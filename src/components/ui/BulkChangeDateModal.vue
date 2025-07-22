<!-- src/components/ui/BulkChangeDateModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkChangeDateModal.vue
 * Modal für die Massenänderung von Transaktionsdaten
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 *
 * Emits:
 * - close: Modal schließen
 * - confirm: Bestätigung mit neuem Datum
 */
import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";

const props = defineProps<{
  isOpen: boolean;
  selectedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [date: string];
}>();

const selectedDate = ref<string>("");
const modalRef = ref<HTMLDialogElement | null>(null);

function handleClose() {
  selectedDate.value = "";
  emit("close");
}

function handleConfirm() {
  if (selectedDate.value) {
    emit("confirm", selectedDate.value);
    handleClose();
  }
}

function setToday() {
  selectedDate.value = dayjs().format("YYYY-MM-DD");
}

function setYesterday() {
  selectedDate.value = dayjs().subtract(1, "day").format("YYYY-MM-DD");
}

function setTomorrow() {
  selectedDate.value = dayjs().add(1, "day").format("YYYY-MM-DD");
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen && modalRef.value) {
      modalRef.value.showModal();
      // Setze heute als Standard
      selectedDate.value = dayjs().format("YYYY-MM-DD");
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
            icon="mdi:calendar"
            class="text-xl"
          />
          Datum ändern
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
          {{ selectedCount }} Transaktionen erhalten das neue Datum.
        </span>
      </div>

      <!-- Quick Date Buttons -->
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          @click="setYesterday"
          class="btn btn-sm btn-outline"
        >
          <Icon icon="mdi:chevron-left" />
          Gestern
        </button>
        <button
          @click="setToday"
          class="btn btn-sm btn-outline"
        >
          <Icon icon="mdi:calendar-today" />
          Heute
        </button>
        <button
          @click="setTomorrow"
          class="btn btn-sm btn-outline"
        >
          <Icon icon="mdi:chevron-right" />
          Morgen
        </button>
      </div>

      <!-- Date Selection -->
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text">Neues Datum auswählen</span>
        </label>
        <input
          type="date"
          class="input input-bordered w-full"
          v-model="selectedDate"
          :max="dayjs().add(1, 'year').format('YYYY-MM-DD')"
        />
      </div>

      <!-- Preview -->
      <div
        v-if="selectedDate"
        class="alert alert-success alert-soft mb-4"
      >
        <Icon icon="mdi:check-circle" />
        <span>
          Neues Datum: {{ dayjs(selectedDate).format("DD.MM.YYYY") }}
        </span>
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
          :disabled="!selectedDate"
        >
          <Icon
            icon="mdi:check"
            class="text-lg"
          />
          Datum ändern
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
