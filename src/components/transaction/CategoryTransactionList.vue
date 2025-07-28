<!-- Datei: src/components/transaction/CategoryTransactionList.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/transaction/CategoryTransactionList.vue
 * Zeigt eine Liste von Transaktionen geordnet nach Kategorien an. Nutzt Services für Daten.
 *
 * Komponenten-Props:
 * - transactions: Transaction[] - Die anzuzeigenden Transaktionen (bereits vorgefiltert und sortiert)
 * - sortKey: keyof Transaction | "" - Nach welchem Feld sortiert wird (Info für UI)
 * - sortOrder: "asc" | "desc" - Die Sortierreihenfolge (Info für UI)
 * - searchTerm?: string - Optional: Suchbegriff für Filterung (wird vom globalen Suchfeld übergeben)
 *
 * Emits:
 * - edit: Bearbeiten einer Standardtransaktion (öffnet TransactionForm)
 * - delete: Löschen einer Transaktion
 * - sort-change: Anforderung zur Änderung der Sortierung
 */
import {
  defineProps,
  defineEmits,
  ref,
  computed,
  defineExpose,
  onMounted,
  onUnmounted,
  nextTick,
  watch,
} from "vue";
import { Transaction, TransactionType } from "../../types";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import CategoryTransferModal from "../budget/CategoryTransferModal.vue";
import ConfirmationModal from "../ui/ConfirmationModal.vue";
import { AccountService } from "../../services/AccountService";
import { CategoryService } from "../../services/CategoryService";
import { debugLog } from "../../utils/logger";
import { BalanceService } from "../../services/BalanceService";
import { TransactionService } from "../../services/TransactionService"; // Import hinzugefügt

debugLog(
  "[CategoryTransactionList] TransactionService on setup:",
  JSON.stringify(TransactionService, null, 2)
); // Log zur Validierung

const props = defineProps<{
  transactions: Transaction[];
  sortKey: keyof Transaction | "";
  sortOrder: "asc" | "desc";
  searchTerm?: string;
}>();

const emit = defineEmits(["edit", "delete", "sort-change"]);

// Lazy Loading State
const visibleItemsCount = ref(25); // Initial number of items to show
const itemsPerLoad = 25; // Number of items to load when scrolling
const loadingMoreItems = ref(false);
const sentinelRef = ref<HTMLElement | null>(null);
const intersectionObserver = ref<IntersectionObserver | null>(null);

// Filterung der Transaktionen:
// ACCOUNTTRANSFER werden aus der Kategorien-Transaktionsliste ausgeblendet.
const allDisplayTransactions = computed(() => {
  let list = props.transactions.filter(
    (tx) => tx.type !== TransactionType.ACCOUNTTRANSFER
  );
  if (props.searchTerm && props.searchTerm.trim() !== "") {
    const term = props.searchTerm.toLowerCase().trim();
    list = list.filter((tx) => {
      const fields = [
        formatDate(tx.date),
        formatDate(tx.valueDate),
        CategoryService.getCategoryName(tx.categoryId || null),
        CategoryService.getCategoryName(tx.toCategoryId || null),
        tx.amount.toString(),
        tx.note || "",
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });
  }
  return list;
});

// Lazy Loading: Nur die sichtbaren Transaktionen anzeigen
const displayTransactions = computed(() => {
  return allDisplayTransactions.value.slice(0, visibleItemsCount.value);
});

// Check if there are more items to load
const hasMoreItems = computed(() => {
  return visibleItemsCount.value < allDisplayTransactions.value.length;
});

// --- Selection Logic ---
const selectedIds = ref<string[]>([]);
const lastSelectedIndex = ref<number | null>(null);
const currentPageIds = computed(() =>
  displayTransactions.value.map((tx) => tx.id)
);
const allSelected = computed(
  () =>
    currentPageIds.value.length > 0 &&
    currentPageIds.value.every((id) => selectedIds.value.includes(id))
);

function handleHeaderCheckboxChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  if (checked) {
    selectedIds.value = [
      ...Array.from(new Set([...selectedIds.value, ...currentPageIds.value])),
    ];
  } else {
    const currentPageIdSet = new Set(currentPageIds.value);
    selectedIds.value = selectedIds.value.filter(
      (id) => !currentPageIdSet.has(id)
    );
  }
  lastSelectedIndex.value = null;
}

