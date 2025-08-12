<!-- src/views/auth/TenantSelectView.vue -->
<script setup lang="ts">
/**
 * Pfad: src/views/auth/TenantSelectView.vue
 * Listet alle Tenants des eingeloggten Users,
 * erlaubt Auswahl oder Neuanlage.
 */

import { ref, computed, nextTick, onMounted, watch, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { TenantService } from "../../services/TenantService";
import { useSessionStore } from "../../stores/sessionStore";
import { useWebSocketStore } from "../../stores/webSocketStore";
import { useTenantStore } from "../../stores/tenantStore";
import { BackendAvailabilityService } from "../../services/BackendAvailabilityService";
import { DataImportExportService } from "../../services/DataImportExportService";
import { debugLog, infoLog, errorLog, warnLog } from "../../utils/logger";
import ConfirmationModal from "../../components/ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";
// import type { Tenant } from "../../types"; // Temporär auskommentiert, da Typ nicht gefunden wird
type Tenant = any; // Temporärer Workaround für den Typ

const router = useRouter();
const session = useSessionStore();
const webSocketStore = useWebSocketStore();
const tenantStore = useTenantStore();

const newTenantName = ref("");
const showCreate = ref(false);
const newTenantNameInput = ref<HTMLInputElement | null>(null);
const tenantListItems = ref<Array<HTMLElement | null>>([]);
const focusedTenantIndex = ref(-1);

const showDeleteModal = ref(false);
const deleteTargetId = ref<string | null>(null);

// SQLite Import-Funktionalität
const selectedSqliteFile = ref<File | null>(null);
const sqliteImportTenantName = ref("");
const showSqliteImport = ref(false);
const isSqliteImporting = ref(false);
const sqliteImportSuccess = ref(false);
const sqliteImportError = ref<string | null>(null);

const tenants = computed<Tenant[]>(() => TenantService.getOwnTenants()); // Expliziter Typ für computed
const isButtonEnabled = computed(
  () => BackendAvailabilityService.isButtonEnabled.value
);

const globalKeyDownHandler = (event: KeyboardEvent) => {
  if (
    event.key === "Enter" &&
    tenants.value.length === 0 &&
    !showCreate.value
  ) {
    event.preventDefault();
    showCreate.value = true;
  }
};

onMounted(() => {
  if (typeof BackendAvailabilityService.startPeriodicChecks === "function") {
    BackendAvailabilityService.startPeriodicChecks();
  } else {
    warnLog(
      "[TenantSelectView]",
      "BackendAvailabilityService.startPeriodicChecks is not a function."
    );
  }
  window.addEventListener("keydown", handleTenantListKeyDown);
  if (tenants.value.length > 0) {
    focusedTenantIndex.value = 0;
    focusTenantItem(0);
  } else {
    window.addEventListener("keydown", globalKeyDownHandler);
  }
});

watch(showCreate, (newValue) => {
  if (newValue) {
    nextTick(() => {
      newTenantNameInput.value?.focus();
    });
  }
});

watch(
  tenants,
  (newTenants) => {
    tenantListItems.value = [];
    if (
      newTenants.length > 0 &&
      (focusedTenantIndex.value === -1 || !newTenants[focusedTenantIndex.value])
    ) {
      focusedTenantIndex.value = 0;
      nextTick(() => focusTenantItem(0));
    } else if (newTenants.length === 0) {
      focusedTenantIndex.value = -1;
    }

    if (newTenants.length === 0) {
      window.removeEventListener("keydown", globalKeyDownHandler);
      window.addEventListener("keydown", globalKeyDownHandler);
    } else {
      window.removeEventListener("keydown", globalKeyDownHandler);
    }
  },
  { deep: true }
);

function focusTenantItem(index: number) {
  nextTick(() => {
    if (tenantListItems.value && tenantListItems.value[index]) {
      tenantListItems.value[index]?.focus();
    }
  });
}

function handleTenantListKeyDown(event: KeyboardEvent) {
  if (showCreate.value || tenants.value.length === 0) return;

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (focusedTenantIndex.value < tenants.value.length - 1) {
        focusedTenantIndex.value++;
      } else {
        focusedTenantIndex.value = 0;
      }
      focusTenantItem(focusedTenantIndex.value);
      break;
    case "ArrowUp":
      event.preventDefault();
      if (focusedTenantIndex.value > 0) {
        focusedTenantIndex.value--;
      } else {
        focusedTenantIndex.value = tenants.value.length - 1;
      }
      focusTenantItem(focusedTenantIndex.value);
      break;
    case "Enter":
      event.preventDefault();
      if (
        focusedTenantIndex.value !== -1 &&
        tenants.value[focusedTenantIndex.value]
      ) {
        selectTenant(tenants.value[focusedTenantIndex.value].uuid);
      }
      break;
  }
}

