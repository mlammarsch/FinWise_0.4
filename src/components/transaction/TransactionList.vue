<!-- Datei: src/components/transaction/TransactionList.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/transaction/TransactionList.vue
 * Zeigt eine Liste von Transaktionen an. Nutzt Stores für Daten.
 *
 * Komponenten-Props:
 * - transactions: Transaction[] - Die anzuzeigenden Transaktionen
 * - showAccount?: boolean - Optional: Anzeige des Kontos
 * - sortKey: keyof Transaction | "" - Feld, nach dem sortiert wird
 * - sortOrder: "asc" | "desc" - Sortierreihenfolge
 * - searchTerm?: string - Optional: Suchbegriff für Filterung (wird vom globalen Suchfeld übergeben)
 *
 * Emits:
 * - edit: Bearbeiten einer Transaktion
 * - delete: Löschen einer Transaktion
 * - sort-change: Anforderung zur Änderung der Sortierung
 * - toggleReconciliation: Umschalten des Abgleich-Status
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
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import BadgeSoft from "../ui/BadgeSoft.vue";
import ConfirmationModal from "../ui/ConfirmationModal.vue";
import { ReconciliationService } from "../../services/ReconciliationService";

const props = defineProps<{
  transactions: Transaction[];
  showAccount?: boolean;
  sortKey: keyof Transaction | "";
  sortOrder: "asc" | "desc";
  searchTerm?: string;
}>();

const emit = defineEmits([
  "edit",
  "delete",
  "sort-change",
  "toggleReconciliation",
]);

const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();

// Lazy Loading State
const visibleItemsCount = ref(25); // Initial number of items to show
const itemsPerLoad = 25; // Number of items to load when scrolling
const loadingMoreItems = ref(false);
const sentinelRef = ref<HTMLElement | null>(null);
const intersectionObserver = ref<IntersectionObserver | null>(null);

// Dynamic height calculation
const containerRef = ref<HTMLElement | null>(null);
const summaryRef = ref<HTMLElement | null>(null);
const containerHeight = ref('600px');
const resizeObserver = ref<ResizeObserver | null>(null);

// Confirmation Modal State
const showDeleteConfirmation = ref(false);
const transactionToDelete = ref<Transaction | null>(null);

// Filterung: CATEGORYTRANSFER-Transaktionen ausschließen
const displayTransactions = computed(() => {
  // immer reaktiv aus props starten
  let filtered = props.transactions.filter(
    (tx) => tx.type !== TransactionType.CATEGORYTRANSFER
  );

  if (props.searchTerm && props.searchTerm.trim() !== "") {
    const term = props.searchTerm.toLowerCase().trim();
    filtered = filtered.filter((tx) => {
      const dateField = formatDate(tx.date);
      const accountName = accountStore.getAccountById(tx.accountId)?.name || "";
      const recipientName =
        recipientStore.getRecipientById(tx.recipientId || "")?.name || "";
      const tagNames = tx.tagIds
        .map((tagId) => tagStore.getTagById(tagId)?.name || "")
        .join(" ");
      const amountStr = tx.amount.toString();
      const note = tx.note || "";
      const fields = [
        dateField,
        accountName,
        recipientName,
        tagNames,
        amountStr,
        note,
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });
  }
  return filtered;
});

// Sortierte Transaktionen mit korrekter date, createdAt Sortierung für Running Balance
const allSortedDisplayTransactions = computed(() => {
  const transactions = [...displayTransactions.value];

  // Nur bei Datumssortierung die spezielle Sortierung anwenden
  if (props.sortKey === "date") {
    return transactions.sort((a, b) => {
      // Primär nach date sortieren
      const dateA = a.date;
      const dateB = b.date;
      const dateComparison =
        props.sortOrder === "asc"
          ? dateA.localeCompare(dateB)
          : dateB.localeCompare(dateA);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      // Sekundär nach updated_at sortieren für korrekte Running Balance-Reihenfolge
      // In IndexedDB steht das Feld als updated_at (snake_case), nicht createdAt
      const createdA = (a as any).updated_at || "1970-01-01T00:00:00.000Z";
      const createdB = (b as any).updated_at || "1970-01-01T00:00:00.000Z";
      return props.sortOrder === "asc"
        ? createdA.localeCompare(createdB)
        : createdB.localeCompare(createdA);
    });
  }

  // Bei anderen Sortierungen die ursprüngliche Reihenfolge beibehalten
  return transactions;
});

// Lazy Loading: Nur die sichtbaren Transaktionen anzeigen
const sortedDisplayTransactions = computed(() => {
  return allSortedDisplayTransactions.value.slice(0, visibleItemsCount.value);
});

// Check if there are more items to load
const hasMoreItems = computed(() => {
  return visibleItemsCount.value < allSortedDisplayTransactions.value.length;
});

// --- Auswahl-Logik ---
const selectedIds = ref<string[]>([]);
const lastSelectedIndex = ref<number | null>(null);
const currentPageIds = computed(() =>
  sortedDisplayTransactions.value.map((tx) => tx.id)
);
const allSelected = computed(
  () =>
    currentPageIds.value.length > 0 &&
    currentPageIds.value.every((id) => selectedIds.value.includes(id))
);

function handleHeaderCheckboxChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  if (checked) {
    selectedIds.value = [...currentPageIds.value];
  } else {
    selectedIds.value = selectedIds.value.filter(
      (id) => !currentPageIds.value.includes(id)
    );
  }
}

