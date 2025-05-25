<!-- src/components/planning/CategoryForecastChart.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/planning/CategoryForecastChart.vue
 * Zeigt eine Prognose der Kategoriesalden für die kommenden Monate an.
 *
 * Komponenten-Props:
 * - startDate: string - Startdatum für die Prognose (YYYY-MM-DD)
 *
 * Emits:
 * - Keine Emits vorhanden
 */
import { ref, computed, onMounted, watch } from "vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { usePlanningStore } from "@/stores/planningStore";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import { formatDate } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { BalanceService } from "@/services/BalanceService";

const props = defineProps<{
  startDate: string;
}>();

// Stores
const categoryStore = useCategoryStore();
const planningStore = usePlanningStore();

// Typ für die Kategorie-Prognosedaten
interface CategoryForecast {
  categoryId: string;
  categoryName: string;
  isIncomeCategory: boolean;
  monthlyForecasts: {
    month: string;
    balance: number;
    projectedBalance: number;
    transactions: Array<{
      date: string;
      description: string;
      amount: number;
    }>;
  }[];
}

// Chart-Konfiguration
const forecastMonths = 6; // Anzahl der Prognosemonate
const chartHeight = 300; // Höhe des Charts in Pixeln

// Daten für die Prognose
const expenseForecastData = ref<CategoryForecast[]>([]);
const incomeForecastData = ref<CategoryForecast[]>([]);

// Aktive Kategorie für detaillierte Ansicht
const activeCategoryId = ref<string | null>(null);

// Anzeigemodus: 'expenses' oder 'income'
const displayMode = ref<"expenses" | "income">("expenses");

// Berechne das höchste und niedrigste Saldo für die Y-Achsen-Skalierung
const expenseBalanceRange = computed(() => {
  let min = 0;
  let max = 0;
  expenseForecastData.value.forEach((category) => {
    category.monthlyForecasts.forEach((forecast) => {
      min = Math.min(min, forecast.projectedBalance);
      max = Math.max(max, forecast.projectedBalance);
    });
  });
  min = Math.floor(min * 1.1);
  max = Math.ceil(max * 1.1);
  return { min, max, range: max - min };
});

const incomeBalanceRange = computed(() => {
  let min = 0;
  let max = 0;
  incomeForecastData.value.forEach((category) => {
    category.monthlyForecasts.forEach((forecast) => {
      min = Math.min(min, forecast.projectedBalance);
      max = Math.max(max, forecast.projectedBalance);
    });
  });
  min = Math.floor(min * 1.1);
  max = Math.ceil(max * 1.1);
  return { min, max, range: max - min };
});

// Aktiver Balancebereich basierend auf dem Anzeigemodus
const activeBalanceRange = computed(() => {
  return displayMode.value === "expenses"
    ? expenseBalanceRange.value
    : incomeBalanceRange.value;
});

// Aktive Forecastdaten basierend auf dem Anzeigemodus
const activeForecastData = computed(() => {
  return displayMode.value === "expenses"
    ? expenseForecastData.value
    : incomeForecastData.value;
});

// Berechnet die Y-Position für einen Saldo im Chart
function getYPosition(balance: number): number {
  if (activeBalanceRange.value.range === 0) return chartHeight / 2;
  const percentage =
    (balance - activeBalanceRange.value.min) / activeBalanceRange.value.range;
  return chartHeight - percentage * chartHeight;
}

