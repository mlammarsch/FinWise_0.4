import { ref, onMounted, computed } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import { ImageService } from "../../services/ImageService"; // Import ImageService
import { useTenantStore } from "../../stores/tenantStore";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["save", "cancel"]);
const accountStore = useAccountStore();
const name = ref("");
const sortOrder = ref(0);
const image = ref(null);
const originalImage = ref(null);
const isUploadingLogo = ref(false);
const uploadMessage = ref(null);
onMounted(() => {
    if (props.group) {
        name.value = props.group.name;
        sortOrder.value = props.group.sortOrder;
        image.value = props.group.logo_path || null;
        originalImage.value = props.group.logo_path || null;
    }
});
// Upload-Logik gemäß Task 3.2: POST /api/v1/logos/upload verwenden
const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
        const tempImageUrl = URL.createObjectURL(file);
        image.value = tempImageUrl;
        isUploadingLogo.value = true;
        uploadMessage.value = null;
        try {
            const accountGroupId = props.group?.id;
            if (!accountGroupId && props.isEdit) {
                uploadMessage.value = {
                    type: "error",
                    text: "Kontogruppen-ID nicht gefunden. Upload nicht möglich.",
                };
                isUploadingLogo.value = false;
                return;
            }
            if (!accountGroupId) {
                uploadMessage.value = {
                    type: "error",
                    text: "Bitte speichern Sie die Kontogruppe zuerst, um ein Logo hochzuladen.",
                };
                isUploadingLogo.value = false;
                return;
            }
            const tenantStore = useTenantStore();
            const tenantId = tenantStore.activeTenantId;
            if (!tenantId) {
                uploadMessage.value = {
                    type: "error",
                    text: "Aktive Mandanten-ID nicht gefunden. Upload nicht möglich.",
                };
                isUploadingLogo.value = false;
                return;
            }
            // Verwende den neuen POST /api/v1/logos/upload Endpunkt
            const response = await ImageService.uploadLogo(accountGroupId, "account_group", file, tenantId);
            if (response && response.logo_path) {
                image.value = response.logo_path;
                uploadMessage.value = {
                    type: "success",
                    text: "Logo erfolgreich hochgeladen.",
                };
                // Nach erfolgreichem Upload: logoPath im Store aktualisieren für Synchronisation
                await accountStore.updateAccountGroupLogo(accountGroupId, response.logo_path);
            }
            else {
                uploadMessage.value = {
                    type: "error",
                    text: "Das Logo konnte nicht hochgeladen werden. Bitte versuchen Sie es später erneut.",
                };
                if (originalImage.value)
                    image.value = originalImage.value;
                else
                    image.value = null;
            }
        }
        catch (error) {
            console.error("Error uploading logo in component:", error);
            let specificMessage = "Fehler beim Hochladen des Logos.";
            if (error.status === 415) {
                specificMessage =
                    "Ungültiges Dateiformat. Bitte JPG oder PNG verwenden.";
            }
            else if (error.status === 413) {
                specificMessage = "Die Datei ist zu groß.";
            }
            else if (error.message && error.message.includes("NetworkError")) {
                specificMessage =
                    "Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.";
            }
            uploadMessage.value = {
                type: "error",
                text: specificMessage,
            };
            if (originalImage.value)
                image.value = originalImage.value;
            else
                image.value = null;
        }
        finally {
            isUploadingLogo.value = false;
            // Temporäre URL freigeben
            if (tempImageUrl && image.value !== tempImageUrl) {
                URL.revokeObjectURL(tempImageUrl);
            }
        }
    }
};
// Löschungs-Logik gemäß Task 3.2: Erst Store aktualisieren, dann DELETE-Endpunkt aufrufen
const removeImage = async () => {
    const logoPathToDelete = image.value; // Dies sollte der relative Pfad sein
    image.value = null;
    uploadMessage.value = null;
    if (props.group?.id) {
        try {
            // SCHRITT 1: Erst logoPath im Store auf null setzen und synchronisieren
            await accountStore.updateAccountGroupLogo(props.group.id, null);
            uploadMessage.value = {
                type: "success",
                text: "Logo-Referenz erfolgreich entfernt.",
            };
            // SCHRITT 2: Erst NACH erfolgreicher Store-Synchronisation die physische Datei löschen
            if (logoPathToDelete) {
                try {
                    await ImageService.deleteLogo(logoPathToDelete);
                    uploadMessage.value = {
                        type: "success",
                        text: "Logo erfolgreich entfernt.",
                    };
                }
                catch (error) {
                    console.error("Fehler beim Löschen der physischen Datei vom Server:", error);
                    // Physische Datei konnte nicht gelöscht werden, aber Store-Referenz ist bereits entfernt
                    // Dies ist weniger kritisch, da die Referenz bereits entfernt wurde
                    uploadMessage.value = {
                        type: "success", // Immer noch Erfolg, da Store-Update erfolgreich war
                        text: "Logo-Referenz entfernt. Physische Datei konnte nicht gelöscht werden.",
                    };
                }
            }
        }
        catch (error) {
            console.error("Fehler beim Aktualisieren des Stores:", error);
            // Store-Update fehlgeschlagen - Bild wiederherstellen
            image.value = logoPathToDelete;
            uploadMessage.value = {
                type: "error",
                text: "Fehler beim Entfernen der Logo-Referenz. Vorgang abgebrochen.",
            };
        }
    }
};
const saveGroup = () => {
    const groupData = {
        name: name.value,
        sortOrder: sortOrder.value,
        logo_path: image.value || null,
    };
    // Wenn props.group.id existiert, fügen wir es hinzu, damit updateAccountGroup es verwenden kann
    const saveData = props.group?.id
        ? { ...groupData, id: props.group.id }
        : groupData;
    emit("save", saveData);
};
// Computed Property für die Anzeige des Logos
const displayLogoUrl = computed(() => {
    if (image.value) {
        if (image.value.startsWith("http://") ||
            image.value.startsWith("https://") ||
            image.value.startsWith("blob:")) {
            return image.value;
        }
        return ImageService.getLogoUrl(image.value);
    }
    return null;
});
// onMounted anpassen, um logoUrl zu verwenden
onMounted(() => {
    if (props.group) {
        name.value = props.group.name;
        sortOrder.value = props.group.sortOrder;
        image.value = props.group.logo_path || null; // Korrigiert zu logo_path
        originalImage.value = props.group.logo_path || null; // Korrigiert zu logo_path
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('cancel');
        } },
    type: "button",
    ...{ class: "btn btn-ghost btn-sm absolute top-0 right-0 z-10" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:close",
    ...{ class: "text-lg" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:close",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.saveGroup) },
    ...{ class: "space-y-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-error" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "text",
    value: (__VLS_ctx.name),
    ...{ class: "input input-bordered w-full" },
    required: true,
    placeholder: "Name der Gruppe",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
    ...{ class: "input input-bordered w-full" },
    min: "0",
});
(__VLS_ctx.sortOrder);
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center space-x-4" },
});
if (__VLS_ctx.displayLogoUrl) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "avatar" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-24 rounded" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.displayLogoUrl),
        alt: "Aktuelles Logo",
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "avatar placeholder" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-neutral-focus text-neutral-content rounded w-24" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.handleImageUpload) },
    type: "file",
    accept: "image/png, image/jpeg",
    ...{ class: "hidden" },
    ref: "fileInput",
});
/** @type {typeof __VLS_ctx.fileInput} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col space-y-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$refs.fileInput?.click();
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-outline" },
    disabled: (__VLS_ctx.isUploadingLogo),
});
if (__VLS_ctx.isUploadingLogo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "loading loading-spinner loading-xs mr-2" },
    });
}
(__VLS_ctx.displayLogoUrl ? "Logo ändern" : "Logo hochladen");
if (__VLS_ctx.displayLogoUrl && !__VLS_ctx.isUploadingLogo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.removeImage) },
        type: "button",
        ...{ class: "btn btn-sm btn-error btn-outline" },
        disabled: (__VLS_ctx.isUploadingLogo),
    });
}
if (__VLS_ctx.uploadMessage) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ([
                'mt-2 p-2 rounded-md text-sm',
                __VLS_ctx.uploadMessage.type === 'success'
                    ? 'bg-success text-success-content'
                    : 'bg-error text-error-content',
            ]) },
    });
    (__VLS_ctx.uploadMessage.text);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end space-x-2 pt-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('cancel');
        } },
    type: "button",
    ...{ class: "btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
    ...{ class: "btn btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-neutral-focus']} */ ;
/** @type {__VLS_StyleScopedClasses['text-neutral-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-error']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            emit: emit,
            name: name,
            sortOrder: sortOrder,
            isUploadingLogo: isUploadingLogo,
            uploadMessage: uploadMessage,
            handleImageUpload: handleImageUpload,
            removeImage: removeImage,
            saveGroup: saveGroup,
            displayLogoUrl: displayLogoUrl,
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
