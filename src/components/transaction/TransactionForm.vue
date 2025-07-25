// src/components/transaction/TransactionForm.vue
<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { Transaction, TransactionType, Category } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import DatePicker from "../ui/DatePicker.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import ButtonGroup from "../ui/ButtonGroup.vue";
import TagSearchableDropdown from "../ui/TagSearchableDropdown.vue";
import SelectAccount from "../ui/SelectAccount.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import SelectRecipient from "../ui/SelectRecipient.vue";
import { debugLog } from "../../utils/logger"; // Korrigierter Pfad
import { toDateOnlyString } from "../../utils/formatters";
import { CategoryService } from "../../services/CategoryService"; // CategoryService importiert
import { Icon } from "@iconify/vue";

const props = defineProps<{
  transaction?: Transaction;
  isEdit?: boolean;
  defaultAccountId?: string;
  initialAccountId?: string;
  initialTransactionType?: TransactionType;
}>();

const emit = defineEmits(["save", "cancel"]);

const accountStore = useAccountStore();
const recipientStore = useRecipientStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();

const date = ref(new Date().toISOString().split("T")[0]);
const valueDate = ref(date.value);
const valueDateManuallyChanged = ref(false);
const transactionType = ref<TransactionType>(TransactionType.EXPENSE);
const accountId = ref("");
const toAccountId = ref("");
const categoryId = ref<string>("");
const tagIds = ref<string[]>([]);
const amount = ref(0);
const note = ref("");
const recipientId = ref("");
const reconciled = ref(false);
const recipientsLoaded = ref(false);
const submitAttempted = ref(false);
const isSubmitting = ref(false);
const showValidationAlert = ref(false);

const amountInputRef = ref<InstanceType<typeof CurrencyInput> | null>(null);
const formModalRef = ref<HTMLFormElement | null>(null);

const locked = computed(
  () => props.transaction && (props.transaction as any).counterTransactionId
);

const recipients = computed(() =>
  Array.isArray(recipientStore.recipients) ? recipientStore.recipients : []
);

const categories = computed(() =>
  categoryStore.categories.map((c) => ({ id: c.id, name: c.name }))
);

const tags = computed(() =>
  tagStore.tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }))
);

const isTransfer = computed(
  () => transactionType.value === TransactionType.ACCOUNTTRANSFER
);

const accounts = computed(() =>
  accountStore.activeAccounts.map((a) => ({ id: a.id, name: a.name }))
);

const filteredAccounts = computed(() =>
  accounts.value.filter((a) => a.id !== accountId.value)
);

const focusModalAndAmount = () => {
  nextTick(() => {
    amountInputRef.value?.focus();
    amountInputRef.value?.select();
  });
};

onMounted(() => {
  recipientsLoaded.value = true;

  if (props.transaction) {
    // Bestehende Transaktion → Felder ausfüllen
    date.value = props.transaction.date;
    valueDate.value =
      (props.transaction as any).valueDate || props.transaction.date;
    accountId.value = props.transaction.accountId;
    categoryId.value = props.transaction.categoryId || "";
    tagIds.value = Array.isArray((props.transaction as any).tagIds)
      ? (props.transaction as any).tagIds
      : [];
    amount.value = props.transaction.amount ?? 0;
    note.value = props.transaction.note || "";
    recipientId.value = (props.transaction as any).recipientId || "";
    transactionType.value =
      (props.transaction as any).type || TransactionType.EXPENSE;
    reconciled.value = (props.transaction as any).reconciled || false;
    if (transactionType.value === TransactionType.ACCOUNTTRANSFER) {
      toAccountId.value = (props.transaction as any).transferToAccountId || "";
    }
    valueDateManuallyChanged.value = valueDate.value !== date.value;
  } else {
    // Neue Transaktion → Initialwerte setzen
    accountId.value =
      props.defaultAccountId ||
      props.initialAccountId ||
      accountStore.activeAccounts[0]?.id ||
      "";
    transactionType.value =
      props.initialTransactionType || TransactionType.EXPENSE;
    reconciled.value = false;
    valueDate.value = date.value;
    valueDateManuallyChanged.value = false;

    debugLog("[TransactionForm]", "initial accountId set:", accountId.value);
  }

  focusModalAndAmount();
});

