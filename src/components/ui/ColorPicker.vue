<script setup lang="ts">
const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "farbe-intensity", value: string): void;
}>();

const colors = [
  "primary",
  "secondary",
  "accent",
  "info",
  "success",
  "warning",
  "error",
];

const selectColor = (color: string) => {
  emit("farbe-intensity", color);
};
</script>

<template>
  <div class="bg-base-100 p-6 rounded shadow-lg border border-base-300 w-54">
    <h3 class="text-lg font-bold mb-4">Farbe auswählen</h3>

    <div class="flex flex-col gap-2 mb-6 items-center">
      <span
        v-for="color in colors"
        :key="color"
        class="badge badge-soft badge-lg text-white text-sm font-medium rounded-full cursor-pointer w-24 justify-center"
        :class="`badge-${color}`"
        @click="selectColor(color)"
      >
        {{ color }}
      </span>
    </div>

    <div class="text-right">
      <button class="btn btn-sm btn-ghost" @click="emit('cancel')">
        Abbrechen
      </button>
    </div>
  </div>
</template>
