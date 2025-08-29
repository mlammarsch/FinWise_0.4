import { ref, computed, onMounted, watch } from "vue";
import { CategoryService } from "../../services/CategoryService";
import { BalanceService } from "../../services/BalanceService";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import ButtonGroup from "../ui/ButtonGroup.vue";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["save", "cancel"]);
// Formularfelder
const name = ref("");
const description = ref("");
const isActive = ref(true);
const isHidden = ref(false);
const isSavingsGoal = ref(false);
const targetAmount = ref(0);
const targetDate = ref("");
const categoryGroupId = ref("");
const balance = ref(0);
const goalDate = ref("");
const priority = ref(0);
const proportion = ref(0);
const monthlyAmount = ref(0);
const note = ref("");
// Validierung
const submitAttempted = ref(false);
const showValidationAlert = ref(false);
// Flags zur Verhinderung von Endlosschleifen bei automatischen Berechnungen
const isCalculatingDate = ref(false);
const isCalculatingAmount = ref(false);
// Lade die Daten, wenn eine Kategorie zum Bearbeiten übergeben wurde
onMounted(() => {
    if (props.category) {
        name.value = props.category.name;
        description.value = ""; // Category hat keine description property
        isActive.value = props.category.isActive;
        isHidden.value = props.category.isHidden || false;
        isSavingsGoal.value = props.category.isSavingsGoal || false;
        targetAmount.value = props.category.targetAmount || 0;
        targetDate.value = ""; // Wird nicht verwendet, goalDate ist das korrekte Feld
        categoryGroupId.value = props.category.categoryGroupId || "";
        // Aktuellen Saldo über BalanceService berechnen statt aus props.category.available
        balance.value = BalanceService.getTodayBalance("category", props.category.id);
        goalDate.value = props.category.goalDate || "";
        priority.value = props.category.priority || 0;
        proportion.value = props.category.proportion || 0;
        monthlyAmount.value = props.category.monthlyAmount || 0;
        note.value = props.category.note || "";
    }
    else {
        const groups = CategoryService.getCategoryGroups().value;
        if (groups.length > 0) {
            categoryGroupId.value = groups[0].id;
        }
    }
});
// Automatische Berechnungen für Sparziel
const calculateGoalDate = () => {
    if (!isSavingsGoal.value || targetAmount.value <= 0 || monthlyAmount.value <= 0 || isCalculatingDate.value) {
        return;
    }
    isCalculatingDate.value = true;
    // Berücksichtige den aktuellen Saldo - nur die Differenz muss noch gespart werden
    const remainingAmount = targetAmount.value - balance.value;
    // Wenn das Ziel bereits erreicht ist, setze das Datum auf heute
    if (remainingAmount <= 0) {
        goalDate.value = new Date().toISOString().split('T')[0];
    }
    else {
        const monthsNeeded = Math.ceil(remainingAmount / monthlyAmount.value);
        const today = new Date();
        const goalDateCalculated = new Date(today.getFullYear(), today.getMonth() + monthsNeeded, today.getDate());
        goalDate.value = goalDateCalculated.toISOString().split('T')[0];
    }
    setTimeout(() => {
        isCalculatingDate.value = false;
    }, 100);
};
const calculateMonthlyAmount = () => {
    if (!isSavingsGoal.value || targetAmount.value <= 0 || !goalDate.value || isCalculatingAmount.value) {
        return;
    }
    isCalculatingAmount.value = true;
    const today = new Date();
    const targetDateObj = new Date(goalDate.value);
    const monthsDiff = (targetDateObj.getFullYear() - today.getFullYear()) * 12 +
        (targetDateObj.getMonth() - today.getMonth());
    // Berücksichtige den aktuellen Saldo - nur die Differenz muss noch gespart werden
    const remainingAmount = targetAmount.value - balance.value;
    if (monthsDiff > 0 && remainingAmount > 0) {
        monthlyAmount.value = Math.ceil(remainingAmount / monthsDiff * 100) / 100;
    }
    else if (remainingAmount <= 0) {
        // Ziel bereits erreicht
        monthlyAmount.value = 0;
    }
    setTimeout(() => {
        isCalculatingAmount.value = false;
    }, 100);
};
// Watch für automatische Berechnungen
watch([targetAmount, monthlyAmount, balance], () => {
    if (isSavingsGoal.value && !isCalculatingDate.value) {
        calculateGoalDate();
    }
}, { deep: true });
watch([targetAmount, goalDate, balance], () => {
    if (isSavingsGoal.value && !isCalculatingAmount.value) {
        calculateMonthlyAmount();
    }
}, { deep: true });
// Validierungsfehler sammeln
const validationErrors = computed(() => {
    const errors = [];
    if (!name.value.trim())
        errors.push("Name ist erforderlich");
    if (!categoryGroupId.value)
        errors.push("Kategoriegruppe ist erforderlich");
    if (isSavingsGoal.value && targetAmount.value <= 0) {
        errors.push("Zielbetrag muss größer als 0 sein");
    }
    return errors;
});
// Speichere die Kategorie
const saveCategory = () => {
    submitAttempted.value = true;
    if (validationErrors.value.length > 0) {
        showValidationAlert.value = true;
        return;
    }
    showValidationAlert.value = false;
    const categoryData = {
        name: name.value,
        icon: undefined,
        budgeted: 0,
        activity: 0,
        available: balance.value,
        isIncomeCategory: false,
        isHidden: isHidden.value,
        isActive: isActive.value,
        sortOrder: 0,
        categoryGroupId: categoryGroupId.value,
        isSavingsGoal: isSavingsGoal.value,
        goalDate: goalDate.value || undefined,
        targetAmount: targetAmount.value || undefined,
        priority: priority.value || undefined,
        proportion: proportion.value || undefined,
        monthlyAmount: monthlyAmount.value || undefined,
        note: note.value || undefined,
    };
    emit("save", categoryData);
};
// Schließt das Validierungs-Alert
const closeValidationAlert = () => {
    showValidationAlert.value = false;
};
const categoryGroups = computed(() => CategoryService.getCategoryGroups().value);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-between items-start mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label cursor-pointer gap-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-sm toggle-primary" },
});
(__VLS_ctx.isActive);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label cursor-pointer gap-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-sm toggle-primary" },
});
(__VLS_ctx.isHidden);
if (props.category) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm text-base-content/70 mb-1" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (__VLS_ctx.balance),
        showZero: (true),
        asInteger: (true),
    }));
    const __VLS_1 = __VLS_0({
        amount: (__VLS_ctx.balance),
        showZero: (true),
        asInteger: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('cancel');
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-circle btn-ghost absolute right-2 -top-12 z-10" },
});
const __VLS_3 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_4 = __VLS_asFunctionalComponent(__VLS_3, new __VLS_3({
    icon: "mdi:close",
    ...{ class: "text-lg" },
}));
const __VLS_5 = __VLS_4({
    icon: "mdi:close",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_4));
