<!-- src/views/PlanningView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/PlanningView.vue
 * Hauptansicht für Finanzplanung und Prognose.
 */
import { ref, computed, onMounted } from "vue";
import dayjs from "dayjs";

import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";

import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
import AccountForecastChart from "@/components/planning/AccountForecastChart.vue";
import CategoryForecastChart from "@/components/planning/CategoryForecastChart.vue";

import { PlanningTransaction, TransactionType } from "@/types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import MonthSelector from "@/components/ui/MonthSelector.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import { formatDate } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { PlanningService } from "@/services/PlanningService";
import { BalanceService } from "@/services/BalanceService";

const planningStore = usePlanningStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();

// UI‑Status
const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const selectedPlanning = ref<PlanningTransaction | null>(null);
const searchQuery = ref("");
const selectedAccountId = ref("");
const activeTab = ref<"upcoming" | "accounts" | "categories">("upcoming");

// Pagination / Zeitraum
const currentPage = ref(1);
const itemsPerPage = ref<number | "all">(25);
const itemsPerPageOptions = [10, 20, 25, 50, 100, "all"];

const dateRange = ref<{ start: string; end: string }>({
  start: dayjs().startOf("month").format("YYYY-MM-DD"),
  end: dayjs().endOf("month").format("YYYY-MM-DD"),
});

// Letztes Prognose‑Update
const lastUpdateDate = computed(() => {
  const ts = localStorage.getItem("finwise_last_forecast_update");
  return ts ? new Date(parseInt(ts)) : null;
});

// Zeitraum‑Update durch MonthSelector
function handleDateRangeUpdate(payload: { start: string; end: string }) {
  dateRange.value = payload;
  debugLog("[PlanningView] Date range updated", payload);
}

/**
 * Berechnet alle anstehenden Ausführungstermine im ausgewählten Zeitraum.
 * Ergebnis: sortiertes Array aus { date, transaction }.
 */
const upcomingTransactionsInRange = computed(() => {
  const start = dateRange.value.start;
  const end = dateRange.value.end;
  const list: Array<{ date: string; transaction: PlanningTransaction }> = [];

  planningStore.planningTransactions.forEach((plan) => {
    if (!plan.isActive) return;
    const occurrences = PlanningService.calculateNextOccurrences(
      plan,
      start,
      end
    );
    occurrences.forEach((dateStr) => {
      list.push({ date: dateStr, transaction: plan });
    });
  });

  return list.sort((a, b) => a.date.localeCompare(b.date));
});

// Suche & Konto‑Filter
const filteredTransactions = computed(() => {
  let data = [...upcomingTransactionsInRange.value];

  if (selectedAccountId.value) {
    data = data.filter(
      (e) => e.transaction.accountId === selectedAccountId.value
    );
  }

  if (searchQuery.value.trim()) {
    const term = searchQuery.value.toLowerCase();
    data = data.filter((e) => {
      const t = e.transaction;
      return (
        t.name.toLowerCase().includes(term) ||
        (recipientStore
          .getRecipientById(t.recipientId || "")
          ?.name.toLowerCase()
          .includes(term) ??
          false) ||
        (accountStore
          .getAccountById(t.accountId)
          ?.name.toLowerCase()
          .includes(term) ??
          false) ||
        String(t.amount).includes(term)
      );
    });
  }

  return data;
});

// Pagination
const paginatedTransactions = computed(() => {
  if (itemsPerPage.value === "all") return filteredTransactions.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  return filteredTransactions.value.slice(
    start,
    start + Number(itemsPerPage.value)
  );
});

// CRUD‑Aktionen
function createPlanning() {
  selectedPlanning.value = null;
  showNewPlanningModal.value = true;
}

function editPlanning(planning: PlanningTransaction) {
  selectedPlanning.value = planning;
  showEditPlanningModal.value = true;
  debugLog("[PlanningView] Edit planning", planning);
}

function savePlanning(data: any) {
  if (selectedPlanning.value) {
    PlanningService.updatePlanningTransaction(selectedPlanning.value.id, data);
    debugLog("[PlanningView] Updated planning", data);
  } else {
    PlanningService.addPlanningTransaction(data);
    debugLog("[PlanningView] Added planning", data);
  }
  showNewPlanningModal.value = false;
  showEditPlanningModal.value = false;
  BalanceService.calculateMonthlyBalances();
}

function deletePlanning(planning: PlanningTransaction) {
  if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
    PlanningService.deletePlanningTransaction(planning.id);
    debugLog("[PlanningView] Deleted planning", planning.id);
    BalanceService.calculateMonthlyBalances();
  }
}

