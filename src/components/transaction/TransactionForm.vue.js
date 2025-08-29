// src/components/transaction/TransactionForm.vue
import { ref, computed, onMounted, watch } from "vue";
import { TransactionType } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import DatePicker from "../ui/DatePicker.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import ButtonGroup from "../ui/ButtonGroup.vue";
import TagSearchableDropdown from "../ui/TagSearchableDropdown.vue";
import SelectAccount from "../ui/SelectAccount.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import SelectRecipient from "../ui/SelectRecipient.vue";
import { debugLog } from "../../utils/logger"; // Korrigierter Pfad
import { toDateOnlyString } from "../../utils/formatters";
import { CategoryService } from "../../services/CategoryService"; // CategoryService importiert
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["save", "cancel"]);
const accountStore = useAccountStore();
const recipientStore = useRecipientStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const date = ref(new Date().toISOString().split("T")[0]);
const valueDate = ref(date.value);
const valueDateManuallyChanged = ref(false);
const transactionType = ref(TransactionType.EXPENSE);
const accountId = ref("");
const toAccountId = ref("");
const categoryId = ref("");
const tagIds = ref([]);
const amount = ref(0);
const note = ref("");
const recipientId = ref("");
const reconciled = ref(false);
const recipientsLoaded = ref(false);
const submitAttempted = ref(false);
const isSubmitting = ref(false);
const showValidationAlert = ref(false);
const amountInputRef = ref(null);
const formModalRef = ref(null);
const locked = computed(() => false); // Erlaube Typ-Änderungen für alle Transaktionen
const recipients = computed(() => Array.isArray(recipientStore.recipients) ? recipientStore.recipients : []);
const categories = computed(() => categoryStore.categories.map((c) => ({ id: c.id, name: c.name })));
const tags = computed(() => tagStore.tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
})));
const isTransfer = computed(() => transactionType.value === TransactionType.ACCOUNTTRANSFER);
const accounts = computed(() => accountStore.activeAccounts.map((a) => ({ id: a.id, name: a.name })));
const filteredAccounts = computed(() => accounts.value.filter((a) => a.id !== accountId.value));
const focusModalAndAmount = () => {
    // Verzögerung hinzufügen, damit das Modal vollständig sichtbar ist
    setTimeout(() => {
        if (amountInputRef.value) {
            amountInputRef.value.focus();
            amountInputRef.value.select();
        }
    }, 100);
};
onMounted(() => {
    recipientsLoaded.value = true;
    if (props.transaction && props.transaction !== null) {
        // Bestehende Transaktion → Felder ausfüllen
        date.value = props.transaction.date;
        valueDate.value =
            props.transaction.valueDate || props.transaction.date;
        accountId.value = props.transaction.accountId;
        categoryId.value = props.transaction.categoryId || "";
        tagIds.value = Array.isArray(props.transaction.tagIds)
            ? props.transaction.tagIds
            : [];
        amount.value = props.transaction.amount ?? 0;
        note.value = props.transaction.note || "";
        recipientId.value = props.transaction.recipientId || "";
        transactionType.value =
            props.transaction.type || TransactionType.EXPENSE;
        reconciled.value = props.transaction.reconciled || false;
        if (transactionType.value === TransactionType.ACCOUNTTRANSFER) {
            toAccountId.value = props.transaction.transferToAccountId || "";
        }
        valueDateManuallyChanged.value = valueDate.value !== date.value;
    }
    else {
        // Neue Transaktion → Initialwerte setzen
        accountId.value =
            props.defaultAccountId ||
                props.initialAccountId ||
                accountStore.activeAccounts[0]?.id ||
                "";
        transactionType.value =
            props.initialTransactionType || TransactionType.EXPENSE;
        categoryId.value = props.initialCategoryId || "";
        tagIds.value = props.initialTagIds || [];
        reconciled.value = false;
        valueDate.value = date.value;
        valueDateManuallyChanged.value = false;
        debugLog("[TransactionForm]", "initial accountId set:", accountId.value);
    }
    focusModalAndAmount();
});
// Watcher für das Prop defaultAccountId
watch(() => props.defaultAccountId, (newVal) => {
    if (newVal) {
        accountId.value = newVal;
        debugLog("[TransactionForm]", "defaultAccountId watcher updated:", newVal);
    }
});
watch(() => props.isEdit, (newValue) => newValue && focusModalAndAmount());
watch([date, valueDate, recipientId, categoryId, transactionType], () => {
    focusModalAndAmount();
});
watch(date, (newDate) => {
    if (!valueDateManuallyChanged.value) {
        valueDate.value = newDate;
    }
});
watch(valueDate, (val) => {
    valueDateManuallyChanged.value = val !== date.value;
});
watch(amount, (newAmount) => {
    if (locked.value || transactionType.value === TransactionType.ACCOUNTTRANSFER)
        return;
    transactionType.value = toAccountId.value
        ? TransactionType.ACCOUNTTRANSFER
        : newAmount < 0
            ? TransactionType.EXPENSE
            : newAmount > 0
                ? TransactionType.INCOME
                : transactionType.value;
});
watch(transactionType, (newType, oldType) => {
    if (newType !== TransactionType.ACCOUNTTRANSFER) {
        toAccountId.value = "";
    }
    // Behandle Typ-Änderung von ACCOUNTTRANSFER zu EXPENSE/INCOME
    if (oldType === TransactionType.ACCOUNTTRANSFER &&
        (newType === TransactionType.EXPENSE ||
            newType === TransactionType.INCOME) &&
        props.transaction &&
        props.transaction.counterTransactionId) {
        // Markiere, dass die Gegenbuchung gelöscht werden soll
        debugLog("[TransactionForm]", "Transfer wird zu normaler Buchung geändert", {
            oldType,
            newType,
            counterTransactionId: props.transaction.counterTransactionId,
        });
    }
    if (newType === TransactionType.EXPENSE && amount.value > 0) {
        amount.value = -Math.abs(amount.value);
    }
    else if (newType === TransactionType.INCOME && amount.value < 0) {
        amount.value = Math.abs(amount.value);
    }
});
watch(toAccountId, (newToAccountId) => {
    if (!locked.value && newToAccountId) {
        transactionType.value = TransactionType.ACCOUNTTRANSFER;
    }
});
const validationErrors = computed(() => {
    const errors = [];
    if (!date.value)
        errors.push("Buchungsdatum ist erforderlich");
    if (!amount.value || amount.value === 0)
        errors.push("Betrag ist erforderlich");
    if (!accountId.value)
        errors.push("Konto ist erforderlich");
    if (transactionType.value === TransactionType.ACCOUNTTRANSFER &&
        !toAccountId.value) {
        errors.push("Gegenkonto ist erforderlich");
    }
    return errors;
});
async function onCreateCategory(newCategoryInput) {
    // Die 'id' von newCategoryInput wird hier nicht direkt verwendet, da der Service/Store die ID generiert.
    // Annahme: Beim Erstellen über dieses Formular handelt es sich um eine Top-Level-Kategorie ohne spezielle Gruppe oder Icon.
    try {
        const newCategoryData = {
            name: newCategoryInput.name,
            parentCategoryId: undefined,
            sortOrder: categoryStore.categories.length,
            categoryGroupId: undefined,
            icon: undefined,
            // Standardwerte für weitere Felder, die `addCategory` erwartet, falls nötig
            budgeted: 0,
            activity: 0,
            available: 0,
            isIncomeCategory: false, // Standardmäßig false, wird ggf. durch Gruppe überschrieben
            isHidden: false,
            isActive: true,
            isSavingsGoal: false,
        };
        const created = await CategoryService.addCategory(newCategoryData);
        if (created) {
            categoryId.value = created.id;
        }
        else {
            // Fehlerbehandlung, falls `addCategory` null zurückgibt
            debugLog("[TransactionForm]", "onCreateCategory - Category creation via Service returned null");
            // Hier könnte eine Fehlermeldung für den Benutzer angezeigt werden
        }
        debugLog("[TransactionForm]", "onCreateCategory - Category created via Service:", created);
    }
    catch (error) {
        debugLog("[TransactionForm]", "onCreateCategory - Error creating category via Service:", error);
        // Hier könnte eine Fehlermeldung für den Benutzer angezeigt werden
        // z.B. mit einem Toast-Service: toast.error("Fehler beim Erstellen der Kategorie.");
    }
}
async function onCreateTag(newTag) {
    const created = await tagStore.addTag({
        name: newTag.name,
        parentTagId: null, // Standardwert
        color: newTag.color, // Verwende die zufällige Farbe von TagSearchableDropdown
    });
    tagIds.value = [...tagIds.value, created.id];
    debugLog("[TransactionForm]", "onCreateTag - Tag created:", created);
}
async function onCreateRecipient(newRecipient) {
    const created = await recipientStore.addRecipient({
        name: newRecipient.name,
    });
    recipientId.value = created.id;
    debugLog("[TransactionForm]", "onCreateRecipient - Recipient created:", created);
}
const saveTransaction = () => {
    const getValidValueDate = () => {
        debugLog("[TransactionForm]", "getValidValueDate - Input values:", {
            dateValue: date.value,
            valueDateValue: valueDate.value,
            isInvalidDate: new Date(valueDate.value).toString() === "Invalid Date",
        });
        // Prüft, ob valueDate.value ein gültiger String für new Date() ist
        // und nicht 'Invalid Date' ergibt.
        if (valueDate.value &&
            new Date(valueDate.value).toString() !== "Invalid Date") {
            const formatted = toDateOnlyString(valueDate.value);
            debugLog("[TransactionForm]", "getValidValueDate - Using valueDate.value, formatted:", formatted);
            return formatted;
        }
        const formattedFallback = toDateOnlyString(date.value);
        debugLog("[TransactionForm]", "getValidValueDate - Using date.value (fallback), formatted:", formattedFallback);
        return formattedFallback; // Fallback auf date.value
    };
    const currentValidValueDate = getValidValueDate();
    const currentDate = toDateOnlyString(date.value);
    if (transactionType.value === TransactionType.ACCOUNTTRANSFER) {
        return {
            type: transactionType.value,
            fromAccountId: accountId.value,
            toAccountId: toAccountId.value,
            amount: Math.abs(amount.value),
            date: currentDate,
            valueDate: currentValidValueDate,
            note: note.value,
            reconciled: reconciled.value,
        };
    }
    else {
        const payload = {
            date: currentDate,
            valueDate: currentValidValueDate,
            accountId: accountId.value,
            categoryId: categoryId.value,
            tagIds: tagIds.value,
            amount: amount.value,
            note: note.value,
            recipientId: recipientId.value || undefined,
            reconciled: reconciled.value,
            type: transactionType.value,
            counterTransactionId: null,
            planningTransactionId: null,
            isReconciliation: false,
            runningBalance: 0,
        };
        // Prüfe, ob es sich um eine Typ-Änderung von Transfer zu normaler Buchung handelt
        if (props.transaction &&
            props.transaction.type === TransactionType.ACCOUNTTRANSFER &&
            props.transaction.counterTransactionId &&
            (transactionType.value === TransactionType.EXPENSE ||
                transactionType.value === TransactionType.INCOME)) {
            debugLog("[TransactionForm]", "Transfer wird zu normaler Buchung konvertiert", {
                originalType: props.transaction.type,
                newType: transactionType.value,
                counterTransactionId: props.transaction.counterTransactionId,
            });
            // Füge spezielle Flags für die Verarbeitung hinzu
            payload.isTransferConversion = true;
            payload.originalCounterTransactionId = props.transaction.counterTransactionId;
            payload.originalTransferToAccountId = props.transaction.transferToAccountId;
        }
        return payload;
    }
};
const submitForm = () => {
    debugLog("[TransactionForm]", "submitForm initiated");
    if (isSubmitting.value) {
        debugLog("[TransactionForm]", "submitForm aborted: already submitting");
        return;
    }
    isSubmitting.value = true;
    submitAttempted.value = true;
    if (validationErrors.value.length > 0) {
        showValidationAlert.value = true;
        debugLog("[TransactionForm]", "submitForm aborted: validation errors", {
            errors: validationErrors.value,
        });
        isSubmitting.value = false;
        return;
    }
    showValidationAlert.value = false;
    const transactionPayload = saveTransaction();
    debugLog("[TransactionForm]", "submitForm payload:", {
        payload: transactionPayload,
    });
    emit("save", transactionPayload);
    isSubmitting.value = false;
};
/**
 * Schließt das Validierungs-Alert.
 */
