import type { Account } from '../types';
export declare const ReconciliationService: {
    startReconciliation(account: Account): void;
    cancelReconciliation(): void;
    reconcileAccount(account: Account): Promise<boolean>;
    reconcileAllTransactionsUntilDate(accountId: string, date: string): number;
    toggleTransactionReconciled(transactionId: string): void;
};
