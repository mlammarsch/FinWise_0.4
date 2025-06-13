// Datei: src/stores/ruleStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import {
  AutomationRule,
  RuleConditionType,
  RuleActionType,
  Transaction,
  EntityTypeEnum,
  SyncOperationType,
} from '../types';
import { debugLog, errorLog } from '@/utils/logger';
import { TransactionService } from '@/services/TransactionService';
import { TenantDbService } from '@/services/TenantDbService';

export const useRuleStore = defineStore('rule', () => {
  /** Alle Regeln */
  const rules = ref<AutomationRule[]>([]);

  // ------------------------------------------------------------------ CRUD
  async function addRule(rule: Omit<AutomationRule, 'id'>, fromSync: boolean = false) {
    try {
      const newRule: AutomationRule = {
        ...rule,
        id: uuidv4(),
        updated_at: new Date().toISOString()
      };

      const tenantDbService = new TenantDbService();
      const createdRule = await tenantDbService.createRule(newRule);

      rules.value.push(createdRule);

      if (!fromSync) {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RULE,
          entityId: createdRule.id,
          operationType: SyncOperationType.CREATE,
          payload: createdRule,
        });
      }

      debugLog('RuleStore', `Regel "${createdRule.name}" hinzugefügt`, { id: createdRule.id });
      return createdRule;
    } catch (error) {
      errorLog('RuleStore', 'Fehler beim Hinzufügen der Regel', error);
      throw error;
    }
  }

  const getRuleById = computed(() => {
    return (id: string) => rules.value.find((r) => r.id === id);
  });

  async function updateRule(id: string, updates: Partial<AutomationRule>, fromSync: boolean = false) {
    try {
      const tenantDbService = new TenantDbService();
      const success = await tenantDbService.updateRule(id, updates);

      if (success) {
        const idx = rules.value.findIndex((r) => r.id === id);
        if (idx !== -1) {
          rules.value[idx] = { ...rules.value[idx], ...updates, updated_at: new Date().toISOString() };
        }

        if (!fromSync) {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RULE,
            entityId: id,
            operationType: SyncOperationType.UPDATE,
            payload: { ...updates, id },
          });
        }

        debugLog('RuleStore', `Regel mit ID ${id} aktualisiert`);
      }

      return success;
    } catch (error) {
      errorLog('RuleStore', 'Fehler beim Aktualisieren der Regel', error);
      return false;
    }
  }

  async function deleteRule(id: string, fromSync: boolean = false) {
    try {
      const tenantDbService = new TenantDbService();
      const success = await tenantDbService.deleteRule(id);

      if (success) {
        rules.value = rules.value.filter((r) => r.id !== id);

        if (!fromSync) {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RULE,
            entityId: id,
            operationType: SyncOperationType.DELETE,
            payload: { id },
          });
        }

        debugLog('RuleStore', `Regel mit ID ${id} gelöscht`);
      }

      return success;
    } catch (error) {
      errorLog('RuleStore', 'Fehler beim Löschen der Regel', error);
      return false;
    }
  }

  // ------------------------------------------------ Regel‑Engine ---------
  function applyRulesToTransaction(
    transaction: Transaction,
    stage: 'PRE' | 'DEFAULT' | 'POST' = 'DEFAULT'
  ) {
    const sorted = [...rules.value]
      .filter((r) => r.isActive && r.stage === stage)
      .sort((a, b) => a.priority - b.priority);

    let modified: Transaction = { ...transaction };
    let applied = 0;

    for (const rule of sorted) {
      if (checkConditions(rule, modified)) {
        modified = applyActions(rule, modified);
        applied++;
      }
    }

    // Änderungen sichern
    if (applied) {
      const updates: Partial<Transaction> = {};
      Object.keys(modified).forEach((k) => {
        // @ts-ignore
        if (k !== 'id' && k !== 'runningBalance' && modified[k] !== transaction[k]) {
          // @ts-ignore
          updates[k] = modified[k];
        }
      });
      if (Object.keys(updates).length) {
        TransactionService.updateTransaction(transaction.id, updates);
      }
    }

    debugLog('RuleStore', `${applied} Regeln auf Transaktion ${transaction.id} angewendet (Stage: ${stage})`);

    return modified;
  }

  function checkConditions(rule: AutomationRule, tx: Transaction): boolean {
    if (!rule.conditions?.length) return true;
    return rule.conditions.every((c) => {
      switch (c.type) {
        case RuleConditionType.ACCOUNT_IS:
          return tx.accountId === c.value;
        case RuleConditionType.PAYEE_EQUALS:
          return tx.payee === c.value;
        case RuleConditionType.PAYEE_CONTAINS:
          return tx.payee?.toLowerCase().includes(String(c.value).toLowerCase());
        case RuleConditionType.AMOUNT_EQUALS:
          return tx.amount === Number(c.value);
        case RuleConditionType.AMOUNT_GREATER:
          return tx.amount > Number(c.value);
        case RuleConditionType.AMOUNT_LESS:
          return tx.amount < Number(c.value);
        case RuleConditionType.DATE_IS:
          return tx.date === c.value;
        case RuleConditionType.DESCRIPTION_CONTAINS:
          return tx.note?.toLowerCase().includes(String(c.value).toLowerCase());
        default:
          return false;
      }
    });
  }

  function applyActions(rule: AutomationRule, tx: Transaction): Transaction {
    const out = { ...tx };
    rule.actions.forEach((a) => {
      switch (a.type) {
        case RuleActionType.SET_CATEGORY:
          out.categoryId = String(a.value);
          break;
        case RuleActionType.ADD_TAG:
          if (!out.tagIds) out.tagIds = [];
          if (Array.isArray(a.value))
            out.tagIds = [...new Set([...out.tagIds, ...a.value])];
          else if (!out.tagIds.includes(String(a.value)))
            out.tagIds.push(String(a.value));
          break;
        case RuleActionType.SET_NOTE:
          out.note = String(a.value);
          break;
      }
    });
    return out;
  }

  // -------------------------------------------------- Persistence ---------
  async function loadRules(fromSync: boolean = false) {
    try {
      const tenantDbService = new TenantDbService();
      const loadedRules = await tenantDbService.getRules();
      rules.value = loadedRules;
      debugLog('RuleStore', `${loadedRules.length} Regeln geladen`);
    } catch (error) {
      errorLog('RuleStore', 'Fehler beim Laden der Regeln', error);
      rules.value = [];
    }
  }

  async function reset() {
    rules.value = [];
    await loadRules();
  }

  // Initialisierung
  loadRules();

  return {
    /* state */
    rules,
    /* CRUD */
    addRule,
    getRuleById,
    updateRule,
    deleteRule,
    loadRules,
    /* engine */
    applyRulesToTransaction,
    /* util */
    reset,
  };
});