if (__VLS_ctx.showValidationAlert && __VLS_ctx.validationErrors.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "alert alert-error alert-soft mb-6" },
    });
    const __VLS_7 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent(__VLS_7, new __VLS_7({
        icon: "mdi:alert-circle",
        ...{ class: "text-lg" },
    }));
    const __VLS_9 = __VLS_8({
        icon: "mdi:alert-circle",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "list-disc list-inside mt-2" },
    });
    for (const [error] of __VLS_getVForSourceType((__VLS_ctx.validationErrors))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (error),
            ...{ class: "text-sm" },
        });
        (error);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeValidationAlert) },
        type: "button",
        ...{ class: "btn btn-sm btn-circle btn-ghost" },
    });
    const __VLS_11 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(__VLS_11, new __VLS_11({
        icon: "mdi:close",
        ...{ class: "text-sm" },
    }));
    const __VLS_13 = __VLS_12({
        icon: "mdi:close",
        ...{ class: "text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.saveCategory) },
    ...{ class: "space-y-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-error" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "text",
    value: (__VLS_ctx.name),
    ...{ class: "input input-bordered w-full" },
    required: true,
    placeholder: "Kategoriename",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-error" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.categoryGroupId),
    ...{ class: "select select-bordered w-full" },
    required: true,
});
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.categoryGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (group.id),
        value: (group.id),
    });
    (group.name);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "text",
    value: (__VLS_ctx.description),
    ...{ class: "input input-bordered w-full" },
    placeholder: "Kurze Beschreibung",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "divider pt-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-3 gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
