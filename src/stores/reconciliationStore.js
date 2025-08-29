// src/stores/reconciliationStore.ts
import { defineStore } from 'pinia';
import { toDateOnlyString } from '@/utils/formatters';
import { debugLog } from '@/utils/logger';
/**
* Reiner UI‑State‑Store.
* Berechnungen (Saldo, Differenz) liegen im ReconciliationService.
*/
export const useReconciliationStore = defineStore('reconciliation', {
    state: () => ({
        currentAccount: null,
        reconcileDate: toDateOnlyString(new Date()),
        actualBalance: 0,
        note: '',
    }),
    actions: {
        /** Initialisiert einen neuen Abgleich */
        startReconciliation(account) {
            this.currentAccount = account;
            this.reconcileDate = toDateOnlyString(new Date());
            this.actualBalance = 0;
            this.note = '';
            debugLog('[ReconciliationStore] startReconciliation', { accountId: account.id });
        },
        /** Bricht den Abgleich ab und setzt UI‑State zurück */
        cancelReconciliation() {
            debugLog('[ReconciliationStore] cancelReconciliation – reset');
            this.reset();
        },
        /** Allgemeiner Reset */
        reset() {
            this.$reset();
            debugLog('[ReconciliationStore] reset');
        },
    },
});