async function selectTenant(id: string) {
  debugLog("[TenantSelectView] selectTenant", `Tenant ID: ${id}`);
  const success = await TenantService.switchTenant(id);
  if (success) {
    router.push("/");
  } else {
    errorLog("[TenantSelectView]", `Fehler beim Mandantenwechsel zu ${id}`);
  }
}

async function createTenant() {
  if (!newTenantName.value.trim()) return;
  try {
    const newTenant = (await TenantService.createTenant(
      newTenantName.value
    )) as Tenant;
    debugLog(
      "[TenantSelectView] tenant created",
      `New Tenant ID: ${newTenant.uuid}`
    );

    newTenantName.value = ""; // Reset name after getting its value
    showCreate.value = false;

    await nextTick();

    if (
      tenants.value.length === 1 &&
      tenants.value[0].uuid === newTenant.uuid
    ) {
      selectTenant(newTenant.uuid);
    } else {
      const newTenantInList = tenants.value.find(
        (t) => t.uuid === newTenant.uuid
      );
      if (newTenantInList) {
        const index = tenants.value.indexOf(newTenantInList);
        if (index !== -1) {
          focusedTenantIndex.value = index;
          focusTenantItem(index);
        }
      }
    }
  } catch (err) {
    errorLog("[TenantSelectView] createTenant error", String(err));
  }
}

function confirmDeleteTenant(tenantId: string) {
  deleteTargetId.value = tenantId;
  showDeleteModal.value = true;
}

async function deleteTenant() {
  if (deleteTargetId.value) {
    try {
      await TenantService.deleteTenantCompletely(deleteTargetId.value);
      debugLog(
        "[TenantSelectView] deleteTenantCompletely",
        `Deleted Tenant ID: ${deleteTargetId.value}`
      );

      if (tenants.value.length > 0) {
        focusedTenantIndex.value = Math.max(0, focusedTenantIndex.value - 1);
        focusTenantItem(focusedTenantIndex.value);
      } else {
        focusedTenantIndex.value = -1;
        window.addEventListener("keydown", globalKeyDownHandler);
      }
    } catch (err) {
      errorLog("[TenantSelectView] deleteTenantCompletely error", String(err));
    }
  }
  showDeleteModal.value = false;
  deleteTargetId.value = null;
}

// SQLite Import Handler
function handleSqliteFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    selectedSqliteFile.value = file;
    sqliteImportError.value = null;
    debugLog("[TenantSelectView]", `SQLite-Datei ausgewählt: ${file.name}`);
  }
}

function resetSqliteImportForm() {
  const fileInput = document.querySelector(
    'input[type="file"][accept=".sqlite,.db"]'
  ) as HTMLInputElement;
  if (fileInput) {
    fileInput.value = "";
  }
  selectedSqliteFile.value = null;
  sqliteImportTenantName.value = "";
  sqliteImportError.value = null;
  showSqliteImport.value = false;
}

async function handleSqliteImport() {
  if (
    !selectedSqliteFile.value ||
    !sqliteImportTenantName.value.trim() ||
    isSqliteImporting.value
  )
    return;

  try {
    isSqliteImporting.value = true;
    sqliteImportError.value = null;

    debugLog(
      "[TenantSelectView]",
      `Starte SQLite-Import für neuen Mandanten: ${sqliteImportTenantName.value}`
    );

    await DataImportExportService.importTenantDatabase(
      selectedSqliteFile.value,
      sqliteImportTenantName.value.trim()
    );

    sqliteImportSuccess.value = true;
    infoLog(
      "[TenantSelectView]",
      `SQLite-Import erfolgreich abgeschlossen für Mandant: ${sqliteImportTenantName.value}. User wird automatisch abgemeldet.`
    );

    // Formular vollständig zurücksetzen
    resetSqliteImportForm();

    // Nach erfolgreichem Import automatisch abmelden
    setTimeout(async () => {
      await logoutAndRedirect();
    }, 2000); // 2 Sekunden warten, damit der User die Erfolgsmeldung sehen kann
  } catch (error) {
    sqliteImportError.value =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Import";
    errorLog("[TenantSelectView]", "Fehler beim SQLite-Import", error);
  } finally {
    isSqliteImporting.value = false;
  }
}