function handleCheckboxClick(
  transactionId: string,
  index: number,
  event: MouseEvent
) {
  const target = event.target as HTMLInputElement;
  const isChecked = target.checked;
  const displayedTxs = displayTransactions.value;
  if (
    event.shiftKey &&
    lastSelectedIndex.value !== null &&
    lastSelectedIndex.value < displayedTxs.length
  ) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    for (let i = start; i <= end; i++) {
      if (i < displayedTxs.length) {
        const id = displayedTxs[i].id;
        if (isChecked && !selectedIds.value.includes(id)) {
          selectedIds.value.push(id);
        } else if (!isChecked) {
          const pos = selectedIds.value.indexOf(id);
          if (pos !== -1) selectedIds.value.splice(pos, 1);
        }
      }
    }
  } else {
    if (isChecked && !selectedIds.value.includes(transactionId)) {
      selectedIds.value.push(transactionId);
    } else if (!isChecked) {
      const pos = selectedIds.value.indexOf(transactionId);
      if (pos !== -1) selectedIds.value.splice(pos, 1);
    }
  }
  lastSelectedIndex.value = index;
}

function getSelectedTransactions(): Transaction[] {
  return allDisplayTransactions.value.filter((tx) =>
    selectedIds.value.includes(tx.id)
  );
}

function clearSelection() {
  selectedIds.value = [];
}

defineExpose({ getSelectedTransactions, selectedIds, clearSelection });

// --- Modal Logic für Bearbeitung von Category Transfers ---
const showTransferModal = ref(false);
const modalData = ref<{
  transactionId: string;
  gegentransactionId: string;
  prefillAmount: number;
  fromCategoryId: string;
  toCategoryId: string;
  prefillDate: string;
  note?: string;
} | null>(null);

// Confirmation Modal State
const showDeleteConfirmation = ref(false);
const transactionToDelete = ref<Transaction | null>(null);

function editTransactionLocal(tx: Transaction) {
  if (tx.type === TransactionType.CATEGORYTRANSFER) {
    const isFromPart = tx.amount < 0;
    const transactionId = isFromPart ? tx.id : tx.counterTransactionId || "";
    const gegentransactionId = isFromPart
      ? tx.counterTransactionId || ""
      : tx.id;
    const fromCatId = isFromPart ? tx.categoryId : tx.toCategoryId || "";
    const toCatId = isFromPart ? tx.toCategoryId || "" : tx.categoryId;
    if (!transactionId || !gegentransactionId) {
      console.error(
        "Counter transaction ID missing for category transfer:",
        tx
      );
      return;
    }
    modalData.value = {
      transactionId,
      gegentransactionId,
      prefillAmount: Math.abs(tx.amount),
      fromCategoryId: fromCatId || "",
      toCategoryId: toCatId || "",
      prefillDate: tx.date,
      note: tx.note,
    };
    debugLog(
      "[CategoryTransactionList] Opening edit modal for transfer",
      JSON.stringify(modalData.value, null, 2)
    );
    showTransferModal.value = true;
  } else {
    debugLog(
      "[CategoryTransactionList] Emitting edit für Standardtransaction",
      JSON.stringify(tx, null, 2)
    );
    emit("edit", tx);
  }
}

function onTransferComplete() {
  showTransferModal.value = false;
  debugLog(
    "[CategoryTransactionList] Transfer modal closed, operation successful.",
    "null"
  );
}

// Delete confirmation functions
function confirmDelete(transaction: Transaction) {
  transactionToDelete.value = transaction;
  showDeleteConfirmation.value = true;
}

function handleDeleteConfirm() {
  if (transactionToDelete.value) {
    emit("delete", transactionToDelete.value);
    showDeleteConfirmation.value = false;
    transactionToDelete.value = null;
  }
}

function handleDeleteCancel() {
  showDeleteConfirmation.value = false;
  transactionToDelete.value = null;
}

