<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useTransactionStore } from "../stores/transactionStore";
import { useAccountStore } from "../stores/accountStore";
import { useStatisticsStore } from "../stores/statisticsStore";
import { formatCurrency, formatDate } from "../utils/formatters";
import dayjs from "dayjs";

const router = useRouter();
const transactionStore = useTransactionStore();
const accountStore = useAccountStore();
const statisticsStore = useStatisticsStore();

const currentDate = dayjs();
const startDate = ref(currentDate.subtract(30, "day").format("YYYY-MM-DD"));
const endDate = ref(currentDate.format("YYYY-MM-DD"));

const accounts = computed(() => accountStore.activeAccounts);
const recentTransactions = computed(() =>
  transactionStore.getRecentTransactions(5)
);
const incomeSummary = computed(() =>
  statisticsStore.getIncomeExpenseSummary(startDate.value, endDate.value)
);
const topExpenses = computed(() =>
  statisticsStore.getCategoryExpenses(startDate.value, endDate.value, 5)
);
const monthlyTrend = computed(() => statisticsStore.getMonthlyTrend(3));
const savingsGoals = computed(() => statisticsStore.getSavingsGoalProgress());

const navigateToTransactions = () => router.push("/transactions");
const navigateToAccounts = () => router.push("/accounts");
const navigateToBudgets = () => router.push("/budgets");
const navigateToStatistics = () => router.push("/statistics");
const navigateToPlanning = () => router.push("/planning");

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
            {{ formatCurrency(accountStore.totalBalance) }}
          </p>
          <div class="card-actions justify-end mt-2">
            <button class="btn btn-sm btn-ghost" @click="navigateToAccounts">
              Details
              <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
            </button>
          </div>
        </div>
      </div>
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Letzte 30 Tage</h3>
          <div class="grid grid-cols-2 gap-2 mt-2">
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
          </div>
          <div class="card-actions justify-end mt-2">
            <button class="btn btn-sm btn-ghost" @click="navigateToStatistics">
              Details
              <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
            </button>
          </div>
        </div>
      </div>
      <div class="card bg-base-100 shadow-md">
        <div class="card-body">
          <h3 class="card-title text-lg">Geplante Zahlungen</h3>
          <p class="text-sm">Nächste 7 Tage</p>
          <p v-if="false" class="text-lg font-semibold">
            {{ formatCurrency(0) }}
          </p>
          <p v-else class="text-sm italic">Keine anstehenden Zahlungen</p>
          <div class="card-actions justify-end mt-2">
            <button class="btn btn-sm btn-ghost" @click="navigateToPlanning">
              Details
              <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
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
              <button
                class="btn btn-sm btn-ghost"
                @click="navigateToTransactions"
              >
                Alle anzeigen
                <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Beschreibung</th>
                    <th>Kategorie</th>
                    <th class="text-right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="tx in recentTransactions" :key="tx.id">
                    <td>{{ formatDate(tx.date) }}</td>
                    <td>{{ tx.payee }}</td>
                    <td>
                      <span v-if="tx.categoryId">
                        {{
                          accountStore.getAccountById(tx.accountId)?.name ||
                          "Unbekannt"
                        }}
                      </span>
                      <span v-else class="text-opacity-60"
                        >Keine Kategorie</span
                      >
                    </td>
                    <td
                      :class="
                        tx.amount >= 0
                          ? 'text-success text-right'
                          : 'text-error text-right'
                      "
                    >
                      {{ formatCurrency(tx.amount) }}
                    </td>
                  </tr>
                  <tr v-if="recentTransactions.length === 0">
                    <td colspan="4" class="text-center py-4">
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
              <table class="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Monat</th>
                    <th class="text-right">Einnahmen</th>
                    <th class="text-right">Ausgaben</th>
                    <th class="text-right">Bilanz</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(month, index) in monthlyTrend" :key="index">
                    <td>{{ month.month }}</td>
                    <td class="text-success text-right">
                      {{ formatCurrency(month.income) }}
                    </td>
                    <td class="text-error text-right">
                      {{ formatCurrency(month.expense) }}
                    </td>
                    <td
                      :class="
                        month.income - month.expense >= 0
                          ? 'text-success text-right'
                          : 'text-error text-right'
                      "
                    >
                      {{ formatCurrency(month.income - month.expense) }}
                    </td>
                  </tr>
                  <tr v-if="monthlyTrend.length === 0">
                    <td colspan="4" class="text-center py-4">
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
                <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="space-y-6">
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
            <div v-else class="text-center py-4">
              <p class="text-sm italic">Keine Ausgaben im Zeitraum</p>
            </div>
            <div class="card-actions justify-end mt-2">
              <button class="btn btn-sm btn-ghost" @click="navigateToBudgets">
                Budgets verwalten
                <span class="iconify ml-1" data-icon="mdi:chevron-right"></span>
              </button>
            </div>
          </div>
        </div>
        <div class="card bg-base-100 shadow-md">
          <div class="card-body">
            <h3 class="card-title text-lg mb-4">Sparziele</h3>
            <div v-if="savingsGoals.length > 0">
              <div v-for="goal in savingsGoals" :key="goal.id" class="mb-4">
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
            <div v-else class="text-center py-4">
              <p class="text-sm italic">Keine Sparziele definiert</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
