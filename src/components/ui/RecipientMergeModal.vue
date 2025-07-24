<!-- src/components/ui/RecipientMergeModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import type { Recipient } from "../../types";

/**
 * Pfad zur Komponente: src/components/ui/RecipientMergeModal.vue
 * Modal-Dialog für das Zusammenführen von Empfängern
 *
 * Props:
 * - selectedRecipients: Recipient[] - Array der ausgewählten Empfänger
 * - show: boolean - Sichtbarkeit des Modals
 *
 * Emits:
 * - update:show: boolean - Modal-Sichtbarkeit aktualisieren
 * - confirm-merge: { targetRecipient: Recipient, sourceRecipients: Recipient[], mergeMode: 'existing' | 'new' } - Merge bestätigen
 * - cancel: void - Modal abbrechen
 */

const props = defineProps<{
  selectedRecipients: Recipient[];
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (
    e: "confirm-merge",
    data: {
      targetRecipient: Recipient;
      sourceRecipients: Recipient[];
      mergeMode: "existing" | "new";
    }
  ): void;
  (e: "cancel"): void;
}>();

// Lokaler State
const currentStep = ref<"select-target" | "confirm">("select-target");
const mergeMode = ref<"existing" | "new">("existing");
const targetRecipient = ref<Recipient | null>(null);
const newRecipientName = ref("");

// Computed Properties
const selectedCount = computed(() => props.selectedRecipients.length);

const canProceedToConfirm = computed(() => {
  if (mergeMode.value === "existing") {
    return targetRecipient.value !== null;
  } else {
    return newRecipientName.value.trim().length > 0;
  }
});

const confirmationMessage = computed(() => {
  if (mergeMode.value === "existing" && targetRecipient.value) {
    return `${selectedCount.value} Empfänger zu "${targetRecipient.value.name}" zusammenführen`;
  } else if (mergeMode.value === "new" && newRecipientName.value.trim()) {
    return `${
      selectedCount.value
    } Empfänger zu neuem Empfänger "${newRecipientName.value.trim()}" zusammenführen`;
  }
  return "";
});

// Methoden
const closeModal = () => {
  emit("update:show", false);
  emit("cancel");
  resetModal();
};

const resetModal = () => {
  currentStep.value = "select-target";
  mergeMode.value = "existing";
  targetRecipient.value = null;
  newRecipientName.value = "";
};

const proceedToConfirm = () => {
  if (!canProceedToConfirm.value) return;
  currentStep.value = "confirm";
};

const goBackToSelection = () => {
  currentStep.value = "select-target";
};

