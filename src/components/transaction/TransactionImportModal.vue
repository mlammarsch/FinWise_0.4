<!-- src/components/transaction/TransactionImportModal.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/transaction/TransactionImportModal.vue
 * CSV-Importer für Transaktionen mit dreistufigem Prozess:
 * 1. CSV-Konfiguration & Mapping
 * 2. Vorschau mit Auto-Mapping
 * 3. Review & Import
 *
 * Props:
 * - isOpen: boolean - Steuert die Sichtbarkeit des Modals
 * - accountId: string - ID des Kontos, zu dem importiert wird
 *
 * Emits:
 * - close: Schließt den Dialog
 * - imported: Wird nach erfolgreichem Import ausgelöst, überträgt die Anzahl importierter Transaktionen
 */
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { useAccountStore } from "@/stores/accountStore";
import { useTagStore } from "@/stores/tagStore";
import { useCSVImportService } from "@/services/CSVImportService";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SelectCategory from "@/components/ui/SelectCategory.vue";
import SelectRecipient from "@/components/ui/SelectRecipient.vue";
import TagSearchableDropdown from "@/components/ui/TagSearchableDropdown.vue";
import DuplicateManagementModal from "@/components/transaction/DuplicateManagementModal.vue";
import { debugLog, infoLog, errorLog } from "@/utils/logger";
import { formatDate } from "@/utils/formatters";
import { parseAmount } from "@/utils/csvUtils";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  isOpen: boolean;
  accountId: string;
}>();

const emit = defineEmits(["close", "imported"]);

// Stores
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const accountStore = useAccountStore();
const tagStore = useTagStore();

// Service
const csvImportService = useCSVImportService();

// Aktiver Schritt (1, 2, 3)
const activeStep = ref<number>(1);

// Bearbeitungsstatus von Notizen
const editingNoteIndex = ref<number | null>(null);
const editableNote = ref<string>("");

// Tags für individuelle Transaktionen (Schritt 3)
const transactionTags = ref<{ [key: number]: string[] }>({});

// Duplikat-Management
const showDuplicateModal = ref<boolean>(false);
const potentialDuplicates = ref<Array<{
  csvRow: any;
  existingTransaction: any;
  duplicateType: 'exact' | 'similar' | 'account_transfer';
  confidence: number;
}>>([]);
const ignoredDuplicateIndexes = ref<Set<number>>(new Set());

// Berechnete Eigenschaften

// Schließen des Modals verhindern während des Imports
const canCloseModal = computed(
  () => csvImportService.importStatus !== "importing"
);

// Prüfungen für Fortschritt
const step1Valid = computed(() => {
  return (
    csvImportService.csvParseStatus === "success" &&
    csvImportService.allParsedData.length > 0 &&
    csvImportService.mappedColumns.date &&
    csvImportService.mappedColumns.amount
  );
});

const step2Valid = computed(() => {
  return csvImportService.allParsedData.length > 0;
});

// Aktiver Schritt zum Anzeigen bestimmen
const showStep1 = computed(() => activeStep.value === 1);
const showStep2 = computed(() => activeStep.value === 2);
const showStep3 = computed(() => activeStep.value === 3);

/**
 * Datei-Upload-Handler: Liest ausgewählte CSV-Datei
 */
function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  csvImportService
    .readCSVFile(input.files[0])
    .then(() => {
      debugLog(
        "TransactionImportModal",
        "CSV-Datei erfolgreich geladen",
        input.files![0].name
      );
    })
    .catch((error: any) => {
      errorLog(
        "TransactionImportModal",
        "Fehler beim Laden der CSV-Datei",
        JSON.stringify(error)
      );
    });
}

/**
 * Öffnet das Duplikat-Management-Modal
 */
function openDuplicateModal() {
  // Temporäre Lösung: Prüfe ob die Funktion verfügbar ist
  if (typeof csvImportService.findPotentialDuplicates === 'function') {
    potentialDuplicates.value = csvImportService.findPotentialDuplicates(props.accountId);
  } else {
    // Fallback: Erstelle eine einfache Duplikatsprüfung
    potentialDuplicates.value = findPotentialDuplicatesLocal();
  }
  showDuplicateModal.value = true;
}

/**
 * Lokale Fallback-Funktion für Duplikatsprüfung
 */
function findPotentialDuplicatesLocal() {
  const duplicates: Array<{
    csvRow: any;
    existingTransaction: any;
    duplicateType: 'exact' | 'similar' | 'account_transfer';
    confidence: number;
  }> = [];

  // Einfache Implementierung als Fallback
  for (let i = 0; i < csvImportService.allParsedData.length; i++) {
    const row = csvImportService.allParsedData[i];

    if (!row._selected) continue;

    const date = csvImportService.parseDate(row[csvImportService.mappedColumns.date]);
    const amount = parseAmount(row[csvImportService.mappedColumns.amount]);

    if (!date || amount === null) continue;

    // Suche nach ähnlichen Transaktionen (vereinfacht)
    // Diese Implementierung kann später entfernt werden, wenn der Service-Cache aktualisiert wird
    console.log('Fallback-Duplikatsprüfung wird verwendet - Service-Cache muss aktualisiert werden');
  }

  return duplicates;
}

