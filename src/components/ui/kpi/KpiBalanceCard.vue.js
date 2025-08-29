import { computed } from 'vue';
import dayjs from 'dayjs';
import { TransactionService } from '../../../services/TransactionService';
import { formatCurrency, formatPercent } from '../../../utils/formatters';
const props = defineProps();
function getPrevComparableRange(start, end) {
    const s = dayjs(start);
    const e = dayjs(end);
    const monthAligned = s.format('YYYY-MM-DD') === s.startOf('month').format('YYYY-MM-DD') &&
        e.format('YYYY-MM-DD') === e.endOf('month').format('YYYY-MM-DD');
    if (monthAligned) {
        const months = e.diff(s, 'month') + 1;
        const prevEnd = s.subtract(1, 'month').endOf('month');
        const prevStart = prevEnd.subtract(months - 1, 'month').startOf('month');
        return {
            start: prevStart.format('YYYY-MM-DD'),
            end: prevEnd.format('YYYY-MM-DD'),
        };
    }
    const days = e.diff(s, 'day') + 1;
    const prevEnd = s.subtract(1, 'day');
    const prevStart = prevEnd.subtract(days - 1, 'day');
    return {
        start: prevStart.format('YYYY-MM-DD'),
        end: prevEnd.format('YYYY-MM-DD'),
    };
}
const current = computed(() => TransactionService.getIncomeExpenseSummary(props.startDate, props.endDate));
const prevRange = computed(() => getPrevComparableRange(props.startDate, props.endDate));
const previous = computed(() => TransactionService.getIncomeExpenseSummary(prevRange.value.start, prevRange.value.end));
const value = computed(() => current.value.balance);
const prevValue = computed(() => previous.value.balance);
const percent = computed(() => {
    const denom = Math.abs(prevValue.value);
    if (denom < 1e-9)
        return null;
    return ((value.value - prevValue.value) / denom) * 100;
});
const isUp = computed(() => value.value - prevValue.value >= 0);
const badgeClass = computed(() => {
    if (percent.value === null)
        return 'badge-ghost';
    return isUp.value ? 'badge-success' : 'badge-error';
});
const arrow = computed(() => (percent.value === null ? '' : (isUp.value ? '▲' : '▼')));
const amountClass = computed(() => (value.value >= 0 ? 'text-success' : 'text-error'));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 items-center gap-y-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "card-title text-lg" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-2xl font-bold" },
    ...{ class: (__VLS_ctx.amountClass) },
});
(__VLS_ctx.formatCurrency(__VLS_ctx.value));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col items-start md:items-end gap-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-xs opacity-70 mb-2 " },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "badge badge-soft badge-sm rounded-full border-0" },
    ...{ class: (__VLS_ctx.badgeClass) },
    'aria-label': "Bilanz-Trend",
});
if (__VLS_ctx.percent !== null) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.arrow);
    (__VLS_ctx.formatPercent(__VLS_ctx.percent));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['md:items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border-0']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formatCurrency: formatCurrency,
            formatPercent: formatPercent,
            value: value,
            percent: percent,
            badgeClass: badgeClass,
            arrow: arrow,
            amountClass: amountClass,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
