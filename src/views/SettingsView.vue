<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useSettingsStore } from "@/stores/settingsStore";
import { LogLevel } from "@/utils/logger";
import { debugLog, infoLog, errorLog } from "@/utils/logger";
import {
  DataImportExportService,
  type ExportDataType,
  type ImportMode,
} from "@/services/DataImportExportService";

/**
 * Pfad zur Komponente: src/views/SettingsView.vue
 * Einstellungen der Anwendung.
 */

// State
const activeTab = ref("general");

// SettingsStore
const settingsStore = useSettingsStore();
const logLevel = computed({
  get: () => settingsStore.logLevel,
  set: (value) => (settingsStore.logLevel = value),
});

// Export-Funktionalität
const selectedExportType = ref<ExportDataType>("rules");
const isExporting = ref(false);
const exportSuccess = ref(false);

const availableExportTypes = DataImportExportService.getAvailableDataTypes();

// Import-Funktionalität
const selectedImportFile = ref<File | null>(null);
const showImportModal = ref(false);
const selectedImportMode = ref<ImportMode>("merge");
const isImporting = ref(false);
const importSuccess = ref(false);
const importError = ref<string | null>(null);

// SQLite Export-Funktionalität
const isSqliteExporting = ref(false);
const sqliteExportSuccess = ref(false);
const sqliteExportError = ref<string | null>(null);

// SQLite Import-Funktionalität
const selectedSqliteFile = ref<File | null>(null);
const newTenantName = ref("");
const isSqliteImporting = ref(false);
const sqliteImportSuccess = ref(false);
const sqliteImportError = ref<string | null>(null);

async function handleExport() {
  if (isExporting.value) return;

  try {
    isExporting.value = true;
    debugLog(
      "[settings]",
      `Starte Export für Typ: ${selectedExportType.value}`
    );

    await DataImportExportService.exportDataAsJSON(selectedExportType.value);

    exportSuccess.value = true;
    infoLog(
      "[settings]",
      `Export für ${selectedExportType.value} erfolgreich abgeschlossen`
    );

    setTimeout(() => {
      exportSuccess.value = false;
    }, 5000);
  } catch (error) {
    errorLog(
      "[settings]",
      `Fehler beim Export für ${selectedExportType.value}`,
      error
    );
  } finally {
    isExporting.value = false;
  }
}

// Import-Funktionen
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    selectedImportFile.value = file;
    showImportModal.value = true;
    importError.value = null;
    debugLog("[settings]", `Datei ausgewählt: ${file.name}`);
  }
}

function closeImportModal() {
  showImportModal.value = false;
  selectedImportFile.value = null;
  selectedImportMode.value = "merge";
  importError.value = null;
}

async function handleImport() {
  if (!selectedImportFile.value || isImporting.value) return;

  try {
    isImporting.value = true;
    importError.value = null;

    debugLog(
      "[settings]",
      `Starte Import im ${selectedImportMode.value}-Modus für Datei: ${selectedImportFile.value.name}`
    );

    await DataImportExportService.importDataFromJSON(
      selectedImportFile.value,
      selectedImportMode.value
    );

    importSuccess.value = true;
    showImportModal.value = false;

    infoLog(
      "[settings]",
      `Import erfolgreich abgeschlossen im ${selectedImportMode.value}-Modus`
    );

    setTimeout(() => {
      importSuccess.value = false;
    }, 5000);

    // Dateiauswahl zurücksetzen
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
    selectedImportFile.value = null;
  } catch (error) {
    importError.value =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Import";
    errorLog("[settings]", "Fehler beim Import", error);
  } finally {
    isImporting.value = false;
  }
}

// SQLite Export Handler
async function handleSqliteExport() {
  if (isSqliteExporting.value) return;

  try {
    isSqliteExporting.value = true;
    sqliteExportError.value = null;
    debugLog("[settings]", "Starte SQLite-Datenbank-Export");

    await DataImportExportService.exportTenantDatabase();

    sqliteExportSuccess.value = true;
    infoLog("[settings]", "SQLite-Datenbank-Export erfolgreich abgeschlossen");

    setTimeout(() => {
      sqliteExportSuccess.value = false;
    }, 5000);
  } catch (error) {
    sqliteExportError.value =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Export";
    errorLog("[settings]", "Fehler beim SQLite-Datenbank-Export", error);
  } finally {
    isSqliteExporting.value = false;
  }
}

