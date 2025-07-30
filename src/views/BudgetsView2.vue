<!-- Datei: src/views/BudgetsView2.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useCategoryStore } from "../stores/categoryStore";
import { useTransactionStore } from "../stores/transactionStore";
import BudgetMonthHeaderCard from "../components/budget/BudgetMonthHeaderCard.vue";
import BudgetCategoryColumn3 from "../components/budget/BudgetCategoryColumn3.vue";
import PagingYearComponent from "../components/ui/PagingYearComponent.vue";
import { Icon } from "@iconify/vue";
import { toDateOnlyString } from "../utils/formatters";
import { BalanceService } from "../services/BalanceService";

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
    <!-- Header - Sticky positioniert -->
    <div class="flex-shrink-0 sticky top-0 z-20 bg-base-100 border-b border-base-300">
      <div class="p-4 flex flex-col">
        <!-- Feste Header-Row mit drei Bereichen -->
        <div class="mb-4 flex items-center justify-between w-full">
          <!-- Links: Überschrift -->
          <div class="flex-shrink-0">
            <h1 class="text-2xl font-bold">Budgets 2 (mit Kategoriegruppen)</h1>
          </div>

          <!-- Mitte: Kalenderansicht -->
          <div class="flex-grow flex justify-center">
            <PagingYearComponent
              :displayedMonths="numMonths"
              :currentStartMonthOffset="monthOffset"
              @updateStartOffset="onUpdateStartOffset"
              @updateDisplayedMonths="onUpdateDisplayedMonths"
            />
          </div>

          <!-- Rechts: Platzhalter für zukünftige Elemente -->
          <div class="flex-shrink-0">
            <!-- Hier können später weitere Elemente hinzugefügt werden -->
          </div>
        </div>
      </div>
      <!-- Tabellenkopf -->
      <div class="flex overflow-x-auto">
        <div
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col justify-end"
        >
          <!-- Platzhalter für zukünftige Header-Elemente -->
          <div class="text-sm text-base-content/60">
            Kategorien
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
    <div class="flex-grow overflow-auto">
      <div class="flex min-w-full">
        <!-- Kategorie-Spalte mit BudgetCategoryColumn2 -->
        <div
          :style="{
            flex: '0 0 calc(100% / ' + totalColumns + ')',
            minWidth: 'calc(100% / ' + totalColumns + ')'
          }"
          class="flex flex-col sticky left-0 z-10 bg-base-100 border-r border-base-300"
        >
          <BudgetCategoryColumn3 />
        </div>
        <!-- Monats-Spalten (entfernt für Fokus auf Header und Kategorie) -->
      </div>
    </div>
  </div>
</template>

<style scoped></style>
