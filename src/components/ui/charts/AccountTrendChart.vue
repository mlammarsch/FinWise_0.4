<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { useAccountStore } from "@/stores/accountStore";
import { useMonthlyBalanceStore } from "@/stores/monthlyBalanceStore";
import { usePlanningStore } from "@/stores/planningStore";
import { BalanceService } from "@/services/BalanceService";
import { BudgetService } from "@/services/BudgetService";
import { formatChartCurrency } from "@/utils/chartFormatters";
import ApexCharts from "apexcharts";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import "dayjs/locale/de";

dayjs.extend(isBetween);

dayjs.locale("de");

// Props
const props = withDefaults(defineProps<{
  accountId?: string;
  days?: number;
  accountGrouping?: string; // "all", "grouped", oder spezifische Account-ID
  mode?: string; // "history" (default) oder "forecast"
  showHeader?: boolean; // Zeigt Überschrift und Steuerungen an
}>(), {
  accountId: "all",
  days: 30,
  accountGrouping: "all",
  mode: "history",
  showHeader: true
});

// Stores
const themeStore = useThemeStore();
const accountStore = useAccountStore();
const monthlyBalanceStore = useMonthlyBalanceStore();
const planningStore = usePlanningStore();

// Chart-Referenzen
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;
let themeObserver: MutationObserver | null = null;

// Responsive
const isSmallScreen = ref(false);

// Interne State für autarke Komponente (wenn showHeader = true)
const selectedAccountId = ref(props.accountId || "all");
const accountTrendDays = ref(props.days || 30);
const accountTrendMode = ref(props.mode || "history");

// Konten für das Dropdown
const accounts = computed(() => {
  const activeAccounts = accountStore.activeAccounts.filter(
    (acc) => !acc.isOfflineBudget
  );
  const accountTypes = [
    ...new Set(activeAccounts.map((acc) => acc.accountType)),
  ];

  return {
    all: activeAccounts,
    types: accountTypes,
  };
});

