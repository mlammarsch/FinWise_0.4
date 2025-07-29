<!-- Datei: src/views/TransactionsView.vue -->
<script setup lang="ts">
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
import TransactionDetailModal from "../components/transaction/TransactionDetailModal.vue";
import TransactionForm from "../components/transaction/TransactionForm.vue";
import DateRangePicker from "../components/ui/DateRangePicker.vue";
import SearchGroup from "../components/ui/SearchGroup.vue";
import SearchableSelectLite from "../components/ui/SearchableSelectLite.vue";
import BulkActionDropdown from "../components/ui/BulkActionDropdown.vue";
import BulkAssignAccountModal from "../components/ui/BulkAssignAccountModal.vue";
import BulkChangeRecipientModal from "../components/ui/BulkChangeRecipientModal.vue";
import BulkAssignCategoryModal from "../components/ui/BulkAssignCategoryModal.vue";
import BulkAssignTagsModal from "../components/ui/BulkAssignTagsModal.vue";
import BulkChangeDateModal from "../components/ui/BulkChangeDateModal.vue";
import BulkDeleteModal from "../components/ui/BulkDeleteModal.vue";
import PlanningTransactionForm from "../components/planning/PlanningTransactionForm.vue";
import ForecastChart from "../components/ui/charts/ForecastChart.vue";
import DetailedForecastChart from "../components/ui/charts/DetailedForecastChart.vue";
import CurrencyDisplay from "../components/ui/CurrencyDisplay.vue";
import ConfirmationModal from "../components/ui/ConfirmationModal.vue";
import { Transaction, TransactionType, PlanningTransaction } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import { debugLog, infoLog, errorLog, warnLog } from "../utils/logger";
import { TransactionService } from "../services/TransactionService";
import { PlanningService } from "../services/PlanningService";
import { BalanceService } from "../services/BalanceService";
import { BudgetService } from "../services/BudgetService";
import { Icon } from "@iconify/vue";
import InfoToast from "../components/ui/InfoToast.vue";

const route = useRoute();
const router = useRouter();

const refreshKey = ref(0);

// Toast Management --------------------------------------------------------
interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

const activeToasts = ref<ToastMessage[]>([]);

function showToast(
  message: string,
  type: ToastMessage["type"] = "info",
  duration?: number
) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const toast: ToastMessage = { id, message, type, duration };
  activeToasts.value.push(toast);
}

function removeToast(id: string) {
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

// Modals ------------------------------------------------------------------
const showTransactionFormModal = ref(false);
const showTransactionDetailModal = ref(false);
const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const showExecuteConfirmation = ref(false);
const selectedPlanning = ref<PlanningTransaction | null>(null);
const transactionListRef = ref<InstanceType<typeof TransactionList> | null>(
  null
);
const categoryTransactionListRef = ref<InstanceType<
  typeof CategoryTransactionList
> | null>(null);

// DateRangePicker reference for navigation
const dateRangePickerRef = ref<any>(null);

// Planning-spezifische Variablen
const selectedAccountForDetail = ref("");
const selectedCategoryForDetail = ref("");

// Für die Ausführungsbestätigung
const pendingExecutionAnalysis = ref<{
  expenses: number;
  income: number;
  accountTransfers: number;
  categoryTransfers: number;
  totalCount: number;
} | null>(null);

// Planning-spezifische Filter
const planningSelectedAccountId = ref("");
const planningSelectedCategoryId = ref("");
const planningSearchQuery = ref("");

// Planning DateRange
const planningDateRange = ref<{ start: string; end: string }>({
  start: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  end: dayjs().endOf("month").format("YYYY-MM-DD"),
});

// Erweiterte Tab-Modi für Planning
const activeTab = ref<
  "account" | "category" | "upcoming" | "accounts" | "categories"
>("account");

// Bulk Actions ----------------------------------------------------------------
const showBulkAssignAccountModal = ref(false);
const showBulkChangeRecipientModal = ref(false);
const showBulkAssignCategoryModal = ref(false);
const showBulkAssignTagsModal = ref(false);
const showBulkChangeDateModal = ref(false);
const showBulkDeleteModal = ref(false);
const bulkDeleteTransactionIds = ref<string[]>([]);

const selectedTransactionCount = computed(() => {
  if (currentViewMode.value === "account") {
    return transactionListRef.value?.getSelectedTransactions()?.length || 0;
  } else {
    return (
      categoryTransactionListRef.value?.getSelectedTransactions()?.length || 0
    );
  }
});

// Ansicht / Filter --------------------------------------------------------
const currentViewMode = computed({
  get: () => transactionFilterStore.currentViewMode,
  set: (v) => (transactionFilterStore.currentViewMode = v),
});

const selectedTransaction = ref<Transaction | null>(null);

const searchQuery = computed({
  get: () => searchStore.globalSearchQuery,
  set: (v) => searchStore.search(v),
});

const dateRange = computed({
  get: () => transactionFilterStore.dateRange,
  set: (v) => transactionFilterStore.updateDateRange(v.start, v.end),
});
function handleDateRangeUpdate(p: { start: string; end: string }) {
  transactionFilterStore.updateDateRange(p.start, p.end);
  refreshKey.value++;
}

// Planning DateRange Handler
function handlePlanningDateRangeUpdate(payload: {
  start: string;
  end: string;
}) {
  planningDateRange.value = payload;
  debugLog("[TransactionsView]", "Planning date range updated", payload);
}

// Navigation methods for chevron buttons
function navigateMonth(direction: "prev" | "next") {
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
  get: () => transactionFilterStore.sortKey as keyof Transaction,
  set: (v) => (transactionFilterStore.sortKey = v),
});
const sortOrder = computed({
  get: () => transactionFilterStore.sortOrder,
  set: (v) => (transactionFilterStore.sortOrder = v),
});
const sortedTransactions = computed(
  () => transactionFilterStore.sortedTransactions
);
const sortedCategoryTransactions = computed(
  () => transactionFilterStore.sortedCategoryTransactions
);

function sortBy(key: keyof Transaction) {
  transactionFilterStore.setSortKey(key);
}
function handleSortChange(key: keyof Transaction) {
  sortBy(key);
}

// Aktionen ---------------------------------------------------------------
const viewTransaction = (tx: Transaction) => {
  selectedTransaction.value = tx;
  showTransactionDetailModal.value = true;
};

const editTransaction = (tx: Transaction) => {
  selectedTransaction.value = tx;
  showTransactionFormModal.value = true;
  showTransactionDetailModal.value = false;
};

