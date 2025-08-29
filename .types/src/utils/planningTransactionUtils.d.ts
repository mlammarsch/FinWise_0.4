import { PlanningTransaction } from '../types';
/**
 * Formatiert Formulardaten für die Speicherung als Planungstransaktion
 */
export declare function formatTransactionForSave(formData: any): Omit<PlanningTransaction, "id">;
/**
 * Erstellt die Ausgangswerte für eine neue Regel basierend auf einer Transaktion
 */
export declare function getInitialRuleValues(params: {
    name: string;
    recipientName: string;
    accountId: string;
    amount: number;
    categoryId: string | null;
    fromCategoryId: string | null;
}): any;
