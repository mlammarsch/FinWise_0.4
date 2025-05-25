<!-- Datei: src/components/planning/PlanningTransactionForm.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/planning/PlanningTransactionForm.vue
 * Formular zum Erstellen und Bearbeiten von geplanten Transaktionen.
 *
 * Komponenten-Props:
 * - transaction?: PlanningTransaction - Optional: Zu bearbeitende Transaktion
 * - isEdit?: boolean - Optional: Zeigt an, ob es sich um eine Bearbeitung handelt
 *
 * Emits:
 * - save: Übermittelt die Daten der gespeicherten Transaktion
 * - cancel: Wird bei Abbruch ausgelöst
 */
import { ref, computed, onMounted, watch, nextTick } from "vue";
import {
  PlanningTransaction,
  RecurrencePattern,
  TransactionType,
  AmountType,
  RecurrenceEndType,
  WeekendHandlingType,
  RuleConditionType,
  RuleActionType,
} from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useRuleStore } from "@/stores/ruleStore";
import RuleForm from "@/components/rules/RuleForm.vue";
import dayjs from "dayjs";
import SelectAccount from "../ui/SelectAccount.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import SelectRecipient from "../ui/SelectRecipient.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import TagSearchableDropdown from "../ui/TagSearchableDropdown.vue";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import { formatDate } from "@/utils/formatters";
import {
  getDayOfWeekName,
  createRecurrenceDescription,
  calculateUpcomingDates,
} from "@/utils/dateUtils";
import {
  formatTransactionForSave,
  getInitialRuleValues,
} from "@/utils/planningTransactionUtils";

const props = defineProps<{
  transaction?: PlanningTransaction;
  isEdit?: boolean;
}>();

const emit = defineEmits(["save", "cancel"]);

const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const ruleStore = useRuleStore();

// Formular-Refs
const planningFormRef = ref<HTMLFormElement | null>(null);

// Grundlegende Informationen
const name = ref("");
const note = ref("");
const amount = ref(0);
const amountType = ref<AmountType>(AmountType.EXACT);
const approximateAmount = ref(0);
const minAmount = ref(0);
const maxAmount = ref(0);
const startDate = ref(dayjs().format("YYYY-MM-DD"));
const valueDate = ref(startDate.value);
const valueDateManuallyChanged = ref(false);
const accountId = ref("");
const categoryId = ref<string | null>(null); // Holds category für Expense/Income, OR target category für CategoryTransfer
const fromCategoryId = ref<string | null>(null); // Holds source category für CategoryTransfer
const tagIds = ref<string[]>([]);
const recipientId = ref<string | null>(null);
const transactionType = ref<TransactionType>(TransactionType.EXPENSE);
const toAccountId = ref("");

// Validierungsstatus
const formAttempted = ref(false);

// Tab-Management
const activeTab = ref("categorization");

// Wiederholungseinstellungen
const repeatsEnabled = ref(false);
const recurrencePattern = ref<RecurrencePattern>(RecurrencePattern.MONTHLY);
const recurrenceEndType = ref<RecurrenceEndType>(RecurrenceEndType.NEVER);
const recurrenceCount = ref(12);
const endDate = ref<string | null>(null);
const executionDay = ref<number | null>(null);
const weekendHandling = ref<WeekendHandlingType>(WeekendHandlingType.NONE);
const moveScheduleEnabled = ref(false);
const weekendHandlingDirection = ref<"before" | "after">("after");

// Prognosebuchung und Aktivitätsstatus
const forecastOnly = ref(false);
const isActive = ref(true);

// Regel-Modal
const showRuleCreationModal = ref(false);

// Berechnete Felder
const dateDescription = ref("");
const upcomingDates = ref<Array<{ date: string; day: string }>>([]);

// Computed Properties
const isExpense = computed(
  () => transactionType.value === TransactionType.EXPENSE
);
const isIncome = computed(
  () => transactionType.value === TransactionType.INCOME
);
const isAccountTransfer = computed(
  () => transactionType.value === TransactionType.ACCOUNTTRANSFER
);
const isCategoryTransfer = computed(
  () => transactionType.value === TransactionType.CATEGORYTRANSFER
);

const accounts = computed(() => accountStore.activeAccounts);
const categories = computed(() => categoryStore.activeCategories);

const filteredAccounts = computed(() =>
  (accounts.value || []).filter((acc) => acc.id !== accountId.value)
);
const filteredCategories = computed(() =>
  (categories.value || []).filter((cat) => cat.id !== fromCategoryId.value)
);

