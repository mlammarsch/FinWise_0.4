<!-- src/views/admin/AdminRulesView.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { useRuleStore } from "@/stores/ruleStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { AutomationRule, Transaction } from "@/types";
import RuleForm from "@/components/rules/RuleForm.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import { debugLog } from "@/utils/logger";

const ruleStore = useRuleStore();
const transactionStore = useTransactionStore();

// UI-Zustand
const showNewRuleModal = ref(false);
const showEditRuleModal = ref(false);
const selectedRule = ref<AutomationRule | null>(null);
const searchQuery = ref("");

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

// Filtern der Regeln nach Suchbegriff
const filteredRules = computed(() => {
  if (!searchQuery.value.trim()) {
    return ruleStore.rules;
  }

  const term = searchQuery.value.toLowerCase();
  return ruleStore.rules.filter((rule) => {
    return (
      rule.name.toLowerCase().includes(term) ||
      (rule.description && rule.description.toLowerCase().includes(term))
    );
  });
});

// Pagination-Berechnung
const totalPages = computed(() => {
  if (itemsPerPage.value === "all") return 1;
  return Math.ceil(filteredRules.value.length / Number(itemsPerPage.value));
});

const paginatedRules = computed(() => {
  if (itemsPerPage.value === "all") return filteredRules.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  const end = start + Number(itemsPerPage.value);
  return filteredRules.value.slice(start, end);
});

// Neue Regel erstellen
const createRule = () => {
  selectedRule.value = null;
  showNewRuleModal.value = true;
};

// Regel bearbeiten
const editRule = (rule: AutomationRule) => {
  selectedRule.value = rule;
  showEditRuleModal.value = true;
  debugLog("[AdminRulesView] Edit rule", rule);
};

// Regel speichern (hinzufügen oder aktualisieren)
const saveRule = (data: Omit<AutomationRule, "id">) => {
  if (selectedRule.value) {
    ruleStore.updateRule(selectedRule.value.id, data);
    debugLog("[AdminRulesView] Updated rule", {
      id: selectedRule.value.id,
      ...data,
    });
  } else {
    ruleStore.addRule(data);
    debugLog("[AdminRulesView] Added rule", data);
  }
  showNewRuleModal.value = false;
  showEditRuleModal.value = false;
};

// Regel löschen
const deleteRule = (rule: AutomationRule) => {
  if (confirm(`Möchten Sie die Regel "${rule.name}" wirklich löschen?`)) {
    ruleStore.deleteRule(rule.id);
    debugLog("[AdminRulesView] Deleted rule", rule.id);
  }
};

// Regel aktivieren/deaktivieren
const toggleRuleActive = (rule: AutomationRule) => {
  ruleStore.updateRule(rule.id, { isActive: !rule.isActive });
  debugLog("[AdminRulesView] Toggled rule active state", {
    id: rule.id,
    isActive: !rule.isActive,
  });
};

// Regel auf bestehende Transaktionen anwenden (Test)
const applyRuleToTransactions = (rule: AutomationRule) => {
  // Holen wir uns die letzten 50 Transaktionen zum Testen
  const transactions = [...transactionStore.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50);

  const matchedTransactions: {
    transaction: Transaction;
    original: Transaction;
    modified: Transaction;
  }[] = [];

  transactions.forEach((tx) => {
    // Wende die Regel auf die Transaktion an
    const modifiedTx = ruleStore.applyRulesToTransaction(
      { ...tx }, // Kopie erstellen
      rule.stage // Phase der Regelanwendung
    );

    // Prüfe, ob sich etwas verändert hat
    if (JSON.stringify(tx) !== JSON.stringify(modifiedTx)) {
      matchedTransactions.push({
        transaction: tx,
        original: { ...tx },
        modified: modifiedTx,
      });
    }
  });

  if (matchedTransactions.length === 0) {
    alert("Die Regel trifft auf keine der letzten 50 Transaktionen zu.");
    return;
  }

  // Zeige an, auf wie viele Transaktionen die Regel zutrifft und frage, ob sie angewendet werden soll
  const confirmApply = confirm(
    `Die Regel trifft auf ${matchedTransactions.length} Transaktionen zu. Möchten Sie die Änderungen jetzt anwenden?`
  );

  if (confirmApply) {
    matchedTransactions.forEach(({ transaction, modified }) => {
      transactionStore.updateTransaction(transaction.id, modified);
    });
    alert(
      `Die Regel wurde auf ${matchedTransactions.length} Transaktionen angewendet.`
    );
    debugLog("[AdminRulesView] Applied rule to transactions", {
      ruleId: rule.id,
      transactionCount: matchedTransactions.length,
    });
  }
};

