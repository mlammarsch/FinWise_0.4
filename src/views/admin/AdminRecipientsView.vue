<!-- src/views/admin/AdminRecipientsView.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTransactionStore } from "../../stores/transactionStore";
import type { Recipient } from "../../types";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import PagingComponent from "../../components/ui/PagingComponent.vue";
import ConfirmationModal from "../../components/ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";

/**
 * Pfad zur Komponente: src/views/admin/AdminRecipientsView.vue
 * Verwaltung der Empfänger/Auftraggeber.
 *
 * Komponenten-Props:
 * - Keine Props vorhanden
 *
 * Emits:
 * - Keine Emits vorhanden
 */

const recipientStore = useRecipientStore();
const transactionStore = useTransactionStore();

const showRecipientModal = ref(false);
const isEditMode = ref(false);
const selectedRecipient = ref<Recipient | null>(null);
const nameInput = ref("");
const searchQuery = ref("");

const showDeleteConfirm = ref(false);
const deleteTargetId = ref<string | null>(null);

// Auswahlzustand-Management für Checkbox-Funktionalität
const selectedRecipientIds = ref<Set<string>>(new Set());
const lastSelectedIndex = ref<number | null>(null);

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

const filteredRecipients = computed(() => {
  if (searchQuery.value.trim() === "") {
    return recipientStore.recipients;
  }
  return recipientStore.recipients.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

const totalPages = computed(() => {
  if (itemsPerPage.value === "all") return 1;
  return Math.ceil(
    filteredRecipients.value.length / Number(itemsPerPage.value)
  );
});

const paginatedRecipients = computed(() => {
  if (itemsPerPage.value === "all") return filteredRecipients.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  const end = start + Number(itemsPerPage.value);
  return filteredRecipients.value.slice(start, end);
});

const recipientUsage = computed(() => {
  return (recipientId: string) =>
    transactionStore.transactions.filter((tx) => tx.recipientId === recipientId)
      .length;
});

// Checkbox-Funktionalität
const toggleRecipientSelection = (recipientId: string, event?: MouseEvent) => {
  const currentIndex = paginatedRecipients.value.findIndex(
    (r) => r.id === recipientId
  );

  if (
    event?.shiftKey &&
    lastSelectedIndex.value !== null &&
    currentIndex !== -1
  ) {
    handleShiftClick(currentIndex);
  } else {
    // Normaler Click: nur aktuellen Recipient togglen
    if (selectedRecipientIds.value.has(recipientId)) {
      selectedRecipientIds.value.delete(recipientId);
    } else {
      selectedRecipientIds.value.add(recipientId);
    }

    // lastSelectedIndex für zukünftige Shift-Clicks aktualisieren
    if (currentIndex !== -1) {
      lastSelectedIndex.value = currentIndex;
    }
  }
};

// Shift-Click-Funktionalität für Bereichsauswahl
const handleShiftClick = (currentIndex: number) => {
  if (lastSelectedIndex.value === null) return;

  const startIndex = Math.min(lastSelectedIndex.value, currentIndex);
  const endIndex = Math.max(lastSelectedIndex.value, currentIndex);

  // Bestimme den Auswahlstatus basierend auf dem letzten ausgewählten Element
  const lastSelectedRecipient =
    paginatedRecipients.value[lastSelectedIndex.value];
  const shouldSelect = selectedRecipientIds.value.has(lastSelectedRecipient.id);

  // Alle Recipients im Bereich auswählen/abwählen
  for (let i = startIndex; i <= endIndex; i++) {
    const recipient = paginatedRecipients.value[i];
    if (recipient) {
      if (shouldSelect) {
        selectedRecipientIds.value.add(recipient.id);
      } else {
        selectedRecipientIds.value.delete(recipient.id);
      }
    }
  }
};

const isRecipientSelected = (recipientId: string) => {
  return selectedRecipientIds.value.has(recipientId);
};

// Header-Checkbox computed properties für "Alle auswählen/abwählen"
const areAllRecipientsSelected = computed(() => {
  if (paginatedRecipients.value.length === 0) return false;
  return paginatedRecipients.value.every((recipient) =>
    selectedRecipientIds.value.has(recipient.id)
  );
});

const areSomeRecipientsSelected = computed(() => {
  return selectedRecipientIds.value.size > 0 && !areAllRecipientsSelected.value;
});

// Header-Checkbox Funktionalität für "Alle auswählen/abwählen"
const toggleAllRecipients = () => {
  if (areAllRecipientsSelected.value) {
    // Alle abwählen - entferne alle sichtbaren Recipients aus der Auswahl
    paginatedRecipients.value.forEach((recipient) => {
      selectedRecipientIds.value.delete(recipient.id);
    });
  } else {
    // Alle auswählen - füge alle sichtbaren Recipients zur Auswahl hinzu
    paginatedRecipients.value.forEach((recipient) => {
      selectedRecipientIds.value.add(recipient.id);
    });
  }
};

// Erweiterte Auswahlzustand-Management-Funktionen (Sub-Task 1.4)

// Funktion zum Zurücksetzen aller Auswahlen
const clearSelection = () => {
  selectedRecipientIds.value.clear();
  lastSelectedIndex.value = null;
};

// Funktion zur Bereinigung nicht mehr existierender IDs
const validateSelection = () => {
  const validIds = new Set(recipientStore.recipients.map((r) => r.id));
  const invalidIds: string[] = [];

  selectedRecipientIds.value.forEach((id) => {
    if (!validIds.has(id)) {
      invalidIds.push(id);
      selectedRecipientIds.value.delete(id);
    }
  });

  // lastSelectedIndex zurücksetzen wenn nicht mehr gültig
  if (lastSelectedIndex.value !== null) {
    const currentRecipient = paginatedRecipients.value[lastSelectedIndex.value];
    if (
      !currentRecipient ||
      !selectedRecipientIds.value.has(currentRecipient.id)
    ) {
      lastSelectedIndex.value = null;
    }
  }

  return invalidIds;
};

// Keyboard Event Handler für Escape-Key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && selectedRecipientIds.value.size > 0) {
    clearSelection();
    event.preventDefault();
  }
};

