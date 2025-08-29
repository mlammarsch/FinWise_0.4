import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import dayjs from "dayjs";
import { useRoute, useRouter } from "vue-router";
import { useTransactionStore } from "../stores/transactionStore";
import { useTransactionFilterStore } from "../stores/transactionFilterStore";
import { useReconciliationStore } from "../stores/reconciliationStore";
import { useAccountStore } from "../stores/accountStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useTagStore } from "../stores/tagStore";
import { useRecipientStore } from "../stores/recipientStore";
import { useSearchStore } from "../stores/searchStore";
import { usePlanningStore } from "../stores/planningStore";
import { useMonthlyBalanceStore } from "../stores/monthlyBalanceStore";
import TransactionList from "../components/transaction/TransactionList.vue";
import CategoryTransactionList from "../components/transaction/CategoryTransactionList.vue";
import PlanningTransactionList from "../components/transaction/PlanningTransactionList.vue";
import TransactionDetailModal from "../components/transaction/TransactionDetailModal.vue";
import TransactionForm from "../components/transaction/TransactionForm.vue";
import DateRangePicker from "../components/ui/DateRangePicker.vue";
import SearchGroup from "../components/ui/SearchGroup.vue";
import SearchableSelectLite from "../components/ui/SearchableSelectLite.vue";
import SelectCategory from "../components/ui/SelectCategory.vue";
import BulkActionDropdown from "../components/ui/BulkActionDropdown.vue";
import BulkAssignAccountModal from "../components/ui/BulkAssignAccountModal.vue";
import BulkChangeRecipientModal from "../components/ui/BulkChangeRecipientModal.vue";
import BulkAssignCategoryModal from "../components/ui/BulkAssignCategoryModal.vue";
import BulkAssignTagsModal from "../components/ui/BulkAssignTagsModal.vue";
import BulkChangeDateModal from "../components/ui/BulkChangeDateModal.vue";
import BulkDeleteModal from "../components/ui/BulkDeleteModal.vue";
import PlanningTransactionForm from "../components/planning/PlanningTransactionForm.vue";
import AccountForecastChart from "../components/ui/charts/AccountForecastChart.vue";
import CategoryForecastChart from "../components/ui/charts/CategoryForecastChart.vue";
import ConfirmationModal from "../components/ui/ConfirmationModal.vue";
import { TransactionType } from "../types";
import { debugLog, infoLog, errorLog, warnLog } from "../utils/logger";
import { TransactionService } from "../services/TransactionService";
import { PlanningService } from "../services/PlanningService";
import { BalanceService } from "../services/BalanceService";
import { Icon } from "@iconify/vue";
import InfoToast from "../components/ui/InfoToast.vue";
const route = useRoute();
const router = useRouter();
const refreshKey = ref(0);
const activeToasts = ref([]);
function showToast(message, type = "info", duration) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast = { id, message, type, duration };
    activeToasts.value.push(toast);
}
function removeToast(id) {
    const index = activeToasts.value.findIndex((toast) => toast.id === id);
    if (index > -1) {
        activeToasts.value.splice(index, 1);
    }
}
// Stores ------------------------------------------------------------------
const transactionStore = useTransactionStore();
const transactionFilterStore = useTransactionFilterStore();
const reconciliationStore = useReconciliationStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const searchStore = useSearchStore();
const planningStore = usePlanningStore();
const monthlyBalanceStore = useMonthlyBalanceStore();
// Alphabetisch sortierte Kontoliste für Dropdowns
const sortedActiveAccounts = computed(() => {
    return [...accountStore.activeAccounts].sort((a, b) => a.name.localeCompare(b.name));
});
// Modals ------------------------------------------------------------------
const showTransactionFormModal = ref(false);
const showTransactionDetailModal = ref(false);
const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const showExecuteConfirmation = ref(false);
const selectedPlanning = ref(null);
const transactionListRef = ref(null);
const categoryTransactionListRef = ref(null);
// DateRangePicker reference for navigation
const dateRangePickerRef = ref(null);
// Planning-spezifische Variablen
const selectedAccountForDetail = ref("");
const selectedCategoryForDetail = ref("");
// Für die Ausführungsbestätigung
const pendingExecutionAnalysis = ref(null);
// Planning-spezifische Filter
const planningSelectedAccountId = ref("");
const planningSelectedCategoryId = ref("");
const planningSearchQuery = ref("");
// Planning DateRange
const planningDateRange = ref({
    start: dayjs().startOf("month").format("YYYY-MM-DD"),
    end: dayjs().add(6, "month").endOf("month").format("YYYY-MM-DD"),
});
// Erweiterte Tab-Modi für Planning
const activeTab = ref("account");
// Bulk Actions ----------------------------------------------------------------
const showBulkAssignAccountModal = ref(false);
const showBulkChangeRecipientModal = ref(false);
const showBulkAssignCategoryModal = ref(false);
const showBulkAssignTagsModal = ref(false);
const showBulkChangeDateModal = ref(false);
const showBulkDeleteModal = ref(false);
const bulkDeleteTransactionIds = ref([]);
const localSelectedCount = ref(0);
const selectedTransactionCount = computed(() => localSelectedCount.value);
function handleSelectionChanged(count) {
    localSelectedCount.value = count;
}
// Ansicht / Filter --------------------------------------------------------
const currentViewMode = computed({
    get: () => transactionFilterStore.currentViewMode,
    set: (v) => (transactionFilterStore.currentViewMode = v),
});
const selectedTransaction = ref(null);
const searchQuery = computed({
    get: () => searchStore.globalSearchQuery,
    set: (v) => searchStore.search(v),
});
const dateRange = computed({
    get: () => transactionFilterStore.dateRange,
    set: (v) => transactionFilterStore.updateDateRange(v.start, v.end),
});
function handleDateRangeUpdate(p) {
    transactionFilterStore.updateDateRange(p.start, p.end);
    refreshKey.value++;
}
// Planning DateRange Handler
function handlePlanningDateRangeUpdate(payload) {
    planningDateRange.value = payload;
    debugLog("[TransactionsView]", "Planning date range updated", payload);
}
// Navigation methods for chevron buttons
function navigateMonth(direction) {
    if (dateRangePickerRef.value) {
        dateRangePickerRef.value.navigateRangeByMonth(direction);
    }
}
// Einzel‑Filter
const selectedAccountId = computed({
    get: () => transactionFilterStore.selectedAccountId,
    set: (v) => (transactionFilterStore.selectedAccountId = v),
});
const selectedTransactionType = computed({
    get: () => transactionFilterStore.selectedTransactionType,
    set: (v) => (transactionFilterStore.selectedTransactionType = v),
});
const selectedReconciledFilter = computed({
    get: () => transactionFilterStore.selectedReconciledFilter,
    set: (v) => (transactionFilterStore.selectedReconciledFilter = v),
});
const selectedTagId = computed({
    get: () => transactionFilterStore.selectedTagId,
    set: (v) => (transactionFilterStore.selectedTagId = v),
});
const selectedCategoryId = computed({
    get: () => transactionFilterStore.selectedCategoryId,
    set: (v) => (transactionFilterStore.selectedCategoryId = v),
});
// Gefilterte Daten --------------------------------------------------------
const filteredTransactions = computed(() => {
    refreshKey.value;
    return transactionFilterStore.filteredTransactions;
});
const filteredCategoryTransactions = computed(() => {
    refreshKey.value;
    return transactionFilterStore.filteredCategoryTransactions;
});
// Sortierung --------------------------------------------------------------
const sortKey = computed({
    get: () => transactionFilterStore.sortKey,
    set: (v) => (transactionFilterStore.sortKey = v),
});
const sortOrder = computed({
    get: () => transactionFilterStore.sortOrder,
    set: (v) => (transactionFilterStore.sortOrder = v),
});
const sortedTransactions = computed(() => transactionFilterStore.sortedTransactions);
const sortedCategoryTransactions = computed(() => transactionFilterStore.sortedCategoryTransactions);
function sortBy(key) {
    transactionFilterStore.setSortKey(key);
}
function handleSortChange(key) {
    sortBy(key);
}
// Aktionen ---------------------------------------------------------------
const viewTransaction = (tx) => {
    selectedTransaction.value = tx;
    showTransactionDetailModal.value = true;
};
const editTransaction = (tx) => {
    selectedTransaction.value = tx;
    showTransactionFormModal.value = true;
    showTransactionDetailModal.value = false;
};
// Vorbelegungswerte für neue Transaktionen
const prefilledAccountId = ref("");
const prefilledTransactionType = ref(undefined);
const prefilledCategoryId = ref("");
const prefilledTagIds = ref([]);
const createTransaction = () => {
    // Aktuelle Filter als Vorbelegung übernehmen
    prefilledAccountId.value = selectedAccountId.value || "";
    prefilledTransactionType.value =
        selectedTransactionType.value || undefined;
    prefilledCategoryId.value = selectedCategoryId.value || "";
    prefilledTagIds.value = selectedTagId.value ? [selectedTagId.value] : [];
    selectedTransaction.value = null;
    showTransactionFormModal.value = true;
};
const handleSave = (payload) => {
    if (payload.type === TransactionType.ACCOUNTTRANSFER) {
        if (selectedTransaction.value) {
            // EDIT: Bestehende Transaktion zu Account Transfer ändern
            // Zuerst die ursprüngliche Transaktion löschen
            TransactionService.deleteTransaction(selectedTransaction.value.id);
            // Dann neuen Account Transfer erstellen
            TransactionService.addAccountTransfer(payload.fromAccountId, payload.toAccountId, payload.amount, payload.date, payload.valueDate, payload.note);
        }
        else {
            // CREATE: Neuen Account Transfer erstellen
            TransactionService.addAccountTransfer(payload.fromAccountId, payload.toAccountId, payload.amount, payload.date, payload.valueDate, payload.note);
        }
    }
    else {
        const tx = {
            ...payload,
            payee: recipientStore.getRecipientById(payload.recipientId)?.name || "",
        };
        if (selectedTransaction.value) {
            TransactionService.updateTransaction(selectedTransaction.value.id, tx);
        }
        else {
            TransactionService.addTransaction(tx);
        }
    }
    showTransactionFormModal.value = false;
    selectedTransaction.value = null;
    refreshKey.value++;
};
const deleteTransaction = (tx) => {
    TransactionService.deleteTransaction(tx.id);
    showTransactionDetailModal.value = false;
};
function clearFilters() {
    transactionFilterStore.clearFilters();
}
// Toggle reconciled
function toggleTransactionReconciled(transaction) {
    TransactionService.updateTransaction(transaction.id, {
        reconciled: !transaction.reconciled,
    });
}
// Bulk Action Event Handlers -------------------------------------------------
function handleBulkAssignAccount() {
    showBulkAssignAccountModal.value = true;
}
function handleBulkChangeRecipient() {
    showBulkChangeRecipientModal.value = true;
}
function handleBulkAssignCategory() {
    showBulkAssignCategoryModal.value = true;
}
function handleBulkAssignTags() {
    showBulkAssignTagsModal.value = true;
}
function handleBulkChangeDate() {
    showBulkChangeDateModal.value = true;
}
function handleBulkSetReconciled() {
    const selectedTransactions = currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();
    if (selectedTransactions && selectedTransactions.length > 0) {
        onBulkSetReconciledConfirm(selectedTransactions);
    }
}
function handleBulkRemoveReconciled() {
    const selectedTransactions = currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();
    if (selectedTransactions && selectedTransactions.length > 0) {
        onBulkRemoveReconciledConfirm(selectedTransactions);
    }
}
function handleBulkDelete() {
    const selectedTransactions = currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();
    if (selectedTransactions && selectedTransactions.length > 0) {
        bulkDeleteTransactionIds.value = selectedTransactions.map((tx) => tx.id);
        showBulkDeleteModal.value = true;
    }
}
// Bulk Action Confirmation Handlers ------------------------------------------
async function onBulkAssignAccountConfirm(accountId) {
    debugLog("[TransactionsView]", "onBulkAssignAccountConfirm", { accountId });
    try {
        // Hole die ausgewählten Transaktionen
        const selectedTransactions = currentViewMode.value === "account"
            ? transactionListRef.value?.getSelectedTransactions()
            : categoryTransactionListRef.value?.getSelectedTransactions();
        if (!selectedTransactions || selectedTransactions.length === 0) {
            warnLog("[TransactionsView]", "Keine Transaktionen für Bulk-Kontozuweisung ausgewählt");
            showBulkAssignAccountModal.value = false;
            return;
        }
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        // Führe die Bulk-Kontozuweisung durch
        const result = await TransactionService.bulkAssignAccount(transactionIds, accountId);
        if (result.success) {
            infoLog("[TransactionsView]", `Bulk-Kontozuweisung erfolgreich: ${result.updatedCount} Transaktionen aktualisiert`);
            // Auswahl zurücksetzen
            if (currentViewMode.value === "account") {
                transactionListRef.value?.clearSelection();
            }
            else {
                categoryTransactionListRef.value?.clearSelection();
            }
            // Erfolgs-Toast anzeigen
            showToast(`${result.updatedCount} Transaktionen erfolgreich zugewiesen`, "success");
        }
        else {
            errorLog("[TransactionsView]", "Fehler bei Bulk-Kontozuweisung", {
                errors: result.errors,
                updatedCount: result.updatedCount,
            });
            // Fehler-Toast anzeigen
            showToast(`Fehler bei Kontozuweisung: ${result.errors.join(", ")}`, "error");
        }
    }
    catch (error) {
        errorLog("[TransactionsView]", "Unerwarteter Fehler bei Bulk-Kontozuweisung", {
            error: error instanceof Error ? error.message : String(error),
            accountId,
        });
        // Fehler-Toast anzeigen
        showToast("Unerwarteter Fehler bei der Kontozuweisung", "error");
    }
    finally {
        showBulkAssignAccountModal.value = false;
    }
}
async function onBulkChangeRecipientConfirm(recipientId, removeAll = false) {
    debugLog("[TransactionsView]", "onBulkChangeRecipientConfirm", {
        recipientId,
        removeAll,
    });
    try {
        // Hole die ausgewählten Transaktionen
        const selectedTransactions = currentViewMode.value === "account"
            ? transactionListRef.value?.getSelectedTransactions()
            : categoryTransactionListRef.value?.getSelectedTransactions();
        if (!selectedTransactions || selectedTransactions.length === 0) {
            warnLog("[TransactionsView]", "Keine Transaktionen für Bulk-Empfänger-Änderung ausgewählt");
            showBulkChangeRecipientModal.value = false;
            return;
        }
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        // Verwende die neue bulkChangeRecipient Funktion
        const result = await TransactionService.bulkChangeRecipient(transactionIds, removeAll ? null : recipientId, removeAll);
        if (result.success) {
            infoLog("[TransactionsView]", "Bulk-Empfänger-Änderung erfolgreich", {
                updatedCount: result.updatedCount,
                recipientId: removeAll ? "alle entfernt" : recipientId,
            });
            // Auswahl zurücksetzen
            if (currentViewMode.value === "account") {
                transactionListRef.value?.clearSelection();
            }
            else {
                categoryTransactionListRef.value?.clearSelection();
            }
            // Refresh der Transaktionsliste
            refreshKey.value++;
        }
        else {
            errorLog("[TransactionsView]", "Bulk-Empfänger-Änderung fehlgeschlagen", {
                errors: result.errors,
                updatedCount: result.updatedCount,
            });
        }
    }
    catch (error) {
        errorLog("[TransactionsView]", "Fehler bei Bulk-Empfänger-Änderung", {
            error: error instanceof Error ? error.message : String(error),
            recipientId,
            removeAll,
        });
    }
    finally {
        showBulkChangeRecipientModal.value = false;
    }
}
async function onBulkAssignCategoryConfirm(categoryId, removeAll = false) {
    debugLog("[TransactionsView]", "onBulkAssignCategoryConfirm", {
        categoryId,
        removeAll,
    });
    try {
        // Hole die ausgewählten Transaktionen
        const selectedTransactions = currentViewMode.value === "account"
            ? transactionListRef.value?.getSelectedTransactions()
            : categoryTransactionListRef.value?.getSelectedTransactions();
        if (!selectedTransactions || selectedTransactions.length === 0) {
            warnLog("[TransactionsView]", "Keine Transaktionen für Bulk-Kategorienzuweisung ausgewählt");
            showBulkAssignCategoryModal.value = false;
            return;
        }
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        // Verwende die neue bulkAssignCategory Funktion
        const result = await TransactionService.bulkAssignCategory(transactionIds, removeAll ? null : categoryId);
        if (result.success) {
            infoLog("[TransactionsView]", "Bulk-Kategorienzuweisung erfolgreich", {
                updatedCount: result.updatedCount,
                categoryId: removeAll ? "entfernt" : categoryId,
            });
            // Auswahl zurücksetzen
            if (currentViewMode.value === "account") {
                transactionListRef.value?.clearSelection();
            }
            else {
                categoryTransactionListRef.value?.clearSelection();
            }
            // Erfolgs-Toast anzeigen
            showToast(`${result.updatedCount} Transaktionen erfolgreich aktualisiert`, "success");
        }
        else {
            warnLog("[TransactionsView]", "Bulk-Kategorienzuweisung mit Fehlern", {
                updatedCount: result.updatedCount,
                errors: result.errors,
            });
            // Fehler-Toast anzeigen
            showToast(`Fehler bei Kategorienzuweisung: ${result.errors.join(", ")}`, "error");
        }
    }
    catch (error) {
        errorLog("[TransactionsView]", "Fehler bei Bulk-Kategorienzuweisung", {
            error: error instanceof Error ? error.message : String(error),
            categoryId,
            removeAll,
        });
        // Fehler-Toast anzeigen
        showToast("Unerwarteter Fehler bei der Kategorienzuweisung", "error");
    }
    finally {
        showBulkAssignCategoryModal.value = false;
    }
}
async function onBulkAssignTagsConfirm(tagIds, removeAll) {
    debugLog("[TransactionsView]", "onBulkAssignTagsConfirm", {
        tagIds,
        removeAll,
    });
    try {
        // Hole die ausgewählten Transaktionen
        const selectedTransactions = currentViewMode.value === "account"
            ? transactionListRef.value?.getSelectedTransactions()
            : categoryTransactionListRef.value?.getSelectedTransactions();
        if (!selectedTransactions || selectedTransactions.length === 0) {
            warnLog("[TransactionsView]", "Keine Transaktionen für Bulk-Tag-Zuweisung ausgewählt");
            showBulkAssignTagsModal.value = false;
            return;
        }
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        // Führe die Bulk-Tag-Zuweisung durch
        const result = await TransactionService.bulkAssignTags(transactionIds, tagIds, removeAll);
        if (result.success) {
            infoLog("[TransactionsView]", `Bulk-Tag-Zuweisung erfolgreich: ${result.updatedCount} Transaktionen aktualisiert`);
            // Auswahl zurücksetzen
            if (currentViewMode.value === "account") {
                transactionListRef.value?.clearSelection();
            }
            else {
                categoryTransactionListRef.value?.clearSelection();
            }
            // Erfolgs-Toast anzeigen
            showToast(`${result.updatedCount} Transaktionen erfolgreich aktualisiert`, "success");
        }
        else {
            errorLog("[TransactionsView]", "Fehler bei Bulk-Tag-Zuweisung", {
                errors: result.errors,
                updatedCount: result.updatedCount,
            });
            // Fehler-Toast anzeigen
            showToast(`Fehler bei Tag-Zuweisung: ${result.errors.join(", ")}`, "error");
        }
    }
    catch (error) {
        errorLog("[TransactionsView]", "Unerwarteter Fehler bei Bulk-Tag-Zuweisung", {
            error: error instanceof Error ? error.message : String(error),
            tagIds,
            removeAll,
        });
        // Fehler-Toast anzeigen
        showToast("Unerwarteter Fehler bei der Tag-Zuweisung", "error");
    }
    finally {
        showBulkAssignTagsModal.value = false;
    }
}
async function onBulkChangeDateConfirm(newDate) {
    debugLog("[TransactionsView]", "onBulkChangeDateConfirm", { newDate });
    try {
        // Hole die ausgewählten Transaktionen
        const selectedTransactions = currentViewMode.value === "account"
            ? transactionListRef.value?.getSelectedTransactions()
            : categoryTransactionListRef.value?.getSelectedTransactions();
        if (!selectedTransactions || selectedTransactions.length === 0) {
            warnLog("[TransactionsView]", "Keine Transaktionen für Bulk-Datumsänderung ausgewählt");
            showBulkChangeDateModal.value = false;
            return;
        }
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        // Verwende die neue bulkChangeDate Funktion
        const result = await TransactionService.bulkChangeDate(transactionIds, newDate);
        if (result.success) {
            infoLog("[TransactionsView]", "Bulk-Datumsänderung erfolgreich", {
                updatedCount: result.updatedCount,
                newDate,
            });
            // Auswahl zurücksetzen
            if (currentViewMode.value === "account") {
                transactionListRef.value?.clearSelection();
            }
            else {
                categoryTransactionListRef.value?.clearSelection();
            }
            // Refresh der Ansicht
            refreshKey.value++;
            // Erfolgs-Toast anzeigen
            showToast(`${result.updatedCount} Transaktionen erfolgreich aktualisiert`, "success");
        }
        else {
            warnLog("[TransactionsView]", "Bulk-Datumsänderung mit Fehlern", {
                updatedCount: result.updatedCount,
                errors: result.errors,
            });
            // Fehler-Toast anzeigen
            showToast(`Fehler bei Datumsänderung: ${result.errors.join(", ")}`, "error");
        }
    }
    catch (error) {
        errorLog("[TransactionsView]", "Fehler bei Bulk-Datumsänderung", {
            error: error instanceof Error ? error.message : String(error),
            newDate,
        });
        // Fehler-Toast anzeigen
        showToast("Unerwarteter Fehler bei der Datumsänderung", "error");
    }
    finally {
        showBulkChangeDateModal.value = false;
    }
}
async function onBulkDeleteConfirm(transactionIds) {
    debugLog("[TransactionsView]", "onBulkDeleteConfirm", { transactionIds });
    try {
        const result = await TransactionService.bulkDeleteTransactions(transactionIds);
        if (result.success) {
            debugLog("[TransactionsView]", "Bulk delete successful", {
                deletedCount: result.deletedCount,
            });
            // Erfolgs-Toast anzeigen
            showToast(`${result.deletedCount} Transaktionen erfolgreich gelöscht`, "success");
        }
        else {
            debugLog("[TransactionsView]", "Bulk delete partially failed", {
                result,
            });
            // Fehler-Toast anzeigen
            showToast("Fehler beim Löschen von Transaktionen", "error");
        }
    }
    catch (error) {
        console.error("Fehler beim Massenlöschen von Transaktionen:", error);
        // Fehler-Toast anzeigen
        showToast("Unerwarteter Fehler beim Löschen von Transaktionen", "error");
    }
    finally {
        showBulkDeleteModal.value = false;
        // Auswahl in den Listen zurücksetzen
        transactionListRef.value?.clearSelection();
        categoryTransactionListRef.value?.clearSelection();
        refreshKey.value++;
    }
}
async function onBulkSetReconciledConfirm(selectedTransactions) {
    debugLog("[TransactionsView]", "onBulkSetReconciledConfirm", {
        count: selectedTransactions.length,
    });
    try {
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        const result = await TransactionService.bulkSetReconciled(transactionIds);
        if (result.success) {
            infoLog("[TransactionsView]", `Bulk-Abgleich erfolgreich gesetzt: ${result.updatedCount} Transaktionen`);
            showToast(`${result.updatedCount} Transaktionen als abgeglichen markiert`, "success");
        }
        else {
            warnLog("[TransactionsView]", `Bulk-Abgleich mit Fehlern: ${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`);
            showToast(`${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`, "warning");
        }
        // Auswahl zurücksetzen
        if (currentViewMode.value === "account") {
            transactionListRef.value?.clearSelection();
        }
        else {
            categoryTransactionListRef.value?.clearSelection();
        }
        refreshKey.value++;
    }
    catch (error) {
        errorLog("[TransactionsView]", "Unerwarteter Fehler beim Bulk-Abgleich setzen", error);
        showToast("Unerwarteter Fehler beim Setzen des Abgleichs", "error");
    }
}
async function onBulkRemoveReconciledConfirm(selectedTransactions) {
    debugLog("[TransactionsView]", "onBulkRemoveReconciledConfirm", {
        count: selectedTransactions.length,
    });
    try {
        const transactionIds = selectedTransactions.map((tx) => tx.id);
        const result = await TransactionService.bulkRemoveReconciled(transactionIds);
        if (result.success) {
            infoLog("[TransactionsView]", `Bulk-Abgleich erfolgreich entfernt: ${result.updatedCount} Transaktionen`);
            showToast(`${result.updatedCount} Transaktionen als nicht abgeglichen markiert`, "success");
        }
        else {
            warnLog("[TransactionsView]", `Bulk-Abgleich-Entfernung mit Fehlern: ${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`);
            showToast(`${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`, "warning");
        }
        // Auswahl zurücksetzen
        if (currentViewMode.value === "account") {
            transactionListRef.value?.clearSelection();
        }
        else {
            categoryTransactionListRef.value?.clearSelection();
        }
        refreshKey.value++;
    }
    catch (error) {
        errorLog("[TransactionsView]", "Unerwarteter Fehler beim Bulk-Abgleich entfernen", error);
        showToast("Unerwarteter Fehler beim Entfernen des Abgleichs", "error");
    }
}
// Planning-spezifische Funktionen aus PlanningView
const upcomingTransactionsInRange = computed(() => {
    const start = planningDateRange.value.start;
    const end = planningDateRange.value.end;
    const list = [];
    planningStore.planningTransactions.forEach((plan) => {
        if (!plan.isActive)
            return;
        const occurrences = PlanningService.calculateNextOccurrences(plan, start, end);
        occurrences.forEach((dateStr) => {
            list.push({ date: dateStr, transaction: plan });
        });
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
});
// Gefilterte Planning-Transaktionen
const filteredPlanningTransactions = computed(() => {
    let data = [...upcomingTransactionsInRange.value];
    // Filter nach Konto
    if (planningSelectedAccountId.value) {
        data = data.filter((e) => {
            const t = e.transaction;
            if (t.accountId === planningSelectedAccountId.value) {
                return true;
            }
            if (t.transactionType === TransactionType.ACCOUNTTRANSFER &&
                t.transferToAccountId === planningSelectedAccountId.value) {
                return true;
            }
            return false;
        });
    }
    // Filter nach Kategorie
    if (planningSelectedCategoryId.value) {
        data = data.filter((e) => {
            const t = e.transaction;
            if (t.categoryId === planningSelectedCategoryId.value) {
                return true;
            }
            if (t.transactionType === TransactionType.CATEGORYTRANSFER &&
                t.transferToCategoryId === planningSelectedCategoryId.value) {
                return true;
            }
            return false;
        });
    }
    // Gegenbuchungen herausfiltern
    data = data.filter((e) => {
        const t = e.transaction;
        if (t.name && t.name.includes("(Gegenbuchung)")) {
            return false;
        }
        if (t.counterPlanningTransactionId &&
            (t.transactionType === TransactionType.ACCOUNTTRANSFER ||
                t.transactionType === TransactionType.CATEGORYTRANSFER)) {
            const counterPlanning = planningStore.planningTransactions.find((counter) => counter.id === t.counterPlanningTransactionId);
            if (counterPlanning && t.amount > 0 && counterPlanning.amount < 0) {
                return false;
            }
        }
        return true;
    });
    if (planningSearchQuery.value.trim()) {
        const term = planningSearchQuery.value.toLowerCase();
        data = data.filter((e) => {
            const t = e.transaction;
            return (t.name.toLowerCase().includes(term) ||
                (recipientStore
                    .getRecipientById(t.recipientId || "")
                    ?.name.toLowerCase()
                    .includes(term) ??
                    false) ||
                (accountStore
                    .getAccountById(t.accountId)
                    ?.name.toLowerCase()
                    .includes(term) ??
                    false) ||
                (categoryStore
                    .getCategoryById(t.categoryId || "")
                    ?.name.toLowerCase()
                    .includes(term) ??
                    false) ||
                String(t.amount).includes(term));
        });
    }
    return data;
});
// Planning CRUD-Aktionen
function createPlanning() {
    selectedPlanning.value = null;
    showNewPlanningModal.value = true;
}
function editPlanning(planning) {
    selectedPlanning.value = planning;
    showEditPlanningModal.value = true;
    debugLog("[TransactionsView]", "Edit planning", {
        id: planning.id,
        name: planning.name,
    });
}
function savePlanning(data) {
    if (selectedPlanning.value) {
        PlanningService.updatePlanningTransaction(selectedPlanning.value.id, data);
        debugLog("[TransactionsView]", "Updated planning", data);
    }
    else {
        PlanningService.addPlanningTransaction(data);
        debugLog("[TransactionsView]", "Added planning", data);
    }
    showNewPlanningModal.value = false;
    showEditPlanningModal.value = false;
    BalanceService.calculateMonthlyBalances();
}
function deletePlanning(planning) {
    if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
        PlanningService.deletePlanningTransaction(planning.id);
        debugLog("[TransactionsView] Deleted planning", planning.id);
        BalanceService.calculateMonthlyBalances();
    }
}
function executePlanning(planningId, date) {
    PlanningService.executePlanningTransaction(planningId, date);
    debugLog("[TransactionsView]", "Executed planning", { planningId, date });
}
function skipPlanning(planningId, date) {
    PlanningService.skipPlanningTransaction(planningId, date);
    debugLog("[TransactionsView]", "Skipped planning", { planningId, date });
}
// Hilfsfunktionen für Planning-Transaktionen
function getTransactionTypeIcon(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
            return "mdi:bank-transfer";
        case TransactionType.CATEGORYTRANSFER:
            return "mdi:briefcase-transfer-outline";
        case TransactionType.EXPENSE:
            return "mdi:bank-transfer-out";
        case TransactionType.INCOME:
            return "mdi:bank-transfer-in";
        default:
            return "mdi:help-circle-outline";
    }
}
function getTransactionTypeClass(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
        case TransactionType.CATEGORYTRANSFER:
            return "text-warning";
        case TransactionType.EXPENSE:
            return "text-error";
        case TransactionType.INCOME:
            return "text-success";
        default:
            return "";
    }
}
function getTransactionTypeLabel(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
            return "Kontotransfer";
        case TransactionType.CATEGORYTRANSFER:
            return "Kategorietransfer";
        case TransactionType.EXPENSE:
            return "Ausgabe";
        case TransactionType.INCOME:
            return "Einnahme";
        default:
            return "Unbekannt";
    }
}
function getSourceName(planning) {
    if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        return (categoryStore.getCategoryById(planning.categoryId || "")?.name || "-");
    }
    else {
        return accountStore.getAccountById(planning.accountId)?.name || "-";
    }
}
function getTargetName(planning) {
    if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        return (categoryStore.getCategoryById(planning.transferToCategoryId || "")
            ?.name || "-");
    }
    else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
        return (accountStore.getAccountById(planning.transferToAccountId || "")?.name ||
            "-");
    }
    else {
        return (categoryStore.getCategoryById(planning.categoryId || "")?.name || "-");
    }
}
// Alle fälligen Planungen ausführen
async function executeAllDuePlannings() {
    const analysis = await analyzeDuePlannings();
    if (analysis.totalCount === 0) {
        showToast("Keine fälligen Planungsbuchungen gefunden.", "info");
        return;
    }
    showExecuteConfirmation.value = true;
    pendingExecutionAnalysis.value = analysis;
}
async function analyzeDuePlannings() {
    const today = dayjs().startOf("day");
    let expenses = 0;
    let income = 0;
    let accountTransfers = 0;
    let categoryTransfers = 0;
    const processedPlanningIds = new Set();
    const planningsToProcess = [...planningStore.planningTransactions];
    for (const planning of planningsToProcess) {
        if (processedPlanningIds.has(planning.id) || !planning.isActive) {
            continue;
        }
        if (planning.name && planning.name.includes("(Gegenbuchung)")) {
            continue;
        }
        const overdueOccurrences = PlanningService.calculateNextOccurrences(planning, planning.startDate, today.format("YYYY-MM-DD"));
        if (overdueOccurrences.length > 0) {
            for (const dateStr of overdueOccurrences) {
                if (dayjs(dateStr).isSameOrBefore(today)) {
                    switch (planning.transactionType) {
                        case TransactionType.EXPENSE:
                            expenses++;
                            break;
                        case TransactionType.INCOME:
                            income++;
                            break;
                        case TransactionType.ACCOUNTTRANSFER:
                            accountTransfers++;
                            break;
                        case TransactionType.CATEGORYTRANSFER:
                            categoryTransfers++;
                            break;
                    }
                    if ((planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
                        planning.transactionType === TransactionType.CATEGORYTRANSFER) &&
                        planning.counterPlanningTransactionId) {
                        processedPlanningIds.add(planning.counterPlanningTransactionId);
                    }
                    processedPlanningIds.add(planning.id);
                }
            }
        }
    }
    return {
        expenses,
        income,
        accountTransfers,
        categoryTransfers,
        totalCount: expenses + income + accountTransfers + categoryTransfers,
    };
}
async function confirmExecution() {
    if (!pendingExecutionAnalysis.value)
        return;
    try {
        const count = await PlanningService.executeAllDuePlanningTransactions();
        showExecuteConfirmation.value = false;
        pendingExecutionAnalysis.value = null;
        showToast(`${count} automatische Planungsbuchungen erfolgreich ausgeführt.`, "success");
    }
    catch (error) {
        showToast("Fehler beim Ausführen der Planungsbuchungen. Bitte prüfen Sie die Konsole für Details.", "error");
    }
}
function cancelExecution() {
    showExecuteConfirmation.value = false;
    pendingExecutionAnalysis.value = null;
}
function getConfirmationMessage() {
    if (!pendingExecutionAnalysis.value)
        return "";
    const analysis = pendingExecutionAnalysis.value;
    const parts = [];
    if (analysis.expenses > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-error badge-sm mr-2">Ausgaben</span><span class="font-semibold">${analysis.expenses} Buchung${analysis.expenses === 1 ? "" : "en"}</span></div>`);
    }
    if (analysis.income > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-success badge-sm mr-2">Einnahmen</span><span class="font-semibold">${analysis.income} Buchung${analysis.income === 1 ? "" : "en"}</span></div>`);
    }
    if (analysis.accountTransfers > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-warning badge-sm mr-2">Kontotransfers</span><span class="font-semibold">${analysis.accountTransfers} Buchung${analysis.accountTransfers === 1 ? "" : "en"}</span></div>`);
    }
    if (analysis.categoryTransfers > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-info badge-sm mr-2">Kategorietransfers</span><span class="font-semibold">${analysis.categoryTransfers} Buchung${analysis.categoryTransfers === 1 ? "" : "en"}</span></div>`);
    }
    if (parts.length === 0)
        return "<p class='text-center text-base-content/70'>Keine fälligen Buchungen gefunden.</p>";
    return `
    <div class="space-y-3">
      <p class="text-sm text-base-content/80 mb-4">Folgende fällige Planungsbuchungen werden ausgeführt:</p>
      <div class="space-y-2">
        ${parts.join("")}
      </div>
      <div class="divider my-4"></div>
      <div class="text-center">
        <span class="badge badge-primary badge-lg">
          Insgesamt: ${analysis.totalCount} Buchung${analysis.totalCount === 1 ? "" : "en"}
        </span>
      </div>
    </div>
  `;
}
// Chart-Detail-Funktionen
function showAccountDetail(accountId) {
    selectedAccountForDetail.value = accountId;
    debugLog("[TransactionsView]", "Show account detail", { accountId });
}
function showCategoryDetail(categoryId) {
    selectedCategoryForDetail.value = categoryId;
    debugLog("[TransactionsView]", "Show category detail", { categoryId });
}
function hideAccountDetail() {
    selectedAccountForDetail.value = "";
}
function hideCategoryDetail() {
    selectedCategoryForDetail.value = "";
}
// Keyboard Event Handler für ALT+n
const handleKeydown = (event) => {
    if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (activeTab.value === "account" || activeTab.value === "category") {
            createTransaction();
        }
        else {
            createPlanning();
        }
    }
};
// Filter‑Persistenz
onMounted(() => {
    transactionFilterStore.loadFilters();
    // Keyboard Event Listener hinzufügen
    document.addEventListener("keydown", handleKeydown);
});
onUnmounted(() => {
    // Keyboard Event Listener entfernen
    document.removeEventListener("keydown", handleKeydown);
});
watch([selectedTagId, selectedCategoryId, currentViewMode], () => transactionFilterStore.saveFilters());
// Watch für activeTab um sicherzustellen, dass Charts und Listen bei Tab-Wechsel neu gerendert werden
watch(activeTab, (newTab) => {
    debugLog("[TransactionsView]", `Tab switched to: ${newTab}`);
    // Synchronisiere currentViewMode mit activeTab für die ersten beiden Tabs
    if (newTab === "account") {
        currentViewMode.value = "account";
    }
    else if (newTab === "category") {
        currentViewMode.value = "category";
    }
    // Refresh key um Vue-Komponenten zum Neurendern zu zwingen
    refreshKey.value++;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleRightClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddleRight: (__VLS_ctx.activeTab === 'upcoming' ? 'Alle fälligen ausführen' : undefined),
    btnMiddleRightIcon: (__VLS_ctx.activeTab === 'upcoming' ? 'mdi:play-circle' : undefined),
    btnRight: "Neue Transaktion",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleRightClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddleRight: (__VLS_ctx.activeTab === 'upcoming' ? 'Alle fälligen ausführen' : undefined),
    btnMiddleRightIcon: (__VLS_ctx.activeTab === 'upcoming' ? 'mdi:play-circle' : undefined),
    btnRight: "Neue Transaktion",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: ((query) => (__VLS_ctx.searchQuery = query))
};
const __VLS_7 = {
    onBtnMiddleRightClick: (__VLS_ctx.executeAllDuePlannings)
};
const __VLS_8 = {
    onBtnRightClick: (__VLS_ctx.createTransaction)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tabs tabs-boxed bg-base-200 mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'account';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'account' }) },
});
const __VLS_9 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    icon: "mdi:bank",
    ...{ class: "mr-2" },
}));
const __VLS_11 = __VLS_10({
    icon: "mdi:bank",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'category';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'category' }) },
});
const __VLS_13 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    icon: "mdi:folder-multiple",
    ...{ class: "mr-2" },
}));
const __VLS_15 = __VLS_14({
    icon: "mdi:folder-multiple",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "divider divider-horizontal mx-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'upcoming';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'upcoming' }) },
});
const __VLS_17 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    icon: "mdi:calendar-clock",
    ...{ class: "mr-2" },
}));
const __VLS_19 = __VLS_18({
    icon: "mdi:calendar-clock",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'accounts';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'accounts' }) },
});
const __VLS_21 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    icon: "mdi:chart-line",
    ...{ class: "mr-2" },
}));
const __VLS_23 = __VLS_22({
    icon: "mdi:chart-line",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'categories';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'categories' }) },
});
const __VLS_25 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    icon: "mdi:chart-areaspline",
    ...{ class: "mr-2" },
}));
const __VLS_27 = __VLS_26({
    icon: "mdi:chart-areaspline",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
if (__VLS_ctx.activeTab === 'account') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-30" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'account'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_29 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_31 = __VLS_30({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mx-2" },
    });
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_34 = __VLS_33({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    let __VLS_36;
    let __VLS_37;
    let __VLS_38;
    const __VLS_39 = {
        'onUpdate:modelValue': ((range) => __VLS_ctx.handleDateRangeUpdate(range))
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_40 = {};
    var __VLS_35;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'account'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_42 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_44 = __VLS_43({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedAccountId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedAccountId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.accountStore.activeAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (acc.id),
            value: (acc.id),
        });
        (acc.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedTransactionType),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedTransactionType
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "ausgabe",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "einnahme",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "transfer",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedReconciledFilter),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedReconciledFilter
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "abgeglichen",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "nicht abgeglichen",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    /** @type {[typeof SearchableSelectLite, ]} */ ;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(SearchableSelectLite, new SearchableSelectLite({
        modelValue: (__VLS_ctx.selectedCategoryId),
        options: (__VLS_ctx.categoryStore.categories),
        itemText: "name",
        itemValue: "id",
        placeholder: "Alle Kategorien",
    }));
    const __VLS_47 = __VLS_46({
        modelValue: (__VLS_ctx.selectedCategoryId),
        options: (__VLS_ctx.categoryStore.categories),
        itemText: "name",
        itemValue: "id",
        placeholder: "Alle Kategorien",
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    /** @type {[typeof SearchableSelectLite, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(SearchableSelectLite, new SearchableSelectLite({
        modelValue: (__VLS_ctx.selectedTagId),
        options: (__VLS_ctx.tagStore.tags),
        itemText: "name",
        itemValue: "id",
        placeholder: "Alle Tags",
    }));
    const __VLS_50 = __VLS_49({
        modelValue: (__VLS_ctx.selectedTagId),
        options: (__VLS_ctx.tagStore.tags),
        itemText: "name",
        itemValue: "id",
        placeholder: "Alle Tags",
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end mb-1" },
    });
    const __VLS_52 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_54 = __VLS_53({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    /** @type {[typeof BulkActionDropdown, ]} */ ;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(BulkActionDropdown, new BulkActionDropdown({
        ...{ 'onAssignAccount': {} },
        ...{ 'onChangeRecipient': {} },
        ...{ 'onAssignCategory': {} },
        ...{ 'onAssignTags': {} },
        ...{ 'onChangeDate': {} },
        ...{ 'onSetReconciled': {} },
        ...{ 'onRemoveReconciled': {} },
        ...{ 'onDelete': {} },
        selectedCount: (__VLS_ctx.selectedTransactionCount),
        ...{ class: "self-end mb-1" },
    }));
    const __VLS_57 = __VLS_56({
        ...{ 'onAssignAccount': {} },
        ...{ 'onChangeRecipient': {} },
        ...{ 'onAssignCategory': {} },
        ...{ 'onAssignTags': {} },
        ...{ 'onChangeDate': {} },
        ...{ 'onSetReconciled': {} },
        ...{ 'onRemoveReconciled': {} },
        ...{ 'onDelete': {} },
        selectedCount: (__VLS_ctx.selectedTransactionCount),
        ...{ class: "self-end mb-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    let __VLS_59;
    let __VLS_60;
    let __VLS_61;
    const __VLS_62 = {
        onAssignAccount: (__VLS_ctx.handleBulkAssignAccount)
    };
    const __VLS_63 = {
        onChangeRecipient: (__VLS_ctx.handleBulkChangeRecipient)
    };
    const __VLS_64 = {
        onAssignCategory: (__VLS_ctx.handleBulkAssignCategory)
    };
    const __VLS_65 = {
        onAssignTags: (__VLS_ctx.handleBulkAssignTags)
    };
    const __VLS_66 = {
        onChangeDate: (__VLS_ctx.handleBulkChangeDate)
    };
    const __VLS_67 = {
        onSetReconciled: (__VLS_ctx.handleBulkSetReconciled)
    };
    const __VLS_68 = {
        onRemoveReconciled: (__VLS_ctx.handleBulkRemoveReconciled)
    };
    const __VLS_69 = {
        onDelete: (__VLS_ctx.handleBulkDelete)
    };
    var __VLS_58;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body py-0 px-1" },
    });
    /** @type {[typeof TransactionList, ]} */ ;
    // @ts-ignore
    const __VLS_70 = __VLS_asFunctionalComponent(TransactionList, new TransactionList({
        ...{ 'onSortChange': {} },
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        ...{ 'onToggleReconciliation': {} },
        ...{ 'onSelectionChanged': {} },
        key: (`transaction-list-${__VLS_ctx.activeTab}`),
        ref: "transactionListRef",
        transactions: (__VLS_ctx.sortedTransactions),
        showAccount: (true),
        sortKey: (__VLS_ctx.sortKey),
        sortOrder: (__VLS_ctx.sortOrder),
        searchTerm: (__VLS_ctx.searchQuery),
    }));
    const __VLS_71 = __VLS_70({
        ...{ 'onSortChange': {} },
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        ...{ 'onToggleReconciliation': {} },
        ...{ 'onSelectionChanged': {} },
        key: (`transaction-list-${__VLS_ctx.activeTab}`),
        ref: "transactionListRef",
        transactions: (__VLS_ctx.sortedTransactions),
        showAccount: (true),
        sortKey: (__VLS_ctx.sortKey),
        sortOrder: (__VLS_ctx.sortOrder),
        searchTerm: (__VLS_ctx.searchQuery),
    }, ...__VLS_functionalComponentArgsRest(__VLS_70));
    let __VLS_73;
    let __VLS_74;
    let __VLS_75;
    const __VLS_76 = {
        onSortChange: (__VLS_ctx.handleSortChange)
    };
    const __VLS_77 = {
        onEdit: (__VLS_ctx.editTransaction)
    };
    const __VLS_78 = {
        onDelete: (__VLS_ctx.deleteTransaction)
    };
    const __VLS_79 = {
        onToggleReconciliation: (__VLS_ctx.toggleTransactionReconciled)
    };
    const __VLS_80 = {
        onSelectionChanged: (__VLS_ctx.handleSelectionChanged)
    };
    /** @type {typeof __VLS_ctx.transactionListRef} */ ;
    var __VLS_81 = {};
    var __VLS_72;
}
else if (__VLS_ctx.activeTab === 'category') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-30" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!(__VLS_ctx.activeTab === 'category'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_83 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_84 = __VLS_asFunctionalComponent(__VLS_83, new __VLS_83({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_85 = __VLS_84({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mx-2" },
    });
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_88 = __VLS_87({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
    let __VLS_90;
    let __VLS_91;
    let __VLS_92;
    const __VLS_93 = {
        'onUpdate:modelValue': ((range) => __VLS_ctx.handleDateRangeUpdate(range))
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_94 = {};
    var __VLS_89;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!(__VLS_ctx.activeTab === 'category'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_96 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_98 = __VLS_97({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    /** @type {[typeof SearchableSelectLite, ]} */ ;
    // @ts-ignore
    const __VLS_100 = __VLS_asFunctionalComponent(SearchableSelectLite, new SearchableSelectLite({
        modelValue: (__VLS_ctx.selectedCategoryId),
        options: (__VLS_ctx.categoryStore.categories),
        itemText: "name",
        itemValue: "id",
        placeholder: "Alle Kategorien",
    }));
    const __VLS_101 = __VLS_100({
        modelValue: (__VLS_ctx.selectedCategoryId),
        options: (__VLS_ctx.categoryStore.categories),
        itemText: "name",
        itemValue: "id",
        placeholder: "Alle Kategorien",
    }, ...__VLS_functionalComponentArgsRest(__VLS_100));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end mb-1" },
    });
    const __VLS_103 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_105 = __VLS_104({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_104));
    /** @type {[typeof BulkActionDropdown, ]} */ ;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(BulkActionDropdown, new BulkActionDropdown({
        ...{ 'onAssignAccount': {} },
        ...{ 'onChangeRecipient': {} },
        ...{ 'onAssignCategory': {} },
        ...{ 'onAssignTags': {} },
        ...{ 'onChangeDate': {} },
        ...{ 'onSetReconciled': {} },
        ...{ 'onRemoveReconciled': {} },
        ...{ 'onDelete': {} },
        selectedCount: (__VLS_ctx.selectedTransactionCount),
        ...{ class: "self-end mb-1" },
    }));
    const __VLS_108 = __VLS_107({
        ...{ 'onAssignAccount': {} },
        ...{ 'onChangeRecipient': {} },
        ...{ 'onAssignCategory': {} },
        ...{ 'onAssignTags': {} },
        ...{ 'onChangeDate': {} },
        ...{ 'onSetReconciled': {} },
        ...{ 'onRemoveReconciled': {} },
        ...{ 'onDelete': {} },
        selectedCount: (__VLS_ctx.selectedTransactionCount),
        ...{ class: "self-end mb-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
    let __VLS_110;
    let __VLS_111;
    let __VLS_112;
    const __VLS_113 = {
        onAssignAccount: (__VLS_ctx.handleBulkAssignAccount)
    };
    const __VLS_114 = {
        onChangeRecipient: (__VLS_ctx.handleBulkChangeRecipient)
    };
    const __VLS_115 = {
        onAssignCategory: (__VLS_ctx.handleBulkAssignCategory)
    };
    const __VLS_116 = {
        onAssignTags: (__VLS_ctx.handleBulkAssignTags)
    };
    const __VLS_117 = {
        onChangeDate: (__VLS_ctx.handleBulkChangeDate)
    };
    const __VLS_118 = {
        onSetReconciled: (__VLS_ctx.handleBulkSetReconciled)
    };
    const __VLS_119 = {
        onRemoveReconciled: (__VLS_ctx.handleBulkRemoveReconciled)
    };
    const __VLS_120 = {
        onDelete: (__VLS_ctx.handleBulkDelete)
    };
    var __VLS_109;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body py-0 px-1" },
    });
    /** @type {[typeof CategoryTransactionList, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(CategoryTransactionList, new CategoryTransactionList({
        ...{ 'onSortChange': {} },
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        ...{ 'onSelectionChanged': {} },
        key: (`category-transaction-list-${__VLS_ctx.activeTab}`),
        ref: "categoryTransactionListRef",
        transactions: (__VLS_ctx.sortedCategoryTransactions),
        sortKey: (__VLS_ctx.sortKey),
        sortOrder: (__VLS_ctx.sortOrder),
        searchTerm: (__VLS_ctx.searchQuery),
    }));
    const __VLS_122 = __VLS_121({
        ...{ 'onSortChange': {} },
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        ...{ 'onSelectionChanged': {} },
        key: (`category-transaction-list-${__VLS_ctx.activeTab}`),
        ref: "categoryTransactionListRef",
        transactions: (__VLS_ctx.sortedCategoryTransactions),
        sortKey: (__VLS_ctx.sortKey),
        sortOrder: (__VLS_ctx.sortOrder),
        searchTerm: (__VLS_ctx.searchQuery),
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    let __VLS_124;
    let __VLS_125;
    let __VLS_126;
    const __VLS_127 = {
        onSortChange: (__VLS_ctx.handleSortChange)
    };
    const __VLS_128 = {
        onEdit: (__VLS_ctx.editTransaction)
    };
    const __VLS_129 = {
        onDelete: (__VLS_ctx.deleteTransaction)
    };
    const __VLS_130 = {
        onSelectionChanged: (__VLS_ctx.handleSelectionChanged)
    };
    /** @type {typeof __VLS_ctx.categoryTransactionListRef} */ ;
    var __VLS_131 = {};
    var __VLS_123;
}
else if (__VLS_ctx.activeTab === 'upcoming') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-30" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_133 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_134 = __VLS_asFunctionalComponent(__VLS_133, new __VLS_133({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_135 = __VLS_134({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_134));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mx-2" },
    });
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_137 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_138 = __VLS_137({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_137));
    let __VLS_140;
    let __VLS_141;
    let __VLS_142;
    const __VLS_143 = {
        'onUpdate:modelValue': (__VLS_ctx.handlePlanningDateRangeUpdate)
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_144 = {};
    var __VLS_139;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_146 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_147 = __VLS_asFunctionalComponent(__VLS_146, new __VLS_146({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_148 = __VLS_147({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_147));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.planningSelectedAccountId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.planningSelectedAccountId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.accountStore.activeAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (acc.id),
            value: (acc.id),
        });
        (acc.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.planningSelectedCategoryId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.planningSelectedCategoryId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.categoryStore.activeCategories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (cat.id),
            value: (cat.id),
        });
        (cat.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end mb-1" },
    });
    const __VLS_150 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_151 = __VLS_asFunctionalComponent(__VLS_150, new __VLS_150({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_152 = __VLS_151({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_151));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body py-0 px-1" },
    });
    /** @type {[typeof PlanningTransactionList, ]} */ ;
    // @ts-ignore
    const __VLS_154 = __VLS_asFunctionalComponent(PlanningTransactionList, new PlanningTransactionList({
        ...{ 'onExecute': {} },
        ...{ 'onSkip': {} },
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        key: (`planning-list-${__VLS_ctx.activeTab}`),
        planningTransactions: (__VLS_ctx.filteredPlanningTransactions),
        searchTerm: (__VLS_ctx.planningSearchQuery),
    }));
    const __VLS_155 = __VLS_154({
        ...{ 'onExecute': {} },
        ...{ 'onSkip': {} },
        ...{ 'onEdit': {} },
        ...{ 'onDelete': {} },
        key: (`planning-list-${__VLS_ctx.activeTab}`),
        planningTransactions: (__VLS_ctx.filteredPlanningTransactions),
        searchTerm: (__VLS_ctx.planningSearchQuery),
    }, ...__VLS_functionalComponentArgsRest(__VLS_154));
    let __VLS_157;
    let __VLS_158;
    let __VLS_159;
    const __VLS_160 = {
        onExecute: (__VLS_ctx.executePlanning)
    };
    const __VLS_161 = {
        onSkip: (__VLS_ctx.skipPlanning)
    };
    const __VLS_162 = {
        onEdit: (__VLS_ctx.editPlanning)
    };
    const __VLS_163 = {
        onDelete: (__VLS_ctx.deletePlanning)
    };
    var __VLS_156;
}
else if (__VLS_ctx.activeTab === 'accounts') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-10" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                if (!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_164 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent(__VLS_164, new __VLS_164({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_166 = __VLS_165({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mx-2" },
    });
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_168 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_169 = __VLS_168({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_168));
    let __VLS_171;
    let __VLS_172;
    let __VLS_173;
    const __VLS_174 = {
        'onUpdate:modelValue': (__VLS_ctx.handlePlanningDateRangeUpdate)
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_175 = {};
    var __VLS_170;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                if (!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_177 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_178 = __VLS_asFunctionalComponent(__VLS_177, new __VLS_177({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_179 = __VLS_178({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_178));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.planningSelectedAccountId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.planningSelectedAccountId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.sortedActiveAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (acc.id),
            value: (acc.id),
        });
        (acc.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end mb-1" },
    });
    const __VLS_181 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_182 = __VLS_asFunctionalComponent(__VLS_181, new __VLS_181({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_183 = __VLS_182({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_182));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-xl font-bold mb-4" },
    });
    /** @type {[typeof AccountForecastChart, ]} */ ;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent(AccountForecastChart, new AccountForecastChart({
        key: (`accounts-chart-${__VLS_ctx.activeTab}`),
        dateRange: (__VLS_ctx.planningDateRange),
        filteredAccountId: (__VLS_ctx.planningSelectedAccountId),
        hideBadges: (true),
    }));
    const __VLS_186 = __VLS_185({
        key: (`accounts-chart-${__VLS_ctx.activeTab}`),
        dateRange: (__VLS_ctx.planningDateRange),
        filteredAccountId: (__VLS_ctx.planningSelectedAccountId),
        hideBadges: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
}
else if (__VLS_ctx.activeTab === 'categories') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-10" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                if (!(__VLS_ctx.activeTab === 'categories'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_188 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_189 = __VLS_asFunctionalComponent(__VLS_188, new __VLS_188({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_190 = __VLS_189({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_189));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mx-2" },
    });
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_192 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_193 = __VLS_192({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_192));
    let __VLS_195;
    let __VLS_196;
    let __VLS_197;
    const __VLS_198 = {
        'onUpdate:modelValue': (__VLS_ctx.handlePlanningDateRangeUpdate)
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_199 = {};
    var __VLS_194;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                if (!(__VLS_ctx.activeTab === 'categories'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_201 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_202 = __VLS_asFunctionalComponent(__VLS_201, new __VLS_201({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_203 = __VLS_202({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_202));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset pt-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend text-center opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'account'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'category'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                if (!(__VLS_ctx.activeTab === 'categories'))
                    return;
                __VLS_ctx.planningSelectedCategoryId = '';
            } },
        ...{ class: "btn btn-sm btn-outline rounded-full" },
        ...{ class: (__VLS_ctx.planningSelectedCategoryId
                ? 'border border-base-300'
                : 'border-2 border-accent') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "min-w-[120px]" },
    });
    /** @type {[typeof SelectCategory, ]} */ ;
    // @ts-ignore
    const __VLS_205 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
        modelValue: (__VLS_ctx.planningSelectedCategoryId),
        showNoneOption: (false),
        rounded: (true),
        ...{ class: "font-normal text-xs" },
    }));
    const __VLS_206 = __VLS_205({
        modelValue: (__VLS_ctx.planningSelectedCategoryId),
        showNoneOption: (false),
        rounded: (true),
        ...{ class: "font-normal text-xs" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_205));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end mb-1" },
    });
    const __VLS_208 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_209 = __VLS_asFunctionalComponent(__VLS_208, new __VLS_208({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_210 = __VLS_209({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-xl font-bold mb-4" },
    });
    /** @type {[typeof CategoryForecastChart, ]} */ ;
    // @ts-ignore
    const __VLS_212 = __VLS_asFunctionalComponent(CategoryForecastChart, new CategoryForecastChart({
        key: (`categories-chart-${__VLS_ctx.activeTab}`),
        dateRange: (__VLS_ctx.planningDateRange),
        filteredCategoryId: (__VLS_ctx.planningSelectedCategoryId),
    }));
    const __VLS_213 = __VLS_212({
        key: (`categories-chart-${__VLS_ctx.activeTab}`),
        dateRange: (__VLS_ctx.planningDateRange),
        filteredCategoryId: (__VLS_ctx.planningSelectedCategoryId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_212));
}
const __VLS_215 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_216 = __VLS_asFunctionalComponent(__VLS_215, new __VLS_215({
    to: "body",
}));
const __VLS_217 = __VLS_216({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_216));
__VLS_218.slots.default;
if (__VLS_ctx.showTransactionDetailModal) {
    /** @type {[typeof TransactionDetailModal, ]} */ ;
    // @ts-ignore
    const __VLS_219 = __VLS_asFunctionalComponent(TransactionDetailModal, new TransactionDetailModal({
        ...{ 'onClose': {} },
        isOpen: (__VLS_ctx.showTransactionDetailModal),
        transaction: (__VLS_ctx.selectedTransaction),
    }));
    const __VLS_220 = __VLS_219({
        ...{ 'onClose': {} },
        isOpen: (__VLS_ctx.showTransactionDetailModal),
        transaction: (__VLS_ctx.selectedTransaction),
    }, ...__VLS_functionalComponentArgsRest(__VLS_219));
    let __VLS_222;
    let __VLS_223;
    let __VLS_224;
    const __VLS_225 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showTransactionDetailModal))
                return;
            __VLS_ctx.showTransactionDetailModal = false;
        }
    };
    var __VLS_221;
}
var __VLS_218;
const __VLS_226 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_227 = __VLS_asFunctionalComponent(__VLS_226, new __VLS_226({
    to: "body",
}));
const __VLS_228 = __VLS_227({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_227));
__VLS_229.slots.default;
if (__VLS_ctx.showTransactionFormModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box overflow-visible relative w-full max-w-2xl" },
    });
    /** @type {[typeof TransactionForm, ]} */ ;
    // @ts-ignore
    const __VLS_230 = __VLS_asFunctionalComponent(TransactionForm, new TransactionForm({
        ...{ 'onCancel': {} },
        ...{ 'onSave': {} },
        transaction: (__VLS_ctx.selectedTransaction),
        initialAccountId: (__VLS_ctx.prefilledAccountId),
        initialTransactionType: (__VLS_ctx.prefilledTransactionType),
        initialCategoryId: (__VLS_ctx.prefilledCategoryId),
        initialTagIds: (__VLS_ctx.prefilledTagIds),
    }));
    const __VLS_231 = __VLS_230({
        ...{ 'onCancel': {} },
        ...{ 'onSave': {} },
        transaction: (__VLS_ctx.selectedTransaction),
        initialAccountId: (__VLS_ctx.prefilledAccountId),
        initialTransactionType: (__VLS_ctx.prefilledTransactionType),
        initialCategoryId: (__VLS_ctx.prefilledCategoryId),
        initialTagIds: (__VLS_ctx.prefilledTagIds),
    }, ...__VLS_functionalComponentArgsRest(__VLS_230));
    let __VLS_233;
    let __VLS_234;
    let __VLS_235;
    const __VLS_236 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showTransactionFormModal))
                return;
            __VLS_ctx.showTransactionFormModal = false;
        }
    };
    const __VLS_237 = {
        onSave: (__VLS_ctx.handleSave)
    };
    var __VLS_232;
}
var __VLS_229;
/** @type {[typeof BulkAssignAccountModal, ]} */ ;
// @ts-ignore
const __VLS_238 = __VLS_asFunctionalComponent(BulkAssignAccountModal, new BulkAssignAccountModal({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkAssignAccountModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}));
const __VLS_239 = __VLS_238({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkAssignAccountModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}, ...__VLS_functionalComponentArgsRest(__VLS_238));
let __VLS_241;
let __VLS_242;
let __VLS_243;
const __VLS_244 = {
    onClose: (...[$event]) => {
        __VLS_ctx.showBulkAssignAccountModal = false;
    }
};
const __VLS_245 = {
    onConfirm: (__VLS_ctx.onBulkAssignAccountConfirm)
};
var __VLS_240;
/** @type {[typeof BulkChangeRecipientModal, ]} */ ;
// @ts-ignore
const __VLS_246 = __VLS_asFunctionalComponent(BulkChangeRecipientModal, new BulkChangeRecipientModal({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkChangeRecipientModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}));
const __VLS_247 = __VLS_246({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkChangeRecipientModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}, ...__VLS_functionalComponentArgsRest(__VLS_246));
let __VLS_249;
let __VLS_250;
let __VLS_251;
const __VLS_252 = {
    onClose: (...[$event]) => {
        __VLS_ctx.showBulkChangeRecipientModal = false;
    }
};
const __VLS_253 = {
    onConfirm: (__VLS_ctx.onBulkChangeRecipientConfirm)
};
var __VLS_248;
/** @type {[typeof BulkAssignCategoryModal, ]} */ ;
// @ts-ignore
const __VLS_254 = __VLS_asFunctionalComponent(BulkAssignCategoryModal, new BulkAssignCategoryModal({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkAssignCategoryModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}));
const __VLS_255 = __VLS_254({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkAssignCategoryModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}, ...__VLS_functionalComponentArgsRest(__VLS_254));
let __VLS_257;
let __VLS_258;
let __VLS_259;
const __VLS_260 = {
    onClose: (...[$event]) => {
        __VLS_ctx.showBulkAssignCategoryModal = false;
    }
};
const __VLS_261 = {
    onConfirm: (__VLS_ctx.onBulkAssignCategoryConfirm)
};
var __VLS_256;
/** @type {[typeof BulkAssignTagsModal, ]} */ ;
// @ts-ignore
const __VLS_262 = __VLS_asFunctionalComponent(BulkAssignTagsModal, new BulkAssignTagsModal({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkAssignTagsModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}));
const __VLS_263 = __VLS_262({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkAssignTagsModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}, ...__VLS_functionalComponentArgsRest(__VLS_262));
let __VLS_265;
let __VLS_266;
let __VLS_267;
const __VLS_268 = {
    onClose: (...[$event]) => {
        __VLS_ctx.showBulkAssignTagsModal = false;
    }
};
const __VLS_269 = {
    onConfirm: (__VLS_ctx.onBulkAssignTagsConfirm)
};
var __VLS_264;
/** @type {[typeof BulkChangeDateModal, ]} */ ;
// @ts-ignore
const __VLS_270 = __VLS_asFunctionalComponent(BulkChangeDateModal, new BulkChangeDateModal({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkChangeDateModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}));
const __VLS_271 = __VLS_270({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkChangeDateModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
}, ...__VLS_functionalComponentArgsRest(__VLS_270));
let __VLS_273;
let __VLS_274;
let __VLS_275;
const __VLS_276 = {
    onClose: (...[$event]) => {
        __VLS_ctx.showBulkChangeDateModal = false;
    }
};
const __VLS_277 = {
    onConfirm: (__VLS_ctx.onBulkChangeDateConfirm)
};
var __VLS_272;
/** @type {[typeof BulkDeleteModal, ]} */ ;
// @ts-ignore
const __VLS_278 = __VLS_asFunctionalComponent(BulkDeleteModal, new BulkDeleteModal({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkDeleteModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
    transactionIds: (__VLS_ctx.bulkDeleteTransactionIds),
}));
const __VLS_279 = __VLS_278({
    ...{ 'onClose': {} },
    ...{ 'onConfirm': {} },
    isOpen: (__VLS_ctx.showBulkDeleteModal),
    selectedCount: (__VLS_ctx.selectedTransactionCount),
    transactionIds: (__VLS_ctx.bulkDeleteTransactionIds),
}, ...__VLS_functionalComponentArgsRest(__VLS_278));
let __VLS_281;
let __VLS_282;
let __VLS_283;
const __VLS_284 = {
    onClose: (...[$event]) => {
        __VLS_ctx.showBulkDeleteModal = false;
    }
};
const __VLS_285 = {
    onConfirm: (__VLS_ctx.onBulkDeleteConfirm)
};
var __VLS_280;
if (__VLS_ctx.showNewPlanningModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-3xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof PlanningTransactionForm, ]} */ ;
    // @ts-ignore
    const __VLS_286 = __VLS_asFunctionalComponent(PlanningTransactionForm, new PlanningTransactionForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }));
    const __VLS_287 = __VLS_286({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_286));
    let __VLS_289;
    let __VLS_290;
    let __VLS_291;
    const __VLS_292 = {
        onSave: (__VLS_ctx.savePlanning)
    };
    const __VLS_293 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showNewPlanningModal))
                return;
            __VLS_ctx.showNewPlanningModal = false;
        }
    };
    var __VLS_288;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showNewPlanningModal))
                    return;
                __VLS_ctx.showNewPlanningModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-3xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof PlanningTransactionForm, ]} */ ;
    // @ts-ignore
    const __VLS_294 = __VLS_asFunctionalComponent(PlanningTransactionForm, new PlanningTransactionForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        transaction: (__VLS_ctx.selectedPlanning),
        isEdit: (true),
    }));
    const __VLS_295 = __VLS_294({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        transaction: (__VLS_ctx.selectedPlanning),
        isEdit: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_294));
    let __VLS_297;
    let __VLS_298;
    let __VLS_299;
    const __VLS_300 = {
        onSave: (__VLS_ctx.savePlanning)
    };
    const __VLS_301 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning))
                return;
            __VLS_ctx.showEditPlanningModal = false;
        }
    };
    var __VLS_296;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning))
                    return;
                __VLS_ctx.showEditPlanningModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showExecuteConfirmation && __VLS_ctx.pendingExecutionAnalysis) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_302 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Fällige Planungsbuchungen ausführen",
        message: (__VLS_ctx.getConfirmationMessage()),
        useHtml: (true),
        confirmText: "Ausführen",
        cancelText: "Abbrechen",
    }));
    const __VLS_303 = __VLS_302({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Fällige Planungsbuchungen ausführen",
        message: (__VLS_ctx.getConfirmationMessage()),
        useHtml: (true),
        confirmText: "Ausführen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_302));
    let __VLS_305;
    let __VLS_306;
    let __VLS_307;
    const __VLS_308 = {
        onConfirm: (__VLS_ctx.confirmExecution)
    };
    const __VLS_309 = {
        onCancel: (__VLS_ctx.cancelExecution)
    };
    var __VLS_304;
}
const __VLS_310 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_311 = __VLS_asFunctionalComponent(__VLS_310, new __VLS_310({
    to: "body",
}));
const __VLS_312 = __VLS_311({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_311));
__VLS_313.slots.default;
for (const [toast] of __VLS_getVForSourceType((__VLS_ctx.activeToasts))) {
    /** @type {[typeof InfoToast, ]} */ ;
    // @ts-ignore
    const __VLS_314 = __VLS_asFunctionalComponent(InfoToast, new InfoToast({
        ...{ 'onClose': {} },
        key: (toast.id),
        message: (toast.message),
        type: (toast.type),
        duration: (toast.duration),
    }));
    const __VLS_315 = __VLS_314({
        ...{ 'onClose': {} },
        key: (toast.id),
        message: (toast.message),
        type: (toast.type),
        duration: (toast.duration),
    }, ...__VLS_functionalComponentArgsRest(__VLS_314));
    let __VLS_317;
    let __VLS_318;
    let __VLS_319;
    const __VLS_320 = {
        onClose: (...[$event]) => {
            __VLS_ctx.removeToast(toast.id);
        }
    };
    var __VLS_316;
}
var __VLS_313;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['divider-horizontal']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-30']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-visible']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
// @ts-ignore
var __VLS_41 = __VLS_40, __VLS_82 = __VLS_81, __VLS_95 = __VLS_94, __VLS_132 = __VLS_131, __VLS_145 = __VLS_144, __VLS_176 = __VLS_175, __VLS_200 = __VLS_199;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            TransactionList: TransactionList,
            CategoryTransactionList: CategoryTransactionList,
            PlanningTransactionList: PlanningTransactionList,
            TransactionDetailModal: TransactionDetailModal,
            TransactionForm: TransactionForm,
            DateRangePicker: DateRangePicker,
            SearchGroup: SearchGroup,
            SearchableSelectLite: SearchableSelectLite,
            SelectCategory: SelectCategory,
            BulkActionDropdown: BulkActionDropdown,
            BulkAssignAccountModal: BulkAssignAccountModal,
            BulkChangeRecipientModal: BulkChangeRecipientModal,
            BulkAssignCategoryModal: BulkAssignCategoryModal,
            BulkAssignTagsModal: BulkAssignTagsModal,
            BulkChangeDateModal: BulkChangeDateModal,
            BulkDeleteModal: BulkDeleteModal,
            PlanningTransactionForm: PlanningTransactionForm,
            AccountForecastChart: AccountForecastChart,
            CategoryForecastChart: CategoryForecastChart,
            ConfirmationModal: ConfirmationModal,
            Icon: Icon,
            InfoToast: InfoToast,
            activeToasts: activeToasts,
            removeToast: removeToast,
            accountStore: accountStore,
            categoryStore: categoryStore,
            tagStore: tagStore,
            sortedActiveAccounts: sortedActiveAccounts,
            showTransactionFormModal: showTransactionFormModal,
            showTransactionDetailModal: showTransactionDetailModal,
            showNewPlanningModal: showNewPlanningModal,
            showEditPlanningModal: showEditPlanningModal,
            showExecuteConfirmation: showExecuteConfirmation,
            selectedPlanning: selectedPlanning,
            transactionListRef: transactionListRef,
            categoryTransactionListRef: categoryTransactionListRef,
            dateRangePickerRef: dateRangePickerRef,
            pendingExecutionAnalysis: pendingExecutionAnalysis,
            planningSelectedAccountId: planningSelectedAccountId,
            planningSelectedCategoryId: planningSelectedCategoryId,
            planningSearchQuery: planningSearchQuery,
            planningDateRange: planningDateRange,
            activeTab: activeTab,
            showBulkAssignAccountModal: showBulkAssignAccountModal,
            showBulkChangeRecipientModal: showBulkChangeRecipientModal,
            showBulkAssignCategoryModal: showBulkAssignCategoryModal,
            showBulkAssignTagsModal: showBulkAssignTagsModal,
            showBulkChangeDateModal: showBulkChangeDateModal,
            showBulkDeleteModal: showBulkDeleteModal,
            bulkDeleteTransactionIds: bulkDeleteTransactionIds,
            selectedTransactionCount: selectedTransactionCount,
            handleSelectionChanged: handleSelectionChanged,
            selectedTransaction: selectedTransaction,
            searchQuery: searchQuery,
            handleDateRangeUpdate: handleDateRangeUpdate,
            handlePlanningDateRangeUpdate: handlePlanningDateRangeUpdate,
            navigateMonth: navigateMonth,
            selectedAccountId: selectedAccountId,
            selectedTransactionType: selectedTransactionType,
            selectedReconciledFilter: selectedReconciledFilter,
            selectedTagId: selectedTagId,
            selectedCategoryId: selectedCategoryId,
            sortKey: sortKey,
            sortOrder: sortOrder,
            sortedTransactions: sortedTransactions,
            sortedCategoryTransactions: sortedCategoryTransactions,
            handleSortChange: handleSortChange,
            editTransaction: editTransaction,
            prefilledAccountId: prefilledAccountId,
            prefilledTransactionType: prefilledTransactionType,
            prefilledCategoryId: prefilledCategoryId,
            prefilledTagIds: prefilledTagIds,
            createTransaction: createTransaction,
            handleSave: handleSave,
            deleteTransaction: deleteTransaction,
            clearFilters: clearFilters,
            toggleTransactionReconciled: toggleTransactionReconciled,
            handleBulkAssignAccount: handleBulkAssignAccount,
            handleBulkChangeRecipient: handleBulkChangeRecipient,
            handleBulkAssignCategory: handleBulkAssignCategory,
            handleBulkAssignTags: handleBulkAssignTags,
            handleBulkChangeDate: handleBulkChangeDate,
            handleBulkSetReconciled: handleBulkSetReconciled,
            handleBulkRemoveReconciled: handleBulkRemoveReconciled,
            handleBulkDelete: handleBulkDelete,
            onBulkAssignAccountConfirm: onBulkAssignAccountConfirm,
            onBulkChangeRecipientConfirm: onBulkChangeRecipientConfirm,
            onBulkAssignCategoryConfirm: onBulkAssignCategoryConfirm,
            onBulkAssignTagsConfirm: onBulkAssignTagsConfirm,
            onBulkChangeDateConfirm: onBulkChangeDateConfirm,
            onBulkDeleteConfirm: onBulkDeleteConfirm,
            filteredPlanningTransactions: filteredPlanningTransactions,
            editPlanning: editPlanning,
            savePlanning: savePlanning,
            deletePlanning: deletePlanning,
            executePlanning: executePlanning,
            skipPlanning: skipPlanning,
            executeAllDuePlannings: executeAllDuePlannings,
            confirmExecution: confirmExecution,
            cancelExecution: cancelExecution,
            getConfirmationMessage: getConfirmationMessage,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
