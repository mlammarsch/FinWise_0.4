import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useCategoryStore } from "@/stores/categoryStore";
import { usePlanningStore } from "@/stores/planningStore";
import { useThemeStore } from "@/stores/themeStore";
import { BalanceService } from "@/services/BalanceService";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
// ApexCharts importieren
import ApexCharts from "apexcharts";
const props = defineProps();
// Stores
const categoryStore = useCategoryStore();
const planningStore = usePlanningStore();
const themeStore = useThemeStore();
// Chart-Konfiguration
const forecastMonths = computed(() => {
    const start = dayjs(props.dateRange.start).startOf("month");
    const end = dayjs(props.dateRange.end).endOf("month");
    const diff = end.diff(start, "month") + 1;
    return Math.min(12, Math.max(1, diff));
});
// Anzeigemodus: 'expenses' oder 'income'
const displayMode = ref("expenses");
// Responsive Verhalten
const isSmallScreen = ref(false);
// Chart-Container und Instanz
const chartContainer = ref();
let chart = null;
// Theme Observer
let themeObserver = null;
// Daten für die Prognose
const expenseForecastData = ref([]);
const incomeForecastData = ref([]);
// Aktive Forecastdaten - zeige alle Kategorien
const activeForecastData = computed(() => {
    return [...expenseForecastData.value, ...incomeForecastData.value];
});
// Responsive Breakpoint Detection
function checkScreenSize() {
    isSmallScreen.value = window.innerWidth < 768;
}
// Funktion zum Abrufen der CSS-Variablen-Werte
const getCSSVariableValue = (variableName) => {
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
const getFontFamily = () => {
    const htmlElement = document.documentElement;
    const computedStyle = getComputedStyle(htmlElement);
    const fontFamily = computedStyle.fontFamily;
    return (fontFamily || "Inter, 'Source Sans Pro', Roboto, system-ui, sans-serif");
};
// 10-Farben-Spektrum basierend auf DaisyUI-Variablen
const getColorSpectrum = () => {
    return [
        getCSSVariableValue("--color-primary"),
        getCSSVariableValue("--color-secondary"),
        getCSSVariableValue("--color-accent"),
        getCSSVariableValue("--color-info"),
        getCSSVariableValue("--color-success"),
        getCSSVariableValue("--color-warning"),
        getCSSVariableValue("--color-error"),
        getCSSVariableValue("--color-neutral"),
        // Erweiterte Farben durch Mischungen
        `color-mix(in srgb, ${getCSSVariableValue("--color-primary")} 70%, ${getCSSVariableValue("--color-secondary")} 30%)`,
        `color-mix(in srgb, ${getCSSVariableValue("--color-accent")} 70%, ${getCSSVariableValue("--color-info")} 30%)`,
    ];
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
// Deutsche Monatsnamen
function getGermanMonthName(date) {
    const months = [
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
    return `${months[date.month()]} ${date.year()}`;
}
// Kompakte Währungsformatierung
function formatCurrency(value) {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M €`;
    }
    else if (absValue >= 1000) {
        return `${(value / 1000).toFixed(1)}k €`;
    }
    else {
        return `${value.toFixed(0)} €`;
    }
}
// Generiert Prognosedaten für die Kategorien
function generateForecastData() {
    const startDate = new Date(props.dateRange.start);
    const expenseData = [];
    const incomeData = [];
    // Nur Root-Kategorien für die Übersicht
    let rootCategories = categoryStore.categories.filter((c) => c.isActive && !c.parentCategoryId && c.name !== "Verfügbare Mittel");
    // Hinweis: Keine direkte Filterung hier, damit Aggregation über alle Kategorien möglich bleibt.
    // Die Auswahl einer spezifischen Kategorie wird später in chartData berücksichtigt.
    // Generiere Daten für jede Kategorie
    rootCategories.forEach((category) => {
        const categoryData = {
            categoryId: category.id,
            categoryName: category.name,
            isIncomeCategory: category.isIncomeCategory,
            monthlyForecasts: [],
        };
        // Erstelle Prognose für jeden Monat
        for (let i = 0; i < forecastMonths.value; i++) {
            const forecastDate = new Date(startDate);
            forecastDate.setMonth(forecastDate.getMonth() + i);
            // Letzter Tag des Monats
            const lastDay = new Date(forecastDate.getFullYear(), forecastDate.getMonth() + 1, 0);
            // Aktueller und prognostizierter Kategoriesaldo
            const balance = BalanceService.getTodayBalance("category", category.id, lastDay);
            const projectedBalance = BalanceService.getProjectedBalance("category", category.id, lastDay);
            // Hole alle geplanten Transaktionen für diesen Monat in dieser Kategorie
            const monthStart = new Date(forecastDate.getFullYear(), forecastDate.getMonth(), 1);
            const transactions = planningStore
                .getUpcomingTransactions(forecastMonths.value * 30)
                .filter((tx) => {
                const txDate = new Date(tx.date);
                return (txDate >= monthStart &&
                    txDate <= lastDay &&
                    tx.transaction.categoryId === category.id);
            })
                .map((tx) => ({
                date: tx.date,
                description: tx.transaction.name || "Geplante Transaktion",
                amount: tx.transaction.amount,
            }));
            categoryData.monthlyForecasts.push({
                month: forecastDate.toLocaleDateString("de-DE", {
                    month: "short",
                    year: "numeric",
                }),
                balance,
                projectedBalance,
                transactions,
            });
        }
        // Sortiere in Ausgaben und Einnahmen
        if (category.isIncomeCategory) {
            incomeData.push(categoryData);
        }
        else {
            expenseData.push(categoryData);
        }
    });
    expenseForecastData.value = expenseData;
    incomeForecastData.value = incomeData;
    debugLog("[CategoryForecastChart] generateForecastData", {
        expenses: expenseData.length,
        incomes: incomeData.length,
        startDate: props.dateRange.start,
    });
}
// Chart-Daten berechnen
const chartData = computed(() => {
    const labels = [];
    const series = [];
    const colorSpectrum = getColorSpectrum();
    // Labels gemäß DateRange (max. 12 Monate)
    const startDate = dayjs(props.dateRange.start).startOf("month");
    const months = forecastMonths.value;
    for (let i = 0; i < months; i++) {
        const month = startDate.add(i, "month");
        labels.push(getGermanMonthName(month));
    }
    if (props.filteredCategoryId) {
        // Nur ausgewählte Kategorie anzeigen
        const cat = activeForecastData.value.find((c) => c.categoryId === props.filteredCategoryId);
        const data = (cat?.monthlyForecasts ?? []).map((f) => Math.round(f.projectedBalance));
        series.push({
            name: cat?.categoryName ?? "Kategorie",
            data,
            categoryId: cat?.categoryId ?? "N/A",
        });
    }
    else {
        // Aggregierte Summe über alle Kategorien je Monat
        const aggregated = [];
        for (let i = 0; i < months; i++) {
            let sum = 0;
            for (const cat of activeForecastData.value) {
                const v = cat.monthlyForecasts[i]?.projectedBalance ?? 0;
                sum += Math.round(v);
            }
            aggregated.push(sum);
        }
        series.push({
            name: "Alle Kategorien",
            data: aggregated,
            categoryId: "ALL",
        });
    }
    return { labels, series, colorSpectrum };
});
// Chart-Optionen
const chartOptions = computed(() => {
    const data = chartData.value;
    const themeColors = getThemeColors();
    return {
        series: data.series.map((s) => ({
            name: s.name,
            data: s.data,
            type: "area",
        })),
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
        colors: data.colorSpectrum,
        dataLabels: {
            enabled: false,
        },
        stroke: {
            curve: "smooth",
            width: 2,
        },
        fill: {
            type: "gradient",
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100],
            },
        },
        xaxis: {
            categories: data.labels,
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
            },
            labels: {
                style: {
                    colors: Array(data.labels.length).fill(themeColors.textColor),
                    fontSize: "12px",
                    fontFamily: themeColors.fontFamily,
                },
            },
        },
        yaxis: {
            labels: {
                style: {
                    colors: Array(10).fill(themeColors.textColor),
                    fontSize: "12px",
                    fontFamily: themeColors.fontFamily,
                },
                formatter: (value) => formatCurrency(value),
            },
            axisBorder: {
                show: false,
            },
            axisTicks: {
                show: false,
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
        },
        legend: {
            show: false,
        },
        tooltip: {
            theme: themeStore.isDarkMode ? "dark" : "light",
            style: {
                fontSize: "12px",
                fontFamily: themeColors.fontFamily,
            },
            y: {
                formatter: (value) => formatCurrency(value),
            },
        },
        responsive: [
            {
                breakpoint: 768,
                options: {
                    legend: {
                        show: false,
                    },
                    chart: {
                        height: 300,
                    },
                },
            },
        ],
    };
});
// Chart erstellen und aktualisieren
const createChart = async () => {
    if (chartContainer.value && !chart && activeForecastData.value.length > 0) {
        try {
            chart = new ApexCharts(chartContainer.value, chartOptions.value);
            await chart.render();
            debugLog("[CategoryForecastChart] Chart created successfully", {
                series: chartOptions.value.series.length,
                container: !!chartContainer.value,
            });
        }
        catch (error) {
            debugLog("[CategoryForecastChart] Error creating chart", error);
        }
    }
};
const updateChart = async () => {
    if (chart && activeForecastData.value.length > 0) {
        try {
            await chart.updateOptions(chartOptions.value, true);
        }
        catch (error) {
            debugLog("[CategoryForecastChart] Error updating chart", error);
        }
    }
};
// Theme-Änderungen überwachen
function setupThemeObserver() {
    themeObserver = new MutationObserver(() => {
        // Chart mit neuen Theme-Farben aktualisieren
        setTimeout(() => {
            updateChart();
        }, 50);
    });
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "class"],
    });
}
// Watchers für Datenänderungen
watch([
    () => props.dateRange.start,
    () => props.dateRange.end,
    () => props.filteredCategoryId,
], async () => {
    generateForecastData();
    await nextTick();
    if (!chart) {
        setTimeout(() => {
            createChart();
        }, 100);
    }
});
watch(chartData, async () => {
    if (chart) {
        await updateChart();
    }
    else if (activeForecastData.value.length > 0) {
        await nextTick();
        setTimeout(() => {
            createChart();
        }, 100);
    }
}, { deep: true });
watch(() => themeStore.isDarkMode, () => {
    setTimeout(() => {
        updateChart();
    }, 50);
});
watch(isSmallScreen, () => {
    updateChart();
});
// Lifecycle
onMounted(async () => {
    generateForecastData();
    checkScreenSize();
    setupThemeObserver();
    // Warten bis DOM und Daten verfügbar sind
    await nextTick();
    setTimeout(() => {
        createChart();
    }, 100);
    window.addEventListener("resize", checkScreenSize);
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
    window.removeEventListener("resize", checkScreenSize);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-6" },
});
if (__VLS_ctx.activeForecastData.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center py-10" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:alert-circle-outline",
        ...{ class: "text-4xl text-warning mb-2" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:alert-circle-outline",
        ...{ class: "text-4xl text-warning mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md h-96" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body flex flex-col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ref: "chartContainer",
        ...{ class: "w-full flex-1 min-h-0" },
    });
    /** @type {typeof __VLS_ctx.chartContainer} */ ;
}
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['h-96']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            chartContainer: chartContainer,
            activeForecastData: activeForecastData,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