// Optimierte computed properties für bessere Performance
const selectedRecipientsCount = computed(() => selectedRecipientIds.value.size);

const hasSelectedRecipients = computed(() => selectedRecipientsCount.value > 0);

// Watcher für Recipients-Änderungen zur automatischen Validierung
watch(
  () => recipientStore.recipients,
  () => {
    validateSelection();
  },
  { deep: true }
);

// Watcher für Paginierung/Filterung - Auswahl bleibt erhalten
watch([currentPage, itemsPerPage, searchQuery], () => {
  // Validierung bei Änderungen, aber Auswahl bleibt bestehen
  validateSelection();
});

// Lifecycle Hooks für Keyboard Event Listener
onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});

const createRecipient = () => {
  selectedRecipient.value = null;
  nameInput.value = "";
  isEditMode.value = false;
  showRecipientModal.value = true;
};

const editRecipient = (recipient: Recipient) => {
  selectedRecipient.value = recipient;
  nameInput.value = recipient.name;
  isEditMode.value = true;
  showRecipientModal.value = true;
};

const saveRecipient = () => {
  if (!nameInput.value.trim()) return;

  if (isEditMode.value && selectedRecipient.value) {
    const updatedRecipient: Recipient = {
      ...selectedRecipient.value,
      name: nameInput.value.trim(),
      updatedAt: new Date().toISOString(),
    };
    recipientStore.updateRecipient(updatedRecipient);
  } else {
    recipientStore.addRecipient({ name: nameInput.value.trim() });
  }

  showRecipientModal.value = false;
  selectedRecipient.value = null;
  nameInput.value = "";
};