function handleCheckboxClick(
  transactionId: string,
  index: number,
  event: MouseEvent
) {
  const target = event.target as HTMLInputElement;
  const isChecked = target.checked;
  if (event.shiftKey && lastSelectedIndex.value !== null) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    for (let i = start; i <= end; i++) {
      const id = sortedDisplayTransactions.value[i].id;
      if (isChecked && !selectedIds.value.includes(id)) {
        selectedIds.value.push(id);
      } else if (!isChecked) {
        const pos = selectedIds.value.indexOf(id);
        if (pos !== -1) selectedIds.value.splice(pos, 1);
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
  return allSortedDisplayTransactions.value.filter((tx) =>
    selectedIds.value.includes(tx.id)
  );
}

function clearSelection() {
  selectedIds.value = [];
}

defineExpose({ getSelectedTransactions, clearSelection });

// Computed properties für Summenanzeige
const selectedTransactions = computed(() => {
  return allSortedDisplayTransactions.value.filter((tx) =>
    selectedIds.value.includes(tx.id)
  );
});

const selectedTotalAmount = computed(() => {
  return selectedTransactions.value.reduce((sum, tx) => sum + tx.amount, 0);
});

const selectedReconciledAmount = computed(() => {
  return selectedTransactions.value
    .filter((tx) => tx.reconciled)
    .reduce((sum, tx) => sum + tx.amount, 0);
});

const selectedUnreconciledAmount = computed(() => {
  return selectedTransactions.value
    .filter((tx) => !tx.reconciled)
    .reduce((sum, tx) => sum + tx.amount, 0);
});

const hasSelectedTransactions = computed(() => {
  return selectedIds.value.length > 0;
});

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
  const recipient =
    transaction.type === TransactionType.ACCOUNTTRANSFER
      ? accountStore.getAccountById(transaction.transferToAccountId || "")
          ?.name || "Unbekanntes Konto"
      : recipientStore.getRecipientById(transaction.recipientId || "")?.name ||
        "Unbekannter Empfänger";

  return `${date} - ${recipient} (${amount} €)`;
}

// Reconciliation toggle function
function toggleReconciliation(transaction: Transaction) {
  ReconciliationService.toggleTransactionReconciled(transaction.id);
  emit("toggleReconciliation", transaction);
}

// Lazy Loading Functions
function loadMoreItems() {
  if (loadingMoreItems.value || !hasMoreItems.value) return;

  loadingMoreItems.value = true;

  // Simulate loading delay for better UX
  setTimeout(() => {
    visibleItemsCount.value = Math.min(
      visibleItemsCount.value + itemsPerLoad,
      allSortedDisplayTransactions.value.length
    );
    loadingMoreItems.value = false;
  }, 100);
}

function setupIntersectionObserver() {
  if (!sentinelRef.value) return;

  // Finde den scrollbaren Container mit fester Höhe
  const scrollContainer = sentinelRef.value.closest('.overflow-y-auto');

  intersectionObserver.value = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && hasMoreItems.value) {
        loadMoreItems();
      }
    },
    {
      root: scrollContainer, // Verwende den scrollbaren Container als root
      rootMargin: "50px", // Reduziert für bessere Performance im Container
      threshold: 0.1,
    }
  );

  intersectionObserver.value.observe(sentinelRef.value);
}