// Formatierung der Ausführungsphase
function formatStage(stage: string): string {
  switch (stage) {
    case "PRE":
      return "Vorab";
    case "DEFAULT":
      return "Normal";
    case "POST":
      return "Nachgelagert";
    default:
      return stage;
  }
}
</script>

<template>
  <div>
    <!-- Header mit Aktionen -->
    <div
      class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Regelverwaltung</h2>
      <SearchGroup
        btnRight="Neue Regel"
        btnRightIcon="mdi:plus"
        @search="(query) => (searchQuery = query)"
        @btn-right-click="createRule"
      />
    </div>

    <!-- Tabelle -->
    <div class="card bg-base-100 shadow-md border border-base-300 w-full mt-6">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Beschreibung</th>
                <th>Phase</th>
                <th>Priorität</th>
                <th>Bedingungen</th>
                <th>Aktionen</th>
                <th>Status</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="rule in paginatedRules" :key="rule.id">
                <td>{{ rule.name }}</td>
                <td>{{ rule.description || "-" }}</td>
                <td>{{ formatStage(rule.stage) }}</td>
                <td>{{ rule.priority }}</td>
                <td>{{ rule.conditions.length }}</td>
                <td>{{ rule.actions.length }}</td>
                <td>
                  <span
                    class="badge"
                    :class="rule.isActive ? 'badge-success' : 'badge-error'"
                  >
                    {{ rule.isActive ? "Aktiv" : "Inaktiv" }}
                  </span>
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="toggleRuleActive(rule)"
                      :title="rule.isActive ? 'Deaktivieren' : 'Aktivieren'"
                    >
                      <Icon
                        :icon="
                          rule.isActive
                            ? 'mdi:toggle-switch'
                            : 'mdi:toggle-switch-off'
                        "
                        class="text-base"
                        :class="rule.isActive ? 'text-success' : 'text-error'"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="editRule(rule)"
                    >
                      <Icon icon="mdi:pencil" class="text-base" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs border-none text-warning"
                      @click="applyRuleToTransactions(rule)"
                    >
                      <Icon icon="mdi:play" class="text-base" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs border-none text-error/75"
                      @click="deleteRule(rule)"
                    >
                      <Icon icon="mdi:trash-can" class="text-base" />
                    </button>
                  </div>
                </td>
              </tr>
              <!-- Leere Tabelle Hinweis -->
              <tr v-if="paginatedRules.length === 0">
                <td colspan="8" class="text-center py-4">
                  Keine Regeln vorhanden. Erstellen Sie eine mit dem Button
                  "Neue Regel".
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <PagingComponent
          :currentPage="currentPage"
          :totalPages="totalPages"
          :itemsPerPage="itemsPerPage"
          @update:currentPage="(val) => (currentPage = val)"
          @update:itemsPerPage="(val) => (itemsPerPage = val)"
        />
      </div>
    </div>

    <!-- Modals -->
    <div v-if="showNewRuleModal" class="modal modal-open">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4">Neue Regel</h3>
        <RuleForm
          @save="saveRule"
          @cancel="showNewRuleModal = false"
          @apply="applyRuleToTransactions"
        />
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showNewRuleModal = false"
      ></div>
    </div>

    <div v-if="showEditRuleModal && selectedRule" class="modal modal-open">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-4">Regel bearbeiten</h3>
        <RuleForm
          :rule="selectedRule"
          :is-edit="true"
          @save="saveRule"
          @cancel="showEditRuleModal = false"
          @apply="applyRuleToTransactions"
        />
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="showEditRuleModal = false"
      ></div>
    </div>
  </div>
</template>
