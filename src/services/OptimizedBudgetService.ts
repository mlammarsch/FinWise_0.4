// OptimizedBudgetService - Kombiniert alle Performance-Optimierungen
import { useCategoryStore } from "@/stores/categoryStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { usePlanningStore } from "@/stores/planningStore";
import { Category, Transaction, TransactionType } from "@/types";
import { toDateOnlyString } from "@/utils/formatters";
import { debugLog, infoLog, warnLog, errorLog } from "@/utils/logger";
import { budgetWorkerService } from "./BudgetWorkerService";
import { BalanceService } from "./BalanceService";

// Optimierte Datenstrukturen
interface OptimizedBudgetData {
  budgeted: number;
  forecast: number;
  spent: number;
  saldo: number;
}

interface CategoryMonthKey {
  categoryId: string;
  monthKey: string;
}

class OptimizedBudgetCache {
  private cache = new Map<string, { data: OptimizedBudgetData; timestamp: number }>();
  private readonly CACHE_TTL = 30000; // 30 Sekunden
  private lastCleanup = 0;

  private getCacheKey(categoryId: string, monthStart: Date, monthEnd: Date): string {
    return `${categoryId}-${monthStart.toISOString().split('T')[0]}-${monthEnd.toISOString().split('T')[0]}`;
  }

  get(categoryId: string, monthStart: Date, monthEnd: Date): OptimizedBudgetData | null {
    this.cleanupExpired();
    const key = this.getCacheKey(categoryId, monthStart, monthEnd);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    return null;
  }

