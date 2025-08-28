<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useTransactionStore } from "../stores/transactionStore";
import { useAccountStore } from "../stores/accountStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useRecipientStore } from "../stores/recipientStore";
import { useStatisticsStore } from "../stores/statisticsStore";
import { usePlanningStore } from "../stores/planningStore";
import { TransactionService } from "../services/TransactionService";
import { BalanceService } from "../services/BalanceService";
import { PlanningService } from "../services/PlanningService";
import { BudgetService } from "../services/BudgetService";
import { TransactionType, PlanningTransaction } from "../types";
import { formatCurrency } from "../utils/formatters";
import ExpenseIncomeSummaryChart from "../components/ui/charts/ExpenseIncomeSummaryChart.vue";
import CurrencyDisplay from "../components/ui/CurrencyDisplay.vue";
import MonthlyTrendStats from "../components/ui/stats/MonthlyTrendStats.vue";
import AccountBalanceStats from "../components/ui/stats/AccountBalanceStats.vue";
import PlanningPaymentsGadget from "../components/ui/gadgets/PlanningPaymentsGadget.vue";
import TopBudgetsStats from "../components/ui/stats/TopBudgetsStats.vue";
import SavingsGoalsStats from "../components/ui/stats/SavingsGoalsStats.vue";
import RecentTransactions from "../components/ui/transactions/RecentTransactions.vue";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";

const router = useRouter();
const transactionStore = useTransactionStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const statisticsStore = useStatisticsStore();
const planningStore = usePlanningStore();

const currentDate = dayjs();
const startDate = ref(currentDate.subtract(30, "day").format("YYYY-MM-DD"));
const endDate = ref(currentDate.format("YYYY-MM-DD"));

// MTD (Month-to-Date) Zeitraum für Top Budgets
const currentMonthStart = dayjs().startOf("month");
const currentMonthEnd = dayjs().endOf("month");

// Anzahl der anzuzeigenden Transaktionen – in Komponente ausgelagert

// Anzahl der anzuzeigenden geplanten Transaktionen
const planningLimit = ref(3);

// Anzahl der anzuzeigenden Top Budgets
const expensesLimit = ref(5);

// Anzahl der anzuzeigenden Sparziele
const savingsGoalsLimit = ref(5);

const accounts = computed(() => accountStore.activeAccounts);

// Letzte Transaktionen – Logik in Komponente ausgelagert
// Berechnung der Einnahmen und Ausgaben über statisticsStore (korrekte Architektur)
const incomeSummary = computed(() => {
  return statisticsStore.getIncomeExpenseSummary(
    startDate.value,
    endDate.value
  );
});

// Top Budgets mit Budget-Daten für aktuellen Monat (MTD)
const topExpensesWithBudget = computed(() => {
  const monthStart = currentMonthStart.toDate();
  const monthEnd = currentMonthEnd.toDate();

  // Hole alle Ausgaben-Kategorien (keine Einnahmen, keine Sparziele)
  const expenseCategories = categoryStore.categories.filter(
    (cat) =>
      cat.isActive &&
      !cat.isIncomeCategory &&
      !cat.isSavingsGoal && // Keine Sparzielkategorien
      cat.name !== "Verfügbare Mittel" &&
      !cat.parentCategoryId // Nur Root-Kategorien
  );

  const categoryData = expenseCategories
    .map((category) => {
      const budgetData = BudgetService.getAggregatedMonthlyBudgetData(
        category.id,
        monthStart,
        monthEnd
      );

      const spent = Math.abs(budgetData.spent);
      const budgeted = Math.abs(budgetData.budgeted);
      const budgetPercentage =
        budgeted > 0 ? (spent / budgeted) * 100 : spent > 0 ? 999 : 0;

      return {
        categoryId: category.id,
        name: category.name,
        spent: spent, // Positive Darstellung für Ausgaben (ohne Planbuchungen)
        budgeted: budgeted, // Budget als positiver Wert
        available: budgetData.saldo,
        budgetPercentage: budgetPercentage, // Prozentsatz des verbrauchten Budgets
        budgetData,
      };
    })
    .filter((item) => item.budgeted > 0 && item.spent > 0) // Nur Kategorien mit Budget UND tatsächlichen Ausgaben
    .sort((a, b) => b.budgetPercentage - a.budgetPercentage) // Nach prozentualem Budget-Verbrauch sortieren (absteigend)
    .slice(0, 5); // Top 5

  return categoryData;
});