// Helper function to get transaction description for confirmation
function getTransactionDescription(transaction: Transaction): string {
  const date = formatDate(transaction.date);
  const amount = Math.abs(transaction.amount).toFixed(2);

  if (transaction.type === TransactionType.CATEGORYTRANSFER) {
    const fromCategory = CategoryService.getCategoryName(
      transaction.toCategoryId || null
    );
    const toCategory = CategoryService.getCategoryName(
      transaction.categoryId || null
    );
    return `${date} - Kategorieübertragung: ${fromCategory} → ${toCategory} (${amount} €)`;
  } else {
    const account = AccountService.getAccountNameSync(transaction.accountId);
    const category = CategoryService.getCategoryName(
      transaction.categoryId || null
    );
    return `${date} - ${account} → ${category} (${amount} €)`;
  }
}

// Lazy Loading Functions
function loadMoreItems() {
  if (loadingMoreItems.value || !hasMoreItems.value) return;

  loadingMoreItems.value = true;

  // Simulate loading delay for better UX
  setTimeout(() => {
    visibleItemsCount.value = Math.min(
      visibleItemsCount.value + itemsPerLoad,
      allDisplayTransactions.value.length
    );
    loadingMoreItems.value = false;
  }, 100);
}

function setupIntersectionObserver() {
  if (!sentinelRef.value) return;

  intersectionObserver.value = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && hasMoreItems.value) {
        loadMoreItems();
      }
    },
    {
      root: null,
      rootMargin: "100px",
      threshold: 0.1,
    }
  );

  intersectionObserver.value.observe(sentinelRef.value);
}

function resetLazyLoading() {
  visibleItemsCount.value = itemsPerLoad;
}

// Watch for changes in transactions to reset lazy loading
function handleTransactionsChange() {
  resetLazyLoading();
  nextTick(() => {
    if (intersectionObserver.value) {
      intersectionObserver.value.disconnect();
    }
    setupIntersectionObserver();
  });
}

// Lifecycle hooks
onMounted(() => {
  nextTick(() => {
    setupIntersectionObserver();
  });
});

onUnmounted(() => {
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect();
  }
});

// Watch for prop changes that should reset lazy loading
watch(
  () => [props.transactions, props.sortKey, props.sortOrder, props.searchTerm],
  () => {
    handleTransactionsChange();
  },
  { deep: true }
);
</script>

