import { defineProps, defineEmits, ref, computed, defineExpose, onMounted, onUnmounted, nextTick, watch, } from "vue";
import { TransactionType } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { formatDate } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { Icon } from "@iconify/vue";
import BadgeSoft from "../ui/BadgeSoft.vue";
import ConfirmationModal from "../ui/ConfirmationModal.vue";
import { ReconciliationService } from "../../services/ReconciliationService";
const props = defineProps();
const emit = defineEmits([
    "edit",
    "delete",
    "sort-change",
    "toggleReconciliation",
    "selection-changed",
]);
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
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
// Confirmation Modal State
const showDeleteConfirmation = ref(false);
const transactionToDelete = ref(null);
// Filterung: CATEGORYTRANSFER-Transaktionen ausschließen
const displayTransactions = computed(() => {
    // immer reaktiv aus props starten
    let filtered = props.transactions.filter((tx) => tx.type !== TransactionType.CATEGORYTRANSFER);
    if (props.searchTerm && props.searchTerm.trim() !== "") {
        const term = props.searchTerm.toLowerCase().trim();
        filtered = filtered.filter((tx) => {
            const dateField = formatDate(tx.date);
            const accountName = accountStore.getAccountById(tx.accountId)?.name || "";
            const recipientName = recipientStore.getRecipientById(tx.recipientId || "")?.name || "";
            const tagNames = tx.tagIds
                .map((tagId) => tagStore.getTagById(tagId)?.name || "")
                .join(" ");
            const amountStr = tx.amount.toString();
            const note = tx.note || "";
            const fields = [
                dateField,
                accountName,
                recipientName,
                tagNames,
                amountStr,
                note,
            ];
            return fields.some((field) => field.toLowerCase().includes(term));
        });
    }
    return filtered;
});
// Sortierte Transaktionen mit korrekter date, createdAt Sortierung für Running Balance
const allSortedDisplayTransactions = computed(() => {
    const transactions = [...displayTransactions.value];
    // Nur bei Datumssortierung die spezielle Sortierung anwenden
    if (props.sortKey === "date") {
        return transactions.sort((a, b) => {
            // Primär nach date sortieren
            const dateA = a.date;
            const dateB = b.date;
            const dateComparison = props.sortOrder === "asc"
                ? dateA.localeCompare(dateB)
                : dateB.localeCompare(dateA);
            if (dateComparison !== 0) {
                return dateComparison;
            }
            // Sekundär nach createdAt sortieren für korrekte Running Balance-Reihenfolge
            const createdA = a.createdAt || "1970-01-01T00:00:00.000Z";
            const createdB = b.createdAt || "1970-01-01T00:00:00.000Z";
            return props.sortOrder === "asc"
                ? createdA.localeCompare(createdB)
                : createdB.localeCompare(createdA);
        });
    }
    // Bei anderen Sortierungen die ursprüngliche Reihenfolge beibehalten
    return transactions;
});
// Lazy Loading: Nur die sichtbaren Transaktionen anzeigen
const sortedDisplayTransactions = computed(() => {
    return allSortedDisplayTransactions.value.slice(0, visibleItemsCount.value);
});
// Check if there are more items to load
const hasMoreItems = computed(() => {
    return visibleItemsCount.value < allSortedDisplayTransactions.value.length;
});
// --- Auswahl-Logik ---
const selectedIds = ref([]);
const lastSelectedIndex = ref(null);
const currentPageIds = computed(() => sortedDisplayTransactions.value.map((tx) => tx.id));
const allDisplayIds = computed(() => allSortedDisplayTransactions.value.map((tx) => tx.id));
const allSelected = computed(() => currentPageIds.value.length > 0 &&
    currentPageIds.value.every((id) => selectedIds.value.includes(id)));
