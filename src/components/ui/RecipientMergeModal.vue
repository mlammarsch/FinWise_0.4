<!-- src/components/ui/RecipientMergeModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import type { Recipient } from "../../types";
import { useRecipientStore } from "../../stores/recipientStore";
import SelectRecipient from "./SelectRecipient.vue";

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

const recipientStore = useRecipientStore();

// Lokaler State
const currentStep = ref<"select-target" | "confirm">("select-target");
const targetRecipient = ref<Recipient | null>(null);
const selectedRecipientId = ref<string>("");

// Computed Properties
const selectedCount = computed(() => props.selectedRecipients.length);

const canProceedToConfirm = computed(() => {
  return targetRecipient.value !== null;
});

const confirmationMessage = computed(() => {
  if (targetRecipient.value) {
    return `${selectedCount.value} Empfänger zu "${targetRecipient.value.name}" zusammenführen`;
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
  targetRecipient.value = null;
  selectedRecipientId.value = "";
};

const proceedToConfirm = () => {
  if (!canProceedToConfirm.value) return;
  currentStep.value = "confirm";
};

const goBackToSelection = () => {
  currentStep.value = "select-target";
};

const confirmMerge = async () => {
  if (!canProceedToConfirm.value || !targetRecipient.value) return;

  emit("confirm-merge", {
    targetRecipient: targetRecipient.value,
    sourceRecipients: props.selectedRecipients,
    mergeMode: "existing" as const, // Da wir nur noch SelectRecipient verwenden
  });

  closeModal();
};

const selectExistingRecipient = (recipient: Recipient) => {
  targetRecipient.value = recipient;
};

// Handler für SelectRecipient Komponente
const handleRecipientSelect = (recipientId: string | undefined) => {
  if (recipientId) {
    const recipient = recipientStore.getRecipientById(recipientId);
    if (recipient) {
      targetRecipient.value = recipient;
    }
  } else {
    targetRecipient.value = null;
  }
};

const handleRecipientCreate = async (data: { name: string }) => {
  try {
    const newRecipient = await recipientStore.addRecipient({
      name: data.name.trim(),
    });
    targetRecipient.value = newRecipient;
    selectedRecipientId.value = newRecipient.id;
  } catch (error) {
    console.error("Fehler beim Erstellen des Empfängers:", error);
  }
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

        <!-- Ziel-Empfänger Auswahl -->
        <div class="space-y-4">
          <h4 class="font-medium">Zusammenführen zu:</h4>
          <div class="text-sm text-base-content/70 mb-3">
            Wählen Sie einen bestehenden Empfänger aus oder erstellen Sie einen
            neuen durch Eingabe des Namens.
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Ziel-Empfänger:</div>
            <SelectRecipient
              v-model="selectedRecipientId"
              @select="handleRecipientSelect"
              @create="handleRecipientCreate"
            />
          </div>
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
              <span>{{ targetRecipient?.name }}</span>
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