// Watcher für das Prop defaultAccountId
watch(
  () => props.defaultAccountId,
  (newVal) => {
    if (newVal) {
      accountId.value = newVal;
      debugLog(
        "[TransactionForm]",
        "defaultAccountId watcher updated:",
        newVal
      );
    }
  }
);

watch(
  () => props.isEdit,
  (newValue) => newValue && focusModalAndAmount()
);

watch([date, valueDate, recipientId, categoryId, transactionType], () => {
  focusModalAndAmount();
});

watch(date, (newDate) => {
  if (!valueDateManuallyChanged.value) {
    valueDate.value = newDate;
  }
});

watch(valueDate, (val) => {
  valueDateManuallyChanged.value = val !== date.value;
});

watch(amount, (newAmount) => {
  if (locked.value || transactionType.value === TransactionType.ACCOUNTTRANSFER)
    return;
  transactionType.value = toAccountId.value
    ? TransactionType.ACCOUNTTRANSFER
    : newAmount < 0
    ? TransactionType.EXPENSE
    : newAmount > 0
    ? TransactionType.INCOME
    : transactionType.value;
});

watch(transactionType, (newType) => {
  if (!locked.value && newType !== TransactionType.ACCOUNTTRANSFER) {
    toAccountId.value = "";
  }
  if (newType === TransactionType.EXPENSE && amount.value > 0) {
    amount.value = -Math.abs(amount.value);
  } else if (newType === TransactionType.INCOME && amount.value < 0) {
    amount.value = Math.abs(amount.value);
  }
});

watch(toAccountId, (newToAccountId) => {
  if (!locked.value && newToAccountId) {
    transactionType.value = TransactionType.ACCOUNTTRANSFER;
  }
});

const validationErrors = computed(() => {
  const errors: string[] = [];
  if (!date.value) errors.push("Buchungsdatum ist erforderlich");
  if (!amount.value || amount.value === 0)
    errors.push("Betrag ist erforderlich");
  if (!accountId.value) errors.push("Konto ist erforderlich");
  if (
    transactionType.value === TransactionType.ACCOUNTTRANSFER &&
    !toAccountId.value
  ) {
    errors.push("Gegenkonto ist erforderlich");
  }
  return errors;
});

async function onCreateCategory(newCategoryInput: {
  id: string;
  name: string;
}) {
  // Die 'id' von newCategoryInput wird hier nicht direkt verwendet, da der Service/Store die ID generiert.
  // Annahme: Beim Erstellen über dieses Formular handelt es sich um eine Top-Level-Kategorie ohne spezielle Gruppe oder Icon.
  try {
    const newCategoryData: Omit<Category, "id" | "updated_at"> = {
      name: newCategoryInput.name,
      parentCategoryId: undefined,
      sortOrder: categoryStore.categories.length,
      categoryGroupId: undefined,
      icon: undefined,
      // Standardwerte für weitere Felder, die `addCategory` erwartet, falls nötig
      budgeted: 0,
      activity: 0,
      available: 0,
      isIncomeCategory: false, // Standardmäßig false, wird ggf. durch Gruppe überschrieben
      isHidden: false,
      isActive: true,
      isSavingsGoal: false,
    };
    const created = await CategoryService.addCategory(newCategoryData);
    if (created) {
      categoryId.value = created.id;
    } else {
      // Fehlerbehandlung, falls `addCategory` null zurückgibt
      debugLog(
        "[TransactionForm]",
        "onCreateCategory - Category creation via Service returned null"
      );
      // Hier könnte eine Fehlermeldung für den Benutzer angezeigt werden
    }
    debugLog(
      "[TransactionForm]",
      "onCreateCategory - Category created via Service:",
      created
    );
  } catch (error) {
    debugLog(
      "[TransactionForm]",
      "onCreateCategory - Error creating category via Service:",
      error
    );
    // Hier könnte eine Fehlermeldung für den Benutzer angezeigt werden
    // z.B. mit einem Toast-Service: toast.error("Fehler beim Erstellen der Kategorie.");
  }
}

