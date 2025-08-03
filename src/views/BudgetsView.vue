<!-- Datei: src/views/BudgetsView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useCategoryStore } from "../stores/categoryStore";
import { useTransactionStore } from "../stores/transactionStore";
import BudgetMonthHeaderCard from "../components/budget/BudgetMonthHeaderCard.vue";
import BudgetCategoriesAndValues from "../components/budget/BudgetCategoriesAndValues.vue";
import PagingYearComponent from "../components/ui/PagingYearComponent.vue";
import { Icon } from "@iconify/vue";
import { toDateOnlyString } from "../utils/formatters";
import { BalanceService } from "../services/BalanceService";

const categoryStore = useCategoryStore();
const transactionStore = useTransactionStore();

// Computed für den Expand/Collapse-Zustand aller Kategoriengruppen
const allGroupsExpanded = computed(() => {
  const allGroupIds = categoryStore.categoryGroups.map(g => g.id);
  return allGroupIds.length > 0 && allGroupIds.every(id => categoryStore.expandedCategoryGroups.has(id));
});

// Funktion zum Ein-/Ausklappen aller Kategoriengruppen
function toggleAllCategoryGroups() {
  if (allGroupsExpanded.value) {
    categoryStore.collapseAllCategoryGroups();
  } else {
    categoryStore.expandAllCategoryGroups();
  }
}

const localStorageKey = "finwise_budget_months";
const numMonths = ref<number>(3);
const monthOffset = ref<number>(0);
const isLoading = ref<boolean>(true);

onMounted(async () => {
  const stored = localStorage.getItem(localStorageKey);
  if (stored) numMonths.value = parseInt(stored);
  await recalcStores();
});

watch([numMonths, monthOffset], async () => {
  localStorage.setItem(localStorageKey, numMonths.value.toString());
  isLoading.value = true;
  await recalcStores();
});

async function recalcStores() {
  try {
    isLoading.value = true;

    // Stores laden - categoryStore wird bereits in BudgetCategoriesAndValues geladen
    await transactionStore.loadTransactions();

    // Kurz warten, damit die computed properties und Mock-Daten berechnet werden
    await nextTick();

    // Loading wird jetzt über muuriReady Event gesteuert
    // isLoading.value = false; // ← Entfernt, wird über onMuuriReady gesetzt
  } catch (error) {
    console.error('Error loading budget data:', error);
    isLoading.value = false;
  }
}

function onUpdateStartOffset(newOffset: number) {
  monthOffset.value = newOffset;
}

function onUpdateDisplayedMonths(newCount: number) {
  numMonths.value = newCount;
}

// Event-Handler für Muuri-Initialisierung
function onMuuriReady() {
  // Loading erst beenden, wenn Muuri-Grids vollständig initialisiert sind
  isLoading.value = false;
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
  <div class="h-[calc(100vh-189px)] flex flex-col overflow-hidden relative">
    <!-- Loading Overlay - wird über den Inhalt gelegt -->
    <div v-if="isLoading" class="absolute inset-0 z-50 flex items-center justify-center bg-base-100" style="will-change: transform;">
      <div class="flex flex-col items-center space-y-4">
        <!-- Loading Spinner mit Hardware-Beschleunigung -->
        <div class="loading loading-spinner loading-lg text-primary" style="will-change: transform; transform: translateZ(0);"></div>

        <!-- Loading Text -->
        <div class="text-center">
          <h3 class="text-lg font-semibold text-base-content mb-2">Budget wird geladen...</h3>
          <p class="text-sm text-base-content/60">Kategorien und Daten werden berechnet</p>
        </div>

        <!-- Optional: Progress Skeleton -->
        <div class="w-80 space-y-2">
          <div class="skeleton h-4 w-full"></div>
          <div class="skeleton h-4 w-3/4"></div>
          <div class="skeleton h-4 w-1/2"></div>
        </div>
      </div>
    </div>

    <!-- Main Content - wird immer gerendert, aber vom Loading-Overlay überdeckt -->
      <!-- Header - Sticky positioniert -->
      <div class="flex-shrink-0 sticky top-0 z-20 bg-base-100 border-b border-base-300">
        <div class="p-4 flex flex-col">
          <!-- Feste Header-Row mit drei Bereichen -->
          <div class="mb-4 flex items-center justify-between w-full">
            <!-- Links: Überschrift -->
            <div class="flex-shrink-0">
              <h1 class="text-2xl font-bold">Budget Verteilung</h1>
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
          <!-- Kategorien-Header (sticky) -->
          <div class="flex-shrink-0 w-[300px] flex flex-col justify-end">
            <div class="text-sm flex items-center cursor-pointer p-2" @click="toggleAllCategoryGroups">
              <Icon
                :icon="allGroupsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                class="text-md mr-1"
              />
              <span>{{ allGroupsExpanded ? "alle einklappen" : "alle ausklappen" }}</span>
            </div>
          </div>
          <!-- Monats-Header (scrollbar) -->
          <div class="flex flex-1 min-w-0 mr-3">
            <div
              v-for="(month, i) in months"
              :key="month.key"
              class="flex-1 min-w-[120px] flex flex-col "
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
      </div>
      <!-- Scrollbarer Datenbereich -->
      <div class="flex-grow overflow-auto">
        <div class="w-full">
          <!-- Erweiterte Kategorie-Spalte mit integrierten Werten -->
          <BudgetCategoriesAndValues :months="months" @muuriReady="onMuuriReady" />
        </div>
      </div>
  </div>
</template>

<style scoped></style>
