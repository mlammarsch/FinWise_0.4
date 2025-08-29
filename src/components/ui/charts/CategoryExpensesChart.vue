<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { TransactionService } from "@/services/TransactionService";
import { formatChartCurrency } from "@/utils/chartFormatters";
import ApexCharts from "apexcharts";

// Props
const props = withDefaults(defineProps<{
  startDate: string;
  endDate: string;
  showHeader?: boolean;
}>(), {
  showHeader: true
});

// Stores
const themeStore = useThemeStore();
const categoryStore = useCategoryStore();

// Chart-Referenzen
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;
let themeObserver: MutationObserver | null = null;

// Responsive
const isSmallScreen = ref(false);

// DaisyUI Theme-Integration
const getCSSVariableValue = (variableName: string): string => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  if (!value) {
    console.warn(`CSS Variable ${variableName} not found`);
    return "#000000";
  }

  if (value.includes("%") && value.includes(" ")) {
    return `oklch(${value})`;
  }

  return value;
};

const getFontFamily = (): string => {
  const htmlElement = document.documentElement;
  const computedStyle = getComputedStyle(htmlElement);
  const fontFamily = computedStyle.fontFamily;
  return (
    fontFamily || "Inter, 'Source Sans Pro', Roboto, system-ui, sans-serif"
  );
};

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

// 10-Farben-Spektrum für Kategorien
const getColorSpectrum = () => {
  const themeColors = getThemeColors();
  return [
    themeColors.primary,
    themeColors.secondary,
    themeColors.accent,
    themeColors.info,
    themeColors.warning,
    themeColors.error,
    themeColors.success,
    themeColors.neutral,
    themeColors.base300,
    themeColors.base200,
  ];
};

// Screen-Size-Watcher
const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640;
};

// Daten berechnen
const chartData = computed(() => {
  const transactions = TransactionService.getAllTransactions();
  const start = new Date(props.startDate);
  const end = new Date(props.endDate);

  // Gruppiere Ausgaben nach Kategorien
  const categoryExpenses: Record<
    string,
    { name: string; amount: number; categoryId: string }
  > = {};

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    if (txDate >= start && txDate <= end && tx.amount < 0 && tx.categoryId) {
      const category = categoryStore.getCategoryById(tx.categoryId);
      if (category) {
        if (!categoryExpenses[tx.categoryId]) {
          categoryExpenses[tx.categoryId] = {
            name: category.name,
            amount: 0,
            categoryId: tx.categoryId,
          };
        }
        categoryExpenses[tx.categoryId].amount += Math.abs(tx.amount);
      }
    }
  });

  const categories = Object.values(categoryExpenses)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    categories,
    hasData: categories.length > 0,
  };
});

// Chart-Optionen
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();
  const colorSpectrum = getColorSpectrum();

  if (!data.hasData) {
    return null;
  }

  return {
    series: data.categories.map((cat) => cat.amount),
    chart: {
      type: "pie",
      height: "100%",
      width: "100%",
      background: "transparent",
      foreColor: themeColors.textColor,
      fontFamily: themeColors.fontFamily,
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
      },
    },
    labels: data.categories.map((cat) => cat.name),
    colors: colorSpectrum,
    legend: {
      show: true,
      position: isSmallScreen.value ? "bottom" : "right",
      horizontalAlign: "center",
      floating: false,
      fontSize: isSmallScreen.value ? "11px" : "12px",
      fontFamily: themeColors.fontFamily,
      fontWeight: 400,
      itemMargin: {
        horizontal: isSmallScreen.value ? 12 : 20,
        vertical: isSmallScreen.value ? 6 : 8,
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
        offsetX: 0,
        offsetY: 0,
        strokeWidth: 0,
        strokeColor: "transparent",
      },
      onItemClick: {
        toggleDataSeries: true,
      },
      onItemHover: {
        highlightDataSeries: true,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number, opts: any) => {
        const value = data.categories[opts.seriesIndex]?.amount || 0;
        return formatChartCurrency(value);
      },
      style: {
        fontSize: isSmallScreen.value ? "10px" : "12px",
        fontFamily: themeColors.fontFamily,
        colors: [themeColors.baseContent],
      },
      dropShadow: {
        enabled: false,
      },
    },
    tooltip: {
      theme: themeStore.isDarkMode ? "dark" : "light",
      y: {
        formatter: (val: number) => formatChartCurrency(val),
      },
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          legend: {
            position: "bottom",
            fontSize: "10px",
            itemMargin: {
              horizontal: 8,
              vertical: 4,
            },
          },
          dataLabels: {
            style: {
              fontSize: "9px",
            },
          },
        },
      },
    ],
  };
});

// Chart erstellen
const createChart = () => {
  if (!chartContainer.value || !chartOptions.value) return;

  if (chart) {
    chart.destroy();
  }

  chart = new ApexCharts(chartContainer.value, chartOptions.value);
  chart.render();
};

// Chart aktualisieren
const updateChart = () => {
  if (chart && chartOptions.value) {
    chart.updateOptions(chartOptions.value, true, true);
  } else if (chartOptions.value) {
    createChart();
  }
};

// Theme-Observer Setup
const setupThemeObserver = () => {
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
  () => [props.startDate, props.endDate],
  () => {
    updateChart();
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

// Lifecycle
onMounted(() => {
  updateScreenSize();
  window.addEventListener("resize", updateScreenSize);
  createChart();
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
  <div
    class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
  >
    <div class="card-body">
      <!-- Header -->
      <h3
        v-if="showHeader"
        class="card-title text-lg mb-4"
      >
        Ausgaben nach Kategorien
      </h3>

      <!-- Chart Container -->
      <div class="h-64">
        <div
          v-if="!chartData.hasData"
          class="flex items-center justify-center h-full text-base-content/70"
        >
          <div class="text-center">
            <div class="text-lg mb-2">📊</div>
            <div>Keine Ausgaben in diesem Zeitraum</div>
          </div>
        </div>
        <div
          v-else
          ref="chartContainer"
          class="w-full h-full"
        ></div>
      </div>
    </div>
  </div>
</template>
