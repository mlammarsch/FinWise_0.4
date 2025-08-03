<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Category } from "../../types";
import { CategoryService } from "../../services/CategoryService";
import { BalanceService } from "../../services/BalanceService";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import ButtonGroup from "../ui/ButtonGroup.vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  category?: Category;
  isEdit?: boolean;
}>();

const emit = defineEmits(["save", "cancel"]);

// Formularfelder
const name = ref("");
const description = ref("");
const isActive = ref(true);
const isHidden = ref(false);
const isSavingsGoal = ref(false);
const targetAmount = ref(0);
const targetDate = ref("");
const categoryGroupId = ref("");
const balance = ref(0);
const goalDate = ref("");
const priority = ref(0);
const proportion = ref(0);
const monthlyAmount = ref(0);
const note = ref("");

// Validierung
const submitAttempted = ref(false);
const showValidationAlert = ref(false);

// Flags zur Verhinderung von Endlosschleifen bei automatischen Berechnungen
const isCalculatingDate = ref(false);
const isCalculatingAmount = ref(false);

// Lade die Daten, wenn eine Kategorie zum Bearbeiten übergeben wurde
onMounted(() => {
  if (props.category) {
    name.value = props.category.name;
    description.value = ""; // Category hat keine description property
    isActive.value = props.category.isActive;
    isHidden.value = props.category.isHidden || false;
    isSavingsGoal.value = props.category.isSavingsGoal || false;
    targetAmount.value = props.category.targetAmount || 0;
    targetDate.value = ""; // Wird nicht verwendet, goalDate ist das korrekte Feld
    categoryGroupId.value = props.category.categoryGroupId || "";
    // Aktuellen Saldo über BalanceService berechnen statt aus props.category.available
    balance.value = BalanceService.getTodayBalance("category", props.category.id);
    goalDate.value = props.category.goalDate || "";
    priority.value = props.category.priority || 0;
    proportion.value = props.category.proportion || 0;
    monthlyAmount.value = props.category.monthlyAmount || 0;
    note.value = props.category.note || "";
  } else {
    const groups = CategoryService.getCategoryGroups().value;
    if (groups.length > 0) {
      categoryGroupId.value = groups[0].id;
    }
  }
});

// Automatische Berechnungen für Sparziel
const calculateGoalDate = () => {
  if (!isSavingsGoal.value || targetAmount.value <= 0 || monthlyAmount.value <= 0 || isCalculatingDate.value) {
    return;
  }

  isCalculatingDate.value = true;

  // Berücksichtige den aktuellen Saldo - nur die Differenz muss noch gespart werden
  const remainingAmount = targetAmount.value - balance.value;

  // Wenn das Ziel bereits erreicht ist, setze das Datum auf heute
  if (remainingAmount <= 0) {
    goalDate.value = new Date().toISOString().split('T')[0];
  } else {
    const monthsNeeded = Math.ceil(remainingAmount / monthlyAmount.value);
    const today = new Date();
    const goalDateCalculated = new Date(today.getFullYear(), today.getMonth() + monthsNeeded, today.getDate());
    goalDate.value = goalDateCalculated.toISOString().split('T')[0];
  }

  setTimeout(() => {
    isCalculatingDate.value = false;
  }, 100);
};

const calculateMonthlyAmount = () => {
  if (!isSavingsGoal.value || targetAmount.value <= 0 || !goalDate.value || isCalculatingAmount.value) {
    return;
  }

  isCalculatingAmount.value = true;

  const today = new Date();
  const targetDateObj = new Date(goalDate.value);
  const monthsDiff = (targetDateObj.getFullYear() - today.getFullYear()) * 12 +
                     (targetDateObj.getMonth() - today.getMonth());

  // Berücksichtige den aktuellen Saldo - nur die Differenz muss noch gespart werden
  const remainingAmount = targetAmount.value - balance.value;

  if (monthsDiff > 0 && remainingAmount > 0) {
    monthlyAmount.value = Math.ceil(remainingAmount / monthsDiff * 100) / 100;
  } else if (remainingAmount <= 0) {
    // Ziel bereits erreicht
    monthlyAmount.value = 0;
  }

  setTimeout(() => {
    isCalculatingAmount.value = false;
  }, 100);
};

// Watch für automatische Berechnungen
watch([targetAmount, monthlyAmount, balance], () => {
  if (isSavingsGoal.value && !isCalculatingDate.value) {
    calculateGoalDate();
  }
}, { deep: true });

watch([targetAmount, goalDate, balance], () => {
  if (isSavingsGoal.value && !isCalculatingAmount.value) {
    calculateMonthlyAmount();
  }
}, { deep: true });

// Validierungsfehler sammeln
const validationErrors = computed(() => {
  const errors: string[] = [];
  if (!name.value.trim()) errors.push("Name ist erforderlich");
  if (!categoryGroupId.value) errors.push("Kategoriegruppe ist erforderlich");
  if (isSavingsGoal.value && targetAmount.value <= 0) {
    errors.push("Zielbetrag muss größer als 0 sein");
  }
  return errors;
});

