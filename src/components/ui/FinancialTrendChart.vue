<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useTransactionStore } from "@/stores/transactionStore";
import { useAccountStore } from "@/stores/accountStore";
import { BalanceService } from "@/services/BalanceService";
import type { Transaction, Account } from "../../types/index";
import { TransactionType } from "../../types/index";
import dayjs from "dayjs";
import "dayjs/locale/de";

// ApexCharts importieren
import ApexCharts from "apexcharts";

dayjs.locale("de");

// Funktion zum Abrufen der CSS-Variablen-Werte mit korrekten DaisyUI v5 Variablennamen
const getCSSVariableValue = (variableName: string): string => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variableName)
    .trim();

  // Fallback falls Variable nicht gefunden wird
  if (!value) {
    console.warn(`CSS Variable ${variableName} not found`);
    return "#000000"; // Fallback-Farbe
  }

  // OKLCH-Werte in RGB konvertieren falls nötig
  if (value.startsWith("oklch(")) {
    return value;
  }

  // Für DaisyUI v5 OKLCH-Format
  if (value.includes("%") && value.includes(" ")) {
    return `oklch(${value})`;
  }

  return value;
};

// Dynamische Farben basierend auf dem aktuellen Theme mit korrekten DaisyUI v5 Variablennamen
const getThemeColors = () => {
  return {
    success: getCSSVariableValue("--color-success"),
    error: getCSSVariableValue("--color-error"),
    warning: getCSSVariableValue("--color-warning"),
    baseContent: getCSSVariableValue("--color-base-content"),
    primary: getCSSVariableValue("--color-primary"),
    secondary: getCSSVariableValue("--color-secondary"),
    accent: getCSSVariableValue("--color-accent"),
    base100: getCSSVariableValue("--color-base-100"),
    base200: getCSSVariableValue("--color-base-200"),
    base300: getCSSVariableValue("--color-base-300"),
  };
};

const transactionStore = useTransactionStore();
const accountStore = useAccountStore();

// Formatierungsfunktion für kompakte Darstellung (3k€ statt 3.000,00€)
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

const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;

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

// Berechne die letzten 6 Monate Daten
const chartData = computed(() => {
  const months = [];
  const incomeData = [];
  const expenseData = [];
  const balanceData = [];
  const labels = [];

  const now = dayjs();

  for (let i = 5; i >= 0; i--) {
    const month = now.subtract(i, "month");
    const startOfMonth = month.startOf("month").format("YYYY-MM-DD");
    const endOfMonthStr = month.endOf("month").format("YYYY-MM-DD");

    // Kontostand am Ende des Monats über BalanceService
    const endOfMonth = month.endOf("month").toDate();
    const monthBalance = BalanceService.getTotalBalance(endOfMonth, false);

    // Transaktionen für diesen Monat filtern (ohne CATEGORYTRANSFER)
    const monthTransactions = transactionStore.transactions.filter(
      (tx: Transaction) => {
        const txDate = dayjs(tx.date);
        return (
          txDate.isAfter(dayjs(startOfMonth).subtract(1, "day")) &&
          txDate.isBefore(dayjs(endOfMonthStr).add(1, "day")) &&
          tx.type !== TransactionType.CATEGORYTRANSFER
        );
      }
    );

    // Einnahmen und Ausgaben berechnen
    let income = 0;
    let expense = 0;

    monthTransactions.forEach((tx: Transaction) => {
      if (tx.amount > 0) {
        income += tx.amount;
      } else {
        expense += Math.abs(tx.amount);
      }
    });

    labels.push(getGermanMonthName(month));
    incomeData.push(Math.round(income));
    expenseData.push(Math.round(expense));
    balanceData.push(Math.round(monthBalance));
  }

  // Min/Max für dynamische Y-Achsen-Skalierung berechnen
  const minBalance = Math.min(...balanceData);
  const maxBalance = Math.max(...balanceData);
  const balanceRange = maxBalance - minBalance;
  const balancePadding = balanceRange * 0.1; // 10% Padding

  // Betrag-Achse: Immer bei 0 beginnen, Maximum basierend auf höchstem Wert
  const maxAmount = Math.max(...incomeData, ...expenseData);
  const amountPadding = maxAmount * 0.1; // 10% Padding

  return {
    labels,
    incomeData,
    expenseData,
    balanceData,
    minBalance: minBalance - balancePadding,
    maxBalance: maxBalance + balancePadding,
    maxAmount: maxAmount + amountPadding,
  };
});