// Funktionen zum Konvertieren von Monatsindex zu Datum und zurück
function getMonthLabel(index: number): string {
  const date = new Date(props.startDate);
  date.setMonth(date.getMonth() + index);
  return date.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

// Generiert Prognosedaten für die Kategorien
function generateForecastData() {
  const startDate = new Date(props.startDate);
  const expenseData: CategoryForecast[] = [];
  const incomeData: CategoryForecast[] = [];

  // Nur Root-Kategorien für die Übersicht
  const rootCategories = categoryStore.categories.filter(
    (c) => c.isActive && !c.parentCategoryId && c.name !== "Verfügbare Mittel"
  );

  // Generiere Daten für jede Kategorie
  rootCategories.forEach((category) => {
    const categoryData: CategoryForecast = {
      categoryId: category.id,
      categoryName: category.name,
      isIncomeCategory: category.isIncomeCategory,
      monthlyForecasts: [],
    };

    // Erstelle Prognose für jeden Monat
    for (let i = 0; i < forecastMonths; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);

      // Letzter Tag des Monats
      const lastDay = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth() + 1,
        0
      );

      // Aktueller und prognostizierter Kategoriesaldo
      const balance = BalanceService.getTodayBalance(
        "category",
        category.id,
        lastDay
      );
      const projectedBalance = BalanceService.getProjectedBalance(
        "category",
        category.id,
        lastDay
      );

      // Hole alle geplanten Transaktionen für diesen Monat in dieser Kategorie
      const monthStart = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth(),
        1
      );
      const transactions = planningStore
        .getUpcomingTransactions(35)
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return (
            txDate >= monthStart &&
            txDate <= lastDay &&
            tx.transaction.categoryId === category.id
          );
        })
        .map((tx) => ({
          date: tx.date,
          description: tx.transaction.name || "Geplante Transaktion",
          amount: tx.transaction.amount,
        }));

      categoryData.monthlyForecasts.push({
        month: forecastDate.toLocaleDateString("de-DE", {
          month: "short",
          year: "numeric",
        }),
        balance,
        projectedBalance,
        transactions,
      });
    }

    // Sortiere in Ausgaben und Einnahmen
    if (category.isIncomeCategory) {
      incomeData.push(categoryData);
    } else {
      expenseData.push(categoryData);
    }
  });

  expenseForecastData.value = expenseData;
  incomeForecastData.value = incomeData;

  debugLog("[CategoryForecastChart] generateForecastData", {
    expenses: expenseData.length,
    incomes: incomeData.length,
    startDate: props.startDate,
  });
}

// Formatiert einen Betrag für die Anzeige
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Zeige detaillierte Ansicht für eine Kategorie
function showCategoryDetails(categoryId: string) {
  activeCategoryId.value =
    activeCategoryId.value === categoryId ? null : categoryId;
}

// Wechselt zwischen Ausgaben- und Einnahmenansicht
function toggleDisplayMode() {
  displayMode.value = displayMode.value === "expenses" ? "income" : "expenses";
  activeCategoryId.value = null; // Zurücksetzen der aktiven Kategorie
}

// Aktualisiere die Daten, wenn sich die Props ändern
watch(
  () => props.startDate,
  () => {
    generateForecastData();
  }
);