// Speichere die Kategorie
const saveCategory = () => {
  submitAttempted.value = true;

  if (validationErrors.value.length > 0) {
    showValidationAlert.value = true;
    return;
  }

  showValidationAlert.value = false;

  const categoryData: Omit<Category, "id"> = {
    name: name.value,
    icon: undefined,
    budgeted: 0,
    activity: 0,
    available: balance.value,
    isIncomeCategory: false,
    isHidden: isHidden.value,
    isActive: isActive.value,
    sortOrder: 0,
    categoryGroupId: categoryGroupId.value,
    isSavingsGoal: isSavingsGoal.value,
    goalDate: goalDate.value || undefined,
    targetAmount: targetAmount.value || undefined,
    priority: priority.value || undefined,
    proportion: proportion.value || undefined,
    monthlyAmount: monthlyAmount.value || undefined,
    note: note.value || undefined,
  };

  emit("save", categoryData);
};

// Schließt das Validierungs-Alert
const closeValidationAlert = () => {
  showValidationAlert.value = false;
};

const categoryGroups = computed(
  () => CategoryService.getCategoryGroups().value
);

</script>

<template>
  <div class="relative">
    <!-- Header mit Switches und Saldo -->
    <div class="flex justify-between items-start mb-6">
      <div class="flex gap-4">
        <div class="form-control">
          <label class="label cursor-pointer gap-2">
            <span class="label-text">Aktiv</span>
            <input
              type="checkbox"
              v-model="isActive"
              class="toggle toggle-sm toggle-primary"
            />
          </label>
        </div>
        <div class="form-control">
          <label class="label cursor-pointer gap-2">
            <span class="label-text">Versteckt</span>
            <input
              type="checkbox"
              v-model="isHidden"
              class="toggle toggle-sm toggle-primary"
            />
          </label>
        </div>
      </div>

      <div v-if="props.category" class="text-right">
        <div class="text-sm text-base-content/70 mb-1">Akt. Saldo</div>
        <CurrencyDisplay
          :amount="balance"
          :show-zero="true"
          :as-integer="true"
        />
      </div>
    </div>

    <!-- X-Icon zum Schließen -->
    <button
      type="button"
      class="btn btn-sm btn-circle btn-ghost absolute right-2 -top-12 z-10"
      @click="emit('cancel')"
    >
      <Icon
        icon="mdi:close"
        class="text-lg"
      />
    </button>

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
      @submit.prevent="saveCategory"
      class="space-y-4"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Name<span class="text-error">*</span>
          </legend>
          <input
            type="text"
            v-model="name"
            class="input input-bordered w-full"
            required
            placeholder="Kategoriename"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Lebensbereich<span class="text-error">*</span>
          </legend>
          <select
            v-model="categoryGroupId"
            class="select select-bordered w-full"
            required
          >
            <option
              v-for="group in categoryGroups"
              :key="group.id"
              :value="group.id"
            >
              {{ group.name }}
            </option>
          </select>
        </fieldset>
      </div>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Beschreibung</legend>
        <input
          type="text"
          v-model="description"
          class="input input-bordered w-full"
          placeholder="Kurze Beschreibung"
        />
      </fieldset>

      <!-- Regelverteilung bei Budgetplanung -->
      <div class="divider pt-6">Regelverteilung bei Budgetplanung</div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">Mtl. Betrag</legend>
          <CurrencyInput
            v-model="monthlyAmount"
            :borderless="false"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Priorität</legend>
          <input
            type="number"
            v-model.number="priority"
            class="input input-bordered"
            min="0"
            max="10"
            placeholder="0-10"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Anteil (%)</legend>
          <input
            type="number"
            v-model.number="proportion"
            class="input input-bordered"
            min="0"
            max="100"
            step="0.1"
            placeholder="0-100"
          />
        </fieldset>
      </div>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text text-xs">Als Sparziel verwenden</span>
          <input
            type="checkbox"
            v-model="isSavingsGoal"
            class="toggle toggle-primary"
          />
        </label>
      </div>

      <div
        v-if="isSavingsGoal"
        class="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Zielbetrag<span class="text-error">*</span>
          </legend>
          <CurrencyInput
            v-model="targetAmount"
            :borderless="false"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Zieldatum</legend>
          <input
            type="date"
            v-model="goalDate"
            class="input input-bordered"
            placeholder="tt.mm.jjjj"
          />
        </fieldset>
      </div>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Notiz</legend>
        <textarea
          v-model="note"
          class="textarea textarea-bordered"
          rows="3"
          placeholder="Zusätzliche Informationen zur Kategorie"
        ></textarea>
      </fieldset>

      <div class="flex justify-end pt-4">
        <ButtonGroup
          left-label="Abbrechen"
          right-label="Speichern"
          left-color="btn-ghost"
          right-color="btn-primary"
          @left-click="emit('cancel')"
          @right-click="saveCategory"
        />
      </div>
    </form>
  </div>
</template>
