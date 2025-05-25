// src/stores/planningStore.ts
/**
 * Pfad: src/stores/planningStore.ts
 * Store für geplante Transaktionen – tenant-spezifisch persistiert.
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
  function addPlanningTransaction(p: Partial<PlanningTransaction>) {
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

    planningTransactions.value.push(tx);
    savePlanningTransactions();
    BalanceService.calculateMonthlyBalances();
    TransactionService.schedule(tx);
    ruleStore.evaluateRules();
    debugLog('[planningStore] add', { id });

    return tx;
  }

  function updatePlanningTransaction(id: string, upd: Partial<PlanningTransaction>) {
    const idx = planningTransactions.value.findIndex(p => p.id === id);
    if (idx === -1) return false;

    planningTransactions.value[idx] = {
      ...planningTransactions.value[idx],
      ...upd,
    };
    savePlanningTransactions();
    BalanceService.calculateMonthlyBalances();
    TransactionService.reschedule(planningTransactions.value[idx]);
    debugLog('[planningStore] update', { id, updates: Object.keys(upd) });
    return true;
  }

  function deletePlanningTransaction(id: string) {
    const tx = planningTransactions.value.find(p => p.id === id);
    planningTransactions.value = planningTransactions.value.filter(p => p.id !== id);
    savePlanningTransactions();
    BalanceService.calculateMonthlyBalances();
    TransactionService.cancel(id);
    debugLog('[planningStore] delete', { id, name: tx?.name });
  }

  /* ------------------------------------------- Persistence */
  function loadPlanningTransactions() {
    const raw = localStorage.getItem(storageKey('planning_transactions'));
    if (raw) {
      try {
        planningTransactions.value = JSON.parse(raw).map((tx: any) => ({
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
      } catch (e) {
        planningTransactions.value = [];
        debugLog('[planningStore] load - parse error', e);
      }
    }
    debugLog('[planningStore] load', { cnt: planningTransactions.value.length });
  }

  function savePlanningTransactions() {
    localStorage.setItem(
      storageKey('planning_transactions'),
      JSON.stringify(planningTransactions.value),
    );
    debugLog('[planningStore] save', { cnt: planningTransactions.value.length });
  }

  function reset() {
    planningTransactions.value = [];
    localStorage.removeItem(storageKey('last_forecast_update'));
    loadPlanningTransactions();
    debugLog('[planningStore] reset');
  }

  loadPlanningTransactions();

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
