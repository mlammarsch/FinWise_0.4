import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';
import { AccountService } from '../../services/AccountService';
import { debugLog, errorLog } from '../../utils/logger';
const dragContainer = ref();
const metaGrid = ref(null);
const subGrids = ref([]);
// Reale Daten aus AccountService
const accountGroups = AccountService.getAllAccountGroups();
const accountsByGroup = computed(() => {
    const grouped = {};
    for (const group of accountGroups) {
        grouped[group.id] = AccountService.getAllAccounts()
            .filter(a => a.accountGroupId === group.id)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    return grouped;
});
// Expand/Collapse State für jede Gruppe (dynamisch basierend auf echten Daten)
const expandedGroups = ref({});
// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref(null);
// Debouncing für Sort Order Updates
const sortOrderUpdateTimer = ref(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500; // 500ms Debounce
// Sortierte Kontogruppen nach sortOrder
const sortedAccountGroups = computed(() => {
    return accountGroups.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
});
// Icon-Mapping für Kontogruppen (einheitliches Ordnersymbol)
function getGroupIcon(group) {
    return 'mdi:folder-outline';
}
// Icon-Farbe für Kontogruppen (einheitlich in base-content)
function getGroupColor(group) {
    return 'text-base-content';
}
// Konten für eine Gruppe (sortiert nach sortOrder)
function getAccountsForGroup(groupId) {
    const accounts = accountsByGroup.value[groupId] || [];
    return accounts
        .slice()
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}
onMounted(async () => {
    // Expand-State für alle Gruppen initialisieren
    for (const group of accountGroups) {
        expandedGroups.value[group.id] = true;
    }
    await nextTick();
    initializeGrids();
});
onUnmounted(() => {
    destroyGrids();
    // Timer aufräumen
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    if (autoExpandTimer.value) {
        clearTimeout(autoExpandTimer.value);
    }
});
function initializeGrids() {
    try {
        // Sub-Grids für Konten mit korrekter Kanban-Logik
        const subGridElements = document.querySelectorAll('.accounts-content');
        subGridElements.forEach(el => {
            const grid = new Muuri(el, {
                items: '.account-item',
                dragEnabled: true,
                dragHandle: '.account-drag-area',
                dragContainer: dragContainer.value,
                dragSort: function () {
                    return subGrids.value;
                },
                // Kanban-CSS-Properties für korrektes Dragging
                dragCssProps: {
                    touchAction: 'auto',
                    userSelect: 'none',
                    userDrag: 'none',
                    tapHighlightColor: 'rgba(0, 0, 0, 0)',
                    touchCallout: 'none',
                    contentZooming: 'none'
                },
                dragAutoScroll: {
                    targets: (item) => {
                        return [
                            { element: window, priority: 0 },
                            { element: item.getGrid().getElement().parentNode, priority: 1 },
                        ];
                    }
                },
            })
                .on('dragInit', function (item) {
                const element = item.getElement();
                if (element) {
                    element.style.width = item.getWidth() + 'px';
                    element.style.height = item.getHeight() + 'px';
                }
            })
                .on('dragReleaseEnd', function (item) {
                const element = item.getElement();
                const grid = item.getGrid();
                if (element) {
                    element.style.width = '';
                    element.style.height = '';
                }
                if (grid) {
                    grid.refreshItems([item]);
                }
            })
                .on('layoutStart', function () {
                if (metaGrid.value) {
                    metaGrid.value.refreshItems().layout();
                }
            })
                .on('dragStart', function (item) {
                // Auto-Expand bei Drag-Over über eingeklappte Gruppen
                setupAutoExpand();
            })
                .on('dragEnd', function (item) {
                // Auto-Expand Timer aufräumen
                clearAutoExpandTimer();
                // Sort Order Update mit Debouncing
                handleAccountDragEnd(item);
            });
            subGrids.value.push(grid);
        });
        // Meta-Grid für Lebensbereiche (mit gleicher Kanban-Logik)
        metaGrid.value = new Muuri('.muuri-container', {
            items: '.group-wrapper',
            dragEnabled: true,
            dragHandle: '.group-drag-handle',
            dragContainer: dragContainer.value,
            // Gleiche CSS Properties wie bei den Kategorien
            dragCssProps: {
                touchAction: 'auto',
                userSelect: 'none',
                userDrag: 'none',
                tapHighlightColor: 'rgba(0, 0, 0, 0)',
                touchCallout: 'none',
                contentZooming: 'none'
            },
            dragAutoScroll: {
                targets: (item) => {
                    return [
                        { element: window, priority: 0 },
                        { element: item.getGrid().getElement().parentNode, priority: 1 },
                    ];
                }
            },
            layout: {
                fillGaps: false,
                horizontal: false,
                alignRight: false,
                alignBottom: false
            },
            layoutDuration: 300,
            layoutEasing: 'ease'
        })
            .on('dragInit', function (item) {
            const element = item.getElement();
            if (element) {
                element.style.width = item.getWidth() + 'px';
                element.style.height = item.getHeight() + 'px';
            }
        })
            .on('dragReleaseEnd', function (item) {
            const element = item.getElement();
            const grid = item.getGrid();
            if (element) {
                element.style.width = '';
                element.style.height = '';
            }
            if (grid) {
                grid.refreshItems([item]);
            }
        })
            .on('dragEnd', function (item) {
            // Sort Order Update für AccountGroups mit Debouncing
            handleAccountGroupDragEnd(item);
        });
        console.log('Muuri grids initialized successfully');
    }
    catch (error) {
        console.error('Failed to initialize Muuri grids', error);
    }
}
function destroyGrids() {
    try {
        subGrids.value.forEach(grid => {
            if (grid) {
                grid.destroy();
            }
        });
        subGrids.value = [];
        if (metaGrid.value) {
            metaGrid.value.destroy();
            metaGrid.value = null;
        }
        console.log('Muuri grids destroyed');
    }
    catch (error) {
        console.error('Failed to destroy Muuri grids', error);
    }
}
// Expand/Collapse Funktionen
function toggleGroup(groupId) {
    expandedGroups.value[groupId] = !expandedGroups.value[groupId];
    // Layout nach Zustandsänderung aktualisieren
    nextTick(() => {
        updateLayoutAfterToggle();
    });
}
function updateLayoutAfterToggle() {
    // Alle Sub-Grids refreshen
    subGrids.value.forEach(grid => {
        if (grid) {
            grid.refreshItems();
            grid.layout(true);
        }
    });
    // Meta-Grid refreshen
    if (metaGrid.value) {
        metaGrid.value.refreshItems();
        metaGrid.value.layout(true);
    }
}
// Auto-Expand bei Drag-Over
function setupAutoExpand() {
    // Event Listener für Drag-Over auf Gruppen-Header
    document.addEventListener('dragover', handleDragOverGroup);
}
function handleDragOverGroup(event) {
    const target = event.target;
    const groupHeader = target.closest('.group-header');
    if (groupHeader) {
        const groupWrapper = groupHeader.closest('.group-wrapper');
        const groupId = groupWrapper?.getAttribute('data-group-id');
        if (groupId && !expandedGroups.value[groupId]) {
            // Timer für Auto-Expand setzen (1 Sekunde Verzögerung)
            clearAutoExpandTimer();
            autoExpandTimer.value = setTimeout(() => {
                expandedGroups.value[groupId] = true;
                nextTick(() => {
                    updateLayoutAfterToggle();
                });
            }, 1000);
        }
    }
}
function clearAutoExpandTimer() {
    if (autoExpandTimer.value) {
        clearTimeout(autoExpandTimer.value);
        autoExpandTimer.value = null;
    }
    document.removeEventListener('dragover', handleDragOverGroup);
}
// Drag & Drop Persistierung für Konten
function handleAccountDragEnd(item) {
    // Debouncing: Vorherigen Timer löschen
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    sortOrderUpdateTimer.value = setTimeout(async () => {
        try {
            const draggedElement = item.getElement();
            const accountId = draggedElement.getAttribute('data-account-id');
            if (!accountId) {
                errorLog('MuuriTestView', 'handleAccountDragEnd - Account ID not found');
                return;
            }
            // Bestimme die neue Gruppe basierend auf dem Container
            const container = draggedElement.closest('.accounts-content');
            const groupWrapper = container?.closest('.group-wrapper');
            const actualGroupId = groupWrapper?.getAttribute('data-group-id');
            if (!actualGroupId) {
                errorLog('MuuriTestView', 'handleAccountDragEnd - Group ID not found');
                return;
            }
            // Hole die neue Reihenfolge direkt vom Muuri-Grid statt vom DOM
            const targetGrid = subGrids.value.find(grid => {
                const gridElement = grid.getElement();
                return gridElement.closest('.group-wrapper')?.getAttribute('data-group-id') === actualGroupId;
            });
            if (!targetGrid) {
                errorLog('MuuriTestView', 'handleAccountDragEnd - Target grid not found', { actualGroupId });
                return;
            }
            // Hole die Items in der aktuellen Muuri-Reihenfolge (ohne Placeholder)
            const items = targetGrid.getItems();
            const newOrder = [];
            items.forEach((item) => {
                const element = item.getElement();
                const id = element.getAttribute('data-account-id');
                // Ignoriere Placeholder-Elemente
                if (id && !element.classList.contains('empty-group-placeholder')) {
                    newOrder.push(id);
                }
            });
            debugLog('MuuriTestView', 'handleAccountDragEnd', {
                accountId,
                actualGroupId,
                newOrder,
                itemsCount: items.length,
                draggedItemPosition: newOrder.indexOf(accountId)
            });
            // Prüfe, ob das Konto in eine andere Gruppe verschoben wurde
            const originalAccount = AccountService.getAllAccounts().find(a => a.id === accountId);
            const originalGroupId = originalAccount?.accountGroupId;
            if (originalGroupId && originalGroupId !== actualGroupId) {
                // Konto wurde zwischen Gruppen verschoben
                const newIndex = newOrder.indexOf(accountId);
                await AccountService.moveAccountToGroup(accountId, actualGroupId, newIndex);
                debugLog('MuuriTestView', 'handleAccountDragEnd - Account moved between groups', {
                    accountId,
                    fromGroup: originalGroupId,
                    toGroup: actualGroupId,
                    newIndex
                });
            }
            else {
                // Konto wurde nur innerhalb der Gruppe neu sortiert
                await AccountService.updateAccountOrder(actualGroupId, newOrder);
                debugLog('MuuriTestView', 'handleAccountDragEnd - Account reordered within group');
            }
            debugLog('MuuriTestView', 'handleAccountDragEnd - Sort order updated successfully');
            // UI-Refresh nach erfolgreichem Update
            await reinitializeMuuriGrids();
        }
        catch (error) {
            errorLog('MuuriTestView', 'handleAccountDragEnd - Error updating sort order', error);
        }
    }, SORT_ORDER_DEBOUNCE_DELAY);
}
// Drag & Drop Persistierung für AccountGroups
function handleAccountGroupDragEnd(item) {
    // Debouncing: Vorherigen Timer löschen
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    sortOrderUpdateTimer.value = setTimeout(async () => {
        try {
            const draggedElement = item.getElement();
            const groupId = draggedElement.getAttribute('data-group-id');
            if (!groupId) {
                errorLog('MuuriTestView', 'handleAccountGroupDragEnd - Group ID not found');
                return;
            }
            // Hole die neue Reihenfolge direkt vom Meta-Grid
            if (!metaGrid.value) {
                errorLog('MuuriTestView', 'handleAccountGroupDragEnd - Meta grid not found');
                return;
            }
            const items = metaGrid.value.getItems();
            const allGroupsInOrder = [];
            items.forEach((item) => {
                const element = item.getElement();
                const id = element.getAttribute('data-group-id');
                if (id)
                    allGroupsInOrder.push(id);
            });
            debugLog('MuuriTestView', 'handleAccountGroupDragEnd', {
                groupId,
                allGroupsInOrder,
                draggedGroupPosition: allGroupsInOrder.indexOf(groupId)
            });
            // Berechne Sort Order Updates
            const sortOrderUpdates = allGroupsInOrder.map((id, index) => ({
                id,
                sortOrder: index
            }));
            // Verwende AccountService für die Sortierung
            await AccountService.updateAccountGroupOrder(sortOrderUpdates);
            debugLog('MuuriTestView', 'handleAccountGroupDragEnd - Sort order updated successfully');
            // UI-Refresh nach erfolgreichem Update
            await reinitializeMuuriGrids();
        }
        catch (error) {
            errorLog('MuuriTestView', 'handleAccountGroupDragEnd - Error updating sort order', error);
        }
    }, SORT_ORDER_DEBOUNCE_DELAY);
}
// UI-Refresh-Funktionen
async function refreshMuuriGrids() {
    try {
        debugLog('MuuriTestView', 'refreshMuuriGrids - Starting UI refresh');
        // Warte kurz, damit die reaktiven Updates von Vue durchgeführt werden
        await nextTick();
        // Alle Sub-Grids refreshen und neu layouten
        subGrids.value.forEach((grid, index) => {
            if (grid) {
                try {
                    grid.refreshItems();
                    grid.layout(true); // force layout
                    debugLog('MuuriTestView', `refreshMuuriGrids - Sub-grid ${index} refreshed`);
                }
                catch (error) {
                    errorLog('MuuriTestView', `refreshMuuriGrids - Error refreshing sub-grid ${index}`, error);
                }
            }
        });
        // Meta-Grid refreshen und neu layouten
        if (metaGrid.value) {
            try {
                metaGrid.value.refreshItems();
                metaGrid.value.layout(true); // force layout
                debugLog('MuuriTestView', 'refreshMuuriGrids - Meta-grid refreshed');
            }
            catch (error) {
                errorLog('MuuriTestView', 'refreshMuuriGrids - Error refreshing meta-grid', error);
            }
        }
        debugLog('MuuriTestView', 'refreshMuuriGrids - UI refresh completed');
    }
    catch (error) {
        errorLog('MuuriTestView', 'refreshMuuriGrids - Error during UI refresh', error);
    }
}
// Alternative: Vollständige Neuinitialisierung der Grids (falls nötig)
async function reinitializeMuuriGrids() {
    try {
        debugLog('MuuriTestView', 'reinitializeMuuriGrids - Starting grid reinitialization');
        // Grids zerstören
        destroyGrids();
        // Warten auf Vue-Updates
        await nextTick();
        // Grids neu initialisieren
        initializeGrids();
        debugLog('MuuriTestView', 'reinitializeMuuriGrids - Grid reinitialization completed');
    }
    catch (error) {
        errorLog('MuuriTestView', 'reinitializeMuuriGrids - Error during grid reinitialization', error);
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['accounts-list']} */ ;
/** @type {__VLS_StyleScopedClasses['account-item']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['account-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['account-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['account-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-group-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['category-name-drag']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-dragging']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-releasing']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "container mx-auto p-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-3xl font-bold text-center mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "dragContainer",
    ...{ class: "drag-container" },
});
/** @type {typeof __VLS_ctx.dragContainer} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "muuri-container bg-base-100 p-4" },
});
for (const [group, index] of __VLS_getVForSourceType((__VLS_ctx.sortedAccountGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (group.id),
        ...{ class: "group-wrapper" },
        'data-group-id': (group.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "account-group-row border-t border-b border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "group-header flex items-center p-1 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:drag-vertical",
        ...{ class: "w-4 h-4 text-base-content/60" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:drag-vertical",
        ...{ class: "w-4 h-4 text-base-content/60" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleGroup(group.id);
            } },
        ...{ class: "flex-shrink-0 mr-3 cursor-pointer hover:bg-base-200 rounded-full p-2 transition-colors" },
        title: "Gruppe ein-/ausklappen",
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: "mdi:chevron-up",
        ...{ class: "w-5 h-5 text-base-content transition-transform duration-300 ease-in-out" },
        ...{ class: ({ 'rotate-180': !__VLS_ctx.expandedGroups[group.id] }) },
    }));
    const __VLS_6 = __VLS_5({
        icon: "mdi:chevron-up",
        ...{ class: "w-5 h-5 text-base-content transition-transform duration-300 ease-in-out" },
        ...{ class: ({ 'rotate-180': !__VLS_ctx.expandedGroups[group.id] }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-shrink-0 mr-2" },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: (__VLS_ctx.getGroupIcon(group)),
        ...{ class: (`w-4 h-4 ${__VLS_ctx.getGroupColor(group)}`) },
    }));
    const __VLS_10 = __VLS_9({
        icon: (__VLS_ctx.getGroupIcon(group)),
        ...{ class: (`w-4 h-4 ${__VLS_ctx.getGroupColor(group)}`) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleGroup(group.id);
            } },
        ...{ class: "flex-grow" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "font-semibold text-sm text-base-content" },
    });
    (group.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-shrink-0 text-xs text-base-content/60" },
    });
    (__VLS_ctx.getAccountsForGroup(group.id).length);
    (__VLS_ctx.getAccountsForGroup(group.id).length === 1 ? 'Konto' : 'Konten');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "accounts-list" },
        ...{ class: ({ 'collapsed': !__VLS_ctx.expandedGroups[group.id] }) },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.expandedGroups[group.id]) }, null, null);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "accounts-content" },
    });
    for (const [account] of __VLS_getVForSourceType((__VLS_ctx.getAccountsForGroup(group.id)))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (account.id),
            ...{ class: "account-item" },
            'data-account-id': (account.id),
            'data-group-id': (group.id),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center p-0 pl-8 bg-base-50 border-b border-base-300 hover:bg-base-100 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "account-drag-area flex items-center flex-grow" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "account-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100" },
        });
        const __VLS_12 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            icon: "mdi:drag-vertical",
            ...{ class: "w-3 h-3 text-base-content/60" },
        }));
        const __VLS_14 = __VLS_13({
            icon: "mdi:drag-vertical",
            ...{ class: "w-3 h-3 text-base-content/60" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-grow account-name-drag" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-xs text-base-content" },
        });
        (account.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-shrink-0 flex items-center space-x-1" },
        });
        if (!account.isActive) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-2 h-2 bg-warning rounded-full" },
                title: "Inaktiv",
            });
        }
        if (account.isOfflineBudget) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-2 h-2 bg-info rounded-full" },
                title: "Offline Budget",
            });
        }
    }
    if (__VLS_ctx.getAccountsForGroup(group.id).length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "empty-group-placeholder account-item" },
            'data-group-id': (group.id),
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center justify-center h-full text-xs text-base-content/40 italic" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mt-6 text-center text-gray-600" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-xs" },
});
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-container']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-container']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['account-group-row']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['ease-in-out']} */ ;
/** @type {__VLS_StyleScopedClasses['rotate-180']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['accounts-list']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['accounts-content']} */ ;
/** @type {__VLS_StyleScopedClasses['account-item']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['account-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['account-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['account-name-drag']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-info']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-group-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['account-item']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/40']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-gray-600']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            dragContainer: dragContainer,
            expandedGroups: expandedGroups,
            sortedAccountGroups: sortedAccountGroups,
            getGroupIcon: getGroupIcon,
            getGroupColor: getGroupColor,
            getAccountsForGroup: getAccountsForGroup,
            toggleGroup: toggleGroup,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
