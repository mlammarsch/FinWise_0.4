<!-- Datei: src/views/TransactionsView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useTransactionStore } from "../stores/transactionStore";
import { useTransactionFilterStore } from "../stores/transactionFilterStore";
import { useReconciliationStore } from "../stores/reconciliationStore";
import { useAccountStore } from "../stores/accountStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useTagStore } from "../stores/tagStore";
import { useRecipientStore } from "../stores/recipientStore";
import { useSearchStore } from "../stores/searchStore";
import TransactionList from "../components/transaction/TransactionList.vue";
import CategoryTransactionList from "../components/transaction/CategoryTransactionList.vue";
import TransactionDetailModal from "../components/transaction/TransactionDetailModal.vue";
import TransactionForm from "../components/transaction/TransactionForm.vue";
import PagingComponent from "../components/ui/PagingComponent.vue";
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
import { Transaction, TransactionType } from "../types";
import { formatCurrency } from "../utils/formatters";
import { debugLog, infoLog, errorLog, warnLog } from "../utils/logger";
import { TransactionService } from "../services/TransactionService";
import { Icon } from "@iconify/vue";

const refreshKey = ref(0);

// Stores ------------------------------------------------------------------
const transactionStore = useTransactionStore();
const transactionFilterStore = useTransactionFilterStore();
const reconciliationStore = useReconciliationStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const searchStore = useSearchStore();

// Modals ------------------------------------------------------------------
const showTransactionFormModal = ref(false);
const showTransactionDetailModal = ref(false);
const transactionListRef = ref<InstanceType<typeof TransactionList> | null>(
  null
);
const categoryTransactionListRef = ref<InstanceType<
  typeof CategoryTransactionList
> | null>(null);

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
const currentPage = ref(1);
const itemsPerPage = ref<number | "all">(25);
const itemsPerPageOptions = [10, 20, 25, 50, 100, "all"];

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
  currentPage.value = 1;
}
function handleSortChange(key: keyof Transaction) {
  sortBy(key);
}

// Pagination helpers
const paginatedTransactions = computed(() => {
  if (itemsPerPage.value === "all") return sortedTransactions.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  return sortedTransactions.value.slice(
    start,
    start + Number(itemsPerPage.value)
  );
});
const paginatedCategoryTransactions = computed(() => {
  if (itemsPerPage.value === "all") return sortedCategoryTransactions.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  return sortedCategoryTransactions.value.slice(
    start,
    start + Number(itemsPerPage.value)
  );
});

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

const createTransaction = () => {
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

      // Erfolgs-Toast anzeigen (falls Toast-System vorhanden)
      // toast.success(`${result.updatedCount} Transaktionen erfolgreich zugewiesen`);
    } else {
      errorLog("[TransactionsView]", "Fehler bei Bulk-Kontozuweisung", {
        errors: result.errors,
        updatedCount: result.updatedCount,
      });

      // Fehler-Toast anzeigen (falls Toast-System vorhanden)
      // toast.error(`Fehler bei Kontozuweisung: ${result.errors.join(', ')}`);
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

    // Fehler-Toast anzeigen (falls Toast-System vorhanden)
    // toast.error("Unerwarteter Fehler bei der Kontozuweisung");
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

      // Optional: Zeige eine Erfolgsmeldung
      // TODO: Implementiere Toast-Notification
    } else {
      warnLog("[TransactionsView]", "Bulk-Kategorienzuweisung mit Fehlern", {
        updatedCount: result.updatedCount,
        errors: result.errors,
      });

      // Optional: Zeige Fehlermeldung
      // TODO: Implementiere Error-Notification mit Details
    }
  } catch (error) {
    errorLog("[TransactionsView]", "Fehler bei Bulk-Kategorienzuweisung", {
      error: error instanceof Error ? error.message : String(error),
      categoryId,
      removeAll,
    });

    // Optional: Zeige Fehlermeldung
    // TODO: Implementiere Error-Notification
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

      // Erfolgs-Toast anzeigen (falls Toast-System vorhanden)
      // toast.success(`${result.updatedCount} Transaktionen erfolgreich aktualisiert`);
    } else {
      errorLog("[TransactionsView]", "Fehler bei Bulk-Tag-Zuweisung", {
        errors: result.errors,
        updatedCount: result.updatedCount,
      });

      // Fehler-Toast anzeigen (falls Toast-System vorhanden)
      // toast.error(`Fehler bei Tag-Zuweisung: ${result.errors.join(', ')}`);
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

    // Fehler-Toast anzeigen (falls Toast-System vorhanden)
    // toast.error("Unerwarteter Fehler bei der Tag-Zuweisung");
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

      // Optional: Zeige eine Erfolgsmeldung
      // TODO: Implementiere Toast-Notification
    } else {
      warnLog("[TransactionsView]", "Bulk-Datumsänderung mit Fehlern", {
        updatedCount: result.updatedCount,
        errors: result.errors,
      });

      // Optional: Zeige Fehlermeldung
      // TODO: Implementiere Toast-Notification für Fehler
    }
  } catch (error) {
    errorLog("[TransactionsView]", "Fehler bei Bulk-Datumsänderung", {
      error: error instanceof Error ? error.message : String(error),
      newDate,
    });

    // Optional: Zeige eine Fehlermeldung
    // TODO: Implementiere Toast-Notification für kritische Fehler
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
      // Optional: Zeige eine Erfolgsmeldung
    } else {
      debugLog("[TransactionsView]", "Bulk delete partially failed", {
        result,
      });
      // Optional: Zeige eine Fehlermeldung
    }
  } catch (error) {
    console.error("Fehler beim Massenlöschen von Transaktionen:", error);
    // Optional: Zeige eine Fehlermeldung
  } finally {
    showBulkDeleteModal.value = false;
    // Auswahl in den Listen zurücksetzen
    transactionListRef.value?.clearSelection();
    categoryTransactionListRef.value?.clearSelection();
    refreshKey.value++;
  }
}