function resetLazyLoading() {
  visibleItemsCount.value = itemsPerLoad;
}

// Dynamic height calculation functions
function calculateContainerHeight() {
  if (!containerRef.value) return;

  const viewportHeight = window.innerHeight;
  const containerRect = containerRef.value.getBoundingClientRect();
  const summaryHeight = summaryRef.value?.offsetHeight || 0;

  // Berechne verfügbare Höhe: Viewport - Container-Top-Position - Padding/Margin (ca. 100px)
  const availableHeight = viewportHeight - containerRect.top - summaryHeight - 100;

  // Mindesthöhe von 400px, maximale Höhe von 80% des Viewports
  const minHeight = 400;
  const maxHeight = viewportHeight * 0.8;

  const calculatedHeight = Math.max(minHeight, Math.min(availableHeight, maxHeight));
  containerHeight.value = `${calculatedHeight}px`;
}

function setupResizeObserver() {
  if (typeof ResizeObserver === 'undefined') return;

  resizeObserver.value = new ResizeObserver(() => {
    calculateContainerHeight();
  });

  if (containerRef.value) {
    resizeObserver.value.observe(containerRef.value);
  }
}

function cleanupResizeObserver() {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
    resizeObserver.value = null;
  }
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
    calculateContainerHeight();
    setupIntersectionObserver();
    setupResizeObserver();

    // Listen to window resize events
    window.addEventListener('resize', calculateContainerHeight);
  });
});

