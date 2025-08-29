interface MonthlyBudgetData {
    budgeted: number;
    forecast: number;
    spent: number;
    saldo: number;
}
interface MonthlySummary {
    budgeted: number;
    forecast: number;
    spentMiddle: number;
    saldoFull: number;
}
export declare const BudgetService: {
    getAggregatedMonthlyBudgetData(categoryId: string, monthStart: Date, monthEnd: Date): MonthlyBudgetData;
    getSingleCategoryMonthlyBudgetData(categoryId: string, monthStart: Date, monthEnd: Date): MonthlyBudgetData;
    getMonthlySummary(monthStart: Date, monthEnd: Date, type: "expense" | "income"): MonthlySummary;
    invalidateCache(): void;
    invalidateCacheForTransaction(transaction: {
        categoryId?: string;
        date: string;
        toCategoryId?: string;
    }): void;
    /**
     * Setzt das Budget für einen Monat auf 0 zurück, indem alle CATEGORYTRANSFER-Transaktionen
     * des Monats für Ausgabenkategorien (isIncomeCategory: false) gelöscht werden.
     * Einnahme-Kategorietransfers werden ignoriert.
     * OPTIMIERT: Verwendet Bulk-Löschung für bessere Performance.
     */
    resetMonthBudget(monthStart: Date, monthEnd: Date): Promise<number>;
    /**
     * Wendet das Budget-Template auf einen Monat an.
     * Durchläuft Kategorien nach Prioritäten und wendet monatliche Beträge oder Anteile an.
     */
    applyBudgetTemplate(monthStart: Date, monthEnd: Date, additive?: boolean): Promise<number>;
    /**
     * Überschreibt das Budget mit dem Template (resetBudgetMonth + applyBudgetTemplate)
     */
    overwriteWithBudgetTemplate(monthStart: Date, monthEnd: Date): Promise<{
        deleted: number;
        created: number;
    }>;
};
export {};