// Sparziele mit Fortschrittsdaten
const savingsGoalsWithProgress = computed(() => {
  const savingsCategories = categoryStore.savingsGoals.filter(
    (cat) =>
      cat.isActive &&
      cat.isSavingsGoal &&
      cat.targetAmount &&
      cat.targetAmount > 0
  );

  const today = dayjs();

  const goalsData = savingsCategories
    .map((category) => {
      // Verwende BalanceService für tagesgenauen Saldo
      const currentAmount = Math.abs(
        BalanceService.getTodayBalance("category", category.id)
      );
      const targetAmount = category.targetAmount || 0;
      const progress =
        targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

      // Berechne Soll-Sparbetrag basierend auf Zieldatum
      let shouldHaveSaved = 0;
      let barColor = "bg-warning"; // Standard: gelb

      if (category.goalDate) {
        const goalDate = dayjs(category.goalDate);
        const startDate = today.startOf("month"); // Annahme: Sparziel startet am Monatsanfang

        // Berechne Gesamtdauer in Monaten
        const totalMonths = goalDate.diff(startDate, "month", true);

        if (totalMonths > 0) {
          // Monatsregelrate
          const monthlyRate = targetAmount / totalMonths;

          // Vergangene Zeit seit Start in Monaten
          const elapsedMonths = today.diff(startDate, "month", true);

          // Soll-Sparbetrag bis heute
          shouldHaveSaved = monthlyRate * elapsedMonths;

          // Bestimme Balkenfarbe basierend auf Soll-Ist-Vergleich
          const tolerance = monthlyRate * 0.05; // 5% Toleranz für "gelb"

          if (currentAmount >= shouldHaveSaved + tolerance) {
            barColor = "bg-success"; // Grün: Überschritten
          } else if (currentAmount >= shouldHaveSaved - tolerance) {
            barColor = "bg-warning"; // Gelb: Im Toleranzbereich
          } else {
            barColor = "bg-error"; // Rot: Unterschritten
          }
        }
      }

      return {
        categoryId: category.id,
        name: category.name,
        currentAmount,
        targetAmount,
        progress: Math.min(progress, 100), // Max 100%
        goalDate: category.goalDate,
        shouldHaveSaved,
        barColor,
        category,
      };
    })
    .sort((a, b) => b.progress - a.progress) // Nach Fortschritt sortieren
    .slice(0, savingsGoalsLimit.value);

  return goalsData;
});

const topExpenses = computed(() =>
  statisticsStore.getCategoryExpenses(startDate.value, endDate.value, 5)
);
const savingsGoals = computed(() => statisticsStore.getSavingsGoalProgress());

// Kommende geplante Transaktionen für die nächsten 14 Tage (inkl. überfällige)
const upcomingPlanningTransactions = computed(() => {
  const today = dayjs();
  const startDate = today.subtract(30, "days"); // 30 Tage zurück für überfällige
  const endDate = today.add(14, "days");

  const upcomingTransactions: Array<{
    planningTransaction: PlanningTransaction;
    executionDate: string;
    formattedDate: string;
    isDue: boolean;
  }> = [];

  planningStore.planningTransactions
    .filter(
      (pt) =>
        pt.isActive && !pt.forecastOnly && !pt.counterPlanningTransactionId
    )
    .forEach((planningTransaction) => {
      try {
        const occurrences = PlanningService.calculateNextOccurrences(
          planningTransaction,
          startDate.format("YYYY-MM-DD"),
          endDate.format("YYYY-MM-DD")
        );

        occurrences.forEach((executionDate) => {
          const executionDay = dayjs(executionDate);
          const isDue = executionDay.isSameOrBefore(today, "day");

          upcomingTransactions.push({
            planningTransaction,
            executionDate: executionDate,
            formattedDate: executionDay.format("DD.MM.YYYY"),
            isDue: isDue,
          });
        });
      } catch (error) {
        console.warn(
          "Fehler beim Berechnen der Occurrences für Planning Transaction:",
          planningTransaction.id,
          error
        );
      }
    });

  // Sortiere nach Ausführungsdatum
  return upcomingTransactions.sort(
    (a, b) =>
      dayjs(a.executionDate).valueOf() - dayjs(b.executionDate).valueOf()
  );
});

const navigateToTransactions = () => router.push("/transactions");
const navigateToBudgets = () => router.push("/budgets");
const navigateToStatistics = () => router.push("/statistics");
const navigateToPlanning = () => router.push("/planning");

// Navigation zur PlanningView mit Bearbeitungsmodus für spezifische Transaktion
const navigateToPlanningEdit = (planningTransactionId: string) => {
  router.push({
    path: "/planning",
    query: { edit: planningTransactionId },
  });
};

// Aktionsfunktionen für geplante Transaktionen
const executePlanning = async (
  planningTransactionId: string,
  executionDate: string
) => {
  try {
    await PlanningService.executePlanningTransaction(
      planningTransactionId,
      executionDate
    );
    // Erfolg-Feedback könnte hier hinzugefügt werden
  } catch (error) {
    console.error("Fehler beim Ausführen der geplanten Transaktion:", error);
    // Fehler-Feedback könnte hier hinzugefügt werden
  }
};

