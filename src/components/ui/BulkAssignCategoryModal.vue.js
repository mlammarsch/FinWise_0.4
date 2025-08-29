import { ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import SelectCategory from "./SelectCategory.vue";
const props = defineProps();
const emit = defineEmits();
const selectedCategoryId = ref("");
const removeAllCategories = ref(false);
const modalRef = ref(null);
function handleClose() {
    selectedCategoryId.value = "";
    removeAllCategories.value = false;
    emit("close");
}
function handleConfirm() {
    if (removeAllCategories.value) {
        emit("confirm", null, true);
    }
    else if (selectedCategoryId.value) {
        emit("confirm", selectedCategoryId.value, false);
    }
    handleClose();
}
function handleCategorySelect(categoryId) {
    selectedCategoryId.value = categoryId || "";
    if (categoryId) {
        removeAllCategories.value = false;
    }
}
function handleRemoveAllChange() {
    if (removeAllCategories.value) {
        selectedCategoryId.value = "";
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
    icon: "mdi:folder",
    ...{ class: "text-xl" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:folder",
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
(__VLS_ctx.removeAllCategories);
if (!__VLS_ctx.removeAllCategories) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    /** @type {[typeof SelectCategory, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
        ...{ 'onSelect': {} },
        selectedCategoryId: (__VLS_ctx.selectedCategoryId),
        placeholder: "Kategorie auswählen...",
    }));
    const __VLS_13 = __VLS_12({
        ...{ 'onSelect': {} },
        selectedCategoryId: (__VLS_ctx.selectedCategoryId),
        placeholder: "Kategorie auswählen...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    let __VLS_15;
    let __VLS_16;
    let __VLS_17;
    const __VLS_18 = {
        onSelect: (__VLS_ctx.handleCategorySelect)
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
    ...{ class: (__VLS_ctx.removeAllCategories ? 'btn-error' : 'btn-primary') },
    disabled: (!__VLS_ctx.removeAllCategories && !__VLS_ctx.selectedCategoryId),
});
const __VLS_19 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent(__VLS_19, new __VLS_19({
    icon: (__VLS_ctx.removeAllCategories ? 'mdi:trash-can' : 'mdi:check'),
    ...{ class: "text-lg" },
}));
const __VLS_21 = __VLS_20({
    icon: (__VLS_ctx.removeAllCategories ? 'mdi:trash-can' : 'mdi:check'),
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
(__VLS_ctx.removeAllCategories ? "Entfernen" : "Zuweisen");
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
            SelectCategory: SelectCategory,
            selectedCategoryId: selectedCategoryId,
            removeAllCategories: removeAllCategories,
            modalRef: modalRef,
            handleClose: handleClose,
            handleConfirm: handleConfirm,
            handleCategorySelect: handleCategorySelect,
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
