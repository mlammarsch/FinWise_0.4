import { ref, nextTick, onMounted, onUnmounted } from 'vue';
const props = withDefaults(defineProps(), {
    fieldKey: '',
    placeholder: ''
});
const emit = defineEmits();
const inputRef = ref();
const editValue = ref('');
// Initialisierung beim Mount der Komponente
function initializeEdit() {
    editValue.value = props.modelValue || '';
    nextTick(() => {
        if (inputRef.value) {
            inputRef.value.focus();
            inputRef.value.select();
        }
    });
}
function finishEdit() {
    // Trimme Whitespace und emittiere den neuen Wert
    const trimmedValue = editValue.value.trim();
    emit('update:modelValue', trimmedValue);
    editValue.value = '';
    emit('finish');
}
function handleKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        finishEdit();
    }
    else if (event.key === 'Escape') {
        event.preventDefault();
        editValue.value = '';
        emit('finish');
    }
}
// Outside click handler
function handleOutsideClick(event) {
    if (inputRef.value) {
        const target = event.target;
        if (!inputRef.value.contains(target)) {
            finishEdit();
        }
    }
}
onMounted(() => {
    document.addEventListener('click', handleOutsideClick);
    // Initialisiere das Edit-Feld beim Mount
    initializeEdit();
});
onUnmounted(() => {
    document.removeEventListener('click', handleOutsideClick);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    fieldKey: '',
    placeholder: ''
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onKeydown: (__VLS_ctx.handleKeydown) },
    ...{ onBlur: (__VLS_ctx.finishEdit) },
    ref: "inputRef",
    value: (__VLS_ctx.editValue),
    type: "text",
    ...{ class: "w-full px-2 py-1 text-left border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm bg-transparent" },
    placeholder: (__VLS_ctx.placeholder),
    'data-field-key': (__VLS_ctx.fieldKey),
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            inputRef: inputRef,
            editValue: editValue,
            finishEdit: finishEdit,
            handleKeydown: handleKeydown,
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