const confirmDeleteRecipient = (recipientId: string) => {
  deleteTargetId.value = recipientId;
  showDeleteConfirm.value = true;
};

const deleteRecipient = () => {
  if (deleteTargetId.value) {
    recipientStore.deleteRecipient(deleteTargetId.value);
    deleteTargetId.value = null;
  }
  showDeleteConfirm.value = false;
};
</script>

<template>
  <div class="max-w-4xl mx-auto flex flex-col min-h-screen py-8">
    <!-- Header -->
    <div
      class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
    >
      <h2 class="text-xl font-bold flex-shrink-0">
        Empfänger/Auftraggeber verwalten
      </h2>
      <SearchGroup
        btnRight="Neu"
        btnRightIcon="mdi:plus"
        @search="(query: string) => (searchQuery = query)"
        @btn-right-click="createRecipient"
      />
    </div>

    <!-- Auswahlzähler-Anzeige (Sub-Task 1.5) -->
    <div
      v-if="hasSelectedRecipients"
      class="mb-4"
    >
      <div class="alert alert-soft">
        <Icon
          icon="mdi:check-circle"
          class="w-5 h-5"
        />
        <span>
          {{ selectedRecipientsCount }}
          {{ selectedRecipientsCount === 1 ? "Empfänger" : "Empfänger" }}
          ausgewählt
        </span>
        <button
          @click="clearSelection"
          class="btn btn-sm btn-ghost ml-auto"
          title="Auswahl aufheben (ESC)"
        >
          <Icon
            icon="mdi:close"
            class="w-4 h-4"
          />
          Auswahl aufheben
        </button>
      </div>
    </div>

    <!-- Card -->
    <div class="card bg-base-100 shadow-md border border-base-300 w-full mt-6">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th class="w-12">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="areAllRecipientsSelected"
                    :indeterminate="areSomeRecipientsSelected"
                    @change="toggleAllRecipients"
                  />
                </th>
                <th>Name</th>
                <th class="text-center hidden md:table-cell">
                  Verwendet in Buchungen
                </th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="recipient in paginatedRecipients"
                :key="recipient.id"
              >
                <td>
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="isRecipientSelected(recipient.id)"
                    @change="toggleRecipientSelection(recipient.id)"
                  />
                </td>
                <td>{{ recipient.name }}</td>
                <td class="text-center hidden md:table-cell">
                  {{ recipientUsage(recipient.id) }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-sm text-secondary flex items-center justify-center"
                      @click="editRecipient(recipient)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-sm text-error flex items-center justify-center"
                      @click="confirmDeleteRecipient(recipient.id)"
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginierungskomponente -->
        <PagingComponent
          :currentPage="currentPage"
          :totalPages="totalPages"
          :itemsPerPage="itemsPerPage"
          @update:currentPage="(val) => (currentPage = val)"
          @update:itemsPerPage="(val) => (itemsPerPage = val)"
        />
      </div>
    </div>

    <!-- Bearbeiten / Neu Modal -->
    <dialog
      v-if="showRecipientModal"
      class="modal modal-open"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          {{ isEditMode ? "Empfänger bearbeiten" : "Neuen Empfänger anlegen" }}
        </h3>
        <input
          type="text"
          v-model="nameInput"
          placeholder="Empfängername"
          class="input input-bordered w-full mb-4"
        />
        <div class="modal-action">
          <button
            class="btn"
            @click="showRecipientModal = false"
          >
            Abbrechen
          </button>
          <button
            class="btn btn-primary"
            @click="saveRecipient"
          >
            Speichern
          </button>
        </div>
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showRecipientModal = false"
      ></div>
    </dialog>

    <!-- Bestätigungsdialog zum Löschen -->
    <ConfirmationModal
      v-if="showDeleteConfirm"
      title="Empfänger löschen"
      message="Möchtest Du diesen Empfänger wirklich löschen?"
      confirmText="Löschen"
      cancelText="Abbrechen"
      @confirm="deleteRecipient"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
