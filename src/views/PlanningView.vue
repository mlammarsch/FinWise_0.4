<!-- src/views/PlanningView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/PlanningView.vue
 * Hauptansicht für Finanzplanung und Prognose.
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import dayjs from "dayjs";
import { Icon } from "@iconify/vue";
import { useRoute, useRouter } from "vue-router";

import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { useMonthlyBalanceStore } from "@/stores/monthlyBalanceStore";
import { useTransactionStore } from "@/stores/transactionStore";

import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
import ForecastChart from "@/components/ui/charts/ForecastChart.vue";
import DetailedForecastChart from "@/components/ui/charts/DetailedForecastChart.vue";

import { PlanningTransaction, TransactionType } from "@/types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import DateRangePicker from "@/components/ui/DateRangePicker.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import { formatDate } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { PlanningService } from "@/services/PlanningService";
import { BalanceService } from "@/services/BalanceService";
import { BudgetService } from "@/services/BudgetService";

const route = useRoute();
const router = useRouter();

const planningStore = usePlanningStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const monthlyBalanceStore = useMonthlyBalanceStore();

// UI‑Status
const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const selectedPlanning = ref<PlanningTransaction | null>(null);
const searchQuery = ref("");
const selectedAccountId = ref("");
const selectedCategoryId = ref("");
const activeTab = ref<"upcoming" | "accounts" | "categories">("upcoming");

// Detailansicht für Charts
const selectedAccountForDetail = ref("");
const selectedCategoryForDetail = ref("");

// Pagination / Zeitraum
const currentPage = ref(1);
const itemsPerPage = ref<number | "all">(25);
const itemsPerPageOptions = [10, 20, 25, 50, 100, "all"];

const dateRange = ref<{ start: string; end: string }>({
  start: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
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

  planningStore.planningTransactions.forEach((plan: PlanningTransaction) => {
    if (!plan.isActive) return;
    const occurrences = PlanningService.calculateNextOccurrences(
      plan,
      start,
      end
    );
    occurrences.forEach((dateStr: string) => {
      list.push({ date: dateStr, transaction: plan });
    });
  });

  return list.sort((a, b) => a.date.localeCompare(b.date));
});

