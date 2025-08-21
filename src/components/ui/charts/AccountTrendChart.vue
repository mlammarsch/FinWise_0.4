<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { useAccountStore } from "@/stores/accountStore";
import { BalanceService } from "@/services/BalanceService";
import { formatChartCurrency } from "@/utils/chartFormatters";
import ApexCharts from "apexcharts";
import dayjs from "dayjs";
import "dayjs/locale/de";

dayjs.locale("de");

// Props
const props = defineProps<{
  accountId: string;
  days: number;
  accountGrouping: string; // "all", "grouped", oder spezifische Account-ID
}>();

// Stores
const themeStore = useThemeStore();
const accountStore = useAccountStore();

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

// Farb-Spektrum für mehrere Konten
const getColorSpectrum = () => {
  const themeColors = getThemeColors();
  return [
    themeColors.primary,
    themeColors.secondary,
    themeColors.accent,
    themeColors.info,
    themeColors.warning,
    themeColors.success,
    themeColors.error,
    themeColors.neutral,
    themeColors.base300,
    themeColors.base200,
  ];
};

// Screen-Size-Watcher
const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640;
};

// Hilfsfunktion für Datumsformatierung basierend auf Zeitraum
const getDateFormat = (days: number) => {
  if (days <= 30) {
    return "DD.MM";
  } else {
    return "DD.MM.YYYY";
  }
};

