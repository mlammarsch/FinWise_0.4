import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
import ButtonGroup from "./ButtonGroup.vue";
const props = defineProps();
const emit = defineEmits();
// State
const isOpen = ref(false);
const containerRef = ref(null);
const dropdownRef = ref(null);
const isDragging = ref(false);
const dragStart = ref(null);
const hoverDate = ref(null);
const dropdownPosition = ref("left");
const dropdownStyles = ref({});
// Current displayed months (left = previous month, right = current month)
const currentDate = ref(dayjs());
const leftMonth = computed(() => currentDate.value.subtract(1, "month"));
const rightMonth = computed(() => currentDate.value);
// Working range (for preview) and committed range (actual value)
const workingRange = ref({
    start: props.modelValue?.start ||
        dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
    end: props.modelValue?.end || dayjs().endOf("month").format("YYYY-MM-DD"),
});
const committedRange = ref({
    start: props.modelValue?.start ||
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
const generateCalendarDays = (month) => {
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
const rightCalendarDays = computed(() => generateCalendarDays(rightMonth.value));
// Navigation
const navigateMonth = (direction) => {
    if (direction === "prev") {
        currentDate.value = currentDate.value.subtract(1, "month");
    }
    else {
        currentDate.value = currentDate.value.add(1, "month");
    }
};
const navigateYear = (direction) => {
    if (direction === "prev") {
        currentDate.value = currentDate.value.subtract(1, "year");
    }
    else {
        currentDate.value = currentDate.value.add(1, "year");
    }
};
// Date selection logic
const handleDateClick = (dateStr) => {
    if (!workingRange.value.start || workingRange.value.end) {
        // Start new selection
        workingRange.value = { start: dateStr, end: "" };
        dragStart.value = dateStr;
        isDragging.value = true;
    }
    else {
        // Complete selection
        const start = dayjs(workingRange.value.start);
        const end = dayjs(dateStr);
        if (start.isAfter(end)) {
            workingRange.value = { start: dateStr, end: workingRange.value.start };
        }
        else {
            workingRange.value.end = dateStr;
        }
        isDragging.value = false;
        dragStart.value = null;
        hoverDate.value = null;
    }
};
const handleDateHover = (dateStr) => {
    if (isDragging.value && workingRange.value.start) {
        hoverDate.value = dateStr;
    }
};
// Check if date is in range (improved for continuous range display)
const isDateInRange = (dateStr) => {
    if (!workingRange.value.start)
        return false;
    const date = dayjs(dateStr);
    const start = dayjs(workingRange.value.start);
    if (workingRange.value.end) {
        const end = dayjs(workingRange.value.end);
        return date.isSameOrAfter(start, "day") && date.isSameOrBefore(end, "day");
    }
    else if (isDragging.value && hoverDate.value) {
        const hover = dayjs(hoverDate.value);
        const rangeStart = start.isBefore(hover) ? start : hover;
        const rangeEnd = start.isBefore(hover) ? hover : start;
        return (date.isSameOrAfter(rangeStart, "day") &&
            date.isSameOrBefore(rangeEnd, "day"));
    }
    return date.isSame(start, "day");
};
const isDateRangeStart = (dateStr) => {
    if (!workingRange.value.start)
        return false;
    if (workingRange.value.end) {
        return dayjs(dateStr).isSame(workingRange.value.start, "day");
    }
    else if (isDragging.value && hoverDate.value) {
        const start = dayjs(workingRange.value.start);
        const hover = dayjs(hoverDate.value);
        const rangeStart = start.isBefore(hover) ? start : hover;
        return dayjs(dateStr).isSame(rangeStart, "day");
    }
    return dayjs(dateStr).isSame(workingRange.value.start, "day");
};
const isDateRangeEnd = (dateStr) => {
    if (!workingRange.value.start)
        return false;
    if (workingRange.value.end) {
        return dayjs(dateStr).isSame(workingRange.value.end, "day");
    }
    else if (isDragging.value && hoverDate.value) {
        const start = dayjs(workingRange.value.start);
        const hover = dayjs(hoverDate.value);
        const rangeEnd = start.isBefore(hover) ? hover : start;
        return dayjs(dateStr).isSame(rangeEnd, "day");
    }
    return false;
};
// Shortcut selection - emit immediately
const selectShortcut = (shortcut) => {
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
    if (!containerRef.value)
        return;
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
const handleClickOutside = (event) => {
    const target = event.target;
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
watch(() => props.modelValue, (newValue) => {
    if (newValue) {
        workingRange.value = { ...newValue };
        committedRange.value = { ...newValue };
    }
}, { deep: true });
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
const navigateRangeByMonth = (direction) => {
    const currentStart = dayjs(committedRange.value.start);
    const currentEnd = dayjs(committedRange.value.end);
    let newStart;
    let newEnd;
    if (direction === "prev") {
        newStart = currentStart.subtract(1, "month");
        newEnd = currentEnd.subtract(1, "month");
    }
    else {
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
const __VLS_exposed = {
    navigateRangeByMonth,
};
defineExpose(__VLS_exposed);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['range-middle']} */ ;
/** @type {__VLS_StyleScopedClasses['range-middle']} */ ;
/** @type {__VLS_StyleScopedClasses['range-start']} */ ;
/** @type {__VLS_StyleScopedClasses['range-end']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
    ref: "containerRef",
});
/** @type {typeof __VLS_ctx.containerRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isOpen = !__VLS_ctx.isOpen;
        } },
    ...{ class: "btn btn-sm btn-outline rounded-full min-w-[200px] justify-between border border-base-300" },
    ...{ class: ({
            'border-2 border-accent': __VLS_ctx.committedRange.start && __VLS_ctx.committedRange.end,
        }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
(__VLS_ctx.displayValue);
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:calendar-range",
    ...{ class: "text-base" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:calendar-range",
    ...{ class: "text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const __VLS_4 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    to: "body",
}));
const __VLS_6 = __VLS_5({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ref: "dropdownRef",
        ...{ class: "fixed bg-base-100 border border-base-300 rounded-lg shadow-xl z-[10000] p-3 min-w-[750px]" },
        ...{ style: (__VLS_ctx.dropdownStyles) },
    });
    /** @type {typeof __VLS_ctx.dropdownRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-44 border-r border-base-300 pr-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-semibold text-sm mb-2 text-base-content/70" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-0.5" },
    });
    for (const [shortcut] of __VLS_getVForSourceType((__VLS_ctx.shortcuts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    __VLS_ctx.selectShortcut(shortcut);
                } },
            key: (shortcut.label),
            ...{ class: "w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-base-200 transition-colors" },
        });
        (shortcut.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center justify-between mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.navigateYear('prev');
            } },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    const __VLS_12 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        icon: "mdi:chevron-double-left",
        ...{ class: "text-sm" },
    }));
    const __VLS_14 = __VLS_13({
        icon: "mdi:chevron-double-left",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "font-semibold text-lg" },
    });
    (__VLS_ctx.currentDate.year());
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.navigateYear('next');
            } },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    const __VLS_16 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        icon: "mdi:chevron-double-right",
        ...{ class: "text-sm" },
    }));
    const __VLS_18 = __VLS_17({
        icon: "mdi:chevron-double-right",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
    });
    const __VLS_20 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_22 = __VLS_21({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-center font-medium mb-2" },
    });
    (__VLS_ctx.leftMonth.format("MMMM YYYY"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-7 gap-0 mb-1" },
    });
    for (const [day] of __VLS_getVForSourceType((__VLS_ctx.weekdays))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (day),
            ...{ class: "text-center text-xs font-medium text-base-content/60 py-1 h-6" },
        });
        (day);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-7 gap-0" },
    });
    for (const [dayData] of __VLS_getVForSourceType((__VLS_ctx.leftCalendarDays))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    !dayData.isEmpty && __VLS_ctx.handleDateClick(dayData.date);
                } },
            ...{ onMouseenter: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    !dayData.isEmpty && __VLS_ctx.handleDateHover(dayData.date);
                } },
            key: (dayData.date || dayData.emptyKey || 'fallback'),
            ...{ class: "w-10 h-8 text-sm transition-all duration-150 relative flex items-center justify-center" },
            ...{ class: ({
                    invisible: dayData.isEmpty,
                    'text-base-content': dayData.isCurrentMonth && !dayData.isEmpty,
                    'bg-primary text-primary-content rounded-l-md': !dayData.isEmpty && __VLS_ctx.isDateRangeStart(dayData.date),
                    'bg-primary text-primary-content rounded-r-md': !dayData.isEmpty && __VLS_ctx.isDateRangeEnd(dayData.date),
                    'bg-primary text-primary-content rounded-md': !dayData.isEmpty &&
                        __VLS_ctx.isDateRangeStart(dayData.date) &&
                        __VLS_ctx.isDateRangeEnd(dayData.date),
                    'bg-base-300': !dayData.isEmpty &&
                        __VLS_ctx.isDateInRange(dayData.date) &&
                        !__VLS_ctx.isDateRangeStart(dayData.date) &&
                        !__VLS_ctx.isDateRangeEnd(dayData.date),
                    'hover:bg-base-200 rounded-md': !dayData.isEmpty &&
                        dayData.isCurrentMonth &&
                        !__VLS_ctx.isDateInRange(dayData.date),
                    'ring-2 ring-primary ring-offset-1 relative z-10': !dayData.isEmpty && dayData.isToday,
                    'cursor-pointer': !dayData.isEmpty && dayData.isCurrentMonth,
                }) },
            disabled: (dayData.isEmpty || !dayData.isCurrentMonth),
        });
        (dayData.day);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-center font-medium mb-2" },
    });
    (__VLS_ctx.rightMonth.format("MMMM YYYY"));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-7 gap-0 mb-1" },
    });
    for (const [day] of __VLS_getVForSourceType((__VLS_ctx.weekdays))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (day),
            ...{ class: "text-center text-xs font-medium text-base-content/60 py-1 h-6" },
        });
        (day);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-7 gap-0" },
    });
    for (const [dayData] of __VLS_getVForSourceType((__VLS_ctx.rightCalendarDays))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    !dayData.isEmpty && __VLS_ctx.handleDateClick(dayData.date);
                } },
            ...{ onMouseenter: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    !dayData.isEmpty && __VLS_ctx.handleDateHover(dayData.date);
                } },
            key: (dayData.date || dayData.emptyKey || 'fallback'),
            ...{ class: "w-10 h-8 text-sm transition-all duration-150 relative flex items-center justify-center" },
            ...{ class: ({
                    invisible: dayData.isEmpty,
                    'text-base-content': dayData.isCurrentMonth && !dayData.isEmpty,
                    'bg-primary text-primary-content rounded-l-md': !dayData.isEmpty && __VLS_ctx.isDateRangeStart(dayData.date),
                    'bg-primary text-primary-content rounded-r-md': !dayData.isEmpty && __VLS_ctx.isDateRangeEnd(dayData.date),
                    'bg-primary text-primary-content rounded-md': !dayData.isEmpty &&
                        __VLS_ctx.isDateRangeStart(dayData.date) &&
                        __VLS_ctx.isDateRangeEnd(dayData.date),
                    'bg-base-300': !dayData.isEmpty &&
                        __VLS_ctx.isDateInRange(dayData.date) &&
                        !__VLS_ctx.isDateRangeStart(dayData.date) &&
                        !__VLS_ctx.isDateRangeEnd(dayData.date),
                    'hover:bg-base-200 rounded-md': !dayData.isEmpty &&
                        dayData.isCurrentMonth &&
                        !__VLS_ctx.isDateInRange(dayData.date),
                    'ring-2 ring-primary ring-offset-1 relative z-10': !dayData.isEmpty && dayData.isToday,
                    'cursor-pointer': !dayData.isEmpty && dayData.isCurrentMonth,
                }) },
            disabled: (dayData.isEmpty || !dayData.isCurrentMonth),
        });
        (dayData.day);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end mt-3 pt-3 border-t border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs" },
    });
    /** @type {[typeof ButtonGroup, ]} */ ;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(ButtonGroup, new ButtonGroup({
        ...{ 'onLeftClick': {} },
        ...{ 'onRightClick': {} },
        leftLabel: "Abbrechen",
        rightLabel: "Übernehmen",
        leftColor: "btn-soft btn-sm",
        rightColor: "btn-primary btn-sm",
    }));
    const __VLS_25 = __VLS_24({
        ...{ 'onLeftClick': {} },
        ...{ 'onRightClick': {} },
        leftLabel: "Abbrechen",
        rightLabel: "Übernehmen",
        leftColor: "btn-soft btn-sm",
        rightColor: "btn-primary btn-sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    let __VLS_27;
    let __VLS_28;
    let __VLS_29;
    const __VLS_30 = {
        onLeftClick: (__VLS_ctx.cancelSelection)
    };
    const __VLS_31 = {
        onRightClick: (__VLS_ctx.confirmSelection)
    };
    var __VLS_26;
}
var __VLS_7;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[200px]']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[10000]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[750px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-44']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-7']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-7']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['invisible']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-offset-1']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-7']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-7']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['invisible']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-offset-1']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            ButtonGroup: ButtonGroup,
            isOpen: isOpen,
            containerRef: containerRef,
            dropdownRef: dropdownRef,
            dropdownStyles: dropdownStyles,
            currentDate: currentDate,
            leftMonth: leftMonth,
            rightMonth: rightMonth,
            committedRange: committedRange,
            shortcuts: shortcuts,
            leftCalendarDays: leftCalendarDays,
            rightCalendarDays: rightCalendarDays,
            navigateMonth: navigateMonth,
            navigateYear: navigateYear,
            handleDateClick: handleDateClick,
            handleDateHover: handleDateHover,
            isDateInRange: isDateInRange,
            isDateRangeStart: isDateRangeStart,
            isDateRangeEnd: isDateRangeEnd,
            selectShortcut: selectShortcut,
            confirmSelection: confirmSelection,
            cancelSelection: cancelSelection,
            displayValue: displayValue,
            weekdays: weekdays,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
