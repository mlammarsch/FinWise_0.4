<script setup lang="ts">
import { ref } from "vue";
import dayjs from "dayjs";
import ExpenseIncomeSummaryChart from "../components/ui/charts/ExpenseIncomeSummaryChart.vue";
import MonthlyTrendStats from "../components/ui/stats/MonthlyTrendStats.vue";
import AccountBalanceStats from "../components/ui/stats/AccountBalanceStats.vue";
import PlanningPaymentsGadget from "../components/ui/gadgets/PlanningPaymentsGadget.vue";
import TopBudgetsStats from "../components/ui/stats/TopBudgetsStats.vue";
import SavingsGoalsStats from "../components/ui/stats/SavingsGoalsStats.vue";
import RecentTransactions from "../components/ui/transactions/RecentTransactions.vue";

const currentDate = dayjs();
const startDate = ref(currentDate.subtract(30, "day").format("YYYY-MM-DD"));
const endDate = ref(currentDate.format("YYYY-MM-DD"));
</script>

<template>
  <div class="flex-col">
    <!-- Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <AccountBalanceStats
        :show-header="true"
        :show-actions="true"
      />
      <PlanningPaymentsGadget
        :show-header="true"
        :show-actions="true"
      />
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
        <MonthlyTrendStats :months="3" />
      </div>

      <div class="space-y-6">
        <TopBudgetsStats
          :show-header="true"
          :show-actions="true"
        />
        <SavingsGoalsStats
          :show-header="true"
          :show-actions="true"
        />
      </div>
    </div>
  </div>
</template>
