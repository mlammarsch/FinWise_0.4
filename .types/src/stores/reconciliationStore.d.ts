import { Account } from '@/types';
interface ReconciliationState {
    currentAccount: Account | null;
    reconcileDate: string;
    actualBalance: number;
    note: string;
}
/**
* Reiner UI‑State‑Store.
* Berechnungen (Saldo, Differenz) liegen im ReconciliationService.
*/
export declare const useReconciliationStore: import("pinia").StoreDefinition<"reconciliation", ReconciliationState, {}, {
    /** Initialisiert einen neuen Abgleich */
    startReconciliation(account: Account): void;
    /** Bricht den Abgleich ab und setzt UI‑State zurück */
    cancelReconciliation(): void;
    /** Allgemeiner Reset */
    reset(): void;
}>;
export {};