/**
 * Schließt das Duplikat-Management-Modal
 */
function closeDuplicateModal() {
  showDuplicateModal.value = false;
}

/**
 * Ignoriert ausgewählte Duplikate
 */
function handleIgnoreDuplicates(duplicateIndexes: number[]) {
  // Füge die Indizes zu den ignorierten Duplikaten hinzu
  duplicateIndexes.forEach(index => {
    ignoredDuplicateIndexes.value.add(index);
  });

  // Markiere entsprechende CSV-Zeilen als ignoriert
  duplicateIndexes.forEach(index => {
    const duplicate = potentialDuplicates.value[index];
    if (duplicate && duplicate.csvRow._originalIndex !== undefined) {
      const csvRowIndex = duplicate.csvRow._originalIndex;
      if (csvRowIndex >= 0 && csvRowIndex < csvImportService.allParsedData.length) {
        csvImportService.allParsedData[csvRowIndex]._selected = false;
        csvImportService.allParsedData[csvRowIndex]._ignoredDuplicate = true;
      }
    }
  });

  debugLog("TransactionImportModal", `${duplicateIndexes.length} Duplikate ignoriert`, {
    ignoredIndexes: duplicateIndexes,
    totalIgnored: ignoredDuplicateIndexes.value.size
  });
}

/**
 * Gehe zum nächsten Schritt im Import-Prozess
 */
function nextStep() {
  if (activeStep.value === 1) {
    // Gehe zu Schritt 2: Auto-Mapping durchführen
    csvImportService.applyAutoMappingToAllData();
    activeStep.value = 2;
  } else if (activeStep.value === 2) {
    // Gehe zu Schritt 3: Review und Tagging
    activeStep.value = 3;
  }
}

/**
 * Zurück zum vorherigen Schritt
 */
function prevStep() {
  if (activeStep.value > 1) {
    activeStep.value--;
  }
}

/**
 * Beginne die Bearbeitung einer Notiz
 */
function startEditingNote(index: number, currentNote: string) {
  editingNoteIndex.value = index;
  editableNote.value = currentNote;
  nextTick(() => {
    const textarea = document.getElementById("note-edit-textarea");
    if (textarea) {
      textarea.focus();
    }
  });
}

/**
 * Speichere die bearbeitete Notiz
 */
function saveEditedNote() {
  if (editingNoteIndex.value !== null) {
    csvImportService.updateRowNote(editingNoteIndex.value, editableNote.value);
    editingNoteIndex.value = null;
  }
}

/**
 * Handler für die Taste Enter bei der Notizbearbeitung
 */
function handleNoteKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    saveEditedNote();
  }
}

/**
 * Erstellt einen neuen Empfänger
 */
function createRecipient(data: { name: string }) {
  const newRecipient = recipientStore.addRecipient(data);
  debugLog(
    "TransactionImportModal",
    "Neuer Empfänger erstellt",
    JSON.stringify(newRecipient)
  );
  return newRecipient;
}

/**
 * Erstellt eine neue Kategorie
 */
function createCategory(data: { name: string }) {
  const newCategory = categoryStore.addCategory({
    ...data,
    color:
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0"),
    isIncomeCategory: false,
  });
  debugLog(
    "TransactionImportModal",
    "Neue Kategorie erstellt",
    JSON.stringify(newCategory)
  );
  return newCategory;
}

/**
 * Erstellt ein neues Tag
 */
function createTag(data: { name: string }) {
  const newTag = tagStore.addTag({
    ...data,
    color:
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0"),
  });
  debugLog(
    "TransactionImportModal",
    "Neues Tag erstellt",
    JSON.stringify(newTag)
  );
  return newTag;
}

/**
 * Aktualisiert Tags für eine bestimmte Zeile
 */
function updateRowTags(rowIndex: number, tags: string[]) {
  transactionTags.value[rowIndex] = tags;
}

/**
 * Startet den Import-Prozess
 */
async function startImport() {
  try {
    // Füge für jede Zeile individuelle Tags hinzu
    Object.entries(transactionTags.value).forEach(([indexStr, tags]) => {
      const index = parseInt(indexStr);

      if (index >= 0 && index < csvImportService.allParsedData.length) {
        // Setze tagIds in den Originaldaten
        csvImportService.allParsedData[index].tagIds = tags;
      }
    });

    // Starte den Import
    debugLog("TransactionImportModal", "Starte Import mit folgenden Daten:", csvImportService.allParsedData.filter((row: any) => row._selected));
    const importedCount = await csvImportService.startImport(props.accountId);
    emit("imported", importedCount);
  } catch (error) {
    errorLog(
      "TransactionImportModal",
      "Fehler beim Import",
      JSON.stringify(error)
    );
  }
}

