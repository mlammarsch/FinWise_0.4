<script setup lang="ts">
import { computed } from "vue";
import type { RuleCondition } from "@/types";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import SelectAccount from "@/components/ui/SelectAccount.vue";
import SelectCategory from "@/components/ui/SelectCategory.vue";
import MultiValueInput from "@/components/ui/MultiValueInput.vue";
import { Icon } from "@iconify/vue";

interface Props {
  condition: RuleCondition;
  index: number;
  canRemove: boolean;
}

interface Emits {
  (e: "update:condition", condition: RuleCondition): void;
  (e: "remove"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const accountStore = useAccountStore();
const categoryStore = useCategoryStore();

// Quelle-Optionen
const sourceOptions = [
  { value: "recipient", label: "Empfänger", type: "string" },
  { value: "date", label: "Datum", type: "date" },
  { value: "valueDate", label: "Wertstellung", type: "date" },
  { value: "amount", label: "Betrag", type: "number" },
  { value: "category", label: "Kategorie", type: "select" },
  { value: "description", label: "Beschreibung", type: "string" },
  { value: "account", label: "Konto", type: "select" },
];

// Operator-Optionen basierend auf Datentyp
function getOperatorOptions(source: string) {
  const sourceType = sourceOptions.find((s) => s.value === source)?.type;

  if (sourceType === "string") {
    return [
      { value: "is", label: "ist" },
      { value: "contains", label: "enthält" },
      { value: "starts_with", label: "beginnt mit" },
      { value: "ends_with", label: "endet mit" },
      { value: "one_of", label: "ist einer von" },
    ];
  } else if (sourceType === "number") {
    return [
      { value: "is", label: "ist" },
      { value: "greater", label: "größer" },
      { value: "greater_equal", label: "größer gleich" },
      { value: "less", label: "kleiner" },
      { value: "less_equal", label: "kleiner gleich" },
      { value: "approx", label: "ungefähr (±10%)" },
      { value: "one_of", label: "ist einer von" },
    ];
  } else if (sourceType === "date") {
    return [
      { value: "is", label: "ist" },
      { value: "greater", label: "größer" },
      { value: "greater_equal", label: "größer gleich" },
      { value: "less", label: "kleiner" },
      { value: "less_equal", label: "kleiner gleich" },
    ];
  } else if (sourceType === "select") {
    return [
      { value: "is", label: "ist" },
      { value: "one_of", label: "ist einer von" },
    ];
  }

  return [{ value: "is", label: "ist" }];
}

// Computed für die aktuelle Bedingung
const currentCondition = computed({
  get: () => props.condition as any,
  set: (value: any) => emit("update:condition", value),
});

// UI-Hilfsfeld für Quelle (nicht Teil des Domain-Typs)
const sourceField = computed<string>({
  get: () => {
    const c: any = currentCondition.value as any;
    return (c?.source ?? "description") as string;
  },
  set: (val: string) => {
    const next: any = { ...(currentCondition.value as any), source: val };
    emit("update:condition", next);
  },
});

// Funktion zum Zurücksetzen des Bedingungswerts bei Operator-Änderung
function resetConditionValue() {
  const newCondition: any = { ...(currentCondition.value as any) };

  // Wenn der neue Operator 'one_of' ist, initialisiere als Array
  if (newCondition.operator === "one_of") {
    newCondition.value = [];
  } else {
    // Für alle anderen Operatoren, initialisiere als String
    newCondition.value = "";
  }

  currentCondition.value = newCondition;
}

// Computed für Multi-Value-Eingabe
const multiValueCondition = computed({
  get: () => {
    const c: any = currentCondition.value as any;
    if (Array.isArray(c?.value)) {
      return c.value as string[];
    }
    return [] as string[];
  },
  set: (value: string[]) => {
    const next: any = { ...(currentCondition.value as any), value };
    currentCondition.value = next;
  },
});

// Computed für Single-Value-Eingabe
const singleValueCondition = computed({
  get: () => {
    const c: any = currentCondition.value as any;
    if (!Array.isArray(c?.value)) {
      return (c?.value ?? "") as string;
    }
    return "";
  },
  set: (value: string) => {
    const next: any = { ...(currentCondition.value as any), value };
    currentCondition.value = next;
  },
});
</script>

<template>
  <div class="grid grid-cols-12 gap-3 items-center p-3 bg-base-200 rounded-lg">
    <!-- Linker Operand: Quelle auswählen -->
    <div class="col-span-3">
      <select
        v-model="sourceField"
        class="select select-bordered select-sm w-full"
        @change="resetConditionValue"
      >
        <option
          v-for="option in sourceOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Operator -->
    <div class="col-span-3">
      <select
        v-model="currentCondition.operator"
        class="select select-bordered select-sm w-full"
        @change="resetConditionValue"
      >
        <option
          v-for="option in getOperatorOptions(sourceField || 'description')"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <!-- Rechter Operand: Wert-Eingabe -->
    <div class="col-span-5">
      <!-- Multi-Value-Input für 'one_of' Operator -->
      <MultiValueInput
        v-if="currentCondition.operator === 'one_of'"
        v-model="multiValueCondition"
        :placeholder="
          sourceField === 'recipient'
            ? 'Empfänger-Namen eingeben...'
            : sourceField === 'amount'
            ? 'Beträge eingeben...'
            : 'Werte eingeben...'
        "
      />

      <!-- Single-Value-Inputs für andere Operatoren -->
      <template v-else>
        <!-- Konto-Auswahl -->
        <SelectAccount
          v-if="sourceField === 'account' && currentCondition.operator === 'is'"
          v-model="singleValueCondition"
          class="w-full"
        />

        <!-- Kategorie-Auswahl -->
        <SelectCategory
          v-else-if="
            sourceField === 'category' && currentCondition.operator === 'is'
          "
          v-model="singleValueCondition"
          class="w-full"
          :show-none-option="true"
        />

        <!-- Empfänger-Freitextfeld für alle recipient-Operationen -->
        <input
          v-else-if="sourceField === 'recipient'"
          type="text"
          v-model="singleValueCondition"
          class="input input-bordered input-sm w-full"
          placeholder="Empfänger-Name eingeben"
        />

        <!-- Zahleneingabe für Beträge -->
        <input
          v-else-if="sourceField === 'amount'"
          type="number"
          step="0.01"
          v-model="singleValueCondition"
          class="input input-bordered input-sm w-full"
          placeholder="Betrag (z.B. 42.99)"
        />

        <!-- Datumseingabe -->
        <input
          v-else-if="sourceField === 'date' || sourceField === 'valueDate'"
          type="date"
          v-model="singleValueCondition"
          class="input input-bordered input-sm w-full"
        />

        <!-- Standard-Texteingabe für andere Quellen -->
        <input
          v-else
          type="text"
          v-model="singleValueCondition"
          class="input input-bordered input-sm w-full"
          placeholder="Wert eingeben"
        />
      </template>
    </div>

    <!-- Entfernen-Button -->
    <div class="col-span-1 flex justify-center">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        @click="emit('remove')"
        :disabled="!canRemove"
      >
        <Icon
          icon="mdi:close"
          class="text-error"
        />
      </button>
    </div>
  </div>
</template>
