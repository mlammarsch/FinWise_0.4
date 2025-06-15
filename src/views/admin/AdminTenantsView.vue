<!-- src/views/admin/AdminTenantsView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/admin/AdminTenantsView.vue
 * Verwaltung der Mandanten (Tenants) des aktuell angemeldeten Users.
 *
 * Komponenten-Props: –
 * Emits:            –
 */

import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { TenantService } from "@/services/TenantService";
import { useTenantStore } from "@/stores/tenantStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useWebSocketStore } from "@/stores/webSocketStore";
import { BackendAvailabilityService } from "@/services/BackendAvailabilityService";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";
import { debugLog, infoLog, errorLog } from "@/utils/logger";

const router = useRouter();
const session = useSessionStore();
const tenantStore = useTenantStore();
const webSocketStore = useWebSocketStore();

const showModal = ref(false);
const isEditMode = ref(false);
const selectedTenant = ref<{ uuid: string; tenantName: string } | null>(null);
const nameInput = ref("");
const searchQuery = ref("");
const showDeleteModal = ref(false);
const deleteTargetId = ref<string | null>(null);

// Neue State-Variablen für erweiterte Funktionen
const showResetDbModal = ref(false);
const showClearQueueModal = ref(false);
const resetDbTargetId = ref<string | null>(null);
const clearQueueTargetId = ref<string | null>(null);

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

// Backend-Status beim Mount prüfen
onMounted(() => {
  BackendAvailabilityService.startPeriodicChecks();
});

/* --------------------------------------------- Helper & Computed */
const ownTenants = computed(() => TenantService.getOwnTenants());

const filteredTenants = computed(() => {
  if (!searchQuery.value.trim()) return ownTenants.value;
  const q = searchQuery.value.toLowerCase();
  return ownTenants.value.filter((t) => t.tenantName.toLowerCase().includes(q));
});

const totalPages = computed(() =>
  itemsPerPage.value === "all"
    ? 1
    : Math.ceil(filteredTenants.value.length / Number(itemsPerPage.value))
);

const paginated = computed(() => {
  if (itemsPerPage.value === "all") return filteredTenants.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  const end = start + Number(itemsPerPage.value);
  return filteredTenants.value.slice(start, end);
});

// Für UI-Stabilität: Buttons immer anzeigen, aber Status prüfen
const showButtons = computed(() => true); // Buttons immer anzeigen
const isButtonEnabled = BackendAvailabilityService.isButtonEnabled; // Aber nur enabled wenn Backend verfügbar

// Legacy-Computed für Template-Kompatibilität
const isBackendAvailable = BackendAvailabilityService.isOnline;

/* --------------------------------------------- Actions */
function openCreate() {
  selectedTenant.value = null;
  nameInput.value = "";
  isEditMode.value = false;
  showModal.value = true;
}

function openEdit(t: { uuid: string; tenantName: string }) {
  selectedTenant.value = t;
  nameInput.value = t.tenantName;
  isEditMode.value = true;
  showModal.value = true;
}

async function saveTenant() {
  if (!nameInput.value.trim()) return;

  try {
    if (isEditMode.value && selectedTenant.value) {
      const success = await TenantService.renameTenant(
        selectedTenant.value.uuid,
        nameInput.value.trim()
      );
      debugLog("[AdminTenantsView] renameTenant", {
        id: selectedTenant.value.uuid,
        name: nameInput.value.trim(),
        success,
      });
      if (!success) {
        errorLog("[AdminTenantsView]", "Fehler beim Umbenennen des Mandanten");
        return;
      }
    } else {
      const t = await TenantService.createTenant(nameInput.value.trim());
      debugLog("[AdminTenantsView] createTenant", { id: t.uuid });
    }

    showModal.value = false;
    selectedTenant.value = null;
    nameInput.value = "";
  } catch (error) {
    errorLog(
      "[AdminTenantsView]",
      "Fehler beim Speichern des Mandanten",
      error
    );
  }
}

function confirmDelete(id: string) {
  deleteTargetId.value = id;
  showDeleteModal.value = true;
}

async function deleteTenant() {
  if (deleteTargetId.value) {
    try {
      const isActiveTenant = session.currentTenantId === deleteTargetId.value;

      await TenantService.deleteTenantCompletely(deleteTargetId.value);
      debugLog("[AdminTenantsView] deleteTenantCompletely", {
        id: deleteTargetId.value,
        isActiveTenant,
      });

      // Bei aktivem Mandanten: Nur Mandant abmelden, zur TenantSelectView weiterleiten
      if (isActiveTenant) {
        debugLog(
          "[AdminTenantsView] Aktiver Mandant gelöscht, navigiere zu TenantSelectView"
        );
        // Mandant aus Session entfernen (ohne User-Logout)
        session.currentTenantId = null;
        router.push("/tenant-select");
      }
    } catch (error) {
      debugLog("[AdminTenantsView] deleteTenantCompletely error", error);
    }
  }
  showDeleteModal.value = false;
  deleteTargetId.value = null;
}

