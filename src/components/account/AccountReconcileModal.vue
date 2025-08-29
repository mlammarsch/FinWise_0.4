<!-- Datei: src/components/account/AccountReconcileModal.vue -->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { Account, Transaction } from "@/types"; // Transaction hinzugefügt
import {
  formatCurrency,
  formatDate,
  toDateOnlyString,
} from "@/utils/formatters";
import { useReconciliationStore } from "@/stores/reconciliationStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { ReconciliationService } from "@/services/ReconciliationService";
import { AccountService } from "@/services/AccountService"; // neu
import DatePicker from "@/components/ui/DatePicker.vue";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import { debugLog } from "@/utils/logger";

/**
 * Pfad zur Komponente: src/components/account/AccountReconcileModal.vue
 * Modal zum Abgleich eines Kontos. Salden‑Berechnung nun über AccountService.
 *
 * Props:
 * - account: Account
 * - isOpen: boolean
 *
 * Emits:
 * - close
 * - reconciled
 */

const props = defineProps<{
  account: Account;
  isOpen: boolean;
}>();

const emit = defineEmits(["close", "reconciled"]);

// Debug-Log beim Erstellen der Komponente
debugLog("AccountReconcileModal", "Component created", {
  account: props.account,
  isOpen: props.isOpen,
});

const reconciliationStore = useReconciliationStore();
const transactionStore = useTransactionStore();
const reconciliationService = ReconciliationService;

const isProcessing = ref(false);
const dateInputRef = ref<InstanceType<typeof DatePicker> | null>(null);

// --- Two‑way bindings (Store <‑> Inputs) -------------------------------
const reconcileDate = computed({
  get: () => reconciliationStore.reconcileDate,
  set: (v) => (reconciliationStore.reconcileDate = v),
});
const actualBalance = computed({
  get: () => reconciliationStore.actualBalance,
  set: (v) => (reconciliationStore.actualBalance = v),
});
const note = computed({
  get: () => reconciliationStore.note,
  set: (v) => (reconciliationStore.note = v),
});

// --- Saldo‑ & Differenz‑Berechnung -------------------------------------
const currentBalance = computed(() =>
  props.account
    ? AccountService.getCurrentBalance(
        props.account.id,
        new Date(reconcileDate.value)
      )
    : 0
);

const difference = computed(() => actualBalance.value - currentBalance.value);

// Pending transactions
const hasPendingTransactions = computed(() => {
  if (!props.account) return false;
  const pending = transactionStore
    .getTransactionsByAccount(props.account.id)
    .filter((tx: Transaction) => !tx.reconciled); // Typ für tx hinzugefügt
  return pending.length > 0;
});

// --- Watchers ----------------------------------------------------------
watch(
  () => props.isOpen,
  (open) => {
    debugLog("AccountReconcileModal", "Watcher triggered", {
      open,
      account: props.account,
    });
    if (open) {
      isProcessing.value = false;
      // Reconciliation im Store starten
      debugLog(
        "AccountReconcileModal",
        "Starting reconciliation for account",
        props.account
      );
      reconciliationService.startReconciliation(props.account);
      nextTick(() => {
        const comp = dateInputRef.value as any;
        if (comp?.focus) comp.focus();
        else if (comp?.focusInput) comp.focusInput();
      });
    }
  }
);

