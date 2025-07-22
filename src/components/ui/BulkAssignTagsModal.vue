<!-- src/components/ui/BulkAssignTagsModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/BulkAssignTagsModal.vue
 * Modal für die Massenzuweisung von Tags zu Transaktionen
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - selectedCount: number - Anzahl der ausgewählten Transaktionen
 *
 * Emits:
 * - close: Modal schließen
 * - confirm: Bestätigung mit ausgewählten Tags oder null für "alle entfernen"
 */
import { ref, watch, computed } from "vue";
import { Icon } from "@iconify/vue";
import TagSearchableDropdown from "./TagSearchableDropdown.vue";
import type { Tag } from "../../types";
import { useTagStore } from "../../stores/tagStore";

const props = defineProps<{
  isOpen: boolean;
  selectedCount: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [tagIds: string[] | null, removeAll: boolean];
}>();

const selectedTagIds = ref<string[]>([]);
const removeAllTags = ref(false);
const modalRef = ref<HTMLDialogElement | null>(null);

const tagStore = useTagStore();

const tagOptions = computed(() => {
  return tagStore.tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon,
  }));
});

function handleClose() {
  selectedTagIds.value = [];
  removeAllTags.value = false;
  emit("close");
}

function handleConfirm() {
  if (removeAllTags.value) {
    emit("confirm", null, true);
  } else if (selectedTagIds.value.length > 0) {
    emit("confirm", selectedTagIds.value, false);
  }
  handleClose();
}

function handleTagsSelect(tags: Tag[]) {
  selectedTagIds.value = tags.map((tag) => tag.id);
  if (tags.length > 0) {
    removeAllTags.value = false;
  }
}

function handleRemoveAllChange() {
  if (removeAllTags.value) {
    selectedTagIds.value = [];
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
            icon="mdi:tag-multiple"
            class="text-xl"
          />
          Tags zuweisen
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
          <span class="label-text">Alle Tags entfernen</span>
          <input
            type="checkbox"
            class="checkbox checkbox-error"
            v-model="removeAllTags"
            @change="handleRemoveAllChange"
          />
        </label>
      </div>

      <!-- Tag Selection -->
      <div
        class="form-control mb-6"
        v-if="!removeAllTags"
      >
        <label class="label">
          <span class="label-text">Tags auswählen</span>
        </label>
        <TagSearchableDropdown
          :modelValue="selectedTagIds"
          :options="tagOptions"
          @update:modelValue="selectedTagIds = $event"
          placeholder="Tags auswählen..."
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
          :class="removeAllTags ? 'btn-error' : 'btn-primary'"
          :disabled="!removeAllTags && selectedTagIds.length === 0"
        >
          <Icon
            :icon="removeAllTags ? 'mdi:trash-can' : 'mdi:check'"
            class="text-lg"
          />
          {{ removeAllTags ? "Entfernen" : "Zuweisen" }}
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
