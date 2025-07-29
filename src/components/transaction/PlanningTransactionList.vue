<!-- Datei: src/components/transaction/PlanningTransactionList.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/transaction/PlanningTransactionList.vue
 * Zeigt eine Liste von geplanten Transaktionen an. Nutzt Stores für Daten.
 *
 * Komponenten-Props:
 * - planningTransactions: Array<{ date: string; transaction: PlanningTransaction }> - Die anzuzeigenden geplanten Transaktionen
 * - searchTerm?: string - Optional: Suchbegriff für Filterung
 *
 * Emits:
 * - execute: Ausführen einer geplanten Transaktion
 * - skip: Überspringen einer geplanten Transaktion
 * - edit: Bearbeiten einer geplanten Transaktion
 * - delete: Löschen einer geplanten Transaktion
 */
import {
  defineProps,
  defineEmits,
  ref,
  computed,
  onMounted,
  onUnmounted,
  nextTick,
  watch,
} from "vue";
import { PlanningTransaction, TransactionType } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  planningTransactions: Array<{ date: string; transaction: PlanningTransaction }>;
  searchTerm?: string;
}>();

const emit = defineEmits([
  "execute",
  "skip",
  "edit",
  "delete",
]);

const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();

// Lazy Loading State
const visibleItemsCount = ref(25); // Initial number of items to show
const itemsPerLoad = 25; // Number of items to load when scrolling
const loadingMoreItems = ref(false);
const sentinelRef = ref<HTMLElement | null>(null);
const intersectionObserver = ref<IntersectionObserver | null>(null);

// Dynamic height calculation
const containerRef = ref<HTMLElement | null>(null);
const containerHeight = ref('600px');
const resizeObserver = ref<ResizeObserver | null>(null);

// Filterung der Transaktionen
const displayTransactions = computed(() => {
  let filtered = [...props.planningTransactions];

  if (props.searchTerm && props.searchTerm.trim() !== "") {
    const term = props.searchTerm.toLowerCase().trim();
    filtered = filtered.filter((entry) => {
      const t = entry.transaction;
      const dateField = formatDate(entry.date);
      const recipientName = recipientStore.getRecipientById(t.recipientId || "")?.name || "";
      const accountName = accountStore.getAccountById(t.accountId)?.name || "";
      const categoryName = categoryStore.getCategoryById(t.categoryId || "")?.name || "";
      const amountStr = t.amount.toString();
      const name = t.name || "";

      const fields = [
        dateField,
        name,
        recipientName,
        accountName,
        categoryName,
        amountStr,
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });
  }

  return filtered;
});

// Lazy Loading: Nur die sichtbaren Transaktionen anzeigen
const sortedDisplayTransactions = computed(() => {
  return displayTransactions.value.slice(0, visibleItemsCount.value);
});

// Check if there are more items to load
const hasMoreItems = computed(() => {
  return visibleItemsCount.value < displayTransactions.value.length;
});

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

// Event handlers
function handleExecute(transactionId: string, date: string) {
  emit("execute", transactionId, date);
}

function handleSkip(transactionId: string, date: string) {
  emit("skip", transactionId, date);
}

function handleEdit(transaction: PlanningTransaction) {
  emit("edit", transaction);
}

function handleDelete(transaction: PlanningTransaction) {
  emit("delete", transaction);
}

// Lazy Loading Functions
function loadMoreItems() {
  if (loadingMoreItems.value || !hasMoreItems.value) return;

  loadingMoreItems.value = true;

  // Simulate loading delay for better UX
  setTimeout(() => {
    visibleItemsCount.value = Math.min(
      visibleItemsCount.value + itemsPerLoad,
      displayTransactions.value.length
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

  // Berechne verfügbare Höhe: Viewport - Container-Top-Position - Padding/Margin (ca. 100px)
  const availableHeight = viewportHeight - containerRect.top - 100;

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
  () => [props.planningTransactions, props.searchTerm],
  () => {
    handleTransactionsChange();
  },
  { deep: true }
);
</script>

<template>
  <div ref="containerRef" class="flex flex-col">
    <!-- Container für Tabelle mit dynamischer Höhe und eigenem Scrolling -->
    <div
      :style="{ height: containerHeight }"
      class="overflow-hidden"
    >
      <div class="h-full overflow-x-auto overflow-y-auto">
        <table class="table table-sm w-full">
          <!-- Sticky Header -->
          <thead class="sticky top-0 z-20 bg-base-100 shadow-sm">
        <tr class="text-xs">
          <th class="py-1 bg-base-100">Datum</th>
          <th class="py-1 bg-base-100">Typ</th>
          <th class="py-1 bg-base-100">Name</th>
          <th class="py-1 bg-base-100">Empfänger</th>
          <th class="py-1 bg-base-100">Quelle</th>
          <th class="py-1 bg-base-100">Ziel</th>
          <th class="py-1 text-right bg-base-100">Betrag</th>
          <th class="py-1 text-right bg-base-100">Aktionen</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(e, index) in sortedDisplayTransactions"
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
                  @click="handleExecute(e.transaction.id, e.date)"
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
                  @click="handleSkip(e.transaction.id, e.date)"
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
                  @click="handleEdit(e.transaction)"
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
                  @click="handleDelete(e.transaction)"
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
        <tr v-if="sortedDisplayTransactions.length === 0">
          <td
            colspan="8"
            class="text-center py-4"
          >
            Keine anstehenden Transaktionen im ausgewählten Zeitraum.
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
      v-else-if="displayTransactions.length > 0"
      class="flex justify-center py-4"
    >
      <span class="text-sm opacity-50"
        >Alle Transaktionen geladen ({{
          displayTransactions.length
        }})</span
      >
      </div>
      </div>
    </div>
  </div>
</template>
