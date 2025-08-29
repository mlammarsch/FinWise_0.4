import { computed, withDefaults } from "vue";
import { formatCurrency, getAmountClass } from "../../utils/formatters";
const props = withDefaults(defineProps(), {
    showSign: true,
    showZero: true,
    asInteger: false,
});
// Berechnet den formatierten Betrag mit optionaler Ganzzahldarstellung
const formattedAmount = computed(() => {
    let value = props.asInteger ? Math.round(props.amount) : props.amount;
    let formatted = formatCurrency(value);
    // Entfernt ",00" nur, wenn `asInteger` aktiv ist, behält aber das Währungssymbol
    if (props.asInteger) {
        formatted = formatted.replace(/,00(?=\s*€)/, "");
    }
    // Entfernt das Währungszeichen nur, wenn `showSign` false ist
    return props.showSign ? formatted : formatted.replace(/\s*€$/, "");
});
// Bestimmt die CSS-Klasse für die Anzeige des Betrags
const amountClass = computed(() => getAmountClass(props.amount));
// Legt fest, ob der Betrag angezeigt wird
const showAmount = computed(() => props.amount !== 0 || props.showZero);
// Bestimmt, was bei showZero=false angezeigt wird
const fallbackDisplay = computed(() => {
    // Wenn showSign true ist, zeige "- €", sonst nur "-"
    return props.showSign ? '- €' : '-';
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showSign: true,
    showZero: true,
    asInteger: false,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (__VLS_ctx.showAmount) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: (__VLS_ctx.amountClass) },
    });
    (__VLS_ctx.formattedAmount);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-neutral" },
    });
    (__VLS_ctx.fallbackDisplay);
}
/** @type {__VLS_StyleScopedClasses['text-neutral']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            formattedAmount: formattedAmount,
            amountClass: amountClass,
            showAmount: showAmount,
            fallbackDisplay: fallbackDisplay,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
