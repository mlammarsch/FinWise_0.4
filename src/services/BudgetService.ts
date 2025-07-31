// src/services/BudgetService.ts
import { useCategoryStore } from "@/stores/categoryStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { usePlanningStore } from "@/stores/planningStore";
import { PlanningService } from "./PlanningService";
import { Category, TransactionType } from "@/types";
import { toDateOnlyString } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { BalanceService } from "./BalanceService";

// Performance-Cache für BudgetService
const summaryCache = new Map<string, { data: any; timestamp: number }>();
const categoryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 Sekunden Cache-Zeit (länger für bessere Performance)
let lastCacheClean = 0;

function getCacheKey(monthStart: Date, monthEnd: Date, type: "expense" | "income"): string {
  return `${type}-${monthStart.toISOString().split('T')[0]}-${monthEnd.toISOString().split('T')[0]}`;
}

function getCategoryCacheKey(categoryId: string, monthStart: Date, monthEnd: Date): string {
  return `cat-${categoryId}-${monthStart.toISOString().split('T')[0]}-${monthEnd.toISOString().split('T')[0]}`;
}

function cleanExpiredCache() {
  const now = Date.now();
  if (now - lastCacheClean < 10000) return; // Nur alle 10 Sekunden cleanen

  lastCacheClean = now;
  for (const [key, value] of summaryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      summaryCache.delete(key);
    }
  }
  for (const [key, value] of categoryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      categoryCache.delete(key);
    }
  }
}

function invalidateCache() {
  summaryCache.clear();
  categoryCache.clear();
}

// Granulare Cache-Invalidierung für spezifische Kategorien und Monate
function invalidateCacheForTransaction(transaction: { categoryId?: string; date: string; toCategoryId?: string }) {
  if (!transaction.categoryId && !transaction.toCategoryId) return;

  const transactionDate = new Date(transaction.date);
  const monthStart = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
  const monthEnd = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0);

  // Invalidiere nur die betroffenen Kategorien und den spezifischen Monat
  const categoriesToInvalidate = [transaction.categoryId, transaction.toCategoryId].filter(Boolean);

  categoriesToInvalidate.forEach(categoryId => {
    if (categoryId) {
      const categoryKey = getCategoryCacheKey(categoryId, monthStart, monthEnd);
      categoryCache.delete(categoryKey);
      debugLog("[BudgetService] Cache invalidated", `Category ${categoryId} for month ${monthStart.toISOString().split('T')[0]}`);
    }
  });

  // Invalidiere nur die Summary-Caches für den betroffenen Monat
  const expenseKey = getCacheKey(monthStart, monthEnd, "expense");
  const incomeKey = getCacheKey(monthStart, monthEnd, "income");
  summaryCache.delete(expenseKey);
  summaryCache.delete(incomeKey);

  debugLog("[BudgetService] Cache invalidated", `Month summaries for ${monthStart.toISOString().split('T')[0]}`);
}

interface MonthlyBudgetData {
  budgeted: number;
  forecast: number; // NEU: Prognose-Spalte für Plan- und Prognosebuchungen (EXPENSE & INCOME)
  spent: number;
  saldo: number;
}
interface MonthlySummary {
  budgeted: number;
  forecast: number; // NEU: Prognose-Spalte
  spentMiddle: number;
  saldoFull: number;
}

/* ----------------------------- Hilfsfunktionen ----------------------------- */

function getPlannedAmountForCategory(
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): number {
  const planningStore = usePlanningStore();
  const categoryStore = useCategoryStore();
  let amount = 0;
  const startStr = toDateOnlyString(monthStart);
  const endStr = toDateOnlyString(monthEnd);

  planningStore.planningTransactions.forEach(planTx => {
    if (planTx.isActive && planTx.categoryId === categoryId) {
      const occurrences = PlanningService.calculateNextOccurrences(
        planTx,
        startStr,
        endStr
      );
      amount += planTx.amount * occurrences.length;
    }
  });

  // Kinder rekursiv
  categoryStore
    .getChildCategories(categoryId)
    .filter(c => c.isActive)
    .forEach(child => {
      amount += getPlannedAmountForCategory(child.id, monthStart, monthEnd);
    });

  return amount;
}

/* ----------------------- Expense-Kategorie-Berechnung ----------------------- */