// Vorbelegungswerte für neue Transaktionen
const prefilledAccountId = ref<string>("");
const prefilledTransactionType = ref<TransactionType | undefined>(undefined);
const prefilledCategoryId = ref<string>("");
const prefilledTagIds = ref<string[]>([]);

const createTransaction = () => {
  // Aktuelle Filter als Vorbelegung übernehmen
  prefilledAccountId.value = selectedAccountId.value || "";
  prefilledTransactionType.value =
    (selectedTransactionType.value as TransactionType) || undefined;
  prefilledCategoryId.value = selectedCategoryId.value || "";
  prefilledTagIds.value = selectedTagId.value ? [selectedTagId.value] : [];

  selectedTransaction.value = null;
  showTransactionFormModal.value = true;
};

const handleSave = (payload: any) => {
  if (payload.type === TransactionType.ACCOUNTTRANSFER) {
    if (selectedTransaction.value) {
      // EDIT: Bestehende Transaktion zu Account Transfer ändern
      // Zuerst die ursprüngliche Transaktion löschen
      TransactionService.deleteTransaction(selectedTransaction.value.id);
      // Dann neuen Account Transfer erstellen
      TransactionService.addAccountTransfer(
        payload.fromAccountId,
        payload.toAccountId,
        payload.amount,
        payload.date,
        payload.valueDate,
        payload.note
      );
    } else {
      // CREATE: Neuen Account Transfer erstellen
      TransactionService.addAccountTransfer(
        payload.fromAccountId,
        payload.toAccountId,
        payload.amount,
        payload.date,
        payload.valueDate,
        payload.note
      );
    }
  } else {
    const tx = {
      ...payload,
      payee: recipientStore.getRecipientById(payload.recipientId)?.name || "",
    };
    if (selectedTransaction.value) {
      TransactionService.updateTransaction(selectedTransaction.value.id, tx);
    } else {
      TransactionService.addTransaction(tx);
    }
  }
  showTransactionFormModal.value = false;
  selectedTransaction.value = null;
  refreshKey.value++;
};

const deleteTransaction = (tx: Transaction) => {
  TransactionService.deleteTransaction(tx.id);
  showTransactionDetailModal.value = false;
};

function clearFilters() {
  transactionFilterStore.clearFilters();
}

// Toggle reconciled
function toggleTransactionReconciled(transaction: Transaction) {
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
  const selectedTransactions =
    currentViewMode.value === "account"
      ? transactionListRef.value?.getSelectedTransactions()
      : categoryTransactionListRef.value?.getSelectedTransactions();

  if (selectedTransactions && selectedTransactions.length > 0) {
    onBulkSetReconciledConfirm(selectedTransactions);
  }
}

function handleBulkRemoveReconciled() {
  const selectedTransactions =
    currentViewMode.value === "account"
      ? transactionListRef.value?.getSelectedTransactions()
      : categoryTransactionListRef.value?.getSelectedTransactions();

  if (selectedTransactions && selectedTransactions.length > 0) {
    onBulkRemoveReconciledConfirm(selectedTransactions);
  }
}

function handleBulkDelete() {
  const selectedTransactions =
    currentViewMode.value === "account"
      ? transactionListRef.value?.getSelectedTransactions()
      : categoryTransactionListRef.value?.getSelectedTransactions();

  if (selectedTransactions && selectedTransactions.length > 0) {
    bulkDeleteTransactionIds.value = selectedTransactions.map((tx) => tx.id);
    showBulkDeleteModal.value = true;
  }
}

// Bulk Action Confirmation Handlers ------------------------------------------
async function onBulkAssignAccountConfirm(accountId: string) {
  debugLog("[TransactionsView]", "onBulkAssignAccountConfirm", { accountId });

  try {
    // Hole die ausgewählten Transaktionen
    const selectedTransactions =
      currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();

    if (!selectedTransactions || selectedTransactions.length === 0) {
      warnLog(
        "[TransactionsView]",
        "Keine Transaktionen für Bulk-Kontozuweisung ausgewählt"
      );
      showBulkAssignAccountModal.value = false;
      return;
    }

    const transactionIds = selectedTransactions.map((tx) => tx.id);

    // Führe die Bulk-Kontozuweisung durch
    const result = await TransactionService.bulkAssignAccount(
      transactionIds,
      accountId
    );

    if (result.success) {
      infoLog(
        "[TransactionsView]",
        `Bulk-Kontozuweisung erfolgreich: ${result.updatedCount} Transaktionen aktualisiert`
      );

      // Auswahl zurücksetzen
      if (currentViewMode.value === "account") {
        transactionListRef.value?.clearSelection();
      } else {
        categoryTransactionListRef.value?.clearSelection();
      }

      // Erfolgs-Toast anzeigen
      showToast(
        `${result.updatedCount} Transaktionen erfolgreich zugewiesen`,
        "success"
      );
    } else {
      errorLog("[TransactionsView]", "Fehler bei Bulk-Kontozuweisung", {
        errors: result.errors,
        updatedCount: result.updatedCount,
      });

      // Fehler-Toast anzeigen
      showToast(
        `Fehler bei Kontozuweisung: ${result.errors.join(", ")}`,
        "error"
      );
    }
  } catch (error) {
    errorLog(
      "[TransactionsView]",
      "Unerwarteter Fehler bei Bulk-Kontozuweisung",
      {
        error: error instanceof Error ? error.message : String(error),
        accountId,
      }
    );

    // Fehler-Toast anzeigen
    showToast("Unerwarteter Fehler bei der Kontozuweisung", "error");
  } finally {
    showBulkAssignAccountModal.value = false;
  }
}

async function onBulkChangeRecipientConfirm(
  recipientId: string | null,
  removeAll: boolean = false
) {
  debugLog("[TransactionsView]", "onBulkChangeRecipientConfirm", {
    recipientId,
    removeAll,
  });

  try {
    // Hole die ausgewählten Transaktionen
    const selectedTransactions =
      currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();

    if (!selectedTransactions || selectedTransactions.length === 0) {
      warnLog(
        "[TransactionsView]",
        "Keine Transaktionen für Bulk-Empfänger-Änderung ausgewählt"
      );
      showBulkChangeRecipientModal.value = false;
      return;
    }

    const transactionIds = selectedTransactions.map((tx) => tx.id);

    // Verwende die neue bulkChangeRecipient Funktion
    const result = await TransactionService.bulkChangeRecipient(
      transactionIds,
      removeAll ? null : recipientId,
      removeAll
    );

    if (result.success) {
      infoLog("[TransactionsView]", "Bulk-Empfänger-Änderung erfolgreich", {
        updatedCount: result.updatedCount,
        recipientId: removeAll ? "alle entfernt" : recipientId,
      });

      // Auswahl zurücksetzen
      if (currentViewMode.value === "account") {
        transactionListRef.value?.clearSelection();
      } else {
        categoryTransactionListRef.value?.clearSelection();
      }

      // Refresh der Transaktionsliste
      refreshKey.value++;
    } else {
      errorLog("[TransactionsView]", "Bulk-Empfänger-Änderung fehlgeschlagen", {
        errors: result.errors,
        updatedCount: result.updatedCount,
      });
    }
  } catch (error) {
    errorLog("[TransactionsView]", "Fehler bei Bulk-Empfänger-Änderung", {
      error: error instanceof Error ? error.message : String(error),
      recipientId,
      removeAll,
    });
  } finally {
    showBulkChangeRecipientModal.value = false;
  }
}