async function onCreateTag(newTag: {
  id: string;
  name: string;
  color?: string;
}) {
  const created = await tagStore.addTag({
    name: newTag.name,
    parentTagId: null, // Standardwert
    color: newTag.color, // Verwende die zufällige Farbe von TagSearchableDropdown
  });
  tagIds.value = [...tagIds.value, created.id];
  debugLog("[TransactionForm]", "onCreateTag - Tag created:", created);
}

async function onCreateRecipient(newRecipient: { id: string; name: string }) {
  const created = await recipientStore.addRecipient({
    name: newRecipient.name,
  });
  recipientId.value = created.id;
  debugLog(
    "[TransactionForm]",
    "onCreateRecipient - Recipient created:",
    created
  );
}

const saveTransaction = () => {
  const getValidValueDate = () => {
    debugLog("[TransactionForm]", "getValidValueDate - Input values:", {
      dateValue: date.value,
      valueDateValue: valueDate.value,
      isInvalidDate: new Date(valueDate.value).toString() === "Invalid Date",
    });
    // Prüft, ob valueDate.value ein gültiger String für new Date() ist
    // und nicht 'Invalid Date' ergibt.
    if (
      valueDate.value &&
      new Date(valueDate.value).toString() !== "Invalid Date"
    ) {
      const formatted = toDateOnlyString(valueDate.value);
      debugLog(
        "[TransactionForm]",
        "getValidValueDate - Using valueDate.value, formatted:",
        formatted
      );
      return formatted;
    }
    const formattedFallback = toDateOnlyString(date.value);
    debugLog(
      "[TransactionForm]",
      "getValidValueDate - Using date.value (fallback), formatted:",
      formattedFallback
    );
    return formattedFallback; // Fallback auf date.value
  };

  const currentValidValueDate = getValidValueDate();
  const currentDate = toDateOnlyString(date.value);

  if (transactionType.value === TransactionType.ACCOUNTTRANSFER) {
    return {
      type: transactionType.value,
      fromAccountId: accountId.value,
      toAccountId: toAccountId.value,
      amount: Math.abs(amount.value),
      date: currentDate,
      valueDate: currentValidValueDate,
      note: note.value,
      reconciled: reconciled.value,
    };
  } else {
    return {
      date: currentDate,
      valueDate: currentValidValueDate,
      accountId: accountId.value,
      categoryId: categoryId.value,
      tagIds: tagIds.value,
      amount: amount.value,
      note: note.value,
      recipientId: recipientId.value || undefined,
      reconciled: reconciled.value,
      type: transactionType.value,
      counterTransactionId: null,
      planningTransactionId: null,
      isReconciliation: false,
      runningBalance: 0,
    };
  }
};

const submitForm = () => {
  debugLog("[TransactionForm]", "submitForm initiated");
  if (isSubmitting.value) {
    debugLog("[TransactionForm]", "submitForm aborted: already submitting");
    return;
  }
  isSubmitting.value = true;

  submitAttempted.value = true;
  if (validationErrors.value.length > 0) {
    showValidationAlert.value = true;
    debugLog("[TransactionForm]", "submitForm aborted: validation errors", {
      errors: validationErrors.value,
    });
    isSubmitting.value = false;
    return;
  }

  showValidationAlert.value = false;
  const transactionPayload = saveTransaction();
  debugLog("[TransactionForm]", "submitForm payload:", {
    payload: transactionPayload,
  });
  emit("save", transactionPayload);
  isSubmitting.value = false;
};

/**
 * Schließt das Validierungs-Alert.
 */
const closeValidationAlert = () => {
  showValidationAlert.value = false;
};
</script>

