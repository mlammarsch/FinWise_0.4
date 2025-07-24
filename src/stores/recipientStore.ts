/**
 * Pfad: src/stores/recipientStore.ts
 * Speichert Empfänger – jetzt tenant-spezifisch mit bidirektionaler Synchronisation.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { Recipient, SyncQueueEntry } from '@/types';
import { SyncOperationType, EntityTypeEnum } from '@/types';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';

export const useRecipientStore = defineStore('recipient', () => {
  const tenantDbService = new TenantDbService();

  const recipients = ref<Recipient[]>([]);

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
      if (localRecipient && localRecipient.updatedAt && recipientWithTimestamp.updatedAt &&
          new Date(localRecipient.updatedAt) >= new Date(recipientWithTimestamp.updatedAt)) {
        infoLog('recipientStore', `addRecipient (fromSync): Lokaler Empfänger ${localRecipient.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localRecipient; // Gib den lokalen, "gewinnenden" Empfänger zurück
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
      if (!fromSync || (recipientWithTimestamp.updatedAt && (!recipients.value[existingRecipientIndex].updatedAt || new Date(recipientWithTimestamp.updatedAt) > new Date(recipients.value[existingRecipientIndex].updatedAt!)))) {
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
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: recipientWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(recipientWithTimestamp),
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

      if (localRecipient.updatedAt && recipientUpdatesWithTimestamp.updatedAt &&
          new Date(localRecipient.updatedAt) >= new Date(recipientUpdatesWithTimestamp.updatedAt)) {
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
      if (!fromSync || (recipientUpdatesWithTimestamp.updatedAt && (!recipients.value[idx].updatedAt || new Date(recipientUpdatesWithTimestamp.updatedAt) > new Date(recipients.value[idx].updatedAt!)))) {
        recipients.value[idx] = { ...recipients.value[idx], ...recipientUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('recipientStore', `updateRecipient (fromSync): Store-Empfänger ${recipients.value[idx].id} war neuer als eingehender ${recipientUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('recipientStore', `Recipient "${recipientUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${recipientUpdatesWithTimestamp.id}).`);

      // SyncQueue-Logik für alle lokalen Änderungen (konsistente Synchronisation)
      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RECIPIENT,
            entityId: recipientUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(recipientUpdatesWithTimestamp),
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
    recipients.value = [];
    await loadRecipients();
    debugLog('recipientStore', 'Store zurückgesetzt');
  }

  /**
   * Führt mehrere Recipients zu einem Ziel-Recipient zusammen
   */
  async function mergeRecipients(
    sourceRecipientIds: string[],
    targetRecipient: Recipient | { name: string }
  ): Promise<void> {
    try {
      // 1. Validierung der Eingaben
      if (!sourceRecipientIds || sourceRecipientIds.length < 1) {
        throw new Error('Mindestens ein Quell-Recipient erforderlich');
      }

      if (!targetRecipient || !targetRecipient.name?.trim()) {
        throw new Error('Gültiger Ziel-Recipient erforderlich');
      }

      infoLog('recipientStore', `Starte Merge von ${sourceRecipientIds.length} Recipients zu "${targetRecipient.name}"`);

      // 2. Ziel-Recipient erstellen oder verwenden
      let finalTargetRecipient: Recipient;

      if ('id' in targetRecipient) {
        // Bestehender Recipient
        finalTargetRecipient = targetRecipient;
        infoLog('recipientStore', `Verwende bestehenden Ziel-Recipient: ${finalTargetRecipient.name} (${finalTargetRecipient.id})`);
      } else {
        // Neuen Recipient erstellen
        const newRecipientData: Omit<Recipient, 'id' | 'updated_at'> = {
          name: targetRecipient.name.trim(),
          defaultCategoryId: null,
          note: undefined
        };

        finalTargetRecipient = await addRecipient(newRecipientData, false);
        infoLog('recipientStore', `Neuer Ziel-Recipient erstellt: ${finalTargetRecipient.name} (${finalTargetRecipient.id})`);
      }

      // 3. Referenzen in anderen Entitäten aktualisieren
      await updateRecipientReferences(sourceRecipientIds, finalTargetRecipient.id);

      // 4. Quell-Recipients löschen
      for (const sourceId of sourceRecipientIds) {
        // Überspringe den Ziel-Recipient falls er in der Quell-Liste ist
        if (sourceId === finalTargetRecipient.id) {
          warnLog('recipientStore', `Überspringe Löschung des Ziel-Recipients: ${sourceId}`);
          continue;
        }

        const sourceRecipient = recipients.value.find(r => r.id === sourceId);
        if (sourceRecipient) {
          await deleteRecipient(sourceId, false);
          infoLog('recipientStore', `Quell-Recipient gelöscht: ${sourceRecipient.name} (${sourceId})`);
        } else {
          warnLog('recipientStore', `Quell-Recipient nicht gefunden: ${sourceId}`);
        }
      }

      infoLog('recipientStore', `Merge erfolgreich abgeschlossen. Ziel-Recipient: ${finalTargetRecipient.name} (${finalTargetRecipient.id})`);

    } catch (error) {
      errorLog('recipientStore', 'Fehler beim Mergen der Recipients', error);
      throw error;
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
  };
});
