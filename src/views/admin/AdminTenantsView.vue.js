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
import { debugLog, errorLog } from "@/utils/logger";
const router = useRouter();
const session = useSessionStore();
const tenantStore = useTenantStore();
const webSocketStore = useWebSocketStore();
const showModal = ref(false);
const isEditMode = ref(false);
const selectedTenant = ref(null);
const nameInput = ref("");
const searchQuery = ref("");
const showDeleteModal = ref(false);
const deleteTargetId = ref(null);
// Neue State-Variablen für erweiterte Funktionen
const showResetDbModal = ref(false);
const showClearQueueModal = ref(false);
const resetDbTargetId = ref(null);
const clearQueueTargetId = ref(null);
const currentPage = ref(1);
const itemsPerPage = ref(25);
// Typisierte Handler-Funktion für SearchGroup (verhindert implicit any)
function handleSearchInput(q) {
    searchQuery.value = q;
}
// Backend-Status beim Mount prüfen
onMounted(() => {
    BackendAvailabilityService.startPeriodicChecks();
});
/* --------------------------------------------- Helper & Computed */
const ownTenants = computed(() => TenantService.getOwnTenants());
const filteredTenants = computed(() => {
    if (!searchQuery.value.trim())
        return ownTenants.value;
    const q = searchQuery.value.toLowerCase();
    return ownTenants.value.filter((t) => t.tenantName.toLowerCase().includes(q));
});
const totalPages = computed(() => itemsPerPage.value === "all"
    ? 1
    : Math.ceil(filteredTenants.value.length / Number(itemsPerPage.value)));
