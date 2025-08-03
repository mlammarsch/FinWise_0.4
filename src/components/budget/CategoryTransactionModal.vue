<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useTransactionStore, type ExtendedTransaction } from '../../stores/transactionStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useAccountStore } from '../../stores/accountStore';
import { useRecipientStore } from '../../stores/recipientStore';
import CurrencyDisplay from '../ui/CurrencyDisplay.vue';
import { debugLog } from '../../utils/logger';
import { toDateOnlyString } from '../../utils/formatters';

interface Props {
  isOpen: boolean;
  categoryId: string;
  month: {
    key: string;
    label: string;
    start: Date;
    end: Date;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

// Stores
const transactionStore = useTransactionStore();
const categoryStore = useCategoryStore();
const accountStore = useAccountStore();
const recipientStore = useRecipientStore();

// Lokaler State
const isLoading = ref(false);

// Computed Properties
const category = computed(() =>
  categoryStore.categories.find(c => c.id === props.categoryId)
);

const categoryTransactions = computed(() => {
  if (!props.isOpen || !props.categoryId) return [];

  const startDate = toDateOnlyString(props.month.start.toISOString());
  const endDate = toDateOnlyString(props.month.end.toISOString());

  return transactionStore.transactions
    .filter(t => {
      const transactionDate = toDateOnlyString(t.date);
      return t.categoryId === props.categoryId &&
             transactionDate >= startDate &&
             transactionDate <= endDate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
});

const totalAmount = computed(() =>
  categoryTransactions.value.reduce((sum, t) => sum + t.amount, 0)
);

const transactionCount = computed(() => categoryTransactions.value.length);

// Helper Functions
function getAccountName(accountId: string): string {
  const account = accountStore.accounts.find(a => a.id === accountId);
  return account?.name || 'Unbekanntes Konto';
}

function getRecipientName(recipientId?: string): string {
  if (!recipientId) return '';
  const recipient = recipientStore.recipients.find(r => r.id === recipientId);
  return recipient?.name || '';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getTransactionTypeIcon(transaction: ExtendedTransaction): string {
  if (transaction.amount > 0) {
    return 'mdi:arrow-down-circle';
  } else {
    return 'mdi:arrow-up-circle';
  }
}

function getTransactionTypeColor(transaction: ExtendedTransaction): string {
  if (transaction.amount > 0) {
    return 'text-success';
  } else {
    return 'text-error';
  }
}

// Event Handlers
function handleClose() {
  emit('close');
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose();
  }
}

// Watchers
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    debugLog('CategoryTransactionModal', `Opening modal for category ${props.categoryId} in month ${props.month.label}`);
  }
});

onMounted(() => {
  // Transaktionen laden falls noch nicht geladen
  if (transactionStore.transactions.length === 0) {
    isLoading.value = true;
    transactionStore.loadTransactions().finally(() => {
      isLoading.value = false;
    });
  }
});
</script>

<template>
  <!-- Modal Backdrop -->
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-base-content/20"
    @click="handleBackdropClick"
  >
    <!-- Modal Content -->
    <div class="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <!-- Modal Header -->
      <div class="flex items-center justify-between p-6 border-b border-base-300">
        <div class="flex items-center space-x-3">
          <Icon
            v-if="category?.icon"
            :icon="category.icon"
            class="w-6 h-6 text-primary"
          />
          <div>
            <h2 class="text-xl font-semibold text-base-content">
              {{ category?.name || 'Kategorie' }}
            </h2>
            <p class="text-sm text-base-content/60">
              {{ month.label }} • {{ transactionCount }} {{ transactionCount === 1 ? 'Transaktion' : 'Transaktionen' }}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Gesamtsumme -->
          <div class="text-right">
            <p class="text-sm text-base-content/60">Gesamtsumme</p>
            <CurrencyDisplay
              :amount="totalAmount"
              :class="totalAmount >= 0 ? 'text-success' : 'text-error'"
              class="text-lg font-semibold"
            />
          </div>

          <!-- Close Button -->
          <button
            @click="handleClose"
            class="btn btn-ghost btn-sm btn-circle"
            aria-label="Modal schließen"
          >
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="flex-1 overflow-hidden">
        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center h-64">
          <div class="loading loading-spinner loading-lg text-primary"></div>
        </div>

        <!-- Empty State -->
        <div v-else-if="categoryTransactions.length === 0" class="flex flex-col items-center justify-center h-64 text-center">
          <Icon icon="mdi:receipt-text-outline" class="w-16 h-16 text-base-content/30 mb-4" />
          <h3 class="text-lg font-medium text-base-content mb-2">Keine Transaktionen</h3>
          <p class="text-base-content/60">
            Für diese Kategorie wurden im {{ month.label }} keine Transaktionen gefunden.
          </p>
        </div>

        <!-- Transactions List -->
        <div v-else class="overflow-y-auto max-h-[60vh]">
          <div class="divide-y divide-base-200">
            <div
              v-for="transaction in categoryTransactions"
              :key="transaction.id"
              class="p-2 hover:bg-base-50 transition-colors duration-150"
            >
              <div class="flex items-center justify-between">
                <!-- Transaction Info -->
                <div class="flex items-center space-x-3 flex-1">
                  <!-- Transaction Type Icon -->
                  <div class="flex-shrink-0">
                    <Icon
                      :icon="getTransactionTypeIcon(transaction)"
                      :class="getTransactionTypeColor(transaction)"
                      class="w-5 h-5"
                    />
                  </div>

                  <!-- Transaction Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2">
                      <p class="text-sm font-medium text-base-content truncate">
                        {{ transaction.description }}
                      </p>
                      <span v-if="getRecipientName(transaction.recipientId)"
                            class="text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">
                        {{ getRecipientName(transaction.recipientId) }}
                      </span>
                    </div>

                    <div class="flex items-center space-x-4 mt-0">
                      <span class="text-xs text-base-content/60">
                        {{ formatDate(transaction.date) }}
                      </span>
                      <span class="text-xs text-base-content/60">
                        {{ getAccountName(transaction.accountId) }}
                      </span>
                      <span v-if="transaction.note" class="text-xs text-base-content/60">
                        {{ transaction.note }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Transaction Amount -->
                <div class="flex-shrink-0 text-right">
                  <CurrencyDisplay
                    :amount="transaction.amount"
                    :class="transaction.amount >= 0 ? 'text-success' : 'text-error'"
                    class="text-sm font-semibold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="flex items-center justify-end p-6 border-t border-base-300 space-x-3">
        <button
          @click="handleClose"
          class="btn btn-ghost"
        >
          Schließen
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth transitions for modal */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Scrollbar styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: hsl(var(--b2));
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: hsl(var(--bc) / 0.3);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--bc) / 0.5);
}
</style>
