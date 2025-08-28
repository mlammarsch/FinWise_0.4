<script setup lang="ts">
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { useCategoryStore } from "../../../stores/categoryStore";
import { BudgetService } from "../../../services/BudgetService";
import CurrencyDisplay from "../CurrencyDisplay.vue";

const props = withDefaults(
  defineProps<{
    showHeader?: boolean;
    showActions?: boolean;
  }>(),
  {
    showHeader: true,
    showActions: true,
  }
);

const router = useRouter();
const categoryStore = useCategoryStore();

const expensesLimit = ref(5);
function setExpensesLimit(limit: number) {
  expensesLimit.value = limit;
}

const currentMonthStart = dayjs().startOf("month");
const currentMonthEnd = dayjs().endOf("month");

const topExpensesWithBudget = computed(() => {
  const monthStart = currentMonthStart.toDate();
  const monthEnd = currentMonthEnd.toDate();

  const expenseCategories = categoryStore.categories.filter(
    (cat) =>
      cat.isActive &&
      !cat.isIncomeCategory &&
      !cat.isSavingsGoal &&
      cat.name !== "Verfügbare Mittel" &&
      !cat.parentCategoryId
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
        spent,
        budgeted,
        available: budgetData.saldo,
        budgetPercentage,
        budgetData,
      };
    })
    .filter((item) => item.budgeted > 0 && item.spent > 0)
    .sort((a, b) => b.budgetPercentage - a.budgetPercentage);

  return categoryData;
});

function navigateToBudgets() {
  router.push("/budgets");
}

function getExpenseBarColor(spent: number, budgeted: number): string {
  if (budgeted === 0) return "bg-base-content opacity-60";
  const percentage = (spent / budgeted) * 100;
  if (percentage <= 90) return "bg-success";
  if (percentage <= 100) return "bg-warning";
  return "bg-error";
}

function getExpenseBarWidth(spent: number, budgeted: number): number {
  if (budgeted === 0) return 100;
  if (spent <= budgeted) return (spent / budgeted) * 100;
  return 100;
}

function getBudgetMarkerPosition(spent: number, budgeted: number): number {
  if (budgeted === 0) return 0;
  if (spent <= budgeted) return 100;
  return (budgeted / spent) * 100;
}
</script>

<template>
  <div
    class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
  >
    <div class="card-body">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h3
            v-if="showHeader"
            class="card-title text-lg"
          >
            Top Budgets
          </h3>
          <p class="text-sm opacity-60">Aktueller Monat (MTD)</p>
        </div>
        <div
          v-if="showActions"
          class="flex gap-2 items-center"
        >
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

      <div
        v-if="topExpensesWithBudget.slice(0, expensesLimit).length > 0"
        class="space-y-2"
      >
        <div
          v-for="expense in topExpensesWithBudget.slice(0, expensesLimit)"
          :key="expense.categoryId"
          class="relative"
        >
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

          <div class="relative">
            <div
              class="w-full bg-base-300 rounded-full h-1.5 relative overflow-hidden"
            >
              <div
                :class="[
                  'h-full rounded-full transition-all duration-300',
                  getExpenseBarColor(expense.spent, expense.budgeted),
                ]"
                :style="{
                  width:
                    getExpenseBarWidth(expense.spent, expense.budgeted) + '%',
                }"
              ></div>
            </div>

            <div
              v-if="expense.budgeted > 0"
              class="absolute -top-1 transform -translate-x-1/2 -translate-y-full"
              :style="{
                left:
                  getBudgetMarkerPosition(expense.spent, expense.budgeted) +
                  '%',
              }"
            >
              <div class="flex flex-col items-center">
                <div
                  class="text-xs font-medium mb-0 bg-base-300 px-1 border border-neutral rounded"
                >
                  <CurrencyDisplay
                    :amount="expense.budgeted"
                    :asInteger="true"
                  />
                </div>
                <div
                  class="w-0 h-0 border-l-2 border-r-2 border-t-4 border-l-transparent border-r-transparent border-t-base-content opacity-70"
                ></div>
              </div>
            </div>
          </div>

          <div class="flex justify-between text-xs opacity-60 mt-1">
            <span>
              {{
                expense.budgeted > 0
                  ? Math.round((expense.spent / expense.budgeted) * 100)
                  : 0
              }}%
              {{ expense.budgeted > 0 ? "vom Budget" : "ausgegeben" }}
            </span>
            <span
              v-if="expense.budgeted > 0 && expense.spent > expense.budgeted"
              class="text-error"
            >
              +<CurrencyDisplay
                :amount="expense.spent - expense.budgeted"
                :asInteger="true"
              />
              über Budget
            </span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="text-center py-4"
      >
        <p class="text-sm italic opacity-60">
          Keine Ausgaben im aktuellen Monat
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped></style>
