<!-- src/views/admin/AdminRecipientsView.vue -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRecipientStore } from "../../stores/recipientStore";
import { useTransactionStore } from "../../stores/transactionStore";
import { useRuleStore } from "../../stores/ruleStore";
import { usePlanningStore } from "../../stores/planningStore";
import type { Recipient } from "../../types";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import PagingComponent from "../../components/ui/PagingComponent.vue";
import ConfirmationModal from "../../components/ui/ConfirmationModal.vue";
import RecipientBulkActionDropdown from "../../components/ui/RecipientBulkActionDropdown.vue";
import RecipientMergeModal from "../../components/ui/RecipientMergeModal.vue";
import RecipientDeleteConfirmModal from "../../components/ui/RecipientDeleteConfirmModal.vue";
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
const ruleStore = useRuleStore();
const planningStore = usePlanningStore();

const showRecipientModal = ref(false);
const isEditMode = ref(false);
const selectedRecipient = ref<Recipient | null>(null);
const nameInput = ref("");
const searchQuery = ref("");

const showDeleteConfirm = ref(false);
const deleteTargetId = ref<string | null>(null);

// Fehlermodal für Löschvalidierung
const showDeleteError = ref(false);
const deleteErrorMessage = ref("");

// Merge-Modal State
const showMergeModal = ref(false);

// Orphan Cleanup Modal State
const showOrphanCleanupModal = ref(false);
const orphanCleanupResult = ref<{
  deletedCount: number;
  warningRecipients: Array<{
    name: string;
    inRules: boolean;
    inPlanning: boolean;
  }>;
} | null>(null);

// Auswahlzustand-Management für Checkbox-Funktionalität
const selectedRecipientIds = ref<Set<string>>(new Set());
const lastSelectedIndex = ref<number | null>(null);

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

// Sortierungsstate
const sortField = ref<"name" | "usage">("name");
const sortDirection = ref<"asc" | "desc">("asc");

const filteredRecipients = computed(() => {
  let filtered = recipientStore.recipients;

  // Filtern nach Suchbegriff
  if (searchQuery.value.trim() !== "") {
    filtered = filtered.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  // Sortieren
  return [...filtered].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (sortField.value === "name") {
      aValue = a.name.toLowerCase();
      bValue = b.name.toLowerCase();
    } else {
      // usage
      aValue = recipientUsage.value(a.id);
      bValue = recipientUsage.value(b.id);
    }

    let comparison = 0;
    if (aValue < bValue) {
      comparison = -1;
    } else if (aValue > bValue) {
      comparison = 1;
    }

    return sortDirection.value === "asc" ? comparison : -comparison;
  });
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

// Computed property für ausgewählte Recipients (für Merge-Modal)
const selectedRecipients = computed(() => {
  return recipientStore.recipients.filter((r) =>
    selectedRecipientIds.value.has(r.id)
  );
});

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
  // Prüfe ob Empfänger in Transaktionen verwendet wird
  const usageCount = recipientUsage.value(recipientId);

  if (usageCount > 0) {
    // Zeige Fehlermeldung wenn Empfänger noch verwendet wird
    const recipient = recipientStore.getRecipientById(recipientId);
    const recipientName = recipient?.name || "Unbekannter Empfänger";

    // Setze Fehlermeldung und zeige Modal
    deleteErrorMessage.value = `Der Empfänger "${recipientName}" kann nicht gelöscht werden, da er noch in ${usageCount} Transaktion${
      usageCount === 1 ? "" : "en"
    } verwendet wird.\n\nBitte entfernen Sie zuerst alle Transaktionen mit diesem Empfänger oder weisen Sie sie einem anderen Empfänger zu.`;
    showDeleteError.value = true;
    return;
  }

  deleteTargetId.value = recipientId;
  showDeleteConfirm.value = true;
};

const deleteRecipient = async () => {
  if (deleteTargetId.value) {
    try {
      // Zusätzliche Sicherheitsprüfung vor dem Löschen
      const usageCount = recipientUsage.value(deleteTargetId.value);

      if (usageCount > 0) {
        const recipient = recipientStore.getRecipientById(deleteTargetId.value);
        const recipientName = recipient?.name || "Unbekannter Empfänger";

        deleteErrorMessage.value = `Fehler: Der Empfänger "${recipientName}" kann nicht gelöscht werden, da er noch in ${usageCount} Transaktion${
          usageCount === 1 ? "" : "en"
        } verwendet wird.`;
        showDeleteError.value = true;
        showDeleteConfirm.value = false;
        deleteTargetId.value = null;
        return;
      }

      await recipientStore.deleteRecipient(deleteTargetId.value);
      deleteTargetId.value = null;
    } catch (error) {
      // Fehler vom Store abfangen und als Modal anzeigen
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Löschen des Empfängers";
      deleteErrorMessage.value = errorMessage;
      showDeleteError.value = true;
      deleteTargetId.value = null;
    }
  }
  showDeleteConfirm.value = false;
};

