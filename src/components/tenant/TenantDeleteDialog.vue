<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
      <div class="flex items-center mb-4">
        <div class="flex-shrink-0">
          <svg
            class="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">
            Mandant löschen
          </h3>
        </div>
      </div>

      <div class="mb-4">
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sind Sie sicher, dass Sie den Mandanten
          <strong>"{{ tenantName }}"</strong> vollständig löschen möchten?
        </p>

        <div
          class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4"
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                class="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
                Warnung: Diese Aktion kann nicht rückgängig gemacht werden!
              </h3>
              <div class="mt-2 text-sm text-red-700 dark:text-red-300">
                <ul class="list-disc pl-5 space-y-1">
                  <li>Alle Daten des Mandanten werden permanent gelöscht</li>
                  <li>Die Mandanten-Datenbank wird vollständig entfernt</li>
                  <li>Alle Verbindungen zum Mandanten werden getrennt</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <label
            for="confirmationText"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Geben Sie zur Bestätigung den Namen des Mandanten ein:
          </label>
          <input
            id="confirmationText"
            v-model="confirmationText"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            :placeholder="tenantName"
          />
        </div>
      </div>

      <div class="flex justify-end space-x-3">
        <button
          @click="cancel"
          :disabled="isDeleting"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          @click="confirmDelete"
          :disabled="!canDelete || isDeleting"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span
            v-if="isDeleting"
            class="flex items-center"
          >
            <svg
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Lösche...
          </span>
          <span v-else>Mandant löschen</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useTenantStore } from "@/stores/tenantStore";
import { useSessionStore } from "@/stores/sessionStore";
import { errorLog, infoLog } from "@/utils/logger";

interface Props {
  isOpen: boolean;
  tenantId: string;
  tenantName: string;
}

interface Emits {
  (e: "close"): void;
  (e: "deleted"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const tenantStore = useTenantStore();
const sessionStore = useSessionStore();

const confirmationText = ref("");
const isDeleting = ref(false);

const canDelete = computed(() => {
  return confirmationText.value.trim() === props.tenantName.trim();
});

async function confirmDelete() {
  if (!canDelete.value || isDeleting.value) {
    return;
  }

  isDeleting.value = true;

  try {
    const userId = sessionStore.currentUserId;
    if (!userId) {
      throw new Error("Benutzer-ID nicht gefunden");
    }

    infoLog(
      "TenantDeleteDialog",
      `Lösche Mandant ${props.tenantId} (${props.tenantName})`
    );

    const success = await tenantStore.deleteTenantCompletely(
      props.tenantId,
      userId
    );

    if (success) {
      infoLog(
        "TenantDeleteDialog",
        `Mandant ${props.tenantId} erfolgreich gelöscht`
      );
      emit("deleted");
      cancel();
    } else {
      throw new Error("Löschung fehlgeschlagen");
    }
  } catch (error) {
    errorLog(
      "TenantDeleteDialog",
      `Fehler beim Löschen des Mandanten ${props.tenantId}`,
      error
    );
    // Hier könnte eine Toast-Benachrichtigung oder ein anderes Feedback angezeigt werden
    alert(
      `Fehler beim Löschen des Mandanten: ${
        error instanceof Error ? error.message : "Unbekannter Fehler"
      }`
    );
  } finally {
    isDeleting.value = false;
  }
}

function cancel() {
  if (isDeleting.value) {
    return;
  }

  confirmationText.value = "";
  emit("close");
}
</script>
