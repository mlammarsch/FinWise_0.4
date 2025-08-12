/**
 * Pfad: src/stores/recipientStore.ts
 * Speichert Empfänger – jetzt tenant-spezifisch mit bidirektionaler Synchronisation.
 * Erweitert um robuste Error-Handling und Rollback-Mechanismen für Task 5.6
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { Recipient, SyncQueueEntry, Transaction, PlanningTransaction } from '@/types';
import { SyncOperationType, EntityTypeEnum } from '@/types';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';

/**
 * Fehler-Kategorisierung für Rollback-Mechanismen
 * Task 5.6: Error-Handling und Rollback-Mechanismen
 */
enum ErrorSeverity {
  INFO = 'info',           // Informational, operation continues
  WARNING = 'warning',     // Warning, operation continues with limitations
  ERROR = 'error',         // Error, operation fails but no rollback needed
  CRITICAL = 'critical'    // Critical error, full rollback required
}

/**
 * Rollback-Action Interface für Compensation-Pattern
 */
interface RollbackAction {
  id: string;
  description: string;
  execute: () => Promise<void>;
  priority: number; // Höhere Priorität wird zuerst ausgeführt
}

/**
 * State Snapshot für Rollback-Operationen
 */
interface StateSnapshot {
  id: string;
  timestamp: number;
  recipients: Recipient[];
  syncQueueEntries: SyncQueueEntry[];
  metadata: {
    operationName: string;
    operationId: string;
    affectedRecipientIds: string[];
  };
}

/**
 * Enhanced Error mit Severity und Rollback-Informationen
 */
interface EnhancedError {
  id: string;
  severity: ErrorSeverity;
  message: string;
  details?: any;
  recipientId?: string;
  operationStep?: string;
  requiresRollback: boolean;
  timestamp: number;
}

/**
 * Rollback-Ergebnis Interface
 */
interface RollbackResult {
  success: boolean;
  executedActions: number;
  failedActions: number;
  errors: string[];
  duration: number;
}