async function logoutAndRedirect() {
  // als async markieren wegen await session.logout()
  infoLog("[TenantSelectView]", "logoutAndRedirect called");
  try {
    // 1. WebSocket-Store zurücksetzen (setzt connectionStatus auf DISCONNECTED)
    infoLog("[TenantSelectView]", "Resetting WebSocket store during logout.");
    webSocketStore.reset(); // Korrekte Methode zum Zurücksetzen des WebSocket-Stores

    // 2. User-Session im Store löschen
    infoLog(
      "[TenantSelectView]",
      "Calling session.logout() to clear session data."
    );
    await session.logout(); // Korrekte Logout-Funktion aus sessionStore verwenden
    infoLog("[TenantSelectView]", "session.logout() completed.");
  } catch (e) {
    errorLog("[TenantSelectView]", "Error during logout process", String(e));
    // Auch bei Fehlern versuchen, die Session manuell zu bereinigen
    session.currentTenantId = null;
    session.currentUserId = null;
    localStorage.removeItem("finwise_session"); // Ggf. anpassen, falls der Key anders ist
    localStorage.removeItem("finwise_activeTenantId");
    warnLog(
      "[TenantSelectView]",
      "Performed manual session cleanup due to error during logout."
    );
  } finally {
    // 3. Sicherstellen, dass alle relevanten Session-Daten im Store genullt sind
    // (session.logout() sollte das bereits erledigt haben, aber zur Sicherheit)
    session.currentTenantId = null;
    session.currentUserId = null;
    // 'isAuthenticated' existiert nicht direkt, wird durch currentUserId bestimmt
    debugLog(
      "[TenantSelectView]",
      "Session state after logout attempt",
      JSON.stringify(session.$state)
    );

    // 4. Zur Login-Seite weiterleiten
    router.push("/login");
    infoLog("[TenantSelectView]", "Redirected to /login");
  }
}

