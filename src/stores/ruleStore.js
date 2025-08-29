// Datei: src/stores/ruleStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { RuleConditionType, RuleActionType, EntityTypeEnum, SyncOperationType, } from '../types';
import { debugLog, errorLog, warnLog } from '@/utils/logger';
import { TransactionService } from '@/services/TransactionService';
import { TenantDbService } from '@/services/TenantDbService';
import { useRecipientStore } from '@/stores/recipientStore';
export const useRuleStore = defineStore('rule', () => {
    /** Alle Regeln */
    const rules = ref([]);
    // ------------------------------------------------------------------ CRUD
    async function addRule(ruleData, fromSync = false) {
        const ruleWithTimestamp = {
            ...ruleData,
            // Generiere ID falls nicht vorhanden (für neue Rules)
            id: ruleData.id || uuidv4(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedAt: ruleData.updatedAt || new Date().toISOString(),
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
        }
        else { // Lokale Änderung (!fromSync)
            await tenantDbService.createRule(ruleWithTimestamp);
        }
        const existingRuleIndex = rules.value.findIndex(r => r.id === ruleWithTimestamp.id);
        if (existingRuleIndex === -1) {
            rules.value.push(ruleWithTimestamp);
        }
        else {
            // LWW-Logik für den Store
            if (!fromSync || (ruleWithTimestamp.updatedAt && (!rules.value[existingRuleIndex].updatedAt || new Date(ruleWithTimestamp.updatedAt) > new Date(rules.value[existingRuleIndex].updatedAt)))) {
                rules.value[existingRuleIndex] = ruleWithTimestamp;
            }
        }
        debugLog('RuleStore', `Regel "${ruleWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${ruleWithTimestamp.id}).`);
        // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
        if (!fromSync) {
            try {
                // Feldmapping: updatedAt -> updated_at für Backend-Kompatibilität
                const backendPayload = {
                    ...tenantDbService.toPlainObject(ruleWithTimestamp),
                    updated_at: ruleWithTimestamp.updatedAt
                };
                // Entferne das Frontend-Feld
                delete backendPayload.updatedAt;
                await tenantDbService.addSyncQueueEntry({
                    entityType: EntityTypeEnum.RULE,
                    entityId: ruleWithTimestamp.id,
                    operationType: SyncOperationType.CREATE,
                    payload: backendPayload,
                });
                debugLog('RuleStore', `Regel "${ruleWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
            }
            catch (e) {
                errorLog('RuleStore', `Fehler beim Hinzufügen von Regel "${ruleWithTimestamp.name}" zur Sync Queue.`, e);
            }
        }
        return ruleWithTimestamp;
    }
    const getRuleById = computed(() => {
        return (id) => rules.value.find((r) => r.id === id);
    });
    async function updateRule(id, ruleUpdatesData, fromSync = false) {
        const ruleUpdatesWithTimestamp = {
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
        }
        else { // Lokale Änderung (!fromSync)
            await tenantDbService.updateRule(ruleUpdatesWithTimestamp.id, { ...ruleUpdatesWithTimestamp });
        }
        // Store-Update mit LWW-Logik
        const existingRuleIndex = rules.value.findIndex(r => r.id === ruleUpdatesWithTimestamp.id);
        if (existingRuleIndex !== -1) {
            if (!fromSync || (ruleUpdatesWithTimestamp.updatedAt && (!rules.value[existingRuleIndex].updatedAt || new Date(ruleUpdatesWithTimestamp.updatedAt) > new Date(rules.value[existingRuleIndex].updatedAt)))) {
                rules.value[existingRuleIndex] = ruleUpdatesWithTimestamp;
            }
        }
        debugLog('RuleStore', `Regel "${ruleUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${ruleUpdatesWithTimestamp.id}).`);
        // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
        if (!fromSync) {
            try {
                // Feldmapping: updatedAt -> updated_at für Backend-Kompatibilität
                const backendPayload = {
                    ...tenantDbService.toPlainObject(ruleUpdatesWithTimestamp),
                    updated_at: ruleUpdatesWithTimestamp.updatedAt
                };
                // Entferne das Frontend-Feld
                delete backendPayload.updatedAt;
                await tenantDbService.addSyncQueueEntry({
                    entityType: EntityTypeEnum.RULE,
                    entityId: ruleUpdatesWithTimestamp.id,
                    operationType: SyncOperationType.UPDATE,
                    payload: backendPayload,
                });
                debugLog('RuleStore', `Regel "${ruleUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
            }
            catch (e) {
                errorLog('RuleStore', `Fehler beim Hinzufügen von Regel "${ruleUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
            }
        }
        return true;
    }
    async function deleteRule(id, fromSync = false) {
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
        }
        catch (error) {
            errorLog('RuleStore', 'Fehler beim Löschen der Regel', error);
            return false;
        }
    }
    // ------------------------------------------------ Regel‑Engine ---------
    function applyRulesToTransaction(transaction, stage = 'DEFAULT') {
        // Rules nur auf EXPENSE und INCOME Transaktionen anwenden
        if (transaction.type !== 'EXPENSE' && transaction.type !== 'INCOME') {
            debugLog('RuleStore', `Regelanwendung übersprungen für Transaktionstyp: ${transaction.type} (ID: ${transaction.id})`);
            return transaction;
        }
        const sorted = [...rules.value]
            .filter((r) => r.isActive && r.stage === stage)
            .sort((a, b) => a.priority - b.priority);
        let modified = { ...transaction };
        let applied = 0;
        for (const rule of sorted) {
            if (checkConditions(rule.conditions, modified, rule)) {
                modified = applyActions(rule, modified);
                applied++;
            }
        }
        // Änderungen sichern
        if (applied) {
            const updates = {};
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
    function checkConditions(conditions, tx, rule) {
        if (!conditions?.length)
            return true;
        // Rules nur auf EXPENSE und INCOME Transaktionen anwenden
        if (tx.type !== 'EXPENSE' && tx.type !== 'INCOME') {
            debugLog('RuleStore', `checkConditions: Übersprungen für Transaktionstyp: ${tx.type} (ID: ${tx.id})`);
            return false;
        }
        debugLog('RuleStore', `checkConditions: Prüfe ${conditions.length} Bedingungen für Transaktion`, {
            txId: tx.id,
            payee: tx.payee,
            originalRecipientName: tx.originalRecipientName,
            amount: tx.amount,
            conditions: conditions.map(c => ({ source: c.source, operator: c.operator, value: c.value })),
            conditionLogic: rule?.conditionLogic || 'all'
        });
        // Bestimme die Verknüpfungslogik: 'all' (UND) oder 'any' (ODER)
        // Fallback auf 'all', wenn conditionLogic nicht vorhanden ist
        const logic = rule?.conditionLogic || 'all';
        // Evaluiere jede Bedingung einzeln
        const conditionResults = conditions.map((condition) => {
            const source = condition.source || ''; // Cast to any for source
            const operator = condition.operator || 'is';
            const value = condition.value;
            let txValue = null;
            switch (source) {
                case 'account':
                    txValue = tx.accountId;
                    break;
                case 'recipient':
                    // Verwende payee für Empfänger-Bedingungen (nicht recipientId)
                    txValue = tx.payee || '';
                    break;
                case 'originalRecipient': // Neue Bedingung für CSV-Import
                    txValue = tx.originalRecipientName || tx.payee || '';
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
                        return !tx.categoryId && !tx.originalCategory;
                    }
                    txValue = tx.originalCategory || tx.categoryId || '';
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
                const compareDate = new Date(value);
                if (operator === 'is')
                    return txDate.getTime() === compareDate.getTime();
                if (operator === 'greater')
                    return txDate > compareDate;
                if (operator === 'greater_equal')
                    return txDate >= compareDate;
                if (operator === 'less')
                    return txDate < compareDate;
                if (operator === 'less_equal')
                    return txDate <= compareDate;
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
                case 'one_of':
                    if (!Array.isArray(condition.value)) {
                        console.warn(`Regel-Engine: 'one_of' Operator erwartet Array-Wert, aber erhielt: ${typeof condition.value}`, {
                            ruleId: rule?.id,
                            ruleName: rule?.name,
                            conditionValue: condition.value,
                            source: source,
                            operator: operator
                        });
                        result = false;
                    }
                    else {
                        result = value.includes(String(txValue));
                    }
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
        // Wende die Verknüpfungslogik an
        const finalResult = logic === 'any'
            ? conditionResults.some(result => result === true)
            : conditionResults.every(result => result === true);
        debugLog('RuleStore', `checkConditions Endergebnis: ${finalResult} (Logik: ${logic}, Ergebnisse: [${conditionResults.join(', ')}])`);
        return finalResult;
    }
    function applyActions(rule, tx) {
        const out = { ...tx };
        rule.actions.forEach((a) => {
            switch (a.type) {
                case RuleActionType.SET_CATEGORY:
                    // Transferbuchungen und Kategorie-Transfers ignorieren
                    if (!tx.isCategoryTransfer && !tx.counterTransactionId) {
                        out.categoryId = String(a.value);
                        // Für CSV-Import: Flag setzen, um automatisches Kategorie-Matching zu überspringen
                        if ('_skipAutoCategoryMatching' in out) {
                            out._skipAutoCategoryMatching = true;
                        }
                    }
                    break;
                case RuleActionType.SET_RECIPIENT:
                    // Suche Empfänger nach Name
                    const recipientStore = useRecipientStore();
                    debugLog('RuleStore', `SET_RECIPIENT: Suche Empfänger mit Wert "${a.value}" (Typ: ${typeof a.value})`);
                    debugLog('RuleStore', `Verfügbare Empfänger: ${recipientStore.recipients.map((r) => `"${r.name}" (${r.id})`).join(', ')}`);
                    // Prüfe ob der Wert bereits eine UUID ist (dann ist es eine ID, nicht ein Name)
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(a.value));
                    let recipient;
                    if (isUUID) {
                        // Suche nach ID
                        recipient = recipientStore.recipients.find((r) => r.id === String(a.value));
                        debugLog('RuleStore', `Suche nach ID: ${a.value}, gefunden: ${recipient ? recipient.name : 'nicht gefunden'}`);
                    }
                    else {
                        // Suche nach Name
                        recipient = recipientStore.recipients.find((r) => r.name.toLowerCase() === String(a.value).toLowerCase());
                        debugLog('RuleStore', `Suche nach Name: ${a.value}, gefunden: ${recipient ? recipient.name : 'nicht gefunden'}`);
                    }
                    if (recipient) {
                        out.recipientId = recipient.id;
                        // Für CSV-Import: Flag setzen, um automatisches Empfänger-Matching zu überspringen
                        if ('_skipAutoRecipientMatching' in out) {
                            out._skipAutoRecipientMatching = true;
                        }
                        debugLog('RuleStore', `Regel "${rule.name}" setzte Empfänger: ${recipient.name} (${recipient.id})`);
                    }
                    else {
                        warnLog('RuleStore', `Regel "${rule.name}" konnte Empfänger "${a.value}" nicht finden`);
                    }
                    break;
                case RuleActionType.ADD_TAG:
                    if (!out.tagIds)
                        out.tagIds = [];
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
    async function loadRules(fromSync = false) {
        try {
            const tenantDbService = new TenantDbService();
            const loadedRules = await tenantDbService.getRules();
            rules.value = loadedRules;
            debugLog('RuleStore', `${loadedRules.length} Regeln geladen`);
        }
        catch (error) {
            errorLog('RuleStore', 'Fehler beim Laden der Regeln', error);
            rules.value = [];
        }
    }
    async function reset() {
        rules.value = [];
        await loadRules();
    }
    // WebSocket-Sync-Message-Handler
    function handleSyncMessage(operation, rule) {
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
    // ------------------------------------------------ Recipient-Referenz-Updates ------
    /**
     * Aktualisiert Recipient-Referenzen in AutomationRules nach einem Merge
     * Wird vom recipientStore bei Merge-Operationen aufgerufen
     */
    async function updateRecipientReferences(oldRecipientIds, newRecipientId) {
        debugLog('RuleStore', `Starte Recipient-Referenz-Updates: ${oldRecipientIds.length} alte IDs → ${newRecipientId}`);
        if (!oldRecipientIds.length || !newRecipientId) {
            warnLog('RuleStore', 'Ungültige Parameter für updateRecipientReferences', { oldRecipientIds, newRecipientId });
            return;
        }
        let updatedCount = 0;
        let errorCount = 0;
        try {
            // Finde alle Rules mit Recipient-Referenzen
            const rulesToUpdate = rules.value.filter(rule => {
                // Prüfe Conditions auf Recipient-Referenzen
                const hasRecipientCondition = rule.conditions.some(condition => (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
                    condition.type === RuleConditionType.RECIPIENT_CONTAINS) &&
                    oldRecipientIds.includes(String(condition.value)));
                // Prüfe Actions auf Recipient-Referenzen
                const hasRecipientAction = rule.actions.some(action => action.type === RuleActionType.SET_RECIPIENT &&
                    oldRecipientIds.includes(String(action.value)));
                return hasRecipientCondition || hasRecipientAction;
            });
            debugLog('RuleStore', `Gefunden: ${rulesToUpdate.length} Rules mit Recipient-Referenzen`);
            // Aktualisiere jede betroffene Rule
            for (const rule of rulesToUpdate) {
                try {
                    const updatedRule = {
                        ...rule,
                        conditions: rule.conditions.map(condition => {
                            if ((condition.type === RuleConditionType.RECIPIENT_EQUALS ||
                                condition.type === RuleConditionType.RECIPIENT_CONTAINS) &&
                                oldRecipientIds.includes(String(condition.value))) {
                                return { ...condition, value: newRecipientId };
                            }
                            return condition;
                        }),
                        actions: rule.actions.map(action => {
                            if (action.type === RuleActionType.SET_RECIPIENT &&
                                oldRecipientIds.includes(String(action.value))) {
                                return { ...action, value: newRecipientId };
                            }
                            return action;
                        }),
                        updatedAt: new Date().toISOString()
                    };
                    // Verwende updateRule für konsistente Store- und Sync-Integration
                    const success = await updateRule(updatedRule.id, updatedRule);
                    if (success) {
                        updatedCount++;
                        debugLog('RuleStore', `Rule "${rule.name}" (${rule.id}) erfolgreich aktualisiert`);
                    }
                    else {
                        errorCount++;
                        warnLog('RuleStore', `Fehler beim Aktualisieren von Rule "${rule.name}" (${rule.id})`);
                    }
                }
                catch (error) {
                    errorCount++;
                    errorLog('RuleStore', `Fehler beim Aktualisieren von Rule "${rule.name}" (${rule.id})`, error);
                }
            }
            // Zusammenfassung loggen
            if (updatedCount > 0) {
                debugLog('RuleStore', `Recipient-Referenz-Update abgeschlossen: ${updatedCount} Rules erfolgreich aktualisiert`);
            }
            if (errorCount > 0) {
                warnLog('RuleStore', `Recipient-Referenz-Update: ${errorCount} Fehler aufgetreten`);
            }
        }
        catch (error) {
            errorLog('RuleStore', 'Kritischer Fehler bei Recipient-Referenz-Updates', error);
            throw error;
        }
    }
    // ------------------------------------------------ Recipient-Validierung und -Bereinigung ------
    /**
     * Findet alle AutomationRules die einen bestimmten Recipient referenzieren
     * @param recipientId Die zu suchende Recipient-ID
     * @returns Promise<AutomationRule[]> Array der gefundenen AutomationRules
     */
    async function getAutomationRulesWithRecipient(recipientId) {
        debugLog('RuleStore', 'getAutomationRulesWithRecipient gestartet', { recipientId });
        if (!recipientId) {
            warnLog('RuleStore', 'getAutomationRulesWithRecipient: Keine recipientId angegeben');
            return [];
        }
        try {
            const matchingRules = rules.value.filter(rule => {
                // Prüfe Conditions auf Recipient-Referenzen
                const hasRecipientCondition = rule.conditions.some(condition => {
                    if (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
                        condition.type === RuleConditionType.RECIPIENT_CONTAINS) {
                        // Prüfe sowohl direkte ID-Referenz als auch Name-Referenz
                        const conditionValue = String(condition.value);
                        return conditionValue === recipientId;
                    }
                    return false;
                });
                // Prüfe Actions auf Recipient-Referenzen
                const hasRecipientAction = rule.actions.some(action => {
                    if (action.type === RuleActionType.SET_RECIPIENT) {
                        const actionValue = String(action.value);
                        return actionValue === recipientId;
                    }
                    return false;
                });
                return hasRecipientCondition || hasRecipientAction;
            });
            debugLog('RuleStore', `Gefunden: ${matchingRules.length} AutomationRules mit Recipient-Referenzen`, {
                recipientId,
                ruleIds: matchingRules.map(rule => rule.id),
                ruleNames: matchingRules.map(rule => rule.name)
            });
            return matchingRules;
        }
        catch (error) {
            errorLog('RuleStore', 'Fehler bei getAutomationRulesWithRecipient', {
                recipientId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Zählt die Anzahl der AutomationRules die einen bestimmten Recipient referenzieren
     * @param recipientId Die zu suchende Recipient-ID
     * @returns Promise<number> Anzahl der gefundenen AutomationRules
     */
    async function countAutomationRulesWithRecipient(recipientId) {
        debugLog('RuleStore', 'countAutomationRulesWithRecipient gestartet', { recipientId });
        if (!recipientId) {
            warnLog('RuleStore', 'countAutomationRulesWithRecipient: Keine recipientId angegeben');
            return 0;
        }
        try {
            let count = 0;
            for (const rule of rules.value) {
                // Prüfe Conditions auf Recipient-Referenzen
                const hasRecipientCondition = rule.conditions.some(condition => {
                    if (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
                        condition.type === RuleConditionType.RECIPIENT_CONTAINS) {
                        const conditionValue = String(condition.value);
                        return conditionValue === recipientId;
                    }
                    return false;
                });
                // Prüfe Actions auf Recipient-Referenzen
                const hasRecipientAction = rule.actions.some(action => {
                    if (action.type === RuleActionType.SET_RECIPIENT) {
                        const actionValue = String(action.value);
                        return actionValue === recipientId;
                    }
                    return false;
                });
                if (hasRecipientCondition || hasRecipientAction) {
                    count++;
                }
            }
            debugLog('RuleStore', `Anzahl AutomationRules mit Recipient-Referenzen: ${count}`, { recipientId });
            return count;
        }
        catch (error) {
            errorLog('RuleStore', 'Fehler bei countAutomationRulesWithRecipient', {
                recipientId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Validiert die Löschung von Recipients durch Prüfung auf aktive Referenzen in AutomationRules
     * @param recipientIds Array der zu validierenden Recipient-IDs
     * @returns Promise<RecipientValidationResult[]> Validierungsergebnisse pro Recipient
     */
    async function validateRecipientDeletion(recipientIds) {
        debugLog('RuleStore', 'validateRecipientDeletion gestartet', {
            recipientIds,
            recipientCount: recipientIds.length
        });
        if (!recipientIds.length) {
            warnLog('RuleStore', 'validateRecipientDeletion: Keine recipientIds angegeben');
            return [];
        }
        try {
            const recipientStore = useRecipientStore();
            const results = [];
            for (const recipientId of recipientIds) {
                const recipient = recipientStore.getRecipientById(recipientId);
                const recipientName = recipient?.name || `Unbekannter Recipient (${recipientId})`;
                debugLog('RuleStore', `Validiere Recipient: ${recipientName} (${recipientId})`);
                // Zähle AutomationRules mit diesem Recipient
                const automationRuleCount = await countAutomationRulesWithRecipient(recipientId);
                const hasActiveReferences = automationRuleCount > 0;
                const warnings = [];
                if (hasActiveReferences) {
                    warnings.push(`${automationRuleCount} AutomationRule(s) verwenden diesen Recipient`);
                }
                const validationResult = {
                    recipientId,
                    recipientName,
                    hasActiveReferences,
                    transactionCount: 0, // Wird vom TransactionService gesetzt
                    planningTransactionCount: 0, // Wird vom PlanningService gesetzt
                    automationRuleCount,
                    canDelete: !hasActiveReferences,
                    warnings
                };
                results.push(validationResult);
                debugLog('RuleStore', `Validierung für ${recipientName} abgeschlossen`, {
                    recipientId,
                    automationRuleCount,
                    hasActiveReferences,
                    canDelete: validationResult.canDelete
                });
            }
            debugLog('RuleStore', 'validateRecipientDeletion abgeschlossen', {
                totalRecipients: recipientIds.length,
                recipientsWithReferences: results.filter(r => r.hasActiveReferences).length,
                recipientsCanDelete: results.filter(r => r.canDelete).length
            });
            return results;
        }
        catch (error) {
            errorLog('RuleStore', 'Fehler bei validateRecipientDeletion', {
                recipientIds,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Bereinigt Recipient-Referenzen aus AutomationRules bei Recipient-Löschung
     * @param recipientId Die ID des zu löschenden Recipients
     * @returns Promise<void>
     */
    async function cleanupRecipientReferences(recipientId) {
        debugLog('RuleStore', 'cleanupRecipientReferences gestartet', { recipientId });
        if (!recipientId) {
            warnLog('RuleStore', 'cleanupRecipientReferences: Keine recipientId angegeben');
            return;
        }
        try {
            // Finde alle betroffenen Rules
            const affectedRules = await getAutomationRulesWithRecipient(recipientId);
            if (!affectedRules.length) {
                debugLog('RuleStore', 'Keine AutomationRules mit Recipient-Referenzen gefunden', { recipientId });
                return;
            }
            debugLog('RuleStore', `Starte Bereinigung von ${affectedRules.length} AutomationRules`, {
                recipientId,
                ruleIds: affectedRules.map(rule => rule.id)
            });
            let updatedCount = 0;
            let deactivatedCount = 0;
            let errorCount = 0;
            for (const rule of affectedRules) {
                try {
                    // Bereinige Conditions
                    const cleanedConditions = rule.conditions.filter(condition => {
                        if (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
                            condition.type === RuleConditionType.RECIPIENT_CONTAINS) {
                            const conditionValue = String(condition.value);
                            if (conditionValue === recipientId) {
                                debugLog('RuleStore', `Entferne Recipient-Condition aus Rule "${rule.name}"`, {
                                    ruleId: rule.id,
                                    conditionType: condition.type,
                                    conditionValue
                                });
                                return false; // Condition entfernen
                            }
                        }
                        return true; // Condition beibehalten
                    });
                    // Bereinige Actions
                    const cleanedActions = rule.actions.filter(action => {
                        if (action.type === RuleActionType.SET_RECIPIENT) {
                            const actionValue = String(action.value);
                            if (actionValue === recipientId) {
                                debugLog('RuleStore', `Entferne SET_RECIPIENT-Action aus Rule "${rule.name}"`, {
                                    ruleId: rule.id,
                                    actionValue
                                });
                                return false; // Action entfernen
                            }
                        }
                        return true; // Action beibehalten
                    });
                    // Prüfe ob Rule noch funktionsfähig ist
                    const hasConditions = cleanedConditions.length > 0;
                    const hasActions = cleanedActions.length > 0;
                    const shouldDeactivate = !hasConditions || !hasActions;
                    const updatedRule = {
                        ...rule,
                        conditions: cleanedConditions,
                        actions: cleanedActions,
                        isActive: shouldDeactivate ? false : rule.isActive,
                        updatedAt: new Date().toISOString()
                    };
                    // Aktualisiere Rule
                    const success = await updateRule(updatedRule.id, updatedRule);
                    if (success) {
                        updatedCount++;
                        if (shouldDeactivate && rule.isActive) {
                            deactivatedCount++;
                            warnLog('RuleStore', `Rule "${rule.name}" wurde deaktiviert (keine gültigen Conditions/Actions mehr)`, {
                                ruleId: rule.id,
                                originalConditions: rule.conditions.length,
                                cleanedConditions: cleanedConditions.length,
                                originalActions: rule.actions.length,
                                cleanedActions: cleanedActions.length
                            });
                        }
                        debugLog('RuleStore', `Rule "${rule.name}" erfolgreich bereinigt`, {
                            ruleId: rule.id,
                            removedConditions: rule.conditions.length - cleanedConditions.length,
                            removedActions: rule.actions.length - cleanedActions.length,
                            deactivated: shouldDeactivate
                        });
                    }
                    else {
                        errorCount++;
                        warnLog('RuleStore', `Fehler beim Bereinigen von Rule "${rule.name}"`, { ruleId: rule.id });
                    }
                }
                catch (error) {
                    errorCount++;
                    errorLog('RuleStore', `Fehler beim Bereinigen von Rule "${rule.name}"`, {
                        ruleId: rule.id,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
            // Zusammenfassung loggen
            debugLog('RuleStore', 'cleanupRecipientReferences abgeschlossen', {
                recipientId,
                totalRules: affectedRules.length,
                updatedCount,
                deactivatedCount,
                errorCount
            });
            if (updatedCount > 0) {
                debugLog('RuleStore', `Recipient-Referenz-Bereinigung erfolgreich: ${updatedCount} Rules aktualisiert`);
            }
            if (deactivatedCount > 0) {
                warnLog('RuleStore', `${deactivatedCount} Rules wurden deaktiviert (keine gültigen Conditions/Actions mehr)`);
            }
            if (errorCount > 0) {
                warnLog('RuleStore', `Recipient-Referenz-Bereinigung: ${errorCount} Fehler aufgetreten`);
            }
        }
        catch (error) {
            errorLog('RuleStore', 'Kritischer Fehler bei cleanupRecipientReferences', {
                recipientId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
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
        /* recipient updates */
        updateRecipientReferences,
        /* recipient validation & cleanup */
        getAutomationRulesWithRecipient,
        countAutomationRulesWithRecipient,
        validateRecipientDeletion,
        cleanupRecipientReferences,
        /* util */
        reset,
    };
});
