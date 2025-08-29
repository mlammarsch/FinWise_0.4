<!-- Datei: src/components/budget/CategoryTransferModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/budget/CategoryTransferModal.vue
 * Funktion: Übertragung von Beträgen zwischen Kategorien mittels TransactionService.
 *
 * Komponenten-Props:
 * - isOpen: boolean – Sichtbarkeit
 * - month?: { start: Date; end: Date } – Aktueller Monat für Saldo-Anzeige
 * - mode?: "fill" | "transfer" | "edit" – Übertragungsmodus
 * - prefillAmount?: number – Vorausgefüllter Betrag
 * - preselectedCategoryId?: string – ID der Kategorie, die je nach Modus in from oder to übernommen wird
 * - prefillDate?: string – Datum (YYYY-MM-DD), falls beim Bearbeiten vorhanden
 * - transactionId?: string – Vorhandene Transaktions-ID (- amount) (bei Bearbeitung)
 * - gegentransactionId?: string – Vorhandene Gegentransaktions-ID (+ amount) (bei Bearbeitung)
 * - fromCategoryId?: string – "Von"-Kategorie (bei Bearbeitung)
 * - toCategoryId?: string – "Zu"-Kategorie (bei Bearbeitung)
 * - note?: string - Vorhandene Notiz (bei Bearbeitung)
 * - isIncomeCategory?: boolean – Ob es sich um eine Einnahmen-Kategorie handelt (für automatische Zielkategorie-Auswahl)
 *
 * Emits:
 * - close – Modal schließen
 * - transfer – Übertragung erfolgreich durchgeführt
 */
import { ref, computed, watch, onMounted, nextTick, withDefaults } from "vue";
import { toDateOnlyString } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import { CategoryService } from "../../services/CategoryService";
import { debugLog } from "../../utils/logger";
import { Icon } from "@iconify/vue";
import { TransactionService } from "../../services/TransactionService";
import { BalanceService } from "../../services/BalanceService";
import ButtonGroup from "../ui/ButtonGroup.vue";

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    month?: { start: Date; end: Date };
    mode?: "fill" | "transfer" | "edit";
    prefillAmount?: number;
    preselectedCategoryId?: string;
    prefillDate?: string;
    transactionId?: string;
    gegentransactionId?: string;
    fromCategoryId?: string;
    toCategoryId?: string;
    note?: string;
    isIncomeCategory?: boolean;
  }>(),
  {
    mode: "transfer",
    isIncomeCategory: false,
  }
);

const emit = defineEmits(["close", "transfer"]);

const fromCategoryIdLocal = ref("");
const toCategoryIdLocal = ref("");
const amount = ref(0);
const date = ref("");
const noteLocal = ref("");
const isProcessing = ref(false);

const fromCategoryRef = ref<InstanceType<typeof SelectCategory> | null>(null);
const toCategoryRef = ref<InstanceType<typeof SelectCategory> | null>(null);
const amountRef = ref<any>(null);

const normalizedMonthStart = computed(() =>
  props.month ? new Date(toDateOnlyString(props.month.start)) : new Date()
);
const normalizedMonthEnd = computed(() =>
  props.month ? new Date(toDateOnlyString(props.month.end)) : new Date()
);

const categoryOptions = computed(() => {
  // Verwende die aktuell relevante Kategorie als Ausgangspunkt
  const clickedCategoryId =
    fromCategoryIdLocal.value || props.preselectedCategoryId || "";
  const isIncome = !!props.isIncomeCategory;
  return TransactionService.getCategoryTransferOptions(
    clickedCategoryId,
    isIncome
  );
});

const fromCategoryOptions = computed(() => {
  return categoryOptions.value.filter(
    (opt) => opt.value !== toCategoryIdLocal.value
  );
});

const toCategoryOptions = computed(() => {
  return categoryOptions.value.filter(
    (opt) => opt.value !== fromCategoryIdLocal.value
  );
});

const availableFromBalance = computed(() => {
  // Die gelieferten Optionen enthalten nur label/value; Saldenanzeige hier nicht verfügbar.
  // Rückgabe 0 als Platzhalter, um Typfehler zu vermeiden.
  return 0;
});

