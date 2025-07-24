<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { TransactionService } from "@/services/TransactionService";
import { formatCurrency } from "@/utils/formatters";
import dayjs from "dayjs";

// Chart-Komponenten
import IncomeExpenseChart from "@/components/ui/charts/IncomeExpenseChart.vue";
import CategoryExpensesChart from "@/components/ui/charts/CategoryExpensesChart.vue";
import NetWorthChart from "@/components/ui/charts/NetWorthChart.vue";
import AccountTrendChart from "@/components/ui/charts/AccountTrendChart.vue";

// Stores
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();

// Zeitraum für die Statistiken
const startDate = ref(dayjs().startOf("month").format("YYYY-MM-DD"));
const endDate = ref(dayjs().endOf("month").format("YYYY-MM-DD"));

// Filter-Optionen
const selectedAccountId = ref("all"); // "all", "grouped", oder spezifische Account-ID
const accountGrouping = ref("all"); // "all" oder "grouped"
const trendMonths = ref(-6);
const accountTrendDays = ref(30);

// Zusammenfassung für den ausgewählten Zeitraum
const summary = computed(() => {
  return TransactionService.getIncomeExpenseSummary(
    startDate.value,
    endDate.value
  );
});

// Top-Ausgabenkategorien für die Liste
const topExpenseCategories = computed(() => {
  const transactions = TransactionService.getAllTransactions();
  const start = new Date(startDate.value);
  const end = new Date(endDate.value);

  // Gruppiere Ausgaben nach Kategorien
  const categoryExpenses: Record<
    string,
    { name: string; amount: number; categoryId: string }
  > = {};

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    if (txDate >= start && txDate <= end && tx.amount < 0 && tx.categoryId) {
      const category = categoryStore.getCategoryById(tx.categoryId);
      if (category) {
        if (!categoryExpenses[tx.categoryId]) {
          categoryExpenses[tx.categoryId] = {
            name: category.name,
            amount: 0,
            categoryId: tx.categoryId,
          };
        }
        categoryExpenses[tx.categoryId].amount += Math.abs(tx.amount);
      }
    }
  });

  return Object.values(categoryExpenses)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
});

// Top-Einnahmenkategorien für die Liste
const topIncomeCategories = computed(() => {
  const transactions = TransactionService.getAllTransactions();
  const start = new Date(startDate.value);
  const end = new Date(endDate.value);

  // Gruppiere Einnahmen nach Kategorien
  const categoryIncome: Record<
    string,
    { name: string; amount: number; categoryId: string }
  > = {};

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    if (txDate >= start && txDate <= end && tx.amount > 0 && tx.categoryId) {
      const category = categoryStore.getCategoryById(tx.categoryId);
      if (category && category.isIncomeCategory) {
        if (!categoryIncome[tx.categoryId]) {
          categoryIncome[tx.categoryId] = {
            name: category.name,
            amount: 0,
            categoryId: tx.categoryId,
          };
        }
        categoryIncome[tx.categoryId].amount += tx.amount;
      }
    }
  });

  return Object.values(categoryIncome)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
});

// Konten für das Dropdown
const accounts = computed(() => {
  const activeAccounts = accountStore.activeAccounts.filter(
    (acc) => !acc.isOfflineBudget
  );
  const accountTypes = [
    ...new Set(activeAccounts.map((acc) => acc.accountType)),
  ];

  return {
    all: activeAccounts,
    types: accountTypes,
  };
});

// Setze das erste aktive Konto als Standard
onMounted(() => {
  if (accounts.value.all.length > 0) {
    selectedAccountId.value = accounts.value.all[0].id;
  }
});

// Zeitraum ändern
const setTimeRange = (range: string) => {
  const today = dayjs();

  switch (range) {
    case "thisMonth":
      startDate.value = today.startOf("month").format("YYYY-MM-DD");
      endDate.value = today.endOf("month").format("YYYY-MM-DD");
      break;
    case "lastMonth":
      startDate.value = today
        .subtract(1, "month")
        .startOf("month")
        .format("YYYY-MM-DD");
      endDate.value = today
        .subtract(1, "month")
        .endOf("month")
        .format("YYYY-MM-DD");
      break;
    case "thisQuarter":
      startDate.value = today.startOf("quarter").format("YYYY-MM-DD");
      endDate.value = today.endOf("quarter").format("YYYY-MM-DD");
      break;
    case "thisYear":
      startDate.value = today.startOf("year").format("YYYY-MM-DD");
      endDate.value = today.endOf("year").format("YYYY-MM-DD");
      break;
    case "lastYear":
      startDate.value = today
        .subtract(1, "year")
        .startOf("year")
        .format("YYYY-MM-DD");
      endDate.value = today
        .subtract(1, "year")
        .endOf("year")
        .format("YYYY-MM-DD");
      break;
  }
};

// Account-Filter-Optionen
const getAccountFilterLabel = (accountId: string) => {
  if (accountId === "all") return "Alle Konten";
  if (accountId === "grouped") return "Nach Typ gruppiert";

  const account = accountStore.getAccountById(accountId);
  return account ? account.name : "Unbekanntes Konto";
};
</script>