const paginated = computed(() => {
    if (itemsPerPage.value === "all")
        return filteredTenants.value;
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
function openEdit(t) {
    selectedTenant.value = t;
    nameInput.value = t.tenantName;
    isEditMode.value = true;
    showModal.value = true;
}
async function saveTenant() {
    if (!nameInput.value.trim())
        return;
    try {
        if (isEditMode.value && selectedTenant.value) {
            const success = await TenantService.renameTenant(selectedTenant.value.uuid, nameInput.value.trim());
            debugLog("[AdminTenantsView] renameTenant", {
                id: selectedTenant.value.uuid,
                name: nameInput.value.trim(),
                success,
            });
            if (!success) {
                errorLog("[AdminTenantsView]", "Fehler beim Umbenennen des Mandanten");
                return;
            }
        }
        else {
            const t = await TenantService.createTenant(nameInput.value.trim());
            debugLog("[AdminTenantsView] createTenant", { id: t.uuid });
        }
        showModal.value = false;
        selectedTenant.value = null;
        nameInput.value = "";
    }
    catch (error) {
        errorLog("[AdminTenantsView]", "Fehler beim Speichern des Mandanten", error);
    }
}
function confirmDelete(id) {
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
                debugLog("[AdminTenantsView] Aktiver Mandant gelöscht, navigiere zu TenantSelectView");
                // Mandant aus Session entfernen (ohne User-Logout)
                session.currentTenantId = null;
                router.push("/tenant-select");
            }
        }
        catch (error) {
            debugLog("[AdminTenantsView] deleteTenantCompletely error", error);
        }
    }
    showDeleteModal.value = false;
    deleteTargetId.value = null;
}
// Neue Funktionen für erweiterte Mandanten-Verwaltung
function confirmResetDatabase(tenantId) {
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
            const tenant = TenantService.getOwnTenants().find((t) => t.uuid === resetDbTargetId.value);
            const tenantName = tenant?.tenantName || "Unbekannt";
            debugLog("[AdminTenantsView] Lösche Mandant und lege neuen mit gleichem Namen an", {
                tenantId: resetDbTargetId.value,
                tenantName,
                isActiveTenant,
            });
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
        }
        catch (error) {
            debugLog("[AdminTenantsView] resetDatabase error", error);
        }
    }
    else {
        debugLog("[AdminTenantsView] resetDatabase: Keine resetDbTargetId gesetzt");
    }
    showResetDbModal.value = false;
    resetDbTargetId.value = null;
}
function confirmClearSyncQueue(tenantId) {
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
        }
        catch (error) {
            debugLog("[AdminTenantsView] clearSyncQueue error", error);
        }
    }
    showClearQueueModal.value = false;
    clearQueueTargetId.value = null;
}
function lokalDate(iso) {
    return new Date(iso).toLocaleString("de-DE");
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "max-w-5xl mx-auto flex flex-col min-h-screen py-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-wrap md:flex-nowrap justify-between items-center mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnRightClick': {} },
    btnRight: "Neu",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnRightClick': {} },
    btnRight: "Neu",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: (__VLS_ctx.handleSearchInput)
};
const __VLS_7 = {
    onBtnRightClick: (__VLS_ctx.openCreate)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card w-full bg-base-100 border border-base-300 shadow-md" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "hidden sm:table-cell" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "hidden sm:table-cell" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.paginated))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (t.uuid),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (t.tenantName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "hidden sm:table-cell" },
    });
    (__VLS_ctx.lokalDate(t.createdAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "hidden sm:table-cell" },
    });
    (__VLS_ctx.lokalDate(t.updatedAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openEdit(t);
            } },
        ...{ class: "btn btn-ghost btn-sm text-secondary" },
        title: "Mandant bearbeiten",
    });
    const __VLS_8 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_10 = __VLS_9({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    if (t.uuid === __VLS_ctx.session.currentTenantId) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(t.uuid === __VLS_ctx.session.currentTenantId))
                        return;
                    __VLS_ctx.isButtonEnabled
                        ? __VLS_ctx.confirmResetDatabase(t.uuid)
                        : __VLS_ctx.debugLog('[AdminTenantsView] DB-Reset disabled - Backend offline', {
                            tenantId: t.uuid,
                            isBackendAvailable: __VLS_ctx.isBackendAvailable,
                        });
                } },
            ...{ class: "btn btn-ghost btn-sm" },
            ...{ class: (__VLS_ctx.isButtonEnabled
                    ? 'text-warning'
                    : 'text-warning opacity-50') },
            disabled: (!__VLS_ctx.isButtonEnabled),
            title: (__VLS_ctx.isButtonEnabled
                ? 'Datenbank zurücksetzen'
                : 'Backend offline - Datenbank-Reset nicht verfügbar'),
        });
        const __VLS_12 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            icon: "mdi:database-refresh",
            ...{ class: "text-base" },
        }));
        const __VLS_14 = __VLS_13({
            icon: "mdi:database-refresh",
            ...{ class: "text-base" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.isButtonEnabled
                    ? __VLS_ctx.confirmClearSyncQueue(t.uuid)
                    : __VLS_ctx.debugLog('[AdminTenantsView] SyncQueue-Clear disabled - Backend offline', { tenantId: t.uuid });
            } },
        ...{ class: "btn btn-ghost btn-sm" },
        ...{ class: (__VLS_ctx.isButtonEnabled ? 'text-info' : 'text-info opacity-50') },
        disabled: (!__VLS_ctx.isButtonEnabled),
        title: (__VLS_ctx.isButtonEnabled
            ? 'SyncQueue löschen'
            : 'Backend offline - SyncQueue-Clear nicht verfügbar'),
    });
    const __VLS_16 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        icon: "mdi:delete-sweep",
        ...{ class: "text-base" },
    }));
    const __VLS_18 = __VLS_17({
        icon: "mdi:delete-sweep",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (__VLS_ctx.isButtonEnabled) {
                    __VLS_ctx.debugLog('[AdminTenantsView] Trash-Button geklickt', {
                        tenantId: t.uuid,
                        isBackendAvailable: __VLS_ctx.isBackendAvailable,
                    });
                    __VLS_ctx.confirmDelete(t.uuid);
                }
                else {
                    __VLS_ctx.debugLog('[AdminTenantsView] Trash-Button disabled - Backend offline', {
                        tenantId: t.uuid,
                        isBackendAvailable: __VLS_ctx.isBackendAvailable,
                        connectionStatus: __VLS_ctx.webSocketStore.connectionStatus,
                        backendStatus: __VLS_ctx.webSocketStore.backendStatus,
                    });
                }
                ;
            } },
        ...{ class: "btn btn-ghost btn-sm" },
        ...{ class: (__VLS_ctx.isButtonEnabled ? 'text-error' : 'text-error opacity-50') },
        disabled: (!__VLS_ctx.isButtonEnabled),
        title: (__VLS_ctx.isButtonEnabled
            ? 'Mandant vollständig löschen'
            : 'Backend offline - Löschen nicht verfügbar'),
    });
    const __VLS_20 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        icon: (__VLS_ctx.isButtonEnabled
            ? 'mdi:trash-can'
            : 'mdi:trash-can-outline'),
        ...{ class: "text-base" },
    }));
    const __VLS_22 = __VLS_21({
        icon: (__VLS_ctx.isButtonEnabled
            ? 'mdi:trash-can'
            : 'mdi:trash-can-outline'),
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
/** @type {[typeof PagingComponent, ]} */ ;
// @ts-ignore
const __VLS_24 = __VLS_asFunctionalComponent(PagingComponent, new PagingComponent({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}));
const __VLS_25 = __VLS_24({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}, ...__VLS_functionalComponentArgsRest(__VLS_24));
let __VLS_27;
let __VLS_28;
let __VLS_29;
const __VLS_30 = {
    'onUpdate:currentPage': ((val) => (__VLS_ctx.currentPage = val))
};
const __VLS_31 = {
    'onUpdate:itemsPerPage': ((val) => (__VLS_ctx.itemsPerPage = val))
};
var __VLS_26;
if (__VLS_ctx.showModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.isEditMode ? "Mandant bearbeiten" : "Neuer Mandant");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.nameInput),
        type: "text",
        placeholder: "Name des Mandanten",
        ...{ class: "input input-bordered w-full mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
            } },
        ...{ class: "btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.saveTenant) },
        ...{ class: "btn btn-primary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showDeleteModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Mandant löschen",
        message: "Möchtest Du diesen Mandanten wirklich vollständig löschen? Alle Daten gehen verloren!",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_33 = __VLS_32({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Mandant löschen",
        message: "Möchtest Du diesen Mandanten wirklich vollständig löschen? Alle Daten gehen verloren!",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    let __VLS_35;
    let __VLS_36;
    let __VLS_37;
    const __VLS_38 = {
        onConfirm: (__VLS_ctx.deleteTenant)
    };
    const __VLS_39 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showDeleteModal))
                return;
            __VLS_ctx.showDeleteModal = false;
        }
    };
    var __VLS_34;
}
if (__VLS_ctx.showResetDbModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_40 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Datenbank zurücksetzen",
        message: "Möchtest Du die Datenbank dieses Mandanten wirklich zurücksetzen? Alle lokalen Daten werden gelöscht!",
        confirmText: "Zurücksetzen",
        cancelText: "Abbrechen",
    }));
    const __VLS_41 = __VLS_40({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Datenbank zurücksetzen",
        message: "Möchtest Du die Datenbank dieses Mandanten wirklich zurücksetzen? Alle lokalen Daten werden gelöscht!",
        confirmText: "Zurücksetzen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_40));
    let __VLS_43;
    let __VLS_44;
    let __VLS_45;
    const __VLS_46 = {
        onConfirm: (__VLS_ctx.resetDatabase)
    };
    const __VLS_47 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showResetDbModal))
                return;
            __VLS_ctx.showResetDbModal = false;
        }
    };
    var __VLS_42;
}
if (__VLS_ctx.showClearQueueModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_48 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "SyncQueue löschen",
        message: "Möchtest Du die SyncQueue dieses Mandanten wirklich löschen? Ausstehende Synchronisationen gehen verloren!",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_49 = __VLS_48({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "SyncQueue löschen",
        message: "Möchtest Du die SyncQueue dieses Mandanten wirklich löschen? Ausstehende Synchronisationen gehen verloren!",
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    let __VLS_51;
    let __VLS_52;
    let __VLS_53;
    const __VLS_54 = {
        onConfirm: (__VLS_ctx.clearSyncQueue)
    };
    const __VLS_55 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showClearQueueModal))
                return;
            __VLS_ctx.showClearQueueModal = false;
        }
    };
    var __VLS_50;
}
/** @type {__VLS_StyleScopedClasses['max-w-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:table-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            SearchGroup: SearchGroup,
            PagingComponent: PagingComponent,
            ConfirmationModal: ConfirmationModal,
            Icon: Icon,
            debugLog: debugLog,
            session: session,
            webSocketStore: webSocketStore,
            showModal: showModal,
            isEditMode: isEditMode,
            nameInput: nameInput,
            showDeleteModal: showDeleteModal,
            showResetDbModal: showResetDbModal,
            showClearQueueModal: showClearQueueModal,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            handleSearchInput: handleSearchInput,
            totalPages: totalPages,
            paginated: paginated,
            isButtonEnabled: isButtonEnabled,
            isBackendAvailable: isBackendAvailable,
            openCreate: openCreate,
            openEdit: openEdit,
            saveTenant: saveTenant,
            confirmDelete: confirmDelete,
            deleteTenant: deleteTenant,
            confirmResetDatabase: confirmResetDatabase,
            resetDatabase: resetDatabase,
            confirmClearSyncQueue: confirmClearSyncQueue,
            clearSyncQueue: clearSyncQueue,
            lokalDate: lokalDate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