// Filter‑Persistenz
onMounted(() => transactionFilterStore.loadFilters());
watch([selectedTagId, selectedCategoryId, currentViewMode], () =>
  transactionFilterStore.saveFilters()
);
</script>

<template>
  <div class="space-y-6">
    <SearchGroup
      btnRight="Neue Transaktion"
      btnRightIcon="mdi:plus"
      @search="(query: string) => (searchQuery = query)"
      @btn-right-click="createTransaction"
    />

    <!-- Umschalter zwischen Tabs -->
    <div class="tabs tabs-boxed mb-4">
      <a
        class="tab"
        :class="{ 'tab-active': currentViewMode === 'account' }"
        @click="currentViewMode = 'account'"
      >
        <Icon
          icon="mdi:bank"
          class="mr-2"
        />
        Kontobuchungen
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': currentViewMode === 'category' }"
        @click="currentViewMode = 'category'"
      >
        <Icon
          icon="mdi:folder-multiple"
          class="mr-2"
        />
        Kategoriebuchungen
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
              <div class="mx-2">
                <DateRangePicker
                  @update:model-value="(range) => handleDateRangeUpdate(range)"
                />
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
              @delete="handleBulkDelete"
            />
          </div>
        </div>
        <div class="divider px-5 m-0" />
        <div class="card-body py-0 px-1">
          <TransactionList
            ref="transactionListRef"
            :transactions="paginatedTransactions"
            :show-account="true"
            :sort-key="sortKey"
            :sort-order="sortOrder"
            :search-term="searchQuery"
            @sort-change="handleSortChange"
            @edit="editTransaction"
            @delete="deleteTransaction"
            @toggleReconciliation="toggleTransactionReconciled"
          />
          <PagingComponent
            v-model:currentPage="currentPage"
            v-model:itemsPerPage="itemsPerPage"
            :totalPages="
              itemsPerPage === 'all'
                ? 1
                : Math.ceil(sortedTransactions.length / Number(itemsPerPage))
            "
            :itemsPerPageOptions="itemsPerPageOptions"
          />
        </div>
      </div>
    </div>
    <div v-else>
      <div class="card bg-base-100 shadow-md border border-base-300 p-4">
        <div
          class="card-title flex flex-wrap items-end justify-between gap-3 mx-2 pt-2 relative z-10"
        >
          <div class="flex flex-wrap items-end gap-3">
            <fieldset class="fieldset pt-0">
              <legend class="fieldset-legend text-center opacity-50">
                Monatswahl
              </legend>
              <div class="mx-2">
                <DateRangePicker
                  @update:model-value="(range) => handleDateRangeUpdate(range)"
                />
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
              @delete="handleBulkDelete"
            />
          </div>
        </div>
        <div class="divider px-5 m-0" />
        <div class="card-body py-0 px-1">
          <CategoryTransactionList
            ref="categoryTransactionListRef"
            :transactions="paginatedCategoryTransactions"
            :sort-key="sortKey"
            :sort-order="sortOrder"
            :search-term="searchQuery"
            @sort-change="handleSortChange"
            @edit="editTransaction"
            @delete="deleteTransaction"
          />
          <PagingComponent
            v-model:currentPage="currentPage"
            v-model:itemsPerPage="itemsPerPage"
            :totalPages="
              itemsPerPage === 'all'
                ? 1
                : Math.ceil(
                    sortedCategoryTransactions.length / Number(itemsPerPage)
                  )
            "
            :itemsPerPageOptions="itemsPerPageOptions"
          />
        </div>
      </div>
    </div>
    <!-- Detail-Modal -->
    <Teleport to="body">
      <TransactionDetailModal
        v-if="showTransactionDetailModal"
        :isOpen="showTransactionDetailModal"
        :transaction="selectedTransaction || undefined"
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
            :transaction="selectedTransaction || undefined"
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
  </div>
</template>