const isNameValid = computed(() => !!name.value?.trim());
const isAmountValid = computed(
  () => typeof amount.value === "number" && amount.value !== 0
);
const isStartDateValid = computed(() => !!startDate.value);
const isValueDateValid = computed(() => !!valueDate.value);

const isAccountIdRequired = computed(
  () => isExpense.value || isIncome.value || isAccountTransfer.value
);
const isAccountIdValid = computed(
  () => !isAccountIdRequired.value || !!accountId.value
);

const isCategoryIdRequired = computed(() => isExpense.value || isIncome.value);
const isCategoryIdValid = computed(
  () => !isCategoryIdRequired.value || !!categoryId.value
);

// Empfänger ist nicht mehr Pflichtfeld
const isRecipientIdRequired = computed(() => false);
const isRecipientIdValid = computed(() => true);

const isToAccountIdRequired = computed(() => isAccountTransfer.value);
const isToAccountIdValid = computed(
  () => !isToAccountIdRequired.value || !!toAccountId.value
);

const isFromCategoryIdRequired = computed(() => isCategoryTransfer.value);
const isFromCategoryIdValid = computed(
  () => !isFromCategoryIdRequired.value || !!fromCategoryId.value
);

const isTargetCategoryIdRequired = computed(() => isCategoryTransfer.value);
const isTargetCategoryIdValid = computed(
  () => !isTargetCategoryIdRequired.value || !!categoryId.value
);

const isFormValid = computed(() => {
  return (
    isNameValid.value &&
    isAmountValid.value &&
    isStartDateValid.value &&
    isValueDateValid.value &&
    isAccountIdValid.value &&
    isCategoryIdValid.value &&
    isRecipientIdValid.value &&
    isToAccountIdValid.value &&
    isFromCategoryIdValid.value &&
    isTargetCategoryIdValid.value
  );
});

// Lifecycle
onMounted(() => {
  loadTransactionData();
  updateDateDescription();
  calculateUpcomingDatesWrapper();
  formAttempted.value = false;
});

// Watchers (Datum, Typ, Betr, Transfers)
watch(startDate, (newDate) => {
  if (!valueDateManuallyChanged.value) valueDate.value = newDate;
  if (formAttempted.value) isStartDateValid.value;
});
watch(valueDate, (val) => {
  valueDateManuallyChanged.value = val !== startDate.value;
  if (formAttempted.value) isValueDateValid.value;
});
watch(
  [
    startDate,
    recurrencePattern,
    repeatsEnabled,
    executionDay,
    moveScheduleEnabled,
    weekendHandlingDirection,
    recurrenceEndType,
    recurrenceCount,
    endDate,
  ],
  () => {
    updateDateDescription();
    calculateUpcomingDatesWrapper();
  },
  { deep: true }
);
watch(transactionType, (newType, oldType) => {
  debugLog(`Transaction type changed FROM ${oldType} TO ${newType}`);
  if (newType !== oldType) {
    // Reset fields
    if (
      oldType === TransactionType.CATEGORYTRANSFER ||
      newType !== TransactionType.CATEGORYTRANSFER
    ) {
      debugLog("Clearing fromCategoryId");
      fromCategoryId.value = null;
      if (
        newType !== TransactionType.EXPENSE &&
        newType !== TransactionType.INCOME &&
        newType !== TransactionType.CATEGORYTRANSFER
      ) {
        categoryId.value = null;
      } else if (newType === TransactionType.CATEGORYTRANSFER) {
        categoryId.value = null;
      }
    }
    if (
      oldType === TransactionType.ACCOUNTTRANSFER ||
      newType !== TransactionType.ACCOUNTTRANSFER
    ) {
      toAccountId.value = "";
    }
  }
  // Amount sign adjustment
  let effectiveAmount = amount.value;
  if (
    newType === TransactionType.ACCOUNTTRANSFER ||
    newType === TransactionType.CATEGORYTRANSFER
  ) {
    amount.value = Math.abs(effectiveAmount);
  } else if (newType === TransactionType.EXPENSE && effectiveAmount >= 0) {
    amount.value = -Math.abs(effectiveAmount);
  } else if (newType === TransactionType.INCOME && effectiveAmount <= 0) {
    amount.value = Math.abs(effectiveAmount);
  }
  debugLog(`Amount after type change: ${amount.value}`);
  if (formAttempted.value) nextTick(isAmountValid.value);
});
watch(amount, (newAmt) => {
  if (!isAccountTransfer.value && !isCategoryTransfer.value) {
    if (newAmt < 0 && transactionType.value !== TransactionType.EXPENSE) {
      transactionType.value = TransactionType.EXPENSE;
    } else if (newAmt > 0 && transactionType.value !== TransactionType.INCOME) {
      transactionType.value = TransactionType.INCOME;
    }
  }
  if (formAttempted.value) isAmountValid.value;
});
watch(fromCategoryId, (newId) => {
  if (isCategoryTransfer.value && newId === categoryId.value) {
    categoryId.value = null;
  }
  if (formAttempted.value) isFromCategoryIdValid.value;
});
watch(categoryId, (newId) => {
  if (isCategoryTransfer.value && newId === fromCategoryId.value) {
    fromCategoryId.value = null;
  }
  if (formAttempted.value) {
    isCategoryIdValid.value;
    isTargetCategoryIdValid.value;
  }
});
watch(accountId, (newId) => {
  if (isAccountTransfer.value && newId === toAccountId.value) {
    toAccountId.value = "";
  }
  if (formAttempted.value) isAccountIdValid.value;
});
watch(toAccountId, (newId) => {
  if (isAccountTransfer.value && newId === accountId.value) {
    accountId.value = "";
  }
  if (formAttempted.value) isToAccountIdValid.value;
});
watch(name, () => {
  if (formAttempted.value) isNameValid.value;
});
watch(recipientId, () => {
  if (formAttempted.value) isRecipientIdValid.value;
});

