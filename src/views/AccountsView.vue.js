import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useAccountStore } from "../stores/accountStore";
import { useTagStore } from "../stores/tagStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useRecipientStore } from "../stores/recipientStore";
import { useTransactionStore } from "../stores/transactionStore";
import { useTransactionFilterStore } from "../stores/transactionFilterStore";
import { useReconciliationStore } from "../stores/reconciliationStore";
import { useSearchStore } from "../stores/searchStore";
import AccountGroupCard from "../components/account/AccountGroupCard.vue";
import AccountForm from "../components/account/AccountForm.vue";
import AccountGroupForm from "../components/account/AccountGroupForm.vue";
import AccountReconcileModal from "../components/account/AccountReconcileModal.vue";
import CurrencyDisplay from "../components/ui/CurrencyDisplay.vue";
import TransactionCard from "../components/transaction/TransactionCard.vue";
import TransactionForm from "../components/transaction/TransactionForm.vue";
import SearchGroup from "../components/ui/SearchGroup.vue";
import { formatDate } from "../utils/formatters";
import { TransactionType } from "../types";
import { TransactionService } from "../services/TransactionService";
import { AccountService } from "../services/AccountService";
import { BalanceService } from "../services/BalanceService";
import { Icon } from "@iconify/vue";
import { debugLog } from "../utils/logger";
import DateRangePicker from "../components/ui/DateRangePicker.vue";
import Muuri from "muuri";
// Stores
const accountStore = useAccountStore();
const router = useRouter();
const tagStore = useTagStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const transactionStore = useTransactionStore();
const transactionFilterStore = useTransactionFilterStore();
const reconciliationStore = useReconciliationStore();
const searchStore = useSearchStore();
// State
const showNewAccountModal = ref(false);
const showNewGroupModal = ref(false);
const showTransactionFormModal = ref(false);
const showReconcileModal = ref(false);
const selectedAccount = ref(null);
const selectedTransaction = ref(null);
// Grid reference for Muuri
const grid = ref(null);
let muuri = null;
// DateRangePicker reference for navigation
const dateRangePickerRef = ref(null);
//Computed
const accountGroups = computed(() => [...accountStore.accountGroups].sort((a, b) => a.sortOrder - b.sortOrder));
const totalBalance = computed(() => AccountService.getTotalBalance());
// Suchbegriff über den SearchStore
const searchQuery = computed({
    get: () => searchStore.globalSearchQuery,
    set: (value) => searchStore.search(value),
});
// DateRange
const dateRange = ref({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
        .toISOString()
        .split("T")[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
        .toISOString()
        .split("T")[0],
});
// Lifecycle Hooks
onMounted(() => {
    const savedTag = localStorage.getItem("accountsView_selectedTagId");
    if (savedTag !== null)
        transactionFilterStore.selectedTagId = savedTag;
    const savedCat = localStorage.getItem("accountsView_selectedCategoryId");
    if (savedCat !== null)
        transactionFilterStore.selectedCategoryId = savedCat;
    if (!selectedAccount.value && accountStore.activeAccounts.length > 0) {
        selectedAccount.value = accountStore.activeAccounts[0];
        debugLog("[AccountView] onMounted: Selected account set", selectedAccount.value);
    }
    // Initialize Muuri
    if (grid.value) {
        muuri = new Muuri(grid.value, {
            items: ".account-group-card", // Dies ist die Klasse, die auf der AccountGroupCard-Komponente erwartet wird
            dragEnabled: true,
            dragHandle: ".drag-handle",
            sortData: {
                order: (item, element) => {
                    const groupId = element.getAttribute("data-id");
                    const group = accountStore.accountGroups.find((g) => g.id === groupId);
                    return group ? group.sortOrder : 0;
                },
            },
        });
        muuri.on("dragEnd", async (item, event) => {
            debugLog("[AccountsView] Drag ended", "Drag operation completed");
            if (muuri) {
                const newOrder = muuri
                    .getItems()
                    .map((item) => item.getElement()?.getAttribute("data-id"))
                    .filter((id) => id !== null);
                console.log("[AccountsView] Neue Reihenfolge der Kontogruppen-IDs:", newOrder);
                await handleSortOrderChange(newOrder);
                // Wichtig: Muuri neu synchronisieren und layouten
                muuri.synchronize();
                muuri.layout(true);
            }
        });
        // Sortiere die Elemente initial basierend auf der sortOrder
        if (accountGroups.value.length) {
            muuri.sort("order", { layout: "instant" });
        }
    }
});
// Watchers
watch(() => transactionFilterStore.selectedTagId, (newVal) => {
    localStorage.setItem("accountsView_selectedTagId", newVal);
});
watch(() => transactionFilterStore.selectedCategoryId, (newVal) => {
    localStorage.setItem("accountsView_selectedCategoryId", newVal);
});
watch(() => accountGroups.value, async (newGroups, oldGroups) => {
    const gridInstance = muuri;
    if (!gridInstance)
        return;
    if (newGroups.length > oldGroups.length) {
        await nextTick();
        const newElements = Array.from(grid.value?.children || []).filter((child) => !gridInstance.getItems().some((item) => item.getElement() === child));
        if (newElements.length) {
            gridInstance.add(newElements);
            gridInstance.layout(true);
        }
    }
}, { deep: true });
watch(() => accountStore.accounts.length, async () => {
    if (muuri) {
        await nextTick();
        muuri.refreshItems();
        muuri.layout();
    }
});
//Hilfsfunktion für Datum
function normalizeDateString(date) {
    try {
        return new Date(date).toISOString().split("T")[0];
    }
    catch {
        return "";
    }
}
// Filterung der Transaktionen: Zeige ACCOUNTTRANSFER, EXPENSE und INCOME
const filteredTransactions = computed(() => {
    if (!selectedAccount.value)
        return [];
    const accountId = selectedAccount.value.id;
    const start = dateRange.value.start;
    const end = dateRange.value.end;
    let txs = transactionStore.transactions.filter((tx) => {
        // Nur Transaktionen, bei denen das eigene Konto führend ist
        if (tx.accountId !== accountId)
            return false;
        const txDate = normalizeDateString(tx.date);
        return txDate >= start && txDate <= end;
    });
    if (transactionFilterStore.selectedTransactionType) {
        const typeMap = {
            ausgabe: "EXPENSE",
            einnahme: "INCOME",
            transfer: "ACCOUNTTRANSFER",
        };
        const desired = typeMap[transactionFilterStore.selectedTransactionType];
        if (desired) {
            txs = txs.filter((tx) => tx.type === desired);
        }
    }
    if (transactionFilterStore.selectedReconciledFilter) {
        txs = txs.filter((tx) => transactionFilterStore.selectedReconciledFilter === "abgeglichen"
            ? tx.reconciled
            : !tx.reconciled);
    }
    if (transactionFilterStore.selectedTagId) {
        txs = txs.filter((tx) => Array.isArray(tx.tagIds) &&
            tx.tagIds.includes(transactionFilterStore.selectedTagId));
    }
    if (transactionFilterStore.selectedCategoryId) {
        txs = txs.filter((tx) => tx.categoryId === transactionFilterStore.selectedCategoryId);
    }
    if (searchQuery.value.trim()) {
        const lower = searchQuery.value.toLowerCase();
        const numeric = lower.replace(",", ".");
        txs = txs.filter((tx) => {
            const recipientName = (tx.payee || "").toLowerCase();
            const categoryName = tx.categoryId
                ? (categoryStore.getCategoryById(tx.categoryId)?.name || "").toLowerCase()
                : "";
            const tags = Array.isArray(tx.tagIds)
                ? tx.tagIds
                    .map((id) => (tagStore.getTagById(id)?.name || "").toLowerCase())
                    .join(" ")
                : "";
            const formattedAmount = ("" + tx.amount)
                .replace(/\./g, "")
                .replace(/,/g, ".");
            const note = tx.note ? tx.note.toLowerCase() : "";
            return [recipientName, categoryName, tags, formattedAmount, note].some((field) => field.includes(lower) || field.includes(numeric));
        });
    }
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    debugLog("[AccountView]", "filteredTransactions count", {
        count: txs.length,
    });
    return txs;
});
const groupedTransactions = computed(() => {
    if (!selectedAccount.value)
        return [];
    const allTxs = transactionStore.getTransactionsByAccount(selectedAccount.value.id);
    // Verwende den BalanceService statt der Utils-Funktion
    const fullGrouped = BalanceService.getTransactionsGroupedByDate(allTxs, selectedAccount.value);
    const groups = fullGrouped
        .map((group) => {
        const filtered = group.transactions.filter((tx) => filteredTransactions.value.some((f) => f.id === tx.id));
        return {
            date: group.date,
            runningBalance: group.runningBalance,
            transactions: filtered,
        };
    })
        .filter((group) => group.transactions.length > 0);
    debugLog("[AccountView]", "groupedTransactions groups", {
        count: groups.length,
    });
    return groups;
});
const clearFilters = () => {
    transactionFilterStore.clearFilters();
    searchStore.clearSearch();
};
// Methods
const createAccount = () => {
    selectedAccount.value = null;
    showNewAccountModal.value = true;
};
const createAccountGroup = () => {
    selectedAccount.value = null;
    showNewGroupModal.value = true;
};
const onAccountSaved = async (accountData) => {
    const isUpdate = selectedAccount.value?.id;
    if (isUpdate) {
        debugLog("[AccountView] onAccountSaved: Updating account with data", accountData);
        // Bei Update an Service delegieren. selectedAccount bleibt gesetzt.
        await AccountService.updateAccount(selectedAccount.value.id, accountData);
    }
    else {
        debugLog("[AccountView] onAccountSaved: Adding new account with data", accountData);
        // Bei neuem Konto an Service delegieren.
        await AccountService.addAccount(accountData);
        // selectedAccount wird von createAccount auf null gesetzt, hier nicht ändern
    }
    showNewAccountModal.value = false;
    debugLog("[AccountView]", "onAccountSaved executed");
};
const onGroupSaved = async (groupData) => {
    const group = accountStore.accountGroups.find((g) => g.name === groupData.name);
    if (group) {
        await AccountService.updateAccountGroup(group.id, groupData);
    }
    else {
        await AccountService.addAccountGroup(groupData);
    }
    showNewGroupModal.value = false;
    debugLog("[AccountView]", "onGroupSaved executed");
};
const onSelectAccount = (account) => {
    selectedAccount.value = account;
    debugLog("[AccountView] Selected account changed", account);
};
const handleDateRangeUpdate = (payload) => {
    dateRange.value = payload;
    debugLog("[AccountView]", "Date range updated", payload); // Correct debugLog call
};
// Navigation methods for chevron buttons
function navigateMonth(direction) {
    if (dateRangePickerRef.value) {
        dateRangePickerRef.value.navigateRangeByMonth(direction);
    }
}
const createTransaction = () => {
    selectedTransaction.value = null;
    showTransactionFormModal.value = true;
};
const editTransaction = (transaction) => {
    debugLog("[AccountView] TransactionCard clicked", transaction);
    selectedTransaction.value = transaction;
    showTransactionFormModal.value = true;
};
// Diese Funktion wurde geändert, um den TransactionService zu verwenden
const handleTransactionSave = (payload) => {
    if (payload.type === TransactionType.ACCOUNTTRANSFER) {
        // Verwende TransactionService für Account Transfers
        TransactionService.addAccountTransfer(payload.fromAccountId, payload.toAccountId, payload.amount, payload.date, payload.note);
        debugLog("[AccountView] Added ACCOUNTTRANSFER via service", payload);
    }
    else {
        // Für reguläre Transaktionen auch TransactionService verwenden
        const tx = {
            ...payload,
            payee: recipientStore.getRecipientById(payload.recipientId)?.name || "",
        };
        if (selectedTransaction.value) {
            TransactionService.updateTransaction(selectedTransaction.value.id, tx);
            debugLog("[AccountView] Updated transaction via service", tx);
        }
        else {
            TransactionService.addTransaction(tx);
            debugLog("[AccountView] Added transaction via service", tx);
        }
    }
    showTransactionFormModal.value = false;
    selectedTransaction.value = null;
};
// Kontoabgleich starten
const startReconcile = (account) => {
    selectedAccount.value = account;
    showReconcileModal.value = true;
};
// Kontoabgleich abgeschlossen
const onReconcileComplete = () => {
    // Aktualisieren der Transaktionsliste nach Abgleich
    showReconcileModal.value = false;
};
// Task 1.4: Methode angepasst, um AccountService zu verwenden
const handleSortOrderChange = async (sortedIds) => {
    // Mappe über das sortedIds-Array, um ein neues Array von Objekten zu erstellen
    const reindexedGroups = sortedIds.map((id, index) => ({
        id: id,
        sortOrder: index,
    }));
    // Verwende AccountService statt direkten Store-Aufruf
    await AccountService.updateAccountGroupOrder(reindexedGroups);
};
// Layout-Refresh für AccountGroupCards
const refreshGroupsLayout = () => {
    if (muuri) {
        muuri.refreshItems().layout();
    }
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-1/2 p-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rounded-md bg-base-200/50 backdrop-blur-lg p-2 mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-between items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "join" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.createAccountGroup) },
    ...{ class: "btn join-item rounded-l-full btn-sm btn-soft border border-base-300" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:folder-plus",
    ...{ class: "mr-2" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:folder-plus",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.createAccount) },
    ...{ class: "btn join-item rounded-r-full btn-sm btn-soft border border-base-300" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:plus",
    ...{ class: "mr-2" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:plus",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-2 text-base text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "opacity-50" },
});
/** @type {[typeof CurrencyDisplay, ]} */ ;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
    ...{ class: "text-base" },
    amount: (__VLS_ctx.totalBalance),
    showZero: (true),
    asInteger: (true),
}));
const __VLS_9 = __VLS_8({
    ...{ class: "text-base" },
    amount: (__VLS_ctx.totalBalance),
    showZero: (true),
    asInteger: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
const __VLS_11 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
    icon: "mdi:scale-balance",
    ...{ class: "text-secondary ml-0 mr-5 opacity-50" },
}));
const __VLS_13 = __VLS_12({
    icon: "mdi:scale-balance",
    ...{ class: "text-secondary ml-0 mr-5 opacity-50" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "grid",
    ...{ class: "relative" },
});
/** @type {typeof __VLS_ctx.grid} */ ;
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.accountGroups))) {
    /** @type {[typeof AccountGroupCard, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(AccountGroupCard, new AccountGroupCard({
        ...{ 'onSelectAccount': {} },
        ...{ 'onReconcileAccount': {} },
        ...{ 'onRequestLayoutUpdate': {} },
        key: (group.id),
        group: (group),
        activeAccountId: (__VLS_ctx.selectedAccount ? __VLS_ctx.selectedAccount.id : ''),
        ...{ class: "account-group-card" },
        dataId: (group.id),
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onSelectAccount': {} },
        ...{ 'onReconcileAccount': {} },
        ...{ 'onRequestLayoutUpdate': {} },
        key: (group.id),
        group: (group),
        activeAccountId: (__VLS_ctx.selectedAccount ? __VLS_ctx.selectedAccount.id : ''),
        ...{ class: "account-group-card" },
        dataId: (group.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_18;
    let __VLS_19;
    let __VLS_20;
    const __VLS_21 = {
        onSelectAccount: (__VLS_ctx.onSelectAccount)
    };
    const __VLS_22 = {
        onReconcileAccount: (__VLS_ctx.startReconcile)
    };
    const __VLS_23 = {
        onRequestLayoutUpdate: (__VLS_ctx.refreshGroupsLayout)
    };
    var __VLS_17;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-1/2 p-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "rounded-md bg-base-200/50 backdrop-blur-lg mb-6 flex justify-between p-2 items-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center gap-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigateMonth('prev');
        } },
    ...{ class: "btn btn-ghost btn-sm btn-circle" },
    title: "Vorheriger Monat",
});
const __VLS_24 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    icon: "mdi:chevron-left",
    ...{ class: "text-lg" },
}));
const __VLS_26 = __VLS_25({
    icon: "mdi:chevron-left",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
/** @type {[typeof DateRangePicker, ]} */ ;
// @ts-ignore
const __VLS_28 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
    ...{ 'onUpdate:modelValue': {} },
    ref: "dateRangePickerRef",
    ...{ class: "mx-2" },
}));
const __VLS_29 = __VLS_28({
    ...{ 'onUpdate:modelValue': {} },
    ref: "dateRangePickerRef",
    ...{ class: "mx-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_28));
let __VLS_31;
let __VLS_32;
let __VLS_33;
const __VLS_34 = {
    'onUpdate:modelValue': ((range) => __VLS_ctx.handleDateRangeUpdate(range))
};
/** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
var __VLS_35 = {};
var __VLS_30;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.navigateMonth('next');
        } },
    ...{ class: "btn btn-ghost btn-sm btn-circle" },
    title: "Nächster Monat",
});
const __VLS_37 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_38 = __VLS_asFunctionalComponent(__VLS_37, new __VLS_37({
    icon: "mdi:chevron-right",
    ...{ class: "text-lg" },
}));
const __VLS_39 = __VLS_38({
    icon: "mdi:chevron-right",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_38));
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnRightClick': {} },
    btnRight: "Neue Transaktion",
    btnRightIcon: "mdi:plus",
}));
const __VLS_42 = __VLS_41({
    ...{ 'onSearch': {} },
    ...{ 'onBtnRightClick': {} },
    btnRight: "Neue Transaktion",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_44;
let __VLS_45;
let __VLS_46;
const __VLS_47 = {
    onSearch: ((query) => (__VLS_ctx.searchQuery = query))
};
const __VLS_48 = {
    onBtnRightClick: (__VLS_ctx.createTransaction)
};
var __VLS_43;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
for (const [group, index] of __VLS_getVForSourceType((__VLS_ctx.groupedTransactions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (index),
        ...{ class: "mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-start items-center" },
    });
    const __VLS_49 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
        icon: "mdi:calendar-import",
        ...{ class: "mx-2 text-sm opacity-50" },
    }));
    const __VLS_51 = __VLS_50({
        icon: "mdi:calendar-import",
        ...{ class: "mx-2 text-sm opacity-50" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs font-normal" },
    });
    (__VLS_ctx.formatDate(group.date));
    const __VLS_53 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
        icon: "mdi:square-medium",
        ...{ class: "text-base opacity-40" },
    }));
    const __VLS_55 = __VLS_54({
        icon: "mdi:square-medium",
        ...{ class: "text-base opacity-40" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_54));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end items-center" },
    });
    const __VLS_57 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
        icon: "mdi:scale-balance",
        ...{ class: "mr-2 opacity-50 text-sm" },
    }));
    const __VLS_59 = __VLS_58({
        icon: "mdi:scale-balance",
        ...{ class: "mr-2 opacity-50 text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        ...{ class: "text-xs" },
        amount: (group.runningBalance),
        showZero: (true),
        asInteger: (true),
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "text-xs" },
        amount: (group.runningBalance),
        showZero: (true),
        asInteger: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-1 gap-1" },
    });
    for (const [transaction] of __VLS_getVForSourceType((group.transactions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    __VLS_ctx.editTransaction(transaction);
                } },
            key: (transaction.id),
            ...{ class: "cursor-pointer" },
        });
        /** @type {[typeof TransactionCard, ]} */ ;
        // @ts-ignore
        const __VLS_64 = __VLS_asFunctionalComponent(TransactionCard, new TransactionCard({
            transaction: (transaction),
            clickable: true,
        }));
        const __VLS_65 = __VLS_64({
            transaction: (transaction),
            clickable: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    }
}
const __VLS_67 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_68 = __VLS_asFunctionalComponent(__VLS_67, new __VLS_67({
    to: "body",
}));
const __VLS_69 = __VLS_68({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_68));
__VLS_70.slots.default;
if (__VLS_ctx.showNewAccountModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof AccountForm, ]} */ ;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent(AccountForm, new AccountForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }));
    const __VLS_72 = __VLS_71({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    let __VLS_74;
    let __VLS_75;
    let __VLS_76;
    const __VLS_77 = {
        onSave: (__VLS_ctx.onAccountSaved)
    };
    const __VLS_78 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showNewAccountModal))
                return;
            __VLS_ctx.showNewAccountModal = false;
        }
    };
    var __VLS_73;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showNewAccountModal))
                    return;
                __VLS_ctx.showNewAccountModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
