<!-- Datei: src/views/BudgetsView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useCategoryStore } from "../stores/categoryStore";
import { useTransactionStore } from "../stores/transactionStore";
import BudgetCategoryColumn from "../components/budget/BudgetCategoryColumn.vue";
import BudgetMonthCard from "../components/budget/BudgetMonthCard.vue";
import BudgetMonthHeaderCard from "../components/budget/BudgetMonthHeaderCard.vue";
import PagingYearComponent from "../components/ui/PagingYearComponent.vue";
import { toDateOnlyString } from "@/utils/formatters";
import { BalanceService } from "@/services/BalanceService";

const categoryStore = useCategoryStore();
const transactionStore = useTransactionStore();

const localStorageKey = "finwise_budget_months";
const numMonths = ref<number>(3);
const monthOffset = ref<number>(0);

onMounted(() => {
  const stored = localStorage.getItem(localStorageKey);
  if (stored) numMonths.value = parseInt(stored);
  recalcStores();
});

watch([numMonths, monthOffset], () => {
  localStorage.setItem(localStorageKey, numMonths.value.toString());
  recalcStores();
});

function recalcStores() {
  transactionStore.loadTransactions();
  categoryStore.loadCategories();
}

function onUpdateStartOffset(newOffset: number) {
  monthOffset.value = newOffset;
}

function onUpdateDisplayedMonths(newCount: number) {
  numMonths.value = newCount;
}

const months = computed(() => {
  const result = [];
  const now = new Date();
  const leftDate = new Date(
    now.getFullYear(),
    now.getMonth() + monthOffset.value,
    1
  );

  for (let i = 0; i < numMonths.value; i++) {
    const d = new Date(leftDate.getFullYear(), leftDate.getMonth() + i, 1);
    const normalizedStart = new Date(toDateOnlyString(d));
    const lastDay = new Date(
      normalizedStart.getFullYear(),
      normalizedStart.getMonth() + 1,
      0
    );
    const normalizedEnd = new Date(toDateOnlyString(lastDay));
    result.push({
      key: `${normalizedStart.getFullYear()}-${normalizedStart.getMonth() + 1}`,
      label: normalizedStart.toLocaleString("de-DE", {
        month: "long",
        year: "numeric",
      }),
      start: normalizedStart,
      end: normalizedEnd,
    });
  }
  return result;
});

const categories = computed(() => {
  return categoryStore.categories.filter((cat) => !cat.parentCategoryId);
});

const totalColumns = computed(() => months.value.length + 1);

// Nutzt den zentralen Expanded-State aus dem CategoryStore
const expanded = categoryStore.expandedCategories;

function toggleAll() {
  if (expanded.value.size > 0) {
    categoryStore.collapseAllCategories();
  } else {
    categoryStore.expandAllCategories();
  }
}

const availableByMonth = computed(() => {
  return months.value.map((month) => {
    const availableCat = categoryStore.categories.find(
      (cat) => cat.name === "Verfügbare Mittel"
    );

    if (!availableCat) return 0;

    // Verwende den BalanceService für die Saldoabfrage
    return BalanceService.getTodayBalance(
      "category",
      availableCat.id,
      month.end
    );
  });
});
</script>

<template>
  <div class="h-[calc(100vh-189px)] flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="flex-shrink-0">
      <div class="p-4 flex flex-col">
        <div
          :class="'grid grid-cols-' + totalColumns"
          class="mb-4 items-center"
        >
          <h1 class="text-2xl font-bold col-span-1">Budgetübersicht</h1>
          <div class="col-span-1 flex items-end"></div>
          <div class="col-span-[calc(var(--cols)-2)] flex justify-center">
            <PagingYearComponent
              :displayedMonths="numMonths"
              :currentStartMonthOffset="monthOffset"
              @updateStartOffset="onUpdateStartOffset"
              @updateDisplayedMonths="onUpdateDisplayedMonths"
            />
          </div>
        </div>
      </div>
      <!-- Tabellenkopf -->
      <div class="flex overflow-y-scroll">
        <div
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col justify-end"
        >
          <!-- Toggle-Control bereits im Header integriert -->
          <div
            class="text-sm flex items-center cursor-pointer"
            @click="toggleAll"
          >
            <Icon
              :icon="expanded.size > 0 ? 'mdi:chevron-up' : 'mdi:chevron-down'"
              class="text-md mr-1"
            />
            <span>{{
              expanded.size > 0 ? "alle einklappen" : "alle ausklappen"
            }}</span>
          </div>
        </div>
        <div
          v-for="(month, i) in months"
          :key="month.key"
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col"
        >
          <BudgetMonthHeaderCard
            :label="month.label"
            :toBudget="200"
            :budgeted="0"
            :overspent="0"
            :available="availableByMonth[i]"
            :nextMonth="0"
            :month="month"
          />
        </div>
      </div>
    </div>
    <!-- Scrollbarer Datenbereich -->
    <div class="flex-grow overflow-y-scroll">
      <div class="flex">
        <!-- Kategorie-Spalte -->
        <div
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col"
        >
          <BudgetCategoryColumn />
        </div>
        <!-- Monats-Spalten -->
        <div
          v-for="month in months"
          :key="month.key"
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col"
        >
          <BudgetMonthCard :month="month" :categories="categories" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