// Initialisierung
onMounted(() => {
  generateForecastData();
});
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h3 class="text-xl font-bold">Kategorienprognose</h3>
      <!-- Umschalter zwischen Ausgaben und Einnahmen -->
      <div class="tabs tabs-boxed">
        <a
          class="tab"
          :class="{ 'tab-active': displayMode === 'expenses' }"
          @click="displayMode = 'expenses'"
        >
          <Icon icon="mdi:cash-minus" class="mr-2" />
          Ausgaben
        </a>
        <a
          class="tab"
          :class="{ 'tab-active': displayMode === 'income' }"
          @click="displayMode = 'income'"
        >
          <Icon icon="mdi:cash-plus" class="mr-2" />
          Einnahmen
        </a>
      </div>
    </div>

    <!-- Kategorieübersicht und Legende -->
    <div class="flex flex-wrap gap-4">
      <div
        v-for="category in activeForecastData"
        :key="category.categoryId"
        class="badge badge-lg cursor-pointer"
        :class="
          activeCategoryId === category.categoryId
            ? 'badge-accent'
            : 'badge-outline'
        "
        @click="showCategoryDetails(category.categoryId)"
      >
        {{ category.categoryName }}
      </div>
    </div>

    <!-- Keine Daten Hinweis -->
    <div v-if="activeForecastData.length === 0" class="text-center py-10">
      <Icon
        icon="mdi:alert-circle-outline"
        class="text-4xl text-warning mb-2"
      />
      <p>
        Keine
        {{ displayMode === "expenses" ? "Ausgaben" : "Einnahmen" }}kategorien
        verfügbar.
      </p>
    </div>

    <!-- Prognose-Visualisierung -->
    <div v-else class="overflow-x-auto">
      <div class="min-w-[800px]">
        <!-- Chart-Bereich -->
        <div
          class="relative"
          :style="`height: ${chartHeight}px; margin-bottom: 30px;`"
        >
          <!-- Y-Achse Beschriftungen -->
          <div
            class="absolute inset-y-0 left-0 w-20 flex flex-col justify-between"
          >
            <div class="text-xs text-right pr-2">
              {{ formatAmount(activeBalanceRange.max) }}
            </div>
            <div class="text-xs text-right pr-2">
              {{ formatAmount(activeBalanceRange.min) }}
            </div>
          </div>

          <!-- Horizontale Hilfslinien -->
          <div class="absolute inset-x-0 inset-y-0 left-20" style="z-index: 1">
            <div
              v-for="i in 5"
              :key="i"
              class="absolute w-full border-t border-base-300"
              :style="`top: ${((i - 1) * chartHeight) / 4}px;`"
            ></div>
            <!-- Nulllinie -->
            <div
              class="absolute w-full border-t border-neutral"
              :style="`top: ${getYPosition(0)}px;`"
            ></div>
          </div>

          <!-- X-Achse Beschriftungen -->
          <div class="absolute bottom-0 left-20 right-0 flex justify-between">
            <div
              v-for="i in forecastMonths"
              :key="i"
              class="text-xs text-center"
              :style="`width: ${100 / forecastMonths}%;`"
            >
              {{ getMonthLabel(i - 1) }}
            </div>
          </div>

          <!-- Linien für jede Kategorie -->
          <div class="absolute inset-y-0 left-20 right-0">
            <svg width="100%" height="100%" class="overflow-visible">
              <g
                v-for="(category, categoryIndex) in activeForecastData"
                :key="category.categoryId"
              >
                <!-- Verbindungslinien zwischen Punkten -->
                <path
                  :d="
                    category.monthlyForecasts
                      .map(
                        (forecast, i) =>
                          `${i === 0 ? 'M' : 'L'} ${
                            i * (100 / (forecastMonths - 1))
                          }% ${getYPosition(forecast.projectedBalance)}`
                      )
                      .join(' ')
                  "
                  :stroke="
                    activeCategoryId === category.categoryId
                      ? 'var(--color-accent)'
                      : `hsl(${categoryIndex * 30}, 70%, 50%)`
                  "
                  stroke-width="2"
                  fill="none"
                />

                <!-- Punkte für jeden Monat -->
                <circle
                  v-for="(forecast, i) in category.monthlyForecasts"
                  :key="i"
                  :cx="`${i * (100 / (forecastMonths - 1))}%`"
                  :cy="getYPosition(forecast.projectedBalance)"
                  r="4"
                  :fill="
                    activeCategoryId === category.categoryId
                      ? 'var(--color-accent)'
                      : `hsl(${categoryIndex * 30}, 70%, 50%)`
                  "
                />
              </g>
            </svg>
          </div>
        </div>

        <!-- Detaillierte Daten für ausgewählte Kategorie -->
        <div v-if="activeCategoryId" class="mt-8">
          <h4 class="text-lg font-semibold mb-4">
            Detaillierte Prognose für
            {{
              activeForecastData.find((c) => c.categoryId === activeCategoryId)
                ?.categoryName
            }}
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="(forecast, i) in activeForecastData.find(
                (c) => c.categoryId === activeCategoryId
              )?.monthlyForecasts"
              :key="i"
              class="card bg-base-200 shadow-sm"
            >
              <div class="card-body p-4">
                <h5 class="card-title text-base">{{ forecast.month }}</h5>
                <div class="text-sm mb-2">
                  <div class="flex justify-between">
                    <span>Aktueller Saldo:</span>
                    <CurrencyDisplay
                      :amount="forecast.balance"
                      :as-integer="true"
                    />
                  </div>
                  <div class="flex justify-between font-bold">
                    <span>Prognostizierter Saldo:</span>
                    <CurrencyDisplay
                      :amount="forecast.projectedBalance"
                      :as-integer="true"
                    />
                  </div>
                </div>
                <div
                  v-if="forecast.transactions.length > 0"
                  class="text-xs space-y-1 border-t border-base-300 pt-2"
                >
                  <div class="font-semibold">Geplante Transaktionen:</div>
                  <div
                    v-for="(tx, j) in forecast.transactions"
                    :key="j"
                    class="flex justify-between"
                  >
                    <span
                      >{{ formatDate(tx.date) }} - {{ tx.description }}</span
                    >
                    <CurrencyDisplay :amount="tx.amount" :show-zero="true" />
                  </div>
                </div>
                <div
                  v-else
                  class="text-xs text-base-content/70 border-t border-base-300 pt-2"
                >
                  Keine geplanten Transaktionen in diesem Monat.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
