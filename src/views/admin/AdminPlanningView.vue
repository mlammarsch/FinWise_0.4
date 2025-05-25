<!-- Datei: src/views/admin/AdminPlanningView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/admin/AdminPlanningView.vue
 * Administrative Verwaltung von Planungstransaktionen.
 */
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import {
  PlanningTransaction,
  RecurrencePattern,
  TransactionType,
} from "@/types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
import { debugLog } from "@/utils/logger";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import { PlanningService } from "@/services/PlanningService";
import { Icon } from "@iconify/vue";

const planningStore = usePlanningStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();

const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const selectedPlanning = ref<PlanningTransaction | null>(null);
const searchQuery = ref("");

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

const filteredPlannings = computed(() => {
  const term = searchQuery.value.trim().toLowerCase();
  if (!term) return planningStore.planningTransactions;
  return planningStore.planningTransactions.filter((p) => {
    const payee =
      recipientStore.getRecipientById(p.recipientId || "")?.name || "";
    const acc = accountStore.getAccountById(p.accountId)?.name || "";
    return (
      p.name.toLowerCase().includes(term) ||
      payee.toLowerCase().includes(term) ||
      acc.toLowerCase().includes(term) ||
      String(p.amount).includes(term)
    );
  });
});

const totalPages = computed(() =>
  itemsPerPage.value === "all"
    ? 1
    : Math.ceil(filteredPlannings.value.length / Number(itemsPerPage.value))
);

const paginatedPlannings = computed(() => {
  if (itemsPerPage.value === "all") return filteredPlannings.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  return filteredPlannings.value.slice(
    start,
    start + Number(itemsPerPage.value)
  );
});

function createPlanning() {
  selectedPlanning.value = null;
  showNewPlanningModal.value = true;
}

function editPlanning(planning: PlanningTransaction) {
  selectedPlanning.value = planning;
  showEditPlanningModal.value = true;
}

function savePlanning(data: any) {
  if (selectedPlanning.value) {
    PlanningService.updatePlanningTransaction(selectedPlanning.value.id, data);
  } else {
    PlanningService.addPlanningTransaction(data);
  }
  showNewPlanningModal.value = false;
  showEditPlanningModal.value = false;
}

function deletePlanning(planning: PlanningTransaction) {
  if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
    PlanningService.deletePlanningTransaction(planning.id);
  }
}

function toggleActivation(planning: PlanningTransaction) {
  PlanningService.updatePlanningTransaction(planning.id, {
    isActive: !planning.isActive,
  });
}

// Button: Alle fälligen
function executeAllDuePlannings() {
  const count = PlanningService.executeAllDuePlanningTransactions();
  alert(`${count} automatische Planungsbuchungen ausgeführt.`);
}

// Button: Play pro Planung - nur fällige ausführen!
function executeDueForPlanning(planning: PlanningTransaction) {
  const today = dayjs().format("YYYY-MM-DD");
  const due = PlanningService.calculateNextOccurrences(
    planning,
    planning.startDate,
    today
  );
  let executed = 0;
  due.forEach((d) => {
    if (PlanningService.executePlanningTransaction(planning.id, d)) executed++;
  });
  alert(`${executed} Buchungen für "${planning.name}" ausgeführt.`);
}

function formatRecurrencePattern(pattern: RecurrencePattern): string {
  return {
    [RecurrencePattern.ONCE]: "Einmalig",
    [RecurrencePattern.DAILY]: "Täglich",
    [RecurrencePattern.WEEKLY]: "Wöchentlich",
    [RecurrencePattern.BIWEEKLY]: "Alle 2 Wochen",
    [RecurrencePattern.MONTHLY]: "Monatlich",
    [RecurrencePattern.QUARTERLY]: "Vierteljährlich",
    [RecurrencePattern.YEARLY]: "Jährlich",
  }[pattern];
}

// Neue Methoden für die Anzeige von Transaktionstypen
function getTransactionTypeIcon(type: TransactionType): string {
  switch (type) {
    case TransactionType.ACCOUNTTRANSFER:
      return "mdi:bank-transfer";
    case TransactionType.CATEGORYTRANSFER:
      return "mdi:briefcase-transfer-outline";
    case TransactionType.EXPENSE:
      return "mdi:bank-transfer-out";
    case TransactionType.INCOME:
      return "mdi:bank-transfer-in";
    default:
      return "mdi:help-circle-outline";
  }
}

function getTransactionTypeClass(type: TransactionType): string {
  switch (type) {
    case TransactionType.ACCOUNTTRANSFER:
    case TransactionType.CATEGORYTRANSFER:
      return "text-warning";
    case TransactionType.EXPENSE:
      return "text-error";
    case TransactionType.INCOME:
      return "text-success";
    default:
      return "";
  }
}

function getTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case TransactionType.ACCOUNTTRANSFER:
      return "Kontotransfer";
    case TransactionType.CATEGORYTRANSFER:
      return "Kategorietransfer";
    case TransactionType.EXPENSE:
      return "Ausgabe";
    case TransactionType.INCOME:
      return "Einnahme";
    default:
      return "Unbekannt";
  }
}

