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
const router = useRouter();
const session = useSessionStore();
const webSocketStore = useWebSocketStore();
const tenantStore = useTenantStore();
const newTenantName = ref("");
const showCreate = ref(false);
const newTenantNameInput = ref(null);
const tenantListItems = ref([]);
const focusedTenantIndex = ref(-1);
const showDeleteModal = ref(false);
const deleteTargetId = ref(null);
// SQLite Import-Funktionalität
const selectedSqliteFile = ref(null);
const sqliteImportTenantName = ref("");
const showSqliteImport = ref(false);
const isSqliteImporting = ref(false);
const sqliteImportSuccess = ref(false);
const sqliteImportError = ref(null);
const tenants = computed(() => TenantService.getOwnTenants()); // Expliziter Typ für computed
const isButtonEnabled = computed(() => BackendAvailabilityService.isButtonEnabled.value);
const globalKeyDownHandler = (event) => {
    if (event.key === "Enter" &&
        tenants.value.length === 0 &&
        !showCreate.value) {
        event.preventDefault();
        showCreate.value = true;
    }
};
onMounted(() => {
    if (typeof BackendAvailabilityService.startPeriodicChecks === "function") {
        BackendAvailabilityService.startPeriodicChecks();
    }
    else {
        warnLog("[TenantSelectView]", "BackendAvailabilityService.startPeriodicChecks is not a function.");
    }
    window.addEventListener("keydown", handleTenantListKeyDown);
    if (tenants.value.length > 0) {
        focusedTenantIndex.value = 0;
        focusTenantItem(0);
    }
    else {
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
watch(tenants, (newTenants) => {
    tenantListItems.value = [];
    if (newTenants.length > 0 &&
        (focusedTenantIndex.value === -1 || !newTenants[focusedTenantIndex.value])) {
        focusedTenantIndex.value = 0;
        nextTick(() => focusTenantItem(0));
    }
    else if (newTenants.length === 0) {
        focusedTenantIndex.value = -1;
    }
    if (newTenants.length === 0) {
        window.removeEventListener("keydown", globalKeyDownHandler);
        window.addEventListener("keydown", globalKeyDownHandler);
    }
    else {
        window.removeEventListener("keydown", globalKeyDownHandler);
    }
}, { deep: true });
function focusTenantItem(index) {
    nextTick(() => {
        if (tenantListItems.value && tenantListItems.value[index]) {
            tenantListItems.value[index]?.focus();
        }
    });
}
function handleTenantListKeyDown(event) {
    if (showCreate.value || tenants.value.length === 0)
        return;
    switch (event.key) {
        case "ArrowDown":
            event.preventDefault();
            if (focusedTenantIndex.value < tenants.value.length - 1) {
                focusedTenantIndex.value++;
            }
            else {
                focusedTenantIndex.value = 0;
            }
            focusTenantItem(focusedTenantIndex.value);
            break;
        case "ArrowUp":
            event.preventDefault();
            if (focusedTenantIndex.value > 0) {
                focusedTenantIndex.value--;
            }
            else {
                focusedTenantIndex.value = tenants.value.length - 1;
            }
            focusTenantItem(focusedTenantIndex.value);
            break;
        case "Enter":
            event.preventDefault();
            if (focusedTenantIndex.value !== -1 &&
                tenants.value[focusedTenantIndex.value]) {
                selectTenant(tenants.value[focusedTenantIndex.value].uuid);
            }
            break;
    }
}
async function selectTenant(id) {
    debugLog("[TenantSelectView] selectTenant", `Tenant ID: ${id}`);
    const success = await TenantService.switchTenant(id);
    if (success) {
        router.push("/");
    }
    else {
        errorLog("[TenantSelectView]", `Fehler beim Mandantenwechsel zu ${id}`);
    }
}
async function createTenant() {
    if (!newTenantName.value.trim())
        return;
    try {
        const newTenant = (await TenantService.createTenant(newTenantName.value));
        debugLog("[TenantSelectView] tenant created", `New Tenant ID: ${newTenant.uuid}`);
        newTenantName.value = ""; // Reset name after getting its value
        showCreate.value = false;
        await nextTick();
        if (tenants.value.length === 1 &&
            tenants.value[0].uuid === newTenant.uuid) {
            selectTenant(newTenant.uuid);
        }
        else {
            const newTenantInList = tenants.value.find((t) => t.uuid === newTenant.uuid);
            if (newTenantInList) {
                const index = tenants.value.indexOf(newTenantInList);
                if (index !== -1) {
                    focusedTenantIndex.value = index;
                    focusTenantItem(index);
                }
            }
        }
    }
    catch (err) {
        errorLog("[TenantSelectView] createTenant error", String(err));
    }
}
function confirmDeleteTenant(tenantId) {
    deleteTargetId.value = tenantId;
    showDeleteModal.value = true;
}
async function deleteTenant() {
    if (deleteTargetId.value) {
        try {
            await TenantService.deleteTenantCompletely(deleteTargetId.value);
            debugLog("[TenantSelectView] deleteTenantCompletely", `Deleted Tenant ID: ${deleteTargetId.value}`);
            if (tenants.value.length > 0) {
                focusedTenantIndex.value = Math.max(0, focusedTenantIndex.value - 1);
                focusTenantItem(focusedTenantIndex.value);
            }
            else {
                focusedTenantIndex.value = -1;
                window.addEventListener("keydown", globalKeyDownHandler);
            }
        }
        catch (err) {
            errorLog("[TenantSelectView] deleteTenantCompletely error", String(err));
        }
    }
    showDeleteModal.value = false;
    deleteTargetId.value = null;
}
// SQLite Import Handler
function handleSqliteFileSelect(event) {
    const target = event.target;
    const file = target.files?.[0];
    if (file) {
        selectedSqliteFile.value = file;
        sqliteImportError.value = null;
        debugLog("[TenantSelectView]", `SQLite-Datei ausgewählt: ${file.name}`);
    }
}
function resetSqliteImportForm() {
    const fileInput = document.querySelector('input[type="file"][accept=".sqlite,.db"]');
    if (fileInput) {
        fileInput.value = "";
    }
    selectedSqliteFile.value = null;
    sqliteImportTenantName.value = "";
    sqliteImportError.value = null;
    showSqliteImport.value = false;
}
async function handleSqliteImport() {
    if (!selectedSqliteFile.value ||
        !sqliteImportTenantName.value.trim() ||
        isSqliteImporting.value)
        return;
    try {
        isSqliteImporting.value = true;
        sqliteImportError.value = null;
        debugLog("[TenantSelectView]", `Starte SQLite-Import für neuen Mandanten: ${sqliteImportTenantName.value}`);
        await DataImportExportService.importTenantDatabase(selectedSqliteFile.value, sqliteImportTenantName.value.trim());
        sqliteImportSuccess.value = true;
        infoLog("[TenantSelectView]", `SQLite-Import erfolgreich abgeschlossen für Mandant: ${sqliteImportTenantName.value}. User wird automatisch abgemeldet.`);
        // Formular vollständig zurücksetzen
        resetSqliteImportForm();
        // Nach erfolgreichem Import automatisch abmelden
        setTimeout(async () => {
            await logoutAndRedirect();
        }, 2000); // 2 Sekunden warten, damit der User die Erfolgsmeldung sehen kann
    }
    catch (error) {
        sqliteImportError.value =
            error instanceof Error ? error.message : "Unbekannter Fehler beim Import";
        errorLog("[TenantSelectView]", "Fehler beim SQLite-Import", error);
    }
    finally {
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
        infoLog("[TenantSelectView]", "Calling session.logout() to clear session data.");
        await session.logout(); // Korrekte Logout-Funktion aus sessionStore verwenden
        infoLog("[TenantSelectView]", "session.logout() completed.");
    }
    catch (e) {
        errorLog("[TenantSelectView]", "Error during logout process", String(e));
        // Auch bei Fehlern versuchen, die Session manuell zu bereinigen
        session.currentTenantId = null;
        session.currentUserId = null;
        localStorage.removeItem("finwise_session"); // Ggf. anpassen, falls der Key anders ist
        localStorage.removeItem("finwise_activeTenantId");
        warnLog("[TenantSelectView]", "Performed manual session cleanup due to error during logout.");
    }
    finally {
        // 3. Sicherstellen, dass alle relevanten Session-Daten im Store genullt sind
        // (session.logout() sollte das bereits erledigt haben, aber zur Sicherheit)
        session.currentTenantId = null;
        session.currentUserId = null;
        // 'isAuthenticated' existiert nicht direkt, wird durch currentUserId bestimmt
        debugLog("[TenantSelectView]", "Session state after logout attempt", JSON.stringify(session.$state));
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
        if (router.currentRoute.value.path !== "/login" &&
            router.currentRoute.value.path !== "/tenant-select") {
            // router.push("/"); // Temporär auskommentiert, um mögliche Endlosschleifen zu vermeiden, falls die Logik hier unerwünscht ist.
            debugLog("[TenantSelectView] nextTick", "Condition for redirect to / met, but redirect is currently disabled for review.", {
                currentPath: router.currentRoute.value.path,
                currentTenantId: session.currentTenantId,
            });
        }
    }
});
onUnmounted(() => {
    window.removeEventListener("keydown", handleTenantListKeyDown);
    window.removeEventListener("keydown", globalKeyDownHandler);
    // Da stopPeriodicChecks nicht existiert im BackendAvailabilityService, entfernen wir den Aufruf.
    // Eine korrekte Implementierung von stopPeriodicChecks wäre für die Zukunft sinnvoll.
    debugLog("[TenantSelectView]", "onUnmounted: BackendAvailabilityService.stopPeriodicChecks call removed as it does not exist.");
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-center min-h-screen py-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card w-full max-w-md bg-base-100 border border-base-300 shadow" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body space-y-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold text-center" },
});
if (__VLS_ctx.tenants.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-2" },
    });
    for (const [t, index] of __VLS_getVForSourceType((__VLS_ctx.tenants))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tenants.length))
                        return;
                    __VLS_ctx.selectTenant(t.uuid);
                } },
            ...{ onFocus: (...[$event]) => {
                    if (!(__VLS_ctx.tenants.length))
                        return;
                    __VLS_ctx.focusedTenantIndex = index;
                } },
            ...{ onKeydown: (...[$event]) => {
                    if (!(__VLS_ctx.tenants.length))
                        return;
                    __VLS_ctx.selectTenant(t.uuid);
                } },
            ...{ onKeydown: (...[$event]) => {
                    if (!(__VLS_ctx.tenants.length))
                        return;
                    __VLS_ctx.selectTenant(t.uuid);
                } },
            key: (t.uuid),
            ref: (el => { if (el)
                __VLS_ctx.tenantListItems[index] = el; }),
            tabindex: "0",
            ...{ class: "flex items-center justify-between px-3 py-1 rounded-box hover:bg-base-200 border border-base-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100" },
            ...{ class: ({
                    'ring-2 ring-primary ring-offset-2 ring-offset-base-100': index === __VLS_ctx.focusedTenantIndex,
                }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "flex-1 text-left" },
        });
        (t.tenantName);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tenants.length))
                        return;
                    if (__VLS_ctx.isButtonEnabled) {
                        __VLS_ctx.confirmDeleteTenant(t.uuid);
                    }
                    else {
                        __VLS_ctx.debugLog('[TenantSelectView] Trash-Button disabled - Backend offline', JSON.stringify({
                            tenantId: t.uuid,
                            isBackendOnline: __VLS_ctx.BackendAvailabilityService.isOnline.value,
                            isCheckingBackend: __VLS_ctx.BackendAvailabilityService.isChecking.value,
                        }));
                    }
                    ;
                } },
            ...{ class: "btn btn-ghost btn-sm" },
            ...{ class: (__VLS_ctx.isButtonEnabled ? 'text-error' : 'text-error opacity-50') },
            disabled: (!__VLS_ctx.isButtonEnabled),
            title: (__VLS_ctx.BackendAvailabilityService.getTooltipText('Mandant löschen')),
        });
        const __VLS_0 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            icon: (__VLS_ctx.isButtonEnabled ? 'mdi:trash-can' : 'mdi:trash-can-outline'),
            ...{ class: "text-base" },
        }));
        const __VLS_2 = __VLS_1({
            icon: (__VLS_ctx.isButtonEnabled ? 'mdi:trash-can' : 'mdi:trash-can-outline'),
            ...{ class: "text-base" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    }
}
else if (!__VLS_ctx.showCreate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-center opacity-70" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCreate = !__VLS_ctx.showCreate;
        } },
    ...{ class: "btn btn-primary w-full" },
});
(__VLS_ctx.showCreate ? "Abbrechen" : "Neuen Mandanten anlegen");
if (__VLS_ctx.showCreate) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onKeyup: (__VLS_ctx.createTenant) },
        ref: "newTenantNameInput",
        value: (__VLS_ctx.newTenantName),
        type: "text",
        placeholder: "Name des Mandanten",
        ...{ class: "input input-bordered w-full" },
        autocomplete: "off",
    });
    /** @type {typeof __VLS_ctx.newTenantNameInput} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.createTenant) },
        ...{ class: "btn btn-secondary w-full" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "divider" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showSqliteImport = !__VLS_ctx.showSqliteImport;
        } },
    ...{ class: "btn btn-outline w-full" },
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
(__VLS_ctx.showSqliteImport
    ? "Import abbrechen"
    : "SQLite-Datenbank importieren");
if (__VLS_ctx.showSqliteImport) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-3 p-4 border border-base-300 rounded-lg bg-base-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alert alert-info alert-soft" },
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:information",
        ...{ class: "text-lg" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:information",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
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
        ...{ class: "file-input file-input-bordered file-input-sm w-full" },
        disabled: (__VLS_ctx.isSqliteImporting),
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
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "text",
        value: (__VLS_ctx.sqliteImportTenantName),
        placeholder: "Name für den neuen Mandanten...",
        ...{ class: "input input-bordered input-sm w-full" },
        disabled: (__VLS_ctx.isSqliteImporting),
        autocomplete: "off",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleSqliteImport) },
        ...{ class: "btn btn-primary btn-sm w-full" },
        disabled: (!__VLS_ctx.selectedSqliteFile ||
            !__VLS_ctx.sqliteImportTenantName.trim() ||
            __VLS_ctx.isSqliteImporting ||
            !__VLS_ctx.isButtonEnabled),
        title: (!__VLS_ctx.isButtonEnabled
            ? __VLS_ctx.BackendAvailabilityService.getTooltipText('SQLite-Import')
            : ''),
    });
    if (!__VLS_ctx.isSqliteImporting) {
        const __VLS_12 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            icon: "mdi:database-import",
            ...{ class: "mr-2" },
        }));
        const __VLS_14 = __VLS_13({
            icon: "mdi:database-import",
            ...{ class: "mr-2" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    else {
        const __VLS_16 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }));
        const __VLS_18 = __VLS_17({
            icon: "mdi:loading",
            ...{ class: "mr-2 animate-spin" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    (__VLS_ctx.isSqliteImporting ? "Importiere..." : "Mandanten importieren");
    if (__VLS_ctx.sqliteImportSuccess) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-success alert-soft" },
        });
        const __VLS_20 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_22 = __VLS_21({
            icon: "mdi:check-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    }
    if (__VLS_ctx.sqliteImportError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-error alert-soft" },
        });
        const __VLS_24 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_26 = __VLS_25({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_25));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-sm" },
        });
        (__VLS_ctx.sqliteImportError);
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-center text-sm opacity-70 mt-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (__VLS_ctx.logoutAndRedirect) },
    href: "#",
    ...{ class: "link link-primary" },
});
if (__VLS_ctx.showDeleteModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_28 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Mandant löschen",
        message: "Möchtest Du diesen Mandanten wirklich vollständig löschen? Alle Daten gehen verloren!",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_29 = __VLS_28({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Mandant löschen",
        message: "Möchtest Du diesen Mandanten wirklich vollständig löschen? Alle Daten gehen verloren!",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_28));
    let __VLS_31;
    let __VLS_32;
    let __VLS_33;
    const __VLS_34 = {
        onConfirm: (__VLS_ctx.deleteTenant)
    };
    const __VLS_35 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showDeleteModal))
                return;
            __VLS_ctx.showDeleteModal = false;
        }
    };
    var __VLS_30;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-offset-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-offset-2']} */ ;
