import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { debugLog } from '../../utils/logger';
const props = withDefaults(defineProps(), {
    fieldKey: ''
});
const emit = defineEmits();
const inputRef = ref();
const editValue = ref('');
const isFinishing = ref(false);
// Deutsche Dezimalnotation: Komma zu Punkt für Berechnung
function normalizeDecimal(value) {
    return value.replace(/,/g, '.');
}
// Punkt zu Komma für Anzeige
function formatDecimal(value) {
    return value.replace(/\./g, ',');
}
// Mathematische Ausdrücke berechnen
function evaluateExpression(expression) {
    try {
        // Normalisiere deutsche Dezimalnotation
        const normalizedExpression = normalizeDecimal(expression.trim());
        // Sicherheitsprüfung: nur erlaubte Zeichen
        const allowedChars = /^[0-9+\-*/().,\s]+$/;
        if (!allowedChars.test(normalizedExpression)) {
            throw new Error('Ungültige Zeichen in der Formel');
        }
        // Verwende Function Constructor für sichere Auswertung
        // (sicherer als eval, da kein Zugriff auf globale Variablen)
        const result = new Function('return ' + normalizedExpression)();
        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Ungültiges Berechnungsergebnis');
        }
        return result;
    }
    catch (error) {
        debugLog('CalculatorInput', `Fehler bei Berechnung von "${expression}":`, error);
        // Bei Fehlern versuche als einfache Zahl zu parsen
        const normalizedValue = normalizeDecimal(expression.trim());
        const simpleNumber = parseFloat(normalizedValue);
        if (!isNaN(simpleNumber)) {
            return simpleNumber;
        }
        // Fallback: ursprünglicher Wert
        return props.modelValue;
    }
}
// Initialisierung beim Mount der Komponente
function initializeEdit() {
    editValue.value = Math.abs(props.modelValue).toString().replace('.', ',');
    nextTick(() => {
        if (inputRef.value) {
            inputRef.value.focus();
            inputRef.value.select();
        }
    });
}
function finishEdit() {
    // Verhindere mehrfache Ausführung
    if (isFinishing.value) {
        debugLog('CalculatorInput', 'finishEdit bereits in Ausführung, überspringe');
        return;
    }
    isFinishing.value = true;
    try {
        if (editValue.value.trim()) {
            const calculatedValue = evaluateExpression(editValue.value);
            debugLog('CalculatorInput', `finishEdit: Emittiere Wert ${calculatedValue} für Feld ${props.fieldKey}`);
            emit('update:modelValue', calculatedValue);
        }
        else {
            // Wenn das Feld leer ist, übergebe 0 an das Parent
            debugLog('CalculatorInput', `finishEdit: Feld leer, emittiere 0 für Feld ${props.fieldKey}`);
            emit('update:modelValue', 0);
        }
        editValue.value = '';
        emit('finish');
    }
    finally {
        // Reset nach kurzer Verzögerung, um Race Conditions zu vermeiden
        setTimeout(() => {
            isFinishing.value = false;
        }, 100);
    }
}
function finishEditAndFocusNext() {
    if (isFinishing.value) {
        debugLog('CalculatorInput', 'finishEditAndFocusNext bereits in Ausführung, überspringe');
        return;
    }
    isFinishing.value = true;
    try {
        if (editValue.value.trim()) {
            const calculatedValue = evaluateExpression(editValue.value);
            debugLog('CalculatorInput', `finishEditAndFocusNext: Emittiere Wert ${calculatedValue} für Feld ${props.fieldKey}`);
            emit('update:modelValue', calculatedValue);
        }
        else {
            debugLog('CalculatorInput', `finishEditAndFocusNext: Feld leer, emittiere 0 für Feld ${props.fieldKey}`);
            emit('update:modelValue', 0);
        }
        editValue.value = '';
        emit('focus-next');
    }
    finally {
        setTimeout(() => {
            isFinishing.value = false;
        }, 100);
    }
}
function finishEditAndFocusPrevious() {
    if (isFinishing.value) {
        debugLog('CalculatorInput', 'finishEditAndFocusPrevious bereits in Ausführung, überspringe');
        return;
    }
    isFinishing.value = true;
    try {
        if (editValue.value.trim()) {
            const calculatedValue = evaluateExpression(editValue.value);
            debugLog('CalculatorInput', `finishEditAndFocusPrevious: Emittiere Wert ${calculatedValue} für Feld ${props.fieldKey}`);
            emit('update:modelValue', calculatedValue);
        }
        else {
            debugLog('CalculatorInput', `finishEditAndFocusPrevious: Feld leer, emittiere 0 für Feld ${props.fieldKey}`);
            emit('update:modelValue', 0);
        }
        editValue.value = '';
        emit('focus-previous');
    }
    finally {
        setTimeout(() => {
            isFinishing.value = false;
        }, 100);
    }
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
    else if (event.key === 'ArrowDown') {
        event.preventDefault();
        finishEditAndFocusNext();
    }
    else if (event.key === 'ArrowUp') {
        event.preventDefault();
        finishEditAndFocusPrevious();
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
    // Reset des Finishing-Flags beim Unmount
    isFinishing.value = false;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    fieldKey: ''
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
    ...{ class: "w-full px-1 py-0.5 text-right border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs bg-transparent" },
    'data-field-key': (__VLS_ctx.fieldKey),
});
/** @type {typeof __VLS_ctx.inputRef} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
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
