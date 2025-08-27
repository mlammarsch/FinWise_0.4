<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { BalanceService } from "@/services/BalanceService";
import { TransactionService } from "@/services/TransactionService";
import { PlanningService } from "@/services/PlanningService";
import { useAccountStore } from "@/stores/accountStore";
import { usePlanningStore } from "@/stores/planningStore";
import { formatChartCurrency } from "@/utils/chartFormatters";
import { TransactionType } from "@/types";
import ApexCharts from "apexcharts";
import dayjs from "dayjs";
import "dayjs/locale/de";

dayjs.locale("de");

// Props
const props = defineProps<{
  months?: number | string;
  showHeader?: boolean;
}>();

// Interne State für eigenständige Komponente
const trendMonths = ref(props.months || 3);

// Stores
const themeStore = useThemeStore();
const accountStore = useAccountStore();
const planningStore = usePlanningStore();

// Chart-Referenzen
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;
let themeObserver: MutationObserver | null = null;

// Responsive
const isSmallScreen = ref(false);

// Zoom-Funktionalität
const zoomLevel = ref(1);
const minZoom = 0.1;
const maxZoom = 10;

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

// Hilfsfunktion für X-Achsen-Skalierung
const getAxisInterval = (totalMonths: number) => {
  if (totalMonths <= 12) return 1; // Monatlich
  if (totalMonths <= 24) return 2; // Alle 2 Monate
  if (totalMonths <= 36) return 3; // Alle 3 Monate
  if (totalMonths <= 60) return 6; // Halbjährlich
  return 12; // Jährlich
};

// Y-Achsen-Zoom-State
const yAxisZoom = ref(1);

// Zoom-Funktionen für vertikale Y-Achsen-Skalierung
const zoomIn = () => {
  if (zoomLevel.value < maxZoom) {
    zoomLevel.value = Math.min(zoomLevel.value * 1.2, maxZoom);
    yAxisZoom.value = Math.min(yAxisZoom.value * 1.2, maxZoom);
    updateChart();
  }
};

const zoomOut = () => {
  if (zoomLevel.value > minZoom) {
    zoomLevel.value = Math.max(zoomLevel.value / 1.2, minZoom);
    yAxisZoom.value = Math.max(yAxisZoom.value / 1.2, minZoom);
    updateChart();
  }
};

// Intelligente Y-Achsen-Skalierung für rechte Achse mit 0-Zentrierung
const calculateYAxisTicks = (min: number, max: number, zoomFactor: number = 1) => {
  // Bestimme den größeren Absolutwert für symmetrische Skalierung um 0
  const maxAbsValue = Math.max(Math.abs(min), Math.abs(max));

  // Wende Zoom-Faktor an, aber mit erweiterten Mindestbereichen
  const zoomedMaxAbs = Math.max(maxAbsValue / zoomFactor, 200); // Mindestens 200€ Bereich

  // Bestimme Tick-Intervall basierend auf gezoomtem Bereich
  let tickInterval: number;
  if (zoomedMaxAbs <= 500) {
    tickInterval = 50;   // 50er Schritte bis 500€
  } else if (zoomedMaxAbs <= 1000) {
    tickInterval = 100;  // 100er Schritte bis 1k
  } else if (zoomedMaxAbs <= 5000) {
    tickInterval = 500;  // 500er Schritte bis 5k
  } else if (zoomedMaxAbs <= 10000) {
    tickInterval = 1000; // 1k Schritte bis 10k
  } else {
    tickInterval = 10000; // 10k Schritte darüber
  }

  // Berechne symmetrische Min/Max um 0 herum mit ausreichend Puffer
  const steps = Math.ceil(zoomedMaxAbs / tickInterval);
  const symmetricMax = Math.max(steps * tickInterval, tickInterval * 2); // Mindestens 2 Tick-Intervalle
  const symmetricMin = -symmetricMax;

  // Stelle sicher, dass die ursprünglichen Daten immer sichtbar sind
  const dataMax = Math.max(Math.abs(min), Math.abs(max));
  if (symmetricMax < dataMax * 1.1) { // 10% Puffer über den Daten
    const adjustedSteps = Math.ceil((dataMax * 1.1) / tickInterval);
    const adjustedMax = adjustedSteps * tickInterval;
    return {
      min: -adjustedMax,
      max: adjustedMax,
      tickAmount: Math.ceil((adjustedMax * 2) / tickInterval),
      tickInterval
    };
  }

  return {
    min: symmetricMin,
    max: symmetricMax,
    tickAmount: Math.ceil((symmetricMax - symmetricMin) / tickInterval),
    tickInterval
  };
};

