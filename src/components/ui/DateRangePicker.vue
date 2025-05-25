<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

/**
 * Pfad zur Komponente: components/ui/DateRangePicker.vue
 *
 * Erweiterter Datepicker für Zeiträume mit Shortcut-Auswahl und Zwei-Monats-Ansicht.
 *
 * Komponenten-Props:
 * - modelValue: { start: string; end: string } - Der aktuelle Datumsbereich.
 *
 * Emits:
 * - update:modelValue - Gibt den neuen Datumsbereich zurück.
 */
const props = defineProps<{ modelValue: { start: string; end: string } }>();
const emit = defineEmits(["update:modelValue"]);

const isOpen = ref(false);
const selectedRange = ref({
  start: props.modelValue?.start ?? "",
  end: props.modelValue?.end ?? "",
});
const containerRef = ref<HTMLElement | null>(null);

const today = new Date();
const todayString = new Date().toISOString().split("T")[0];
const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

// Funktion zur Berechnung des ersten und letzten Tages eines Monats
const getFirstDayOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split("T")[0];

const predefinedRanges = [
  {
    label: "Heute",
    range: {
      start: todayString,
      end: todayString,
    },
  },
  {
    label: "Letzte 7 Tage",
    range: {
      start: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
      end: todayString,
    },
  },
  {
    label: "Letzte 30 Tage",
    range: {
      start: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
      end: todayString,
    },
  },
  {
    label: "Letzter Monat bis heute",
    range: {
      start: getFirstDayOfMonth(lastMonth),
      end: todayString,
    },
  },
  {
    label: "Letzte 3 Monate",
    range: {
      start: getFirstDayOfMonth(
        new Date(today.getFullYear(), today.getMonth() - 2, 1)
      ),
      end: todayString,
    },
  },
  {
    label: "Letzte 6 Monate",
    range: {
      start: getFirstDayOfMonth(
        new Date(today.getFullYear(), today.getMonth() - 5, 1)
      ),
      end: todayString,
    },
  },
  {
    label: "Laufendes Jahr",
    range: {
      start: new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0],
      end: todayString,
    },
  },
];

const setPredefinedRange = (preset: { start: string; end: string }) => {
  selectedRange.value = { ...preset };
  emit("update:modelValue", selectedRange.value);
  isOpen.value = false;
};

const daysInMonth = (month: number, year: number) =>
  new Date(year, month + 1, 0).getDate();

const generateMonthData = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const days = Array.from(
    { length: daysInMonth(month, year) },
    (_, i) => i + 1
  );
  return { month, year, days };
};

const lastMonthData = computed(() => generateMonthData(lastMonth));
const currentMonthData = computed(() => generateMonthData(currentMonth));

const selectDate = (year: number, month: number, day: number) => {
  const dateString = new Date(year, month, day).toISOString().split("T")[0];

  if (!selectedRange.value.start || selectedRange.value.end) {
    selectedRange.value = { start: dateString, end: "" };
  } else {
    selectedRange.value.end = dateString;
    if (selectedRange.value.start > selectedRange.value.end) {
      [selectedRange.value.start, selectedRange.value.end] = [
        selectedRange.value.end,
        selectedRange.value.start,
      ];
    }
  }

  emit("update:modelValue", selectedRange.value);
};

const closeOnClickOutside = (event: Event) => {
  if (
    containerRef.value &&
    !containerRef.value.contains(event.target as Node)
  ) {
    isOpen.value = false;
  }
};

onMounted(() => document.addEventListener("click", closeOnClickOutside));
onUnmounted(() => document.removeEventListener("click", closeOnClickOutside));

watch(
  () => props.modelValue,
  (newVal) => {
    selectedRange.value = { ...newVal };
  }
);
</script>

<template>
  <div
    class="relative w-60 max-w-4xl bg-base-100 border border-base-300"
    ref="containerRef"
  >
    <!-- Button für den DatePicker -->
    <button
      class="datepicker-button w-full"
      @click="isOpen = !isOpen"
    >
      <span>{{ selectedRange.start }} ~ {{ selectedRange.end }}</span>
      <Icon
        icon="mdi:calendar-range"
        class="text-lg text-gray-500"
      />
    </button>

    <div
      v-if="isOpen"
      class="absolute left-0 mt-2 bg-base-100 border border-base-200 rounded-md shadow-lg z-50 p-4 w-full"
    >
      <div class="grid grid-cols-4 gap-4">
        <!-- Shortcuts -->
        <div class="col-span-1 bg-base-100 p-3 rounded-md">
          <h4 class="text-sm font-semibold mb-2">Schnellauswahl</h4>
          <ul class="space-y-2">
            <li
              v-for="preset in predefinedRanges"
              :key="preset.label"
            >
              <button
                class="datepicker-shortcut w-full"
                @click="setPredefinedRange(preset.range)"
              >
                {{ preset.label }}
              </button>
            </li>
          </ul>
        </div>

        <!-- Kalenderansicht -->
        <div class="col-span-3 grid grid-cols-2 gap-4">
          <div
            v-for="calendar in [lastMonthData, currentMonthData]"
            :key="calendar.month"
            class="p-2 border rounded-md"
          >
            <h4 class="text-center font-medium text-sm mb-2">
              {{
                new Date(calendar.year, calendar.month).toLocaleDateString(
                  "de-DE",
                  {
                    month: "long",
                    year: "numeric",
                  }
                )
              }}
            </h4>
            <div class="grid grid-cols-7 text-center text-xs font-semibold">
              <span
                v-for="day in ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']"
                :key="day"
                >{{ day }}</span
              >
            </div>
            <div class="grid grid-cols-7 gap-1 mt-2">
              <span
                v-for="day in calendar.days"
                :key="day"
                class="datepicker-day"
                :class="{
                  'bg-primary text-white':
                    selectedRange.start ===
                    `${calendar.year}-${String(calendar.month + 1).padStart(
                      2,
                      '0'
                    )}-${String(day).padStart(2, '0')}`,
                  'bg-primary/20':
                    selectedRange.end ===
                    `${calendar.year}-${String(calendar.month + 1).padStart(
                      2,
                      '0'
                    )}-${String(day).padStart(2, '0')}`,
                }"
                @click="selectDate(calendar.year, calendar.month, day)"
              >
                {{ day }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
