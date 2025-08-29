import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useWebSocketStore } from "@/stores/webSocketStore";
import { LogLevel } from "@/utils/logger";
import { debugLog, infoLog, errorLog } from "@/utils/logger";
import { DataImportExportService, } from "@/services/DataImportExportService";
/**
 * Pfad zur Komponente: src/views/SettingsView.vue
 * Einstellungen der Anwendung.
 */
// State
const activeTab = ref("general");
// Router und Stores
const router = useRouter();
const settingsStore = useSettingsStore();
const session = useSessionStore();
const webSocketStore = useWebSocketStore();
const logLevel = computed({
    get: () => settingsStore.logLevel,
    set: (value) => {
        debugLog("[settings]", "LogLevel wird geändert", {
            oldValue: settingsStore.logLevel,
            newValue: value,
        });
        settingsStore.logLevel = value;
        // Explizit speichern nach Änderung
        settingsStore.saveToStorage().catch((error) => {
            errorLog("[settings]", "Fehler beim Speichern nach LogLevel-Änderung", error);
        });
    },
});
// Export-Funktionalität
const selectedExportType = ref("rules");
const isExporting = ref(false);
const exportSuccess = ref(false);
const availableExportTypes = DataImportExportService.getAvailableDataTypes();
// Import-Funktionalität
const selectedImportFile = ref(null);
const showImportModal = ref(false);
const selectedImportMode = ref("merge");
const isImporting = ref(false);
const importSuccess = ref(false);
const importError = ref(null);
// SQLite Export-Funktionalität
const isSqliteExporting = ref(false);
const sqliteExportSuccess = ref(false);
const sqliteExportError = ref(null);
// SQLite Import-Funktionalität
const selectedSqliteFile = ref(null);
const newTenantName = ref("");
const isSqliteImporting = ref(false);
const sqliteImportSuccess = ref(false);
const sqliteImportError = ref(null);
async function handleExport() {
    if (isExporting.value)
        return;
    try {
        isExporting.value = true;
        debugLog("[settings]", `Starte Export für Typ: ${selectedExportType.value}`);
        await DataImportExportService.exportDataAsJSON(selectedExportType.value);
        exportSuccess.value = true;
        infoLog("[settings]", `Export für ${selectedExportType.value} erfolgreich abgeschlossen`);
        setTimeout(() => {
            exportSuccess.value = false;
        }, 5000);
    }
    catch (error) {
        errorLog("[settings]", `Fehler beim Export für ${selectedExportType.value}`, error);
    }
    finally {
        isExporting.value = false;
    }
}
// Import-Funktionen
function handleFileSelect(event) {
    const target = event.target;
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
    if (!selectedImportFile.value || isImporting.value)
        return;
    try {
        isImporting.value = true;
        importError.value = null;
        debugLog("[settings]", `Starte Import im ${selectedImportMode.value}-Modus für Datei: ${selectedImportFile.value.name}`);
        await DataImportExportService.importDataFromJSON(selectedImportFile.value, selectedImportMode.value);
        importSuccess.value = true;
        showImportModal.value = false;
        infoLog("[settings]", `Import erfolgreich abgeschlossen im ${selectedImportMode.value}-Modus`);
        setTimeout(() => {
            importSuccess.value = false;
        }, 5000);
        // Dateiauswahl zurücksetzen
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.value = "";
        }
        selectedImportFile.value = null;
    }
    catch (error) {
        importError.value =
            error instanceof Error ? error.message : "Unbekannter Fehler beim Import";
        errorLog("[settings]", "Fehler beim Import", error);
    }
    finally {
        isImporting.value = false;
    }
}
// SQLite Export Handler
async function handleSqliteExport() {
    if (isSqliteExporting.value)
        return;
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
    }
    catch (error) {
        sqliteExportError.value =
            error instanceof Error ? error.message : "Unbekannter Fehler beim Export";
        errorLog("[settings]", "Fehler beim SQLite-Datenbank-Export", error);
    }
    finally {
        isSqliteExporting.value = false;
    }
}
// SQLite Import Handler
// Hilfsfunktion zum Zurücksetzen des SQLite-Import-Formulars
function resetSqliteImportForm() {
    const fileInput = document.querySelector('input[type="file"][accept=".sqlite,.db"]');
    if (fileInput) {
        fileInput.value = "";
    }
    selectedSqliteFile.value = null;
    newTenantName.value = "";
    sqliteImportError.value = null;
}
function handleSqliteFileSelect(event) {
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        selectedSqliteFile.value = file;
        sqliteImportError.value = null;
        debugLog("[settings]", `SQLite-Datei ausgewählt: ${file.name}`);
    }
}
async function handleSqliteImport() {
    if (!selectedSqliteFile.value ||
        !newTenantName.value.trim() ||
        isSqliteImporting.value)
        return;
    try {
        isSqliteImporting.value = true;
        sqliteImportError.value = null;
        debugLog("[settings]", `Starte SQLite-Import für neuen Mandanten: ${newTenantName.value}`);
        await DataImportExportService.importTenantDatabase(selectedSqliteFile.value, newTenantName.value.trim());
        sqliteImportSuccess.value = true;
        infoLog("[settings]", `SQLite-Import erfolgreich abgeschlossen für Mandant: ${newTenantName.value}. User wird automatisch abgemeldet.`);
        // Formular vollständig zurücksetzen
        resetSqliteImportForm();
        // Nach erfolgreichem Import automatisch abmelden
        setTimeout(async () => {
            try {
                // WebSocket-Store zurücksetzen
                webSocketStore.reset();
                // User-Session löschen
                await session.logout();
                // Zur Login-Seite weiterleiten
                router.push("/login");
                infoLog("[settings]", "User nach SQLite-Import automatisch abgemeldet und zur Login-Seite weitergeleitet");
            }
            catch (error) {
                errorLog("[settings]", "Fehler beim automatischen Logout nach SQLite-Import", error);
            }
        }, 2000); // 2 Sekunden warten, damit der User die Erfolgsmeldung sehen kann
    }
    catch (error) {
        sqliteImportError.value =
            error instanceof Error ? error.message : "Unbekannter Fehler beim Import";
        errorLog("[settings]", "Fehler beim SQLite-Import", error);
    }
    finally {
        isSqliteImporting.value = false;
    }
}
onMounted(() => {
    debugLog("[settings]", "SettingsView geladen");
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "container mx-auto py-4 sm:py-8 max-w-4xl px-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "text-2xl font-bold mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tabs tabs-boxed mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'general';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'general' }) },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:cog",
    ...{ class: "mr-2" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:cog",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'import-export';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'import-export' }) },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:database-import",
    ...{ class: "mr-2" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:database-import",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
if (__VLS_ctx.activeTab === 'general') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "card-title" },
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
        value: (__VLS_ctx.logLevel),
        ...{ class: "select select-bordered w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (__VLS_ctx.LogLevel.DEBUG),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (__VLS_ctx.LogLevel.INFO),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (__VLS_ctx.LogLevel.WARN),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (__VLS_ctx.LogLevel.ERROR),
    });
}
if (__VLS_ctx.activeTab === 'import-export') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "card-title" },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:database-import",
        ...{ class: "mr-2" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:database-import",
        ...{ class: "mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-base-content/70 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-xl font-semibold mb-4" },
    });
    const __VLS_12 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        icon: "mdi:code-json",
        ...{ class: "mr-2" },
    }));
    const __VLS_14 = __VLS_13({
        icon: "mdi:code-json",
        ...{ class: "mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-base-content/70 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-lg font-medium mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedExportType),
        ...{ class: "select select-bordered w-full" },
        disabled: (__VLS_ctx.isExporting),
        ...{ class: ({ 'select-disabled': __VLS_ctx.isExporting }) },
    });
    for (const [type] of __VLS_getVForSourceType((__VLS_ctx.availableExportTypes))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (type.value),
            value: (type.value),
        });
        (type.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleExport) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.isExporting),
    });
    if (!__VLS_ctx.isExporting) {
        const __VLS_16 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            icon: "mdi:download",
            ...{ class: "mr-2" },
        }));
        const __VLS_18 = __VLS_17({
            icon: "mdi:download",
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    else {
        const __VLS_20 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }));
        const __VLS_22 = __VLS_21({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    (__VLS_ctx.isExporting ? "Exportiere..." : "JSON exportieren");
    if (__VLS_ctx.exportSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-success alert-soft mt-4" },
        });
        const __VLS_24 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_26 = __VLS_25({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-lg font-medium mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/60 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.handleFileSelect) },
        type: "file",
        accept: ".json",
        ...{ class: "file-input file-input-bordered w-full" },
        disabled: (__VLS_ctx.isImporting),
    });
    if (__VLS_ctx.importSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-success alert-soft mt-4" },
        });
        const __VLS_28 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_30 = __VLS_29({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-xl font-semibold mb-4" },
    });
    const __VLS_32 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        icon: "mdi:database",
        ...{ class: "mr-2" },
    }));
    const __VLS_34 = __VLS_33({
        icon: "mdi:database",
        ...{ class: "mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-base-content/70 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-lg font-medium mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/60 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleSqliteExport) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.isSqliteExporting),
    });
    if (!__VLS_ctx.isSqliteExporting) {
        const __VLS_36 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            icon: "mdi:download",
            ...{ class: "mr-2" },
        }));
        const __VLS_38 = __VLS_37({
            icon: "mdi:download",
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    }
    else {
        const __VLS_40 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }));
        const __VLS_42 = __VLS_41({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    (__VLS_ctx.isSqliteExporting
        ? "Exportiere..."
        : "Mandanten-Datenbank exportieren");
    if (__VLS_ctx.sqliteExportSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-success alert-soft mt-4" },
        });
        const __VLS_44 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_46 = __VLS_45({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    }
    if (__VLS_ctx.sqliteExportError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-error alert-soft mt-4" },
        });
        const __VLS_48 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_50 = __VLS_49({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.sqliteExportError);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-lg font-medium mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alert alert-warning alert-soft mb-4" },
    });
    const __VLS_52 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        icon: "mdi:alert",
        ...{ class: "text-lg" },
    }));
    const __VLS_54 = __VLS_53({
        icon: "mdi:alert",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onChange: (__VLS_ctx.handleSqliteFileSelect) },
        type: "file",
        accept: ".sqlite,.db",
        ...{ class: "file-input file-input-bordered w-full" },
        disabled: (__VLS_ctx.isSqliteImporting),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "text",
        value: (__VLS_ctx.newTenantName),
        placeholder: "Name für den neuen Mandanten eingeben...",
        ...{ class: "input input-bordered w-full" },
        disabled: (__VLS_ctx.isSqliteImporting),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleSqliteImport) },
        ...{ class: "btn btn-primary" },
        disabled: (!__VLS_ctx.selectedSqliteFile ||
            !__VLS_ctx.newTenantName.trim() ||
            __VLS_ctx.isSqliteImporting),
    });
    if (!__VLS_ctx.isSqliteImporting) {
        const __VLS_56 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            icon: "mdi:database-import",
            ...{ class: "mr-2" },
        }));
        const __VLS_58 = __VLS_57({
            icon: "mdi:database-import",
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    }
    else {
        const __VLS_60 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_61 = __VLS_asFunctionalComponent(__VLS_60, new __VLS_60({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }));
        const __VLS_62 = __VLS_61({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    }
    (__VLS_ctx.isSqliteImporting ? "Importiere..." : "Mandanten importieren");
    if (__VLS_ctx.sqliteImportSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-success alert-soft mt-4" },
        });
        const __VLS_64 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_66 = __VLS_65({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_65));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    }
    if (__VLS_ctx.sqliteImportError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-error alert-soft mt-4" },
        });
        const __VLS_68 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_70 = __VLS_69({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.sqliteImportError);
    }
}
if (__VLS_ctx.showImportModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-lg" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    const __VLS_72 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent(__VLS_72, new __VLS_72({
        icon: "mdi:import",
        ...{ class: "mr-2" },
    }));
    const __VLS_74 = __VLS_73({
        icon: "mdi:import",
        ...{ class: "mr-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-base-content/70 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.selectedImportFile?.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col w-[95%] mx-auto space-y-4 mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label cursor-pointer p-4 border border-base-300 rounded-lg hover:bg-base-200 transition-colors w-full flex" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 w-45" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center mb-2" },
    });
    const __VLS_76 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
        icon: "mdi:merge",
        ...{ class: "mr-2 text-primary" },
    }));
    const __VLS_78 = __VLS_77({
        icon: "mdi:merge",
        ...{ class: "mr-2 text-primary" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_77));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "text-base" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/70" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "radio",
        name: "importMode",
        value: "merge",
        ...{ class: "radio radio-primary" },
    });
    (__VLS_ctx.selectedImportMode);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label cursor-pointer p-4 border border-base-300 rounded-lg hover:bg-base-200 transition-colors w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 w-45" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center mb-2" },
    });
    const __VLS_80 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        icon: "mdi:database-refresh",
        ...{ class: "mr-2 text-warning" },
    }));
    const __VLS_82 = __VLS_81({
        icon: "mdi:database-refresh",
        ...{ class: "mr-2 text-warning" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({
        ...{ class: "text-base" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/70" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.br)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "radio",
        name: "importMode",
        value: "replace",
        ...{ class: "radio radio-primary" },
    });
    (__VLS_ctx.selectedImportMode);
    if (__VLS_ctx.importError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-error alert-soft mb-4" },
        });
        const __VLS_84 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_85 = __VLS_asFunctionalComponent(__VLS_84, new __VLS_84({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_86 = __VLS_85({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_85));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.importError);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeImportModal) },
        ...{ class: "btn btn-ghost" },
        disabled: (__VLS_ctx.isImporting),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleImport) },
        ...{ class: "btn btn-primary" },
        disabled: (__VLS_ctx.isImporting),
    });
    if (!__VLS_ctx.isImporting) {
        const __VLS_88 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            icon: "mdi:import",
            ...{ class: "mr-2" },
        }));
        const __VLS_90 = __VLS_89({
            icon: "mdi:import",
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    }
    else {
        const __VLS_92 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }));
        const __VLS_94 = __VLS_93({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
    }
    (__VLS_ctx.isImporting ? "Importiere..." : "Importieren");
}
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['select-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[95%]']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-45']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-45']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            LogLevel: LogLevel,
            activeTab: activeTab,
            logLevel: logLevel,
            selectedExportType: selectedExportType,
            isExporting: isExporting,
            exportSuccess: exportSuccess,
            availableExportTypes: availableExportTypes,
            selectedImportFile: selectedImportFile,
            showImportModal: showImportModal,
            selectedImportMode: selectedImportMode,
            isImporting: isImporting,
            importSuccess: importSuccess,
            importError: importError,
            isSqliteExporting: isSqliteExporting,
            sqliteExportSuccess: sqliteExportSuccess,
            sqliteExportError: sqliteExportError,
            selectedSqliteFile: selectedSqliteFile,
            newTenantName: newTenantName,
            isSqliteImporting: isSqliteImporting,
            sqliteImportSuccess: sqliteImportSuccess,
            sqliteImportError: sqliteImportError,
            handleExport: handleExport,
            handleFileSelect: handleFileSelect,
            closeImportModal: closeImportModal,
            handleImport: handleImport,
            handleSqliteExport: handleSqliteExport,
            handleSqliteFileSelect: handleSqliteFileSelect,
            handleSqliteImport: handleSqliteImport,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
