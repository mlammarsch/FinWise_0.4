<!-- Datei: src/components/ui/DateRangePicker.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
import ButtonGroup from "./ButtonGroup.vue";

interface DateRange {
  start: string;
  end: string;
}

const props = defineProps<{
  modelValue?: DateRange;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: DateRange): void;
}>();

// State
const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragStart = ref<string | null>(null);
const hoverDate = ref<string | null>(null);
const dropdownPosition = ref<"left" | "center" | "right">("left");

// Current displayed months (left = previous month, right = current month)
const currentDate = ref(dayjs());
const leftMonth = computed(() => currentDate.value.subtract(1, "month"));
const rightMonth = computed(() => currentDate.value);

// Working range (for preview) and committed range (actual value)
const workingRange = ref<DateRange>({
  start:
    props.modelValue?.start ||
    dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  end: props.modelValue?.end || dayjs().endOf("month").format("YYYY-MM-DD"),
});

const committedRange = ref<DateRange>({
  start:
    props.modelValue?.start ||
    dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  end: props.modelValue?.end || dayjs().endOf("month").format("YYYY-MM-DD"),
});

// Default range: Letzte 2 Monate (Vormonat + aktueller Monat)
const getDefaultRange = () => ({
  start: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  end: dayjs().endOf("month").format("YYYY-MM-DD"),
});

// Shortcuts
const shortcuts = [
  {
    label: "Letzte 30 Tage",
    getValue: () => ({
      start: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
      end: dayjs().format("YYYY-MM-DD"),
    }),
  },
  {
    label: "Letzte 60 Tage",
    getValue: () => ({
      start: dayjs().subtract(60, "day").format("YYYY-MM-DD"),
      end: dayjs().format("YYYY-MM-DD"),
    }),
  },
  {
    label: "Dieser Monat",
    getValue: () => ({
      start: dayjs().startOf("month").format("YYYY-MM-DD"),
      end: dayjs().endOf("month").format("YYYY-MM-DD"),
    }),
  },
  {
    label: "Letzter Monat",
    getValue: () => ({
      start: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
      end: dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
    }),
  },
  {
    label: "Letzte 2 Monate",
    getValue: getDefaultRange,
  },
  {
    label: "Dieses Quartal",
    getValue: () => {
      const currentMonth = dayjs().month();
      const quarterStart = Math.floor(currentMonth / 3) * 3;
      return {
        start: dayjs()
          .month(quarterStart)
          .startOf("month")
          .format("YYYY-MM-DD"),
        end: dayjs()
          .month(quarterStart + 2)
          .endOf("month")
          .format("YYYY-MM-DD"),
      };
    },
  },
  {
    label: "Dieses Jahr",
    getValue: () => ({
      start: dayjs().startOf("year").format("YYYY-MM-DD"),
      end: dayjs().endOf("year").format("YYYY-MM-DD"),
    }),
  },
  {
    label: "Letztes Jahr",
    getValue: () => ({
      start: dayjs().subtract(1, "year").startOf("year").format("YYYY-MM-DD"),
      end: dayjs().subtract(1, "year").endOf("year").format("YYYY-MM-DD"),
    }),
  },
];

// Generate calendar days for a month
const generateCalendarDays = (month: dayjs.Dayjs) => {
  const startOfMonth = month.startOf("month");
  const endOfMonth = month.endOf("month");
  const startOfWeek = startOfMonth.startOf("week").add(1, "day"); // Monday start
  const endOfWeek = endOfMonth.endOf("week").add(1, "day"); // Monday start

  const days = [];
  let current = startOfWeek;

  while (current.isBefore(endOfWeek) || current.isSame(endOfWeek, "day")) {
    days.push({
      date: current.format("YYYY-MM-DD"),
      day: current.date(),
      isCurrentMonth: current.isSame(month, "month"),
      isToday: current.isSame(dayjs(), "day"),
      dayjs: current,
    });
    current = current.add(1, "day");
  }

  return days;
};

const leftCalendarDays = computed(() => generateCalendarDays(leftMonth.value));
const rightCalendarDays = computed(() =>
  generateCalendarDays(rightMonth.value)
);

// Navigation
const navigateMonth = (direction: "prev" | "next") => {
  if (direction === "prev") {
    currentDate.value = currentDate.value.subtract(1, "month");
  } else {
    currentDate.value = currentDate.value.add(1, "month");
  }
};

const navigateYear = (direction: "prev" | "next") => {
  if (direction === "prev") {
    currentDate.value = currentDate.value.subtract(1, "year");
  } else {
    currentDate.value = currentDate.value.add(1, "year");
  }
};

