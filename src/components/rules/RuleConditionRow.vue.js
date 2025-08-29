import { computed } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import SelectAccount from "@/components/ui/SelectAccount.vue";
import SelectCategory from "@/components/ui/SelectCategory.vue";
import MultiValueInput from "@/components/ui/MultiValueInput.vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
// Quelle-Optionen
const sourceOptions = [
    { value: "recipient", label: "Empfänger", type: "string" },
    { value: "date", label: "Datum", type: "date" },
    { value: "valueDate", label: "Wertstellung", type: "date" },
    { value: "amount", label: "Betrag", type: "number" },
    { value: "category", label: "Kategorie", type: "select" },
    { value: "description", label: "Beschreibung", type: "string" },
    { value: "account", label: "Konto", type: "select" },
];
// Operator-Optionen basierend auf Datentyp
function getOperatorOptions(source) {
    const sourceType = sourceOptions.find((s) => s.value === source)?.type;
    if (sourceType === "string") {
        return [
            { value: "is", label: "ist" },
            { value: "contains", label: "enthält" },
            { value: "starts_with", label: "beginnt mit" },
            { value: "ends_with", label: "endet mit" },
            { value: "one_of", label: "ist einer von" },
        ];
    }
    else if (sourceType === "number") {
        return [
            { value: "is", label: "ist" },
            { value: "greater", label: "größer" },
            { value: "greater_equal", label: "größer gleich" },
            { value: "less", label: "kleiner" },
            { value: "less_equal", label: "kleiner gleich" },
            { value: "approx", label: "ungefähr (±10%)" },
            { value: "one_of", label: "ist einer von" },
        ];
    }
    else if (sourceType === "date") {
        return [
            { value: "is", label: "ist" },
            { value: "greater", label: "größer" },
            { value: "greater_equal", label: "größer gleich" },
            { value: "less", label: "kleiner" },
            { value: "less_equal", label: "kleiner gleich" },
        ];
    }
    else if (sourceType === "select") {
        return [
            { value: "is", label: "ist" },
            { value: "one_of", label: "ist einer von" },
        ];
    }
    return [{ value: "is", label: "ist" }];
}
// Computed für die aktuelle Bedingung
const currentCondition = computed({
    get: () => props.condition,
    set: (value) => emit("update:condition", value),
});
// UI-Hilfsfeld für Quelle (nicht Teil des Domain-Typs)
const sourceField = computed({
    get: () => {
        const c = currentCondition.value;
        return (c?.source ?? "description");
    },
    set: (val) => {
        const next = { ...currentCondition.value, source: val };
        emit("update:condition", next);
    },
});
// Funktion zum Zurücksetzen des Bedingungswerts bei Operator-Änderung
function resetConditionValue() {
    const newCondition = { ...currentCondition.value };
    // Wenn der neue Operator 'one_of' ist, initialisiere als Array
    if (newCondition.operator === "one_of") {
        newCondition.value = [];
    }
    else {
        // Für alle anderen Operatoren, initialisiere als String
        newCondition.value = "";
    }
    currentCondition.value = newCondition;
}
// Computed für Multi-Value-Eingabe
const multiValueCondition = computed({
    get: () => {
        const c = currentCondition.value;
        if (Array.isArray(c?.value)) {
            return c.value;
        }
        return [];
    },
    set: (value) => {
        const next = { ...currentCondition.value, value };
        currentCondition.value = next;
    },
});
// Computed für Single-Value-Eingabe
const singleValueCondition = computed({
    get: () => {
        const c = currentCondition.value;
        if (!Array.isArray(c?.value)) {
            return (c?.value ?? "");
        }
        return "";
    },
    set: (value) => {
        const next = { ...currentCondition.value, value };
        currentCondition.value = next;
    },
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-12 gap-3 items-center p-3 bg-base-200 rounded-lg" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-span-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ onChange: (__VLS_ctx.resetConditionValue) },
    value: (__VLS_ctx.sourceField),
    ...{ class: "select select-bordered select-sm w-full" },
});
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.sourceOptions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (option.value),
        value: (option.value),
    });
    (option.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-span-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ onChange: (__VLS_ctx.resetConditionValue) },
    value: (__VLS_ctx.currentCondition.operator),
    ...{ class: "select select-bordered select-sm w-full" },
});
for (const [option] of __VLS_getVForSourceType((__VLS_ctx.getOperatorOptions(__VLS_ctx.sourceField || 'description')))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (option.value),
        value: (option.value),
    });
    (option.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-span-5" },
});
if (__VLS_ctx.currentCondition.operator === 'one_of') {
    /** @type {[typeof MultiValueInput, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(MultiValueInput, new MultiValueInput({
        modelValue: (__VLS_ctx.multiValueCondition),
        placeholder: (__VLS_ctx.sourceField === 'recipient'
            ? 'Empfänger-Namen eingeben...'
            : __VLS_ctx.sourceField === 'amount'
                ? 'Beträge eingeben...'
                : 'Werte eingeben...'),
    }));
    const __VLS_1 = __VLS_0({
        modelValue: (__VLS_ctx.multiValueCondition),
        placeholder: (__VLS_ctx.sourceField === 'recipient'
            ? 'Empfänger-Namen eingeben...'
            : __VLS_ctx.sourceField === 'amount'
                ? 'Beträge eingeben...'
                : 'Werte eingeben...'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
else {
    if (__VLS_ctx.sourceField === 'account' && __VLS_ctx.currentCondition.operator === 'is') {
        /** @type {[typeof SelectAccount, ]} */ ;
        // @ts-ignore
        const __VLS_3 = __VLS_asFunctionalComponent(SelectAccount, new SelectAccount({
            modelValue: (__VLS_ctx.singleValueCondition),
            ...{ class: "w-full" },
        }));
        const __VLS_4 = __VLS_3({
            modelValue: (__VLS_ctx.singleValueCondition),
            ...{ class: "w-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_3));
    }
    else if (__VLS_ctx.sourceField === 'category' && __VLS_ctx.currentCondition.operator === 'is') {
        /** @type {[typeof SelectCategory, ]} */ ;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
            modelValue: (__VLS_ctx.singleValueCondition),
            ...{ class: "w-full" },
            showNoneOption: (true),
        }));
        const __VLS_7 = __VLS_6({
            modelValue: (__VLS_ctx.singleValueCondition),
            ...{ class: "w-full" },
            showNoneOption: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    }
    else if (__VLS_ctx.sourceField === 'recipient') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "text",
            value: (__VLS_ctx.singleValueCondition),
            ...{ class: "input input-bordered input-sm w-full" },
            placeholder: "Empfänger-Name eingeben",
        });
    }
    else if (__VLS_ctx.sourceField === 'amount') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "number",
            step: "0.01",
            ...{ class: "input input-bordered input-sm w-full" },
            placeholder: "Betrag (z.B. 42.99)",
        });
        (__VLS_ctx.singleValueCondition);
    }
    else if (__VLS_ctx.sourceField === 'date' || __VLS_ctx.sourceField === 'valueDate') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "date",
            ...{ class: "input input-bordered input-sm w-full" },
        });
        (__VLS_ctx.singleValueCondition);
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "text",
            value: (__VLS_ctx.singleValueCondition),
            ...{ class: "input input-bordered input-sm w-full" },
            placeholder: "Wert eingeben",
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "col-span-1 flex justify-center" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('remove');
        } },
    type: "button",
    ...{ class: "btn btn-ghost btn-sm" },
    disabled: (!__VLS_ctx.canRemove),
});
const __VLS_9 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    icon: "mdi:close",
    ...{ class: "text-error" },
}));
const __VLS_11 = __VLS_10({
    icon: "mdi:close",
    ...{ class: "text-error" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-3']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            SelectAccount: SelectAccount,
            SelectCategory: SelectCategory,
            MultiValueInput: MultiValueInput,
            Icon: Icon,
            emit: emit,
            sourceOptions: sourceOptions,
            getOperatorOptions: getOperatorOptions,
            currentCondition: currentCondition,
            sourceField: sourceField,
            resetConditionValue: resetConditionValue,
            multiValueCondition: multiValueCondition,
            singleValueCondition: singleValueCondition,
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
