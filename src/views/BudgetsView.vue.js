import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useCategoryStore } from "../stores/categoryStore";
import { useTransactionStore } from "../stores/transactionStore";
import BudgetMonthHeaderCard from "../components/budget/BudgetMonthHeaderCard.vue";
import BudgetCategoriesAndValues from "../components/budget/BudgetCategoriesAndValues.vue";
import PagingYearComponent from "../components/ui/PagingYearComponent.vue";
import { Icon } from "@iconify/vue";
import { toDateOnlyString } from "../utils/formatters";
import { BalanceService } from "../services/BalanceService";
const categoryStore = useCategoryStore();
const transactionStore = useTransactionStore();
// Computed für den Expand/Collapse-Zustand aller Lebensbereiche
const allGroupsExpanded = computed(() => {
    const allGroupIds = categoryStore.categoryGroups.map((g) => g.id);
    return (allGroupIds.length > 0 &&
        allGroupIds.every((id) => categoryStore.expandedCategoryGroups.has(id)));
});
// Funktion zum Ein-/Ausklappen aller Lebensbereiche
function toggleAllCategoryGroups() {
    if (allGroupsExpanded.value) {
        categoryStore.collapseAllCategoryGroups();
    }
    else {
        categoryStore.expandAllCategoryGroups();
    }
}
// Funktion zum Ein-/Ausblenden versteckter Kategorien
function toggleShowHiddenCategories() {
    // Loading aktivieren für Muuri-Neuberechnung
    isLoading.value = true;
    categoryStore.toggleShowHiddenCategories();
}
const localStorageKey = "finwise_budget_months";
const numMonths = ref(3);
const monthOffset = ref(0);
const isLoading = ref(true);
onMounted(async () => {
    const stored = localStorage.getItem(localStorageKey);
    if (stored)
        numMonths.value = parseInt(stored);
    await recalcStores();
});
watch([numMonths, monthOffset], async () => {
    localStorage.setItem(localStorageKey, numMonths.value.toString());
    isLoading.value = true;
    await recalcStores();
});
async function recalcStores() {
    try {
        isLoading.value = true;
        // Stores laden - categoryStore wird bereits in BudgetCategoriesAndValues geladen
        await transactionStore.loadTransactions();
        // Kurz warten, damit die computed properties und Mock-Daten berechnet werden
        await nextTick();
        // Loading wird jetzt über muuriReady Event gesteuert
        // isLoading.value = false; // ← Entfernt, wird über onMuuriReady gesetzt
    }
    catch (error) {
        console.error("Error loading budget data:", error);
        isLoading.value = false;
    }
}
function onUpdateStartOffset(newOffset) {
    monthOffset.value = newOffset;
}
function onUpdateDisplayedMonths(newCount) {
    numMonths.value = newCount;
}
// Event-Handler für Muuri-Initialisierung
function onMuuriReady() {
    // Loading erst beenden, wenn Muuri-Grids vollständig initialisiert sind
    isLoading.value = false;
}
const months = computed(() => {
    const result = [];
    const now = new Date();
    const leftDate = new Date(now.getFullYear(), now.getMonth() + monthOffset.value, 1);
    for (let i = 0; i < numMonths.value; i++) {
        const d = new Date(leftDate.getFullYear(), leftDate.getMonth() + i, 1);
        const normalizedStart = new Date(toDateOnlyString(d));
        const lastDay = new Date(normalizedStart.getFullYear(), normalizedStart.getMonth() + 1, 0);
        const normalizedEnd = new Date(toDateOnlyString(lastDay));
        result.push({
            key: `${normalizedStart.getFullYear()}-${normalizedStart.getMonth() + 1}`,
            label: normalizedStart.toLocaleString("de-DE", {
                month: "long",
                year: "numeric",
            }),
            start: normalizedStart,
            end: normalizedEnd,
        });
    }
    return result;
});
const categories = computed(() => {
    return categoryStore.categories.filter((cat) => !cat.parentCategoryId);
});
const totalColumns = computed(() => months.value.length + 1);
const availableByMonth = computed(() => {
    return months.value.map((month) => {
        const availableCat = categoryStore.categories.find((cat) => cat.name === "Verfügbare Mittel");
        if (!availableCat)
            return 0;
        // Verwende den BalanceService für die Saldoabfrage
        return BalanceService.getTodayBalance("category", availableCat.id, month.end);
    });
});
const budgetedByMonth = computed(() => {
    return months.value.map((month) => {
        // Verwende den BalanceService für die Berechnung der budgetierten Ausgabenkategorien
        return BalanceService.getTotalBudgetedForMonth(month.start, month.end);
    });
});
const toBudgetByMonth = computed(() => {
    return months.value.map((month, index) => {
        const available = availableByMonth.value[index] || 0;
        // "zu budgetieren" = verfügbare Mittel (nur die monatlichen Einnahmen-Transfers)
        // Darf nicht negativ werden - bleibt bei 0€ stehen
        return Math.max(0, available);
    });
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-[calc(100vh-189px)] flex flex-col overflow-hidden relative transform-gpu" },
    ...{ style: {} },
});
if (__VLS_ctx.isLoading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed inset-0 z-[1000] flex items-center justify-center bg-base-100 transform-gpu" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col items-center space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "loading loading-spinner loading-lg text-primary" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-lg font-semibold text-base-content mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/60" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-80 space-y-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "skeleton h-4 w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "skeleton h-4 w-3/4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "skeleton h-4 w-1/2" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-shrink-0 sticky top-0 z-20 bg-base-100 border-b border-base-300 transform-gpu" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "p-4 flex flex-col" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-4 flex items-center justify-between w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-shrink-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-grow flex justify-center" },
});
/** @type {[typeof PagingYearComponent, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(PagingYearComponent, new PagingYearComponent({
    ...{ 'onUpdateStartOffset': {} },
    ...{ 'onUpdateDisplayedMonths': {} },
    displayedMonths: (__VLS_ctx.numMonths),
    currentStartMonthOffset: (__VLS_ctx.monthOffset),
}));
const __VLS_1 = __VLS_0({
    ...{ 'onUpdateStartOffset': {} },
    ...{ 'onUpdateDisplayedMonths': {} },
    displayedMonths: (__VLS_ctx.numMonths),
    currentStartMonthOffset: (__VLS_ctx.monthOffset),
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onUpdateStartOffset: (__VLS_ctx.onUpdateStartOffset)
};
const __VLS_7 = {
    onUpdateDisplayedMonths: (__VLS_ctx.onUpdateDisplayedMonths)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-shrink-0" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-shrink-0 w-[300px] flex flex-col justify-end" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (__VLS_ctx.toggleAllCategoryGroups) },
    ...{ class: "text-sm flex items-center cursor-pointer p-2" },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: (__VLS_ctx.allGroupsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'),
    ...{ class: "text-md mr-1" },
}));
const __VLS_10 = __VLS_9({
    icon: (__VLS_ctx.allGroupsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'),
    ...{ class: "text-md mr-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.allGroupsExpanded ? "alle einklappen" : "alle ausklappen");
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-sm flex items-center p-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.toggleShowHiddenCategories) },
    type: "checkbox",
    checked: (__VLS_ctx.categoryStore.showHiddenCategories),
    ...{ class: "checkbox checkbox-sm mr-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-1 min-w-0 mr-3" },
});
for (const [month, i] of __VLS_getVForSourceType((__VLS_ctx.months))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (month.key),
        ...{ class: "flex-1 min-w-[120px] flex flex-col" },
    });
    /** @type {[typeof BudgetMonthHeaderCard, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(BudgetMonthHeaderCard, new BudgetMonthHeaderCard({
        label: (month.label),
        month: (month),
        available: (__VLS_ctx.availableByMonth[i]),
        budgeted: (__VLS_ctx.budgetedByMonth[i]),
        toBudget: (__VLS_ctx.toBudgetByMonth[i]),
    }));
    const __VLS_13 = __VLS_12({
        label: (month.label),
        month: (month),
        available: (__VLS_ctx.availableByMonth[i]),
        budgeted: (__VLS_ctx.budgetedByMonth[i]),
        toBudget: (__VLS_ctx.toBudgetByMonth[i]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex-grow overflow-auto transform-gpu" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-full" },
});
/** @type {[typeof BudgetCategoriesAndValues, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(BudgetCategoriesAndValues, new BudgetCategoriesAndValues({
    ...{ 'onMuuriReady': {} },
    months: (__VLS_ctx.months),
}));
const __VLS_16 = __VLS_15({
    ...{ 'onMuuriReady': {} },
    months: (__VLS_ctx.months),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
let __VLS_18;
let __VLS_19;
let __VLS_20;
const __VLS_21 = {
    onMuuriReady: (__VLS_ctx.onMuuriReady)
};
var __VLS_17;
/** @type {__VLS_StyleScopedClasses['h-[calc(100vh-189px)]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[1000]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['w-80']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3/4']} */ ;
/** @type {__VLS_StyleScopedClasses['skeleton']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[300px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-md']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BudgetMonthHeaderCard: BudgetMonthHeaderCard,
            BudgetCategoriesAndValues: BudgetCategoriesAndValues,
            PagingYearComponent: PagingYearComponent,
            Icon: Icon,
            categoryStore: categoryStore,
            allGroupsExpanded: allGroupsExpanded,
            toggleAllCategoryGroups: toggleAllCategoryGroups,
            toggleShowHiddenCategories: toggleShowHiddenCategories,
            numMonths: numMonths,
            monthOffset: monthOffset,
            isLoading: isLoading,
            onUpdateStartOffset: onUpdateStartOffset,
            onUpdateDisplayedMonths: onUpdateDisplayedMonths,
            onMuuriReady: onMuuriReady,
            months: months,
            availableByMonth: availableByMonth,
            budgetedByMonth: budgetedByMonth,
            toBudgetByMonth: toBudgetByMonth,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
