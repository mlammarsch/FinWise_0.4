// src/stores/recipientStore.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Recipient, EntityTypeEnum, SyncOperationType } from '@/types';
import { TenantDbService } from '@/services/TenantDbService';
import { debugLog, errorLog } from '@/utils/logger';

export const useRecipientStore = defineStore('recipient', () => {
  const tenantDbService = new TenantDbService();

  const recipients = ref<Recipient[]>([]);

  const getRecipientById = computed(() => (id: string) =>
    recipients.value.find(r => r.id === id),
  );

  async function addRecipient(recipient: Omit<Recipient, 'id'>, fromSync: boolean = false) {
    try {
      const r: Recipient = { id: uuidv4(), ...recipient };
      const createdRecipient = await tenantDbService.createRecipient(r);
      recipients.value.push(createdRecipient);

      if (!fromSync) {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: createdRecipient.id,
          operationType: SyncOperationType.CREATE,
          payload: createdRecipient
        });
      }

      debugLog('RecipientStore', `Empfänger "${createdRecipient.name}" hinzugefügt`, { id: createdRecipient.id });
      return createdRecipient;
    } catch (error) {
      errorLog('RecipientStore', 'Fehler beim Hinzufügen des Empfängers', { recipient, error });
      throw error;
    }
  }

  async function updateRecipient(id: string, updates: Partial<Recipient>, fromSync: boolean = false) {
    try {
      const success = await tenantDbService.updateRecipient(id, updates);
      if (!success) return false;

      const idx = recipients.value.findIndex(r => r.id === id);
      if (idx !== -1) {
        const updatedRecipient = { ...recipients.value[idx], ...updates, updated_at: new Date().toISOString() };
        recipients.value[idx] = updatedRecipient;

        if (!fromSync) {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RECIPIENT,
            entityId: id,
            operationType: SyncOperationType.UPDATE,
            payload: updatedRecipient
          });
        }
      }

      debugLog('RecipientStore', `Empfänger mit ID "${id}" aktualisiert`);
      return true;
    } catch (error) {
      errorLog('RecipientStore', 'Fehler beim Aktualisieren des Empfängers', { id, updates, error });
      return false;
    }
  }

  async function deleteRecipient(id: string, fromSync: boolean = false) {
    try {
      const success = await tenantDbService.deleteRecipient(id);
      if (!success) return false;

      recipients.value = recipients.value.filter(r => r.id !== id);

      if (!fromSync) {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: id,
          operationType: SyncOperationType.DELETE,
          payload: { id }
        });
      }

      debugLog('RecipientStore', `Empfänger mit ID "${id}" gelöscht`);
      return true;
    } catch (error) {
      errorLog('RecipientStore', 'Fehler beim Löschen des Empfängers', { id, error });
      return false;
    }
  }

  async function loadRecipients() {
    try {
      const loadedRecipients = await tenantDbService.getRecipients();
      recipients.value = loadedRecipients;
      debugLog('RecipientStore', 'Empfänger geladen', { count: loadedRecipients.length });
    } catch (error) {
      errorLog('RecipientStore', 'Fehler beim Laden der Empfänger', { error });
      recipients.value = [];
    }
  }

  async function reset() {
    recipients.value = [];
    await loadRecipients();
    debugLog('RecipientStore', 'Store zurückgesetzt');
  }

  async function handleSyncUpdate(recipientData: Recipient, operationType: SyncOperationType) {
    try {
      if (operationType === SyncOperationType.CREATE || operationType === SyncOperationType.UPDATE) {
        const existingIndex = recipients.value.findIndex(r => r.id === recipientData.id);

        if (existingIndex !== -1) {
          const existing = recipients.value[existingIndex];
          const incomingTimestamp = new Date(recipientData.updated_at || 0).getTime();
          const existingTimestamp = new Date(existing.updated_at || 0).getTime();

          if (incomingTimestamp > existingTimestamp) {
            recipients.value[existingIndex] = recipientData;
            await tenantDbService.updateRecipient(recipientData.id, recipientData);
            debugLog('RecipientStore', `Empfänger "${recipientData.name}" durch Sync aktualisiert`);
          }
        } else {
          recipients.value.push(recipientData);
          await tenantDbService.createRecipient(recipientData);
          debugLog('RecipientStore', `Empfänger "${recipientData.name}" durch Sync erstellt`);
        }
      } else if (operationType === SyncOperationType.DELETE) {
        recipients.value = recipients.value.filter(r => r.id !== recipientData.id);
        await tenantDbService.deleteRecipient(recipientData.id);
        debugLog('RecipientStore', `Empfänger mit ID "${recipientData.id}" durch Sync gelöscht`);
      }
    } catch (error) {
      errorLog('RecipientStore', 'Fehler beim Verarbeiten der Sync-Aktualisierung', { recipientData, operationType, error });
    }
  }

  loadRecipients();

  return {
    recipients,
    getRecipientById,
    addRecipient,
    updateRecipient,
    deleteRecipient,
    loadRecipients,
    reset,
    handleSyncUpdate,
  };
});
