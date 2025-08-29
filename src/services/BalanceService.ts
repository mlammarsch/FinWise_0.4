// src/services/BalanceService.ts
import { useTransactionStore, type ExtendedTransaction } from '@/stores/transactionStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useMonthlyBalanceStore, MonthlyBalance } from '@/stores/monthlyBalanceStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { TransactionType, BalanceInfo, Transaction } from '@/types';
import { toDateOnlyString } from '@/utils/formatters';
import { PlanningService } from './PlanningService';
import { debugLog } from '@/utils/logger';
import dayjs from 'dayjs';

/**
 * Transaction Cache für optimierte Balance-Berechnungen
 * Gruppiert Transaktionen nach Monat/Kategorie für schnellere Zugriffe
 */
class TransactionCache {
  private cache = new Map<string, {
    accountTransactions: Map<string, Transaction[]>;
    categoryTransactions: Map<string, Transaction[]>;
    lastUpdate: number;
  }>();

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 Minuten TTL

  /**
   * Generiert Cache-Key für einen Monat
   */
  private getMonthKey(year: number, month: number): string {
    return `${year}-${month.toString().padStart(2, '0')}`;
  }

  /**
   * Holt oder erstellt Cache-Eintrag für einen Monat
   */
  private getOrCreateMonthCache(year: number, month: number) {
    const key = this.getMonthKey(year, month);
    let monthCache = this.cache.get(key);

    // Für den aktuellen Monat: Cache immer invalidieren für aktuelle Daten
    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    if (!monthCache ||
      (Date.now() - monthCache.lastUpdate) > this.CACHE_TTL ||
      isCurrentMonth) {
      monthCache = {
        accountTransactions: new Map(),
        categoryTransactions: new Map(),
        lastUpdate: Date.now()
      };
      this.cache.set(key, monthCache);
      this.buildMonthCache(year, month, monthCache);
    }

    return monthCache;
  }

  /**
   * Baut den Cache für einen Monat auf
   */
  private buildMonthCache(year: number, month: number, monthCache: any) {
    const transactionStore = useTransactionStore();
    const endDate = new Date(year, month + 1, 0);
    const endDateStr = toDateOnlyString(endDate);

    // Alle Transaktionen bis zum Monatsende
    const relevantTxs = transactionStore.transactions.filter(tx =>
      toDateOnlyString(tx.date) <= endDateStr || toDateOnlyString(tx.valueDate) <= endDateStr
    );

    // Gruppierung nach Accounts (nach date)
    relevantTxs.forEach(tx => {
      if (tx.accountId && toDateOnlyString(tx.date) <= endDateStr && tx.type !== TransactionType.CATEGORYTRANSFER) {
        if (!monthCache.accountTransactions.has(tx.accountId)) {
          monthCache.accountTransactions.set(tx.accountId, []);
        }
        monthCache.accountTransactions.get(tx.accountId)!.push(tx);
      }
    });

    // Gruppierung nach Kategorien (nach valueDate)
    relevantTxs.forEach(tx => {
      if (tx.categoryId && toDateOnlyString(tx.valueDate) <= endDateStr) {
        if (!monthCache.categoryTransactions.has(tx.categoryId)) {
          monthCache.categoryTransactions.set(tx.categoryId, []);
        }
        monthCache.categoryTransactions.get(tx.categoryId)!.push(tx);
      }
    });
  }

  /**
   * Holt Account-Transaktionen für einen Monat
   */
  getAccountTransactions(accountId: string, year: number, month: number): Transaction[] {
    const monthCache = this.getOrCreateMonthCache(year, month);
    return monthCache.accountTransactions.get(accountId) || [];
  }

  /**
   * Holt Kategorie-Transaktionen für einen Monat
   */
  getCategoryTransactions(categoryId: string, year: number, month: number): Transaction[] {
    const monthCache = this.getOrCreateMonthCache(year, month);
    return monthCache.categoryTransactions.get(categoryId) || [];
  }

  /**
   * Invalidiert Cache für bestimmte Monate
   */
  invalidateMonths(months: Array<{ year: number; month: number }>) {
    months.forEach(({ year, month }) => {
      const key = this.getMonthKey(year, month);
      this.cache.delete(key);
    });
  }

  /**
   * Leert den gesamten Cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Invalidiert den Cache für den aktuellen Monat
   * Wird verwendet, um sicherzustellen, dass aktuelle Daten angezeigt werden
   */
  invalidateCurrentMonth() {
    const now = new Date();
    const currentMonthKey = this.getMonthKey(now.getFullYear(), now.getMonth());
    this.cache.delete(currentMonthKey);
  }
}

/**
 * Optimierte Running Balance Queue für Batch-Verarbeitung
 * Sammelt Account-Updates und verarbeitet sie in Batches mit Debouncing
 */
class RunningBalanceQueue {
  private pendingAccounts = new Set<string>();
  private accountDates = new Map<string, string>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private readonly DEBOUNCE_DELAY = 100; // 100ms Debounce

  /**
   * Fügt einen Account zur Batch-Verarbeitung hinzu
   */
  enqueueAccount(accountId: string, transactionDate?: string): void {
    this.pendingAccounts.add(accountId);

    // Speichere das früheste Datum für optimierte Berechnung
    if (transactionDate) {
      const existingDate = this.accountDates.get(accountId);
      if (!existingDate || transactionDate < existingDate) {
        this.accountDates.set(accountId, transactionDate);
      }
    }

    this.scheduleProcessing();
  }

  /**
   * Plant die Batch-Verarbeitung mit Debouncing
   */
  private scheduleProcessing(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processBatch();
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Verarbeitet alle gesammelten Accounts in einem optimierten Batch
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingAccounts.size === 0) {
      return;
    }

    this.isProcessing = true;
    const accountsToProcess = Array.from(this.pendingAccounts);
    const datesToProcess = new Map(this.accountDates);

    // Queues leeren
    this.pendingAccounts.clear();
    this.accountDates.clear();

    debugLog('BalanceService', 'RunningBalanceQueue - Batch-Verarbeitung gestartet', {
      accountCount: accountsToProcess.length,
      accounts: accountsToProcess
    });

