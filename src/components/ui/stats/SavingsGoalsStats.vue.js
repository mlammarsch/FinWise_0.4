import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useCategoryStore } from "../../../stores/categoryStore";
import { BalanceService } from "../../../services/BalanceService";
import CurrencyDisplay from "../CurrencyDisplay.vue";
const props = withDefaults(defineProps(), {
    showHeader: true,
    showActions: true,
});
const categoryStore = useCategoryStore();
const savingsGoalsLimit = ref(5);
function setSavingsGoalsLimit(limit) {
    savingsGoalsLimit.value = limit;
}
const savingsGoalsWithProgress = computed(() => {
    const savingsCategories = categoryStore.savingsGoals.filter((cat) => cat.isActive &&
        cat.isSavingsGoal &&
        cat.targetAmount &&
        cat.targetAmount > 0);
    const today = dayjs();
    const goalsData = savingsCategories
        .map((category) => {
        const currentAmount = Math.abs(BalanceService.getTodayBalance("category", category.id));
        const targetAmount = category.targetAmount || 0;
        const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
        let shouldHaveSaved = 0;
        let barColor = "bg-warning";
        if (category.goalDate) {
            const goalDate = dayjs(category.goalDate);
            const startDate = today.startOf("month");
            const totalMonths = goalDate.diff(startDate, "month", true);
            if (totalMonths > 0) {
                const monthlyRate = targetAmount / totalMonths;
                const elapsedMonths = today.diff(startDate, "month", true);
                shouldHaveSaved = monthlyRate * elapsedMonths;
                const tolerance = monthlyRate * 0.05;
                if (currentAmount >= shouldHaveSaved + tolerance) {
                    barColor = "bg-success";
                }
                else if (currentAmount >= shouldHaveSaved - tolerance) {
                    barColor = "bg-warning";
                }
                else {
                    barColor = "bg-error";
                }
            }
        }
        return {
            categoryId: category.id,
            name: category.name,
            currentAmount,
            targetAmount,
            progress: Math.min(progress, 100),
            goalDate: category.goalDate,
            shouldHaveSaved,
            barColor,
        };
    })
        .sort((a, b) => b.progress - a.progress)
        .slice(0, savingsGoalsLimit.value);
    return goalsData;
});
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
                __VLS_ctx.setSavingsGoalsLimit(3);
            } },
        ...{ class: (__VLS_ctx.savingsGoalsLimit === 3
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showActions))
                    return;
                __VLS_ctx.setSavingsGoalsLimit(5);
            } },
        ...{ class: (__VLS_ctx.savingsGoalsLimit === 5
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showActions))
                    return;
                __VLS_ctx.setSavingsGoalsLimit(10);
            } },
        ...{ class: (__VLS_ctx.savingsGoalsLimit === 10
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
}
if (__VLS_ctx.savingsGoalsWithProgress.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-2" },
    });
    for (const [goal] of __VLS_getVForSourceType((__VLS_ctx.savingsGoalsWithProgress))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (goal.categoryId),
            ...{ class: "relative" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-left items-center mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-medium mr-1" },
        });
        (goal.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_0 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (goal.targetAmount),
            asInteger: (true),
        }));
        const __VLS_1 = __VLS_0({
            amount: (goal.targetAmount),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_0));
        if (goal.goalDate) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-xs opacity-60 ml-2" },
            });
            (new Date(goal.goalDate).toLocaleDateString("de-DE"));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "relative" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-full bg-base-300 rounded-full h-1.5 relative overflow-hidden" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: ([
                    'h-full rounded-full transition-all duration-300',
                    goal.barColor,
                ]) },
            ...{ style: ({ width: goal.progress + '%' }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "absolute -top-1 transform -translate-x-1/2 -translate-y-full" },
            ...{ style: ({ left: goal.progress + '%' }) },
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
            amount: (goal.currentAmount),
            asInteger: (true),
        }));
        const __VLS_4 = __VLS_3({
            amount: (goal.currentAmount),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_3));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-base-content opacity-70" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between text-xs opacity-60 mt-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (Math.round(goal.progress));
        if (goal.progress >= 100) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-success" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-info" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (goal.targetAmount - goal.currentAmount),
                asInteger: (true),
            }));
            const __VLS_7 = __VLS_6({
                amount: (goal.targetAmount - goal.currentAmount),
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
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-info']} */ ;
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
            savingsGoalsLimit: savingsGoalsLimit,
            setSavingsGoalsLimit: setSavingsGoalsLimit,
            savingsGoalsWithProgress: savingsGoalsWithProgress,
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