// NetWorth-Daten berechnen
const chartData = computed(() => {
  // Cache für aktuellen Monat invalidieren, um aktuelle Daten zu gewährleisten
  // Dies stellt sicher, dass bei jeder Neuberechnung die neuesten Transaktionen berücksichtigt werden
  BalanceService.invalidateCurrentMonthCache();

  const now = dayjs();
  const todayMonth = now.startOf("month");

  let startMonth: dayjs.Dayjs;
  let endMonth: dayjs.Dayjs;
  let showProjection = false;

  // Bestimme Zeitraum basierend auf trendMonths
  if (trendMonths.value === "all") {
    // Alle verfügbaren Daten - nur Vergangenheit
    // Finde älteste Transaktion für Startdatum
    const oldestDate = dayjs().subtract(60, "month"); // Fallback: 5 Jahre zurück
    startMonth = oldestDate.startOf("month");
    endMonth = todayMonth;
  } else {
    const monthsNum =
      typeof trendMonths.value === "string" ? parseInt(trendMonths.value) : trendMonths.value;

    if (monthsNum < 0) {
      // Negative Werte: Nur Vergangenheit
      startMonth = now.subtract(Math.abs(monthsNum), "month").startOf("month");
      endMonth = todayMonth;
    } else {
      // Positive Werte: Vergangenheit + Zukunft mit Prognose
      startMonth = now.subtract(Math.abs(monthsNum), "month").startOf("month");
      endMonth = now.add(Math.abs(monthsNum), "month").startOf("month");
      showProjection = true;
    }
  }

  const labels: string[] = [];
  const actualData: (number | null)[] = [];
  const projectedData: (number | null)[] = [];
  const incomeData: number[] = [];
  const expenseData: number[] = [];
  const plannedIncomeData: number[] = [];
  const plannedExpenseData: number[] = [];

  let currentMonth = startMonth;
  const totalMonths = endMonth.diff(startMonth, "month") + 1;
  const axisInterval = getAxisInterval(totalMonths);

  while (currentMonth.isSameOrBefore(endMonth)) {
    // Label nur bei entsprechendem Intervall anzeigen
    const monthIndex = currentMonth.diff(startMonth, "month");
    const showLabel =
      monthIndex % axisInterval === 0 || currentMonth.isSame(endMonth);

    const monthLabel = showLabel
      ? `${getGermanMonthName(currentMonth)} ${currentMonth.format("YY")}`
      : "";
    labels.push(monthLabel);

    const monthStart = currentMonth.startOf("month").format("YYYY-MM-DD");
    const monthEndStr = currentMonth.endOf("month").format("YYYY-MM-DD");
    const monthEnd = currentMonth.endOf("month").toDate();

    // Für aktuellen Monat: Verwende heutiges Datum als Stichtag für NetWorth
    // Für vergangene/zukünftige Monate: Verwende Monatsende
    const isCurrentMonth = currentMonth.isSame(todayMonth, 'month');
    const netWorthStichtag = isCurrentMonth ? now.toDate() : monthEnd;

    // Berechne NetWorth (Gesamtsaldo aller aktiven Konten außer Offline-Budget)
    const actualNetWorth = BalanceService.getTotalBalance(netWorthStichtag, false);
    const projectedNetWorth = BalanceService.getTotalBalance(netWorthStichtag, true);

    // Berechne Einnahmen/Ausgaben für diesen Monat
    const monthSummary = TransactionService.getIncomeExpenseSummary(
      monthStart,
      monthEndStr
    );

    if (currentMonth.isSameOrBefore(todayMonth)) {
      // Vergangenheit und Gegenwart: Nur tatsächliche Werte
      incomeData.push(Math.round(monthSummary.income));
      expenseData.push(Math.round(-Math.abs(monthSummary.expense))); // Ausgaben als negative Werte
      plannedIncomeData.push(0);
      plannedExpenseData.push(0);
      actualData.push(Math.round(actualNetWorth));
      projectedData.push(null);
    } else if (showProjection) {
      // Zukunft: Planungsdaten berechnen
      const plannedSummary = PlanningService.calculatePlannedIncomeExpense(
        monthStart,
        monthEndStr
      );

      incomeData.push(0);
      expenseData.push(0);
      plannedIncomeData.push(Math.round(plannedSummary.income));
      plannedExpenseData.push(Math.round(-Math.abs(plannedSummary.expense)));
      actualData.push(null);
      projectedData.push(Math.round(projectedNetWorth));
    } else {
      // Kein Zukunftsdaten wenn nicht gewünscht
      incomeData.push(Math.round(monthSummary.income));
      expenseData.push(Math.round(-Math.abs(monthSummary.expense)));
      plannedIncomeData.push(0);
      plannedExpenseData.push(0);
      actualData.push(null);
      projectedData.push(null);
    }

    currentMonth = currentMonth.add(1, "month");
  }

  return {
    labels,
    actualData,
    projectedData,
    incomeData,
    expenseData,
    plannedIncomeData,
    plannedExpenseData,
    showProjection,
    hasData:
      actualData.some((val) => val !== null && val !== 0) ||
      projectedData.some((val) => val !== null && val !== 0) ||
      incomeData.some((val) => val !== 0) ||
      expenseData.some((val) => val !== 0) ||
      plannedIncomeData.some((val) => val !== 0) ||
      plannedExpenseData.some((val) => val !== 0),
  };
});

