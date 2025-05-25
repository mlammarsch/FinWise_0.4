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
import { defineProps, defineEmits, ref, computed, defineExpose } from "vue";
import { Transaction, TransactionType } from "../../types";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import CategoryTransferModal from "../budget/CategoryTransferModal.vue";
import { AccountService } from "@/services/AccountService";
import { CategoryService } from "@/services/CategoryService";
import { debugLog } from "@/utils/logger";
import { BalanceService } from "@/services/BalanceService";

const props = defineProps<{
  transactions: Transaction[];
  sortKey: keyof Transaction | "";
  sortOrder: "asc" | "desc";
  searchTerm?: string;
}>();

const emit = defineEmits(["edit", "delete", "sort-change"]);

// Filterung der Transaktionen:
// Bei CATEGORYTRANSFER werden nur Transaktionen mit nicht-negativem Betrag angezeigt.
const displayTransactions = computed(() => {
  let list = props.transactions.filter(
    (tx) => tx.type !== TransactionType.CATEGORYTRANSFER || tx.amount >= 0
  );
  if (props.searchTerm && props.searchTerm.trim() !== "") {
    const term = props.searchTerm.toLowerCase().trim();
    list = list.filter((tx) => {
      const fields = [
        formatDate(tx.date),
        formatDate(tx.valueDate),
        CategoryService.getCategoryName(tx.categoryId),
        CategoryService.getCategoryName(tx.toCategoryId),
        tx.amount.toString(),
        tx.note || "",
      ];
      return fields.some((field) => field.toLowerCase().includes(term));
    });
  }
  return list;
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
      ...new Set([...selectedIds.value, ...currentPageIds.value]),
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
  return props.transactions.filter((tx) => selectedIds.value.includes(tx.id));
}

defineExpose({ getSelectedTransactions, selectedIds });

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
      fromCategoryId: fromCatId,
      toCategoryId: toCatId,
      prefillDate: tx.date,
      note: tx.note,
    };
    debugLog(
      "[CategoryTransactionList] Opening edit modal for transfer",
      modalData.value
    );
    showTransferModal.value = true;
  } else {
    debugLog(
      "[CategoryTransactionList] Emitting edit für Standardtransaction",
      tx
    );
    emit("edit", tx);
  }
}

function onTransferComplete() {
  showTransferModal.value = false;
  debugLog(
    "[CategoryTransactionList] Transfer modal closed, operation successful."
  );
}
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
              <Icon icon="mdi:note-text-outline" class="text-base" />
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
                {{ CategoryService.getCategoryName(tx.toCategoryId) }}
              </template>
              <template v-else>
                {{ AccountService.getAccountName(tx.accountId) }}
              </template>
            </td>
            <td class="px-2">
              {{ CategoryService.getCategoryName(tx.categoryId) }}
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
                <div class="tooltip tooltip-left" :data-tip="tx.note">
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
                  <Icon icon="mdi:pencil" class="text-base" />
                </button>
                <button
                  class="btn btn-ghost btn-xs border-none text-error/75 px-1"
                  @click="$emit('delete', tx)"
                  title="Löschen"
                >
                  <Icon icon="mdi:trash-can" class="text-base" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="displayTransactions.length === 0">
            <td colspan="8" class="text-center py-4 text-base-content/70">
              Keine Transaktionen für die Filter gefunden.
            </td>
          </tr>
        </tbody>
      </table>
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
  </div>
</template>
