<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useTransactionStore } from "@/stores/transactionStore";
import { useAccountStore } from "@/stores/accountStore";
import { useThemeStore } from "@/stores/themeStore";
import { BalanceService } from "@/services/BalanceService";
import type { Transaction, Account } from "../../../types/index";
import { TransactionType } from "../../../types/index";
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

// Funktion zum Abrufen der Schriftfamilie aus style.css
const getFontFamily = (): string => {
  const htmlElement = document.documentElement;
  const computedStyle = getComputedStyle(htmlElement);
  const fontFamily = computedStyle.fontFamily;

  // Fallback auf die in style.css definierte Schriftfamilie
  return (
    fontFamily || "Inter, 'Source Sans Pro', Roboto, system-ui, sans-serif"
  );
};

// Dynamische Farben basierend auf dem aktuellen Theme mit korrekten DaisyUI v5 Variablennamen
const getThemeColors = () => {
  // Verwende themeStore für konsistente Theme-Erkennung
  const isDarkMode = themeStore.isDarkMode;

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

const transactionStore = useTransactionStore();
const accountStore = useAccountStore();
const themeStore = useThemeStore();

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
let resizeObserver: ResizeObserver | null = null;

// Responsive Verhalten für die Legende
const isSmallScreen = ref(false);

// Screen-Size-Watcher
const updateScreenSize = () => {
  isSmallScreen.value = window.innerWidth < 640; // Tailwind sm breakpoint
};

// Chart-Resize-Handler
const resizeChart = () => {
  if (chart && chartContainer.value) {
    // Aktuelle Container-Dimensionen ermitteln
    const containerRect = chartContainer.value.getBoundingClientRect();
    const containerHeight = chartContainer.value.offsetHeight;
    const containerWidth = chartContainer.value.offsetWidth;

    // Chart mit aktueller Container-Größe neu rendern
    chart.updateOptions(
      {
        chart: {
          width: containerWidth,
          height: containerHeight,
        },
      },
      false,
      true
    );
  }
};

// ResizeObserver für Container-Größenänderungen
const setupResizeObserver = () => {
  if (chartContainer.value && "ResizeObserver" in window) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Debounce resize calls
        setTimeout(() => {
          resizeChart();
        }, 100);
      }
    });

    resizeObserver.observe(chartContainer.value);
  }
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
      type: "line",
      stacked: false,
      background: "transparent",
      foreColor: themeColors.textColor, // Globale Textfarbe für alle Chart-Elemente mit besserem Kontrast
      fontFamily: themeColors.fontFamily, // Globale Schriftfamilie aus style.css
      height: "100%", // Wichtig: Chart soll 100% der Container-Höhe nutzen
      width: "100%", // Wichtig: Chart soll 100% der Container-Breite nutzen
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
        easing: "easeinout",
        speed: 800,
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          legend: {
            position: "top",
            fontSize: "10px",
            itemMargin: {
              horizontal: 15,
              vertical: 5,
            },
          },
          plotOptions: {
            bar: {
              columnWidth: "90%",
            },
          },
        },
      },
      {
        breakpoint: 480,
        options: {
          legend: {
            position: "top",
            fontSize: "8px",
            itemMargin: {
              horizontal: 10,
              vertical: 3,
            },
          },
          plotOptions: {
            bar: {
              columnWidth: "80%",
            },
          },
          xaxis: {
            labels: {
              style: {
                fontSize: "10px",
              },
            },
          },
          yaxis: [
            {
              labels: {
                style: {
                  fontSize: "9px",
                },
              },
            },
            {
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
    colors: [
      themeColors.success, // success (grün) für Einnahmen
      themeColors.error, // error (rot) für Ausgaben
      themeColors.warning, // warning (orange) für Kontostand-Linie
    ],
    stroke: {
      width: [0, 0, 3], // Dünnere Linie für Kontostand
      curve: "smooth",
    },
    plotOptions: {
      bar: {
        columnWidth: "100%", // Breitere Balken
        borderRadius: 2,
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
          colors: Array(data.labels.length).fill(themeColors.textColor), // Array für alle Labels mit besserem Kontrast
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
      axisBorder: {
        show: true,
        color: themeColors.base300, // Dynamische Achsenrand-Farbe
        height: 1,
      },
      axisTicks: {
        show: true,
        color: themeColors.base300, // Dynamische Achsen-Tick-Farbe
        height: 6,
      },
      title: {
        text: "Monate",
        style: {
          color: themeColors.baseContent, // Dynamische Titel-Farbe
          fontSize: "12px",
          fontFamily: themeColors.fontFamily,
        },
      },
    },
    yaxis: [
      {
        title: {
          text: "Kontostand (€)",
          style: {
            color: themeColors.baseContent,
            fontSize: "12px",
            fontFamily: themeColors.fontFamily,
          },
        },
        labels: {
          style: {
            colors: Array(10).fill(themeColors.textColor), // Array für alle Y-Achsen-Labels mit besserem Kontrast
            fontSize: "11px",
            fontFamily: themeColors.fontFamily,
          },
          formatter: function (val: number) {
            return formatCurrency(val);
          },
        },
        axisBorder: {
          show: true,
          color: themeColors.base300, // Dynamische Achsenrand-Farbe
        },
        axisTicks: {
          show: true,
          color: themeColors.base300, // Dynamische Achsen-Tick-Farbe
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
            fontFamily: themeColors.fontFamily,
          },
        },
        labels: {
          style: {
            colors: Array(10).fill(themeColors.textColor), // Array für alle Y-Achsen-Labels mit besserem Kontrast
            fontSize: "11px",
            fontFamily: themeColors.fontFamily,
          },
          formatter: function (val: number) {
            return formatCurrency(val);
          },
        },
        axisBorder: {
          show: true,
          color: themeColors.base300, // Dynamische Achsenrand-Farbe
        },
        axisTicks: {
          show: true,
          color: themeColors.base300, // Dynamische Achsen-Tick-Farbe
        },
        seriesName: ["Einnahmen", "Ausgaben"],
        min: 0, // Immer bei 0 beginnen
        max: data.maxAmount, // Maximum basierend auf höchstem Ein-/Ausgabenwert
      },
    ],
    tooltip: {
      shared: true,
      intersect: false,
      theme: themeStore.isDarkMode ? "dark" : "light", // Verwende themeStore für konsistente Theme-Erkennung
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
      customLegendItems: [],
      clusterGroupedSeries: false,
      clusterGroupedSeriesOrientation: "horizontal",
      position: isSmallScreen.value ? "top" : "top",
      horizontalAlign: "center",
      floating: false,
      fontSize: isSmallScreen.value ? "8px" : "10px",
      fontFamily: themeColors.fontFamily,
      fontWeight: 400,
      itemMargin: {
        horizontal: isSmallScreen.value ? 12 : 20, // Weniger Abstand auf kleinen Bildschirmen
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
        fillColors: undefined, // Verwendet automatisch die Series-Farben
        customHTML: undefined,
        onClick: undefined,
      },
      onItemClick: {
        toggleDataSeries: true,
      },
      onItemHover: {
        highlightDataSeries: true,
      },
      formatter: function (seriesName: string, opts: any) {
        // Stelle sicher, dass alle Items horizontal angezeigt werden
        return seriesName;
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
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
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
    // Sicherstellen, dass Container-Dimensionen verfügbar sind
    const containerHeight = chartContainer.value.offsetHeight || 300; // Fallback-Höhe
    const containerWidth = chartContainer.value.offsetWidth || 400; // Fallback-Breite

    // Chart-Optionen mit aktueller Container-Größe erstellen
    const options = {
      ...chartOptions.value,
      chart: {
        ...chartOptions.value.chart,
        height: containerHeight,
        width: containerWidth,
      },
    };

    chart = new ApexCharts(chartContainer.value, options);
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

// Watcher für Theme-Änderungen über themeStore
watch(
  () => themeStore.isDarkMode,
  () => {
    // Kurze Verzögerung, damit CSS-Variablen aktualisiert werden
    setTimeout(() => {
      updateChart();
    }, 50);
  }
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
  // Initiale Screen-Size-Erkennung
  updateScreenSize();

  // Event-Listener für Fenstergrößenänderungen
  window.addEventListener("resize", updateScreenSize);

  createChart();
  setupThemeObserver();
  setupResizeObserver();
});

// Watcher für Screen-Size-Änderungen
watch(isSmallScreen, () => {
  // Chart mit neuen responsive Einstellungen aktualisieren
  updateChart();
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
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  // Resize-Event-Listener entfernen
  window.removeEventListener("resize", updateScreenSize);
});
</script>

<template>
  <div
    ref="chartContainer"
    class="w-full h-full min-h-0"
  ></div>
</template>
