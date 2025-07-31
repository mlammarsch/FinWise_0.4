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
import { BudgetService } from '@/services/BudgetService';

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

  // Batch-Update-Mechanismus für Performance-Optimierung
  const isBatchUpdateMode = ref(false);
  const batchUpdateCount = ref(0);
  const pendingUIUpdates = ref(false);

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
   * Aktiviert den Batch-Update-Modus für Performance-Optimierung
   * Verhindert UI-Updates während Massenverarbeitung
   */
  function startBatchUpdate(): void {
    isBatchUpdateMode.value = true;
    batchUpdateCount.value = 0;
    pendingUIUpdates.value = false;
    debugLog('transactionStore', 'Batch-Update-Modus aktiviert');
  }

  /**
   * Beendet den Batch-Update-Modus und löst finale UI-Updates aus
   */
  function endBatchUpdate(): void {
    isBatchUpdateMode.value = false;
    const processedCount = batchUpdateCount.value;
    batchUpdateCount.value = 0;

    if (pendingUIUpdates.value) {
      // Trigger finale UI-Updates durch Reaktivität
      pendingUIUpdates.value = false;
      infoLog('transactionStore', `Batch-Update abgeschlossen: ${processedCount} Transaktionen verarbeitet`);
      // Pauschale Cache-Invalidierung nach Batch-Update (da viele Transaktionen betroffen)
      BudgetService.invalidateCache();
    }

    debugLog('transactionStore', 'Batch-Update-Modus deaktiviert');
  }

  /**
   * Prüft ob aktuell im Batch-Update-Modus
   */
  function isInBatchMode(): boolean {
    return isBatchUpdateMode.value;
  }

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

    if (!fromSync) {
      debugLog('transactionStore', `Füge neue Transaktion hinzu: ${transactionWithTimestamp.description} (${transactionWithTimestamp.amount}€) vom ${transactionWithTimestamp.date} für Konto ${transactionWithTimestamp.accountId}`);
    }

    if (fromSync) {
      // Nutze die optimierte TenantDbService-Methode mit skipIfOlder=true
      const wasUpdated = await tenantDbService.addTransaction(transactionWithTimestamp, true);

      if (!wasUpdated) {
        // Lokale Transaktion war neuer oder gleich - keine DB-Operation erfolgt
        if (isBatchUpdateMode.value) {
          debugLog('transactionStore', `Batch: Skipped transaction ${transactionWithTimestamp.id} (local is newer or equal)`);
        } else {
          infoLog('transactionStore', `addTransaction (fromSync): Lokale Transaktion ${transactionWithTimestamp.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        }
        // Lade lokale Transaktion für Rückgabe
        const localTransaction = await tenantDbService.getTransactionById(transactionWithTimestamp.id);
        return localTransaction || transactionWithTimestamp;
      }

      // Transaktion wurde tatsächlich aktualisiert
      if (isBatchUpdateMode.value) {
        debugLog('transactionStore', `Batch: Applied transaction ${transactionWithTimestamp.id} to IndexedDB`);
      } else {
        infoLog('transactionStore', `addTransaction (fromSync): Eingehende Transaktion ${transactionWithTimestamp.id} angewendet.`);
      }
    } else {
      // Normale Benutzer-Aktion - immer schreiben
      await tenantDbService.addTransaction(transactionWithTimestamp, false);
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

    // Batch-Update-Tracking und Logging
    if (isBatchUpdateMode.value) {
      batchUpdateCount.value++;
      pendingUIUpdates.value = true;
      debugLog('transactionStore', `Batch-Transaktion verarbeitet: ${batchUpdateCount.value} (${transactionWithTimestamp.description})`);
    } else {
      infoLog('transactionStore', `Transaction "${transactionWithTimestamp.description}" im Store hinzugefügt/aktualisiert (ID: ${transactionWithTimestamp.id}).`);
      // Granulare Cache-Invalidierung nur bei normalen Updates (nicht bei Batch-Mode)
      BudgetService.invalidateCacheForTransaction({
        categoryId: transactionWithTimestamp.categoryId,
        date: transactionWithTimestamp.date,
        toCategoryId: transactionWithTimestamp.toCategoryId
      });
    }

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

      // Granulare Cache-Invalidierung bei Updates (außer bei Batch-Mode)
      if (!isBatchUpdateMode.value) {
        const transaction = transactions.value.find(t => t.id === id);
        if (transaction) {
          BudgetService.invalidateCacheForTransaction({
            categoryId: transaction.categoryId,
            date: transaction.date,
            toCategoryId: transaction.toCategoryId
          });
        }
      }

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

    if (transactionToDelete) {
      debugLog('transactionStore', `Lösche Transaktion: ${transactionToDelete.description} (${transactionToDelete.amount}€) vom ${transactionToDelete.date} für Konto ${transactionToDelete.accountId}`);
    }

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
    // Batch-Update-Funktionen für Performance-Optimierung
    startBatchUpdate,
    endBatchUpdate,
    isInBatchMode,
  };
});
