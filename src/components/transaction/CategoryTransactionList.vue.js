import { defineProps, defineEmits, ref, computed, defineExpose, onMounted, onUnmounted, nextTick, watch, } from "vue";
import { TransactionType } from "../../types";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import CategoryTransferModal from "../budget/CategoryTransferModal.vue";
import ConfirmationModal from "../ui/ConfirmationModal.vue";
import { AccountService } from "../../services/AccountService";
import { CategoryService } from "../../services/CategoryService";
import { debugLog } from "../../utils/logger";
import { TransactionService } from "../../services/TransactionService"; // Import hinzugefügt
import { ReconciliationService } from "../../services/ReconciliationService";
debugLog("[CategoryTransactionList] TransactionService on setup:", JSON.stringify(TransactionService, null, 2)); // Log zur Validierung
const props = defineProps();
const emit = defineEmits([
    "edit",
    "delete",
    "sort-change",
    "toggleReconciliation",
    "selection-changed",
]);
// Lazy Loading State
const visibleItemsCount = ref(25); // Initial number of items to show
const itemsPerLoad = 25; // Number of items to load when scrolling
const loadingMoreItems = ref(false);
const sentinelRef = ref(null);
const intersectionObserver = ref(null);
// Dynamic height calculation
const containerRef = ref(null);
const summaryRef = ref(null);
const containerHeight = ref('600px');
const resizeObserver = ref(null);
// Filterung und Sortierung der Transaktionen:
// ACCOUNTTRANSFER werden aus der Kategorien-Transaktionsliste ausgeblendet.
const allDisplayTransactions = computed(() => {
    let list = props.transactions.filter((tx) => tx.type !== TransactionType.ACCOUNTTRANSFER);
    if (props.searchTerm && props.searchTerm.trim() !== "") {
        const term = props.searchTerm.toLowerCase().trim();
        list = list.filter((tx) => {
            const fields = [
                formatDate(tx.date),
                formatDate(tx.valueDate),
                CategoryService.getCategoryName(tx.categoryId || null),
                CategoryService.getCategoryName(tx.toCategoryId || null),
                tx.amount.toString(),
                tx.note || "",
            ];
            return fields.some((field) => field.toLowerCase().includes(term));
        });
    }
    // KORRIGIERT: Explizite Sortierung für CategoryTransactionList
    // Sortiert nach valueDate (primär) und updated_at (sekundär) entsprechend sortOrder
    const sortedList = [...list].sort((a, b) => {
        // Primär nach valueDate sortieren (für Kategorien ist valueDate maßgeblich)
        const dateA = a.valueDate;
        const dateB = b.valueDate;
        const dateComparison = props.sortOrder === "asc"
            ? dateA.localeCompare(dateB)
            : dateB.localeCompare(dateA);
        if (dateComparison !== 0) {
            return dateComparison;
        }
        // Sekundär nach createdAt sortieren für korrekte Reihenfolge am gleichen Tag
        const createdA = a.createdAt || "1970-01-01T00:00:00.000Z";
        const createdB = b.createdAt || "1970-01-01T00:00:00.000Z";
        return props.sortOrder === "asc"
            ? createdA.localeCompare(createdB)
            : createdB.localeCompare(createdA);
    });
    return sortedList;
});
// Lazy Loading: Nur die sichtbaren Transaktionen anzeigen
const displayTransactions = computed(() => {
    return allDisplayTransactions.value.slice(0, visibleItemsCount.value);
});
// Check if there are more items to load
const hasMoreItems = computed(() => {
    return visibleItemsCount.value < allDisplayTransactions.value.length;
});
// --- Selection Logic ---
const selectedIds = ref([]);
const lastSelectedIndex = ref(null);
const currentPageIds = computed(() => displayTransactions.value.map((tx) => tx.id));
const allSelected = computed(() => currentPageIds.value.length > 0 &&
    currentPageIds.value.every((id) => selectedIds.value.includes(id)));