<template>
  <div>
    <div class="overflow-x-auto">
      <table class="table w-full table-zebra table-sm">
        <thead>
          <tr>
            <th class="w-5 px-1">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                :checked="allSelected"
                @change="handleHeaderCheckboxChange"
              />
            </th>
            <th
              @click="$emit('sort-change', 'date')"
              class="cursor-pointer px-2"
            >
              <div class="flex items-center">
                Datum
                <Icon
                  v-if="sortKey === 'date'"
                  :icon="
                    sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                  "
                  class="ml-1 text-sm"
                />
              </div>
            </th>
            <th
              @click="$emit('sort-change', 'valueDate')"
              class="cursor-pointer px-2"
            >
              <div class="flex items-center">
                Wertstellung
                <Icon
                  v-if="sortKey === 'valueDate'"
                  :icon="
                    sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                  "
                  class="ml-1 text-sm"
                />
              </div>
            </th>
            <th
              @click="$emit('sort-change', 'toCategoryId')"
              class="cursor-pointer px-2"
            >
              <div class="flex items-center">
                <div class="flex items-center">
                  Herkuftskat./-konto
                  <Icon
                    v-if="sortKey === 'toCategoryId'"
                    :icon="
                      sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                    "
                    class="ml-1 text-sm"
                  />
                </div>
                <Icon
                  icon="mdi:chevron-triple-right"
                  class="ml-5 text-lg cursor-help"
                />
              </div>
            </th>
            <th
              @click="$emit('sort-change', 'categoryId')"
              class="cursor-pointer px-2"
            >
              <div class="flex items-center">
                Empfänger Kategorie
                <Icon
                  v-if="sortKey === 'categoryId'"
                  :icon="
                    sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                  "
                  class="ml-1 text-sm"
                />
              </div>
            </th>

            <th
              class="text-right cursor-pointer px-2"
              @click="$emit('sort-change', 'amount')"
            >
              <div class="flex items-center justify-end">
                Betrag
                <Icon
                  v-if="sortKey === 'amount'"
                  :icon="
                    sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                  "
                  class="ml-1 text-sm"
                />
              </div>
            </th>
            <th class="text-center cursor-pointer px-1">
              <Icon
                icon="mdi:note-text-outline"
                class="text-base"
              />
            </th>
            <th class="text-right px-2">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(tx, index) in displayTransactions"
            :key="tx.id"
            class="hover"
          >
            <td class="px-1">
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                :checked="selectedIds.includes(tx.id)"
                @click="handleCheckboxClick(tx.id, index, $event)"
              />
            </td>
            <td class="px-2">{{ formatDate(tx.date) }}</td>
            <td class="px-2">{{ formatDate(tx.valueDate) }}</td>
            <td class="px-2">
              <template v-if="tx.type === TransactionType.CATEGORYTRANSFER">
                {{ CategoryService.getCategoryName(tx.toCategoryId || null) }}
              </template>
              <template v-else>
                {{ AccountService.getAccountNameSync(tx.accountId) }}
              </template>
            </td>
            <td class="px-2">
              {{ CategoryService.getCategoryName(tx.categoryId || null) }}
            </td>

            <td class="text-right px-2">
              <CurrencyDisplay
                :amount="tx.amount"
                :show-zero="true"
                :asInteger="false"
                :class="{
                  'text-warning': tx.type === TransactionType.CATEGORYTRANSFER,
                  'text-success': tx.type === TransactionType.INCOME,
                  'text-error': tx.type === TransactionType.EXPENSE,
                  'text-info': tx.type === TransactionType.ACCOUNTTRANSFER,
                }"
              />
            </td>
            <td class="text-center px-1">
              <template v-if="tx.note && tx.note.trim()">
                <div
                  class="tooltip tooltip-left"
                  :data-tip="tx.note"
                >
                  <Icon
                    icon="mdi:comment-text-outline"
                    class="text-base opacity-60 cursor-help"
                  />
                </div>
              </template>
            </td>
            <td class="text-right px-2">
              <div class="flex justify-end space-x-1">
                <button
                  class="btn btn-ghost btn-xs border-none px-1"
                  @click="editTransactionLocal(tx)"
                  title="Bearbeiten"
                >
                  <Icon
                    icon="mdi:pencil"
                    class="text-base"
                  />
                </button>
                <button
                  class="btn btn-ghost btn-xs border-none text-error/75 px-1"
                  @click="confirmDelete(tx)"
                  title="Löschen"
                >
                  <Icon
                    icon="mdi:trash-can"
                    class="text-base"
                  />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="displayTransactions.length === 0">
            <td
              colspan="8"
              class="text-center py-4 text-base-content/70"
            >
              Keine Transaktionen für die Filter gefunden.
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Loading indicator and sentinel for infinite scroll -->
      <div
        v-if="hasMoreItems"
        class="flex justify-center py-4"
      >
        <div
          v-if="loadingMoreItems"
          class="flex items-center space-x-2"
        >
          <span class="loading loading-spinner loading-sm"></span>
          <span class="text-sm opacity-70">Lade weitere Transaktionen...</span>
        </div>
        <!-- Sentinel element for intersection observer -->
        <div
          ref="sentinelRef"
          class="h-1 w-full"
        ></div>
      </div>

      <!-- End of list indicator -->
      <div
        v-else-if="allDisplayTransactions.length > 0"
        class="flex justify-center py-4"
      >
        <span class="text-sm opacity-50"
          >Alle Transaktionen geladen ({{
            allDisplayTransactions.length
          }})</span
        >
      </div>
    </div>
    <CategoryTransferModal
      v-if="showTransferModal && modalData"
      mode="edit"
      :is-open="showTransferModal"
      :prefillAmount="modalData.prefillAmount"
      :prefillDate="modalData.prefillDate"
      :fromCategoryId="modalData.fromCategoryId"
      :toCategoryId="modalData.toCategoryId"
      :transactionId="modalData.transactionId"
      :gegentransactionId="modalData.gegentransactionId"
      :note="modalData.note"
      @close="showTransferModal = false"
      @transfer="onTransferComplete"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      v-if="showDeleteConfirmation && transactionToDelete"
      title="Transaktion löschen"
      :message="`Möchten Sie diese Transaktion wirklich löschen?\n\n${getTransactionDescription(
        transactionToDelete
      )}`"
      confirm-text="Löschen"
      cancel-text="Abbrechen"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </div>
</template>
