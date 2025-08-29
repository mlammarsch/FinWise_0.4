import { PlanningTransaction, WeekendHandlingType } from "@/types";
import dayjs from "dayjs";
interface RecipientValidationResult {
    recipientId: string;
    recipientName: string;
    hasActiveReferences: boolean;
    transactionCount: number;
    planningTransactionCount: number;
    automationRuleCount: number;
    canDelete: boolean;
    warnings: string[];
}
export declare const PlanningService: {
    /**
     * Fügt eine Planungstransaktion hinzu (CRUD).
     */
    addPlanningTransaction(planning: Partial<PlanningTransaction>): Promise<PlanningTransaction>;
    /**
   * Berechnet zukünftige Ausführungstermine einer Planungstransaktion.
   */
    calculateNextOccurrences(planTx: PlanningTransaction, startDate: string, endDate: string): string[];
    /**
     * Verschiebt das Datum, falls es auf ein Wochenende fällt.
     */
    applyWeekendHandling(date: dayjs.Dayjs, handling: WeekendHandlingType): dayjs.Dayjs;
    /**
     * Führt eine geplante Transaktion aus.
     * Verarbeitet Haupttransaktionen und deren Gegenbuchungen zusammen.
     * Löscht ONCE‑Planungen bzw. die letzte Wiederholung automatisch aus dem Store.
     */
    executePlanningTransaction(planningId: string, executionDate: string): Promise<boolean>;
    /**
     * Überspringt eine geplante Transaktion ohne echte Transaktion zu erstellen.
     * Markiert die Planung als erledigt und berechnet das nächste Datum oder löscht sie.
     */
    skipPlanningTransaction(planningId: string, executionDate: string): Promise<boolean>;
    /**
     * Löscht eine Planungstransaktion (CRUD).
     */
    deletePlanningTransaction(id: string): Promise<boolean>;
    /**
     * Führt alle fälligen Planungstransaktionen aus.
     */
    executeAllDuePlanningTransactions(): Promise<number>;
    /**
     * Aktualisiert die Prognosen, indem die Monatsbilanzen neu berechnet werden.
     */
    updateForecasts(): Promise<boolean>;
    /**
     * Überprüft und ergänzt Prognosebuchungen für aktive Planungstransaktionen bis 24 Monate in die Zukunft
     */
    refreshForecastsForFuturePeriod(): Promise<number>;
    /**
     * Aktualisiert eine bestehende Planungstransaktion
     */
    updatePlanningTransaction(planningId: string, updatedPlanning: Partial<PlanningTransaction>): Promise<boolean>;
    /**
     * Berechnet geplante Einnahmen und Ausgaben für einen bestimmten Zeitraum
     */
    calculatePlannedIncomeExpense(startDate: string, endDate: string): {
        income: number;
        expense: number;
    };
    /**
     * Aktualisiert Recipient-Referenzen in allen betroffenen PlanningTransactions
     * Wird vom recipientStore bei Merge-Operationen aufgerufen
     */
    updateRecipientReferences(oldRecipientIds: string[], newRecipientId: string): Promise<void>;
    /**
     * Findet alle PlanningTransactions die einen bestimmten Recipient referenzieren
     * Sucht in recipientId-Feld der PlanningTransactions
     * @param recipientId Die zu suchende Recipient-ID
     * @returns Promise<PlanningTransaction[]> Array der gefundenen PlanningTransactions
     */
    getPlanningTransactionsWithRecipient(recipientId: string): Promise<PlanningTransaction[]>;
    /**
     * Zählt die Anzahl der PlanningTransactions die einen bestimmten Recipient referenzieren
     * Optimierte Version von getPlanningTransactionsWithRecipient für reine Zählung
     * @param recipientId Die zu suchende Recipient-ID
     * @returns Promise<number> Anzahl der gefundenen PlanningTransactions
     */
    countPlanningTransactionsWithRecipient(recipientId: string): Promise<number>;
    /**
     * Validiert die Löschung von Recipients durch Prüfung auf aktive Referenzen in PlanningTransactions
     * @param recipientIds Array der zu validierenden Recipient-IDs
     * @returns Promise<RecipientValidationResult[]> Validierungsergebnisse pro Recipient
     */
    validateRecipientDeletion(recipientIds: string[]): Promise<RecipientValidationResult[]>;
};
export {};
