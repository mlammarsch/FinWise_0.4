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
} from '@/types';

dayjs.extend(isSameOrBefore);
dayjs.extend(weekday);
dayjs.extend(isSameOrAfter);

export const usePlanningStore = defineStore('planning', () => {
  /* ------------------------------------------------ State */
  const planningTransactions = ref<PlanningTransaction[]>([]);
  const transactionStore    = useTransactionStore();
  const ruleStore           = useRuleStore();
  const tenantDbService     = new TenantDbService();

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
  async function addPlanningTransaction(p: Partial<PlanningTransaction>, fromSync = false) {
    const id = uuidv4();
    const tx: PlanningTransaction = {
      id,
      name: p.name || '',
      accountId: p.accountId || '',
      categoryId: p.categoryId ?? null,
      tagIds: p.tagIds || [],
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
    };

    try {
      const savedTx = await tenantDbService.createPlanningTransaction(tx);
      planningTransactions.value.push(savedTx);

      if (!fromSync) {
        BalanceService.calculateMonthlyBalances();
        // TransactionService.schedule(tx); // Kommentiert aus, da Methode nicht existiert
        // ruleStore.evaluateRules(); // Kommentiert aus, da Methode nicht existiert
      }

      debugLog('PlanningStore', `Planungstransaktion "${tx.name}" hinzugefügt`, { id });
      return savedTx;
    } catch (error) {
      debugLog('PlanningStore', `Fehler beim Hinzufügen der Planungstransaktion "${tx.name}"`, String(error));
      throw error;
    }
  }

  async function updatePlanningTransaction(id: string, upd: Partial<PlanningTransaction>, fromSync = false) {
    try {
      const success = await tenantDbService.updatePlanningTransaction(id, upd);
      if (!success) {
        debugLog('PlanningStore', `Planungstransaktion mit ID "${id}" nicht gefunden für Update`);
        return false;
      }

      const idx = planningTransactions.value.findIndex(p => p.id === id);
      if (idx !== -1) {
        planningTransactions.value[idx] = {
          ...planningTransactions.value[idx],
          ...upd,
        };
      }

      if (!fromSync) {
        BalanceService.calculateMonthlyBalances();
        // TransactionService.reschedule(planningTransactions.value[idx]); // Kommentiert aus, da Methode nicht existiert
      }

      debugLog('PlanningStore', `Planungstransaktion mit ID "${id}" aktualisiert`, Object.keys(upd).join(', '));
      return true;
    } catch (error) {
      debugLog('PlanningStore', `Fehler beim Aktualisieren der Planungstransaktion mit ID "${id}"`, String(error));
      return false;
    }
  }

  async function deletePlanningTransaction(id: string, fromSync = false) {
    try {
      const tx = planningTransactions.value.find(p => p.id === id);
      const success = await tenantDbService.deletePlanningTransaction(id);

      if (success) {
        planningTransactions.value = planningTransactions.value.filter(p => p.id !== id);

        if (!fromSync) {
          BalanceService.calculateMonthlyBalances();
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

  /* ----------------------------------------------- Exports */
  return {
    planningTransactions,
    getPlanningTransactionById,
    getUpcomingTransactions,
    addPlanningTransaction,
    updatePlanningTransaction,
    deletePlanningTransaction,
    loadPlanningTransactions,
    savePlanningTransactions,
    reset,
  };
});
