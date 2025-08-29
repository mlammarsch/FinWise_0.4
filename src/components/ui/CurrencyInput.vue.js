import { ref, watch, computed, onMounted, defineExpose } from "vue";
const props = defineProps({
    modelValue: {
        type: Number,
        default: 0,
    },
    label: {
        type: String,
        default: "",
    },
    borderless: {
        type: Boolean,
        default: false,
    },
});
const emit = defineEmits(["update:modelValue"]);
const rawInputValue = ref("");
const inputRef = ref(null);
onMounted(() => {
    rawInputValue.value =
        props.modelValue !== 0 ? formatToGermanCurrency(props.modelValue) : "";
});
watch(() => props.modelValue, (newValue) => {
    if (document.activeElement !== inputRef.value) {
        rawInputValue.value = formatToGermanCurrency(newValue);
    }
});
const textClass = computed(() => {
    return props.modelValue < 0 ? "text-error" : "text-success";
});
const parseInput = (input) => {
    let validInput = input.replace(/[^0-9,-]/g, "");
    const hasMinus = validInput.startsWith("-");
    validInput = validInput.replace(/-/g, "");
    if (hasMinus)
        validInput = "-" + validInput;
    const parts = validInput.split(",");
    if (parts.length > 2)
        validInput = parts[0] + "," + parts[1];
    else if (parts.length > 1 && parts[1].length > 2)
        validInput = parts[0] + "," + parts[1].slice(0, 2);
    return validInput;
};
const onInput = (event) => {
    const target = event.target;
    rawInputValue.value = parseInput(target.value);
};
const onEnter = (event) => {
    formatAndEmitValue();
    event.target?.dispatchEvent(new Event("change", { bubbles: true }));
};
const onBlur = () => formatAndEmitValue();
const formatAndEmitValue = () => {
    const parsedValue = parseGermanCurrency(rawInputValue.value);
    emit("update:modelValue", parsedValue);
    rawInputValue.value = formatToGermanCurrency(parsedValue);
};
const onFocus = (event) => {
    const target = event.target;
    setTimeout(() => target.select(), 0);
};
function formatToGermanCurrency(value) {
    return new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
function parseGermanCurrency(value) {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
}
function focus() {
    inputRef.value?.focus();
}
function select() {
    inputRef.value?.select();
}
const __VLS_exposed = { focus, select };
defineExpose(__VLS_exposed);
const inputClasses = computed(() => {
    return props.borderless
        ? "input w-full text-right border-0"
        : "input w-full text-right";
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
if (__VLS_ctx.label) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    (__VLS_ctx.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "input-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.onInput) },
    ...{ onFocus: (__VLS_ctx.onFocus) },
    ...{ onBlur: (__VLS_ctx.onBlur) },
    ...{ onKeydown: (__VLS_ctx.onEnter) },
    ref: "inputRef",
    type: "text",
    ...{ class: (__VLS_ctx.inputClasses) },
    value: (__VLS_ctx.rawInputValue),
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input-group']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            rawInputValue: rawInputValue,
            inputRef: inputRef,
            onInput: onInput,
            onEnter: onEnter,
            onBlur: onBlur,
            onFocus: onFocus,
            inputClasses: inputClasses,
        };
    },
    emits: {},
    props: {
        modelValue: {
            type: Number,
            default: 0,
        },
        label: {
            type: String,
            default: "",
        },
        borderless: {
            type: Boolean,
            default: false,
        },
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
    emits: {},
    props: {
        modelValue: {
            type: Number,
            default: 0,
        },
        label: {
            type: String,
            default: "",
        },
        borderless: {
            type: Boolean,
            default: false,
        },
    },
});
; /* PartiallyEnd: #4569/main.vue */
