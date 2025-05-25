// src/stores/recipientStore.ts
/**
 * Pfad: src/stores/recipientStore.ts
 * Empfänger-/Auftraggeber-Store – tenant-spezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Recipient } from '@/types';
import { storageKey } from '@/utils/storageKey';
import { debugLog } from '@/utils/logger';

export const useRecipientStore = defineStore('recipient', () => {
  /* ----------------------------------------------------- State */
  const recipients = ref<Recipient[]>([]);

  /* --------------------------------------------------- Getters */
  const getRecipientById = computed(() => (id: string) =>
    recipients.value.find(r => r.id === id),
  );

  /* --------------------------------------------------- Actions */
  function addRecipient(recipient: Omit<Recipient, 'id'>) {
    const r: Recipient = { id: uuidv4(), ...recipient };
    recipients.value.push(r);
    saveRecipients();
    debugLog('[recipientStore] addRecipient', { id: r.id });
    return r;
  }

  function updateRecipient(id: string, updates: Partial<Recipient>) {
    const idx = recipients.value.findIndex(r => r.id === id);
    if (idx === -1) return false;
    recipients.value[idx] = { ...recipients.value[idx], ...updates };
    saveRecipients();
    debugLog('[recipientStore] updateRecipient', { id });
    return true;
  }

  function deleteRecipient(id: string) {
    recipients.value = recipients.value.filter(r => r.id !== id);
    saveRecipients();
    debugLog('[recipientStore] deleteRecipient', { id });
    return true;
  }

  /* ------------------------------------------------ Persistence */
  function loadRecipients() {
    const raw = localStorage.getItem(storageKey('recipients'));
    recipients.value = raw ? JSON.parse(raw) : [];
    debugLog('[recipientStore] loadRecipients', { cnt: recipients.value.length });
  }

  function saveRecipients() {
    localStorage.setItem(storageKey('recipients'), JSON.stringify(recipients.value));
    debugLog('[recipientStore] saveRecipients', { cnt: recipients.value.length });
  }

  function reset() {
    recipients.value = [];
    loadRecipients();
    debugLog('[recipientStore] reset');
  }

  loadRecipients();

  /* ----------------------------------------------- Exports */
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