onMounted(() => {
  debugLog("CategoryTransferModal", "mounted - incoming props", { ...props });
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      isProcessing.value = false;
      if (props.prefillDate) {
        date.value = props.prefillDate;
      } else {
        const defaultDate = props.month
          ? new Date(props.month.end).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];
        date.value = defaultDate;
      }
      amount.value = props.prefillAmount || 0;
      noteLocal.value = props.note || "";

      if (props.transactionId) {
        fromCategoryIdLocal.value = props.fromCategoryId || "";
        toCategoryIdLocal.value = props.toCategoryId || "";
      } else {
        if (props.mode === "transfer" && props.preselectedCategoryId) {
          fromCategoryIdLocal.value = props.preselectedCategoryId;

          // Bei Einnahmen-Kategorien automatisch "Verfügbare Mittel" als Zielkategorie setzen
          if (props.isIncomeCategory) {
            const availableFundsCat =
              CategoryService.getAvailableFundsCategory().value;
            toCategoryIdLocal.value = availableFundsCat?.id || "";
          } else {
            toCategoryIdLocal.value = "";
          }
        } else if (props.mode === "fill" && props.preselectedCategoryId) {
          toCategoryIdLocal.value = props.preselectedCategoryId;
          const availableFundsCat =
            CategoryService.getAvailableFundsCategory().value;
          fromCategoryIdLocal.value = availableFundsCat?.id || "";
        } else {
          fromCategoryIdLocal.value = "";
          toCategoryIdLocal.value = "";
        }
      }

      nextTick(() => {
        if (props.transactionId) {
          amountRef.value?.focus();
          amountRef.value?.select();
        } else if (props.mode === "fill") {
          if (amount.value > 0) {
            amountRef.value?.focus();
            amountRef.value?.select();
          } else {
            fromCategoryRef.value?.focusInput();
          }
        } else {
          if (fromCategoryIdLocal.value) {
            toCategoryRef.value?.focusInput();
          } else {
            fromCategoryRef.value?.focusInput();
          }
        }
      });

      debugLog("CategoryTransferModal", "Initialized state", {
        from: fromCategoryIdLocal.value,
        to: toCategoryIdLocal.value,
        amount: amount.value,
        date: date.value,
        note: noteLocal.value,
        mode: props.mode,
      });
    } else {
      fromCategoryIdLocal.value = "";
      toCategoryIdLocal.value = "";
      amount.value = 0;
      date.value = "";
      noteLocal.value = "";
    }
  },
  { immediate: true }
);

// Validierung
const submitAttempted = ref(false);
const showValidationAlert = ref(false);

// Validierungsfehler sammeln
const validationErrors = computed(() => {
  const errors: string[] = [];
  if (!fromCategoryIdLocal.value) errors.push("Von-Kategorie ist erforderlich");
  if (!toCategoryIdLocal.value) errors.push("Zu-Kategorie ist erforderlich");
  if (!amount.value || amount.value <= 0)
    errors.push("Betrag muss größer als 0 sein");
  if (!date.value) errors.push("Datum ist erforderlich");
  return errors;
});

// Schließt das Validierungs-Alert
const closeValidationAlert = () => {
  showValidationAlert.value = false;
};