function computeExpenseCategoryDataSingle(
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): MonthlyBudgetData {
  const categoryStore = useCategoryStore();
  const transactionStore = useTransactionStore();
  const cat = categoryStore.getCategoryById(categoryId);
  if (!cat) return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };

  // Vormonats-Saldo
  const prev = new Date(monthStart);
  prev.setDate(prev.getDate() - 1);
  const previousSaldo = BalanceService.getProjectedBalance('category', categoryId, prev);

  // Buchungen dieses Monats nach valueDate
  const txs = transactionStore.transactions.filter(tx => {
    const d = new Date(toDateOnlyString(tx.valueDate));
    return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
  });

  // Budget-Transfers (nur Quelle)
  const budgetAmount = txs
    .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
    .reduce((s, tx) => s + tx.amount, 0);

  // echte Ausgaben UND Einnahmen für diese Kategorie
  const expenseAmount = txs
    .filter(tx => tx.type === TransactionType.EXPENSE || tx.type === TransactionType.INCOME)
    .reduce((s, tx) => s + tx.amount, 0);

  // Prognose - Summe aller Plan- und Prognosebuchungen des Types EXPENSE & INCOME (nur für diese Kategorie)
  const planningStore = usePlanningStore();
  let forecastAmount = 0;
  const startStr = toDateOnlyString(monthStart);
  const endStr = toDateOnlyString(monthEnd);

  planningStore.planningTransactions.forEach(planTx => {
    if (planTx.isActive && planTx.categoryId === categoryId) {
      const occurrences = PlanningService.calculateNextOccurrences(
        planTx,
        startStr,
        endStr
      );
      forecastAmount += planTx.amount * occurrences.length;
    }
  });

  const spent = expenseAmount;
  const saldo = previousSaldo + budgetAmount + spent + forecastAmount;

  return {
    budgeted: budgetAmount,
    forecast: forecastAmount,
    spent: spent,
    saldo: saldo
  };
}

function computeExpenseCategoryData(
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): MonthlyBudgetData {
  const categoryStore = useCategoryStore();
  const transactionStore = useTransactionStore();
  const cat = categoryStore.getCategoryById(categoryId);
  if (!cat) return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };

  // Vormonats-Saldo
  const prev = new Date(monthStart);
  prev.setDate(prev.getDate() - 1);
  const previousSaldo = BalanceService.getProjectedBalance('category', categoryId, prev);

  // Buchungen dieses Monats nach valueDate
  const txs = transactionStore.transactions.filter(tx => {
    const d = new Date(toDateOnlyString(tx.valueDate));
    return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
  });

  // Budget-Transfers (nur Quelle)
  const budgetAmount = txs
    .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
    .reduce((s, tx) => s + tx.amount, 0);

  // echte Ausgaben UND Einnahmen für diese Kategorie
  const expenseAmount = txs
    .filter(tx => tx.type === TransactionType.EXPENSE || tx.type === TransactionType.INCOME)
    .reduce((s, tx) => s + tx.amount, 0);

  // Prognose - Summe aller Plan- und Prognosebuchungen des Types EXPENSE & INCOME
  const forecastAmount = getPlannedAmountForCategory(categoryId, monthStart, monthEnd);

  const spent = expenseAmount;
  const saldo = previousSaldo + budgetAmount + spent + forecastAmount;

  // Kinder
  let totalBudget = budgetAmount;
  let totalForecast = forecastAmount;
  let totalSpent = spent;
  let totalSaldo = saldo;

  categoryStore
    .getChildCategories(categoryId)
    .filter(c => c.isActive)
    .forEach(child => {
      const childData = computeExpenseCategoryData(child.id, monthStart, monthEnd);
      totalBudget += childData.budgeted;
      totalForecast += childData.forecast;
      totalSpent += childData.spent;
      totalSaldo += childData.saldo;
    });

  return {
    budgeted: totalBudget,
    forecast: totalForecast,
    spent: totalSpent,
    saldo: totalSaldo
  };
}

/* ------------------------ Income-Kategorie-Berechnung ----------------------- */

function computeIncomeCategoryDataSingle(
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): MonthlyBudgetData {
  const categoryStore = useCategoryStore();
  const transactionStore = useTransactionStore();
  const cat = categoryStore.getCategoryById(categoryId);
  if (!cat) return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };

  // Buchungen dieses Monats nach valueDate
  const txs = transactionStore.transactions.filter(tx => {
    const d = new Date(toDateOnlyString(tx.valueDate));
    return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
  });

  // Budget-Transfers (analog zu Expense)
  const budgetAmount = txs
    .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
    .reduce((s, tx) => s + tx.amount, 0);

  // Prognose - Plan- und Prognosebuchungen (nur für diese Kategorie)
  const planningStore = usePlanningStore();
  let forecastAmount = 0;
  const startStr = toDateOnlyString(monthStart);
  const endStr = toDateOnlyString(monthEnd);

  planningStore.planningTransactions.forEach(planTx => {
    if (planTx.isActive && planTx.categoryId === categoryId) {
      const occurrences = PlanningService.calculateNextOccurrences(
        planTx,
        startStr,
        endStr
      );
      forecastAmount += planTx.amount * occurrences.length;
    }
  });

  // Einnahmen-Transaktionen
  const incomeAmount = txs
    .filter(tx => tx.type === TransactionType.INCOME)
    .reduce((s, tx) => s + tx.amount, 0);

  return {
    budgeted: budgetAmount,
    forecast: forecastAmount,
    spent: incomeAmount,
    saldo: budgetAmount + incomeAmount + forecastAmount
  };
}

