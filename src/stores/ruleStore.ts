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
  async function addRule(ruleData: Omit<AutomationRule, 'updated_at'> | AutomationRule, fromSync: boolean = false): Promise<AutomationRule> {
    const ruleWithTimestamp: AutomationRule = {
      ...ruleData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updated_at: (ruleData as any).updated_at || new Date().toISOString(),
    };

    const tenantDbService = new TenantDbService();

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localRule = await tenantDbService.getRuleById(ruleWithTimestamp.id);
      if (localRule && localRule.updated_at && ruleWithTimestamp.updated_at &&
          new Date(localRule.updated_at) >= new Date(ruleWithTimestamp.updated_at)) {
        debugLog('RuleStore', `addRule (fromSync): Lokale Regel ${localRule.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localRule; // Gib die lokale, "gewinnende" Regel zurück
      }
      // Wenn eingehend neuer ist oder lokal nicht existiert, fahre fort mit DB-Update und Store-Update
      await tenantDbService.createRule(ruleWithTimestamp); // createRule ist wie put, überschreibt wenn ID existiert
      debugLog('RuleStore', `addRule (fromSync): Eingehende Regel ${ruleWithTimestamp.id} angewendet (neuer oder lokal nicht vorhanden).`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.createRule(ruleWithTimestamp);
    }

    const existingRuleIndex = rules.value.findIndex(r => r.id === ruleWithTimestamp.id);
    if (existingRuleIndex === -1) {
      rules.value.push(ruleWithTimestamp);
    } else {
      // LWW-Logik für den Store
      if (!fromSync || (ruleWithTimestamp.updated_at && (!rules.value[existingRuleIndex].updated_at || new Date(ruleWithTimestamp.updated_at) > new Date(rules.value[existingRuleIndex].updated_at!)))) {
        rules.value[existingRuleIndex] = ruleWithTimestamp;
      }
    }
    debugLog('RuleStore', `Regel "${ruleWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${ruleWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RULE,
          entityId: ruleWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: ruleWithTimestamp,
        });
        debugLog('RuleStore', `Regel "${ruleWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('RuleStore', `Fehler beim Hinzufügen von Regel "${ruleWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return ruleWithTimestamp;
  }

  const getRuleById = computed(() => {
    return (id: string) => rules.value.find((r) => r.id === id);
  });

  async function updateRule(ruleUpdatesData: AutomationRule, fromSync: boolean = false): Promise<boolean> {
    const ruleUpdatesWithTimestamp: AutomationRule = {
      ...ruleUpdatesData,
      updated_at: ruleUpdatesData.updated_at || new Date().toISOString(),
    };

    const tenantDbService = new TenantDbService();

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localRule = await tenantDbService.getRuleById(ruleUpdatesWithTimestamp.id);
      if (localRule && localRule.updated_at && ruleUpdatesWithTimestamp.updated_at &&
          new Date(localRule.updated_at) >= new Date(ruleUpdatesWithTimestamp.updated_at)) {
        debugLog('RuleStore', `updateRule (fromSync): Lokale Regel ${localRule.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        // Store mit lokalen Daten "auffrischen", falls er abweicht
        const storeIdx = rules.value.findIndex(r => r.id === localRule.id);
        if (storeIdx !== -1 && JSON.stringify(rules.value[storeIdx]) !== JSON.stringify(localRule)) {
          rules.value[storeIdx] = localRule;
        }
        return true; // Erfolgreich, aber lokale Daten beibehalten
      }
      // Wenn eingehend neuer ist, fahre fort mit DB-Update und Store-Update
      await tenantDbService.updateRule(ruleUpdatesWithTimestamp.id, ruleUpdatesWithTimestamp);
      debugLog('RuleStore', `updateRule (fromSync): Eingehende Regel ${ruleUpdatesWithTimestamp.id} angewendet (neuer).`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateRule(ruleUpdatesWithTimestamp.id, ruleUpdatesWithTimestamp);
    }

    // Store-Update mit LWW-Logik
    const existingRuleIndex = rules.value.findIndex(r => r.id === ruleUpdatesWithTimestamp.id);
    if (existingRuleIndex !== -1) {
      if (!fromSync || (ruleUpdatesWithTimestamp.updated_at && (!rules.value[existingRuleIndex].updated_at || new Date(ruleUpdatesWithTimestamp.updated_at) > new Date(rules.value[existingRuleIndex].updated_at!)))) {
        rules.value[existingRuleIndex] = ruleUpdatesWithTimestamp;
      }
    }
    debugLog('RuleStore', `Regel "${ruleUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${ruleUpdatesWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RULE,
          entityId: ruleUpdatesWithTimestamp.id,
          operationType: SyncOperationType.UPDATE,
          payload: ruleUpdatesWithTimestamp,
        });
        debugLog('RuleStore', `Regel "${ruleUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
      } catch (e) {
        errorLog('RuleStore', `Fehler beim Hinzufügen von Regel "${ruleUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return true;
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

  // WebSocket-Sync-Message-Handler
  function handleSyncMessage(operation: SyncOperationType, rule: AutomationRule) {
    debugLog('RuleStore', `handleSyncMessage: ${operation} für Regel ${rule.id}`, rule);

    switch (operation) {
      case SyncOperationType.CREATE:
        addRule(rule, true); // fromSync = true
        break;
      case SyncOperationType.UPDATE:
        updateRule(rule, true); // fromSync = true
        break;
      case SyncOperationType.DELETE:
        deleteRule(rule.id, true); // fromSync = true
        break;
      default:
        errorLog('RuleStore', `Unbekannte Sync-Operation: ${operation}`, { rule });
    }
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
    /* sync */
    handleSyncMessage,
    /* util */
    reset,
  };
});
