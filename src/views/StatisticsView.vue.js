import { ref, watch } from "vue";
import dayjs from "dayjs";
import KpiIncomeCard from "../components/ui/kpi/KpiIncomeCard.vue";
import KpiExpenseCard from "../components/ui/kpi/KpiExpenseCard.vue";
import KpiBalanceCard from "../components/ui/kpi/KpiBalanceCard.vue";
import KpiNetWorthCard from "../components/ui/kpi/KpiNetWorthCard.vue";
import NetWorthChart from "../components/ui/charts/NetWorthChart.vue";
import AccountTrendChart from "../components/ui/charts/AccountTrendChart.vue";
import TopExpenseCategoriesChart from "../components/ui/charts/TopExpenseCategoriesChart.vue";
import TopIncomeCategoriesChart from "../components/ui/charts/TopIncomeCategoriesChart.vue";
import DateRangePicker from "../components/ui/DateRangePicker.vue";
// Zeitraum für die Statistiken
const startDate = ref(dayjs().startOf("month").format("YYYY-MM-DD"));
const endDate = ref(dayjs().endOf("month").format("YYYY-MM-DD"));
// Filter-Optionen
const trendMonths = ref(3);
// Gemeinsamer Range-State für den DateRangePicker (hält Picker-UI synchron)
const dateRange = ref({
    start: startDate.value,
    end: endDate.value,
});
// Wenn der Picker geändert wird, auf startDate/endDate spiegeln
watch(dateRange, (range) => {
    if (!range?.start || !range?.end)
        return;
    startDate.value = range.start;
    endDate.value = range.end;
});
// KPI Cards berechnen intern ihre Werte basierend auf startDate/endDate
// Zeitraum ändern (Buttons steuern weiterhin und synchronisieren den Picker)
const setTimeRange = (range) => {
    const today = dayjs();
    switch (range) {
        case "thisMonth":
            startDate.value = today.startOf("month").format("YYYY-MM-DD");
            endDate.value = today.endOf("month").format("YYYY-MM-DD");
            break;
        case "lastMonth":
            startDate.value = today
                .subtract(1, "month")
                .startOf("month")
                .format("YYYY-MM-DD");
            endDate.value = today
                .subtract(1, "month")
                .endOf("month")
                .format("YYYY-MM-DD");
            break;
        case "thisQuarter":
            startDate.value = dayjs(today)
                .month(Math.floor(today.month() / 3) * 3)
                .startOf("month")
                .format("YYYY-MM-DD");
            endDate.value = dayjs(today)
                .month(Math.floor(today.month() / 3) * 3 + 2)
                .endOf("month")
                .format("YYYY-MM-DD");
            break;
        case "thisYear":
            startDate.value = today.startOf("year").format("YYYY-MM-DD");
            endDate.value = today.endOf("year").format("YYYY-MM-DD");
            break;
        case "lastYear":
            startDate.value = today
                .subtract(1, "year")
                .startOf("year")
                .format("YYYY-MM-DD");
            endDate.value = today
                .subtract(1, "year")
                .endOf("year")
                .format("YYYY-MM-DD");
            break;
    }
    // Picker-Range mit Buttons synchronisieren
    dateRange.value = { start: startDate.value, end: endDate.value };
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "btn-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTimeRange('thisMonth');
        } },
    ...{ class: "btn btn-sm" },
    ...{ class: ({
            'btn-active': __VLS_ctx.startDate === __VLS_ctx.dayjs().startOf('month').format('YYYY-MM-DD'),
        }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTimeRange('lastMonth');
        } },
    ...{ class: "btn btn-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTimeRange('thisQuarter');
        } },
    ...{ class: "btn btn-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTimeRange('thisYear');
        } },
    ...{ class: "btn btn-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTimeRange('lastYear');
        } },
    ...{ class: "btn btn-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-2" },
});
/** @type {[typeof DateRangePicker, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
    modelValue: (__VLS_ctx.dateRange),
}));
const __VLS_1 = __VLS_0({
    modelValue: (__VLS_ctx.dateRange),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" },
});
/** @type {[typeof KpiIncomeCard, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(KpiIncomeCard, new KpiIncomeCard({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}));
const __VLS_4 = __VLS_3({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {[typeof KpiExpenseCard, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(KpiExpenseCard, new KpiExpenseCard({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}));
const __VLS_7 = __VLS_6({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {[typeof KpiBalanceCard, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(KpiBalanceCard, new KpiBalanceCard({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}));
const __VLS_10 = __VLS_9({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
/** @type {[typeof KpiNetWorthCard, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(KpiNetWorthCard, new KpiNetWorthCard({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}));
const __VLS_13 = __VLS_12({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-6 mb-6" },
});
/** @type {[typeof TopExpenseCategoriesChart, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(TopExpenseCategoriesChart, new TopExpenseCategoriesChart({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
    showHeader: (true),
}));
const __VLS_16 = __VLS_15({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
    showHeader: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
/** @type {[typeof TopIncomeCategoriesChart, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(TopIncomeCategoriesChart, new TopIncomeCategoriesChart({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
    showHeader: (true),
}));
const __VLS_19 = __VLS_18({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
    showHeader: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {[typeof NetWorthChart, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(NetWorthChart, new NetWorthChart({
    months: (__VLS_ctx.trendMonths),
}));
const __VLS_22 = __VLS_21({
    months: (__VLS_ctx.trendMonths),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
/** @type {[typeof AccountTrendChart, ]} */ ;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(AccountTrendChart, new AccountTrendChart({
    showHeader: (true),
}));
const __VLS_25 = __VLS_24({
    showHeader: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['md:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-group']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-active']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            dayjs: dayjs,
            KpiIncomeCard: KpiIncomeCard,
            KpiExpenseCard: KpiExpenseCard,
            KpiBalanceCard: KpiBalanceCard,
            KpiNetWorthCard: KpiNetWorthCard,
            NetWorthChart: NetWorthChart,
            AccountTrendChart: AccountTrendChart,
            TopExpenseCategoriesChart: TopExpenseCategoriesChart,
            TopIncomeCategoriesChart: TopIncomeCategoriesChart,
            DateRangePicker: DateRangePicker,
            startDate: startDate,
            endDate: endDate,
            trendMonths: trendMonths,
            dateRange: dateRange,
            setTimeRange: setTimeRange,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
