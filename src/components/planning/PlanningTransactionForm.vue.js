import { ref, computed, onMounted, watch, nextTick } from "vue";
import { RecurrencePattern, TransactionType, AmountType, RecurrenceEndType, WeekendHandlingType, } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTagStore } from "../../stores/tagStore";
import { useRecipientStore } from "../../stores/recipientStore";
import { useRuleStore } from "@/stores/ruleStore";
import dayjs from "dayjs";
import SelectAccount from "../ui/SelectAccount.vue";
import SelectCategory from "../ui/SelectCategory.vue";
import SelectRecipient from "../ui/SelectRecipient.vue";
import CurrencyInput from "../ui/CurrencyInput.vue";
import TagSearchableDropdown from "../ui/TagSearchableDropdown.vue";
import { debugLog, errorLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import { formatDate } from "@/utils/formatters";
import { createRecurrenceDescription, calculateUpcomingDates, } from "@/utils/dateUtils";
import { getInitialRuleValues, } from "@/utils/planningTransactionUtils";
const props = defineProps();
const emit = defineEmits(["save", "cancel"]);
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const ruleStore = useRuleStore();
// Formular-Refs
const planningFormRef = ref(null);
const nameInputRef = ref(null);
const amountInputRef = ref(null);
// Grundlegende Informationen
const name = ref("");
const note = ref("");
const amount = ref(0);
const amountType = ref(AmountType.EXACT);
const approximateAmount = ref(0);
const minAmount = ref(0);
const maxAmount = ref(0);
const startDate = ref(dayjs().format("YYYY-MM-DD"));
const valueDate = ref(startDate.value);
const valueDateManuallyChanged = ref(false);
const accountId = ref("");
const categoryId = ref(null); // Holds category für Expense/Income, OR target category für CategoryTransfer
const fromCategoryId = ref(null); // Holds source category für CategoryTransfer
const tagIds = ref([]);
const recipientId = ref(null);
const transactionType = ref(TransactionType.EXPENSE);
const toAccountId = ref("");
// Normalisierte Computed-Modelle für v-model Bindings (vermeiden null vs. undefined Typkonflikte)
const recipientIdModel = computed({
    get: () => (recipientId.value ?? undefined),
    set: (v) => {
        recipientId.value = (v ?? null);
    },
});
const categoryIdModel = computed({
    get: () => (categoryId.value ?? undefined),
    set: (v) => {
        categoryId.value = (v ?? null);
    },
});
const fromCategoryIdModel = computed({
    get: () => (fromCategoryId.value ?? undefined),
    set: (v) => {
        fromCategoryId.value = (v ?? null);
    },
});
// Validierungsstatus
const formAttempted = ref(false);
const validationErrors = ref([]);
const showValidationAlert = ref(false);
// Tab-Management
const activeTab = ref("categorization");
// Wiederholungseinstellungen
const repeatsEnabled = ref(false);
const recurrencePattern = ref(RecurrencePattern.MONTHLY);
const recurrenceEndType = ref(RecurrenceEndType.NEVER);
const recurrenceCount = ref(12);
const endDate = ref(null);
const executionDay = ref(null);
const weekendHandling = ref(WeekendHandlingType.NONE);
const moveScheduleEnabled = ref(false);
const weekendHandlingDirection = ref("after");
// Prognosebuchung und Aktivitätsstatus
const forecastOnly = ref(false);
const isActive = ref(true);
// Regel-Modal
const showRuleCreationModal = ref(false);
// Berechnete Felder
const dateDescription = ref("");
const upcomingDates = ref([]);
// Computed Properties
const isExpense = computed(() => transactionType.value === TransactionType.EXPENSE);
const isIncome = computed(() => transactionType.value === TransactionType.INCOME);
const isAccountTransfer = computed(() => transactionType.value === TransactionType.ACCOUNTTRANSFER);
const isCategoryTransfer = computed(() => transactionType.value === TransactionType.CATEGORYTRANSFER);
const accounts = computed(() => accountStore.activeAccounts);
const categories = computed(() => categoryStore.activeCategories);
const filteredAccounts = computed(() => (accounts.value || []).filter((acc) => acc.id !== accountId.value));
const filteredCategories = computed(() => (categories.value || []).filter((cat) => cat.id !== fromCategoryId.value));
const isNameValid = computed(() => !!name.value?.trim());
const isAmountValid = computed(() => typeof amount.value === "number" && amount.value !== 0);
const isStartDateValid = computed(() => !!startDate.value);
const isValueDateValid = computed(() => !!valueDate.value);
const isAccountIdRequired = computed(() => isExpense.value || isIncome.value || isAccountTransfer.value);
const isAccountIdValid = computed(() => !isAccountIdRequired.value || !!accountId.value);
const isCategoryIdRequired = computed(() => isExpense.value || isIncome.value);
const isCategoryIdValid = computed(() => !isCategoryIdRequired.value || !!categoryId.value);
// Empfänger ist nicht mehr Pflichtfeld
const isRecipientIdRequired = computed(() => false);
const isRecipientIdValid = computed(() => true);
const isToAccountIdRequired = computed(() => isAccountTransfer.value);
const isToAccountIdValid = computed(() => !isToAccountIdRequired.value || !!toAccountId.value);
const isFromCategoryIdRequired = computed(() => isCategoryTransfer.value);
const isFromCategoryIdValid = computed(() => !isFromCategoryIdRequired.value || !!fromCategoryId.value);
const isTargetCategoryIdRequired = computed(() => isCategoryTransfer.value);
const isTargetCategoryIdValid = computed(() => !isTargetCategoryIdRequired.value || !!categoryId.value);
const isFormValid = computed(() => {
    return (isNameValid.value &&
        isAmountValid.value &&
        isStartDateValid.value &&
        isValueDateValid.value &&
        isAccountIdValid.value &&
        isCategoryIdValid.value &&
        isRecipientIdValid.value &&
        isToAccountIdValid.value &&
        isFromCategoryIdValid.value &&
        isTargetCategoryIdValid.value);
});
// Lifecycle
onMounted(() => {
    loadTransactionData();
    updateDateDescription();
    calculateUpcomingDatesWrapper();
    formAttempted.value = false;
    // Fokus-Verhalten nach dem Laden der Daten mit Verzögerung für Modal-Sichtbarkeit
    setTimeout(() => {
        if (props.isEdit && props.transaction) {
            // Bei Edit: Fokus auf Betragsfeld und Inhalt markieren
            if (amountInputRef.value) {
                amountInputRef.value.focus();
                amountInputRef.value.select();
            }
        }
        else {
            // Bei Create: Fokus auf Name-Feld
            if (nameInputRef.value) {
                nameInputRef.value.focus();
            }
        }
    }, 150);
});
// Watchers (Datum, Typ, Betr, Transfers)
watch(startDate, (newDate) => {
    if (!valueDateManuallyChanged.value)
        valueDate.value = newDate;
    if (formAttempted.value)
        isStartDateValid.value;
});
watch(valueDate, (val) => {
    valueDateManuallyChanged.value = val !== startDate.value;
    if (formAttempted.value)
        isValueDateValid.value;
});
watch([
    startDate,
    recurrencePattern,
    repeatsEnabled,
    executionDay,
    moveScheduleEnabled,
    weekendHandlingDirection,
    recurrenceEndType,
    recurrenceCount,
    endDate,
], () => {
    updateDateDescription();
    calculateUpcomingDatesWrapper();
}, { deep: true });
watch(transactionType, (newType, oldType) => {
    debugLog(`Transaction type changed FROM ${oldType} TO ${newType}`);
    if (newType !== oldType) {
        // Reset fields
        if (oldType === TransactionType.CATEGORYTRANSFER ||
            newType !== TransactionType.CATEGORYTRANSFER) {
            debugLog("Clearing fromCategoryId");
            fromCategoryId.value = null;
            if (newType !== TransactionType.EXPENSE &&
                newType !== TransactionType.INCOME &&
                newType !== TransactionType.CATEGORYTRANSFER) {
                categoryId.value = null;
            }
            else if (newType === TransactionType.CATEGORYTRANSFER) {
                categoryId.value = null;
            }
        }
        if (oldType === TransactionType.ACCOUNTTRANSFER ||
            newType !== TransactionType.ACCOUNTTRANSFER) {
            toAccountId.value = "";
        }
    }
    // Amount sign adjustment
    let effectiveAmount = amount.value;
    if (newType === TransactionType.ACCOUNTTRANSFER ||
        newType === TransactionType.CATEGORYTRANSFER) {
        amount.value = Math.abs(effectiveAmount);
    }
    else if (newType === TransactionType.EXPENSE && effectiveAmount >= 0) {
        amount.value = -Math.abs(effectiveAmount);
    }
    else if (newType === TransactionType.INCOME && effectiveAmount <= 0) {
        amount.value = Math.abs(effectiveAmount);
    }
    debugLog(`Amount after type change: ${amount.value}`);
    if (formAttempted.value)
        nextTick(() => {
            void isAmountValid.value;
        });
});
watch(amount, (newAmt) => {
    if (!isAccountTransfer.value && !isCategoryTransfer.value) {
        if (newAmt < 0 && transactionType.value !== TransactionType.EXPENSE) {
            transactionType.value = TransactionType.EXPENSE;
        }
        else if (newAmt > 0 && transactionType.value !== TransactionType.INCOME) {
            transactionType.value = TransactionType.INCOME;
        }
    }
    if (formAttempted.value)
        isAmountValid.value;
});
watch(fromCategoryId, (newId) => {
    if (isCategoryTransfer.value && newId === categoryId.value) {
        categoryId.value = null;
    }
    if (formAttempted.value)
        isFromCategoryIdValid.value;
});
watch(categoryId, (newId) => {
    if (isCategoryTransfer.value && newId === fromCategoryId.value) {
        fromCategoryId.value = null;
    }
    if (formAttempted.value) {
        isCategoryIdValid.value;
        isTargetCategoryIdValid.value;
    }
});
watch(accountId, (newId) => {
    if (isAccountTransfer.value && newId === toAccountId.value) {
        toAccountId.value = "";
    }
    if (formAttempted.value)
        isAccountIdValid.value;
});
watch(toAccountId, (newId) => {
    if (isAccountTransfer.value && newId === accountId.value) {
        accountId.value = "";
    }
    if (formAttempted.value)
        isToAccountIdValid.value;
});
watch(name, () => {
    if (formAttempted.value)
        isNameValid.value;
});
watch(recipientId, () => {
    if (formAttempted.value)
        isRecipientIdValid.value;
});
// Methoden
/**
 * Lädt Daten in das Formular.
 */
function loadTransactionData() {
    if (props.transaction) {
        const tx = props.transaction;
        name.value = tx.name || "";
        note.value = tx.note || "";
        amountType.value = tx.amountType || AmountType.EXACT;
        approximateAmount.value = tx.approximateAmount || 0;
        minAmount.value = tx.minAmount || 0;
        maxAmount.value = tx.maxAmount || 0;
        startDate.value = tx.startDate;
        valueDate.value = tx.valueDate || tx.startDate;
        valueDateManuallyChanged.value = valueDate.value !== startDate.value;
        accountId.value = tx.accountId;
        tagIds.value = tx.tagIds || [];
        recipientId.value = tx.recipientId || null;
        forecastOnly.value = tx.forecastOnly || false;
        isActive.value = tx.isActive !== undefined ? tx.isActive : true;
        repeatsEnabled.value = tx.recurrencePattern !== RecurrencePattern.ONCE;
        recurrencePattern.value = tx.recurrencePattern;
        recurrenceEndType.value = tx.recurrenceEndType || RecurrenceEndType.NEVER;
        recurrenceCount.value = tx.recurrenceCount || 12;
        endDate.value = tx.endDate || null;
        executionDay.value = tx.executionDay || null;
        weekendHandling.value = tx.weekendHandling || WeekendHandlingType.NONE;
        moveScheduleEnabled.value =
            weekendHandling.value !== WeekendHandlingType.NONE;
        weekendHandlingDirection.value =
            weekendHandling.value === WeekendHandlingType.BEFORE ? "before" : "after";
        transactionType.value =
            tx.transactionType ||
                (tx.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME);
        amount.value = tx.amount;
        if (transactionType.value === TransactionType.ACCOUNTTRANSFER) {
            toAccountId.value = tx.transferToAccountId || "";
            categoryId.value = null;
            fromCategoryId.value = null;
            amount.value = Math.abs(tx.amount);
        }
        else if (transactionType.value === TransactionType.CATEGORYTRANSFER) {
            fromCategoryId.value = tx.categoryId;
            categoryId.value = tx.transferToCategoryId || null;
            toAccountId.value = "";
            amount.value = Math.abs(tx.amount);
        }
        else {
            categoryId.value = tx.categoryId;
            fromCategoryId.value = null;
            toAccountId.value = "";
        }
    }
    else {
        if (accountStore.activeAccounts.length > 0) {
            accountId.value = accountStore.activeAccounts[0].id;
        }
        valueDate.value = startDate.value;
        valueDateManuallyChanged.value = false;
        transactionType.value = TransactionType.EXPENSE;
        amount.value = 0;
        categoryId.value = null;
        fromCategoryId.value = null;
        toAccountId.value = "";
        recipientId.value = null;
    }
}
/**
 * Aktualisiert Textbeschreibung des Musters.
 */
function updateDateDescription() {
    dateDescription.value = createRecurrenceDescription({
        startDate: startDate.value,
        repeatsEnabled: repeatsEnabled.value,
        recurrencePattern: recurrencePattern.value,
        executionDay: executionDay.value,
        moveScheduleEnabled: moveScheduleEnabled.value,
        weekendHandlingDirection: weekendHandlingDirection.value,
    });
}
/**
 * Berechnet nächste Ausführungstermine.
 */
function calculateUpcomingDatesWrapper() {
    upcomingDates.value = calculateUpcomingDates({
        startDate: startDate.value,
        repeatsEnabled: repeatsEnabled.value,
        recurrencePattern: recurrencePattern.value,
        recurrenceEndType: recurrenceEndType.value,
        endDate: endDate.value,
        recurrenceCount: recurrenceCount.value,
        executionDay: executionDay.value,
        moveScheduleEnabled: moveScheduleEnabled.value,
        weekendHandlingDirection: weekendHandlingDirection.value,
    });
}
/**
 * Neuer Empfänger erstellen.
 */
async function onCreateRecipient(data) {
    const created = await recipientStore.addRecipient({ name: data.name });
    recipientId.value = created.id;
    debugLog("[PlanningTransactionForm] onCreateRecipient", created);
}
/**
 * Neuen Tag erstellen und automatisch zuweisen.
 */
async function onCreateTag(data) {
    try {
        const created = await tagStore.addTag({
            name: data.name,
            color: data.color, // Verwende die zufällige Farbe von TagSearchableDropdown
        });
        // Automatisch den neu erstellten Tag zur Auswahl hinzufügen
        if (!tagIds.value.includes(created.id)) {
            tagIds.value = [...tagIds.value, created.id];
        }
        debugLog("[PlanningTransactionForm] onCreateTag", created);
    }
    catch (error) {
        errorLog("[PlanningTransactionForm]", "Fehler beim Erstellen des Tags", error);
    }
}
/**
 * Sammelt alle Validierungsfehler für das Alert.
 */
function collectValidationErrors() {
    const errors = [];
    if (!isNameValid.value) {
        errors.push("Name ist erforderlich");
    }
    if (!isAmountValid.value) {
        errors.push("Betrag muss eine gültige Zahl sein");
    }
    if (!isStartDateValid.value) {
        errors.push("Startdatum ist erforderlich");
    }
    if (!isValueDateValid.value) {
        errors.push("Wertstellungsdatum ist erforderlich");
    }
    if (isAccountIdRequired.value && !isAccountIdValid.value) {
        if (isAccountTransfer.value) {
            errors.push("Quellkonto ist erforderlich");
        }
        else {
            errors.push("Konto ist erforderlich");
        }
    }
    if (isCategoryIdRequired.value && !isCategoryIdValid.value) {
        errors.push("Kategorie ist erforderlich");
    }
    if (isToAccountIdRequired.value && !isToAccountIdValid.value) {
        errors.push("Zielkonto ist erforderlich");
    }
    if (isFromCategoryIdRequired.value && !isFromCategoryIdValid.value) {
        errors.push("Quellkategorie ist erforderlich");
    }
    if (isTargetCategoryIdRequired.value && !isTargetCategoryIdValid.value) {
        errors.push("Zielkategorie ist erforderlich");
    }
    return errors;
}
/**
 * Validiert Formular und zeigt Fehler-Alert an.
 */
function validateForm() {
    formAttempted.value = true;
    const valid = isFormValid.value;
    if (!valid) {
        validationErrors.value = collectValidationErrors();
        showValidationAlert.value = true;
        debugLog("[PlanningTransactionForm] Validation failed.", validationErrors.value);
        nextTick(() => {
            const firstError = planningFormRef.value?.querySelector('.input-bordered:invalid, .select-bordered:invalid, .validator-hint.text-error:not([style*="display: none"])');
            if (firstError) {
                firstError.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    }
    else {
        showValidationAlert.value = false;
        validationErrors.value = [];
    }
    return valid;
}
/**
 * Schließt das Validierungs-Alert.
 */
function closeValidationAlert() {
    showValidationAlert.value = false;
}
/**
 * Speichert Planungstransaktion.
 */
function savePlanningTransaction() {
    debugLog("[PlanningTransactionForm] savePlanningTransaction called");
    if (!validateForm()) {
        debugLog("[PlanningTransactionForm] Form validation failed, not saving");
        return;
    }
    debugLog("[PlanningTransactionForm] Form validation passed, proceeding with save");
    const weekendHandlingValue = moveScheduleEnabled.value
        ? weekendHandlingDirection.value === "before"
            ? WeekendHandlingType.BEFORE
            : WeekendHandlingType.AFTER
        : WeekendHandlingType.NONE;
    const effectiveRecurrencePattern = repeatsEnabled.value
        ? recurrencePattern.value
        : RecurrencePattern.ONCE;
    const effectiveRecurrenceEndType = repeatsEnabled.value
        ? recurrenceEndType.value
        : RecurrenceEndType.NEVER;
    const effectiveRecurrenceCount = repeatsEnabled.value &&
        effectiveRecurrenceEndType === RecurrenceEndType.COUNT
        ? recurrenceCount.value
        : null;
    const effectiveEndDate = repeatsEnabled.value &&
        effectiveRecurrenceEndType === RecurrenceEndType.DATE
        ? endDate.value
        : null;
    // Basis-Daten für alle Transaktionstypen
    let finalData = {
        name: name.value,
        tagIds: Array.isArray(tagIds.value) ? [...tagIds.value] : [],
        amount: amount.value,
        amountType: amountType.value,
        approximateAmount: approximateAmount.value,
        minAmount: minAmount.value,
        maxAmount: maxAmount.value,
        note: note.value,
        startDate: startDate.value,
        valueDate: valueDate.value,
        endDate: effectiveEndDate,
        recurrencePattern: effectiveRecurrencePattern,
        recurrenceEndType: effectiveRecurrenceEndType,
        recurrenceCount: effectiveRecurrenceCount,
        executionDay: executionDay.value,
        weekendHandling: weekendHandlingValue,
        isActive: isActive.value,
        forecastOnly: forecastOnly.value,
        // repeatsEnabled entfernt, da es kein Teil von PlanningTransaction ist
        transactionType: transactionType.value,
        // Die folgenden Felder werden unten je nach Typ spezifisch gesetzt
        // accountId: undefined,
        // categoryId: undefined,
        // recipientId: undefined,
        // transferToAccountId: undefined,
        // transferToCategoryId: undefined,
        counterPlanningTransactionId: props.transaction?.counterPlanningTransactionId, // Beibehalten, falls es bearbeitet wird
    };
    // Je nach Transaktionstyp zusätzliche Felder setzen
    if (isExpense.value || isIncome.value) {
        finalData.accountId = accountId.value;
        finalData.categoryId = categoryId.value;
        finalData.recipientId = recipientId.value;
        finalData.transferToAccountId = undefined; // Explizit auf undefined setzen
        finalData.transferToCategoryId = undefined; // Explizit auf undefined setzen
    }
    else if (isAccountTransfer.value) {
        finalData.accountId = accountId.value;
        finalData.transferToAccountId = toAccountId.value;
        finalData.categoryId = undefined; // Explizit auf undefined setzen
        finalData.transferToCategoryId = undefined; // Explizit auf undefined setzen
        finalData.recipientId = undefined; // Explizit auf undefined setzen
    }
    else if (isCategoryTransfer.value) {
        finalData.categoryId = fromCategoryId.value; // Dies ist die Quellkategorie
        finalData.transferToCategoryId = categoryId.value; // Dies ist die Zielkategorie
        finalData.accountId = undefined; // Explizit auf undefined setzen
        finalData.transferToAccountId = undefined; // Explizit auf undefined setzen
        finalData.recipientId = undefined; // Explizit auf undefined setzen
    }
    debugLog("[PlanningTransactionForm] Final data for save:", finalData);
    debugLog("[PlanningTransactionForm] Emitting save event");
    emit("save", finalData);
    debugLog("[PlanningTransactionForm] Save event emitted successfully");
}
/**
 * Initialisiert neue Regel-Werte.
 */
function getInitialRuleValuesForForm() {
    const recipientName = recipientStore.getRecipientById(recipientId.value || "")?.name || "";
    return getInitialRuleValues({
        name: name.value,
        recipientName,
        accountId: accountId.value,
        amount: amount.value,
        categoryId: categoryId.value,
        fromCategoryId: fromCategoryId.value,
    });
}
/**
 * Speichert Regel und schließt Modal.
 */
function saveRuleAndCloseModal(ruleData) {
    ruleStore.addRule(ruleData);
    debugLog("[PlanningTransactionForm] Created rule from planning", ruleData);
    showRuleCreationModal.value = false;
    alert(`Regel "${ruleData.name}" wurde erfolgreich erstellt.`);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('cancel');
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-circle btn-ghost absolute right-2 -top-12 z-10" },
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
    ...{ onSubmit: (__VLS_ctx.savePlanningTransaction) },
    ref: "planningFormRef",
    ...{ class: "space-y-6" },
    novalidate: true,
});
/** @type {typeof __VLS_ctx.planningFormRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset flex justify-between gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-wrap justify-center gap-4 pt-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "flex items-center gap-2 cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "radio",
    ...{ class: "radio radio-sm border-neutral checked:bg-error/60 checked:text-error checked:border-error" },
    value: (__VLS_ctx.TransactionType.EXPENSE),
});
(__VLS_ctx.transactionType);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "flex items-center gap-2 cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "radio",
    ...{ class: "radio radio-sm border-neutral checked:bg-success/60 checked:text-success checked:border-success" },
    value: (__VLS_ctx.TransactionType.INCOME),
});
(__VLS_ctx.transactionType);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "flex items-center gap-2 cursor-pointer" },
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
    ...{ class: "flex items-center gap-2 cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "radio",
    ...{ class: "radio radio-sm border-neutral checked:bg-warning/60 checked:text-warning checked:border-warning" },
    value: (__VLS_ctx.TransactionType.CATEGORYTRANSFER),
});
(__VLS_ctx.transactionType);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "divider" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex gap-4 items-end" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-full" },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ref: "nameInputRef",
    type: "text",
    value: (__VLS_ctx.name),
    ...{ class: "input input-bordered" },
    ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isNameValid }) },
    required: true,
    placeholder: "z.B. Schornsteinfeger, Miete, Gehalt",
    'aria-describedby': "name-validation",
});
/** @type {typeof __VLS_ctx.nameInputRef} */ ;
if (__VLS_ctx.formAttempted && !__VLS_ctx.isNameValid) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: "name-validation",
        ...{ class: "validator-hint text-error mt-1" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
    value: (__VLS_ctx.note),
    ...{ class: "textarea textarea-bordered w-full" },
    placeholder: "Zusätzliche Informationen",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-full" },
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col space-y-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "input-group flex items-center gap-2" },
});
/** @type {[typeof CurrencyInput, ]} */ ;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
    ref: "amountInputRef",
    modelValue: (__VLS_ctx.amount),
    ...{ class: ({
            'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isAmountValid,
        }) },
    'aria-describedby': "amount-validation",
    required: true,
}));
const __VLS_13 = __VLS_12({
    ref: "amountInputRef",
    modelValue: (__VLS_ctx.amount),
    ...{ class: ({
            'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isAmountValid,
        }) },
    'aria-describedby': "amount-validation",
    required: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
/** @type {typeof __VLS_ctx.amountInputRef} */ ;
var __VLS_15 = {};
var __VLS_14;
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
if (__VLS_ctx.formAttempted && !__VLS_ctx.isAmountValid) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: "amount-validation",
        ...{ class: "validator-hint text-error mt-1" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center space-x-3" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "flex items-center gap-2 cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "radio",
    ...{ class: "radio radio-sm" },
    value: (__VLS_ctx.AmountType.EXACT),
});
(__VLS_ctx.amountType);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "flex items-center gap-2 cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "radio",
    ...{ class: "radio radio-sm" },
    value: (__VLS_ctx.AmountType.APPROXIMATE),
});
(__VLS_ctx.amountType);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "flex items-center gap-2 cursor-pointer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "radio",
    ...{ class: "radio radio-sm" },
    value: (__VLS_ctx.AmountType.RANGE),
});
(__VLS_ctx.amountType);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-sm" },
});
if (__VLS_ctx.amountType === __VLS_ctx.AmountType.APPROXIMATE) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label pt-0 pb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-group border border-base-content/20 rounded-lg focus-within:border-primary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "pl-3" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        modelValue: (__VLS_ctx.approximateAmount),
        borderless: true,
        hideErrorMessage: true,
    }));
    const __VLS_18 = __VLS_17({
        modelValue: (__VLS_ctx.approximateAmount),
        borderless: true,
        hideErrorMessage: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "pr-3" },
    });
}
if (__VLS_ctx.amountType === __VLS_ctx.AmountType.RANGE) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label pt-0 pb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-group border border-base-content/20 rounded-lg focus-within:border-primary" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_20 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        modelValue: (__VLS_ctx.minAmount),
        borderless: true,
        hideErrorMessage: true,
    }));
    const __VLS_21 = __VLS_20({
        modelValue: (__VLS_ctx.minAmount),
        borderless: true,
        hideErrorMessage: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_20));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "pr-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label pt-0 pb-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "input-group border border-base-content/20 rounded-lg focus-within:border-primary" },
    });
    /** @type {[typeof CurrencyInput, ]} */ ;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(CurrencyInput, new CurrencyInput({
        modelValue: (__VLS_ctx.maxAmount),
        borderless: true,
        hideErrorMessage: true,
    }));
    const __VLS_24 = __VLS_23({
        modelValue: (__VLS_ctx.maxAmount),
        borderless: true,
        hideErrorMessage: true,
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "pr-3" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "text-error" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid grid-cols-1 md:grid-cols-2 gap-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label pb-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "date",
    ...{ class: "input input-bordered" },
    ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isStartDateValid }) },
    required: true,
    'aria-describedby': "startdate-validation",
});
(__VLS_ctx.startDate);
if (__VLS_ctx.formAttempted && !__VLS_ctx.isStartDateValid) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: "startdate-validation",
        ...{ class: "validator-hint text-error mt-1" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label pb-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "date",
    ...{ class: "input input-bordered" },
    ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isValueDateValid }) },
    required: true,
    'aria-describedby': "valuedate-validation",
});
(__VLS_ctx.valueDate);
if (__VLS_ctx.formAttempted && !__VLS_ctx.isValueDateValid) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        id: "valuedate-validation",
        ...{ class: "validator-hint text-error mt-1" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card border border-base-300 p-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tabs tabs-boxed" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'categorization';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'categorization' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'recurrence';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'recurrence' }) },
});
if (__VLS_ctx.activeTab === 'categorization') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-200 p-4 rounded-lg space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    if (__VLS_ctx.transactionType !== __VLS_ctx.TransactionType.CATEGORYTRANSFER) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        /** @type {[typeof SelectRecipient, ]} */ ;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent(SelectRecipient, new SelectRecipient({
            ...{ 'onCreate': {} },
            modelValue: (__VLS_ctx.recipientIdModel),
            placeholder: "Optional: Empfänger/Auftraggeber auswählen...",
        }));
        const __VLS_27 = __VLS_26({
            ...{ 'onCreate': {} },
            modelValue: (__VLS_ctx.recipientIdModel),
            placeholder: "Optional: Empfänger/Auftraggeber auswählen...",
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
        let __VLS_29;
        let __VLS_30;
        let __VLS_31;
        const __VLS_32 = {
            onCreate: (__VLS_ctx.onCreateRecipient)
        };
        var __VLS_28;
    }
    if (__VLS_ctx.isExpense || __VLS_ctx.isIncome) {
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        /** @type {[typeof SelectAccount, ]} */ ;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(SelectAccount, new SelectAccount({
            modelValue: (__VLS_ctx.accountId),
            ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isAccountIdValid }) },
            'aria-describedby': "account-validation",
            required: true,
        }));
        const __VLS_34 = __VLS_33({
            modelValue: (__VLS_ctx.accountId),
            ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isAccountIdValid }) },
            'aria-describedby': "account-validation",
            required: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        if (__VLS_ctx.formAttempted && !__VLS_ctx.isAccountIdValid) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                id: "account-validation",
                ...{ class: "validator-hint text-error mt-1" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-error" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        /** @type {[typeof SelectCategory, ]} */ ;
        // @ts-ignore
        const __VLS_36 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
            modelValue: (__VLS_ctx.categoryIdModel),
            ...{ class: ({
                    'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isCategoryIdValid,
                }) },
            'aria-describedby': "category-validation",
            required: true,
        }));
        const __VLS_37 = __VLS_36({
            modelValue: (__VLS_ctx.categoryIdModel),
            ...{ class: ({
                    'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isCategoryIdValid,
                }) },
            'aria-describedby': "category-validation",
            required: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_36));
        if (__VLS_ctx.formAttempted && !__VLS_ctx.isCategoryIdValid) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                id: "category-validation",
                ...{ class: "validator-hint text-error mt-1" },
            });
        }
    }
    if (__VLS_ctx.isAccountTransfer) {
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        /** @type {[typeof SelectAccount, ]} */ ;
        // @ts-ignore
        const __VLS_39 = __VLS_asFunctionalComponent(SelectAccount, new SelectAccount({
            modelValue: (__VLS_ctx.accountId),
            ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isAccountIdValid }) },
            'aria-describedby': "source-account-validation",
            required: true,
        }));
        const __VLS_40 = __VLS_39({
            modelValue: (__VLS_ctx.accountId),
            ...{ class: ({ 'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isAccountIdValid }) },
            'aria-describedby': "source-account-validation",
            required: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_39));
        if (__VLS_ctx.formAttempted && !__VLS_ctx.isAccountIdValid) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                id: "source-account-validation",
                ...{ class: "validator-hint text-error mt-1" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-error" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.toAccountId),
            ...{ class: "select select-bordered w-full" },
            ...{ class: ({
                    'select-error': __VLS_ctx.formAttempted && !__VLS_ctx.isToAccountIdValid,
                }) },
            required: true,
            'aria-describedby': "target-account-validation",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "",
            disabled: true,
            selected: true,
        });
        for (const [account] of __VLS_getVForSourceType((__VLS_ctx.filteredAccounts))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (account.id),
                value: (account.id),
            });
            (account.name);
        }
        if (__VLS_ctx.formAttempted && !__VLS_ctx.isToAccountIdValid) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                id: "target-account-validation",
                ...{ class: "validator-hint text-error mt-1" },
            });
        }
    }
    if (__VLS_ctx.isCategoryTransfer) {
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        /** @type {[typeof SelectCategory, ]} */ ;
        // @ts-ignore
        const __VLS_42 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
            modelValue: (__VLS_ctx.fromCategoryIdModel),
            ...{ class: ({
                    'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isFromCategoryIdValid,
                }) },
            'aria-describedby': "source-category-validation",
            required: true,
        }));
        const __VLS_43 = __VLS_42({
            modelValue: (__VLS_ctx.fromCategoryIdModel),
            ...{ class: ({
                    'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isFromCategoryIdValid,
                }) },
            'aria-describedby': "source-category-validation",
            required: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_42));
        if (__VLS_ctx.formAttempted && !__VLS_ctx.isFromCategoryIdValid) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                id: "source-category-validation",
                ...{ class: "validator-hint text-error mt-1" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-error" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        /** @type {[typeof SelectCategory, ]} */ ;
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
            modelValue: (__VLS_ctx.categoryIdModel),
            options: (__VLS_ctx.filteredCategories),
            ...{ class: ({
                    'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isTargetCategoryIdValid,
                }) },
            'aria-describedby': "target-category-validation",
            required: true,
        }));
        const __VLS_46 = __VLS_45({
            modelValue: (__VLS_ctx.categoryIdModel),
            options: (__VLS_ctx.filteredCategories),
            ...{ class: ({
                    'input-error': __VLS_ctx.formAttempted && !__VLS_ctx.isTargetCategoryIdValid,
                }) },
            'aria-describedby': "target-category-validation",
            required: true,
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        if (__VLS_ctx.formAttempted && !__VLS_ctx.isTargetCategoryIdValid) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                id: "target-category-validation",
                ...{ class: "validator-hint text-error mt-1" },
            });
        }
    }
    if (__VLS_ctx.transactionType !== __VLS_ctx.TransactionType.CATEGORYTRANSFER) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
            ...{ class: "fieldset" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
            ...{ class: "fieldset-legend" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        /** @type {[typeof TagSearchableDropdown, ]} */ ;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent(TagSearchableDropdown, new TagSearchableDropdown({
            ...{ 'onCreate': {} },
            modelValue: (__VLS_ctx.tagIds),
            options: (__VLS_ctx.tagStore.tags),
            placeholder: "Tags hinzufügen...",
        }));
        const __VLS_49 = __VLS_48({
            ...{ 'onCreate': {} },
            modelValue: (__VLS_ctx.tagIds),
            options: (__VLS_ctx.tagStore.tags),
            placeholder: "Tags hinzufügen...",
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
        let __VLS_51;
        let __VLS_52;
        let __VLS_53;
        const __VLS_54 = {
            onCreate: (__VLS_ctx.onCreateTag)
        };
        var __VLS_50;
    }
}
if (__VLS_ctx.activeTab === 'recurrence') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-200 p-4 rounded-lg" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col md:flex-row md:space-x-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "space-y-4 md:w-1/2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "cursor-pointer label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "checkbox",
        ...{ class: "toggle toggle-primary" },
    });
    (__VLS_ctx.repeatsEnabled);
    if (__VLS_ctx.repeatsEnabled) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "space-y-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "label pb-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (__VLS_ctx.recurrencePattern),
            ...{ class: "select select-bordered w-full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (__VLS_ctx.RecurrencePattern.DAILY),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (__VLS_ctx.RecurrencePattern.WEEKLY),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (__VLS_ctx.RecurrencePattern.BIWEEKLY),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (__VLS_ctx.RecurrencePattern.MONTHLY),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (__VLS_ctx.RecurrencePattern.QUARTERLY),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (__VLS_ctx.RecurrencePattern.YEARLY),
        });
        if (__VLS_ctx.recurrencePattern === __VLS_ctx.RecurrencePattern.MONTHLY) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label pb-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "number",
                ...{ class: "input input-bordered" },
                min: "1",
                max: "31",
                placeholder: "Standard: Tag des Startdatums",
            });
            (__VLS_ctx.executionDay);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "cursor-pointer label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "checkbox",
            ...{ class: "toggle" },
            disabled: (!__VLS_ctx.repeatsEnabled),
        });
        (__VLS_ctx.moveScheduleEnabled);
        if (__VLS_ctx.repeatsEnabled && __VLS_ctx.moveScheduleEnabled) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label pb-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex space-x-4" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "flex items-center gap-2 cursor-pointer" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "radio",
                ...{ class: "radio radio-sm" },
                value: "before",
            });
            (__VLS_ctx.weekendHandlingDirection);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-sm" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "flex items-center gap-2 cursor-pointer" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "radio",
                ...{ class: "radio radio-sm" },
                value: "after",
            });
            (__VLS_ctx.weekendHandlingDirection);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-sm" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-control" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "label pt-4 pb-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "label-text" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex flex-wrap gap-x-4 gap-y-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "flex items-center gap-2 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "radio",
            ...{ class: "radio radio-sm" },
            value: (__VLS_ctx.RecurrenceEndType.NEVER),
            disabled: (!__VLS_ctx.repeatsEnabled),
        });
        (__VLS_ctx.recurrenceEndType);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "flex items-center gap-2 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "radio",
            ...{ class: "radio radio-sm" },
            value: (__VLS_ctx.RecurrenceEndType.COUNT),
            disabled: (!__VLS_ctx.repeatsEnabled),
        });
        (__VLS_ctx.recurrenceEndType);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "flex items-center gap-2 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "radio",
            ...{ class: "radio radio-sm" },
            value: (__VLS_ctx.RecurrenceEndType.DATE),
            disabled: (!__VLS_ctx.repeatsEnabled),
        });
        (__VLS_ctx.recurrenceEndType);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-sm" },
        });
        if (__VLS_ctx.repeatsEnabled &&
            __VLS_ctx.recurrenceEndType === __VLS_ctx.RecurrenceEndType.COUNT) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label pb-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "number",
                ...{ class: "input input-bordered" },
                min: "1",
                placeholder: "Anzahl",
            });
            (__VLS_ctx.recurrenceCount);
        }
        if (__VLS_ctx.repeatsEnabled &&
            __VLS_ctx.recurrenceEndType === __VLS_ctx.RecurrenceEndType.DATE) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "form-control" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "label pb-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "label-text" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                type: "date",
                ...{ class: "input input-bordered" },
                min: (__VLS_ctx.startDate),
                placeholder: "Enddatum",
            });
            (__VLS_ctx.endDate);
        }
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-4 md:mt-0 md:w-1/2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-sm font-semibold mb-8" },
    });
    (__VLS_ctx.dateDescription);
    if (__VLS_ctx.upcomingDates.length > 0 && __VLS_ctx.repeatsEnabled) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm font-semibold mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-1 gap-1" },
        });
        for (const [d, i] of __VLS_getVForSourceType((__VLS_ctx.upcomingDates))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (i),
                ...{ class: "text-xs p-1 rounded" },
            });
            (d.date);
            (d.day);
        }
        if (__VLS_ctx.recurrenceEndType === __VLS_ctx.RecurrenceEndType.COUNT &&
            __VLS_ctx.upcomingDates.length >= (__VLS_ctx.recurrenceCount || 0)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-xs text-base-content/70 mt-1" },
            });
            (__VLS_ctx.recurrenceCount);
        }
        else if (__VLS_ctx.recurrenceEndType === __VLS_ctx.RecurrenceEndType.DATE && __VLS_ctx.endDate) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                ...{ class: "text-xs text-base-content/70 mt-1" },
            });
            (__VLS_ctx.formatDate(__VLS_ctx.endDate));
        }
    }
    else if (__VLS_ctx.upcomingDates.length > 0 && !__VLS_ctx.repeatsEnabled) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm font-semibold mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-xs p-1 rounded bg-base-100" },
        });
        (__VLS_ctx.upcomingDates[0].date);
        (__VLS_ctx.upcomingDates[0].day);
    }
    else if (!__VLS_ctx.startDate) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-sm text-warning" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "cursor-pointer label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.isActive);
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "cursor-pointer label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.forecastOnly);
if (__VLS_ctx.forecastOnly) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-xs text-base-content/70 pl-4" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-end space-x-2 pt-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('cancel');
        } },
    type: "button",
    ...{ class: "btn btn-ghost" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
    ...{ class: "btn btn-primary" },
});
(__VLS_ctx.isEdit ? "Änderungen speichern" : "Planung erstellen");
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
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
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
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
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
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
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
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
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['border-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:bg-warning/60']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['checked:border-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
/** @type {__VLS_StyleScopedClasses['input-group']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input-group']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-within:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input-group']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-within:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input-group']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['focus-within:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-3']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['select-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['input-error']} */ ;
/** @type {__VLS_StyleScopedClasses['validator-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['md:space-x-8']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['radio']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:mt-0']} */ ;
/** @type {__VLS_StyleScopedClasses['md:w-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
// @ts-ignore
var __VLS_16 = __VLS_15;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RecurrencePattern: RecurrencePattern,
            TransactionType: TransactionType,
            AmountType: AmountType,
            RecurrenceEndType: RecurrenceEndType,
            SelectAccount: SelectAccount,
            SelectCategory: SelectCategory,
            SelectRecipient: SelectRecipient,
            CurrencyInput: CurrencyInput,
            TagSearchableDropdown: TagSearchableDropdown,
            Icon: Icon,
            formatDate: formatDate,
            emit: emit,
            tagStore: tagStore,
            planningFormRef: planningFormRef,
            nameInputRef: nameInputRef,
            amountInputRef: amountInputRef,
            name: name,
            note: note,
            amount: amount,
            amountType: amountType,
            approximateAmount: approximateAmount,
            minAmount: minAmount,
            maxAmount: maxAmount,
            startDate: startDate,
            valueDate: valueDate,
            accountId: accountId,
            tagIds: tagIds,
            transactionType: transactionType,
            toAccountId: toAccountId,
            recipientIdModel: recipientIdModel,
            categoryIdModel: categoryIdModel,
            fromCategoryIdModel: fromCategoryIdModel,
            formAttempted: formAttempted,
            validationErrors: validationErrors,
            showValidationAlert: showValidationAlert,
            activeTab: activeTab,
            repeatsEnabled: repeatsEnabled,
            recurrencePattern: recurrencePattern,
            recurrenceEndType: recurrenceEndType,
            recurrenceCount: recurrenceCount,
            endDate: endDate,
            executionDay: executionDay,
            moveScheduleEnabled: moveScheduleEnabled,
            weekendHandlingDirection: weekendHandlingDirection,
            forecastOnly: forecastOnly,
            isActive: isActive,
            dateDescription: dateDescription,
            upcomingDates: upcomingDates,
            isExpense: isExpense,
            isIncome: isIncome,
            isAccountTransfer: isAccountTransfer,
            isCategoryTransfer: isCategoryTransfer,
            filteredAccounts: filteredAccounts,
            filteredCategories: filteredCategories,
            isNameValid: isNameValid,
            isAmountValid: isAmountValid,
            isStartDateValid: isStartDateValid,
            isValueDateValid: isValueDateValid,
            isAccountIdValid: isAccountIdValid,
            isCategoryIdValid: isCategoryIdValid,
            isToAccountIdValid: isToAccountIdValid,
            isFromCategoryIdValid: isFromCategoryIdValid,
            isTargetCategoryIdValid: isTargetCategoryIdValid,
            onCreateRecipient: onCreateRecipient,
            onCreateTag: onCreateTag,
            closeValidationAlert: closeValidationAlert,
            savePlanningTransaction: savePlanningTransaction,
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