function executePlanning(planningId: string, date: string) {
  PlanningService.executePlanningTransaction(planningId, date);
  debugLog("[PlanningView] Executed planning", { planningId, date });
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

// Hilfs‑Funktionen
function clearFilters() {
  selectedAccountId.value = "";
  searchQuery.value = "";
  currentPage.value = 1;
}

// Service‑Aufrufe
function executeAutomaticTransactions() {
  const count = PlanningService.executeAllDuePlanningTransactions();
  alert(`${count} automatische Planungsbuchungen ausgeführt.`);
}

function updateForecasts() {
  PlanningService.updateForecasts();
  alert("Prognosen und monatliche Saldi wurden aktualisiert.");
}

// Auto‑Execute Check bei Mount
onMounted(() => {
  BalanceService.calculateMonthlyBalances();

  // Prognosebuchungen für zukünftige Zeiträume aktualisieren
  PlanningService.refreshForecastsForFuturePeriod();

  const today = dayjs().format("YYYY-MM-DD");
  let autoCount = 0;

  planningStore.planningTransactions.forEach((plan) => {
    if (!plan.isActive || !plan.autoExecute) return;
    const occ = PlanningService.calculateNextOccurrences(plan, today, today);
    if (occ.length) autoCount++;
  });

  if (autoCount > 0) {
    const run = confirm(
      `Es stehen ${autoCount} automatische Planungsbuchungen für heute an. Jetzt ausführen?`
    );
    if (run) executeAutomaticTransactions();
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-bold">Finanzplanung und Prognose</h2>
      <div class="flex items-center gap-3">
        <div class="text-sm opacity-70" v-if="lastUpdateDate">
          Prognosen aktualisiert am: {{ formatDate(lastUpdateDate) }}
        </div>
        <button class="btn btn-outline" @click="updateForecasts">
          <Icon icon="mdi:refresh" class="mr-2" />
          Prognosen aktualisieren
        </button>
        <button class="btn btn-outline" @click="executeAutomaticTransactions">
          <Icon icon="mdi:play-circle" class="mr-2" />
          Auto-Ausführen
        </button>
      </div>
    </div>

    <!-- Filter & MonthSelector -->
    <div class="card bg-base-100 shadow-md border border-base-300 p-4">
      <div class="flex flex-wrap justify-between items-end gap-4">
        <div class="flex items-end gap-4">
          <MonthSelector @update-daterange="handleDateRangeUpdate" />
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Konto</span>
            </label>
            <select
              v-model="selectedAccountId"
              class="select select-sm select-bordered rounded-full"
              :class="
                selectedAccountId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Konten</option>
              <option
                v-for="acc in accountStore.activeAccounts"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.name }}
              </option>
            </select>
          </div>
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon icon="mdi:filter-off" class="text-xl" />
          </button>
        </div>
        <SearchGroup
          btn-right="Neue Planung"
          btn-right-icon="mdi:plus"
          @btn-right-click="createPlanning"
          @search="(q) => (searchQuery = q)"
        />
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs tabs-boxed bg-base-200">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'upcoming' }"
        @click="activeTab = 'upcoming'"
      >
        <Icon icon="mdi:calendar-clock" class="mr-2" />
        Anstehende Buchungen
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'accounts' }"
        @click="activeTab = 'accounts'"
      >
        <Icon icon="mdi:chart-line" class="mr-2" />
        Kontenprognose
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <Icon icon="mdi:chart-areaspline" class="mr-2" />
        Kategorienprognose
      </a>
    </div>

    <!-- Upcoming Transactions -->
    <div
      v-if="activeTab === 'upcoming'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Buchungstyp</th>
              <th>Name</th>
              <th>Empfänger</th>
              <th>Quelle</th>
              <th>Ziel</th>
              <th class="text-right">Betrag</th>
              <th class="text-center">Status</th>
              <th class="text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="e in paginatedTransactions"
              :key="`${e.transaction.id}-${e.date}`"
            >
              <td>{{ formatDate(e.date) }}</td>
              <td class="text-center">
                <div
                  class="tooltip"
                  :data-tip="
                    getTransactionTypeLabel(e.transaction.transactionType)
                  "
                >
                  <Icon
                    :icon="
                      getTransactionTypeIcon(e.transaction.transactionType)
                    "
                    :class="
                      getTransactionTypeClass(e.transaction.transactionType)
                    "
                    class="text-2xl"
                  />
                </div>
              </td>
              <td>{{ e.transaction.name }}</td>
              <td>
                {{
                  recipientStore.getRecipientById(
                    e.transaction.recipientId || ""
                  )?.name || "-"
                }}
              </td>
              <td>{{ getSourceName(e.transaction) }}</td>
              <td>{{ getTargetName(e.transaction) }}</td>
              <td class="text-right">
                <CurrencyDisplay
                  :amount="e.transaction.amount"
                  :show-zero="true"
                />
              </td>
              <td class="text-center">
                <span
                  class="badge"
                  :class="
                    e.transaction.isActive ? 'badge-success' : 'badge-error'
                  "
                >
                  {{ e.transaction.isActive ? "Aktiv" : "Inaktiv" }}
                </span>
                <span
                  v-if="e.transaction.autoExecute"
                  class="badge badge-info ml-1"
                  >Auto</span
                >
              </td>
              <td class="text-right">
                <div class="flex justify-end space-x-1">
                  <button
                    class="btn btn-ghost btn-xs border-none"
                    @click="executePlanning(e.transaction.id, e.date)"
                  >
                    <Icon icon="mdi:play" class="text-base text-success" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs border-none"
                    @click="editPlanning(e.transaction)"
                  >
                    <Icon icon="mdi:pencil" class="text-base" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs border-none text-error/75"
                    @click="deletePlanning(e.transaction)"
                  >
                    <Icon icon="mdi:trash-can" class="text-base" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="paginatedTransactions.length === 0">
              <td colspan="9" class="text-center py-4">
                Keine anstehenden Transaktionen im ausgewählten Zeitraum.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PagingComponent
        v-model:currentPage="currentPage"
        v-model:itemsPerPage="itemsPerPage"
        :totalPages="
          itemsPerPage === 'all'
            ? 1
            : Math.ceil(filteredTransactions.length / Number(itemsPerPage))
        "
        :itemsPerPageOptions="itemsPerPageOptions"
      />
    </div>

    <!-- Account forecast -->
    <div
      v-if="activeTab === 'accounts'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <AccountForecastChart
        :start-date="dateRange.start"
        :filtered-account-id="selectedAccountId"
      />
    </div>

    <!-- Category forecast -->
    <div
      v-if="activeTab === 'categories'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <CategoryForecastChart :start-date="dateRange.start" />
    </div>

    <!-- Modals -->
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
      ></div>
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
      ></div>
    </div>
  </div>
</template>
