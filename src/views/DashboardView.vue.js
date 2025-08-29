import { ref } from "vue";
import dayjs from "dayjs";
import ExpenseIncomeSummaryChart from "../components/ui/charts/ExpenseIncomeSummaryChart.vue";
import MonthlyTrendStats from "../components/ui/stats/MonthlyTrendStats.vue";
import AccountBalanceStats from "../components/ui/stats/AccountBalanceStats.vue";
import PlanningPaymentsGadget from "../components/ui/gadgets/PlanningPaymentsGadget.vue";
import TopBudgetsStats from "../components/ui/stats/TopBudgetsStats.vue";
import SavingsGoalsStats from "../components/ui/stats/SavingsGoalsStats.vue";
import RecentTransactions from "../components/ui/transactions/RecentTransactions.vue";
const currentDate = dayjs();
const startDate = ref(currentDate.subtract(30, "day").format("YYYY-MM-DD"));
const endDate = ref(currentDate.format("YYYY-MM-DD"));
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-col" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" },
});
/** @type {[typeof AccountBalanceStats, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(AccountBalanceStats, new AccountBalanceStats({
    showHeader: (true),
    showActions: (true),
}));
const __VLS_1 = __VLS_0({
    showHeader: (true),
    showActions: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
/** @type {[typeof PlanningPaymentsGadget, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(PlanningPaymentsGadget, new PlanningPaymentsGadget({
    showHeader: (true),
    showActions: (true),
}));
const __VLS_4 = __VLS_3({
    showHeader: (true),
    showActions: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {[typeof ExpenseIncomeSummaryChart, ]} */ ;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent(ExpenseIncomeSummaryChart, new ExpenseIncomeSummaryChart({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
    showHeader: (true),
}));
const __VLS_7 = __VLS_6({
    startDate: (__VLS_ctx.startDate),
    endDate: (__VLS_ctx.endDate),
    showHeader: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 lg:grid-cols-3 gap-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "lg:col-span-2 space-y-6" },
});
/** @type {[typeof RecentTransactions, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(RecentTransactions, new RecentTransactions({}));
const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
/** @type {[typeof MonthlyTrendStats, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(MonthlyTrendStats, new MonthlyTrendStats({
    months: (3),
}));
const __VLS_13 = __VLS_12({
    months: (3),
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-6" },
});
/** @type {[typeof TopBudgetsStats, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(TopBudgetsStats, new TopBudgetsStats({
    showHeader: (true),
    showActions: (true),
}));
const __VLS_16 = __VLS_15({
    showHeader: (true),
    showActions: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
/** @type {[typeof SavingsGoalsStats, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(SavingsGoalsStats, new SavingsGoalsStats({
    showHeader: (true),
    showActions: (true),
}));
const __VLS_19 = __VLS_18({
    showHeader: (true),
    showActions: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ExpenseIncomeSummaryChart: ExpenseIncomeSummaryChart,
            MonthlyTrendStats: MonthlyTrendStats,
            AccountBalanceStats: AccountBalanceStats,
            PlanningPaymentsGadget: PlanningPaymentsGadget,
            TopBudgetsStats: TopBudgetsStats,
            SavingsGoalsStats: SavingsGoalsStats,
            RecentTransactions: RecentTransactions,
            startDate: startDate,
            endDate: endDate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
