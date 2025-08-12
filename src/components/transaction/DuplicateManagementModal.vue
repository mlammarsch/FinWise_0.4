<!-- src/components/transaction/DuplicateManagementModal.vue -->
<script setup lang="ts">
/**
 * Duplikat-Management-Modal für CSV-Import
 * Zeigt potentielle Duplikate an und ermöglicht deren Verwaltung
 */
import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import { formatDate } from "@/utils/formatters";
import { parseAmount } from "@/utils/csvUtils";

const props = defineProps<{
  isOpen: boolean;
  duplicates: Array<{
    csvRow: any;
    existingTransaction: any;
    duplicateType: 'exact' | 'similar' | 'account_transfer';
    confidence: number;
  }>;
  mappedColumns: {
    date: string;
    amount: string;
    recipient: string;
    category: string;
    notes: string;
  };
}>();

const emit = defineEmits<{
  close: [];
  ignoreDuplicates: [duplicateIndexes: number[]];
}>();

// Lokaler State für Checkbox-Verwaltung
const selectedDuplicates = ref<Set<number>>(new Set());
const selectAll = ref(false);

// Computed für "Alle auswählen" Checkbox
const allSelected = computed(() => {
  return props.duplicates.length > 0 && selectedDuplicates.value.size === props.duplicates.length;
});

const someSelected = computed(() => {
  return selectedDuplicates.value.size > 0 && selectedDuplicates.value.size < props.duplicates.length;
});

// Watcher für "Alle auswählen"
watch(selectAll, (newValue) => {
  if (newValue) {
    selectedDuplicates.value = new Set(props.duplicates.map((_, index) => index));
  } else {
    selectedDuplicates.value.clear();
  }
});

// Watcher für individuelle Auswahl
watch(() => selectedDuplicates.value.size, (newSize) => {
  selectAll.value = newSize === props.duplicates.length;
});

// Reset bei Modal-Öffnung
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    selectedDuplicates.value.clear();
    selectAll.value = false;
  }
});

function toggleDuplicate(index: number) {
  if (selectedDuplicates.value.has(index)) {
    selectedDuplicates.value.delete(index);
  } else {
    selectedDuplicates.value.add(index);
  }
  // Trigger reactivity
  selectedDuplicates.value = new Set(selectedDuplicates.value);
}

function handleIgnoreSelected() {
  const indexes = Array.from(selectedDuplicates.value);
  emit('ignoreDuplicates', indexes);
  emit('close');
}

function handleClose() {
  emit('close');
}

function getDuplicateTypeLabel(type: string): string {
  switch (type) {
    case 'exact': return 'Exakt';
    case 'similar': return 'Ähnlich';
    case 'account_transfer': return 'Account-Transfer';
    default: return 'Unbekannt';
  }
}

function getDuplicateTypeColor(type: string): string {
  switch (type) {
    case 'exact': return 'badge-error';
    case 'similar': return 'badge-warning';
    case 'account_transfer': return 'badge-info';
    default: return 'badge-neutral';
  }
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-error';
  if (confidence >= 0.7) return 'text-warning';
  return 'text-info';
}
</script>