    try {
      // Sequenzielle Verarbeitung aller Accounts
      for (const accountId of accountsToProcess) {
        const fromDate = datesToProcess.get(accountId);
        const startDate = fromDate ? new Date(fromDate) : undefined;

        // Einen Tag früher beginnen für korrekte Berechnung
        if (startDate) {
          startDate.setDate(startDate.getDate() - 1);
        }

        await BalanceService.recalculateRunningBalancesForAccount(accountId, startDate);
      }

      debugLog('BalanceService', 'RunningBalanceQueue - Batch-Verarbeitung abgeschlossen', {
        processedAccounts: accountsToProcess.length
      });
    } catch (error) {
      debugLog('BalanceService', 'RunningBalanceQueue - Fehler bei Batch-Verarbeitung', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Prüft ob gerade eine Batch-Verarbeitung läuft
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Erzwingt sofortige Verarbeitung (für Tests oder kritische Operationen)
   */
  async forceProcess(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.processBatch();
  }
}

// Globale Instanzen
const runningBalanceQueue = new RunningBalanceQueue();
const transactionCache = new TransactionCache();

/**
 * Queue für die Aktualisierung der Monatsbilanzen.
 * Sammelt Änderungen und stößt eine inkrementelle Neuberechnung an.
 */
class MonthlyBalanceUpdateQueue {
  private pendingUpdates = {
    accountIds: new Set<string>(),
    categoryIds: new Set<string>(),
    fromDate: ''
  };
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessing = false;
  private readonly DEBOUNCE_DELAY = 200; // 200ms Debounce

  enqueueUpdate(updates: { accountIds?: string[]; categoryIds?: string[]; fromDate: string }): void {
    updates.accountIds?.forEach(id => this.pendingUpdates.accountIds.add(id));
    updates.categoryIds?.forEach(id => this.pendingUpdates.categoryIds.add(id));

    if (!this.pendingUpdates.fromDate || updates.fromDate < this.pendingUpdates.fromDate) {
      this.pendingUpdates.fromDate = updates.fromDate;
    }

    this.scheduleProcessing();
  }

  private scheduleProcessing(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.DEBOUNCE_DELAY);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || (this.pendingUpdates.accountIds.size === 0 && this.pendingUpdates.categoryIds.size === 0)) {
      return;
    }

    this.isProcessing = true;
    const updatesToProcess = {
      accountIds: Array.from(this.pendingUpdates.accountIds),
      categoryIds: Array.from(this.pendingUpdates.categoryIds),
      fromDate: this.pendingUpdates.fromDate
    };

    this.pendingUpdates.accountIds.clear();
    this.pendingUpdates.categoryIds.clear();
    this.pendingUpdates.fromDate = '';

    try {
      await BalanceService.updateMonthlyBalancesForChanges(updatesToProcess);
    } catch (error) {
      debugLog('BalanceService', 'MonthlyBalanceUpdateQueue - Fehler bei der Verarbeitung', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

const monthlyBalanceUpdateQueue = new MonthlyBalanceUpdateQueue();

export type EntityType = 'account' | 'category';

export interface RunningBalance {
  date: string;
  balance: number;
  projected?: number;
}

export interface MonthlyBalanceResult {
  year: number;
  month: number;
  balance: number;
  projected?: number;
}

/**
 * BalanceService - Zentrale Service-Schicht für alle Saldoberechnungen
 * Bietet einheitliche API für:
 * - Konto- und Kategorie-Salden
 * - Aktuelle, laufende, monatliche und projizierte Salden
 */
export const BalanceService = {
  /**
   * Prüft, ob eine Neuberechnung der Monatsbilanzen erforderlich ist.
   * Wird beim Login verwendet, um unnötige Berechnungen zu vermeiden.
   */
  async calculateMonthlyBalancesIfNeeded(): Promise<void> {
    debugLog('BalanceService', 'calculateMonthlyBalancesIfNeeded - Checking if recalculation needed');

    const mbStore = useMonthlyBalanceStore();
    const transactionStore = useTransactionStore();

    // Prüfe, ob bereits Monatsbilanzen existieren
    const existingBalances = mbStore.getAllMonthlyBalances();

    if (existingBalances.length === 0) {
      debugLog('BalanceService', 'calculateMonthlyBalancesIfNeeded - No existing balances, calculating all');
      await this.calculateAllMonthlyBalances();
      return;
    }

    // Prüfe, ob neue Transaktionen seit der letzten Berechnung hinzugekommen sind
    const latestBalance = existingBalances
      .sort((a, b) => b.year - a.year || b.month - a.month)[0];

    if (latestBalance && latestBalance.lastCalculated) {
      const hasNewTransactions = transactionStore.transactions.some(tx =>
        new Date(tx.updated_at || tx.createdAt || '1970-01-01') > new Date(latestBalance.lastCalculated!)
      );

      if (!hasNewTransactions) {
        debugLog('BalanceService', 'calculateMonthlyBalancesIfNeeded - No new transactions, skipping calculation');
        return;
      }
    }

    debugLog('BalanceService', 'calculateMonthlyBalancesIfNeeded - New data detected, recalculating');
    await this.calculateAllMonthlyBalances();
  },

  /**
   * Backward-Compat Wrapper: viele Stellen rufen noch calculateMonthlyBalances() auf.
   * Delegiert auf calculateAllMonthlyBalances().
   */
  async calculateMonthlyBalances(): Promise<void> {
    await this.calculateAllMonthlyBalances();
  },

  /**
   * Stößt die Neuberechnung der Monatsbilanzen über die Queue an.
   */
  triggerMonthlyBalanceUpdate(updates: { accountIds?: string[]; categoryIds?: string[]; fromDate: string }): void {
    monthlyBalanceUpdateQueue.enqueueUpdate(updates);

    // Cache-Invalidierung: Betroffene Monate ermitteln und invalidieren
    const fromDate = new Date(updates.fromDate);
    const currentDate = new Date();
    const monthsToInvalidate: Array<{ year: number; month: number }> = [];

    // Invalidiere alle Monate vom fromDate bis heute
    let date = new Date(fromDate);
    while (date <= currentDate) {
      monthsToInvalidate.push({
        year: date.getFullYear(),
        month: date.getMonth()
      });
      date.setMonth(date.getMonth() + 1);
    }

    if (monthsToInvalidate.length > 0) {
      transactionCache.invalidateMonths(monthsToInvalidate);
      debugLog('BalanceService', `Cache invalidiert für ${monthsToInvalidate.length} Monate`, {
        months: monthsToInvalidate.map(m => `${m.year}-${m.month + 1}`).join(', ')
      });
    }
  },

  /**
   * Führt eine inkrementelle Aktualisierung der Monatsbilanzen durch.
   * Berechnet nur die betroffenen Entitäten ab einem bestimmten Datum neu.
   */
  async updateMonthlyBalancesForChanges(updates: { accountIds?: string[]; categoryIds?: string[]; fromDate: string }): Promise<void> {
    const { accountIds, categoryIds, fromDate } = updates;
    if ((!accountIds || accountIds.length === 0) && (!categoryIds || categoryIds.length === 0)) {
      return;
    }

    debugLog('BalanceService', 'updateMonthlyBalancesForChanges - Start', { updates });
    const mbStore = useMonthlyBalanceStore();

    const startMonth = dayjs(fromDate).startOf('month');
    const end = dayjs().add(2, 'year').endOf('month'); // Bis in 2 Jahren rechnen
    let currentMonth = startMonth;

    const calculationTimestamp = new Date().toISOString();

    while (currentMonth.isBefore(end) || currentMonth.isSame(end)) {
      const year = currentMonth.year();
      const month = currentMonth.month();

      const existingBalance = mbStore.getMonthlyBalance(year, month) || {
        year,
        month,
        accountBalances: {},
        categoryBalances: {},
        projectedAccountBalances: {},
        projectedCategoryBalances: {},
      };

      const newBalanceData = this.calculateBalanceForMonth(year, month, accountIds, categoryIds, existingBalance);

      const mergedBalance: MonthlyBalance = {
        ...existingBalance,
        ...newBalanceData,
        year,
        month,
        lastCalculated: calculationTimestamp,
      };

      await mbStore.setMonthlyBalance(year, month, mergedBalance);
      currentMonth = currentMonth.add(1, 'month');
    }
  },

  /**
   * Berechnet alle Monatsbilanzen und speichert sie im Store.
   * Wird für die Erstberechnung verwendet.
   */
  async calculateAllMonthlyBalances(): Promise<void> {
    debugLog('BalanceService', 'calculateAllMonthlyBalances - Start full calculation');
    const transactionStore = useTransactionStore();
    const planningStore = usePlanningStore();
    const mbStore = useMonthlyBalanceStore();

    await mbStore.loadMonthlyBalances();
    const months = new Set<string>();

    transactionStore.transactions.forEach(tx => {
      months.add(dayjs(tx.date).format('YYYY-M'));
      if (tx.valueDate) months.add(dayjs(tx.valueDate).format('YYYY-M'));
    });
    // Planungstransaktionen werden über calculateNextOccurrences berechnet
    // und müssen nicht separat zu den Monaten hinzugefügt werden

    let current = dayjs().startOf('month');
    const end = dayjs().add(2, 'year').endOf('month');
    while (current.isBefore(end)) {
      months.add(current.format('YYYY-M'));
      current = current.add(1, 'month');
    }

    const calculationTimestamp = new Date().toISOString();
    for (const key of Array.from(months).sort()) {
      const [year, monthIndex] = key.split('-').map(Number);
      const balanceData = this.calculateBalanceForMonth(year, monthIndex - 1);
      const monthlyBalance: MonthlyBalance = {
        accountBalances: balanceData.accountBalances || {},
        categoryBalances: balanceData.categoryBalances || {},
        projectedAccountBalances: balanceData.projectedAccountBalances || {},
        projectedCategoryBalances: balanceData.projectedCategoryBalances || {},
        year,
        month: monthIndex - 1,
        lastCalculated: calculationTimestamp
      };
      await mbStore.setMonthlyBalance(year, monthIndex - 1, monthlyBalance);
    }
  },

  /**
 * Berechnet die Bilanz für einen bestimmten Monat
 */
  calculateBalanceForMonth(
    year: number,
    month: number,
    changedAccountIds: string[] = [],
    changedCategoryIds: string[] = [],
    existingBalance?: MonthlyBalance
  ): Partial<Omit<MonthlyBalance, 'year' | 'month'>> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startDateStr = toDateOnlyString(startDate);
    const endDateStr = toDateOnlyString(endDate);

    const transactionStore = useTransactionStore();
    const accountStore = useAccountStore();
    const categoryStore = useCategoryStore();
    const planningStore = usePlanningStore();
    const mbStore = useMonthlyBalanceStore();

    // 1. Kontosalden berechnen (mit Cache-Optimierung)
    const accountBalances: Record<string, number> = existingBalance?.accountBalances || {};
    const relevantAccountIds = changedAccountIds.length > 0 ? changedAccountIds : accountStore.accounts.map(a => a.id);

    relevantAccountIds.forEach(accId => {
      const accountTxs = transactionCache.getAccountTransactions(accId, year, month);
      accountBalances[accId] = accountTxs.reduce((sum, tx) => sum + tx.amount, 0);
    });

    // 2. Kategoriesalden berechnen (mit Cache-Optimierung)
    const categoryBalances: Record<string, number> = existingBalance?.categoryBalances || {};
    const relevantCategoryIds = changedCategoryIds.length > 0 ? changedCategoryIds : categoryStore.categories.map(c => c.id);

    relevantCategoryIds.forEach(catId => {
      const categoryTxs = transactionCache.getCategoryTransactions(catId, year, month);
      categoryBalances[catId] = categoryTxs.reduce((sum, tx) => sum + tx.amount, 0);
    });

    // 4. Projizierte Salden = aktuelle Salden
    const projectedAccountBalances = { ...accountBalances };
    const projectedCategoryBalances = { ...categoryBalances };

    // 5. Vormonatswerte holen (oder Null-Fallback)
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const prevMb = mbStore.getMonthlyBalance(prevYear, prevMonth) || {
      accountBalances: {} as Record<string, number>,
      categoryBalances: {} as Record<string, number>,
      projectedAccountBalances: {} as Record<string, number>,
      projectedCategoryBalances: {} as Record<string, number>
    };

    // 6. Kategorie-Projektion - nur für geänderte Kategorien
    relevantCategoryIds.forEach(catId => {
      const plannedAmount = planningStore.planningTransactions
        .filter(pt => pt.isActive && pt.categoryId === catId)
        .reduce((sum, pt) => {
          const occ = PlanningService
            .calculateNextOccurrences(pt, startDateStr, endDateStr)
            .length;
          return sum + pt.amount * occ;
        }, 0);

      const prevRaw = prevMb.categoryBalances[catId] ?? 0;
      const prevProj = prevMb.projectedCategoryBalances[catId] ?? 0;
      const currentRaw = categoryBalances[catId] ?? 0;

      projectedCategoryBalances[catId] =
        prevProj + (currentRaw - prevRaw) + plannedAmount;
    });

    // 7. Konto-Projektion - nur für geänderte Konten
    relevantAccountIds.forEach(accId => {
      if (projectedAccountBalances[accId] !== undefined) {
        const plannedAmount = planningStore.planningTransactions
          .filter(pt =>
            pt.isActive &&
            pt.accountId === accId &&
            pt.transactionType !== TransactionType.CATEGORYTRANSFER
          )
          .reduce((sum, pt) => {
            const occ = PlanningService
              .calculateNextOccurrences(pt, startDateStr, endDateStr)
              .length;
            return sum + pt.amount * occ;
          }, 0);

        const prevRaw = prevMb.accountBalances[accId] ?? 0;
        const prevProj = prevMb.projectedAccountBalances[accId] ?? 0;
        const currentRaw = accountBalances[accId] ?? 0;

        projectedAccountBalances[accId] =
          prevProj + (currentRaw - prevRaw) + plannedAmount;
      }
    });

    // 8. Ergebnis zurückgeben
    return {
      accountBalances,
      categoryBalances,
      projectedAccountBalances,
      projectedCategoryBalances
    };
  },

  /**
   * Liefert den aktuellen Saldo eines Kontos/Kategorie zum Stichtag (default = heute).
   * Berücksichtigt nur Transaktionen bis zum angegebenen Datum.
   *
   * @param entityType - Typ der Entität ('account' oder 'category')
   * @param id - ID der Entität
   * @param asOf - Stichtag (optional, default = heute)
   */
  getTodayBalance(entityType: EntityType, id: string, asOf: Date = new Date()): number {
    const mbStore = useMonthlyBalanceStore();
    const year = asOf.getFullYear();
    const month = asOf.getMonth();
    const mb = mbStore.getMonthlyBalance(year, month);

    // Wenn die Monatsbilanz existiert, den Wert aus der Bilanz zurückgeben
    if (mb) {
      if (entityType === 'account' && mb.accountBalances[id] !== undefined) {
        return mb.accountBalances[id];
      } else if (entityType === 'category' && mb.categoryBalances[id] !== undefined) {
        return mb.categoryBalances[id];
      }
    }

    // Fallback: Balance neu berechnen (mit Cache-Optimierung)
    const dateStr = toDateOnlyString(asOf);

    if (entityType === 'account') {
      // Für Konten: Verwende Cache für bessere Performance
      const accountTxs = transactionCache.getAccountTransactions(id, year, month);
      return accountTxs
        .filter(tx => toDateOnlyString(tx.date) <= dateStr)
        .reduce((sum, tx) => sum + tx.amount, 0);
    } else {
      // Für Kategorien: Verwende Cache für bessere Performance
      const categoryTxs = transactionCache.getCategoryTransactions(id, year, month);
      return categoryTxs
        .filter(tx => toDateOnlyString(tx.valueDate) <= dateStr)
        .reduce((sum, tx) => sum + tx.amount, 0);
    }
  },

  /**
   * Liefert den projizierten Saldo eines Kontos/Kategorie zum Stichtag (default = heute).
   * Berücksichtigt auch zukünftige geplante Transaktionen.
   *
   * @param entityType - Typ der Entität ('account' oder 'category')
   * @param id - ID der Entität
   * @param asOf - Stichtag (optional, default = heute)
   */
  getProjectedBalance(entityType: EntityType, id: string, asOf: Date = new Date()): number {
    const mbStore = useMonthlyBalanceStore();
    const year = asOf.getFullYear();
    const month = asOf.getMonth();
    const mb = mbStore.getMonthlyBalance(year, month);

    if (mb) {
      if (entityType === 'account' && mb.projectedAccountBalances[id] !== undefined) {
        return mb.projectedAccountBalances[id];
      } else if (entityType === 'category' && mb.projectedCategoryBalances[id] !== undefined) {
        return mb.projectedCategoryBalances[id];
      }
    }

    // Fallback: Verwende die aktuelle Bilanz, wenn keine Projektion verfügbar ist
    return this.getTodayBalance(entityType, id, asOf);
  },

  /**
   * Berechnet laufende Salden für ein Konto oder eine Kategorie über einen Zeitraum.
   *
   * @param entityType - Typ der Entität ('account' oder 'category')
   * @param id - ID der Entität
   * @param range - Zeitraum [startDate, endDate]
   * @param options - Optionen wie includeProjection
   */
  getRunningBalances(
    entityType: EntityType,
    id: string,
    range: [Date, Date],
    options: { includeProjection?: boolean } = {}
  ): RunningBalance[] {
    const txStore = useTransactionStore();
    const planStore = usePlanningStore();
    const [startDate, endDate] = range;
    const startStr = toDateOnlyString(startDate);
    const endStr = toDateOnlyString(endDate);

    // 1. Relevante Transaktionen filtern - WICHTIG: date vs. valueDate unterscheiden
    const transactions = txStore.transactions.filter(tx => {
      const txDate = toDateOnlyString(entityType === 'account' ? tx.date : tx.valueDate);
      return txDate >= startStr && txDate <= endStr &&
        (entityType === 'account'
          ? tx.accountId === id && tx.type !== TransactionType.CATEGORYTRANSFER
          : tx.categoryId === id);
    });

    // 2. Transaktionen nach dem richtigen Datum sortieren
    // 2. Transaktionen nach dem richtigen Datum und der Erstellungszeit sortieren
    const sortedTxs = [...transactions].sort((a, b) => {
      const dateA = toDateOnlyString(entityType === 'account' ? a.date : a.valueDate);
      const dateB = toDateOnlyString(entityType === 'account' ? b.date : b.valueDate);

      // Primär nach Datum sortieren
      const dateComparison = dateA.localeCompare(dateB);
      if (dateComparison !== 0) {
        return dateComparison;
      }

      // Sekundär nach Erstellungszeit für korrekte Reihenfolge am selben Tag
      const createdA = a.createdAt || '1970-01-01T00:00:00.000Z';
      const createdB = b.createdAt || '1970-01-01T00:00:00.000Z';
      return createdA.localeCompare(createdB);
    });

    // 3. Startsaldo berechnen
    const prevDay = new Date(startDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const startBalance = this.getTodayBalance(entityType, id, prevDay);

    // 4. Laufende Salden berechnen
    let runningBalance = startBalance;
    const balances: RunningBalance[] = [];

    // Set für bereits berücksichtigte Daten
    const processedDates = new Set<string>();

    // Für jeden Tag im Zeitraum einen Eintrag erstellen
    let current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isSameOrBefore(end)) {
      const currentDateStr = toDateOnlyString(current.toDate());
      processedDates.add(currentDateStr);

      // Transaktionen dieses Tages finden und aufsummieren
      const dayTxs = sortedTxs.filter(tx => {
        const txDate = toDateOnlyString(entityType === 'account' ? tx.date : tx.valueDate);
        return txDate === currentDateStr;
      });

      // Tagesbetrag berechnen - KORRIGIERT
      const dayAmount = dayTxs.reduce((sum, tx) => sum + tx.amount, 0);

      runningBalance += dayAmount;

      // 5. Wenn gewünscht, Prognosen berechnen
      let projected = undefined;

      if (options.includeProjection) {
        projected = runningBalance;

        // Prognosetransaktionen für diesen Tag ermitteln - NUR AKTIVE PLANBUCHUNGEN
        const planTxs = planStore.planningTransactions.filter(plan => {
          if (!plan.isActive) return false;

          const occurrences = PlanningService.calculateNextOccurrences(
            plan, currentDateStr, currentDateStr
          );

          if (occurrences.length === 0) return false;

          // Prüfen, ob die Entität betroffen ist
          return entityType === 'account'
            ? plan.accountId === id && plan.transactionType !== TransactionType.CATEGORYTRANSFER
            : plan.categoryId === id;
        });

        // Prognosebetrag berechnen - KORRIGIERT
        const planAmount = planTxs.reduce((sum, plan) => sum + plan.amount, 0);
        projected += planAmount;
      }

      balances.push({
        date: currentDateStr,
        balance: runningBalance,
        ...(options.includeProjection ? { projected } : {})
      });

      current = current.add(1, 'day');
    }

    return balances;
  },

  /**
   * Liefert die monatlichen Salden für ein Konto oder eine Kategorie über einen Zeitraum.
   *
   * @param entityType - Typ der Entität ('account' oder 'category')
   * @param id - ID der Entität
   * @param range - Zeitraum [startDate, endDate]
   * @param options - Optionen wie includeProjection
   */
  getMonthlyBalances(
    entityType: EntityType,
    id: string,
    range: [Date, Date],
    options: { includeProjection?: boolean } = { includeProjection: true }
  ): MonthlyBalanceResult[] {
    const mbStore = useMonthlyBalanceStore();
    const [start, end] = range;

    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    const result: MonthlyBalanceResult[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 0;
      const monthEnd = year === endYear ? endMonth : 11;

      for (let month = monthStart; month <= monthEnd; month++) {
        const mb = mbStore.getMonthlyBalance(year, month);

        let balance = 0;
        let projected = undefined;

        if (mb) {
          if (entityType === 'account') {
            balance = mb.accountBalances[id] || 0;
            if (options.includeProjection) {
              projected = mb.projectedAccountBalances[id] || 0;
            }
          } else {
            balance = mb.categoryBalances[id] || 0;
            if (options.includeProjection) {
              projected = mb.projectedCategoryBalances[id] || 0;
            }
          }
        } else {
          // Fallback: Berechne den Saldo am Ende des Monats
          const date = new Date(year, month + 1, 0); // Letzter Tag des Monats
          balance = this.getTodayBalance(entityType, id, date);
          if (options.includeProjection) {
            projected = this.getProjectedBalance(entityType, id, date);
          }
        }

        result.push({
          year,
          month,
          balance,
          ...(options.includeProjection ? { projected } : {})
        });
      }
    }

    return result;
  },

  /**
   * Liefert den letzten persistierten Saldo vor einem Datum
   *
   * @param entityType - Typ der Entität ('account' oder 'category')
   * @param id - ID der Entität
   * @param asOf - Stichtag
   */
  getPreviousPersistedBalance(entityType: EntityType, id: string, asOf: Date): BalanceInfo | null {
    const mbStore = useMonthlyBalanceStore();
    const targetYear = asOf.getFullYear();
    const targetMonth = asOf.getMonth();

    // Alle Monatsbilanzen vor dem Zieldatum
    const balances = mbStore.getAllMonthlyBalances()
      .filter(mb => mb.year < targetYear || (mb.year === targetYear && mb.month < targetMonth))
      .sort((a, b) => b.year - a.year || b.month - a.month);

    for (const mb of balances) {
      if (entityType === 'account' && mb.accountBalances[id] !== undefined) {
        return {
          balance: mb.accountBalances[id],
          date: new Date(mb.year, mb.month, 1)
        };
      } else if (entityType === 'category' && mb.categoryBalances[id] !== undefined) {
        return {
          balance: mb.categoryBalances[id],
          date: new Date(mb.year, mb.month, 1)
        };
      }
    }

    return null;
  },

  /**
   * Liefert den Gesamtsaldo aller Konten einer bestimmten Gruppe
   *
   * @param groupId - ID der Kontogruppe
   * @param asOf - Stichtag
   * @param includeProjection - Ob Prognosen berücksichtigt werden sollen
   */
  getAccountGroupBalance(groupId: string, asOf: Date = new Date(), includeProjection: boolean = false): number {
    const accountStore = useAccountStore();
    const groupAccounts = accountStore.accounts.filter(
      a => a.accountGroupId === groupId && a.isActive && !a.isOfflineBudget
    );

    return groupAccounts.reduce((sum, account) => {
      if (includeProjection) {
        return sum + this.getProjectedBalance('account', account.id, asOf);
      } else {
        return sum + this.getTodayBalance('account', account.id, asOf);
      }
    }, 0);
  },

  /**
   * Liefert den Gesamtsaldo aller aktiven Konten
   */
  getTotalBalance(asOf: Date = new Date(), includeProjection: boolean = false): number {
    const accountStore = useAccountStore();
    return accountStore.activeAccounts
      .filter(a => !a.isOfflineBudget)
      .reduce((sum, a) => {
        if (includeProjection) {
          return sum + this.getProjectedBalance('account', a.id, asOf);
        } else {
          return sum + this.getTodayBalance('account', a.id, asOf);
        }
      }, 0);
  },


  /**
   * Berechnet den Saldo einer Kategorie mit ihren Kindern
   */
  getCategoryWithChildrenBalance(categoryId: string, asOf: Date = new Date(), includeProjection: boolean = false): number {
    const categoryStore = useCategoryStore();
    const category = categoryStore.getCategoryById(categoryId);
    if (!category) return 0;

    const categoryBalance = includeProjection
      ? this.getProjectedBalance('category', categoryId, asOf)
      : this.getTodayBalance('category', categoryId, asOf);

    // Kinder rekursiv
    const childrenIds = categoryStore.categories
      .filter(c => c.parentCategoryId === categoryId && c.isActive)
      .map(c => c.id);

    const childrenBalance = childrenIds.reduce((sum, childId) => {
      return sum + this.getCategoryWithChildrenBalance(childId, asOf, includeProjection);
    }, 0);

    return categoryBalance + childrenBalance;
  },

  /**
   * Gruppiert Transaktionen eines Kontos nach Datum und berechnet den
   * laufenden Saldo je Gruppe für die Anzeige in Kontolisten.
   *
   * @param transactions - Liste aller Transaktionen
   * @param account - Konto, für das die Gruppierung erfolgen soll
   * @returns Array von Gruppen mit Transaktionen und laufendem Saldo
   */
  getTransactionsGroupedByDate(
    transactions: Transaction[],
    account: any
  ): Array<{ date: string; transactions: Transaction[]; runningBalance: number }> {
    const offset = account.offset || 0;
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    // 1. Transaktionen für das Konto filtern und chronologisch sortieren
    const filteredTransactions = transactions
      .filter(tx => tx.accountId === account.id && tx.type !== TransactionType.CATEGORYTRANSFER)
      .sort((a, b) => {
        // Primär nach Datum sortieren (aufsteigend für Berechnung)
        const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison !== 0) {
          return dateComparison;
        }
        // Sekundär nach createdAt sortieren für korrekte Reihenfolge am selben Tag
        const createdA = a.createdAt || '1970-01-01T00:00:00.000Z';
        const createdB = b.createdAt || '1970-01-01T00:00:00.000Z';
        return createdA.localeCompare(createdB);
      });

    // 2. Nach Datum gruppieren
    const groups = filteredTransactions.reduce((acc, tx) => {
      const key = tx.date.split("T")[0];
      if (!acc[key]) {
        acc[key] = { date: key, transactions: [] as Transaction[] };
      }
      acc[key].transactions.push(tx);
      return acc;
    }, {} as Record<string, { date: string; transactions: Transaction[] }>);

    // 3. Chronologisch sortierte Gruppen erstellen
    const sortedGroups = Object.values(groups)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Running Balance chronologisch berechnen
    let runningBalance = 0;

    // Startsaldo berechnen (alle Transaktionen vor der ersten Gruppe)
    if (sortedGroups.length > 0) {
      const firstDate = new Date(sortedGroups[0].date);
      const dayBefore = new Date(firstDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      runningBalance = this.getTodayBalance('account', account.id, dayBefore);
    }

    // 5. Für jede Gruppe den Running Balance berechnen
    const groupsWithBalance = sortedGroups.map(group => {
      // Transaktionen dieser Gruppe zum Running Balance addieren
      const dayAmount = group.transactions.reduce((sum, tx) => sum + tx.amount, 0);
      runningBalance += dayAmount;

      // Offset anwenden falls nötig
      const date = new Date(group.date);
      const applyOffset = date.getTime() >= firstOfMonth ? offset : 0;
      const displayBalance = runningBalance - applyOffset;

      return {
        ...group,
        runningBalance: displayBalance
      };
    });

    // 6. Für Anzeige nach Datum absteigend sortieren (neueste zuerst)
    return groupsWithBalance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  /**
   * Erweiterte Sortierlogik für Transaktionen
   * Sortiert nach valueDate, dann nach created_at für korrekte Reihenfolge innerhalb eines Tages
   * WICHTIG: created_at statt updated_at verwenden, um Race Conditions zu vermeiden
   */
  sortTransactionsForRunningBalance(transactions: any[]): any[] {
    return [...transactions].sort((a, b) => {
      // Primär nach valueDate sortieren (aufsteigend für Berechnung)
      const dateA = toDateOnlyString(a.valueDate || a.date);
      const dateB = toDateOnlyString(b.valueDate || b.date);
      const dateComparison = dateA.localeCompare(dateB);

      if (dateComparison !== 0) {
        return dateComparison;
      }

      // Sekundär nach createdAt sortieren für korrekte Reihenfolge am gleichen Tag
      const createdA = a.createdAt || '1970-01-01T00:00:00.000Z';
      const createdB = b.createdAt || '1970-01-01T00:00:00.000Z';
      return createdA.localeCompare(createdB);
    });
  },

  /**
   * Berechnet running balances für alle Transaktionen eines Kontos neu
   * WICHTIG: Berechnet IMMER alle Transaktionen des Kontos neu, da eine neue Transaktion
   * mit älterem valueDate alle nachfolgenden runningBalance-Werte beeinflusst
   *
   * @param accountId - ID des Kontos
   * @param fromDate - Startdatum für Neuberechnung (optional, default = älteste Transaktion)
   * @returns Promise<void>
   */
  async recalculateRunningBalancesForAccount(accountId: string, fromDate?: Date): Promise<void> {
    debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Start', { accountId, fromDate });

    const txStore = useTransactionStore();
    const accountStore = useAccountStore();

    // Alle Transaktionen des Kontos holen (außer CATEGORYTRANSFER)
    const accountTransactions = txStore.transactions.filter(tx =>
      tx.accountId === accountId && tx.type !== TransactionType.CATEGORYTRANSFER
    );

    if (accountTransactions.length === 0) {
      debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Keine Transaktionen gefunden', { accountId });
      return;
    }

    // KORRIGIERT: Sortierung nach date (nicht valueDate) für Kontosalden
    // WICHTIG: Für Running Balance-Berechnung IMMER aufsteigend sortieren (älteste zuerst)
    // Primär nach date, sekundär nach createdAt für korrekte Reihenfolge
    const sortedTransactions = [...accountTransactions].sort((a, b) => {
      const dateA = toDateOnlyString(a.date);
      const dateB = toDateOnlyString(b.date);
      const dateComparison = dateA.localeCompare(dateB); // IMMER aufsteigend für Berechnung

      if (dateComparison !== 0) {
        return dateComparison;
      }

      // Sekundär nach createdAt sortieren für korrekte Reihenfolge am gleichen Tag
      const createdA = (a as any).createdAt || '1970-01-01T00:00:00.000Z';
      const createdB = (b as any).createdAt || '1970-01-01T00:00:00.000Z';
      return createdA.localeCompare(createdB); // IMMER aufsteigend für Berechnung
    });

    // Startdatum bestimmen
    let startDate = fromDate;
    if (!startDate && sortedTransactions.length > 0) {
      const firstTxDate = toDateOnlyString(sortedTransactions[0].date);
      startDate = new Date(firstTxDate);
    }

    if (!startDate) {
      debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Kein Startdatum bestimmbar', { accountId });
      return;
    }

    // KORRIGIERT: Startsaldo-Berechnung - IMMER von Grund auf neu berechnen
    let runningBalance = 0;

    if (fromDate) {
      // Explizites fromDate - Berechne Startsaldo durch Summierung ALLER Transaktionen vor fromDate
      const dayBefore = new Date(fromDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dateStrBefore = toDateOnlyString(dayBefore);

      // Finde alle Transaktionen vor dem fromDate (sortiert)
      const txsBeforeDate = sortedTransactions.filter(tx =>
        toDateOnlyString(tx.date) <= dateStrBefore
      );

      // WICHTIG: Berechne Startsaldo durch Summierung aller Beträge (nicht runningBalance verwenden!)
      runningBalance = txsBeforeDate.reduce((sum, tx) => sum + tx.amount, 0);

      debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Startsaldo durch vollständige Summierung berechnet', {
        accountId,
        transactionsBeforeDate: txsBeforeDate.length,
        calculatedBalance: runningBalance,
        fromDate: toDateOnlyString(fromDate),
        dayBefore: dateStrBefore
      });
    } else {
      // Kein fromDate - beginne bei 0 (älteste Transaktion)
      debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Kein fromDate, Startsaldo = 0', { accountId });
    }

    // Rundung auf 2 Dezimalstellen für Startsaldo
    runningBalance = Math.round(runningBalance * 100) / 100;

    debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Startsaldo berechnet', {
      accountId,
      startDate: toDateOnlyString(startDate),
      startBalance: runningBalance
    });

    // Running balances für alle Transaktionen ab Startdatum berechnen
    const transactionsToUpdate: { id: string; runningBalance: number }[] = [];

    for (const tx of sortedTransactions) {
      const txDate = toDateOnlyString(tx.date);

      // Nur Transaktionen ab Startdatum berücksichtigen
      if (txDate >= toDateOnlyString(startDate)) {
        runningBalance += tx.amount;
        // Rundung auf 2 Dezimalstellen
        runningBalance = Math.round(runningBalance * 100) / 100;

        transactionsToUpdate.push({
          id: tx.id,
          runningBalance: runningBalance
        });

        debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Transaktion verarbeitet', {
          txId: tx.id,
          date: txDate,
          amount: tx.amount,
          previousBalance: runningBalance - tx.amount,
          newRunningBalance: runningBalance
        });
      }
    }

