import { ref, computed, watch, nextTick } from "vue";
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
import { debugLog, errorLog } from "@/utils/logger";
import { formatDate } from "@/utils/formatters";
import { parseAmount } from "@/utils/csvUtils";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["close", "imported"]);
// Stores
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const accountStore = useAccountStore();
const tagStore = useTagStore();
// Service
const csvImportService = useCSVImportService();
// Aktiver Schritt (1, 2, 3)
const activeStep = ref(1);
// Bearbeitungsstatus von Notizen
const editingNoteIndex = ref(null);
const editableNote = ref("");
// Tags für individuelle Transaktionen (Schritt 3)
const transactionTags = ref({});
// Duplikat-Management
const showDuplicateModal = ref(false);
const potentialDuplicates = ref([]);
const ignoredDuplicateIndexes = ref(new Set());
// Berechnete Eigenschaften
// Schließen des Modals verhindern während des Imports
const canCloseModal = computed(() => csvImportService.importStatus !== "importing");
// Prüfungen für Fortschritt
const step1Valid = computed(() => {
    return (csvImportService.csvParseStatus === "success" &&
        csvImportService.allParsedData.length > 0 &&
        csvImportService.mappedColumns.date &&
        csvImportService.mappedColumns.amount);
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
function handleFileUpload(event) {
    const input = event.target;
    if (!input.files?.length)
        return;
    csvImportService
        .readCSVFile(input.files[0])
        .then(() => {
        debugLog("TransactionImportModal", "CSV-Datei erfolgreich geladen", input.files[0].name);
    })
        .catch((error) => {
        errorLog("TransactionImportModal", "Fehler beim Laden der CSV-Datei", JSON.stringify(error));
    });
}
/**
 * Öffnet das Duplikat-Management-Modal
 */
function openDuplicateModal() {
    // Temporäre Lösung: Prüfe ob die Funktion verfügbar ist
    if (typeof csvImportService.findPotentialDuplicates === "function") {
        potentialDuplicates.value = csvImportService.findPotentialDuplicates(props.accountId);
    }
    else {
        // Fallback: Erstelle eine einfache Duplikatsprüfung
        potentialDuplicates.value = findPotentialDuplicatesLocal();
    }
    showDuplicateModal.value = true;
}
/**
 * Lokale Fallback-Funktion für Duplikatsprüfung
 */
function findPotentialDuplicatesLocal() {
    const duplicates = [];
    // Einfache Implementierung als Fallback
    for (let i = 0; i < csvImportService.allParsedData.length; i++) {
        const row = csvImportService.allParsedData[i];
        if (!row._selected)
            continue;
        const date = csvImportService.parseDate(row[csvImportService.mappedColumns.date]);
        const amount = parseAmount(row[csvImportService.mappedColumns.amount]);
        if (!date || amount === null)
            continue;
        // Suche nach ähnlichen Transaktionen (vereinfacht)
        // Diese Implementierung kann später entfernt werden, wenn der Service-Cache aktualisiert wird
        console.log("Fallback-Duplikatsprüfung wird verwendet - Service-Cache muss aktualisiert werden");
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
function handleIgnoreDuplicates(duplicateIndexes) {
    // Füge die Indizes zu den ignorierten Duplikaten hinzu
    duplicateIndexes.forEach((index) => {
        ignoredDuplicateIndexes.value.add(index);
    });
    // Markiere entsprechende CSV-Zeilen als ignoriert
    duplicateIndexes.forEach((index) => {
        const duplicate = potentialDuplicates.value[index];
        if (duplicate && duplicate.csvRow._originalIndex !== undefined) {
            const csvRowIndex = duplicate.csvRow._originalIndex;
            if (csvRowIndex >= 0 &&
                csvRowIndex < csvImportService.allParsedData.length) {
                csvImportService.allParsedData[csvRowIndex]._selected = false;
                csvImportService.allParsedData[csvRowIndex]._ignoredDuplicate = true;
            }
        }
    });
    debugLog("TransactionImportModal", `${duplicateIndexes.length} Duplikate ignoriert`, {
        ignoredIndexes: duplicateIndexes,
        totalIgnored: ignoredDuplicateIndexes.value.size,
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
    }
    else if (activeStep.value === 2) {
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
function startEditingNote(index, currentNote) {
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
function handleNoteKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        saveEditedNote();
    }
}
/**
 * Erstellt einen neuen Empfänger
 */
function createRecipient(data) {
    const newRecipient = recipientStore.addRecipient(data);
    debugLog("TransactionImportModal", "Neuer Empfänger erstellt", JSON.stringify(newRecipient));
    return newRecipient;
}
/**
 * Erstellt eine neue Kategorie
 */
function createCategory(data) {
    // Erforderliche Felder gemäß Category-Typ auffüllen
    const newCategory = categoryStore.addCategory({
        name: data.name,
        icon: undefined,
        budgeted: 0,
        activity: 0,
        available: 0,
        isIncomeCategory: false,
        isHidden: false,
        isActive: true,
        sortOrder: 0,
        categoryGroupId: undefined,
        parentCategoryId: undefined,
        isSavingsGoal: false,
        goalDate: undefined,
        targetAmount: undefined,
        priority: undefined,
        proportion: undefined,
        monthlyAmount: undefined,
        note: undefined,
    });
    debugLog("TransactionImportModal", "Neue Kategorie erstellt", JSON.stringify(newCategory));
    return newCategory;
}
/**
 * Erstellt ein neues Tag
 */
function createTag(data) {
    const newTag = tagStore.addTag({
        ...data,
        color: "#" +
            Math.floor(Math.random() * 16777215)
                .toString(16)
                .padStart(6, "0"),
    });
    debugLog("TransactionImportModal", "Neues Tag erstellt", JSON.stringify(newTag));
    return newTag;
}
/**
 * Aktualisiert Tags für eine bestimmte Zeile
 */
function updateRowTags(rowIndex, tags) {
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
        debugLog("TransactionImportModal", "Starte Import mit folgenden Daten:", csvImportService.allParsedData.filter((row) => row._selected));
        const importedCount = await csvImportService.startImport(props.accountId);
        emit("imported", importedCount);
    }
    catch (error) {
        errorLog("TransactionImportModal", "Fehler beim Import", JSON.stringify(error));
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
watch(() => [
    csvImportService.configuration.delimiter,
    csvImportService.configuration.customDelimiter,
    csvImportService.configuration.hasTitleRow,
    csvImportService.configuration.dateFormat,
], () => {
    if (csvImportService.csvData) {
        csvImportService.parseCSV();
    }
});
// Reagieren auf Änderungen der Mappings und Auto-Mapping erneut anwenden
watch(() => csvImportService.mappedColumns, () => {
    if (csvImportService.allParsedData.length > 0) {
        csvImportService.applyAutoMappingToAllData();
    }
}, { deep: true });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open z-50" },
        tabindex: "-1",
        role: "dialog",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-7xl max-h-[90vh]" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between items-center mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "steps steps-horizontal" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.activeStep = 1;
            } },
        ...{ class: "step" },
        ...{ class: ({ 'step-primary': __VLS_ctx.activeStep >= 1 }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.activeStep >= 2 ? (__VLS_ctx.activeStep = 2) : null;
            } },
        ...{ class: "step" },
        ...{ class: ({ 'step-primary': __VLS_ctx.activeStep >= 2 }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.activeStep >= 3 ? (__VLS_ctx.activeStep = 3) : null;
            } },
        ...{ class: "step" },
        ...{ class: ({ 'step-primary': __VLS_ctx.activeStep >= 3 }) },
    });
    if (__VLS_ctx.showStep1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-1 lg:grid-cols-2 gap-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card bg-base-200 p-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "font-bold mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: (__VLS_ctx.handleFileUpload) },
            type: "file",
            accept: ".csv",
            ...{ class: "file-input file-input-bordered w-full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card bg-base-200 p-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "font-bold mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.csvImportService.configuration.delimiter),
            ...{ class: "select select-bordered w-full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: ",",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: ";",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "\u005c\u0074",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "custom",
        });
        if (__VLS_ctx.csvImportService.configuration.delimiter === 'custom') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (__VLS_ctx.csvImportService.configuration.customDelimiter),
                type: "text",
                ...{ class: "input input-bordered mt-2 w-full max-w-xs" },
                maxlength: "1",
                placeholder: "Eigenes Trennzeichen",
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.csvImportService.configuration.dateFormat),
            ...{ class: "select select-bordered w-full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "YYYY-MM-DD",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "YY-MM-DD",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "MM-DD-YYYY",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "MM-DD-YY",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "DD-MM-YYYY",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "DD-MM-YY",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-xs text-base-content/70 mt-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "label cursor-pointer justify-start gap-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "checkbox",
            ...{ class: "checkbox checkbox-sm" },
        });
        (__VLS_ctx.csvImportService.configuration.hasTitleRow);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text" },
        });
        if (__VLS_ctx.csvImportService.csvParseStatus !== 'idle' ||
            __VLS_ctx.csvImportService.csvFile) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "alert alert-soft" },
                ...{ class: ({
                        'alert-success': __VLS_ctx.csvImportService.csvParseStatus === 'success',
                        'alert-error': __VLS_ctx.csvImportService.csvParseStatus === 'error',
                        'alert-info': __VLS_ctx.csvImportService.csvParseStatus === 'parsing' ||
                            (__VLS_ctx.csvImportService.csvParseStatus === 'idle' &&
                                __VLS_ctx.csvImportService.csvFile),
                    }) },
            });
            if (__VLS_ctx.csvImportService.csvParseStatus === 'success') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                const __VLS_0 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
                    icon: "mdi:check-circle",
                }));
                const __VLS_2 = __VLS_1({
                    icon: "mdi:check-circle",
                }, ...__VLS_functionalComponentArgsRest(__VLS_1));
                (__VLS_ctx.csvImportService.allParsedData.length);
            }
            else if (__VLS_ctx.csvImportService.csvParseStatus === 'error') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                const __VLS_4 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
                    icon: "mdi:alert-circle",
                }));
                const __VLS_6 = __VLS_5({
                    icon: "mdi:alert-circle",
                }, ...__VLS_functionalComponentArgsRest(__VLS_5));
                (__VLS_ctx.csvImportService.error);
            }
            else if (__VLS_ctx.csvImportService.csvParseStatus === 'parsing') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center gap-2" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "loading loading-dots loading-md" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            }
            else if (__VLS_ctx.csvImportService.csvParseStatus === 'idle' &&
                __VLS_ctx.csvImportService.csvFile) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center gap-2" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "loading loading-dots loading-md" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                const __VLS_8 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
                    icon: "mdi:information",
                }));
                const __VLS_10 = __VLS_9({
                    icon: "mdi:information",
                }, ...__VLS_functionalComponentArgsRest(__VLS_9));
            }
        }
        if (__VLS_ctx.csvImportService.csvParseStatus === 'success' &&
            __VLS_ctx.csvImportService.allParsedData.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "space-y-6" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
                ...{ class: "font-bold text-lg" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "grid grid-cols-1 md:grid-cols-3 gap-4" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
                value: (__VLS_ctx.csvImportService.mappedColumns.date),
                ...{ class: "select select-bordered w-full" },
                ...{ class: ({
                        'select-error': !__VLS_ctx.csvImportService.mappedColumns.date,
                    }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                value: "",
            });
            for (const [header] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.csvHeaders))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    key: (header),
                    value: (header),
                });
                (header);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
                value: (__VLS_ctx.csvImportService.mappedColumns.amount),
                ...{ class: "select select-bordered w-full" },
                ...{ class: ({
                        'select-error': !__VLS_ctx.csvImportService.mappedColumns.amount,
                    }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                value: "",
            });
            for (const [header] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.csvHeaders))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    key: (header),
                    value: (header),
                });
                (header);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
                value: (__VLS_ctx.csvImportService.mappedColumns.recipient),
                ...{ class: "select select-bordered w-full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                value: "",
            });
            for (const [header] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.csvHeaders))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    key: (header),
                    value: (header),
                });
                (header);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
                value: (__VLS_ctx.csvImportService.mappedColumns.category),
                ...{ class: "select select-bordered w-full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                value: "",
            });
            for (const [header] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.csvHeaders))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    key: (header),
                    value: (header),
                });
                (header);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
                value: (__VLS_ctx.csvImportService.mappedColumns.notes),
                ...{ class: "select select-bordered w-full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                value: "",
            });
            for (const [header] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.csvHeaders))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                    key: (header),
                    value: (header),
                });
                (header);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "mt-6" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
                ...{ class: "font-bold text-lg mb-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "overflow-x-auto" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
                ...{ class: "table table-zebra table-sm w-full text-sm" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                ...{ class: "py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                ...{ class: "py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                ...{ class: "py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                ...{ class: "py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
                ...{ class: "py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
            for (const [row, index] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.allParsedData.slice(0, 5)))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                    key: (index),
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    ...{ class: "py-0" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: ({
                            'text-success': __VLS_ctx.csvImportService.mappedColumns.date &&
                                __VLS_ctx.csvImportService.parseDate(row[__VLS_ctx.csvImportService.mappedColumns.date]),
                            'text-error': __VLS_ctx.csvImportService.mappedColumns.date &&
                                !__VLS_ctx.csvImportService.parseDate(row[__VLS_ctx.csvImportService.mappedColumns.date]),
                        }) },
                });
                (__VLS_ctx.csvImportService.mappedColumns.date
                    ? row[__VLS_ctx.csvImportService.mappedColumns.date]
                    : "—");
                if (__VLS_ctx.csvImportService.mappedColumns.date &&
                    __VLS_ctx.csvImportService.parseDate(row[__VLS_ctx.csvImportService.mappedColumns.date])) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "text-xs" },
                    });
                    (__VLS_ctx.formatDate(__VLS_ctx.csvImportService.parseDate(row[__VLS_ctx.csvImportService.mappedColumns.date]) || ""));
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    ...{ class: "py-0" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: ({
                            'text-success': __VLS_ctx.csvImportService.mappedColumns.amount &&
                                __VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) !== null,
                            'text-error': __VLS_ctx.csvImportService.mappedColumns.amount &&
                                __VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) === null,
                        }) },
                });
                (__VLS_ctx.csvImportService.mappedColumns.amount
                    ? row[__VLS_ctx.csvImportService.mappedColumns.amount]
                    : "—");
                if (__VLS_ctx.csvImportService.mappedColumns.amount &&
                    __VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) !== null) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "text-xs" },
                    });
                    /** @type {[typeof CurrencyDisplay, ]} */ ;
                    // @ts-ignore
                    const __VLS_12 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                        amount: (__VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) || 0),
                    }));
                    const __VLS_13 = __VLS_12({
                        amount: (__VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) || 0),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    ...{ class: "py-0" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: ({
                            'text-success': __VLS_ctx.csvImportService.mappedColumns.recipient &&
                                row[__VLS_ctx.csvImportService.mappedColumns.recipient],
                        }) },
                });
                (__VLS_ctx.csvImportService.mappedColumns.recipient
                    ? row[__VLS_ctx.csvImportService.mappedColumns.recipient]
                    : "—");
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    ...{ class: "py-0" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: ({
                            'text-success': __VLS_ctx.csvImportService.mappedColumns.category &&
                                row[__VLS_ctx.csvImportService.mappedColumns.category],
                        }) },
                });
                (__VLS_ctx.csvImportService.mappedColumns.category
                    ? row[__VLS_ctx.csvImportService.mappedColumns.category]
                    : "—");
                __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                    ...{ class: "py-0" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: ({
                            'text-success': __VLS_ctx.csvImportService.mappedColumns.notes &&
                                row[__VLS_ctx.csvImportService.mappedColumns.notes],
                        }) },
                });
                (__VLS_ctx.csvImportService.mappedColumns.notes
                    ? row[__VLS_ctx.csvImportService.mappedColumns.notes]
                    : "—");
            }
        }
    }
    if (__VLS_ctx.showStep2) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "font-bold text-lg mb-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stats shadow w-full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-value" },
        });
        (__VLS_ctx.csvImportService.importSummary.total);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-desc" },
        });
        (__VLS_ctx.csvImportService.importSummary.ready);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-value text-primary" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.csvImportService.totalAmount),
        }));
        const __VLS_16 = __VLS_15({
            amount: (__VLS_ctx.csvImportService.totalAmount),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-desc" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-value" },
        });
        (__VLS_ctx.csvImportService.importSummary.withRecipient);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-desc" },
        });
        (__VLS_ctx.csvImportService.importSummary.withCategory);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-value text-warning" },
        });
        (__VLS_ctx.csvImportService.importSummary.potentialDuplicates);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "stat-desc" },
        });
        if (__VLS_ctx.csvImportService.importSummary.potentialDuplicates > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (__VLS_ctx.openDuplicateModal) },
                ...{ class: "btn btn-xs btn-warning btn-outline" },
            });
            const __VLS_18 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_19 = __VLS_asFunctionalComponent(__VLS_18, new __VLS_18({
                icon: "mdi:eye",
                ...{ class: "w-3 h-3" },
            }));
            const __VLS_20 = __VLS_19({
                icon: "mdi:eye",
                ...{ class: "w-3 h-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_19));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-success" },
            });
            const __VLS_22 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({
                icon: "mdi:check",
                ...{ class: "w-3 h-3" },
            }));
            const __VLS_24 = __VLS_23({
                icon: "mdi:check",
                ...{ class: "w-3 h-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_23));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "relative max-h-[50vh] overflow-y-auto" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
            ...{ class: "table table-zebra w-full table-fixed text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            ...{ class: "sticky top-0 z-10 bg-base-100" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-4 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onChange: ((e) => __VLS_ctx.csvImportService.toggleAllRows(e.target.checked)) },
            type: "checkbox",
            ...{ class: "checkbox checkbox-sm" },
            checked: (__VLS_ctx.csvImportService.allParsedData.every((row) => row._selected)),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-24 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-24 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-55 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-auto py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-55 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-22 text-center py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
        for (const [row, index] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.allParsedData))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                key: (index),
                ...{ class: ({ 'opacity-50': !row._selected }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "checkbox",
                ...{ class: "checkbox checkbox-sm" },
            });
            (row._selected);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            (__VLS_ctx.formatDate(__VLS_ctx.csvImportService.parseDate(row[__VLS_ctx.csvImportService.mappedColumns.date]) || ""));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_26 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) ||
                    0),
            }));
            const __VLS_27 = __VLS_26({
                amount: (__VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) ||
                    0),
            }, ...__VLS_functionalComponentArgsRest(__VLS_26));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[150px] py-0" },
            });
            if (__VLS_ctx.csvImportService.mappedColumns.recipient) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-sm mb-1" },
                });
                (row[__VLS_ctx.csvImportService.mappedColumns.recipient]);
                /** @type {[typeof SelectRecipient, ]} */ ;
                // @ts-ignore
                const __VLS_29 = __VLS_asFunctionalComponent(SelectRecipient, new SelectRecipient({
                    ...{ 'onUpdate:modelValue': {} },
                    ...{ 'onCreate': {} },
                    modelValue: (row.recipientId),
                    placeholder: "Empfänger zuordnen...",
                }));
                const __VLS_30 = __VLS_29({
                    ...{ 'onUpdate:modelValue': {} },
                    ...{ 'onCreate': {} },
                    modelValue: (row.recipientId),
                    placeholder: "Empfänger zuordnen...",
                }, ...__VLS_functionalComponentArgsRest(__VLS_29));
                let __VLS_32;
                let __VLS_33;
                let __VLS_34;
                const __VLS_35 = {
                    'onUpdate:modelValue': ((recipientId) => __VLS_ctx.csvImportService.applyRecipientToSimilarRows(row, recipientId))
                };
                const __VLS_36 = {
                    onCreate: (__VLS_ctx.createRecipient)
                };
                var __VLS_31;
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-base-content/50" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[150px] py-0" },
            });
            if (__VLS_ctx.csvImportService.mappedColumns.category) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-sm mb-1" },
                });
                (row[__VLS_ctx.csvImportService.mappedColumns.category]);
                /** @type {[typeof SelectCategory, ]} */ ;
                // @ts-ignore
                const __VLS_37 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
                    ...{ 'onUpdate:modelValue': {} },
                    ...{ 'onCreate': {} },
                    modelValue: (row.categoryId),
                    placeholder: "Kategorie zuordnen...",
                }));
                const __VLS_38 = __VLS_37({
                    ...{ 'onUpdate:modelValue': {} },
                    ...{ 'onCreate': {} },
                    modelValue: (row.categoryId),
                    placeholder: "Kategorie zuordnen...",
                }, ...__VLS_functionalComponentArgsRest(__VLS_37));
                let __VLS_40;
                let __VLS_41;
                let __VLS_42;
                const __VLS_43 = {
                    'onUpdate:modelValue': ((categoryId) => __VLS_ctx.csvImportService.applyCategoryToSimilarRows(row, categoryId))
                };
                const __VLS_44 = {
                    onCreate: (__VLS_ctx.createCategory)
                };
                var __VLS_39;
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-base-content/50" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-auto py-0" },
            });
            if (__VLS_ctx.csvImportService.mappedColumns.notes) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "relative" },
                });
                if (__VLS_ctx.editingNoteIndex !== index) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.isOpen))
                                    return;
                                if (!(__VLS_ctx.showStep2))
                                    return;
                                if (!(__VLS_ctx.csvImportService.mappedColumns.notes))
                                    return;
                                if (!(__VLS_ctx.editingNoteIndex !== index))
                                    return;
                                __VLS_ctx.startEditingNote(index, row[__VLS_ctx.csvImportService.mappedColumns.notes]);
                            } },
                        ...{ class: "cursor-pointer whitespace-pre-wrap min-h-[2rem]" },
                    });
                    (row[__VLS_ctx.csvImportService.mappedColumns.notes]);
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
                        ...{ onKeydown: (__VLS_ctx.handleNoteKeydown) },
                        ...{ onBlur: (__VLS_ctx.saveEditedNote) },
                        id: "note-edit-textarea",
                        ...{ class: "textarea textarea-bordered w-full" },
                        value: (__VLS_ctx.editableNote),
                    });
                }
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-base-content/50" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            /** @type {[typeof TagSearchableDropdown, ]} */ ;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent(TagSearchableDropdown, new TagSearchableDropdown({
                ...{ 'onCreate': {} },
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (__VLS_ctx.transactionTags[index] || []),
                options: (__VLS_ctx.tagStore.tags),
                placeholder: "+",
            }));
            const __VLS_46 = __VLS_45({
                ...{ 'onCreate': {} },
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (__VLS_ctx.transactionTags[index] || []),
                options: (__VLS_ctx.tagStore.tags),
                placeholder: "+",
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
            let __VLS_48;
            let __VLS_49;
            let __VLS_50;
            const __VLS_51 = {
                onCreate: (__VLS_ctx.createTag)
            };
            const __VLS_52 = {
                'onUpdate:modelValue': ((tags) => __VLS_ctx.updateRowTags(index, tags))
            };
            var __VLS_47;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "text-right py-0" },
            });
            if (row._potentialMerge) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "tooltip tooltip-left" },
                    'data-tip': "Ähnliche Buchung bereits vorhanden",
                });
                const __VLS_53 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-warning text-xl" },
                }));
                const __VLS_55 = __VLS_54({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-warning text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_54));
            }
            else if (__VLS_ctx.csvImportService.isRowReadyForImport(row)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                const __VLS_57 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
                    icon: "mdi:check-circle",
                    ...{ class: "text-success text-xl" },
                }));
                const __VLS_59 = __VLS_58({
                    icon: "mdi:check-circle",
                    ...{ class: "text-success text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_58));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                const __VLS_61 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-error text-xl" },
                }));
                const __VLS_63 = __VLS_62({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-error text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_62));
            }
        }
    }
    if (__VLS_ctx.showStep3) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "font-bold text-lg mb-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "relative max-h-[50vh] overflow-y-auto" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
            ...{ class: "table table-zebra w-full table-fixed text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            ...{ class: "sticky top-0 z-10 bg-base-100" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-24 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-24 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-55 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-55 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-auto py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-55 py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
            ...{ class: "w-24 text-left py-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
        for (const [row, index] of __VLS_getVForSourceType((__VLS_ctx.csvImportService.allParsedData))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
                key: (index),
                ...{ class: ({ 'opacity-50': !row._selected }) },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            (__VLS_ctx.formatDate(__VLS_ctx.csvImportService.parseDate(row[__VLS_ctx.csvImportService.mappedColumns.date]) || ""));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_65 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) ||
                    0),
            }));
            const __VLS_66 = __VLS_65({
                amount: (__VLS_ctx.parseAmount(row[__VLS_ctx.csvImportService.mappedColumns.amount]) ||
                    0),
            }, ...__VLS_functionalComponentArgsRest(__VLS_65));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[150px] py-0" },
            });
            if (row.recipientId) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "truncate max-w-[150px]" },
                    title: "\u007b\u007b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0072\u0065\u0063\u0069\u0070\u0069\u0065\u006e\u0074\u0053\u0074\u006f\u0072\u0065\u002e\u0067\u0065\u0074\u0052\u0065\u0063\u0069\u0070\u0069\u0065\u006e\u0074\u0042\u0079\u0049\u0064\u0028\u0072\u006f\u0077\u002e\u0072\u0065\u0063\u0069\u0070\u0069\u0065\u006e\u0074\u0049\u0064\u0029\u003f\u002e\u006e\u0061\u006d\u0065\u0020\u007c\u007c\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0027\u0055\u006e\u0062\u0065\u006b\u0061\u006e\u006e\u0074\u0027\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u007d\u007d",
                });
                (__VLS_ctx.recipientStore.getRecipientById(row.recipientId)?.name ||
                    "Unbekannt");
            }
            else if (__VLS_ctx.csvImportService.mappedColumns.recipient) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "truncate max-w-[150px]" },
                    title: "\u007b\u007b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0072\u006f\u0077\u005b\u0063\u0073\u0076\u0049\u006d\u0070\u006f\u0072\u0074\u0053\u0065\u0072\u0076\u0069\u0063\u0065\u002e\u006d\u0061\u0070\u0070\u0065\u0064\u0043\u006f\u006c\u0075\u006d\u006e\u0073\u002e\u0072\u0065\u0063\u0069\u0070\u0069\u0065\u006e\u0074\u005d\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u007d\u007d",
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-base-content/50" },
                });
                (row[__VLS_ctx.csvImportService.mappedColumns.recipient]);
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-base-content/50" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[150px] py-0" },
            });
            if (row.categoryId) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "truncate max-w-[150px]" },
                    title: "\u007b\u007b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0063\u0061\u0074\u0065\u0067\u006f\u0072\u0079\u0053\u0074\u006f\u0072\u0065\u002e\u0067\u0065\u0074\u0043\u0061\u0074\u0065\u0067\u006f\u0072\u0079\u0042\u0079\u0049\u0064\u0028\u0072\u006f\u0077\u002e\u0063\u0061\u0074\u0065\u0067\u006f\u0072\u0079\u0049\u0064\u0029\u003f\u002e\u006e\u0061\u006d\u0065\u0020\u007c\u007c\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0027\u0055\u006e\u0062\u0065\u006b\u0061\u006e\u006e\u0074\u0027\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u007d\u007d",
                });
                (__VLS_ctx.categoryStore.getCategoryById(row.categoryId)?.name ||
                    "Unbekannt");
            }
            else if (__VLS_ctx.csvImportService.mappedColumns.category) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "truncate max-w-[150px]" },
                    title: "\u007b\u007b\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0072\u006f\u0077\u005b\u0063\u0073\u0076\u0049\u006d\u0070\u006f\u0072\u0074\u0053\u0065\u0072\u0076\u0069\u0063\u0065\u002e\u006d\u0061\u0070\u0070\u0065\u0064\u0043\u006f\u006c\u0075\u006d\u006e\u0073\u002e\u0063\u0061\u0074\u0065\u0067\u006f\u0072\u0079\u005d\u000d\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u007d\u007d",
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "text-base-content/50" },
                });
                (row[__VLS_ctx.csvImportService.mappedColumns.category]);
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-base-content/50" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-auto py-0" },
            });
            if (__VLS_ctx.csvImportService.mappedColumns.notes) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "relative" },
                });
                if (__VLS_ctx.editingNoteIndex !== index) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.isOpen))
                                    return;
                                if (!(__VLS_ctx.showStep3))
                                    return;
                                if (!(__VLS_ctx.csvImportService.mappedColumns.notes))
                                    return;
                                if (!(__VLS_ctx.editingNoteIndex !== index))
                                    return;
                                __VLS_ctx.startEditingNote(index, row[__VLS_ctx.csvImportService.mappedColumns.notes]);
                            } },
                        ...{ class: "cursor-pointer whitespace-pre-wrap min-h-[2rem]" },
                    });
                    (row[__VLS_ctx.csvImportService.mappedColumns.notes]);
                }
                else {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
                        ...{ onKeydown: (__VLS_ctx.handleNoteKeydown) },
                        ...{ onBlur: (__VLS_ctx.saveEditedNote) },
                        id: "note-edit-textarea",
                        ...{ class: "textarea textarea-bordered w-full" },
                        value: (__VLS_ctx.editableNote),
                    });
                }
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-base-content/50" },
                });
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[100px] py-0" },
            });
            /** @type {[typeof TagSearchableDropdown, ]} */ ;
            // @ts-ignore
            const __VLS_68 = __VLS_asFunctionalComponent(TagSearchableDropdown, new TagSearchableDropdown({
                ...{ 'onCreate': {} },
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (__VLS_ctx.transactionTags[index] || []),
                options: (__VLS_ctx.tagStore.tags),
                placeholder: "+",
            }));
            const __VLS_69 = __VLS_68({
                ...{ 'onCreate': {} },
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (__VLS_ctx.transactionTags[index] || []),
                options: (__VLS_ctx.tagStore.tags),
                placeholder: "+",
            }, ...__VLS_functionalComponentArgsRest(__VLS_68));
            let __VLS_71;
            let __VLS_72;
            let __VLS_73;
            const __VLS_74 = {
                onCreate: (__VLS_ctx.createTag)
            };
            const __VLS_75 = {
                'onUpdate:modelValue': ((tags) => __VLS_ctx.updateRowTags(index, tags))
            };
            var __VLS_70;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
                ...{ class: "w-[60px] text-center py-0" },
            });
            if (row._potentialMerge) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "tooltip tooltip-left" },
                    'data-tip': "Ähnliche Buchung bereits vorhanden",
                });
                const __VLS_76 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-warning text-xl" },
                }));
                const __VLS_78 = __VLS_77({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-warning text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_77));
            }
            else if (__VLS_ctx.csvImportService.isRowReadyForImport(row)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                const __VLS_80 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
                    icon: "mdi:check-circle",
                    ...{ class: "text-success text-xl" },
                }));
                const __VLS_82 = __VLS_81({
                    icon: "mdi:check-circle",
                    ...{ class: "text-success text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                const __VLS_84 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-error text-xl" },
                }));
                const __VLS_86 = __VLS_85({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-error text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_85));
            }
        }
        if (__VLS_ctx.csvImportService.importStatus !== 'idle') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "mt-6" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "alert alert-soft" },
                ...{ class: ({
                        'alert-info': __VLS_ctx.csvImportService.importStatus === 'importing',
                        'alert-success': __VLS_ctx.csvImportService.importStatus === 'success',
                        'alert-error': __VLS_ctx.csvImportService.importStatus === 'error',
                    }) },
            });
            if (__VLS_ctx.csvImportService.importStatus === 'importing') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center gap-2" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "loading loading-dots loading-md" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            }
            else if (__VLS_ctx.csvImportService.importStatus === 'success') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center gap-2" },
                });
                const __VLS_88 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
                    icon: "mdi:check-circle",
                    ...{ class: "text-xl" },
                }));
                const __VLS_90 = __VLS_89({
                    icon: "mdi:check-circle",
                    ...{ class: "text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_89));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (__VLS_ctx.csvImportService.importedTransactions.length);
            }
            else if (__VLS_ctx.csvImportService.importStatus === 'error') {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center gap-2" },
                });
                const __VLS_92 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-xl" },
                }));
                const __VLS_94 = __VLS_93({
                    icon: "mdi:alert-circle",
                    ...{ class: "text-xl" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (__VLS_ctx.csvImportService.error);
            }
        }
        if (__VLS_ctx.csvImportService.importStatus === 'success') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "card bg-base-200 p-4 mt-6" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.h5, __VLS_intrinsicElements.h5)({
                ...{ class: "font-medium mb-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "grid grid-cols-2 gap-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "font-semibold" },
            });
            (__VLS_ctx.csvImportService.importedTransactions.length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "font-semibold" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_96 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.csvImportService.importedTransactions.reduce((sum, tx) => sum + tx.amount, 0)),
            }));
            const __VLS_97 = __VLS_96({
                amount: (__VLS_ctx.csvImportService.importedTransactions.reduce((sum, tx) => sum + tx.amount, 0)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_96));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "font-semibold" },
            });
            (__VLS_ctx.csvImportService.importedTransactions.filter((tx) => tx.recipientId).length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "font-semibold" },
            });
            (__VLS_ctx.csvImportService.importedTransactions.filter((tx) => tx.categoryId).length);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "font-semibold" },
            });
            (__VLS_ctx.csvImportService.selectedTags.length > 0 ? "Ja" : "Nein");
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action mt-6" },
    });
    if (__VLS_ctx.activeStep > 1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.prevStep) },
            ...{ class: "btn btn-outline" },
            disabled: (__VLS_ctx.csvImportService.importStatus === 'importing'),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeModal) },
        ...{ class: "btn btn-outline" },
        disabled: (!__VLS_ctx.canCloseModal),
    });
    (__VLS_ctx.csvImportService.importStatus === "success"
        ? "Schließen"
        : "Abbrechen");
    if (__VLS_ctx.showStep1) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.nextStep) },
            ...{ class: "btn btn-primary" },
            disabled: (!__VLS_ctx.step1Valid),
        });
    }
    if (__VLS_ctx.showStep2) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.nextStep) },
            ...{ class: "btn btn-primary" },
            disabled: (!__VLS_ctx.step2Valid),
        });
    }
    if (__VLS_ctx.showStep3 && __VLS_ctx.csvImportService.importStatus !== 'success') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.startImport) },
            ...{ class: "btn btn-primary" },
            disabled: (__VLS_ctx.csvImportService.importStatus === 'importing' ||
                __VLS_ctx.csvImportService.importSummary.ready === 0),
        });
        if (__VLS_ctx.csvImportService.importStatus === 'importing') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "loading loading-dots loading-sm mr-2" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.canCloseModal ? __VLS_ctx.closeModal() : null;
            } },
        ...{ class: "modal-backdrop bg-base-300 opacity-80" },
    });
}
/** @type {[typeof DuplicateManagementModal, ]} */ ;
// @ts-ignore
const __VLS_99 = __VLS_asFunctionalComponent(DuplicateManagementModal, new DuplicateManagementModal({
    ...{ 'onClose': {} },
    ...{ 'onIgnoreDuplicates': {} },
    isOpen: (__VLS_ctx.showDuplicateModal),
    duplicates: (__VLS_ctx.potentialDuplicates),
    mappedColumns: (__VLS_ctx.csvImportService.mappedColumns),
}));
const __VLS_100 = __VLS_99({
    ...{ 'onClose': {} },
    ...{ 'onIgnoreDuplicates': {} },
    isOpen: (__VLS_ctx.showDuplicateModal),
    duplicates: (__VLS_ctx.potentialDuplicates),
    mappedColumns: (__VLS_ctx.csvImportService.mappedColumns),
}, ...__VLS_functionalComponentArgsRest(__VLS_99));
let __VLS_102;
let __VLS_103;
let __VLS_104;
const __VLS_105 = {
    onClose: (__VLS_ctx.closeDuplicateModal)
};
const __VLS_106 = {
    onIgnoreDuplicates: (__VLS_ctx.handleIgnoreDuplicates)
};
var __VLS_101;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-7xl']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[90vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['steps']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-horizontal']} */ ;
/** @type {__VLS_StyleScopedClasses['step']} */ ;
/** @type {__VLS_StyleScopedClasses['step-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['step']} */ ;
/** @type {__VLS_StyleScopedClasses['step-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['step']} */ ;
/** @type {__VLS_StyleScopedClasses['step-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['select-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['select-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['stats']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['stat']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-title']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['stat-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[50vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-55']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-55']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-22']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[2rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[50vh]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['table-fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-55']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-55']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-55']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[2rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[60px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-left']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-md']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-dots']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            SelectCategory: SelectCategory,
            SelectRecipient: SelectRecipient,
            TagSearchableDropdown: TagSearchableDropdown,
            DuplicateManagementModal: DuplicateManagementModal,
            formatDate: formatDate,
            parseAmount: parseAmount,
            Icon: Icon,
            categoryStore: categoryStore,
            recipientStore: recipientStore,
            tagStore: tagStore,
            csvImportService: csvImportService,
            activeStep: activeStep,
            editingNoteIndex: editingNoteIndex,
            editableNote: editableNote,
            transactionTags: transactionTags,
            showDuplicateModal: showDuplicateModal,
            potentialDuplicates: potentialDuplicates,
            canCloseModal: canCloseModal,
            step1Valid: step1Valid,
            step2Valid: step2Valid,
            showStep1: showStep1,
            showStep2: showStep2,
            showStep3: showStep3,
            handleFileUpload: handleFileUpload,
            openDuplicateModal: openDuplicateModal,
            closeDuplicateModal: closeDuplicateModal,
            handleIgnoreDuplicates: handleIgnoreDuplicates,
            nextStep: nextStep,
            prevStep: prevStep,
            startEditingNote: startEditingNote,
            saveEditedNote: saveEditedNote,
            handleNoteKeydown: handleNoteKeydown,
            createRecipient: createRecipient,
            createCategory: createCategory,
            createTag: createTag,
            updateRowTags: updateRowTags,
            startImport: startImport,
            closeModal: closeModal,
        };
    },
    emits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
