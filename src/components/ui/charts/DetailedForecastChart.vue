<script setup lang="ts">
/**
 * DetailedForecastChart - Zweifarbige Darstellung für einzelne Konten/Kategorien
 *
 * Features:
 * - Positive Werte in Success-Farben (grün)
 * - Negative Werte in Error-Farben (rot)
 * - Durchgehende Linie auch über Null-Bereich
 * - Deutlich markierte Null-Linie mit solid Strich
 * - Flächenchart mit Gradient-Fill
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { usePlanningStore } from "@/stores/planningStore";
import { useThemeStore } from "@/stores/themeStore";
import { BalanceService } from "@/services/BalanceService";
import { debugLog } from "@/utils/logger";
import dayjs from "dayjs";
import "dayjs/locale/de";

// ApexCharts importieren
import ApexCharts from "apexcharts";

dayjs.locale("de");

const props = defineProps<{
  startDate: string;
  type: "accounts" | "categories";
  selectedId: string; // ID des ausgewählten Kontos oder Kategorie
}>();

// Stores
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const planningStore = usePlanningStore();
const themeStore = useThemeStore();

// Chart-Konfiguration
const forecastMonths = 6;
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;

// Responsive Verhalten
const isSmallScreen = ref(false);

// Theme Observer
let themeObserver: MutationObserver | null = null;

// Funktion zum Abrufen der CSS-Variablen-Werte
const getCSSVariableValue = (variableName: string): string => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  if (!value) {
    console.warn(`CSS Variable ${variableName} not found`);
    return "#000000";
  }

  if (value.startsWith("oklch(")) {
    return value;
  }

  if (value.includes("%") && value.includes(" ")) {
    return `oklch(${value})`;
  }

  return value;
};

// Funktion zum Abrufen der Schriftfamilie
const getFontFamily = (): string => {
  const htmlElement = document.documentElement;
  const computedStyle = getComputedStyle(htmlElement);
  const fontFamily = computedStyle.fontFamily;
  return (
    fontFamily || "Inter, 'Source Sans Pro', Roboto, system-ui, sans-serif"
  );
};

// Theme-Farben
const getThemeColors = () => {
  return {
    success: getCSSVariableValue("--color-success"),
    error: getCSSVariableValue("--color-error"),
    warning: getCSSVariableValue("--color-warning"),
    baseContent: getCSSVariableValue("--color-base-content"),
    textColor: getCSSVariableValue("--color-base-content"),
    primary: getCSSVariableValue("--color-primary"),
    secondary: getCSSVariableValue("--color-secondary"),
    accent: getCSSVariableValue("--color-accent"),
    base100: getCSSVariableValue("--color-base-100"),
    base200: getCSSVariableValue("--color-base-200"),
    base300: getCSSVariableValue("--color-base-300"),
    neutral: getCSSVariableValue("--color-neutral"),
    info: getCSSVariableValue("--color-info"),
    fontFamily: getFontFamily(),
  };
};

// Formatierungsfunktion für kompakte Darstellung
const formatCurrency = (value: number): string => {
  if (value === 0) return "0€";

  const absValue = Math.abs(value);
  let formatted = "";

  if (absValue >= 1000000) {
    formatted = (value / 1000000).toFixed(1).replace(".0", "") + "M€";
  } else if (absValue >= 1000) {
    formatted = (value / 1000).toFixed(1).replace(".0", "") + "k€";
  } else {
    formatted = value.toFixed(0) + "€";
  }

  return formatted;
};

// Screen-Size-Watcher
const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640;
};

// Deutsche Monatsnamen
const getGermanMonthName = (date: dayjs.Dayjs): string => {
  const monthNames = [
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
  return monthNames[date.month()];
};

// Daten für die Prognose
const forecastData = ref<{
  id: string;
  name: string;
  currentBalance?: number;
  isIncomeCategory?: boolean;
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
} | null>(null);

// Chart-Daten berechnen mit zweifarbiger Logik
const chartData = computed(() => {
  if (!forecastData.value) return { labels: [], series: [] };

  const labels: string[] = [];
  const rawData: number[] = [];

  // Labels für die nächsten 6 Monate generieren
  const startDate = dayjs(props.startDate);
  for (let i = 0; i < forecastMonths; i++) {
    const month = startDate.add(i, "month");
    labels.push(getGermanMonthName(month));
  }

  // Rohdaten sammeln
  forecastData.value.monthlyForecasts.forEach((f) => {
    rawData.push(Math.round(f.projectedBalance));
  });

  // Zwei Serien erstellen: eine für positive, eine für negative Werte
  // Aber beide enthalten alle Datenpunkte für durchgehende Linie
  const positiveData: (number | null)[] = [];
  const negativeData: (number | null)[] = [];
  const allData: number[] = [];

  rawData.forEach((value) => {
    allData.push(value);
    if (value >= 0) {
      positiveData.push(value);
      negativeData.push(null);
    } else {
      positiveData.push(null);
      negativeData.push(value);
    }
  });

  // Für durchgehende Linie: Verbindungspunkte an Null-Übergängen
  const connectedPositiveData: (number | null)[] = [...positiveData];
  const connectedNegativeData: (number | null)[] = [...negativeData];

  for (let i = 0; i < rawData.length - 1; i++) {
    const current = rawData[i];
    const next = rawData[i + 1];

    // Übergang von positiv zu negativ oder umgekehrt
    if ((current >= 0 && next < 0) || (current < 0 && next >= 0)) {
      // Interpoliere den Null-Punkt
      const ratio = Math.abs(current) / (Math.abs(current) + Math.abs(next));
      const nullPoint = 0;

      // Füge Null-Punkt zu beiden Serien hinzu für Verbindung
      if (current >= 0 && next < 0) {
        // Von positiv zu negativ
        connectedNegativeData[i] = nullPoint;
        connectedPositiveData[i + 1] = nullPoint;
      } else {
        // Von negativ zu positiv
        connectedPositiveData[i] = nullPoint;
        connectedNegativeData[i + 1] = nullPoint;
      }
    }
  }

  const series = [];

  // Positive Serie (grün)
  if (connectedPositiveData.some((val) => val !== null)) {
    series.push({
      name: `${forecastData.value.name} (Positiv)`,
      data: connectedPositiveData,
      type: "area",
    });
  }

  // Negative Serie (rot)
  if (connectedNegativeData.some((val) => val !== null)) {
    series.push({
      name: `${forecastData.value.name} (Negativ)`,
      data: connectedNegativeData,
      type: "area",
    });
  }

  return { labels, series, rawData: allData };
});

// Chart-Optionen
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();

  return {
    series: data.series,
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
    colors: [themeColors.success, themeColors.error], // Grün für positiv, rot für negativ
    stroke: {
      curve: "smooth",
      width: 3, // Etwas dicker für bessere Sichtbarkeit
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.6,
        opacityTo: 0.2,
        stops: [0, 90, 100],
      },
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: data.labels,
      labels: {
        style: {
          colors: Array(data.labels.length).fill(themeColors.textColor),
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
      axisBorder: {
        show: true,
        color: themeColors.base300,
        height: 1,
      },
      axisTicks: {
        show: true,
        color: themeColors.base300,
        height: 6,
      },
      title: {
        text: "Monate",
        style: {
          color: themeColors.baseContent,
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
    },
    yaxis: {
      title: {
        text:
          props.type === "accounts" ? "Kontostand (€)" : "Kategoriesaldo (€)",
        style: {
          color: themeColors.baseContent,
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
      labels: {
        style: {
          colors: Array(10).fill(themeColors.textColor),
          fontSize: "11px",
          fontFamily: themeColors.fontFamily,
        },
        formatter: function (val: number) {
          return formatCurrency(val);
        },
      },
      axisBorder: {
        show: true,
        color: themeColors.base300,
      },
      axisTicks: {
        show: true,
        color: themeColors.base300,
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: themeStore.isDarkMode ? "dark" : "light",
      style: {
        fontSize: "12px",
      },
      y: {
        formatter: function (val: number) {
          return formatCurrency(val);
        },
      },
    },
    legend: {
      show: data.series.length > 1,
      position: isSmallScreen.value ? "top" : "top",
      horizontalAlign: "center",
      floating: false,
      fontSize: isSmallScreen.value ? "8px" : "10px",
      fontFamily: themeColors.fontFamily,
      fontWeight: 400,
      itemMargin: {
        horizontal: isSmallScreen.value ? 12 : 20,
        vertical: isSmallScreen.value ? 5 : 1,
      },
      offsetY: isSmallScreen.value ? 5 : 0,
      offsetX: 0,
      labels: {
        colors: themeColors.baseContent,
        useSeriesColors: false,
      },
      markers: {
        width: isSmallScreen.value ? 10 : 12,
        height: isSmallScreen.value ? 10 : 12,
        radius: 2,
        offsetX: -1,
        offsetY: 0,
        strokeWidth: 0,
        strokeColor: "transparent",
        fillColors: undefined,
      },
      onItemClick: {
        toggleDataSeries: true,
      },
      onItemHover: {
        highlightDataSeries: true,
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
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      },
    },
    // Null-Linie als Annotation hinzufügen
    annotations: {
      yaxis: [
        {
          y: 0,
          borderColor: themeColors.baseContent,
          borderWidth: 2, // Deutlich sichtbare Null-Linie
          strokeDashArray: 0, // Solid line (nicht gestrichelt)
          opacity: 0.8,
          label: {
            text: "0€",
            position: "right",
            offsetX: 0,
            style: {
              color: themeColors.baseContent,
              background: themeColors.base100,
              fontSize: "10px",
              fontFamily: themeColors.fontFamily,
            },
          },
        },
      ],
    },
  };
});

// Prognosedaten generieren
function generateForecastData() {
  const startDate = new Date(props.startDate);
  let data: typeof forecastData.value = null;

  if (props.type === "accounts") {
    // Account-Daten generieren
    const account = accountStore.getAccountById(props.selectedId);
    if (!account) return;

    data = {
      id: account.id,
      name: account.name,
      currentBalance: account.balance,
      monthlyForecasts: [],
    };

    for (let i = 0; i < forecastMonths; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);

      const lastDay = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth() + 1,
        0
      );

      const balance = BalanceService.getTodayBalance(
        "account",
        account.id,
        lastDay
      );
      const projectedBalance = BalanceService.getProjectedBalance(
        "account",
        account.id,
        lastDay
      );

      const monthStart = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth(),
        1
      );
      const transactions = planningStore
        .getUpcomingTransactions(365) // 365 Tage statt 35, um alle 6 Monate abzudecken
        .filter((tx: any) => {
          const txDate = new Date(tx.date);
          return (
            txDate >= monthStart &&
            txDate <= lastDay &&
            tx.transaction?.accountId === account.id
          );
        })
        .map((tx: any) => ({
          date: tx.date,
          description: tx.transaction?.name || "Geplante Transaktion",
          amount: tx.transaction?.amount || 0,
        }));

      data.monthlyForecasts.push({
        month: forecastDate.toLocaleDateString("de-DE", {
          month: "short",
          year: "numeric",
        }),
        balance,
        projectedBalance,
        transactions,
      });
    }
  } else {
    // Category-Daten generieren
    const category = categoryStore.getCategoryById(props.selectedId);
    if (!category) return;

    data = {
      id: category.id,
      name: category.name,
      isIncomeCategory: category.isIncomeCategory,
      monthlyForecasts: [],
    };

    for (let i = 0; i < forecastMonths; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);

      const lastDay = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth() + 1,
        0
      );

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

      const monthStart = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth(),
        1
      );
      const transactions = planningStore
        .getUpcomingTransactions(365) // 365 Tage statt 35, um alle 6 Monate abzudecken
        .filter((tx: any) => {
          const txDate = new Date(tx.date);
          return (
            txDate >= monthStart &&
            txDate <= lastDay &&
            tx.transaction?.categoryId === category.id
          );
        })
        .map((tx: any) => ({
          date: tx.date,
          description: tx.transaction?.name || "Geplante Transaktion",
          amount: tx.transaction?.amount || 0,
        }));

      data.monthlyForecasts.push({
        month: forecastDate.toLocaleDateString("de-DE", {
          month: "short",
          year: "numeric",
        }),
        balance,
        projectedBalance,
        transactions,
      });
    }
  }

  forecastData.value = data;
  debugLog("[DetailedForecastChart] generateForecastData", {
    type: props.type,
    selectedId: props.selectedId,
    name: data?.name,
    startDate: props.startDate,
  });
}

// Chart erstellen und aktualisieren
const createChart = async () => {
  if (chartContainer.value && !chart && forecastData.value) {
    try {
      chart = new ApexCharts(chartContainer.value, chartOptions.value);
      await chart.render();
      debugLog("[DetailedForecastChart] Chart created successfully", {
        type: props.type,
        series: chartOptions.value.series.length,
        container: !!chartContainer.value,
      });
    } catch (error) {
      debugLog("[DetailedForecastChart] Error creating chart", error);
    }
  }
};

const updateChart = async () => {
  if (chart && forecastData.value) {
    try {
      await chart.updateOptions(chartOptions.value, true);
    } catch (error) {
      debugLog("[DetailedForecastChart] Error updating chart", error);
    }
  }
};

// Theme-Observer
const setupThemeObserver = () => {
  if (themeObserver) {
    themeObserver.disconnect();
  }

  themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "data-theme"
      ) {
        setTimeout(() => {
          updateChart();
        }, 50);
      }
    });
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
};

// Watchers
watch(
  [() => props.startDate, () => props.selectedId, () => props.type],
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
    } else if (forecastData.value) {
      await nextTick();
      setTimeout(() => {
        createChart();
      }, 100);
    }
  },
  { deep: true }
);

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

onMounted(async () => {
  updateScreenSize();
  window.addEventListener("resize", updateScreenSize);
  generateForecastData();

  // Warten bis DOM und Daten verfügbar sind
  await nextTick();
  setTimeout(() => {
    createChart();
  }, 100);

  setupThemeObserver();
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
  window.removeEventListener("resize", updateScreenSize);
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h3 class="text-xl font-bold">
        Detaillierte {{ type === "accounts" ? "Konto" : "Kategorie" }}prognose
      </h3>
      <div class="text-sm opacity-70">
        {{ forecastData?.name }}
      </div>
    </div>

    <!-- Keine Daten Hinweis -->
    <div
      v-if="!forecastData"
      class="text-center py-10"
    >
      <div class="text-4xl text-warning mb-2">⚠️</div>
      <p>
        Keine Daten für das ausgewählte
        {{ type === "accounts" ? "Konto" : "Kategorie" }} verfügbar.
      </p>
    </div>

    <!-- ApexCharts Zweifarbige Prognose-Visualisierung -->
    <div
      v-else
      class="card bg-base-100 shadow-md h-80"
    >
      <div class="card-body flex flex-col">
        <div
          ref="chartContainer"
          class="w-full flex-1 min-h-0"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Zusätzliche Styles falls benötigt */
</style>
