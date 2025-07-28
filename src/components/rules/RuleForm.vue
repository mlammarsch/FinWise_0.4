<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/rules/RuleForm.vue
 * Komponente zum Erstellen und Bearbeiten von Automatisierungsregeln.
 *
 * Komponenten-Props:
 * - rule?: AutomationRule - Bestehende Regel für Bearbeitungsmodus
 * - isEdit?: boolean - Gibt an, ob es sich um eine Bearbeitung handelt
 * - initialValues?: Partial<AutomationRule> - Vorausgefüllte Werte für neue Regeln
 *
 * Emits:
 * - save: Gibt die erstellte/aktualisierte Regel zurück
 * - cancel: Bricht den Vorgang ab
 * - apply: Testet die Regel auf vorhandene Transaktionen an
 */
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import {
  RuleConditionType,
  RuleActionType,
  AutomationRule,
  RuleCondition,
  RuleAction,
  Transaction,
} from "@/types";
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

const props = defineProps<{
  rule?: AutomationRule;
  isEdit?: boolean;
  initialValues?: Partial<AutomationRule>;
}>();

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
const stage = ref<"PRE" | "DEFAULT" | "POST">("DEFAULT");
const priority = ref(100);
const conditionLogic = ref<"all" | "any">("all");
const conditions = ref<RuleCondition[]>([]);
const actions = ref<RuleAction[]>([]);

// Für Test-Ergebnisse
const testResults = reactive({
  show: false,
  matchCount: 0,
  transactions: [] as Transaction[],
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
  } else if (props.initialValues) {
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
        case RuleConditionType.PAYEE_EQUALS:
        case RuleConditionType.PAYEE_CONTAINS:
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
const tags = computed(() =>
  tagStore.tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }))
);

// Computed property für dynamischen Bedingungstext
const dynamicConditionText = computed(() => {
  if (conditionLogic.value === "all") {
    return "Wenn **alle** der folgenden Bedingungen zutreffen:";
  } else if (conditionLogic.value === "any") {
    return "Wenn **eine beliebige** der folgenden Bedingungen zutrifft:";
  }
  return "Bedingungen:";
});

function addCondition() {
  conditions.value.push({
    type: RuleConditionType.PAYEE_CONTAINS,
    operator: "contains",
    value: "",
    source: "recipient",
  });
}

