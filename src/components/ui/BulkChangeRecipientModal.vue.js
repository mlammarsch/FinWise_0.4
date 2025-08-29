import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import SelectRecipient from "./SelectRecipient.vue";
import { debugLog, errorLog } from "../../utils/logger";
const props = defineProps();
const emit = defineEmits();
const selectedRecipientId = ref("");
const removeAllRecipients = ref(false);
const modalRef = ref(null);
function handleClose() {
    selectedRecipientId.value = "";
    removeAllRecipients.value = false;
    emit("close");
}
function handleConfirm() {
    if (removeAllRecipients.value) {
        emit("confirm", null, true);
    }
    else if (selectedRecipientId.value) {
        emit("confirm", selectedRecipientId.value, false);
    }
    handleClose();
}
function handleRecipientSelect(recipientId) {
    selectedRecipientId.value = recipientId || "";
    if (recipientId) {
        removeAllRecipients.value = false;
    }
}
async function handleRecipientCreate(recipientData) {
    // Erstelle den neuen Empfänger über den recipientStore
    const { useRecipientStore } = await import("../../stores/recipientStore");
    const recipientStore = useRecipientStore();
    try {
        const newRecipient = await recipientStore.addRecipient({
            name: recipientData.name,
            defaultCategoryId: undefined,
            note: "",
        });
        // Setze den neu erstellten Empfänger als ausgewählt
        selectedRecipientId.value = newRecipient.id;
        removeAllRecipients.value = false;
        debugLog("[BulkChangeRecipientModal]", "Neuer Empfänger erstellt und ausgewählt", {
            recipientId: newRecipient.id,
            name: newRecipient.name,
        });
    }
    catch (error) {
        errorLog("[BulkChangeRecipientModal]", "Fehler beim Erstellen des Empfängers", {
            error: error instanceof Error ? error.message : String(error),
            recipientName: recipientData.name,
        });
    }
}
function handleRemoveAllChange() {
    if (removeAllRecipients.value) {
        selectedRecipientId.value = "";
    }
}
watch(() => props.isOpen, (isOpen) => {
    if (isOpen && modalRef.value) {
        modalRef.value.showModal();
    }
    else if (modalRef.value) {
        modalRef.value.close();
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
    ...{ onClose: (__VLS_ctx.handleClose) },
    ref: "modalRef",
    ...{ class: "modal" },
});
/** @type {typeof __VLS_ctx.modalRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "modal-box" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "font-bold text-lg flex items-center gap-2" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:account",
    ...{ class: "text-xl" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:account",
    ...{ class: "text-xl" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleClose) },
    ...{ class: "btn btn-sm btn-circle btn-ghost" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:close",
    ...{ class: "text-lg" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:close",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "alert alert-info alert-soft mb-4" },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:information",
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:information",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.selectedCount);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.handleRemoveAllChange) },
    type: "checkbox",
    ...{ class: "checkbox checkbox-error" },
});
(__VLS_ctx.removeAllRecipients);
if (!__VLS_ctx.removeAllRecipients) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    /** @type {[typeof SelectRecipient, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(SelectRecipient, new SelectRecipient({
        ...{ 'onSelect': {} },
        ...{ 'onCreate': {} },
        selectedRecipientId: (__VLS_ctx.selectedRecipientId),
        placeholder: "Empfänger auswählen...",
    }));
    const __VLS_13 = __VLS_12({
        ...{ 'onSelect': {} },
        ...{ 'onCreate': {} },
        selectedRecipientId: (__VLS_ctx.selectedRecipientId),
        placeholder: "Empfänger auswählen...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    let __VLS_15;
    let __VLS_16;
    let __VLS_17;
    const __VLS_18 = {
        onSelect: (__VLS_ctx.handleRecipientSelect)
    };
    const __VLS_19 = {
        onCreate: (__VLS_ctx.handleRecipientCreate)
    };
    var __VLS_14;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "modal-action" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleClose) },
    ...{ class: "btn btn-ghost" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleConfirm) },
    ...{ class: "btn" },
    ...{ class: (__VLS_ctx.removeAllRecipients ? 'btn-error' : 'btn-primary') },
    disabled: (!__VLS_ctx.removeAllRecipients && !__VLS_ctx.selectedRecipientId),
});
const __VLS_20 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    icon: (__VLS_ctx.removeAllRecipients ? 'mdi:trash-can' : 'mdi:check'),
    ...{ class: "text-lg" },
}));
const __VLS_22 = __VLS_21({
    icon: (__VLS_ctx.removeAllRecipients ? 'mdi:trash-can' : 'mdi:check'),
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
(__VLS_ctx.removeAllRecipients ? "Entfernen" : "Zuweisen");
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    method: "dialog",
    ...{ class: "modal-backdrop" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.handleClose) },
});
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-info']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            SelectRecipient: SelectRecipient,
            selectedRecipientId: selectedRecipientId,
            removeAllRecipients: removeAllRecipients,
            modalRef: modalRef,
            handleClose: handleClose,
            handleConfirm: handleConfirm,
            handleRecipientSelect: handleRecipientSelect,
            handleRecipientCreate: handleRecipientCreate,
            handleRemoveAllChange: handleRemoveAllChange,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