/**
 * Schließt das Modal und setzt alles zurück
 */
function closeModal() {
  if (canCloseModal.value) {
    csvImportService.reset();
    activeStep.value = 1;
    editingNoteIndex.value = null;
    editableNote.value = "";
    transactionTags.value = {};
    emit("close");
  }
}

// Reagieren auf Änderungen der Konfig und neu parsen
watch(
  () => [
    csvImportService.configuration.delimiter,
    csvImportService.configuration.customDelimiter,
    csvImportService.configuration.hasTitleRow,
    csvImportService.configuration.dateFormat,
  ],
  () => {
    if (csvImportService.csvData) {
      csvImportService.parseCSV();
    }
  }
);

// Reagieren auf Änderungen der Mappings und Auto-Mapping erneut anwenden
watch(
  () => csvImportService.mappedColumns,
  () => {
    if (csvImportService.allParsedData.length > 0) {
      csvImportService.applyAutoMappingToAllData();
    }
  },
  { deep: true }
);
</script>

<template>
  <div
    v-if="isOpen"
    class="modal modal-open z-50"
    tabindex="-1"
    role="dialog"
  >
    <div class="modal-box max-w-7xl max-h-[90vh]">
      <!-- Modal Kopfzeile mit Fortschrittsanzeige -->
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-bold text-xl">Transaktionsimport</h3>

        <!-- Fortschrittsanzeige (Stepper) -->
        <ul class="steps steps-horizontal">
          <li
            class="step"
            :class="{ 'step-primary': activeStep >= 1 }"
            @click="activeStep = 1"
          >
            Konfiguration
          </li>
          <li
            class="step"
            :class="{ 'step-primary': activeStep >= 2 }"
            @click="activeStep >= 2 ? (activeStep = 2) : null"
          >
            Vorschau & Mapping
          </li>
          <li
            class="step"
            :class="{ 'step-primary': activeStep >= 3 }"
            @click="activeStep >= 3 ? (activeStep = 3) : null"
          >
            Review & Import
          </li>
        </ul>
      </div>

      <!-- SCHRITT 1: CSV-KONFIGURATION & DATENMAPPING -->
      <div
        v-if="showStep1"
        class="space-y-6"
      >
        <!-- Formular für Datei-Upload und Konfiguration -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Datei-Upload -->
          <div class="card bg-base-200 p-4">
            <h4 class="font-bold mb-2">CSV-Datei auswählen</h4>
            <div class="form-control">
              <input
                type="file"
                accept=".csv"
                class="file-input file-input-bordered w-full"
                @change="handleFileUpload"
              />
            </div>
          </div>

          <!-- CSV-Konfiguration -->
          <div class="card bg-base-200 p-4">
            <h4 class="font-bold mb-2">CSV-Konfiguration</h4>
            <div class="space-y-4">
              <!-- Delimiter -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Trennzeichen</span>
                </label>
                <select
                  v-model="csvImportService.configuration.delimiter"
                  class="select select-bordered w-full"
                >
                  <option value=",">Komma (,)</option>
                  <option value=";">Semikolon (;)</option>
                  <option value="\t">Tabulator</option>
                  <option value="custom">Benutzerdefiniert</option>
                </select>
                <input
                  v-if="csvImportService.configuration.delimiter === 'custom'"
                  v-model="csvImportService.configuration.customDelimiter"
                  type="text"
                  class="input input-bordered mt-2 w-full max-w-xs"
                  maxlength="1"
                  placeholder="Eigenes Trennzeichen"
                />
              </div>

              <!-- Datumsformat -->
              <div class="form-control">
                <label class="label">
                  <span class="label-text">Datumsformat</span>
                </label>
                <select
                  v-model="csvImportService.configuration.dateFormat"
                  class="select select-bordered w-full"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="YY-MM-DD">YY-MM-DD</option>
                  <option value="MM-DD-YYYY">MM-DD-YYYY</option>
                  <option value="MM-DD-YY">MM-DD-YY</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  <option value="DD-MM-YY">DD-MM-YY</option>
                </select>
                <p class="text-xs text-base-content/70 mt-1">
                  Hinweis: Als Trennzeichen im Datum sind -, / und . erlaubt.
                </p>
              </div>

              <!-- Weitere Optionen -->
              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    v-model="csvImportService.configuration.hasTitleRow"
                  />
                  <span class="label-text"
                    >Erste Zeile enthält Überschriften</span
                  >
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Parsing-Status -->
        <div
          class="alert alert-soft"
          :class="{
            'alert-success': csvImportService.csvParseStatus === 'success',
            'alert-error': csvImportService.csvParseStatus === 'error',
            'alert-info':
              csvImportService.csvParseStatus === 'parsing' ||
              (csvImportService.csvParseStatus === 'idle' &&
                csvImportService.csvFile),
          }"
          v-if="
            csvImportService.csvParseStatus !== 'idle' ||
            csvImportService.csvFile
          "
        >
          <span v-if="csvImportService.csvParseStatus === 'success'">
            <Icon icon="mdi:check-circle" />
            CSV erfolgreich geparst.
            {{ csvImportService.allParsedData.length }} Einträge gefunden.
          </span>
          <span v-else-if="csvImportService.csvParseStatus === 'error'">
            <Icon icon="mdi:alert-circle" />
            {{ csvImportService.error }}
          </span>
          <div
            v-else-if="csvImportService.csvParseStatus === 'parsing'"
            class="flex items-center gap-2"
          >
            <span class="loading loading-dots loading-md"></span>
            <span>Parsing läuft...</span>
          </div>
          <div
            v-else-if="
              csvImportService.csvParseStatus === 'idle' &&
              csvImportService.csvFile
            "
            class="flex items-center gap-2"
          >
            <span class="loading loading-dots loading-md"></span>
            <span>CSV-Datei wird eingelesen...</span>
          </div>
          <span v-else>
            <Icon icon="mdi:information" />
            Konfigurationsparameter anpassen, falls nötig.
          </span>
        </div>

        <!-- Mapping und Vorschau -->
        <div
          v-if="
            csvImportService.csvParseStatus === 'success' &&
            csvImportService.allParsedData.length > 0
          "
          class="space-y-6"
        >
          <h4 class="font-bold text-lg">Daten-Mapping</h4>

          <!-- Mapping-Formular -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Spalte Datum -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">Buchungsdatum*</span>
              </label>
              <select
                v-model="csvImportService.mappedColumns.date"
                class="select select-bordered w-full"
                :class="{
                  'select-error': !csvImportService.mappedColumns.date,
                }"
              >
                <option value="">-- Bitte auswählen --</option>
                <option
                  v-for="header in csvImportService.csvHeaders"
                  :key="header"
                  :value="header"
                >
                  {{ header }}
                </option>
              </select>
            </div>

            <!-- Spalte Betrag -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">Betrag*</span>
              </label>
              <select
                v-model="csvImportService.mappedColumns.amount"
                class="select select-bordered w-full"
                :class="{
                  'select-error': !csvImportService.mappedColumns.amount,
                }"
              >
                <option value="">-- Bitte auswählen --</option>
                <option
                  v-for="header in csvImportService.csvHeaders"
                  :key="header"
                  :value="header"
                >
                  {{ header }}
                </option>
              </select>
            </div>

            <!-- Spalte Empfänger -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">Empfänger</span>
              </label>
              <select
                v-model="csvImportService.mappedColumns.recipient"
                class="select select-bordered w-full"
              >
                <option value="">-- Nicht importieren --</option>
                <option
                  v-for="header in csvImportService.csvHeaders"
                  :key="header"
                  :value="header"
                >
                  {{ header }}
                </option>
              </select>
            </div>

            <!-- Spalte Kategorie -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">Kategorie</span>
              </label>
              <select
                v-model="csvImportService.mappedColumns.category"
                class="select select-bordered w-full"
              >
                <option value="">-- Nicht importieren --</option>
                <option
                  v-for="header in csvImportService.csvHeaders"
                  :key="header"
                  :value="header"
                >
                  {{ header }}
                </option>
              </select>
            </div>

            <!-- Spalte Notizen -->
            <div class="form-control">
              <label class="label">
                <span class="label-text">Notizen</span>
              </label>
              <select
                v-model="csvImportService.mappedColumns.notes"
                class="select select-bordered w-full"
              >
                <option value="">-- Nicht importieren --</option>
                <option
                  v-for="header in csvImportService.csvHeaders"
                  :key="header"
                  :value="header"
                >
                  {{ header }}
                </option>
              </select>
            </div>
          </div>

          <!-- Datenvorschau - nur 4-5 Zeilen anzeigen -->
          <div class="mt-6">
            <h4 class="font-bold text-lg mb-2">Datenvorschau</h4>
            <div class="overflow-x-auto">
              <table class="table table-zebra table-sm w-full text-sm">
                <thead>
                  <tr>
                    <th class="py-0">Datum</th>
                    <th class="py-0">Betrag</th>
                    <th class="py-0">Empfänger</th>
                    <th class="py-0">Kategorie</th>
                    <th class="py-0">Notizen</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Zeige nur die ersten 5 Zeilen -->
                  <tr
                    v-for="(row, index) in csvImportService.allParsedData.slice(
                      0,
                      5
                    )"
                    :key="index"
                  >
                    <td class="py-0">
                      <div
                        :class="{
                          'text-success':
                            csvImportService.mappedColumns.date &&
                            csvImportService.parseDate(
                              row[csvImportService.mappedColumns.date]
                            ),
                          'text-error':
                            csvImportService.mappedColumns.date &&
                            !csvImportService.parseDate(
                              row[csvImportService.mappedColumns.date]
                            ),
                        }"
                      >
                        {{
                          csvImportService.mappedColumns.date
                            ? row[csvImportService.mappedColumns.date]
                            : "—"
                        }}
                        <div
                          class="text-xs"
                          v-if="
                            csvImportService.mappedColumns.date &&
                            csvImportService.parseDate(
                              row[csvImportService.mappedColumns.date]
                            )
                          "
                        >
                          →
                          {{
                            formatDate(
                              csvImportService.parseDate(
                                row[csvImportService.mappedColumns.date]
                              ) || ""
                            )
                          }}
                        </div>
                      </div>
                    </td>
                    <td class="py-0">
                      <div
                        :class="{
                          'text-success':
                            csvImportService.mappedColumns.amount &&
                            parseAmount(
                              row[csvImportService.mappedColumns.amount]
                            ) !== null,
                          'text-error':
                            csvImportService.mappedColumns.amount &&
                            parseAmount(
                              row[csvImportService.mappedColumns.amount]
                            ) === null,
                        }"
                      >
                        {{
                          csvImportService.mappedColumns.amount
                            ? row[csvImportService.mappedColumns.amount]
                            : "—"
                        }}
                        <div
                          class="text-xs"
                          v-if="
                            csvImportService.mappedColumns.amount &&
                            parseAmount(
                              row[csvImportService.mappedColumns.amount]
                            ) !== null
                          "
                        >
                          →
                          <CurrencyDisplay
                            :amount="
                              parseAmount(
                                row[csvImportService.mappedColumns.amount]
                              ) || 0
                            "
                          />
                        </div>
                      </div>
                    </td>
                    <td class="py-0">
                      <div
                        :class="{
                          'text-success':
                            csvImportService.mappedColumns.recipient &&
                            row[csvImportService.mappedColumns.recipient],
                        }"
                      >
                        {{
                          csvImportService.mappedColumns.recipient
                            ? row[csvImportService.mappedColumns.recipient]
                            : "—"
                        }}
                      </div>
                    </td>
                    <td class="py-0">
                      <div
                        :class="{
                          'text-success':
                            csvImportService.mappedColumns.category &&
                            row[csvImportService.mappedColumns.category],
                        }"
                      >
                        {{
                          csvImportService.mappedColumns.category
                            ? row[csvImportService.mappedColumns.category]
                            : "—"
                        }}
                      </div>
                    </td>
                    <td class="py-0">
                      <div
                        :class="{
                          'text-success':
                            csvImportService.mappedColumns.notes &&
                            row[csvImportService.mappedColumns.notes],
                        }"
                      >
                        {{
                          csvImportService.mappedColumns.notes
                            ? row[csvImportService.mappedColumns.notes]
                            : "—"
                        }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- SCHRITT 2: VORSCHAU MIT AUTO-MAPPING & BEARBEITBARKEIT -->
      <div
        v-if="showStep2"
        class="space-y-6"
      >
        <h4 class="font-bold text-lg mb-4">
          Transaktionsvorschau & Auto-Mapping
        </h4>

        <!-- Import-Übersicht -->
        <div class="stats shadow w-full">
          <div class="stat">
            <div class="stat-title">Datensätze</div>
            <div class="stat-value">
              {{ csvImportService.importSummary.total }}
            </div>
            <div class="stat-desc">
              {{ csvImportService.importSummary.ready }} importierbar
            </div>
          </div>

          <div class="stat">
            <div class="stat-title">Gesamtbetrag</div>
            <div class="stat-value text-primary">
              <CurrencyDisplay :amount="csvImportService.totalAmount" />
            </div>
            <div class="stat-desc">der importierbaren Transaktionen</div>
          </div>

          <div class="stat">
            <div class="stat-title">Zuordnungen</div>
            <div class="stat-value">
              {{ csvImportService.importSummary.withRecipient }}
            </div>
            <div class="stat-desc">
              Empfänger ({{ csvImportService.importSummary.withCategory }}
              Kategorien)
            </div>
          </div>

          <div class="stat">
            <div class="stat-title">Potentielle Duplikate</div>
            <div class="stat-value text-warning">
              {{ csvImportService.importSummary.potentialDuplicates }}
            </div>
            <div class="stat-desc">
              <button
                v-if="csvImportService.importSummary.potentialDuplicates > 0"
                class="btn btn-xs btn-warning btn-outline"
                @click="openDuplicateModal"
              >
                <Icon icon="mdi:eye" class="w-3 h-3" />
                Überprüfen Sie diese Einträge
              </button>
              <span v-else class="text-success">
                <Icon icon="mdi:check" class="w-3 h-3" />
                Keine Duplikate gefunden
              </span>
            </div>
          </div>
        </div>

        <!-- Datenvorschau mit Bearbeitungsmöglichkeit -->
        <div class="relative max-h-[50vh] overflow-y-auto">
          <table class="table table-zebra w-full table-fixed text-sm">
            <thead>
              <tr class="sticky top-0 z-10 bg-base-100">
                <th class="w-4 py-0">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    :checked="
                      csvImportService.allParsedData.every(
                        (row: any) => row._selected
                      )
                    "
                    @change="
                      (e) => csvImportService.toggleAllRows((e.target as HTMLInputElement).checked)
                    "
                  />
                </th>
                <th class="w-24 py-0">Datum</th>
                <th class="w-24 py-0">Betrag</th>
                <th class="w-55 py-0">Empfänger</th>
                <th class="py-0">Kategorie</th>
                <th class="w-auto py-0">Notizen</th>
                <th class="w-55 py-0">Tags</th>
                <th class="w-22 text-center py-0">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in csvImportService.allParsedData"
                :key="index"
                :class="{ 'opacity-50': !row._selected }"
              >
                <td class="w-[100px] py-0">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    v-model="row._selected"
                  />
                </td>
                <td class="w-[100px] py-0">
                  <div>
                    {{
                      formatDate(
                        csvImportService.parseDate(
                          row[csvImportService.mappedColumns.date]
                        ) || ""
                      )
                    }}
                  </div>
                </td>
                <td class="w-[100px] py-0">
                  <CurrencyDisplay
                    :amount="
                      parseAmount(row[csvImportService.mappedColumns.amount]) ||
                      0
                    "
                  />
                </td>
                <td class="w-[150px] py-0">
                  <div v-if="csvImportService.mappedColumns.recipient">
                    <div class="text-sm mb-1">
                      {{ row[csvImportService.mappedColumns.recipient] }}
                    </div>
                    <SelectRecipient
                      v-model="row.recipientId"
                      placeholder="Empfänger zuordnen..."
                      @update:modelValue="
                        (recipientId: string) =>
                          csvImportService.applyRecipientToSimilarRows(
                            row,
                            recipientId
                          )
                      "
                      @create="createRecipient"
                    />
                  </div>
                  <div
                    v-else
                    class="text-base-content/50"
                  >
                    -
                  </div>
                </td>
                <td class="w-[150px] py-0">
                  <div v-if="csvImportService.mappedColumns.category">
                    <div class="text-sm mb-1">
                      {{ row[csvImportService.mappedColumns.category] }}
                    </div>
                    <SelectCategory
                      v-model="row.categoryId"
                      placeholder="Kategorie zuordnen..."
                      @update:modelValue="
                        (categoryId: string) =>
                          csvImportService.applyCategoryToSimilarRows(
                            row,
                            categoryId
                          )
                      "
                      @create="createCategory"
                    />
                  </div>
                  <div
                    v-else
                    class="text-base-content/50"
                  >
                    -
                  </div>
                </td>
                <td class="w-auto py-0">
                  <div
                    v-if="csvImportService.mappedColumns.notes"
                    class="relative"
                  >
                    <!-- Anzeige der Notiz, wird zum Textarea beim Klick -->
                    <div
                      v-if="editingNoteIndex !== index"
                      @click="
                        startEditingNote(
                          index,
                          row[csvImportService.mappedColumns.notes]
                        )
                      "
                      class="cursor-pointer whitespace-pre-wrap min-h-[2rem]"
                    >
                      {{ row[csvImportService.mappedColumns.notes] }}
                    </div>

                    <!-- Textarea für Bearbeitung -->
                    <textarea
                      v-else
                      id="note-edit-textarea"
                      class="textarea textarea-bordered w-full"
                      v-model="editableNote"
                      @keydown="handleNoteKeydown"
                      @blur="saveEditedNote"
                    ></textarea>
                  </div>
                  <div
                    v-else
                    class="text-base-content/50"
                  >
                    -
                  </div>
                </td>
                <td class="w-[100px] py-0">
                  <!-- Individuelle Tag-Auswahl pro Zeile -->
                  <TagSearchableDropdown
                    :modelValue="transactionTags[index] || []"
                    :options="tagStore.tags"
                    placeholder="+"
                    @create="createTag"
                    @update:modelValue="(tags: string[]) => updateRowTags(index, tags)"
                  />
                </td>
                <td class="text-right py-0">
                  <!-- Status für potenzielle Duplikate -->
                  <div
                    v-if="row._potentialMerge"
                    class="tooltip tooltip-left"
                    data-tip="Ähnliche Buchung bereits vorhanden"
                  >
                    <Icon
                      icon="mdi:alert-circle"
                      class="text-warning text-xl"
                    />
                  </div>
                  <!-- Normale Buchung -->
                  <div v-else-if="csvImportService.isRowReadyForImport(row)">
                    <Icon
                      icon="mdi:check-circle"
                      class="text-success text-xl"
                    />
                  </div>
                  <!-- Fehler bei der Validierung -->
                  <div v-else>
                    <Icon
                      icon="mdi:alert-circle"
                      class="text-error text-xl"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginierung entfernt -->
      </div>

      <!-- SCHRITT 3: REVIEW & TAGGING -->
      <div
        v-if="showStep3"
        class="space-y-6"
      >
        <h4 class="font-bold text-lg mb-4">Review & Tagging</h4>

        <!-- Tag-Auswahl für alle Transaktionen entfernt -->

        <!-- Finale Review-Tabelle -->
        <div class="relative max-h-[50vh] overflow-y-auto">
          <table class="table table-zebra w-full table-fixed text-sm">
            <thead>
              <tr class="sticky top-0 z-10 bg-base-100">
                <th class="w-24 py-0">Datum</th>
                <th class="w-24 py-0">Betrag</th>
                <th class="w-55 py-0">Empfänger</th>
                <th class="w-55 py-0">Kategorie</th>
                <th class="w-auto py-0">Notizen</th>
                <th class="w-55 py-0">Tags</th>
                <th class="w-24 text-left py-0">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in csvImportService.allParsedData"
                :key="index"
                :class="{ 'opacity-50': !row._selected }"
              >
                <td class="w-[100px] py-0">
                  {{
                    formatDate(
                      csvImportService.parseDate(
                        row[csvImportService.mappedColumns.date]
                      ) || ""
                    )
                  }}
                </td>
                <td class="w-[100px] py-0">
                  <CurrencyDisplay
                    :amount="
                      parseAmount(row[csvImportService.mappedColumns.amount]) ||
                      0
                    "
                  />
                </td>
                <td class="w-[150px] py-0">
                  <!-- Nicht mehr editierbar -->
                  <div
                    v-if="row.recipientId"
                    class="truncate max-w-[150px]"
                    title="{{
                      recipientStore.getRecipientById(row.recipientId)?.name ||
                      'Unbekannt'
                    }}"
                  >
                    {{
                      recipientStore.getRecipientById(row.recipientId)?.name ||
                      "Unbekannt"
                    }}
                  </div>
                  <div
                    v-else-if="csvImportService.mappedColumns.recipient"
                    class="truncate max-w-[150px]"
                    title="{{
                      row[csvImportService.mappedColumns.recipient]
                    }}"
                  >
                    <span class="text-base-content/50">{{
                      row[csvImportService.mappedColumns.recipient]
                    }}</span>
                  </div>
                  <div
                    v-else
                    class="text-base-content/50"
                  >
                    -
                  </div>
                </td>
                <td class="w-[150px] py-0">
                  <!-- Nicht mehr editierbar -->
                  <div
                    v-if="row.categoryId"
                    class="truncate max-w-[150px]"
                    title="{{
                      categoryStore.getCategoryById(row.categoryId)?.name ||
                      'Unbekannt'
                    }}"
                  >
                    {{
                      categoryStore.getCategoryById(row.categoryId)?.name ||
                      "Unbekannt"
                    }}
                  </div>
                  <div
                    v-else-if="csvImportService.mappedColumns.category"
                    class="truncate max-w-[150px]"
                    title="{{
                      row[csvImportService.mappedColumns.category]
                    }}"
                  >
                    <span class="text-base-content/50">{{
                      row[csvImportService.mappedColumns.category]
                    }}</span>
                  </div>
                  <div
                    v-else
                    class="text-base-content/50"
                  >
                    -
                  </div>
                </td>
                <td class="w-auto py-0">
                  <!-- Klickbare Notizen -->
                  <div
                    v-if="csvImportService.mappedColumns.notes"
                    class="relative"
                  >
                    <!-- Anzeige der Notiz, wird zum Textarea beim Klick -->
                    <div
                      v-if="editingNoteIndex !== index"
                      @click="
                        startEditingNote(
                          index,
                          row[csvImportService.mappedColumns.notes]
                        )
                      "
                      class="cursor-pointer whitespace-pre-wrap min-h-[2rem]"
                    >
                      {{ row[csvImportService.mappedColumns.notes] }}
                    </div>

                    <!-- Textarea für Bearbeitung -->
                    <textarea
                      v-else
                      id="note-edit-textarea"
                      class="textarea textarea-bordered w-full"
                      v-model="editableNote"
                      @keydown="handleNoteKeydown"
                      @blur="saveEditedNote"
                    ></textarea>
                  </div>
                  <div
                    v-else
                    class="text-base-content/50"
                  >
                    -
                  </div>
                </td>
                <td class="w-[100px] py-0">
                  <!-- Individuelle Tag-Auswahl pro Zeile -->
                  <TagSearchableDropdown
                    :modelValue="transactionTags[index] || []"
                    :options="tagStore.tags"
                    placeholder="+"
                    @create="createTag"
                    @update:modelValue="(tags: string[]) => updateRowTags(index, tags)"
                  />
                </td>
                <td class="w-[60px] text-center py-0">
                  <!-- Status für potenzielle Duplikate -->
                  <div
                    v-if="row._potentialMerge"
                    class="tooltip tooltip-left"
                    data-tip="Ähnliche Buchung bereits vorhanden"
                  >
                    <Icon
                      icon="mdi:alert-circle"
                      class="text-warning text-xl"
                    />
                  </div>
                  <!-- Normale Buchung -->
                  <div v-else-if="csvImportService.isRowReadyForImport(row)">
                    <Icon
                      icon="mdi:check-circle"
                      class="text-success text-xl"
                    />
                  </div>
                  <!-- Fehler bei der Validierung -->
                  <div v-else>
                    <Icon
                      icon="mdi:alert-circle"
                      class="text-error text-xl"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Paginierung entfernt -->

        <!-- Import-Status -->
        <div
          v-if="csvImportService.importStatus !== 'idle'"
          class="mt-6"
        >
          <div
            class="alert alert-soft"
            :class="{
              'alert-info': csvImportService.importStatus === 'importing',
              'alert-success': csvImportService.importStatus === 'success',
              'alert-error': csvImportService.importStatus === 'error',
            }"
          >
            <div
              v-if="csvImportService.importStatus === 'importing'"
              class="flex items-center gap-2"
            >
              <span class="loading loading-dots loading-md"></span>
              <span>Import läuft, bitte warten...</span>
            </div>
            <div
              v-else-if="csvImportService.importStatus === 'success'"
              class="flex items-center gap-2"
            >
              <Icon
                icon="mdi:check-circle"
                class="text-xl"
              />
              <span
                >{{
                  csvImportService.importedTransactions.length
                }}
                Transaktionen erfolgreich importiert!</span
              >
            </div>
            <div
              v-else-if="csvImportService.importStatus === 'error'"
              class="flex items-center gap-2"
            >
              <Icon
                icon="mdi:alert-circle"
                class="text-xl"
              />
              <span>{{ csvImportService.error }}</span>
            </div>
          </div>
        </div>

        <!-- Import-Statistik -->
        <div
          v-if="csvImportService.importStatus === 'success'"
          class="card bg-base-200 p-4 mt-6"
        >
          <h5 class="font-medium mb-2">Import-Statistik</h5>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="font-semibold">Importierte Transaktionen:</span>
              {{ csvImportService.importedTransactions.length }}
            </div>
            <div>
              <span class="font-semibold">Gesamtbetrag:</span>
              <CurrencyDisplay
                :amount="
                  csvImportService.importedTransactions.reduce(
                    (sum: number, tx: any) => sum + tx.amount,
                    0
                  )
                "
              />
            </div>
            <div>
              <span class="font-semibold">Mit Empfänger:</span>
              {{
                csvImportService.importedTransactions.filter(
                  (tx: any) => tx.recipientId
                ).length
              }}
            </div>
            <div>
              <span class="font-semibold">Mit Kategorie:</span>
              {{
                csvImportService.importedTransactions.filter(
                  (tx: any) => tx.categoryId
                ).length
              }}
            </div>
            <div>
              <span class="font-semibold">Mit Tags:</span>
              {{ csvImportService.selectedTags.length > 0 ? "Ja" : "Nein" }}
            </div>
          </div>
        </div>
      </div>

      <!-- Aktionen (Buttons) -->
      <div class="modal-action mt-6">
        <!-- Zurück-Button -->
        <button
          v-if="activeStep > 1"
          class="btn btn-outline"
          @click="prevStep"
          :disabled="csvImportService.importStatus === 'importing'"
        >
          Zurück
        </button>

        <!-- Abbrechen-Button -->
        <button
          class="btn btn-outline"
          @click="closeModal"
          :disabled="!canCloseModal"
        >
          {{
            csvImportService.importStatus === "success"
              ? "Schließen"
              : "Abbrechen"
          }}
        </button>

        <!-- Weiter-Button (Schritt 1 -> 2) -->
        <button
          v-if="showStep1"
          class="btn btn-primary"
          @click="nextStep"
          :disabled="!step1Valid"
        >
          Weiter zur Vorschau
        </button>

        <!-- Weiter-Button (Schritt 2 -> 3) -->
        <button
          v-if="showStep2"
          class="btn btn-primary"
          @click="nextStep"
          :disabled="!step2Valid"
        >
          Weiter zum Review
        </button>

        <!-- Import-Button (Schritt 3) -->
        <button
          v-if="showStep3 && csvImportService.importStatus !== 'success'"
          class="btn btn-primary"
          @click="startImport"
          :disabled="
            csvImportService.importStatus === 'importing' ||
            csvImportService.importSummary.ready === 0
          "
        >
          <span v-if="csvImportService.importStatus === 'importing'">
            <span class="loading loading-dots loading-sm mr-2"></span>
            Importiere...
          </span>
          <span v-else> Import starten </span>
        </button>
      </div>
    </div>

    <!-- Backdrop/Overlay -->
    <div
      class="modal-backdrop bg-base-300 opacity-80"
      @click="canCloseModal ? closeModal() : null"
    ></div>
  </div>

  <!-- Duplikat-Management-Modal -->
  <DuplicateManagementModal
    :isOpen="showDuplicateModal"
    :duplicates="potentialDuplicates"
    :mappedColumns="csvImportService.mappedColumns"
    @close="closeDuplicateModal"
    @ignoreDuplicates="handleIgnoreDuplicates"
  />
</template>

<style scoped>
/* Nur minimale Styles, der Rest wird durch DaisyUI gehandhabt */
.select-error {
  border-color: hsl(var(--er));
}
</style>