async function onBulkAssignCategoryConfirm(
  categoryId: string | null,
  removeAll: boolean = false
) {
  debugLog("[TransactionsView]", "onBulkAssignCategoryConfirm", {
    categoryId,
    removeAll,
  });

  try {
    // Hole die ausgewählten Transaktionen
    const selectedTransactions =
      currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();

    if (!selectedTransactions || selectedTransactions.length === 0) {
      warnLog(
        "[TransactionsView]",
        "Keine Transaktionen für Bulk-Kategorienzuweisung ausgewählt"
      );
      showBulkAssignCategoryModal.value = false;
      return;
    }

    const transactionIds = selectedTransactions.map((tx) => tx.id);

    // Verwende die neue bulkAssignCategory Funktion
    const result = await TransactionService.bulkAssignCategory(
      transactionIds,
      removeAll ? null : categoryId
    );

    if (result.success) {
      infoLog("[TransactionsView]", "Bulk-Kategorienzuweisung erfolgreich", {
        updatedCount: result.updatedCount,
        categoryId: removeAll ? "entfernt" : categoryId,
      });

      // Auswahl zurücksetzen
      if (currentViewMode.value === "account") {
        transactionListRef.value?.clearSelection();
      } else {
        categoryTransactionListRef.value?.clearSelection();
      }

      // Erfolgs-Toast anzeigen
      showToast(
        `${result.updatedCount} Transaktionen erfolgreich aktualisiert`,
        "success"
      );
    } else {
      warnLog("[TransactionsView]", "Bulk-Kategorienzuweisung mit Fehlern", {
        updatedCount: result.updatedCount,
        errors: result.errors,
      });

      // Fehler-Toast anzeigen
      showToast(
        `Fehler bei Kategorienzuweisung: ${result.errors.join(", ")}`,
        "error"
      );
    }
  } catch (error) {
    errorLog("[TransactionsView]", "Fehler bei Bulk-Kategorienzuweisung", {
      error: error instanceof Error ? error.message : String(error),
      categoryId,
      removeAll,
    });

    // Fehler-Toast anzeigen
    showToast("Unerwarteter Fehler bei der Kategorienzuweisung", "error");
  } finally {
    showBulkAssignCategoryModal.value = false;
  }
}

async function onBulkAssignTagsConfirm(
  tagIds: string[] | null,
  removeAll: boolean
) {
  debugLog("[TransactionsView]", "onBulkAssignTagsConfirm", {
    tagIds,
    removeAll,
  });

  try {
    // Hole die ausgewählten Transaktionen
    const selectedTransactions =
      currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();

    if (!selectedTransactions || selectedTransactions.length === 0) {
      warnLog(
        "[TransactionsView]",
        "Keine Transaktionen für Bulk-Tag-Zuweisung ausgewählt"
      );
      showBulkAssignTagsModal.value = false;
      return;
    }

    const transactionIds = selectedTransactions.map((tx) => tx.id);

    // Führe die Bulk-Tag-Zuweisung durch
    const result = await TransactionService.bulkAssignTags(
      transactionIds,
      tagIds,
      removeAll
    );

    if (result.success) {
      infoLog(
        "[TransactionsView]",
        `Bulk-Tag-Zuweisung erfolgreich: ${result.updatedCount} Transaktionen aktualisiert`
      );

      // Auswahl zurücksetzen
      if (currentViewMode.value === "account") {
        transactionListRef.value?.clearSelection();
      } else {
        categoryTransactionListRef.value?.clearSelection();
      }

      // Erfolgs-Toast anzeigen
      showToast(
        `${result.updatedCount} Transaktionen erfolgreich aktualisiert`,
        "success"
      );
    } else {
      errorLog("[TransactionsView]", "Fehler bei Bulk-Tag-Zuweisung", {
        errors: result.errors,
        updatedCount: result.updatedCount,
      });

      // Fehler-Toast anzeigen
      showToast(
        `Fehler bei Tag-Zuweisung: ${result.errors.join(", ")}`,
        "error"
      );
    }
  } catch (error) {
    errorLog(
      "[TransactionsView]",
      "Unerwarteter Fehler bei Bulk-Tag-Zuweisung",
      {
        error: error instanceof Error ? error.message : String(error),
        tagIds,
        removeAll,
      }
    );

    // Fehler-Toast anzeigen
    showToast("Unerwarteter Fehler bei der Tag-Zuweisung", "error");
  } finally {
    showBulkAssignTagsModal.value = false;
  }
}

async function onBulkChangeDateConfirm(newDate: string) {
  debugLog("[TransactionsView]", "onBulkChangeDateConfirm", { newDate });

  try {
    // Hole die ausgewählten Transaktionen
    const selectedTransactions =
      currentViewMode.value === "account"
        ? transactionListRef.value?.getSelectedTransactions()
        : categoryTransactionListRef.value?.getSelectedTransactions();

    if (!selectedTransactions || selectedTransactions.length === 0) {
      warnLog(
        "[TransactionsView]",
        "Keine Transaktionen für Bulk-Datumsänderung ausgewählt"
      );
      showBulkChangeDateModal.value = false;
      return;
    }

    const transactionIds = selectedTransactions.map((tx) => tx.id);

    // Verwende die neue bulkChangeDate Funktion
    const result = await TransactionService.bulkChangeDate(
      transactionIds,
      newDate
    );

    if (result.success) {
      infoLog("[TransactionsView]", "Bulk-Datumsänderung erfolgreich", {
        updatedCount: result.updatedCount,
        newDate,
      });

      // Auswahl zurücksetzen
      if (currentViewMode.value === "account") {
        transactionListRef.value?.clearSelection();
      } else {
        categoryTransactionListRef.value?.clearSelection();
      }

      // Refresh der Ansicht
      refreshKey.value++;

      // Erfolgs-Toast anzeigen
      showToast(
        `${result.updatedCount} Transaktionen erfolgreich aktualisiert`,
        "success"
      );
    } else {
      warnLog("[TransactionsView]", "Bulk-Datumsänderung mit Fehlern", {
        updatedCount: result.updatedCount,
        errors: result.errors,
      });

      // Fehler-Toast anzeigen
      showToast(
        `Fehler bei Datumsänderung: ${result.errors.join(", ")}`,
        "error"
      );
    }
  } catch (error) {
    errorLog("[TransactionsView]", "Fehler bei Bulk-Datumsänderung", {
      error: error instanceof Error ? error.message : String(error),
      newDate,
    });

    // Fehler-Toast anzeigen
    showToast("Unerwarteter Fehler bei der Datumsänderung", "error");
  } finally {
    showBulkChangeDateModal.value = false;
  }
}