// Methoden

/**
 * Lädt Daten in das Formular.
 */
function loadTransactionData() {
  if (props.transaction) {
    const tx = props.transaction;
    name.value = tx.name || "";
    note.value = tx.note || "";
    amountType.value = tx.amountType || AmountType.EXACT;
    approximateAmount.value = tx.approximateAmount || 0;
    minAmount.value = tx.minAmount || 0;
    maxAmount.value = tx.maxAmount || 0;
    startDate.value = tx.startDate;
    valueDate.value = tx.valueDate || tx.startDate;
    valueDateManuallyChanged.value = valueDate.value !== startDate.value;
    accountId.value = tx.accountId;
    tagIds.value = tx.tagIds || [];
    recipientId.value = tx.recipientId || null;
    forecastOnly.value = tx.forecastOnly || false;
    isActive.value = tx.isActive !== undefined ? tx.isActive : true;

    repeatsEnabled.value = tx.recurrencePattern !== RecurrencePattern.ONCE;
    recurrencePattern.value = tx.recurrencePattern;
    recurrenceEndType.value = tx.recurrenceEndType || RecurrenceEndType.NEVER;
    recurrenceCount.value = tx.recurrenceCount || 12;
    endDate.value = tx.endDate || null;
    executionDay.value = tx.executionDay || null;

    weekendHandling.value = tx.weekendHandling || WeekendHandlingType.NONE;
    moveScheduleEnabled.value =
      weekendHandling.value !== WeekendHandlingType.NONE;
    weekendHandlingDirection.value =
      weekendHandling.value === WeekendHandlingType.BEFORE ? "before" : "after";

    transactionType.value =
      tx.transactionType ||
      (tx.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME);
    amount.value = tx.amount;

    if (transactionType.value === TransactionType.ACCOUNTTRANSFER) {
      toAccountId.value = tx.transferToAccountId || "";
      categoryId.value = null;
      fromCategoryId.value = null;
      amount.value = Math.abs(tx.amount);
    } else if (transactionType.value === TransactionType.CATEGORYTRANSFER) {
      fromCategoryId.value = tx.categoryId;
      categoryId.value = tx.transferToCategoryId || null;
      toAccountId.value = "";
      amount.value = Math.abs(tx.amount);
    } else {
      categoryId.value = tx.categoryId;
      fromCategoryId.value = null;
      toAccountId.value = "";
    }
  } else {
    if (accountStore.activeAccounts.length > 0) {
      accountId.value = accountStore.activeAccounts[0].id;
    }
    valueDate.value = startDate.value;
    valueDateManuallyChanged.value = false;
    transactionType.value = TransactionType.EXPENSE;
    amount.value = 0;
    categoryId.value = null;
    fromCategoryId.value = null;
    toAccountId.value = "";
    recipientId.value = null;
  }
}

/**
 * Aktualisiert Textbeschreibung des Musters.
 */
function updateDateDescription() {
  dateDescription.value = createRecurrenceDescription({
    startDate: startDate.value,
    repeatsEnabled: repeatsEnabled.value,
    recurrencePattern: recurrencePattern.value,
    executionDay: executionDay.value,
    moveScheduleEnabled: moveScheduleEnabled.value,
    weekendHandlingDirection: weekendHandlingDirection.value,
  });
}

/**
 * Berechnet nächste Ausführungstermine.
 */
