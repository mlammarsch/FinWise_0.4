<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { usePlanningStore } from '../../stores/planningStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useAccountStore } from '../../stores/accountStore';
import { useRecipientStore } from '../../stores/recipientStore';
import { PlanningService } from '../../services/PlanningService';
import CurrencyDisplay from '../ui/CurrencyDisplay.vue';
import { debugLog } from '../../utils/logger';
import { toDateOnlyString } from '../../utils/formatters';
import type { PlanningTransaction } from '../../types';

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
const planningStore = usePlanningStore();
const categoryStore = useCategoryStore();
const accountStore = useAccountStore();
const recipientStore = useRecipientStore();

// Lokaler State
const isLoading = ref(false);

// Computed Properties
const category = computed(() =>
  categoryStore.categories.find(c => c.id === props.categoryId)
);

const categoryPlannings = computed(() => {
  if (!props.isOpen || !props.categoryId) return [];

  const startDate = toDateOnlyString(props.month.start.toISOString());
  const endDate = toDateOnlyString(props.month.end.toISOString());

  return planningStore.planningTransactions
    .filter(p => {
      // Nur aktive Planungen
      if (!p.isActive) return false;

      // Kategorie muss übereinstimmen
      if (p.categoryId !== props.categoryId) return false;

      // Berechne alle Ausführungstermine für diese Planung im Monat
      const occurrences = PlanningService.calculateNextOccurrences(p, startDate, endDate);
      return occurrences.length > 0;
    })
    .map(p => {
      // Erweitere jede Planung um die Ausführungstermine im Monat
      const occurrences = PlanningService.calculateNextOccurrences(p, startDate, endDate);
      return {
        ...p,
        nextOccurrences: occurrences
      };
    })
    .sort((a, b) => {
      // Sortiere nach dem nächsten Ausführungstermin
      const aNext = a.nextOccurrences[0] || a.startDate;
      const bNext = b.nextOccurrences[0] || b.startDate;
      return new Date(aNext).getTime() - new Date(bNext).getTime();
    });
});

const totalAmount = computed(() =>
  categoryPlannings.value.reduce((sum, p) => {
    // Multipliziere mit der Anzahl der Ausführungen im Monat
    return sum + (p.amount * p.nextOccurrences.length);
  }, 0)
);

const planningCount = computed(() => {
  // Zähle die Gesamtanzahl der geplanten Ausführungen
  return categoryPlannings.value.reduce((sum, p) => sum + p.nextOccurrences.length, 0);
});

// Helper Functions
function getAccountName(accountId: string): string {
  const account = accountStore.accounts.find(a => a.id === accountId);
  return account?.name || 'Unbekanntes Konto';
}

function getRecipientName(recipientId?: string | null): string {
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

function getPlanningTypeIcon(planning: PlanningTransaction): string {
  if (planning.amount > 0) {
    return 'mdi:calendar-plus';
  } else {
    return 'mdi:calendar-minus';
  }
}

function getPlanningTypeColor(planning: PlanningTransaction): string {
  if (planning.amount > 0) {
    return 'text-success';
  } else {
    return 'text-error';
  }
}

function getRecurrenceText(planning: PlanningTransaction): string {
  switch (planning.recurrencePattern) {
    case 'ONCE': return 'Einmalig';
    case 'DAILY': return 'Täglich';
    case 'WEEKLY': return 'Wöchentlich';
    case 'BIWEEKLY': return 'Alle 2 Wochen';
    case 'MONTHLY': return 'Monatlich';
    case 'QUARTERLY': return 'Vierteljährlich';
    case 'YEARLY': return 'Jährlich';
    default: return 'Unbekannt';
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
    debugLog('CategoryPlanningModal', `Opening modal for category ${props.categoryId} in month ${props.month.label}`);
  }
});

onMounted(() => {
  // Planungen laden falls noch nicht geladen
  if (planningStore.planningTransactions.length === 0) {
    isLoading.value = true;
    planningStore.loadPlanningTransactions().finally(() => {
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
              {{ category?.name || 'Kategorie' }} - Planungen
            </h2>
            <p class="text-sm text-base-content/60">
              {{ month.label }} • {{ planningCount }} {{ planningCount === 1 ? 'geplante Ausführung' : 'geplante Ausführungen' }}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <!-- Gesamtsumme -->
          <div class="text-right">
            <p class="text-sm text-base-content/60">Geplante Summe</p>
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
        <div v-else-if="categoryPlannings.length === 0" class="flex flex-col items-center justify-center h-64 text-center">
          <Icon icon="mdi:calendar-outline" class="w-16 h-16 text-base-content/30 mb-4" />
          <h3 class="text-lg font-medium text-base-content mb-2">Keine Planungen</h3>
          <p class="text-base-content/60">
            Für diese Kategorie wurden im {{ month.label }} keine geplanten Transaktionen gefunden.
          </p>
        </div>

        <!-- Plannings List -->
        <div v-else class="overflow-y-auto max-h-[60vh]">
          <div class="divide-y divide-base-200">
            <div
              v-for="planning in categoryPlannings"
              :key="planning.id"
              class="p-4 hover:bg-base-50 transition-colors duration-150"
            >
              <!-- Planning Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-3 flex-1">
                  <!-- Planning Type Icon -->
                  <div class="flex-shrink-0">
                    <Icon
                      :icon="getPlanningTypeIcon(planning)"
                      :class="getPlanningTypeColor(planning)"
                      class="w-5 h-5"
                    />
                  </div>

                  <!-- Planning Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2">
                      <p class="text-sm font-medium text-base-content truncate">
                        {{ planning.name }}
                      </p>
                      <span v-if="getRecipientName(planning.recipientId)"
                            class="text-xs text-base-content/60 bg-base-200 px-2 py-1 rounded">
                        {{ getRecipientName(planning.recipientId) }}
                      </span>
                    </div>

                    <div class="flex items-center space-x-4 mt-1">
                      <span class="text-xs text-base-content/60">
                        {{ getRecurrenceText(planning) }}
                      </span>
                      <span v-if="planning.accountId" class="text-xs text-base-content/60">
                        {{ getAccountName(planning.accountId) }}
                      </span>
                      <span v-if="planning.note" class="text-xs text-base-content/60">
                        {{ planning.note }}
                      </span>
                      <span v-if="planning.nextOccurrences.length > 0" class="text-xs text-base-content/60">
                        Geplante Ausführungen:
                        <span
                          v-for="(date, index) in planning.nextOccurrences"
                          :key="date"
                          class="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded ml-1"
                        >{{ formatDate(date) }}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Planning Amount -->
                <div class="flex-shrink-0 text-right">
                  <CurrencyDisplay
                    :amount="planning.amount"
                    :class="planning.amount >= 0 ? 'text-success' : 'text-error'"
                    class="text-sm font-semibold"
                  />
                  <p class="text-xs text-base-content/60">
                    {{ planning.nextOccurrences.length }}x im Monat
                  </p>
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