async function onBulkDeleteConfirm(transactionIds: string[]) {
  debugLog("[TransactionsView]", "onBulkDeleteConfirm", { transactionIds });
  try {
    const result = await TransactionService.bulkDeleteTransactions(
      transactionIds
    );
    if (result.success) {
      debugLog("[TransactionsView]", "Bulk delete successful", {
        deletedCount: result.deletedCount,
      });
      // Erfolgs-Toast anzeigen
      showToast(
        `${result.deletedCount} Transaktionen erfolgreich gelöscht`,
        "success"
      );
    } else {
      debugLog("[TransactionsView]", "Bulk delete partially failed", {
        result,
      });
      // Fehler-Toast anzeigen
      showToast("Fehler beim Löschen von Transaktionen", "error");
    }
  } catch (error) {
    console.error("Fehler beim Massenlöschen von Transaktionen:", error);
    // Fehler-Toast anzeigen
    showToast("Unerwarteter Fehler beim Löschen von Transaktionen", "error");
  } finally {
    showBulkDeleteModal.value = false;
    // Auswahl in den Listen zurücksetzen
    transactionListRef.value?.clearSelection();
    categoryTransactionListRef.value?.clearSelection();
    refreshKey.value++;
  }
}

async function onBulkSetReconciledConfirm(selectedTransactions: Transaction[]) {
  debugLog("[TransactionsView]", "onBulkSetReconciledConfirm", {
    count: selectedTransactions.length,
  });

  try {
    const transactionIds = selectedTransactions.map((tx) => tx.id);
    const result = await TransactionService.bulkSetReconciled(transactionIds);

    if (result.success) {
      infoLog(
        "[TransactionsView]",
        `Bulk-Abgleich erfolgreich gesetzt: ${result.updatedCount} Transaktionen`
      );
      showToast(
        `${result.updatedCount} Transaktionen als abgeglichen markiert`,
        "success"
      );
    } else {
      warnLog(
        "[TransactionsView]",
        `Bulk-Abgleich mit Fehlern: ${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`
      );
      showToast(
        `${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`,
        "warning"
      );
    }

    // Auswahl zurücksetzen
    if (currentViewMode.value === "account") {
      transactionListRef.value?.clearSelection();
    } else {
      categoryTransactionListRef.value?.clearSelection();
    }

    refreshKey.value++;
  } catch (error) {
    errorLog(
      "[TransactionsView]",
      "Unerwarteter Fehler beim Bulk-Abgleich setzen",
      error
    );
    showToast("Unerwarteter Fehler beim Setzen des Abgleichs", "error");
  }
}

async function onBulkRemoveReconciledConfirm(
  selectedTransactions: Transaction[]
) {
  debugLog("[TransactionsView]", "onBulkRemoveReconciledConfirm", {
    count: selectedTransactions.length,
  });

  try {
    const transactionIds = selectedTransactions.map((tx) => tx.id);
    const result = await TransactionService.bulkRemoveReconciled(
      transactionIds
    );

    if (result.success) {
      infoLog(
        "[TransactionsView]",
        `Bulk-Abgleich erfolgreich entfernt: ${result.updatedCount} Transaktionen`
      );
      showToast(
        `${result.updatedCount} Transaktionen als nicht abgeglichen markiert`,
        "success"
      );
    } else {
      warnLog(
        "[TransactionsView]",
        `Bulk-Abgleich-Entfernung mit Fehlern: ${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`
      );
      showToast(
        `${result.updatedCount} erfolgreich, ${result.errors.length} Fehler`,
        "warning"
      );
    }

    // Auswahl zurücksetzen
    if (currentViewMode.value === "account") {
      transactionListRef.value?.clearSelection();
    } else {
      categoryTransactionListRef.value?.clearSelection();
    }

    refreshKey.value++;
  } catch (error) {
    errorLog(
      "[TransactionsView]",
      "Unerwarteter Fehler beim Bulk-Abgleich entfernen",
      error
    );
    showToast("Unerwarteter Fehler beim Entfernen des Abgleichs", "error");
  }
}

