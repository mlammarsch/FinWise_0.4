<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { TransactionService } from "@/services/TransactionService";
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

// Chart-Referenzen
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;
let themeObserver: MutationObserver | null = null;

// Responsive
const isSmallScreen = ref(false);

// Formatiert Währungsbeträge als vollständige Integer-Werte
const formatFullCurrency = (value: number): string => {
  if (value === 0) return "0€";
  return Math.round(value).toLocaleString('de-DE') + "€";
};

// Formatiert Y-Achsen-Labels in gekürzter k-Angabe
const formatYAxisCurrency = (value: number): string => {
  if (value === 0) return "0€";

  const absValue = Math.abs(value);
  let formatted = "";

  if (absValue >= 1000000) {
    formatted = Math.round(value / 1000000) + "M€";
  } else if (absValue >= 1000) {
    formatted = Math.round(value / 1000) + "k€";
  } else {
    formatted = Math.round(value) + "€";
  }

  return formatted;
};

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

// Screen-Size-Watcher
const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640;
};

// Daten berechnen
const chartData = computed(() => {
  const summary = TransactionService.getIncomeExpenseSummary(
    props.startDate,
    props.endDate
  );
  return {
    income: summary.income,
    expense: summary.expense,
    balance: summary.balance,
  };
});

// Chart-Optionen
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();

  return {
    series: [
      {
        name: "Betrag",
        data: [data.income, data.expense],
      },
    ],
    chart: {
      type: "bar",
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
    colors: [themeColors.success, themeColors.error],
    fill: {
      colors: [themeColors.success, themeColors.error]
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "55%",
        borderRadius: 4,
        distributed: true,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => formatFullCurrency(val),
      style: {
        fontSize: "12px",
        fontFamily: themeColors.fontFamily,
        colors: [themeColors.baseContent],
      },
      offsetY: -10,
    },
    xaxis: {
      categories: ["Einnahmen", "Ausgaben"],
      labels: {
        style: {
          colors: Array(2).fill(themeColors.textColor),
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => formatYAxisCurrency(val),
        style: {
          colors: themeColors.textColor,
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
    },
    grid: {
      borderColor: themeColors.base300,
      strokeDashArray: 5,
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
      row: {
        colors: undefined,
        opacity: 0.3,
      },
      column: {
        colors: undefined,
        opacity: 0.3,
      },
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 15,
      },
    },
    annotations: {
      yaxis: [
        {
          y: 0,
          borderColor: themeColors.baseContent,
          borderWidth: 1,
          strokeDashArray: 0,
        },
      ],
    },
    legend: {
      show: false,
    },
    tooltip: {
      theme: themeStore.isDarkMode ? "dark" : "light",
      y: {
        formatter: (val: number) => formatFullCurrency(val),
      },
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          plotOptions: {
            bar: {
              columnWidth: "70%",
            },
          },
          dataLabels: {
            style: {
              fontSize: "10px",
            },
          },
        },
      },
    ],
  };
});

// Chart erstellen
const createChart = () => {
  if (!chartContainer.value) return;

  if (chart) {
    chart.destroy();
  }

  chart = new ApexCharts(chartContainer.value, chartOptions.value);
  chart.render();
};

// Chart aktualisieren
const updateChart = () => {
  if (chart) {
    chart.updateOptions(chartOptions.value, true, true);
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
    ref="chartContainer"
    class="w-full h-180"
  ></div>
</template>