// SQLite Import Handler
// Hilfsfunktion zum Zurücksetzen des SQLite-Import-Formulars
function resetSqliteImportForm() {
  const fileInput = document.querySelector(
    'input[type="file"][accept=".sqlite,.db"]'
  ) as HTMLInputElement;
  if (fileInput) {
    fileInput.value = "";
  }
  selectedSqliteFile.value = null;
  newTenantName.value = "";
  sqliteImportError.value = null;
}

function handleSqliteFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (file) {
    selectedSqliteFile.value = file;
    sqliteImportError.value = null;
    debugLog("[settings]", `SQLite-Datei ausgewählt: ${file.name}`);
  }
}

async function handleSqliteImport() {
  if (
    !selectedSqliteFile.value ||
    !newTenantName.value.trim() ||
    isSqliteImporting.value
  )
    return;

  try {
    isSqliteImporting.value = true;
    sqliteImportError.value = null;

    debugLog(
      "[settings]",
      `Starte SQLite-Import für neuen Mandanten: ${newTenantName.value}`
    );

    await DataImportExportService.importTenantDatabase(
      selectedSqliteFile.value,
      newTenantName.value.trim()
    );

    sqliteImportSuccess.value = true;
    infoLog(
      "[settings]",
      `SQLite-Import erfolgreich abgeschlossen für Mandant: ${newTenantName.value}`
    );

    // Formular vollständig zurücksetzen
    resetSqliteImportForm();

    setTimeout(() => {
      sqliteImportSuccess.value = false;
    }, 5000);
  } catch (error) {
    sqliteImportError.value =
      error instanceof Error ? error.message : "Unbekannter Fehler beim Import";
    errorLog("[settings]", "Fehler beim SQLite-Import", error);
  } finally {
    isSqliteImporting.value = false;
  }
}

onMounted(() => {
  debugLog("[settings]", "SettingsView geladen");
});
</script>

