// src/services/BalanceService.ts
import { useTransactionStore } from '@/stores/transactionStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useMonthlyBalanceStore, MonthlyBalance } from '@/stores/monthlyBalanceStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { TransactionType, BalanceInfo } from '@/types';
import { toDateOnlyString } from '@/utils/formatters';
import { PlanningService } from './PlanningService';
import { debugLog } from '@/utils/logger';
import dayjs from 'dayjs';

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
   * Berechnet alle Monatsbilanzen und speichert sie im Store.
   * Diese Methode sollte aufgerufen werden, wenn sich Transaktionen oder Planungen ändern.
   */
  calculateMonthlyBalances(): void {
    debugLog('[BalanceService] calculateMonthlyBalances - Start calculation');

    const transactionStore = useTransactionStore();
    const mbStore = useMonthlyBalanceStore();

    // 1. Sammle alle relevanten Monate
    const months: Set<string> = new Set();

    if (transactionStore.transactions && transactionStore.transactions.length > 0) {
      transactionStore.transactions.forEach(tx => {
        const date = new Date(tx.date);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        months.add(key);

        // Für Kategorietransaktionen auch das ValueDate berücksichtigen
        if (tx.type === TransactionType.CATEGORYTRANSFER || tx.categoryId) {
          const valueDate = new Date(tx.valueDate);
          const valueDateKey = `${valueDate.getFullYear()}-${valueDate.getMonth()}`;
          months.add(valueDateKey);
        }
      });
    } else {
      debugLog('[BalanceService] Keine Transaktionen gefunden - Erstelle nur Zukunftsmonate');
    }

    // 2. Füge die nächsten 24 Monate hinzu
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      months.add(key);
    }

    // 3. Berechne alle Monatsbilanzen
    Array.from(months).sort().forEach(key => {
      const [year, month] = key.split('-').map(Number);
      const balanceData = this.calculateBalanceForMonth(year, month);
      mbStore.setMonthlyBalance(year, month, balanceData);
    });

    // 4. Speichere die Ergebnisse
    mbStore.saveMonthlyBalances();

    debugLog('[BalanceService] calculateMonthlyBalances - Calculated balances for', months.size, 'months');
  },

    /**
   * Berechnet die Bilanz für einen bestimmten Monat
   */
  calculateBalanceForMonth(year: number, month: number): Omit<MonthlyBalance, 'year' | 'month'> {
    const startDate = new Date(year, month, 1);
    const endDate   = new Date(year, month + 1, 0);
    const startDateStr = toDateOnlyString(startDate);
    const endDateStr   = toDateOnlyString(endDate);

    const transactionStore    = useTransactionStore();
    const accountStore        = useAccountStore();
    const categoryStore       = useCategoryStore();
    const planningStore       = usePlanningStore();
    const mbStore             = useMonthlyBalanceStore();

    // 1. Transaktionen bis zum Monatsende finden
    const txsUntilEnd = transactionStore.transactions.filter(tx =>
      toDateOnlyString(tx.date)      <= endDateStr
    );
    const categoryTxsUntilEnd = transactionStore.transactions.filter(tx =>
      toDateOnlyString(tx.valueDate) <= endDateStr
    );

    // 2. Kontosalden berechnen
    const accountBalances: Record<string, number> = {};
    accountStore.accounts.forEach(acc => {
      accountBalances[acc.id] = txsUntilEnd
        .filter(tx => tx.accountId === acc.id && tx.type !== TransactionType.CATEGORYTRANSFER)
        .reduce((sum, tx) => sum + tx.amount, 0);
    });

    // 3. Kategoriesalden berechnen
    const categoryBalances: Record<string, number> = {};
    categoryStore.categories.forEach(cat => {
      categoryBalances[cat.id] = categoryTxsUntilEnd
        .filter(tx => tx.categoryId === cat.id)
        .reduce((sum, tx) => sum + tx.amount, 0);
    });

    // 4. Projizierte Salden = aktuelle Salden
    const projectedAccountBalances  = { ...accountBalances };
    const projectedCategoryBalances = { ...categoryBalances };

    // 5. Vormonatswerte holen (oder Null-Fallback)
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear  = month === 0 ? year - 1  : year;
    const prevMb = mbStore.getMonthlyBalance(prevYear, prevMonth) || {
      accountBalances:          {},
      categoryBalances:         {},
      projectedAccountBalances: {},
      projectedCategoryBalances:{}
    };

    // 6. Kategorie-Projektion
    categoryStore.categories.forEach(cat => {
      const plannedAmount = planningStore.planningTransactions
        .filter(pt => pt.isActive && pt.categoryId === cat.id)
        .reduce((sum, pt) => {
          const occ = PlanningService
            .calculateNextOccurrences(pt, startDateStr, endDateStr)
            .length;
          return sum + pt.amount * occ;
        }, 0);

      const prevRaw  = prevMb.categoryBalances[cat.id]           ?? 0;
      const prevProj = prevMb.projectedCategoryBalances[cat.id] ?? 0;
      const currentRaw = categoryBalances[cat.id]                ?? 0;

      projectedCategoryBalances[cat.id] =
        prevProj + (currentRaw - prevRaw) + plannedAmount;
    });

    // 7. Konto-Projektion
    Object.keys(prevMb.projectedAccountBalances).forEach(accId => {
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

        const prevRaw  = prevMb.accountBalances[accId]           ?? 0;
        const prevProj = prevMb.projectedAccountBalances[accId] ?? 0;
        const currentRaw = accountBalances[accId]               ?? 0;

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

    // Fallback: Balance neu berechnen
    const txStore = useTransactionStore();
    const dateStr = toDateOnlyString(asOf);

    if (entityType === 'account') {
      // Für Konten: Nach date filtern, CATEGORYTRANSFER ausschließen
      const txs = txStore.transactions.filter(
        tx => tx.accountId === id &&
             tx.type !== TransactionType.CATEGORYTRANSFER &&
             toDateOnlyString(tx.date) <= dateStr
      );
      return txs.reduce((sum, tx) => sum + tx.amount, 0);
    } else {
      // Für Kategorien: Nach valueDate filtern, nur direkte Kategoriezuordnungen berücksichtigen
      let balance = 0;
      txStore.transactions.forEach(tx => {
        if (toDateOnlyString(tx.valueDate) <= dateStr && tx.categoryId === id) {
          balance += tx.amount;
        }
      });
      return balance;
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
    const sortedTxs = [...transactions].sort((a, b) => {
      const dateA = toDateOnlyString(entityType === 'account' ? a.date : a.valueDate);
      const dateB = toDateOnlyString(entityType === 'account' ? b.date : b.valueDate);
      return dateA.localeCompare(dateB);
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

    // 1. Transaktionen für das Konto filtern und nach Datum sortieren
    const filteredTransactions = transactions
      .filter(tx => tx.accountId === account.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Nach Datum gruppieren
    const groups = filteredTransactions.reduce((acc, tx) => {
      const key = tx.date.split("T")[0];
      if (!acc[key]) {
        acc[key] = { date: key, transactions: [] as Transaction[] };
      }
      acc[key].transactions.push(tx);
      return acc;
    }, {} as Record<string, { date: string; transactions: Transaction[] }>);

    // 3. Saldo je Gruppe berechnen und Gruppen sortieren
    const finalGroups = Object.values(groups)
      .map(group => {
        // Korrekte Berechnung des laufenden Saldos für das Datum
        const date = new Date(group.date);
        const rawBalance = this.getTodayBalance('account', account.id, date);
        const applyOffset = date.getTime() >= firstOfMonth ? offset : 0;
        return {
          ...group,
          runningBalance: rawBalance - applyOffset
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return finalGroups;
  }
};
