<script setup lang="ts">
import { ref, computed } from "vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { TransactionService } from "@/services/TransactionService";
import { formatCurrency } from "@/utils/formatters";
import type { Transaction } from "../../../types/index";

// Props
const props = withDefaults(defineProps<{
  startDate: string;
  endDate: string;
  topCount?: number;
  showHeader?: boolean;
}>(), {
  topCount: 10,
  showHeader: true
});

// Stores
const categoryStore = useCategoryStore();

// Interne State für eigenständige Komponente
const selectedTopCount = ref(props.topCount);

// Top-Count-Optionen
const topCountOptions = [5, 10, 20];

// Top-Einnahmenkategorien berechnen
const topIncomeCategories = computed(() => {
  const transactions = TransactionService.getAllTransactions();
  const start = new Date(props.startDate);
  const end = new Date(props.endDate);

  // Gruppiere Einnahmen nach Kategorien
  const categoryIncome: Record<
    string,
    { name: string; amount: number; categoryId: string }
  > = {};

  transactions.forEach((tx: Transaction) => {
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
    .slice(0, selectedTopCount.value);
});

// Setze Top-Count
const setTopCount = (count: number) => {
  selectedTopCount.value = count;
};
</script>

<template>
  <div
    class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
  >
    <div class="card-body">
      <!-- Header mit Buttons -->
      <div
        v-if="showHeader"
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4"
      >
        <h3 class="card-title text-lg">Top-Einnahmenkategorien</h3>

        <!-- Top-Count Buttons -->
        <div class="btn-group">
          <button
            v-for="count in topCountOptions"
            :key="count"
            class="btn btn-sm"
            :class="{
              'btn-primary': selectedTopCount === count,
            }"
            @click="setTopCount(count)"
          >
            Top-{{ count }}
          </button>
        </div>
      </div>

      <!-- Titel ohne Header -->
      <h3
        v-else
        class="card-title text-lg mb-4"
      >
        Top-{{ selectedTopCount }} Einnahmenkategorien
      </h3>

      <!-- Kategorien-Liste -->
      <div
        v-if="topIncomeCategories.length > 0"
        class="space-y-3"
      >
        <div
          v-for="(category, index) in topIncomeCategories"
          :key="category.categoryId"
          class="space-y-1"
        >
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-base-content/70">
                {{ index + 1 }}.
              </span>
              <span>{{ category.name }}</span>
            </div>
            <span class="font-medium">{{
              formatCurrency(category.amount)
            }}</span>
          </div>
          <progress
            class="progress progress-success w-full"
            :value="category.amount"
            :max="topIncomeCategories[0]?.amount || 1"
          ></progress>
        </div>
      </div>

      <!-- Keine Daten -->
      <div
        v-else
        class="text-center py-8 text-base-content/70"
      >
        <div class="text-4xl mb-2">💰</div>
        <div class="text-lg font-medium mb-1">Keine Einnahmen</div>
        <div class="text-sm">Keine Einnahmen in diesem Zeitraum gefunden</div>
      </div>
    </div>
  </div>
</template>