// Chart-Konfiguration
const chartOptions = computed(() => {
  const data = chartData.value;
  const themeColors = getThemeColors();

  return {
    series: [
      {
        name: "Einnahmen",
        type: "column",
        data: data.incomeData,
        yAxisIndex: 1, // Rechte Y-Achse für Balken
      },
      {
        name: "Ausgaben",
        type: "column",
        data: data.expenseData,
        yAxisIndex: 1, // Rechte Y-Achse für Balken
      },
      {
        name: "Kontosaldo",
        type: "line",
        data: data.balanceData,
        yAxisIndex: 0, // Linke Y-Achse für Linie
      },
    ],
    chart: {
      height: 350,
      type: "line",
      stacked: false,
      background: "transparent",
      foreColor: themeColors.baseContent, // Globale Textfarbe für alle Chart-Elemente
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
      },
    },
    colors: [
      themeColors.success, // success (grün) für Einnahmen
      themeColors.error, // error (rot) für Ausgaben
      themeColors.warning, // warning (orange) für Kontostand-Linie
    ],
    stroke: {
      width: [0, 0, 4], // Dünnere Linie für Kontostand
      curve: "smooth",
    },
    plotOptions: {
      bar: {
        columnWidth: "100%", // Breitere Balken
        borderRadius: 3,
      },
    },
    fill: {
      opacity: [0.85, 0.85, 1],
      type: ["solid", "solid", "solid"],
    },
    labels: data.labels,
    markers: {
      size: [0, 0, 0], // Keine Punkte auf der Linie
      strokeWidth: [0, 0, 0],
      strokeColors: ["transparent", "transparent", "transparent"],
      fillColors: ["transparent", "transparent", "transparent"],
    },
    xaxis: {
      type: "category",
      labels: {
        style: {
          colors: [themeColors.baseContent],
          fontSize: "12px",
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: [
      {
        title: {
          text: "Kontostand (€)",
          style: {
            color: themeColors.baseContent,
            fontSize: "12px",
          },
        },
        labels: {
          style: {
            colors: [themeColors.baseContent],
            fontSize: "11px",
          },
          formatter: function (val: number) {
            return formatCurrency(val);
          },
        },
        seriesName: "Kontostand",
        min: data.minBalance,
        max: data.maxBalance,
      },
      {
        opposite: true,
        title: {
          text: "Betrag (€)",
          style: {
            color: themeColors.baseContent,
            fontSize: "12px",
          },
        },
        labels: {
          style: {
            colors: [themeColors.baseContent],
            fontSize: "11px",
          },
          formatter: function (val: number) {
            return formatCurrency(val);
          },
        },
        seriesName: ["Einnahmen", "Ausgaben"],
        min: 0, // Immer bei 0 beginnen
        max: data.maxAmount, // Maximum basierend auf höchstem Ein-/Ausgabenwert
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      theme:
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dark"
          : "light", // Dynamisches Theme
      style: {
        fontSize: "12px",
      },
      y: {
        formatter: function (val: number, opts: any) {
          if (opts.seriesIndex === 2) {
            // Kontostand-Linie
            return formatCurrency(val);
          }
          return formatCurrency(val);
        },
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "center",
      fontSize: "12px",
      labels: {
        colors: [themeColors.baseContent],
      },
      markers: {
        width: 12,
        height: 12,
        radius: 2,
      },
    },
    grid: {
      borderColor: themeColors.base300, // Dynamische Grid-Farbe mit DaisyUI v5
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
    dataLabels: {
      enabled: false,
    },
  };
});

// Chart erstellen und aktualisieren
const createChart = () => {
  if (chartContainer.value && !chart) {
    chart = new ApexCharts(chartContainer.value, chartOptions.value);
    chart.render();
  }
};

const updateChart = () => {
  if (chart) {
    chart.updateOptions(chartOptions.value, true);
  }
};

// Watchers für Datenänderungen
watch(
  chartData,
  () => {
    updateChart();
  },
  { deep: true }
);

// Theme-Änderungen überwachen - verbesserte Implementierung
const themeWatcher = ref<string | null>(null);

// MutationObserver für data-theme Änderungen
let themeObserver: MutationObserver | null = null;

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
        const newTheme = document.documentElement.getAttribute("data-theme");
        if (newTheme !== themeWatcher.value) {
          themeWatcher.value = newTheme;
          // Kurze Verzögerung, damit CSS-Variablen aktualisiert werden
          setTimeout(() => {
            updateChart();
          }, 50);
        }
      }
    });
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  // Initialer Theme-Wert
  themeWatcher.value = document.documentElement.getAttribute("data-theme");
};

onMounted(() => {
  createChart();
  setupThemeObserver();
});

// Cleanup beim Unmount
onUnmounted(() => {
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (themeObserver) {
    themeObserver.disconnect();
    themeObserver = null;
  }
});
</script>

<template>
  <div class="card bg-base-100 shadow-md">
    <div class="card-body">
      <h3 class="card-title text-lg mb-4">Finanztrend (6 Monate)</h3>
      <div
        ref="chartContainer"
        class="w-full"
      ></div>
    </div>
  </div>
</template>

<style scoped>
/* ApexCharts spezifische Styles für bessere Theme-Integration */
:deep(.apexcharts-tooltip) {
  background: hsl(var(--b1)) !important;
  border: 1px solid hsl(var(--bc) / 0.2) !important;
  color: hsl(var(--bc)) !important;
}

:deep(.apexcharts-tooltip-title) {
  background: hsl(var(--b2)) !important;
  border-bottom: 1px solid hsl(var(--bc) / 0.2) !important;
  color: hsl(var(--bc)) !important;
}

:deep(.apexcharts-legend-text) {
  color: hsl(var(--bc)) !important;
}

:deep(.apexcharts-xaxis-label),
:deep(.apexcharts-yaxis-label) {
  fill: hsl(var(--bc)) !important;
}

:deep(.apexcharts-gridline) {
  stroke: hsl(var(--bc) / 0.1) !important;
}
</style>