const closeValidationAlert = () => {
    showValidationAlert.value = false;
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (!__VLS_ctx.recipientsLoaded) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center p-4" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "relative" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.recipientsLoaded))
                    return;
                __VLS_ctx.emit('cancel');
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
        ...{ class: "font-bold text-lg mb-4" },
    });
    (props.transaction ? "Transaktionsbearbeitung" : "Transaktionserstellung");
    if (__VLS_ctx.showValidationAlert && __VLS_ctx.validationErrors.length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "alert alert-error alert-soft mb-6" },
        });
        const __VLS_4 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }));
        const __VLS_6 = __VLS_5({
            icon: "mdi:alert-circle",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_5));
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
        const __VLS_8 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
            icon: "mdi:close",
            ...{ class: "text-sm" },
        }));
        const __VLS_10 = __VLS_9({
            icon: "mdi:close",
            ...{ class: "text-sm" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.submitForm) },
        ...{ onKeydown: (...[$event]) => {
                if (!!(!__VLS_ctx.recipientsLoaded))
                    return;
                __VLS_ctx.emit('cancel');
            } },
        ref: "formModalRef",
        novalidate: true,
        tabindex: "-1",
        ...{ class: "space-y-4 max-w-[calc(100%-80px)] mx-auto relative" },
    });
    /** @type {typeof __VLS_ctx.formModalRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-row justify-between items-start" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-center gap-4 pt-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "radio",
        ...{ class: "radio radio-sm border-neutral checked:bg-error/60 checked:text-error checked:border-error" },
        value: (__VLS_ctx.TransactionType.EXPENSE),
        disabled: (__VLS_ctx.locked),
    });
    (__VLS_ctx.transactionType);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "radio",
        ...{ class: "radio radio-sm border-neutral checked:bg-success/60 checked:text-success checked:border-success" },
        value: (__VLS_ctx.TransactionType.INCOME),
        disabled: (__VLS_ctx.locked),
    });
    (__VLS_ctx.transactionType);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "flex items-center gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "radio",
        ...{ class: "radio radio-sm border-neutral checked:bg-warning/60 checked:text-warning checked:border-warning" },
        value: (__VLS_ctx.TransactionType.ACCOUNTTRANSFER),
    });
    (__VLS_ctx.transactionType);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "flex items-center gap-2 text-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "checkbox",
        ...{ class: "checkbox checkbox-xs" },
    });
    (__VLS_ctx.reconciled);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-3 gap-4 items-end" },
    });
    /** @type {[typeof DatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent(DatePicker, new DatePicker({
        modelValue: (__VLS_ctx.date),
        label: "Buchungsdatum (Pflicht)",
        required: true,
        ...{ class: "self-end fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
    }));
    const __VLS_13 = __VLS_12({
        modelValue: (__VLS_ctx.date),
        label: "Buchungsdatum (Pflicht)",
        required: true,
        ...{ class: "self-end fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    /** @type {[typeof DatePicker, ]} */ ;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(DatePicker, new DatePicker({
        modelValue: (__VLS_ctx.valueDate),
        label: "Wertstellung",
        required: true,
        ...{ class: "self-end fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
    }));
    const __VLS_16 = __VLS_15({
        modelValue: (__VLS_ctx.valueDate),
        label: "Wertstellung",
        required: true,
        ...{ class: "self-end fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end items-center gap-2 self-end" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        ref: "amountInputRef",
        modelValue: (__VLS_ctx.amount),
        ...{ class: "w-[150px] focus:outline-none focus:ring-2 focus:ring-accent" },
    }));
    const __VLS_19 = __VLS_18({
        ref: "amountInputRef",
        modelValue: (__VLS_ctx.amount),
        ...{ class: "w-[150px] focus:outline-none focus:ring-2 focus:ring-accent" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    /** @type {typeof __VLS_ctx.amountInputRef} */ ;
    var __VLS_21 = {};
    var __VLS_20;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-3xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-start justify-between gap-2 mt-5" },
    });
    const __VLS_23 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_24 = __VLS_asFunctionalComponent(__VLS_23, new __VLS_23({
        icon: "mdi:speaker-notes",
    }));
    const __VLS_25 = __VLS_24({
        icon: "mdi:speaker-notes",
    }, ...__VLS_functionalComponentArgsRest(__VLS_24));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.note),
        ...{ class: "textarea textarea-bordered w-full min-h-[3rem] fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
        placeholder: "Notiz",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider pt-5" },
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
    /** @type {[typeof SelectAccount, ]} */ ;
    // @ts-ignore
    const __VLS_27 = __VLS_asFunctionalComponent(SelectAccount, new SelectAccount({
        modelValue: (__VLS_ctx.accountId),
    }));
    const __VLS_28 = __VLS_27({
        modelValue: (__VLS_ctx.accountId),
    }, ...__VLS_functionalComponentArgsRest(__VLS_27));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.toAccountId),
        ...{ class: "select select-bordered focus:outline-none focus:ring-2 focus:ring-accent w-full" },
        disabled: (!__VLS_ctx.isTransfer),
    });
    for (const [a] of __VLS_getVForSourceType((__VLS_ctx.filteredAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (a.id),
            value: (a.id),
        });
        (a.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider pt-5" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    /** @type {[typeof SelectRecipient, ]} */ ;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent(SelectRecipient, new SelectRecipient({
        ...{ 'onCreate': {} },
        modelValue: (__VLS_ctx.recipientId),
        ...{ class: (__VLS_ctx.isTransfer ? 'opacity-50' : '') },
        disabled: (__VLS_ctx.isTransfer),
    }));
    const __VLS_31 = __VLS_30({
        ...{ 'onCreate': {} },
        modelValue: (__VLS_ctx.recipientId),
        ...{ class: (__VLS_ctx.isTransfer ? 'opacity-50' : '') },
        disabled: (__VLS_ctx.isTransfer),
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    let __VLS_33;
    let __VLS_34;
    let __VLS_35;
    const __VLS_36 = {
        onCreate: (__VLS_ctx.onCreateRecipient)
    };
    var __VLS_32;
    if (__VLS_ctx.transactionType !== __VLS_ctx.TransactionType.ACCOUNTTRANSFER) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        /** @type {[typeof SelectCategory, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
            modelValue: (__VLS_ctx.categoryId),
        }));
        const __VLS_38 = __VLS_37({
            modelValue: (__VLS_ctx.categoryId),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        /** @type {[typeof TagSearchableDropdown, ]} */ ;
        // @ts-ignore
        const __VLS_40 = __VLS_asFunctionalComponent(TagSearchableDropdown, new TagSearchableDropdown({
            ...{ 'onCreate': {} },
            ...{ class: "fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
            modelValue: (__VLS_ctx.tagIds),
            options: (__VLS_ctx.tags),
        }));
        const __VLS_41 = __VLS_40({
            ...{ 'onCreate': {} },
            ...{ class: "fieldset focus:outline-none focus:ring-2 focus:ring-accent" },
            modelValue: (__VLS_ctx.tagIds),
            options: (__VLS_ctx.tags),
        }, ...__VLS_functionalComponentArgsRest(__VLS_40));
        let __VLS_43;
        let __VLS_44;
        let __VLS_45;
        const __VLS_46 = {
            onCreate: (__VLS_ctx.onCreateTag)
        };
        var __VLS_42;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end pt-5" },
    });
    /** @type {[typeof ButtonGroup, ]} */ ;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent(ButtonGroup, new ButtonGroup({
        ...{ 'onLeftClick': {} },
        ...{ 'onRightClick': {} },
        leftLabel: "Abbrechen",
        rightLabel: "Speichern",
        leftColor: "btn-soft",
        rightColor: "btn-primary",
    }));
    const __VLS_48 = __VLS_47({
        ...{ 'onLeftClick': {} },
        ...{ 'onRightClick': {} },
        leftLabel: "Abbrechen",
        rightLabel: "Speichern",
        leftColor: "btn-soft",
        rightColor: "btn-primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_50;
    let __VLS_51;
    let __VLS_52;
    const __VLS_53 = {
        onLeftClick: (...[$event]) => {
            if (!!(!__VLS_ctx.recipientsLoaded))
                return;
            __VLS_ctx.emit('cancel');
        }
    };
    const __VLS_54 = {
        onRightClick: (__VLS_ctx.submitForm)
    };
    var __VLS_49;
}
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
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
/** @type {__VLS_StyleScopedClasses['max-w-[calc(100%-80px)]']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:bg-error/60']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:border-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:bg-success/60']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:border-success']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:bg-warning/60']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:border-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['w-[150px]']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[3rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
// @ts-ignore
var __VLS_22 = __VLS_21;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            TransactionType: TransactionType,
            DatePicker: DatePicker,
            CurrencyInput: CurrencyInput,
            ButtonGroup: ButtonGroup,
            TagSearchableDropdown: TagSearchableDropdown,
            SelectAccount: SelectAccount,
            SelectCategory: SelectCategory,
            SelectRecipient: SelectRecipient,
            Icon: Icon,
            emit: emit,
            date: date,
            valueDate: valueDate,
            transactionType: transactionType,
            accountId: accountId,
            toAccountId: toAccountId,
            categoryId: categoryId,
            tagIds: tagIds,
            amount: amount,
            note: note,
            recipientId: recipientId,
            reconciled: reconciled,
            recipientsLoaded: recipientsLoaded,
            showValidationAlert: showValidationAlert,
            amountInputRef: amountInputRef,
            formModalRef: formModalRef,
            locked: locked,
            tags: tags,
            isTransfer: isTransfer,
            filteredAccounts: filteredAccounts,
            validationErrors: validationErrors,
            onCreateTag: onCreateTag,
            onCreateRecipient: onCreateRecipient,
            submitForm: submitForm,
            closeValidationAlert: closeValidationAlert,
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
