import { ref, computed } from "vue";
const props = withDefaults(defineProps(), {
    placeholder: "Wert eingeben...",
    disabled: false,
});
const emit = defineEmits();
const inputValue = ref("");
const inputRef = ref();
const values = computed({
    get: () => props.modelValue,
    set: (newValue) => emit("update:modelValue", newValue),
});
function addValue(value) {
    const trimmedValue = value.trim();
    if (trimmedValue && !values.value.includes(trimmedValue)) {
        values.value = [...values.value, trimmedValue];
    }
    inputValue.value = "";
}
function removeValue(index) {
    values.value = values.value.filter((_, i) => i !== index);
}
function handleKeydown(event) {
    if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addValue(inputValue.value);
    }
    else if (event.key === "Backspace" &&
        inputValue.value === "" &&
        values.value.length > 0) {
        // Letzten Wert entfernen wenn Input leer ist und Backspace gedrückt wird
        removeValue(values.value.length - 1);
    }
}
function handleBlur() {
    // Wert hinzufügen wenn Input verlassen wird und noch ein Wert eingegeben ist
    if (inputValue.value.trim()) {
        addValue(inputValue.value);
    }
}
function focusInput() {
    inputRef.value?.focus();
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    placeholder: "Wert eingeben...",
    disabled: false,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['input-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['input-disabled']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (__VLS_ctx.focusInput) },
    ...{ class: "input input-bordered flex flex-wrap items-center gap-1 p-2 min-h-[3rem] cursor-text" },
    ...{ class: ({ 'input-disabled': __VLS_ctx.disabled }) },
});
for (const [value, index] of __VLS_getVForSourceType((__VLS_ctx.values))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (index),
        ...{ class: "badge badge-primary gap-1 py-2 px-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (value);
    if (!__VLS_ctx.disabled) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.disabled))
                        return;
                    __VLS_ctx.removeValue(index);
                } },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs p-0 w-4 h-4 min-h-0 hover:bg-primary-focus" },
            'aria-label': (`${value} entfernen`),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
            xmlns: "http://www.w3.org/2000/svg",
            ...{ class: "h-3 w-3" },
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            'stroke-width': "2",
            d: "M6 18L18 6M6 6l12 12",
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (__VLS_ctx.handleKeydown) },
    ...{ onBlur: (__VLS_ctx.handleBlur) },
    ref: "inputRef",
    value: (__VLS_ctx.inputValue),
    type: "text",
    placeholder: (__VLS_ctx.values.length === 0 ? __VLS_ctx.placeholder : ''),
    disabled: (__VLS_ctx.disabled),
    ...{ class: "flex-1 min-w-[120px] bg-transparent border-none outline-none" },
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "text-xs text-base-content/60 mt-1" },
});
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[3rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-primary-focus']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            inputValue: inputValue,
            inputRef: inputRef,
            values: values,
            removeValue: removeValue,
            handleKeydown: handleKeydown,
            handleBlur: handleBlur,
            focusInput: focusInput,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