var __VLS_70;
const __VLS_79 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_80 = __VLS_asFunctionalComponent(__VLS_79, new __VLS_79({
    to: "body",
}));
const __VLS_81 = __VLS_80({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_80));
__VLS_82.slots.default;
if (__VLS_ctx.showNewGroupModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof AccountGroupForm, ]} */ ;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(AccountGroupForm, new AccountGroupForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }));
    const __VLS_84 = __VLS_83({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    let __VLS_86;
    let __VLS_87;
    let __VLS_88;
    const __VLS_89 = {
        onSave: (__VLS_ctx.onGroupSaved)
    };
    const __VLS_90 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showNewGroupModal))
                return;
            __VLS_ctx.showNewGroupModal = false;
        }
    };
    var __VLS_85;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showNewGroupModal))
                    return;
                __VLS_ctx.showNewGroupModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
var __VLS_82;
const __VLS_91 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_92 = __VLS_asFunctionalComponent(__VLS_91, new __VLS_91({
    to: "body",
}));
const __VLS_93 = __VLS_92({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_92));
__VLS_94.slots.default;
if (__VLS_ctx.showTransactionFormModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box overflow-visible max-w-2xl" },
    });
    /** @type {[typeof TransactionForm, ]} */ ;
    // @ts-ignore
    const __VLS_95 = __VLS_asFunctionalComponent(TransactionForm, new TransactionForm({
        ...{ 'onCancel': {} },
        ...{ 'onSave': {} },
        transaction: (__VLS_ctx.selectedTransaction),
        defaultAccountId: (__VLS_ctx.selectedAccount?.id),
    }));
    const __VLS_96 = __VLS_95({
        ...{ 'onCancel': {} },
        ...{ 'onSave': {} },
        transaction: (__VLS_ctx.selectedTransaction),
        defaultAccountId: (__VLS_ctx.selectedAccount?.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_95));
    let __VLS_98;
    let __VLS_99;
    let __VLS_100;
    const __VLS_101 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showTransactionFormModal))
                return;
            __VLS_ctx.showTransactionFormModal = false;
        }
    };
    const __VLS_102 = {
        onSave: (__VLS_ctx.handleTransactionSave)
    };
    var __VLS_97;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showTransactionFormModal))
                    return;
                __VLS_ctx.showTransactionFormModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