// Date selection logic
const handleDateClick = (dateStr: string) => {
  if (!workingRange.value.start || workingRange.value.end) {
    // Start new selection
    workingRange.value = { start: dateStr, end: "" };
    dragStart.value = dateStr;
    isDragging.value = true;
  } else {
    // Complete selection
    const start = dayjs(workingRange.value.start);
    const end = dayjs(dateStr);

    if (start.isAfter(end)) {
      workingRange.value = { start: dateStr, end: workingRange.value.start };
    } else {
      workingRange.value.end = dateStr;
    }

    isDragging.value = false;
    dragStart.value = null;
    hoverDate.value = null;
  }
};

const handleDateHover = (dateStr: string) => {
  if (isDragging.value && workingRange.value.start) {
    hoverDate.value = dateStr;
  }
};

// Check if date is in range (improved for continuous range display)
const isDateInRange = (dateStr: string) => {
  if (!workingRange.value.start) return false;

  const date = dayjs(dateStr);
  const start = dayjs(workingRange.value.start);

  if (workingRange.value.end) {
    const end = dayjs(workingRange.value.end);
    return date.isSameOrAfter(start, "day") && date.isSameOrBefore(end, "day");
  } else if (isDragging.value && hoverDate.value) {
    const hover = dayjs(hoverDate.value);
    const rangeStart = start.isBefore(hover) ? start : hover;
    const rangeEnd = start.isBefore(hover) ? hover : start;
    return (
      date.isSameOrAfter(rangeStart, "day") &&
      date.isSameOrBefore(rangeEnd, "day")
    );
  }

  return date.isSame(start, "day");
};

const isDateRangeStart = (dateStr: string) => {
  if (!workingRange.value.start) return false;

  if (workingRange.value.end) {
    return dayjs(dateStr).isSame(workingRange.value.start, "day");
  } else if (isDragging.value && hoverDate.value) {
    const start = dayjs(workingRange.value.start);
    const hover = dayjs(hoverDate.value);
    const rangeStart = start.isBefore(hover) ? start : hover;
    return dayjs(dateStr).isSame(rangeStart, "day");
  }

  return dayjs(dateStr).isSame(workingRange.value.start, "day");
};

const isDateRangeEnd = (dateStr: string) => {
  if (!workingRange.value.start) return false;

  if (workingRange.value.end) {
    return dayjs(dateStr).isSame(workingRange.value.end, "day");
  } else if (isDragging.value && hoverDate.value) {
    const start = dayjs(workingRange.value.start);
    const hover = dayjs(hoverDate.value);
    const rangeEnd = start.isBefore(hover) ? hover : start;
    return dayjs(dateStr).isSame(rangeEnd, "day");
  }

  return false;
};

// Shortcut selection - emit immediately
const selectShortcut = (shortcut: (typeof shortcuts)[0]) => {
  const range = shortcut.getValue();
  workingRange.value = range;
  committedRange.value = range;
  emit("update:modelValue", range);
  isOpen.value = false;
};

// Confirm selection
const confirmSelection = () => {
  if (workingRange.value.start && workingRange.value.end) {
    committedRange.value = { ...workingRange.value };
    emit("update:modelValue", committedRange.value);
    isOpen.value = false;
  }
};

// Cancel selection
const cancelSelection = () => {
  workingRange.value = { ...committedRange.value };
  isDragging.value = false;
  dragStart.value = null;
  hoverDate.value = null;
  isOpen.value = false;
};

// Calculate optimal dropdown position
const calculateDropdownPosition = () => {
  if (!containerRef.value || !dropdownRef.value) return;

  const container = containerRef.value.getBoundingClientRect();
  const dropdown = dropdownRef.value.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Check available space on each side
  const spaceLeft = container.left;
  const spaceRight = viewport.width - container.right;
  const spaceCenter = Math.min(spaceLeft, spaceRight);

  // Dropdown width is approximately 800px
  const dropdownWidth = 800;

  if (spaceRight >= dropdownWidth) {
    dropdownPosition.value = "left";
  } else if (spaceLeft >= dropdownWidth) {
    dropdownPosition.value = "right";
  } else if (spaceCenter >= dropdownWidth / 2) {
    dropdownPosition.value = "center";
  } else {
    // Fallback to left if no good position
    dropdownPosition.value = "left";
  }
};

// Format display value (original range format)
const displayValue = computed(() => {
  if (committedRange.value.start && committedRange.value.end) {
    const start = dayjs(committedRange.value.start);
    const end = dayjs(committedRange.value.end);
    return `${start.format("DD.MM.YYYY")} - ${end.format("DD.MM.YYYY")}`;
  }
  return "Zeitraum wählen";
});

// Close on outside click
const handleClickOutside = (event: Event) => {
  if (
    containerRef.value &&
    !containerRef.value.contains(event.target as Node)
  ) {
    cancelSelection();
  }
};

