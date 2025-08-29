<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTransactionStore } from '../../../stores/transactionStore';
import { useAccountStore } from '../../../stores/accountStore';
import { useCategoryStore } from '../../../stores/categoryStore';
import { useRecipientStore } from '../../../stores/recipientStore';
import { TransactionType } from '../../../types';
import { formatDate } from '../../../utils/formatters';
import CurrencyDisplay from '../CurrencyDisplay.vue';

const props = withDefaults(defineProps<{
  initialLimit?: number;
  limits?: number[];
  showHeader?: boolean;
  showActions?: boolean;
}>(), {
  initialLimit: 5,
  limits: () => [5, 10, 25],
  showHeader: true,
  showActions: true,
});

const router = useRouter();

const transactionStore = useTransactionStore();
const accountStore = useAccountStore();
const recipientStore = useRecipientStore();
const categoryStore = useCategoryStore();

const transactionLimit = ref<number>(props.initialLimit);

const recentTransactions = computed(() => {
  const allTransactions = transactionStore.transactions
    .filter(
      (tx) =>
        tx.type === TransactionType.INCOME ||
        tx.type === TransactionType.EXPENSE
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, transactionLimit.value);

  return allTransactions;
});

const setTransactionLimit = (limit: number) => {
  transactionLimit.value = limit;
};

const navigateToTransactions = () => router.push('/transactions');
</script>

<template>
  <div class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150">
    <div class="card-body">
      <div class="flex justify-between items-center mb-4">
        <h3 v-if="showHeader" class="card-title text-lg">Letzte Transaktionen</h3>

        <!-- Buttons für Transaktionslimit -->
        <div class="flex gap-2 mb-4">
          <button
            v-for="limit in props.limits"
            :key="limit"
            :class="transactionLimit === limit ? 'btn btn-xs btn-primary' : 'btn btn-xs btn-outline'"
            @click="setTransactionLimit(limit)"
          >
            {{ limit }}
          </button>
        </div>

        <button
          v-if="showActions"
          class="btn btn-sm btn-ghost"
          @click="navigateToTransactions"
        >
          Alle anzeigen
          <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra w-full table-compact">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Konto</th>
              <th>Empfänger</th>
              <th>Beschreibung</th>
              <th>Kategorie</th>
              <th class="text-right">Betrag</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr
              v-for="tx in recentTransactions"
              :key="tx.id"
              class="leading-tight"
            >
              <td class="py-2">{{ formatDate(tx.date) }}</td>
              <td class="py-2">
                {{ tx.accountId ? (accountStore.getAccountById(tx.accountId)?.name || '') : '' }}
              </td>
              <td class="py-2">
                {{ tx.recipientId ? (recipientStore.getRecipientById(tx.recipientId)?.name || '') : '' }}
              </td>
              <td class="py-2">{{ tx.description || tx.payee || '' }}</td>
              <td class="py-2">
                {{ tx.categoryId ? (categoryStore.getCategoryById(tx.categoryId)?.name || '') : '' }}
              </td>
              <td
                class="text-right py-2"
                :class="tx.amount >= 0 ? 'text-success' : 'text-error'"
              >
                <CurrencyDisplay :amount="tx.amount" :asInteger="true" />
              </td>
            </tr>

            <tr v-if="recentTransactions.length === 0">
              <td colspan="6" class="text-center py-4">
                Keine Transaktionen vorhanden
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
</style>
