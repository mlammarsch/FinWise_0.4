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
 *
 * Emits:
 * - close – Modal schließen
 * - transfer – Übertragung erfolgreich durchgeführt
 */
import { ref, computed, watch, onMounted, nextTick, withDefaults } from "vue";
import { toDateOnlyString } from "@/utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import { TransactionService } from "@/services/TransactionService";
import { BalanceService } from "@/services/BalanceService";

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
  }>(),
  {
    mode: "transfer",
  }
);

const emit = defineEmits(["close", "transfer"]);

const categoryStore = useCategoryStore();

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
  if (!props.month || !props.month.start || !props.month.end) return [];
  return TransactionService.getCategoryTransferOptions(
    normalizedMonthStart.value,
    normalizedMonthEnd.value
  );
});

const fromCategoryOptions = computed(() => {
  return categoryOptions.value.filter(
    (opt) => opt.id !== toCategoryIdLocal.value
  );
});

const toCategoryOptions = computed(() => {
  return categoryOptions.value.filter(
    (opt) => opt.id !== fromCategoryIdLocal.value
  );
});

const availableFromBalance = computed(() => {
  const selectedOption = categoryOptions.value.find(
    (opt) => opt.id === fromCategoryIdLocal.value
  );
  return selectedOption?.saldo ?? 0;
});

onMounted(() => {
  debugLog("[CategoryTransferModal] mounted - incoming props", { ...props });
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
          toCategoryIdLocal.value = "";
        } else if (props.mode === "fill" && props.preselectedCategoryId) {
          toCategoryIdLocal.value = props.preselectedCategoryId;
          const availableFundsCat = categoryStore.getAvailableFundsCategory();
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

      debugLog("[CategoryTransferModal] Initialized state", {
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

async function performTransfer() {
  if (
    !fromCategoryIdLocal.value ||
    !toCategoryIdLocal.value ||
    amount.value <= 0 ||
    !date.value ||
    isProcessing.value
  ) {
    debugLog("[CategoryTransferModal] Validation failed or processing", {
      from: fromCategoryIdLocal.value,
      to: toCategoryIdLocal.value,
      amount: amount.value,
      date: date.value,
    });
    return;
  }

  isProcessing.value = true;

  try {
    let success = false;
    if (props.transactionId && props.gegentransactionId) {
      debugLog("[CategoryTransferModal] Attempting to update transfer");
      success = await TransactionService.updateCategoryTransfer(
        props.transactionId,
        props.gegentransactionId,
        fromCategoryIdLocal.value,
        toCategoryIdLocal.value,
        amount.value,
        date.value,
        noteLocal.value
      );
    } else {
      debugLog("[CategoryTransferModal] Attempting to add transfer");
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
      debugLog("[CategoryTransferModal] Transfer successful");
      // Explizite Aktualisierung der Salden
      BalanceService.calculateMonthlyBalances();
      emit("transfer");
      emit("close");
    } else {
      debugLog("[CategoryTransferModal] Transfer failed");
    }
  } catch (error) {
    debugLog("[CategoryTransferModal] Error during transfer:", error);
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="modal modal-open"
    tabindex="0"
    @keydown.escape="$emit('close')"
  >
    <div class="modal-box w-full max-w-lg">
      <h3 class="font-bold text-lg mb-4 flex items-center">
        <Icon icon="mdi:swap-horizontal-bold" class="mr-2 text-xl" />
        <template v-if="transactionId">Kategorietransfer bearbeiten</template>
        <template v-else-if="mode === 'fill'">
          Fülle
          <span class="font-semibold mx-1">{{
            categoryStore.getCategoryById(toCategoryIdLocal)?.name || "..."
          }}</span>
          auf von...
        </template>
        <template v-else>
          Transferiere von
          <span class="font-semibold mx-1">{{
            categoryStore.getCategoryById(fromCategoryIdLocal)?.name || "..."
          }}</span>
          zu...
        </template>
      </h3>

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
          <label class="label" v-if="fromCategoryIdLocal">
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
          <button type="button" class="btn btn-ghost" @click="$emit('close')">
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="isProcessing"
          >
            <span
              v-if="isProcessing"
              class="loading loading-spinner loading-xs"
            ></span>
            {{ transactionId ? "Speichern" : "Übertragen" }}
          </button>
        </div>
      </form>
    </div>
    <div class="modal-backdrop bg-black/30" @click="$emit('close')"></div>
  </div>
</template>

<style scoped>
/* Keine zusätzlichen Styles */
</style>
