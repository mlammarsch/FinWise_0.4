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

  const getUpcomingTransactions = computed(() => (days = 30, startDate?: string) => {
    // Verwende das übergebene Startdatum oder heute als Fallback
    const start = startDate || dayjs().format('YYYY-MM-DD');
    const endDate = dayjs(start).add(days, 'days').format('YYYY-MM-DD');

    const upcomingTransactions: Array<{
      date: string;
      transaction: PlanningTransaction;
    }> = [];

    // Für jede aktive Planning-Transaktion die zukünftigen Termine berechnen
    for (const planTx of planningTransactions.value.filter(tx => tx.isActive)) {
      try {
        // Berechne Termine für einen größeren Zeitraum (2 Jahre) um sicherzustellen,
        // dass wir alle relevanten Termine erfassen
        const extendedEndDate = dayjs(start).add(730, 'days').format('YYYY-MM-DD'); // 2 Jahre
        const allOccurrences = calculateNextOccurrences(planTx, start, extendedEndDate);

        // Filtere nur die Termine im gewünschten Zeitraum
        const relevantOccurrences = allOccurrences.filter(date => {
          const occurrenceDate = dayjs(date);
          return occurrenceDate.isSameOrAfter(dayjs(start)) && occurrenceDate.isSameOrBefore(dayjs(endDate));
        });

        // Für jeden berechneten Termin ein Upcoming-Transaction-Objekt erstellen
        for (const date of relevantOccurrences) {
          upcomingTransactions.push({
            date,
            transaction: planTx
          });
        }
      } catch (error) {
        debugLog('PlanningStore', `Fehler beim Berechnen der Termine für Planning ${planTx.id}:`, error);
      }
    }

    // Nach Datum sortieren
    return upcomingTransactions.sort((a, b) => a.date.localeCompare(b.date));
  });

  /**
   * Berechnet zukünftige Ausführungstermine einer Planungstransaktion.
   * Diese Funktion ist eine Kopie der PlanningService.calculateNextOccurrences Logik
   * um Circular Dependencies zu vermeiden.
   */
  function calculateNextOccurrences(
    planTx: PlanningTransaction,
    startDate: string,
    endDate: string
  ): string[] {
    if (!planTx.isActive) return [];

    const repeatsEnabled = planTx.recurrencePattern !== RecurrencePattern.ONCE;

    const occurrences: string[] = [];
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const txStart = dayjs(toDateOnlyString(planTx.startDate));

    if (txStart.isAfter(end)) return [];
    if (planTx.endDate && dayjs(toDateOnlyString(planTx.endDate)).isBefore(start))
      return [];

    // Wenn das Planning-Startdatum in der Vergangenheit liegt,
    // berechne das nächste relevante Datum ab dem gewünschten Startdatum
    let currentDate = txStart;
    let count = 1;
    const maxIterations = 1000;

    // Wenn txStart vor dem gewünschten Startdatum liegt, springe zum nächsten relevanten Termin
    if (txStart.isBefore(start) && planTx.recurrencePattern !== RecurrencePattern.ONCE) {
      // Berechne wie viele Wiederholungen seit txStart vergangen sind
      let tempDate = txStart;
      let tempCount = 1;

      while (tempDate.isBefore(start) && tempCount < maxIterations) {
        switch (planTx.recurrencePattern) {
          case RecurrencePattern.DAILY:
            tempDate = tempDate.add(1, "day");
            break;
          case RecurrencePattern.WEEKLY:
            tempDate = tempDate.add(1, "week");
            break;
          case RecurrencePattern.BIWEEKLY:
            tempDate = tempDate.add(2, "weeks");
            break;
          case RecurrencePattern.MONTHLY:
            if (
              planTx.executionDay &&
              planTx.executionDay > 0 &&
              planTx.executionDay <= 31
            ) {
              const nextMonth = tempDate.add(1, "month");
              const year = nextMonth.year();
              const month = nextMonth.month() + 1;
              const maxDay = new Date(year, month, 0).getDate();
              const day = Math.min(planTx.executionDay, maxDay);
              tempDate = dayjs(new Date(year, month - 1, day));
            } else {
              tempDate = tempDate.add(1, "month");
            }
            break;
          case RecurrencePattern.QUARTERLY:
            tempDate = tempDate.add(3, "months");
            break;
          case RecurrencePattern.YEARLY:
            tempDate = tempDate.add(1, "year");
            break;
          default:
            break;
        }
        tempCount++;

        // Prüfe End-Bedingungen
        if (
          planTx.recurrenceEndType === RecurrenceEndType.COUNT &&
          planTx.recurrenceCount !== null &&
          planTx.recurrenceCount !== undefined &&
          tempCount > planTx.recurrenceCount
        ) {
          return []; // Keine weiteren Termine
        }

        if (
          planTx.recurrenceEndType === RecurrenceEndType.DATE &&
          planTx.endDate &&
          tempDate.isAfter(dayjs(toDateOnlyString(planTx.endDate)))
        ) {
          return []; // Keine weiteren Termine
        }
      }

      currentDate = tempDate;
      count = tempCount;
    }

    // Einmalige Buchung
    if (!repeatsEnabled || planTx.recurrencePattern === RecurrencePattern.ONCE) {
      let adjustedDate = applyWeekendHandling(currentDate, planTx.weekendHandling);
      if (
        adjustedDate.isSameOrAfter(start) &&
        adjustedDate.isSameOrBefore(end)
      ) {
        occurrences.push(toDateOnlyString(adjustedDate.toDate()));
      }
      return occurrences;
    }

    while (currentDate.isSameOrBefore(end) && count < maxIterations) {
      let adjustedDate = applyWeekendHandling(currentDate, planTx.weekendHandling);

      if (
        adjustedDate.isSameOrAfter(start) &&
        adjustedDate.isSameOrBefore(end)
      ) {
        occurrences.push(toDateOnlyString(adjustedDate.toDate()));
      }

      if (planTx.recurrenceEndType === RecurrenceEndType.NEVER) {
        const maxEndDate = dayjs(start).add(24, "months");
        if (adjustedDate.isAfter(maxEndDate)) break;
      }

      if (
        planTx.recurrenceEndType === RecurrenceEndType.COUNT &&
        planTx.recurrenceCount !== null &&
        planTx.recurrenceCount !== undefined &&
        count >= planTx.recurrenceCount
      ) {
        break;
      }

      count++;

      switch (planTx.recurrencePattern) {
        case RecurrencePattern.DAILY:
          currentDate = currentDate.add(1, "day");
          break;
        case RecurrencePattern.WEEKLY:
          currentDate = currentDate.add(1, "week");
          break;
        case RecurrencePattern.BIWEEKLY:
          currentDate = currentDate.add(2, "weeks");
          break;
        case RecurrencePattern.MONTHLY:
          if (
            planTx.executionDay &&
            planTx.executionDay > 0 &&
            planTx.executionDay <= 31
          ) {
            const nextMonth = currentDate.add(1, "month");
            const year = nextMonth.year();
            const month = nextMonth.month() + 1;
            const maxDay = new Date(year, month, 0).getDate();
            const day = Math.min(planTx.executionDay, maxDay);
            currentDate = dayjs(new Date(year, month - 1, day));
          } else {
            currentDate = currentDate.add(1, "month");
          }
          break;
        case RecurrencePattern.QUARTERLY:
          currentDate = currentDate.add(3, "months");
          break;
        case RecurrencePattern.YEARLY:
          currentDate = currentDate.add(1, "year");
          break;
        default:
          return occurrences;
      }

      if (
        planTx.recurrenceEndType === RecurrenceEndType.DATE &&
        planTx.endDate &&
        currentDate.isAfter(dayjs(toDateOnlyString(planTx.endDate)))
      )
        break;
    }

    return occurrences;
  }

  /**
   * Verschiebt das Datum, falls es auf ein Wochenende fällt.
   */
  function applyWeekendHandling(date: dayjs.Dayjs, handling: WeekendHandlingType): dayjs.Dayjs {
    const day = date.day();
    if ((day !== 0 && day !== 6) || handling === WeekendHandlingType.NONE)
      return date;
    const isSaturday = day === 6;
    switch (handling) {
      case WeekendHandlingType.BEFORE:
        return isSaturday ? date.subtract(1, 'day') : date.subtract(2, 'day');
      case WeekendHandlingType.AFTER:
        return isSaturday ? date.add(2, 'day') : date.add(1, 'day');
      default:
        return date;
    }
  }

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