function handleHeaderCheckboxChange(event) {
    const checked = event.target.checked;
    if (checked) {
        selectedIds.value = [
            ...Array.from(new Set([...selectedIds.value, ...currentPageIds.value])),
        ];
    }
    else {
        const currentPageIdSet = new Set(currentPageIds.value);
        selectedIds.value = selectedIds.value.filter((id) => !currentPageIdSet.has(id));
    }
    lastSelectedIndex.value = null;
    emit("selection-changed", selectedIds.value.length);
}
function handleCheckboxClick(transactionId, index, event) {
    const target = event.target;
    const isChecked = target.checked;
    const displayedTxs = displayTransactions.value;
    if (event.shiftKey &&
        lastSelectedIndex.value !== null &&
        lastSelectedIndex.value < displayedTxs.length) {
        const start = Math.min(lastSelectedIndex.value, index);
        const end = Math.max(lastSelectedIndex.value, index);
        for (let i = start; i <= end; i++) {
            if (i < displayedTxs.length) {
                const id = displayedTxs[i].id;
                if (isChecked && !selectedIds.value.includes(id)) {
                    selectedIds.value.push(id);
                }
                else if (!isChecked) {
                    const pos = selectedIds.value.indexOf(id);
                    if (pos !== -1)
                        selectedIds.value.splice(pos, 1);
                }
            }
        }
    }
    else {
        if (isChecked && !selectedIds.value.includes(transactionId)) {
            selectedIds.value.push(transactionId);
        }
        else if (!isChecked) {
            const pos = selectedIds.value.indexOf(transactionId);
            if (pos !== -1)
                selectedIds.value.splice(pos, 1);
        }
    }
    lastSelectedIndex.value = index;
    emit("selection-changed", selectedIds.value.length);
}
function getSelectedTransactions() {
    return allDisplayTransactions.value.filter((tx) => selectedIds.value.includes(tx.id));
}
function clearSelection() {
    selectedIds.value = [];
    emit("selection-changed", 0);
}
const __VLS_exposed = { getSelectedTransactions, selectedIds, clearSelection };
defineExpose(__VLS_exposed);
// Computed properties für Summenanzeige
const selectedTransactions = computed(() => {
    return allDisplayTransactions.value.filter((tx) => selectedIds.value.includes(tx.id));
});
const selectedTotalAmount = computed(() => {
    return selectedTransactions.value.reduce((sum, tx) => sum + tx.amount, 0);
});
const selectedReconciledAmount = computed(() => {
    return selectedTransactions.value
        .filter((tx) => tx.reconciled)
        .reduce((sum, tx) => sum + tx.amount, 0);
});
const selectedUnreconciledAmount = computed(() => {
    return selectedTransactions.value
        .filter((tx) => !tx.reconciled)
        .reduce((sum, tx) => sum + tx.amount, 0);
});
const hasSelectedTransactions = computed(() => {
    return selectedIds.value.length > 0;
});
// --- Modal Logic für Bearbeitung von Category Transfers ---
const showTransferModal = ref(false);
const modalData = ref(null);
// Confirmation Modal State
const showDeleteConfirmation = ref(false);
const transactionToDelete = ref(null);
function editTransactionLocal(tx) {
    if (tx.type === TransactionType.CATEGORYTRANSFER) {
        const isFromPart = tx.amount < 0;
        const transactionId = isFromPart ? tx.id : tx.counterTransactionId || "";
        const gegentransactionId = isFromPart
            ? tx.counterTransactionId || ""
            : tx.id;
        const fromCatId = isFromPart ? tx.categoryId : tx.toCategoryId || "";
        const toCatId = isFromPart ? tx.toCategoryId || "" : tx.categoryId;
        if (!transactionId || !gegentransactionId) {
            console.error("Counter transaction ID missing for category transfer:", tx);
            return;
        }
        modalData.value = {
            transactionId,
            gegentransactionId,
            prefillAmount: Math.abs(tx.amount),
            fromCategoryId: fromCatId || "",
            toCategoryId: toCatId || "",
            prefillDate: tx.date,
            note: tx.note,
        };
        debugLog("[CategoryTransactionList] Opening edit modal for transfer", JSON.stringify(modalData.value, null, 2));
        showTransferModal.value = true;
    }
    else {
        debugLog("[CategoryTransactionList] Emitting edit für Standardtransaction", JSON.stringify(tx, null, 2));
        emit("edit", tx);
    }
}
function onTransferComplete() {
    showTransferModal.value = false;
    debugLog("[CategoryTransactionList] Transfer modal closed, operation successful.", "null");
}
// Delete confirmation functions
function confirmDelete(transaction) {
    transactionToDelete.value = transaction;
    showDeleteConfirmation.value = true;
}
function handleDeleteConfirm() {
    if (transactionToDelete.value) {
        emit("delete", transactionToDelete.value);
        showDeleteConfirmation.value = false;
        transactionToDelete.value = null;
    }
}
function handleDeleteCancel() {
    showDeleteConfirmation.value = false;
    transactionToDelete.value = null;
}
// Helper function to get transaction description for confirmation
function getTransactionDescription(transaction) {
    const date = formatDate(transaction.date);
    const amount = Math.abs(transaction.amount).toFixed(2);
    if (transaction.type === TransactionType.CATEGORYTRANSFER) {
        const fromCategory = CategoryService.getCategoryName(transaction.toCategoryId || null);
        const toCategory = CategoryService.getCategoryName(transaction.categoryId || null);
        return `${date} - Kategorieübertragung: ${fromCategory} → ${toCategory} (${amount} €)`;
    }
    else {
        const account = AccountService.getAccountNameSync(transaction.accountId);
        const category = CategoryService.getCategoryName(transaction.categoryId || null);
        return `${date} - ${account} → ${category} (${amount} €)`;
    }
}
// Reconciliation toggle function
function toggleReconciliation(transaction) {
    ReconciliationService.toggleTransactionReconciled(transaction.id);
    emit("toggleReconciliation", transaction);
}
// Lazy Loading Functions
function loadMoreItems() {
    if (loadingMoreItems.value || !hasMoreItems.value)
        return;
    loadingMoreItems.value = true;
    // Simulate loading delay for better UX
    setTimeout(() => {
        visibleItemsCount.value = Math.min(visibleItemsCount.value + itemsPerLoad, allDisplayTransactions.value.length);
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
    const summaryHeight = summaryRef.value?.offsetHeight || 0;
    // Berechne verfügbare Höhe: Viewport - Container-Top-Position - Padding/Margin (ca. 100px)
    const availableHeight = viewportHeight - containerRect.top - summaryHeight - 100;
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
watch(() => [props.transactions, props.sortKey, props.sortOrder, props.searchTerm], () => {
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
if (__VLS_ctx.hasSelectedTransactions) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ref: "summaryRef",
        ...{ class: "bg-base-100 border-b border-base-300 mb-1 pb-1 text-sm text-base-content/70" },
    });
    /** @type {typeof __VLS_ctx.summaryRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.selectedTotalAmount),
        asInteger: (false),
        ...{ class: "font-medium" },
    }));
    const __VLS_1 = __VLS_0({
        amount: (__VLS_ctx.selectedTotalAmount),
        asInteger: (false),
        ...{ class: "font-medium" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_3 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.selectedReconciledAmount),
        asInteger: (false),
        ...{ class: "font-medium text-success" },
    }));
    const __VLS_4 = __VLS_3({
        amount: (__VLS_ctx.selectedReconciledAmount),
        asInteger: (false),
        ...{ class: "font-medium text-success" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.selectedUnreconciledAmount),
        asInteger: (false),
        ...{ class: "font-medium text-warning" },
    }));
    const __VLS_7 = __VLS_6({
        amount: (__VLS_ctx.selectedUnreconciledAmount),
        asInteger: (false),
        ...{ class: "font-medium text-warning" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: ({ height: __VLS_ctx.containerHeight }) },
    ...{ class: "overflow-hidden" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "h-full overflow-x-auto overflow-y-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table w-full table-zebra table-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({
    ...{ class: "sticky top-0 z-20 bg-base-100 shadow-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "w-5 px-1 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.handleHeaderCheckboxChange) },
    type: "checkbox",
    ...{ class: "checkbox checkbox-sm" },
    checked: (__VLS_ctx.allSelected),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('sort-change', 'date');
        } },
    ...{ class: "cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.sortKey === 'date') {
    const __VLS_9 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }));
    const __VLS_11 = __VLS_10({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_10));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('sort-change', 'valueDate');
        } },
    ...{ class: "cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.sortKey === 'valueDate') {
    const __VLS_13 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }));
    const __VLS_15 = __VLS_14({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('sort-change', 'toCategoryId');
        } },
    ...{ class: "cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.sortKey === 'toCategoryId') {
    const __VLS_17 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }));
    const __VLS_19 = __VLS_18({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
}
const __VLS_21 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    icon: "mdi:chevron-triple-right",
    ...{ class: "ml-5 text-lg cursor-help" },
}));
const __VLS_23 = __VLS_22({
    icon: "mdi:chevron-triple-right",
    ...{ class: "ml-5 text-lg cursor-help" },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('sort-change', 'categoryId');
        } },
    ...{ class: "cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.sortKey === 'categoryId') {
    const __VLS_25 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }));
    const __VLS_27 = __VLS_26({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('sort-change', 'amount');
        } },
    ...{ class: "text-right cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-end" },
});
if (__VLS_ctx.sortKey === 'amount') {
    const __VLS_29 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }));
    const __VLS_31 = __VLS_30({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center cursor-pointer px-1 bg-base-100" },
});
const __VLS_33 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    icon: "mdi:note-text-outline",
    ...{ class: "text-base" },
}));
const __VLS_35 = __VLS_34({
    icon: "mdi:note-text-outline",
    ...{ class: "text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-center px-1 bg-base-100" },
});
const __VLS_37 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    icon: "mdi:check-circle-outline",
    ...{ class: "text-base" },
    title: "Abgleich",
}));
const __VLS_39 = __VLS_38({
    icon: "mdi:check-circle-outline",
    ...{ class: "text-base" },
    title: "Abgleich",
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [tx, index] of __VLS_getVForSourceType((__VLS_ctx.displayTransactions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (tx.id),
        ...{ class: "hover" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.handleCheckboxClick(tx.id, index, $event);
            } },
        type: "checkbox",
        ...{ class: "checkbox checkbox-sm" },
        checked: (__VLS_ctx.selectedIds.includes(tx.id)),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    (__VLS_ctx.formatDate(tx.date));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    (__VLS_ctx.formatDate(tx.valueDate));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    if (tx.type === __VLS_ctx.TransactionType.CATEGORYTRANSFER) {
        (__VLS_ctx.CategoryService.getCategoryName(tx.toCategoryId || null));
    }
    else {
        (__VLS_ctx.AccountService.getAccountNameSync(tx.accountId));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    (__VLS_ctx.CategoryService.getCategoryName(tx.categoryId || null));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right px-2" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (tx.amount),
        showZero: (true),
        asInteger: (false),
        ...{ class: ({
                'text-warning': tx.type === __VLS_ctx.TransactionType.CATEGORYTRANSFER,
                'text-success': tx.type === __VLS_ctx.TransactionType.INCOME,
                'text-error': tx.type === __VLS_ctx.TransactionType.EXPENSE,
                'text-info': tx.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER,
            }) },
    }));
    const __VLS_42 = __VLS_41({
        amount: (tx.amount),
        showZero: (true),
        asInteger: (false),
        ...{ class: ({
                'text-warning': tx.type === __VLS_ctx.TransactionType.CATEGORYTRANSFER,
                'text-success': tx.type === __VLS_ctx.TransactionType.INCOME,
                'text-error': tx.type === __VLS_ctx.TransactionType.EXPENSE,
                'text-info': tx.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER,
            }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center px-1" },
    });
    if (tx.note && tx.note.trim()) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-left" },
            'data-tip': (tx.note),
        });
        const __VLS_44 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            icon: "mdi:comment-text-outline",
            ...{ class: "text-base opacity-60 cursor-help" },
        }));
        const __VLS_46 = __VLS_45({
            icon: "mdi:comment-text-outline",
            ...{ class: "text-base opacity-60 cursor-help" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center px-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (...[$event]) => {
                __VLS_ctx.toggleReconciliation(tx);
            } },
        type: "checkbox",
        ...{ class: "checkbox checkbox-xs rounded-full" },
        checked: (tx.reconciled || false),
        title: "Abgeglichen",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right px-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editTransactionLocal(tx);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none px-1" },
        title: "Bearbeiten",
    });
    const __VLS_48 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_50 = __VLS_49({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.confirmDelete(tx);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-error/75 px-1" },
        title: "Löschen",
    });
    const __VLS_52 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_54 = __VLS_53({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
}
if (__VLS_ctx.displayTransactions.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "9",
        ...{ class: "text-center py-4 text-base-content/70" },
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
else if (__VLS_ctx.allDisplayTransactions.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-center py-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm opacity-50" },
    });
    (__VLS_ctx.allDisplayTransactions.length);
}
if (__VLS_ctx.showTransferModal && __VLS_ctx.modalData) {
    /** @type {[typeof CategoryTransferModal, ]} */ ;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent(CategoryTransferModal, new CategoryTransferModal({
        ...{ 'onClose': {} },
        ...{ 'onTransfer': {} },
        mode: "edit",
        isOpen: (__VLS_ctx.showTransferModal),
        prefillAmount: (__VLS_ctx.modalData.prefillAmount),
        prefillDate: (__VLS_ctx.modalData.prefillDate),
        fromCategoryId: (__VLS_ctx.modalData.fromCategoryId),
        toCategoryId: (__VLS_ctx.modalData.toCategoryId),
        transactionId: (__VLS_ctx.modalData.transactionId),
        gegentransactionId: (__VLS_ctx.modalData.gegentransactionId),
        note: (__VLS_ctx.modalData.note),
    }));
    const __VLS_57 = __VLS_56({
        ...{ 'onClose': {} },
        ...{ 'onTransfer': {} },
        mode: "edit",
        isOpen: (__VLS_ctx.showTransferModal),
        prefillAmount: (__VLS_ctx.modalData.prefillAmount),
        prefillDate: (__VLS_ctx.modalData.prefillDate),
        fromCategoryId: (__VLS_ctx.modalData.fromCategoryId),
        toCategoryId: (__VLS_ctx.modalData.toCategoryId),
        transactionId: (__VLS_ctx.modalData.transactionId),
        gegentransactionId: (__VLS_ctx.modalData.gegentransactionId),
        note: (__VLS_ctx.modalData.note),
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    let __VLS_59;
    let __VLS_60;
    let __VLS_61;
    const __VLS_62 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showTransferModal && __VLS_ctx.modalData))
                return;
            __VLS_ctx.showTransferModal = false;
        }
    };
    const __VLS_63 = {
        onTransfer: (__VLS_ctx.onTransferComplete)
    };
    var __VLS_58;
}
if (__VLS_ctx.showDeleteConfirmation && __VLS_ctx.transactionToDelete) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Transaktion löschen",
        message: (`Möchten Sie diese Transaktion wirklich löschen?\n\n${__VLS_ctx.getTransactionDescription(__VLS_ctx.transactionToDelete)}`),
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_65 = __VLS_64({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Transaktion löschen",
        message: (`Möchten Sie diese Transaktion wirklich löschen?\n\n${__VLS_ctx.getTransactionDescription(__VLS_ctx.transactionToDelete)}`),
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    let __VLS_67;
    let __VLS_68;
    let __VLS_69;
    const __VLS_70 = {
        onConfirm: (__VLS_ctx.handleDeleteConfirm)
    };
    const __VLS_71 = {
        onCancel: (__VLS_ctx.handleDeleteCancel)
    };
    var __VLS_66;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-help']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['hover']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-info']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-help']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error/75']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
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
            CategoryTransferModal: CategoryTransferModal,
            ConfirmationModal: ConfirmationModal,
            AccountService: AccountService,
            CategoryService: CategoryService,
            loadingMoreItems: loadingMoreItems,
            sentinelRef: sentinelRef,
            containerRef: containerRef,
            summaryRef: summaryRef,
            containerHeight: containerHeight,
            allDisplayTransactions: allDisplayTransactions,
            displayTransactions: displayTransactions,
            hasMoreItems: hasMoreItems,
            selectedIds: selectedIds,
            allSelected: allSelected,
            handleHeaderCheckboxChange: handleHeaderCheckboxChange,
            handleCheckboxClick: handleCheckboxClick,
            selectedTotalAmount: selectedTotalAmount,
            selectedReconciledAmount: selectedReconciledAmount,
            selectedUnreconciledAmount: selectedUnreconciledAmount,
            hasSelectedTransactions: hasSelectedTransactions,
            showTransferModal: showTransferModal,
            modalData: modalData,
            showDeleteConfirmation: showDeleteConfirmation,
            transactionToDelete: transactionToDelete,
            editTransactionLocal: editTransactionLocal,
            onTransferComplete: onTransferComplete,
            confirmDelete: confirmDelete,
            handleDeleteConfirm: handleDeleteConfirm,
            handleDeleteCancel: handleDeleteCancel,
            getTransactionDescription: getTransactionDescription,
            toggleReconciliation: toggleReconciliation,
        };
    },
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