// Daten berechnen
const chartData = computed(() => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - props.days);

  const dateFormat = getDateFormat(props.days);

  let series: Array<{
    name: string;
    data: Array<{ x: string; y: number }>;
    id: string;
  }> = [];

  if (props.accountId === "all") {
    // Alle Konten einzeln anzeigen
    const activeAccounts = accountStore.activeAccounts.filter(
      (acc) => !acc.isOfflineBudget
    );

    activeAccounts.forEach((account) => {
      const balances = BalanceService.getRunningBalances(
        "account",
        account.id,
        [startDate, endDate],
        { includeProjection: false }
      );

      const data = balances.map((balance) => ({
        x: dayjs(balance.date).format(dateFormat),
        y: Math.round(balance.balance),
      }));

      series.push({
        name: account.name,
        data,
        id: account.id,
      });
    });
  } else if (props.accountId === "grouped") {
    // Nach AccountType gruppiert
    const activeAccounts = accountStore.activeAccounts.filter(
      (acc) => !acc.isOfflineBudget
    );
    const accountTypes = [
      ...new Set(activeAccounts.map((acc) => acc.accountType)),
    ];

    accountTypes.forEach((accountType) => {
      const typeAccounts = activeAccounts.filter(
        (acc) => acc.accountType === accountType
      );

      // Berechne Gesamtsaldo für diesen Typ pro Tag
      const combinedBalances: Record<string, number> = {};

      typeAccounts.forEach((account) => {
        const balances = BalanceService.getRunningBalances(
          "account",
          account.id,
          [startDate, endDate],
          { includeProjection: false }
        );

        balances.forEach((balance) => {
          const dateKey = balance.date;
          if (!combinedBalances[dateKey]) {
            combinedBalances[dateKey] = 0;
          }
          combinedBalances[dateKey] += balance.balance;
        });
      });

      const data = Object.entries(combinedBalances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, balance]) => ({
          x: dayjs(date).format(dateFormat),
          y: Math.round(balance),
        }));

      series.push({
        name: `${accountType} (${typeAccounts.length} Konten)`,
        data,
        id: `type_${accountType}`,
      });
    });
  } else {
    // Einzelnes Konto
    const account = accountStore.getAccountById(props.accountId);
    if (account) {
      const balances = BalanceService.getRunningBalances(
        "account",
        props.accountId,
        [startDate, endDate],
        { includeProjection: true }
      );

      const actualData = balances.map((balance) => ({
        x: dayjs(balance.date).format(dateFormat),
        y: Math.round(balance.balance),
      }));

      const projectedData = balances
        .filter((balance) => balance.projected !== undefined)
        .map((balance) => ({
          x: dayjs(balance.date).format(dateFormat),
          y: Math.round(balance.projected!),
        }));

      series.push({
        name: account.name,
        data: actualData,
        id: account.id,
      });

      if (projectedData.length > 0) {
        series.push({
          name: `${account.name} (Prognose)`,
          data: projectedData,
          id: `${account.id}_projected`,
        });
      }
    }
  }

  return {
    series,
    hasData: series.length > 0 && series.some((s) => s.data.length > 0),
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

  // Bestimme Farben basierend auf Anzahl der Serien
  let colors: string[];
  if (data.series.length === 2 && data.series[1].id.includes("_projected")) {
    // Einzelkonto mit Prognose: Hauptfarbe und gestrichelte Variante
    colors = [themeColors.primary, themeColors.accent];
  } else {
    colors = colorSpectrum;
  }

  return {
    series: data.series.map((s, index) => ({
      name: s.name,
      data: s.data,
      type: "line",
    })),
    chart: {
      type: "line",
      height: "100%",
      width: "100%",
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
        enabled: true,
        type: "x",
        autoScaleYaxis: true,
      },
    },
    colors: colors,
    stroke: {
      width: data.series.map((s, index) =>
        s.id.includes("_projected") ? 2 : 3
      ),
      curve: "smooth",
      dashArray: data.series.map((s, index) =>
        s.id.includes("_projected") ? 5 : 0
      ),
    },
    markers: {
      size: data.series.length === 1 ? 4 : 0,
      strokeColors: colors,
      strokeWidth: 2,
      hover: {
        size: 6,
      },
    },
    xaxis: {
      type: "category",
      labels: {
        style: {
          colors: themeColors.textColor,
          fontSize: isSmallScreen.value ? "10px" : "12px",
          fontFamily: themeColors.fontFamily,
        },
        rotate: isSmallScreen.value ? -45 : 0,
        formatter: (value: string, timestamp?: number, opts?: any) => {
          // Ab 90 Tagen nur Monatsbeschriftungen anzeigen
          if (props.days >= 90) {
            // Parse das Datum - versuche verschiedene Formate
            let date = dayjs(value, "DD.MM.YYYY");
            if (!date.isValid()) {
              date = dayjs(value, "DD.MM");
            }

            if (date.isValid()) {
              // Zeige jeden Monatsersten
              if (date.date() === 1) {
                return date.format("MM YYYY");
              }
              // Für bessere Verteilung auch Mitte des Monats bei sehr langen Zeiträumen
              if (props.days >= 365 && (date.date() === 15)) {
                return "";
              }
            }
            return "";
          }
          return value;
        },
        showDuplicates: false,
        maxHeight: props.days >= 90 ? 60 : undefined,
        // Reduziere die Anzahl der Labels bei längeren Zeiträumen
        ...(props.days >= 90 && {
          hideOverlappingLabels: true,
          trim: false,
        }),
      },
      axisBorder: {
        show: true,
        color: themeColors.base300,
      },
      axisTicks: {
        show: true,
        color: themeColors.base300,
      },
      // Bessere Tick-Verteilung für längere Zeiträume
      ...(props.days >= 90 && {
        tickAmount: Math.min(12, Math.ceil(props.days / 30)),
      }),
    },
    yaxis: {
      title: {
        text: "Kontostand",
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
        color: themeColors.base300,
      },
      axisTicks: {
        show: true,
        color: themeColors.base300,
      },
    },
    legend: {
      show: data.series.length > 1,
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
      position: 'back',
      ...(props.days >= 90 && {
        row: {
          colors: ['transparent'],
          opacity: 0.5
        },
        column: {
          colors: ['transparent'],
          opacity: 0.1
        }
      })
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
          yaxis: {
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
          xaxis: {
            labels: {
              style: {
                fontSize: "9px",
              },
              rotate: -45,
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
  () => [props.accountId, props.days, props.accountGrouping],
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
  <div class="w-full h-full">
    <div
      v-if="!chartData.hasData"
      class="flex items-center justify-center h-full text-base-content/70"
    >
      <div class="text-center">
        <div class="text-lg mb-2">💰</div>
        <div v-if="accountId === 'all' || accountId === 'grouped'">
          Bitte wählen Sie ein Konto aus
        </div>
        <div v-else>Keine Kontodaten verfügbar</div>
      </div>
    </div>
    <div
      v-else
      ref="chartContainer"
      class="w-full h-full"
    ></div>
  </div>
</template>