var __VLS_94;
const __VLS_103 = {}.Teleport;
/** @type {[typeof __VLS_components.Teleport, typeof __VLS_components.Teleport, ]} */ ;
// @ts-ignore
const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
    to: "body",
}));
const __VLS_105 = __VLS_104({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_104));
__VLS_106.slots.default;
if (__VLS_ctx.showReconcileModal && __VLS_ctx.selectedAccount) {
    /** @type {[typeof AccountReconcileModal, ]} */ ;
    // @ts-ignore
    const __VLS_107 = __VLS_asFunctionalComponent(AccountReconcileModal, new AccountReconcileModal({
        ...{ 'onClose': {} },
        ...{ 'onReconcile': {} },
        account: (__VLS_ctx.selectedAccount),
        isOpen: (__VLS_ctx.showReconcileModal),
    }));
    const __VLS_108 = __VLS_107({
        ...{ 'onClose': {} },
        ...{ 'onReconcile': {} },
        account: (__VLS_ctx.selectedAccount),
        isOpen: (__VLS_ctx.showReconcileModal),
    }, ...__VLS_functionalComponentArgsRest(__VLS_107));
    let __VLS_110;
    let __VLS_111;
    let __VLS_112;
    const __VLS_113 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showReconcileModal && __VLS_ctx.selectedAccount))
                return;
            __VLS_ctx.showReconcileModal = false;
        }
    };
    const __VLS_114 = {
        onReconcile: (__VLS_ctx.onReconcileComplete)
    };
    var __VLS_109;
}
var __VLS_106;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['join']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-l-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-r-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-5']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['account-group-card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-visible']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
// @ts-ignore
var __VLS_36 = __VLS_35;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            AccountGroupCard: AccountGroupCard,
            AccountForm: AccountForm,
            AccountGroupForm: AccountGroupForm,
            AccountReconcileModal: AccountReconcileModal,
            CurrencyDisplay: CurrencyDisplay,
            TransactionCard: TransactionCard,
            TransactionForm: TransactionForm,
            SearchGroup: SearchGroup,
            formatDate: formatDate,
            Icon: Icon,
            DateRangePicker: DateRangePicker,
            showNewAccountModal: showNewAccountModal,
            showNewGroupModal: showNewGroupModal,
            showTransactionFormModal: showTransactionFormModal,
            showReconcileModal: showReconcileModal,
            selectedAccount: selectedAccount,
            selectedTransaction: selectedTransaction,
            grid: grid,
            dateRangePickerRef: dateRangePickerRef,
            accountGroups: accountGroups,
            totalBalance: totalBalance,
            searchQuery: searchQuery,
            groupedTransactions: groupedTransactions,
            createAccount: createAccount,
            createAccountGroup: createAccountGroup,
            onAccountSaved: onAccountSaved,
            onGroupSaved: onGroupSaved,
            onSelectAccount: onSelectAccount,
            handleDateRangeUpdate: handleDateRangeUpdate,
            navigateMonth: navigateMonth,
            createTransaction: createTransaction,
            editTransaction: editTransaction,
            handleTransactionSave: handleTransactionSave,
            startReconcile: startReconcile,
            onReconcileComplete: onReconcileComplete,
            refreshGroupsLayout: refreshGroupsLayout,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
