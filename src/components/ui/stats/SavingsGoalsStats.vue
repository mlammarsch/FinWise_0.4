<script setup lang="ts">
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useCategoryStore } from "../../../stores/categoryStore";
import { BalanceService } from "../../../services/BalanceService";
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

const categoryStore = useCategoryStore();

const savingsGoalsLimit = ref(5);
function setSavingsGoalsLimit(limit: number) {
  savingsGoalsLimit.value = limit;
}

type GoalRow = {
  categoryId: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  progress: number;
  goalDate?: string;
  shouldHaveSaved: number;
  barColor: string;
};

const savingsGoalsWithProgress = computed<GoalRow[]>(() => {
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
      const currentAmount = Math.abs(
        BalanceService.getTodayBalance("category", category.id)
      );
      const targetAmount = category.targetAmount || 0;
      const progress =
        targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;

      let shouldHaveSaved = 0;
      let barColor = "bg-warning";

      if (category.goalDate) {
        const goalDate = dayjs(category.goalDate);
        const startDate = today.startOf("month");

        const totalMonths = goalDate.diff(startDate, "month", true);

        if (totalMonths > 0) {
          const monthlyRate = targetAmount / totalMonths;
          const elapsedMonths = today.diff(startDate, "month", true);
          shouldHaveSaved = monthlyRate * elapsedMonths;

          const tolerance = monthlyRate * 0.05;

          if (currentAmount >= shouldHaveSaved + tolerance) {
            barColor = "bg-success";
          } else if (currentAmount >= shouldHaveSaved - tolerance) {
            barColor = "bg-warning";
          } else {
            barColor = "bg-error";
          }
        }
      }

      return {
        categoryId: category.id,
        name: category.name,
        currentAmount,
        targetAmount,
        progress: Math.min(progress, 100),
        goalDate: category.goalDate,
        shouldHaveSaved,
        barColor,
      };
    })
    .sort((a, b) => b.progress - a.progress)
    .slice(0, savingsGoalsLimit.value);

  return goalsData;
});
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
            Sparziele
          </h3>
          <p class="text-sm opacity-60">Fortschritt der Sparziele</p>
        </div>
        <div
          v-if="showActions"
          class="flex gap-2 items-center"
        >
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

      <div
        v-if="savingsGoalsWithProgress.length > 0"
        class="space-y-2"
      >
        <div
          v-for="goal in savingsGoalsWithProgress"
          :key="goal.categoryId"
          class="relative"
        >
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
            <span
              v-if="goal.goalDate"
              class="text-xs opacity-60 ml-2"
            >
              bis {{ new Date(goal.goalDate).toLocaleDateString("de-DE") }}
            </span>
          </div>

          <div class="relative">
            <div
              class="w-full bg-base-300 rounded-full h-1.5 relative overflow-hidden"
            >
              <div
                :class="[
                  'h-full rounded-full transition-all duration-300',
                  goal.barColor,
                ]"
                :style="{ width: goal.progress + '%' }"
              ></div>
            </div>

            <div
              class="absolute -top-1 transform -translate-x-1/2 -translate-y-full"
              :style="{ left: goal.progress + '%' }"
            >
              <div class="flex flex-col items-center">
                <div
                  class="text-xs font-medium mb-0 bg-base-300 px-1 border border-neutral rounded"
                >
                  <CurrencyDisplay
                    :amount="goal.currentAmount"
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
            <span> {{ Math.round(goal.progress) }}% vom Ziel angespart </span>
            <span
              v-if="goal.progress >= 100"
              class="text-success"
            >
              Ziel erreicht!
            </span>
            <span
              v-else
              class="text-info"
            >
              Noch
              <CurrencyDisplay
                :amount="goal.targetAmount - goal.currentAmount"
                :asInteger="true"
              />
              benötigt
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
</template>

<style lang="postcss" scoped></style>