// Account-Filter-Optionen
const getAccountFilterLabel = (accountId: string) => {
  if (accountId === "all") return "Alle Konten";
  if (accountId === "grouped") return "Nach Typ gruppiert";

  const account = accountStore.getAccountById(accountId);
  return account ? account.name : "Unbekanntes Konto";
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
  // Verwende interne State wenn showHeader=true, sonst Props
  const currentAccountId = props.showHeader ? selectedAccountId.value : props.accountId;
  const currentDays = props.showHeader ? accountTrendDays.value : props.days;
  const currentMode = props.showHeader ? accountTrendMode.value : (props.mode || "history");

  let startDate: Date, endDate: Date;

  if (currentMode === "forecast") {
    // Prognose: Von heute in die Zukunft
    startDate = new Date();
    endDate = new Date();
    endDate.setDate(endDate.getDate() + currentDays);
  } else {
    // Vergangenheit: Von X Tagen zurück bis heute
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(startDate.getDate() - currentDays);
  }

  const dateFormat = getDateFormat(currentDays);

  let series: Array<{
      name: string;
      data: Array<{ x: string | number; y: number }>;
      id: string;
    }> = [];

  if (currentAccountId === "all") {
    // Alle Konten einzeln anzeigen
    const activeAccounts = accountStore.activeAccounts.filter(
      (acc) => !acc.isOfflineBudget
    );

    activeAccounts.forEach((account) => {
      if (currentMode === "forecast") {
        // Prognose: Verwende getRunningBalances für tagesgenaue Prognosen
        const balances = BalanceService.getRunningBalances(
          "account",
          account.id,
          [startDate, endDate],
          { includeProjection: true }
        );

        const forecastData = balances
          .filter((balance) => balance.projected !== undefined)
          .map((balance) => ({
            x: dayjs(balance.date).valueOf(),
            y: Math.round(balance.projected!),
          }));

        if (forecastData.length > 0) {
          series.push({
            name: `${account.name} (Prognose)`,
            data: forecastData,
            id: `${account.id}_forecast`,
          });
        }
      } else {
        // Vergangenheit: Verwende BalanceService für echte Kontostände
        const balances = BalanceService.getRunningBalances(
          "account",
          account.id,
          [startDate, endDate],
          { includeProjection: false }
        );

        const data = balances.map((balance) => ({
          x: dayjs(balance.date).valueOf(),
          y: Math.round(balance.balance),
        }));

        series.push({
          name: account.name,
          data,
          id: account.id,
        });
      }
    });
  } else if (currentAccountId === "grouped") {
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
        if (currentMode === "forecast") {
          // Prognose: Verwende getRunningBalances für tagesgenaue Prognosen
          const balances = BalanceService.getRunningBalances(
            "account",
            account.id,
            [startDate, endDate],
            { includeProjection: true }
          );

          balances
            .filter((balance) => balance.projected !== undefined)
            .forEach((balance) => {
              const dateKey = balance.date;
              if (!combinedBalances[dateKey]) {
                combinedBalances[dateKey] = 0;
              }
              combinedBalances[dateKey] += balance.projected!;
            });
        } else {
          // Vergangenheit: Verwende BalanceService
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
        }
      });

      const data = Object.entries(combinedBalances)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, balance]) => ({
          x: dayjs(date).valueOf(),
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
    const account = accountStore.getAccountById(currentAccountId);
    if (account) {
      if (currentMode === "forecast") {
        // Prognose: Berechne echte Prognose-Salden basierend auf aktuellem Saldo + geplante Transaktionen
        const currentBalance = BalanceService.getTodayBalance("account", currentAccountId);
        const data: Array<{ x: number; y: number }> = [];

        let runningBalance = currentBalance;
        let current = dayjs(startDate);
        const end = dayjs(endDate);

        // Hole alle geplanten Transaktionen für den Zeitraum aus planningStore
        const allPlannedTransactions = planningStore.getUpcomingTransactions(currentDays + 30);
        const accountPlannedTransactions = allPlannedTransactions.filter(tx => {
          const txDate = dayjs(tx.date);
          return tx.transaction?.accountId === currentAccountId &&
                 txDate.isSameOrAfter(dayjs(startDate)) &&
                 txDate.isSameOrBefore(dayjs(endDate));
        });

        while (current.isSameOrBefore(end)) {
          const currentDate = current.format('YYYY-MM-DD');

          // Addiere alle geplanten Transaktionen für diesen Tag
          const dayTransactions = accountPlannedTransactions.filter(tx =>
            dayjs(tx.date).format('YYYY-MM-DD') === currentDate
          );

          dayTransactions.forEach(tx => {
            runningBalance += tx.transaction?.amount || 0;
          });

          data.push({
            x: current.valueOf(),
            y: Math.round(runningBalance),
          });

          current = current.add(1, 'day');
        }

        if (data.length > 0) {
          series.push({
            name: `${account.name} (Prognose)`,
            data,
            id: `${account.id}_forecast`,
          });
        }
      } else {
        // Vergangenheit: Verwende BalanceService für echte Kontostände
        const balances = BalanceService.getRunningBalances(
          "account",
          currentAccountId,
          [startDate, endDate],
          { includeProjection: false }
        );

        const actualData = balances.map((balance) => ({
          x: dayjs(balance.date).valueOf(),
          y: Math.round(balance.balance),
        }));

        series.push({
          name: account.name,
          data: actualData,
          id: account.id,
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
        (s.id.includes("_projected") || s.id.includes("_forecast") || ((props.showHeader ? accountTrendMode.value : props.mode) === "forecast")) ? 2 : 3
      ),
      curve: "smooth",
      dashArray: data.series.map((s, index) =>
        (s.id.includes("_projected") || s.id.includes("_forecast") || ((props.showHeader ? accountTrendMode.value : props.mode) === "forecast")) ? 5 : 0
      ),
    },
    markers: {
      size: 0, // Keine Wertepunkte anzeigen
      strokeColors: colors,
      strokeWidth: 2,
      hover: {
        size: 6,
      },
    },
    xaxis: {
      type: "datetime",
      labels: {
        style: {
          colors: themeColors.textColor,
          fontSize: isSmallScreen.value ? "10px" : "12px",
          fontFamily: themeColors.fontFamily,
        },
        rotate: isSmallScreen.value ? -45 : 0,
        formatter: (value: string | number, timestamp?: number, opts?: any) => {
          const date = dayjs(typeof value === 'number' ? value : parseInt(value));
          if ((props.showHeader ? accountTrendDays.value : props.days) >= 90) {
            return date.format("MM/YYYY");
          } else if ((props.showHeader ? accountTrendDays.value : props.days) <= 30) {
            return date.format("DD.MM");
          } else {
            return date.format("DD.MM.YYYY");
          }
        },
        showDuplicates: false,
        maxHeight: (props.showHeader ? accountTrendDays.value : props.days) >= 90 ? 60 : undefined,
        datetimeUTC: false,
        datetimeFormatter: {
          year: 'yyyy',
          month: (props.showHeader ? accountTrendDays.value : props.days) >= 90 ? 'MM/yyyy' : 'MMM',
          day: (props.showHeader ? accountTrendDays.value : props.days) <= 30 ? 'dd.MM' : 'dd.MM.yyyy',
          hour: 'HH:mm'
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
      // Tick-Anzahl je nach Zeitraum
      tickAmount: (props.showHeader ? accountTrendDays.value : props.days) >= 90
        ? Math.min(Math.ceil((props.showHeader ? accountTrendDays.value : props.days) / 30), 12)
        : (props.showHeader ? accountTrendDays.value : props.days) <= 7
          ? (props.showHeader ? accountTrendDays.value : props.days)
          : Math.min(Math.ceil((props.showHeader ? accountTrendDays.value : props.days) / 3), 15),
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
      // Bessere Skalierung je nach Zeitraum
      forceNiceScale: true,
      floating: false,
      // Für kürzere Zeiträume mehr Kontrolle über die Tick-Anzahl
      ...((props.showHeader ? accountTrendDays.value : props.days) < 90 && {
        tickAmount: 6,
        decimalsInFloat: 0,
      }),
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
  () => [props.accountId, props.days, props.accountGrouping, props.mode],
  () => {
    updateChart();
  },
  { deep: true }
);

// Watchers für interne State (wenn showHeader = true)
watch(
  () => [selectedAccountId.value, accountTrendDays.value, accountTrendMode.value],
  () => {
    if (props.showHeader) {
      updateChart();
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

// Lifecycle
onMounted(() => {
  updateScreenSize();
  window.addEventListener("resize", updateScreenSize);

  // Setze das erste aktive Konto als Standard (nur wenn showHeader = true)
  if (props.showHeader && accounts.value.all.length > 0) {
    selectedAccountId.value = accounts.value.all[0].id;
  }

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
  <div v-if="showHeader" class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150">
    <div class="card-body">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <h3 class="card-title text-lg">Kontoentwicklung</h3>

        <div class="flex gap-1">
          <!-- Konto-Auswahl -->
          <select
            v-model="selectedAccountId"
            class="select select-bordered select-xs"
          >
            <option value="all">Alle Konten</option>
            <option value="grouped">Nach Typ gruppiert</option>
            <optgroup
              v-for="accountType in accounts.types"
              :key="accountType"
              :label="`${accountType} Konten`"
            >
              <option
                v-for="account in accounts.all.filter(
                  (acc) => acc.accountType === accountType
                )"
                :key="account.id"
                :value="account.id"
              >
                {{ account.name }}
              </option>
            </optgroup>
          </select>

          <!-- Modus-Auswahl -->
          <select
            v-model="accountTrendMode"
            class="select select-bordered select-xs"
          >
            <option value="history">Vergangenheit</option>
            <option value="forecast">Prognose</option>
          </select>

          <!-- Zeitraum-Auswahl -->
          <select
            v-model="accountTrendDays"
            class="select select-bordered select-xs"
          >
            <option :value="7">7 Tage</option>
            <option :value="30">30 Tage</option>
            <option :value="90">90 Tage</option>
            <option :value="180">180 Tage</option>
            <option :value="365">1 Jahr</option>
          </select>
        </div>
      </div>

      <div class="h-64">
        <div
          v-if="!chartData.hasData"
          class="flex items-center justify-center h-full text-base-content/70"
        >
          <div class="text-center">
            <div class="text-lg mb-2">💰</div>
            <div v-if="selectedAccountId === 'all' || selectedAccountId === 'grouped'">
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
    </div>
  </div>

  <!-- Fallback für showHeader = false -->
  <div v-else class="w-full h-full">
    <div
      v-if="!chartData.hasData"
      class="flex items-center justify-center h-full text-base-content/70"
    >
      <div class="text-center">
        <div class="text-lg mb-2">💰</div>
        <div v-if="(showHeader ? selectedAccountId : accountId) === 'all' || (showHeader ? selectedAccountId : accountId) === 'grouped'">
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
