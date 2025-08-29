import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { usePlanningStore } from "../../../stores/planningStore";
import { useCategoryStore } from "../../../stores/categoryStore";
import { useAccountStore } from "../../../stores/accountStore";
import { PlanningService } from "../../../services/PlanningService";
import { TransactionType } from "../../../types";
import CurrencyDisplay from "../CurrencyDisplay.vue";
const props = withDefaults(defineProps(), {
    showHeader: true,
    showActions: true,
});
const router = useRouter();
const planningStore = usePlanningStore();
const categoryStore = useCategoryStore();
const accountStore = useAccountStore();
const planningLimit = ref(3);
function setPlanningLimit(limit) {
    planningLimit.value = limit;
}
function navigateToPlanning() {
    router.push("/planning");
}
function navigateToPlanningEdit(planningTransactionId) {
    router.push({
        path: "/planning",
        query: { edit: planningTransactionId },
    });
}
const upcomingPlanningTransactions = computed(() => {
    const today = dayjs();
    const startDate = today.subtract(30, "days");
    const endDate = today.add(14, "days");
    const upcomingTransactions = [];
    planningStore.planningTransactions
        .filter((pt) => pt.isActive && !pt.forecastOnly && !pt.counterPlanningTransactionId)
        .forEach((planningTransaction) => {
        try {
            const occurrences = PlanningService.calculateNextOccurrences(planningTransaction, startDate.format("YYYY-MM-DD"), endDate.format("YYYY-MM-DD"));
            occurrences.forEach((executionDate) => {
                const executionDay = dayjs(executionDate);
                const isDue = executionDay.isSameOrBefore(today, "day");
                const isOverdue = executionDay.isBefore(today.subtract(2, "days"), "day");
                upcomingTransactions.push({
                    planningTransaction,
                    executionDate: executionDate,
                    formattedDate: executionDay.format("DD.MM.YYYY"),
                    isDue: isDue,
                    isOverdue: isOverdue,
                });
            });
        }
        catch (error) {
            console.warn("Fehler beim Berechnen der Occurrences für Planning Transaction:", planningTransaction.id, error);
        }
    });
    return upcomingTransactions.sort((a, b) => dayjs(a.executionDate).valueOf() - dayjs(b.executionDate).valueOf());
});
// Sichtbare Items entsprechend Button-Einstellung (3 oder 8)
const visibleItems = computed(() => upcomingPlanningTransactions.value.slice(0, planningLimit.value));
// Konstanten für Zeilenhöhe und Zwischenabstand (px)
const ROW_HEIGHT = 56; // Höhe je Kartenzeile (inkl. Padding)
const ROW_GAP = 4; // Abstand zwischen Karten (space-y-1 ≈ 0.25rem = 4px)
// Anzahl der Zeilen, die maximal sichtbar sein dürfen (Hardcap 4)
const containerRows = computed(() => Math.min(visibleItems.value.length, 5));
// Scrollbar aktiv, wenn mehr als 4 sichtbar konfiguriert sind
const isScrollable = computed(() => planningLimit.value > 4 && visibleItems.value.length > 4);
// Dynamischer Stil für den Scroll-Container: max-height + overflow nur vertikal
const listContainerStyle = computed(() => {
    const rows = containerRows.value;
    const maxHeight = rows > 0 ? rows * ROW_HEIGHT + (rows - 1) * ROW_GAP : 0;
    // Wenn mehr Items als sichtbare Zeilen vorhanden: vertikal scrollen
    const needScroll = visibleItems.value.length > rows;
    return {
        maxHeight: `${maxHeight}px`,
        overflowY: needScroll ? "auto" : "hidden",
        overflowX: "hidden",
    };
});
// Kompakteres Padding, sobald Scroll aktiv ist (verhindert horizontalen Scroll)
const rowPaddingClass = computed(() => (isScrollable.value ? "p-1" : "p-2"));
const dueTransactions = computed(() => {
    return upcomingPlanningTransactions.value.filter((item) => item.isDue);
});
async function executePlanning(planningTransactionId, executionDate) {
    try {
        await PlanningService.executePlanningTransaction(planningTransactionId, executionDate);
    }
    catch (error) {
        console.error("Fehler beim Ausführen der geplanten Transaktion:", error);
    }
}
async function skipPlanning(planningTransactionId, executionDate) {
    try {
        await PlanningService.skipPlanningTransaction(planningTransactionId, executionDate);
    }
    catch (error) {
        console.error("Fehler beim Überspringen der geplanten Transaktion:", error);
    }
}
async function executeAutomaticTransactions() {
    try {
        const count = await PlanningService.executeAllDuePlanningTransactions();
        if (count > 0) {
            alert(`${count} fällige Planungsbuchungen wurden ausgeführt.`);
        }
        else {
            alert("Keine fälligen Planungsbuchungen gefunden.");
        }
    }
    catch (error) {
        console.error("Fehler beim Ausführen der fälligen Planungsbuchungen:", error);
        alert("Fehler beim Ausführen der fälligen Planungsbuchungen.");
    }
}
function getTransactionTypeIcon(type) {
    if (!type)
        return "mdi:help-circle-outline";
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
            return "mdi:bank-transfer";
        case TransactionType.CATEGORYTRANSFER:
            return "mdi:briefcase-transfer-outline";
        case TransactionType.EXPENSE:
            return "mdi:bank-transfer-out";
        case TransactionType.INCOME:
            return "mdi:bank-transfer-in";
        default:
            return "mdi:help-circle-outline";
    }
}
function getTransactionTypeClass(type) {
    if (!type)
        return "";
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
        case TransactionType.CATEGORYTRANSFER:
            return "text-warning";
        case TransactionType.EXPENSE:
            return "text-error";
        case TransactionType.INCOME:
            return "text-success";
        default:
            return "";
    }
}
function getSourceName(planning) {
    if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        return (categoryStore.getCategoryById(planning.categoryId || "")?.name || "-");
    }
    else {
        return accountStore.getAccountById(planning.accountId)?.name || "-";
    }
}
function getTargetName(planning) {
    if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        return (categoryStore.getCategoryById(planning.transferToCategoryId || "")
            ?.name || "-");
    }
    else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
        return (accountStore.getAccountById(planning.transferToAccountId || "")?.name ||
            "-");
    }
    else {
        return (categoryStore.getCategoryById(planning.categoryId || "")?.name || "-");
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showHeader: true,
    showActions: true,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ppg-list']} */ ;
/** @type {__VLS_StyleScopedClasses['ppg-list']} */ ;
/** @type {__VLS_StyleScopedClasses['ppg-list']} */ ;
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
    ...{ class: "text-sm" },
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
                __VLS_ctx.setPlanningLimit(3);
            } },
        ...{ class: (__VLS_ctx.planningLimit === 3
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showActions))
                    return;
                __VLS_ctx.setPlanningLimit(8);
            } },
        ...{ class: (__VLS_ctx.planningLimit === 8
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.navigateToPlanning) },
        ...{ class: "btn btn-xs btn-outline" },
    });
    if (__VLS_ctx.dueTransactions.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.executeAutomaticTransactions) },
            ...{ class: "btn btn-xs btn-info btn-outline" },
            title: (`${__VLS_ctx.dueTransactions.length} fällige Planungen ausführen`),
        });
        const __VLS_0 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            icon: "mdi:play-circle",
            ...{ class: "mr-1" },
        }));
        const __VLS_2 = __VLS_1({
            icon: "mdi:play-circle",
            ...{ class: "mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        (__VLS_ctx.dueTransactions.length);
    }
}
if (__VLS_ctx.upcomingPlanningTransactions.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "ppg-list space-y-1" },
        ...{ style: (__VLS_ctx.listContainerStyle) },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.visibleItems))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.upcomingPlanningTransactions.length > 0))
                        return;
                    __VLS_ctx.navigateToPlanningEdit(item.planningTransaction.id);
                } },
            key: (`${item.planningTransaction.id}-${item.executionDate}`),
            ...{ class: ([
                    'ppg-row flex items-center justify-between rounded-lg cursor-pointer transition-colors',
                    __VLS_ctx.rowPaddingClass,
                    item.isOverdue
                        ? 'bg-error/10 hover:bg-error/20 border border-error/20'
                        : item.isDue
                            ? 'bg-info/10 hover:bg-info/20 border border-info/20'
                            : 'bg-base-200 hover:bg-base-300',
                ]) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center space-x-1 flex-1 min-w-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-shrink-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "iconify text-lg" },
            ...{ class: (__VLS_ctx.getTransactionTypeClass(item.planningTransaction.transactionType)) },
            'data-icon': (__VLS_ctx.getTransactionTypeIcon(item.planningTransaction.transactionType)),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-1 min-w-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-xs font-medium truncate" },
        });
        (item.planningTransaction.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-xs opacity-60 truncate" },
        });
        (item.formattedDate);
        (__VLS_ctx.getSourceName(item.planningTransaction));
        (__VLS_ctx.getTargetName(item.planningTransaction));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center space-x-2 flex-shrink-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm font-semibold" },
            ...{ class: (__VLS_ctx.getTransactionTypeClass(item.planningTransaction.transactionType)) },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (item.planningTransaction.amount),
            asInteger: (true),
        }));
        const __VLS_5 = __VLS_4({
            amount: (item.planningTransaction.amount),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_4));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex space-x-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-top max-w-xs" },
            'data-tip': "Planungstransaktion ausführen und echte Transaktion erstellen",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.upcomingPlanningTransactions.length > 0))
                        return;
                    __VLS_ctx.executePlanning(item.planningTransaction.id, item.executionDate);
                } },
            ...{ class: "btn btn-ghost btn-xs border-none" },
        });
        const __VLS_7 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
            icon: "mdi:play",
            ...{ class: "text-base text-success" },
        }));
        const __VLS_9 = __VLS_8({
            icon: "mdi:play",
            ...{ class: "text-base text-success" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-top max-w-xs" },
            'data-tip': "Planungstransaktion überspringen (als erledigt markieren ohne Transaktion zu erstellen)",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.upcomingPlanningTransactions.length > 0))
                        return;
                    __VLS_ctx.skipPlanning(item.planningTransaction.id, item.executionDate);
                } },
            ...{ class: "btn btn-ghost btn-xs border-none" },
        });
        const __VLS_11 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
            icon: "mdi:skip-next",
            ...{ class: "text-base text-warning" },
        }));
        const __VLS_13 = __VLS_12({
            icon: "mdi:skip-next",
            ...{ class: "text-base text-warning" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    }
    if (__VLS_ctx.upcomingPlanningTransactions.length > __VLS_ctx.planningLimit) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-center pt-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs opacity-60" },
        });
        (__VLS_ctx.upcomingPlanningTransactions.length - __VLS_ctx.planningLimit);
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-info']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['ppg-list']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ppg-row']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['iconify']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-top']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-top']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['italic']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            CurrencyDisplay: CurrencyDisplay,
            planningLimit: planningLimit,
            setPlanningLimit: setPlanningLimit,
            navigateToPlanning: navigateToPlanning,
            navigateToPlanningEdit: navigateToPlanningEdit,
            upcomingPlanningTransactions: upcomingPlanningTransactions,
            visibleItems: visibleItems,
            listContainerStyle: listContainerStyle,
            rowPaddingClass: rowPaddingClass,
            dueTransactions: dueTransactions,
            executePlanning: executePlanning,
            skipPlanning: skipPlanning,
            executeAutomaticTransactions: executeAutomaticTransactions,
            getTransactionTypeIcon: getTransactionTypeIcon,
            getTransactionTypeClass: getTransactionTypeClass,
            getSourceName: getSourceName,
            getTargetName: getTargetName,
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
