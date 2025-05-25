// src/services/BudgetService.ts
import { useCategoryStore } from "@/stores/categoryStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { usePlanningStore } from "@/stores/planningStore";
import { PlanningService } from "./PlanningService";
import { Category, TransactionType } from "@/types";
import { toDateOnlyString } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { BalanceService } from "./BalanceService";

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

  getMonthlySummary(
    monthStart: Date,
    monthEnd: Date,
    type: "expense" | "income"
  ): MonthlySummary {
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
    debugLog("[BudgetService] Monthly summary", { monthStart, monthEnd, type, sum });
    return sum;
  },
};
