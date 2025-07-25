<!-- src/components/ui/RecipientDeleteConfirmModal.vue -->
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import type { Recipient } from "../../types";

/**
 * Pfad zur Komponente: src/components/ui/RecipientDeleteConfirmModal.vue
 * Modal-Dialog für die sichere Löschung von Empfängern mit Validierung
 *
 * Props:
 * - selectedRecipients: Recipient[] - Array der zu löschenden Empfänger
 * - show: boolean - Sichtbarkeit des Modals
 * - validationResults: RecipientValidationResult[] - Validierungsergebnisse für jeden Empfänger
 *
 * Emits:
 * - update:show: boolean - Modal-Sichtbarkeit aktualisieren
 * - confirm: { recipients: Recipient[] } - Löschung bestätigen
 * - cancel: void - Modal abbrechen
 */

// Validation Result Interface (wird in späteren Subtasks definiert)
interface RecipientValidationResult {
  recipientId: string;
  recipientName: string;
  hasActiveReferences: boolean;
  transactionCount: number;
  planningTransactionCount: number;
  automationRuleCount: number;
  canDelete: boolean;
  warnings: string[];
}

const props = defineProps<{
  selectedRecipients: Recipient[];
  show: boolean;
  validationResults?: RecipientValidationResult[];
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm", data: { recipients: Recipient[] }): void;
  (e: "cancel"): void;
}>();

// Lokaler State
const confirmText = ref<string>("");
const requiredConfirmText = "LÖSCHEN";

// Computed Properties
const selectedCount = computed(() => props.selectedRecipients.length);

const recipientsWithWarnings = computed(() => {
  if (!props.validationResults) return [];
  return props.validationResults.filter((result) => result.hasActiveReferences);
});

const recipientsWithoutWarnings = computed(() => {
  if (!props.validationResults) return props.selectedRecipients;
  const warningIds = new Set(
    recipientsWithWarnings.value.map((r) => r.recipientId)
  );
  return props.selectedRecipients.filter(
    (recipient) => !warningIds.has(recipient.id)
  );
});

const hasWarnings = computed(() => recipientsWithWarnings.value.length > 0);

const canDelete = computed(() => {
  if (!props.validationResults) return true;
  return props.validationResults.every((result) => result.canDelete);
});

const isConfirmValid = computed(() => {
  return confirmText.value === requiredConfirmText;
});

const totalReferences = computed(() => {
  if (!props.validationResults) return 0;
  return props.validationResults.reduce((total, result) => {
    return (
      total +
      result.transactionCount +
      result.planningTransactionCount +
      result.automationRuleCount
    );
  }, 0);
});

// Methoden
const closeModal = () => {
  emit("update:show", false);
  emit("cancel");
  resetModal();
};

const resetModal = () => {
  confirmText.value = "";
};

const confirmDelete = () => {
  if (!isConfirmValid.value || !canDelete.value) return;

  emit("confirm", {
    recipients: props.selectedRecipients,
  });

  closeModal();
};