nextTick(() => {
  // Diese Logik scheint eher für den App-Start oder Routen-Guards relevant zu sein.
  // Überprüfung, ob sie hier in TenantSelectView wirklich benötigt wird oder
  // ob sie zu unerwartetem Verhalten führen kann, wenn man von einer anderen Seite
  // hierher navigiert, während ein Tenant aktiv ist.
  // Vorerst belassen, aber mit Vorsicht betrachten.
  if (session.currentTenantId && router.currentRoute.value.path !== "/") {
    if (
      router.currentRoute.value.path !== "/login" &&
      router.currentRoute.value.path !== "/tenant-select"
    ) {
      // router.push("/"); // Temporär auskommentiert, um mögliche Endlosschleifen zu vermeiden, falls die Logik hier unerwünscht ist.
      debugLog(
        "[TenantSelectView] nextTick",
        "Condition for redirect to / met, but redirect is currently disabled for review.",
        {
          currentPath: router.currentRoute.value.path,
          currentTenantId: session.currentTenantId,
        }
      );
    }
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleTenantListKeyDown);
  window.removeEventListener("keydown", globalKeyDownHandler);
  // Da stopPeriodicChecks nicht existiert im BackendAvailabilityService, entfernen wir den Aufruf.
  // Eine korrekte Implementierung von stopPeriodicChecks wäre für die Zukunft sinnvoll.
  debugLog(
    "[TenantSelectView]",
    "onUnmounted: BackendAvailabilityService.stopPeriodicChecks call removed as it does not exist."
  );
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen py-2">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Mandant wählen</h2>

        <template v-if="tenants.length">
          <div class="space-y-2">
            <div
              v-for="(t, index) in tenants"
              :key="t.uuid"
              :ref="el => { if (el) tenantListItems[index] = el as HTMLElement }"
              tabindex="0"
              class="flex items-center justify-between px-3 py-1 rounded-box hover:bg-base-200 border border-base-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100"
              :class="{
                'ring-2 ring-primary ring-offset-2 ring-offset-base-100':
                  index === focusedTenantIndex,
              }"
              @click="selectTenant(t.uuid)"
              @focus="focusedTenantIndex = index"
              @keydown.enter.prevent="selectTenant(t.uuid)"
              @keydown.space.prevent="selectTenant(t.uuid)"
            >
              <span class="flex-1 text-left">
                {{ t.tenantName }}
              </span>
              <button
                class="btn btn-ghost btn-sm"
                :class="
                  isButtonEnabled ? 'text-error' : 'text-error opacity-50'
                "
                :disabled="!isButtonEnabled"
                @click.stop="
                  if (isButtonEnabled) {
                    confirmDeleteTenant(t.uuid);
                  } else {
                    debugLog(
                      '[TenantSelectView] Trash-Button disabled - Backend offline',
                      JSON.stringify({
                        tenantId: t.uuid,
                        isBackendOnline:
                          BackendAvailabilityService.isOnline.value,
                        isCheckingBackend:
                          BackendAvailabilityService.isChecking.value,
                      })
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
          v-else-if="!showCreate"
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
            ref="newTenantNameInput"
            v-model.trim="newTenantName"
            type="text"
            placeholder="Name des Mandanten"
            class="input input-bordered w-full"
            autocomplete="off"
            @keyup.enter="createTenant"
          />
          <button
            class="btn btn-secondary w-full"
            @click="createTenant"
          >
            Anlegen & wechseln
          </button>
        </div>

        <div class="divider">oder</div>

        <!-- SQLite Import Bereich -->
        <div class="space-y-3">
          <button
            class="btn btn-outline w-full"
            @click="showSqliteImport = !showSqliteImport"
          >
            <Icon
              icon="mdi:database-import"
              class="mr-2"
            />
            {{
              showSqliteImport
                ? "Import abbrechen"
                : "SQLite-Datenbank importieren"
            }}
          </button>

          <div
            v-if="showSqliteImport"
            class="space-y-3 p-4 border border-base-300 rounded-lg bg-base-50"
          >
            <div class="alert alert-info alert-soft">
              <Icon
                icon="mdi:information"
                class="text-lg"
              />
              <div class="text-sm">
                <strong>Hinweis:</strong> Diese Aktion erstellt einen neuen
                Mandanten aus einer SQLite-Datenbank-Datei. Nach dem Import
                werden Sie automatisch abgemeldet.
              </div>
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">SQLite-Datei auswählen</span>
              </label>
              <input
                type="file"
                accept=".sqlite,.db"
                class="file-input file-input-bordered file-input-sm w-full"
                @change="handleSqliteFileSelect"
                :disabled="isSqliteImporting"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Mandantenname</span>
              </label>
              <input
                type="text"
                v-model="sqliteImportTenantName"
                placeholder="Name für den neuen Mandanten..."
                class="input input-bordered input-sm w-full"
                :disabled="isSqliteImporting"
                autocomplete="off"
              />
            </div>

            <button
              class="btn btn-primary btn-sm w-full"
              @click="handleSqliteImport"
              :disabled="
                !selectedSqliteFile ||
                !sqliteImportTenantName.trim() ||
                isSqliteImporting ||
                !isButtonEnabled
              "
              :title="
                !isButtonEnabled
                  ? BackendAvailabilityService.getTooltipText('SQLite-Import')
                  : ''
              "
            >
              <Icon
                v-if="!isSqliteImporting"
                icon="mdi:database-import"
                class="mr-2"
              />
              <Icon
                v-else
                icon="mdi:loading"
                class="mr-2 animate-spin"
              />
              {{
                isSqliteImporting ? "Importiere..." : "Mandanten importieren"
              }}
            </button>

            <div
              v-if="sqliteImportSuccess"
              class="alert alert-success alert-soft"
            >
              <Icon
                icon="mdi:check-circle"
                class="text-lg"
              />
              <div class="text-sm">
                <strong>Import erfolgreich!</strong> Der neue Mandant wurde
                erstellt. Sie werden automatisch abgemeldet...
              </div>
            </div>

            <div
              v-if="sqliteImportError"
              class="alert alert-error alert-soft"
            >
              <Icon
                icon="mdi:alert-circle"
                class="text-lg"
              />
              <span class="text-sm">{{ sqliteImportError }}</span>
            </div>
          </div>
        </div>

        <div class="text-center text-sm opacity-70 mt-4">
          <a
            href="#"
            class="link link-primary"
            @click.prevent="logoutAndRedirect"
          >
            Zum Login
          </a>
        </div>
      </div>
    </div>

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