    if (transactionsToUpdate.length === 0) {
      debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Keine Transaktionen zu aktualisieren', {
        accountId,
        startDate: toDateOnlyString(startDate),
        totalTransactions: sortedTransactions.length
      });
      return;
    }

    // Batch-Update der running balances im Store
    await this.batchUpdateRunningBalances(transactionsToUpdate);

    debugLog('BalanceService', 'recalculateRunningBalancesForAccount - Abgeschlossen', {
      accountId,
      updatedTransactions: transactionsToUpdate.length
    });
  },

  /**
   * Berechnet running balances für alle Konten neu
   * Wird nach CSV-Imports aufgerufen
   */
  async recalculateAllRunningBalances(): Promise<void> {
    debugLog('BalanceService', 'recalculateAllRunningBalances - Start');

    const accountStore = useAccountStore();
    const activeAccounts = accountStore.accounts.filter(acc => acc.isActive);

    // Sequenziell alle Konten abarbeiten
    for (const account of activeAccounts) {
      await this.recalculateRunningBalancesForAccount(account.id);
    }

    debugLog('BalanceService', 'recalculateAllRunningBalances - Abgeschlossen', {
      processedAccounts: activeAccounts.length
    });
  },

  /**
   * HOCHOPTIMIERTE Batch-Update für running balances
   * Aktualisiert ALLE Running Balances in einem einzigen Vorgang ohne einzelne Store-Updates
   */
  async batchUpdateRunningBalances(updates: { id: string; runningBalance: number }[]): Promise<void> {
    if (updates.length === 0) {
      return;
    }

    const txStore = useTransactionStore();

    debugLog('BalanceService', 'batchUpdateRunningBalances - HOCHOPTIMIERT Start', {
      updateCount: updates.length
    });

    // Aktiviere Batch-Modus für Performance-Optimierung
    txStore.startBatchUpdate();

    try {
      // KRITISCH: Alle Updates direkt im Store-Array vornehmen (ohne einzelne updateTransaction Aufrufe)
      const updateMap = new Map(updates.map(u => [u.id, u.runningBalance]));

      // Direkte Manipulation des Store-Arrays für maximale Performance
      for (let i = 0; i < txStore.transactions.length; i++) {
        const transaction = txStore.transactions[i];
        const newRunningBalance = updateMap.get(transaction.id);

        if (newRunningBalance !== undefined) {
          // Direkte Zuweisung ohne Store-Methoden für maximale Performance
          txStore.transactions[i] = {
            ...transaction,
            runningBalance: newRunningBalance,
            updated_at: new Date().toISOString()
          };
        }
      }

      // Batch-Update in IndexedDB (alle auf einmal)
      await this.batchUpdateRunningBalancesInDB(updates);

      debugLog('BalanceService', 'batchUpdateRunningBalances - HOCHOPTIMIERT Alle Updates verarbeitet', {
        updatedCount: updates.length
      });

    } finally {
      // Batch-Modus beenden und finale UI-Updates triggern
      txStore.endBatchUpdate();
    }

    debugLog('BalanceService', 'batchUpdateRunningBalances - HOCHOPTIMIERT Abgeschlossen', {
      updatedCount: updates.length
    });
  },

  /**
   * Batch-Update direkt in IndexedDB für maximale Performance
   */
  async batchUpdateRunningBalancesInDB(updates: { id: string; runningBalance: number }[]): Promise<void> {
    const { TenantDbService } = await import('@/services/TenantDbService');
    const tenantDbService = new TenantDbService();

    try {
      debugLog('BalanceService', 'batchUpdateRunningBalancesInDB - OPTIMIERT Start', {
        updateCount: updates.length
      });

      // OPTIMIERT: Bulk-Read aller betroffenen Transaktionen
      const transactionIds = updates.map(u => u.id);
      const transactions = await tenantDbService.getTransactionsByIds(transactionIds);

      if (transactions.length === 0) {
        debugLog('BalanceService', 'batchUpdateRunningBalancesInDB - Keine Transaktionen gefunden');
        return;
      }

      // OPTIMIERT: Erstelle Update-Map für schnelle Zuordnung
      const updateMap = new Map(updates.map(u => [u.id, u.runningBalance]));
      const timestamp = new Date().toISOString();

      // OPTIMIERT: Bereite alle Updates vor
      const updatedTransactions: ExtendedTransaction[] = [];

      for (const transaction of transactions) {
        const newRunningBalance = updateMap.get(transaction.id);
        if (newRunningBalance !== undefined) {
          updatedTransactions.push({
            ...transaction,
            runningBalance: newRunningBalance,
            updated_at: timestamp
          });
        }
      }

      if (updatedTransactions.length === 0) {
        debugLog('BalanceService', 'batchUpdateRunningBalancesInDB - Keine Updates erforderlich');
        return;
      }

      // OPTIMIERT: Bulk-Update in einer einzigen IndexedDB-Transaktion
      await tenantDbService.bulkUpdateTransactions(updatedTransactions);

      debugLog('BalanceService', 'batchUpdateRunningBalancesInDB - OPTIMIERT Abgeschlossen', {
        updatedCount: updatedTransactions.length,
        performanceGain: `${updates.length} einzelne DB-Operationen → 1 Bulk-Operation`
      });

    } catch (error) {
      debugLog('BalanceService', 'batchUpdateRunningBalancesInDB - Fehler', error);

      // Fallback: Einzelne Updates bei Bulk-Fehler
      debugLog('BalanceService', 'batchUpdateRunningBalancesInDB - Fallback auf einzelne Updates');
      const updatePromises = updates.map(async (update) => {
        try {
          const transaction = await tenantDbService.getTransactionById(update.id);
          if (transaction) {
            const updatedTransaction = {
              ...transaction,
              runningBalance: update.runningBalance,
              updated_at: new Date().toISOString()
            };
            return tenantDbService.updateTransaction(updatedTransaction);
          }
        } catch (singleError) {
          debugLog('BalanceService', `Fehler bei einzelnem Running Balance Update für ${update.id}`, singleError);
        }
      });

      await Promise.all(updatePromises);
    }
  },

  /**
   * Neue optimierte Methode: Ersetzt triggerRunningBalanceRecalculation
   * Verwendet Queue-System für Batch-Verarbeitung mit Debouncing
   */
  enqueueRunningBalanceRecalculation(accountId: string, changedTransactionDate?: string): void {
    debugLog('BalanceService', 'enqueueRunningBalanceRecalculation', {
      accountId,
      changedTransactionDate
    });

    // Füge Account zur optimierten Queue hinzu
    runningBalanceQueue.enqueueAccount(accountId, changedTransactionDate);
  },

  /**
   * Legacy-Methode für Rückwärtskompatibilität
   * @deprecated Verwende stattdessen enqueueRunningBalanceRecalculation
   */
  async triggerRunningBalanceRecalculation(accountId: string, changedTransactionDate?: string): Promise<void> {
    debugLog('BalanceService', 'triggerRunningBalanceRecalculation (deprecated)', { accountId, changedTransactionDate });

    // Leite an neue optimierte Methode weiter
    this.enqueueRunningBalanceRecalculation(accountId, changedTransactionDate);
  },

  /**
   * Erzwingt sofortige Verarbeitung der Queue (für Tests oder kritische Operationen)
   */
  async forceProcessRunningBalanceQueue(): Promise<void> {
    debugLog('BalanceService', 'forceProcessRunningBalanceQueue - Erzwinge sofortige Verarbeitung');
    await runningBalanceQueue.forceProcess();
  },

  /**
   * Prüft ob gerade Running Balance Berechnungen laufen
   */
  isRunningBalanceProcessing(): boolean {
    return runningBalanceQueue.isCurrentlyProcessing();
  },

  /**
   * Berechnet die Summe aller budgetierten Ausgabenkategorien für einen Monat
   * @param monthStart - Startdatum des Monats
   * @param monthEnd - Enddatum des Monats
   * @returns Summe der budgetierten Beträge aller Ausgabenkategorien
   */
  getTotalBudgetedForMonth(monthStart: Date, monthEnd: Date): number {
    const categoryStore = useCategoryStore();
    const transactionStore = useTransactionStore();

    // Hole alle aktiven Ausgabenkategorien (ohne "Verfügbare Mittel")
    const expenseCategories = categoryStore.categories.filter(cat =>
      cat.isActive &&
      !cat.isIncomeCategory &&
      cat.name.trim().toLowerCase() !== "verfügbare mittel"
    );

    let totalBudgeted = 0;

    // Berechne für jede Ausgabenkategorie die budgetierten Beträge (CATEGORYTRANSFER)
    for (const category of expenseCategories) {
      const categoryTransfers = transactionStore.transactions.filter(tx => {
        const txDate = new Date(toDateOnlyString(tx.valueDate));
        return (
          tx.type === TransactionType.CATEGORYTRANSFER &&
          tx.categoryId === category.id &&
          txDate >= monthStart &&
          txDate <= monthEnd
        );
      });

      const categoryBudget = categoryTransfers.reduce((sum, tx) => sum + tx.amount, 0);
      totalBudgeted += categoryBudget;

      // Berücksichtige auch Kindkategorien rekursiv
      const childCategories = categoryStore.getChildCategories(category.id);
      for (const child of childCategories) {
        if (child.isActive) {
          const childTransfers = transactionStore.transactions.filter(tx => {
            const txDate = new Date(toDateOnlyString(tx.valueDate));
            return (
              tx.type === TransactionType.CATEGORYTRANSFER &&
              tx.categoryId === child.id &&
              txDate >= monthStart &&
              txDate <= monthEnd
            );
          });

          const childBudget = childTransfers.reduce((sum, tx) => sum + tx.amount, 0);
          totalBudgeted += childBudget;
        }
      }
    }

    debugLog('BalanceService', 'getTotalBudgetedForMonth', {
      monthStart: monthStart.toISOString().split('T')[0],
      monthEnd: monthEnd.toISOString().split('T')[0],
      totalBudgeted,
      categoriesProcessed: expenseCategories.length
    });

    return totalBudgeted;
  },

  /**
   * Leert den Transaction Cache (für Debugging oder bei größeren Datenänderungen)
   */
  clearTransactionCache(): void {
    transactionCache.clear();
    debugLog('BalanceService', 'Transaction Cache vollständig geleert');
  },

  /**
   * Invalidiert den Cache für den aktuellen Monat
   * Stellt sicher, dass Charts immer aktuelle Daten anzeigen
   */
  invalidateCurrentMonthCache(): void {
    transactionCache.invalidateCurrentMonth();
    debugLog('BalanceService', 'Cache für aktuellen Monat invalidiert');
  }
};
