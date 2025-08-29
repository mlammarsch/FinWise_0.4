import { ref, computed, watch, onMounted, nextTick, withDefaults } from "vue";
import { toDateOnlyString } from "../../utils/formatters";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import { CategoryService } from "../../services/CategoryService";
import { debugLog } from "../../utils/logger";
import { Icon } from "@iconify/vue";
import { TransactionService } from "../../services/TransactionService";
import ButtonGroup from "../ui/ButtonGroup.vue";
const props = withDefaults(defineProps(), {
    mode: "transfer",
    isIncomeCategory: false,
});
const emit = defineEmits(["close", "transfer"]);
const fromCategoryIdLocal = ref("");
const toCategoryIdLocal = ref("");
const amount = ref(0);
const date = ref("");
const noteLocal = ref("");
const isProcessing = ref(false);
const fromCategoryRef = ref(null);
const toCategoryRef = ref(null);
const amountRef = ref(null);
const normalizedMonthStart = computed(() => props.month ? new Date(toDateOnlyString(props.month.start)) : new Date());
const normalizedMonthEnd = computed(() => props.month ? new Date(toDateOnlyString(props.month.end)) : new Date());
const categoryOptions = computed(() => {
    // Verwende die aktuell relevante Kategorie als Ausgangspunkt
    const clickedCategoryId = fromCategoryIdLocal.value || props.preselectedCategoryId || "";
    const isIncome = !!props.isIncomeCategory;
    return TransactionService.getCategoryTransferOptions(clickedCategoryId, isIncome);
});
const fromCategoryOptions = computed(() => {
    return categoryOptions.value.filter((opt) => opt.value !== toCategoryIdLocal.value);
});
const toCategoryOptions = computed(() => {
    return categoryOptions.value.filter((opt) => opt.value !== fromCategoryIdLocal.value);
});
const availableFromBalance = computed(() => {
    // Die gelieferten Optionen enthalten nur label/value; Saldenanzeige hier nicht verfügbar.
    // Rückgabe 0 als Platzhalter, um Typfehler zu vermeiden.
    return 0;
});
onMounted(() => {
    debugLog("CategoryTransferModal", "mounted - incoming props", { ...props });
});
watch(() => props.isOpen, (open) => {
    if (open) {
        isProcessing.value = false;
        if (props.prefillDate) {
            date.value = props.prefillDate;
        }
        else {
            const defaultDate = props.month
                ? new Date(props.month.end).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0];
            date.value = defaultDate;
        }
        amount.value = props.prefillAmount || 0;
        noteLocal.value = props.note || "";
        if (props.transactionId) {
            fromCategoryIdLocal.value = props.fromCategoryId || "";
            toCategoryIdLocal.value = props.toCategoryId || "";
        }
        else {
            if (props.mode === "transfer" && props.preselectedCategoryId) {
                fromCategoryIdLocal.value = props.preselectedCategoryId;
                // Bei Einnahmen-Kategorien automatisch "Verfügbare Mittel" als Zielkategorie setzen
                if (props.isIncomeCategory) {
                    const availableFundsCat = CategoryService.getAvailableFundsCategory().value;
                    toCategoryIdLocal.value = availableFundsCat?.id || "";
                }
                else {
                    toCategoryIdLocal.value = "";
                }
            }
            else if (props.mode === "fill" && props.preselectedCategoryId) {
                toCategoryIdLocal.value = props.preselectedCategoryId;
                const availableFundsCat = CategoryService.getAvailableFundsCategory().value;
                fromCategoryIdLocal.value = availableFundsCat?.id || "";
            }
            else {
                fromCategoryIdLocal.value = "";
                toCategoryIdLocal.value = "";
            }
        }
        nextTick(() => {
            if (props.transactionId) {
                amountRef.value?.focus();
                amountRef.value?.select();
            }
            else if (props.mode === "fill") {
                if (amount.value > 0) {
                    amountRef.value?.focus();
                    amountRef.value?.select();
                }
                else {
                    fromCategoryRef.value?.focusInput();
                }
            }
            else {
                if (fromCategoryIdLocal.value) {
                    toCategoryRef.value?.focusInput();
                }
                else {
                    fromCategoryRef.value?.focusInput();
                }
            }
        });
        debugLog("CategoryTransferModal", "Initialized state", {
            from: fromCategoryIdLocal.value,
            to: toCategoryIdLocal.value,
            amount: amount.value,
            date: date.value,
            note: noteLocal.value,
            mode: props.mode,
        });
    }
    else {
        fromCategoryIdLocal.value = "";
        toCategoryIdLocal.value = "";
        amount.value = 0;
        date.value = "";
        noteLocal.value = "";
    }
}, { immediate: true });
// Validierung
const submitAttempted = ref(false);
const showValidationAlert = ref(false);
// Validierungsfehler sammeln
const validationErrors = computed(() => {
    const errors = [];
    if (!fromCategoryIdLocal.value)
        errors.push("Von-Kategorie ist erforderlich");
    if (!toCategoryIdLocal.value)
        errors.push("Zu-Kategorie ist erforderlich");
    if (!amount.value || amount.value <= 0)
        errors.push("Betrag muss größer als 0 sein");
    if (!date.value)
        errors.push("Datum ist erforderlich");
    return errors;
});
// Schließt das Validierungs-Alert
const closeValidationAlert = () => {
    showValidationAlert.value = false;
};
async function performTransfer() {
    submitAttempted.value = true;
    if (validationErrors.value.length > 0) {
        showValidationAlert.value = true;
        debugLog("CategoryTransferModal", "Validation failed", validationErrors.value);
        return;
    }
    if (isProcessing.value)
        return;
    showValidationAlert.value = false;
    isProcessing.value = true;
    // Modal SOFORT schließen - Transfer läuft asynchron im Hintergrund
    debugLog("CategoryTransferModal", "Starting background transfer operation");
    emit("transfer");
    emit("close");
    isProcessing.value = false;
    // Transfer-Operation komplett asynchron im Hintergrund ausführen
    setTimeout(async () => {
        try {
            let success = false;
            if (props.transactionId && props.gegentransactionId) {
                debugLog("CategoryTransferModal", "Background: Attempting to update transfer");
                await TransactionService.updateCategoryTransfer(props.transactionId, props.gegentransactionId, fromCategoryIdLocal.value, toCategoryIdLocal.value, amount.value, date.value, noteLocal.value);
                success = true;
            }
            else {
                debugLog("CategoryTransferModal", "Background: Attempting to add transfer");
                const result = await TransactionService.addCategoryTransfer(fromCategoryIdLocal.value, toCategoryIdLocal.value, amount.value, date.value, noteLocal.value);
                success = !!result;
            }
            if (success) {
                debugLog("CategoryTransferModal", "Background transfer completed successfully");
            }
            else {
                debugLog("CategoryTransferModal", "Background transfer failed");
            }
        }
        catch (error) {
            debugLog("CategoryTransferModal", "Background transfer error", error);
        }
    }, 0);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    mode: "transfer",
    isIncomeCategory: false,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onKeydown: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.$emit('close');
            } },
        ...{ class: "modal modal-open" },
        tabindex: "0",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box w-full max-w-lg relative" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.$emit('close');
            } },
        type: "button",
        ...{ class: "btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:close",
        ...{ class: "text-lg" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:close",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4 flex items-center" },
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: "mdi:swap-horizontal-bold",
        ...{ class: "mr-2 text-xl" },
    }));
    const __VLS_6 = __VLS_5({
        icon: "mdi:swap-horizontal-bold",
        ...{ class: "mr-2 text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    if (__VLS_ctx.transactionId) {
    }
    else if (__VLS_ctx.mode === 'fill') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-semibold mx-1" },
        });
        (__VLS_ctx.CategoryService.getCategoryById(__VLS_ctx.toCategoryIdLocal).value?.name ||
            "...");
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "font-semibold mx-1" },
        });
        (__VLS_ctx.CategoryService.getCategoryById(__VLS_ctx.fromCategoryIdLocal).value?.name ||
            "...");
    }
    if (__VLS_ctx.showValidationAlert && __VLS_ctx.validationErrors.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-error alert-soft mb-6" },
        });
        const __VLS_8 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_10 = __VLS_9({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_9));
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
        const __VLS_12 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
            icon: "mdi:close",
            ...{ class: "text-sm" },
        }));
        const __VLS_14 = __VLS_13({
            icon: "mdi:close",
            ...{ class: "text-sm" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.performTransfer) },
        ...{ class: "flex flex-col space-y-4 w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.mode !== 'transfer') }, null, null);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1 select-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    /** @type {[typeof SelectCategory, ]} */ ;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
        ref: "fromCategoryRef",
        modelValue: (__VLS_ctx.fromCategoryIdLocal),
        options: (__VLS_ctx.fromCategoryOptions),
        placeholder: "Auswählen...",
    }));
    const __VLS_17 = __VLS_16({
        ref: "fromCategoryRef",
        modelValue: (__VLS_ctx.fromCategoryIdLocal),
        options: (__VLS_ctx.fromCategoryOptions),
        placeholder: "Auswählen...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    /** @type {typeof __VLS_ctx.fromCategoryRef} */ ;
    var __VLS_19 = {};
    var __VLS_18;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.mode !== 'fill') }, null, null);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1 select-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    /** @type {[typeof SelectCategory, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
        ref: "toCategoryRef",
        modelValue: (__VLS_ctx.toCategoryIdLocal),
        options: (__VLS_ctx.toCategoryOptions),
        placeholder: "Auswählen...",
    }));
    const __VLS_22 = __VLS_21({
        ref: "toCategoryRef",
        modelValue: (__VLS_ctx.toCategoryIdLocal),
        options: (__VLS_ctx.toCategoryOptions),
        placeholder: "Auswählen...",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    /** @type {typeof __VLS_ctx.toCategoryRef} */ ;
    var __VLS_24 = {};
    var __VLS_23;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1 select-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        ref: "amountRef",
        modelValue: (__VLS_ctx.amount),
        ...{ class: (__VLS_ctx.amount > __VLS_ctx.availableFromBalance ? 'input-error' : '') },
    }));
    const __VLS_27 = __VLS_26({
        ref: "amountRef",
        modelValue: (__VLS_ctx.amount),
        ...{ class: (__VLS_ctx.amount > __VLS_ctx.availableFromBalance ? 'input-error' : '') },
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    /** @type {typeof __VLS_ctx.amountRef} */ ;
    var __VLS_29 = {};
    var __VLS_28;
    if (__VLS_ctx.fromCategoryIdLocal) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text-alt flex items-center" },
            ...{ class: (__VLS_ctx.availableFromBalance < __VLS_ctx.amount && __VLS_ctx.availableFromBalance < 0
                    ? 'text-error'
                    : __VLS_ctx.availableFromBalance < __VLS_ctx.amount
                        ? 'text-warning'
                        : 'text-base-content/70') },
        });
        const __VLS_31 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_32 = __VLS_asFunctionalComponent(__VLS_31, new __VLS_31({
            icon: (__VLS_ctx.availableFromBalance < __VLS_ctx.amount
                ? 'mdi:alert-circle-outline'
                : 'mdi:information-outline'),
            ...{ class: "mr-1" },
        }));
        const __VLS_33 = __VLS_32({
            icon: (__VLS_ctx.availableFromBalance < __VLS_ctx.amount
                ? 'mdi:alert-circle-outline'
                : 'mdi:information-outline'),
            ...{ class: "mr-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_32));
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_35 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.availableFromBalance),
            showZero: (true),
            asInteger: (true),
        }));
        const __VLS_36 = __VLS_35({
            amount: (__VLS_ctx.availableFromBalance),
            showZero: (true),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1 select-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "date",
        ...{ class: "input input-bordered w-full" },
        required: true,
    });
    (__VLS_ctx.date);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "text-sm font-semibold mb-1 select-none" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "text",
        value: (__VLS_ctx.noteLocal),
        ...{ class: "input input-bordered w-full" },
        placeholder: "Grund für die Übertragung (optional)",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action mt-6" },
    });
    /** @type {[typeof ButtonGroup, ]} */ ;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent(ButtonGroup, new ButtonGroup({
        ...{ 'onLeftClick': {} },
        ...{ 'onRightClick': {} },
        leftLabel: "Abbrechen",
        rightLabel: (__VLS_ctx.transactionId ? 'Speichern' : 'Übertragen'),
        leftColor: "btn-ghost",
        rightColor: "btn-primary",
        rightDisabled: (__VLS_ctx.isProcessing),
    }));
    const __VLS_39 = __VLS_38({
        ...{ 'onLeftClick': {} },
        ...{ 'onRightClick': {} },
        leftLabel: "Abbrechen",
        rightLabel: (__VLS_ctx.transactionId ? 'Speichern' : 'Übertragen'),
        leftColor: "btn-ghost",
        rightColor: "btn-primary",
        rightDisabled: (__VLS_ctx.isProcessing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    let __VLS_41;
    let __VLS_42;
    let __VLS_43;
    const __VLS_44 = {
        onLeftClick: (...[$event]) => {
            if (!(__VLS_ctx.isOpen))
                return;
            __VLS_ctx.$emit('close');
        }
    };
    const __VLS_45 = {
        onRightClick: (__VLS_ctx.performTransfer)
    };
    var __VLS_40;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isOpen))
                    return;
                __VLS_ctx.$emit('close');
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text-alt']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
// @ts-ignore
var __VLS_20 = __VLS_19, __VLS_25 = __VLS_24, __VLS_30 = __VLS_29;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            CurrencyInput: CurrencyInput,
            SelectCategory: SelectCategory,
            CategoryService: CategoryService,
            Icon: Icon,
            ButtonGroup: ButtonGroup,
            fromCategoryIdLocal: fromCategoryIdLocal,
            toCategoryIdLocal: toCategoryIdLocal,
            amount: amount,
            date: date,
            noteLocal: noteLocal,
            isProcessing: isProcessing,
            fromCategoryRef: fromCategoryRef,
            toCategoryRef: toCategoryRef,
            amountRef: amountRef,
            fromCategoryOptions: fromCategoryOptions,
            toCategoryOptions: toCategoryOptions,
            availableFromBalance: availableFromBalance,
            showValidationAlert: showValidationAlert,
            validationErrors: validationErrors,
            closeValidationAlert: closeValidationAlert,
            performTransfer: performTransfer,
        };
    },
    emits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    emits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
