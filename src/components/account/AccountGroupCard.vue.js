import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick, } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import AccountCard from "./AccountCard.vue";
import AccountGroupForm from "./AccountGroupForm.vue";
import { AccountService } from "../../services/AccountService";
import { useTenantStore } from "../../stores/tenantStore";
import { ImageService } from "../../services/ImageService";
import { Icon } from "@iconify/vue";
import Muuri from "muuri";
import { debugLog, infoLog, errorLog } from "../../utils/logger";
// Globale Registry für alle Muuri-Instanzen (für Inter-Group-Drag)
const muuriRegistry = new Set();
const emit = defineEmits(["selectAccount", "request-layout-update"]);
const props = defineProps();
const accountStore = useAccountStore();
// State für Modal
const showEditModal = ref(false);
// Muuri-Instanz für diese Kontogruppe
const muuriGrid = ref(null);
const gridContainer = ref(null);
const displayLogoSrc = ref(null);
// Logo laden
const loadDisplayLogo = async () => {
    const logoPath = props.group.logo_path;
    if (!logoPath) {
        displayLogoSrc.value = null;
        return;
    }
    // Zuerst Cache abfragen über TenantDbService für Konsistenz
    const activeTenantDB = useTenantStore().activeTenantDB;
    if (activeTenantDB) {
        const cachedLogo = await activeTenantDB.logoCache.get(logoPath);
        if (cachedLogo?.data) {
            displayLogoSrc.value = cachedLogo.data;
            return; // Logo im Cache gefunden, keine Netzwerkanfrage nötig
        }
    }
    // Nur wenn nicht im Cache: Netzwerkanfrage an Backend
    try {
        const dataUrl = await ImageService.fetchAndCacheLogo(logoPath);
        if (dataUrl) {
            displayLogoSrc.value = dataUrl;
            debugLog("AccountGroupCard", `Logo erfolgreich geladen für Gruppe ${props.group.name}`, { logoPath });
        }
        else {
            displayLogoSrc.value = null;
            debugLog("AccountGroupCard", `Kein Logo verfügbar für Gruppe ${props.group.name}`, { logoPath });
        }
    }
    catch (error) {
        errorLog("AccountGroupCard", `Fehler beim Laden des Logos für Gruppe ${props.group.name}`, { logoPath, error });
        displayLogoSrc.value = null;
    }
};
watch(() => props.group.logo_path, async (newLogoPath, oldLogoPath) => {
    if (newLogoPath !== oldLogoPath) {
        await loadDisplayLogo();
    }
}, { immediate: false });
onMounted(async () => {
    await loadDisplayLogo();
    await nextTick(); // Warten bis DOM gerendert ist
    initializeMuuri();
});
onBeforeUnmount(() => {
    destroyMuuri();
});
// Konten der Gruppe (gefiltert und nach sortOrder sortiert)
const accountsInGroup = computed(() => accountStore.accounts
    .filter((account) => account.accountGroupId === props.group.id && account.isActive)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
// Saldo der Gruppe (Service)
const groupBalance = computed(() => {
    const balances = AccountService.getGroupBalances();
    return balances[props.group.id] ?? 0;
});
// Anzahl Konten
const accountCount = computed(() => accountsInGroup.value.length);
// Gruppe löschen
const deleteAccountGroup = async () => {
    if (confirm(`Möchtest Du die Gruppe "${props.group.name}" wirklich löschen?`)) {
        try {
            debugLog("AccountGroupCard", `Lösche Kontogruppe ${props.group.name}`, {
                groupId: props.group.id,
            });
            await accountStore.deleteAccountGroup(props.group.id);
            infoLog("AccountGroupCard", `Kontogruppe ${props.group.name} erfolgreich gelöscht`, { groupId: props.group.id });
        }
        catch (error) {
            errorLog("AccountGroupCard", `Fehler beim Löschen der Kontogruppe ${props.group.name}`, { groupId: props.group.id, error });
        }
    }
};
// Modal Handler
const onGroupSaved = async (groupData) => {
    showEditModal.value = false;
    try {
        debugLog("AccountGroupCard", `Aktualisiere Kontogruppe ${props.group.name}`, { groupId: props.group.id, groupData });
        await AccountService.updateAccountGroup(props.group.id, groupData);
        infoLog("AccountGroupCard", `Kontogruppe ${props.group.name} erfolgreich aktualisiert`, { groupId: props.group.id });
    }
    catch (error) {
        errorLog("AccountGroupCard", `Fehler beim Aktualisieren der Kontogruppe ${props.group.name}`, { groupId: props.group.id, error });
    }
};
// Account Selection Handler
const onAccountSelect = (account) => emit("selectAccount", account);
// Muuri-Initialisierung
const initializeMuuri = () => {
    if (!gridContainer.value) {
        debugLog("AccountGroupCard", `Grid-Container nicht verfügbar für Gruppe ${props.group.name}`, { groupId: props.group.id });
        return;
    }
    try {
        debugLog("AccountGroupCard", `Initialisiere Muuri für Gruppe ${props.group.name}`, { groupId: props.group.id });
        muuriGrid.value = new Muuri(gridContainer.value, {
            items: ".account-item",
            dragEnabled: true,
            dragHandle: ".drag-handle",
            dragAxis: "y", // Beschränke Drag auf vertikale Achse
            dragSort: function () {
                // Alle anderen Muuri-Instanzen für Inter-Group-Drag zurückgeben
                return Array.from(muuriRegistry).filter((grid) => grid !== this);
            },
            dragSortHeuristics: {
                sortInterval: 100,
                minDragDistance: 10,
                minBounceBackAngle: 1,
            },
            dragSortPredicate: {
                threshold: 50,
                action: "move",
            },
            layout: {
                fillGaps: false,
                horizontal: false, // Vertikales Layout
                alignRight: false,
                alignBottom: false,
                rounding: false,
            },
            layoutDuration: 300,
            layoutEasing: "ease",
        });
        // Instanz zur Registry hinzufügen
        muuriRegistry.add(muuriGrid.value);
        debugLog("AccountGroupCard", `Muuri-Instanz zur Registry hinzugefügt für Gruppe ${props.group.name}`, { registrySize: muuriRegistry.size });
        // Event-Listener für Drag-End
        muuriGrid.value.on("dragEnd", handleDragEnd);
        // Event-Listener für Layout-End - signalisiert Größenänderung an Parent
        muuriGrid.value.on("layoutEnd", () => {
            debugLog("AccountGroupCard", `Layout-Update angefordert für Gruppe ${props.group.name}`);
            emit("request-layout-update");
        });
        infoLog("AccountGroupCard", `Muuri erfolgreich initialisiert für Gruppe ${props.group.name}`, { groupId: props.group.id });
    }
    catch (error) {
        errorLog("AccountGroupCard", "Fehler bei Muuri-Initialisierung", error);
    }
};
// Muuri-Cleanup
const destroyMuuri = () => {
    if (muuriGrid.value) {
        debugLog("AccountGroupCard", `Zerstöre Muuri für Gruppe ${props.group.name}`, { groupId: props.group.id });
        // Aus Registry entfernen
        muuriRegistry.delete(muuriGrid.value);
        muuriGrid.value.destroy();
        muuriGrid.value = null;
        debugLog("AccountGroupCard", `Muuri erfolgreich zerstört für Gruppe ${props.group.name}`, { registrySize: muuriRegistry.size });
    }
};
// Drag-End Handler - Subtasks 1.1 & 1.2: Inter-Group vs. Intra-Group Erkennung und Ziel-Grid-Extraktion
const handleDragEnd = async (item, event) => {
    debugLog("AccountGroupCard", "Drag ended", { item, event });
    // Subtask 1.1: Erkennung von Inter-Group vs. Intra-Group Bewegungen
    const draggedElement = item.getElement();
    const draggedAccountId = draggedElement?.getAttribute("data-account-id");
    if (!draggedAccountId) {
        errorLog("AccountGroupCard", "Keine Account-ID im gedragten Element gefunden", { element: draggedElement });
        return;
    }
    // Bestimme das Quell-Grid (diese Muuri-Instanz)
    const sourceGrid = muuriGrid.value;
    if (!sourceGrid) {
        errorLog("AccountGroupCard", "Quell-Grid nicht verfügbar");
        return;
    }
    // Subtask 1.2: Extraktion der Ziel-Grid-Information aus Muuri-Event
    let targetGrid = sourceGrid; // Default: Intra-Group
    let targetGroupId = props.group.id; // Default: aktuelle Gruppe
    let targetGridContainer = null;
    // Prüfe verschiedene Quellen für Ziel-Grid-Information
    if (item._dragSort?.targetGrid) {
        // Primäre Quelle: Muuri's dragSort-Mechanismus
        targetGrid = item._dragSort.targetGrid;
        targetGridContainer = targetGrid.getElement();
    }
    else if (item._drag?.targetGrid) {
        // Alternative Quelle: Drag-Objekt
        targetGrid = item._drag.targetGrid;
        targetGridContainer = targetGrid.getElement();
    }
    else if (event?.targetGrid) {
        // Event-basierte Quelle
        targetGrid = event.targetGrid;
        targetGridContainer = targetGrid.getElement();
    }
    // Extrahiere Ziel-Gruppen-ID aus dem Grid-Container
    if (targetGridContainer && targetGrid !== sourceGrid) {
        // Suche nach dem übergeordneten AccountGroupCard-Element
        let groupElement = targetGridContainer.closest("[data-group-id]");
        if (!groupElement) {
            // Fallback: Suche in der DOM-Hierarchie nach Gruppe
            groupElement = targetGridContainer.closest(".card");
            if (groupElement) {
                // Versuche Gruppen-ID aus verschiedenen Attributen zu extrahieren
                const possibleGroupId = groupElement.getAttribute("data-group-id") ||
                    groupElement
                        .querySelector("[data-group-id]")
                        ?.getAttribute("data-group-id");
                if (possibleGroupId) {
                    targetGroupId = possibleGroupId;
                }
            }
        }
        else {
            targetGroupId =
                groupElement.getAttribute("data-group-id") || props.group.id;
        }
        // Zusätzliche Validierung: Suche in der Muuri-Registry
        Array.from(muuriRegistry).forEach((registeredGrid) => {
            if (registeredGrid === targetGrid) {
                const registeredContainer = registeredGrid.getElement();
                const registeredGroupElement = registeredContainer?.closest("[data-group-id]");
                if (registeredGroupElement) {
                    const registeredGroupId = registeredGroupElement.getAttribute("data-group-id");
                    if (registeredGroupId) {
                        targetGroupId = registeredGroupId;
                    }
                }
            }
        });
    }
    // Prüfe, ob es sich um eine Inter-Group oder Intra-Group Bewegung handelt
    const isInterGroupMove = targetGrid !== sourceGrid && targetGroupId !== props.group.id;
    debugLog("AccountGroupCard", "Drag-Operation Details", {
        draggedAccountId,
        sourceGroupId: props.group.id,
        targetGroupId,
        isInterGroupMove,
        sourceGrid: sourceGrid,
        targetGrid: targetGrid,
        targetGridContainer: targetGridContainer,
        dragSortInfo: item._dragSort,
        dragInfo: item._drag,
    });
    if (isInterGroupMove) {
        debugLog("AccountGroupCard", `Inter-Group Bewegung erkannt: ${props.group.id} → ${targetGroupId}`);
        // Subtask 1.3: Bestimmung der neuen Position im Ziel-Grid
        let newIndex = 0; // Default: An den Anfang
        if (targetGrid && targetGrid !== sourceGrid) {
            // Hole alle Items aus dem Ziel-Grid in ihrer aktuellen Reihenfolge
            const targetItems = targetGrid.getItems();
            // Finde die Position des gedragten Elements im Ziel-Grid
            const draggedItemInTarget = targetItems.find((targetItem) => targetItem.getElement() === draggedElement);
            if (draggedItemInTarget) {
                // Element wurde bereits in das Ziel-Grid eingefügt - finde seine Position
                newIndex = targetItems.indexOf(draggedItemInTarget);
            }
            else {
                // Fallback: Verwende die Anzahl der Items im Ziel-Grid (ans Ende)
                newIndex = targetItems.length;
            }
            debugLog("AccountGroupCard", "Ziel-Grid Position Details", {
                targetItems: targetItems.length,
                newIndex,
                draggedItemFound: !!draggedItemInTarget,
            });
        }
        debugLog("AccountGroupCard", `Inter-Group Position bestimmt: Index ${newIndex} in Gruppe ${targetGroupId}`);
        // Subtask 1.4: Service-Methoden aufrufen
        try {
            await AccountService.moveAccountToGroup(draggedAccountId, targetGroupId, newIndex);
            infoLog("AccountGroupCard", `Inter-Group Bewegung erfolgreich: Konto ${draggedAccountId} zu Gruppe ${targetGroupId} an Position ${newIndex}`);
        }
        catch (error) {
            errorLog("AccountGroupCard", "Fehler bei Inter-Group Bewegung", error);
            // Bei Fehler: Muuri-Layout zurücksetzen
            if (sourceGrid) {
                sourceGrid.refreshItems();
                sourceGrid.layout();
            }
            if (targetGrid && targetGrid !== sourceGrid) {
                targetGrid.refreshItems();
                targetGrid.layout();
            }
        }
    }
    else {
        // Intra-Group Bewegung - bestehende Logik beibehalten
        debugLog("AccountGroupCard", "Intra-Group Bewegung erkannt - verwende bestehende Logik");
        // Neue Reihenfolge der DOM-Elemente aus der Muuri-Instanz abrufen
        const sortedItems = sourceGrid.getItems();
        debugLog("AccountGroupCard", "Sortierte Elemente nach Drag-End", sortedItems);
        if (sortedItems) {
            // Account-IDs in der neuen Reihenfolge extrahieren
            const sortedAccountIds = [];
            sortedItems.forEach((sortedItem) => {
                // data-account-id aus DOM-Element extrahieren
                const element = sortedItem.getElement();
                const accountId = element?.getAttribute("data-account-id");
                if (accountId) {
                    sortedAccountIds.push(accountId);
                }
            });
            debugLog("AccountGroupCard", "Neue Account-Reihenfolge (IDs)", sortedAccountIds);
            // Subtask 1.4: Service-Methoden aufrufen für Intra-Group Bewegungen
            try {
                await AccountService.updateAccountOrder(props.group.id, sortedAccountIds);
                infoLog("AccountGroupCard", "Account-Sortierung erfolgreich über AccountService aktualisiert");
            }
            catch (error) {
                errorLog("AccountGroupCard", "Fehler beim Aktualisieren der Account-Sortierung", error);
                // Bei Fehler: Muuri-Layout zurücksetzen
                if (sourceGrid) {
                    sourceGrid.refreshItems();
                    sourceGrid.layout();
                }
            }
        }
    }
};
// Explizite Layout-Aktualisierung (für externe Aufrufe)
const refreshLayout = async () => {
    if (muuriGrid.value) {
        debugLog("AccountGroupCard", `Explizite Layout-Aktualisierung für Gruppe ${props.group.name}`, { groupId: props.group.id });
        await nextTick();
        // Prüfe auf neue Items, die noch nicht zu Muuri hinzugefügt wurden
        const newElements = gridContainer.value?.querySelectorAll(".account-item:not(.muuri-item)");
        if (newElements && newElements.length > 0) {
            debugLog("AccountGroupCard", `Füge ${newElements.length} neue Items zu Muuri hinzu`, { groupId: props.group.id });
            muuriGrid.value.add(newElements, { layout: false });
        }
        muuriGrid.value.refreshItems();
        muuriGrid.value.layout();
        // Signalisiere Layout-Update an Parent
        emit("request-layout-update");
    }
};
// Expose refreshLayout für Parent-Component
const __VLS_exposed = {
    refreshLayout,
};
defineExpose(__VLS_exposed);
// Watch für Änderungen der Konten-Anzahl (für automatisches Layout-Update)
watch(accountCount, async (newCount, oldCount) => {
    if (muuriGrid.value && newCount !== oldCount) {
        debugLog("AccountGroupCard", `Automatisches Layout-Update für Gruppe ${props.group.name}`, { groupId: props.group.id, oldCount, newCount });
        await nextTick(); // Warten bis DOM aktualisiert ist
        if (newCount > oldCount) {
            // Neue Items hinzugefügt - Muuri muss neue Items erkennen
            debugLog("AccountGroupCard", `Neue Konten hinzugefügt - füge Items zu Muuri hinzu`, { groupId: props.group.id, newItems: newCount - oldCount });
            // Neue Items zu Muuri hinzufügen
            const newItems = muuriGrid.value.add(gridContainer.value?.querySelectorAll(".account-item:not(.muuri-item)") || [], { layout: false } // Layout manuell triggern
            );
            debugLog("AccountGroupCard", `${newItems.length} neue Items zu Muuri hinzugefügt`, { groupId: props.group.id, newItemsCount: newItems.length });
        }
        else {
            // Items entfernt - refreshItems reicht
            muuriGrid.value.refreshItems();
        }
        // Layout neu berechnen
        muuriGrid.value.layout();
        // Signalisiere Layout-Update an Parent
        emit("request-layout-update");
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['account-item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-item']} */ ;
/** @type {__VLS_StyleScopedClasses['item-content']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "item-content" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card glass-effect bg-none border border-base-300 shadow-md relative" },
    'data-group-id': (__VLS_ctx.group.id),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dropdown dropdown-end absolute top-1 right-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    tabindex: "0",
    ...{ class: "btn btn-ghost btn-sm btn-circle border-none" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:dots-vertical",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:dots-vertical",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    tabindex: "0",
    ...{ class: "dropdown-content menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-52" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showEditModal = true;
        } },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (__VLS_ctx.deleteAccountGroup) },
    ...{ class: "text-error" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body flex flex-row p-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "drag-handle flex items-center cursor-move" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:drag-vertical",
    ...{ class: "w-12 h-12 text-base-content opacity-30 mr-0" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:drag-vertical",
    ...{ class: "w-12 h-12 text-base-content opacity-30 mr-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "p-0 w-24" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-12 h-12 rounded-md overflow-hidden flex items-center justify-center bg-base-200 opacity-80" },
});
if (__VLS_ctx.displayLogoSrc) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.displayLogoSrc),
        alt: (props.group.name + ' Logo'),
        ...{ class: "w-full h-full object-cover" },
    });
}
else {
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:folder-multiple-outline",
        ...{ class: "w-8 h-8 text-base-content opacity-50" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:folder-multiple-outline",
        ...{ class: "w-8 h-8 text-base-content opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col md:flex-row w-full mr-1 ml-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "self-start flex-grow md:self-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "text-lg opacity-50 font-semibold" },
});
(__VLS_ctx.group.name);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col md:flex-row w-full mr-1 ml-1 justify-end" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "self-start w-full md:self-center md:w-25 flex items-center md:justify-end" },
});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    ...{ class: "text-base" },
    amount: (__VLS_ctx.groupBalance),
    showZero: (true),
    asInteger: (true),
}));
const __VLS_13 = __VLS_12({
    ...{ class: "text-base" },
    amount: (__VLS_ctx.groupBalance),
    showZero: (true),
    asInteger: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
const __VLS_15 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
    icon: "mdi:scale-balance",
    ...{ class: "text-secondary text-base opacity-50 ml-2" },
}));
const __VLS_17 = __VLS_16({
    icon: "mdi:scale-balance",
    ...{ class: "text-secondary text-base opacity-50 ml-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body py-0 px-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "gridContainer",
    ...{ class: "muuri-grid accounts-container" },
});
/** @type {typeof __VLS_ctx.gridContainer} */ ;
for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accountsInGroup))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (account.id),
        ...{ class: "account-item" },
        'data-account-id': (account.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "item-content" },
    });
    /** @type {[typeof AccountCard, ]} */ ;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent(AccountCard, new AccountCard({
        ...{ 'onSelect': {} },
        account: (account),
        active: (__VLS_ctx.activeAccountId === account.id),
    }));
    const __VLS_20 = __VLS_19({
        ...{ 'onSelect': {} },
        account: (account),
        active: (__VLS_ctx.activeAccountId === account.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    let __VLS_22;
    let __VLS_23;
    let __VLS_24;
    const __VLS_25 = {
        onSelect: (__VLS_ctx.onAccountSelect)
    };
    var __VLS_21;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-actions py-4 px-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 gap-1" },
});
const __VLS_26 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent(__VLS_26, new __VLS_26({
    to: "body",
}));
const __VLS_28 = __VLS_27({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
__VLS_29.slots.default;
if (__VLS_ctx.showEditModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof AccountGroupForm, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(AccountGroupForm, new AccountGroupForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        group: (__VLS_ctx.group),
        isEdit: (true),
    }));
    const __VLS_31 = __VLS_30({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        group: (__VLS_ctx.group),
        isEdit: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    let __VLS_33;
    let __VLS_34;
    let __VLS_35;
    const __VLS_36 = {
        onSave: (__VLS_ctx.onGroupSaved)
    };
    const __VLS_37 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showEditModal))
                return;
            __VLS_ctx.showEditModal = false;
        }
    };
    var __VLS_32;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditModal))
                    return;
                __VLS_ctx.showEditModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
var __VLS_29;
/** @type {__VLS_StyleScopedClasses['item-content']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['glass-effect']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-none']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-end']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1']} */ ;
/** @type {__VLS_StyleScopedClasses['right-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-content']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-52']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-move']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-30']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-0']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['self-start']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['md:self-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['self-start']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['md:self-center']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-25']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['md:justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['accounts-container']} */ ;
/** @type {__VLS_StyleScopedClasses['account-item']} */ ;
/** @type {__VLS_StyleScopedClasses['item-content']} */ ;
/** @type {__VLS_StyleScopedClasses['card-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            AccountCard: AccountCard,
            AccountGroupForm: AccountGroupForm,
            Icon: Icon,
            showEditModal: showEditModal,
            gridContainer: gridContainer,
            displayLogoSrc: displayLogoSrc,
            accountsInGroup: accountsInGroup,
            groupBalance: groupBalance,
            deleteAccountGroup: deleteAccountGroup,
            onGroupSaved: onGroupSaved,
            onAccountSelect: onAccountSelect,
        };
    },
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