const skipPlanning = async (
  planningTransactionId: string,
  executionDate: string
) => {
  try {
    await PlanningService.skipPlanningTransaction(
      planningTransactionId,
      executionDate
    );
    // Erfolg-Feedback könnte hier hinzugefügt werden
  } catch (error) {
    console.error("Fehler beim Überspringen der geplanten Transaktion:", error);
    // Fehler-Feedback könnte hier hinzugefügt werden
  }
};

// Hilfsfunktionen für Transaktionstyp-Anzeige (aus PlanningView übernommen)
const getTransactionTypeIcon = (type: TransactionType | undefined): string => {
  if (!type) return "mdi:help-circle-outline";

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
};

const getTransactionTypeClass = (type: TransactionType | undefined): string => {
  if (!type) return "";

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
};

const getSourceName = (planning: PlanningTransaction): string => {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return (
      categoryStore.getCategoryById(planning.categoryId || "")?.name || "-"
    );
  } else {
    return accountStore.getAccountById(planning.accountId)?.name || "-";
  }
};

const getTargetName = (planning: PlanningTransaction): string => {
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
    return (
      categoryStore.getCategoryById(planning.categoryId || "")?.name || "-"
    );
  }
};

// setTransactionLimit – in Komponente ausgelagert

// Funktionen für Planungslimit-Buttons
const setPlanningLimit = (limit: number) => {
  planningLimit.value = limit;
};

// Funktionen für Top Budgets Limit-Buttons
const setExpensesLimit = (limit: number) => {
  expensesLimit.value = limit;
};

// Funktionen für Sparziele-Limit-Buttons
const setSavingsGoalsLimit = (limit: number) => {
  savingsGoalsLimit.value = limit;
};

// Hilfsfunktionen für Budget-Balken-Visualisierung
const getExpenseBarColor = (spent: number, budgeted: number): string => {
  if (budgeted === 0) {
    // Kein Budget definiert - verwende neutrale Farbe
    return "bg-base-content opacity-60";
  }

  const percentage = (spent / budgeted) * 100;

  if (percentage <= 90) {
    // Grün bis 90% des Budgets
    return "bg-success";
  } else if (percentage <= 100) {
    // Warning zwischen 90% und 100%
    return "bg-warning";
  } else {
    // Rot bei Budgetüberschreitung
    return "bg-error";
  }
};

const getExpenseBarWidth = (spent: number, budgeted: number): number => {
  if (budgeted === 0) {
    // Kein Budget - zeige 100% der Ausgaben
    return 100;
  }

  if (spent <= budgeted) {
    // Ausgaben innerhalb des Budgets - zeige Prozentsatz des Budgets
    return (spent / budgeted) * 100;
  } else {
    // Budgetüberschreitung - zeige 100% (volle Breite)
    return 100;
  }
};

const getBudgetMarkerPosition = (spent: number, budgeted: number): number => {
  if (budgeted === 0) return 0;

  if (spent <= budgeted) {
    // Budget-Marker bei 100% der Balkenbreite wenn innerhalb des Budgets
    return 100;
  } else {
    // Bei Budgetüberschreitung: Budget-Marker zeigt die Budget-Position relativ zu den Ausgaben
    return (budgeted / spent) * 100;
  }
};

// Fällige Transaktionen für Auto-Ausführen
const dueTransactions = computed(() => {
  return upcomingPlanningTransactions.value.filter((item) => item.isDue);
});

// Auto-Ausführen Funktion (aus PlanningView übernommen)
const executeAutomaticTransactions = async () => {
  try {
    const count = await PlanningService.executeAllDuePlanningTransactions();
    if (count > 0) {
      alert(`${count} fällige Planungsbuchungen wurden ausgeführt.`);
    } else {
      alert("Keine fälligen Planungsbuchungen gefunden.");
    }
  } catch (error) {
    console.error(
      "Fehler beim Ausführen der fälligen Planungsbuchungen:",
      error
    );
    alert("Fehler beim Ausführen der fälligen Planungsbuchungen.");
  }
};

onMounted(() => {
  // additional initialization if needed
});
</script>

<template>
  <div>
    <!-- Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <AccountBalanceStats
            :show-header="true"
            :show-actions="true"
          />
        </div>
      </div>
      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <PlanningPaymentsGadget
            :show-header="true"
            :show-actions="true"
          />
        </div>
      </div>

      <ExpenseIncomeSummaryChart
        :start-date="startDate"
        :end-date="endDate"
        :show-header="true"
      />
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <RecentTransactions />

        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <MonthlyTrendStats :months="3" />
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <TopBudgetsStats
              :show-header="true"
              :show-actions="true"
            />
          </div>
        </div>

        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <SavingsGoalsStats
              :show-header="true"
              :show-actions="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
