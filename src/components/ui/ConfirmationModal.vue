<!-- src/components/ui/ConfirmationModal.vue -->
<script setup lang="ts">
import { defineEmits, defineProps } from "vue";

/**
 * Pfad zur Komponente: src/components/ui/ConfirmationModal.vue
 * Ein einfacher Bestätigungsdialog für Löschaktionen und ähnliche Zwecke.
 *
 * Komponenten-Props:
 * - title: string – Titel des Dialogs
 * - message: string – Nachricht im Dialog
 * - confirmText: string – Beschriftung des Bestätigungsbuttons
 * - cancelText: string – Beschriftung des Abbrechen-Buttons
 *
 * Emits:
 * - confirm – wird ausgelöst, wenn der Nutzer bestätigt
 * - cancel – wird ausgelöst, wenn der Nutzer abbricht
 */

const props = defineProps<{
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  useHtml?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <dialog class="modal modal-open">
    <div class="modal-box border border-base-300 max-w-2xl">
      <h3 class="font-bold text-lg mb-4">{{ props.title }}</h3>
      <div
        v-if="props.useHtml"
        class="py-4 prose prose-sm max-w-none"
        v-html="props.message"
      ></div>
      <p
        v-else
        class="py-4 whitespace-pre-line"
      >
        {{ props.message }}
      </p>
      <div class="modal-action">
        <button
          class="btn btn-ghost"
          @click="emit('cancel')"
        >
          {{ props.cancelText }}
        </button>
        <button
          class="btn btn-primary"
          @click="emit('confirm')"
        >
          {{ props.confirmText }}
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="emit('cancel')"
    ></div>
  </dialog>
</template>
