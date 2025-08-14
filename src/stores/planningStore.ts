// src/stores/planningStore.ts
/**
 * Store für geplante Transaktionen – tenant-spezifisch persistiert via IndexedDB.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import weekday from 'dayjs/plugin/weekday';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { toDateOnlyString } from '@/utils/formatters';
import { debugLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';
import { BalanceService } from '@/services/BalanceService';
import { TransactionService } from '@/services/TransactionService';
import { TenantDbService } from '@/services/TenantDbService';
import { useTransactionStore } from './transactionStore';
import { useRuleStore } from './ruleStore';
import {
  PlanningTransaction,
  RecurrencePattern,
  AmountType,
  RecurrenceEndType,
  WeekendHandlingType,
  SyncOperationType,
} from '@/types';

dayjs.extend(isSameOrBefore);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

export const usePlanningStore = defineStore('planning', () => {
  /* ------------------------------------------------ State */
  const planningTransactions = ref<PlanningTransaction[]>([]);
  const transactionStore = useTransactionStore();
  const ruleStore = useRuleStore();
  const tenantDbService = new TenantDbService();

  /* ---------------------------------------------- Getters */
  const getPlanningTransactionById = computed(() => (id: string) =>
    planningTransactions.value.find(tx => tx.id === id),
  );

  const getUpcomingTransactions = computed(() => (days = 30) =>
    planningTransactions.value
      .filter(tx => tx.isActive)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  );

  /* ---------------------------------------------- Actions */
  async function addPlanningTransaction(p: Partial<PlanningTransaction>, fromSync = false): Promise<PlanningTransaction> {
    const planningTransactionWithTimestamp: PlanningTransaction = {
      id: p.id || uuidv4(),
      name: p.name || '',
      accountId: p.accountId || '',
      categoryId: p.categoryId ?? null,
      tagIds: Array.isArray(p.tagIds) ? [...p.tagIds] : [], // Ensure plain array
      recipientId: p.recipientId ?? null,
      amount: p.amount || 0,
      amountType: p.amountType || AmountType.EXACT,
      approximateAmount: p.approximateAmount,
      minAmount: p.minAmount,
      maxAmount: p.maxAmount,
      note: p.note || '',
      startDate: p.startDate || new Date().toISOString(),
      valueDate: p.valueDate || p.startDate || new Date().toISOString(),
      endDate: p.endDate ?? null,
      recurrencePattern: p.recurrencePattern || RecurrencePattern.ONCE,
      recurrenceEndType: p.recurrenceEndType || RecurrenceEndType.NEVER,
      recurrenceCount: p.recurrenceCount ?? null,
      executionDay: p.executionDay ?? null,
      weekendHandling: p.weekendHandling || WeekendHandlingType.NONE,
      isActive: p.isActive !== undefined ? p.isActive : true,
      forecastOnly: p.forecastOnly !== undefined ? p.forecastOnly : false,
      transactionType: p.transactionType!,
      transferToAccountId: p.transferToAccountId,
      transferToCategoryId: p.transferToCategoryId,
      counterPlanningTransactionId: p.counterPlanningTransactionId || null,
      autoExecute: p.autoExecute || false,
      updatedAt: p.updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localPlanningTransaction = await tenantDbService.getPlanningTransactionById(planningTransactionWithTimestamp.id);
      if (localPlanningTransaction && localPlanningTransaction.updatedAt && planningTransactionWithTimestamp.updatedAt &&
        new Date(localPlanningTransaction.updatedAt) >= new Date(planningTransactionWithTimestamp.updatedAt)) {
        debugLog('PlanningStore', `addPlanningTransaction (fromSync): Lokale Planungstransaktion ${localPlanningTransaction.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localPlanningTransaction; // Gib die lokale, "gewinnende" Planungstransaktion zurück
      }
    }

    try {
      const savedTx = await tenantDbService.createPlanningTransaction(planningTransactionWithTimestamp);

      // Lokaler State aktualisieren
      const existingIndex = planningTransactions.value.findIndex(pt => pt.id === savedTx.id);
      if (existingIndex !== -1) {
        planningTransactions.value[existingIndex] = savedTx;
      } else {
        planningTransactions.value.push(savedTx);
      }

      if (!fromSync) {
        // Sync-Queue hinzufügen
        await tenantDbService.addToSyncQueue('planningTransactions', 'create', savedTx);

        BalanceService.calculateAllMonthlyBalances();
        // TransactionService.schedule(tx); // Kommentiert aus, da Methode nicht existiert
        // ruleStore.evaluateRules(); // Kommentiert aus, da Methode nicht existiert
      }

      debugLog('PlanningStore', `Planungstransaktion "${savedTx.name}" hinzugefügt`, { id: savedTx.id });
      return savedTx;
    } catch (error) {
      debugLog('PlanningStore', `Fehler beim Hinzufügen der Planungstransaktion "${planningTransactionWithTimestamp.name}"`, String(error));
      throw error;
    }
  }

  /**
   * Fügt mehrere Planungstransaktionen in einem Batch hinzu - optimiert für große Datenmengen
   */
  async function addMultiplePlanningTransactions(planningTransactionsToAdd: Partial<PlanningTransaction>[], fromSync = false): Promise<PlanningTransaction[]> {
    if (planningTransactionsToAdd.length === 0) {
      debugLog('PlanningStore', 'addMultiplePlanningTransactions: Keine Planungstransaktionen zum Hinzufügen');
      return [];
    }

    const processedPlanningTransactions: PlanningTransaction[] = [];

    try {
      // Bereite alle Planungstransaktionen vor
      const planningTransactionsWithTimestamp = planningTransactionsToAdd.map(p => {
        const planningTransactionWithTimestamp: PlanningTransaction = {
          id: p.id || uuidv4(),
          name: p.name || '',
          accountId: p.accountId || '',
          categoryId: p.categoryId ?? null,
          tagIds: Array.isArray(p.tagIds) ? [...p.tagIds] : [],
          recipientId: p.recipientId ?? null,
          amount: p.amount || 0,
          amountType: p.amountType || AmountType.EXACT,
          approximateAmount: p.approximateAmount,
          minAmount: p.minAmount,
          maxAmount: p.maxAmount,
          note: p.note || '',
          startDate: p.startDate || new Date().toISOString(),
          valueDate: p.valueDate || p.startDate || new Date().toISOString(),
          endDate: p.endDate ?? null,
          recurrencePattern: p.recurrencePattern || RecurrencePattern.ONCE,
          recurrenceEndType: p.recurrenceEndType || RecurrenceEndType.NEVER,
          recurrenceCount: p.recurrenceCount ?? null,
          executionDay: p.executionDay ?? null,
          weekendHandling: p.weekendHandling || WeekendHandlingType.NONE,
          isActive: p.isActive !== undefined ? p.isActive : true,
          forecastOnly: p.forecastOnly !== undefined ? p.forecastOnly : false,
          transactionType: p.transactionType!,
          transferToAccountId: p.transferToAccountId,
          transferToCategoryId: p.transferToCategoryId,
          counterPlanningTransactionId: p.counterPlanningTransactionId || null,
          autoExecute: p.autoExecute || false,
          updatedAt: p.updatedAt || new Date().toISOString(),
        };
        return planningTransactionWithTimestamp;
      });

      if (fromSync) {
        // Verwende intelligente Batch-Operation für Sync
        const result = await tenantDbService.addPlanningTransactionsBatchIntelligent(planningTransactionsWithTimestamp);
        debugLog('PlanningStore', `PlanningTransactions Sync-Batch abgeschlossen: ${result.updated} aktualisiert, ${result.skipped} übersprungen`);

        // Aktualisiere nur die tatsächlich geänderten Planungstransaktionen im Store
        for (const ptx of planningTransactionsWithTimestamp) {
          const existingIndex = planningTransactions.value.findIndex(p => p.id === ptx.id);
          if (existingIndex === -1) {
            planningTransactions.value.push(ptx);
            processedPlanningTransactions.push(ptx);
          } else if (ptx.updatedAt && (!planningTransactions.value[existingIndex].updatedAt ||
            new Date(ptx.updatedAt) > new Date(planningTransactions.value[existingIndex].updatedAt!))) {
            planningTransactions.value[existingIndex] = ptx;
            processedPlanningTransactions.push(ptx);
          }
        }
      } else {
        // Normale Batch-Operation für lokale Änderungen
        await tenantDbService.addPlanningTransactionsBatch(planningTransactionsWithTimestamp);

        // Füge alle Planungstransaktionen zum Store hinzu
        for (const ptx of planningTransactionsWithTimestamp) {
          const existingIndex = planningTransactions.value.findIndex(p => p.id === ptx.id);
          if (existingIndex === -1) {
            planningTransactions.value.push(ptx);
          } else {
            planningTransactions.value[existingIndex] = ptx;
          }
          processedPlanningTransactions.push(ptx);
        }

        // Füge alle zur Sync-Queue hinzu (einzeln, da keine Batch-Methode existiert)
        for (const ptx of planningTransactionsWithTimestamp) {
          try {
            await tenantDbService.addToSyncQueue('planningTransactions', 'create', ptx);
          } catch (e) {
            debugLog('PlanningStore', `Fehler beim Hinzufügen von PlanningTransaction "${ptx.name}" zur Sync Queue.`, String(e));
          }
        }
        debugLog('PlanningStore', `${planningTransactionsWithTimestamp.length} Planungstransaktionen zur Sync Queue hinzugefügt`);

        // Trigger Balance-Berechnung nur einmal am Ende
        BalanceService.calculateAllMonthlyBalances();
      }

      debugLog('PlanningStore', `${processedPlanningTransactions.length} Planungstransaktionen erfolgreich als Batch verarbeitet`);
      return processedPlanningTransactions;

    } catch (error) {
      debugLog('PlanningStore', `Fehler beim Batch-Hinzufügen von ${planningTransactionsToAdd.length} Planungstransaktionen`, String(error));
      throw error;
    }
  }

  async function updatePlanningTransaction(id: string, upd: Partial<PlanningTransaction>, fromSync = false): Promise<boolean> {
    const updatesWithTimestamp = {
      ...upd,
      updatedAt: upd.updatedAt || new Date().toISOString()
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localPlanningTransaction = await tenantDbService.getPlanningTransactionById(id);
      if (localPlanningTransaction && localPlanningTransaction.updatedAt && updatesWithTimestamp.updatedAt &&
        new Date(localPlanningTransaction.updatedAt) >= new Date(updatesWithTimestamp.updatedAt)) {
        debugLog('PlanningStore', `updatePlanningTransaction (fromSync): Lokale Planungstransaktion ${id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true; // Erfolgreich, aber keine Änderung
      }
    }

    try {
      const success = await tenantDbService.updatePlanningTransaction(id, updatesWithTimestamp);
      if (!success) {
        debugLog('PlanningStore', `Planungstransaktion mit ID "${id}" nicht gefunden für Update`);
        return false;
      }

      const idx = planningTransactions.value.findIndex(p => p.id === id);
      if (idx !== -1) {
        planningTransactions.value[idx] = {
          ...planningTransactions.value[idx],
          ...updatesWithTimestamp,
        };

        if (!fromSync) {
          // Sync-Queue hinzufügen
          await tenantDbService.addToSyncQueue('planningTransactions', 'update', planningTransactions.value[idx]);
        }
      }

      if (!fromSync) {
        BalanceService.calculateAllMonthlyBalances();
        // TransactionService.reschedule(planningTransactions.value[idx]); // Kommentiert aus, da Methode nicht existiert
      }

      debugLog('PlanningStore', `Planungstransaktion mit ID "${id}" aktualisiert`, Object.keys(updatesWithTimestamp).join(', '));
      return true;
    } catch (error) {
      debugLog('PlanningStore', `Fehler beim Aktualisieren der Planungstransaktion mit ID "${id}"`, String(error));
      return false;
    }
  }

  async function deletePlanningTransaction(id: string, fromSync = false): Promise<boolean> {
    try {
      const tx = planningTransactions.value.find(p => p.id === id);

      if (!fromSync && tx) {
        // Sync-Queue hinzufügen vor dem Löschen
        await tenantDbService.addToSyncQueue('planningTransactions', 'delete', { id });
      }

      const success = await tenantDbService.deletePlanningTransaction(id);

      if (success) {
        planningTransactions.value = planningTransactions.value.filter(p => p.id !== id);

        if (!fromSync) {
          BalanceService.calculateAllMonthlyBalances();
          // TransactionService.cancel(id); // Kommentiert aus, da Methode nicht existiert
        }

        debugLog('PlanningStore', `Planungstransaktion "${tx?.name}" gelöscht`, id);
      } else {
        debugLog('PlanningStore', `Planungstransaktion mit ID "${id}" nicht gefunden für Löschung`);
      }

      return success;
    } catch (error) {
      debugLog('PlanningStore', `Fehler beim Löschen der Planungstransaktion mit ID "${id}"`, String(error));
      return false;
    }
  }

  /* ------------------------------------------- Persistence */
  async function loadPlanningTransactions() {
    try {
      // Erst versuchen aus IndexedDB zu laden
      const dbTransactions = await tenantDbService.getPlanningTransactions();

      if (dbTransactions.length > 0) {
        planningTransactions.value = dbTransactions.map((tx: any) => ({
          ...tx,
          name: tx.name || tx.payee || '',
          date: toDateOnlyString(tx.startDate),
          valueDate: toDateOnlyString(tx.valueDate || tx.startDate),
          amountType: tx.amountType || AmountType.EXACT,
          weekendHandling: tx.weekendHandling || WeekendHandlingType.NONE,
          recurrenceEndType: tx.recurrenceEndType || RecurrenceEndType.NEVER,
          isActive: tx.isActive !== undefined ? tx.isActive : true,
          forecastOnly: tx.forecastOnly !== undefined ? tx.forecastOnly : false,
        }));
        debugLog('PlanningStore', `${planningTransactions.value.length} Planungstransaktionen aus IndexedDB geladen`);
        return;
      }

      // Fallback: Migration von localStorage
      const raw = localStorage.getItem(storageKey('planning_transactions'));
      if (raw) {
        try {
          const legacyTransactions = JSON.parse(raw).map((tx: any) => ({
            ...tx,
            name: tx.name || tx.payee || '',
            date: toDateOnlyString(tx.startDate),
            valueDate: toDateOnlyString(tx.valueDate || tx.startDate),
            amountType: tx.amountType || AmountType.EXACT,
            weekendHandling: tx.weekendHandling || WeekendHandlingType.NONE,
            recurrenceEndType: tx.recurrenceEndType || RecurrenceEndType.NEVER,
            isActive: tx.isActive !== undefined ? tx.isActive : true,
            forecastOnly: tx.forecastOnly !== undefined ? tx.forecastOnly : false,
          }));

          // Migriere zu IndexedDB
          for (const tx of legacyTransactions) {
            await tenantDbService.createPlanningTransaction(tx);
          }

          planningTransactions.value = legacyTransactions;
          localStorage.removeItem(storageKey('planning_transactions'));
          debugLog('PlanningStore', `${legacyTransactions.length} Planungstransaktionen von localStorage zu IndexedDB migriert`);
        } catch (e) {
          planningTransactions.value = [];
          debugLog('PlanningStore', 'Fehler beim Parsen der localStorage-Daten', String(e));
        }
      } else {
        planningTransactions.value = [];
        debugLog('PlanningStore', 'Keine Planungstransaktionen gefunden');
      }
    } catch (error) {
      planningTransactions.value = [];
      debugLog('PlanningStore', 'Fehler beim Laden der Planungstransaktionen', String(error));
    }
  }

  function savePlanningTransactions() {
    // IndexedDB persistiert automatisch - diese Methode wird für Kompatibilität beibehalten
    debugLog('PlanningStore', `${planningTransactions.value.length} Planungstransaktionen sind in IndexedDB persistiert`);
  }

  async function reset() {
    planningTransactions.value = [];
    localStorage.removeItem(storageKey('last_forecast_update'));
    await loadPlanningTransactions();
    debugLog('PlanningStore', 'Store zurückgesetzt');
  }

  // Initialisierung - async wird in einem Promise-Wrapper ausgeführt
  loadPlanningTransactions().catch(error => {
    debugLog('PlanningStore', 'Fehler bei der Initialisierung', String(error));
  });

  /* ---------------------------------------- Sync-Handling */
  function handleSyncMessage(operation: SyncOperationType, planningTransaction: PlanningTransaction) {
    debugLog('PlanningStore', `handleSyncMessage: ${operation} für PlanningTransaction ${planningTransaction.id}`);

    switch (operation) {
      case SyncOperationType.CREATE:
        addPlanningTransaction(planningTransaction, true);
        break;
      case SyncOperationType.UPDATE:
        updatePlanningTransaction(planningTransaction.id, planningTransaction, true);
        break;
      case SyncOperationType.DELETE:
        deletePlanningTransaction(planningTransaction.id, true);
        break;
      default:
        debugLog('PlanningStore', `Unbekannte Sync-Operation: ${operation}`);
    }
  }

  /* ----------------------------------------------- Exports */
  return {
    planningTransactions,
    getPlanningTransactionById,
    getUpcomingTransactions,
    addPlanningTransaction,
    addMultiplePlanningTransactions,
    updatePlanningTransaction,
    deletePlanningTransaction,
    loadPlanningTransactions,
    savePlanningTransactions,
    reset,
    handleSyncMessage,
  };
});