<template>
  <div v-if="isOpen" class="modal modal-open">
    <div class="modal-box w-11/12 max-w-6xl h-5/6 max-h-screen flex flex-col">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4 flex-shrink-0">
        <div>
          <h3 class="font-bold text-lg">Duplikat-Verwaltung</h3>
          <p class="text-sm text-base-content/70">
            {{ duplicates.length }} potentielle Duplikate gefunden
          </p>
        </div>
        <button class="btn btn-sm btn-circle btn-ghost" @click="handleClose">
          <Icon icon="mdi:close" class="w-4 h-4" />
        </button>
      </div>

      <!-- Aktionen -->
      <div class="flex justify-between items-center mb-4 flex-shrink-0">
        <div class="form-control">
          <label class="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              v-model="selectAll"
              :indeterminate="someSelected"
            />
            <span class="label-text">Alle auswählen</span>
          </label>
        </div>
        <div class="flex gap-2">
          <button
            class="btn btn-sm btn-warning"
            :disabled="selectedDuplicates.size === 0"
            @click="handleIgnoreSelected"
          >
            <Icon icon="mdi:eye-off" class="w-4 h-4" />
            {{ selectedDuplicates.size }} Duplikate ignorieren
          </button>
        </div>
      </div>

      <!-- Duplikat-Liste -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="duplicates.length === 0" class="text-center py-8 text-base-content/50">
          <Icon icon="mdi:check-circle" class="w-16 h-16 mx-auto mb-2 text-success" />
          <p>Keine Duplikate gefunden!</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="(duplicate, index) in duplicates"
            :key="index"
            class="card bg-base-200 shadow-sm"
            :class="{ 'opacity-60': selectedDuplicates.has(index) }"
          >
            <div class="card-body p-3">
              <!-- Duplikat-Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="selectedDuplicates.has(index)"
                    @change="toggleDuplicate(index)"
                  />
                  <div class="badge badge-sm" :class="getDuplicateTypeColor(duplicate.duplicateType)">
                    {{ getDuplicateTypeLabel(duplicate.duplicateType) }}
                  </div>
                  <span class="text-xs" :class="getConfidenceColor(duplicate.confidence)">
                    {{ Math.round(duplicate.confidence * 100) }}% Übereinstimmung
                  </span>
                </div>
                <Icon
                  icon="mdi:content-duplicate"
                  class="w-4 h-4 text-warning"
                  title="Duplikat erkannt"
                />
              </div>

              <!-- CSV-Zeile (Neue Transaktion) -->
              <div class="bg-base-100 rounded p-2 mb-2">
                <div class="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:file-upload" class="w-4 h-4 text-primary" />
                  <span class="text-xs font-medium text-primary">Neue Transaktion (CSV)</span>
                </div>
                <div class="grid grid-cols-5 gap-2 text-xs">
                  <div>
                    <span class="text-base-content/60">Datum:</span><br>
                    <span class="font-mono">
                      {{ formatDate(duplicate.csvRow[mappedColumns.date] || '') }}
                    </span>
                  </div>
                  <div>
                    <span class="text-base-content/60">Betrag:</span><br>
                    <CurrencyDisplay
                      :amount="parseAmount(duplicate.csvRow[mappedColumns.amount]) || 0"
                      class="font-mono"
                    />
                  </div>
                  <div>
                    <span class="text-base-content/60">Empfänger:</span><br>
                    <span class="font-mono text-xs">
                      {{ duplicate.csvRow[mappedColumns.recipient] || '—' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-base-content/60">Kategorie:</span><br>
                    <span class="font-mono text-xs">
                      {{ duplicate.csvRow[mappedColumns.category] || '—' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-base-content/60">Notizen:</span><br>
                    <span class="font-mono text-xs truncate">
                      {{ duplicate.csvRow[mappedColumns.notes] || '—' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Existierende Transaktion -->
              <div class="bg-base-300 rounded p-2 pl-6">
                <div class="flex items-center gap-2 mb-1">
                  <Icon icon="mdi:database" class="w-4 h-4 text-accent" />
                  <span class="text-xs font-medium text-accent">Existierende Transaktion</span>
                </div>
                <div class="grid grid-cols-5 gap-2 text-xs">
                  <div>
                    <span class="text-base-content/60">Datum:</span><br>
                    <span class="font-mono">
                      {{ formatDate(duplicate.existingTransaction.date || '') }}
                    </span>
                  </div>
                  <div>
                    <span class="text-base-content/60">Betrag:</span><br>
                    <CurrencyDisplay
                      :amount="duplicate.existingTransaction.amount || 0"
                      class="font-mono"
                    />
                  </div>
                  <div>
                    <span class="text-base-content/60">Empfänger:</span><br>
                    <span class="font-mono text-xs">
                      {{ duplicate.existingTransaction.payee || '—' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-base-content/60">Typ:</span><br>
                    <span class="font-mono text-xs">
                      {{ duplicate.existingTransaction.type || '—' }}
                    </span>
                  </div>
                  <div>
                    <span class="text-base-content/60">Notizen:</span><br>
                    <span class="font-mono text-xs truncate">
                      {{ duplicate.existingTransaction.note || '—' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-action flex-shrink-0 mt-4">
        <button class="btn btn-ghost" @click="handleClose">
          Schließen
        </button>
        <button
          class="btn btn-warning"
          :disabled="selectedDuplicates.size === 0"
          @click="handleIgnoreSelected"
        >
          <Icon icon="mdi:eye-off" class="w-4 h-4" />
          Ausgewählte ignorieren ({{ selectedDuplicates.size }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Zusätzliche Styles für bessere Lesbarkeit bei kleinen Schriften */
.text-xs {
  line-height: 1.2;
}

.font-mono {
  font-family: 'Courier New', Courier, monospace;
}

/* Indeterminate Checkbox Style */
input[type="checkbox"]:indeterminate {
  background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M4 8h8'/%3e%3c/svg%3e");
}
</style>
