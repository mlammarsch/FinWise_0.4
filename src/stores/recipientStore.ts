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
      updated_at: (recipientData as any).updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localRecipient = await tenantDbService.getRecipientById(recipientWithTimestamp.id);
      if (localRecipient && localRecipient.updated_at && recipientWithTimestamp.updated_at &&
          new Date(localRecipient.updated_at) >= new Date(recipientWithTimestamp.updated_at)) {
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
      if (!fromSync || (recipientWithTimestamp.updated_at && (!recipients.value[existingRecipientIndex].updated_at || new Date(recipientWithTimestamp.updated_at) > new Date(recipients.value[existingRecipientIndex].updated_at!)))) {
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
          payload: recipientWithTimestamp,
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
      updated_at: recipientUpdatesData.updated_at || new Date().toISOString(),
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

      if (localRecipient.updated_at && recipientUpdatesWithTimestamp.updated_at &&
          new Date(localRecipient.updated_at) >= new Date(recipientUpdatesWithTimestamp.updated_at)) {
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
      if (!fromSync || (recipientUpdatesWithTimestamp.updated_at && (!recipients.value[idx].updated_at || new Date(recipientUpdatesWithTimestamp.updated_at) > new Date(recipients.value[idx].updated_at!)))) {
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
            payload: recipientUpdatesWithTimestamp,
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
  };
});