// Watch for dropdown open/close to calculate position
watch(isOpen, (newValue) => {
  if (newValue) {
    // Use nextTick to ensure DOM is updated
    setTimeout(() => {
      calculateDropdownPosition();
    }, 0);
  }
});

// Watch for prop changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      workingRange.value = { ...newValue };
      committedRange.value = { ...newValue };
    }
  },
  { deep: true }
);

onMounted(() => {
  document.addEventListener("click", handleClickOutside);

  // Set default range if no modelValue is provided
  if (!props.modelValue?.start || !props.modelValue?.end) {
    const defaultRange = getDefaultRange();
    workingRange.value = defaultRange;
    committedRange.value = defaultRange;
    emit("update:modelValue", defaultRange);
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

// Weekday labels
const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
</script>

<template>
  <div
    class="relative"
    ref="containerRef"
  >
    <!-- Trigger Button (MonthSelector style) -->
    <button
      @click="isOpen = !isOpen"
      class="btn btn-sm btn-outline rounded-full min-w-[200px] justify-between border border-base-300"
      :class="{
        'border-2 border-accent': committedRange.start && committedRange.end,
      }"
    >
      <span class="text-sm">{{ displayValue }}</span>
      <Icon
        icon="mdi:calendar-range"
        class="text-base"
      />
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="absolute top-full mt-2 bg-base-100 border border-base-300 rounded-lg shadow-xl z-50 p-4 min-w-[800px]"
      :class="{
        'left-0': dropdownPosition === 'left',
        'right-0': dropdownPosition === 'right',
        'left-1/2 transform -translate-x-1/2': dropdownPosition === 'center',
      }"
    >
      <div class="flex gap-4">
        <!-- Shortcuts -->
        <div class="w-48 border-r border-base-300 pr-4">
          <h3 class="font-semibold text-sm mb-3 text-base-content/70">
            Schnellauswahl
          </h3>
          <div class="space-y-1">
            <button
              v-for="shortcut in shortcuts"
              :key="shortcut.label"
              @click="selectShortcut(shortcut)"
              class="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-base-200 transition-colors"
            >
              {{ shortcut.label }}
            </button>
          </div>
        </div>

        <!-- Calendar -->
        <div class="flex-1">
          <!-- Navigation -->
          <div class="flex items-center justify-between mb-4">
            <button
              @click="navigateMonth('prev')"
              class="btn btn-ghost btn-sm btn-circle"
            >
              <Icon
                icon="mdi:chevron-left"
                class="text-lg"
              />
            </button>

            <div class="flex items-center gap-4">
              <button
                @click="navigateYear('prev')"
                class="btn btn-ghost btn-xs"
              >
                <Icon
                  icon="mdi:chevron-double-left"
                  class="text-sm"
                />
              </button>

              <span class="font-semibold text-lg">{{
                currentDate.year()
              }}</span>

              <button
                @click="navigateYear('next')"
                class="btn btn-ghost btn-xs"
              >
                <Icon
                  icon="mdi:chevron-double-right"
                  class="text-sm"
                />
              </button>
            </div>

            <button
              @click="navigateMonth('next')"
              class="btn btn-ghost btn-sm btn-circle"
            >
              <Icon
                icon="mdi:chevron-right"
                class="text-lg"
              />
            </button>
          </div>

          <!-- Two Month View -->
          <div class="grid grid-cols-2 gap-6">
            <!-- Left Month -->
            <div>
              <h4 class="text-center font-medium mb-3">
                {{ leftMonth.format("MMMM YYYY") }}
              </h4>

              <!-- Weekday Headers -->
              <div class="grid grid-cols-7 gap-1 mb-2">
                <div
                  v-for="day in weekdays"
                  :key="day"
                  class="text-center text-xs font-medium text-base-content/60 py-1"
                >
                  {{ day }}
                </div>
              </div>

              <!-- Calendar Days -->
              <div class="grid grid-cols-7 gap-0">
                <button
                  v-for="dayData in leftCalendarDays"
                  :key="dayData.date"
                  @click="handleDateClick(dayData.date)"
                  @mouseenter="handleDateHover(dayData.date)"
                  class="aspect-square text-sm transition-all duration-150 relative"
                  :class="{
                    'text-base-content/30': !dayData.isCurrentMonth,
                    'text-base-content': dayData.isCurrentMonth,
                    'bg-primary text-primary-content rounded-l-md':
                      isDateRangeStart(dayData.date),
                    'bg-primary text-primary-content rounded-r-md':
                      isDateRangeEnd(dayData.date),
                    'bg-primary text-primary-content rounded-md':
                      isDateRangeStart(dayData.date) &&
                      isDateRangeEnd(dayData.date),
                    'bg-base-300':
                      isDateInRange(dayData.date) &&
                      !isDateRangeStart(dayData.date) &&
                      !isDateRangeEnd(dayData.date),
                    'hover:bg-base-200 rounded-md':
                      dayData.isCurrentMonth && !isDateInRange(dayData.date),
                    'ring-2 ring-primary ring-offset-2': dayData.isToday,
                    'cursor-pointer': dayData.isCurrentMonth,
                    'cursor-not-allowed': !dayData.isCurrentMonth,
                  }"
                  :disabled="!dayData.isCurrentMonth"
                >
                  {{ dayData.day }}
                </button>
              </div>
            </div>

            <!-- Right Month -->
            <div>
              <h4 class="text-center font-medium mb-3">
                {{ rightMonth.format("MMMM YYYY") }}
              </h4>

              <!-- Weekday Headers -->
              <div class="grid grid-cols-7 gap-1 mb-2">
                <div
                  v-for="day in weekdays"
                  :key="day"
                  class="text-center text-xs font-medium text-base-content/60 py-1"
                >
                  {{ day }}
                </div>
              </div>

              <!-- Calendar Days -->
              <div class="grid grid-cols-7 gap-0">
                <button
                  v-for="dayData in rightCalendarDays"
                  :key="dayData.date"
                  @click="handleDateClick(dayData.date)"
                  @mouseenter="handleDateHover(dayData.date)"
                  class="aspect-square text-sm transition-all duration-150 relative"
                  :class="{
                    'text-base-content/30': !dayData.isCurrentMonth,
                    'text-base-content': dayData.isCurrentMonth,
                    'bg-primary text-primary-content rounded-l-md':
                      isDateRangeStart(dayData.date),
                    'bg-primary text-primary-content rounded-r-md':
                      isDateRangeEnd(dayData.date),
                    'bg-primary text-primary-content rounded-md':
                      isDateRangeStart(dayData.date) &&
                      isDateRangeEnd(dayData.date),
                    'bg-base-300':
                      isDateInRange(dayData.date) &&
                      !isDateRangeStart(dayData.date) &&
                      !isDateRangeEnd(dayData.date),
                    'hover:bg-base-200 rounded-md':
                      dayData.isCurrentMonth && !isDateInRange(dayData.date),
                    'ring-2 ring-primary ring-offset-2': dayData.isToday,
                    'cursor-pointer': dayData.isCurrentMonth,
                    'cursor-not-allowed': !dayData.isCurrentMonth,
                  }"
                  :disabled="!dayData.isCurrentMonth"
                >
                  {{ dayData.day }}
                </button>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end mt-4 pt-4 border-t border-base-300">
            <div class="text-xs">
              <ButtonGroup
                left-label="Abbrechen"
                right-label="Übernehmen"
                left-color="btn-soft btn-sm"
                right-color="btn-primary btn-sm"
                @left-click="cancelSelection"
                @right-click="confirmSelection"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Calendar styling with continuous range blocks */

