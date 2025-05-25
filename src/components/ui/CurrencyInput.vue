<script setup lang="ts">
import { ref, watch, computed, onMounted, defineExpose } from "vue";

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0,
  },
  label: {
    type: String,
    default: "",
  },
  borderless: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const rawInputValue = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  rawInputValue.value =
    props.modelValue !== 0 ? formatToGermanCurrency(props.modelValue) : "";
});

watch(
  () => props.modelValue,
  (newValue) => {
    if (document.activeElement !== inputRef.value) {
      rawInputValue.value = formatToGermanCurrency(newValue);
    }
  }
);

const textClass = computed(() => {
  return props.modelValue < 0 ? "text-error" : "text-success";
});

const parseInput = (input: string): string => {
  let validInput = input.replace(/[^0-9,-]/g, "");
  const hasMinus = validInput.startsWith("-");
  validInput = validInput.replace(/-/g, "");
  if (hasMinus) validInput = "-" + validInput;

  const parts = validInput.split(",");
  if (parts.length > 2) validInput = parts[0] + "," + parts[1];
  else if (parts.length > 1 && parts[1].length > 2)
    validInput = parts[0] + "," + parts[1].slice(0, 2);

  return validInput;
};

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  rawInputValue.value = parseInput(target.value);
};

const onEnter = (event: KeyboardEvent) => {
  formatAndEmitValue();
  event.target?.dispatchEvent(new Event("change", { bubbles: true }));
};

const onBlur = () => formatAndEmitValue();

const formatAndEmitValue = () => {
  const parsedValue = parseGermanCurrency(rawInputValue.value);
  emit("update:modelValue", parsedValue);
  rawInputValue.value = formatToGermanCurrency(parsedValue);
};

const onFocus = (event: FocusEvent) => {
  const target = event.target as HTMLInputElement;
  setTimeout(() => target.select(), 0);
};

function formatToGermanCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseGermanCurrency(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

function focus() {
  inputRef.value?.focus();
}

function select() {
  inputRef.value?.select();
}

defineExpose({ focus, select });

const inputClasses = computed(() => {
  return props.borderless
    ? "input w-full text-right border-0"
    : "input w-full text-right";
});
</script>

<template>
  <div class="form-control">
    <label class="label" v-if="label">
      <span class="label-text">{{ label }}</span>
    </label>
    <div class="input-group">
      <input
        ref="inputRef"
        type="text"
        :class="inputClasses"
        v-model="rawInputValue"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.enter="onEnter"
      />
    </div>
  </div>
</template>
