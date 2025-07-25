<!-- src/views/admin/AdminRulesView.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { useRuleStore } from "@/stores/ruleStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { AutomationRule, Transaction } from "@/types";
import RuleForm from "@/components/rules/RuleForm.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";

const ruleStore = useRuleStore();
const transactionStore = useTransactionStore();
const recipientStore = useRecipientStore();

// UI-Zustand
const showNewRuleModal = ref(false);
const showEditRuleModal = ref(false);
const selectedRule = ref<AutomationRule | null>(null);
const searchQuery = ref("");

// Bestätigungsmodal für "Alle Regeln anwenden"
const showApplyAllRulesModal = ref(false);
const applyAllRulesData = ref<{
  activeRulesCount: number;
  totalTransactionsCount: number;
}>({
  activeRulesCount: 0,
  totalTransactionsCount: 0,
});

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

// Filtern der Regeln nach Suchbegriff
const filteredRules = computed(() => {
  if (!searchQuery.value.trim()) {
    return ruleStore.rules;
  }

  const term = searchQuery.value.toLowerCase();
  return ruleStore.rules.filter((rule: AutomationRule) => {
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

// Regel duplizieren
const duplicateRule = async (rule: AutomationRule) => {
  try {
    // Erstelle eine Kopie der Regel mit neuem Namen und ohne ID
    const duplicatedRuleData: Omit<AutomationRule, "id" | "updatedAt"> = {
      name: `Kopie von ${rule.name}`,
      description: rule.description,
      stage: rule.stage,
      conditions: [...rule.conditions], // Deep copy der Bedingungen
      actions: [...rule.actions], // Deep copy der Aktionen
      priority: rule.priority,
      isActive: rule.isActive,
      conditionLogic: rule.conditionLogic,
    };

    // Regel über den Store hinzufügen (generiert automatisch neue ID und updatedAt)
    await ruleStore.addRule(duplicatedRuleData);

    debugLog("[AdminRulesView] Duplicated rule", {
      originalId: rule.id,
      originalName: rule.name,
      newName: duplicatedRuleData.name,
    });

    // Toast-Notification anzeigen
    showToastNotification(
      `Die Regel "${rule.name}" wurde erfolgreich als "${duplicatedRuleData.name}" dupliziert.`,
      "success"
    );
  } catch (error) {
    console.error(`Fehler beim Duplizieren der Regel "${rule.name}":`, error);
    showToastNotification(
      `Fehler beim Duplizieren der Regel "${rule.name}". Bitte versuchen Sie es erneut.`,
      "error"
    );
  }
};

// Regel löschen
const deleteRule = (rule: AutomationRule) => {
  if (confirm(`Möchten Sie die Regel "${rule.name}" wirklich löschen?`)) {
    ruleStore.deleteRule(rule.id);
    debugLog("[AdminRulesView] Deleted rule", rule.id);
  }
};

// Regel aktivieren/deaktivieren
const toggleRuleActive = async (rule: AutomationRule) => {
  try {
    const newStatus = !rule.isActive;
    // Vollständige Regel-Daten mit neuem Status übergeben
    const updatedRule = {
      ...rule,
      isActive: newStatus,
      updated_at: new Date().toISOString(),
    };

    // ID aus dem Update-Objekt entfernen, da updateRule sie als separaten Parameter erwartet
    const { id, ...ruleWithoutId } = updatedRule;

    await ruleStore.updateRule(rule.id, ruleWithoutId);
    debugLog("[AdminRulesView] Toggled rule active state", {
      id: rule.id,
      isActive: newStatus,
    });
  } catch (error) {
    console.error(
      `Fehler beim Umschalten des Regel-Status für "${rule.name}":`,
      error
    );
  }
};

// Regel auf bestehende Transaktionen anwenden - Vereinfachte Version
const showApplyRuleModal = ref(false);
const applyRuleData = ref<{
  rule: AutomationRule | null;
  matchedCount: number;
}>({
  rule: null,
  matchedCount: 0,
});

// Toast-Notification System
const showToast = ref(false);
const toastMessage = ref("");
const toastType = ref<"success" | "error">("success");
let toastTimeout: NodeJS.Timeout | null = null;

const showToastNotification = (
  message: string,
  type: "success" | "error" = "success"
) => {
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;

  // Auto-hide nach 3 Sekunden
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    showToast.value = false;
  }, 3000);
};

const hideToast = () => {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  showToast.value = false;
};

const applyRuleToTransactions = async (rule: AutomationRule) => {
  // Alle Transaktionen holen
  const allTransactions = [...transactionStore.transactions];

  debugLog("[AdminRulesView] Analyzing rule application", {
    ruleId: rule.id,
    ruleName: rule.name,
    totalTransactions: allTransactions.length,
    ruleConditions: rule.conditions,
  });

  let matchedCount = 0;
  const matchedTransactions = [];

  // Alle Transaktionen durchgehen und prüfen, ob die Regel zutrifft
  for (const tx of allTransactions) {
    try {
      if (ruleStore.checkConditions(rule.conditions, tx)) {
        matchedCount++;
        matchedTransactions.push(tx);

        // Debug-Log für die ersten 5 Treffer
        if (matchedCount <= 5) {
          debugLog("[AdminRulesView] Rule match found", {
            transactionId: tx.id,
            payee: tx.payee,
            recipientId: tx.recipientId,
            date: tx.date,
            amount: tx.amount,
          });
        }
      }
    } catch (error) {
      console.error(
        `Fehler beim Prüfen der Regel auf Transaktion ${tx.id}:`,
        error
      );
    }
  }

  // Daten für Modal setzen und Modal öffnen
  applyRuleData.value = {
    rule,
    matchedCount,
  };
  showApplyRuleModal.value = true;

  debugLog("[AdminRulesView] Rule analysis completed", {
    ruleId: rule.id,
    matchedCount: matchedCount,
    totalTransactions: allTransactions.length,
    sampleMatches: matchedTransactions.slice(0, 3).map((tx) => ({
      id: tx.id,
      payee: tx.payee,
      recipientId: tx.recipientId,
    })),
  });
};

// Regel tatsächlich anwenden (nach Bestätigung)
const confirmApplyRule = async () => {
  if (!applyRuleData.value.rule || applyRuleData.value.matchedCount === 0) {
    return;
  }

  try {
    const rule = applyRuleData.value.rule;
    const allTransactions = [...transactionStore.transactions];
    let appliedCount = 0;

    // Alle Transaktionen durchgehen und Regel anwenden
    for (const tx of allTransactions) {
      if (ruleStore.checkConditions(rule.conditions, tx)) {
        // Regel-Aktionen auf die Transaktion anwenden
        const updates: Partial<Transaction> = {};

        for (const action of rule.actions) {
          switch (action.type) {
            case "SET_CATEGORY":
              if (tx.categoryId !== action.value) {
                updates.categoryId = String(action.value);
              }
              break;
            case "SET_RECIPIENT":
              if (tx.recipientId !== action.value) {
                updates.recipientId = String(action.value);
              }
              break;
            case "SET_NOTE":
              if (tx.note !== action.value) {
                updates.note = String(action.value);
              }
              break;
            case "ADD_TAG":
              const currentTags = tx.tagIds || [];
              const newTag = String(action.value);
              if (!currentTags.includes(newTag)) {
                updates.tagIds = [...currentTags, newTag];
              }
              break;
            case "SET_ACCOUNT":
              if (tx.accountId !== action.value) {
                updates.accountId = String(action.value);
              }
              break;
          }
        }

        // Update über TransactionStore, falls Änderungen vorhanden
        if (Object.keys(updates).length > 0) {
          await transactionStore.updateTransaction(tx.id, updates);
          appliedCount++;
        }
      }
    }

    // Toast-Notification anzeigen
    showToastNotification(
      `Die Regel "${rule.name}" wurde erfolgreich auf ${appliedCount} Transaktionen angewendet.`,
      "success"
    );

    debugLog("[AdminRulesView] Rule applied successfully", {
      ruleId: rule.id,
      transactionCount: appliedCount,
    });
  } catch (error) {
    console.error("Fehler beim Anwenden der Regel:", error);
    showToastNotification(
      "Fehler beim Anwenden der Regel. Bitte versuchen Sie es erneut.",
      "error"
    );
  } finally {
    // Modal schließen und Daten zurücksetzen
    showApplyRuleModal.value = false;
    applyRuleData.value = {
      rule: null,
      matchedCount: 0,
    };
  }
};

// Modal schließen ohne Änderungen
const cancelApplyRule = () => {
  showApplyRuleModal.value = false;
  applyRuleData.value = {
    rule: null,
    matchedCount: 0,
  };
};

// Alle aktiven Regeln auf alle Transaktionen anwenden
const applyAllRules = async () => {
  try {
    // Alle aktiven Regeln holen, sortiert nach Priorität
    const activeRules = ruleStore.rules
      .filter((rule: AutomationRule) => rule.isActive)
      .sort(
        (a: AutomationRule, b: AutomationRule) =>
          (a.priority || 0) - (b.priority || 0)
      );

    if (activeRules.length === 0) {
      showToastNotification(
        "Keine aktiven Regeln vorhanden. Aktivieren Sie mindestens eine Regel.",
        "error"
      );
      return;
    }

    // Daten für Bestätigungsmodal setzen und Modal öffnen
    applyAllRulesData.value = {
      activeRulesCount: activeRules.length,
      totalTransactionsCount: transactionStore.transactions.length,
    };
    showApplyAllRulesModal.value = true;
  } catch (error) {
    console.error("Fehler beim Vorbereiten der Regel-Anwendung:", error);
    showToastNotification(
      "Fehler beim Vorbereiten der Regel-Anwendung. Bitte versuchen Sie es erneut.",
      "error"
    );
  }
};

// Bestätigung für "Alle Regeln anwenden" - tatsächliche Ausführung
const confirmApplyAllRules = async () => {
  try {
    showApplyAllRulesModal.value = false;

    // Alle aktiven Regeln holen, sortiert nach Priorität
    const activeRules = ruleStore.rules
      .filter((rule: AutomationRule) => rule.isActive)
      .sort(
        (a: AutomationRule, b: AutomationRule) =>
          (a.priority || 0) - (b.priority || 0)
      );

    const allTransactions = [...transactionStore.transactions];
    let totalAppliedCount = 0;
    const ruleResults: { ruleName: string; appliedCount: number }[] = [];

    debugLog("[AdminRulesView] Starting bulk rule application", {
      activeRulesCount: activeRules.length,
      totalTransactions: allTransactions.length,
    });

    // Jede aktive Regel auf alle Transaktionen anwenden
    for (const rule of activeRules) {
      let ruleAppliedCount = 0;

      for (const tx of allTransactions) {
        try {
          if (ruleStore.checkConditions(rule.conditions, tx)) {
            // Regel-Aktionen auf die Transaktion anwenden
            const updates: Partial<Transaction> = {};

            for (const action of rule.actions) {
              switch (action.type) {
                case "SET_CATEGORY":
                  if (tx.categoryId !== action.value) {
                    updates.categoryId = String(action.value);
                  }
                  break;
                case "SET_RECIPIENT":
                  if (tx.recipientId !== action.value) {
                    updates.recipientId = String(action.value);
                  }
                  break;
                case "SET_NOTE":
                  if (tx.note !== action.value) {
                    updates.note = String(action.value);
                  }
                  break;
                case "ADD_TAG":
                  const currentTags = tx.tagIds || [];
                  const newTag = String(action.value);
                  if (!currentTags.includes(newTag)) {
                    updates.tagIds = [...currentTags, newTag];
                  }
                  break;
                case "SET_ACCOUNT":
                  if (tx.accountId !== action.value) {
                    updates.accountId = String(action.value);
                  }
                  break;
              }
            }

            // Update über TransactionStore, falls Änderungen vorhanden
            if (Object.keys(updates).length > 0) {
              await transactionStore.updateTransaction(tx.id, updates);
              ruleAppliedCount++;
              totalAppliedCount++;
            }
          }
        } catch (error) {
          console.error(
            `Fehler beim Anwenden der Regel "${rule.name}" auf Transaktion ${tx.id}:`,
            error
          );
        }
      }

      ruleResults.push({
        ruleName: rule.name,
        appliedCount: ruleAppliedCount,
      });

      debugLog("[AdminRulesView] Rule applied", {
        ruleId: rule.id,
        ruleName: rule.name,
        appliedCount: ruleAppliedCount,
      });
    }

    // Erfolgs-Toast mit Details anzeigen
    const successMessage = `Alle Regeln wurden erfolgreich angewendet!\n\nInsgesamt: ${totalAppliedCount} Änderungen\n${ruleResults
      .filter((r) => r.appliedCount > 0)
      .map((r) => `• ${r.ruleName}: ${r.appliedCount}`)
      .join("\n")}`;

    showToastNotification(
      `Alle ${activeRules.length} Regeln wurden erfolgreich angewendet. Insgesamt ${totalAppliedCount} Transaktionen wurden aktualisiert.`,
      "success"
    );

    debugLog("[AdminRulesView] Bulk rule application completed", {
      totalRules: activeRules.length,
      totalAppliedCount,
      ruleResults,
    });
  } catch (error) {
    console.error("Fehler beim Anwenden aller Regeln:", error);
    showToastNotification(
      "Fehler beim Anwenden der Regeln. Bitte versuchen Sie es erneut.",
      "error"
    );
  }
};

// Abbrechen der "Alle Regeln anwenden" Aktion
const cancelApplyAllRules = () => {
  showApplyAllRulesModal.value = false;
  applyAllRulesData.value = {
    activeRulesCount: 0,
    totalTransactionsCount: 0,
  };
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
        btnMiddle="Alle Regeln anwenden"
        btnMiddleIcon="mdi:play-circle"
        btnRight="Neue Regel"
        btnRightIcon="mdi:plus"
        @search="(query: string) => (searchQuery = query)"
        @btn-middle-click="applyAllRules"
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
              <tr
                v-for="rule in paginatedRules"
                :key="rule.id"
              >
                <td>{{ rule?.name || "-" }}</td>
                <td>{{ rule?.description || "-" }}</td>
                <td>{{ rule?.stage ? formatStage(rule.stage) : "-" }}</td>
                <td>{{ rule?.priority || 0 }}</td>
                <td>{{ rule?.conditions?.length || 0 }}</td>
                <td>{{ rule?.actions?.length || 0 }}</td>
                <td>
                  <div
                    class="badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity"
                    :class="rule.isActive ? 'badge-success' : 'badge-error'"
                    @click="toggleRuleActive(rule)"
                    :title="`Klicken um Status zu ${
                      rule.isActive ? 'Inaktiv' : 'Aktiv'
                    } zu ändern`"
                  >
                    {{ rule.isActive ? "Aktiv" : "Inaktiv" }}
                  </div>
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="editRule(rule)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                    <div
                      class="tooltip tooltip-left"
                      data-tip="Regel auf alle existierenden Transaktionen anwenden. Zeigt Vorschau und fragt nach Bestätigung."
                    >
                      <button
                        class="btn btn-ghost btn-xs border-none text-warning"
                        @click="applyRuleToTransactions(rule)"
                      >
                        <Icon
                          icon="mdi:play"
                          class="text-base"
                        />
                      </button>
                    </div>
                    <div
                      class="tooltip tooltip-left"
                      data-tip="Regel duplizieren. Erstellt eine Kopie der Regel mit dem Präfix 'Kopie von'."
                    >
                      <button
                        class="btn btn-ghost btn-xs border-none text-info"
                        @click="duplicateRule(rule)"
                      >
                        <Icon
                          icon="mdi:content-copy"
                          class="text-base"
                        />
                      </button>
                    </div>
                    <button
                      class="btn btn-ghost btn-xs border-none text-error/75"
                      @click="deleteRule(rule)"
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
              <!-- Leere Tabelle Hinweis -->
              <tr v-if="paginatedRules.length === 0">
                <td
                  colspan="8"
                  class="text-center py-4"
                >
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
          @update:currentPage="(val: number) => (currentPage = val)"
          @update:itemsPerPage="(val: number | string) => (itemsPerPage = val)"
        />
      </div>
    </div>

    <!-- Modals -->
    <div
      v-if="showNewRuleModal"
      class="modal modal-open"
    >
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

    <div
      v-if="showEditRuleModal && selectedRule"
      class="modal modal-open"
    >
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

    <!-- Vereinfachtes Modal für Regel-Anwendung -->
    <div
      v-if="showApplyRuleModal"
      class="modal modal-open"
    >
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          Regel anwenden: {{ applyRuleData.rule?.name }}
        </h3>

        <div class="bg-base-200 p-4 rounded-lg mb-4">
          <p class="text-sm">
            Die Regel trifft auf
            <strong>{{ applyRuleData.matchedCount }}</strong> von
            {{ transactionStore.transactions.length }} Transaktionen zu.
          </p>
          <p
            class="text-xs text-base-content/70 mt-2"
            v-if="applyRuleData.matchedCount > 0"
          >
            Möchten Sie die Regel auf diese Transaktionen anwenden?
          </p>
          <p
            class="text-xs text-base-content/70 mt-2"
            v-else
          >
            Die Regel trifft auf keinen Datensatz zu.
          </p>
        </div>

        <div class="modal-action">
          <button
            class="btn"
            @click="cancelApplyRule"
          >
            {{ applyRuleData.matchedCount > 0 ? "Abbrechen" : "OK" }}
          </button>
          <button
            v-if="applyRuleData.matchedCount > 0"
            class="btn btn-primary"
            @click="confirmApplyRule"
          >
            Regel anwenden
          </button>
        </div>
      </div>
      <div
        class="modal-backdrop bg-black/30"
        @click="cancelApplyRule"
      ></div>
    </div>

    <!-- Bestätigungsmodal für "Alle Regeln anwenden" -->
    <ConfirmationModal
      v-if="showApplyAllRulesModal"
      title="Alle Regeln anwenden"
      :message="`Möchten Sie alle ${applyAllRulesData.activeRulesCount} aktiven Regeln auf alle ${applyAllRulesData.totalTransactionsCount} Transaktionen anwenden?\n\nDies kann nicht rückgängig gemacht werden.`"
      confirmText="Regeln anwenden"
      cancelText="Abbrechen"
      @confirm="confirmApplyAllRules"
      @cancel="cancelApplyAllRules"
    />

    <!-- Toast-Notification -->
    <div
      v-if="showToast"
      class="toast toast-bottom toast-start z-50"
      @click="hideToast"
    >
      <div
        class="alert cursor-pointer transition-all duration-300"
        :class="{
          'alert-success': toastType === 'success',
          'alert-error': toastType === 'error',
        }"
      >
        <Icon
          :icon="
            toastType === 'success' ? 'mdi:check-circle' : 'mdi:alert-circle'
          "
          class="text-lg"
        />
        <span>{{ toastMessage }}</span>
      </div>
    </div>
  </div>
</template>
