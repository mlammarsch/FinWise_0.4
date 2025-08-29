import { ref, watch } from "vue";
const props = defineProps();
const emit = defineEmits(["update:modelValue"]);
const inputDate = ref(props.modelValue);
// Voreingestellte Zeiträume
const presets = [
    { label: "Heute", days: 0 },
    { label: "Gestern", days: -1 },
    { label: "Letzte Woche", days: -7 },
    { label: "Letzter Monat", days: -30 },
    { label: "Anfang des Monats", type: "startOfMonth" },
    { label: "Ende des Monats", type: "endOfMonth" },
];
// Aktualisiere den Input, wenn sich der modelValue ändert
watch(() => props.modelValue, (newValue) => {
    inputDate.value = newValue;
});
// Aktualisiere den modelValue, wenn sich der Input ändert
function updateDate(event) {
    const target = event.target;
    emit("update:modelValue", target.value);
}
// Setze ein voreingestelltes Datum
function setPresetDate(preset) {
    const today = new Date();
    let date;
    if (preset.type === "startOfMonth") {
        date = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    else if (preset.type === "endOfMonth") {
        date = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    else if (preset.days !== undefined) {
        date = new Date();
        date.setDate(today.getDate() + preset.days);
    }
    else {
        return;
    }
    const formattedDate = formatDateForInput(date);
    inputDate.value = formattedDate;
    emit("update:modelValue", formattedDate);
}
// Formatiere ein Datum für das Input-Feld (YYYY-MM-DD)
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control w-full" },
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
    ...{ class: "flex" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onInput: (__VLS_ctx.updateDate) },
    type: "date",
    ...{ class: "input input-bordered w-full" },
    value: (__VLS_ctx.inputDate),
    disabled: (__VLS_ctx.disabled),
    required: (__VLS_ctx.required),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "dropdown dropdown-end ml-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    tabindex: "0",
    ...{ class: "btn btn-square btn-ghost btn-sm" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:calendar-month",
    ...{ class: "text-lg" },
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:calendar-month",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
    tabindex: "0",
    ...{ class: "dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 border-1 border-base-300" },
});
for (const [preset] of __VLS_getVForSourceType((__VLS_ctx.presets))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        key: (preset.label),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.setPresetDate(preset);
            } },
    });
    (preset.label);
}
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-end']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-square']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['dropdown-content']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-52']} */ ;
/** @type {__VLS_StyleScopedClasses['border-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            inputDate: inputDate,
            presets: presets,
            updateDate: updateDate,
            setPresetDate: setPresetDate,
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
