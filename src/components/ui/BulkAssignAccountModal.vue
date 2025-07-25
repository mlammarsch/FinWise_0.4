<!-- src/components/ui/BulkAssignAccountModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkAssignAccountModal.vue
 * Modal für die Massenzuweisung von Konten zu Transaktionen
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 *
 * Emits:
 * - close: Modal schließen
 * - confirm: Bestätigung mit ausgewähltem Konto
 */
import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import SelectAccount from "./SelectAccount.vue";
import type { Account } from "../../types";

const props = defineProps<{
  isOpen: boolean;
  selectedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [accountId: string];
}>();

const selectedAccountId = ref<string>("");
const modalRef = ref<HTMLDialogElement | null>(null);

function handleClose() {
  selectedAccountId.value = "";
  emit("close");
}

function handleConfirm() {
  if (selectedAccountId.value) {
    emit("confirm", selectedAccountId.value);
    handleClose();
  }
}

function handleAccountSelect(accountId: string | undefined) {
  selectedAccountId.value = accountId || "";
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
            icon="mdi:bank"
            class="text-xl"
          />
          Kontozuweisung
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
        <span>
          {{ selectedCount }} Transaktionen werden dem ausgewählten Konto
          zugewiesen.
        </span>
      </div>

      <!-- Account Selection -->
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text">Zielkonto auswählen</span>
        </label>
        <SelectAccount
          :selected-account-id="selectedAccountId"
          @select="handleAccountSelect"
          placeholder="Konto auswählen..."
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
          class="btn btn-primary"
          :disabled="!selectedAccountId"
        >
          <Icon
            icon="mdi:check"
            class="text-lg"
          />
          Zuweisen
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