// Batch-Action Event-Handler (Sub-Task 2.5)
const handleMergeRecipients = () => {
  if (selectedRecipientIds.value.size < 2) {
    console.warn("Mindestens 2 Empfänger müssen ausgewählt sein für Merge");
    return;
  }
  showMergeModal.value = true;
};

// Merge-Modal Event-Handler
const handleMergeConfirm = async (data: {
  targetRecipient: Recipient;
  sourceRecipients: Recipient[];
  mergeMode: "existing" | "new";
}) => {
  try {
    console.log("Merge bestätigt:", data);

    // Extrahiere die IDs der Quell-Empfänger
    const sourceRecipientIds = data.sourceRecipients.map((r) => r.id);

    // Führe den Merge durch
    const result = await recipientStore.mergeRecipients(
      sourceRecipientIds,
      data.targetRecipient
    );

    if (result.success) {
      console.log("Merge erfolgreich abgeschlossen:", result);
      clearSelection();
      showMergeModal.value = false;
    } else {
      console.error("Merge fehlgeschlagen:", result.errors);
      // TODO: Fehler-Modal anzeigen
    }
  } catch (error) {
    console.error("Fehler beim Merge:", error);
    // TODO: Fehler-Modal anzeigen
  }
};

const handleMergeCancel = () => {
  showMergeModal.value = false;
};

// Orphan Cleanup Funktionalität
const handleOrphanCleanup = async () => {
  try {
    console.log("Starte Orphan Cleanup...");

    const allRecipients = recipientStore.recipients;
    const orphanRecipients: string[] = [];
    const warningRecipients: Array<{
      name: string;
      inRules: boolean;
      inPlanning: boolean;
    }> = [];

    // Prüfe jeden Empfänger auf Verbindungen
    for (const recipient of allRecipients) {
      // Prüfe Transaktionen
      const hasTransactions = transactionStore.transactions.some(
        (tx) => tx.recipientId === recipient.id
      );

      if (hasTransactions) {
        continue; // Hat Transaktionen, nicht orphan
      }

      // Prüfe Planning-Transaktionen
      const hasPlanningTransactions = planningStore.planningTransactions.some(
        (pt) => pt.recipientId === recipient.id
      );

      // Prüfe Automation Rules
      const hasRuleReferences =
        (await ruleStore.countAutomationRulesWithRecipient(recipient.id)) > 0;

      // Kategorisierung
      if (!hasPlanningTransactions && !hasRuleReferences) {
        // Vollständig orphan - kann gelöscht werden
        orphanRecipients.push(recipient.id);
      } else {
        // Hat Referenzen in Rules/Planning aber nicht in Transactions
        warningRecipients.push({
          name: recipient.name,
          inRules: hasRuleReferences,
          inPlanning: hasPlanningTransactions,
        });
      }
    }

    // Lösche orphane Empfänger
    let deletedCount = 0;
    for (const recipientId of orphanRecipients) {
      try {
        await recipientStore.deleteRecipient(recipientId);
        deletedCount++;
      } catch (error) {
        console.error(
          `Fehler beim Löschen von Empfänger ${recipientId}:`,
          error
        );
      }
    }

    // Setze Ergebnis und zeige Modal
    orphanCleanupResult.value = {
      deletedCount,
      warningRecipients,
    };
    showOrphanCleanupModal.value = true;

    console.log(
      `Orphan Cleanup abgeschlossen: ${deletedCount} Empfänger gelöscht`
    );
  } catch (error) {
    console.error("Fehler beim Orphan Cleanup:", error);
  }
};

const handleOrphanCleanupClose = () => {
  showOrphanCleanupModal.value = false;
  orphanCleanupResult.value = null;
};

// Sortierungsfunktionen
const toggleSort = (field: "name" | "usage") => {
  if (sortField.value === field) {
    // Gleiche Spalte: Richtung umkehren
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
  } else {
    // Neue Spalte: auf aufsteigend setzen
    sortField.value = field;
    sortDirection.value = "asc";
  }
};