<template>
  <div>
    <!-- Header mit Zeitraumauswahl -->
    <div
      class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6"
    >
      <h2 class="text-xl font-bold">Statistiken</h2>

      <div class="flex flex-wrap gap-2">
        <div class="btn-group">
          <button
            class="btn btn-sm"
            :class="{
              'btn-active':
                startDate === dayjs().startOf('month').format('YYYY-MM-DD'),
            }"
            @click="setTimeRange('thisMonth')"
          >
            Dieser Monat
          </button>
          <button
            class="btn btn-sm"
            @click="setTimeRange('lastMonth')"
          >
            Letzter Monat
          </button>
          <button
            class="btn btn-sm"
            @click="setTimeRange('thisQuarter')"
          >
            Dieses Quartal
          </button>
          <button
            class="btn btn-sm"
            @click="setTimeRange('thisYear')"
          >
            Dieses Jahr
          </button>
          <button
            class="btn btn-sm"
            @click="setTimeRange('lastYear')"
          >
            Letztes Jahr
          </button>
        </div>

        <div class="flex gap-2">
          <input
            type="date"
            v-model="startDate"
            class="input input-bordered input-sm"
          />
          <span class="self-center">bis</span>
          <input
            type="date"
            v-model="endDate"
            class="input input-bordered input-sm"
          />
        </div>
      </div>
    </div>

    <!-- Zusammenfassung -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Einnahmen</h3>
          <p class="text-2xl font-bold text-success">
            {{ formatCurrency(summary.income) }}
          </p>
        </div>
      </div>

      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Ausgaben</h3>
          <p class="text-2xl font-bold text-error">
            {{ formatCurrency(summary.expense) }}
          </p>
        </div>
      </div>

      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Bilanz</h3>
          <p
            class="text-2xl font-bold"
            :class="summary.balance >= 0 ? 'text-success' : 'text-error'"
          >
            {{ formatCurrency(summary.balance) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Einnahmen vs. Ausgaben Chart -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Einnahmen vs. Ausgaben</h3>
          <div class="h-64">
            <IncomeExpenseChart
              :start-date="startDate"
              :end-date="endDate"
            />
          </div>
        </div>
      </div>

      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Ausgaben nach Kategorien</h3>
          <div class="h-64">
            <CategoryExpensesChart
              :start-date="startDate"
              :end-date="endDate"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Top-Kategorien Listen -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Top-Ausgabenkategorien</h3>

          <div
            v-if="topExpenseCategories.length > 0"
            class="space-y-3"
          >
            <div
              v-for="category in topExpenseCategories"
              :key="category.categoryId"
              class="space-y-1"
            >
              <div class="flex justify-between items-center">
                <span>{{ category.name }}</span>
                <span class="font-medium">{{
                  formatCurrency(category.amount)
                }}</span>
              </div>
              <progress
                class="progress progress-error w-full"
                :value="category.amount"
                :max="topExpenseCategories[0].amount"
              ></progress>
            </div>
          </div>

          <div
            v-else
            class="text-center py-4 text-base-content/70"
          >
            Keine Ausgaben in diesem Zeitraum
          </div>
        </div>
      </div>

      <div
        class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
      >
        <div class="card-body">
          <h3 class="card-title text-lg">Top-Einnahmenkategorien</h3>

          <div
            v-if="topIncomeCategories.length > 0"
            class="space-y-3"
          >
            <div
              v-for="category in topIncomeCategories"
              :key="category.categoryId"
              class="space-y-1"
            >
              <div class="flex justify-between items-center">
                <span>{{ category.name }}</span>
                <span class="font-medium">{{
                  formatCurrency(category.amount)
                }}</span>
              </div>
              <progress
                class="progress progress-success w-full"
                :value="category.amount"
                :max="topIncomeCategories[0].amount"
              ></progress>
            </div>
          </div>

          <div
            v-else
            class="text-center py-4 text-base-content/70"
          >
            Keine Einnahmen in diesem Zeitraum
          </div>
        </div>
      </div>
    </div>

    <!-- Monatlicher Trend -->
    <div
      class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150 mb-6"
    >
      <div class="card-body">
        <div class="flex justify-between items-center mb-4">
          <h3 class="card-title text-lg">Nettovermögensentwicklung</h3>
          <select
            v-model="trendMonths"
            class="select select-bordered select-sm"
          >
            <option value="all">Alle</option>
            <option :value="-3">3 Monate</option>
            <option :value="-6">6 Monate</option>
            <option :value="-12">12 Monate</option>
            <option :value="3">+ 3 Monate</option>
            <option :value="6">+ 6 Monate</option>
            <option :value="12">+ 12 Monate</option>
          </select>
        </div>

        <div class="h-64">
          <NetWorthChart :months="trendMonths" />
        </div>
      </div>
    </div>

    <!-- Kontoentwicklung -->
    <div
      class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
    >
      <div class="card-body">
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4"
        >
          <h3 class="card-title text-lg">Kontoentwicklung</h3>

          <div class="flex flex-wrap gap-2">
            <!-- Konto-Auswahl -->
            <select
              v-model="selectedAccountId"
              class="select select-bordered select-sm"
            >
              <option value="all">Alle Konten</option>
              <option value="grouped">Nach Typ gruppiert</option>
              <optgroup
                v-for="accountType in accounts.types"
                :key="accountType"
                :label="`${accountType} Konten`"
              >
                <option
                  v-for="account in accounts.all.filter(
                    (acc) => acc.accountType === accountType
                  )"
                  :key="account.id"
                  :value="account.id"
                >
                  {{ account.name }}
                </option>
              </optgroup>
            </select>

            <!-- Zeitraum-Auswahl -->
            <select
              v-model="accountTrendDays"
              class="select select-bordered select-sm"
            >
              <option :value="7">7 Tage</option>
              <option :value="30">30 Tage</option>
              <option :value="90">90 Tage</option>
              <option :value="180">180 Tage</option>
              <option :value="365">1 Jahr</option>
            </select>
          </div>
        </div>

        <div class="h-64">
          <AccountTrendChart
            :account-id="selectedAccountId"
            :days="accountTrendDays"
            :account-grouping="accountGrouping"
          />
        </div>
      </div>
    </div>
  </div>
</template>
