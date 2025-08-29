<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "../../../stores/themeStore";
import { TransactionService } from "../../../services/TransactionService";
import ApexCharts from "apexcharts";

// Props
const props = withDefaults(
  defineProps<{
    startDate: string;
    endDate: string;
    showHeader?: boolean;
  }>(),
  {
    showHeader: true,
  }
);

// Stores
const themeStore = useThemeStore();

// Chart-Referenzen
const chartContainer = ref<HTMLElement>();
let chart: ApexCharts | null = null;
let themeObserver: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
const cardBodyRef = ref<HTMLElement>();
const headerRef = ref<HTMLElement | null>(null);

// Responsive
const isSmallScreen = ref(false);

// Formatiert Währungsbeträge als vollständige Integer-Werte
const formatFullCurrency = (value: number): string => {
  if (value === 0) return "0€";
  return Math.round(value).toLocaleString("de-DE") + "€";
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
      colors: [themeColors.success, themeColors.error],
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

const getSizedOptions = () => {
  const bodyEl = cardBodyRef.value;
  const defaultHeight = 160;
  const defaultWidth = 300;

  const totalH = bodyEl?.clientHeight ?? defaultHeight;
  const totalW = bodyEl?.clientWidth ?? defaultWidth;

  const headerH = headerRef.value?.offsetHeight ?? (props.showHeader ? 40 : 0);
  const verticalPadding = 32; // p-4 top + bottom
  const gapBelowHeader = 8; // mb-2 unter Header

  const availableH = Math.max(
    80,
    totalH - headerH - verticalPadding - gapBelowHeader
  );

  const containerW = chartContainer.value?.clientWidth ?? totalW - 32; // p-4 left+right

  return {
    ...chartOptions.value,
    chart: {
      ...chartOptions.value.chart,
      height: availableH,
      width: Math.max(100, containerW),
    },
  };
};

// Chart erstellen
const createChart = () => {
  if (!chartContainer.value) return;

  if (chart) {
    chart.destroy();
  }

  chart = new ApexCharts(chartContainer.value, getSizedOptions());
  chart.render();
};

// Chart aktualisieren
const updateChart = (animate: boolean = true) => {
  if (chart) {
    // keine Pfad-Neuzeichnung, keine Animation -> weniger Reflows/Jank
    chart.updateOptions(getSizedOptions(), false, animate);
  }
};

// rAF-Coalescing + optionales Debounce
const DEBOUNCE_RESIZE_MS = 120;
let rafId: number | null = null;
let debounceId: number | null = null;
let pendingAnimate = true;

const scheduleUpdate = (opts?: { debounce?: number; animate?: boolean }) => {
  const debounceMs = opts?.debounce ?? 0;
  const animate = opts?.animate ?? true;

  // Wenn irgendein Aufrufer Animationen deaktivieren möchte, gilt das für diesen Batch
  pendingAnimate = pendingAnimate && animate;

  const flush = () => {
    rafId = null;
    updateChart(pendingAnimate);
    pendingAnimate = true;
  };

  if (debounceMs > 0) {
    if (debounceId) window.clearTimeout(debounceId);
    debounceId = window.setTimeout(() => {
      debounceId = null;
      if (rafId) return; // bereits geplant
      rafId = requestAnimationFrame(flush);
    }, debounceMs);
    return;
  }

  if (rafId) return;
  rafId = requestAnimationFrame(flush);
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
          scheduleUpdate();
        }, 50);
      }
    });
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
};

// ResizeObserver Setup
const setupResizeObserver = () => {
  const target = cardBodyRef.value ?? chartContainer.value;
  if (target && "ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => {
      // warte auf das nächste Repaint, dann exakt auf Containermaß anpassen
      requestAnimationFrame(() => updateChart());
    });
    resizeObserver.observe(target);
  }
};

// Watchers
watch(
  () => [props.startDate, props.endDate],
  () => {
    scheduleUpdate();
  },
  { deep: true }
);

watch(
  () => themeStore.isDarkMode,
  () => {
    setTimeout(() => {
      scheduleUpdate();
    }, 50);
  }
);

watch(isSmallScreen, () => {
  scheduleUpdate();
});

// Lifecycle
onMounted(() => {
  updateScreenSize();
  window.addEventListener("resize", updateScreenSize);
  createChart();
  setupThemeObserver();
  setupResizeObserver();
  // direkt nach Mount einmal ohne Animation an Containergröße anpassen
  setTimeout(() => {
    scheduleUpdate({ animate: false });
  }, 0);
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
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  window.removeEventListener("resize", updateScreenSize);
});
</script>

<template>
  <div
    class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
  >
    <div
      class="card-body h-[160px] p-4 flex flex-col overflow-hidden"
      ref="cardBodyRef"
    >
      <!-- Header -->
      <div
        v-if="showHeader"
        class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2"
        ref="headerRef"
      >
        <h3 class="card-title text-lg">Einnahmen vs. Ausgaben</h3>

        <!-- Link-Button -->
        <RouterLink
          :to="{ name: 'transactions' }"
          class="btn btn-sm btn-ghost"
        >
          Zu Transaktionen
        </RouterLink>
      </div>

      <!-- Titel wenn kein Header -->
      <h3
        v-else
        class="card-title text-lg mb-2"
      >
        Einnahmen vs. Ausgaben
      </h3>

      <!-- Chart -->
      <div
        ref="chartContainer"
        class="w-full flex-1 min-h-0 overflow-hidden h-full eisc-container"
      ></div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
/* Stelle sicher, dass ApexCharts niemals größer als der Container rendert */
.eisc-container :deep(.apexcharts-canvas),
.eisc-container :deep(svg) {
  width: 100% !important;
  height: 100% !important;
}
</style>