// Neue Funktionen für erweiterte Mandanten-Verwaltung
function confirmResetDatabase(tenantId: string) {
  debugLog("[AdminTenantsView] confirmResetDatabase aufgerufen", {
    tenantId,
    currentTenantId: session.currentTenantId,
  });
  resetDbTargetId.value = tenantId;
  showResetDbModal.value = true;
}

async function resetDatabase() {
  if (resetDbTargetId.value) {
    debugLog("[AdminTenantsView] resetDatabase aufgerufen", {
      targetId: resetDbTargetId.value,
    });

    try {
      const isActiveTenant = session.currentTenantId === resetDbTargetId.value;

      // Mandanten-Name für Neuanlage merken
      const tenant = TenantService.getOwnTenants().find(
        (t) => t.uuid === resetDbTargetId.value
      );
      const tenantName = tenant?.tenantName || "Unbekannt";

      debugLog(
        "[AdminTenantsView] Lösche Mandant und lege neuen mit gleichem Namen an",
        {
          tenantId: resetDbTargetId.value,
          tenantName,
          isActiveTenant,
        }
      );

      // Schritt 1: Mandanten komplett löschen
      await TenantService.deleteTenantCompletely(resetDbTargetId.value);

      // Schritt 2: Neuen Mandanten mit gleichem Namen anlegen
      const newTenant = await TenantService.createTenant(tenantName);

      debugLog("[AdminTenantsView] Mandant erfolgreich zurückgesetzt", {
        oldId: resetDbTargetId.value,
        newId: newTenant.uuid,
        tenantName,
      });

      // Schritt 3: Direkt zur Hauptseite weiterleiten (Mandant ist bereits aktiv)
      router.push("/");
    } catch (error) {
      debugLog("[AdminTenantsView] resetDatabase error", error);
    }
  } else {
    debugLog("[AdminTenantsView] resetDatabase: Keine resetDbTargetId gesetzt");
  }
  showResetDbModal.value = false;
  resetDbTargetId.value = null;
}

function confirmClearSyncQueue(tenantId: string) {
  clearQueueTargetId.value = tenantId;
  showClearQueueModal.value = true;
}

async function clearSyncQueue() {
  if (clearQueueTargetId.value) {
    try {
      await TenantService.clearSyncQueue(clearQueueTargetId.value);
      debugLog("[AdminTenantsView] clearSyncQueue", {
        id: clearQueueTargetId.value,
      });
    } catch (error) {
      debugLog("[AdminTenantsView] clearSyncQueue error", error);
    }
  }
  showClearQueueModal.value = false;
  clearQueueTargetId.value = null;
}

function lokalDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE");
}
</script>

