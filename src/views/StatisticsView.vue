<script setup lang="ts">
import { ref, watch } from "vue";
import dayjs from "dayjs";
import KpiIncomeCard from "../components/ui/kpi/KpiIncomeCard.vue";
import KpiExpenseCard from "../components/ui/kpi/KpiExpenseCard.vue";
import KpiBalanceCard from "../components/ui/kpi/KpiBalanceCard.vue";
import KpiNetWorthCard from "../components/ui/kpi/KpiNetWorthCard.vue";

// Chart-Komponenten
import FinancialTrendChart from "../components/ui/charts/FinancialTrendChart.vue";
import CategoryExpensesChart from "../components/ui/charts/CategoryExpensesChart.vue";
import NetWorthChart from "../components/ui/charts/NetWorthChart.vue";
import AccountTrendChart from "../components/ui/charts/AccountTrendChart.vue";
import TopExpenseCategoriesChart from "../components/ui/charts/TopExpenseCategoriesChart.vue";
import TopIncomeCategoriesChart from "../components/ui/charts/TopIncomeCategoriesChart.vue";
import DateRangePicker from "../components/ui/DateRangePicker.vue";


// Zeitraum für die Statistiken
const startDate = ref(dayjs().startOf("month").format("YYYY-MM-DD"));
const endDate = ref(dayjs().endOf("month").format("YYYY-MM-DD"));

// Filter-Optionen
const trendMonths = ref(3);

// Gemeinsamer Range-State für den DateRangePicker (hält Picker-UI synchron)
const dateRange = ref<{ start: string; end: string }>({
  start: startDate.value,
  end: endDate.value,
});

// Wenn der Picker geändert wird, auf startDate/endDate spiegeln
watch(dateRange, (range: { start: string; end: string }) => {
  if (!range?.start || !range?.end) return;
  startDate.value = range.start;
  endDate.value = range.end;
});

// KPI Cards berechnen intern ihre Werte basierend auf startDate/endDate

// Zeitraum ändern (Buttons steuern weiterhin und synchronisieren den Picker)
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
      startDate.value = dayjs(today)
        .month(Math.floor(today.month() / 3) * 3)
        .startOf("month")
        .format("YYYY-MM-DD");
      endDate.value = dayjs(today)
        .month(Math.floor(today.month() / 3) * 3 + 2)
        .endOf("month")
        .format("YYYY-MM-DD");
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

  // Picker-Range mit Buttons synchronisieren
  dateRange.value = { start: startDate.value, end: endDate.value };
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
          <DateRangePicker v-model="dateRange" />
        </div>
      </div>
    </div>

    <!-- Zusammenfassung -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <KpiIncomeCard :start-date="startDate" :end-date="endDate" />
      <KpiExpenseCard :start-date="startDate" :end-date="endDate" />
      <KpiBalanceCard :start-date="startDate" :end-date="endDate" />
      <KpiNetWorthCard :start-date="startDate" :end-date="endDate" />
    </div>

    <!-- Einnahmen vs. Ausgaben Chart -->
    <div class="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6 h-80">
      <FinancialTrendChart :show-header="true" />

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