const getValidationResult = (
  recipientId: string
): RecipientValidationResult | undefined => {
  return props.validationResults?.find(
    (result) => result.recipientId === recipientId
  );
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
        <h3 class="font-bold text-lg flex items-center gap-2 text-error">
          <Icon
            icon="mdi:trash-can"
            class="w-5 h-5"
          />
          Empfänger löschen
        </h3>
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

      <!-- Warning Alert -->
      <div class="alert alert-error mb-4">
        <Icon
          icon="mdi:alert-circle"
          class="w-5 h-5"
        />
        <div>
          <div class="font-bold">
            Achtung: Diese Aktion kann nicht rückgängig gemacht werden!
          </div>
          <div class="text-sm">
            {{ selectedCount }} Empfänger werden permanent gelöscht.
            <span v-if="totalReferences > 0">
              Dabei werden {{ totalReferences }} Referenzen in Transaktionen,
              Planungen und Regeln entfernt.
            </span>
          </div>
        </div>
      </div>

      <!-- Empfänger-Liste -->
      <div class="space-y-4 mb-6">
        <h4 class="font-medium">
          Zu löschende Empfänger ({{ selectedCount }}):
        </h4>

        <!-- Empfänger ohne Warnungen -->
        <div
          v-if="recipientsWithoutWarnings.length > 0"
          class="space-y-2"
        >
          <div
            v-for="recipient in recipientsWithoutWarnings"
            :key="recipient.id"
            class="flex items-center justify-between p-3 bg-base-200 rounded-lg"
          >
            <div class="flex items-center space-x-3">
              <Icon
                icon="mdi:account"
                class="w-5 h-5 text-base-content/70"
              />
              <div>
                <div class="font-medium">{{ recipient.name }}</div>
                <div
                  v-if="recipient.note"
                  class="text-sm text-base-content/70"
                >
                  {{ recipient.note }}
                </div>
              </div>
            </div>
            <div class="badge badge-success badge-outline">
              Keine Referenzen
            </div>
          </div>
        </div>

        <!-- Empfänger mit Warnungen -->
        <div
          v-if="recipientsWithWarnings.length > 0"
          class="space-y-2"
        >
          <div
            v-for="result in recipientsWithWarnings"
            :key="result.recipientId"
            class="p-3 bg-warning/10 border border-warning/20 rounded-lg"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center space-x-3">
                <Icon
                  icon="mdi:account-alert"
                  class="w-5 h-5 text-warning flex-shrink-0"
                />
                <div>
                  <div class="font-medium">{{ result.recipientName }}</div>
                  <div class="text-sm text-base-content/70">
                    Hat aktive Referenzen
                  </div>
                </div>
              </div>
              <div class="badge badge-warning">
                {{
                  result.transactionCount +
                  result.planningTransactionCount +
                  result.automationRuleCount
                }}
                Referenzen
              </div>
            </div>

            <!-- Referenz-Details -->
            <div class="ml-8 space-y-1 text-sm">
              <div
                v-if="result.transactionCount > 0"
                class="flex items-center space-x-2"
              >
                <Icon
                  icon="mdi:swap-horizontal"
                  class="w-4 h-4 text-base-content/50"
                />
                <span>{{ result.transactionCount }} Transaktionen</span>
              </div>
              <div
                v-if="result.planningTransactionCount > 0"
                class="flex items-center space-x-2"
              >
                <Icon
                  icon="mdi:calendar-clock"
                  class="w-4 h-4 text-base-content/50"
                />
                <span
                  >{{
                    result.planningTransactionCount
                  }}
                  Planungstransaktionen</span
                >
              </div>
              <div
                v-if="result.automationRuleCount > 0"
                class="flex items-center space-x-2"
              >
                <Icon
                  icon="mdi:cog"
                  class="w-4 h-4 text-base-content/50"
                />
                <span
                  >{{ result.automationRuleCount }} Automatisierungsregeln</span
                >
              </div>
            </div>

            <!-- Warnungen -->
            <div
              v-if="result.warnings.length > 0"
              class="ml-8 mt-2 space-y-1"
            >
              <div
                v-for="warning in result.warnings"
                :key="warning"
                class="text-sm text-warning flex items-start space-x-2"
              >
                <Icon
                  icon="mdi:alert-circle-outline"
                  class="w-4 h-4 flex-shrink-0 mt-0.5"
                />
                <span>{{ warning }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bestätigungstext-Eingabe -->
      <div
        v-if="canDelete"
        class="form-control mb-6"
      >
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
          @keyup.enter="confirmDelete"
        />
      </div>

      <!-- Nicht löschbar Warnung -->
      <div
        v-if="!canDelete"
        class="alert alert-error mb-6"
      >
        <Icon
          icon="mdi:block-helper"
          class="w-5 h-5"
        />
        <div>
          <div class="font-bold">Löschung nicht möglich</div>
          <div class="text-sm">
            Einige Empfänger können aufgrund kritischer Referenzen nicht
            gelöscht werden. Bitte entfernen Sie zuerst die Referenzen oder
            verwenden Sie die Merge-Funktion.
          </div>
        </div>
      </div>

      <!-- Zusammenfassung -->
      <div class="bg-base-200 p-4 rounded-lg mb-4">
        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span>Zu löschende Empfänger:</span>
            <span class="font-bold">{{ selectedCount }}</span>
          </div>
          <div
            v-if="totalReferences > 0"
            class="flex items-center justify-between"
          >
            <span>Betroffene Referenzen:</span>
            <span class="font-bold text-warning">{{ totalReferences }}</span>
          </div>
          <div
            v-if="hasWarnings"
            class="flex items-center justify-between"
          >
            <span>Empfänger mit Warnungen:</span>
            <span class="font-bold text-warning">{{
              recipientsWithWarnings.length
            }}</span>
          </div>
        </div>
      </div>

      <!-- Modal Actions -->
      <div class="modal-action">
        <div class="flex justify-between w-full">
          <div></div>
          <div class="flex space-x-2">
            <button
              class="btn btn-ghost"
              @click="closeModal"
            >
              Abbrechen
            </button>
            <button
              class="btn btn-error"
              :disabled="!canDelete || !isConfirmValid"
              @click="confirmDelete"
            >
              <Icon
                icon="mdi:trash-can"
                class="w-4 h-4 mr-2"
              />
              Endgültig löschen
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