const confirmMerge = () => {
  if (!canProceedToConfirm.value) return;

  let finalTargetRecipient: Recipient;

  if (mergeMode.value === "existing" && targetRecipient.value) {
    finalTargetRecipient = targetRecipient.value;
  } else {
    // Erstelle neuen Empfänger für Merge
    finalTargetRecipient = {
      id: "", // Wird vom Store generiert
      name: newRecipientName.value.trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  emit("confirm-merge", {
    targetRecipient: finalTargetRecipient,
    sourceRecipients: props.selectedRecipients,
    mergeMode: mergeMode.value,
  });

  closeModal();
};

const selectExistingRecipient = (recipient: Recipient) => {
  targetRecipient.value = recipient;
};

// Watcher für Modal-Reset bei Schließung
watch(
  () => props.show,
  (newShow) => {
    if (!newShow) {
      resetModal();
    }
  }
);
</script>

<template>
  <div
    v-if="show"
    class="modal modal-open"
  >
    <div class="modal-box max-w-2xl">
      <!-- Modal Header -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-lg">Empfänger zusammenführen</h3>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          @click="closeModal"
          aria-label="Modal schließen"
        >
          <Icon
            icon="mdi:close"
            class="w-4 h-4"
          />
        </button>
      </div>

      <!-- Schritt-Indikator -->
      <div class="flex items-center mb-6">
        <div class="flex items-center">
          <div
            class="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center text-sm font-medium"
          >
            1
          </div>
          <span class="ml-2 text-sm font-medium">Ziel auswählen</span>
        </div>
        <div class="flex-1 mx-4 h-px bg-base-300"></div>
        <div class="flex items-center">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
            :class="
              currentStep === 'confirm'
                ? 'bg-primary text-primary-content'
                : 'bg-base-300 text-base-content'
            "
          >
            2
          </div>
          <span class="ml-2 text-sm font-medium">Bestätigen</span>
        </div>
      </div>

      <!-- Schritt 1: Ziel-Auswahl -->
      <div
        v-if="currentStep === 'select-target'"
        class="space-y-6"
      >
        <!-- Info über ausgewählte Empfänger -->
        <div class="bg-base-200 rounded-lg p-4">
          <h4 class="font-medium mb-2">
            Ausgewählte Empfänger ({{ selectedCount }}):
          </h4>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="recipient in selectedRecipients"
              :key="recipient.id"
              class="badge badge-outline"
            >
              {{ recipient.name }}
            </span>
          </div>
        </div>

        <!-- Merge-Modus Auswahl -->
        <div class="space-y-4">
          <h4 class="font-medium">Zusammenführen zu:</h4>

          <!-- Option: Bestehenden Empfänger auswählen -->
          <label class="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              v-model="mergeMode"
              value="existing"
              class="radio radio-primary mt-1"
            />
            <div class="flex-1">
              <div class="font-medium">Bestehenden Empfänger auswählen</div>
              <div class="text-sm text-base-content/70 mt-1">
                Wählen Sie einen vorhandenen Empfänger als Ziel für die
                Zusammenführung
              </div>

              <!-- Empfänger-Auswahl (nur wenn dieser Modus aktiv ist) -->
              <div
                v-if="mergeMode === 'existing'"
                class="mt-3 space-y-2"
              >
                <div class="text-sm font-medium">Ziel-Empfänger:</div>
                <div
                  class="max-h-40 overflow-y-auto border border-base-300 rounded-lg"
                >
                  <div
                    v-for="recipient in selectedRecipients"
                    :key="recipient.id"
                    class="p-3 hover:bg-base-200 cursor-pointer border-b border-base-300 last:border-b-0"
                    :class="{
                      'bg-primary/10 border-primary':
                        targetRecipient?.id === recipient.id,
                    }"
                    @click="selectExistingRecipient(recipient)"
                  >
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="font-medium">{{ recipient.name }}</div>
                        <div
                          v-if="recipient.note"
                          class="text-sm text-base-content/70"
                        >
                          {{ recipient.note }}
                        </div>
                      </div>
                      <Icon
                        v-if="targetRecipient?.id === recipient.id"
                        icon="mdi:check-circle"
                        class="w-5 h-5 text-primary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </label>

          <!-- Option: Neuen Empfänger erstellen -->
          <label class="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              v-model="mergeMode"
              value="new"
              class="radio radio-primary mt-1"
            />
            <div class="flex-1">
              <div class="font-medium">Neuen Empfänger erstellen</div>
              <div class="text-sm text-base-content/70 mt-1">
                Erstellen Sie einen neuen Empfänger für die Zusammenführung
              </div>

              <!-- Name-Eingabe (nur wenn dieser Modus aktiv ist) -->
              <div
                v-if="mergeMode === 'new'"
                class="mt-3"
              >
                <label class="block text-sm font-medium mb-1"
                  >Name des neuen Empfängers:</label
                >
                <input
                  type="text"
                  v-model="newRecipientName"
                  class="input input-bordered w-full"
                  placeholder="Name eingeben..."
                  @keyup.enter="proceedToConfirm"
                />
              </div>
            </div>
          </label>
        </div>
      </div>

      <!-- Schritt 2: Bestätigung -->
      <div
        v-if="currentStep === 'confirm'"
        class="space-y-6"
      >
        <!-- Bestätigungsmeldung -->
        <div class="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <div class="flex items-start space-x-3">
            <Icon
              icon="mdi:alert-circle"
              class="w-6 h-6 text-warning flex-shrink-0 mt-0.5"
            />
            <div>
              <h4 class="font-medium text-warning mb-2">
                Zusammenführung bestätigen
              </h4>
              <p class="text-sm">
                {{ confirmationMessage }}
              </p>
              <p class="text-sm mt-2 text-base-content/70">
                Diese Aktion kann nicht rückgängig gemacht werden. Alle
                Transaktionen und Planungen werden auf den Ziel-Empfänger
                übertragen.
              </p>
            </div>
          </div>
        </div>

        <!-- Details der Zusammenführung -->
        <div class="space-y-4">
          <div>
            <h5 class="font-medium mb-2">Quell-Empfänger (werden gelöscht):</h5>
            <div class="space-y-1">
              <div
                v-for="recipient in selectedRecipients"
                :key="recipient.id"
                class="flex items-center space-x-2 text-sm"
              >
                <Icon
                  icon="mdi:account"
                  class="w-4 h-4 text-base-content/50"
                />
                <span>{{ recipient.name }}</span>
              </div>
            </div>
          </div>

          <div>
            <h5 class="font-medium mb-2">Ziel-Empfänger:</h5>
            <div class="flex items-center space-x-2 text-sm">
              <Icon
                icon="mdi:account-check"
                class="w-4 h-4 text-success"
              />
              <span>
                {{
                  mergeMode === "existing"
                    ? targetRecipient?.name
                    : newRecipientName.trim()
                }}
                <span
                  v-if="mergeMode === 'new'"
                  class="text-base-content/70"
                  >(neu)</span
                >
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Actions -->
      <div class="modal-action">
        <div class="flex justify-between w-full">
          <!-- Zurück Button (nur im Bestätigungsschritt) -->
          <button
            v-if="currentStep === 'confirm'"
            class="btn btn-ghost"
            @click="goBackToSelection"
          >
            <Icon
              icon="mdi:arrow-left"
              class="w-4 h-4 mr-2"
            />
            Zurück
          </button>
          <div v-else></div>

          <!-- Rechte Buttons -->
          <div class="flex space-x-2">
            <button
              class="btn btn-ghost"
              @click="closeModal"
            >
              Abbrechen
            </button>

            <button
              v-if="currentStep === 'select-target'"
              class="btn btn-primary"
              :disabled="!canProceedToConfirm"
              @click="proceedToConfirm"
            >
              Weiter
              <Icon
                icon="mdi:arrow-right"
                class="w-4 h-4 ml-2"
              />
            </button>

            <button
              v-if="currentStep === 'confirm'"
              class="btn btn-warning"
              @click="confirmMerge"
            >
              <Icon
                icon="mdi:merge"
                class="w-4 h-4 mr-2"
              />
              Zusammenführen
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Backdrop -->
    <div
      class="modal-backdrop bg-black/30"
      @click="closeModal"
    ></div>
  </div>
</template>