const getSortIcon = (field: "name" | "usage") => {
  if (sortField.value !== field) {
    return "mdi:sort";
  }
  return sortDirection.value === "asc"
    ? "mdi:sort-ascending"
    : "mdi:sort-descending";
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
        btnMiddle="Bereinigen"
        btnMiddleIcon="mdi:broom"
        btnRight="Neu"
        btnRightIcon="mdi:plus"
        @search="(query: string) => (searchQuery = query)"
        @btn-middle-click="handleOrphanCleanup"
        @btn-right-click="createRecipient"
      />
    </div>

    <!-- Auswahlzähler-Anzeige mit Batch-Actions (Sub-Task 1.5 + 2.5) -->
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
        <div class="ml-auto flex items-center space-x-2">
          <!-- Batch-Actions Dropdown -->
          <RecipientBulkActionDropdown
            :selected-count="selectedRecipientsCount"
            @merge-recipients="handleMergeRecipients"
          />
          <!-- Auswahl aufheben Button -->
          <button
            @click="clearSelection"
            class="btn btn-sm btn-ghost"
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
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="toggleSort('name')"
                >
                  <div class="flex items-center justify-between">
                    <span>Name</span>
                    <Icon
                      :icon="getSortIcon('name')"
                      class="w-4 h-4 ml-1"
                      :class="{ 'text-primary': sortField === 'name' }"
                    />
                  </div>
                </th>
                <th
                  class="text-center hidden md:table-cell cursor-pointer hover:bg-base-200 select-none"
                  @click="toggleSort('usage')"
                >
                  <div class="flex items-center justify-center">
                    <span>Verwendet in Buchungen</span>
                    <Icon
                      :icon="getSortIcon('usage')"
                      class="w-4 h-4 ml-1"
                      :class="{ 'text-primary': sortField === 'usage' }"
                    />
                  </div>
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

    <!-- Fehlermodal für Löschvalidierung -->
    <dialog
      v-if="showDeleteError"
      class="modal modal-open"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
          Löschen nicht möglich
        </h3>
        <div class="alert alert-soft alert-error mb-4">
          <Icon
            icon="mdi:information"
            class="w-5 h-5"
          />
          <div class="whitespace-pre-line">{{ deleteErrorMessage }}</div>
        </div>
        <div class="modal-action">
          <button
            class="btn btn-primary"
            @click="showDeleteError = false"
          >
            Verstanden
          </button>
        </div>
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showDeleteError = false"
      ></div>
    </dialog>

    <!-- Merge-Modal -->
    <RecipientMergeModal
      v-model:show="showMergeModal"
      :selected-recipients="selectedRecipients"
      @confirm-merge="handleMergeConfirm"
      @cancel="handleMergeCancel"
    />

    <!-- Orphan Cleanup Result Modal -->
    <dialog
      v-if="showOrphanCleanupModal"
      class="modal modal-open"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Orphan-Empfänger Bereinigung</h3>

        <div
          v-if="orphanCleanupResult"
          class="space-y-4"
        >
          <div class="alert alert-success alert-soft">
            <Icon
              icon="mdi:check-circle"
              class="w-5 h-5"
            />
            <span>
              {{ orphanCleanupResult.deletedCount }} orphane Empfänger wurden
              erfolgreich gelöscht.
            </span>
          </div>

          <div
            v-if="orphanCleanupResult.warningRecipients.length > 0"
            class="alert alert-warning"
          >
            <Icon
              icon="mdi:information"
              class="w-5 h-5"
            />
            <div>
              <p class="font-semibold mb-2">
                {{ orphanCleanupResult.warningRecipients.length }} Empfänger
                haben noch Referenzen:
              </p>
              <ul class="list-disc list-inside space-y-1">
                <li
                  v-for="recipient in orphanCleanupResult.warningRecipients"
                  :key="recipient.name"
                  class="text-sm"
                >
                  <strong>{{ recipient.name }}</strong>
                  <span v-if="recipient.inRules && recipient.inPlanning">
                    - in Regeln und Planungen</span
                  >
                  <span v-else-if="recipient.inRules"> - in Regeln</span>
                  <span v-else-if="recipient.inPlanning"> - in Planungen</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="modal-action">
          <button
            class="btn btn-primary"
            @click="handleOrphanCleanupClose"
          >
            OK
          </button>
        </div>
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="handleOrphanCleanupClose"
      ></div>
    </dialog>
  </div>
</template>
