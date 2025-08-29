import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { RuleConditionType, RuleActionType, TransactionType, } from "../../types";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useTagStore } from "@/stores/tagStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { usePlanningStore } from "@/stores/planningStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { useRuleStore } from "@/stores/ruleStore";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import TagSearchableDropdown from "@/components/ui/TagSearchableDropdown.vue";
import SelectCategory from "@/components/ui/SelectCategory.vue";
import SelectAccount from "@/components/ui/SelectAccount.vue";
import SelectRecipient from "@/components/ui/SelectRecipient.vue";
import RuleConditionRow from "@/components/rules/RuleConditionRow.vue";
import { debugLog, errorLog } from "@/utils/logger";
import { v4 as uuidv4 } from "uuid";
import { Icon } from "@iconify/vue";
const props = defineProps();
const emit = defineEmits(["save", "cancel", "apply"]);
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();
const recipientStore = useRecipientStore();
const planningStore = usePlanningStore();
const transactionStore = useTransactionStore();
const ruleStore = useRuleStore();
const name = ref("");
const description = ref("");
const isActive = ref(true);
const stage = ref("DEFAULT");
const priority = ref(100);
const conditionLogic = ref("all");
const conditions = ref([]);
const actions = ref([]);
// Für Test-Ergebnisse
const testResults = reactive({
    show: false,
    matchCount: 0,
    transactions: [],
});
onMounted(() => {
    if (props.rule) {
        name.value = props.rule.name;
        description.value = props.rule.description || "";
        isActive.value = props.rule.isActive;
        stage.value = props.rule.stage;
        priority.value = props.rule.priority;
        conditionLogic.value = props.rule.conditionLogic || "all";
        conditions.value = [...props.rule.conditions];
        actions.value = [...props.rule.actions];
    }
    else if (props.initialValues) {
        name.value = props.initialValues.name || "";
        description.value = props.initialValues.description || "";
        isActive.value =
            props.initialValues.isActive !== undefined
                ? props.initialValues.isActive
                : true;
        stage.value = props.initialValues.stage || "DEFAULT";
        priority.value = props.initialValues.priority || 100;
        conditionLogic.value = props.initialValues.conditionLogic || "all";
        conditions.value = props.initialValues.conditions
            ? [...props.initialValues.conditions]
            : [];
        actions.value = props.initialValues.actions
            ? [...props.initialValues.actions]
            : [];
    }
    if (conditions.value.length === 0) {
        conditions.value.push({
            type: RuleConditionType.ACCOUNT_IS,
            operator: "is",
            value: "",
            source: "account", // Neue Eigenschaft
        });
    }
    if (actions.value.length === 0) {
        actions.value.push({
            type: RuleActionType.SET_CATEGORY,
            field: "category",
            value: "",
        });
    }
    // Kompatibilität für bestehende Bedingungen sicherstellen
    conditions.value.forEach((condition) => {
        if (!condition.source) {
            switch (condition.type) {
                case RuleConditionType.ACCOUNT_IS:
                    condition.source = "account";
                    break;
                case RuleConditionType.RECIPIENT_EQUALS:
                case RuleConditionType.RECIPIENT_CONTAINS:
                    condition.source = "recipient";
                    break;
                case RuleConditionType.AMOUNT_EQUALS:
                case RuleConditionType.AMOUNT_GREATER:
                case RuleConditionType.AMOUNT_LESS:
                    condition.source = "amount";
                    break;
                case RuleConditionType.DATE_IS:
                case RuleConditionType.DATE_APPROX:
                    condition.source = "date";
                    break;
                case RuleConditionType.DESCRIPTION_CONTAINS:
                    condition.source = "description";
                    break;
                default:
                    condition.source = "description";
            }
        }
    });
});
const actionTypeOptions = [
    { value: RuleActionType.SET_CATEGORY, label: "Kategorie setzen" },
    { value: RuleActionType.ADD_TAG, label: "Tag hinzufügen" },
    { value: RuleActionType.SET_NOTE, label: "Notiz setzen" },
    { value: RuleActionType.LINK_SCHEDULE, label: "Mit Planung verknüpfen" },
    { value: RuleActionType.SET_ACCOUNT, label: "Konto setzen" },
    { value: RuleActionType.SET_RECIPIENT, label: "Empfänger setzen" },
];
// Tags für Dropdown
const tags = computed(() => tagStore.tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
})));
// Computed property für dynamischen Bedingungstext
const dynamicConditionText = computed(() => {
    if (conditionLogic.value === "all") {
        return "Wenn **alle** der folgenden Bedingungen zutreffen:";
    }
    else if (conditionLogic.value === "any") {
        return "Wenn **eine beliebige** der folgenden Bedingungen zutrifft:";
    }
    return "Bedingungen:";
});
function addCondition() {
    const c = {
        type: RuleConditionType.RECIPIENT_CONTAINS,
        operator: "contains",
        value: "",
        source: "recipient",
    };
    conditions.value.push(c);
}
function removeCondition(index) {
    if (conditions.value.length > 1) {
        conditions.value.splice(index, 1);
    }
}
function addAction() {
    actions.value.push({
        type: RuleActionType.SET_CATEGORY,
        field: "category",
        value: "",
    });
}
function removeAction(index) {
    if (actions.value.length > 1) {
        actions.value.splice(index, 1);
    }
}
function saveRule() {
    const normalizedConditions = conditions.value.map((c) => ({
        type: c.type,
        operator: c.operator,
        value: c.value,
    }));
    const ruleData = {
        name: name.value,
        description: description.value,
        stage: stage.value,
        conditions: normalizedConditions,
        actions: actions.value,
        priority: priority.value,
        isActive: isActive.value,
        conditionLogic: conditionLogic.value,
    };
    debugLog("[RuleForm] saveRule", ruleData);
    emit("save", ruleData);
}
function applyRuleToExistingTransactions() {
    const normalizedConditions = conditions.value.map((c) => ({
        type: c.type,
        operator: c.operator,
        value: c.value,
    }));
    const ruleData = {
        id: props.rule?.id || uuidv4(),
        name: name.value,
        description: description.value,
        stage: stage.value,
        conditions: normalizedConditions,
        actions: actions.value,
        priority: priority.value,
        isActive: isActive.value,
        conditionLogic: conditionLogic.value,
    };
    debugLog("[RuleForm] applyRuleToExistingTransactions (Virtual Test)", ruleData);
    // Virtuelle Regelprüfung - nur die letzten 250 EXPENSE/INCOME Transaktionen testen
    // Rules greifen nicht bei CATEGORYTRANSFER und ACCOUNTTRANSFER
    const allTransactions = [...transactionStore.transactions]
        .filter((tx) => tx.type === TransactionType.EXPENSE ||
        tx.type === TransactionType.INCOME)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 250); // Begrenzt auf 250 Transaktionen
    const matchingTransactions = [];
    for (const transaction of allTransactions) {
        if (ruleStore.checkConditions(ruleData.conditions, transaction, ruleData)) {
            matchingTransactions.push(transaction);
        }
    }
    // Ergebnisse anzeigen - zeige bis zu 20 Transaktionen im Modal
    testResults.transactions = matchingTransactions.slice(0, 20);
    testResults.matchCount = matchingTransactions.length;
    testResults.show = true;
    debugLog("[RuleForm] Virtual test results", {
        testedTransactions: allTransactions.length,
        matched: matchingTransactions.length,
        showing: testResults.transactions.length,
    });
}
// Erstellt einen neuen Empfänger im Store
async function handleCreateRecipient(recipientData) {
    try {
        debugLog("[RuleForm] handleCreateRecipient", recipientData);
        const newRecipient = await recipientStore.addRecipient({
            name: recipientData.name,
        });
        debugLog("[RuleForm] Neuer Empfänger erstellt", newRecipient);
        // Setze den neuen Empfänger als Wert für die entsprechende Aktion
        // Suche die erste SET_RECIPIENT Aktion ohne Wert, oder falls alle einen Wert haben, die erste
        const currentAction = actions.value.find((action) => action.type === RuleActionType.SET_RECIPIENT && !action.value) ||
            actions.value.find((action) => action.type === RuleActionType.SET_RECIPIENT);
        if (currentAction && newRecipient) {
            currentAction.value = newRecipient.id;
        }
    }
    catch (error) {
        errorLog("[RuleForm] Fehler beim Erstellen des Empfängers", error);
    }
}
// Erstellt einen neuen Tag im Store
async function handleCreateTag(tagData) {
    try {
        debugLog("[RuleForm] handleCreateTag", tagData);
        const newTag = await tagStore.addTag({
            name: tagData.name,
            color: tagData.color,
        });
        debugLog("[RuleForm] Neuer Tag erstellt", newTag);
        // Für ADD_TAG Aktionen: Füge den neuen Tag zur bestehenden Auswahl hinzu
        // Suche die erste ADD_TAG Aktion, die gerade bearbeitet wird
        const currentAction = actions.value.find((action) => action.type === RuleActionType.ADD_TAG);
        if (currentAction && newTag) {
            // Konvertiere den aktuellen Wert zu einem Array, füge den neuen Tag hinzu
            const currentTags = currentAction.value
                ? String(currentAction.value).split(",")
                : [];
            if (!currentTags.includes(newTag.id)) {
                currentTags.push(newTag.id);
                currentAction.value = currentTags.join(",");
            }
        }
    }
    catch (error) {
        errorLog("[RuleForm] Fehler beim Erstellen des Tags", error);
    }
}
// Schließen des Test-Modals
function closeTestResults() {
    testResults.show = false;
}
// ESC-Taste-Handler für Modal
function handleKeydown(event) {
    if (event.key === "Escape" && testResults.show) {
        closeTestResults();
    }
}
// Event Listener für ESC-Taste hinzufügen
onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
});
// Event Listener beim Unmount entfernen
onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "relative" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    ...{ onSubmit: (__VLS_ctx.saveRule) },
    ...{ class: "space-y-4" },
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
    placeholder: "Name der Regel",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
    value: (__VLS_ctx.description),
    ...{ class: "textarea textarea-bordered w-full" },
    placeholder: "Optionale Beschreibung der Regel",
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tooltip tooltip-bottom max-w-xs" },
    'data-tip': "\u0042\u0065\u0073\u0074\u0069\u006d\u006d\u0074\u0020\u0064\u0069\u0065\u0020\u0052\u0065\u0069\u0068\u0065\u006e\u0066\u006f\u006c\u0067\u0065\u0020\u0064\u0065\u0072\u0020\u0052\u0065\u0067\u0065\u006c\u0061\u0075\u0073\u0066\u00fc\u0068\u0072\u0075\u006e\u0067\u003a\u000d\u000a\u000d\u000a\u0050\u0052\u0045\u0020\u0028\u0056\u006f\u0072\u0061\u0062\u0029\u003a\u0020\u0057\u0069\u0072\u0064\u0020\u0076\u006f\u0072\u0020\u0061\u006c\u006c\u0065\u006e\u0020\u0061\u006e\u0064\u0065\u0072\u0065\u006e\u0020\u0052\u0065\u0067\u0065\u006c\u006e\u0020\u0061\u0075\u0073\u0067\u0065\u0066\u00fc\u0068\u0072\u0074\u000d\u000a\u2022\u0020\u0042\u0065\u0069\u0073\u0070\u0069\u0065\u006c\u003a\u0020\u0047\u0072\u0075\u006e\u0064\u006c\u0065\u0067\u0065\u006e\u0064\u0065\u0020\u004b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0073\u0069\u0065\u0072\u0075\u006e\u0067\u0020\u0076\u006f\u006e\u0020\u00dc\u0062\u0065\u0072\u0077\u0065\u0069\u0073\u0075\u006e\u0067\u0065\u006e\u000d\u000a\u2022\u0020\u0056\u0065\u0072\u0077\u0065\u006e\u0064\u0075\u006e\u0067\u003a\u0020\u0057\u0065\u006e\u006e\u0020\u0065\u0069\u006e\u0065\u0020\u0052\u0065\u0067\u0065\u006c\u0020\u0061\u006e\u0064\u0065\u0072\u0065\u0020\u0052\u0065\u0067\u0065\u006c\u006e\u0020\u0062\u0065\u0065\u0069\u006e\u0066\u006c\u0075\u0073\u0073\u0065\u006e\u0020\u0073\u006f\u006c\u006c\u000d\u000a\u000d\u000a\u0044\u0045\u0046\u0041\u0055\u004c\u0054\u0020\u0028\u004e\u006f\u0072\u006d\u0061\u006c\u0029\u003a\u0020\u0053\u0074\u0061\u006e\u0064\u0061\u0072\u0064\u002d\u0041\u0075\u0073\u0066\u00fc\u0068\u0072\u0075\u006e\u0067\u0073\u0072\u0065\u0069\u0068\u0065\u006e\u0066\u006f\u006c\u0067\u0065\u000d\u000a\u2022\u0020\u0042\u0065\u0069\u0073\u0070\u0069\u0065\u006c\u003a\u0020\u004e\u006f\u0072\u006d\u0061\u006c\u0065\u0020\u004b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0073\u0069\u0065\u0072\u0075\u006e\u0067\u0020\u006e\u0061\u0063\u0068\u0020\u0045\u006d\u0070\u0066\u00e4\u006e\u0067\u0065\u0072\u0020\u006f\u0064\u0065\u0072\u0020\u0042\u0065\u0074\u0072\u0061\u0067\u000d\u000a\u2022\u0020\u0056\u0065\u0072\u0077\u0065\u006e\u0064\u0075\u006e\u0067\u003a\u0020\u0046\u00fc\u0072\u0020\u0064\u0069\u0065\u0020\u006d\u0065\u0069\u0073\u0074\u0065\u006e\u0020\u0061\u006c\u006c\u0074\u00e4\u0067\u006c\u0069\u0063\u0068\u0065\u006e\u0020\u0052\u0065\u0067\u0065\u006c\u006e\u000d\u000a\u000d\u000a\u0050\u004f\u0053\u0054\u0020\u0028\u004e\u0061\u0063\u0068\u0067\u0065\u006c\u0061\u0067\u0065\u0072\u0074\u0029\u003a\u0020\u0057\u0069\u0072\u0064\u0020\u006e\u0061\u0063\u0068\u0020\u0061\u006c\u006c\u0065\u006e\u0020\u0061\u006e\u0064\u0065\u0072\u0065\u006e\u0020\u0052\u0065\u0067\u0065\u006c\u006e\u0020\u0061\u0075\u0073\u0067\u0065\u0066\u00fc\u0068\u0072\u0074\u000d\u000a\u2022\u0020\u0042\u0065\u0069\u0073\u0070\u0069\u0065\u006c\u003a\u0020\u0046\u0069\u006e\u0061\u006c\u0065\u0020\u0042\u0065\u0072\u0065\u0069\u006e\u0069\u0067\u0075\u006e\u0067\u0020\u006f\u0064\u0065\u0072\u0020\u0073\u0070\u0065\u007a\u0069\u0065\u006c\u006c\u0065\u0020\u004d\u0061\u0072\u006b\u0069\u0065\u0072\u0075\u006e\u0067\u0065\u006e\u000d\u000a\u2022\u0020\u0056\u0065\u0072\u0077\u0065\u006e\u0064\u0075\u006e\u0067\u003a\u0020\u0046\u00fc\u0072\u0020\u0052\u0065\u0067\u0065\u006c\u006e\u002c\u0020\u0064\u0069\u0065\u0020\u0061\u0075\u0066\u0020\u0062\u0065\u0072\u0065\u0069\u0074\u0073\u0020\u0076\u0065\u0072\u0061\u0072\u0062\u0065\u0069\u0074\u0065\u0074\u0065\u0020\u0044\u0061\u0074\u0065\u006e\u0020\u007a\u0075\u0067\u0072\u0065\u0069\u0066\u0065\u006e\u000d\u000a\u000d\u000a\u0049\u006e\u006e\u0065\u0072\u0068\u0061\u006c\u0062\u0020\u006a\u0065\u0064\u0065\u0072\u0020\u0050\u0068\u0061\u0073\u0065\u0020\u0062\u0065\u0073\u0074\u0069\u006d\u006d\u0074\u0020\u0064\u0069\u0065\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0064\u0069\u0065\u0020\u0067\u0065\u006e\u0061\u0075\u0065\u0020\u0052\u0065\u0069\u0068\u0065\u006e\u0066\u006f\u006c\u0067\u0065\u002e",
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:help-circle-outline",
    ...{ class: "text-base-content/50 cursor-help ml-1" },
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:help-circle-outline",
    ...{ class: "text-base-content/50 cursor-help ml-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.stage),
    ...{ class: "select select-bordered w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "PRE",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "DEFAULT",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "POST",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
    ...{ class: "fieldset" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
    ...{ class: "fieldset-legend" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tooltip tooltip-bottom max-w-xs" },
    'data-tip': "\u0042\u0065\u0073\u0074\u0069\u006d\u006d\u0074\u0020\u0064\u0069\u0065\u0020\u0041\u0075\u0073\u0066\u00fc\u0068\u0072\u0075\u006e\u0067\u0073\u0072\u0065\u0069\u0068\u0065\u006e\u0066\u006f\u006c\u0067\u0065\u0020\u0069\u006e\u006e\u0065\u0072\u0068\u0061\u006c\u0062\u0020\u0064\u0065\u0072\u0020\u0067\u0065\u0077\u00e4\u0068\u006c\u0074\u0065\u006e\u0020\u0050\u0068\u0061\u0073\u0065\u003a\u000d\u000a\u000d\u000a\u004e\u0069\u0065\u0064\u0072\u0069\u0067\u0065\u0072\u0065\u0020\u005a\u0061\u0068\u006c\u0065\u006e\u0020\u003d\u0020\u0048\u00f6\u0068\u0065\u0072\u0065\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0028\u0077\u0065\u0072\u0064\u0065\u006e\u0020\u007a\u0075\u0065\u0072\u0073\u0074\u0020\u0061\u0075\u0073\u0067\u0065\u0066\u00fc\u0068\u0072\u0074\u0029\u000d\u000a\u0048\u00f6\u0068\u0065\u0072\u0065\u0020\u005a\u0061\u0068\u006c\u0065\u006e\u0020\u003d\u0020\u004e\u0069\u0065\u0064\u0072\u0069\u0067\u0065\u0072\u0065\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0028\u0077\u0065\u0072\u0064\u0065\u006e\u0020\u0073\u0070\u00e4\u0074\u0065\u0072\u0020\u0061\u0075\u0073\u0067\u0065\u0066\u00fc\u0068\u0072\u0074\u0029\u000d\u000a\u000d\u000a\u0042\u0065\u0069\u0073\u0070\u0069\u0065\u006c\u0065\u003a\u000d\u000a\u2022\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0031\u0030\u003a\u0020\u0053\u0065\u0068\u0072\u0020\u0077\u0069\u0063\u0068\u0074\u0069\u0067\u0065\u0020\u0052\u0065\u0067\u0065\u006c\u0020\u0028\u007a\u002e\u0042\u002e\u0020\u004d\u0069\u0065\u0074\u0065\u0020\u006b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0073\u0069\u0065\u0072\u0065\u006e\u0029\u000d\u000a\u2022\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0035\u0030\u003a\u0020\u0057\u0069\u0063\u0068\u0074\u0069\u0067\u0065\u0020\u0052\u0065\u0067\u0065\u006c\u0020\u0028\u007a\u002e\u0042\u002e\u0020\u0053\u0075\u0070\u0065\u0072\u006d\u0061\u0072\u006b\u0074\u002d\u0045\u0069\u006e\u006b\u00e4\u0075\u0066\u0065\u0029\u000d\u000a\u2022\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0031\u0030\u0030\u003a\u0020\u0053\u0074\u0061\u006e\u0064\u0061\u0072\u0064\u002d\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0028\u0053\u0074\u0061\u006e\u0064\u0061\u0072\u0064\u0077\u0065\u0072\u0074\u0029\u000d\u000a\u2022\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0020\u0032\u0030\u0030\u003a\u0020\u0057\u0065\u006e\u0069\u0067\u0065\u0072\u0020\u0077\u0069\u0063\u0068\u0074\u0069\u0067\u0065\u0020\u0052\u0065\u0067\u0065\u006c\u0020\u0028\u007a\u002e\u0042\u002e\u0020\u0061\u006c\u006c\u0067\u0065\u006d\u0065\u0069\u006e\u0065\u0020\u004b\u0061\u0074\u0065\u0067\u006f\u0072\u0069\u0073\u0069\u0065\u0072\u0075\u006e\u0067\u0029\u000d\u000a\u000d\u000a\ud83d\udca1\u0020\u0054\u0069\u0070\u0070\u003a\u0020\u004c\u0061\u0073\u0073\u0065\u006e\u0020\u0053\u0069\u0065\u0020\u0050\u006c\u0061\u0074\u007a\u0020\u007a\u0077\u0069\u0073\u0063\u0068\u0065\u006e\u0020\u0064\u0065\u006e\u0020\u0050\u0072\u0069\u006f\u0072\u0069\u0074\u00e4\u0074\u0065\u006e\u0020\u0028\u0031\u0030\u002c\u0020\u0032\u0030\u002c\u0020\u0033\u0030\u002e\u002e\u002e\u0029\u000d\u000a\u0075\u006d\u0020\u0073\u0070\u00e4\u0074\u0065\u0072\u0020\u006e\u0065\u0075\u0065\u0020\u0052\u0065\u0067\u0065\u006c\u006e\u0020\u0064\u0061\u007a\u0077\u0069\u0073\u0063\u0068\u0065\u006e\u0020\u0065\u0069\u006e\u0066\u00fc\u0067\u0065\u006e\u0020\u007a\u0075\u0020\u006b\u00f6\u006e\u006e\u0065\u006e\u002e",
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:help-circle-outline",
    ...{ class: "text-base-content/50 cursor-help ml-1" },
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:help-circle-outline",
    ...{ class: "text-base-content/50 cursor-help ml-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "number",
    ...{ class: "input input-bordered w-full" },
    min: "1",
    max: "999",
});
(__VLS_ctx.priority);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "form-control pt-8" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "cursor-pointer label justify-start" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    type: "checkbox",
    ...{ class: "toggle mr-2" },
});
(__VLS_ctx.isActive);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-200 p-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "text-lg font-semibold mb-4 flex items-center" },
});
const __VLS_12 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    icon: "mdi:filter-outline",
    ...{ class: "mr-2" },
}));
const __VLS_14 = __VLS_13({
    icon: "mdi:filter-outline",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalDirective(__VLS_directives.vHtml)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.dynamicConditionText) }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "label-text" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.conditionLogic),
    ...{ class: "select select-bordered w-full max-w-xs" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "all",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "any",
});
for (const [condition, index] of __VLS_getVForSourceType((__VLS_ctx.conditions))) {
    /** @type {[typeof RuleConditionRow, ]} */ ;
    // @ts-ignore
    const __VLS_16 = __VLS_asFunctionalComponent(RuleConditionRow, new RuleConditionRow({
        ...{ 'onUpdate:condition': {} },
        ...{ 'onRemove': {} },
        key: (index),
        condition: (condition),
        index: (index),
        canRemove: (__VLS_ctx.conditions.length > 1),
    }));
    const __VLS_17 = __VLS_16({
        ...{ 'onUpdate:condition': {} },
        ...{ 'onRemove': {} },
        key: (index),
        condition: (condition),
        index: (index),
        canRemove: (__VLS_ctx.conditions.length > 1),
    }, ...__VLS_functionalComponentArgsRest(__VLS_16));
    let __VLS_19;
    let __VLS_20;
    let __VLS_21;
    const __VLS_22 = {
        'onUpdate:condition': ((updatedCondition) => { __VLS_ctx.conditions[index] = updatedCondition; })
    };
    const __VLS_23 = {
        onRemove: (...[$event]) => {
            __VLS_ctx.removeCondition(index);
        }
    };
    var __VLS_18;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.addCondition) },
    type: "button",
    ...{ class: "btn btn-ghost btn-sm mt-2" },
});
const __VLS_24 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    icon: "mdi:plus",
    ...{ class: "mr-1" },
}));
const __VLS_26 = __VLS_25({
    icon: "mdi:plus",
    ...{ class: "mr-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-200 p-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "text-lg font-semibold mb-4 flex items-center" },
});
const __VLS_28 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    icon: "mdi:lightning-bolt",
    ...{ class: "mr-2" },
}));
const __VLS_30 = __VLS_29({
    icon: "mdi:lightning-bolt",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
for (const [action, index] of __VLS_getVForSourceType((__VLS_ctx.actions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (index),
        ...{ class: "mb-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-12 gap-3 items-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (action.type),
        ...{ class: "select select-bordered w-full" },
    });
    for (const [option] of __VLS_getVForSourceType((__VLS_ctx.actionTypeOptions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (option.value),
            value: (option.value),
        });
        (option.label);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-7" },
    });
    if (action.type === __VLS_ctx.RuleActionType.ADD_TAG) {
        /** @type {[typeof TagSearchableDropdown, ]} */ ;
        // @ts-ignore
        const __VLS_32 = __VLS_asFunctionalComponent(TagSearchableDropdown, new TagSearchableDropdown({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onCreate': {} },
            modelValue: (String(action.value ?? '')
                .split(',')
                .filter(Boolean)),
            options: (__VLS_ctx.tags),
            ...{ class: "w-full" },
        }));
        const __VLS_33 = __VLS_32({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onCreate': {} },
            modelValue: (String(action.value ?? '')
                .split(',')
                .filter(Boolean)),
            options: (__VLS_ctx.tags),
            ...{ class: "w-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_32));
        let __VLS_35;
        let __VLS_36;
        let __VLS_37;
        const __VLS_38 = {
            'onUpdate:modelValue': ((val) => action.value = val.join(','))
        };
        const __VLS_39 = {
            onCreate: (__VLS_ctx.handleCreateTag)
        };
        var __VLS_34;
    }
    else if (action.type === __VLS_ctx.RuleActionType.SET_CATEGORY) {
        /** @type {[typeof SelectCategory, ]} */ ;
        // @ts-ignore
        const __VLS_40 = __VLS_asFunctionalComponent(SelectCategory, new SelectCategory({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (String(action.value ?? '')),
            ...{ class: "w-full" },
        }));
        const __VLS_41 = __VLS_40({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (String(action.value ?? '')),
            ...{ class: "w-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_40));
        let __VLS_43;
        let __VLS_44;
        let __VLS_45;
        const __VLS_46 = {
            'onUpdate:modelValue': ((v) => (action.value = v))
        };
        var __VLS_42;
    }
    else if (action.type === __VLS_ctx.RuleActionType.SET_ACCOUNT) {
        /** @type {[typeof SelectAccount, ]} */ ;
        // @ts-ignore
        const __VLS_47 = __VLS_asFunctionalComponent(SelectAccount, new SelectAccount({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (String(action.value ?? '')),
            ...{ class: "w-full" },
        }));
        const __VLS_48 = __VLS_47({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (String(action.value ?? '')),
            ...{ class: "w-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_47));
        let __VLS_50;
        let __VLS_51;
        let __VLS_52;
        const __VLS_53 = {
            'onUpdate:modelValue': ((v) => (action.value = v))
        };
        var __VLS_49;
    }
    else if (action.type === __VLS_ctx.RuleActionType.SET_RECIPIENT) {
        /** @type {[typeof SelectRecipient, ]} */ ;
        // @ts-ignore
        const __VLS_54 = __VLS_asFunctionalComponent(SelectRecipient, new SelectRecipient({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onCreate': {} },
            modelValue: (String(action.value ?? '')),
            ...{ class: "w-full" },
        }));
        const __VLS_55 = __VLS_54({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onCreate': {} },
            modelValue: (String(action.value ?? '')),
            ...{ class: "w-full" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_54));
        let __VLS_57;
        let __VLS_58;
        let __VLS_59;
        const __VLS_60 = {
            'onUpdate:modelValue': ((v) => (action.value = v))
        };
        const __VLS_61 = {
            onCreate: (__VLS_ctx.handleCreateRecipient)
        };
        var __VLS_56;
    }
    else if (action.type === __VLS_ctx.RuleActionType.LINK_SCHEDULE) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            ...{ onChange: ((e) => (action.value = String(e.target.value))) },
            value: (String(action.value ?? '')),
            ...{ class: "select select-bordered w-full" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "",
            disabled: true,
        });
        for (const [planning] of __VLS_getVForSourceType((__VLS_ctx.planningStore.planningTransactions))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (planning.id),
                value: (planning.id),
            });
            (planning.name);
        }
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onInput: ((e) => (action.value = String(e.target.value))) },
            type: "text",
            value: (String(action.value ?? '')),
            ...{ class: "input input-bordered w-full" },
            placeholder: "Wert eingeben",
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "col-span-1 flex justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeAction(index);
            } },
        type: "button",
        ...{ class: "btn btn-ghost btn-sm" },
        disabled: (__VLS_ctx.actions.length <= 1),
    });
    const __VLS_62 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent(__VLS_62, new __VLS_62({
        icon: "mdi:close",
        ...{ class: "text-error" },
    }));
    const __VLS_64 = __VLS_63({
        icon: "mdi:close",
        ...{ class: "text-error" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.addAction) },
    type: "button",
    ...{ class: "btn btn-ghost btn-sm mt-2" },
});
const __VLS_66 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({
    icon: "mdi:plus",
    ...{ class: "mr-1" },
}));
const __VLS_68 = __VLS_67({
    icon: "mdi:plus",
    ...{ class: "mr-1" },
}, ...__VLS_functionalComponentArgsRest(__VLS_67));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex justify-between items-center pt-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tooltip tooltip-right" },
    'data-tip': "Virtueller Test mit den letzten 250 Transaktionen. Zeigt Vorschau ohne reale Änderungen.",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.applyRuleToExistingTransactions) },
    type: "button",
    ...{ class: "btn btn-outline" },
});
const __VLS_70 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent(__VLS_70, new __VLS_70({
    icon: "mdi:play",
    ...{ class: "mr-2" },
}));
const __VLS_72 = __VLS_71({
    icon: "mdi:play",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-x-2" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.$emit('cancel');
        } },
    type: "button",
    ...{ class: "btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    type: "submit",
    ...{ class: "btn btn-primary" },
});
if (__VLS_ctx.testResults.show) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-4xl h-120" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-lg font-bold mb-4" },
    });
    (__VLS_ctx.testResults.matchCount);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-base-200 p-3 rounded-lg mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm text-base-content/80 mb-2" },
    });
    const __VLS_74 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({
        icon: "mdi:information-outline",
        ...{ class: "inline mr-1" },
    }));
    const __VLS_76 = __VLS_75({
        icon: "mdi:information-outline",
        ...{ class: "inline mr-1" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-xs text-base-content/60" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    if (__VLS_ctx.conditionLogic === 'all') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge badge-primary badge-sm ml-1" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge badge-secondary badge-sm ml-1" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-2" },
    });
    (__VLS_ctx.conditions.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "overflow-x-auto" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        ...{ class: "table table-zebra table-xs w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [tx] of __VLS_getVForSourceType((__VLS_ctx.testResults.transactions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            key: (tx.id),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (tx.date);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.accountStore.getAccountById(tx.accountId)?.name ||
            tx.accountId);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (tx.payee || "-");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (tx.categoryId
            ? __VLS_ctx.categoryStore.getCategoryById(tx.categoryId)?.name ||
                "-"
            : "-");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_78 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (tx.amount),
        }));
        const __VLS_79 = __VLS_78({
            amount: (tx.amount),
        }, ...__VLS_functionalComponentArgsRest(__VLS_78));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (tx.note || "-");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (tx.reconciled ? "Ja" : "Nein");
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.closeTestResults) },
        ...{ class: "btn" },
    });
}
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
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['textarea-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-help']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-bottom']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-help']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-12']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-4']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-7']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['col-span-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-right']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['h-120']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RuleActionType: RuleActionType,
            CurrencyDisplay: CurrencyDisplay,
            TagSearchableDropdown: TagSearchableDropdown,
            SelectCategory: SelectCategory,
            SelectAccount: SelectAccount,
            SelectRecipient: SelectRecipient,
            RuleConditionRow: RuleConditionRow,
            Icon: Icon,
            emit: emit,
            accountStore: accountStore,
            categoryStore: categoryStore,
            planningStore: planningStore,
            name: name,
            description: description,
            isActive: isActive,
            stage: stage,
            priority: priority,
            conditionLogic: conditionLogic,
            conditions: conditions,
            actions: actions,
            testResults: testResults,
            actionTypeOptions: actionTypeOptions,
            tags: tags,
            dynamicConditionText: dynamicConditionText,
            addCondition: addCondition,
            removeCondition: removeCondition,
            addAction: addAction,
            removeAction: removeAction,
            saveRule: saveRule,
            applyRuleToExistingTransactions: applyRuleToExistingTransactions,
            handleCreateRecipient: handleCreateRecipient,
            handleCreateTag: handleCreateTag,
            closeTestResults: closeTestResults,
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
