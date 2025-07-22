<!-- src/components/ui/BulkDeleteModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkDeleteModal.vue
 * Modal für die Massenlöschung von Transaktionen
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 *
 * Emits:
 * - close: Modal schließen
 * - confirm: Bestätigung der Löschung
 */
import { ref, watch, computed } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  isOpen: boolean;
  selectedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const confirmText = ref<string>("");
const modalRef = ref<HTMLDialogElement | null>(null);

const requiredConfirmText = "LÖSCHEN";

function handleClose() {
  confirmText.value = "";
  emit("close");
}

function handleConfirm() {
  if (confirmText.value === requiredConfirmText) {
    emit("confirm");
    handleClose();
  }
}

const isConfirmValid = computed(() => {
  return confirmText.value === requiredConfirmText;
});

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
        <h3 class="font-bold text-lg flex items-center gap-2 text-error">
          <Icon
            icon="mdi:trash-can"
            class="text-xl"
          />
          Transaktionen löschen
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

      <!-- Warning -->
      <div class="alert alert-error alert-soft mb-4">
        <Icon icon="mdi:alert-circle" />
        <div>
          <div class="font-bold">
            Achtung: Diese Aktion kann nicht rückgängig gemacht werden!
          </div>
          <div class="text-sm">
            {{ selectedCount }} Transaktionen werden permanent gelöscht.
          </div>
        </div>
      </div>

      <!-- Confirmation Input -->
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text">
            Geben Sie
            <span class="font-bold text-error"
              >"{{ requiredConfirmText }}"</span
            >
            ein, um zu bestätigen:
          </span>
        </label>
        <input
          type="text"
          class="input input-bordered w-full"
          :class="{ 'input-error': confirmText && !isConfirmValid }"
          v-model="confirmText"
          :placeholder="requiredConfirmText"
          autocomplete="off"
        />
      </div>

      <!-- Transaction Count Info -->
      <div class="bg-base-200 p-4 rounded-lg mb-4">
        <div class="flex items-center gap-2 text-sm">
          <Icon icon="mdi:information-outline" />
          <span
            >Zu löschende Transaktionen:
            <span class="font-bold">{{ selectedCount }}</span></span
          >
        </div>
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
          class="btn btn-error"
          :disabled="!isConfirmValid"
        >
          <Icon
            icon="mdi:trash-can"
            class="text-lg"
          />
          Endgültig löschen
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
