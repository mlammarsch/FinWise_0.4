import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useCategoryStore } from "../../../stores/categoryStore";
import { BudgetService } from "../../../services/BudgetService";
import CurrencyDisplay from "../CurrencyDisplay.vue";
const props = withDefaults(defineProps(), {
    showHeader: true,
    showActions: true,
});
const router = useRouter();
const categoryStore = useCategoryStore();
const expensesLimit = ref(5);
function setExpensesLimit(limit) {
    expensesLimit.value = limit;
}
const currentMonthStart = dayjs().startOf("month");
const currentMonthEnd = dayjs().endOf("month");
const topExpensesWithBudget = computed(() => {
    const monthStart = currentMonthStart.toDate();
    const monthEnd = currentMonthEnd.toDate();
    const expenseCategories = categoryStore.categories.filter((cat) => cat.isActive &&
        !cat.isIncomeCategory &&
        !cat.isSavingsGoal &&
        cat.name !== "Verfügbare Mittel" &&
        !cat.parentCategoryId);
    const categoryData = expenseCategories
        .map((category) => {
        const budgetData = BudgetService.getAggregatedMonthlyBudgetData(category.id, monthStart, monthEnd);
        const spent = Math.abs(budgetData.spent);
        const budgeted = Math.abs(budgetData.budgeted);
        const budgetPercentage = budgeted > 0 ? (spent / budgeted) * 100 : spent > 0 ? 999 : 0;
        return {
            categoryId: category.id,
            name: category.name,
            spent,
            budgeted,
            available: budgetData.saldo,
            budgetPercentage,
            budgetData,
        };
    })
        .filter((item) => item.budgeted > 0 && item.spent > 0)
        .sort((a, b) => b.budgetPercentage - a.budgetPercentage);
    return categoryData;
});
function navigateToBudgets() {
    router.push("/budgets");
}
function getExpenseBarColor(spent, budgeted) {
    if (budgeted === 0)
        return "bg-base-content opacity-60";
    const percentage = (spent / budgeted) * 100;
    if (percentage <= 90)
        return "bg-success";
    if (percentage <= 100)
        return "bg-warning";
    return "bg-error";
}
function getExpenseBarWidth(spent, budgeted) {
    if (budgeted === 0)
        return 100;
    if (spent <= budgeted)
        return (spent / budgeted) * 100;
    return 100;
}
function getBudgetMarkerPosition(spent, budgeted) {
    if (budgeted === 0)
        return 0;
    if (spent <= budgeted)
        return 100;
    return (budgeted / spent) * 100;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showHeader: true,
    showActions: true,
});
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
    ...{ class: "flex justify-between items-center mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
if (__VLS_ctx.showHeader) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "card-title text-lg" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "text-sm opacity-60" },
});
if (__VLS_ctx.showActions) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2 items-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showActions))
                    return;
                __VLS_ctx.setExpensesLimit(3);
            } },
        ...{ class: (__VLS_ctx.expensesLimit === 3
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showActions))
                    return;
                __VLS_ctx.setExpensesLimit(5);
            } },
        ...{ class: (__VLS_ctx.expensesLimit === 5
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showActions))
                    return;
                __VLS_ctx.setExpensesLimit(10);
            } },
        ...{ class: (__VLS_ctx.expensesLimit === 10
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.navigateToBudgets) },
        ...{ class: "btn btn-sm btn-ghost" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "iconify ml-1" },
        'data-icon': "mdi:chevron-right",
    });
}
if (__VLS_ctx.topExpensesWithBudget.slice(0, __VLS_ctx.expensesLimit).length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-2" },
    });
    for (const [expense] of __VLS_getVForSourceType((__VLS_ctx.topExpensesWithBudget.slice(0, __VLS_ctx.expensesLimit)))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (expense.categoryId),
            ...{ class: "relative" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-left items-center mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-medium mr-1" },
        });
        (expense.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_0 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (expense.spent),
            asInteger: (true),
        }));
        const __VLS_1 = __VLS_0({
            amount: (expense.spent),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_0));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "relative" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-full bg-base-300 rounded-full h-1.5 relative overflow-hidden" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: ([
                    'h-full rounded-full transition-all duration-300',
                    __VLS_ctx.getExpenseBarColor(expense.spent, expense.budgeted),
                ]) },
            ...{ style: ({
                    width: __VLS_ctx.getExpenseBarWidth(expense.spent, expense.budgeted) + '%',
                }) },
        });
        if (expense.budgeted > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "absolute -top-1 transform -translate-x-1/2 -translate-y-full" },
                ...{ style: ({
                        left: __VLS_ctx.getBudgetMarkerPosition(expense.spent, expense.budgeted) +
                            '%',
                    }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex flex-col items-center" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-xs font-medium mb-0 bg-base-300 px-1 border border-neutral rounded" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_3 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (expense.budgeted),
                asInteger: (true),
            }));
            const __VLS_4 = __VLS_3({
                amount: (expense.budgeted),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_3));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-base-content opacity-70" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between text-xs opacity-60 mt-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (expense.budgeted > 0
            ? Math.round((expense.spent / expense.budgeted) * 100)
            : 0);
        (expense.budgeted > 0 ? "vom Budget" : "ausgegeben");
        if (expense.budgeted > 0 && expense.spent > expense.budgeted) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-error" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (expense.spent - expense.budgeted),
                asInteger: (true),
            }));
            const __VLS_7 = __VLS_6({
                amount: (expense.spent - expense.budgeted),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        }
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center py-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm italic opacity-60" },
    });
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['iconify']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-left']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-300']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['-top-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transform']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-x-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-y-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            expensesLimit: expensesLimit,
            setExpensesLimit: setExpensesLimit,
            topExpensesWithBudget: topExpensesWithBudget,
            navigateToBudgets: navigateToBudgets,
            getExpenseBarColor: getExpenseBarColor,
            getExpenseBarWidth: getExpenseBarWidth,
            getBudgetMarkerPosition: getBudgetMarkerPosition,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