<template>
  <div class="max-w-5xl mx-auto flex flex-col min-h-screen py-8">
    <!-- Header -->
    <div
      class="flex flex-wrap md:flex-nowrap justify-between items-center mb-6"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Mandanten verwalten</h2>

      <SearchGroup
        btnRight="Neu"
        btnRightIcon="mdi:plus"
        @search="(q) => (searchQuery = q)"
        @btn-right-click="openCreate"
      />
    </div>

    <!-- Card -->
    <div class="card w-full bg-base-100 border border-base-300 shadow-md">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th class="hidden sm:table-cell">Erstellt</th>
                <th class="hidden sm:table-cell">Geändert</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in paginated"
                :key="t.uuid"
              >
                <td>{{ t.tenantName }}</td>
                <td class="hidden sm:table-cell">
                  {{ lokalDate(t.createdAt) }}
                </td>
                <td class="hidden sm:table-cell">
                  {{ lokalDate(t.updatedAt) }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <!-- Bearbeiten-Button (bestehend) -->
                    <button
                      class="btn btn-ghost btn-sm text-secondary"
                      @click="openEdit(t)"
                      title="Mandant bearbeiten"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>

                    <!-- DB-Reset-Button (NEU - nur für aktiven Mandanten, immer sichtbar aber disabled wenn offline) -->
                    <button
                      v-if="t.uuid === session.currentTenantId"
                      class="btn btn-ghost btn-sm"
                      :class="
                        isButtonEnabled
                          ? 'text-warning'
                          : 'text-warning opacity-50'
                      "
                      :disabled="!isButtonEnabled"
                      @click="
                        isButtonEnabled
                          ? confirmResetDatabase(t.uuid)
                          : debugLog(
                              '[AdminTenantsView] DB-Reset disabled - Backend offline',
                              {
                                tenantId: t.id,
                                isBackendAvailable: isBackendAvailable,
                              }
                            )
                      "
                      :title="
                        isButtonEnabled
                          ? 'Datenbank zurücksetzen'
                          : 'Backend offline - Datenbank-Reset nicht verfügbar'
                      "
                    >
                      <Icon
                        icon="mdi:database-refresh"
                        class="text-base"
                      />
                    </button>

                    <!-- SyncQueue-Clear-Button (NEU - immer sichtbar aber disabled wenn offline) -->
                    <button
                      class="btn btn-ghost btn-sm"
                      :class="
                        isButtonEnabled ? 'text-info' : 'text-info opacity-50'
                      "
                      :disabled="!isButtonEnabled"
                      @click="
                        isButtonEnabled
                          ? confirmClearSyncQueue(t.uuid)
                          : debugLog(
                              '[AdminTenantsView] SyncQueue-Clear disabled - Backend offline',
                              { tenantId: t.uuid }
                            )
                      "
                      :title="
                        isButtonEnabled
                          ? 'SyncQueue löschen'
                          : 'Backend offline - SyncQueue-Clear nicht verfügbar'
                      "
                    >
                      <Icon
                        icon="mdi:delete-sweep"
                        class="text-base"
                      />
                    </button>

                    <!-- Löschen-Button (immer sichtbar aber disabled wenn offline) -->
                    <button
                      class="btn btn-ghost btn-sm"
                      :class="
                        isButtonEnabled ? 'text-error' : 'text-error opacity-50'
                      "
                      :disabled="!isButtonEnabled"
                      @click="
                        if (isButtonEnabled) {
                          debugLog('[AdminTenantsView] Trash-Button geklickt', {
                            tenantId: t.uuid,
                            isBackendAvailable: isBackendAvailable,
                          });
                          confirmDelete(t.uuid);
                        } else {
                          debugLog(
                            '[AdminTenantsView] Trash-Button disabled - Backend offline',
                            {
                              tenantId: t.id,
                              isBackendAvailable: isBackendAvailable,
                              connectionStatus: webSocketStore.connectionStatus,
                              backendStatus: webSocketStore.backendStatus,
                            }
                          );
                        }
                      "
                      :title="
                        isButtonEnabled
                          ? 'Mandant vollständig löschen'
                          : 'Backend offline - Löschen nicht verfügbar'
                      "
                    >
                      <Icon
                        :icon="
                          isButtonEnabled
                            ? 'mdi:trash-can'
                            : 'mdi:trash-can-outline'
                        "
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <PagingComponent
          :currentPage="currentPage"
          :totalPages="totalPages"
          :itemsPerPage="itemsPerPage"
          @update:currentPage="(val) => (currentPage = val)"
          @update:itemsPerPage="(val) => (itemsPerPage = val)"
        />
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <dialog
      v-if="showModal"
      class="modal modal-open"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          {{ isEditMode ? "Mandant bearbeiten" : "Neuer Mandant" }}
        </h3>

        <input
          v-model.trim="nameInput"
          type="text"
          placeholder="Name des Mandanten"
          class="input input-bordered w-full mb-4"
        />

        <div class="modal-action">
          <button
            class="btn"
            @click="showModal = false"
          >
            Abbrechen
          </button>
          <button
            class="btn btn-primary"
            @click="saveTenant"
          >
            Speichern
          </button>
        </div>
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showModal = false"
      ></div>
    </dialog>

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

    <!-- DB Reset Confirmation -->
    <ConfirmationModal
      v-if="showResetDbModal"
      title="Datenbank zurücksetzen"
      message="Möchtest Du die Datenbank dieses Mandanten wirklich zurücksetzen? Alle lokalen Daten werden gelöscht!"
      confirmText="Zurücksetzen"
      cancelText="Abbrechen"
      @confirm="resetDatabase"
      @cancel="showResetDbModal = false"
    />

    <!-- SyncQueue Clear Confirmation -->
    <ConfirmationModal
      v-if="showClearQueueModal"
      title="SyncQueue löschen"
      message="Möchtest Du die SyncQueue dieses Mandanten wirklich löschen? Ausstehende Synchronisationen gehen verloren!"
      confirmText="Löschen"
      cancelText="Abbrechen"
      @confirm="clearSyncQueue"
      @cancel="showClearQueueModal = false"
    />
  </div>
</template>
