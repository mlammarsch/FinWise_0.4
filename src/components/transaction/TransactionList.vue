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
import { defineProps, defineEmits, ref, computed, defineExpose } from "vue";
import { Transaction, TransactionType } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import BadgeSoft from "../ui/BadgeSoft.vue";

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
const sortedDisplayTransactions = computed(() => {
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

// --- Auswahl-Logik ---
const selectedIds = ref<string[]>([]);
const lastSelectedIndex = ref<number | null>(null);
const currentPageIds = computed(() =>
  sortedDisplayTransactions.value.map((tx) => tx.id)
);
const allSelected = computed(() =>
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
  return sortedDisplayTransactions.value.filter((tx) =>
    selectedIds.value.includes(tx.id)
  );
}

function clearSelection() {
  selectedIds.value = [];
}

defineExpose({ getSelectedTransactions, clearSelection });
</script>

<template>
  <div class="overflow-x-auto">
    <table class="table w-full table-zebra table-sm">
      <thead>
        <tr>
          <th class="w-5 px-1">
            <input
              type="checkbox"
              class="checkbox checkbox-sm rounded-full"
              :checked="allSelected"
              @change="handleHeaderCheckboxChange"
            />
          </th>
          <th
            @click="emit('sort-change', 'date')"
            class="cursor-pointer px-2"
          >
            <div class="flex items-center">
              Datum
              <Icon
                v-if="sortKey === 'date'"
                :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                class="ml-1 text-sm"
              />
            </div>
          </th>
          <th
            v-if="showAccount"
            @click="emit('sort-change', 'accountId')"
            class="cursor-pointer px-2"
          >
            <div class="flex items-center">
              Konto
              <Icon
                v-if="sortKey === 'accountId'"
                :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                class="ml-1 text-sm"
              />
            </div>
          </th>
          <th
            @click="emit('sort-change', 'recipientId')"
            class="cursor-pointer px-2"
          >
            <div class="flex items-center">
              Empfänger
              <Icon
                v-if="sortKey === 'recipientId'"
                :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                class="ml-1 text-sm"
              />
            </div>
          </th>
          <th
            @click="emit('sort-change', 'categoryId')"
            class="cursor-pointer px-2"
          >
            <div class="flex items-center">
              Kategorie
              <Icon
                v-if="sortKey === 'categoryId'"
                :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
                class="ml-1 text-sm"
              />
            </div>
          </th>
          <th class="px-2">Tags</th>
          <th
            @click="emit('sort-change', 'amount')"
            class="text-right cursor-pointer px-2"
          >
            <div class="flex items-center justify-end">
              Betrag
              <Icon
                v-if="sortKey === 'amount'"
                :icon="sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'"
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
          <th class="text-right cursor-pointer px-2">
            <div class="flex items-center justify-end">
              Saldo
              <Icon
                icon="mdi:scale-balance"
                class="ml-1 text-sm opacity-50"
              />
            </div>
          </th>
          <th class="text-right px-2">Aktionen</th>
        </tr>
      </thead>
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
            {{ accountStore.getAccountById(tx.accountId)?.name || "Unbekannt" }}
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
                @click="emit('delete', tx)"
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
  </div>
</template>