// --- Actions -----------------------------------------------------------
async function performReconciliation() {
  debugLog("AccountReconcileModal", "performReconciliation called", {
    isProcessing: isProcessing.value,
    difference: difference.value,
    propsAccount: props.account, // Logge das Prop-Konto
  });

  if (isProcessing.value) return;
  // Die Prüfung auf difference === 0 wird im Button :disabled behandelt,
  // aber hier zur Sicherheit beibehalten, falls direkt aufgerufen.
  if (difference.value === 0 && !note.value) {
    // Erlaube Buchung bei Diff 0 wenn Notiz da
    debugLog(
      "AccountReconcileModal",
      "Difference is 0 and no note, nothing to do."
    );
    // Optional: closeModal() hier aufrufen, wenn keine Aktion gewünscht ist
    return;
  }

  isProcessing.value = true;
  try {
    // Übergebe props.account direkt an den Service
    const ok = await reconciliationService.reconcileAccount(props.account);
    if (ok) {
      emit("reconciled");
      reconciliationStore.reset(); // Store zurücksetzen nach erfolgreichem Abgleich
      closeModal(); // Schließt das Modal und ruft ggf. cancelReconciliation auf
    }
  } finally {
    isProcessing.value = false;
  }
}

function closeModal() {
  // Abbrechen nur, wenn keine Verarbeitung läuft
  if (!isProcessing.value) {
    reconciliationService.cancelReconciliation(); // ruft intern store.reset() auf
  }
  emit("close");
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal modal-open"
    @keydown.esc="closeModal"
  >
    <div class="modal-box max-w-lg relative">
      <button
        type="button"
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        @click="closeModal"
      >
        <Icon
          icon="mdi:close"
          class="text-lg"
        />
      </button>
      <h3 class="font-bold text-lg mb-4">
        Konto abgleichen: {{ account.name }}
      </h3>

      <form
        @submit.prevent="performReconciliation"
        class="space-y-4"
      >
        <!-- Datum -->
        <fieldset>
          <legend class="text-sm font-semibold mb-1">
            Datum <span class="text-error">*</span>
          </legend>
          <DatePicker
            ref="dateInputRef"
            v-model="reconcileDate"
            class="input input-bordered w-full"
          />
        </fieldset>

        <!-- Externer Kontostand -->
        <fieldset>
          <legend class="text-sm font-semibold mb-1">
            Externer Kontostand <span class="text-error">*</span>
          </legend>
          <CurrencyInput
            v-model="actualBalance"
            required
          />
        </fieldset>

        <!-- Zusammenfassung -->
        <div class="bg-base-200 p-3 rounded-md text-sm space-y-1">
          <div class="flex justify-between">
            <span>Aktueller Kontostand (App):</span>
            <span class="font-medium">
              <CurrencyDisplay
                :amount="currentBalance"
                :showZero="true"
              />
            </span>
          </div>
          <div class="flex justify-between border-t border-base-300 pt-1">
            <span>Differenz:</span>
            <span
              class="font-bold"
              :class="{
                'text-success': difference === 0,
                'text-error': difference !== 0,
              }"
            >
              <CurrencyDisplay
                :amount="difference"
                :showZero="true"
                :showSign="true"
              />
            </span>
          </div>
        </div>

        <!-- Notiz -->
        <fieldset v-if="difference !== 0">
          <legend class="text-sm font-semibold mb-1">Notiz</legend>
          <input
            type="text"
            v-model="note"
            class="input input-bordered w-full"
            placeholder="z.B. Korrektur Rundungsdifferenz"
          />
        </fieldset>

        <!-- Warnung offene Buchungen -->
        <div
          v-if="hasPendingTransactions"
          class="alert alert-warning alert-soft text-xs p-2 mt-4"
        >
          <Icon
            icon="mdi:alert-outline"
            class="text-lg"
          />
          <span
            >Es gibt noch nicht abgeglichene Transaktionen. Der
            "Aktuelle Kontostand (App)" enthält diese bereits.</span
          >
        </div>

        <!-- Aktionen -->
        <div class="modal-action mt-6">
          <button
            type="button"
            class="btn btn-ghost"
            @click="closeModal"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="difference === 0 || isProcessing"
          >
            <span
              v-if="isProcessing"
              class="loading loading-spinner loading-xs"
            />
            {{ difference === 0 ? "Abgeglichen" : "Ausgleich buchen" }}
          </button>
        </div>
      </form>
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="closeModal"
    />
  </div>
</template>