<template>
  <div class="container mx-auto py-4 sm:py-8 max-w-4xl px-4">
    <h1 class="text-2xl font-bold mb-6">Einstellungen</h1>

    <div class="tabs tabs-boxed mb-6">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'general' }"
        @click="activeTab = 'general'"
      >
        <Icon
          icon="mdi:cog"
          class="mr-2"
        />
        Allgemein
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'import-export' }"
        @click="activeTab = 'import-export'"
      >
        <Icon
          icon="mdi:database-import"
          class="mr-2"
        />
        Daten Import/Export
      </a>
    </div>

    <!-- Allgemeine Einstellungen -->
    <div
      v-if="activeTab === 'general'"
      class="space-y-6"
    >
      <!-- Logger-Einstellungen Card -->
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Logger-Einstellungen</h2>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Log-Level</span>
            </label>
            <select
              v-model="logLevel"
              class="select select-bordered w-full"
            >
              <option :value="LogLevel.DEBUG">Debug (Alles)</option>
              <option :value="LogLevel.INFO">Info (ohne Debug)</option>
              <option :value="LogLevel.WARN">
                Warnung (nur Warnungen und Fehler)
              </option>
              <option :value="LogLevel.ERROR">Fehler (nur Fehler)</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Daten Import/Export -->
    <div
      v-if="activeTab === 'import-export'"
      class="space-y-6"
    >
      <!-- Kombinierte Import/Export Card -->
      <div class="card bg-base-100 shadow-md border border-base-300">
        <div class="card-body">
          <h2 class="card-title">
            <Icon
              icon="mdi:database-import"
              class="mr-2"
            />
            Daten Import & Export
          </h2>
          <p class="text-base-content/70 mb-6">
            Verwalten Sie Ihre Daten durch Import und Export verschiedener
            Formate.
          </p>

          <!-- Stammdaten (JSON) Bereich -->
          <div class="mb-8">
            <h3 class="text-xl font-semibold mb-4">
              <Icon
                icon="mdi:code-json"
                class="mr-2"
              />
              Stammdaten (JSON)
            </h3>
            <p class="text-base-content/70 mb-6">
              Exportieren oder importieren Sie Ihre Stammdaten als JSON-Datei
              für Backup oder Transfer zwischen Mandanten.
            </p>

            <!-- JSON Export -->
            <div class="mb-6">
              <h4 class="text-lg font-medium mb-3">Export</h4>
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">Datentyp auswählen</span>
                </label>
                <select
                  v-model="selectedExportType"
                  class="select select-bordered w-full"
                  :disabled="isExporting"
                  :class="{ 'select-disabled': isExporting }"
                >
                  <option
                    v-for="type in availableExportTypes"
                    :key="type.value"
                    :value="type.value"
                  >
                    {{ type.label }}
                  </option>
                </select>
              </div>

              <button
                class="btn btn-primary"
                @click="handleExport"
                :disabled="isExporting"
              >
                <Icon
                  v-if="!isExporting"
                  icon="mdi:download"
                  class="mr-2"
                />
                <Icon
                  v-else
                  icon="mdi:loading"
                  class="mr-2 animate-spin"
                />
                {{ isExporting ? "Exportiere..." : "JSON exportieren" }}
              </button>

              <div
                v-if="exportSuccess"
                class="alert alert-success alert-soft mt-4"
              >
                <Icon
                  icon="mdi:check-circle"
                  class="text-lg"
                />
                <span
                  >Export erfolgreich! Die Datei wurde heruntergeladen.</span
                >
              </div>
            </div>

            <!-- JSON Import -->
            <div>
              <h4 class="text-lg font-medium mb-3">Import</h4>
              <p class="text-sm text-base-content/60 mb-4">
                Importieren Sie zuvor exportierte JSON-Dateien. Wählen Sie
                zwischen "Zusammenführen" (neue Einträge hinzufügen) oder
                "Ersetzen" (alle bestehenden Daten löschen).
              </p>

              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">JSON-Datei auswählen</span>
                </label>
                <input
                  type="file"
                  accept=".json"
                  class="file-input file-input-bordered w-full"
                  @change="handleFileSelect"
                  :disabled="isImporting"
                />
              </div>

              <div
                v-if="importSuccess"
                class="alert alert-success alert-soft mt-4"
              >
                <Icon
                  icon="mdi:check-circle"
                  class="text-lg"
                />
                <span>Import erfolgreich abgeschlossen!</span>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <!-- Gesamter Mandant (SQLite-Datenbank) Bereich -->
          <div>
            <h3 class="text-xl font-semibold mb-4">
              <Icon
                icon="mdi:database"
                class="mr-2"
              />
              Gesamter Mandant (SQLite-Datenbank)
            </h3>
            <p class="text-base-content/70 mb-6">
              Exportieren Sie Ihre komplette Mandanten-Datenbank als Backup oder
              importieren Sie eine Datenbank als neuen Mandanten.
            </p>

            <!-- SQLite Export -->
            <div class="mb-6">
              <h4 class="text-lg font-medium mb-3">Export</h4>
              <p class="text-sm text-base-content/60 mb-4">
                Erstellt eine vollständige Sicherung Ihrer aktuellen
                Mandanten-Datenbank.
              </p>

              <button
                class="btn btn-primary"
                @click="handleSqliteExport"
                :disabled="isSqliteExporting"
              >
                <Icon
                  v-if="!isSqliteExporting"
                  icon="mdi:download"
                  class="mr-2"
                />
                <Icon
                  v-else
                  icon="mdi:loading"
                  class="mr-2 animate-spin"
                />
                {{
                  isSqliteExporting
                    ? "Exportiere..."
                    : "Mandanten-Datenbank exportieren"
                }}
              </button>

              <div
                v-if="sqliteExportSuccess"
                class="alert alert-success alert-soft mt-4"
              >
                <Icon
                  icon="mdi:check-circle"
                  class="text-lg"
                />
                <span
                  >Datenbank erfolgreich exportiert! Die Datei wurde
                  heruntergeladen.</span
                >
              </div>

              <div
                v-if="sqliteExportError"
                class="alert alert-error alert-soft mt-4"
              >
                <Icon
                  icon="mdi:alert-circle"
                  class="text-lg"
                />
                <span>{{ sqliteExportError }}</span>
              </div>
            </div>

            <!-- SQLite Import -->
            <div>
              <h4 class="text-lg font-medium mb-3">Import</h4>

              <div class="alert alert-warning alert-soft mb-4">
                <Icon
                  icon="mdi:alert"
                  class="text-lg"
                />
                <div>
                  <strong>Wichtiger Hinweis:</strong> Diese Aktion erstellt
                  einen <strong>neuen, separaten Mandanten</strong>. Ihre
                  bestehenden Daten bleiben unverändert. Nach dem Import müssen
                  Sie sich ab- und wieder anmelden oder den Mandanten wechseln,
                  um den neuen Mandanten zu sehen.
                </div>
              </div>

              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">SQLite-Datei auswählen</span>
                </label>
                <input
                  type="file"
                  accept=".sqlite,.db"
                  class="file-input file-input-bordered w-full"
                  @change="handleSqliteFileSelect"
                  :disabled="isSqliteImporting"
                />
              </div>

              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">Neuer Mandantenname</span>
                </label>
                <input
                  type="text"
                  v-model="newTenantName"
                  placeholder="Name für den neuen Mandanten eingeben..."
                  class="input input-bordered w-full"
                  :disabled="isSqliteImporting"
                />
              </div>

              <button
                class="btn btn-primary"
                @click="handleSqliteImport"
                :disabled="
                  !selectedSqliteFile ||
                  !newTenantName.trim() ||
                  isSqliteImporting
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
                class="alert alert-success alert-soft mt-4"
              >
                <Icon
                  icon="mdi:check-circle"
                  class="text-lg"
                />
                <div>
                  <strong>Import erfolgreich!</strong> Der neue Mandant wurde
                  erstellt. Bitte melden Sie sich ab und wieder an oder wechseln
                  Sie den Mandanten, um den neuen Mandanten zu sehen.
                </div>
              </div>

              <div
                v-if="sqliteImportError"
                class="alert alert-error alert-soft mt-4"
              >
                <Icon
                  icon="mdi:alert-circle"
                  class="text-lg"
                />
                <span>{{ sqliteImportError }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div
      v-if="showImportModal"
      class="modal modal-open"
    >
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4">
          <Icon
            icon="mdi:import"
            class="mr-2"
          />
          Import-Modus auswählen
        </h3>

        <p class="text-base-content/70 mb-6">
          Datei: <strong>{{ selectedImportFile?.name }}</strong>
        </p>

        <div class="flex flex-col w-[95%] mx-auto space-y-4 mb-6">
          <!-- <div class="form-control w-full"> -->
          <label
            class="label cursor-pointer p-4 border border-base-300 rounded-lg hover:bg-base-200 transition-colors w-full flex"
          >
            <div class="flex-1 w-45">
              <div class="flex items-center mb-2">
                <Icon
                  icon="mdi:merge"
                  class="mr-2 text-primary"
                />
                <strong class="text-base">Zusammenführen</strong>
              </div>
              <p class="text-sm text-base-content/70">
                Neue Einträge hinzufügen, bestehende beibehalten
              </p>
            </div>
            <input
              type="radio"
              name="importMode"
              value="merge"
              v-model="selectedImportMode"
              class="radio radio-primary"
            />
          </label>
          <!-- </div> -->

          <!-- <div class="form-control w-full"> -->
          <label
            class="label cursor-pointer p-4 border border-base-300 rounded-lg hover:bg-base-200 transition-colors w-full"
          >
            <div class="flex-1 w-45">
              <div class="flex items-center mb-2">
                <Icon
                  icon="mdi:database-refresh"
                  class="mr-2 text-warning"
                />
                <strong class="text-base">Ersetzen</strong>
              </div>
              <p class="text-sm text-base-content/70">
                Alle bestehenden Daten löschen und durch<br />importierte
                ersetzen
              </p>
            </div>
            <input
              type="radio"
              name="importMode"
              value="replace"
              v-model="selectedImportMode"
              class="radio radio-primary"
            />
          </label>
          <!-- </div> -->
        </div>

        <div
          v-if="importError"
          class="alert alert-error alert-soft mb-4"
        >
          <Icon
            icon="mdi:alert-circle"
            class="text-lg"
          />
          <span>{{ importError }}</span>
        </div>

        <div class="modal-action">
          <button
            class="btn btn-ghost"
            @click="closeImportModal"
            :disabled="isImporting"
          >
            Abbrechen
          </button>
          <button
            class="btn btn-primary"
            @click="handleImport"
            :disabled="isImporting"
          >
            <Icon
              v-if="!isImporting"
              icon="mdi:import"
              class="mr-2"
            />
            <Icon
              v-else
              icon="mdi:loading"
              class="mr-2 animate-spin"
            />
            {{ isImporting ? "Importiere..." : "Importieren" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
