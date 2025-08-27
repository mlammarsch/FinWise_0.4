<script setup lang="ts">
import { ref, computed } from "vue";
import { BalanceService } from "@/services/BalanceService";
import { TransactionService } from "@/services/TransactionService";
import { formatCurrency } from "@/utils/formatters";
import dayjs from "dayjs";

// Chart-Komponenten
import ExpenseIncomeSummaryChart from "@/components/ui/charts/ExpenseIncomeSummaryChart.vue";
import CategoryExpensesChart from "@/components/ui/charts/CategoryExpensesChart.vue";
import NetWorthChart from "@/components/ui/charts/NetWorthChart.vue";
import AccountTrendChart from "@/components/ui/charts/AccountTrendChart.vue";
import TopExpenseCategoriesChart from "@/components/ui/charts/TopExpenseCategoriesChart.vue";
import TopIncomeCategoriesChart from "@/components/ui/charts/TopIncomeCategoriesChart.vue";


// Zeitraum für die Statistiken
const startDate = ref(dayjs().startOf("month").format("YYYY-MM-DD"));
const endDate = ref(dayjs().endOf("month").format("YYYY-MM-DD"));

// Filter-Optionen
const trendMonths = ref(3);

// Zusammenfassung für den ausgewählten Zeitraum
const summary = computed(() => {
  // Cache für aktuellen Monat invalidieren, um aktuelle Daten zu gewährleisten
  BalanceService.invalidateCurrentMonthCache();

  return TransactionService.getIncomeExpenseSummary(
    startDate.value,
    endDate.value
  );
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
      <ExpenseIncomeSummaryChart
        :start-date="startDate"
        :end-date="endDate"
        :show-header="true"
      />

      <CategoryExpensesChart
        :start-date="startDate"
        :end-date="endDate"
        :show-header="true"
      />
    </div>

    <!-- Top-Kategorien Listen -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <TopExpenseCategoriesChart
        :start-date="startDate"
        :end-date="endDate"
        :show-header="true"
      />

      <TopIncomeCategoriesChart
        :start-date="startDate"
        :end-date="endDate"
        :show-header="true"
      />
    </div>

    <!-- Monatlicher Trend -->
    <NetWorthChart :months="trendMonths" />

    <!-- Kontoentwicklung -->
    <AccountTrendChart :show-header="true" />
  </div>
</template>