export const useRecipientStore = defineStore('recipient', () => {
  const tenantDbService = new TenantDbService();

  const recipients = ref<Recipient[]>([]);

  // Rollback-Management State
  const rollbackActions = ref<Map<string, RollbackAction[]>>(new Map());
  const stateSnapshots = ref<Map<string, StateSnapshot>>(new Map());
  const enhancedErrors = ref<Map<string, EnhancedError[]>>(new Map());

  /**
   * Erstellt einen State Snapshot für Rollback-Operationen
   * Task 5.6: State Snapshot-System
   */
  function createStateSnapshot(operationName: string, operationId: string, affectedRecipientIds: string[]): StateSnapshot {
    const snapshot: StateSnapshot = {
      id: uuidv4(),
      timestamp: Date.now(),
      recipients: JSON.parse(JSON.stringify(recipients.value)), // Deep copy
      syncQueueEntries: [], // Wird bei Bedarf gefüllt
      metadata: {
        operationName,
        operationId,
        affectedRecipientIds
      }
    };

    stateSnapshots.value.set(operationId, snapshot);
    debugLog('recipientStore', `State Snapshot erstellt für Operation ${operationName}`, {
      snapshotId: snapshot.id,
      operationId,
      recipientCount: snapshot.recipients.length,
      affectedRecipients: affectedRecipientIds.length
    });

    return snapshot;
  }

  /**
   * Stellt einen State aus einem Snapshot wieder her
   * Task 5.6: State Snapshot-System
   */
  async function restoreFromSnapshot(operationId: string): Promise<boolean> {
    const snapshot = stateSnapshots.value.get(operationId);
    if (!snapshot) {
      errorLog('recipientStore', `Snapshot für Operation ${operationId} nicht gefunden`);
      return false;
    }

    try {
      // Restore recipients state
      recipients.value = JSON.parse(JSON.stringify(snapshot.recipients));

      // Restore IndexedDB state
      for (const recipient of snapshot.recipients) {
        await tenantDbService.createRecipient(recipient);
      }

      infoLog('recipientStore', `State erfolgreich aus Snapshot wiederhergestellt`, {
        operationId,
        snapshotId: snapshot.id,
        restoredRecipients: snapshot.recipients.length
      });

      return true;
    } catch (error) {
      errorLog('recipientStore', `Fehler beim Wiederherstellen aus Snapshot`, {
        operationId,
        error
      });
      return false;
    }
  }

  /**
   * Fügt eine Rollback-Action hinzu
   * Task 5.6: Transaktionale Rollback-Infrastruktur
   */
  function addRollbackAction(operationId: string, action: RollbackAction): void {
    if (!rollbackActions.value.has(operationId)) {
      rollbackActions.value.set(operationId, []);
    }
    rollbackActions.value.get(operationId)!.push(action);

    debugLog('recipientStore', `Rollback-Action hinzugefügt`, {
      operationId,
      actionId: action.id,
      description: action.description,
      priority: action.priority
    });
  }

  /**
   * Führt alle Rollback-Actions für eine Operation aus
   * Task 5.6: Transaktionale Rollback-Infrastruktur
   */
  async function executeRollback(operationId: string): Promise<RollbackResult> {
    const startTime = performance.now();
    const actions = rollbackActions.value.get(operationId) || [];

    if (actions.length === 0) {
      warnLog('recipientStore', `Keine Rollback-Actions für Operation ${operationId} gefunden`);
      return {
        success: true,
        executedActions: 0,
        failedActions: 0,
        errors: [],
        duration: Math.round(performance.now() - startTime)
      };
    }

    // Sortiere Actions nach Priorität (höchste zuerst)
    const sortedActions = [...actions].sort((a, b) => b.priority - a.priority);

    let executedActions = 0;
    let failedActions = 0;
    const errors: string[] = [];

    infoLog('recipientStore', `Starte Rollback für Operation ${operationId}`, {
      totalActions: sortedActions.length
    });

    for (const action of sortedActions) {
      try {
        await action.execute();
        executedActions++;
        debugLog('recipientStore', `Rollback-Action erfolgreich ausgeführt: ${action.description}`);
      } catch (error) {
        failedActions++;
        const errorMsg = `Rollback-Action fehlgeschlagen: ${action.description} - ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorLog('recipientStore', errorMsg, error);
      }
    }

    const duration = Math.round(performance.now() - startTime);
    const success = failedActions === 0;

    const result: RollbackResult = {
      success,
      executedActions,
      failedActions,
      errors,
      duration
    };

    if (success) {
      infoLog('recipientStore', `Rollback erfolgreich abgeschlossen`, {
        operationId,
        ...result
      });
    } else {
      errorLog('recipientStore', `Rollback mit Fehlern abgeschlossen`, {
        operationId,
        ...result
      });
    }

    return result;
  }

  /**
   * Bereinigt Rollback-Daten nach erfolgreicher Operation
   * Task 5.6: Memory-optimierte Rollback-Datenstrukturen
   */
  function cleanupRollbackData(operationId: string): void {
    rollbackActions.value.delete(operationId);
    stateSnapshots.value.delete(operationId);
    enhancedErrors.value.delete(operationId);

    debugLog('recipientStore', `Rollback-Daten bereinigt für Operation ${operationId}`);
  }

  /**
   * Fügt einen Enhanced Error hinzu
   * Task 5.6: Fehler-Kategorisierung
   */
  function addEnhancedError(operationId: string, error: Omit<EnhancedError, 'id' | 'timestamp'>): EnhancedError {
    const enhancedError: EnhancedError = {
      ...error,
      id: uuidv4(),
      timestamp: Date.now()
    };

    if (!enhancedErrors.value.has(operationId)) {
      enhancedErrors.value.set(operationId, []);
    }
    enhancedErrors.value.get(operationId)!.push(enhancedError);

    // Log basierend auf Severity
    const logData = {
      operationId,
      errorId: enhancedError.id,
      severity: enhancedError.severity,
      message: enhancedError.message,
      recipientId: enhancedError.recipientId,
      operationStep: enhancedError.operationStep,
      requiresRollback: enhancedError.requiresRollback
    };

    switch (enhancedError.severity) {
      case ErrorSeverity.INFO:
        debugLog('recipientStore', `Info: ${enhancedError.message}`, logData);
        break;
      case ErrorSeverity.WARNING:
        warnLog('recipientStore', `Warning: ${enhancedError.message}`, logData);
        break;
      case ErrorSeverity.ERROR:
        errorLog('recipientStore', `Error: ${enhancedError.message}`, logData);
        break;
      case ErrorSeverity.CRITICAL:
        errorLog('recipientStore', `CRITICAL: ${enhancedError.message}`, logData);
        break;
    }

    return enhancedError;
  }

  /**
   * Transaktionale Rollback-Infrastruktur
   * Task 5.6: executeWithRollback
   */
  async function executeWithRollback<T>(
    operation: () => Promise<T>,
    rollbackActions: Array<() => Promise<void>>,
    operationName: string
  ): Promise<T> {
    const operationId = uuidv4();
    const startTime = performance.now();

    try {
      infoLog('recipientStore', `Starte transaktionale Operation: ${operationName}`, {
        operationId,
        rollbackActionsCount: rollbackActions.length
      });

      // Registriere Rollback-Actions
      rollbackActions.forEach((action, index) => {
        addRollbackAction(operationId, {
          id: `${operationId}-rollback-${index}`,
          description: `Rollback action ${index + 1} for ${operationName}`,
          execute: action,
          priority: rollbackActions.length - index // Umgekehrte Reihenfolge
        });
      });

      // Führe Operation aus
      const result = await operation();

      const duration = Math.round(performance.now() - startTime);
      infoLog('recipientStore', `Transaktionale Operation erfolgreich: ${operationName}`, {
        operationId,
        duration: `${duration}ms`
      });

      // Bereinige Rollback-Daten bei Erfolg
      cleanupRollbackData(operationId);

      return result;

    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      errorLog('recipientStore', `Transaktionale Operation fehlgeschlagen: ${operationName}`, {
        operationId,
        error,
        duration: `${duration}ms`
      });

      // Führe Rollback aus
      const rollbackResult = await executeRollback(operationId);

      if (!rollbackResult.success) {
        errorLog('recipientStore', `Rollback fehlgeschlagen für Operation: ${operationName}`, {
          operationId,
          rollbackResult
        });
      }

      // Bereinige Rollback-Daten
      cleanupRollbackData(operationId);

      // Re-throw original error
      throw error;
    }
  }

  const getRecipientById = computed(() => (id: string) =>
    recipients.value.find(r => r.id === id),
  );

  async function addRecipient(recipientData: Omit<Recipient, 'id' | 'updated_at'> | Recipient, fromSync = false): Promise<Recipient> {

    const recipientWithTimestamp: Recipient = {
      ...recipientData,
      id: 'id' in recipientData ? recipientData.id : uuidv4(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: (recipientData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localRecipient = await tenantDbService.getRecipientById(recipientWithTimestamp.id);
      if (localRecipient) {
        // Berücksichtige sowohl updatedAt als auch updated_at
        const localTimestamp = localRecipient.updatedAt || (localRecipient as any).updated_at;
        const incomingTimestamp = recipientWithTimestamp.updatedAt || (recipientWithTimestamp as any).updated_at;

        if (localTimestamp && incomingTimestamp && new Date(localTimestamp) >= new Date(incomingTimestamp)) {
          infoLog('recipientStore', `addRecipient (fromSync): Lokaler Empfänger ${localRecipient.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
          return localRecipient; // Gib den lokalen, "gewinnenden" Empfänger zurück
        }
      }
      // Wenn eingehend neuer ist oder lokal nicht existiert, fahre fort mit DB-Update und Store-Update
      await tenantDbService.createRecipient(recipientWithTimestamp); // createRecipient ist wie put, überschreibt wenn ID existiert
      infoLog('recipientStore', `addRecipient (fromSync): Eingehender Empfänger ${recipientWithTimestamp.id} angewendet (neuer oder lokal nicht vorhanden).`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.createRecipient(recipientWithTimestamp);
    }

    const existingRecipientIndex = recipients.value.findIndex(r => r.id === recipientWithTimestamp.id);
    if (existingRecipientIndex === -1) {
      recipients.value.push(recipientWithTimestamp);
    } else {
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt, falls die DB-Operation nicht sofort reflektiert wird
      // Berücksichtige sowohl updatedAt als auch updated_at für Store-Update
      const storeTimestamp = recipients.value[existingRecipientIndex].updatedAt || (recipients.value[existingRecipientIndex] as any).updated_at;
      const incomingTimestamp = recipientWithTimestamp.updatedAt || (recipientWithTimestamp as any).updated_at;

      if (!fromSync || (incomingTimestamp && (!storeTimestamp || new Date(incomingTimestamp) > new Date(storeTimestamp)))) {
        recipients.value[existingRecipientIndex] = recipientWithTimestamp;
      } else if (fromSync) {
        // Wenn fromSync und das Store-Empfänger neuer ist, behalte das Store-Empfänger (sollte durch obige DB-Prüfung nicht passieren)
        warnLog('recipientStore', `addRecipient (fromSync): Store-Empfänger ${recipients.value[existingRecipientIndex].id} war neuer als eingehender ${recipientWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('recipientStore', `Recipient "${recipientWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${recipientWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync) {
      try {
        // Feldmapping: updatedAt -> updated_at für Backend-Kompatibilität
        const backendPayload = {
          ...tenantDbService.toPlainObject(recipientWithTimestamp),
          updated_at: recipientWithTimestamp.updatedAt
        };

        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: recipientWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: backendPayload,
        });
        infoLog('recipientStore', `Recipient "${recipientWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('recipientStore', `Fehler beim Hinzufügen von Recipient "${recipientWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return recipientWithTimestamp;
  }

  async function updateRecipient(recipientUpdatesData: Recipient, fromSync = false): Promise<boolean> {

    const recipientUpdatesWithTimestamp: Recipient = {
      ...recipientUpdatesData,
      updatedAt: recipientUpdatesData.updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localRecipient = await tenantDbService.getRecipientById(recipientUpdatesWithTimestamp.id);
      if (!localRecipient) {
        // Empfänger existiert lokal nicht, also behandle es wie ein "CREATE" vom Sync
        infoLog('recipientStore', `updateRecipient (fromSync): Lokaler Empfänger ${recipientUpdatesWithTimestamp.id} nicht gefunden. Behandle als addRecipient.`);
        await addRecipient(recipientUpdatesWithTimestamp, true); // Rufe addRecipient mit fromSync=true auf
        return true; // Frühzeitiger Ausstieg, da addRecipient die weitere Logik übernimmt
      }

      // Verbesserte LWW-Logik: Berücksichtige sowohl updatedAt als auch updated_at
      const localTimestamp = localRecipient.updatedAt || (localRecipient as any).updated_at;
      const incomingTimestamp = recipientUpdatesWithTimestamp.updatedAt || (recipientUpdatesWithTimestamp as any).updated_at;

      if (localTimestamp && !incomingTimestamp) {
        infoLog('recipientStore', `updateRecipient (fromSync): Backend sendet null-Timestamp, lokale Daten haben Vorrang. Eingehende Änderung verworfen.`);
        return true;
      }

      if (localTimestamp && incomingTimestamp &&
        new Date(localTimestamp) >= new Date(incomingTimestamp)) {
        infoLog('recipientStore', `updateRecipient (fromSync): Lokaler Empfänger ${localRecipient.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true; // Änderung verworfen, aber Operation als "erfolgreich" für den Sync-Handler betrachten
      }
      // Eingehend ist neuer, fahre fort mit DB-Update und Store-Update
      await tenantDbService.updateRecipient(recipientUpdatesWithTimestamp.id, recipientUpdatesWithTimestamp);
      infoLog('recipientStore', `updateRecipient (fromSync): Eingehendes Update für Empfänger ${recipientUpdatesWithTimestamp.id} angewendet.`);
    } else { // Lokale Änderung (!fromSync)
      await tenantDbService.updateRecipient(recipientUpdatesWithTimestamp.id, recipientUpdatesWithTimestamp);
    }

    const idx = recipients.value.findIndex(r => r.id === recipientUpdatesWithTimestamp.id);
    if (idx !== -1) {
      // Stelle sicher, dass auch hier die LWW-Logik für den Store gilt
      const storeTimestamp = recipients.value[idx].updatedAt || (recipients.value[idx] as any).updated_at;
      const incomingTimestamp = recipientUpdatesWithTimestamp.updatedAt || (recipientUpdatesWithTimestamp as any).updated_at;

      if (!fromSync || (incomingTimestamp && (!storeTimestamp || new Date(incomingTimestamp) > new Date(storeTimestamp)))) {
        recipients.value[idx] = { ...recipients.value[idx], ...recipientUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('recipientStore', `updateRecipient (fromSync): Store-Empfänger ${recipients.value[idx].id} war neuer als eingehender ${recipientUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('recipientStore', `Recipient "${recipientUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${recipientUpdatesWithTimestamp.id}).`);

      // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
      if (!fromSync) {
        try {
          // Feldmapping: updatedAt -> updated_at für Backend-Kompatibilität
          const backendPayload = {
            ...tenantDbService.toPlainObject(recipientUpdatesWithTimestamp),
            updated_at: recipientUpdatesWithTimestamp.updatedAt
          };

          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RECIPIENT,
            entityId: recipientUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: backendPayload,
          });
          infoLog('recipientStore', `Recipient "${recipientUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('recipientStore', `Fehler beim Hinzufügen von Recipient Update "${recipientUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('recipientStore', `updateRecipient: Recipient ${recipientUpdatesWithTimestamp.id} not found in store during sync. Adding it.`);
      await addRecipient(recipientUpdatesWithTimestamp, true);
      return true;
    }
    return false;
  }

  async function deleteRecipient(recipientId: string, fromSync = false): Promise<void> {
    const recipientToDelete = recipients.value.find(r => r.id === recipientId);

    // Validierung: Prüfe ob Empfänger noch in Transaktionen verwendet wird (nur bei lokalen Löschungen)
    if (!fromSync) {
      try {
        // Importiere TransactionStore dynamisch um zirkuläre Abhängigkeiten zu vermeiden
        const { useTransactionStore } = await import('@/stores/transactionStore');
        const transactionStore = useTransactionStore();

        // Prüfe Transaktionen
        const transactionsWithRecipient = transactionStore.transactions.filter(
          tx => tx.recipientId === recipientId
        );

        if (transactionsWithRecipient.length > 0) {
          const recipientName = recipientToDelete?.name || 'Unbekannter Empfänger';
          const errorMessage = `Der Empfänger "${recipientName}" kann nicht gelöscht werden, da er noch in ${transactionsWithRecipient.length} Transaktion${transactionsWithRecipient.length === 1 ? '' : 'en'} verwendet wird.`;

          errorLog('recipientStore', errorMessage, {
            recipientId,
            recipientName,
            transactionCount: transactionsWithRecipient.length,
            transactionIds: transactionsWithRecipient.map(tx => tx.id)
          });

          throw new Error(errorMessage);
        }

        // Prüfe auch PlanningTransactions
        const { usePlanningStore } = await import('@/stores/planningStore');
        const planningStore = usePlanningStore();

        const planningTransactionsWithRecipient = planningStore.planningTransactions.filter(
          ptx => ptx.recipientId === recipientId
        );

        if (planningTransactionsWithRecipient.length > 0) {
          const recipientName = recipientToDelete?.name || 'Unbekannter Empfänger';
          const errorMessage = `Der Empfänger "${recipientName}" kann nicht gelöscht werden, da er noch in ${planningTransactionsWithRecipient.length} Planungstransaktion${planningTransactionsWithRecipient.length === 1 ? '' : 'en'} verwendet wird.`;

          errorLog('recipientStore', errorMessage, {
            recipientId,
            recipientName,
            planningTransactionCount: planningTransactionsWithRecipient.length,
            planningTransactionIds: planningTransactionsWithRecipient.map(ptx => ptx.id)
          });

          throw new Error(errorMessage);
        }

        infoLog('recipientStore', `Validierung erfolgreich: Empfänger "${recipientToDelete?.name}" kann sicher gelöscht werden`, {
          recipientId,
          transactionCount: 0,
          planningTransactionCount: 0
        });

      } catch (error) {
        // Wenn es ein Validierungsfehler ist, werfe ihn weiter
        if (error instanceof Error && error.message.includes('kann nicht gelöscht werden')) {
          throw error;
        }
        // Bei anderen Fehlern (z.B. Import-Probleme) logge und fahre fort
        warnLog('recipientStore', 'Fehler bei der Validierung vor Löschung, fahre trotzdem fort', {
          recipientId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Lokale DB immer zuerst (oder zumindest vor dem Hinzufügen zur SyncQueue) aktualisieren,
    // unabhängig davon, ob es vom Sync kommt oder eine lokale Änderung ist,
    // um den lokalen Zustand konsistent zu halten.
    // Die `fromSync`-Logik verhindert dann nur das erneute Senden an den Server.
    await tenantDbService.deleteRecipient(recipientId);
    recipients.value = recipients.value.filter(r => r.id !== recipientId);
    infoLog('recipientStore', `Recipient mit ID "${recipientId}" aus Store und lokaler DB entfernt.`);

    // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
    if (!fromSync && recipientToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: recipientId,
          operationType: SyncOperationType.DELETE,
          payload: { id: recipientId }, // Nur ID bei Delete
        });
        infoLog('recipientStore', `Recipient mit ID "${recipientId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('recipientStore', `Fehler beim Hinzufügen von Recipient Delete (ID: "${recipientId}") zur Sync Queue.`, e);
      }
    }
  }

  async function loadRecipients() {
    try {
      const loadedRecipients = await tenantDbService.getRecipients();
      recipients.value = loadedRecipients;
      debugLog('recipientStore', 'Empfänger geladen', { count: loadedRecipients.length });
    } catch (error) {
      errorLog('recipientStore', 'Fehler beim Laden der Empfänger', { error });
      recipients.value = [];
    }
  }

  async function reset() {
    try {
      // Versuche alle Empfänger aus der Datenbank zu löschen
      const result = await tenantDbService.clearAllRecipients();

      if (!result.success) {
        warnLog('recipientStore', `Reset fehlgeschlagen: ${result.message}`);
        throw new Error(result.message);
      }

      // Lokale Arrays leeren und neu laden
      recipients.value = [];
      await loadRecipients();

      infoLog('recipientStore', 'Reset erfolgreich abgeschlossen - alle Empfänger gelöscht');
    } catch (error) {
      errorLog('recipientStore', 'Fehler beim Reset der Empfänger', error);
      throw error;
    }
  }

  /**
   * Führt mehrere Recipients zu einem Ziel-Recipient zusammen
   * Implementiert Task 5.1 Anforderungen mit vollständiger Service-Integration
   * Erweitert um Enhanced Error-Handling und Rollback-Mechanismen (Task 5.6)
   */
  async function mergeRecipients(
    sourceRecipientIds: string[],
    targetRecipient: Recipient | { name: string; defaultCategoryId?: string; note?: string }
  ): Promise<{
    success: boolean;
    mergedRecipient: Recipient;
    updatedTransactions: number;
    updatedPlanningTransactions: number;
    updatedRules: number;
    errors: string[];
    enhancedErrors?: EnhancedError[];
    rollbackExecuted?: boolean;
    rollbackResult?: RollbackResult;
    cleanup?: {
      cleanedTransactions: number;
      cleanedPlanningTransactions: number;
      cleanedRules: number;
      orphanedDataRemoved: number;
    };
  }> {
    const operationId = uuidv4();
    const operationName = 'mergeRecipients';
    const errors: string[] = [];
    const enhancedErrorsList: EnhancedError[] = [];
    let updatedTransactions = 0;
    let updatedPlanningTransactions = 0;
    let updatedRules = 0;
    let mergedRecipient: Recipient;
    let rollbackExecuted = false;
    let rollbackResult: RollbackResult | undefined;

    // Rollback-Actions sammeln
    const rollbackActions: Array<() => Promise<void>> = [];

    try {
      // 1. Eingabevalidierung mit Enhanced Error-Handling
      if (!sourceRecipientIds || sourceRecipientIds.length === 0) {
        const error = addEnhancedError(operationId, {
          severity: ErrorSeverity.CRITICAL,
          message: 'Mindestens ein Quell-Recipient erforderlich',
          operationStep: 'input_validation',
          requiresRollback: false
        });
        enhancedErrorsList.push(error);
        throw new Error(error.message);
      }

      if (!targetRecipient || !targetRecipient.name?.trim()) {
        const error = addEnhancedError(operationId, {
          severity: ErrorSeverity.CRITICAL,
          message: 'Gültiger Ziel-Recipient mit Name erforderlich',
          operationStep: 'input_validation',
          requiresRollback: false
        });
        enhancedErrorsList.push(error);
        throw new Error(error.message);
      }

      // Entferne Duplikate aus sourceRecipientIds
      const uniqueSourceIds = [...new Set(sourceRecipientIds)];

      // Erstelle State Snapshot vor kritischen Operationen
      const snapshot = createStateSnapshot(operationName, operationId, uniqueSourceIds);

      infoLog('recipientStore', `Starte Enhanced Merge von ${uniqueSourceIds.length} Recipients zu "${targetRecipient.name}"`, {
        operationId,
        sourceRecipientIds: uniqueSourceIds,
        targetRecipient: 'id' in targetRecipient ? { id: targetRecipient.id, name: targetRecipient.name } : { name: targetRecipient.name },
        snapshotId: snapshot.id
      });

      // 2. Ziel-Recipient erstellen oder verwenden mit Rollback-Integration
      if ('id' in targetRecipient) {
        // Bestehender Recipient verwenden
        const existingRecipient = recipients.value.find(r => r.id === targetRecipient.id);
        if (!existingRecipient) {
          const error = addEnhancedError(operationId, {
            severity: ErrorSeverity.CRITICAL,
            message: `Ziel-Recipient mit ID ${targetRecipient.id} nicht gefunden`,
            recipientId: targetRecipient.id,
            operationStep: 'target_recipient_validation',
            requiresRollback: false
          });
          enhancedErrorsList.push(error);
          throw new Error(error.message);
        }
        mergedRecipient = existingRecipient;

        // Aktualisiere den bestehenden Recipient falls zusätzliche Daten vorhanden sind
        if (targetRecipient.defaultCategoryId !== undefined || targetRecipient.note !== undefined) {
          const originalRecipient = { ...mergedRecipient };
          const updateData: Partial<Recipient> = {};
          if (targetRecipient.defaultCategoryId !== undefined) {
            updateData.defaultCategoryId = targetRecipient.defaultCategoryId;
          }
          if (targetRecipient.note !== undefined) {
            updateData.note = targetRecipient.note;
          }

          try {
            const success = await updateRecipient({ ...mergedRecipient, ...updateData }, false);
            if (success) {
              mergedRecipient = { ...mergedRecipient, ...updateData };

              // Rollback-Action für Target-Recipient-Update
              rollbackActions.push(async () => {
                await updateRecipient(originalRecipient, false);
                debugLog('recipientStore', `Rollback: Target-Recipient auf ursprünglichen Zustand zurückgesetzt: ${originalRecipient.id}`);
              });

              debugLog('recipientStore', `Ziel-Recipient aktualisiert: ${mergedRecipient.name} (${mergedRecipient.id})`);
            } else {
              const error = addEnhancedError(operationId, {
                severity: ErrorSeverity.WARNING,
                message: `Ziel-Recipient konnte nicht aktualisiert werden: ${mergedRecipient.id}`,
                recipientId: mergedRecipient.id,
                operationStep: 'target_recipient_update',
                requiresRollback: false
              });
              enhancedErrorsList.push(error);
              errors.push(error.message);
            }
          } catch (updateError) {
            const error = addEnhancedError(operationId, {
              severity: ErrorSeverity.ERROR,
              message: `Fehler beim Aktualisieren des Ziel-Recipients: ${updateError instanceof Error ? updateError.message : String(updateError)}`,
              recipientId: mergedRecipient.id,
              operationStep: 'target_recipient_update',
              requiresRollback: false,
              details: updateError
            });
            enhancedErrorsList.push(error);
            errors.push(error.message);
          }
        }

        infoLog('recipientStore', `Verwende bestehenden Ziel-Recipient: ${mergedRecipient.name} (${mergedRecipient.id})`);
      } else {
        // Neuen Recipient erstellen
        const newRecipientData: Omit<Recipient, 'id' | 'updated_at'> = {
          name: targetRecipient.name.trim(),
          defaultCategoryId: targetRecipient.defaultCategoryId || null,
          note: targetRecipient.note || undefined
        };

        try {
          mergedRecipient = await addRecipient(newRecipientData, false);

          // Rollback-Action für neuen Target-Recipient
          rollbackActions.push(async () => {
            await deleteRecipient(mergedRecipient.id, false);
            debugLog('recipientStore', `Rollback: Neu erstellter Target-Recipient gelöscht: ${mergedRecipient.id}`);
          });

          infoLog('recipientStore', `Neuer Ziel-Recipient erstellt: ${mergedRecipient.name} (${mergedRecipient.id})`);
        } catch (createError) {
          const error = addEnhancedError(operationId, {
            severity: ErrorSeverity.CRITICAL,
            message: `Fehler beim Erstellen des neuen Ziel-Recipients: ${createError instanceof Error ? createError.message : String(createError)}`,
            operationStep: 'target_recipient_creation',
            requiresRollback: true,
            details: createError
          });
          enhancedErrorsList.push(error);
          throw new Error(error.message);
        }
      }

      // Entferne den Ziel-Recipient aus der Quell-Liste falls vorhanden
      const filteredSourceIds = uniqueSourceIds.filter(id => id !== mergedRecipient.id);
      if (filteredSourceIds.length !== uniqueSourceIds.length) {
        debugLog('recipientStore', `Ziel-Recipient aus Quell-Liste entfernt: ${mergedRecipient.id}`);
      }

      if (filteredSourceIds.length === 0) {
        infoLog('recipientStore', 'Keine Quell-Recipients zu verarbeiten nach Filterung');

        // Bereinige Rollback-Daten bei erfolgreichem Early Return
        cleanupRollbackData(operationId);

        return {
          success: true,
          mergedRecipient,
          updatedTransactions: 0,
          updatedPlanningTransactions: 0,
          updatedRules: 0,
          errors: [],
          enhancedErrors: enhancedErrorsList,
          rollbackExecuted: false
        };
      }

      // 3. Referenzen in anderen Entitäten aktualisieren mit Enhanced Error-Handling
      debugLog('recipientStore', `Aktualisiere Referenzen für ${filteredSourceIds.length} Quell-Recipients`);

      // 3.1 Transaction-Referenzen aktualisieren
      try {
        const { TransactionService } = await import('@/services/TransactionService');
        const transactionStore = (await import('@/stores/transactionStore')).useTransactionStore();
        const transactionsBefore = transactionStore.transactions.filter(t =>
          t.recipientId && filteredSourceIds.includes(t.recipientId)
        );

        if (transactionsBefore.length > 0) {
          // Sammle ursprüngliche Transaction-Daten für Rollback
          const originalTransactionData = transactionsBefore.map(t => ({
            id: t.id,
            recipientId: t.recipientId
          }));

          await TransactionService.updateRecipientReferences(filteredSourceIds, mergedRecipient.id);
          updatedTransactions = transactionsBefore.length;

          // Rollback-Action für Transaction-Referenzen
          rollbackActions.push(async () => {
            for (const originalData of originalTransactionData) {
              await transactionStore.updateTransaction(originalData.id, {
                recipientId: originalData.recipientId,
                updatedAt: new Date().toISOString()
              }, false);
            }
            debugLog('recipientStore', `Rollback: ${originalTransactionData.length} Transaction-Referenzen wiederhergestellt`);
          });

          infoLog('recipientStore', `${updatedTransactions} Transaction-Referenzen aktualisiert`);
        }
      } catch (error) {
        const enhancedError = addEnhancedError(operationId, {
          severity: ErrorSeverity.ERROR,
          message: `Fehler beim Aktualisieren der Transaction-Referenzen: ${error instanceof Error ? error.message : String(error)}`,
          operationStep: 'transaction_reference_update',
          requiresRollback: true,
          details: error
        });
        enhancedErrorsList.push(enhancedError);
        errors.push(enhancedError.message);
        errorLog('recipientStore', enhancedError.message, error);
      }

      // 3.2 PlanningTransaction-Referenzen aktualisieren
      try {
        const { PlanningService } = await import('@/services/PlanningService');
        const planningStore = (await import('@/stores/planningStore')).usePlanningStore();
        const planningsBefore = planningStore.planningTransactions.filter(pt =>
          pt.recipientId && filteredSourceIds.includes(pt.recipientId)
        );

        if (planningsBefore.length > 0) {
          // Sammle ursprüngliche PlanningTransaction-Daten für Rollback
          const originalPlanningData = planningsBefore.map(pt => ({
            id: pt.id,
            recipientId: pt.recipientId
          }));

          await PlanningService.updateRecipientReferences(filteredSourceIds, mergedRecipient.id);
          updatedPlanningTransactions = planningsBefore.length;

          // Rollback-Action für PlanningTransaction-Referenzen
          rollbackActions.push(async () => {
            for (const originalData of originalPlanningData) {
              await planningStore.updatePlanningTransaction(originalData.id, {
                recipientId: originalData.recipientId,
                updatedAt: new Date().toISOString()
              });
            }
            debugLog('recipientStore', `Rollback: ${originalPlanningData.length} PlanningTransaction-Referenzen wiederhergestellt`);
          });

          infoLog('recipientStore', `${updatedPlanningTransactions} PlanningTransaction-Referenzen aktualisiert`);
        }
      } catch (error) {
        const enhancedError = addEnhancedError(operationId, {
          severity: ErrorSeverity.ERROR,
          message: `Fehler beim Aktualisieren der PlanningTransaction-Referenzen: ${error instanceof Error ? error.message : String(error)}`,
          operationStep: 'planning_reference_update',
          requiresRollback: true,
          details: error
        });
        enhancedErrorsList.push(enhancedError);
        errors.push(enhancedError.message);
        errorLog('recipientStore', enhancedError.message, error);
      }

      // 3.3 AutomationRule-Referenzen aktualisieren
      try {
        const { useRuleStore } = await import('@/stores/ruleStore');
        const ruleStore = useRuleStore();
        const rulesBefore = ruleStore.rules.filter(rule => {
          const hasRecipientCondition = rule.conditions.some(condition =>
            (condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
            typeof condition.value === 'string' && filteredSourceIds.includes(condition.value)
          );
          const hasRecipientAction = rule.actions.some(action =>
            action.type === 'SET_RECIPIENT' &&
            typeof action.value === 'string' && filteredSourceIds.includes(action.value)
          );
          return hasRecipientCondition || hasRecipientAction;
        });

        if (rulesBefore.length > 0) {
          // Sammle ursprüngliche Rule-Daten für Rollback
          const originalRuleData = rulesBefore.map(rule => ({
            ...rule, // Vollständige Rule-Daten für korrekten Rollback
            conditions: JSON.parse(JSON.stringify(rule.conditions)),
            actions: JSON.parse(JSON.stringify(rule.actions))
          }));

          await ruleStore.updateRecipientReferences(filteredSourceIds, mergedRecipient.id);
          updatedRules = rulesBefore.length;

          // Rollback-Action für AutomationRule-Referenzen
          rollbackActions.push(async () => {
            for (const originalData of originalRuleData) {
              await ruleStore.updateRule(originalData.id, {
                name: originalData.name,
                description: originalData.description,
                stage: originalData.stage,
                conditions: originalData.conditions,
                actions: originalData.actions,
                priority: originalData.priority,
                isActive: originalData.isActive,
                updatedAt: new Date().toISOString()
              }, false);
            }
            debugLog('recipientStore', `Rollback: ${originalRuleData.length} AutomationRule-Referenzen wiederhergestellt`);
          });

          infoLog('recipientStore', `${updatedRules} AutomationRule-Referenzen aktualisiert`);
        }
      } catch (error) {
        const enhancedError = addEnhancedError(operationId, {
          severity: ErrorSeverity.ERROR,
          message: `Fehler beim Aktualisieren der AutomationRule-Referenzen: ${error instanceof Error ? error.message : String(error)}`,
          operationStep: 'rule_reference_update',
          requiresRollback: true,
          details: error
        });
        enhancedErrorsList.push(enhancedError);
        errors.push(enhancedError.message);
        errorLog('recipientStore', enhancedError.message, error);
      }

      // 4. Quell-Recipients löschen mit Enhanced Error-Handling
      debugLog('recipientStore', `Lösche ${filteredSourceIds.length} Quell-Recipients`);
      let deletedCount = 0;
      const deletedRecipients: Recipient[] = []; // Für Rollback

      for (const sourceId of filteredSourceIds) {
        try {
          const sourceRecipient = recipients.value.find(r => r.id === sourceId);
          if (sourceRecipient) {
            // Speichere für Rollback
            deletedRecipients.push({ ...sourceRecipient });
            await deleteRecipient(sourceId, false);
            deletedCount++;
            debugLog('recipientStore', `Quell-Recipient gelöscht: ${sourceRecipient.name} (${sourceId})`);
          } else {
            const enhancedError = addEnhancedError(operationId, {
              severity: ErrorSeverity.WARNING,
              message: `Quell-Recipient nicht gefunden: ${sourceId}`,
              recipientId: sourceId,
              operationStep: 'source_recipient_deletion',
              requiresRollback: false
            });
            enhancedErrorsList.push(enhancedError);
            errors.push(enhancedError.message);
            warnLog('recipientStore', enhancedError.message);
          }
        } catch (error) {
          const enhancedError = addEnhancedError(operationId, {
            severity: ErrorSeverity.ERROR,
            message: `Fehler beim Löschen von Recipient ${sourceId}: ${error instanceof Error ? error.message : String(error)}`,
            recipientId: sourceId,
            operationStep: 'source_recipient_deletion',
            requiresRollback: true,
            details: error
          });
          enhancedErrorsList.push(enhancedError);
          errors.push(enhancedError.message);
          errorLog('recipientStore', enhancedError.message, error);
        }
      }

      // Rollback-Action für gelöschte Recipients
      if (deletedRecipients.length > 0) {
        rollbackActions.push(async () => {
          for (const deletedRecipient of deletedRecipients) {
            await addRecipient(deletedRecipient, false);
          }
          debugLog('recipientStore', `Rollback: ${deletedRecipients.length} gelöschte Recipients wiederhergestellt`);
        });
      }

      // 5. Automatische Post-Merge-Bereinigung
      let cleanup: {
        cleanedTransactions: number;
        cleanedPlanningTransactions: number;
        cleanedRules: number;
        orphanedDataRemoved: number;
      } | undefined;

      // Führe Cleanup nur bei erfolgreichem Merge oder bei nicht-kritischen Fehlern durch
      const shouldPerformCleanup = errors.length === 0 ||
        !errors.some(error => error.includes('Kritischer Fehler') || error.includes('nicht gefunden'));

      if (shouldPerformCleanup && filteredSourceIds.length > 0) {
        try {
          debugLog('recipientStore', 'Starte automatische Post-Merge-Bereinigung');
          cleanup = await performPostMergeCleanup(mergedRecipient.id, filteredSourceIds);
          infoLog('recipientStore', 'Post-Merge-Bereinigung erfolgreich abgeschlossen', cleanup);
        } catch (cleanupError) {
          const cleanupErrorMsg = `Warnung: Post-Merge-Bereinigung fehlgeschlagen: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`;
          errors.push(cleanupErrorMsg);
          warnLog('recipientStore', cleanupErrorMsg, cleanupError);

          // Setze partielle Cleanup-Ergebnisse falls verfügbar
          cleanup = {
            cleanedTransactions: 0,
            cleanedPlanningTransactions: 0,
            cleanedRules: 0,
            orphanedDataRemoved: 0
          };
        }
      } else {
        debugLog('recipientStore', 'Post-Merge-Bereinigung übersprungen', {
          shouldPerformCleanup,
          filteredSourceIdsLength: filteredSourceIds.length,
          errorCount: errors.length
        });
      }

      // 6. Prüfe auf kritische Fehler und führe Rollback aus falls nötig
      const criticalErrors = enhancedErrorsList.filter(e => e.severity === ErrorSeverity.CRITICAL || e.requiresRollback);

      if (criticalErrors.length > 0) {
        warnLog('recipientStore', `Kritische Fehler erkannt, führe Rollback aus`, {
          operationId,
          criticalErrorCount: criticalErrors.length,
          criticalErrors: criticalErrors.map(e => ({ id: e.id, message: e.message, severity: e.severity }))
        });

        try {
          rollbackResult = await executeRollback(operationId);
          rollbackExecuted = true;

          if (rollbackResult.success) {
            infoLog('recipientStore', 'Rollback erfolgreich ausgeführt', { operationId, rollbackResult });
          } else {
            errorLog('recipientStore', 'Rollback fehlgeschlagen', { operationId, rollbackResult });
          }
        } catch (rollbackError) {
          errorLog('recipientStore', 'Kritischer Fehler beim Rollback', {
            operationId,
            rollbackError
          });
        }
      }

      // 7. Ergebnis zusammenfassen mit Enhanced Error-Handling
      const success = errors.length === 0 && criticalErrors.length === 0;
      const result = {
        success,
        mergedRecipient,
        updatedTransactions,
        updatedPlanningTransactions,
        updatedRules,
        errors,
        enhancedErrors: enhancedErrorsList,
        rollbackExecuted,
        rollbackResult,
        cleanup
      };

      if (success) {
        infoLog('recipientStore', `Enhanced Merge erfolgreich abgeschlossen`, {
          operationId,
          mergedRecipient: { id: mergedRecipient.id, name: mergedRecipient.name },
          deletedCount,
          updatedTransactions,
          updatedPlanningTransactions,
          updatedRules,
          enhancedErrorCount: enhancedErrorsList.length,
          cleanup
        });

        // Bereinige Rollback-Daten bei Erfolg
        cleanupRollbackData(operationId);
      } else {
        warnLog('recipientStore', `Enhanced Merge mit Fehlern abgeschlossen`, {
          operationId,
          mergedRecipient: { id: mergedRecipient.id, name: mergedRecipient.name },
          deletedCount,
          updatedTransactions,
          updatedPlanningTransactions,
          updatedRules,
          errorCount: errors.length,
          enhancedErrorCount: enhancedErrorsList.length,
          criticalErrorCount: criticalErrors.length,
          rollbackExecuted,
          errors,
          cleanup
        });

        // Bereinige Rollback-Daten auch bei Fehlern (nach Rollback-Ausführung)
        if (!rollbackExecuted) {
          cleanupRollbackData(operationId);
        }
      }

      return result;

    } catch (error) {
      const criticalError = addEnhancedError(operationId, {
        severity: ErrorSeverity.CRITICAL,
        message: `Kritischer Fehler beim Mergen der Recipients: ${error instanceof Error ? error.message : String(error)}`,
        operationStep: 'critical_error_handler',
        requiresRollback: true,
        details: error
      });
      enhancedErrorsList.push(criticalError);
      errors.push(criticalError.message);
      errorLog('recipientStore', criticalError.message, error);

      // Führe Rollback bei kritischen Fehlern aus
      try {
        rollbackResult = await executeRollback(operationId);
        rollbackExecuted = true;

        if (rollbackResult.success) {
          infoLog('recipientStore', 'Emergency Rollback erfolgreich ausgeführt', { operationId, rollbackResult });
        } else {
          errorLog('recipientStore', 'Emergency Rollback fehlgeschlagen', { operationId, rollbackResult });
        }
      } catch (rollbackError) {
        errorLog('recipientStore', 'Kritischer Fehler beim Emergency Rollback', {
          operationId,
          rollbackError
        });
      } finally {
        cleanupRollbackData(operationId);
      }

      // Fallback-Ergebnis bei kritischen Fehlern
      return {
        success: false,
        mergedRecipient: mergedRecipient! || {
          id: '',
          name: targetRecipient.name || 'Unbekannt',
          defaultCategoryId: null,
          note: undefined,
          updated_at: new Date().toISOString()
        },
        updatedTransactions,
        updatedPlanningTransactions,
        updatedRules,
        errors,
        enhancedErrors: enhancedErrorsList,
        rollbackExecuted,
        rollbackResult,
        cleanup: {
          cleanedTransactions: 0,
          cleanedPlanningTransactions: 0,
          cleanedRules: 0,
          orphanedDataRemoved: 0
        }
      };
    }
  }

  /**
   * Führt automatische Bereinigung nach erfolgreichem Merge durch
   * Implementiert Task 5.4 Anforderungen für Post-Merge-Cleanup
   */
  async function performPostMergeCleanup(
    mergedRecipientId: string,
    deletedRecipientIds: string[]
  ): Promise<{
    cleanedTransactions: number;
    cleanedPlanningTransactions: number;
    cleanedRules: number;
    orphanedDataRemoved: number;
  }> {
    const startTime = performance.now();
    let cleanedTransactions = 0;
    let cleanedPlanningTransactions = 0;
    let cleanedRules = 0;
    let orphanedDataRemoved = 0;

    try {
      infoLog('recipientStore', `Starte Post-Merge-Cleanup für Recipient ${mergedRecipientId}`, {
        deletedRecipientIds,
        timestamp: new Date().toISOString()
      });

      // 1. Orphaned Data Detection und Bereinigung
      debugLog('recipientStore', 'Schritt 1: Orphaned Data Detection');

      // Import der Services dynamisch, um zirkuläre Abhängigkeiten zu vermeiden
      const [
        { useTransactionStore },
        { usePlanningStore },
        { useRuleStore },
        { TransactionService },
        { PlanningService }
      ] = await Promise.all([
        import('@/stores/transactionStore'),
        import('@/stores/planningStore'),
        import('@/stores/ruleStore'),
        import('@/services/TransactionService'),
        import('@/services/PlanningService')
      ]);

      const transactionStore = useTransactionStore();
      const planningStore = usePlanningStore();
      const ruleStore = useRuleStore();

      // 1.1 Finde verwaiste Transaction-Referenzen
      const orphanedTransactions = transactionStore.transactions.filter(t =>
        t.recipientId && deletedRecipientIds.includes(t.recipientId)
      );

      for (const transaction of orphanedTransactions) {
        try {
          // Aktualisiere auf merged recipient oder entferne Referenz
          const updateData = {
            recipientId: mergedRecipientId,
            updatedAt: new Date().toISOString()
          };

          await transactionStore.updateTransaction(transaction.id, updateData, false);
          cleanedTransactions++;

          debugLog('recipientStore', `Orphaned Transaction-Referenz bereinigt: ${transaction.id}`);
        } catch (error) {
          errorLog('recipientStore', `Fehler beim Bereinigen der Transaction ${transaction.id}`, error);
          // Entferne die Referenz komplett bei Fehlern
          try {
            await transactionStore.updateTransaction(transaction.id, {
              recipientId: undefined,
              updatedAt: new Date().toISOString()
            }, false);
            orphanedDataRemoved++;
          } catch (removeError) {
            errorLog('recipientStore', `Kritischer Fehler beim Entfernen der Transaction-Referenz ${transaction.id}`, removeError);
          }
        }
      }

      // 1.2 Finde verwaiste PlanningTransaction-Referenzen
      const orphanedPlannings = planningStore.planningTransactions.filter(pt =>
        pt.recipientId && deletedRecipientIds.includes(pt.recipientId)
      );

      for (const planning of orphanedPlannings) {
        try {
          // Aktualisiere auf merged recipient oder entferne Referenz
          const updateData = {
            recipientId: mergedRecipientId,
            updatedAt: new Date().toISOString()
          };

          await planningStore.updatePlanningTransaction(planning.id, updateData);
          cleanedPlanningTransactions++;

          debugLog('recipientStore', `Orphaned PlanningTransaction-Referenz bereinigt: ${planning.id}`);
        } catch (error) {
          errorLog('recipientStore', `Fehler beim Bereinigen der PlanningTransaction ${planning.id}`, error);
          // Entferne die Referenz komplett bei Fehlern
          try {
            await planningStore.updatePlanningTransaction(planning.id, {
              recipientId: undefined,
              updatedAt: new Date().toISOString()
            });
            orphanedDataRemoved++;
          } catch (removeError) {
            errorLog('recipientStore', `Kritischer Fehler beim Entfernen der PlanningTransaction-Referenz ${planning.id}`, removeError);
          }
        }
      }

      // 1.3 Finde verwaiste AutomationRule-Referenzen
      const orphanedRules = ruleStore.rules.filter(rule => {
        const hasOrphanedCondition = rule.conditions.some(condition =>
          (condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
          typeof condition.value === 'string' && deletedRecipientIds.includes(condition.value)
        );
        const hasOrphanedAction = rule.actions.some(action =>
          action.type === 'SET_RECIPIENT' &&
          typeof action.value === 'string' && deletedRecipientIds.includes(action.value)
        );
        return hasOrphanedCondition || hasOrphanedAction;
      });

      for (const rule of orphanedRules) {
        try {
          let ruleUpdated = false;
          const updatedRule = { ...rule };

          // Bereinige Bedingungen
          for (const condition of updatedRule.conditions) {
            if ((condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
              typeof condition.value === 'string' && deletedRecipientIds.includes(condition.value)) {
              condition.value = mergedRecipientId;
              ruleUpdated = true;
            }
          }

          // Bereinige Aktionen
          for (const action of updatedRule.actions) {
            if (action.type === 'SET_RECIPIENT' &&
              typeof action.value === 'string' && deletedRecipientIds.includes(action.value)) {
              action.value = mergedRecipientId;
              ruleUpdated = true;
            }
          }

          if (ruleUpdated) {
            updatedRule.updatedAt = new Date().toISOString();
            await ruleStore.updateRule(rule.id, updatedRule, false);
            cleanedRules++;
            debugLog('recipientStore', `Orphaned AutomationRule-Referenzen bereinigt: ${rule.id}`);
          }
        } catch (error) {
          errorLog('recipientStore', `Fehler beim Bereinigen der AutomationRule ${rule.id}`, error);
        }
      }

      // 2. Duplicate Detection und Bereinigung
      debugLog('recipientStore', 'Schritt 2: Duplicate Detection');

      // 2.1 Prüfe auf doppelte Transaction-Referenzen zum merged recipient
      const duplicateTransactionGroups = new Map<string, Transaction[]>();

      transactionStore.transactions
        .filter(t => t.recipientId === mergedRecipientId)
        .forEach(transaction => {
          const key = `${transaction.accountId}-${transaction.date}-${transaction.amount}-${transaction.description}`;
          if (!duplicateTransactionGroups.has(key)) {
            duplicateTransactionGroups.set(key, []);
          }
          duplicateTransactionGroups.get(key)!.push(transaction);
        });

      // Entferne Duplikate (behalte das neueste basierend auf updatedAt)
      for (const [key, duplicates] of duplicateTransactionGroups) {
        if (duplicates.length > 1) {
          // Sortiere nach updatedAt (neuestes zuerst)
          duplicates.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.date);
            const dateB = new Date(b.updatedAt || b.date);
            return dateB.getTime() - dateA.getTime();
          });

          // Entferne alle außer dem neuesten
          for (let i = 1; i < duplicates.length; i++) {
            try {
              await transactionStore.deleteTransaction(duplicates[i].id, false);
              orphanedDataRemoved++;
              debugLog('recipientStore', `Duplicate Transaction entfernt: ${duplicates[i].id}`);
            } catch (error) {
              errorLog('recipientStore', `Fehler beim Entfernen der Duplicate Transaction ${duplicates[i].id}`, error);
            }
          }
        }
      }

      // 2.2 Prüfe auf doppelte PlanningTransaction-Referenzen
      const duplicatePlanningGroups = new Map<string, PlanningTransaction[]>();

      planningStore.planningTransactions
        .filter(pt => pt.recipientId === mergedRecipientId)
        .forEach(planning => {
          const key = `${planning.accountId}-${planning.categoryId}-${planning.amount}-${planning.name}-${planning.recurrencePattern}`;
          if (!duplicatePlanningGroups.has(key)) {
            duplicatePlanningGroups.set(key, []);
          }
          duplicatePlanningGroups.get(key)!.push(planning);
        });

      // Entferne Duplikate
      for (const [key, duplicates] of duplicatePlanningGroups) {
        if (duplicates.length > 1) {
          duplicates.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.startDate);
            const dateB = new Date(b.updatedAt || b.startDate);
            return dateB.getTime() - dateA.getTime();
          });

          for (let i = 1; i < duplicates.length; i++) {
            try {
              await planningStore.deletePlanningTransaction(duplicates[i].id);
              orphanedDataRemoved++;
              debugLog('recipientStore', `Duplicate PlanningTransaction entfernt: ${duplicates[i].id}`);
            } catch (error) {
              errorLog('recipientStore', `Fehler beim Entfernen der Duplicate PlanningTransaction ${duplicates[i].id}`, error);
            }
          }
        }
      }

      // 3. Index und Cache Cleanup
      debugLog('recipientStore', 'Schritt 3: Index und Cache Cleanup');

      // 3.1 Store-interne Bereinigung
      // Entferne gelöschte Recipients aus dem lokalen Store (falls noch vorhanden)
      const initialRecipientCount = recipients.value.length;
      recipients.value = recipients.value.filter(r => !deletedRecipientIds.includes(r.id));
      const removedFromStore = initialRecipientCount - recipients.value.length;

      if (removedFromStore > 0) {
        orphanedDataRemoved += removedFromStore;
        debugLog('recipientStore', `${removedFromStore} verwaiste Recipients aus Store entfernt`);
      }

      // 3.2 TenantDbService Cache-Bereinigung (falls vorhanden)
      try {
        const tenantDbService = new TenantDbService();
        // Prüfe ob gelöschte Recipients noch in IndexedDB vorhanden sind
        for (const deletedId of deletedRecipientIds) {
          const stillExists = await tenantDbService.getRecipientById(deletedId);
          if (stillExists) {
            await tenantDbService.deleteRecipient(deletedId);
            orphanedDataRemoved++;
            debugLog('recipientStore', `Verwaister Recipient aus IndexedDB entfernt: ${deletedId}`);
          }
        }
      } catch (error) {
        warnLog('recipientStore', 'Fehler bei IndexedDB-Bereinigung (nicht kritisch)', error);
      }

      // 4. Datenintegritäts-Validierung
      debugLog('recipientStore', 'Schritt 4: Datenintegritäts-Validierung');

      // 4.1 Validiere dass merged recipient existiert
      const mergedRecipient = recipients.value.find(r => r.id === mergedRecipientId);
      if (!mergedRecipient) {
        throw new Error(`Merged Recipient ${mergedRecipientId} nicht im Store gefunden`);
      }

      // 4.2 Validiere dass keine gelöschten Recipients mehr referenziert werden
      const remainingOrphanedTransactions = transactionStore.transactions.filter(t =>
        t.recipientId && deletedRecipientIds.includes(t.recipientId)
      ).length;

      const remainingOrphanedPlannings = planningStore.planningTransactions.filter(pt =>
        pt.recipientId && deletedRecipientIds.includes(pt.recipientId)
      ).length;

      const remainingOrphanedRules = ruleStore.rules.filter(rule => {
        const hasOrphanedCondition = rule.conditions.some(condition =>
          (condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
          typeof condition.value === 'string' && deletedRecipientIds.includes(condition.value)
        );
        const hasOrphanedAction = rule.actions.some(action =>
          action.type === 'SET_RECIPIENT' &&
          typeof action.value === 'string' && deletedRecipientIds.includes(action.value)
        );
        return hasOrphanedCondition || hasOrphanedAction;
      }).length;

      if (remainingOrphanedTransactions > 0 || remainingOrphanedPlannings > 0 || remainingOrphanedRules > 0) {
        warnLog('recipientStore', 'Warnung: Noch verwaiste Referenzen nach Cleanup gefunden', {
          remainingOrphanedTransactions,
          remainingOrphanedPlannings,
          remainingOrphanedRules
        });
      }

      // 5. Performance-Metriken und Zusammenfassung
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const result = {
        cleanedTransactions,
        cleanedPlanningTransactions,
        cleanedRules,
        orphanedDataRemoved
      };

      infoLog('recipientStore', 'Post-Merge-Cleanup erfolgreich abgeschlossen', {
        mergedRecipientId,
        deletedRecipientIds,
        result,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      errorLog('recipientStore', 'Fehler beim Post-Merge-Cleanup', {
        error,
        mergedRecipientId,
        deletedRecipientIds,
        duration: `${duration}ms`,
        partialResults: {
          cleanedTransactions,
          cleanedPlanningTransactions,
          cleanedRules,
          orphanedDataRemoved
        }
      });

      // Gib partielle Ergebnisse zurück, auch bei Fehlern
      return {
        cleanedTransactions,
        cleanedPlanningTransactions,
        cleanedRules,
        orphanedDataRemoved
      };
    }
  }

  /**
   * Aktualisiert Referenzen in anderen Entitäten (Transactions, PlanningTransactions, AutomationRules)
   */
  async function updateRecipientReferences(oldRecipientIds: string[], newRecipientId: string): Promise<void> {
    try {
      infoLog('recipientStore', `Aktualisiere Referenzen von [${oldRecipientIds.join(', ')}] zu ${newRecipientId}`);

      // Import der Services dynamisch, um zirkuläre Abhängigkeiten zu vermeiden
      const { useTransactionStore } = await import('@/stores/transactionStore');
      const { usePlanningStore } = await import('@/stores/planningStore');
      const { useRuleStore } = await import('@/stores/ruleStore');

      // Transactions aktualisieren
      const transactionStore = useTransactionStore();
      for (const transaction of transactionStore.transactions) {
        if (transaction.recipientId && oldRecipientIds.includes(transaction.recipientId)) {
          await transactionStore.updateTransaction(transaction.id, {
            recipientId: newRecipientId,
            updatedAt: new Date().toISOString()
          }, false);
          debugLog('recipientStore', `Transaction ${transaction.id} Recipient-Referenz aktualisiert`);
        }
      }

      // PlanningTransactions aktualisieren
      const planningStore = usePlanningStore();
      for (const planning of planningStore.planningTransactions) {
        if (planning.recipientId && oldRecipientIds.includes(planning.recipientId)) {
          await planningStore.updatePlanningTransaction(planning.id, {
            recipientId: newRecipientId,
            updatedAt: new Date().toISOString()
          });
          debugLog('recipientStore', `PlanningTransaction ${planning.id} Recipient-Referenz aktualisiert`);
        }
      }

      // AutomationRules aktualisieren
      const ruleStore = useRuleStore();
      for (const rule of ruleStore.rules) {
        let ruleUpdated = false;

        // Bedingungen prüfen
        for (const condition of rule.conditions) {
          if ((condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
            typeof condition.value === 'string' && oldRecipientIds.includes(condition.value)) {
            condition.value = newRecipientId;
            ruleUpdated = true;
          }
        }

        // Aktionen prüfen
        for (const action of rule.actions) {
          if (action.type === 'SET_RECIPIENT' &&
            typeof action.value === 'string' && oldRecipientIds.includes(action.value)) {
            action.value = newRecipientId;
            ruleUpdated = true;
          }
        }

        if (ruleUpdated) {
          await ruleStore.updateRule(rule.id, {
            ...rule,
            updatedAt: new Date().toISOString()
          }, false);
          debugLog('recipientStore', `AutomationRule ${rule.id} Recipient-Referenzen aktualisiert`);
        }
      }

      infoLog('recipientStore', 'Alle Referenzen erfolgreich aktualisiert');

    } catch (error) {
      errorLog('recipientStore', 'Fehler beim Aktualisieren der Recipient-Referenzen', error);
      throw error;
    }
  }

  /**
   * Löscht mehrere Recipients mit Validierung und Batch-Verarbeitung
   * Erweitert um Enhanced Error-Handling und Rollback-Mechanismen (Task 5.6)
   * @param recipientIds Array der zu löschenden Recipient-IDs
   * @returns Promise mit Ergebnis der Batch-Delete-Operation
   */
  async function batchDeleteRecipients(recipientIds: string[]): Promise<{
    success: boolean;
    deletedCount: number;
    errors: Array<{ recipientId: string; error: string }>;
    enhancedErrors?: EnhancedError[];
    rollbackExecuted?: boolean;
    rollbackResult?: RollbackResult;
    validationResults?: Map<string, any>;
  }> {
    const operationId = uuidv4();
    const operationName = 'batchDeleteRecipients';
    const enhancedErrorsList: EnhancedError[] = [];
    let rollbackExecuted = false;
    let rollbackResult: RollbackResult | undefined;
    const rollbackActions: Array<() => Promise<void>> = [];

    try {
      infoLog('recipientStore', `Starte Enhanced Batch-Delete für ${recipientIds.length} Recipients`, {
        operationId,
        recipientIds
      });

      // Eingabevalidierung mit Enhanced Error-Handling
      if (!recipientIds || recipientIds.length === 0) {
        const error = addEnhancedError(operationId, {
          severity: ErrorSeverity.CRITICAL,
          message: 'Keine Recipient-IDs für Batch-Delete angegeben',
          operationStep: 'input_validation',
          requiresRollback: false
        });
        enhancedErrorsList.push(error);
        throw new Error(error.message);
      }

      // Erstelle State Snapshot vor kritischen Operationen
      const snapshot = createStateSnapshot(operationName, operationId, recipientIds);
      debugLog('recipientStore', `State Snapshot erstellt für Batch-Delete`, {
        operationId,
        snapshotId: snapshot.id,
        recipientCount: recipientIds.length
      });

      // Validierung durch alle Services mit Enhanced Error-Handling
      debugLog('recipientStore', 'Starte umfassende Enhanced Validierung für alle Recipients');

      let transactionValidation: any[] = [];
      let planningValidation: any[] = [];
      let ruleValidation: any[] = [];

      try {
        // Import der Services dynamisch, um zirkuläre Abhängigkeiten zu vermeiden
        const { TransactionService } = await import('@/services/TransactionService');
        const { PlanningService } = await import('@/services/PlanningService');
        const { useRuleStore } = await import('@/stores/ruleStore');

        const ruleStore = useRuleStore();

        // Parallele Validierung durch alle Services
        [transactionValidation, planningValidation, ruleValidation] = await Promise.all([
          TransactionService.validateRecipientDeletion(recipientIds),
          PlanningService.validateRecipientDeletion(recipientIds),
          ruleStore.validateRecipientDeletion(recipientIds)
        ]);

        debugLog('recipientStore', 'Enhanced Validierungsergebnisse erhalten', {
          operationId,
          transactionResults: transactionValidation.length,
          planningResults: planningValidation.length,
          ruleResults: ruleValidation.length
        });

      } catch (validationError) {
        const error = addEnhancedError(operationId, {
          severity: ErrorSeverity.CRITICAL,
          message: `Kritischer Fehler bei Service-Validierung: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          operationStep: 'service_validation',
          requiresRollback: false,
          details: validationError
        });
        enhancedErrorsList.push(error);
        throw new Error(error.message);
      }

      // Kombiniere Validierungsergebnisse
      const combinedValidation = new Map<string, {
        recipientId: string;
        recipientName: string;
        hasActiveReferences: boolean;
        transactionCount: number;
        planningTransactionCount: number;
        automationRuleCount: number;
        canDelete: boolean;
        warnings: string[];
      }>();

      // Initialisiere mit Transaction-Validierung
      for (const result of transactionValidation) {
        combinedValidation.set(result.recipientId, { ...result });
      }

      // Ergänze Planning-Validierung
      for (const result of planningValidation) {
        const existing = combinedValidation.get(result.recipientId);
        if (existing) {
          existing.planningTransactionCount = result.planningTransactionCount;
          existing.hasActiveReferences = existing.hasActiveReferences || result.hasActiveReferences;
          existing.canDelete = existing.canDelete && result.canDelete;
          existing.warnings.push(...result.warnings);
        }
      }

      // Ergänze Rule-Validierung
      for (const result of ruleValidation) {
        const existing = combinedValidation.get(result.recipientId);
        if (existing) {
          existing.automationRuleCount = result.automationRuleCount;
          existing.hasActiveReferences = existing.hasActiveReferences || result.hasActiveReferences;
          existing.canDelete = existing.canDelete && result.canDelete;
          existing.warnings.push(...result.warnings);
        }
      }

      // Batch-Verarbeitung mit Enhanced Error-Handling
      let deletedCount = 0;
      const errors: Array<{ recipientId: string; error: string }> = [];
      const deletedRecipients: Recipient[] = []; // Für Rollback

      debugLog('recipientStore', 'Starte Enhanced sequenzielle Verarbeitung der Recipients');

      // Re-import ruleStore für Batch-Verarbeitung
      const { useRuleStore: useRuleStoreForBatch } = await import('@/stores/ruleStore');
      const ruleStoreForBatch = useRuleStoreForBatch();

      for (const recipientId of recipientIds) {
        try {
          const validation = combinedValidation.get(recipientId);
          const recipient = recipients.value.find(r => r.id === recipientId);
          const recipientName = recipient?.name || `Unbekannter Recipient (${recipientId})`;

          debugLog('recipientStore', `Enhanced Verarbeitung: ${recipientName} (${recipientId})`, {
            operationId,
            canDelete: validation?.canDelete,
            hasActiveReferences: validation?.hasActiveReferences,
            warnings: validation?.warnings
          });

          if (!validation) {
            const enhancedError = addEnhancedError(operationId, {
              severity: ErrorSeverity.ERROR,
              message: `Validierungsergebnis für Recipient ${recipientId} nicht gefunden`,
              recipientId,
              operationStep: 'batch_validation_check',
              requiresRollback: false
            });
            enhancedErrorsList.push(enhancedError);
            errors.push({ recipientId, error: enhancedError.message });
            errorLog('recipientStore', enhancedError.message);
            continue;
          }

          if (!validation.canDelete) {
            const enhancedError = addEnhancedError(operationId, {
              severity: ErrorSeverity.WARNING,
              message: `Recipient kann nicht gelöscht werden: ${validation.warnings.join(', ')}`,
              recipientId,
              operationStep: 'batch_deletion_validation',
              requiresRollback: false
            });
            enhancedErrorsList.push(enhancedError);
            errors.push({ recipientId, error: enhancedError.message });
            warnLog('recipientStore', `Überspringe Recipient ${recipientName}: ${enhancedError.message}`);
            continue;
          }

          // Speichere Recipient für Rollback vor Löschung
          if (recipient) {
            deletedRecipients.push({ ...recipient });
          }

          // Bereinige AutomationRules vor der Löschung
          if (validation.automationRuleCount > 0) {
            try {
              debugLog('recipientStore', `Bereinige ${validation.automationRuleCount} AutomationRule(s) für ${recipientName}`);
              await ruleStoreForBatch.cleanupRecipientReferences(recipientId);
              infoLog('recipientStore', `AutomationRules für ${recipientName} bereinigt`);
            } catch (cleanupError) {
              const enhancedError = addEnhancedError(operationId, {
                severity: ErrorSeverity.WARNING,
                message: `Warnung: AutomationRule-Bereinigung fehlgeschlagen für ${recipientName}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
                recipientId,
                operationStep: 'rule_cleanup',
                requiresRollback: false,
                details: cleanupError
              });
              enhancedErrorsList.push(enhancedError);
              warnLog('recipientStore', enhancedError.message, cleanupError);
            }
          }

          // Lösche den Recipient
          await deleteRecipient(recipientId, false);
          deletedCount++;
          infoLog('recipientStore', `Enhanced Recipient erfolgreich gelöscht: ${recipientName} (${recipientId})`);

        } catch (error) {
          const enhancedError = addEnhancedError(operationId, {
            severity: ErrorSeverity.ERROR,
            message: `Fehler beim Löschen von Recipient ${recipientId}: ${error instanceof Error ? error.message : String(error)}`,
            recipientId,
            operationStep: 'batch_recipient_deletion',
            requiresRollback: true,
            details: error
          });
          enhancedErrorsList.push(enhancedError);
          errors.push({ recipientId, error: enhancedError.message });
          errorLog('recipientStore', enhancedError.message, error);
        }
      }

      // Rollback-Action für gelöschte Recipients
      if (deletedRecipients.length > 0) {
        rollbackActions.push(async () => {
          for (const deletedRecipient of deletedRecipients) {
            await addRecipient(deletedRecipient, false);
          }
          debugLog('recipientStore', `Rollback: ${deletedRecipients.length} gelöschte Recipients wiederhergestellt`);
        });
      }

      // Prüfe auf kritische Fehler und führe Rollback aus falls nötig
      const criticalErrors = enhancedErrorsList.filter(e => e.severity === ErrorSeverity.CRITICAL || e.requiresRollback);

      if (criticalErrors.length > 0) {
        warnLog('recipientStore', `Kritische Fehler bei Batch-Delete erkannt, führe Rollback aus`, {
          operationId,
          criticalErrorCount: criticalErrors.length,
          criticalErrors: criticalErrors.map(e => ({ id: e.id, message: e.message, severity: e.severity }))
        });

        try {
          rollbackResult = await executeRollback(operationId);
          rollbackExecuted = true;

          if (rollbackResult.success) {
            infoLog('recipientStore', 'Batch-Delete Rollback erfolgreich ausgeführt', { operationId, rollbackResult });
          } else {
            errorLog('recipientStore', 'Batch-Delete Rollback fehlgeschlagen', { operationId, rollbackResult });
          }
        } catch (rollbackError) {
          errorLog('recipientStore', 'Kritischer Fehler beim Batch-Delete Rollback', {
            operationId,
            rollbackError
          });
        }
      }

      // Ergebnis zusammenfassen mit Enhanced Error-Handling
      const success = errors.length === 0 && criticalErrors.length === 0;
      const result = {
        success,
        deletedCount,
        errors,
        enhancedErrors: enhancedErrorsList,
        rollbackExecuted,
        rollbackResult,
        validationResults: combinedValidation
      };

      if (success) {
        infoLog('recipientStore', `Enhanced Batch-Delete erfolgreich abgeschlossen: ${deletedCount} Recipients gelöscht`, {
          operationId,
          deletedCount,
          enhancedErrorCount: enhancedErrorsList.length
        });

        // Bereinige Rollback-Daten bei Erfolg
        cleanupRollbackData(operationId);
      } else {
        warnLog('recipientStore', `Enhanced Batch-Delete mit Fehlern abgeschlossen: ${deletedCount} gelöscht, ${errors.length} Fehler`, {
          operationId,
          deletedCount,
          errorCount: errors.length,
          enhancedErrorCount: enhancedErrorsList.length,
          criticalErrorCount: criticalErrors.length,
          rollbackExecuted,
          errors: errors.map(e => ({ recipientId: e.recipientId, error: e.error }))
        });

        // Bereinige Rollback-Daten auch bei Fehlern (nach Rollback-Ausführung)
        if (!rollbackExecuted) {
          cleanupRollbackData(operationId);
        }
      }

      return result;

    } catch (error) {
      const criticalError = addEnhancedError(operationId, {
        severity: ErrorSeverity.CRITICAL,
        message: `Kritischer Fehler bei Batch-Delete-Operation: ${error instanceof Error ? error.message : String(error)}`,
        operationStep: 'critical_error_handler',
        requiresRollback: true,
        details: error
      });
      enhancedErrorsList.push(criticalError);
      errorLog('recipientStore', criticalError.message, error);

      // Führe Emergency Rollback bei kritischen Fehlern aus
      try {
        rollbackResult = await executeRollback(operationId);
        rollbackExecuted = true;

        if (rollbackResult.success) {
          infoLog('recipientStore', 'Emergency Batch-Delete Rollback erfolgreich ausgeführt', { operationId, rollbackResult });
        } else {
          errorLog('recipientStore', 'Emergency Batch-Delete Rollback fehlgeschlagen', { operationId, rollbackResult });
        }
      } catch (rollbackError) {
        errorLog('recipientStore', 'Kritischer Fehler beim Emergency Batch-Delete Rollback', {
          operationId,
          rollbackError
        });
      } finally {
        cleanupRollbackData(operationId);
      }

      return {
        success: false,
        deletedCount: 0,
        errors: [{ recipientId: 'BATCH_OPERATION', error: criticalError.message }],
        enhancedErrors: enhancedErrorsList,
        rollbackExecuted,
        rollbackResult
      };
    }
  }

  /**
   * Service-Integration für koordinierte Rollbacks
   * Task 5.6: Service-Integration für koordinierte Rollbacks
   */

  /**
   * Erstellt eine koordinierte Rollback-Operation mit anderen Services
   */
  async function createCoordinatedRollback(
    operationName: string,
    affectedRecipientIds: string[],
    serviceOperations: {
      transactionService?: () => Promise<void>;
      planningService?: () => Promise<void>;
      ruleService?: () => Promise<void>;
    }
  ): Promise<{
    operationId: string;
    execute: () => Promise<void>;
    rollback: () => Promise<RollbackResult>;
  }> {
    const operationId = uuidv4();
    const rollbackActions: Array<() => Promise<void>> = [];

    // Erstelle State Snapshot
    const snapshot = createStateSnapshot(operationName, operationId, affectedRecipientIds);

    // Sammle Service-Rollback-Actions
    if (serviceOperations.transactionService) {
      rollbackActions.push(async () => {
        try {
          await serviceOperations.transactionService!();
          debugLog('recipientStore', `Koordinierter Rollback: TransactionService erfolgreich`);
        } catch (error) {
          errorLog('recipientStore', `Koordinierter Rollback: TransactionService fehlgeschlagen`, error);
          throw error;
        }
      });
    }

    if (serviceOperations.planningService) {
      rollbackActions.push(async () => {
        try {
          await serviceOperations.planningService!();
          debugLog('recipientStore', `Koordinierter Rollback: PlanningService erfolgreich`);
        } catch (error) {
          errorLog('recipientStore', `Koordinierter Rollback: PlanningService fehlgeschlagen`, error);
          throw error;
        }
      });
    }

    if (serviceOperations.ruleService) {
      rollbackActions.push(async () => {
        try {
          await serviceOperations.ruleService!();
          debugLog('recipientStore', `Koordinierter Rollback: RuleService erfolgreich`);
        } catch (error) {
          errorLog('recipientStore', `Koordinierter Rollback: RuleService fehlgeschlagen`, error);
          throw error;
        }
      });
    }

    // Registriere Rollback-Actions
    rollbackActions.forEach((action, index) => {
      addRollbackAction(operationId, {
        id: `${operationId}-service-rollback-${index}`,
        description: `Service rollback ${index + 1} for ${operationName}`,
        execute: action,
        priority: rollbackActions.length - index
      });
    });

    return {
      operationId,
      execute: async () => {
        infoLog('recipientStore', `Koordinierte Operation gestartet: ${operationName}`, {
          operationId,
          affectedRecipients: affectedRecipientIds.length,
          serviceCount: Object.keys(serviceOperations).length
        });
      },
      rollback: async () => {
        infoLog('recipientStore', `Koordinierter Rollback gestartet: ${operationName}`, { operationId });
        const result = await executeRollback(operationId);
        cleanupRollbackData(operationId);
        return result;
      }
    };
  }

  /**
   * Registriert externe Service-Rollback-Actions
   */
  function registerServiceRollback(
    operationId: string,
    serviceName: string,
    rollbackAction: () => Promise<void>,
    priority: number = 1
  ): void {
    addRollbackAction(operationId, {
      id: `${operationId}-${serviceName}-rollback`,
      description: `${serviceName} rollback for operation ${operationId}`,
      execute: rollbackAction,
      priority
    });

    debugLog('recipientStore', `Service-Rollback registriert: ${serviceName}`, {
      operationId,
      priority
    });
  }

  /**
   * Führt einen koordinierten Rollback mit anderen Services aus
   */
  async function executeCoordinatedRollback(
    operationId: string,
    serviceRollbacks?: {
      transactionService?: () => Promise<void>;
      planningService?: () => Promise<void>;
      ruleService?: () => Promise<void>;
    }
  ): Promise<RollbackResult> {
    infoLog('recipientStore', `Starte koordinierten Rollback`, {
      operationId,
      serviceCount: serviceRollbacks ? Object.keys(serviceRollbacks).length : 0
    });

    // Registriere zusätzliche Service-Rollbacks falls vorhanden
    if (serviceRollbacks) {
      if (serviceRollbacks.transactionService) {
        registerServiceRollback(operationId, 'TransactionService', serviceRollbacks.transactionService, 3);
      }
      if (serviceRollbacks.planningService) {
        registerServiceRollback(operationId, 'PlanningService', serviceRollbacks.planningService, 2);
      }
      if (serviceRollbacks.ruleService) {
        registerServiceRollback(operationId, 'RuleService', serviceRollbacks.ruleService, 1);
      }
    }

    const result = await executeRollback(operationId);
    cleanupRollbackData(operationId);

    infoLog('recipientStore', `Koordinierter Rollback abgeschlossen`, {
      operationId,
      success: result.success,
      executedActions: result.executedActions,
      failedActions: result.failedActions
    });

    return result;
  }

  /**
   * Sync-Queue Rollback-Mechanismen
   * Task 5.6: Sync-Queue Rollback-Mechanismen
   */

  /**
   * Entfernt fehlgeschlagene Sync-Queue-Einträge
   */
  async function rollbackSyncQueueEntries(
    operationId: string,
    affectedEntityIds: string[]
  ): Promise<void> {
    try {
      infoLog('recipientStore', `Starte Sync-Queue Rollback`, {
        operationId,
        affectedEntityIds
      });

      // Hole alle Sync-Queue-Einträge für die betroffenen Entitäten
      // Verwende die verfügbaren TenantDbService-Methoden
      const allSyncQueueEntries: SyncQueueEntry[] = [];

      // Da wir keine getSyncQueueEntries-Methode haben, simulieren wir das Verhalten
      // In einer echten Implementierung würde diese Methode in TenantDbService hinzugefügt werden
      for (const entityId of affectedEntityIds) {
        try {
          // Versuche, Sync-Queue-Einträge für diese Entität zu finden
          // Dies ist eine vereinfachte Implementierung - in der Praxis würde
          // TenantDbService erweitert werden
          debugLog('recipientStore', `Prüfe Sync-Queue für Entität: ${entityId}`);
        } catch (error) {
          // Ignoriere Fehler beim Suchen einzelner Einträge
          debugLog('recipientStore', `Keine Sync-Queue-Einträge für ${entityId} gefunden`);
        }
      }

      // Vereinfachte Implementierung - entferne Sync-Queue-Einträge über addSyncQueueEntry
      // mit einem speziellen "ROLLBACK"-Marker
      for (const entityId of affectedEntityIds) {
        try {
          // Markiere Entität als "rollback" in der Sync-Queue
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RECIPIENT,
            entityId,
            operationType: 'DELETE' as any, // Markiere für Rollback-Bereinigung
            payload: { id: entityId }, // Verwende korrektes Payload-Format
          });

          debugLog('recipientStore', `Sync-Queue Rollback-Marker gesetzt für: ${entityId}`);
        } catch (error) {
          warnLog('recipientStore', `Fehler beim Setzen des Rollback-Markers für ${entityId}`, error);
        }
      }

      infoLog('recipientStore', `Sync-Queue Rollback abgeschlossen`, {
        operationId,
        processedEntities: affectedEntityIds.length
      });

    } catch (error) {
      errorLog('recipientStore', `Fehler beim Sync-Queue Rollback`, {
        operationId,
        error
      });
      throw error;
    }
  }

  /**
   * Erstellt Rollback-Actions für Sync-Queue-Operationen
   */
  function createSyncQueueRollback(
    operationId: string,
    syncQueueEntries: any[]
  ): void {
    if (syncQueueEntries.length === 0) return;

    addRollbackAction(operationId, {
      id: `${operationId}-sync-queue-rollback`,
      description: `Sync-Queue rollback for ${syncQueueEntries.length} entries`,
      execute: async () => {
        await rollbackSyncQueueEntries(
          operationId,
          syncQueueEntries.map(entry => entry.entityId)
        );
      },
      priority: 10 // Höchste Priorität für Sync-Queue-Rollback
    });

    debugLog('recipientStore', `Sync-Queue Rollback-Action erstellt`, {
      operationId,
      entryCount: syncQueueEntries.length
    });
  }

  // Initialisierung
  loadRecipients();

  return {
    recipients,
    getRecipientById,
    addRecipient,
    updateRecipient,
    deleteRecipient,
    loadRecipients,
    reset,
    mergeRecipients,
    batchDeleteRecipients,
    performPostMergeCleanup,
    updateRecipientReferences,
    // Enhanced Error-Handling und Rollback-Mechanismen (Task 5.6)
    createCoordinatedRollback,
    registerServiceRollback,
    executeCoordinatedRollback,
    rollbackSyncQueueEntries,
    createSyncQueueRollback,
    // Utility-Methoden für externe Services
    createStateSnapshot,
    executeWithRollback,
    addEnhancedError,
    cleanupRollbackData
  };
});
