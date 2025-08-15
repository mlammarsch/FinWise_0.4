// Budget Worker für asynchrone Berechnungen
// Verlagert schwere Budget-Berechnungen in Background-Thread

class BudgetWorker {
  constructor() {
    this.transactionIndex = new Map();
    this.planningIndex = new Map();
  }

  // Erstelle Index für schnelle Transaktions-Suche
  buildTransactionIndex(transactions) {
    this.transactionIndex.clear();

    transactions.forEach(tx => {
      const txDate = new Date(tx.valueDate);
      const monthKey = `${txDate.getFullYear()}-${txDate.getMonth()}`;
      const categoryKey = `${tx.categoryId}-${monthKey}`;

      if (!this.transactionIndex.has(categoryKey)) {
        this.transactionIndex.set(categoryKey, []);
      }
      this.transactionIndex.get(categoryKey).push(tx);
    });
  }

  // Erstelle Index für Planungstransaktionen
  buildPlanningIndex(planningTransactions) {
    this.planningIndex.clear();

    planningTransactions.forEach(pt => {
      if (!pt.isActive) return;

      const categoryKey = pt.categoryId;
      if (!this.planningIndex.has(categoryKey)) {
        this.planningIndex.set(categoryKey, []);
      }
      this.planningIndex.get(categoryKey).push(pt);
    });
  }

  // Berechne Budget-Daten für eine Kategorie
  calculateCategoryBudget(categoryId, monthStart, monthEnd, isIncomeCategory) {
    const monthKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;
    const categoryKey = `${categoryId}-${monthKey}`;

    // Hole Transaktionen aus Index
    const transactions = this.transactionIndex.get(categoryKey) || [];
    const planningTransactions = this.planningIndex.get(categoryId) || [];

    // Filtere Transaktionen für den exakten Zeitraum
    const relevantTxs = transactions.filter(tx => {
      const txDate = new Date(tx.valueDate);
      return txDate >= monthStart && txDate <= monthEnd;
    });

    // Budget-Transfers (nur Quelle)
    const budgetAmount = relevantTxs
      .filter(tx => tx.type === 'CATEGORYTRANSFER' && tx.categoryId === categoryId)
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Echte Ausgaben/Einnahmen
    const expenseAmount = relevantTxs
      .filter(tx => tx.type === 'EXPENSE' || tx.type === 'INCOME')
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Prognose aus Planungstransaktionen
    const forecastAmount = planningTransactions
      .filter(pt => {
        const ptDate = new Date(pt.valueDate);
        return ptDate >= monthStart && ptDate <= monthEnd;
      })
      .reduce((sum, pt) => sum + pt.amount, 0);

    return {
      budgeted: budgetAmount,
      forecast: forecastAmount,
      spent: expenseAmount,
      saldo: budgetAmount + expenseAmount + forecastAmount
    };
  }

  // Berechne Zusammenfassung für alle Kategorien eines Typs
  calculateTypeSummary(categoryIds, monthStart, monthEnd, type) {
    let totalBudgeted = 0;
    let totalForecast = 0;
    let totalSpent = 0;
    let totalSaldo = 0;

    const results = {};

    categoryIds.forEach(categoryId => {
      const result = this.calculateCategoryBudget(
        categoryId,
        monthStart,
        monthEnd,
        type === 'income'
      );

      results[categoryId] = result;
      totalBudgeted += result.budgeted;
      totalForecast += result.forecast;
      totalSpent += result.spent;
      totalSaldo += result.saldo;
    });

    return {
      categories: results,
      summary: {
        budgeted: totalBudgeted,
        forecast: totalForecast,
        spentMiddle: totalSpent,
        saldoFull: totalSaldo
      }
    };
  }
}

const budgetWorker = new BudgetWorker();

// Message Handler
self.onmessage = function (e) {
  const { type, data, requestId } = e.data;

  try {
    let result;

    switch (type) {
      case 'BUILD_TRANSACTION_INDEX':
        budgetWorker.buildTransactionIndex(data.transactions);
        result = { success: true };
        break;

      case 'BUILD_PLANNING_INDEX':
        budgetWorker.buildPlanningIndex(data.planningTransactions);
        result = { success: true };
        break;

      case 'CALCULATE_CATEGORY_BUDGET':
        result = budgetWorker.calculateCategoryBudget(
          data.categoryId,
          new Date(data.monthStart),
          new Date(data.monthEnd),
          data.isIncomeCategory
        );
        break;

      case 'CALCULATE_TYPE_SUMMARY':
        result = budgetWorker.calculateTypeSummary(
          data.categoryIds,
          new Date(data.monthStart),
          new Date(data.monthEnd),
          data.type
        );
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({
      type: 'SUCCESS',
      requestId,
      result
    });

  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      requestId,
      error: error.message
    });
  }
};

// Bereit-Signal senden
self.postMessage({
  type: 'READY'
});
