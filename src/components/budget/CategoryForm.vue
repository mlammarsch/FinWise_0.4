<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Category } from "../../types";
import { CategoryService } from "../../services/CategoryService";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
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
const isSavingsGoal = ref(false);
const targetAmount = ref(0);
const targetDate = ref("");
const categoryGroupId = ref("");
const parentCategoryId = ref<string | undefined>(undefined);
const balance = ref(0);

// Validierung
const submitAttempted = ref(false);
const showValidationAlert = ref(false);

// Lade die Daten, wenn eine Kategorie zum Bearbeiten übergeben wurde
onMounted(() => {
  if (props.category) {
    name.value = props.category.name;
    description.value = ""; // Category hat keine description property
    isActive.value = props.category.isActive;
    isSavingsGoal.value = props.category.isSavingsGoal || false;
    targetAmount.value = 0; // Category hat keine targetAmount property
    targetDate.value = ""; // Category hat keine targetDate property
    categoryGroupId.value = props.category.categoryGroupId || "";
    parentCategoryId.value = props.category.parentCategoryId;
    balance.value = props.category.available || 0;
  } else {
    const groups = CategoryService.getCategoryGroups().value;
    if (groups.length > 0) {
      categoryGroupId.value = groups[0].id;
    }
  }
});

// Konvertiere einen String in eine Zahl
const parseNumber = (value: string): number => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized) || 0;
};

// Formatiere eine Zahl für die Anzeige
const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return "0,00";
  return value.toString().replace(".", ",");
};

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
    isHidden: false,
    isActive: isActive.value,
    sortOrder: 0,
    categoryGroupId: categoryGroupId.value,
    parentCategoryId: parentCategoryId.value,
    isSavingsGoal: isSavingsGoal.value,
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

const parentCategories = computed(() => {
  return CategoryService.getCategories()
    .value.filter((cat) => !props.category || cat.id !== props.category.id)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
    }));
});
</script>

<template>
  <div class="relative">
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
        <legend class="fieldset-legend">Beschreibung</legend>
        <input
          type="text"
          v-model="description"
          class="input input-bordered w-full"
          placeholder="Kurze Beschreibung"
        />
      </fieldset>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Kategoriegruppe<span class="text-error">*</span>
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

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Übergeordnete Kategorie</legend>
          <select
            v-model="parentCategoryId"
            class="select select-bordered w-full"
          >
            <option :value="undefined">Keine (Hauptkategorie)</option>
            <option
              v-for="category in parentCategories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
        </fieldset>
      </div>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Als Sparziel verwenden</span>
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
        <div class="form-control">
          <label class="label">
            <span class="label-text">Zielbetrag</span>
            <span class="text-error">*</span>
          </label>
          <div class="input-group">
            <input
              type="text"
              :value="formatNumber(targetAmount)"
              @input="
                targetAmount = parseNumber(
                  ($event.target as HTMLInputElement).value
                )
              "
              class="input input-bordered w-full"
              :required="isSavingsGoal"
              placeholder="0,00"
            />
          </div>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Zieldatum</span>
          </label>
          <input
            type="date"
            v-model="targetDate"
            class="input input-bordered"
            placeholder="Zieldatum"
          />
        </div>
      </div>

      <div
        v-if="props.category"
        class="form-control"
      >
        <label class="label">
          <span class="label-text">Aktueller Saldo</span>
        </label>
        <CurrencyDisplay
          :amount="balance"
          :show-zero="true"
          :as-integer="false"
        />
      </div>

      <div class="form-control">
        <label class="label cursor-pointer">
          <span class="label-text">Aktiv</span>
          <input
            type="checkbox"
            v-model="isActive"
            class="toggle toggle-primary"
          />
        </label>
      </div>

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
