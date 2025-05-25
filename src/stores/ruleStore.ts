// Datei: src/stores/ruleStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import {
  AutomationRule,
  RuleConditionType,
  RuleActionType,
  Transaction,
} from '../types';
import { debugLog } from '@/utils/logger';
import { TransactionService } from '@/services/TransactionService'; // neu

export const useRuleStore = defineStore('rule', () => {
  /** Alle Regeln */
  const rules = ref<AutomationRule[]>([]);

  // ------------------------------------------------------------------ CRUD
  function addRule(rule: Omit<AutomationRule, 'id'>) {
    const newRule: AutomationRule = { ...rule, id: uuidv4() };
    rules.value.push(newRule);
    saveRules();
    debugLog('[ruleStore] addRule', newRule);
    return newRule;
  }

  const getRuleById = computed(() => {
    return (id: string) => rules.value.find((r) => r.id === id);
  });

  function updateRule(id: string, updates: Partial<AutomationRule>) {
    const idx = rules.value.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    rules.value[idx] = { ...rules.value[idx], ...updates };
    saveRules();
    debugLog('[ruleStore] updateRule', { id, updates });
    return true;
  }

  function deleteRule(id: string) {
    rules.value = rules.value.filter((r) => r.id !== id);
    saveRules();
    debugLog('[ruleStore] deleteRule', id);
    return true;
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

    debugLog('[ruleStore] applyRulesToTransaction', {
      transactionId: transaction.id,
      stage,
      rulesApplied: applied,
    });

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
  function saveRules() {
    localStorage.setItem('finwise_rules', JSON.stringify(rules.value));
  }
  function loadRules() {
    const saved = localStorage.getItem('finwise_rules');
    if (saved) {
      try {
        rules.value = JSON.parse(saved);
        debugLog('[ruleStore] loadRules', rules.value.length);
      } catch (e) {
        debugLog('[ruleStore] loadRules error', e);
        rules.value = [];
      }
    }
  }

  function reset() {
    rules.value = [];
    loadRules();
  }

  loadRules();

  return {
    /* state */
    rules,
    /* CRUD */
    addRule,
    getRuleById,
    updateRule,
    deleteRule,
    /* engine */
    applyRulesToTransaction,
    /* util */
    reset,
  };
});
