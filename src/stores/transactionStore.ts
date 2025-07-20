// src/stores/transactionStore.ts
/**
 * Pfad: src/stores/transactionStore.ts
 * Transaktionen – jetzt tenant-spezifisch persistiert.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Transaction, SyncOperationType, EntityTypeEnum } from '@/types';
import { useAccountStore } from './accountStore';
import { useRecipientStore } from './recipientStore';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';

export interface ExtendedTransaction extends Transaction {
  tagIds: string[];
  payee: string;
  counterTransactionId: string | null;
  planningTransactionId: string | null;
  isReconciliation: boolean;
  runningBalance: number;
  transferToAccountId?: string | null;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

function toDateOnlyString(i: string): string {
  return i?.split('T')[0] ?? i;
}

export const useTransactionStore = defineStore('transaction', () => {
  const tenantDbService = new TenantDbService();

  /* ----------------------------------------------------- State */
  const transactions = ref<ExtendedTransaction[]>([]);
  const accountStore = useAccountStore();
  const recipientStore = useRecipientStore();

  /* --------------------------------------------------- Getters */
  const getTransactionById = computed(() => (id: string) =>
    transactions.value.find(t => t.id === id),
  );

  const getTransactionsByAccount = computed(() => (accountId: string) =>
    transactions.value
      .filter(t => t.accountId === accountId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  );

  const getTransactionsByCategory = computed(() => (categoryId: string) =>
    transactions.value
      .filter(t => t.categoryId === categoryId)
      .sort((a, b) => b.date.localeCompare(a.date)),
  );

  function getRecentTransactions(limit: number = 10) {
    debugLog('transactionStore', 'getRecentTransactions', { limit });
    return [...transactions.value]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  /* --------------------------------------------------- Actions */

  /**
   * Leitet payee-Wert aus recipientId ab oder verwendet den übergebenen payee-Wert
   */
  function resolvePayeeFromRecipient(recipientId?: string, fallbackPayee?: string): string {
    if (recipientId) {
      const recipient = recipientStore.getRecipientById(recipientId);
      if (recipient) {
        return recipient.name;
      }
    }
    return fallbackPayee || '';
  }

  async function addTransaction(tx: ExtendedTransaction, fromSync = false): Promise<ExtendedTransaction> {
    // Stelle sicher, dass payee aus recipientId abgeleitet wird, falls recipientId vorhanden ist
    const resolvedPayee = resolvePayeeFromRecipient(tx.recipientId, tx.payee);

    const now = new Date().toISOString();
    const transactionWithTimestamp: ExtendedTransaction = {
      ...tx,
      payee: resolvedPayee,
      updated_at: tx.updated_at || now,
      createdAt: tx.createdAt || now,
      updatedAt: tx.updatedAt || tx.updated_at || now,
    };

    if (fromSync) {
      const localTransaction = await tenantDbService.getTransactionById(transactionWithTimestamp.id);
      if (localTransaction && localTransaction.updated_at && transactionWithTimestamp.updated_at &&
          new Date(localTransaction.updated_at) >= new Date(transactionWithTimestamp.updated_at)) {
        infoLog('transactionStore', `addTransaction (fromSync): Lokale Transaktion ${localTransaction.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localTransaction;
      }
      await tenantDbService.addTransaction(transactionWithTimestamp);
      infoLog('transactionStore', `addTransaction (fromSync): Eingehende Transaktion ${transactionWithTimestamp.id} angewendet.`);
    } else {
      await tenantDbService.addTransaction(transactionWithTimestamp);
    }

    const existingTransactionIndex = transactions.value.findIndex(t => t.id === transactionWithTimestamp.id);
    if (existingTransactionIndex === -1) {
      transactions.value.push(transactionWithTimestamp);
    } else {
      if (!fromSync || (transactionWithTimestamp.updated_at && (!transactions.value[existingTransactionIndex].updated_at || new Date(transactionWithTimestamp.updated_at) > new Date(transactions.value[existingTransactionIndex].updated_at!)))) {
        transactions.value[existingTransactionIndex] = transactionWithTimestamp;
      } else if (fromSync) {
        warnLog('transactionStore', `addTransaction (fromSync): Store-Transaktion ${transactions.value[existingTransactionIndex].id} war neuer als eingehende ${transactionWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('transactionStore', `Transaction "${transactionWithTimestamp.description}" im Store hinzugefügt/aktualisiert (ID: ${transactionWithTimestamp.id}).`);

    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.TRANSACTION,
          entityId: transactionWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(transactionWithTimestamp),
        });
        infoLog('transactionStore', `Transaction "${transactionWithTimestamp.description}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('transactionStore', `Fehler beim Hinzufügen von Transaction "${transactionWithTimestamp.description}" zur Sync Queue.`, e);
      }
    }
    return transactionWithTimestamp;
  }

  async function updateTransaction(id: string, updates: Partial<ExtendedTransaction>, fromSync = false): Promise<boolean> {
    // Wenn recipientId in den Updates enthalten ist, leite payee ab
    let resolvedPayee = updates.payee;
    if (updates.recipientId !== undefined) {
      resolvedPayee = resolvePayeeFromRecipient(updates.recipientId, updates.payee);
    }

    const now = new Date().toISOString();
    const transactionUpdatesWithTimestamp: Partial<ExtendedTransaction> = {
      ...updates,
      ...(resolvedPayee !== undefined && { payee: resolvedPayee }),
      updated_at: updates.updated_at || now,
      updatedAt: updates.updatedAt || updates.updated_at || now,
    };

    if (fromSync) {
      const localTransaction = await tenantDbService.getTransactionById(id);
      if (!localTransaction) {
        infoLog('transactionStore', `updateTransaction (fromSync): Lokale Transaktion ${id} nicht gefunden. Behandle als addTransaction.`);
        const fullTransaction = { id, ...transactionUpdatesWithTimestamp } as ExtendedTransaction;
        await addTransaction(fullTransaction, true);
        return true;
      }

      if (localTransaction.updated_at && transactionUpdatesWithTimestamp.updated_at &&
          new Date(localTransaction.updated_at) >= new Date(transactionUpdatesWithTimestamp.updated_at)) {
        infoLog('transactionStore', `updateTransaction (fromSync): Lokale Transaktion ${localTransaction.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true;
      }
      const updatedTransaction = { ...localTransaction, ...transactionUpdatesWithTimestamp };
      await tenantDbService.updateTransaction(updatedTransaction);
      infoLog('transactionStore', `updateTransaction (fromSync): Eingehendes Update für Transaktion ${id} angewendet.`);
    } else {
      const localTransaction = await tenantDbService.getTransactionById(id);
      if (!localTransaction) {
        debugLog('transactionStore', 'updateTransaction - not found', { id });
        return false;
      }
      const updatedTransaction = { ...localTransaction, ...transactionUpdatesWithTimestamp };
      await tenantDbService.updateTransaction(updatedTransaction);
    }

    const idx = transactions.value.findIndex(t => t.id === id);
    if (idx !== -1) {
      if (!fromSync || (transactionUpdatesWithTimestamp.updated_at && (!transactions.value[idx].updated_at || new Date(transactionUpdatesWithTimestamp.updated_at) > new Date(transactions.value[idx].updated_at!)))) {
        transactions.value[idx] = { ...transactions.value[idx], ...transactionUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('transactionStore', `updateTransaction (fromSync): Store-Transaktion ${transactions.value[idx].id} war neuer als eingehende ${id}. Store nicht geändert.`);
      }
      infoLog('transactionStore', `Transaction mit ID "${id}" im Store aktualisiert.`);

      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.TRANSACTION,
            entityId: id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(transactions.value[idx]),
          });
          infoLog('transactionStore', `Transaction mit ID "${id}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('transactionStore', `Fehler beim Hinzufügen von Transaction Update (ID: "${id}") zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('transactionStore', `updateTransaction: Transaction ${id} not found in store during sync. Adding it.`);
      const fullTransaction = { id, ...transactionUpdatesWithTimestamp } as ExtendedTransaction;
      await addTransaction(fullTransaction, true);
      return true;
    }
    return false;
  }

  async function deleteTransaction(id: string, fromSync = false): Promise<boolean> {
    const transactionToDelete = transactions.value.find(t => t.id === id);

    await tenantDbService.deleteTransaction(id);
    transactions.value = transactions.value.filter(t => t.id !== id);
    infoLog('transactionStore', `Transaction mit ID "${id}" aus Store und lokaler DB entfernt.`);

    if (!fromSync && transactionToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.TRANSACTION,
          entityId: id,
          operationType: SyncOperationType.DELETE,
          payload: { id: id },
        });
        infoLog('transactionStore', `Transaction mit ID "${id}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('transactionStore', `Fehler beim Hinzufügen von Transaction Delete (ID: "${id}") zur Sync Queue.`, e);
      }
    }
    return true;
  }

  /* ----------------------------------------------- Persistence */
  async function loadTransactions(): Promise<void> {
    try {
      const loadedTransactions = await tenantDbService.getAllTransactions();
      transactions.value = loadedTransactions || [];

      // normalize dates
      transactions.value = transactions.value.map(tx => ({
        ...tx,
        date: toDateOnlyString(tx.date),
        valueDate: toDateOnlyString(tx.valueDate || tx.date),
      }));

      debugLog('transactionStore', 'loadTransactions completed', {
        count: transactions.value.length,
      });
    } catch (error) {
      errorLog('transactionStore', 'Fehler beim Laden der Transaktionen', error);
      transactions.value = [];
    }
  }

  async function reset(): Promise<void> {
    transactions.value = [];
    await loadTransactions();
    debugLog('transactionStore', 'reset completed');
  }

  /** Initialisiert den Store beim Tenantwechsel oder App-Start */
  async function initializeStore(): Promise<void> {
    await loadTransactions();
    debugLog('transactionStore', 'initializeStore completed');
  }

  loadTransactions();

  /* ----------------------------------------------- Exports */
  return {
    transactions,
    getTransactionById,
    getTransactionsByAccount,
    getTransactionsByCategory,
    getRecentTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    loadTransactions,
    reset,
    initializeStore,
  };
});
