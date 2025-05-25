<!-- Datei: src/components/transaction/TransactionCard.vue -->
<script setup lang="ts">
import { defineProps, computed } from "vue";
import { Transaction, TransactionType } from "../../types";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTransactionStore } from "../../stores/transactionStore";
import { useTransactionFilterStore } from "../../stores/transactionFilterStore"; // Neuer Import
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { formatDate } from "../../utils/formatters";
import BadgeSoft from "../ui/BadgeSoft.vue";
import { Icon } from "@iconify/vue";
import { useAccountStore } from "../../stores/accountStore";
import { TransactionService } from "@/services/TransactionService"; // Neuer Import

/**
 * Pfad zur Komponente: components/transaction/TransactionCard.vue
 * Diese Komponente stellt eine einzelne Transaktionskarte im horizontalen Layout dar.
 * Komponenten-Props:
 * - transaction: Transaction - Die Transaktion, die angezeigt wird.
 *
 * Emits:
 * - Keine Emits vorhanden.
 */

const props = defineProps<{ transaction: Transaction }>();

const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const transactionStore = useTransactionStore();

const categoryName = computed(() =>
  props.transaction.categoryId
    ? categoryStore.getCategoryById(props.transaction.categoryId)?.name ||
      "Keine Kategorie"
    : "Keine Kategorie"
);

const recipientName = computed(() => {
  if (props.transaction.type === TransactionType.ACCOUNTTRANSFER) {
    const toAccountId = props.transaction.transferToAccountId;
    const account = toAccountId
      ? accountStore.getAccountById(toAccountId)
      : null;
    return account?.name || "-";
  }

  return props.transaction.recipientId
    ? recipientStore.getRecipientById(props.transaction.recipientId)?.name ||
        "-"
    : "-";
});

const getTagName = (tagId: string) => tagStore.getTagById(tagId)?.name || "";

const transactionIcon = computed(() => {
  if (props.transaction.type === TransactionType.ACCOUNTTRANSFER)
    return "mdi:bank-transfer";
  if (props.transaction.type === TransactionType.EXPENSE)
    return "mdi:cash-minus";
  if (props.transaction.type === TransactionType.INCOME) return "mdi:cash-plus";
  return "mdi:cash";
});

const toggleReconciled = () => {
  TransactionService.updateTransaction(props.transaction.id, {
    reconciled: !props.transaction.reconciled,
  });
};
</script>

<template>
  <div
    v-if="transaction.type !== TransactionType.CATEGORYTRANSFER"
    class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
  >
    <div class="flex items-stretch px-2 p-2 space-x-2">
      <!-- Checkbox für Batchverarbeitung -->
      <div class="flex flex-col justify-center p-2">
        <input type="checkbox" class="checkbox checkbox-sm" />
      </div>

      <!-- Hauptbereich -->
      <div class="flex flex-col flex-grow space-y-1">
        <!-- Empfänger + Betrag -->
        <div class="flex justify-between items-start">
          <div class="flex items-center">
            <Icon icon="mdi:account" class="pr-1 text-lg opacity-50" />
            <div class="text-base">{{ recipientName }}</div>
          </div>

          <div class="flex items-center space-x-1">
            <div class="flex items-center">
              <input
                type="checkbox"
                class="checkbox checkbox-xs rounded-full"
                :checked="transaction.reconciled"
                @change="toggleReconciled"
              />
            </div>
            <Icon
              :icon="transactionIcon"
              class="text-xl mx-1 text-neutral/70 mx-2"
            />
            <CurrencyDisplay
              :amount="transaction.amount"
              class="text-right text-base whitespace-nowrap"
              :show-zero="true"
              :class="{
                'text-warning':
                  transaction.type === TransactionType.ACCOUNTTRANSFER,
              }"
            />
          </div>
        </div>

        <!-- Notiz -->
        <div
          v-if="transaction.note"
          class="whitespace-pre-wrap flex items-start w-5/6 bg-base-200 rounded-md p-1"
        >
          <div class="flex items-center">
            <div>
              <Icon icon="mdi:speaker-notes" class="text-sm ml-1 opacity-50" />
            </div>
            <div class="text-sm text-gray-500 ml-2">
              {{ transaction.note }}
            </div>
          </div>
        </div>

        <!-- Datum + Kategorie -->
        <div class="text-xs neutral-content flex items-center flex-wrap">
          <!-- Gruppe 1 -->
          <div class="flex items-center">
            <Icon icon="mdi:calendar-import" class="pr-1 text-lg opacity-50" />
            <div class="text-sm">{{ formatDate(transaction.date) }}</div>
          </div>

          <Icon icon="mdi:square-medium" class="text-base opacity-40 mx-1" />

          <!-- Gruppe 2 -->
          <div class="flex items-center">
            <Icon icon="mdi:calendar-check" class="pr-1 text-lg opacity-50" />
            <div class="text-sm">{{ formatDate(transaction.valueDate) }}</div>
          </div>

          <Icon icon="mdi:square-medium" class="text-base opacity-40 mx-1" />

          <!-- Gruppe 3 -->
          <div class="flex items-center">
            <Icon icon="mdi:category" class="pr-1 text-lg opacity-50" />
            <div class="text-sm">{{ categoryName }}</div>
          </div>
        </div>

        <!-- Tags (immer ganz unten) -->
        <div
          v-if="transaction.tagIds.length > 0"
          class="flex flex-wrap gap-1 mt-1"
        >
          <BadgeSoft
            v-for="tagId in transaction.tagIds"
            :key="tagId"
            :label="getTagName(tagId)"
            :colorIntensity="tagStore.getTagById(tagId)?.color || 'secondary'"
            size="sm"
          />
        </div>
      </div>
    </div>
  </div>
</template>
