<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useTransactionStore } from "../stores/transactionStore";
import { useAccountStore } from "../stores/accountStore";
import { useCategoryStore } from "../stores/categoryStore";
import { useRecipientStore } from "../stores/recipientStore";
import { useStatisticsStore } from "../stores/statisticsStore";
import { TransactionService } from "../services/TransactionService";
import { TransactionType } from "../types";
import { formatCurrency, formatDate } from "../utils/formatters";
import FinancialTrendChart from "../components/ui/charts/FinancialTrendChart.vue";
import dayjs from "dayjs";

const router = useRouter();
const transactionStore = useTransactionStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const statisticsStore = useStatisticsStore();

const currentDate = dayjs();
const startDate = ref(currentDate.subtract(30, "day").format("YYYY-MM-DD"));
const endDate = ref(currentDate.format("YYYY-MM-DD"));

// Anzahl der anzuzeigenden Transaktionen
const transactionLimit = ref(5);

const accounts = computed(() => accountStore.activeAccounts);
const totalBalance = computed(() =>
  accountStore.accounts.reduce(
    (sum, account) => sum + (account.balance || 0),
    0
  )
);

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
// Berechnung der Einnahmen und Ausgaben über TransactionService
const incomeSummary = computed(() => {
  return TransactionService.getIncomeExpenseSummary(
    startDate.value,
    endDate.value
  );
});
const topExpenses = computed(() =>
  statisticsStore.getCategoryExpenses(startDate.value, endDate.value, 5)
);
const monthlyTrend = computed(() =>
  TransactionService.getMonthlyTrend(3).reverse()
);
const savingsGoals = computed(() => statisticsStore.getSavingsGoalProgress());

const navigateToTransactions = () => router.push("/transactions");
const navigateToAccounts = () => router.push("/accounts");
const navigateToBudgets = () => router.push("/budgets");
const navigateToStatistics = () => router.push("/statistics");
const navigateToPlanning = () => router.push("/planning");

// Funktionen für Transaktionslimit-Buttons
const setTransactionLimit = (limit: number) => {
  transactionLimit.value = limit;
};

onMounted(() => {
  // additional initialization if needed
});
</script>

<template>
  <div>
    <!-- Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Kontostand</h3>
          <p class="text-2xl font-bold">
            {{ formatCurrency(totalBalance) }}
          </p>
          <div class="card-actions justify-end mt-2">
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
        </div>
      </div>
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Letzte 30 Tage</h3>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <div>
              <p class="text-sm">Einnahmen</p>
              <p class="text-lg font-semibold text-success">
                {{ formatCurrency(incomeSummary.income) }}
              </p>
            </div>
            <div>
              <p class="text-sm">Ausgaben</p>
              <p class="text-lg font-semibold text-error">
                {{ formatCurrency(incomeSummary.expense) }}
              </p>
            </div>
            <div>
              <p class="text-sm">Bilanz</p>
              <p
                :class="
                  incomeSummary.balance >= 0
                    ? 'text-lg font-semibold text-success'
                    : 'text-lg font-semibold text-error'
                "
              >
                {{ formatCurrency(incomeSummary.balance) }}
              </p>
            </div>
          </div>
          <div class="card-actions justify-end mt-2">
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
        </div>
      </div>
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Geplante Zahlungen</h3>
          <p class="text-sm">Nächste 7 Tage</p>
          <p
            v-if="false"
            class="text-lg font-semibold"
          >
            {{ formatCurrency(0) }}
          </p>
          <p
            v-else
            class="text-sm italic"
          >
            Keine anstehenden Zahlungen
          </p>
          <div class="card-actions justify-end mt-2">
            <button
              class="btn btn-sm btn-ghost"
              @click="navigateToPlanning"
            >
              Details
              <span
                class="iconify ml-1"
                data-icon="mdi:chevron-right"
              ></span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="card bg-base-100 shadow-md">
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
        <div class="card bg-base-100 shadow-md">
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
                    <td class="font-medium py-2">{{ month.month }}</td>
                    <td class="text-success text-right font-semibold py-2">
                      {{ formatCurrency(month.income) }}
                    </td>
                    <td class="text-error text-right font-semibold py-2">
                      {{ formatCurrency(month.expense) }}
                    </td>
                    <td
                      :class="
                        month.balance >= 0
                          ? 'text-success text-right font-bold py-2'
                          : 'text-error text-right font-bold py-2'
                      "
                    >
                      {{ formatCurrency(month.balance) }}
                    </td>
                    <td class="text-center py-2">
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
        <!-- Financial Trend Chart - rechts oben im Dashboard -->
        <FinancialTrendChart />

        <div class="card bg-base-100 shadow-md">
          <div class="card-body">
            <h3 class="card-title text-lg mb-4">Top-Ausgaben</h3>
            <div v-if="topExpenses.length > 0">
              <div
                v-for="expense in topExpenses"
                :key="expense.categoryId"
                class="mb-3"
              >
                <div class="flex justify-between items-center mb-1">
                  <span>{{ expense.name }}</span>
                  <span class="text-error">{{
                    formatCurrency(expense.amount)
                  }}</span>
                </div>
                <progress
                  class="progress progress-error w-full"
                  :value="expense.amount"
                  :max="topExpenses[0].amount"
                ></progress>
              </div>
            </div>
            <div
              v-else
              class="text-center py-4"
            >
              <p class="text-sm italic">Keine Ausgaben im Zeitraum</p>
            </div>
            <div class="card-actions justify-end mt-2">
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
        </div>
        <div class="card bg-base-100 shadow-md">
          <div class="card-body">
            <h3 class="card-title text-lg mb-4">Sparziele</h3>
            <div v-if="savingsGoals.length > 0">
              <div
                v-for="goal in savingsGoals"
                :key="goal.id"
                class="mb-4"
              >
                <div class="flex justify-between items-center mb-1">
                  <span>{{ goal.name }}</span>
                  <span>{{ goal.progress }}%</span>
                </div>
                <progress
                  class="progress progress-accent w-full"
                  :value="goal.progress"
                  max="100"
                ></progress>
                <div class="flex justify-between text-xs mt-1">
                  <span>{{ formatCurrency(goal.currentAmount) }}</span>
                  <span>{{ formatCurrency(goal.targetAmount) }}</span>
                </div>
              </div>
            </div>
            <div
              v-else
              class="text-center py-4"
            >
              <p class="text-sm italic">Keine Sparziele definiert</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
