<script setup lang="ts">
import { ref, computed } from "vue";

interface Props {
  modelValue: string[];
  placeholder?: string;
  disabled?: boolean;
}

interface Emits {
  (e: "update:modelValue", value: string[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Wert eingeben...",
  disabled: false,
});

const emit = defineEmits<Emits>();

const inputValue = ref("");
const inputRef = ref<HTMLInputElement>();

const values = computed({
  get: () => props.modelValue,
  set: (newValue: string[]) => emit("update:modelValue", newValue),
});

function addValue(value: string) {
  const trimmedValue = value.trim();
  if (trimmedValue && !values.value.includes(trimmedValue)) {
    values.value = [...values.value, trimmedValue];
  }
  inputValue.value = "";
}

function removeValue(index: number) {
  values.value = values.value.filter((_, i) => i !== index);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addValue(inputValue.value);
  } else if (
    event.key === "Backspace" &&
    inputValue.value === "" &&
    values.value.length > 0
  ) {
    // Letzten Wert entfernen wenn Input leer ist und Backspace gedrückt wird
    removeValue(values.value.length - 1);
  }
}

function handleBlur() {
  // Wert hinzufügen wenn Input verlassen wird und noch ein Wert eingegeben ist
  if (inputValue.value.trim()) {
    addValue(inputValue.value);
  }
}

function focusInput() {
  inputRef.value?.focus();
}
</script>

<template>
  <div
    class="input input-bordered flex flex-wrap items-center gap-1 p-2 min-h-[3rem] cursor-text"
    :class="{ 'input-disabled': disabled }"
    @click="focusInput"
  >
    <!-- Bestehende Tags -->
    <div
      v-for="(value, index) in values"
      :key="index"
      class="badge badge-primary gap-1 py-2 px-3"
    >
      <span>{{ value }}</span>
      <button
        v-if="!disabled"
        type="button"
        class="btn btn-ghost btn-xs p-0 w-4 h-4 min-h-0 hover:bg-primary-focus"
        @click.stop="removeValue(index)"
        :aria-label="`${value} entfernen`"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Input für neue Werte -->
    <input
      ref="inputRef"
      v-model="inputValue"
      type="text"
      :placeholder="values.length === 0 ? placeholder : ''"
      :disabled="disabled"
      class="flex-1 min-w-[120px] bg-transparent border-none outline-none"
      @keydown="handleKeydown"
      @blur="handleBlur"
    />
  </div>

  <!-- Hilfetext -->
  <div class="text-xs text-base-content/60 mt-1">
    Drücke Enter oder Komma, um einen Wert hinzuzufügen
  </div>
</template>

<style scoped>
/* Entferne Standard-Input-Styling für das innere Input */
input:focus {
  outline: none;
  box-shadow: none;
}

/* Hover-Effekt für das Container-Element */
.input:hover:not(.input-disabled) {
  border-color: hsl(var(--bc) / 0.4);
}

/* Focus-Effekt für das Container-Element */
.input:focus-within:not(.input-disabled) {
  outline: 2px solid hsl(var(--bc) / 0.2);
  outline-offset: 2px;
  border-color: hsl(var(--bc) / 0.4);
}

/* Disabled-Styling */
.input-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.input-disabled .badge {
  opacity: 0.7;
}
</style>