function removeCondition(index: number) {
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

function removeAction(index: number) {
  if (actions.value.length > 1) {
    actions.value.splice(index, 1);
  }
}

function saveRule() {
  const ruleData: Omit<AutomationRule, "id"> = {
    name: name.value,
    description: description.value,
    stage: stage.value,
    conditions: conditions.value,
    actions: actions.value,
    priority: priority.value,
    isActive: isActive.value,
    conditionLogic: conditionLogic.value,
  };

  debugLog("[RuleForm] saveRule", ruleData);
  emit("save", ruleData);
}

function applyRuleToExistingTransactions() {
  const ruleData: AutomationRule = {
    id: props.rule?.id || uuidv4(),
    name: name.value,
    description: description.value,
    stage: stage.value,
    conditions: conditions.value,
    actions: actions.value,
    priority: priority.value,
    isActive: isActive.value,
    conditionLogic: conditionLogic.value,
  };

  debugLog(
    "[RuleForm] applyRuleToExistingTransactions (Virtual Test)",
    ruleData
  );

  // Virtuelle Regelprüfung - nur die letzten 250 EXPENSE/INCOME Transaktionen testen
  // Rules greifen nicht bei CATEGORYTRANSFER und ACCOUNTTRANSFER
  const allTransactions = [...transactionStore.transactions]
    .filter((tx) => tx.type === "EXPENSE" || tx.type === "INCOME")
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
async function handleCreateRecipient(recipientData: { name: string }) {
  try {
    debugLog("[RuleForm] handleCreateRecipient", recipientData);
    const newRecipient = await recipientStore.addRecipient({
      name: recipientData.name,
    });
    debugLog("[RuleForm] Neuer Empfänger erstellt", newRecipient);

    // Setze den neuen Empfänger als Wert für die entsprechende Aktion
    // Suche die erste SET_RECIPIENT Aktion ohne Wert, oder falls alle einen Wert haben, die erste
    const currentAction =
      actions.value.find(
        (action) =>
          action.type === RuleActionType.SET_RECIPIENT && !action.value
      ) ||
      actions.value.find(
        (action) => action.type === RuleActionType.SET_RECIPIENT
      );

    if (currentAction && newRecipient) {
      currentAction.value = newRecipient.id;
    }
  } catch (error) {
    errorLog("[RuleForm] Fehler beim Erstellen des Empfängers", error);
  }
}

// Erstellt einen neuen Tag im Store
async function handleCreateTag(tagData: { name: string; color?: string }) {
  try {
    debugLog("[RuleForm] handleCreateTag", tagData);
    const newTag = await tagStore.addTag({
      name: tagData.name,
      color: tagData.color,
    });
    debugLog("[RuleForm] Neuer Tag erstellt", newTag);

    // Für ADD_TAG Aktionen: Füge den neuen Tag zur bestehenden Auswahl hinzu
    // Suche die erste ADD_TAG Aktion, die gerade bearbeitet wird
    const currentAction = actions.value.find(
      (action: RuleAction) => action.type === RuleActionType.ADD_TAG
    );

    if (currentAction && newTag) {
      // Konvertiere den aktuellen Wert zu einem Array, füge den neuen Tag hinzu
      const currentTags = currentAction.value
        ? currentAction.value.split(",")
        : [];
      if (!currentTags.includes(newTag.id)) {
        currentTags.push(newTag.id);
        currentAction.value = currentTags.join(",");
      }
    }
  } catch (error) {
    errorLog("[RuleForm] Fehler beim Erstellen des Tags", error);
  }
}

// Schließen des Test-Modals
function closeTestResults() {
  testResults.show = false;
}

// ESC-Taste-Handler für Modal
function handleKeydown(event: KeyboardEvent) {
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
</script>

<template>
  <div class="relative">
    <!-- X-Icon zum Schließen -->
    <button
      type="button"
      class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
      @click="emit('cancel')"
    >
      <Icon
        icon="mdi:close"
        class="text-lg"
      />
    </button>

    <form
      @submit.prevent="saveRule"
      class="space-y-4"
    >
      <!-- Grundlegende Regelinformationen -->
      <fieldset class="fieldset">
        <legend class="fieldset-legend">
          Regelname<span class="text-error">*</span>
        </legend>
        <input
          type="text"
          v-model="name"
          class="input input-bordered w-full"
          required
          placeholder="Name der Regel"
        />
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">Beschreibung</legend>
        <textarea
          v-model="description"
          class="textarea textarea-bordered w-full"
          placeholder="Optionale Beschreibung der Regel"
        ></textarea>
      </fieldset>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Ausführungsphase -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Ausführungsphase
            <div
              class="tooltip tooltip-bottom max-w-xs"
              data-tip="Bestimmt die Reihenfolge der Regelausführung:

PRE (Vorab): Wird vor allen anderen Regeln ausgeführt
• Beispiel: Grundlegende Kategorisierung von Überweisungen
• Verwendung: Wenn eine Regel andere Regeln beeinflussen soll

DEFAULT (Normal): Standard-Ausführungsreihenfolge
• Beispiel: Normale Kategorisierung nach Empfänger oder Betrag
• Verwendung: Für die meisten alltäglichen Regeln

POST (Nachgelagert): Wird nach allen anderen Regeln ausgeführt
• Beispiel: Finale Bereinigung oder spezielle Markierungen
• Verwendung: Für Regeln, die auf bereits verarbeitete Daten zugreifen

Innerhalb jeder Phase bestimmt die Priorität die genaue Reihenfolge."
            >
              <Icon
                icon="mdi:help-circle-outline"
                class="text-base-content/50 cursor-help ml-1"
              />
            </div>
          </legend>
          <select
            v-model="stage"
            class="select select-bordered w-full"
          >
            <option value="PRE">PRE (Vorab)</option>
            <option value="DEFAULT">DEFAULT (Normal)</option>
            <option value="POST">POST (Nachgelagert)</option>
          </select>
        </fieldset>

        <!-- Priorität -->
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Priorität
            <div
              class="tooltip tooltip-bottom max-w-xs"
              data-tip="Bestimmt die Ausführungsreihenfolge innerhalb der gewählten Phase:

Niedrigere Zahlen = Höhere Priorität (werden zuerst ausgeführt)
Höhere Zahlen = Niedrigere Priorität (werden später ausgeführt)

Beispiele:
• Priorität 10: Sehr wichtige Regel (z.B. Miete kategorisieren)
• Priorität 50: Wichtige Regel (z.B. Supermarkt-Einkäufe)
• Priorität 100: Standard-Priorität (Standardwert)
• Priorität 200: Weniger wichtige Regel (z.B. allgemeine Kategorisierung)

💡 Tipp: Lassen Sie Platz zwischen den Prioritäten (10, 20, 30...)
um später neue Regeln dazwischen einfügen zu können."
            >
              <Icon
                icon="mdi:help-circle-outline"
                class="text-base-content/50 cursor-help ml-1"
              />
            </div>
          </legend>
          <input
            type="number"
            v-model="priority"
            class="input input-bordered w-full"
            min="1"
            max="999"
          />
        </fieldset>

        <!-- Aktiv/Inaktiv -->
        <div class="form-control pt-8">
          <label class="cursor-pointer label justify-start">
            <input
              type="checkbox"
              v-model="isActive"
              class="toggle mr-2"
            />
            <span class="label-text">Regel aktiv</span>
          </label>
        </div>
      </div>

      <!-- Bedingungsteil -->
      <div class="card bg-base-200 p-4">
        <h3 class="text-lg font-semibold mb-4 flex items-center">
          <Icon
            icon="mdi:filter-outline"
            class="mr-2"
          />
          <span v-html="dynamicConditionText"></span>
        </h3>

        <!-- Dropdown für Haupt-Verknüpfungsoperator -->
        <div class="mb-4">
          <label class="label">
            <span class="label-text">Verknüpfung der Bedingungen:</span>
          </label>
          <select
            v-model="conditionLogic"
            class="select select-bordered w-full max-w-xs"
          >
            <option value="all">Alle Bedingungen müssen zutreffen (UND)</option>
            <option value="any">
              Beliebige Bedingung muss zutreffen (ODER)
            </option>
          </select>
        </div>

        <RuleConditionRow
          v-for="(condition, index) in conditions"
          :key="index"
          :condition="condition"
          :index="index"
          :can-remove="conditions.length > 1"
          @update:condition="
            (updatedCondition: RuleCondition) => (conditions[index] = updatedCondition)
          "
          @remove="removeCondition(index)"
        />

        <button
          type="button"
          class="btn btn-ghost btn-sm mt-2"
          @click="addCondition"
        >
          <Icon
            icon="mdi:plus"
            class="mr-1"
          />
          Weitere Bedingung hinzufügen
        </button>
      </div>

      <!-- Aktionsteil -->
      <div class="card bg-base-200 p-4">
        <h3 class="text-lg font-semibold mb-4 flex items-center">
          <Icon
            icon="mdi:lightning-bolt"
            class="mr-2"
          />
          Dann führe diese Aktionen aus:
        </h3>

        <div
          v-for="(action, index) in actions"
          :key="index"
          class="mb-3"
        >
          <div class="grid grid-cols-12 gap-3 items-center">
            <!-- Aktionstyp -->
            <div class="col-span-4">
              <select
                v-model="action.type"
                class="select select-bordered w-full"
              >
                <option
                  v-for="option in actionTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>

            <!-- Aktionswert -->
            <div class="col-span-7">
              <!-- Tag-Auswahl -->
              <TagSearchableDropdown
                v-if="action.type === RuleActionType.ADD_TAG"
                :model-value="
                  action.value ? action.value.split(',').filter(Boolean) : []
                "
                @update:model-value="(val: string[]) => action.value = val.join(',')"
                :options="tags"
                class="w-full"
                @create="handleCreateTag"
              />

              <!-- Kategorie-Auswahl -->
              <SelectCategory
                v-else-if="action.type === RuleActionType.SET_CATEGORY"
                v-model="action.value"
                class="w-full"
              />

              <!-- Konto-Auswahl -->
              <SelectAccount
                v-else-if="action.type === RuleActionType.SET_ACCOUNT"
                v-model="action.value"
                class="w-full"
              />

              <!-- Empfänger-Auswahl -->
              <SelectRecipient
                v-else-if="action.type === RuleActionType.SET_RECIPIENT"
                v-model="action.value"
                class="w-full"
                @create="handleCreateRecipient"
              />

              <!-- Planungsauswahl -->
              <select
                v-else-if="action.type === RuleActionType.LINK_SCHEDULE"
                v-model="action.value"
                class="select select-bordered w-full"
              >
                <option
                  value=""
                  disabled
                >
                  Planung auswählen
                </option>
                <option
                  v-for="planning in planningStore.planningTransactions"
                  :key="planning.id"
                  :value="planning.id"
                >
                  {{ planning.name }}
                </option>
              </select>

              <!-- Texteingabe für andere Aktionen -->
              <input
                v-else
                type="text"
                v-model="action.value"
                class="input input-bordered w-full"
                placeholder="Wert eingeben"
              />
            </div>

            <!-- Entfernen-Button -->
            <div class="col-span-1 flex justify-center">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                @click="removeAction(index)"
                :disabled="actions.length <= 1"
              >
                <Icon
                  icon="mdi:close"
                  class="text-error"
                />
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-ghost btn-sm mt-2"
          @click="addAction"
        >
          <Icon
            icon="mdi:plus"
            class="mr-1"
          />
          Weitere Aktion hinzufügen
        </button>
      </div>

      <!-- Test-Button und Aktionsbuttons -->
      <div class="flex justify-between items-center pt-4">
        <div
          class="tooltip tooltip-right"
          data-tip="Virtueller Test mit den letzten 250 Transaktionen. Zeigt Vorschau ohne reale Änderungen."
        >
          <button
            type="button"
            class="btn btn-outline"
            @click="applyRuleToExistingTransactions"
          >
            <Icon
              icon="mdi:play"
              class="mr-2"
            />
            Regel testen
          </button>
        </div>

        <div class="space-x-2">
          <button
            type="button"
            class="btn"
            @click="$emit('cancel')"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            class="btn btn-primary"
          >
            Speichern
          </button>
        </div>
      </div>
    </form>

    <!-- Modal für Testergebnisse -->
    <div
      v-if="testResults.show"
      class="modal modal-open"
    >
      <div class="modal-box max-w-4xl h-120">
        <h3 class="text-lg font-bold mb-4">
          Virtueller Test: {{ testResults.matchCount }} von 250 Transaktionen
          gefunden
        </h3>

        <div class="bg-base-200 p-3 rounded-lg mb-4">
          <p class="text-sm text-base-content/80 mb-2">
            <Icon
              icon="mdi:information-outline"
              class="inline mr-1"
            />
            Dies ist ein virtueller Test mit den letzten 250 Transaktionen. Es
            werden keine realen Änderungen vorgenommen.
          </p>
          <div class="text-xs text-base-content/60">
            <strong>Regel-Logik:</strong>
            <span
              v-if="conditionLogic === 'all'"
              class="badge badge-primary badge-sm ml-1"
            >
              ALLE Bedingungen (UND)
            </span>
            <span
              v-else
              class="badge badge-secondary badge-sm ml-1"
            >
              BELIEBIGE Bedingung (ODER)
            </span>
            <span class="ml-2">{{ conditions.length }} Bedingung(en)</span>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-zebra table-xs w-full">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Konto</th>
                <th>Empfänger</th>
                <th>Kategorie</th>
                <th>Betrag</th>
                <th>Notiz</th>
                <th>Abgegl.</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tx in testResults.transactions"
                :key="tx.id"
              >
                <td>{{ tx.date }}</td>
                <td>
                  {{
                    accountStore.getAccountById(tx.accountId)?.name ||
                    tx.accountId
                  }}
                </td>
                <td>{{ tx.payee || "-" }}</td>
                <td>
                  {{
                    categoryStore.getCategoryById(tx.categoryId)?.name || "-"
                  }}
                </td>
                <td><CurrencyDisplay :amount="tx.amount" /></td>
                <td>{{ tx.note || "-" }}</td>
                <td>{{ tx.reconciled ? "Ja" : "Nein" }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="modal-action">
          <button
            class="btn"
            @click="closeTestResults"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