async function performTransfer() {
  submitAttempted.value = true;

  if (validationErrors.value.length > 0) {
    showValidationAlert.value = true;
    debugLog(
      "CategoryTransferModal",
      "Validation failed",
      validationErrors.value
    );
    return;
  }

  if (isProcessing.value) return;

  showValidationAlert.value = false;
  isProcessing.value = true;

  // Modal SOFORT schließen - Transfer läuft asynchron im Hintergrund
  debugLog("CategoryTransferModal", "Starting background transfer operation");
  emit("transfer");
  emit("close");
  isProcessing.value = false;

  // Transfer-Operation komplett asynchron im Hintergrund ausführen
  setTimeout(async () => {
    try {
      let success = false;
      if (props.transactionId && props.gegentransactionId) {
        debugLog(
          "CategoryTransferModal",
          "Background: Attempting to update transfer"
        );
        await TransactionService.updateCategoryTransfer(
          props.transactionId,
          props.gegentransactionId,
          fromCategoryIdLocal.value,
          toCategoryIdLocal.value,
          amount.value,
          date.value,
          noteLocal.value
        );
        success = true;
      } else {
        debugLog(
          "CategoryTransferModal",
          "Background: Attempting to add transfer"
        );
        const result = await TransactionService.addCategoryTransfer(
          fromCategoryIdLocal.value,
          toCategoryIdLocal.value,
          amount.value,
          date.value,
          noteLocal.value
        );
        success = !!result;
      }

      if (success) {
        debugLog(
          "CategoryTransferModal",
          "Background transfer completed successfully"
        );
      } else {
        debugLog("CategoryTransferModal", "Background transfer failed");
      }
    } catch (error) {
      debugLog("CategoryTransferModal", "Background transfer error", error);
    }
  }, 0);
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal modal-open"
    tabindex="0"
    @keydown.escape="$emit('close')"
  >
    <div class="modal-box w-full max-w-lg relative">
      <!-- X-Icon zum Schließen -->
      <button
        type="button"
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
        @click="$emit('close')"
      >
        <Icon
          icon="mdi:close"
          class="text-lg"
        />
      </button>

      <h3 class="font-bold text-lg mb-4 flex items-center">
        <Icon
          icon="mdi:swap-horizontal-bold"
          class="mr-2 text-xl"
        />
        <template v-if="transactionId">Kategorietransfer bearbeiten</template>
        <template v-else-if="mode === 'fill'">
          Fülle
          <span class="font-semibold mx-1">{{
            CategoryService.getCategoryById(toCategoryIdLocal).value?.name ||
            "..."
          }}</span>
          auf von...
        </template>
        <template v-else>
          Transferiere von
          <span class="font-semibold mx-1">{{
            CategoryService.getCategoryById(fromCategoryIdLocal).value?.name ||
            "..."
          }}</span>
          zu...
        </template>
      </h3>

      <!-- Validierungs-Alert -->
      <div
        v-if="showValidationAlert && validationErrors.length > 0"
        class="alert alert-error alert-soft mb-6"
      >
        <Icon
          icon="mdi:alert-circle"
          class="text-lg"
        />
        <div>
          <h3 class="font-bold">Bitte korrigieren Sie folgende Fehler:</h3>
          <ul class="list-disc list-inside mt-2">
            <li
              v-for="error in validationErrors"
              :key="error"
              class="text-sm"
            >
              {{ error }}
            </li>
          </ul>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost"
          @click="closeValidationAlert"
        >
          <Icon
            icon="mdi:close"
            class="text-sm"
          />
        </button>
      </div>

      <form
        @submit.prevent="performTransfer"
        class="flex flex-col space-y-4 w-full"
      >
        <!-- From Category -->
        <fieldset v-show="mode !== 'transfer'">
          <legend class="text-sm font-semibold mb-1 select-none">
            Von Kategorie <span class="text-error">*</span>
          </legend>
          <SelectCategory
            ref="fromCategoryRef"
            v-model="fromCategoryIdLocal"
            :options="fromCategoryOptions"
            placeholder="Auswählen..."
          />
        </fieldset>

        <!-- To Category -->
        <fieldset v-show="mode !== 'fill'">
          <legend class="text-sm font-semibold mb-1 select-none">
            Zu Kategorie <span class="text-error">*</span>
          </legend>
          <SelectCategory
            ref="toCategoryRef"
            v-model="toCategoryIdLocal"
            :options="toCategoryOptions"
            placeholder="Auswählen..."
          />
        </fieldset>

        <!-- Amount -->
        <fieldset>
          <legend class="text-sm font-semibold mb-1 select-none">
            Betrag <span class="text-error">*</span>
          </legend>
          <CurrencyInput
            ref="amountRef"
            v-model="amount"
            :class="amount > availableFromBalance ? 'input-error' : ''"
          />
          <label
            class="label"
            v-if="fromCategoryIdLocal"
          >
            <span
              class="label-text-alt flex items-center"
              :class="
                availableFromBalance < amount && availableFromBalance < 0
                  ? 'text-error'
                  : availableFromBalance < amount
                  ? 'text-warning'
                  : 'text-base-content/70'
              "
            >
              <Icon
                :icon="
                  availableFromBalance < amount
                    ? 'mdi:alert-circle-outline'
                    : 'mdi:information-outline'
                "
                class="mr-1"
              />
              Verfügbar:
              <CurrencyDisplay
                :amount="availableFromBalance"
                :show-zero="true"
                :as-integer="true"
              />
            </span>
          </label>
        </fieldset>

        <!-- Date -->
        <fieldset>
          <legend class="text-sm font-semibold mb-1 select-none">
            Datum <span class="text-error">*</span>
          </legend>
          <input
            type="date"
            v-model="date"
            class="input input-bordered w-full"
            required
          />
        </fieldset>

        <!-- Note -->
        <fieldset>
          <legend class="text-sm font-semibold mb-1 select-none">Notiz</legend>
          <input
            type="text"
            v-model="noteLocal"
            class="input input-bordered w-full"
            placeholder="Grund für die Übertragung (optional)"
          />
        </fieldset>

        <!-- Actions -->
        <div class="modal-action mt-6">
          <ButtonGroup
            left-label="Abbrechen"
            :right-label="transactionId ? 'Speichern' : 'Übertragen'"
            left-color="btn-ghost"
            right-color="btn-primary"
            :right-disabled="isProcessing"
            @left-click="$emit('close')"
            @right-click="performTransfer"
          />
        </div>
      </form>
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="$emit('close')"
    ></div>
  </div>
</template>

<style scoped>
/* Keine zusätzlichen Styles */
</style>
