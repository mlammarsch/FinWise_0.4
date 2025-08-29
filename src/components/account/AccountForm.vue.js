import { ref, computed, onMounted, nextTick } from "vue";
import { AccountType } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import CurrencyInput from "../ui/CurrencyInput.vue";
import { ImageService } from "../../services/ImageService"; // Import ImageService
import { useTenantStore } from "../../stores/tenantStore";
const props = defineProps();
const emit = defineEmits(["save", "cancel"]);
const accountStore = useAccountStore();
const name = ref("");
const description = ref("");
const note = ref("");
const accountGroupId = ref("");
const accountType = ref(AccountType.Girokonto);
const iban = ref("");
const offset = ref(0);
const creditLimit = ref(0);
const image = ref(null);
const originalImage = ref(null);
const isUploadingLogo = ref(false);
const uploadMessage = ref(null);
// Die onMounted-Logik wird hierhin verschoben und angepasst, um logoUrl zu verwenden
onMounted(() => {
    if (props.account) {
        name.value = props.account.name;
        description.value = props.account.description || "";
        note.value = props.account.note || "";
        accountGroupId.value = props.account.accountGroupId;
        accountType.value = props.account.accountType;
        iban.value = props.account.iban || "";
        offset.value = props.account.offset || 0;
        creditLimit.value = props.account.creditLimit || 0;
        image.value = props.account.logo_path || null;
        originalImage.value = props.account.logo_path || null;
    }
    else {
        accountGroupId.value = accountStore.accountGroups[0]?.id || "";
        offset.value = 0;
        creditLimit.value = 0;
        accountType.value = AccountType.Girokonto;
    }
    nextTick(() => document.getElementById("account-name")?.focus());
});
// Upload-Logik gemäß Task 3.2: POST /api/v1/logos/upload verwenden
const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
        // Temporäre URL für die Vorschau erstellen
        const tempImageUrl = URL.createObjectURL(file);
        image.value = tempImageUrl; // Setze das Bild sofort für die Vorschau
        isUploadingLogo.value = true;
        uploadMessage.value = null;
        try {
            const accountId = props.account?.id;
            if (!accountId && props.isEdit) {
                uploadMessage.value = {
                    type: "error",
                    text: "Konto-ID nicht gefunden. Upload nicht möglich.",
                };
                isUploadingLogo.value = false;
                return;
            }
            if (!accountId) {
                uploadMessage.value = {
                    type: "error",
                    text: "Bitte speichern Sie das Konto zuerst, um ein Logo hochzuladen.",
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
            const response = await ImageService.uploadLogo(accountId, "account", file, tenantId);
            if (response && response.logo_path) {
                image.value = response.logo_path; // Speichere den relativen Pfad vom Server
                uploadMessage.value = {
                    type: "success",
                    text: "Logo erfolgreich hochgeladen.",
                };
                // Nach erfolgreichem Upload: logoPath im Store aktualisieren für Synchronisation
                await accountStore.updateAccountLogo(accountId, response.logo_path);
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
    if (props.account?.id) {
        try {
            // SCHRITT 1: Erst logoPath im Store auf null setzen und synchronisieren
            await accountStore.updateAccountLogo(props.account.id, null);
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
// Die saveAccount-Logik wird hierhin verschoben und angepasst
const saveAccount = () => {
    const accountData = {
        name: name.value,
        description: description.value,
        note: note.value,
        accountGroupId: accountGroupId.value,
        accountType: accountType.value,
        iban: iban.value,
        offset: offset.value,
        creditLimit: creditLimit.value,
        logo_path: image.value || undefined,
        isActive: props.account?.isActive ?? true,
        isOfflineBudget: props.account?.isOfflineBudget ?? false,
    };
    emit("save", accountData);
};
const accountGroups = computed(() => accountStore.accountGroups);
const accountTypeOptions = computed(() => {
    return Object.entries(AccountType)
        .map(([key, value]) => ({
        label: key,
        value: value,
    }))
        .sort((a, b) => a.label.localeCompare(b.label));
});
// Computed Property für die Anzeige des Logos
const displayLogoUrl = computed(() => {
    if (image.value) {
        // Wenn image.value eine volle URL ist (z.B. von externen Quellen oder temporäre Blob-URL), gib sie direkt zurück.
        if (image.value.startsWith("http://") ||
            image.value.startsWith("https://") ||
            image.value.startsWith("blob:")) {
            return image.value;
        }
        // Wenn es ein relativer Pfad ist, konstruiere die URL über ImageService
        return ImageService.getLogoUrl(image.value);
    }
    return null;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.saveAccount) },
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
    id: "account-name",
    type: "text",
    value: (__VLS_ctx.name),
    ...{ class: "input input-bordered w-full" },
    required: true,
    placeholder: "Kontoname",
    autofocus: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "text",
    value: (__VLS_ctx.description),
    ...{ class: "input input-bordered w-full" },
    placeholder: "Kurze Beschreibung",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.accountGroupId),
    ...{ class: "select select-bordered w-full" },
    required: true,
});
for (const [g] of __VLS_getVForSourceType((__VLS_ctx.accountGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (g.id),
        value: (g.id),
    });
    (g.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.accountType),
    ...{ class: "select select-bordered w-full" },
    required: true,
});
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.accountTypeOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (option.value),
        value: (option.value),
    });
    (option.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "text",
    value: (__VLS_ctx.iban),
    ...{ class: "input input-bordered w-full" },
    placeholder: "DE12 3456 7890 1234 5678 90",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
/** @type {[typeof CurrencyInput, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
    modelValue: (__VLS_ctx.offset),
    placeholder: "0,00",
}));
const __VLS_1 = __VLS_0({
    modelValue: (__VLS_ctx.offset),
    placeholder: "0,00",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
/** @type {[typeof CurrencyInput, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
    modelValue: (__VLS_ctx.creditLimit),
    placeholder: "0,00",
}));
const __VLS_4 = __VLS_3({
    modelValue: (__VLS_ctx.creditLimit),
    placeholder: "0,00",
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
    value: (__VLS_ctx.note),
    ...{ class: "textarea textarea-bordered h-24 w-full" },
    placeholder: "Zusätzliche Informationen",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.handleImageUpload) },
    type: "file",
    accept: "image/jpeg,image/png",
    ...{ class: "file-input file-input-bordered w-full" },
    disabled: (__VLS_ctx.isUploadingLogo),
});
if (__VLS_ctx.isUploadingLogo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-2 flex items-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "loading loading-spinner loading-sm mr-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
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
if (__VLS_ctx.displayLogoUrl && !__VLS_ctx.isUploadingLogo) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.img)({
        src: (__VLS_ctx.displayLogoUrl),
        alt: "Vorschau",
        ...{ class: "rounded-md max-h-32" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.removeImage) },
        ...{ class: "btn btn-error btn-sm mt-2" },
        type: "button",
        disabled: (__VLS_ctx.isUploadingLogo),
    });
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
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['h-24']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['loading']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
/** @type {__VLS_StyleScopedClasses['loading-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-32']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-error']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
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
            CurrencyInput: CurrencyInput,
            emit: emit,
            name: name,
            description: description,
            note: note,
            accountGroupId: accountGroupId,
            accountType: accountType,
            iban: iban,
            offset: offset,
            creditLimit: creditLimit,
            isUploadingLogo: isUploadingLogo,
            uploadMessage: uploadMessage,
            handleImageUpload: handleImageUpload,
            removeImage: removeImage,
            saveAccount: saveAccount,
            accountGroups: accountGroups,
            accountTypeOptions: accountTypeOptions,
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
