import { MonthlyBalance } from '@/stores/monthlyBalanceStore';
import { BalanceInfo, Transaction } from '@/types';
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
export declare const BalanceService: {
    /**
     * Prüft, ob eine Neuberechnung der Monatsbilanzen erforderlich ist.
     * Wird beim Login verwendet, um unnötige Berechnungen zu vermeiden.
     */
    calculateMonthlyBalancesIfNeeded(): Promise<void>;
    /**
     * Backward-Compat Wrapper: viele Stellen rufen noch calculateMonthlyBalances() auf.
     * Delegiert auf calculateAllMonthlyBalances().
     */
    calculateMonthlyBalances(): Promise<void>;
    /**
     * Stößt die Neuberechnung der Monatsbilanzen über die Queue an.
     */
    triggerMonthlyBalanceUpdate(updates: {
        accountIds?: string[];
        categoryIds?: string[];
        fromDate: string;
    }): void;
    /**
     * Führt eine inkrementelle Aktualisierung der Monatsbilanzen durch.
     * Berechnet nur die betroffenen Entitäten ab einem bestimmten Datum neu.
     */
    updateMonthlyBalancesForChanges(updates: {
        accountIds?: string[];
        categoryIds?: string[];
        fromDate: string;
    }): Promise<void>;
    /**
     * Berechnet alle Monatsbilanzen und speichert sie im Store.
     * Wird für die Erstberechnung verwendet.
     */
    calculateAllMonthlyBalances(): Promise<void>;
    /**
   * Berechnet die Bilanz für einen bestimmten Monat
   */
    calculateBalanceForMonth(year: number, month: number, changedAccountIds?: string[], changedCategoryIds?: string[], existingBalance?: MonthlyBalance): Partial<Omit<MonthlyBalance, "year" | "month">>;
    /**
     * Liefert den aktuellen Saldo eines Kontos/Kategorie zum Stichtag (default = heute).
     * Berücksichtigt nur Transaktionen bis zum angegebenen Datum.
     *
     * @param entityType - Typ der Entität ('account' oder 'category')
     * @param id - ID der Entität
     * @param asOf - Stichtag (optional, default = heute)
     */
    getTodayBalance(entityType: EntityType, id: string, asOf?: Date): number;
    /**
     * Liefert den projizierten Saldo eines Kontos/Kategorie zum Stichtag (default = heute).
     * Berücksichtigt auch zukünftige geplante Transaktionen.
     *
     * @param entityType - Typ der Entität ('account' oder 'category')
     * @param id - ID der Entität
     * @param asOf - Stichtag (optional, default = heute)
     */
    getProjectedBalance(entityType: EntityType, id: string, asOf?: Date): number;
    /**
     * Berechnet laufende Salden für ein Konto oder eine Kategorie über einen Zeitraum.
     *
     * @param entityType - Typ der Entität ('account' oder 'category')
     * @param id - ID der Entität
     * @param range - Zeitraum [startDate, endDate]
     * @param options - Optionen wie includeProjection
     */
    getRunningBalances(entityType: EntityType, id: string, range: [Date, Date], options?: {
        includeProjection?: boolean;
    }): RunningBalance[];
    /**
     * Liefert die monatlichen Salden für ein Konto oder eine Kategorie über einen Zeitraum.
     *
     * @param entityType - Typ der Entität ('account' oder 'category')
     * @param id - ID der Entität
     * @param range - Zeitraum [startDate, endDate]
     * @param options - Optionen wie includeProjection
     */
    getMonthlyBalances(entityType: EntityType, id: string, range: [Date, Date], options?: {
        includeProjection?: boolean;
    }): MonthlyBalanceResult[];
    /**
     * Liefert den letzten persistierten Saldo vor einem Datum
     *
     * @param entityType - Typ der Entität ('account' oder 'category')
     * @param id - ID der Entität
     * @param asOf - Stichtag
     */
    getPreviousPersistedBalance(entityType: EntityType, id: string, asOf: Date): BalanceInfo | null;
    /**
     * Liefert den Gesamtsaldo aller Konten einer bestimmten Gruppe
     *
     * @param groupId - ID der Kontogruppe
     * @param asOf - Stichtag
     * @param includeProjection - Ob Prognosen berücksichtigt werden sollen
     */
    getAccountGroupBalance(groupId: string, asOf?: Date, includeProjection?: boolean): number;
    /**
     * Liefert den Gesamtsaldo aller aktiven Konten
     */
    getTotalBalance(asOf?: Date, includeProjection?: boolean): number;
    /**
     * Berechnet den Saldo einer Kategorie mit ihren Kindern
     */
    getCategoryWithChildrenBalance(categoryId: string, asOf?: Date, includeProjection?: boolean): number;
    /**
     * Gruppiert Transaktionen eines Kontos nach Datum und berechnet den
     * laufenden Saldo je Gruppe für die Anzeige in Kontolisten.
     *
     * @param transactions - Liste aller Transaktionen
     * @param account - Konto, für das die Gruppierung erfolgen soll
     * @returns Array von Gruppen mit Transaktionen und laufendem Saldo
     */
    getTransactionsGroupedByDate(transactions: Transaction[], account: any): Array<{
        date: string;
        transactions: Transaction[];
        runningBalance: number;
    }>;
    /**
     * Erweiterte Sortierlogik für Transaktionen
     * Sortiert nach valueDate, dann nach created_at für korrekte Reihenfolge innerhalb eines Tages
     * WICHTIG: created_at statt updated_at verwenden, um Race Conditions zu vermeiden
     */
    sortTransactionsForRunningBalance(transactions: any[]): any[];
    /**
     * Berechnet running balances für alle Transaktionen eines Kontos neu
     * WICHTIG: Berechnet IMMER alle Transaktionen des Kontos neu, da eine neue Transaktion
     * mit älterem valueDate alle nachfolgenden runningBalance-Werte beeinflusst
     *
     * @param accountId - ID des Kontos
     * @param fromDate - Startdatum für Neuberechnung (optional, default = älteste Transaktion)
     * @returns Promise<void>
     */
    recalculateRunningBalancesForAccount(accountId: string, fromDate?: Date): Promise<void>;
    /**
     * Berechnet running balances für alle Konten neu
     * Wird nach CSV-Imports aufgerufen
     */
    recalculateAllRunningBalances(): Promise<void>;
    /**
     * HOCHOPTIMIERTE Batch-Update für running balances
     * Aktualisiert ALLE Running Balances in einem einzigen Vorgang ohne einzelne Store-Updates
     */
    batchUpdateRunningBalances(updates: {
        id: string;
        runningBalance: number;
    }[]): Promise<void>;
    /**
     * Batch-Update direkt in IndexedDB für maximale Performance
     */
    batchUpdateRunningBalancesInDB(updates: {
        id: string;
        runningBalance: number;
    }[]): Promise<void>;
    /**
     * Neue optimierte Methode: Ersetzt triggerRunningBalanceRecalculation
     * Verwendet Queue-System für Batch-Verarbeitung mit Debouncing
     */
    enqueueRunningBalanceRecalculation(accountId: string, changedTransactionDate?: string): void;
    /**
     * Legacy-Methode für Rückwärtskompatibilität
     * @deprecated Verwende stattdessen enqueueRunningBalanceRecalculation
     */
    triggerRunningBalanceRecalculation(accountId: string, changedTransactionDate?: string): Promise<void>;
    /**
     * Erzwingt sofortige Verarbeitung der Queue (für Tests oder kritische Operationen)
     */
    forceProcessRunningBalanceQueue(): Promise<void>;
    /**
     * Prüft ob gerade Running Balance Berechnungen laufen
     */
    isRunningBalanceProcessing(): boolean;
    /**
     * Berechnet die Summe aller budgetierten Ausgabenkategorien für einen Monat
     * @param monthStart - Startdatum des Monats
     * @param monthEnd - Enddatum des Monats
     * @returns Summe der budgetierten Beträge aller Ausgabenkategorien
     */
    getTotalBudgetedForMonth(monthStart: Date, monthEnd: Date): number;
    /**
     * Leert den Transaction Cache (für Debugging oder bei größeren Datenänderungen)
     */
    clearTransactionCache(): void;
    /**
     * Invalidiert den Cache für den aktuellen Monat
     * Stellt sicher, dass Charts immer aktuelle Daten anzeigen
     */
    invalidateCurrentMonthCache(): void;
};
