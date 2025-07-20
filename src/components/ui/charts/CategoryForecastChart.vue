<!-- src/components/ui/charts/CategoryForecastChart.vue -->
<script setup lang="ts">
/**
 * ApexCharts-basierte Kategorienprognose mit DaisyUI-Integration
 * Ersetzt die SVG-basierte CategoryForecastChart aus planning/
 *
 * Features:
 * - Tab-Umschaltung zwischen Ausgaben und Einnahmen
 * - 10-Farben-Spektrum aus DaisyUI-Variablen
 * - Responsive Verhalten mit automatischer Legende
 * - Flächenchart-Darstellung mit Gradient-Fill
 * - Theme-Integration mit MutationObserver
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { usePlanningStore } from "@/stores/planningStore";
import { useThemeStore } from "@/stores/themeStore";
import { BalanceService } from "@/services/BalanceService";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
// ApexCharts importieren
import ApexCharts from "apexcharts";

const props = defineProps<{
  startDate: string;
}>();

// Stores
const categoryStore = useCategoryStore();
const planningStore = usePlanningStore();
const themeStore = useThemeStore();

// Chart-Konfiguration
const forecastMonths = 6;

// Anzeigemodus: 'expenses' oder 'income'
const displayMode = ref<"expenses" | "income">("expenses");

// Responsive Verhalten
const isSmallScreen = ref(false);

// Chart-Container und Instanz
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;

// Theme Observer
let themeObserver: MutationObserver | null = null;

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

// Daten für die Prognose
const expenseForecastData = ref<CategoryForecast[]>([]);
const incomeForecastData = ref<CategoryForecast[]>([]);

// Aktive Forecastdaten basierend auf dem Anzeigemodus
const activeForecastData = computed(() => {
  return displayMode.value === "expenses"
    ? expenseForecastData.value
    : incomeForecastData.value;
});

// Responsive Breakpoint Detection
function checkScreenSize(): void {
  isSmallScreen.value = window.innerWidth < 768;
}

// Theme-Farben aus CSS-Variablen extrahieren
function getThemeColors() {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);

  return {
    primary: `hsl(${computedStyle.getPropertyValue("--p").trim()})`,
    secondary: `hsl(${computedStyle.getPropertyValue("--s").trim()})`,
    accent: `hsl(${computedStyle.getPropertyValue("--a").trim()})`,
    neutral: `hsl(${computedStyle.getPropertyValue("--n").trim()})`,
    base100: `hsl(${computedStyle.getPropertyValue("--b1").trim()})`,
    base200: `hsl(${computedStyle.getPropertyValue("--b2").trim()})`,
    base300: `hsl(${computedStyle.getPropertyValue("--b3").trim()})`,
    baseContent: `hsl(${computedStyle.getPropertyValue("--bc").trim()})`,
    success: `hsl(${computedStyle.getPropertyValue("--su").trim()})`,
    warning: `hsl(${computedStyle.getPropertyValue("--wa").trim()})`,
    error: `hsl(${computedStyle.getPropertyValue("--er").trim()})`,
    info: `hsl(${computedStyle.getPropertyValue("--in").trim()})`,
    textColor: computedStyle.getPropertyValue("--bc")
      ? `hsl(${computedStyle.getPropertyValue("--bc").trim()})`
      : "#374151",
    fontFamily:
      computedStyle.getPropertyValue("font-family") ||
      'Inter, "Source Sans Pro", Roboto, sans-serif',
  };
}

// 10-Farben-Spektrum aus DaisyUI-Variablen
function getColorSpectrum(): string[] {
  const themeColors = getThemeColors();

  return [
    themeColors.primary,
    themeColors.secondary,
    themeColors.accent,
    themeColors.info,
    themeColors.success,
    themeColors.warning,
    themeColors.error,
    themeColors.neutral,
    `hsl(280, 70%, 60%)`, // Lila
    `hsl(320, 70%, 60%)`, // Pink
  ];
}

// Deutsche Monatsnamen
function getGermanMonthName(date: dayjs.Dayjs): string {
  const months = [
    "Jan",
    "Feb",
    "Mär",
    "Apr",
    "Mai",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Okt",
    "Nov",
    "Dez",
  ];
  return `${months[date.month()]} ${date.year()}`;
}

// Kompakte Währungsformatierung
function formatCurrency(value: number): string {
  const absValue = Math.abs(value);

  if (absValue >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M €`;
  } else if (absValue >= 1000) {
    return `${(value / 1000).toFixed(1)}k €`;
  } else {
    return `${value.toFixed(0)} €`;
  }
}

// Generiert Prognosedaten für die Kategorien
function generateForecastData(): void {
  const startDate = new Date(props.startDate);
  const expenseData: CategoryForecast[] = [];
  const incomeData: CategoryForecast[] = [];

  // Nur Root-Kategorien für die Übersicht
  const rootCategories = categoryStore.categories.filter(
    (c: any) =>
      c.isActive && !c.parentCategoryId && c.name !== "Verfügbare Mittel"
  );

  // Generiere Daten für jede Kategorie
  rootCategories.forEach((category: any) => {
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
        .filter((tx: any) => {
          const txDate = new Date(tx.date);
          return (
            txDate >= monthStart &&
            txDate <= lastDay &&
            tx.transaction.categoryId === category.id
          );
        })
        .map((tx: any) => ({
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

// Chart-Daten berechnen
const chartData = computed(() => {
  const labels: string[] = [];
  const series: {
    name: string;
    data: (number | null)[];
    categoryId: string;
  }[] = [];
  const colorSpectrum = getColorSpectrum();

  // Labels für die nächsten 6 Monate generieren
  const startDate = dayjs(props.startDate);
  for (let i = 0; i < forecastMonths; i++) {
    const month = startDate.add(i, "month");
    labels.push(getGermanMonthName(month));
  }

  // Daten für jede Kategorie
  activeForecastData.value.forEach((category) => {
    const data = category.monthlyForecasts.map((f: any) =>
      Math.round(f.projectedBalance)
    );

    series.push({
      name: category.categoryName,
      data,
      categoryId: category.categoryId,
    });
  });

  return { labels, series, colorSpectrum };
});

// Chart-Optionen
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();

  return {
    series: data.series.map((s) => ({
      name: s.name,
      data: s.data,
      type: "area",
    })),
    chart: {
      height: "100%",
      width: "100%",
      type: "area",
      background: "transparent",
      foreColor: themeColors.textColor,
      fontFamily: themeColors.fontFamily,
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
      },
      zoom: {
        enabled: false,
      },
    },
    colors: data.colorSpectrum,
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: "smooth" as const,
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
        stops: [0, 90, 100],
      },
    },
    xaxis: {
      categories: data.labels,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        style: {
          colors: themeColors.textColor,
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: themeColors.textColor,
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
        formatter: (value: number) => formatCurrency(value),
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    grid: {
      borderColor: themeColors.base300,
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    legend: {
      show: !isSmallScreen.value && data.series.length > 1,
      position: "bottom" as const,
      horizontalAlign: "center" as const,
      fontSize: "12px",
      fontFamily: themeColors.fontFamily,
      labels: {
        colors: themeColors.textColor,
      },
      markers: {
        width: 12,
        height: 12,
        radius: 2,
      },
      itemMargin: {
        horizontal: 8,
        vertical: 4,
      },
    },
    tooltip: {
      theme: themeStore.isDarkMode ? "dark" : "light",
      style: {
        fontSize: "12px",
        fontFamily: themeColors.fontFamily,
      },
      y: {
        formatter: (value: number) => formatCurrency(value),
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          legend: {
            show: false,
          },
          chart: {
            height: 300,
          },
        },
      },
    ],
  };
});

// Chart erstellen und aktualisieren
const createChart = async () => {
  if (chartContainer.value && !chart && activeForecastData.value.length > 0) {
    try {
      chart = new ApexCharts(chartContainer.value, chartOptions.value);
      await chart.render();
      debugLog("[CategoryForecastChart] Chart created successfully", {
        series: chartOptions.value.series.length,
        container: !!chartContainer.value,
        mode: displayMode.value,
      });
    } catch (error) {
      debugLog("[CategoryForecastChart] Error creating chart", error);
    }
  }
};

const updateChart = async () => {
  if (chart && activeForecastData.value.length > 0) {
    try {
      await chart.updateOptions(chartOptions.value, true);
    } catch (error) {
      debugLog("[CategoryForecastChart] Error updating chart", error);
    }
  }
};

// Theme-Änderungen überwachen
function setupThemeObserver(): void {
  themeObserver = new MutationObserver(() => {
    // Chart mit neuen Theme-Farben aktualisieren
    setTimeout(() => {
      updateChart();
    }, 50);
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
}

// Wechselt zwischen Ausgaben- und Einnahmenansicht
function toggleDisplayMode(mode: "expenses" | "income"): void {
  displayMode.value = mode;
}

// Watchers für Datenänderungen
watch(
  () => props.startDate,
  async () => {
    generateForecastData();
    await nextTick();
    if (!chart) {
      setTimeout(() => {
        createChart();
      }, 100);
    }
  }
);

watch(
  chartData,
  async () => {
    if (chart) {
      await updateChart();
    } else if (activeForecastData.value.length > 0) {
      await nextTick();
      setTimeout(() => {
        createChart();
      }, 100);
    }
  },
  { deep: true }
);

watch(displayMode, async () => {
  if (chart) {
    await updateChart();
  } else if (activeForecastData.value.length > 0) {
    await nextTick();
    setTimeout(() => {
      createChart();
    }, 100);
  }
});

watch(
  () => themeStore.isDarkMode,
  () => {
    setTimeout(() => {
      updateChart();
    }, 50);
  }
);

watch(isSmallScreen, () => {
  updateChart();
});

// Lifecycle
onMounted(async () => {
  generateForecastData();
  checkScreenSize();
  setupThemeObserver();

  // Warten bis DOM und Daten verfügbar sind
  await nextTick();
  setTimeout(() => {
    createChart();
  }, 100);

  window.addEventListener("resize", checkScreenSize);
});

onUnmounted(() => {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
  window.removeEventListener("resize", checkScreenSize);
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
          @click="toggleDisplayMode('expenses')"
        >
          <Icon
            icon="mdi:cash-minus"
            class="mr-2"
          />
          Ausgaben
        </a>
        <a
          class="tab"
          :class="{ 'tab-active': displayMode === 'income' }"
          @click="toggleDisplayMode('income')"
        >
          <Icon
            icon="mdi:cash-plus"
            class="mr-2"
          />
          Einnahmen
        </a>
      </div>
    </div>

    <!-- Keine Daten Hinweis -->
    <div
      v-if="activeForecastData.length === 0"
      class="text-center py-10"
    >
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

    <!-- ApexCharts Flächenchart -->
    <div
      v-else
      class="w-full"
    >
      <div class="card bg-base-100 shadow-md h-96">
        <div class="card-body flex flex-col">
          <div
            ref="chartContainer"
            class="w-full flex-1 min-h-0"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Zusätzliche Styles falls benötigt */
.tabs-boxed .tab {
  transition: all 0.2s ease;
}

.tabs-boxed .tab:hover {
  background-color: hsl(var(--b3));
}

.tabs-boxed .tab-active {
  background-color: hsl(var(--p));
  color: hsl(var(--pc));
}
</style>