onUnmounted(() => {
  if (intersectionObserver.value) {
    intersectionObserver.value.disconnect();
  }
  cleanupResizeObserver();
  window.removeEventListener('resize', calculateContainerHeight);
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
  <div ref="containerRef" class="flex flex-col">
    <!-- Sticky Summenanzeige für markierte Buchungen -->
    <div
      ref="summaryRef"
      v-if="hasSelectedTransactions"
      class="bg-base-100 border-b border-base-300 mb-4 pb-4 text-sm text-base-content/70"
    >
      <div class="flex flex-wrap gap-4">
        <div class="flex items-center gap-2">
          <span>Gesamt:</span>
          <CurrencyDisplay
            :amount="selectedTotalAmount"
            :asInteger="false"
            class="font-medium"
          />
        </div>
        <div class="flex items-center gap-2">
          <span>Abgeglichen:</span>
          <CurrencyDisplay
            :amount="selectedReconciledAmount"
            :asInteger="false"
            class="font-medium text-success"
          />
        </div>
        <div class="flex items-center gap-2">
          <span>Unabgeglichen:</span>
          <CurrencyDisplay
            :amount="selectedUnreconciledAmount"
            :asInteger="false"
            class="font-medium text-warning"
          />
        </div>
      </div>
    </div>

    <!-- Container für Tabelle mit dynamischer Höhe und eigenem Scrolling -->
    <div
      :style="{ height: containerHeight }"
      class="overflow-hidden"
    >
      <div class="h-full overflow-x-auto overflow-y-auto">
        <table class="table w-full table-zebra table-sm">
          <!-- Sticky Header -->
          <thead class="sticky top-0 z-20 bg-base-100 shadow-sm">
            <tr>
              <th class="w-5 px-1 bg-base-100">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm rounded-full"
                  :checked="allSelected"
                  @change="handleHeaderCheckboxChange"
                />
              </th>
              <th
                @click="emit('sort-change', 'date')"
                class="cursor-pointer px-2 bg-base-100"
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
                v-if="showAccount"
                @click="emit('sort-change', 'accountId')"
                class="cursor-pointer px-2 bg-base-100"
              >
                <div class="flex items-center">
                  Konto
                  <Icon
                    v-if="sortKey === 'accountId'"
                    :icon="
                      sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                    "
                    class="ml-1 text-sm"
                  />
                </div>
              </th>
              <th
                @click="emit('sort-change', 'recipientId')"
                class="cursor-pointer px-2 bg-base-100"
              >
                <div class="flex items-center">
                  Empfänger
                  <Icon
                    v-if="sortKey === 'recipientId'"
                    :icon="
                      sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                    "
                    class="ml-1 text-sm"
                  />
                </div>
              </th>
              <th
                @click="emit('sort-change', 'categoryId')"
                class="cursor-pointer px-2 bg-base-100"
              >
                <div class="flex items-center">
                  Kategorie
                  <Icon
                    v-if="sortKey === 'categoryId'"
                    :icon="
                      sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'
                    "
                    class="ml-1 text-sm"
                  />
                </div>
              </th>
              <th class="px-2 bg-base-100">Tags</th>
              <th
                @click="emit('sort-change', 'amount')"
                class="text-right cursor-pointer px-2 bg-base-100"
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
              <th class="text-center cursor-pointer px-1 bg-base-100">
                <Icon
                  icon="mdi:note-text-outline"
                  class="text-base"
                />
              </th>
              <th class="text-right cursor-pointer px-2 bg-base-100">
                <div class="flex items-center justify-end">
                  Saldo
                  <Icon
                    icon="mdi:scale-balance"
                    class="ml-1 text-sm opacity-50"
                  />
                </div>
              </th>
              <th class="text-center px-1 bg-base-100">
                <Icon
                  icon="mdi:check-circle-outline"
                  class="text-base"
                  title="Abgleich"
                />
              </th>
              <th class="text-right px-2 bg-base-100">Aktionen</th>
            </tr>
          </thead>

          <!-- Scrollbarer Tabelleninhalt -->
          <tbody>
            <tr
              v-for="(tx, index) in sortedDisplayTransactions"
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
              <td
                v-if="showAccount"
                class="px-2"
              >
                {{
                  accountStore.getAccountById(tx.accountId)?.name || "Unbekannt"
                }}
              </td>
              <td class="px-2">
                <span v-if="tx.type === TransactionType.ACCOUNTTRANSFER">
                  {{
                    accountStore.getAccountById(tx.transferToAccountId || "")
                      ?.name || "Unbekanntes Konto"
                  }}
                </span>
                <span v-else>
                  {{
                    recipientStore.getRecipientById(tx.recipientId || "")?.name ||
                    "-"
                  }}
                </span>
              </td>
              <td class="px-2">
                {{
                  categoryStore.getCategoryById(tx.categoryId || "")?.name || "-"
                }}
              </td>
              <td class="px-2">
                <div class="flex flex-wrap gap-1">
                  <BadgeSoft
                    v-for="tagId in tx.tagIds"
                    :key="tagId"
                    :label="tagStore.getTagById(tagId)?.name || 'Unbekanntes Tag'"
                    :colorIntensity="
                      tagStore.getTagById(tagId)?.color || 'secondary'
                    "
                    size="sm"
                  />
                </div>
              </td>
              <td class="text-right px-2">
                <CurrencyDisplay
                  :amount="tx.amount"
                  :show-zero="true"
                  :class="{
                    'text-warning': tx.type === TransactionType.ACCOUNTTRANSFER,
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
                <CurrencyDisplay
                  :amount="tx.runningBalance || 0"
                  :show-zero="true"
                  :asInteger="false"
                  class="text-sm"
                />
              </td>
              <td class="text-center px-1">
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs rounded-full"
                  :checked="tx.reconciled || false"
                  @change="toggleReconciliation(tx)"
                  title="Abgeglichen"
                />
              </td>
              <td class="text-right px-2">
                <div class="flex justify-end space-x-1">
                  <button
                    class="btn btn-ghost btn-xs border-none px-1"
                    @click="emit('edit', tx)"
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
          </tbody>
        </table>

        <!-- Loading indicator und Sentinel für infinite scroll -->
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
          <!-- Sentinel element für intersection observer -->
          <div
            ref="sentinelRef"
            class="h-1 w-full"
          ></div>
        </div>

        <!-- Ende der Liste Indikator -->
        <div
          v-else-if="allSortedDisplayTransactions.length > 0"
          class="flex justify-center py-4"
        >
          <span class="text-sm opacity-50"
            >Alle Transaktionen geladen ({{
              allSortedDisplayTransactions.length
            }})</span
          >
        </div>
      </div>
    </div>

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
