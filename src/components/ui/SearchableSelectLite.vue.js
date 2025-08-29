import { ref, computed, onMounted, watch } from "vue";
import { Icon } from "@iconify/vue";
const props = defineProps({
    modelValue: { type: String, default: "" },
    options: { type: Array, default: () => [] },
    label: { type: String, default: "" },
    placeholder: { type: String, default: "" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    itemText: { type: String, default: "name" },
    itemValue: { type: String, default: "id" },
});
const emit = defineEmits(["update:modelValue"]);
const isOpen = ref(false);
const searchTerm = ref("");
function onClickOutside(e) {
    const target = e.target;
    if (!target.closest(".custom-dropdown-container")) {
        isOpen.value = false;
    }
}
onMounted(() => {
    watch(isOpen, (val) => {
        if (val)
            window.addEventListener("click", onClickOutside);
        else
            window.removeEventListener("click", onClickOutside);
    }, { immediate: true });
});
const listOptions = computed(() => props.options);
const filteredOptions = computed(() => {
    let arr = [...listOptions.value].sort((a, b) => {
        const A = String(a[props.itemText] ?? "").toLowerCase();
        const B = String(b[props.itemText] ?? "").toLowerCase();
        return A.localeCompare(B);
    });
    if (searchTerm.value.trim()) {
        const term = searchTerm.value.toLowerCase();
        arr = arr.filter((opt) => String(opt[props.itemText] ?? "").toLowerCase().includes(term));
    }
    return arr;
});
const selectedLabel = computed(() => {
    if (!props.modelValue)
        return "";
    const found = listOptions.value.find((o) => String(o[props.itemValue] ?? "") === String(props.modelValue));
    return found ? found[props.itemText] ?? "" : "";
});
function toggleDropdown() {
    if (!props.disabled) {
        isOpen.value = !isOpen.value;
    }
}
function selectOption(value) {
    emit("update:modelValue", value);
    isOpen.value = false;
    searchTerm.value = "";
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control w-full custom-dropdown-container relative" },
});
if (__VLS_ctx.label) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    (__VLS_ctx.label);
    if (__VLS_ctx.required) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-error" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ onClick: (__VLS_ctx.toggleDropdown) },
    ...{ class: "input input-sm input-bordered text-xs w-full flex items-center justify-between cursor-pointer rounded-full" },
    ...{ class: ({
            'opacity-60': __VLS_ctx.disabled,
            'border-2 border-accent': __VLS_ctx.modelValue,
            'border-base-300': !__VLS_ctx.modelValue,
        }) },
});
if (__VLS_ctx.selectedLabel) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.selectedLabel);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.placeholder || "-kein Filter-");
}
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:arrow-down-drop",
    ...{ class: "ml-2 text-lg" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:arrow-down-drop",
    ...{ class: "ml-2 text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-1 w-38 bg-base-100 rounded-box shadow-lg border border-base-300 absolute z-40" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ onClick: () => { } },
        type: "text",
        ...{ class: "input input-sm input-bordered w-full" },
        value: (__VLS_ctx.searchTerm),
        placeholder: "Suchen...",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "max-h-60 overflow-y-auto p-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.selectOption('');
            } },
        ...{ class: "p-1 hover:bg-base-200 rounded cursor-pointer" },
    });
    for (const [opt] of __VLS_getVForSourceType((__VLS_ctx.filteredOptions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isOpen))
                        return;
                    __VLS_ctx.selectOption(String(opt[props.itemValue] ?? ''));
                } },
            key: (String(opt[props.itemValue] ?? '')),
            ...{ class: "p-1 hover:bg-base-200 rounded cursor-pointer" },
        });
        (String(opt[props.itemText] ?? ''));
    }
}
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['custom-dropdown-container']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['border-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-38']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-60']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            isOpen: isOpen,
            searchTerm: searchTerm,
            filteredOptions: filteredOptions,
            selectedLabel: selectedLabel,
            toggleDropdown: toggleDropdown,
            selectOption: selectOption,
        };
    },
    emits: {},
    props: {
        modelValue: { type: String, default: "" },
        options: { type: Array, default: () => [] },
        label: { type: String, default: "" },
        placeholder: { type: String, default: "" },
        required: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        itemText: { type: String, default: "name" },
        itemValue: { type: String, default: "id" },
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
    props: {
        modelValue: { type: String, default: "" },
        options: { type: Array, default: () => [] },
        label: { type: String, default: "" },
        placeholder: { type: String, default: "" },
        required: { type: Boolean, default: false },
        disabled: { type: Boolean, default: false },
        itemText: { type: String, default: "name" },
        itemValue: { type: String, default: "id" },
    },
});
; /* PartiallyEnd: #4569/main.vue */
