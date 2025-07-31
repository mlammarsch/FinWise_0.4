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

import { computed, ref, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";

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

function onDisplayedMonthsChange(monthCount: number) {
  emits("updateDisplayedMonths", monthCount);
}

// Icons für verschiedene Monatsanzahlen
const monthIcons = computed(() => [
  { count: 1, icon: "mdi:calendar-blank", tooltip: "1 Monat" },
  { count: 2, icon: "mdi:calendar-blank", tooltip: "2 Monate" },
  { count: 3, icon: "mdi:calendar-blank", tooltip: "3 Monate" },
  { count: 4, icon: "mdi:calendar-blank", tooltip: "4 Monate" },
  { count: 5, icon: "mdi:calendar-blank", tooltip: "5 Monate" },
  { count: 6, icon: "mdi:calendar-blank", tooltip: "6 Monate" },
]);

// Responsive Bildschirmbreite tracking
const windowWidth = ref(
  typeof window !== "undefined" ? window.innerWidth : 1200
);

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  if (typeof window !== "undefined") {
    window.addEventListener("resize", updateWindowWidth);
    updateWindowWidth();
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", updateWindowWidth);
  }
});

// Responsive Anzahl der sichtbaren Icons basierend auf Bildschirmbreite
const visibleIconCount = computed(() => {
  // Responsive Breakpoints für Icon-Anzahl
  if (windowWidth.value < 640) return 3; // sm: 3 Icons
  if (windowWidth.value < 768) return 4; // md: 4 Icons
  if (windowWidth.value < 1024) return 5; // lg: 5 Icons
  return 6; // xl und größer: alle 6 Icons
});
</script>

<template>
  <div class="flex items-end justify-between w-full max-w-4xl">
    <!-- Links: Leer für Balance -->
    <div class="flex-shrink-0 w-[10%]">
      <!-- Platzhalter für zukünftige Elemente -->
    </div>

    <!-- Rechts: Monatsspaltensatz Auswahl mit Icons (rechtsbündig) -->
    <div class="flex items-center flex-shrink-0 justify-start">
      <button
        v-for="iconData in monthIcons.slice(0, visibleIconCount)"
        :key="iconData.count"
        class="btn btn-xs p-0 transition-all duration-200"
        :class="{
          'btn-ghost': iconData.count <= props.displayedMonths,
          'btn-ghost opacity-40': iconData.count > props.displayedMonths,
        }"
        :title="iconData.tooltip"
        @click="onDisplayedMonthsChange(iconData.count)"
      >
        <Icon
          :icon="iconData.icon"
          class="w-4 h-4"
        />
      </button>
    </div>

    <div class="flex-shrink-0 w-[5%]">
      <!-- Platzhalter für zukünftige Elemente -->
    </div>

    <!-- Mitte: Kalenderansicht -->
    <div class="flex flex-col gap-1 flex-grow mx-2">
      <!-- Jahresbeschriftungen -->
      <div class="flex gap-1 justify-center">
        <div
          v-for="(m, idx) in months"
          :key="'year-' + m.offset"
          class="w-10 text-center text-xs"
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
      <div class="flex gap-0 justify-center">
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


  </div>
</template>

<style scoped></style>