// Hilfsfunktion zur korrekten Anzeige von Quelle und Ziel je nach Transaktionstyp
function getSourceName(planning: PlanningTransaction): string {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return categoryStore.getCategoryById(planning.categoryId)?.name || "-";
  } else {
    return accountStore.getAccountById(planning.accountId)?.name || "-";
  }
}

function getTargetName(planning: PlanningTransaction): string {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return (
      categoryStore.getCategoryById(planning.transferToCategoryId || "")
        ?.name || "-"
    );
  } else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
    return (
      accountStore.getAccountById(planning.transferToAccountId || "")?.name ||
      "-"
    );
  } else {
    return categoryStore.getCategoryById(planning.categoryId)?.name || "-";
  }
}
</script>

<template>
  <!-- Header -->
  <div
    class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
  >
    <h2 class="text-xl font-bold flex-shrink-0">Planungsverwaltung</h2>
    <div class="flex justify-end w-full md:w-auto mt-2 md:mt-0">
      <div class="join">
        <button
          class="btn join-item rounded-l-full btn-sm btn-soft border border-base-300"
          @click="executeAllDuePlannings"
        >
          <Icon icon="mdi:play-circle" class="mr-2 text-base" />
          Alle fälligen ausführen
        </button>
        <button
          class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300"
          @click="createPlanning"
        >
          <Icon icon="mdi:plus" class="mr-2 text-base" />
          Neue Planung
        </button>
      </div>
    </div>
  </div>

  <SearchGroup @search="(q) => (searchQuery = q)" />

  <div class="card bg-base-100 shadow-md border border-base-300 w-full mt-6">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Buchungstyp</th>
              <th>Empfänger</th>
              <th>Quelle</th>
              <th>Ziel</th>
              <th>Intervall</th>
              <th>Start</th>
              <th class="text-right">Betrag</th>
              <th>Status</th>
              <th class="text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="planning in paginatedPlannings" :key="planning.id">
              <td>{{ planning.name }}</td>
              <td class="text-center">
                <div
                  class="tooltip"
                  :data-tip="getTransactionTypeLabel(planning.transactionType)"
                >
                  <Icon
                    :icon="getTransactionTypeIcon(planning.transactionType)"
                    :class="getTransactionTypeClass(planning.transactionType)"
                    class="text-2xl"
                  />
                </div>
              </td>
              <td>
                {{
                  recipientStore.getRecipientById(planning.recipientId || "")
                    ?.name || "-"
                }}
              </td>
              <td>{{ getSourceName(planning) }}</td>
              <td>{{ getTargetName(planning) }}</td>
              <td>{{ formatRecurrencePattern(planning.recurrencePattern) }}</td>
              <td>{{ planning.startDate }}</td>
              <td class="text-right">
                <CurrencyDisplay :amount="planning.amount" :show-zero="true" />
              </td>
              <td>
                <div class="flex space-x-1">
                  <span
                    class="badge"
                    :class="planning.isActive ? 'badge-success' : 'badge-error'"
                  >
                    {{ planning.isActive ? "Aktiv" : "Inaktiv" }}
                  </span>
                  <span v-if="planning.autoExecute" class="badge badge-info"
                    >Auto</span
                  >
                </div>
              </td>
              <td class="text-right">
                <div class="flex justify-end space-x-1">
                  <button
                    class="btn btn-ghost btn-xs border-none"
                    @click="toggleActivation(planning)"
                    :title="planning.isActive ? 'Deaktivieren' : 'Aktivieren'"
                  >
                    <Icon
                      :icon="
                        planning.isActive
                          ? 'mdi:toggle-switch'
                          : 'mdi:toggle-switch-off'
                      "
                      class="text-base"
                      :class="planning.isActive ? 'text-success' : 'text-error'"
                    />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs border-none"
                    @click="editPlanning(planning)"
                  >
                    <Icon icon="mdi:pencil" class="text-base" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs border-none text-error/75"
                    @click="deletePlanning(planning)"
                  >
                    <Icon icon="mdi:trash-can" class="text-base" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="paginatedPlannings.length === 0">
              <td colspan="10" class="text-center py-4">
                Keine geplanten Transaktionen vorhanden.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PagingComponent
        :currentPage="currentPage"
        :totalPages="totalPages"
        :itemsPerPage="itemsPerPage"
        @update:currentPage="(v) => (currentPage = v)"
        @update:itemsPerPage="(v) => (itemsPerPage = v)"
      />
    </div>
  </div>

  <div v-if="showNewPlanningModal" class="modal modal-open">
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg mb-4">Neue geplante Transaktion</h3>
      <PlanningTransactionForm
        @save="savePlanning"
        @cancel="showNewPlanningModal = false"
      />
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="showNewPlanningModal = false"
    />
  </div>

  <div
    v-if="showEditPlanningModal && selectedPlanning"
    class="modal modal-open"
  >
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg mb-4">Geplante Transaktion bearbeiten</h3>
      <PlanningTransactionForm
        :transaction="selectedPlanning"
        :is-edit="true"
        @save="savePlanning"
        @cancel="showEditPlanningModal = false"
      />
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="showEditPlanningModal = false"
    />
  </div>
</template>
