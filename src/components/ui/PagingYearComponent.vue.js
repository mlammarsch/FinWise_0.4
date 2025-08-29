import { computed, ref, onMounted, onUnmounted } from "vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emits = defineEmits();
// Liste aller Monate: current -9 bis +9
const months = computed(() => {
    const now = new Date();
    const result = [];
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
function onMonthClick(offset) {
    emits("updateStartOffset", offset);
}
function onDisplayedMonthsChange(monthCount) {
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
const windowWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1200);
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
    if (windowWidth.value < 640)
        return 3; // sm: 3 Icons
    if (windowWidth.value < 768)
        return 4; // md: 4 Icons
    if (windowWidth.value < 1024)
        return 5; // lg: 5 Icons
    return 6; // xl und größer: alle 6 Icons
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-end justify-between w-full max-w-4xl" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-shrink-0 w-[10%]" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center flex-shrink-0 justify-start" },
});
for (const [iconData] of __VLS_getVForSourceType((__VLS_ctx.monthIcons.slice(0, __VLS_ctx.visibleIconCount)))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onDisplayedMonthsChange(iconData.count);
            } },
        key: (iconData.count),
        ...{ class: "btn btn-xs p-0 transition-all duration-200" },
        ...{ class: ({
                'btn-ghost': iconData.count <= props.displayedMonths,
                'btn-ghost opacity-40': iconData.count > props.displayedMonths,
            }) },
        title: (iconData.tooltip),
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: (iconData.icon),
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_2 = __VLS_1({
        icon: (iconData.icon),
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-shrink-0 w-[5%]" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col gap-1 flex-grow mx-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-1 justify-center" },
});
for (const [m, idx] of __VLS_getVForSourceType((__VLS_ctx.months))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: ('year-' + m.offset),
        ...{ class: "w-10 text-center text-xs" },
    });
    if (m.isJanuary ||
        (idx === 0 &&
            !__VLS_ctx.months.some((mo) => mo.offset < m.offset && mo.isJanuary))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (m.year);
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-0 justify-center" },
});
for (const [m] of __VLS_getVForSourceType((__VLS_ctx.months))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onMonthClick(m.offset);
            } },
        key: (m.offset),
        ...{ class: "btn btn-xs w-10" },
        ...{ class: ({
                'btn-primary': m.offset >= props.currentStartMonthOffset &&
                    m.offset < props.currentStartMonthOffset + props.displayedMonths,
            }) },
    });
    (m.label);
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[10%]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[5%]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-10']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            months: months,
            onMonthClick: onMonthClick,
            onDisplayedMonthsChange: onDisplayedMonthsChange,
            monthIcons: monthIcons,
            visibleIconCount: visibleIconCount,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
