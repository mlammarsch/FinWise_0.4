<!-- src/components/ui/BulkAssignCategoryModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkAssignCategoryModal.vue
 * Modal für die Massenzuweisung von Kategorien zu Transaktionen
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 *
 * Emits:
 * - close: Modal schließen
 * - confirm: Bestätigung mit ausgewählter Kategorie oder null für "alle entfernen"
 */
import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import SelectCategory from "./SelectCategory.vue";
import type { Category } from "../../types";

const props = defineProps<{
  isOpen: boolean;
  selectedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [categoryId: string | null, removeAll: boolean];
}>();

const selectedCategoryId = ref<string>("");
const removeAllCategories = ref(false);
const modalRef = ref<HTMLDialogElement | null>(null);

function handleClose() {
  selectedCategoryId.value = "";
  removeAllCategories.value = false;
  emit("close");
}

function handleConfirm() {
  if (removeAllCategories.value) {
    emit("confirm", null, true);
  } else if (selectedCategoryId.value) {
    emit("confirm", selectedCategoryId.value, false);
  }
  handleClose();
}

function handleCategorySelect(category: Category | null) {
  selectedCategoryId.value = category?.id || "";
  if (category) {
    removeAllCategories.value = false;
  }
}

function handleRemoveAllChange() {
  if (removeAllCategories.value) {
    selectedCategoryId.value = "";
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
            icon="mdi:folder"
            class="text-xl"
          />
          Kategorienzuweisung
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
      <div class="alert alert-info mb-4">
        <Icon icon="mdi:information" />
        <span> {{ selectedCount }} Transaktionen werden bearbeitet. </span>
      </div>

      <!-- Remove All Option -->
      <div class="form-control mb-4">
        <label class="label cursor-pointer">
          <span class="label-text">Alle Kategorien entfernen</span>
          <input
            type="checkbox"
            class="checkbox checkbox-error"
            v-model="removeAllCategories"
            @change="handleRemoveAllChange"
          />
        </label>
      </div>

      <!-- Category Selection -->
      <div
        class="form-control mb-6"
        v-if="!removeAllCategories"
      >
        <label class="label">
          <span class="label-text">Neue Kategorie auswählen</span>
        </label>
        <SelectCategory
          :selected-category-id="selectedCategoryId"
          @category-selected="handleCategorySelect"
          placeholder="Kategorie auswählen..."
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
          :class="removeAllCategories ? 'btn-error' : 'btn-primary'"
          :disabled="!removeAllCategories && !selectedCategoryId"
        >
          <Icon
            :icon="removeAllCategories ? 'mdi:trash-can' : 'mdi:check'"
            class="text-lg"
          />
          {{ removeAllCategories ? "Entfernen" : "Zuweisen" }}
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
