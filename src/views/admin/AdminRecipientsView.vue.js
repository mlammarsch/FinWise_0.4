import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTransactionStore } from "../../stores/transactionStore";
import { useRuleStore } from "../../stores/ruleStore";
import { usePlanningStore } from "../../stores/planningStore";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import PagingComponent from "../../components/ui/PagingComponent.vue";
import ConfirmationModal from "../../components/ui/ConfirmationModal.vue";
import RecipientBulkActionDropdown from "../../components/ui/RecipientBulkActionDropdown.vue";
import RecipientMergeModal from "../../components/ui/RecipientMergeModal.vue";
import TextInput from "../../components/ui/TextInput.vue";
import { Icon } from "@iconify/vue";
/**
 * Pfad zur Komponente: src/views/admin/AdminRecipientsView.vue
 * Verwaltung der Empfänger/Auftraggeber.
 *
 * Komponenten-Props:
 * - Keine Props vorhanden
 *
 * Emits:
 * - Keine Emits vorhanden
 */
const recipientStore = useRecipientStore();
const transactionStore = useTransactionStore();
const ruleStore = useRuleStore();
const planningStore = usePlanningStore();
const showRecipientModal = ref(false);
const isEditMode = ref(false);
const selectedRecipient = ref(null);
const nameInput = ref("");
const searchQuery = ref("");
const showDeleteConfirm = ref(false);
const deleteTargetId = ref(null);
// Fehlermodal für Löschvalidierung
const showDeleteError = ref(false);
const deleteErrorMessage = ref("");
// Merge-Modal State
const showMergeModal = ref(false);
// Orphan Cleanup Modal State
const showOrphanCleanupModal = ref(false);
const orphanCleanupResult = ref(null);
// Auswahlzustand-Management für Checkbox-Funktionalität
const selectedRecipientIds = ref(new Set());
const lastSelectedIndex = ref(null);
const editingRecipientId = ref(null); // für Inline-Bearbeitung
const currentPage = ref(1);
const itemsPerPage = ref(25);
// Sortierungsstate
const sortField = ref("name");
const sortDirection = ref("asc");
const filteredRecipients = computed(() => {
    let filtered = recipientStore.recipients;
    // Filtern nach Suchbegriff
    if (searchQuery.value.trim() !== "") {
        filtered = filtered.filter((r) => r.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
    }
    // Sortieren
    return [...filtered].sort((a, b) => {
        let aValue;
        let bValue;
        if (sortField.value === "name") {
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
        }
        else if (sortField.value === "usage") {
            aValue = recipientUsage.value(a.id);
            bValue = recipientUsage.value(b.id);
        }
        else if (sortField.value === "planning") {
            aValue = recipientPlanningUsage.value(a.id);
            bValue = recipientPlanningUsage.value(b.id);
        }
        else {
            // rules
            aValue = recipientRuleUsage.value(a.id);
            bValue = recipientRuleUsage.value(b.id);
        }
        let comparison = 0;
        if (aValue < bValue) {
            comparison = -1;
        }
        else if (aValue > bValue) {
            comparison = 1;
        }
        return sortDirection.value === "asc" ? comparison : -comparison;
    });
});
const totalPages = computed(() => {
    if (itemsPerPage.value === "all")
        return 1;
    return Math.ceil(filteredRecipients.value.length / Number(itemsPerPage.value));
});
const paginatedRecipients = computed(() => {
    if (itemsPerPage.value === "all")
        return filteredRecipients.value;
    const start = (currentPage.value - 1) * Number(itemsPerPage.value);
    const end = start + Number(itemsPerPage.value);
    return filteredRecipients.value.slice(start, end);
});
const recipientUsage = computed(() => {
    return (recipientId) => transactionStore.transactions.filter((tx) => tx.recipientId === recipientId)
        .length;
});
const recipientPlanningUsage = computed(() => {
    return (recipientId) => planningStore.planningTransactions.filter((pt) => pt.recipientId === recipientId).length;
});
const recipientRuleUsage = computed(() => {
    return (recipientId) => {
        return ruleStore.rules.filter((rule) => {
            // Prüfe ob der Empfänger in den Bedingungen oder Aktionen der Regel verwendet wird
            const conditions = rule.conditions || [];
            const actions = rule.actions || [];
            // Prüfe Bedingungen auf Empfänger-Referenzen
            const hasRecipientInConditions = conditions.some((condition) => condition.type === "recipient" && condition.value === recipientId);
            // Prüfe Aktionen auf Empfänger-Referenzen
            const hasRecipientInActions = actions.some((action) => action.type === "setRecipient" && action.value === recipientId);
            return hasRecipientInConditions || hasRecipientInActions;
        }).length;
    };
});
// Checkbox-Funktionalität
const toggleRecipientSelection = (recipientId, event) => {
    const currentIndex = paginatedRecipients.value.findIndex((r) => r.id === recipientId);
    if (event?.shiftKey &&
        lastSelectedIndex.value !== null &&
        currentIndex !== -1) {
        handleShiftClick(currentIndex);
    }
    else {
        // Normaler Click: nur aktuellen Recipient togglen
        if (selectedRecipientIds.value.has(recipientId)) {
            selectedRecipientIds.value.delete(recipientId);
        }
        else {
            selectedRecipientIds.value.add(recipientId);
        }
        // lastSelectedIndex für zukünftige Shift-Clicks aktualisieren
        if (currentIndex !== -1) {
            lastSelectedIndex.value = currentIndex;
        }
    }
};
// Shift-Click-Funktionalität für Bereichsauswahl
const handleShiftClick = (currentIndex) => {
    if (lastSelectedIndex.value === null)
        return;
    const startIndex = Math.min(lastSelectedIndex.value, currentIndex);
    const endIndex = Math.max(lastSelectedIndex.value, currentIndex);
    // Bestimme den Auswahlstatus basierend auf dem letzten ausgewählten Element
    const lastSelectedRecipient = paginatedRecipients.value[lastSelectedIndex.value];
    const shouldSelect = selectedRecipientIds.value.has(lastSelectedRecipient.id);
    // Alle Recipients im Bereich auswählen/abwählen
    for (let i = startIndex; i <= endIndex; i++) {
        const recipient = paginatedRecipients.value[i];
        if (recipient) {
            if (shouldSelect) {
                selectedRecipientIds.value.add(recipient.id);
            }
            else {
                selectedRecipientIds.value.delete(recipient.id);
            }
        }
    }
};
const isRecipientSelected = (recipientId) => {
    return selectedRecipientIds.value.has(recipientId);
};
// Header-Checkbox computed properties für "Alle auswählen/abwählen"
const areAllRecipientsSelected = computed(() => {
    if (paginatedRecipients.value.length === 0)
        return false;
    return paginatedRecipients.value.every((recipient) => selectedRecipientIds.value.has(recipient.id));
});
const areSomeRecipientsSelected = computed(() => {
    return selectedRecipientIds.value.size > 0 && !areAllRecipientsSelected.value;
});
// Header-Checkbox Funktionalität für "Alle auswählen/abwählen"
const toggleAllRecipients = () => {
    if (areAllRecipientsSelected.value) {
        // Alle abwählen - entferne alle sichtbaren Recipients aus der Auswahl
        paginatedRecipients.value.forEach((recipient) => {
            selectedRecipientIds.value.delete(recipient.id);
        });
    }
    else {
        // Alle auswählen - füge alle sichtbaren Recipients zur Auswahl hinzu
        paginatedRecipients.value.forEach((recipient) => {
            selectedRecipientIds.value.add(recipient.id);
        });
    }
};
// Erweiterte Auswahlzustand-Management-Funktionen (Sub-Task 1.4)
// Funktion zum Zurücksetzen aller Auswahlen
const clearSelection = () => {
    selectedRecipientIds.value.clear();
    lastSelectedIndex.value = null;
};
// Funktion zur Bereinigung nicht mehr existierender IDs
const validateSelection = () => {
    const validIds = new Set(recipientStore.recipients.map((r) => r.id));
    const invalidIds = [];
    selectedRecipientIds.value.forEach((id) => {
        if (!validIds.has(id)) {
            invalidIds.push(id);
            selectedRecipientIds.value.delete(id);
        }
    });
    // lastSelectedIndex zurücksetzen wenn nicht mehr gültig
    if (lastSelectedIndex.value !== null) {
        const currentRecipient = paginatedRecipients.value[lastSelectedIndex.value];
        if (!currentRecipient ||
            !selectedRecipientIds.value.has(currentRecipient.id)) {
            lastSelectedIndex.value = null;
        }
    }
    return invalidIds;
};
// Keyboard Event Handler für Escape-Key
const handleKeydown = (event) => {
    if (event.key === "Escape" && selectedRecipientIds.value.size > 0) {
        clearSelection();
        event.preventDefault();
    }
};
// Optimierte computed properties für bessere Performance
const selectedRecipientsCount = computed(() => selectedRecipientIds.value.size);
const hasSelectedRecipients = computed(() => selectedRecipientsCount.value > 0);
// Computed property für ausgewählte Recipients (für Merge-Modal)
const selectedRecipients = computed(() => {
    return recipientStore.recipients.filter((r) => selectedRecipientIds.value.has(r.id));
});
// Watcher für Recipients-Änderungen zur automatischen Validierung
watch(() => recipientStore.recipients, () => {
    validateSelection();
}, { deep: true });
// Watcher für Paginierung/Filterung - Auswahl bleibt erhalten
watch([currentPage, itemsPerPage, searchQuery], () => {
    // Validierung bei Änderungen, aber Auswahl bleibt bestehen
    validateSelection();
});
// Lifecycle Hooks für Keyboard Event Listener
onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
});
onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
});
const createRecipient = () => {
    selectedRecipient.value = null;
    nameInput.value = "";
    isEditMode.value = false;
    showRecipientModal.value = true;
};
const editRecipient = (recipient) => {
    selectedRecipient.value = recipient;
    nameInput.value = recipient.name;
    isEditMode.value = true;
    showRecipientModal.value = true;
};
const saveRecipient = async () => {
    if (!nameInput.value.trim())
        return;
    if (isEditMode.value && selectedRecipient.value) {
        // Stelle sicher, dass der lokale Timestamp immer aktueller ist
        const now = new Date();
        const updatedRecipient = {
            ...selectedRecipient.value,
            name: nameInput.value.trim(),
            updatedAt: now.toISOString(),
        };
        try {
            const success = await recipientStore.updateRecipient(updatedRecipient, false);
            if (!success) {
                console.error('Failed to update recipient in modal');
                return; // Verhindere das Schließen des Modals bei Fehlern
            }
        }
        catch (error) {
            console.error('Error updating recipient in modal:', error);
            return; // Verhindere das Schließen des Modals bei Fehlern
        }
    }
    else {
        try {
            await recipientStore.addRecipient({ name: nameInput.value.trim() });
        }
        catch (error) {
            console.error('Error adding recipient:', error);
            return; // Verhindere das Schließen des Modals bei Fehlern
        }
    }
    showRecipientModal.value = false;
    selectedRecipient.value = null;
    nameInput.value = "";
};
const confirmDeleteRecipient = (recipientId) => {
    // Prüfe ob Empfänger in Transaktionen verwendet wird
    const usageCount = recipientUsage.value(recipientId);
    if (usageCount > 0) {
        // Zeige Fehlermeldung wenn Empfänger noch verwendet wird
        const recipient = recipientStore.getRecipientById(recipientId);
        const recipientName = recipient?.name || "Unbekannter Empfänger";
        // Setze Fehlermeldung und zeige Modal
        deleteErrorMessage.value = `Der Empfänger "${recipientName}" kann nicht gelöscht werden, da er noch in ${usageCount} Transaktion${usageCount === 1 ? "" : "en"} verwendet wird.\n\nBitte entfernen Sie zuerst alle Transaktionen mit diesem Empfänger oder weisen Sie sie einem anderen Empfänger zu.`;
        showDeleteError.value = true;
        return;
    }
    deleteTargetId.value = recipientId;
    showDeleteConfirm.value = true;
};
const deleteRecipient = async () => {
    if (deleteTargetId.value) {
        try {
            // Zusätzliche Sicherheitsprüfung vor dem Löschen
            const usageCount = recipientUsage.value(deleteTargetId.value);
            if (usageCount > 0) {
                const recipient = recipientStore.getRecipientById(deleteTargetId.value);
                const recipientName = recipient?.name || "Unbekannter Empfänger";
                deleteErrorMessage.value = `Fehler: Der Empfänger "${recipientName}" kann nicht gelöscht werden, da er noch in ${usageCount} Transaktion${usageCount === 1 ? "" : "en"} verwendet wird.`;
                showDeleteError.value = true;
                showDeleteConfirm.value = false;
                deleteTargetId.value = null;
                return;
            }
            await recipientStore.deleteRecipient(deleteTargetId.value);
            deleteTargetId.value = null;
        }
        catch (error) {
            // Fehler vom Store abfangen und als Modal anzeigen
            const errorMessage = error instanceof Error
                ? error.message
                : "Unbekannter Fehler beim Löschen des Empfängers";
            deleteErrorMessage.value = errorMessage;
            showDeleteError.value = true;
            deleteTargetId.value = null;
        }
    }
    showDeleteConfirm.value = false;
};
// Batch-Action Event-Handler (Sub-Task 2.5)
const handleMergeRecipients = () => {
    if (selectedRecipientIds.value.size < 2) {
        console.warn("Mindestens 2 Empfänger müssen ausgewählt sein für Merge");
        return;
    }
    showMergeModal.value = true;
};
// Merge-Modal Event-Handler
const handleMergeConfirm = async (data) => {
    try {
        console.log("Merge bestätigt:", data);
        // Extrahiere die IDs der Quell-Empfänger
        const sourceRecipientIds = data.sourceRecipients.map((r) => r.id);
        // Führe den Merge durch
        const result = await recipientStore.mergeRecipients(sourceRecipientIds, data.targetRecipient);
        if (result.success) {
            console.log("Merge erfolgreich abgeschlossen:", result);
            clearSelection();
            showMergeModal.value = false;
        }
        else {
            console.error("Merge fehlgeschlagen:", result.errors);
            // TODO: Fehler-Modal anzeigen
        }
    }
    catch (error) {
        console.error("Fehler beim Merge:", error);
        // TODO: Fehler-Modal anzeigen
    }
};
const handleMergeCancel = () => {
    showMergeModal.value = false;
};
// Orphan Cleanup Funktionalität
const handleOrphanCleanup = async () => {
    try {
        console.log("Starte Orphan Cleanup...");
        const allRecipients = recipientStore.recipients;
        const orphanRecipients = [];
        const warningRecipients = [];
        // Prüfe jeden Empfänger auf Verbindungen
        for (const recipient of allRecipients) {
            // Prüfe Transaktionen
            const hasTransactions = transactionStore.transactions.some((tx) => tx.recipientId === recipient.id);
            if (hasTransactions) {
                continue; // Hat Transaktionen, nicht orphan
            }
            // Prüfe Planning-Transaktionen
            const hasPlanningTransactions = planningStore.planningTransactions.some((pt) => pt.recipientId === recipient.id);
            // Prüfe Automation Rules
            const hasRuleReferences = (await ruleStore.countAutomationRulesWithRecipient(recipient.id)) > 0;
            // Kategorisierung
            if (!hasPlanningTransactions && !hasRuleReferences) {
                // Vollständig orphan - kann gelöscht werden
                orphanRecipients.push(recipient.id);
            }
            else {
                // Hat Referenzen in Rules/Planning aber nicht in Transactions
                warningRecipients.push({
                    name: recipient.name,
                    inRules: hasRuleReferences,
                    inPlanning: hasPlanningTransactions,
                });
            }
        }
        // Lösche orphane Empfänger
        let deletedCount = 0;
        for (const recipientId of orphanRecipients) {
            try {
                await recipientStore.deleteRecipient(recipientId);
                deletedCount++;
            }
            catch (error) {
                console.error(`Fehler beim Löschen von Empfänger ${recipientId}:`, error);
            }
        }
        // Setze Ergebnis und zeige Modal
        orphanCleanupResult.value = {
            deletedCount,
            warningRecipients,
        };
        showOrphanCleanupModal.value = true;
        console.log(`Orphan Cleanup abgeschlossen: ${deletedCount} Empfänger gelöscht`);
    }
    catch (error) {
        console.error("Fehler beim Orphan Cleanup:", error);
    }
};
const handleOrphanCleanupClose = () => {
    showOrphanCleanupModal.value = false;
    orphanCleanupResult.value = null;
};
// Sortierungsfunktionen
const toggleSort = (field) => {
    if (sortField.value === field) {
        // Gleiche Spalte: Richtung umkehren
        sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    }
    else {
        // Neue Spalte: auf aufsteigend setzen
        sortField.value = field;
        sortDirection.value = "asc";
    }
};
const getSortIcon = (field) => {
    if (sortField.value !== field) {
        return "mdi:sort";
    }
    return sortDirection.value === "asc"
        ? "mdi:sort-ascending"
        : "mdi:sort-descending";
};
// Inline-Bearbeitung
const startInlineEdit = (recipientId) => {
    console.log('Starting inline edit for recipient:', recipientId);
    editingRecipientId.value = recipientId;
};
const finishInlineEdit = () => {
    editingRecipientId.value = null;
};
const saveInlineEdit = async (recipientId, newName) => {
    console.log('Saving inline edit:', { recipientId, newName });
    if (newName.trim() === '') {
        console.log('Empty name, finishing edit without saving');
        finishInlineEdit();
        return;
    }
    const recipient = recipientStore.recipients.find(r => r.id === recipientId);
    console.log('Found recipient:', recipient);
    if (recipient && recipient.name !== newName.trim()) {
        // Stelle sicher, dass der lokale Timestamp immer aktueller ist
        const now = new Date();
        const updatedRecipient = {
            ...recipient,
            name: newName.trim(),
            updatedAt: now.toISOString(),
        };
        console.log('Updating recipient with timestamp:', updatedRecipient);
        try {
            const success = await recipientStore.updateRecipient(updatedRecipient, false);
            console.log('Update result:', success);
            if (!success) {
                console.error('Failed to update recipient');
                // Optional: Zeige Fehlermeldung an
            }
        }
        catch (error) {
            console.error('Error updating recipient:', error);
            // Optional: Zeige Fehlermeldung an
        }
    }
    else {
        console.log('No update needed or recipient not found');
    }
    finishInlineEdit();
};
const handleInlineEditFinish = (recipientId, newName) => {
    console.log('handleInlineEditFinish called:', { recipientId, newName });
    saveInlineEdit(recipientId, newName);
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "max-w-4xl mx-auto flex flex-col min-h-screen py-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddle: "Bereinigen",
    btnMiddleIcon: "mdi:broom",
    btnRight: "Neu",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddle: "Bereinigen",
    btnMiddleIcon: "mdi:broom",
    btnRight: "Neu",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: ((query) => (__VLS_ctx.searchQuery = query))
};
const __VLS_7 = {
    onBtnMiddleClick: (__VLS_ctx.handleOrphanCleanup)
};
const __VLS_8 = {
    onBtnRightClick: (__VLS_ctx.createRecipient)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-xs text-base-content/60 mb-2 flex items-center space-x-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
if (__VLS_ctx.hasSelectedRecipients) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alert alert-soft" },
    });
    const __VLS_9 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        icon: "mdi:check-circle",
        ...{ class: "w-5 h-5" },
    }));
    const __VLS_11 = __VLS_10({
        icon: "mdi:check-circle",
        ...{ class: "w-5 h-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedRecipientsCount);
    (__VLS_ctx.selectedRecipientsCount === 1 ? "Empfänger" : "Empfänger");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "ml-auto flex items-center space-x-2" },
    });
    /** @type {[typeof RecipientBulkActionDropdown, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(RecipientBulkActionDropdown, new RecipientBulkActionDropdown({
        ...{ 'onMergeRecipients': {} },
        selectedCount: (__VLS_ctx.selectedRecipientsCount),
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onMergeRecipients': {} },
        selectedCount: (__VLS_ctx.selectedRecipientsCount),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_16;
    let __VLS_17;
    let __VLS_18;
    const __VLS_19 = {
        onMergeRecipients: (__VLS_ctx.handleMergeRecipients)
    };
    var __VLS_15;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearSelection) },
        ...{ class: "btn btn-sm btn-ghost" },
        title: "Auswahl aufheben (ESC)",
    });
    const __VLS_20 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        icon: "mdi:close",
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_22 = __VLS_21({
        icon: "mdi:close",
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 w-full mt-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "w-12" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.toggleAllRecipients) },
    type: "checkbox",
    ...{ class: "checkbox checkbox-sm" },
    checked: (__VLS_ctx.areAllRecipientsSelected),
    indeterminate: (__VLS_ctx.areSomeRecipientsSelected),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('name');
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_24 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    icon: (__VLS_ctx.getSortIcon('name')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'name' }) },
}));
const __VLS_26 = __VLS_25({
    icon: (__VLS_ctx.getSortIcon('name')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'name' }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('usage');
        } },
    ...{ class: "text-center hidden md:table-cell cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_28 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    icon: (__VLS_ctx.getSortIcon('usage')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'usage' }) },
}));
const __VLS_30 = __VLS_29({
    icon: (__VLS_ctx.getSortIcon('usage')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'usage' }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('planning');
        } },
    ...{ class: "text-center hidden lg:table-cell cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_32 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    icon: (__VLS_ctx.getSortIcon('planning')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'planning' }) },
}));
const __VLS_34 = __VLS_33({
    icon: (__VLS_ctx.getSortIcon('planning')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'planning' }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.toggleSort('rules');
        } },
    ...{ class: "text-center hidden lg:table-cell cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_36 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
    icon: (__VLS_ctx.getSortIcon('rules')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'rules' }) },
}));
const __VLS_38 = __VLS_37({
    icon: (__VLS_ctx.getSortIcon('rules')),
    ...{ class: "w-4 h-4 ml-1" },
    ...{ class: ({ 'text-primary': __VLS_ctx.sortField === 'rules' }) },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [recipient] of __VLS_getVForSourceType((__VLS_ctx.paginatedRecipients))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (recipient.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (...[$event]) => {
                __VLS_ctx.toggleRecipientSelection(recipient.id);
            } },
        type: "checkbox",
        ...{ class: "checkbox checkbox-sm" },
        checked: (__VLS_ctx.isRecipientSelected(recipient.id)),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    if (__VLS_ctx.editingRecipientId === recipient.id) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-full" },
        });
        /** @type {[typeof TextInput, ]} */ ;
        // @ts-ignore
        const __VLS_40 = __VLS_asFunctionalComponent(TextInput, new TextInput({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (recipient.name),
            isActive: (true),
            placeholder: (recipient.name),
        }));
        const __VLS_41 = __VLS_40({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (recipient.name),
            isActive: (true),
            placeholder: (recipient.name),
        }, ...__VLS_functionalComponentArgsRest(__VLS_40));
        let __VLS_43;
        let __VLS_44;
        let __VLS_45;
        const __VLS_46 = {
            'onUpdate:modelValue': ((newName) => __VLS_ctx.handleInlineEditFinish(recipient.id, newName))
        };
        const __VLS_47 = {
            onFinish: (__VLS_ctx.finishInlineEdit)
        };
        var __VLS_42;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.editingRecipientId === recipient.id))
                        return;
                    __VLS_ctx.startInlineEdit(recipient.id);
                } },
            ...{ class: "cursor-pointer select-none hover:bg-base-200 px-2 py-1 rounded" },
        });
        (recipient.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center hidden md:table-cell" },
    });
    (__VLS_ctx.recipientUsage(recipient.id));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center hidden lg:table-cell" },
    });
    (__VLS_ctx.recipientPlanningUsage(recipient.id));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center hidden lg:table-cell" },
    });
    (__VLS_ctx.recipientRuleUsage(recipient.id));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editRecipient(recipient);
            } },
        ...{ class: "btn btn-ghost btn-sm text-secondary flex items-center justify-center" },
    });
    const __VLS_48 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_50 = __VLS_49({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.confirmDeleteRecipient(recipient.id);
            } },
        ...{ class: "btn btn-ghost btn-sm text-error flex items-center justify-center" },
    });
    const __VLS_52 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_54 = __VLS_53({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
}
/** @type {[typeof PagingComponent, ]} */ ;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent(PagingComponent, new PagingComponent({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}));
const __VLS_57 = __VLS_56({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
let __VLS_59;
let __VLS_60;
let __VLS_61;
const __VLS_62 = {
    'onUpdate:currentPage': ((val) => (__VLS_ctx.currentPage = val))
};
const __VLS_63 = {
    'onUpdate:itemsPerPage': ((val) => (__VLS_ctx.itemsPerPage = val))
};
var __VLS_58;
if (__VLS_ctx.showRecipientModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.isEditMode ? "Empfänger bearbeiten" : "Neuen Empfänger anlegen");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "text",
        value: (__VLS_ctx.nameInput),
        placeholder: "Empfängername",
        ...{ class: "input input-bordered w-full mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showRecipientModal))
                    return;
                __VLS_ctx.showRecipientModal = false;
            } },
        ...{ class: "btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.saveRecipient) },
        ...{ class: "btn btn-primary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showRecipientModal))
                    return;
                __VLS_ctx.showRecipientModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showDeleteConfirm) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Empfänger löschen",
        message: "Möchtest Du diesen Empfänger wirklich löschen?",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_65 = __VLS_64({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Empfänger löschen",
        message: "Möchtest Du diesen Empfänger wirklich löschen?",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    let __VLS_67;
    let __VLS_68;
    let __VLS_69;
    const __VLS_70 = {
        onConfirm: (__VLS_ctx.deleteRecipient)
    };
    const __VLS_71 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showDeleteConfirm))
                return;
            __VLS_ctx.showDeleteConfirm = false;
        }
    };
    var __VLS_66;
}
if (__VLS_ctx.showDeleteError) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4 flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alert alert-soft alert-error mb-4" },
    });
    const __VLS_72 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        icon: "mdi:information",
        ...{ class: "w-5 h-5" },
    }));
    const __VLS_74 = __VLS_73({
        icon: "mdi:information",
        ...{ class: "w-5 h-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "whitespace-pre-line" },
    });
    (__VLS_ctx.deleteErrorMessage);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeleteError))
                    return;
                __VLS_ctx.showDeleteError = false;
            } },
        ...{ class: "btn btn-primary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showDeleteError))
                    return;
                __VLS_ctx.showDeleteError = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
/** @type {[typeof RecipientMergeModal, ]} */ ;
// @ts-ignore
const __VLS_76 = __VLS_asFunctionalComponent(RecipientMergeModal, new RecipientMergeModal({
    ...{ 'onConfirmMerge': {} },
    ...{ 'onCancel': {} },
    show: (__VLS_ctx.showMergeModal),
    selectedRecipients: (__VLS_ctx.selectedRecipients),
}));
const __VLS_77 = __VLS_76({
    ...{ 'onConfirmMerge': {} },
    ...{ 'onCancel': {} },
    show: (__VLS_ctx.showMergeModal),
    selectedRecipients: (__VLS_ctx.selectedRecipients),
}, ...__VLS_functionalComponentArgsRest(__VLS_76));
let __VLS_79;
let __VLS_80;
let __VLS_81;
const __VLS_82 = {
    onConfirmMerge: (__VLS_ctx.handleMergeConfirm)
};
const __VLS_83 = {
    onCancel: (__VLS_ctx.handleMergeCancel)
};
var __VLS_78;
if (__VLS_ctx.showOrphanCleanupModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    if (__VLS_ctx.orphanCleanupResult) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-success alert-soft" },
        });
        const __VLS_84 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            icon: "mdi:check-circle",
            ...{ class: "w-5 h-5" },
        }));
        const __VLS_86 = __VLS_85({
            icon: "mdi:check-circle",
            ...{ class: "w-5 h-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.orphanCleanupResult.deletedCount);
        if (__VLS_ctx.orphanCleanupResult.warningRecipients.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "alert alert-warning" },
            });
            const __VLS_88 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
                icon: "mdi:information",
                ...{ class: "w-5 h-5" },
            }));
            const __VLS_90 = __VLS_89({
                icon: "mdi:information",
                ...{ class: "w-5 h-5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_89));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "font-semibold mb-2" },
            });
            (__VLS_ctx.orphanCleanupResult.warningRecipients.length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
                ...{ class: "list-disc list-inside space-y-1" },
            });
            for (const [recipient] of __VLS_getVForSourceType((__VLS_ctx.orphanCleanupResult.warningRecipients))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
                    key: (recipient.name),
                    ...{ class: "text-sm" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
                (recipient.name);
                if (recipient.inRules && recipient.inPlanning) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                }
                else if (recipient.inRules) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                }
                else if (recipient.inPlanning) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                }
            }
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleOrphanCleanupClose) },
        ...{ class: "btn btn-primary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.handleOrphanCleanupClose) },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['md:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-line']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
/** @type {__VLS_StyleScopedClasses['list-inside']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            SearchGroup: SearchGroup,
            PagingComponent: PagingComponent,
            ConfirmationModal: ConfirmationModal,
            RecipientBulkActionDropdown: RecipientBulkActionDropdown,
            RecipientMergeModal: RecipientMergeModal,
            TextInput: TextInput,
            Icon: Icon,
            showRecipientModal: showRecipientModal,
            isEditMode: isEditMode,
            nameInput: nameInput,
            searchQuery: searchQuery,
            showDeleteConfirm: showDeleteConfirm,
            showDeleteError: showDeleteError,
            deleteErrorMessage: deleteErrorMessage,
            showMergeModal: showMergeModal,
            showOrphanCleanupModal: showOrphanCleanupModal,
            orphanCleanupResult: orphanCleanupResult,
            editingRecipientId: editingRecipientId,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            sortField: sortField,
            totalPages: totalPages,
            paginatedRecipients: paginatedRecipients,
            recipientUsage: recipientUsage,
            recipientPlanningUsage: recipientPlanningUsage,
            recipientRuleUsage: recipientRuleUsage,
            toggleRecipientSelection: toggleRecipientSelection,
            isRecipientSelected: isRecipientSelected,
            areAllRecipientsSelected: areAllRecipientsSelected,
            areSomeRecipientsSelected: areSomeRecipientsSelected,
            toggleAllRecipients: toggleAllRecipients,
            clearSelection: clearSelection,
            selectedRecipientsCount: selectedRecipientsCount,
            hasSelectedRecipients: hasSelectedRecipients,
            selectedRecipients: selectedRecipients,
            createRecipient: createRecipient,
            editRecipient: editRecipient,
            saveRecipient: saveRecipient,
            confirmDeleteRecipient: confirmDeleteRecipient,
            deleteRecipient: deleteRecipient,
            handleMergeRecipients: handleMergeRecipients,
            handleMergeConfirm: handleMergeConfirm,
            handleMergeCancel: handleMergeCancel,
            handleOrphanCleanup: handleOrphanCleanup,
            handleOrphanCleanupClose: handleOrphanCleanupClose,
            toggleSort: toggleSort,
            getSortIcon: getSortIcon,
            startInlineEdit: startInlineEdit,
            finishInlineEdit: finishInlineEdit,
            handleInlineEditFinish: handleInlineEditFinish,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
