// src/stores/reconciliationStore.ts
import { defineStore } from 'pinia';
import { Account } from '@/types';
import { toDateOnlyString } from '@/utils/formatters';
import { debugLog } from '@/utils/logger';

interface ReconciliationState {
currentAccount: Account | null; // aktuell gewähltes Konto
reconcileDate: string;          // YYYY‑MM‑DD (Vorgabe: heute)
actualBalance: number;          // Eingabe: externer Kontostand
note: string;                   // Eingabe: Notiz für Ausgleichsbuchung
}

/**
* Reiner UI‑State‑Store.
* Berechnungen (Saldo, Differenz) liegen im ReconciliationService.
*/
export const useReconciliationStore = defineStore('reconciliation', {
state: (): ReconciliationState => ({
  currentAccount: null,
  reconcileDate: toDateOnlyString(new Date()),
  actualBalance: 0,
  note: '',
}),

actions: {
  /** Initialisiert einen neuen Abgleich */
  startReconciliation(account: Account) {
    this.currentAccount = account;
    this.reconcileDate  = toDateOnlyString(new Date());
    this.actualBalance  = 0;
    this.note           = '';
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
