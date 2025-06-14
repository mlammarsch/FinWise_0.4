<!-- src/views/auth/TenantSelectView.vue -->
<script setup lang="ts">
/**
 * Pfad: src/views/auth/TenantSelectView.vue
 * Listet alle Tenants des eingeloggten Users,
 * erlaubt Auswahl oder Neuanlage.
 */

import { ref, computed, nextTick, onMounted } from "vue";
import { useRouter } from "vue-router";
import { TenantService } from "@/services/TenantService";
import { useSessionStore } from "@/stores/sessionStore";
import { useWebSocketStore } from "@/stores/webSocketStore";
import { BackendAvailabilityService } from "@/services/BackendAvailabilityService";
import { debugLog, infoLog, errorLog } from "@/utils/logger";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";

const router = useRouter();
const session = useSessionStore();
const webSocketStore = useWebSocketStore();

const newTenantName = ref("");
const showCreate = ref(false);

// Neue State-Variablen für Lösch-Funktionalität
const showDeleteModal = ref(false);
const deleteTargetId = ref<string | null>(null);

const tenants = computed(() => TenantService.getOwnTenants());

// Backend-Verfügbarkeit über zentralen Service
const isButtonEnabled = BackendAvailabilityService.isButtonEnabled;

// Backend-Status beim Mount prüfen
onMounted(() => {
  BackendAvailabilityService.startPeriodicChecks();
});

function selectTenant(id: string) {
  debugLog("[TenantSelectView] selectTenant", JSON.stringify({ tenantId: id }));
  TenantService.switchTenant(id);
  router.push("/");
}

async function createTenant() {
  if (!newTenantName.value.trim()) return;
  const tenant = TenantService.createTenant(newTenantName.value);
  debugLog("[TenantSelectView] tenant created", { id: tenant.id });
  newTenantName.value = "";
  showCreate.value = false;
  // Auswahl wurde schon im Service gesetzt
  router.push("/");
}

// Neue Funktionen für Lösch-Funktionalität
function confirmDeleteTenant(tenantId: string) {
  deleteTargetId.value = tenantId;
  showDeleteModal.value = true;
}

async function deleteTenant() {
  if (deleteTargetId.value) {
    try {
      await TenantService.deleteTenantCompletely(deleteTargetId.value);
      debugLog("[TenantSelectView] deleteTenantCompletely", {
        id: deleteTargetId.value,
      });
    } catch (error) {
      debugLog("[TenantSelectView] deleteTenantCompletely error", error);
    }
  }
  showDeleteModal.value = false;
  deleteTargetId.value = null;
}

nextTick(() => {
  // Falls bereits ein Tenant aktiv ist → sofort weiter
  if (session.currentTenantId) router.push("/");
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Mandant wählen</h2>

        <template v-if="tenants.length">
          <div class="space-y-2">
            <div
              v-for="t in tenants"
              :key="t.uuid"
              class="flex items-center justify-between p-3 rounded-box hover:bg-base-200 border border-base-300"
            >
              <span
                @click="selectTenant(t.uuid)"
                class="flex-1 cursor-pointer text-left"
              >
                {{ t.tenantName }}
              </span>
              <!-- Trashcan-Button (immer sichtbar aber disabled wenn offline) -->
              <button
                class="btn btn-ghost btn-sm"
                :class="
                  isButtonEnabled ? 'text-error' : 'text-error opacity-50'
                "
                :disabled="!isButtonEnabled"
                @click="
                  if (isButtonEnabled) {
                    confirmDeleteTenant(t.uuid);
                  } else {
                    debugLog(
                      '[TenantSelectView] Trash-Button disabled - Backend offline',
                      {
                        tenantId: t.uuid,
                        isBackendOnline:
                          BackendAvailabilityService.isOnline.value,
                        isCheckingBackend:
                          BackendAvailabilityService.isChecking.value,
                      }
                    );
                  }
                "
                :title="
                  BackendAvailabilityService.getTooltipText('Mandant löschen')
                "
              >
                <Icon
                  :icon="
                    isButtonEnabled ? 'mdi:trash-can' : 'mdi:trash-can-outline'
                  "
                  class="text-base"
                />
              </button>
            </div>
          </div>
        </template>

        <p
          v-else
          class="text-center opacity-70"
        >
          Noch kein Mandant vorhanden.
        </p>

        <button
          class="btn btn-primary w-full"
          @click="showCreate = !showCreate"
        >
          {{ showCreate ? "Abbrechen" : "Neuen Mandanten anlegen" }}
        </button>

        <div
          v-if="showCreate"
          class="space-y-3"
        >
          <input
            v-model.trim="newTenantName"
            type="text"
            placeholder="Name des Mandanten"
            class="input input-bordered w-full"
            autocomplete="off"
          />
          <button
            class="btn btn-secondary w-full"
            @click="createTenant"
          >
            Anlegen & wechseln
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <ConfirmationModal
      v-if="showDeleteModal"
      title="Mandant löschen"
      message="Möchtest Du diesen Mandanten wirklich vollständig löschen? Alle Daten gehen verloren!"
      confirmText="Löschen"
      cancelText="Abbrechen"
      @confirm="deleteTenant"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
