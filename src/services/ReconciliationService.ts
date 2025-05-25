// src/services/ReconciliationService.ts
import { useReconciliationStore } from '@/stores/reconciliationStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { Account, TransactionType } from '@/types';
import { debugLog } from '@/utils/logger';
import { TransactionService } from './TransactionService';
import { BalanceService } from './BalanceService';
import { toDateOnlyString } from '@/utils/formatters';

function calcDifference(
  accountId: string,
  reconcileDate: string,
  actual: number,
) {
  const current = BalanceService.getTodayBalance(
    'account',
    accountId,
    new Date(reconcileDate),
  );
  const diff = Math.round((actual - current) * 100) / 100;
  return { current, diff };
}

export const ReconciliationService = {
  /* ----------------------------- UI‑Flow API ---------------------------- */

  startReconciliation(account: Account) {
    const store = useReconciliationStore();
    store.startReconciliation(account);
  },

  cancelReconciliation() {
    useReconciliationStore().cancelReconciliation();
  },

  /* ------------------------- Haupt‑Durchführung ------------------------- */

  reconcileAccount(): boolean {
    const store = useReconciliationStore();

    if (!store.currentAccount) {
      debugLog('[ReconciliationService] no currentAccount – abort');
      return false;
    }

    const { current, diff } = calcDifference(
      store.currentAccount.id,
      store.reconcileDate,
      store.actualBalance,
    );

    if (diff === 0) {
      debugLog('[ReconciliationService] difference 0 – nothing to do');
      store.reset();
      return true;
    }

    // Ausgleichsbuchung anlegen
    const newTx = TransactionService.addReconcileTransaction(
      store.currentAccount.id,
      diff,
      store.reconcileDate,
      store.note,
    );

    if (!newTx) {
      debugLog('[ReconciliationService] failed to create reconcile tx');
      return false;
    }

    debugLog('[ReconciliationService] reconcile OK', {
      accountId: store.currentAccount.id,
      currentBalance: current,
      difference: diff,
      txId: newTx.id,
    });

    // Monats­salden neu berechnen
    BalanceService.calculateMonthlyBalances();
    store.reset();
    return true;
  },

  /* -------------- Batch‑Reconciliation (bestehend) bleibt -------------- */

  reconcileAllTransactionsUntilDate(accountId: string, date: string): number {
    const txStore = useTransactionStore();
    let count = 0;
    const target = new Date(date);

    txStore.transactions.forEach(tx => {
      if (
        tx.accountId === accountId &&
        !tx.reconciled &&
        new Date(toDateOnlyString(tx.date)) <= target
      ) {
        TransactionService.updateTransaction(tx.id, { reconciled: true });
        count++;
      }
    });

    debugLog('[ReconciliationService] reconciled historic txs', { count });
    return count;
  },

  toggleTransactionReconciled(transactionId: string) {
    const txStore = useTransactionStore();
    const tx = txStore.getTransactionById(transactionId);
    if (!tx) return;

    TransactionService.updateTransaction(transactionId, {
      reconciled: !tx.reconciled,
    });
    debugLog('[ReconciliationService] toggled reconciled', {
      id: transactionId,
      newVal: !tx.reconciled,
    });
  },
};
