import { defineProps, defineEmits, ref, computed, onMounted, onUnmounted, nextTick, watch, } from "vue";
import { TransactionType } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits([
    "execute",
    "skip",
    "edit",
    "delete",
]);
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
// Lazy Loading State
const visibleItemsCount = ref(25); // Initial number of items to show
const itemsPerLoad = 25; // Number of items to load when scrolling
const loadingMoreItems = ref(false);
const sentinelRef = ref(null);
const intersectionObserver = ref(null);
// Dynamic height calculation
const containerRef = ref(null);
const containerHeight = ref('600px');
const resizeObserver = ref(null);
// Filterung der Transaktionen
const displayTransactions = computed(() => {
    let filtered = [...props.planningTransactions];
    if (props.searchTerm && props.searchTerm.trim() !== "") {
        const term = props.searchTerm.toLowerCase().trim();
        filtered = filtered.filter((entry) => {
            const t = entry.transaction;
            const dateField = formatDate(entry.date);
            const recipientName = recipientStore.getRecipientById(t.recipientId || "")?.name || "";
            const accountName = accountStore.getAccountById(t.accountId)?.name || "";
            const categoryName = categoryStore.getCategoryById(t.categoryId || "")?.name || "";
            const amountStr = t.amount.toString();
            const name = t.name || "";
            const fields = [
                dateField,
                name,
                recipientName,
                accountName,
                categoryName,
                amountStr,
            ];
            return fields.some((field) => field.toLowerCase().includes(term));
        });
    }
    return filtered;
});
// Lazy Loading: Nur die sichtbaren Transaktionen anzeigen
const sortedDisplayTransactions = computed(() => {
    return displayTransactions.value.slice(0, visibleItemsCount.value);
});
// Check if there are more items to load
const hasMoreItems = computed(() => {
    return visibleItemsCount.value < displayTransactions.value.length;
});
// Hilfsfunktionen für Planning-Transaktionen
function getTransactionTypeIcon(type) {
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
function getTransactionTypeLabel(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
            return "Kontotransfer";
        case TransactionType.CATEGORYTRANSFER:
            return "Kategorietransfer";
        case TransactionType.EXPENSE:
            return "Ausgabe";
        case TransactionType.INCOME:
            return "Einnahme";
        default:
            return "Unbekannt";
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
// Event handlers
function handleExecute(transactionId, date) {
    emit("execute", transactionId, date);
}
function handleSkip(transactionId, date) {
    emit("skip", transactionId, date);
}
function handleEdit(transaction) {
    emit("edit", transaction);
}
function handleDelete(transaction) {
    emit("delete", transaction);
}
// Lazy Loading Functions
function loadMoreItems() {
    if (loadingMoreItems.value || !hasMoreItems.value)
        return;
    loadingMoreItems.value = true;
    // Simulate loading delay for better UX
    setTimeout(() => {
        visibleItemsCount.value = Math.min(visibleItemsCount.value + itemsPerLoad, displayTransactions.value.length);
        loadingMoreItems.value = false;
    }, 100);
}
function setupIntersectionObserver() {
    if (!sentinelRef.value)
        return;
    // Finde den scrollbaren Container mit fester Höhe
    const scrollContainer = sentinelRef.value.closest('.overflow-y-auto');
    intersectionObserver.value = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreItems.value) {
            loadMoreItems();
        }
    }, {
        root: scrollContainer, // Verwende den scrollbaren Container als root
        rootMargin: "50px", // Reduziert für bessere Performance im Container
        threshold: 0.1,
    });
    intersectionObserver.value.observe(sentinelRef.value);
}
function resetLazyLoading() {
    visibleItemsCount.value = itemsPerLoad;
}
// Dynamic height calculation functions
function calculateContainerHeight() {
    if (!containerRef.value)
        return;
    const viewportHeight = window.innerHeight;
    const containerRect = containerRef.value.getBoundingClientRect();
    // Berechne verfügbare Höhe: Viewport - Container-Top-Position - Padding/Margin (ca. 100px)
    const availableHeight = viewportHeight - containerRect.top - 100;
    // Mindesthöhe von 400px, maximale Höhe von 80% des Viewports
    const minHeight = 400;
    const maxHeight = viewportHeight * 0.8;
    const calculatedHeight = Math.max(minHeight, Math.min(availableHeight, maxHeight));
    containerHeight.value = `${calculatedHeight}px`;
}
function setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined')
        return;
    resizeObserver.value = new ResizeObserver(() => {
        calculateContainerHeight();
    });
    if (containerRef.value) {
        resizeObserver.value.observe(containerRef.value);
    }
}
function cleanupResizeObserver() {
    if (resizeObserver.value) {
        resizeObserver.value.disconnect();
        resizeObserver.value = null;
    }
}
// Watch for changes in transactions to reset lazy loading
function handleTransactionsChange() {
    resetLazyLoading();
    nextTick(() => {
        if (intersectionObserver.value) {
            intersectionObserver.value.disconnect();
        }
        setupIntersectionObserver();
    });
}
// Lifecycle hooks
onMounted(() => {
    nextTick(() => {
        calculateContainerHeight();
        setupIntersectionObserver();
        setupResizeObserver();
        // Listen to window resize events
        window.addEventListener('resize', calculateContainerHeight);
    });
});
onUnmounted(() => {
    if (intersectionObserver.value) {
        intersectionObserver.value.disconnect();
    }
    cleanupResizeObserver();
    window.removeEventListener('resize', calculateContainerHeight);
});
// Watch for prop changes that should reset lazy loading
watch(() => [props.planningTransactions, props.searchTerm], () => {
    handleTransactionsChange();
}, { deep: true });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "containerRef",
    ...{ class: "flex flex-col" },
});
/** @type {typeof __VLS_ctx.containerRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: ({ height: __VLS_ctx.containerHeight }) },
    ...{ class: "overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-full overflow-x-auto overflow-y-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-sm w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({
    ...{ class: "sticky top-0 z-20 bg-base-100 shadow-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
    ...{ class: "text-xs" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 text-right bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "py-1 text-right bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [e, index] of __VLS_getVForSourceType((__VLS_ctx.sortedDisplayTransactions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (`${e.transaction.id}-${e.date}`),
        ...{ class: (index % 2 === 0 ? 'bg-base-100' : 'bg-base-200') },
        ...{ class: "text-sm hover:bg-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1" },
    });
    (__VLS_ctx.formatDate(e.date));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-primary" },
        'data-tip': (__VLS_ctx.getTransactionTypeLabel(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: (__VLS_ctx.getTransactionTypeIcon(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
        ...{ class: (__VLS_ctx.getTransactionTypeClass(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)) },
        ...{ class: "text-lg" },
    }));
    const __VLS_2 = __VLS_1({
        icon: (__VLS_ctx.getTransactionTypeIcon(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
        ...{ class: (__VLS_ctx.getTransactionTypeClass(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)) },
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1" },
    });
    (e.transaction.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1" },
    });
    (__VLS_ctx.recipientStore.getRecipientById(e.transaction.recipientId || "")?.name || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1" },
    });
    (__VLS_ctx.getSourceName(e.transaction));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1" },
    });
    (__VLS_ctx.getTargetName(e.transaction));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1 text-right" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (e.transaction.amount),
        showZero: (true),
    }));
    const __VLS_5 = __VLS_4({
        amount: (e.transaction.amount),
        showZero: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_4));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "py-1 text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-success" },
        'data-tip': "Planungstransaktion ausführen",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleExecute(e.transaction.id, e.date);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none" },
    });
    const __VLS_7 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        icon: "mdi:play",
        ...{ class: "text-sm text-success" },
    }));
    const __VLS_9 = __VLS_8({
        icon: "mdi:play",
        ...{ class: "text-sm text-success" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-warning" },
        'data-tip': "Planungstransaktion überspringen",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleSkip(e.transaction.id, e.date);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none" },
    });
    const __VLS_11 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
        icon: "mdi:skip-next",
        ...{ class: "text-sm text-warning" },
    }));
    const __VLS_13 = __VLS_12({
        icon: "mdi:skip-next",
        ...{ class: "text-sm text-warning" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-info" },
        'data-tip': "Planungstransaktion bearbeiten",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleEdit(e.transaction);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none" },
    });
    const __VLS_15 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(__VLS_15, new __VLS_15({
        icon: "mdi:pencil",
        ...{ class: "text-sm" },
    }));
    const __VLS_17 = __VLS_16({
        icon: "mdi:pencil",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip tooltip-error" },
        'data-tip': "Planungstransaktion löschen",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleDelete(e.transaction);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-error/75" },
    });
    const __VLS_19 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
        icon: "mdi:trash-can",
        ...{ class: "text-sm" },
    }));
    const __VLS_21 = __VLS_20({
        icon: "mdi:trash-can",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
}
if (__VLS_ctx.sortedDisplayTransactions.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "8",
        ...{ class: "text-center py-4" },
    });
}
if (__VLS_ctx.hasMoreItems) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-center py-4" },
    });
    if (__VLS_ctx.loadingMoreItems) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center space-x-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "loading loading-spinner loading-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-sm opacity-70" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ref: "sentinelRef",
        ...{ class: "h-1 w-full" },
    });
    /** @type {typeof __VLS_ctx.sentinelRef} */ ;
}
else if (__VLS_ctx.displayTransactions.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-center py-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm opacity-50" },
    });
    (__VLS_ctx.displayTransactions.length);
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-success']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-info']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-error']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error/75']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            TransactionType: TransactionType,
            formatDate: formatDate,
            CurrencyDisplay: CurrencyDisplay,
            Icon: Icon,
            recipientStore: recipientStore,
            loadingMoreItems: loadingMoreItems,
            sentinelRef: sentinelRef,
            containerRef: containerRef,
            containerHeight: containerHeight,
            displayTransactions: displayTransactions,
            sortedDisplayTransactions: sortedDisplayTransactions,
            hasMoreItems: hasMoreItems,
            getTransactionTypeIcon: getTransactionTypeIcon,
            getTransactionTypeClass: getTransactionTypeClass,
            getTransactionTypeLabel: getTransactionTypeLabel,
            getSourceName: getSourceName,
            getTargetName: getTargetName,
            handleExecute: handleExecute,
            handleSkip: handleSkip,
            handleEdit: handleEdit,
            handleDelete: handleDelete,
        };
    },
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