/* Add small margin to all calendar buttons for spacing */
.grid-cols-7 button {
  margin: 1px;
}

/* Range middle days - no border radius, extend to fill gaps */
.grid-cols-7
  button.bg-base-300:not(.rounded-l-md):not(.rounded-r-md):not(.rounded-md) {
  border-radius: 0 !important;
  margin: 0 !important;
}

/* Range start styling - keep original classes working */
.grid-cols-7 button.rounded-l-md {
  margin: 0 0 0 1px !important;
}

/* Range end styling - keep original classes working */
.grid-cols-7 button.rounded-r-md {
  margin: 0 1px 0 0 !important;
}

/* Single day selection (start and end same day) - keep original classes working */
.grid-cols-7 button.rounded-md {
  margin: 1px !important;
}

/* Week boundaries for range middle days */
.grid-cols-7 button.bg-primary\/40:nth-child(7n + 1):not(.rounded-l-md) {
  border-top-left-radius: 0.375rem !important;
  border-bottom-left-radius: 0.375rem !important;
  margin-left: 1px !important;
}

.grid-cols-7 button.bg-primary\/40:nth-child(7n):not(.rounded-r-md) {
  border-top-right-radius: 0.375rem !important;
  border-bottom-right-radius: 0.375rem !important;
  margin-right: 1px !important;
}

/* Special cases: range start/end at week boundaries */
.grid-cols-7 button.rounded-l-md:nth-child(7n) {
  border-radius: 0.375rem !important;
  margin: 1px !important;
}

.grid-cols-7 button.rounded-r-md:nth-child(7n + 1) {
  border-radius: 0.375rem !important;
  margin: 1px !important;
}
</style>
