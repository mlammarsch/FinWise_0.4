<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps({
  modelValue: { type: String, default: "" },
  options: { type: Array, default: () => [] },
  label: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  itemText: { type: String, default: "name" },
  itemValue: { type: String, default: "id" },
});

const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const searchTerm = ref("");

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".custom-dropdown-container")) {
    isOpen.value = false;
  }
}

onMounted(() => {
  watch(
    isOpen,
    (val) => {
      if (val) window.addEventListener("click", onClickOutside);
      else window.removeEventListener("click", onClickOutside);
    },
    { immediate: true }
  );
});

const filteredOptions = computed(() => {
  let arr = [...props.options].sort((a, b) => {
    const A = String(a[props.itemText]).toLowerCase();
    const B = String(b[props.itemText]).toLowerCase();
    return A.localeCompare(B);
  });
  if (searchTerm.value.trim()) {
    const term = searchTerm.value.toLowerCase();
    arr = arr.filter((opt) =>
      String(opt[props.itemText]).toLowerCase().includes(term)
    );
  }
  return arr;
});

const selectedLabel = computed(() => {
  if (!props.modelValue) return "";
  const found = props.options.find(
    (o) => String(o[props.itemValue]) === String(props.modelValue)
  );
  return found ? found[props.itemText] : "";
});

function toggleDropdown() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
}

function selectOption(value: string) {
  emit("update:modelValue", value);
  isOpen.value = false;
  searchTerm.value = "";
}
</script>

<template>
  <div class="form-control w-full custom-dropdown-container relative">
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
      <span v-if="required" class="text-error">*</span>
    </label>

    <!-- Hauptfeld -->
    <div
      class="input input-sm input-bordered text-xs w-full flex items-center justify-between cursor-pointer rounded-full"
      :class="{
        'opacity-60': disabled,
        'border-2 border-accent': modelValue,
        'border-base-300': !modelValue,
      }"
      @click="toggleDropdown"
    >
      <span v-if="selectedLabel">{{ selectedLabel }}</span>
      <span v-else>{{ placeholder || "-kein Filter-" }}</span>
      <Icon icon="mdi:arrow-down-drop" class="ml-2 text-lg" />
    </div>

    <!-- Dropdown-Liste -->
    <div
      v-if="isOpen"
      class="mt-1 w-38 bg-base-100 rounded-box shadow-lg border border-base-300 absolute z-40"
    >
      <!-- Eingabefeld im Dropdown -->
      <div class="p-2">
        <input
          type="text"
          class="input input-sm input-bordered w-full"
          v-model="searchTerm"
          placeholder="Suchen..."
          @click.stop
        />
      </div>
      <ul class="max-h-60 overflow-y-auto p-2">
        <!-- Option für 'kein Filter' -->
        <li
          class="p-1 hover:bg-base-200 rounded cursor-pointer"
          @click="selectOption('')"
        >
          -kein Filter-
        </li>
        <!-- Alphabetisch sortierte Items -->
        <li
          v-for="opt in filteredOptions"
          :key="opt[props.itemValue]"
          class="p-1 hover:bg-base-200 rounded cursor-pointer"
          @click="selectOption(opt[props.itemValue])"
        >
          {{ opt[props.itemText] }}
        </li>
      </ul>
    </div>
  </div>
</template>