  set(categoryId: string, monthStart: Date, monthEnd: Date, data: OptimizedBudgetData): void {
    const key = this.getCacheKey(categoryId, monthStart, monthEnd);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(categoryId?: string, monthStart?: Date, monthEnd?: Date): void {
    if (categoryId && monthStart && monthEnd) {
      // Spezifische Invalidierung
      const key = this.getCacheKey(categoryId, monthStart, monthEnd);
      this.cache.delete(key);
    } else {
      // Komplette Invalidierung
      this.cache.clear();
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    if (now - this.lastCleanup < 10000) return; // Nur alle 10 Sekunden

    this.lastCleanup = now;
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}

class TransactionIndexOptimized {
  private categoryMonthIndex = new Map<string, Transaction[]>();
  private lastRebuild = 0;
  private readonly REBUILD_INTERVAL = 15000; // 15 Sekunden

  private getIndexKey(categoryId: string, year: number, month: number): string {
    return `${categoryId}-${year}-${month}`;
  }

  getTransactions(categoryId: string, monthStart: Date, monthEnd: Date): Transaction[] {
    this.ensureIndexFresh();

    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const key = this.getIndexKey(categoryId, year, month);

    const transactions = this.categoryMonthIndex.get(key) || [];

    // Zusätzliche Filterung für exakten Datumsbereich
    return transactions.filter(tx => {
      const txDate = new Date(toDateOnlyString(tx.valueDate));
      return txDate >= monthStart && txDate <= monthEnd;
    });
  }

  private ensureIndexFresh(): void {
    const now = Date.now();
    if (now - this.lastRebuild > this.REBUILD_INTERVAL) {
      this.rebuildIndex();
    }
  }

  private rebuildIndex(): void {
    this.categoryMonthIndex.clear();
    const transactionStore = useTransactionStore();

    let indexedCount = 0;
    transactionStore.transactions.forEach(tx => {
      if (!tx.categoryId) return;

      const txDate = new Date(toDateOnlyString(tx.valueDate));
      const key = this.getIndexKey(tx.categoryId, txDate.getFullYear(), txDate.getMonth());

      if (!this.categoryMonthIndex.has(key)) {
        this.categoryMonthIndex.set(key, []);
      }
      this.categoryMonthIndex.get(key)!.push(tx);
      indexedCount++;
    });

    this.lastRebuild = Date.now();
    debugLog("[OptimizedBudgetService]", `Transaction index rebuilt: ${indexedCount} transactions in ${this.categoryMonthIndex.size} category-month buckets`);
  }

  invalidate(): void {
    this.categoryMonthIndex.clear();
    this.lastRebuild = 0;
  }
}

class OptimizedBudgetService {
  private cache = new OptimizedBudgetCache();
  private transactionIndex = new TransactionIndexOptimized();
  private workerInitialized = false;

  async initializeWorker(): Promise<void> {
    if (this.workerInitialized || !budgetWorkerService.isWorkerAvailable()) {
      return;
    }

    try {
      const transactionStore = useTransactionStore();
      const planningStore = usePlanningStore();

      await budgetWorkerService.buildTransactionIndex(transactionStore.transactions);
      await budgetWorkerService.buildPlanningIndex(planningStore.planningTransactions);

      this.workerInitialized = true;
      debugLog("[OptimizedBudgetService]", "Worker initialized successfully");
    } catch (error) {
      errorLog("[OptimizedBudgetService]", "Failed to initialize worker", error);
    }
  }

  async getOptimizedBudgetData(
    categoryId: string,
    monthStart: Date,
    monthEnd: Date
  ): Promise<OptimizedBudgetData> {
    // 1. Cache-Lookup
    const cached = this.cache.get(categoryId, monthStart, monthEnd);
    if (cached) {
      return cached;
    }

    // 2. Versuche Worker-basierte Berechnung
    if (budgetWorkerService.isWorkerAvailable() && this.workerInitialized) {
      try {
        const categoryStore = useCategoryStore();
        const category = categoryStore.getCategoryById(categoryId);
        const result = await budgetWorkerService.calculateCategoryBudget(
          categoryId,
          monthStart,
          monthEnd,
          category?.isIncomeCategory || false
        );

        this.cache.set(categoryId, monthStart, monthEnd, result);
        return result;
      } catch (error) {
        warnLog("[OptimizedBudgetService]", "Worker calculation failed, falling back to sync", error);
      }
    }

    // 3. Fallback: Optimierte synchrone Berechnung
    const result = this.calculateBudgetDataSync(categoryId, monthStart, monthEnd);
    this.cache.set(categoryId, monthStart, monthEnd, result);
    return result;
  }

  private calculateBudgetDataSync(
    categoryId: string,
    monthStart: Date,
    monthEnd: Date
  ): OptimizedBudgetData {
    const categoryStore = useCategoryStore();
    const category = categoryStore.getCategoryById(categoryId);

    if (!category) {
      return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    }

    // KRITISCH: Vormonats-Saldo berechnen (war in der optimierten Version vergessen!)
    const prev = new Date(monthStart);
    prev.setDate(prev.getDate() - 1);
    const previousSaldo = BalanceService.getProjectedBalance('category', categoryId, prev);

    // Optimierte Transaktions-Abfrage über Index
    const transactions = this.transactionIndex.getTransactions(categoryId, monthStart, monthEnd);

    // Budget-Transfers (nur Quelle)
    const budgetAmount = transactions
      .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Echte Ausgaben/Einnahmen
    const expenseAmount = transactions
      .filter(tx => tx.type === TransactionType.EXPENSE || tx.type === TransactionType.INCOME)
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Prognose aus Planungstransaktionen
    const forecastAmount = this.getPlannedAmountOptimized(categoryId, monthStart, monthEnd);

    return {
      budgeted: budgetAmount,
      forecast: forecastAmount,
      spent: expenseAmount,
      saldo: previousSaldo + budgetAmount + expenseAmount + forecastAmount  // BEHOBEN: previousSaldo hinzugefügt!
    };
  }

  private getPlannedAmountOptimized(
    categoryId: string,
    monthStart: Date,
    monthEnd: Date
  ): number {
    const planningStore = usePlanningStore();
    const startStr = toDateOnlyString(monthStart);
    const endStr = toDateOnlyString(monthEnd);

    return planningStore.planningTransactions
      .filter(pt =>
        pt.isActive &&
        pt.categoryId === categoryId &&
        pt.valueDate &&
        pt.valueDate >= startStr &&
        pt.valueDate <= endStr
      )
      .reduce((sum, pt) => sum + pt.amount, 0);
  }

  // Batch-Verarbeitung für mehrere Kategorien
  async getBatchBudgetData(
    requests: Array<{ categoryId: string; monthStart: Date; monthEnd: Date }>
  ): Promise<Map<string, OptimizedBudgetData>> {
    const results = new Map<string, OptimizedBudgetData>();

    // Gruppiere Requests nach Verfügbarkeit im Cache
    const cachedRequests: typeof requests = [];
    const uncachedRequests: typeof requests = [];

    requests.forEach(req => {
      const cached = this.cache.get(req.categoryId, req.monthStart, req.monthEnd);
      if (cached) {
        const key = `${req.categoryId}-${req.monthStart.toISOString()}-${req.monthEnd.toISOString()}`;
        results.set(key, cached);
        cachedRequests.push(req);
      } else {
        uncachedRequests.push(req);
      }
    });

    // Verarbeite uncached Requests in Batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < uncachedRequests.length; i += BATCH_SIZE) {
      const batch = uncachedRequests.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async req => {
        const result = await this.getOptimizedBudgetData(req.categoryId, req.monthStart, req.monthEnd);
        const key = `${req.categoryId}-${req.monthStart.toISOString()}-${req.monthEnd.toISOString()}`;
        results.set(key, result);
      }));

      // Kurze Pause zwischen Batches für UI-Responsiveness
      if (i + BATCH_SIZE < uncachedRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    infoLog("[OptimizedBudgetService]", `Batch processed: ${cachedRequests.length} cached, ${uncachedRequests.length} calculated`);
    return results;
  }

  // Cache-Management
  invalidateCache(categoryId?: string, monthStart?: Date, monthEnd?: Date): void {
    this.cache.invalidate(categoryId, monthStart, monthEnd);
    this.transactionIndex.invalidate();
    this.workerInitialized = false;
  }

  // Berechne Type-Summary für alle Kategorien eines Typs
  async calculateTypeSummary(
    categoryIds: string[],
    monthStart: Date,
    monthEnd: Date,
    type: 'expense' | 'income'
  ): Promise<{
    categories: Record<string, any>;
    summary: {
      budgeted: number;
      forecast: number;
      spentMiddle: number;
      saldoFull: number;
    };
  }> {
    try {
      // Verwende Batch-Verarbeitung für bessere Performance
      const requests = categoryIds.map(categoryId => ({
        categoryId,
        monthStart,
        monthEnd
      }));

      const results = await this.getBatchBudgetData(requests);

      let totalBudgeted = 0;
      let totalForecast = 0;
      let totalSpent = 0;
      let totalSaldo = 0;

      const categories: Record<string, any> = {};

      categoryIds.forEach(categoryId => {
        const key = `${categoryId}-${monthStart.toISOString()}-${monthEnd.toISOString()}`;
        const result = results.get(key);

        if (result) {
          categories[categoryId] = result;
          totalBudgeted += result.budgeted;
          totalForecast += result.forecast;
          totalSpent += result.spent;
          totalSaldo += result.saldo;
        }
      });

      return {
        categories,
        summary: {
          budgeted: totalBudgeted,
          forecast: totalForecast,
          spentMiddle: totalSpent,
          saldoFull: totalSaldo
        }
      };
    } catch (error) {
      errorLog("[OptimizedBudgetService]", `Failed to calculate ${type} summary`, error);
      throw error;
    }
  }

  // Statistiken für Debugging
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: (this.cache as any).cache.size,
      hitRate: 0 // TODO: Implementiere Hit-Rate-Tracking
    };
  }
}

// Singleton-Export
export const optimizedBudgetService = new OptimizedBudgetService();

// Auto-Initialisierung - verzögert bis Pinia verfügbar ist
if (typeof window !== 'undefined') {
  // Warte bis DOM und Pinia geladen sind
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      optimizedBudgetService.initializeWorker();
    }, 2000); // Längere Verzögerung für Pinia-Initialisierung
  });
}
