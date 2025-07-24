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
import { debugLog, errorLog, warnLog } from '@/utils/logger';
import { TransactionService } from '@/services/TransactionService';
import { TenantDbService } from '@/services/TenantDbService';
import { useRecipientStore } from '@/stores/recipientStore';

export const useRuleStore = defineStore('rule', () => {
  /** Alle Regeln */
  const rules = ref<AutomationRule[]>([]);

  // ------------------------------------------------------------------ CRUD
  async function addRule(ruleData: Omit<AutomationRule, 'updated_at' | 'id'> & Partial<Pick<AutomationRule, 'id'>> | AutomationRule, fromSync: boolean = false): Promise<AutomationRule> {
    const ruleWithTimestamp: AutomationRule = {
      ...ruleData,
      // Generiere ID falls nicht vorhanden (für neue Rules)
      id: ruleData.id || uuidv4(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: (ruleData as any).updatedAt || new Date().toISOString(),
    };

    const tenantDbService = new TenantDbService();

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localRule = await tenantDbService.getRuleById(ruleWithTimestamp.id);
      if (localRule && localRule.updatedAt && ruleWithTimestamp.updatedAt &&
          new Date(localRule.updatedAt) >= new Date(ruleWithTimestamp.updatedAt)) {
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
      if (!fromSync || (ruleWithTimestamp.updatedAt && (!rules.value[existingRuleIndex].updatedAt || new Date(ruleWithTimestamp.updatedAt) > new Date(rules.value[existingRuleIndex].updatedAt!)))) {
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
          payload: tenantDbService.toPlainObject(ruleWithTimestamp),
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

  async function updateRule(id: string, ruleUpdatesData: Omit<AutomationRule, 'id'>, fromSync: boolean = false): Promise<boolean> {
    const ruleUpdatesWithTimestamp: AutomationRule = {
      ...ruleUpdatesData,
      id,
      updatedAt: ruleUpdatesData.updatedAt || new Date().toISOString(),
    };

    const tenantDbService = new TenantDbService();

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localRule = await tenantDbService.getRuleById(ruleUpdatesWithTimestamp.id);
      if (localRule && localRule.updatedAt && ruleUpdatesWithTimestamp.updatedAt &&
          new Date(localRule.updatedAt) >= new Date(ruleUpdatesWithTimestamp.updatedAt)) {
        debugLog('RuleStore', `updateRule (fromSync): Lokale Regel ${localRule.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        // Store mit lokalen Daten "auffrischen", falls er abweicht
        const storeIdx = rules.value.findIndex(r => r.id === localRule.id);
        if (storeIdx !== -1 && JSON.stringify(rules.value[storeIdx]) !== JSON.stringify(localRule)) {
          rules.value[storeIdx] = localRule;
        }
        return true; // Erfolgreich, aber lokale Daten beibehalten
      }
      // Wenn eingehend neuer ist, fahre fort mit DB-Update und Store-Update
      await tenantDbService.updateRule(ruleUpdatesWithTimestamp.id, { ...ruleUpdatesWithTimestamp });
      debugLog('RuleStore', `updateRule (fromSync): Eingehende Regel ${ruleUpdatesWithTimestamp.id} angewendet (neuer).`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateRule(ruleUpdatesWithTimestamp.id, { ...ruleUpdatesWithTimestamp });
    }

    // Store-Update mit LWW-Logik
    const existingRuleIndex = rules.value.findIndex(r => r.id === ruleUpdatesWithTimestamp.id);
    if (existingRuleIndex !== -1) {
      if (!fromSync || (ruleUpdatesWithTimestamp.updatedAt && (!rules.value[existingRuleIndex].updatedAt || new Date(ruleUpdatesWithTimestamp.updatedAt) > new Date(rules.value[existingRuleIndex].updatedAt!)))) {
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
          payload: tenantDbService.toPlainObject(ruleUpdatesWithTimestamp),
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
      if (checkConditions(rule.conditions, modified)) {
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

  function checkConditions(conditions: any[], tx: Transaction): boolean {
    if (!conditions?.length) return true;

    debugLog('RuleStore', `checkConditions: Prüfe ${conditions.length} Bedingungen für Transaktion`, {
      txId: tx.id,
      payee: tx.payee,
      originalRecipientName: (tx as any).originalRecipientName,
      amount: tx.amount,
      conditions: conditions.map(c => ({ source: c.source, operator: c.operator, value: c.value }))
    });

    // Die `checkConditions`-Logik aus der RuleForm.vue sollte hierher verschoben werden,
    // um Konsistenz zu gewährleisten. Ich übernehme die Logik von dort.
    return conditions.every((condition) => {
      const source = (condition as any).source || ''; // Cast to any for source
      const operator = condition.operator || 'is';
      const value = condition.value;

      let txValue: any = null;

      switch (source) {
        case 'account':
          txValue = tx.accountId;
          break;
        case 'recipient':
          // Verwende payee für Empfänger-Bedingungen (nicht recipientId)
          txValue = tx.payee || '';
          break;
        case 'originalRecipient': // Neue Bedingung für CSV-Import
          txValue = (tx as any).originalRecipientName || tx.payee || '';
          break;
        case 'amount':
          txValue = tx.amount;
          break;
        case 'date':
          txValue = tx.date;
          break;
        case 'valueDate':
          txValue = tx.valueDate || tx.date;
          break;
        case 'description':
          txValue = tx.note || '';
          break;
        case 'category':
          // Für Kategorie-Bedingungen: erst originalCategory, dann categoryId
          if (condition.operator === 'is' && value === 'NO_CATEGORY') {
            return !tx.categoryId && !(tx as any).originalCategory;
          }
          txValue = (tx as any).originalCategory || tx.categoryId || '';
          break;
        default:
          // Fallback für alte Regeltypen ohne 'source'
          switch (condition.type) {
            case RuleConditionType.ACCOUNT_IS:
              return tx.accountId === value;
            case RuleConditionType.RECIPIENT_EQUALS:
               return (tx.payee || '').toLowerCase() === String(value).toLowerCase();
            case RuleConditionType.RECIPIENT_CONTAINS:
               return (tx.payee || '').toLowerCase().includes(String(value).toLowerCase());
            case RuleConditionType.AMOUNT_EQUALS:
              return tx.amount === Number(value);
            case RuleConditionType.AMOUNT_GREATER:
              return tx.amount > Number(value);
            case RuleConditionType.AMOUNT_LESS:
              return tx.amount < Number(value);
            case RuleConditionType.DATE_IS:
              return tx.date === value;
            case RuleConditionType.DESCRIPTION_CONTAINS:
              return (tx.note || '').toLowerCase().includes(String(value).toLowerCase());
            default:
              return false;
          }
      }

      // Neue, vereinheitlichte Logik
      if (source === 'category' && operator === 'is') {
        if (value === 'NO_CATEGORY') {
          return !tx.categoryId;
        }
        return tx.categoryId === value;
      }

      if (source === 'account' && operator === 'is') {
        return tx.accountId === value;
      }

      if ((source === 'date' || source === 'valueDate') && ['is', 'greater', 'greater_equal', 'less', 'less_equal'].includes(operator)) {
        const txDate = new Date(txValue);
        const compareDate = new Date(value as string);
        if (operator === 'is') return txDate.getTime() === compareDate.getTime();
        if (operator === 'greater') return txDate > compareDate;
        if (operator === 'greater_equal') return txDate >= compareDate;
        if (operator === 'less') return txDate < compareDate;
        if (operator === 'less_equal') return txDate <= compareDate;
      }

      // Debug-Log für jede Bedingung
      let result = false;
      switch (operator) {
        case 'is':
          result = String(txValue).toLowerCase() === String(value).toLowerCase();
          break;
        case 'contains':
          result = String(txValue).toLowerCase().includes(String(value).toLowerCase());
          break;
        case 'starts_with':
          result = String(txValue).toLowerCase().startsWith(String(value).toLowerCase());
          break;
        case 'ends_with':
          result = String(txValue).toLowerCase().endsWith(String(value).toLowerCase());
          break;
        case 'greater':
          result = Number(txValue) > Number(value);
          break;
        case 'greater_equal':
          result = Number(txValue) >= Number(value);
          break;
        case 'less':
          result = Number(txValue) < Number(value);
          break;
        case 'less_equal':
          result = Number(txValue) <= Number(value);
          break;
        case 'approx':
          const txNum = Number(txValue);
          const valNum = Number(value);
          const tolerance = Math.abs(valNum * 0.1);
          result = Math.abs(txNum - valNum) <= tolerance;
          break;
        default:
          result = false;
      }

      debugLog('RuleStore', `Bedingung: ${source} ${operator} "${value}" | txValue: "${txValue}" | Ergebnis: ${result}`);
      return result;
    });
  }

  function applyActions(rule: AutomationRule, tx: Transaction): Transaction {
    const out = { ...tx };
    rule.actions.forEach((a) => {
      switch (a.type) {
        case RuleActionType.SET_CATEGORY:
          // Transferbuchungen und Kategorie-Transfers ignorieren
          if (!tx.isCategoryTransfer && !tx.counterTransactionId) {
            out.categoryId = String(a.value);
            // Für CSV-Import: Flag setzen, um automatisches Kategorie-Matching zu überspringen
            if ('_skipAutoCategoryMatching' in out) {
              (out as any)._skipAutoCategoryMatching = true;
            }
          }
          break;
        case RuleActionType.SET_RECIPIENT:
          // Suche Empfänger nach Name
          const recipientStore = useRecipientStore();
          debugLog('RuleStore', `SET_RECIPIENT: Suche Empfänger mit Wert "${a.value}" (Typ: ${typeof a.value})`);
          debugLog('RuleStore', `Verfügbare Empfänger: ${recipientStore.recipients.map((r: any) => `"${r.name}" (${r.id})`).join(', ')}`);

          // Prüfe ob der Wert bereits eine UUID ist (dann ist es eine ID, nicht ein Name)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(a.value));

          let recipient;
          if (isUUID) {
            // Suche nach ID
            recipient = recipientStore.recipients.find((r: any) => r.id === String(a.value));
            debugLog('RuleStore', `Suche nach ID: ${a.value}, gefunden: ${recipient ? recipient.name : 'nicht gefunden'}`);
          } else {
            // Suche nach Name
            recipient = recipientStore.recipients.find((r: any) =>
              r.name.toLowerCase() === String(a.value).toLowerCase()
            );
            debugLog('RuleStore', `Suche nach Name: ${a.value}, gefunden: ${recipient ? recipient.name : 'nicht gefunden'}`);
          }

          if (recipient) {
            out.recipientId = recipient.id;
            // Für CSV-Import: Flag setzen, um automatisches Empfänger-Matching zu überspringen
            if ('_skipAutoRecipientMatching' in out) {
              (out as any)._skipAutoRecipientMatching = true;
            }
            debugLog('RuleStore', `Regel "${rule.name}" setzte Empfänger: ${recipient.name} (${recipient.id})`);
          } else {
            warnLog('RuleStore', `Regel "${rule.name}" konnte Empfänger "${a.value}" nicht finden`);
          }
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
        updateRule(rule.id, rule, true); // fromSync = true
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
    checkConditions,
    applyActions,
    /* sync */
    handleSyncMessage,
    /* util */
    reset,
  };
});