function computeIncomeCategoryData(
  categoryId: string,
  monthStart: Date,
  monthEnd: Date
): MonthlyBudgetData {
  const categoryStore = useCategoryStore();
  const transactionStore = useTransactionStore();
  const cat = categoryStore.getCategoryById(categoryId);
  if (!cat) return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };

  // Buchungen dieses Monats nach valueDate
  const txs = transactionStore.transactions.filter(tx => {
    const d = new Date(toDateOnlyString(tx.valueDate));
    return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
  });

  // Budget-Transfers (analog zu Expense)
  const budgetAmount = txs
    .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
    .reduce((s, tx) => s + tx.amount, 0);

  // Prognose - Plan- und Prognosebuchungen
  const forecastAmount = getPlannedAmountForCategory(categoryId, monthStart, monthEnd);

  // Einnahmen-Transaktionen
  const incomeAmount = txs
    .filter(tx => tx.type === TransactionType.INCOME)
    .reduce((s, tx) => s + tx.amount, 0);

  let totalBudget = budgetAmount;
  let totalForecast = forecastAmount;
  let totalSpent = incomeAmount;
  let totalSaldo = budgetAmount + incomeAmount + forecastAmount;

  categoryStore
    .getChildCategories(categoryId)
    .filter(c => c.isActive)
    .forEach(child => {
      const childData = computeIncomeCategoryData(child.id, monthStart, monthEnd);
      totalBudget += childData.budgeted;
      totalForecast += childData.forecast;
      totalSpent += childData.spent;
      totalSaldo += childData.saldo;
    });

  return {
    budgeted: totalBudget,
    forecast: totalForecast,
    spent: totalSpent,
    saldo: totalSaldo
  };
}

/* ------------------------------ Public API ---------------------------------- */

export const BudgetService = {
  getAggregatedMonthlyBudgetData(
    categoryId: string,
    monthStart: Date,
    monthEnd: Date
  ): MonthlyBudgetData {
    const cat = useCategoryStore().getCategoryById(categoryId);
    if (!cat) {
      debugLog("[BudgetService] Category not found", categoryId);
      return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    }

    return cat.isIncomeCategory
      ? computeIncomeCategoryData(categoryId, monthStart, monthEnd)
      : computeExpenseCategoryData(categoryId, monthStart, monthEnd);
  },

  getSingleCategoryMonthlyBudgetData(
    categoryId: string,
    monthStart: Date,
    monthEnd: Date
  ): MonthlyBudgetData {
    const cat = useCategoryStore().getCategoryById(categoryId);
    if (!cat) {
      debugLog("[BudgetService] Category not found", categoryId);
      return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    }

    return cat.isIncomeCategory
      ? computeIncomeCategoryDataSingle(categoryId, monthStart, monthEnd)
      : computeExpenseCategoryDataSingle(categoryId, monthStart, monthEnd);
  },

  getMonthlySummary(
    monthStart: Date,
    monthEnd: Date,
    type: "expense" | "income"
  ): MonthlySummary {
    // Cache-Check
    const cacheKey = getCacheKey(monthStart, monthEnd, type);
    const cached = summaryCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    // Cache-Cleanup
    cleanExpiredCache();

    // Berechnung
    const categoryStore = useCategoryStore();
    const isIncome = type === "income";
    const roots = categoryStore.categories.filter(
      c =>
        c.isActive &&
        !c.parentCategoryId &&
        c.isIncomeCategory === isIncome &&
        c.name !== "Verfügbare Mittel"
    );

    const sum: MonthlySummary = { budgeted: 0, forecast: 0, spentMiddle: 0, saldoFull: 0 };
    roots.forEach(cat => {
      const d = this.getAggregatedMonthlyBudgetData(
        cat.id,
        monthStart,
        monthEnd
      );
      sum.budgeted += d.budgeted;
      sum.forecast += d.forecast;
      sum.spentMiddle += d.spent;
      sum.saldoFull += d.saldo;
    });

    // Cache speichern
    summaryCache.set(cacheKey, { data: sum, timestamp: now });

    debugLog("[BudgetService] Monthly summary", `${type} summary for ${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]} (${cached ? 'CACHED' : 'CALCULATED'})`);
    return sum;
  },

  // Cache-Invalidierung für externe Aufrufe
  invalidateCache() {
    invalidateCache();
  },

  // Granulare Cache-Invalidierung für spezifische Transaktionen
  invalidateCacheForTransaction(transaction: { categoryId?: string; date: string; toCategoryId?: string }) {
    invalidateCacheForTransaction(transaction);
  },
};