// Suche & Filter
const filteredTransactions = computed(() => {
  let data = [...upcomingTransactionsInRange.value];

  // Filter nach Konto
  if (selectedAccountId.value) {
    data = data.filter((e) => {
      const t = e.transaction;
      // Hauptbuchung mit dem gewählten Konto
      if (t.accountId === selectedAccountId.value) {
        return true;
      }
      // Bei Kontotransfers: Zielkonto prüfen
      if (
        t.transactionType === TransactionType.ACCOUNTTRANSFER &&
        t.transferToAccountId === selectedAccountId.value
      ) {
        return true;
      }
      return false;
    });
  }

  // Filter nach Kategorie
  if (selectedCategoryId.value) {
    data = data.filter((e) => {
      const t = e.transaction;
      // Hauptbuchung mit der gewählten Kategorie
      if (t.categoryId === selectedCategoryId.value) {
        return true;
      }
      // Bei Kategorietransfers: Zielkategorie prüfen
      if (
        t.transactionType === TransactionType.CATEGORYTRANSFER &&
        t.transferToCategoryId === selectedCategoryId.value
      ) {
        return true;
      }
      return false;
    });
  }

  // Gegenbuchungen IMMER herausfiltern (unabhängig von Filtern)
  data = data.filter((e) => {
    const t = e.transaction;
    // Gegenbuchungen über Namen erkennen und ausblenden
    if (t.name && t.name.includes("(Gegenbuchung)")) {
      return false;
    }
    // Zusätzliche Prüfung: Bei Transfers mit counterPlanningTransactionId
    // ist die Gegenbuchung diejenige mit positivem Betrag
    if (
      t.counterPlanningTransactionId &&
      (t.transactionType === TransactionType.ACCOUNTTRANSFER ||
        t.transactionType === TransactionType.CATEGORYTRANSFER)
    ) {
      const counterPlanning = planningStore.planningTransactions.find(
        (counter) => counter.id === t.counterPlanningTransactionId
      );
      if (counterPlanning && t.amount > 0 && counterPlanning.amount < 0) {
        return false; // Gegenbuchung ausblenden
      }
    }
    return true;
  });

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
        (categoryStore
          .getCategoryById(t.categoryId)
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

function skipPlanning(planningId: string, date: string) {
  PlanningService.skipPlanningTransaction(planningId, date);
  debugLog("[PlanningView] Skipped planning", { planningId, date });
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
  selectedCategoryId.value = "";
  searchQuery.value = "";
  currentPage.value = 1;
}

// Chart-Detail-Funktionen
function showAccountDetail(accountId: string) {
  selectedAccountForDetail.value = accountId;
  debugLog("[PlanningView] Show account detail", { accountId });
}

function showCategoryDetail(categoryId: string) {
  selectedCategoryForDetail.value = categoryId;
  debugLog("[PlanningView] Show category detail", { categoryId });
}

function hideAccountDetail() {
  selectedAccountForDetail.value = "";
}

function hideCategoryDetail() {
  selectedCategoryForDetail.value = "";
}

// Forecast-Daten für detaillierte Anzeige (6 Monate ab aktuellem Monat)
function getAccountForecastData(accountId: string) {
  const forecasts = [];
  const startDate = dayjs(dateRange.value.start).startOf("month");
  let previousMonthProjectedBalance: number | null = null;

  // 6 Monate ab dem aktuellen Monat generieren
  for (let i = 0; i < 6; i++) {
    const currentDate = startDate.add(i, "month");
    const monthStart = currentDate.format("YYYY-MM-DD");
    const monthEnd = currentDate.endOf("month").format("YYYY-MM-DD");
    // Startsaldo und Endsaldo berechnen
    let startBalance: number;
    let projectedBalance: number;

    if (i === 0) {
      // Erster Monat: Startsaldo ist der projizierte Saldo des Vormonats
      const prevMonth = currentDate.subtract(1, "month");
      const prevMonthEnd = prevMonth.endOf("month");

      startBalance =
        monthlyBalanceStore.getProjectedAccountBalanceForDate(
          accountId,
          new Date(prevMonthEnd.format("YYYY-MM-DD"))
        ) ??
        BalanceService.getProjectedBalance(
          "account",
          accountId,
          new Date(prevMonthEnd.format("YYYY-MM-DD"))
        );

      // Endsaldo ist der projizierte Saldo am Monatsende des aktuellen Monats
      projectedBalance =
        monthlyBalanceStore.getProjectedAccountBalanceForDate(
          accountId,
          new Date(monthEnd)
        ) ??
        BalanceService.getProjectedBalance(
          "account",
          accountId,
          new Date(monthEnd)
        );
    } else {
      // Nachfolgende Monate: Startsaldo ist der projizierte Endsaldo des Vormonats
      startBalance = previousMonthProjectedBalance ?? 0;

      // Endsaldo ist der projizierte Saldo am Monatsende
      projectedBalance =
        monthlyBalanceStore.getProjectedAccountBalanceForDate(
          accountId,
          new Date(monthEnd)
        ) ??
        BalanceService.getProjectedBalance(
          "account",
          accountId,
          new Date(monthEnd)
        );
    }
    // Geplante Transaktionen für diesen Monat sammeln
    const monthTransactions: Array<{
      date: string;
      description: string;
      amount: number;
    }> = [];

    let plannedTransactionsSum = 0;

    planningStore.planningTransactions.forEach((plan: PlanningTransaction) => {
      if (!plan.isActive || plan.accountId !== accountId) return;

      const occurrences = PlanningService.calculateNextOccurrences(
        plan,
        monthStart,
        monthEnd
      );

      occurrences.forEach((dateStr: string) => {
        const amount =
          plan.transactionType === TransactionType.INCOME
            ? Math.abs(plan.amount)
            : -Math.abs(plan.amount);

        monthTransactions.push({
          date: dateStr,
          description: plan.name,
          amount: amount,
        });

        plannedTransactionsSum += amount;
      });
    });

    // Monatliche Änderung (nur Planbuchungen)
    const monthlyChangePlanned = plannedTransactionsSum;

    // Monatliche Änderung (inkl. existierende Transaktionen) = Endsaldo - Startsaldo
    const monthlyChangeTotal = projectedBalance - startBalance;

    // Debug-Log für Problemanalyse
    if (i === 0) {
      debugLog(
        "PlanningView",
        `Aktueller Monat ${monthStart}: Start=${startBalance}€, Ende=${projectedBalance}€, Änderung=${monthlyChangeTotal}€, Planungen=${monthlyChangePlanned}€`
      );
    }

    // Für den nächsten Monat merken
    previousMonthProjectedBalance = projectedBalance;

    forecasts.push({
      month: currentDate.format("MMMM YYYY"),
      balance: startBalance,
      projectedBalance: projectedBalance,
      monthlyChangePlanned: monthlyChangePlanned,
      monthlyChangeTotal: monthlyChangeTotal,
      transactions: monthTransactions.sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    });
  }

  return forecasts;
}

// Computed für Category Forecast Data um auf Store-Änderungen zu reagieren
const categoryForecastData = computed(() => {
  return (categoryId: string) => {
    const forecasts: Array<{
      month: string;
      budgeted: number;
      activity: number;
      available: number;
      isOverspent: boolean;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
      }>;
    }> = [];
    const startDate = dayjs(dateRange.value.start).startOf("month");

    // 6 Monate ab dem aktuellen Monat generieren
    for (let i = 0; i < 6; i++) {
      const currentDate = startDate.add(i, "month");
      const monthStart = new Date(currentDate.format("YYYY-MM-DD"));
      const monthEnd = new Date(
        currentDate.endOf("month").format("YYYY-MM-DD")
      );

      // Geplante Transaktionen für diese Kategorie in diesem Monat sammeln
      const monthTransactions: Array<{
        date: string;
        description: string;
        amount: number;
      }> = [];

      planningStore.planningTransactions.forEach(
        (plan: PlanningTransaction) => {
          if (!plan.isActive || plan.categoryId !== categoryId) return;

          const occurrences = PlanningService.calculateNextOccurrences(
            plan,
            currentDate.format("YYYY-MM-DD"),
            currentDate.endOf("month").format("YYYY-MM-DD")
          );

          occurrences.forEach((dateStr: string) => {
            const amount =
              plan.transactionType === TransactionType.INCOME
                ? Math.abs(plan.amount)
                : -Math.abs(plan.amount);

            monthTransactions.push({
              date: dateStr,
              description: plan.name,
              amount: amount,
            });
          });
        }
      );

      // Verwende BudgetService für konsistente Daten wie in BudgetMonthCard.vue
      const budgetData = BudgetService.getAggregatedMonthlyBudgetData(
        categoryId,
        monthStart,
        monthEnd
      );

      // Werte direkt aus BudgetService übernehmen (wie in BudgetMonthCard.vue)
      const budgeted = budgetData.budgeted;
      const activity = budgetData.spent;
      const forecastAmount = budgetData.forecast;
      const available = budgetData.saldo;

      // Überzogen-Status basierend auf verfügbarem Saldo
      const isOverspent = available < 0;

      debugLog(
        "PlanningView",
        `Kategorie ${categoryId} ${currentDate.format(
          "MMMM YYYY"
        )}: Budgetiert=${budgeted}€, Aktivität=${activity}€, Prognose=${forecastAmount}€, Verfügbar=${available}€, Überzogen=${isOverspent}`
      );

      forecasts.push({
        month: currentDate.format("MMMM YYYY"),
        budgeted: budgeted,
        activity: activity,
        available: available,
        isOverspent: isOverspent,
        transactions: monthTransactions.sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      });
    }

    return forecasts;
  };
});

// Service‑Aufrufe
function executeAutomaticTransactions() {
  const count = PlanningService.executeAllDuePlanningTransactions();
  alert(`${count} automatische Planungsbuchungen ausgeführt.`);
}

function updateForecasts() {
  PlanningService.updateForecasts();
  alert("Prognosen und monatliche Saldi wurden aktualisiert.");
}

// Keyboard Event Handler für ALT+n
function handleKeydown(event: KeyboardEvent) {
  if (event.altKey && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createPlanning();
  }
}

// Auto‑Execute Check bei Mount
onMounted(() => {
  // Keyboard Event Listener hinzufügen
  document.addEventListener("keydown", handleKeydown);

  BalanceService.calculateMonthlyBalances();

  // Prognosebuchungen für zukünftige Zeiträume aktualisieren
  PlanningService.refreshForecastsForFuturePeriod();

  // Prüfe Query-Parameter für automatisches Öffnen des Bearbeitungsmodus
  const editId = route.query.edit as string;
  if (editId) {
    const planningToEdit = planningStore.getPlanningTransactionById(editId);
    if (planningToEdit) {
      debugLog("[PlanningView] Auto-opening edit mode for planning", editId);
      editPlanning(planningToEdit);
      // Query-Parameter nach dem Öffnen entfernen
      router.replace({ query: {} });
    } else {
      debugLog(
        "[PlanningView] Planning transaction not found for edit",
        editId
      );
    }
  }

  const today = dayjs().format("YYYY-MM-DD");
  let autoCount = 0;

  planningStore.planningTransactions.forEach((plan: PlanningTransaction) => {
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

// Cleanup bei Unmount
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold">Finanzplanung und Prognose</h2>

      <SearchGroup
        btn-right="Neue Planung"
        btn-right-icon="mdi:plus"
        @btn-right-click="createPlanning"
        @search="(q: string) => (searchQuery = q)"
      />
    </div>

    <!-- Tabs -->
    <div class="tabs tabs-boxed bg-base-200">
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'upcoming' }"
        @click="activeTab = 'upcoming'"
      >
        <Icon
          icon="mdi:calendar-clock"
          class="mr-2"
        />
        Anstehende Buchungen
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'accounts' }"
        @click="activeTab = 'accounts'"
      >
        <Icon
          icon="mdi:chart-line"
          class="mr-2"
        />
        Kontenprognose
      </a>
      <a
        class="tab"
        :class="{ 'tab-active': activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        <Icon
          icon="mdi:chart-areaspline"
          class="mr-2"
        />
        Kategorienprognose
      </a>
    </div>

    <!-- Upcoming Transactions -->
    <div
      v-if="activeTab === 'upcoming'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <!-- Filter & DateRangePicker -->
      <div class="flex flex-wrap justify-between items-end gap-4 mb-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Zeitraum</span>
            </label>
            <DateRangePicker @update:model-value="handleDateRangeUpdate" />
          </div>
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
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Kategorie</span>
            </label>
            <select
              v-model="selectedCategoryId"
              class="select select-sm select-bordered rounded-full"
              :class="
                selectedCategoryId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Kategorien</option>
              <option
                v-for="cat in categoryStore.activeCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon
              icon="mdi:filter-off"
              class="text-xl"
            />
          </button>
        </div>
      </div>

      <div class="divider px-5 m-0" />

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
                  class="tooltip tooltip-primary"
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
              <td class="text-right">
                <div class="flex justify-end space-x-1">
                  <div
                    class="tooltip tooltip-success"
                    data-tip="Planungstransaktion ausführen und echte Transaktion erstellen"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="executePlanning(e.transaction.id, e.date)"
                    >
                      <Icon
                        icon="mdi:play"
                        class="text-base text-success"
                      />
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-warning"
                    data-tip="Planungstransaktion überspringen (als erledigt markieren ohne Transaktion zu erstellen)"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="skipPlanning(e.transaction.id, e.date)"
                    >
                      <Icon
                        icon="mdi:skip-next"
                        class="text-base text-warning"
                      />
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-info"
                    data-tip="Planungstransaktion bearbeiten"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none"
                      @click="editPlanning(e.transaction)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                  </div>
                  <div
                    class="tooltip tooltip-error"
                    data-tip="Planungstransaktion löschen"
                  >
                    <button
                      class="btn btn-ghost btn-xs border-none text-error/75"
                      @click="deletePlanning(e.transaction)"
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </div>
              </td>
            </tr>
            <tr v-if="paginatedTransactions.length === 0">
              <td
                colspan="8"
                class="text-center py-4"
              >
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
      <!-- Filter & DateRangePicker -->
      <div class="flex flex-wrap justify-between items-end gap-4 mb-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Zeitraum</span>
            </label>
            <DateRangePicker @update:model-value="handleDateRangeUpdate" />
          </div>
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
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Kategorie</span>
            </label>
            <select
              v-model="selectedCategoryId"
              class="select select-sm select-bordered rounded-full"
              :class="
                selectedCategoryId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Kategorien</option>
              <option
                v-for="cat in categoryStore.activeCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon
              icon="mdi:filter-off"
              class="text-xl"
            />
          </button>
        </div>
      </div>

      <div class="divider px-5 m-0" />

      <!-- Account Badges -->
      <h3 class="text-xl font-bold mb-4">Kontenprognose</h3>
      <div class="flex flex-wrap gap-4 mb-4">
        <div
          v-for="account in accountStore.activeAccounts"
          :key="account.id"
          class="badge badge-lg cursor-pointer"
          :class="
            selectedAccountForDetail === account.id
              ? 'badge-accent'
              : 'badge-outline'
          "
          @click="
            selectedAccountForDetail === account.id
              ? hideAccountDetail()
              : showAccountDetail(account.id)
          "
        >
          {{ account.name }}
        </div>
      </div>

      <!-- Chart - DetailedForecastChart wenn Konto ausgewählt, sonst ForecastChart -->
      <DetailedForecastChart
        v-if="selectedAccountForDetail"
        :selected-id="selectedAccountForDetail"
        :start-date="dateRange.start"
        type="accounts"
      />
      <ForecastChart
        v-else
        :start-date="dateRange.start"
        :filtered-account-id="selectedAccountId"
        :selected-account-for-detail="selectedAccountForDetail"
        type="accounts"
      />

      <!-- Detaillierte Prognose für ausgewähltes Account -->
      <div v-if="selectedAccountForDetail">
        <div class="divider px-5 m-0" />

        <h4 class="text-lg font-semibold mb-4">
          Detaillierte Prognose für
          {{ accountStore.getAccountById(selectedAccountForDetail)?.name }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="(forecast, i) in getAccountForecastData(
              selectedAccountForDetail
            )"
            :key="i"
            class="card bg-base-200 shadow-sm"
          >
            <div class="card-body p-4">
              <h5 class="card-title text-base">{{ forecast.month }}</h5>
              <div class="text-sm mb-2">
                <div class="flex justify-between">
                  <span>Startsaldo:</span>
                  <CurrencyDisplay
                    :amount="forecast.balance"
                    :as-integer="true"
                  />
                </div>
                <div class="flex justify-between">
                  <span>Änderung (Planbuchungen):</span>
                  <CurrencyDisplay
                    :amount="forecast.monthlyChangePlanned"
                    :as-integer="true"
                    :show-zero="true"
                  />
                </div>
                <div class="flex justify-between">
                  <span>Änderung (inkl. exist. Transaktionen):</span>
                  <CurrencyDisplay
                    :amount="forecast.monthlyChangeTotal"
                    :as-integer="true"
                    :show-zero="true"
                  />
                </div>
                <div
                  class="flex justify-between font-bold border-t border-base-300 pt-1"
                >
                  <span>Prognostizierter Endsaldo:</span>
                  <CurrencyDisplay
                    :amount="forecast.projectedBalance"
                    :as-integer="true"
                  />
                </div>
              </div>
              <div
                v-if="forecast.transactions.length > 0"
                class="text-xs space-y-1 border-t border-base-300 pt-2"
              >
                <div class="font-semibold">Geplante Transaktionen:</div>
                <div
                  v-for="(tx, j) in forecast.transactions"
                  :key="j"
                  class="flex justify-between"
                >
                  <span>{{ formatDate(tx.date) }} - {{ tx.description }}</span>
                  <CurrencyDisplay
                    :amount="tx.amount"
                    :show-zero="true"
                  />
                </div>
              </div>
              <div
                v-else
                class="text-xs text-base-content/70 border-t border-base-300 pt-2"
              >
                Keine geplanten Transaktionen in diesem Monat.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category forecast -->
    <div
      v-if="activeTab === 'categories'"
      class="card bg-base-100 shadow-md border border-base-300 p-4"
    >
      <!-- Filter & DateRangePicker -->
      <div class="flex flex-wrap justify-between items-end gap-4 mb-4">
        <div class="flex flex-wrap items-end gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Zeitraum</span>
            </label>
            <DateRangePicker @update:model-value="handleDateRangeUpdate" />
          </div>
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
          <div class="form-control">
            <label class="label">
              <span class="label-text opacity-50">Kategorie</span>
            </label>
            <select
              v-model="selectedCategoryId"
              class="select select-sm select-bordered rounded-full"
              :class="
                selectedCategoryId
                  ? 'border-2 border-accent'
                  : 'border border-base-300'
              "
            >
              <option value="">Alle Kategorien</option>
              <option
                v-for="cat in categoryStore.activeCategories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex items-end gap-2">
          <button
            class="btn btn-sm btn-ghost btn-circle self-end"
            @click="clearFilters"
          >
            <Icon
              icon="mdi:filter-off"
              class="text-xl"
            />
          </button>
        </div>
      </div>

      <div class="divider px-5 m-0" />

      <!-- Category Badges -->
      <h3 class="text-xl font-bold mb-4">Kategorienprognose</h3>
      <div class="flex flex-wrap gap-4 mb-4">
        <div
          v-for="category in categoryStore.activeCategories"
          :key="category.id"
          class="badge badge-lg cursor-pointer transition-all duration-200"
          :class="
            selectedCategoryForDetail === category.id
              ? 'badge-accent text-accent-content'
              : 'badge-outline hover:badge-secondary'
          "
          @click="
            selectedCategoryForDetail === category.id
              ? hideCategoryDetail()
              : showCategoryDetail(category.id)
          "
        >
          <Icon
            v-if="category.icon"
            :icon="category.icon"
            class="mr-1 text-sm"
          />
          {{ category.name }}
        </div>
      </div>

      <!-- Chart - DetailedForecastChart wenn Kategorie ausgewählt, sonst ForecastChart -->
      <DetailedForecastChart
        v-if="selectedCategoryForDetail"
        :selected-id="selectedCategoryForDetail"
        :start-date="dateRange.start"
        type="categories"
      />
      <ForecastChart
        v-else
        :start-date="dateRange.start"
        :selected-category-for-detail="selectedCategoryForDetail"
        type="categories"
        @show-category-detail="showCategoryDetail"
        @hide-category-detail="hideCategoryDetail"
      />

      <!-- Detaillierte Prognose für ausgewählte Kategorie -->
      <div v-if="selectedCategoryForDetail">
        <div class="divider px-5 m-0" />

        <h4 class="text-lg font-semibold mb-4">
          Detaillierte Prognose für
          {{ categoryStore.getCategoryById(selectedCategoryForDetail)?.name }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="(forecast, i) in categoryForecastData(
              selectedCategoryForDetail
            ).slice(0, 6)"
            :key="i"
            class="card bg-base-200 shadow-sm"
          >
            <div class="card-body p-4">
              <h5 class="card-title text-base">{{ forecast.month }}</h5>
              <div class="text-sm mb-2">
                <div class="flex justify-between">
                  <span>Budgetiert:</span>
                  <CurrencyDisplay
                    :amount="forecast.budgeted"
                    :as-integer="true"
                  />
                </div>
                <div class="flex justify-between">
                  <span>Bisherige Aktivität:</span>
                  <CurrencyDisplay
                    :amount="forecast.activity"
                    :as-integer="true"
                  />
                </div>
                <div class="flex justify-between">
                  <span>Anstehende Planbuchungen:</span>
                  <CurrencyDisplay
                    :amount="
                      forecast.transactions.reduce(
                        (sum, tx) => sum + tx.amount,
                        0
                      )
                    "
                    :as-integer="true"
                  />
                </div>
                <div
                  class="flex justify-between font-bold border-t border-base-300 pt-1"
                  :class="forecast.isOverspent ? 'text-error' : ''"
                >
                  <span>{{
                    forecast.isOverspent
                      ? "Budget überschritten:"
                      : "Verfügbar:"
                  }}</span>
                  <CurrencyDisplay
                    :amount="forecast.available"
                    :as-integer="true"
                    :class="forecast.isOverspent ? 'text-error' : ''"
                  />
                </div>
              </div>
              <div
                v-if="forecast.transactions.length > 0"
                class="text-xs space-y-1 border-t border-base-300 pt-2"
              >
                <div class="font-semibold">Geplante Transaktionen:</div>
                <div
                  v-for="(tx, j) in forecast.transactions"
                  :key="j"
                  class="flex justify-between"
                >
                  <span>{{ formatDate(tx.date) }} - {{ tx.description }}</span>
                  <CurrencyDisplay
                    :amount="tx.amount"
                    :show-zero="true"
                  />
                </div>
              </div>
              <div
                v-else
                class="text-xs text-base-content/70 border-t border-base-300 pt-2"
              >
                Keine geplanten Transaktionen in diesem Monat.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <div
      v-if="showNewPlanningModal"
      class="modal modal-open"
    >
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
