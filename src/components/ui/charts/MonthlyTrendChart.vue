<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { TransactionService } from "@/services/TransactionService";
import { formatChartCurrency } from "@/utils/chartFormatters";
import ApexCharts from "apexcharts";
import dayjs from "dayjs";
import "dayjs/locale/de";

dayjs.locale("de");

// Props
const props = defineProps<{
  months: number;
}>();

// Stores
const themeStore = useThemeStore();

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

// Screen-Size-Watcher
const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640;
};

// Deutsche Monatsnamen (3-stellig)
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

// Daten berechnen
const chartData = computed(() => {
  const monthlyTrend = TransactionService.getMonthlyTrend(props.months);

  return {
    labels: monthlyTrend.map((item) => item.month.split(" ")[0]), // Nur Monat ohne Jahr
    incomeData: monthlyTrend.map((item) => Math.round(item.income)),
    expenseData: monthlyTrend.map((item) => Math.round(item.expense)),
    // Balance nicht vorhanden: aus income - expense ableiten
    balanceData: monthlyTrend.map((item) =>
      Math.round(item.income - item.expense)
    ),
    hasData: monthlyTrend.length > 0,
  };
});

// Chart-Optionen
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();

  if (!data.hasData) {
    return null;
  }

  return {
    series: [
      {
        name: "Einnahmen",
        type: "column",
        data: data.incomeData,
      },
      {
        name: "Ausgaben",
        type: "column",
        data: data.expenseData.map((val) => -Math.abs(val)), // Ausgaben als negative Werte
      },
      {
        name: "Bilanz",
        type: "line",
        data: data.balanceData,
      },
    ],
    chart: {
      type: "line",
      height: "100%",
      width: "100%",
      stacked: false,
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
    },
    colors: [themeColors.success, themeColors.error, themeColors.primary],
    plotOptions: {
      bar: {
        columnWidth: isSmallScreen.value ? "70%" : "50%",
        borderRadius: 4,
      },
    },
    stroke: {
      width: [0, 0, 3],
      curve: "smooth",
    },
    fill: {
      opacity: [0.85, 0.85, 1],
      type: ["solid", "solid", "solid"],
    },
    labels: data.labels,
    markers: {
      size: [0, 0, 5],
      strokeColors: themeColors.primary,
      strokeWidth: 2,
      fillColors: [themeColors.primary],
      hover: {
        size: 7,
      },
    },
    xaxis: {
      type: "category",
      labels: {
        style: {
          colors: Array(data.labels.length).fill(themeColors.textColor),
          fontSize: isSmallScreen.value ? "10px" : "12px",
          fontFamily: themeColors.fontFamily,
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
    yaxis: [
      {
        seriesName: ["Einnahmen", "Ausgaben"],
        title: {
          text: "Einnahmen / Ausgaben",
          style: {
            color: themeColors.baseContent,
            fontSize: isSmallScreen.value ? "10px" : "12px",
            fontFamily: themeColors.fontFamily,
          },
        },
        labels: {
          formatter: (val: number) => formatChartCurrency(val),
          style: {
            colors: themeColors.textColor,
            fontSize: isSmallScreen.value ? "10px" : "12px",
            fontFamily: themeColors.fontFamily,
          },
        },
        axisBorder: {
          show: true,
          color: themeColors.success,
        },
        axisTicks: {
          show: true,
          color: themeColors.success,
        },
      },
      {
        seriesName: "Bilanz",
        opposite: true,
        title: {
          text: "Bilanz",
          style: {
            color: themeColors.baseContent,
            fontSize: isSmallScreen.value ? "10px" : "12px",
            fontFamily: themeColors.fontFamily,
          },
        },
        labels: {
          formatter: (val: number) => formatChartCurrency(val),
          style: {
            colors: themeColors.textColor,
            fontSize: isSmallScreen.value ? "10px" : "12px",
            fontFamily: themeColors.fontFamily,
          },
        },
        axisBorder: {
          show: true,
          color: themeColors.primary,
        },
        axisTicks: {
          show: true,
          color: themeColors.primary,
        },
      },
    ],
    legend: {
      show: true,
      clusterGroupedSeries: false,
      clusterGroupedSeriesOrientation: "horizontal",
      position: isSmallScreen.value ? "bottom" : "top",
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
      labels: {
        colors: themeColors.baseContent,
        useSeriesColors: false,
      },
      markers: {
        width: isSmallScreen.value ? 10 : 12,
        height: isSmallScreen.value ? 10 : 12,
        radius: 2,
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
    tooltip: {
      theme: themeStore.isDarkMode ? "dark" : "light",
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number) => formatChartCurrency(val),
      },
    },
    grid: {
      borderColor: themeColors.base300,
      strokeDashArray: 3,
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          plotOptions: {
            bar: {
              columnWidth: "80%",
            },
          },
          legend: {
            position: "bottom",
            fontSize: "10px",
            itemMargin: {
              horizontal: 8,
              vertical: 4,
            },
          },
          yaxis: [
            {
              title: {
                style: {
                  fontSize: "9px",
                },
              },
              labels: {
                style: {
                  fontSize: "9px",
                },
              },
            },
            {
              title: {
                style: {
                  fontSize: "9px",
                },
              },
              labels: {
                style: {
                  fontSize: "9px",
                },
              },
            },
          ],
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
  () => props.months,
  () => {
    updateChart();
  }
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
  <div class="w-full h-full">
    <div
      v-if="!chartData.hasData"
      class="flex items-center justify-center h-full text-base-content/70"
    >
      <div class="text-center">
        <div class="text-lg mb-2">📈</div>
        <div>Keine Daten für Trend verfügbar</div>
      </div>
    </div>
    <div
      v-else
      ref="chartContainer"
      class="w-full h-full"
    ></div>
  </div>
</template>
