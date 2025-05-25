<script setup lang="ts">
import { ref, computed, watch } from "vue";

const props = defineProps<{
  modelValue: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits(["update:modelValue"]);

const inputDate = ref(props.modelValue);

// Voreingestellte Zeiträume
const presets = [
  { label: "Heute", days: 0 },
  { label: "Gestern", days: -1 },
  { label: "Letzte Woche", days: -7 },
  { label: "Letzter Monat", days: -30 },
  { label: "Anfang des Monats", type: "startOfMonth" },
  { label: "Ende des Monats", type: "endOfMonth" },
];

// Aktualisiere den Input, wenn sich der modelValue ändert
watch(
  () => props.modelValue,
  (newValue) => {
    inputDate.value = newValue;
  }
);

// Aktualisiere den modelValue, wenn sich der Input ändert
function updateDate(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("update:modelValue", target.value);
}

// Setze ein voreingestelltes Datum
function setPresetDate(preset: {
  label: string;
  days?: number;
  type?: string;
}) {
  const today = new Date();
  let date: Date;

  if (preset.type === "startOfMonth") {
    date = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset.type === "endOfMonth") {
    date = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (preset.days !== undefined) {
    date = new Date();
    date.setDate(today.getDate() + preset.days);
  } else {
    return;
  }

  const formattedDate = formatDateForInput(date);
  inputDate.value = formattedDate;
  emit("update:modelValue", formattedDate);
}

// Formatiere ein Datum für das Input-Feld (YYYY-MM-DD)
function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
      <span v-if="required" class="text-error">*</span>
    </label>

    <div class="flex">
      <input
        type="date"
        class="input input-bordered w-full"
        :value="inputDate"
        @input="updateDate"
        :disabled="disabled"
        :required="required"
      />

      <div class="dropdown dropdown-end ml-1">
        <label tabindex="0" class="btn btn-square btn-ghost btn-sm">
          <Icon icon="mdi:calendar-month" class="text-lg" />
        </label>
        <ul
          tabindex="0"
          class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 border-1 border-base-300"
        >
          <li v-for="preset in presets" :key="preset.label">
            <a @click="setPresetDate(preset)">{{ preset.label }}</a>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