/** @type {__VLS_StyleScopedClasses['ring-offset-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-success']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['link']} */ ;
/** @type {__VLS_StyleScopedClasses['link-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BackendAvailabilityService: BackendAvailabilityService,
            debugLog: debugLog,
            ConfirmationModal: ConfirmationModal,
            Icon: Icon,
            newTenantName: newTenantName,
            showCreate: showCreate,
            newTenantNameInput: newTenantNameInput,
            tenantListItems: tenantListItems,
            focusedTenantIndex: focusedTenantIndex,
            showDeleteModal: showDeleteModal,
            selectedSqliteFile: selectedSqliteFile,
            sqliteImportTenantName: sqliteImportTenantName,
            showSqliteImport: showSqliteImport,
            isSqliteImporting: isSqliteImporting,
            sqliteImportSuccess: sqliteImportSuccess,
            sqliteImportError: sqliteImportError,
            tenants: tenants,
            isButtonEnabled: isButtonEnabled,
            selectTenant: selectTenant,
            createTenant: createTenant,
            confirmDeleteTenant: confirmDeleteTenant,
            deleteTenant: deleteTenant,
            handleSqliteFileSelect: handleSqliteFileSelect,
            handleSqliteImport: handleSqliteImport,
            logoutAndRedirect: logoutAndRedirect,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