<template>
  <div
    class="text-center p-4"
    v-if="!recipientsLoaded"
  >
    Lade Empfänger...
  </div>
  <div
    v-else
    class="relative"
  >
    <!-- X-Icon zum Schließen -->
    <button
      type="button"
      class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
      @click="emit('cancel')"
    >
      <Icon
        icon="mdi:close"
        class="text-lg"
      />
    </button>

    <!-- Überschrift -->
    <h3 class="font-bold text-lg mb-4">
      {{
        props.transaction ? "Transaktionsbearbeitung" : "Transaktionserstellung"
      }}
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
      ref="formModalRef"
      novalidate
      tabindex="-1"
      @submit.prevent="submitForm"
      @keydown.esc.prevent="emit('cancel')"
      class="space-y-4 max-w-[calc(100%-80px)] mx-auto relative"
    >
      <div class="flex flex-row justify-between items-start">
        <div class="flex justify-center gap-4 pt-4">
          <label class="flex items-center gap-2">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-error/60 checked:text-error checked:border-error"
              v-model="transactionType"
              :value="TransactionType.EXPENSE"
              :disabled="locked"
            />
            <span class="text-sm">Ausgabe</span>
          </label>
          <label class="flex items-center gap-2">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-success/60 checked:text-success checked:border-success"
              v-model="transactionType"
              :value="TransactionType.INCOME"
              :disabled="locked"
            />
            <span class="text-sm">Einnahme</span>
          </label>
          <label class="flex items-center gap-2">
            <input
              type="radio"
              class="radio radio-sm border-neutral checked:bg-warning/60 checked:text-warning checked:border-warning"
              v-model="transactionType"
              :value="TransactionType.ACCOUNTTRANSFER"
            />
            <span class="text-sm">Transfer</span>
          </label>
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            v-model="reconciled"
            class="checkbox checkbox-xs"
          />
          abgeglichen?
        </label>
      </div>
      <div class="divider" />

      <!-- Datum und Betrag -->
      <div class="grid grid-cols-3 gap-4 items-end">
        <DatePicker
          v-model="date"
          label="Buchungsdatum (Pflicht)"
          required
          class="self-end fieldset focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <DatePicker
          v-model="valueDate"
          label="Wertstellung"
          required
          class="self-end fieldset focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div class="flex justify-end items-center gap-2 self-end">
          <CurrencyInput
            ref="amountInputRef"
            v-model="amount"
            class="w-[150px] focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span class="text-3xl">€</span>
        </div>
      </div>

      <!-- Notiz -->
      <div class="flex items-start justify-between gap-2 mt-5">
        <Icon icon="mdi:speaker-notes" />
        <textarea
          v-model="note"
          class="textarea textarea-bordered w-full min-h-[3rem] fieldset focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Notiz"
        ></textarea>
      </div>

      <div class="divider pt-5" />

      <!-- Konto und Transfer-Konto -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Konto</legend>
          <SelectAccount v-model="accountId" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Transfer-Konto (Pflicht bei Transfer)
          </legend>
          <select
            v-model="toAccountId"
            class="select select-bordered focus:outline-none focus:ring-2 focus:ring-accent w-full"
            :disabled="!isTransfer"
          >
            <option
              v-for="a in filteredAccounts"
              :key="a.id"
              :value="a.id"
            >
              {{ a.name }}
            </option>
          </select>
        </fieldset>
      </div>

      <div class="divider pt-5" />

      <!-- Empfänger -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Empfänger</legend>
        <SelectRecipient
          v-model="recipientId"
          @create="onCreateRecipient"
          :class="isTransfer ? 'opacity-50' : ''"
          :disabled="isTransfer"
        />
      </fieldset>

      <!-- Kategorie & Tags -->
      <div
        v-if="transactionType !== TransactionType.ACCOUNTTRANSFER"
        class="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Kategorie</legend>
          <SelectCategory v-model="categoryId" />
        </fieldset>
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Tags</legend>
          <TagSearchableDropdown
            class="fieldset focus:outline-none focus:ring-2 focus:ring-accent"
            v-model="tagIds"
            :options="tags"
            @create="onCreateTag"
          />
        </fieldset>
      </div>

      <!-- Buttons -->
      <div class="flex justify-end pt-5">
        <ButtonGroup
          left-label="Abbrechen"
          right-label="Speichern"
          left-color="btn-soft"
          right-color="btn-primary"
          @left-click="emit('cancel')"
          @right-click="submitForm"
        />
      </div>
    </form>
  </div>
</template>