// Chart-Optionen
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();

  if (!data.hasData) {
    return null;
  }

  // Erstelle Series-Daten
  const series = [
    // Gestapelte Balken für Einnahmen/Ausgaben (Y2-Achse)
    {
      name: "Einnahmen",
      type: "column",
      data: data.incomeData,
      yAxisIndex: 1,
    },
    {
      name: "Ausgaben",
      type: "column",
      data: data.expenseData,
      yAxisIndex: 1,
    },
    // NetWorth-Linien (Y1-Achse)
    {
      name: "NetWorth (Ist)",
      type: "line",
      data: data.actualData,
      yAxisIndex: 0,
    },
  ];

  // Füge Planungsdaten hinzu, wenn Projektionen angezeigt werden sollen
  if (data.showProjection) {
    // Geplante Einnahmen/Ausgaben mit 70% Opacity
    series.push(
      {
        name: "Einnahmen (geplant)",
        type: "column",
        data: data.plannedIncomeData,
        yAxisIndex: 1,
      },
      {
        name: "Ausgaben (geplant)",
        type: "column",
        data: data.plannedExpenseData,
        yAxisIndex: 1,
      }
    );

    // Für nahtlosen Übergang: Letzter Ist-Wert als erster Prognose-Wert
    let lastActualValue = null;
    for (let i = data.actualData.length - 1; i >= 0; i--) {
      if (data.actualData[i] !== null) {
        lastActualValue = data.actualData[i];
        break;
      }
    }
    const projectedDataWithTransition = data.projectedData.map((val, index) => {
      if (val !== null && index > 0 && data.projectedData[index - 1] === null) {
        // Erster Prognose-Wert: Verwende letzten Ist-Wert für Kontinuität
        return lastActualValue;
      }
      return val;
    });

    series.push({
      name: "NetWorth (Prognose)",
      type: "line",
      data: projectedDataWithTransition,
      yAxisIndex: 0,
    });
  }

  return {
    series,
    chart: {
      type: "line",
      height: "100%",
      width: "100%",
      stacked: true, // Für gestapelte Balken
      background: "transparent",
      foreColor: themeColors.textColor,
      fontFamily: themeColors.fontFamily,
      toolbar: {
        show: false,
      },
      animations: {
        enabled: false, // Animationen deaktiviert für bessere Zoom-Performance
      },
      zoom: {
        enabled: false, // ApexCharts Zoom deaktiviert, wir verwenden eigene Implementierung
      },
      events: {
        mounted: (chartContext: any, config: any) => {
          // Custom Zoom-Implementierung nach Chart-Mount
        },
        wheel: (event: any, chartContext: any, config: any) => {
          event.preventDefault();
          const delta = event.deltaY;
          if (delta < 0) {
            zoomIn();
          } else {
            zoomOut();
          }
        },
      },
    },
    colors: data.showProjection
      ? [
          themeColors.success, // Einnahmen
          themeColors.error, // Ausgaben
          themeColors.primary, // NetWorth (Ist)
          themeColors.success, // Einnahmen (geplant)
          themeColors.error, // Ausgaben (geplant)
          themeColors.primary, // NetWorth (Prognose)
        ]
      : [themeColors.success, themeColors.error, themeColors.primary],
    stroke: {
      width: data.showProjection ? [0, 0, 3, 0, 0, 3] : [0, 0, 3], // Balken: 0, Linien: 3
      curve: "smooth",
      dashArray: data.showProjection ? [0, 0, 0, 0, 0, 8] : [0, 0, 0], // Nur Prognose-Linie gestrichelt
    },
    fill: {
      opacity: data.showProjection
        ? [0.85, 0.85, 1, 0.7, 0.7, 0.8]
        : [0.85, 0.85, 1],
      type: data.showProjection
        ? ["solid", "solid", "solid", "solid", "solid", "solid"]
        : ["solid", "solid", "solid"],
    },
    plotOptions: {
      bar: {
        columnWidth: isSmallScreen.value ? "70%" : "50%",
        borderRadius: 0,
      },
    },
    labels: data.labels,
    markers: {
      size: data.showProjection ? [0, 0, 0, 0, 0, 0] : [0, 0, 0], // Keine Marker für Linien
      strokeColors: data.showProjection
        ? [
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
          ]
        : [themeColors.primary, themeColors.primary, themeColors.primary],
      strokeWidth: 2,
      fillColors: data.showProjection
        ? [
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
            themeColors.primary,
          ]
        : [themeColors.primary, themeColors.primary, themeColors.primary],
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
        // Y1-Achse für NetWorth-Linien - KEIN ZOOM
        seriesName: data.showProjection
          ? ["NetWorth (Ist)", "NetWorth (Prognose)"]
          : ["NetWorth (Ist)"],
        title: {
          text: "NetWorth (€)",
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
        // NetWorth-Achse wird NICHT gezoomed - automatische Skalierung
        forceNiceScale: true,
      },
      {
        // Y2-Achse für Einnahmen/Ausgaben-Balken
        seriesName: data.showProjection
          ? [
              "Einnahmen",
              "Ausgaben",
              "Einnahmen (geplant)",
              "Ausgaben (geplant)",
            ]
          : ["Einnahmen", "Ausgaben"],
        opposite: true,
        title: {
          text: "Einnahmen / Ausgaben (€)",
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
        // Intelligente Skalierung mit 0-Zentrierung und Zoom-Integration
        ...(() => {
          // Berechne Min/Max aus den Daten
          const allValues = [
            ...data.incomeData,
            ...data.expenseData,
            ...data.plannedIncomeData,
            ...data.plannedExpenseData
          ].filter(val => val !== 0);

          if (allValues.length === 0) {
            // Fallback: Symmetrische Skalierung um 0
            const ticks = calculateYAxisTicks(-1000, 1000, yAxisZoom.value);
            return {
              min: ticks.min,
              max: ticks.max,
              tickAmount: Math.min(ticks.tickAmount, 10),
              forceNiceScale: false,
            };
          }

          const min = Math.min(...allValues);
          const max = Math.max(...allValues);
          const ticks = calculateYAxisTicks(min, max, yAxisZoom.value);

          return {
            min: ticks.min,
            max: ticks.max,
            tickAmount: Math.min(ticks.tickAmount, 10), // Maximal 10 Ticks
            forceNiceScale: false,
          };
        })(),
      },
    ],
    legend: {
      show: false, // Legende entfernt für mehr Platz
    },
    tooltip: {
      theme: themeStore.isDarkMode ? "dark" : "light",
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number, opts: any) => {
          // Filtere null/undefined Werte
          if (val === null || val === undefined) {
            return undefined; // Eintrag wird nicht angezeigt
          }

          const seriesName = opts.w.globals.seriesNames[opts.seriesIndex];

          // Filtere 0-Werte bei Einnahmen/Ausgaben (aber nicht bei NetWorth)
          if (val === 0 && (seriesName.includes('Einnahmen') || seriesName.includes('Ausgaben'))) {
            return undefined;
          }

          // Filtere basierend auf Serie-Namen für bessere Trennung
          // Vergangenheit: Keine geplanten Werte anzeigen
          // Zukunft: Keine Ist-Werte anzeigen (außer NetWorth Ist für Kontinuität)
          if (seriesName.includes('geplant') && val === 0) {
            return undefined;
          }

          return formatChartCurrency(val);
        },
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
    annotations: {
      yaxis: [
        {
          // Nulllinie für NetWorth (Y1-Achse)
          y: 0,
          yAxisIndex: 0,
          borderColor: themeColors.primary,
          borderWidth: 1,
          strokeDashArray: 0,
          opacity: 1,
        },
        {
          // Nulllinie für Ein-/Ausgaben (Y2-Achse)
          y: 0,
          yAxisIndex: 1,
          borderColor: themeColors.success,
          borderWidth: 1,
          strokeDashArray: 0,
          opacity: 1,
        },
      ],
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
  () => trendMonths.value,
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

// Watcher für Account-Änderungen
watch(
  () => accountStore.accounts,
  () => {
    updateChart();
  },
  { deep: true }
);

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
  <div class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150">
    <div class="card-body">
      <!-- Header mit Überschrift, Zoom-Controls und Dropdown -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <h3 class="card-title text-lg">Nettovermögensentwicklung</h3>

        <div class="flex items-center gap-2">
          <!-- Zoom Controls - kleinere Buttons mittig positioniert -->
          <button
            @click="zoomOut"
            :disabled="zoomLevel <= minZoom"
            class="btn btn-xs btn-ghost btn-circle"
            :class="{ 'opacity-50 cursor-not-allowed': zoomLevel <= minZoom }"
            title="Herauszoomen"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
            </svg>
          </button>
          <button
            @click="zoomIn"
            :disabled="zoomLevel >= maxZoom"
            class="btn btn-xs btn-ghost btn-circle"
            :class="{ 'opacity-50 cursor-not-allowed': zoomLevel >= maxZoom }"
            title="Hineinzoomen"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>

          <!-- Zeitraum-Auswahl -->
          <select
            v-model="trendMonths"
            class="select select-bordered select-xs"
          >
            <option value="all">Alle</option>
            <option :value="-3">3 Monate</option>
            <option :value="-6">6 Monate</option>
            <option :value="-12">12 Monate</option>
            <option :value="3">+ 3 Monate</option>
            <option :value="6">+ 6 Monate</option>
            <option :value="12">+ 12 Monate</option>
          </select>
        </div>
      </div>

      <!-- Chart Container -->
      <div class="h-64">
        <div
          v-if="!chartData.hasData"
          class="flex items-center justify-center h-full text-base-content/70"
        >
          <div class="text-center">
            <div class="text-lg mb-2">💰</div>
            <div>Keine NetWorth-Daten verfügbar</div>
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
