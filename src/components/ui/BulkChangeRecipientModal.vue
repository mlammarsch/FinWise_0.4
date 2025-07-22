<!-- src/components/ui/BulkChangeRecipientModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkChangeRecipientModal.vue
 * Modal für die Massenänderung von Empfängern bei Transaktionen
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 *
 * Emits:
 * - close: Modal schließen
 * - confirm: Bestätigung mit ausgewähltem Empfänger oder null für "alle entfernen"
 */
import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import SelectRecipient from "./SelectRecipient.vue";
import type { Recipient } from "../../types";

const props = defineProps<{
  isOpen: boolean;
  selectedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [recipientId: string | null, removeAll: boolean];
}>();

const selectedRecipientId = ref<string>("");
const removeAllRecipients = ref(false);
const modalRef = ref<HTMLDialogElement | null>(null);

function handleClose() {
  selectedRecipientId.value = "";
  removeAllRecipients.value = false;
  emit("close");
}

function handleConfirm() {
  if (removeAllRecipients.value) {
    emit("confirm", null, true);
  } else if (selectedRecipientId.value) {
    emit("confirm", selectedRecipientId.value, false);
  }
  handleClose();
}

function handleRecipientSelect(recipient: Recipient | null) {
  selectedRecipientId.value = recipient?.id || "";
  if (recipient) {
    removeAllRecipients.value = false;
  }
}

function handleRemoveAllChange() {
  if (removeAllRecipients.value) {
    selectedRecipientId.value = "";
  }
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && modalRef.value) {
      modalRef.value.showModal();
    } else if (modalRef.value) {
      modalRef.value.close();
    }
  }
);
</script>

<template>
  <dialog
    ref="modalRef"
    class="modal"
    @close="handleClose"
  >
    <div class="modal-box">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <Icon
            icon="mdi:account"
            class="text-xl"
          />
          Empfänger ändern
        </h3>
        <button
          @click="handleClose"
          class="btn btn-sm btn-circle btn-ghost"
        >
          <Icon
            icon="mdi:close"
            class="text-lg"
          />
        </button>
      </div>

      <!-- Info -->
      <div class="alert alert-info alert-soft mb-4">
        <Icon icon="mdi:information" />
        <span> {{ selectedCount }} Transaktionen werden bearbeitet. </span>
      </div>

      <!-- Remove All Option -->
      <div class="form-control mb-4">
        <label class="label cursor-pointer">
          <span class="label-text">Alle Empfänger entfernen</span>
          <input
            type="checkbox"
            class="checkbox checkbox-error"
            v-model="removeAllRecipients"
            @change="handleRemoveAllChange"
          />
        </label>
      </div>

      <!-- Recipient Selection -->
      <div
        class="form-control mb-6"
        v-if="!removeAllRecipients"
      >
        <label class="label">
          <span class="label-text">Neuen Empfänger auswählen</span>
        </label>
        <SelectRecipient
          :selected-recipient-id="selectedRecipientId"
          @recipient-selected="handleRecipientSelect"
          placeholder="Empfänger auswählen..."
        />
      </div>

      <!-- Actions -->
      <div class="modal-action">
        <button
          @click="handleClose"
          class="btn btn-ghost"
        >
          Abbrechen
        </button>
        <button
          @click="handleConfirm"
          class="btn"
          :class="removeAllRecipients ? 'btn-error' : 'btn-primary'"
          :disabled="!removeAllRecipients && !selectedRecipientId"
        >
          <Icon
            :icon="removeAllRecipients ? 'mdi:trash-can' : 'mdi:check'"
            class="text-lg"
          />
          {{ removeAllRecipients ? "Entfernen" : "Zuweisen" }}
        </button>
      </div>
    </div>
    <form
      method="dialog"
      class="modal-backdrop"
    >
      <button @click="handleClose">close</button>
    </form>
  </dialog>
</template>
