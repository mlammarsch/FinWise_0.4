// src/stores/transactionFilterStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TransactionType } from '@/types'
import { useTransactionStore } from './transactionStore'
import { useAccountStore } from './accountStore'
import { useCategoryStore } from './categoryStore'
import { useTagStore } from './tagStore'
import { useRecipientStore } from './recipientStore'
import { debugLog } from '@/utils/logger'

export const useTransactionFilterStore = defineStore('transactionFilter', () => {
  // Store-Referenzen
  const transactionStore = useTransactionStore();
  const accountStore = useAccountStore();
  const categoryStore = useCategoryStore();
  const tagStore = useTagStore();
  const recipientStore = useRecipientStore();

  // Filter-Zustand
  const searchQuery = ref("");
  const selectedAccountId = ref("");
  const selectedTransactionType = ref("");
  const selectedReconciledFilter = ref("");
  const selectedTagId = ref("");
  const selectedCategoryId = ref("");
  const dateRange = ref({
    start: new Date().toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const currentViewMode = ref<"account" | "category">("account");

  // Sortierung
  const sortKey = ref<string>("date");
  const sortOrder = ref<"asc" | "desc">("desc");

  // Methode zum Speichern der Filter-Einstellungen
  function saveFilters() {
    localStorage.setItem("transactionsView_selectedTagId", selectedTagId.value);
    localStorage.setItem("transactionsView_selectedCategoryId", selectedCategoryId.value);
    localStorage.setItem("transactionsView_viewMode", currentViewMode.value);
    debugLog("[transactionFilterStore] saveFilters", {
      tagId: selectedTagId.value,
      categoryId: selectedCategoryId.value,
      viewMode: currentViewMode.value
    });
  }

  // Methode zum Laden der Filter-Einstellungen
  function loadFilters() {
    const savedTag = localStorage.getItem("transactionsView_selectedTagId");
    if (savedTag !== null) selectedTagId.value = savedTag;

    const savedCat = localStorage.getItem("transactionsView_selectedCategoryId");
    if (savedCat !== null) selectedCategoryId.value = savedCat;

    const savedView = localStorage.getItem("transactionsView_viewMode");
    if (savedView === "account" || savedView === "category") {
      currentViewMode.value = savedView;
    }

    debugLog("[transactionFilterStore] loadFilters", {
      loadedTagId: selectedTagId.value,
      loadedCategoryId: selectedCategoryId.value,
      loadedViewMode: currentViewMode.value
    });
  }

  // Methode zum Zurücksetzen der Filter
  function clearFilters() {
    if (currentViewMode.value === "account") {
      selectedAccountId.value = "";
      selectedTransactionType.value = "";
      selectedReconciledFilter.value = "";
      selectedTagId.value = "";
    }
    selectedCategoryId.value = "";
    searchQuery.value = "";
    debugLog("[transactionFilterStore] clearFilters");
  }

  // Filtere nach Kontotransaktionen
  const filteredTransactions = computed(() => {
    let txs = transactionStore.transactions;

    // Filtern nach Transaktionstyp
    if (selectedTransactionType.value) {
      const typeMap: Record<string, TransactionType> = {
        ausgabe: TransactionType.EXPENSE,
        einnahme: TransactionType.INCOME,
        transfer: TransactionType.ACCOUNTTRANSFER,
      };
      const desired = typeMap[selectedTransactionType.value];
      if (desired) txs = txs.filter((tx) => tx.type === desired);
    }

    // Filtern nach Konto
    if (selectedAccountId.value) {
      txs = txs.filter((tx) => tx.accountId === selectedAccountId.value);
    }

    // Filtern nach Abgleich-Status
    if (selectedReconciledFilter.value) {
      txs = txs.filter((tx) =>
        selectedReconciledFilter.value === "abgeglichen"
          ? tx.reconciled
          : !tx.reconciled
      );
    }

    // Filtern nach Tag
    if (selectedTagId.value) {
      txs = txs.filter((tx) =>
        Array.isArray(tx.tagIds) && tx.tagIds.includes(selectedTagId.value)
      );
    }

    // Filtern nach Kategorie
    if (selectedCategoryId.value) {
      txs = txs.filter((tx) => tx.categoryId === selectedCategoryId.value);
    }

    // Filtern nach Datumszeitraum
    const start = dateRange.value.start;
    const end = dateRange.value.end;
    txs = txs.filter((tx) => {
      const txDate = tx.date.split("T")[0];
      return txDate >= start && txDate <= end;
    });

    // Filtern nach Suchbegriff
    if (!searchQuery.value.trim()) return txs;

    const lower = searchQuery.value.toLowerCase();
    const numeric = lower.replace(",", ".");

    return txs.filter((tx) => {
      const categoryName = tx.categoryId
        ? categoryStore.getCategoryById(tx.categoryId)?.name?.toLowerCase() || ""
        : "";
      const recipientName = tx.recipientId
        ? recipientStore.getRecipientById(tx.recipientId)?.name?.toLowerCase() || ""
        : "";
      const tags = Array.isArray(tx.tagIds)
        ? tx.tagIds
            .map((id) => tagStore.getTagById(id)?.name?.toLowerCase() || "")
            .join(" ")
        : "";
      const accountName = accountStore.getAccountById(tx.accountId)?.name.toLowerCase() || "";
      const toAccountName = tx.type === TransactionType.ACCOUNTTRANSFER
        ? accountStore.getAccountById(tx.transferToAccountId)?.name?.toLowerCase() || ""
        : "";
      const payee = tx.payee?.toLowerCase() || "";
      const formattedAmount = String(tx.amount).replace(/\./g, "").replace(/,/g, ".");
      const note = tx.note?.toLowerCase() || "";

      return [
        categoryName,
        recipientName,
        tags,
        accountName,
        toAccountName,
        payee,
        formattedAmount,
        note,
      ].some((field) => field.includes(lower) || field.includes(numeric));
    });
  });

  // Filtere nach Kategorietransaktionen
  const filteredCategoryTransactions = computed(() => {
    let txs = transactionStore.transactions;

    // Filtern nach Kategorie
    if (selectedCategoryId.value) {
      txs = txs.filter((tx) => tx.categoryId === selectedCategoryId.value);
    }

    // Filtern nach Datumszeitraum (verwendet valueDate)
    const start = dateRange.value.start;
    const end = dateRange.value.end;
    txs = txs.filter((tx) => {
      const txDate = tx.valueDate.split("T")[0];
      return txDate >= start && txDate <= end;
    });

    // Filtern nach Suchbegriff
    if (!searchQuery.value.trim()) return txs;

    const lower = searchQuery.value.toLowerCase();
    const numeric = lower.replace(",", ".");

    return txs.filter((tx) => {
      const categoryName = tx.categoryId
        ? categoryStore.getCategoryById(tx.categoryId)?.name?.toLowerCase() || ""
        : "";
      const toCategoryName = tx.toCategoryId
        ? categoryStore.getCategoryById(tx.toCategoryId)?.name?.toLowerCase() || ""
        : "";
      const accountName = accountStore.getAccountById(tx.accountId)?.name.toLowerCase() || "";
      const date = tx.date;
      const valueDate = tx.valueDate;
      const formattedAmount = String(tx.amount).replace(/\./g, "").replace(/,/g, ".");
      const note = tx.note?.toLowerCase() || "";

      return [
        categoryName,
        toCategoryName,
        accountName,
        date,
        valueDate,
        formattedAmount,
        note,
      ].some((field) => field.includes(lower) || field.includes(numeric));
    });
  });

  // Sortierung anwenden
  const sortedTransactions = computed(() => {
    const list = [...filteredTransactions.value];
    if (!sortKey.value) return list;

    return list.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortKey.value) {
        case "accountId":
          aVal = accountStore.getAccountById(a.accountId)?.name || "";
          bVal = accountStore.getAccountById(b.accountId)?.name || "";
          break;
        case "recipientId":
          aVal = a.type === TransactionType.ACCOUNTTRANSFER
            ? accountStore.getAccountById(a.transferToAccountId)?.name || ""
            : recipientStore.getRecipientById(a.recipientId)?.name || "";
          bVal = b.type === TransactionType.ACCOUNTTRANSFER
            ? accountStore.getAccountById(b.transferToAccountId)?.name || ""
            : recipientStore.getRecipientById(b.recipientId)?.name || "";
          break;
        case "categoryId":
          aVal = categoryStore.getCategoryById(a.categoryId)?.name || "";
          bVal = categoryStore.getCategoryById(b.categoryId)?.name || "";
          break;
        case "reconciled":
          aVal = a.reconciled ? 1 : 0;
          bVal = b.reconciled ? 1 : 0;
          break;
        case "amount":
          aVal = a.amount;
          bVal = b.amount;
          break;
        case "date":
          aVal = a.date;
          bVal = b.date;
          break;
        case "valueDate":
          aVal = a.valueDate || a.date;
          bVal = b.valueDate || b.date;
          break;
        default:
          aVal = a[sortKey.value as keyof typeof a];
          bVal = b[sortKey.value as keyof typeof b];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder.value === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder.value === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  });

  const sortedCategoryTransactions = computed(() => {
    const list = [...filteredCategoryTransactions.value];
    if (!sortKey.value) {
      // Standard: nach valueDate sortieren, wenn kein sortKey
      return list.sort((a, b) =>
        sortOrder.value === "asc"
          ? (a.valueDate || a.date).localeCompare(b.valueDate || b.date)
          : (b.valueDate || b.date).localeCompare(a.valueDate || a.date)
      );
    }

    return list.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortKey.value) {
        case "categoryId":
          aVal = categoryStore.getCategoryById(a.categoryId)?.name || "";
          bVal = categoryStore.getCategoryById(b.categoryId)?.name || "";
          break;
        case "accountId":
          if (a.type === TransactionType.CATEGORYTRANSFER &&
              b.type === TransactionType.CATEGORYTRANSFER) {
            aVal = categoryStore.getCategoryById(a.toCategoryId)?.name || "";
            bVal = categoryStore.getCategoryById(b.toCategoryId)?.name || "";
          } else {
            aVal = accountStore.getAccountById(a.accountId)?.name || "";
            bVal = accountStore.getAccountById(b.accountId)?.name || "";
          }
          break;
        case "amount":
          aVal = a.amount;
          bVal = b.amount;
          break;
        case "date":
          aVal = a.date;
          bVal = b.date;
          break;
        case "valueDate":
          aVal = a.valueDate || a.date;
          bVal = b.valueDate || b.date;
          break;
        default:
          aVal = a[sortKey.value as keyof typeof a];
          bVal = b[sortKey.value as keyof typeof b];
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder.value === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder.value === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  });

  function updateDateRange(start: string, end: string) {
    dateRange.value = { start, end };
    debugLog("[transactionFilterStore] updateDateRange", { start, end });
  }

  function setSortKey(key: string) {
    if (sortKey.value === key) {
      sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
    } else {
      sortKey.value = key;
      sortOrder.value = "asc";
    }
    debugLog("[transactionFilterStore] setSortKey", { key, order: sortOrder.value });
  }

  return {
    // State
    searchQuery,
    selectedAccountId,
    selectedTransactionType,
    selectedReconciledFilter,
    selectedTagId,
    selectedCategoryId,
    dateRange,
    currentViewMode,
    sortKey,
    sortOrder,

    // Computed
    filteredTransactions,
    filteredCategoryTransactions,
    sortedTransactions,
    sortedCategoryTransactions,

    // Actions
    saveFilters,
    loadFilters,
    clearFilters,
    updateDateRange,
    setSortKey
  }
});
