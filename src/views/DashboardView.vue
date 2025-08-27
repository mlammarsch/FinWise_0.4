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
import { formatCurrency, formatDate } from "../utils/formatters";
import ExpenseIncomeSummaryChart from "../components/ui/charts/ExpenseIncomeSummaryChart.vue";
import CurrencyDisplay from "../components/ui/CurrencyDisplay.vue";
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
const currentMonthStart = dayjs().startOf('month');
const currentMonthEnd = dayjs().endOf('month');

// Anzahl der anzuzeigenden Transaktionen
const transactionLimit = ref(5);

// Anzahl der anzuzeigenden geplanten Transaktionen
const planningLimit = ref(3);

// Anzahl der anzuzeigenden Top Budgets
const expensesLimit = ref(5);

// Anzahl der anzuzeigenden Sparziele
const savingsGoalsLimit = ref(5);

const accounts = computed(() => accountStore.activeAccounts);

// Verwende BalanceService für konsistente Saldoberechnungen
const totalBalance = computed(() => BalanceService.getTotalBalance());

// Kontogruppen mit Salden für Collapse-Komponenten
const accountGroupsWithBalances = computed(() => {
  return accountStore.accountGroups
    .filter((group) => {
      // Nur Gruppen mit aktiven Konten anzeigen
      const groupAccounts = accountStore.accounts.filter(
        (account) =>
          account.accountGroupId === group.id &&
          account.isActive &&
          !account.isOfflineBudget
      );
      return groupAccounts.length > 0;
    })
    .map((group) => {
      const groupBalance = BalanceService.getAccountGroupBalance(group.id);
      const groupAccounts = accountStore.accounts
        .filter(
          (account) =>
            account.accountGroupId === group.id &&
            account.isActive &&
            !account.isOfflineBudget
        )
        .map((account) => ({
          ...account,
          balance: BalanceService.getTodayBalance("account", account.id),
        }));

      return {
        ...group,
        balance: groupBalance,
        accounts: groupAccounts,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
});

// Gefilterte Transaktionen: nur INCOME und EXPENSE
const recentTransactions = computed(() => {
  const allTransactions = transactionStore.transactions
    .filter(
      (tx) =>
        tx.type === TransactionType.INCOME ||
        tx.type === TransactionType.EXPENSE
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, transactionLimit.value);

  return allTransactions;
});
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
  const expenseCategories = categoryStore.categories.filter(cat =>
    cat.isActive &&
    !cat.isIncomeCategory &&
    !cat.isSavingsGoal && // Keine Sparzielkategorien
    cat.name !== 'Verfügbare Mittel' &&
    !cat.parentCategoryId // Nur Root-Kategorien
  );

  const categoryData = expenseCategories.map(category => {
    const budgetData = BudgetService.getAggregatedMonthlyBudgetData(
      category.id,
      monthStart,
      monthEnd
    );

    const spent = Math.abs(budgetData.spent);
    const budgeted = Math.abs(budgetData.budgeted);
    const budgetPercentage = budgeted > 0 ? (spent / budgeted) * 100 : (spent > 0 ? 999 : 0);

    return {
      categoryId: category.id,
      name: category.name,
      spent: spent, // Positive Darstellung für Ausgaben (ohne Planbuchungen)
      budgeted: budgeted, // Budget als positiver Wert
      available: budgetData.saldo,
      budgetPercentage: budgetPercentage, // Prozentsatz des verbrauchten Budgets
      budgetData
    };
  })
  .filter(item => item.budgeted > 0 && item.spent > 0) // Nur Kategorien mit Budget UND tatsächlichen Ausgaben
  .sort((a, b) => b.budgetPercentage - a.budgetPercentage) // Nach prozentualem Budget-Verbrauch sortieren (absteigend)
  .slice(0, 5); // Top 5

  return categoryData;
});

// Sparziele mit Fortschrittsdaten
const savingsGoalsWithProgress = computed(() => {
  const savingsCategories = categoryStore.savingsGoals.filter(cat =>
    cat.isActive && cat.isSavingsGoal && cat.targetAmount && cat.targetAmount > 0
  );

  const today = dayjs();

  const goalsData = savingsCategories.map(category => {
    // Verwende BalanceService für tagesgenauen Saldo
    const currentAmount = Math.abs(BalanceService.getTodayBalance("category", category.id));
    const targetAmount = category.targetAmount || 0;
    const progress = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

    // Berechne Soll-Sparbetrag basierend auf Zieldatum
    let shouldHaveSaved = 0;
    let barColor = 'bg-warning'; // Standard: gelb

    if (category.goalDate) {
      const goalDate = dayjs(category.goalDate);
      const startDate = today.startOf('month'); // Annahme: Sparziel startet am Monatsanfang

      // Berechne Gesamtdauer in Monaten
      const totalMonths = goalDate.diff(startDate, 'month', true);

      if (totalMonths > 0) {
        // Monatsregelrate
        const monthlyRate = targetAmount / totalMonths;

        // Vergangene Zeit seit Start in Monaten
        const elapsedMonths = today.diff(startDate, 'month', true);

        // Soll-Sparbetrag bis heute
        shouldHaveSaved = monthlyRate * elapsedMonths;

        // Bestimme Balkenfarbe basierend auf Soll-Ist-Vergleich
        const tolerance = monthlyRate * 0.05; // 5% Toleranz für "gelb"

        if (currentAmount >= shouldHaveSaved + tolerance) {
          barColor = 'bg-success'; // Grün: Überschritten
        } else if (currentAmount >= shouldHaveSaved - tolerance) {
          barColor = 'bg-warning'; // Gelb: Im Toleranzbereich
        } else {
          barColor = 'bg-error'; // Rot: Unterschritten
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
      category
    };
  })
  .sort((a, b) => b.progress - a.progress) // Nach Fortschritt sortieren
  .slice(0, savingsGoalsLimit.value);

  return goalsData;
});

const topExpenses = computed(() =>
  statisticsStore.getCategoryExpenses(startDate.value, endDate.value, 5)
);
const monthlyTrend = computed(() =>
  statisticsStore.getMonthlyTrend(3).reverse()
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
const navigateToAccounts = () => router.push("/accounts");
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

// Funktionen für Transaktionslimit-Buttons
const setTransactionLimit = (limit: number) => {
  transactionLimit.value = limit;
};

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
    return 'bg-base-content opacity-60';
  }

  const percentage = (spent / budgeted) * 100;

  if (percentage <= 90) {
    // Grün bis 90% des Budgets
    return 'bg-success';
  } else if (percentage <= 100) {
    // Warning zwischen 90% und 100%
    return 'bg-warning';
  } else {
    // Rot bei Budgetüberschreitung
    return 'bg-error';
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
          <div class="flex justify-between items-center mb-4">
            <h3 class="card-title text-lg">Kontostand</h3>
            <button
              class="btn btn-sm btn-ghost"
              @click="navigateToAccounts"
            >
              Details
              <span
                class="iconify ml-1"
                data-icon="mdi:chevron-right"
              ></span>
            </button>
          </div>

          <!-- Gesamtsaldo -->
          <div class="mb-4">
            <p class="text-2xl font-bold">
              <CurrencyDisplay
                :amount="totalBalance"
                :asInteger="true"
              />
            </p>
            <p class="text-sm opacity-60">Gesamtsaldo aller Konten</p>
          </div>

          <!-- Kontogruppen als Collapse-Komponenten -->
          <div class="space-y-2 mb-4">
            <div
              v-for="group in accountGroupsWithBalances"
              :key="group.id"
              tabindex="0"
              class="collapse collapse-arrow bg-base-200 border-base-300 border"
            >
              <div class="collapse-title text-sm font-medium py-2 px-3">
                <div class="flex justify-between items-center">
                  <span>{{ group.name }}</span>
                  <span class="font-semibold">
                    <CurrencyDisplay
                      :amount="group.balance"
                      :asInteger="true"
                    />
                  </span>
                </div>
              </div>
              <div class="collapse-content px-3 pb-2">
                <div class="space-y-1">
                  <div
                    v-for="account in group.accounts"
                    :key="account.id"
                    class="flex justify-between items-center py-1 px-2 rounded bg-base-100"
                  >
                    <span class="text-xs">{{ account.name }}</span>
                    <span class="text-xs font-medium">
                      <CurrencyDisplay
                        :amount="account.balance"
                        :asInteger="true"
                      />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <div class="flex justify-between items-center mb-4">
            <h3 class="card-title text-lg">Letzte 30 Tage</h3>
            <button
              class="btn btn-sm btn-ghost"
              @click="navigateToTransactions"
            >
              Details
              <span
                class="iconify ml-1"
                data-icon="mdi:chevron-right"
              ></span>
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <div>
              <p class="text-sm">Einnahmen</p>
              <p class="text-lg font-semibold">
                <CurrencyDisplay
                  :amount="incomeSummary.income"
                  :asInteger="true"
                />
              </p>
            </div>
            <div>
              <p class="text-sm">Ausgaben</p>
              <p class="text-lg font-semibold">
                <CurrencyDisplay
                  :amount="incomeSummary.expense * -1"
                  :asInteger="true"
                />
              </p>
            </div>
            <div>
              <p class="text-sm">Bilanz</p>
              <p class="text-lg font-semibold">
                <CurrencyDisplay
                  :amount="incomeSummary.balance"
                  :asInteger="true"
                />
              </p>
            </div>
          </div>
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
        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <h3 class="card-title text-lg">Letzte Transaktionen</h3>
              <!-- Buttons für Transaktionslimit -->
              <div class="flex gap-2 mb-4">
                <button
                  :class="
                    transactionLimit === 5
                      ? 'btn btn-xs btn-primary'
                      : 'btn btn-xs btn-outline'
                  "
                  @click="setTransactionLimit(5)"
                >
                  5
                </button>
                <button
                  :class="
                    transactionLimit === 10
                      ? 'btn btn-xs btn-primary'
                      : 'btn btn-xs btn-outline'
                  "
                  @click="setTransactionLimit(10)"
                >
                  10
                </button>
                <button
                  :class="
                    transactionLimit === 25
                      ? 'btn btn-xs btn-primary'
                      : 'btn btn-xs btn-outline'
                  "
                  @click="setTransactionLimit(25)"
                >
                  25
                </button>
              </div>
              <button
                class="btn btn-sm btn-ghost"
                @click="navigateToTransactions"
              >
                Alle anzeigen
                <span
                  class="iconify ml-1"
                  data-icon="mdi:chevron-right"
                ></span>
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="table table-zebra w-full table-compact">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Konto</th>
                    <th>Empfänger</th>
                    <th>Beschreibung</th>
                    <th>Kategorie</th>
                    <th class="text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr
                    v-for="tx in recentTransactions"
                    :key="tx.id"
                    class="leading-tight"
                  >
                    <td class="py-2">{{ formatDate(tx.date) }}</td>
                    <td class="py-2">
                      {{
                        tx.accountId
                          ? accountStore.getAccountById(tx.accountId)?.name ||
                            ""
                          : ""
                      }}
                    </td>
                    <td class="py-2">
                      {{
                        tx.recipientId
                          ? recipientStore.getRecipientById(tx.recipientId)
                              ?.name || ""
                          : ""
                      }}
                    </td>
                    <td class="py-2">{{ tx.description || tx.payee || "" }}</td>
                    <td class="py-2">
                      {{
                        tx.categoryId
                          ? categoryStore.getCategoryById(tx.categoryId)
                              ?.name || ""
                          : ""
                      }}
                    </td>
                    <td
                      :class="
                        tx.amount >= 0
                          ? 'text-success text-right py-2'
                          : 'text-error text-right py-2'
                      "
                    >
                      {{ formatCurrency(tx.amount) }}
                    </td>
                  </tr>
                  <tr v-if="recentTransactions.length === 0">
                    <td
                      colspan="6"
                      class="text-center py-4"
                    >
                      Keine Transaktionen vorhanden
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <h3 class="card-title text-lg mb-4">Monatlicher Trend</h3>
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full table-compact">
                <thead>
                  <tr>
                    <th>Monat</th>
                    <th class="text-right">Einnahmen</th>
                    <th class="text-right">Ausgaben</th>
                    <th class="text-right">Bilanz</th>
                    <th class="text-center">Trend</th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr
                    v-for="(month, index) in monthlyTrend"
                    :key="month.monthKey"
                    class="leading-tight"
                  >
                    <td class="font-medium py-0">{{ month.month }}</td>
                    <td class="text-right font-semibold py-2">
                      <CurrencyDisplay
                        :amount="month.income"
                        :asInteger="true"
                      />
                    </td>
                    <td class="text-right font-semibold py-1">
                      <CurrencyDisplay
                        :amount="month.expense"
                        :asInteger="true"
                      />
                    </td>
                    <td class="text-right font-bold py-1">
                      <CurrencyDisplay
                        :amount="month.balance"
                        :asInteger="true"
                      />
                    </td>
                    <td class="text-center py-1">
                      <div class="flex items-center justify-center">
                        <span
                          v-if="month.trend === 'up'"
                          class="text-success text-xl font-bold"
                          title="Verbesserung gegenüber Vormonat"
                          >↗</span
                        >
                        <span
                          v-else-if="month.trend === 'down'"
                          class="text-error text-xl font-bold"
                          title="Verschlechterung gegenüber Vormonat"
                          >↘</span
                        >
                        <span
                          v-else
                          class="text-base-content text-opacity-50 text-xl font-bold"
                          title="Keine Änderung gegenüber Vormonat"
                          >→</span
                        >
                      </div>
                    </td>
                  </tr>
                  <tr v-if="monthlyTrend.length === 0">
                    <td
                      colspan="5"
                      class="text-center py-4"
                    >
                      Keine Daten vorhanden
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="card-actions justify-end mt-4">
              <button
                class="btn btn-sm btn-ghost"
                @click="navigateToStatistics"
              >
                Mehr Statistiken
                <span
                  class="iconify ml-1"
                  data-icon="mdi:chevron-right"
                ></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="space-y-6">
        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="card-title text-lg">Geplante Zahlungen</h3>
                <p class="text-sm">Nächste 14 Tage</p>
              </div>
              <!-- Buttons für Planungslimit und Fällige ausführen -->
              <div class="flex gap-2 items-center">
                <div class="flex gap-2">
                  <button
                    :class="
                      planningLimit === 3
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setPlanningLimit(3)"
                  >
                    3
                  </button>
                  <button
                    :class="
                      planningLimit === 8
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setPlanningLimit(8)"
                  >
                    8
                  </button>
                  <button
                    :class="
                      planningLimit === 16
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setPlanningLimit(16)"
                  >
                    16
                  </button>
                  <button
                    class="btn btn-xs btn-outline"
                    @click="navigateToPlanning"
                  >
                    Alle
                  </button>
                </div>

                <!-- Fällige ausführen Button -->
                <button
                  v-if="dueTransactions.length > 0"
                  class="btn btn-xs btn-info btn-outline"
                  @click="executeAutomaticTransactions"
                  :title="`${dueTransactions.length} fällige Planungen ausführen`"
                >
                  <Icon
                    icon="mdi:play-circle"
                    class="mr-1"
                  />
                  Fällige ({{ dueTransactions.length }})
                </button>
              </div>
            </div>

            <!-- Liste der geplanten Transaktionen -->
            <div
              v-if="upcomingPlanningTransactions.length > 0"
              class="space-y-1 mt-3"
            >
              <div
                v-for="item in upcomingPlanningTransactions.slice(
                  0,
                  planningLimit
                )"
                :key="`${item.planningTransaction.id}-${item.executionDate}`"
                :class="[
                  'flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
                  item.isDue
                    ? 'bg-info/10 hover:bg-info/20 border border-info/20'
                    : 'bg-base-200 hover:bg-base-300',
                ]"
                @click="navigateToPlanningEdit(item.planningTransaction.id)"
              >
                <!-- Linke Seite: Icon, Name und Datum -->
                <div class="flex items-center space-x-1 flex-1 min-w-0">
                  <div class="flex-shrink-0">
                    <span
                      class="iconify text-lg"
                      :class="
                        getTransactionTypeClass(
                          item.planningTransaction.transactionType
                        )
                      "
                      :data-icon="
                        getTransactionTypeIcon(
                          item.planningTransaction.transactionType
                        )
                      "
                    ></span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium truncate">
                      {{ item.planningTransaction.name }}
                    </div>
                    <div class="text-xs opacity-60">
                      {{ item.formattedDate }} •
                      {{ getSourceName(item.planningTransaction) }} →
                      {{ getTargetName(item.planningTransaction) }}
                    </div>
                  </div>
                </div>

                <!-- Rechte Seite: Betrag und Aktionsbuttons -->
                <div class="flex items-center space-x-2 flex-shrink-0">
                  <div class="text-right">
                    <div
                      class="text-sm font-semibold"
                      :class="
                        getTransactionTypeClass(
                          item.planningTransaction.transactionType
                        )
                      "
                    >
                      <CurrencyDisplay
                        :amount="item.planningTransaction.amount"
                        :asInteger="true"
                      />
                    </div>
                  </div>

                  <!-- Aktionsbuttons -->
                  <div class="flex space-x-1">
                    <div
                      class="tooltip tooltip-top max-w-xs"
                      data-tip="Planungstransaktion ausführen und echte Transaktion erstellen"
                    >
                      <button
                        class="btn btn-ghost btn-xs border-none"
                        @click.stop="
                          executePlanning(
                            item.planningTransaction.id,
                            item.executionDate
                          )
                        "
                      >
                        <Icon
                          icon="mdi:play"
                          class="text-base text-success"
                        />
                      </button>
                    </div>
                    <div
                      class="tooltip tooltip-top max-w-xs"
                      data-tip="Planungstransaktion überspringen (als erledigt markieren ohne Transaktion zu erstellen)"
                    >
                      <button
                        class="btn btn-ghost btn-xs border-none"
                        @click.stop="
                          skipPlanning(
                            item.planningTransaction.id,
                            item.executionDate
                          )
                        "
                      >
                        <Icon
                          icon="mdi:skip-next"
                          class="text-base text-warning"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Anzeige wenn mehr Einträge vorhanden als das Limit -->
              <div
                v-if="upcomingPlanningTransactions.length > planningLimit"
                class="text-center pt-2"
              >
                <p class="text-xs opacity-60">
                  ... und
                  {{ upcomingPlanningTransactions.length - planningLimit }}
                  weitere
                </p>
              </div>
            </div>

            <!-- Fallback wenn keine geplanten Transaktionen -->
            <div
              v-else
              class="text-center py-4"
            >
              <p class="text-sm italic opacity-60">
                Keine anstehenden Zahlungen
              </p>
            </div>
          </div>
        </div>

        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="card-title text-lg">Top Budgets</h3>
                <p class="text-sm opacity-60">Aktueller Monat (MTD)</p>
              </div>
              <!-- Buttons für Ausgabenlimit und Navigation -->
              <div class="flex gap-2 items-center">
                <div class="flex gap-2">
                  <button
                    :class="
                      expensesLimit === 3
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setExpensesLimit(3)"
                  >
                    3
                  </button>
                  <button
                    :class="
                      expensesLimit === 5
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setExpensesLimit(5)"
                  >
                    5
                  </button>
                  <button
                    :class="
                      expensesLimit === 10
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setExpensesLimit(10)"
                  >
                    10
                  </button>
                </div>
                <button
                  class="btn btn-sm btn-ghost"
                  @click="navigateToBudgets"
                >
                  Budgets verwalten
                  <span
                    class="iconify ml-1"
                    data-icon="mdi:chevron-right"
                  ></span>
                </button>
              </div>
            </div>

            <div v-if="topExpensesWithBudget.slice(0, expensesLimit).length > 0" class="space-y-2">
              <div
                v-for="expense in topExpensesWithBudget.slice(0, expensesLimit)"
                :key="expense.categoryId"
                class="relative"
              >
                <!-- Kategorie-Name und Beträge -->
                <div class="flex justify-left items-center mb-2">
                  <span class="font-medium mr-1">{{ expense.name }} -</span>
                  <div class="text-right">
                    <div class="text-sm font-semibold">
                      <CurrencyDisplay
                        :amount="expense.spent"
                        :asInteger="true"
                      />
                    </div>
                  </div>
                </div>

                <!-- Budget-Balken mit Marker -->
                <div class="relative">
                  <!-- Haupt-Balken -->
                  <div class="w-full bg-base-300 rounded-full h-1.5 relative overflow-hidden">
                    <!-- Ausgaben-Balken -->
                    <div
                      :class="[
                        'h-full rounded-full transition-all duration-300',
                        getExpenseBarColor(expense.spent, expense.budgeted)
                      ]"
                      :style="{
                        width: getExpenseBarWidth(expense.spent, expense.budgeted) + '%'
                      }"
                    ></div>
                  </div>

                  <!-- Budget-Marker (Chevron) -->
                  <div
                    v-if="expense.budgeted > 0"
                    class="absolute -top-1 transform -translate-x-1/2 -translate-y-full"
                    :style="{
                      left: getBudgetMarkerPosition(expense.spent, expense.budgeted) + '%'
                    }"
                  >
                    <!-- Chevron nach unten zeigend -->
                    <div class="flex flex-col items-center">
                      <div class="text-xs font-medium mb-0 bg-base-300 px-1 border border-neutral rounded">
                        <CurrencyDisplay
                          :amount="expense.budgeted"
                          :asInteger="true"
                        />
                      </div>
                      <div class="w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-base-content opacity-70"></div>
                    </div>
                  </div>
                </div>

                <!-- Fortschritts-Info -->
                <div class="flex justify-between text-xs opacity-60 mt-1">
                  <span>
                    {{ expense.budgeted > 0 ? Math.round((expense.spent / expense.budgeted) * 100) : 0 }}%
                    {{ expense.budgeted > 0 ? 'vom Budget' : 'ausgegeben' }}
                  </span>
                  <span v-if="expense.budgeted > 0 && expense.spent > expense.budgeted" class="text-error">
                    +<CurrencyDisplay
                      :amount="expense.spent - expense.budgeted"
                      :asInteger="true"
                    /> über Budget
                  </span>
                </div>
              </div>
            </div>

            <div
              v-else
              class="text-center py-4"
            >
              <p class="text-sm italic opacity-60">Keine Ausgaben im aktuellen Monat</p>
            </div>
          </div>
        </div>

        <div
          class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
        >
          <div class="card-body">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h3 class="card-title text-lg">Sparziele</h3>
                <p class="text-sm opacity-60">Fortschritt der Sparziele</p>
              </div>
              <!-- Buttons für Sparziele-Limit -->
              <div class="flex gap-2 items-center">
                <div class="flex gap-2">
                  <button
                    :class="
                      savingsGoalsLimit === 3
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setSavingsGoalsLimit(3)"
                  >
                    3
                  </button>
                  <button
                    :class="
                      savingsGoalsLimit === 5
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setSavingsGoalsLimit(5)"
                  >
                    5
                  </button>
                  <button
                    :class="
                      savingsGoalsLimit === 10
                        ? 'btn btn-xs btn-primary'
                        : 'btn btn-xs btn-outline'
                    "
                    @click="setSavingsGoalsLimit(10)"
                  >
                    10
                  </button>
                </div>
              </div>
            </div>

            <div v-if="savingsGoalsWithProgress.length > 0" class="space-y-2">
              <div
                v-for="goal in savingsGoalsWithProgress"
                :key="goal.categoryId"
                class="relative"
              >
                <!-- Kategorie-Name und Beträge -->
                <div class="flex justify-left items-center mb-2">
                  <span class="font-medium mr-1">{{ goal.name }} -</span>
                  <div class="text-right">
                    <div class="text-sm font-semibold">
                      <CurrencyDisplay
                        :amount="goal.targetAmount"
                        :asInteger="true"
                      />
                    </div>
                  </div>
                  <span v-if="goal.goalDate" class="text-xs opacity-60 ml-2">
                    bis {{ new Date(goal.goalDate).toLocaleDateString('de-DE') }}
                  </span>
                </div>

                <!-- Fortschritts-Balken mit Marker -->
                <div class="relative">
                  <!-- Haupt-Balken (grau für 100%) -->
                  <div class="w-full bg-base-300 rounded-full h-1.5 relative overflow-hidden">
                    <!-- Fortschritts-Balken (dynamische Farbe) -->
                    <div
                      :class="[
                        'h-full rounded-full transition-all duration-300',
                        goal.barColor
                      ]"
                      :style="{
                        width: goal.progress + '%'
                      }"
                    ></div>
                  </div>

                  <!-- Gesparter Betrag-Marker (Badge) -->
                  <div
                    class="absolute -top-1 transform -translate-x-1/2 -translate-y-full"
                    :style="{
                      left: goal.progress + '%'
                    }"
                  >
                    <!-- Badge mit gespartem Betrag -->
                    <div class="flex flex-col items-center">
                      <div class="text-xs font-medium mb-0 bg-base-300 px-1 border border-neutral rounded">
                        <CurrencyDisplay
                          :amount="goal.currentAmount"
                          :asInteger="true"
                        />
                      </div>
                      <div class="w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-base-content opacity-70"></div>
                    </div>
                  </div>
                </div>

                <!-- Fortschritts-Info -->
                <div class="flex justify-between text-xs opacity-60 mt-1">
                  <span>
                    {{ Math.round(goal.progress) }}% vom Ziel angespart
                  </span>
                  <span v-if="goal.progress >= 100" class="text-success">
                    Ziel erreicht!
                  </span>
                  <span v-else class="text-info">
                    Noch <CurrencyDisplay
                      :amount="goal.targetAmount - goal.currentAmount"
                      :asInteger="true"
                    /> benötigt
                  </span>
                </div>
              </div>
            </div>

            <div
              v-else
              class="text-center py-4"
            >
              <p class="text-sm italic opacity-60">Keine Sparziele definiert</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
