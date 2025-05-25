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
import MonthSelector from "../components/ui/MonthSelector.vue";
import SearchGroup from "../components/ui/SearchGroup.vue";
import SearchableSelectLite from "../components/ui/SearchableSelectLite.vue";
import { Transaction, TransactionType } from "../types";
import { formatCurrency } from "../utils/formatters";
import { debugLog } from "@/utils/logger";
import { TransactionService } from "@/services/TransactionService"; // Service already present

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

// Ansicht / Filter --------------------------------------------------------
const currentViewMode = computed({
  get: () => transactionFilterStore.currentViewMode,
  set: (v) => (transactionFilterStore.currentViewMode = v),
});

const selectedTransaction = ref<Transaction | null>(null);
const currentPage = ref(1);
const itemsPerPage = ref(25);
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
    TransactionService.addAccountTransfer(
      payload.fromAccountId,
      payload.toAccountId,
      payload.amount,
      payload.date,
      payload.note
    );
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
  if (confirm("Möchten Sie diese Transaktion wirklich löschen?")) {
    TransactionService.deleteTransaction(tx.id);
    showTransactionDetailModal.value = false;
  }
};

function clearFilters() {
  transactionFilterStore.clearFilters();
}

// Toggle reconciled
function toggleTransactionReconciled(transactionId: string) {
  reconciliationStore.toggleTransactionReconciled(transactionId);
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
      @search="(query) => (searchQuery = query)"
      @btn-right-click="createTransaction"
    />

    <!-- Umschalter zwischen Tabs -->
    <div class="tabs tabs-boxed mb-4">
      <a
        class="tab"
        :class="{ 'tab-active': currentViewMode === 'account' }"
        @click="currentViewMode = 'account'"
      >
        <Icon icon="mdi:bank" class="mr-2" />
        Kontobuchungen
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': currentViewMode === 'category' }"
        @click="currentViewMode = 'category'"
      >
        <Icon icon="mdi:folder-multiple" class="mr-2" />
        Kategoriebuchungen
      </a>
    </div>

    <!-- Filterleiste und Liste abhängig vom Modus -->
    <div v-if="currentViewMode === 'account'">
      <div class="card bg-base-100 shadow-md border border-base-300 p-4">
        <div
          class="card-title flex flex-wrap items-end justify-start gap-3 mx-2 pt-2 relative z-10"
        >
          <fieldset class="fieldset pt-0">
            <legend class="fieldset-legend text-center opacity-50">
              Monatswahl
            </legend>
            <MonthSelector
              @update-daterange="handleDateRangeUpdate"
              class="mx-2"
            />
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
            <legend class="fieldset-legend text-center opacity-50">Tags</legend>
            <SearchableSelectLite
              v-model="selectedTagId"
              :options="tagStore.tags"
              item-text="name"
              item-value="id"
              placeholder="Alle Tags"
            />
          </fieldset>
          <button
            class="btn btn-sm btn-ghost btn-circle self-end mb-1"
            @click="clearFilters"
          >
            <Icon icon="mdi:filter-off" class="text-xl" />
          </button>
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
          class="card-title flex flex-wrap items-end justify-start gap-3 mx-2 pt-2 relative z-10"
        >
          <fieldset class="fieldset pt-0">
            <legend class="fieldset-legend text-center opacity-50">
              Monatswahl
            </legend>
            <MonthSelector
              @update-daterange="handleDateRangeUpdate"
              class="mx-2"
            />
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
          <button
            class="btn btn-sm btn-ghost btn-circle self-end mb-1"
            @click="clearFilters"
          >
            <Icon icon="mdi:filter-off" class="text-xl" />
          </button>
        </div>
        <div class="divider px-5 m-0" />
        <div class="card-body py-0 px-1">
          <CategoryTransactionList
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
        :transaction="selectedTransaction"
        @close="showTransactionDetailModal = false"
      />
    </Teleport>
    <!-- Formular-Modal -->
    <Teleport to="body">
      <div v-if="showTransactionFormModal" class="modal modal-open">
        <div class="modal-box overflow-visible relative w-full max-w-2xl">
          <TransactionForm
            :transaction="selectedTransaction"
            @cancel="showTransactionFormModal = false"
            @save="handleSave"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>