/** @type {[typeof CurrencyInput, ]} */ ;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
    modelValue: (__VLS_ctx.monthlyAmount),
    borderless: (false),
}));
const __VLS_16 = __VLS_15({
    modelValue: (__VLS_ctx.monthlyAmount),
    borderless: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
    ...{ class: "input input-bordered" },
    min: "0",
    max: "10",
    placeholder: "0-10",
});
(__VLS_ctx.priority);
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
    ...{ class: "input input-bordered" },
    min: "0",
    max: "100",
    step: "0.1",
    placeholder: "0-100",
});
(__VLS_ctx.proportion);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text text-xs" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-primary" },
});
(__VLS_ctx.isSavingsGoal);
if (__VLS_ctx.isSavingsGoal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        modelValue: (__VLS_ctx.targetAmount),
        borderless: (false),
    }));
    const __VLS_19 = __VLS_18({
        modelValue: (__VLS_ctx.targetAmount),
        borderless: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "date",
        ...{ class: "input input-bordered" },
        placeholder: "tt.mm.jjjj",
    });
    (__VLS_ctx.goalDate);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
    value: (__VLS_ctx.note),
    ...{ class: "textarea textarea-bordered" },
    rows: "3",
    placeholder: "Zusätzliche Informationen zur Kategorie",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end pt-4" },
});
/** @type {[typeof ButtonGroup, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(ButtonGroup, new ButtonGroup({
    ...{ 'onLeftClick': {} },
    ...{ 'onRightClick': {} },
    leftLabel: "Abbrechen",
    rightLabel: "Speichern",
    leftColor: "btn-ghost",
    rightColor: "btn-primary",
}));
const __VLS_22 = __VLS_21({
    ...{ 'onLeftClick': {} },
    ...{ 'onRightClick': {} },
    leftLabel: "Abbrechen",
    rightLabel: "Speichern",
    leftColor: "btn-ghost",
    rightColor: "btn-primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
let __VLS_26;
const __VLS_27 = {
    onLeftClick: (...[$event]) => {
        __VLS_ctx.emit('cancel');
    }
};
const __VLS_28 = {
    onRightClick: (__VLS_ctx.saveCategory)
};
var __VLS_23;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['-top-12']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['alert']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
/** @type {__VLS_StyleScopedClasses['alert-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['list-disc']} */ ;
/** @type {__VLS_StyleScopedClasses['list-inside']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            CurrencyInput: CurrencyInput,
            ButtonGroup: ButtonGroup,
            Icon: Icon,
            emit: emit,
            name: name,
            description: description,
            isActive: isActive,
            isHidden: isHidden,
            isSavingsGoal: isSavingsGoal,
            targetAmount: targetAmount,
            categoryGroupId: categoryGroupId,
            balance: balance,
            goalDate: goalDate,
            priority: priority,
            proportion: proportion,
            monthlyAmount: monthlyAmount,
            note: note,
            showValidationAlert: showValidationAlert,
            validationErrors: validationErrors,
            saveCategory: saveCategory,
            closeValidationAlert: closeValidationAlert,
            categoryGroups: categoryGroups,
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