// Planning-spezifische Funktionen aus PlanningView
const upcomingTransactionsInRange = computed(() => {
  const start = planningDateRange.value.start;
  const end = planningDateRange.value.end;
  const list: Array<{ date: string; transaction: PlanningTransaction }> = [];

  planningStore.planningTransactions.forEach((plan: PlanningTransaction) => {
    if (!plan.isActive) return;
    const occurrences = PlanningService.calculateNextOccurrences(
      plan,
      start,
      end
    );
    occurrences.forEach((dateStr: string) => {
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
      if (
        t.transactionType === TransactionType.ACCOUNTTRANSFER &&
        t.transferToAccountId === planningSelectedAccountId.value
      ) {
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
      if (
        t.transactionType === TransactionType.CATEGORYTRANSFER &&
        t.transferToCategoryId === planningSelectedCategoryId.value
      ) {
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
    if (
      t.counterPlanningTransactionId &&
      (t.transactionType === TransactionType.ACCOUNTTRANSFER ||
        t.transactionType === TransactionType.CATEGORYTRANSFER)
    ) {
      const counterPlanning = planningStore.planningTransactions.find(
        (counter) => counter.id === t.counterPlanningTransactionId
      );
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
      return (
        t.name.toLowerCase().includes(term) ||
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
        String(t.amount).includes(term)
      );
    });
  }

  return data;
});

// Planning CRUD-Aktionen
function createPlanning() {
  selectedPlanning.value = null;
  showNewPlanningModal.value = true;
}

function editPlanning(planning: PlanningTransaction) {
  selectedPlanning.value = planning;
  showEditPlanningModal.value = true;
  debugLog("[TransactionsView]", "Edit planning", {
    id: planning.id,
    name: planning.name,
  });
}

function savePlanning(data: any) {
  if (selectedPlanning.value) {
    PlanningService.updatePlanningTransaction(selectedPlanning.value.id, data);
    debugLog("[TransactionsView]", "Updated planning", data);
  } else {
    PlanningService.addPlanningTransaction(data);
    debugLog("[TransactionsView]", "Added planning", data);
  }
  showNewPlanningModal.value = false;
  showEditPlanningModal.value = false;
  BalanceService.calculateMonthlyBalances();
}

function deletePlanning(planning: PlanningTransaction) {
  if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
    PlanningService.deletePlanningTransaction(planning.id);
    debugLog("[TransactionsView] Deleted planning", planning.id);
    BalanceService.calculateMonthlyBalances();
  }
}

function executePlanning(planningId: string, date: string) {
  PlanningService.executePlanningTransaction(planningId, date);
  debugLog("[TransactionsView]", "Executed planning", { planningId, date });
}

function skipPlanning(planningId: string, date: string) {
  PlanningService.skipPlanningTransaction(planningId, date);
  debugLog("[TransactionsView]", "Skipped planning", { planningId, date });
}

// Hilfsfunktionen für Planning-Transaktionen
function getTransactionTypeIcon(type: TransactionType): string {
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

function getTransactionTypeClass(type: TransactionType): string {
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

function getTransactionTypeLabel(type: TransactionType): string {
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

function getSourceName(planning: PlanningTransaction): string {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return (
      categoryStore.getCategoryById(planning.categoryId || "")?.name || "-"
    );
  } else {
    return accountStore.getAccountById(planning.accountId)?.name || "-";
  }
}

function getTargetName(planning: PlanningTransaction): string {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return (
      categoryStore.getCategoryById(planning.transferToCategoryId || "")
        ?.name || "-"
    );
  } else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
    return (
      accountStore.getAccountById(planning.transferToAccountId || "")?.name ||
      "-"
    );
  } else {
    return (
      categoryStore.getCategoryById(planning.categoryId || "")?.name || "-"
    );
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

  const processedPlanningIds = new Set<string>();
  const planningsToProcess = [...planningStore.planningTransactions];

  for (const planning of planningsToProcess) {
    if (processedPlanningIds.has(planning.id) || !planning.isActive) {
      continue;
    }

    if (planning.name && planning.name.includes("(Gegenbuchung)")) {
      continue;
    }

    const overdueOccurrences = PlanningService.calculateNextOccurrences(
      planning,
      planning.startDate,
      today.format("YYYY-MM-DD")
    );

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

          if (
            (planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
              planning.transactionType === TransactionType.CATEGORYTRANSFER) &&
            planning.counterPlanningTransactionId
          ) {
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
  if (!pendingExecutionAnalysis.value) return;

  try {
    const count = await PlanningService.executeAllDuePlanningTransactions();
    showExecuteConfirmation.value = false;
    pendingExecutionAnalysis.value = null;

    showToast(
      `${count} automatische Planungsbuchungen erfolgreich ausgeführt.`,
      "success"
    );
  } catch (error) {
    showToast(
      "Fehler beim Ausführen der Planungsbuchungen. Bitte prüfen Sie die Konsole für Details.",
      "error"
    );
  }
}

function cancelExecution() {
  showExecuteConfirmation.value = false;
  pendingExecutionAnalysis.value = null;
}

function getConfirmationMessage(): string {
  if (!pendingExecutionAnalysis.value) return "";

  const analysis = pendingExecutionAnalysis.value;
  const parts: string[] = [];

  if (analysis.expenses > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-error badge-sm mr-2">Ausgaben</span><span class="font-semibold">${
        analysis.expenses
      } Buchung${analysis.expenses === 1 ? "" : "en"}</span></div>`
    );
  }
  if (analysis.income > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-success badge-sm mr-2">Einnahmen</span><span class="font-semibold">${
        analysis.income
      } Buchung${analysis.income === 1 ? "" : "en"}</span></div>`
    );
  }
  if (analysis.accountTransfers > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-warning badge-sm mr-2">Kontotransfers</span><span class="font-semibold">${
        analysis.accountTransfers
      } Buchung${analysis.accountTransfers === 1 ? "" : "en"}</span></div>`
    );
  }
  if (analysis.categoryTransfers > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-info badge-sm mr-2">Kategorietransfers</span><span class="font-semibold">${
        analysis.categoryTransfers
      } Buchung${analysis.categoryTransfers === 1 ? "" : "en"}</span></div>`
    );
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
          Insgesamt: ${analysis.totalCount} Buchung${
    analysis.totalCount === 1 ? "" : "en"
  }
        </span>
      </div>
    </div>
  `;
}

// Chart-Detail-Funktionen
function showAccountDetail(accountId: string) {
  selectedAccountForDetail.value = accountId;
  debugLog("[TransactionsView]", "Show account detail", { accountId });
}

function showCategoryDetail(categoryId: string) {
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
const handleKeydown = (event: KeyboardEvent) => {
  if (event.altKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    if (activeTab.value === "account" || activeTab.value === "category") {
      createTransaction();
    } else {
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

watch([selectedTagId, selectedCategoryId, currentViewMode], () =>
  transactionFilterStore.saveFilters()
);
</script>

<template>
  <div class="space-y-6">
    <!-- Überschrift -->
    <div class="flex items-center justify-between items-center">
      <h2 class="text-xl font-bold">Transaktionen</h2>

      <SearchGroup
        :btn-middle-right="
          activeTab === 'upcoming' ? 'Alle fälligen ausführen' : undefined
        "
        :btn-middle-right-icon="
          activeTab === 'upcoming' ? 'mdi:play-circle' : undefined
        "
        btnRight="Neue Transaktion"
        btnRightIcon="mdi:plus"
        @search="(query: string) => (searchQuery = query)"
        @btn-middle-right-click="executeAllDuePlannings"
        @btn-right-click="createTransaction"
      />
    </div>

    <!-- Umschalter zwischen Tabs -->
    <div class="tabs tabs-boxed bg-base-200 mb-4">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'account' }"
        @click="activeTab = 'account'"
      >
        <Icon
          icon="mdi:bank"
          class="mr-2"
        />
        Kontobuchungen
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'category' }"
        @click="activeTab = 'category'"
      >
        <Icon
          icon="mdi:folder-multiple"
          class="mr-2"
        />
        Kategoriebuchungen
      </a>

      <!-- Vertikaler Divider -->
      <div class="divider divider-horizontal mx-2"></div>

      <!-- Planning Tabs -->
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'upcoming' }"
        @click="activeTab = 'upcoming'"
      >
        <Icon
          icon="mdi:calendar-clock"
          class="mr-2"
        />
        Anstehende Buchungen
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'accounts' }"
        @click="activeTab = 'accounts'"
      >
        <Icon
          icon="mdi:chart-line"
          class="mr-2"
        />
        Kontenprognose
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <Icon
          icon="mdi:chart-areaspline"
          class="mr-2"
        />
        Kategorienprognose
      </a>
    </div>

    <!-- Filterleiste und Liste abhängig vom Modus -->
    <div v-if="currentViewMode === 'account'">
      <div class="card bg-base-100 shadow-md border border-base-300 p-4">
        <div
          class="card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-10"
        >
          <div class="flex flex-wrap items-end gap-3">
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Monatswahl
              </legend>
              <div class="flex items-center gap-1">
                <button
                  class="btn btn-ghost btn-sm btn-circle"
                  @click="navigateMonth('prev')"
                  title="Vorheriger Monat"
                >
                  <Icon
                    icon="mdi:chevron-left"
                    class="text-lg"
                  />
                </button>
                <div class="mx-2">
                  <DateRangePicker
                    ref="dateRangePickerRef"
                    @update:model-value="
                      (range) => handleDateRangeUpdate(range)
                    "
                  />
                </div>
                <button
                  class="btn btn-ghost btn-sm btn-circle"
                  @click="navigateMonth('next')"
                  title="Nächster Monat"
                >
                  <Icon
                    icon="mdi:chevron-right"
                    class="text-lg"
                  />
                </button>
              </div>
            </fieldset>
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Konto
              </legend>
              <select
                v-model="selectedAccountId"
                class="select select-sm select-bordered rounded-full"
                :class="
                  selectedAccountId
                    ? 'border-2 border-accent'
                    : 'border border-base-300'
                "
              >
                <option value="">Alle Konten</option>
                <option
                  v-for="acc in accountStore.activeAccounts"
                  :key="acc.id"
                  :value="acc.id"
                >
                  {{ acc.name }}
                </option>
              </select>
            </fieldset>
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Transaktion
              </legend>
              <select
                v-model="selectedTransactionType"
                class="select select-sm select-bordered rounded-full"
                :class="
                  selectedTransactionType
                    ? 'border-2 border-accent'
                    : 'border border-base-300'
                "
              >
                <option value="">Alle Typen</option>
                <option value="ausgabe">Ausgabe</option>
                <option value="einnahme">Einnahme</option>
                <option value="transfer">Transfer</option>
              </select>
            </fieldset>
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Abgeglichen
              </legend>
              <select
                v-model="selectedReconciledFilter"
                class="select select-sm select-bordered rounded-full"
                :class="
                  selectedReconciledFilter
                    ? 'border-2 border-accent'
                    : 'border border-base-300'
                "
              >
                <option value="">Alle</option>
                <option value="abgeglichen">Abgeglichen</option>
                <option value="nicht abgeglichen">Nicht abgeglichen</option>
              </select>
            </fieldset>
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Kategorien
              </legend>
              <SearchableSelectLite
                v-model="selectedCategoryId"
                :options="categoryStore.categories"
                item-text="name"
                item-value="id"
                placeholder="Alle Kategorien"
              />
            </fieldset>
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Tags
              </legend>
              <SearchableSelectLite
                v-model="selectedTagId"
                :options="tagStore.tags"
                item-text="name"
                item-value="id"
                placeholder="Alle Tags"
              />
            </fieldset>
          </div>

          <div class="flex items-end gap-2">
            <button
              class="btn btn-sm btn-ghost btn-circle self-end mb-1"
              @click="clearFilters"
            >
              <Icon
                icon="mdi:filter-off"
                class="text-xl"
              />
            </button>
            <!-- Bulk Actions Dropdown -->
            <BulkActionDropdown
              :selectedCount="selectedTransactionCount"
              class="self-end mb-1"
              @assign-account="handleBulkAssignAccount"
              @change-recipient="handleBulkChangeRecipient"
              @assign-category="handleBulkAssignCategory"
              @assign-tags="handleBulkAssignTags"
              @change-date="handleBulkChangeDate"
              @set-reconciled="handleBulkSetReconciled"
              @remove-reconciled="handleBulkRemoveReconciled"
              @delete="handleBulkDelete"
            />
          </div>
        </div>
        <div class="divider px-5 m-0" />
        <div class="card-body py-0 px-1">
          <TransactionList
            ref="transactionListRef"
            :transactions="sortedTransactions"
            :show-account="true"
            :sort-key="sortKey"
            :sort-order="sortOrder"
            :search-term="searchQuery"
            @sort-change="handleSortChange"
            @edit="editTransaction"
            @delete="deleteTransaction"
            @toggleReconciliation="toggleTransactionReconciled"
          />
        </div>
      </div>
    </div>
    <div v-else-if="activeTab === 'category'">
      <div class="card bg-base-100 shadow-md border border-base-300 p-4">
        <div
          class="card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-10"
        >
          <div class="flex flex-wrap items-end gap-3">
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Monatswahl
              </legend>
              <div class="flex items-center gap-1">
                <button
                  class="btn btn-ghost btn-sm btn-circle"
                  @click="navigateMonth('prev')"
                  title="Vorheriger Monat"
                >
                  <Icon
                    icon="mdi:chevron-left"
                    class="text-lg"
                  />
                </button>
                <div class="mx-2">
                  <DateRangePicker
                    ref="dateRangePickerRef"
                    @update:model-value="
                      (range) => handleDateRangeUpdate(range)
                    "
                  />
                </div>
                <button
                  class="btn btn-ghost btn-sm btn-circle"
                  @click="navigateMonth('next')"
                  title="Nächster Monat"
                >
                  <Icon
                    icon="mdi:chevron-right"
                    class="text-lg"
                  />
                </button>
              </div>
            </fieldset>
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Kategorien
              </legend>
              <SearchableSelectLite
                v-model="selectedCategoryId"
                :options="categoryStore.categories"
                item-text="name"
                item-value="id"
                placeholder="Alle Kategorien"
              />
            </fieldset>
          </div>

          <div class="flex items-end gap-2">
            <button
              class="btn btn-sm btn-ghost btn-circle self-end mb-1"
              @click="clearFilters"
            >
              <Icon
                icon="mdi:filter-off"
                class="text-xl"
              />
            </button>
            <!-- Bulk Actions Dropdown -->
            <BulkActionDropdown
              :selectedCount="selectedTransactionCount"
              class="self-end mb-1"
              @assign-account="handleBulkAssignAccount"
              @change-recipient="handleBulkChangeRecipient"
              @assign-category="handleBulkAssignCategory"
              @assign-tags="handleBulkAssignTags"
              @change-date="handleBulkChangeDate"
              @set-reconciled="handleBulkSetReconciled"
              @remove-reconciled="handleBulkRemoveReconciled"
              @delete="handleBulkDelete"
            />
          </div>
        </div>
        <div class="divider px-5 m-0" />
        <div class="card-body py-0 px-1">
          <CategoryTransactionList
            ref="categoryTransactionListRef"
            :transactions="sortedCategoryTransactions"
            :sort-key="sortKey"
            :sort-order="sortOrder"
            :search-term="searchQuery"
            @sort-change="handleSortChange"
            @edit="editTransaction"
            @delete="deleteTransaction"
          />
        </div>
      </div>
    </div>

    <!-- Planning Tabs -->
    <!-- Anstehende Buchungen -->
    <div
      v-else-if="activeTab === 'upcoming'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <!-- Filter & DateRangePicker -->
      <div class="flex flex-wrap justify-between items-end gap-4 mb-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Zeitraum</span>
            </label>
            <div class="flex items-center gap-1">
              <button
                class="btn btn-ghost btn-sm btn-circle"
                @click="navigateMonth('prev')"
                title="Vorheriger Monat"
              >
                <Icon
                  icon="mdi:chevron-left"
                  class="text-lg"
                />
              </button>
              <DateRangePicker
                ref="dateRangePickerRef"
                @update:model-value="handlePlanningDateRangeUpdate"
              />
              <button
                class="btn btn-ghost btn-sm btn-circle"
                @click="navigateMonth('next')"
                title="Nächster Monat"
              >
                <Icon
                  icon="mdi:chevron-right"
                  class="text-lg"
                />
              </button>
            </div>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Konto</span>
            </label>
            <select
              v-model="planningSelectedAccountId"
              class="select select-sm select-bordered rounded-full"
              :class="
                planningSelectedAccountId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Konten</option>
              <option
                v-for="acc in accountStore.activeAccounts"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.name }}
              </option>
            </select>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Kategorie</span>
            </label>
            <select
              v-model="planningSelectedCategoryId"
              class="select select-sm select-bordered rounded-full"
              :class="
                planningSelectedCategoryId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Kategorien</option>
              <option
                v-for="cat in categoryStore.activeCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon
              icon="mdi:filter-off"
              class="text-xl"
            />
          </button>
        </div>
      </div>

      <div class="divider px-5 m-0" />

      <div class="overflow-x-auto">
        <table class="table table-sm w-full">
          <thead>
            <tr class="text-xs">
              <th class="py-1">Datum</th>
              <th class="py-1">Typ</th>
              <th class="py-1">Name</th>
              <th class="py-1">Empfänger</th>
              <th class="py-1">Quelle</th>
              <th class="py-1">Ziel</th>
              <th class="py-1 text-right">Betrag</th>
              <th class="py-1 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(e, index) in filteredPlanningTransactions"
              :key="`${e.transaction.id}-${e.date}`"
              :class="index % 2 === 0 ? 'bg-base-100' : 'bg-base-200'"
              class="text-sm hover:bg-base-300"
            >
              <td class="py-1">{{ formatDate(e.date) }}</td>
              <td class="py-1 text-center">
                <div
                  class="tooltip tooltip-primary"
                  :data-tip="
                    getTransactionTypeLabel(
                      e.transaction.transactionType || TransactionType.EXPENSE
                    )
                  "
                >
                  <Icon
                    :icon="
                      getTransactionTypeIcon(
                        e.transaction.transactionType || TransactionType.EXPENSE
                      )
                    "
                    :class="
                      getTransactionTypeClass(
                        e.transaction.transactionType || TransactionType.EXPENSE
                      )
                    "
                    class="text-lg"
                  />
                </div>
              </td>
              <td class="py-1">{{ e.transaction.name }}</td>
              <td class="py-1">
                {{
                  recipientStore.getRecipientById(
                    e.transaction.recipientId || ""
                  )?.name || "-"
                }}
              </td>
              <td class="py-1">{{ getSourceName(e.transaction) }}</td>
              <td class="py-1">{{ getTargetName(e.transaction) }}</td>
              <td class="py-1 text-right">
                <CurrencyDisplay
                  :amount="e.transaction.amount"
                  :show-zero="true"
                />
              </td>
              <td class="py-1 text-right">
                <div class="flex justify-end space-x-1">
                  <div
                    class="tooltip tooltip-success"
                    data-tip="Planungstransaktion ausführen"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="executePlanning(e.transaction.id, e.date)"
                    >
                      <Icon
                        icon="mdi:play"
                        class="text-sm text-success"
                      />
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-warning"
                    data-tip="Planungstransaktion überspringen"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="skipPlanning(e.transaction.id, e.date)"
                    >
                      <Icon
                        icon="mdi:skip-next"
                        class="text-sm text-warning"
                      />
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-info"
                    data-tip="Planungstransaktion bearbeiten"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="editPlanning(e.transaction)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-sm"
                      />
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-error"
                    data-tip="Planungstransaktion löschen"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none text-error/75"
                      @click="deletePlanning(e.transaction)"
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-sm"
                      />
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="filteredPlanningTransactions.length === 0">
              <td
                colspan="8"
                class="text-center py-4"
              >
                Keine anstehenden Transaktionen im ausgewählten Zeitraum.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Kontenprognose -->
    <div
      v-else-if="activeTab === 'accounts'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <!-- Filter & DateRangePicker -->
      <div class="flex flex-wrap justify-between items-end gap-4 mb-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Zeitraum</span>
            </label>
            <div class="flex items-center gap-1">
              <button
                class="btn btn-ghost btn-sm btn-circle"
                @click="navigateMonth('prev')"
                title="Vorheriger Monat"
              >
                <Icon
                  icon="mdi:chevron-left"
                  class="text-lg"
                />
              </button>
              <DateRangePicker
                ref="dateRangePickerRef"
                @update:model-value="handlePlanningDateRangeUpdate"
              />
              <button
                class="btn btn-ghost btn-sm btn-circle"
                @click="navigateMonth('next')"
                title="Nächster Monat"
              >
                <Icon
                  icon="mdi:chevron-right"
                  class="text-lg"
                />
              </button>
            </div>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Konto</span>
            </label>
            <select
              v-model="planningSelectedAccountId"
              class="select select-sm select-bordered rounded-full"
              :class="
                planningSelectedAccountId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Konten</option>
              <option
                v-for="acc in accountStore.activeAccounts"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.name }}
              </option>
            </select>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Kategorie</span>
            </label>
            <select
              v-model="planningSelectedCategoryId"
              class="select select-sm select-bordered rounded-full"
              :class="
                planningSelectedCategoryId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Kategorien</option>
              <option
                v-for="cat in categoryStore.activeCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon
              icon="mdi:filter-off"
              class="text-xl"
            />
          </button>
        </div>
      </div>

      <div class="divider px-5 m-0" />

      <h3 class="text-xl font-bold mb-4">Kontenprognose</h3>
      <ForecastChart
        :start-date="planningDateRange.start"
        :filtered-account-id="planningSelectedAccountId"
        :selected-account-for-detail="selectedAccountForDetail"
        type="accounts"
      />
    </div>

    <!-- Kategorienprognose -->
    <div
      v-else-if="activeTab === 'categories'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <!-- Filter & DateRangePicker -->
      <div class="flex flex-wrap justify-between items-end gap-4 mb-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Zeitraum</span>
            </label>
            <div class="flex items-center gap-1">
              <button
                class="btn btn-ghost btn-sm btn-circle"
                @click="navigateMonth('prev')"
                title="Vorheriger Monat"
              >
                <Icon
                  icon="mdi:chevron-left"
                  class="text-lg"
                />
              </button>
              <DateRangePicker
                ref="dateRangePickerRef"
                @update:model-value="handlePlanningDateRangeUpdate"
              />
              <button
                class="btn btn-ghost btn-sm btn-circle"
                @click="navigateMonth('next')"
                title="Nächster Monat"
              >
                <Icon
                  icon="mdi:chevron-right"
                  class="text-lg"
                />
              </button>
            </div>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Konto</span>
            </label>
            <select
              v-model="planningSelectedAccountId"
              class="select select-sm select-bordered rounded-full"
              :class="
                planningSelectedAccountId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Konten</option>
              <option
                v-for="acc in accountStore.activeAccounts"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.name }}
              </option>
            </select>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Kategorie</span>
            </label>
            <select
              v-model="planningSelectedCategoryId"
              class="select select-sm select-bordered rounded-full"
              :class="
                planningSelectedCategoryId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Kategorien</option>
              <option
                v-for="cat in categoryStore.activeCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon
              icon="mdi:filter-off"
              class="text-xl"
            />
          </button>
        </div>
      </div>

      <div class="divider px-5 m-0" />

      <h3 class="text-xl font-bold mb-4">Kategorienprognose</h3>
      <ForecastChart
        :start-date="planningDateRange.start"
        :selected-category-for-detail="selectedCategoryForDetail"
        type="categories"
        @show-category-detail="showCategoryDetail"
        @hide-category-detail="hideCategoryDetail"
      />
    </div>

    <!-- Detail-Modal -->
    <Teleport to="body">
      <TransactionDetailModal
        v-if="showTransactionDetailModal"
        :isOpen="showTransactionDetailModal"
        :transaction="selectedTransaction"
        @close="showTransactionDetailModal = false"
      />
    </Teleport>
    <!-- Formular-Modal -->
    <Teleport to="body">
      <div
        v-if="showTransactionFormModal"
        class="modal modal-open"
      >
        <div class="modal-box overflow-visible relative w-full max-w-2xl">
          <TransactionForm
            :transaction="selectedTransaction"
            :initialAccountId="prefilledAccountId"
            :initialTransactionType="prefilledTransactionType"
            :initialCategoryId="prefilledCategoryId"
            :initialTagIds="prefilledTagIds"
            @cancel="showTransactionFormModal = false"
            @save="handleSave"
          />
        </div>
      </div>
    </Teleport>

    <!-- Bulk Action Modals -->
    <BulkAssignAccountModal
      :isOpen="showBulkAssignAccountModal"
      :selectedCount="selectedTransactionCount"
      @close="showBulkAssignAccountModal = false"
      @confirm="onBulkAssignAccountConfirm"
    />

    <BulkChangeRecipientModal
      :isOpen="showBulkChangeRecipientModal"
      :selectedCount="selectedTransactionCount"
      @close="showBulkChangeRecipientModal = false"
      @confirm="onBulkChangeRecipientConfirm"
    />

    <BulkAssignCategoryModal
      :isOpen="showBulkAssignCategoryModal"
      :selectedCount="selectedTransactionCount"
      @close="showBulkAssignCategoryModal = false"
      @confirm="onBulkAssignCategoryConfirm"
    />

    <BulkAssignTagsModal
      :isOpen="showBulkAssignTagsModal"
      :selectedCount="selectedTransactionCount"
      @close="showBulkAssignTagsModal = false"
      @confirm="onBulkAssignTagsConfirm"
    />

    <BulkChangeDateModal
      :isOpen="showBulkChangeDateModal"
      :selectedCount="selectedTransactionCount"
      @close="showBulkChangeDateModal = false"
      @confirm="onBulkChangeDateConfirm"
    />

    <BulkDeleteModal
      :isOpen="showBulkDeleteModal"
      :selectedCount="selectedTransactionCount"
      :transactionIds="bulkDeleteTransactionIds"
      @close="showBulkDeleteModal = false"
      @confirm="onBulkDeleteConfirm"
    />

    <!-- Planning Modals -->
    <div
      v-if="showNewPlanningModal"
      class="modal modal-open"
    >
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4">Neue geplante Transaktion</h3>
        <PlanningTransactionForm
          @save="savePlanning"
          @cancel="showNewPlanningModal = false"
        />
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showNewPlanningModal = false"
      ></div>
    </div>

    <div
      v-if="showEditPlanningModal && selectedPlanning"
      class="modal modal-open"
    >
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4">Geplante Transaktion bearbeiten</h3>
        <PlanningTransactionForm
          :transaction="selectedPlanning"
          :is-edit="true"
          @save="savePlanning"
          @cancel="showEditPlanningModal = false"
        />
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showEditPlanningModal = false"
      ></div>
    </div>

    <!-- Bestätigungsmodal für Ausführung aller fälligen Buchungen -->
    <ConfirmationModal
      v-if="showExecuteConfirmation && pendingExecutionAnalysis"
      title="Fällige Planungsbuchungen ausführen"
      :message="getConfirmationMessage()"
      :use-html="true"
      confirm-text="Ausführen"
      cancel-text="Abbrechen"
      @confirm="confirmExecution"
      @cancel="cancelExecution"
    />

    <!-- Toast Notifications -->
    <Teleport to="body">
      <InfoToast
        v-for="toast in activeToasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        :duration="toast.duration"
        @close="removeToast(toast.id)"
      />
    </Teleport>
  </div>
</template>
