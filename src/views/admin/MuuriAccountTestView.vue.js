import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import { AccountService } from "../../services/AccountService";
import { debugLog, infoLog, errorLog } from "../../utils/logger";
import { Icon } from "@iconify/vue";
import Muuri from "muuri";
import AccountGroupCard from "../../components/account/AccountGroupCard.vue";
// Stores
const accountStore = useAccountStore();
// Muuri-Instanzen für Kontogruppen-Sortierung
const groupsGrid = ref(null);
const groupsContainer = ref(null);
// Refs für AccountGroupCard-Komponenten
const accountGroupCardRefs = ref([]);
// Debouncing für sortOrder-Updates
const sortOrderUpdateTimer = ref(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500;
// Computed properties
const accountGroups = computed(() => {
    return [...accountStore.accountGroups].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
});
// Lifecycle Hooks
onMounted(async () => {
    await nextTick();
    // Warte bis AccountGroupCards geladen sind, dann initialisiere Gruppen-Grid
    setTimeout(() => {
        initializeGroupsGrid();
    }, 500);
    infoLog("MuuriAccountTestView", "Komponente geladen");
});
onBeforeUnmount(() => {
    destroyGroupsGrid();
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    debugLog("MuuriAccountTestView", "Komponente wird zerstört");
});
// Muuri-Grid für Kontogruppen-Sortierung
const initializeGroupsGrid = () => {
    if (!groupsContainer.value) {
        debugLog("MuuriAccountTestView", "Groups container nicht verfügbar");
        return;
    }
    try {
        groupsGrid.value = new Muuri(groupsContainer.value, {
            items: ".account-group-wrapper",
            dragEnabled: true,
            dragHandle: ".group-drag-handle", // Spezifischer Handle für Gruppen
            layout: {
                fillGaps: false,
                horizontal: false,
                alignRight: false,
                alignBottom: false,
                rounding: false,
            },
            layoutDuration: 300,
            layoutEasing: "ease",
            dragStartPredicate: {
                distance: 10,
                delay: 0,
            },
        });
        groupsGrid.value.on("dragEnd", handleGroupDragEnd);
        infoLog("MuuriAccountTestView", "Kontogruppen-Grid erfolgreich initialisiert");
    }
    catch (error) {
        errorLog("MuuriAccountTestView", "Fehler bei Kontogruppen-Grid-Initialisierung", error);
    }
};
const destroyGroupsGrid = () => {
    if (groupsGrid.value) {
        groupsGrid.value.destroy();
        groupsGrid.value = null;
    }
};
// Drag-Handler für Kontogruppen
const handleGroupDragEnd = async (item) => {
    if (!groupsGrid.value)
        return;
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    sortOrderUpdateTimer.value = setTimeout(async () => {
        try {
            const sortedItems = groupsGrid.value.getItems();
            const sortedGroupIds = [];
            sortedItems.forEach((sortedItem) => {
                const element = sortedItem.getElement();
                const groupId = element?.getAttribute("data-group-id");
                if (groupId) {
                    sortedGroupIds.push(groupId);
                }
            });
            debugLog("MuuriAccountTestView", "Neue Kontogruppen-Reihenfolge", sortedGroupIds);
            // Erzeuge Sortier-Updates aus der neuen Reihenfolge und speichere sie
            const sortOrderUpdates = sortedGroupIds.map((id, index) => ({
                id,
                sortOrder: index,
            }));
            await AccountService.updateAccountGroupOrder(sortOrderUpdates);
            const success = true;
            if (success) {
                infoLog("MuuriAccountTestView", "Kontogruppen-Sortierung erfolgreich aktualisiert");
            }
            else {
                errorLog("MuuriAccountTestView", "Fehler beim Aktualisieren der Kontogruppen-Sortierung");
            }
        }
        catch (error) {
            errorLog("MuuriAccountTestView", "Fehler beim Aktualisieren der Kontogruppen-Sortierung", error);
        }
    }, SORT_ORDER_DEBOUNCE_DELAY);
};
// Layout-Update-Funktion für AccountGroupCard-Events
const refreshGroupsLayout = () => {
    if (groupsGrid.value) {
        groupsGrid.value.refreshItems().layout();
    }
    debugLog("MuuriAccountTestView", "Layout-Update durchgeführt");
};
// Account Selection Handler
const onAccountSelect = (account) => {
    debugLog("MuuriAccountTestView", "Account selected", account);
};
// Reconcile Handler
const startReconcile = (account) => {
    debugLog("MuuriAccountTestView", "Start reconcile for account", account);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['account-group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['account-group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['account-group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "p-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full justify-between items-center mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-sm text-base-content/60" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "groupsContainer",
    ...{ class: "space-y-4" },
});
/** @type {typeof __VLS_ctx.groupsContainer} */ ;
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.accountGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (group.id),
        'data-group-id': (group.id),
        ...{ class: "account-group-wrapper" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "group-drag-handle flex items-center justify-center w-full h-6 cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 transition-colors mb-2" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:drag-horizontal",
        ...{ class: "text-lg" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:drag-horizontal",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs ml-2" },
    });
    /** @type {[typeof AccountGroupCard, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(AccountGroupCard, new AccountGroupCard({
        ...{ 'onSelectAccount': {} },
        ...{ 'onReconcileAccount': {} },
        ...{ 'onRequestLayoutUpdate': {} },
        ref: ((el) => { if (el)
            __VLS_ctx.accountGroupCardRefs.push(el); }),
        group: (group),
        activeAccountId: (''),
    }));
    const __VLS_5 = __VLS_4({
        ...{ 'onSelectAccount': {} },
        ...{ 'onReconcileAccount': {} },
        ...{ 'onRequestLayoutUpdate': {} },
        ref: ((el) => { if (el)
            __VLS_ctx.accountGroupCardRefs.push(el); }),
        group: (group),
        activeAccountId: (''),
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    let __VLS_7;
    let __VLS_8;
    let __VLS_9;
    const __VLS_10 = {
        onSelectAccount: (__VLS_ctx.onAccountSelect)
    };
    const __VLS_11 = {
        onReconcileAccount: (__VLS_ctx.startReconcile)
    };
    const __VLS_12 = {
        onRequestLayoutUpdate: (__VLS_ctx.refreshGroupsLayout)
    };
    var __VLS_6;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mt-8 p-4 bg-base-200 rounded-lg" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "text-lg font-semibold mb-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-sm space-y-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
(__VLS_ctx.accountGroups.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
(__VLS_ctx.groupsGrid ? "Ja" : "Nein");
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
(__VLS_ctx.accountGroupCardRefs.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-xs text-base-content/60 mt-2" },
});
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['account-group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
/** @type {__VLS_StyleScopedClasses['active:cursor-grabbing']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/40']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            AccountGroupCard: AccountGroupCard,
            groupsGrid: groupsGrid,
            groupsContainer: groupsContainer,
            accountGroupCardRefs: accountGroupCardRefs,
            accountGroups: accountGroups,
            refreshGroupsLayout: refreshGroupsLayout,
            onAccountSelect: onAccountSelect,
            startReconcile: startReconcile,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