function calculateUpcomingDatesWrapper() {
  upcomingDates.value = calculateUpcomingDates({
    startDate: startDate.value,
    repeatsEnabled: repeatsEnabled.value,
    recurrencePattern: recurrencePattern.value,
    recurrenceEndType: recurrenceEndType.value,
    endDate: endDate.value,
    recurrenceCount: recurrenceCount.value,
    executionDay: executionDay.value,
    moveScheduleEnabled: moveScheduleEnabled.value,
    weekendHandlingDirection: weekendHandlingDirection.value,
  });
}

/**
 * Neuer Empfänger erstellen.
 */
function onCreateRecipient(data: { name: string }) {
  const created = recipientStore.addRecipient({ name: data.name });
  recipientId.value = created.id;
  debugLog("[PlanningTransactionForm] onCreateRecipient", created);
}

/**
 * Validiert Formular.
 */
function validateForm(): boolean {
  formAttempted.value = true;
  const valid = isFormValid.value;
  if (!valid) {
    debugLog("[PlanningTransactionForm] Validation failed.");
    nextTick(() => {
      const firstError = planningFormRef.value?.querySelector(
        '.input-bordered:invalid, .select-bordered:invalid, .validator-hint.text-error:not([style*="display: none"])'
      );
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
  return valid;
}

/**
 * Speichert Planungstransaktion.
 */
function savePlanningTransaction() {
  if (!validateForm()) return;

  const weekendHandlingValue = moveScheduleEnabled.value
    ? weekendHandlingDirection.value === "before"
      ? WeekendHandlingType.BEFORE
      : WeekendHandlingType.AFTER
    : WeekendHandlingType.NONE;

  const effectiveRecurrencePattern = repeatsEnabled.value
    ? recurrencePattern.value
    : RecurrencePattern.ONCE;

  const effectiveRecurrenceEndType = repeatsEnabled.value
    ? recurrenceEndType.value
    : RecurrenceEndType.NEVER;

  const effectiveRecurrenceCount =
    repeatsEnabled.value &&
    effectiveRecurrenceEndType === RecurrenceEndType.COUNT
      ? recurrenceCount.value
      : null;

  const effectiveEndDate =
    repeatsEnabled.value &&
    effectiveRecurrenceEndType === RecurrenceEndType.DATE
      ? endDate.value
      : null;

  // Basis-Daten für alle Transaktionstypen
  let finalData = {
    name: name.value,
    tagIds: tagIds.value,
    amount: amount.value,
    amountType: amountType.value,
    approximateAmount: approximateAmount.value,
    minAmount: minAmount.value,
    maxAmount: maxAmount.value,
    note: note.value,
    startDate: startDate.value,
    valueDate: valueDate.value,
    endDate: endDate.value,
    recurrencePattern: recurrencePattern.value,
    recurrenceEndType: recurrenceEndType.value,
    recurrenceCount: recurrenceCount.value,
    executionDay: executionDay.value,
    weekendHandling: weekendHandling.value,
    isActive: isActive.value,
    forecastOnly: forecastOnly.value,
    repeatsEnabled: repeatsEnabled.value,
    transactionType: transactionType.value,
  };

  // Je nach Transaktionstyp zusätzliche Felder setzen
  if (isExpense.value || isIncome.value) {
    finalData = {
      ...finalData,
      accountId: accountId.value,
      categoryId: categoryId.value,
      recipientId: recipientId.value,
      transferToAccountId: null,
      transferToCategoryId: null,
    };
  } else if (isAccountTransfer.value) {
    finalData = {
      ...finalData,
      accountId: accountId.value,
      transferToAccountId: toAccountId.value,
      categoryId: null,
      transferToCategoryId: null,
      recipientId: null,
    };
  } else if (isCategoryTransfer.value) {
    finalData = {
      ...finalData,
      categoryId: fromCategoryId.value,
      transferToCategoryId: categoryId.value,
      accountId: null,
      transferToAccountId: null,
      recipientId: null,
    };
  }

  debugLog("[PlanningTransactionForm] Final data for save:", finalData);
  emit("save", finalData);
}

/**
 * Initialisiert neue Regel-Werte.
 */
function getInitialRuleValuesForForm() {
  const recipientName =
    recipientStore.getRecipientById(recipientId.value || "")?.name || "";

  return getInitialRuleValues({
    name: name.value,
    recipientName,
    accountId: accountId.value,
    amount: amount.value,
    categoryId: categoryId.value,
    fromCategoryId: fromCategoryId.value,
  });
}

/**
 * Speichert Regel und schließt Modal.
 */
function saveRuleAndCloseModal(ruleData: any) {
  ruleStore.addRule(ruleData);
  debugLog("[PlanningTransactionForm] Created rule from planning", ruleData);
  showRuleCreationModal.value = false;
  alert(`Regel "${ruleData.name}" wurde erfolgreich erstellt.`);
}
</script>

<template>
  <form
    ref="planningFormRef"
    @submit.prevent="savePlanningTransaction"
    class="space-y-6"
    novalidate
  >
    <!-- ALLGEMEIN -->
    <div class="space-y-4">
      <fieldset class="fieldset flex justify-between gap-4">
        <div><legend class="fieldset-legend">Transaktionstyp</legend></div>
        <div class="flex flex-wrap justify-center gap-4 pt-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-error/60 checked:text-error checked:border-error"
              v-model="transactionType"
              :value="TransactionType.EXPENSE"
            />
            <span class="text-sm">Ausgabe</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-success/60 checked:text-success checked:border-success"
              v-model="transactionType"
              :value="TransactionType.INCOME"
            />
            <span class="text-sm">Einnahme</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-warning/60 checked:text-warning checked:border-warning"
              v-model="transactionType"
              :value="TransactionType.ACCOUNTTRANSFER"
            />
            <span class="text-sm">Kontotransfer</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-warning/60 checked:text-warning checked:border-warning"
              v-model="transactionType"
              :value="TransactionType.CATEGORYTRANSFER"
            />
            <span class="text-sm">Kategorietransfer</span>
          </label>
        </div>
      </fieldset>
      <div class="divider"></div>
      <div class="flex gap-4 items-end">
        <div class="w-full">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Name<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <input
                type="text"
                v-model="name"
                class="input input-bordered"
                :class="{ 'input-error': formAttempted && !isNameValid }"
                required
                placeholder="z.B. Schornsteinfeger, Miete, Gehalt"
                aria-describedby="name-validation"
              />
              <div
                id="name-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isNameValid"
              >
                Name darf nicht leer sein.
              </div>
            </div>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Notizen</legend>
            <div class="form-control">
              <textarea
                v-model="note"
                class="textarea textarea-bordered w-full"
                placeholder="Zusätzliche Informationen"
              ></textarea>
            </div>
          </fieldset>
        </div>
        <div class="w-full">
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Betrag<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <div class="flex flex-col space-y-3">
                <div class="input-group flex items-center gap-2">
                  <CurrencyInput
                    v-model="amount"
                    :class="{ 'input-error': formAttempted && !isAmountValid }"
                    aria-describedby="amount-validation"
                    required
                  />
                  <span>€</span>
                </div>
                <div
                  id="amount-validation"
                  class="validator-hint text-error mt-1"
                  v-if="formAttempted && !isAmountValid"
                >
                  Betrag muss eine gültige Zahl sein.
                </div>
                <div class="flex items-center space-x-3">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      class="radio radio-sm"
                      :value="AmountType.EXACT"
                      v-model="amountType"
                    />
                    <span class="text-sm">Exakt</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      class="radio radio-sm"
                      :value="AmountType.APPROXIMATE"
                      v-model="amountType"
                    />
                    <span class="text-sm">Ungefähr</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      class="radio radio-sm"
                      :value="AmountType.RANGE"
                      v-model="amountType"
                    />
                    <span class="text-sm">Bereich</span>
                  </label>
                </div>
                <div
                  v-if="amountType === AmountType.APPROXIMATE"
                  class="form-control"
                >
                  <label class="label pt-0 pb-1">
                    <span class="label-text">Schwankung</span>
                  </label>
                  <div
                    class="input-group border border-base-content/20 rounded-lg focus-within:border-primary"
                  >
                    <span class="pl-3">±</span>
                    <CurrencyInput
                      v-model="approximateAmount"
                      borderless
                      hide-error-message
                    />
                    <span class="pr-3">€</span>
                  </div>
                </div>
                <div
                  v-if="amountType === AmountType.RANGE"
                  class="grid grid-cols-2 gap-2"
                >
                  <div class="form-control">
                    <label class="label pt-0 pb-1">
                      <span class="label-text">Min. Betrag</span>
                    </label>
                    <div
                      class="input-group border border-base-content/20 rounded-lg focus-within:border-primary"
                    >
                      <CurrencyInput
                        v-model="minAmount"
                        borderless
                        hide-error-message
                      />
                      <span class="pr-3">€</span>
                    </div>
                  </div>
                  <div class="form-control">
                    <label class="label pt-0 pb-1">
                      <span class="label-text">Max. Betrag</span>
                    </label>
                    <div
                      class="input-group border border-base-content/20 rounded-lg focus-within:border-primary"
                    >
                      <CurrencyInput
                        v-model="maxAmount"
                        borderless
                        hide-error-message
                      />
                      <span class="pr-3">€</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend">
          Datum<span class="text-error">*</span>
        </legend>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label pb-1">
              <span class="label-text">Startdatum</span>
            </label>
            <input
              type="date"
              v-model="startDate"
              class="input input-bordered"
              :class="{ 'input-error': formAttempted && !isStartDateValid }"
              required
              aria-describedby="startdate-validation"
            />
            <div
              id="startdate-validation"
              class="validator-hint text-error mt-1"
              v-if="formAttempted && !isStartDateValid"
            >
              Startdatum muss angegeben werden.
            </div>
          </div>
          <div class="form-control">
            <label class="label pb-1">
              <span class="label-text">Wertstellung</span>
            </label>
            <input
              type="date"
              v-model="valueDate"
              class="input input-bordered"
              :class="{ 'input-error': formAttempted && !isValueDateValid }"
              required
              aria-describedby="valuedate-validation"
            />
            <div
              id="valuedate-validation"
              class="validator-hint text-error mt-1"
              v-if="formAttempted && !isValueDateValid"
            >
              Wertstellungsdatum muss angegeben werden.
            </div>
          </div>
        </div>
      </fieldset>
    </div>

    <!-- TABS -->
    <div class="card border border-base-300 p-1">
      <div class="tabs tabs-boxed">
        <a
          class="tab"
          :class="{ 'tab-active': activeTab === 'categorization' }"
          @click="activeTab = 'categorization'"
        >
          Kategorisierung & Details
        </a>
        <a
          class="tab"
          :class="{ 'tab-active': activeTab === 'recurrence' }"
          @click="activeTab = 'recurrence'"
        >
          Wiederholung
        </a>
      </div>

      <!-- TAB 1 -->
      <div
        v-if="activeTab === 'categorization'"
        class="card bg-base-200 p-4 rounded-lg space-y-4"
      >
        <div class="form-control">
          <fieldset
            v-if="transactionType !== TransactionType.CATEGORYTRANSFER"
            class="fieldset"
          >
            <legend class="fieldset-legend">Empfänger/Auftraggeber</legend>
            <SelectRecipient
              v-model="recipientId"
              @create="onCreateRecipient"
              placeholder="Optional: Empfänger/Auftraggeber auswählen..."
            />
            <!-- Validierungshinweis entfernt, da Empfänger nun optional ist -->
          </fieldset>
        </div>

        <div
          v-if="isExpense || isIncome"
          class="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Konto<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <SelectAccount
                v-model="accountId"
                :class="{ 'input-error': formAttempted && !isAccountIdValid }"
                aria-describedby="account-validation"
                required
              />
              <div
                id="account-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isAccountIdValid"
              >
                Konto muss ausgewählt werden.
              </div>
            </div>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Kategorie<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <SelectCategory
                v-model="categoryId"
                :class="{ 'input-error': formAttempted && !isCategoryIdValid }"
                aria-describedby="category-validation"
                required
              />
              <div
                id="category-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isCategoryIdValid"
              >
                Kategorie muss ausgewählt werden.
              </div>
            </div>
          </fieldset>
        </div>

        <!-- Kontotransfer -->
        <div
          v-if="isAccountTransfer"
          class="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Quellkonto<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <SelectAccount
                v-model="accountId"
                :class="{ 'input-error': formAttempted && !isAccountIdValid }"
                aria-describedby="source-account-validation"
                required
              />
              <div
                id="source-account-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isAccountIdValid"
              >
                Quellkonto muss ausgewählt werden.
              </div>
            </div>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Zielkonto<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <select
                v-model="toAccountId"
                class="select select-bordered w-full"
                :class="{
                  'select-error': formAttempted && !isToAccountIdValid,
                }"
                required
                aria-describedby="target-account-validation"
              >
                <option value="" disabled selected>Bitte wählen</option>
                <option
                  v-for="account in filteredAccounts"
                  :key="account.id"
                  :value="account.id"
                >
                  {{ account.name }}
                </option>
              </select>
              <div
                id="target-account-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isToAccountIdValid"
              >
                Zielkonto muss ausgewählt werden.
              </div>
            </div>
          </fieldset>
        </div>

        <!-- Kategorietransfer -->
        <div
          v-if="isCategoryTransfer"
          class="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Quellkategorie<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <SelectCategory
                v-model="fromCategoryId"
                :class="{
                  'input-error': formAttempted && !isFromCategoryIdValid,
                }"
                aria-describedby="source-category-validation"
                required
              />
              <div
                id="source-category-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isFromCategoryIdValid"
              >
                Quellkategorie muss ausgewählt werden.
              </div>
            </div>
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Zielkategorie<span class="text-error">*</span>
            </legend>
            <div class="form-control">
              <SelectCategory
                v-model="categoryId"
                :options="filteredCategories"
                :class="{
                  'input-error': formAttempted && !isTargetCategoryIdValid,
                }"
                aria-describedby="target-category-validation"
                required
              />
              <div
                id="target-category-validation"
                class="validator-hint text-error mt-1"
                v-if="formAttempted && !isTargetCategoryIdValid"
              >
                Zielkategorie muss ausgewählt werden.
              </div>
            </div>
          </fieldset>
        </div>

        <fieldset
          v-if="transactionType !== TransactionType.CATEGORYTRANSFER"
          class="fieldset"
        >
          <legend class="fieldset-legend">Tags</legend>
          <div class="form-control">
            <TagSearchableDropdown
              v-model="tagIds"
              :options="tagStore.tags"
              placeholder="Tags hinzufügen..."
            />
          </div>
        </fieldset>
      </div>

      <!-- TAB 2 -->
      <div v-if="activeTab === 'recurrence'" class="space-y-4">
        <fieldset class="fieldset">
          <div class="card bg-base-200 p-4 rounded-lg">
            <legend class="fieldset-legend">Einstellungen Wiederholung</legend>
            <div class="flex flex-col md:flex-row md:space-x-8">
              <div class="space-y-4 md:w-1/2">
                <div class="form-control">
                  <label class="cursor-pointer label">
                    <span class="label-text">Wiederholt sich</span>
                    <input
                      type="checkbox"
                      class="toggle toggle-primary"
                      v-model="repeatsEnabled"
                    />
                  </label>
                </div>
                <div v-if="repeatsEnabled" class="space-y-4">
                  <div class="form-control">
                    <label class="label pb-1">
                      <span class="label-text">Frequenz</span>
                    </label>
                    <select
                      v-model="recurrencePattern"
                      class="select select-bordered w-full"
                    >
                      <option :value="RecurrencePattern.DAILY">Täglich</option>
                      <option :value="RecurrencePattern.WEEKLY">
                        Wöchentlich
                      </option>
                      <option :value="RecurrencePattern.BIWEEKLY">
                        Alle 2 Wochen
                      </option>
                      <option :value="RecurrencePattern.MONTHLY">
                        Monatlich
                      </option>
                      <option :value="RecurrencePattern.QUARTERLY">
                        Vierteljährlich
                      </option>
                      <option :value="RecurrencePattern.YEARLY">
                        Jährlich
                      </option>
                    </select>
                  </div>
                  <div
                    v-if="recurrencePattern === RecurrencePattern.MONTHLY"
                    class="form-control"
                  >
                    <label class="label pb-1">
                      <span class="label-text">Tag des Monats (optional)</span>
                    </label>
                    <input
                      type="number"
                      v-model.number="executionDay"
                      class="input input-bordered"
                      min="1"
                      max="31"
                      placeholder="Standard: Tag des Startdatums"
                    />
                  </div>
                  <div class="form-control">
                    <label class="cursor-pointer label">
                      <span class="label-text"
                        >Verschieben, wenn Wochenende</span
                      >
                      <input
                        type="checkbox"
                        class="toggle"
                        v-model="moveScheduleEnabled"
                        :disabled="!repeatsEnabled"
                      />
                    </label>
                  </div>
                  <div
                    v-if="repeatsEnabled && moveScheduleEnabled"
                    class="form-control"
                  >
                    <label class="label pb-1">
                      <span class="label-text">Verschieberichtung</span>
                    </label>
                    <div class="flex space-x-4">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          value="before"
                          v-model="weekendHandlingDirection"
                        />
                        <span class="text-sm">Vorher (Freitag)</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          value="after"
                          v-model="weekendHandlingDirection"
                        />
                        <span class="text-sm">Danach (Montag)</span>
                      </label>
                    </div>
                  </div>
                  <div class="form-control">
                    <label class="label pt-4 pb-1">
                      <span class="label-text">Endet</span>
                    </label>
                    <div class="flex flex-wrap gap-x-4 gap-y-2">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          :value="RecurrenceEndType.NEVER"
                          v-model="recurrenceEndType"
                          :disabled="!repeatsEnabled"
                        />
                        <span class="text-sm">Nie</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          :value="RecurrenceEndType.COUNT"
                          v-model="recurrenceEndType"
                          :disabled="!repeatsEnabled"
                        />
                        <span class="text-sm">Nach Anzahl</span>
                      </label>
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          class="radio radio-sm"
                          :value="RecurrenceEndType.DATE"
                          v-model="recurrenceEndType"
                          :disabled="!repeatsEnabled"
                        />
                        <span class="text-sm">Am Datum</span>
                      </label>
                    </div>
                  </div>
                  <div
                    v-if="
                      repeatsEnabled &&
                      recurrenceEndType === RecurrenceEndType.COUNT
                    "
                    class="form-control"
                  >
                    <label class="label pb-1">
                      <span class="label-text">Anzahl Wiederholungen</span>
                    </label>
                    <input
                      type="number"
                      v-model.number="recurrenceCount"
                      class="input input-bordered"
                      min="1"
                      placeholder="Anzahl"
                    />
                  </div>
                  <div
                    v-if="
                      repeatsEnabled &&
                      recurrenceEndType === RecurrenceEndType.DATE
                    "
                    class="form-control"
                  >
                    <label class="label pb-1">
                      <span class="label-text">Enddatum</span>
                    </label>
                    <input
                      type="date"
                      v-model="endDate"
                      class="input input-bordered"
                      :min="startDate"
                      placeholder="Enddatum"
                    />
                  </div>
                </div>
              </div>
              <div class="mt-4 md:mt-0 md:w-1/2">
                <div class="text-sm font-semibold mb-8">
                  Nächste Ausführung: {{ dateDescription }}
                </div>
                <div v-if="upcomingDates.length > 0 && repeatsEnabled">
                  <div class="text-sm font-semibold mb-2">
                    Voraussichtliche Termine:
                  </div>
                  <div class="grid grid-cols-1 gap-1">
                    <div
                      v-for="(d, i) in upcomingDates"
                      :key="i"
                      class="text-xs p-1 rounded"
                    >
                      {{ d.date }} ({{ d.day }})
                    </div>
                  </div>
                  <p
                    class="text-xs text-base-content/70 mt-1"
                    v-if="
                      recurrenceEndType === RecurrenceEndType.COUNT &&
                      upcomingDates.length >= (recurrenceCount || 0)
                    "
                  >
                    Endet nach {{ recurrenceCount }} Termin(en).
                  </p>
                  <p
                    class="text-xs text-base-content/70 mt-1"
                    v-else-if="
                      recurrenceEndType === RecurrenceEndType.DATE && endDate
                    "
                  >
                    Endet am {{ formatDate(endDate) }}.
                  </p>
                </div>
                <div v-else-if="upcomingDates.length > 0 && !repeatsEnabled">
                  <div class="text-sm font-semibold mb-2">
                    Einmaliger Termin:
                  </div>
                  <div class="text-xs p-1 rounded bg-base-100">
                    {{ upcomingDates[0].date }} ({{ upcomingDates[0].day }})
                  </div>
                </div>
                <p v-else-if="!startDate" class="text-sm text-warning">
                  Bitte ein Startdatum wählen.
                </p>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Status</legend>
      <div class="form-control">
        <label class="cursor-pointer label">
          <span class="label-text">Aktiv</span>
          <input type="checkbox" class="toggle" v-model="isActive" />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Buchungsverhalten</legend>
      <div class="form-control">
        <label class="cursor-pointer label">
          <span class="label-text">Nur Prognosebuchung</span>
          <input type="checkbox" class="toggle" v-model="forecastOnly" />
        </label>
        <p class="text-xs text-base-content/70 pl-4" v-if="forecastOnly">
          Bei aktivierter Option werden keine echten Transaktionen erzeugt.
        </p>
      </div>
    </fieldset>

    <div class="flex justify-end space-x-2 pt-6">
      <button type="button" class="btn btn-ghost" @click="$emit('cancel')">
        Abbrechen
      </button>
      <button type="submit" class="btn btn-primary">
        {{ isEdit ? "Änderungen speichern" : "Planung erstellen" }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.fieldset {
  border: none;
  padding: 0;
  margin: 0;
}
.fieldset-legend {
  font-weight: 600;
  padding-bottom: 0.5rem;
  font-size: 0.875rem;
  color: hsl(var(--bc) / 0.7);
}
.input-error,
.select-error,
.textarea-error {
  border-color: hsl(var(--er));
}
.validator-hint {
  font-size: 0.75rem;
  min-height: 1rem;
}
input:invalid,
select:invalid,
textarea:invalid {
  box-shadow: none;
}
</style>