function handleHeaderCheckboxChange(event) {
    const checked = event.target.checked;
    console.log('[TransactionList] Header checkbox changed:', {
        checked,
        currentPageIds: currentPageIds.value.length,
        allDisplayIds: allDisplayIds.value.length,
        allSortedDisplayTransactions: allSortedDisplayTransactions.value.length,
        selectedIdsBefore: selectedIds.value.length
    });
    if (checked) {
        // Wähle ALLE gefilterten Transaktionen aus, nicht nur die sichtbaren
        selectedIds.value = [...allDisplayIds.value];
    }
    else {
        // Entferne ALLE gefilterten Transaktionen aus der Auswahl
        selectedIds.value = selectedIds.value.filter((id) => !allDisplayIds.value.includes(id));
    }
    console.log('[TransactionList] After header checkbox change:', {
        selectedIdsAfter: selectedIds.value.length,
        getSelectedTransactionsLength: getSelectedTransactions().length
    });
    emit("selection-changed", selectedIds.value.length);
}
function handleCheckboxClick(transactionId, index, event) {
    const target = event.target;
    const isChecked = target.checked;
    if (event.shiftKey && lastSelectedIndex.value !== null) {
        const start = Math.min(lastSelectedIndex.value, index);
        const end = Math.max(lastSelectedIndex.value, index);
        for (let i = start; i <= end; i++) {
            const id = sortedDisplayTransactions.value[i].id;
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
    const result = allSortedDisplayTransactions.value.filter((tx) => selectedIds.value.includes(tx.id));
    console.log('[TransactionList] getSelectedTransactions called:', {
        selectedIds: selectedIds.value.length,
        allSortedDisplayTransactions: allSortedDisplayTransactions.value.length,
        resultLength: result.length,
        selectedIdsArray: selectedIds.value
    });
    return result;
}
function clearSelection() {
    selectedIds.value = [];
    emit("selection-changed", 0);
}
const __VLS_exposed = { getSelectedTransactions, clearSelection };
defineExpose(__VLS_exposed);
// Computed properties für Summenanzeige
const selectedTransactions = computed(() => {
    return allSortedDisplayTransactions.value.filter((tx) => selectedIds.value.includes(tx.id));
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
    const recipient = transaction.type === TransactionType.ACCOUNTTRANSFER
        ? accountStore.getAccountById(transaction.transferToAccountId || "")
            ?.name || "Unbekanntes Konto"
        : recipientStore.getRecipientById(transaction.recipientId || "")?.name ||
            "Unbekannter Empfänger";
    return `${date} - ${recipient} (${amount} €)`;
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
        visibleItemsCount.value = Math.min(visibleItemsCount.value + itemsPerLoad, allSortedDisplayTransactions.value.length);
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
    ...{ class: "checkbox checkbox-sm rounded-full" },
    checked: (__VLS_ctx.allSelected),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('sort-change', 'date');
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
if (__VLS_ctx.showAccount) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showAccount))
                    return;
                __VLS_ctx.emit('sort-change', 'accountId');
            } },
        ...{ class: "cursor-pointer px-2 bg-base-100" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center" },
    });
    if (__VLS_ctx.sortKey === 'accountId') {
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
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('sort-change', 'recipientId');
        } },
    ...{ class: "cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.sortKey === 'recipientId') {
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('sort-change', 'categoryId');
        } },
    ...{ class: "cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
if (__VLS_ctx.sortKey === 'categoryId') {
    const __VLS_21 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }));
    const __VLS_23 = __VLS_22({
        icon: (__VLS_ctx.sortOrder === 'asc' ? 'mdi:arrow-up' : 'mdi:arrow-down'),
        ...{ class: "ml-1 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('sort-change', 'amount');
        } },
    ...{ class: "text-right cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-end" },
});
if (__VLS_ctx.sortKey === 'amount') {
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
    ...{ class: "text-center cursor-pointer px-1 bg-base-100" },
});
const __VLS_29 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    icon: "mdi:note-text-outline",
    ...{ class: "text-base" },
}));
const __VLS_31 = __VLS_30({
    icon: "mdi:note-text-outline",
    ...{ class: "text-base" },
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right cursor-pointer px-2 bg-base-100" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-end" },
});
const __VLS_33 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    icon: "mdi:scale-balance",
    ...{ class: "ml-1 text-sm opacity-50" },
}));
const __VLS_35 = __VLS_34({
    icon: "mdi:scale-balance",
    ...{ class: "ml-1 text-sm opacity-50" },
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
for (const [tx, index] of __VLS_getVForSourceType((__VLS_ctx.sortedDisplayTransactions))) {
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
    if (__VLS_ctx.showAccount) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "px-2" },
        });
        (__VLS_ctx.accountStore.getAccountById(tx.accountId)?.name || "Unbekannt");
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    if (tx.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.accountStore.getAccountById(tx.transferToAccountId || "")
            ?.name || "Unbekanntes Konto");
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.recipientStore.getRecipientById(tx.recipientId || "")?.name ||
            "-");
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    (__VLS_ctx.categoryStore.getCategoryById(tx.categoryId || "")?.name || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "px-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-1" },
    });
    for (const [tagId] of __VLS_getVForSourceType((tx.tagIds))) {
        /** @type {[typeof BadgeSoft, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(BadgeSoft, new BadgeSoft({
            key: (tagId),
            label: (__VLS_ctx.tagStore.getTagById(tagId)?.name || 'Unbekanntes Tag'),
            colorIntensity: (__VLS_ctx.tagStore.getTagById(tagId)?.color || 'secondary'),
            size: "sm",
        }));
        const __VLS_42 = __VLS_41({
            key: (tagId),
            label: (__VLS_ctx.tagStore.getTagById(tagId)?.name || 'Unbekanntes Tag'),
            colorIntensity: (__VLS_ctx.tagStore.getTagById(tagId)?.color || 'secondary'),
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right px-2" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_44 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (tx.amount),
        showZero: (true),
        ...{ class: ({
                'text-warning': tx.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER,
            }) },
    }));
    const __VLS_45 = __VLS_44({
        amount: (tx.amount),
        showZero: (true),
        ...{ class: ({
                'text-warning': tx.type === __VLS_ctx.TransactionType.ACCOUNTTRANSFER,
            }) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_44));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center px-1" },
    });
    if (tx.note && tx.note.trim()) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-left" },
            'data-tip': (tx.note),
        });
        const __VLS_47 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent(__VLS_47, new __VLS_47({
            icon: "mdi:comment-text-outline",
            ...{ class: "text-base opacity-60 cursor-help" },
        }));
        const __VLS_49 = __VLS_48({
            icon: "mdi:comment-text-outline",
            ...{ class: "text-base opacity-60 cursor-help" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right px-2" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (tx.runningBalance || 0),
        showZero: (true),
        asInteger: (false),
        ...{ class: "text-sm" },
    }));
    const __VLS_52 = __VLS_51({
        amount: (tx.runningBalance || 0),
        showZero: (true),
        asInteger: (false),
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
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
                __VLS_ctx.emit('edit', tx);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none px-1" },
        title: "Bearbeiten",
    });
    const __VLS_54 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent(__VLS_54, new __VLS_54({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_56 = __VLS_55({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.confirmDelete(tx);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-error/75 px-1" },
        title: "Löschen",
    });
    const __VLS_58 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_59 = __VLS_asFunctionalComponent(__VLS_58, new __VLS_58({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_60 = __VLS_59({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_59));
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
else if (__VLS_ctx.allSortedDisplayTransactions.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-center py-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm opacity-50" },
    });
    (__VLS_ctx.allSortedDisplayTransactions.length);
}
if (__VLS_ctx.showDeleteConfirmation && __VLS_ctx.transactionToDelete) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Transaktion löschen",
        message: (`Möchten Sie diese Transaktion wirklich löschen?\n\n${__VLS_ctx.getTransactionDescription(__VLS_ctx.transactionToDelete)}`),
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_63 = __VLS_62({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Transaktion löschen",
        message: (`Möchten Sie diese Transaktion wirklich löschen?\n\n${__VLS_ctx.getTransactionDescription(__VLS_ctx.transactionToDelete)}`),
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    let __VLS_65;
    let __VLS_66;
    let __VLS_67;
    const __VLS_68 = {
        onConfirm: (__VLS_ctx.handleDeleteConfirm)
    };
    const __VLS_69 = {
        onCancel: (__VLS_ctx.handleDeleteCancel)
    };
    var __VLS_64;
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
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
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
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
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
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
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
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-help']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
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
            BadgeSoft: BadgeSoft,
            ConfirmationModal: ConfirmationModal,
            emit: emit,
            accountStore: accountStore,
            categoryStore: categoryStore,
            tagStore: tagStore,
            recipientStore: recipientStore,
            loadingMoreItems: loadingMoreItems,
            sentinelRef: sentinelRef,
            containerRef: containerRef,
            summaryRef: summaryRef,
            containerHeight: containerHeight,
            showDeleteConfirmation: showDeleteConfirmation,
            transactionToDelete: transactionToDelete,
            allSortedDisplayTransactions: allSortedDisplayTransactions,
            sortedDisplayTransactions: sortedDisplayTransactions,
            hasMoreItems: hasMoreItems,
            selectedIds: selectedIds,
            allSelected: allSelected,
            handleHeaderCheckboxChange: handleHeaderCheckboxChange,
            handleCheckboxClick: handleCheckboxClick,
            selectedTotalAmount: selectedTotalAmount,
            selectedReconciledAmount: selectedReconciledAmount,
            selectedUnreconciledAmount: selectedUnreconciledAmount,
            hasSelectedTransactions: hasSelectedTransactions,
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
