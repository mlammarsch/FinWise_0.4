<!-- Datei: src/components/ui/PagingYearComponent.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/PagingYearComponent.vue
 * Zeigt 19 Monate (±9 um aktuellen Monat) in einer Zeile, Jahr-Marker darüber.
 *
 * Komponenten-Props:
 * - displayedMonths: number
 * - currentStartMonthOffset: number
 *
 * Emits:
 * - updateStartOffset(number)
 * - updateDisplayedMonths(number)
 */

import { computed } from "vue";

const props = defineProps<{
  displayedMonths: number;
  currentStartMonthOffset: number;
}>();

const emits = defineEmits<{
  (e: "updateStartOffset", val: number): void;
  (e: "updateDisplayedMonths", val: number): void;
}>();

// Liste aller Monate: current -9 bis +9
const months = computed(() => {
  const now = new Date();
  const result: {
    year: number;
    month: number;
    label: string;
    offset: number;
    isJanuary: boolean;
  }[] = [];

  for (let i = -7; i <= 7; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const offset = i;
    const label = date.toLocaleString("de-DE", { month: "short" });

    result.push({
      year,
      month,
      label,
      offset,
      isJanuary: month === 0,
    });
  }

  return result;
});

// Klick auf Monatsbutton → neuen StartOffset setzen
function onMonthClick(offset: number) {
  emits("updateStartOffset", offset);
}

function onDisplayedMonthsChange(event: Event) {
  const val = parseInt((event.target as HTMLSelectElement).value, 10);
  emits("updateDisplayedMonths", val);
}
</script>

<template>
  <div class="flex items-end">
    <div class="flex flex-col gap-1">
      <!-- Jahresbeschriftungen -->
      <div class="flex gap-1">
        <div
          v-for="(m, idx) in months"
          :key="'year-' + m.offset"
          class="w-10 text-left text-xs"
        >
          <span
            v-if="
              m.isJanuary ||
              (idx === 0 &&
                !months.some((mo) => mo.offset < m.offset && mo.isJanuary))
            "
            >{{ m.year }}</span
          >
        </div>
      </div>

      <!-- Monatsbuttons -->
      <div class="flex gap-0">
        <button
          v-for="m in months"
          :key="m.offset"
          class="btn btn-xs w-10"
          :class="{
            'btn-primary':
              m.offset >= props.currentStartMonthOffset &&
              m.offset < props.currentStartMonthOffset + props.displayedMonths,
          }"
          @click="onMonthClick(m.offset)"
        >
          {{ m.label }}
        </button>
      </div>
    </div>

    <!-- Monatsspaltensatz Auswahl -->
    <div class="mt-2 flex items-center gap-2">
      <span class="text-sm">Anz. Monate:</span>
      <select
        class="select select-bordered select-xs w-20"
        :value="props.displayedMonths"
        @change="onDisplayedMonthsChange"
      >
        <option v-for="n in [1, 2, 3, 4, 5, 6]" :key="n" :value="n">
          {{ n }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped></style>
