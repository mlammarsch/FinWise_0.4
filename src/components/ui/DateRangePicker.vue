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
  (e: "navigate-month", direction: "prev" | "next"): void;
}>();

// State
const isOpen = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const dragStart = ref<string | null>(null);
const hoverDate = ref<string | null>(null);
const dropdownPosition = ref<"left" | "center" | "right">("left");
const dropdownStyles = ref<Record<string, string>>({});

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

// Generate calendar days for a month (only current month days)
const generateCalendarDays = (month: dayjs.Dayjs) => {
  const startOfMonth = month.startOf("month");
  const endOfMonth = month.endOf("month");
  const startOfWeek = startOfMonth.startOf("week").add(1, "day"); // Monday start

  const days = [];
  let emptyIndex = 0;

  // Add empty cells for days before month start
  let current = startOfWeek;
  while (current.isBefore(startOfMonth, "day")) {
    days.push({
      date: "",
      day: "",
      isCurrentMonth: false,
      isToday: false,
      dayjs: null,
      isEmpty: true,
      emptyKey: `empty-before-${month.format("YYYY-MM")}-${emptyIndex++}`,
    });
    current = current.add(1, "day");
  }

  // Add actual month days
  current = startOfMonth;
  while (current.isSameOrBefore(endOfMonth, "day")) {
    days.push({
      date: current.format("YYYY-MM-DD"),
      day: current.date(),
      isCurrentMonth: true,
      isToday: current.isSame(dayjs(), "day"),
      dayjs: current,
      isEmpty: false,
      emptyKey: null,
    });
    current = current.add(1, "day");
  }

  // Add empty cells to complete the grid (6 weeks = 42 cells)
  while (days.length < 42) {
    days.push({
      date: "",
      day: "",
      isCurrentMonth: false,
      isToday: false,
      dayjs: null,
      isEmpty: true,
      emptyKey: `empty-after-${month.format("YYYY-MM")}-${emptyIndex++}`,
    });
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

// Calculate optimal dropdown position for teleported element
const calculateDropdownPosition = () => {
  if (!containerRef.value) return;

  const container = containerRef.value.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Dropdown width is approximately 750px
  const dropdownWidth = 750;

  let left = container.left;
  let top = container.bottom + 8; // 8px gap below trigger

  // Check if dropdown would overflow right edge
  if (left + dropdownWidth > viewport.width) {
    left = viewport.width - dropdownWidth - 16; // 16px margin from edge
  }

  // Check if dropdown would overflow left edge
  if (left < 16) {
    left = 16; // 16px margin from edge
  }

  // Check if dropdown would overflow bottom edge
  if (top + 400 > viewport.height) { // Approximate dropdown height
    top = container.top - 400 - 8; // Show above trigger
  }

  dropdownStyles.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
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
  const target = event.target as Node;

  // Check if click is inside the trigger button
  if (containerRef.value && containerRef.value.contains(target)) {
    return;
  }

  // Check if click is inside the teleported dropdown
  if (dropdownRef.value && dropdownRef.value.contains(target)) {
    return;
  }

  // Click is outside both elements, close the dropdown
  cancelSelection();
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

// Navigation methods for external chevron buttons
const navigateRangeByMonth = (direction: "prev" | "next") => {
  const currentStart = dayjs(committedRange.value.start);
  const currentEnd = dayjs(committedRange.value.end);

  let newStart: dayjs.Dayjs;
  let newEnd: dayjs.Dayjs;

  if (direction === "prev") {
    newStart = currentStart.subtract(1, "month");
    newEnd = currentEnd.subtract(1, "month");
  } else {
    newStart = currentStart.add(1, "month");
    newEnd = currentEnd.add(1, "month");
  }

  const newRange = {
    start: newStart.format("YYYY-MM-DD"),
    end: newEnd.format("YYYY-MM-DD"),
  };

  workingRange.value = newRange;
  committedRange.value = newRange;
  emit("update:modelValue", newRange);
  emit("navigate-month", direction);
};

// Expose navigation method for parent components
defineExpose({
  navigateRangeByMonth,
});
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

    <!-- Dropdown with Teleport -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="fixed bg-base-100 border border-base-300 rounded-lg shadow-xl z-[10000] p-3 min-w-[750px]"
        :style="dropdownStyles"
      >
        <div class="flex gap-3">
        <!-- Shortcuts -->
        <div class="w-44 border-r border-base-300 pr-3">
          <h3 class="font-semibold text-sm mb-2 text-base-content/70">
            Schnellauswahl
          </h3>
          <div class="space-y-0.5">
            <button
              v-for="shortcut in shortcuts"
              :key="shortcut.label"
              @click="selectShortcut(shortcut)"
              class="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-base-200 transition-colors"
            >
              {{ shortcut.label }}
            </button>
          </div>
        </div>

        <!-- Calendar -->
        <div class="flex-1">
          <!-- Navigation -->
          <div class="flex items-center justify-between mb-3">
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
          <div class="grid grid-cols-2 gap-4">
            <!-- Left Month -->
            <div>
              <h4 class="text-center font-medium mb-2">
                {{ leftMonth.format("MMMM YYYY") }}
              </h4>

              <!-- Weekday Headers -->
              <div class="grid grid-cols-7 gap-0 mb-1">
                <div
                  v-for="day in weekdays"
                  :key="day"
                  class="text-center text-xs font-medium text-base-content/60 py-1 h-6"
                >
                  {{ day }}
                </div>
              </div>

              <!-- Calendar Days -->
              <div class="grid grid-cols-7 gap-0">
                <button
                  v-for="dayData in leftCalendarDays"
                  :key="dayData.date || dayData.emptyKey || 'fallback'"
                  @click="!dayData.isEmpty && handleDateClick(dayData.date)"
                  @mouseenter="
                    !dayData.isEmpty && handleDateHover(dayData.date)
                  "
                  class="w-10 h-8 text-sm transition-all duration-150 relative flex items-center justify-center"
                  :class="{
                    invisible: dayData.isEmpty,
                    'text-base-content':
                      dayData.isCurrentMonth && !dayData.isEmpty,
                    'bg-primary text-primary-content rounded-l-md':
                      !dayData.isEmpty && isDateRangeStart(dayData.date),
                    'bg-primary text-primary-content rounded-r-md':
                      !dayData.isEmpty && isDateRangeEnd(dayData.date),
                    'bg-primary text-primary-content rounded-md':
                      !dayData.isEmpty &&
                      isDateRangeStart(dayData.date) &&
                      isDateRangeEnd(dayData.date),
                    'bg-base-300':
                      !dayData.isEmpty &&
                      isDateInRange(dayData.date) &&
                      !isDateRangeStart(dayData.date) &&
                      !isDateRangeEnd(dayData.date),
                    'hover:bg-base-200 rounded-md':
                      !dayData.isEmpty &&
                      dayData.isCurrentMonth &&
                      !isDateInRange(dayData.date),
                    'ring-2 ring-primary ring-offset-1 relative z-10':
                      !dayData.isEmpty && dayData.isToday,
                    'cursor-pointer':
                      !dayData.isEmpty && dayData.isCurrentMonth,
                  }"
                  :disabled="dayData.isEmpty || !dayData.isCurrentMonth"
                >
                  {{ dayData.day }}
                </button>
              </div>
            </div>

            <!-- Right Month -->
            <div>
              <h4 class="text-center font-medium mb-2">
                {{ rightMonth.format("MMMM YYYY") }}
              </h4>

              <!-- Weekday Headers -->
              <div class="grid grid-cols-7 gap-0 mb-1">
                <div
                  v-for="day in weekdays"
                  :key="day"
                  class="text-center text-xs font-medium text-base-content/60 py-1 h-6"
                >
                  {{ day }}
                </div>
              </div>

              <!-- Calendar Days -->
              <div class="grid grid-cols-7 gap-0">
                <button
                  v-for="dayData in rightCalendarDays"
                  :key="dayData.date || dayData.emptyKey || 'fallback'"
                  @click="!dayData.isEmpty && handleDateClick(dayData.date)"
                  @mouseenter="
                    !dayData.isEmpty && handleDateHover(dayData.date)
                  "
                  class="w-10 h-8 text-sm transition-all duration-150 relative flex items-center justify-center"
                  :class="{
                    invisible: dayData.isEmpty,
                    'text-base-content':
                      dayData.isCurrentMonth && !dayData.isEmpty,
                    'bg-primary text-primary-content rounded-l-md':
                      !dayData.isEmpty && isDateRangeStart(dayData.date),
                    'bg-primary text-primary-content rounded-r-md':
                      !dayData.isEmpty && isDateRangeEnd(dayData.date),
                    'bg-primary text-primary-content rounded-md':
                      !dayData.isEmpty &&
                      isDateRangeStart(dayData.date) &&
                      isDateRangeEnd(dayData.date),
                    'bg-base-300':
                      !dayData.isEmpty &&
                      isDateInRange(dayData.date) &&
                      !isDateRangeStart(dayData.date) &&
                      !isDateRangeEnd(dayData.date),
                    'hover:bg-base-200 rounded-md':
                      !dayData.isEmpty &&
                      dayData.isCurrentMonth &&
                      !isDateInRange(dayData.date),
                    'ring-2 ring-primary ring-offset-1 relative z-10':
                      !dayData.isEmpty && dayData.isToday,
                    'cursor-pointer':
                      !dayData.isEmpty && dayData.isCurrentMonth,
                  }"
                  :disabled="dayData.isEmpty || !dayData.isCurrentMonth"
                >
                  {{ dayData.day }}
                </button>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex justify-end mt-3 pt-3 border-t border-base-300">
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
    </Teleport>
  </div>
</template>

<style scoped>
/* Calendar styling with continuous range blocks */

/* Calendar container - fixed height to prevent jumping */
.calendar-container {
  min-height: 240px; /* 6 rows * 32px + headers + margins */
}

/* Calendar grid - ensure consistent spacing */
.calendar-grid {
  gap: 0;
}

/* Base calendar day styling */
.calendar-day {
  width: 100%;
  min-width: 32px;
  margin: 0;
}

/* Hover styling for non-range days */
.hover-day {
  border-radius: 0.375rem;
}

/* Range styling - seamless connection using negative margins */
.range-start {
  border-radius: 0.375rem 0 0 0.375rem;
  margin-right: -1px;
  position: relative;
  z-index: 1;
}

.range-end {
  border-radius: 0 0.375rem 0.375rem 0;
  margin-left: -1px;
  position: relative;
  z-index: 1;
}

.range-single {
  border-radius: 0.375rem;
}

.range-middle {
  border-radius: 0;
  margin-left: -1px;
  margin-right: -1px;
  position: relative;
  z-index: 0;
}

/* First range-middle in a row shouldn't have left margin */
.range-middle:nth-child(7n + 1) {
  margin-left: 0;
  border-top-left-radius: 0.375rem;
  border-bottom-left-radius: 0.375rem;
}

/* Last range-middle in a row shouldn't have right margin */
.range-middle:nth-child(7n) {
  margin-right: 0;
  border-top-right-radius: 0.375rem;
  border-bottom-right-radius: 0.375rem;
}

/* Special cases: range start/end at week boundaries */
.range-start:nth-child(7n) {
  border-radius: 0.375rem;
  margin-right: 0;
}

.range-end:nth-child(7n + 1) {
  border-radius: 0.375rem;
  margin-left: 0;
}
</style>
