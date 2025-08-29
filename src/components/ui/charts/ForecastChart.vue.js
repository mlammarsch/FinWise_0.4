import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { usePlanningStore } from "@/stores/planningStore";
import { useThemeStore } from "@/stores/themeStore";
import { BalanceService } from "@/services/BalanceService";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
import "dayjs/locale/de";
// ApexCharts importieren
import ApexCharts from "apexcharts";
dayjs.locale("de");
const props = defineProps();
const emit = defineEmits();
// Stores
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const planningStore = usePlanningStore();
const themeStore = useThemeStore();
// Chart-Konfiguration
const forecastMonths = 6;
const chartContainer = ref();
let chart = null;
// Responsive Verhalten
const isSmallScreen = ref(false);
// Anzeigemodus für Kategorien: 'expenses' oder 'income'
const displayMode = ref("expenses");
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
// 10-Farben-Spektrum aus CSS-Variablen (ohne secondary und neutral)
const getColorSpectrum = () => {
    return [
        getCSSVariableValue("--color-primary"),
        getCSSVariableValue("--color-accent"),
        getCSSVariableValue("--color-info"),
        getCSSVariableValue("--color-success"),
        getCSSVariableValue("--color-warning"),
        getCSSVariableValue("--color-error"),
        getCSSVariableValue("--color-chart-purple"),
        getCSSVariableValue("--color-chart-pink"),
        getCSSVariableValue("--color-chart-orange"),
        getCSSVariableValue("--color-chart-teal"),
        getCSSVariableValue("--color-chart-indigo"),
    ].filter((color) => color && color !== "#000000"); // Filtere ungültige Farben
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
// Formatierungsfunktion für kompakte Darstellung
const formatCurrency = (value) => {
    if (value === 0)
        return "0€";
    const absValue = Math.abs(value);
    let formatted = "";
    if (absValue >= 1000000) {
        formatted = (value / 1000000).toFixed(1).replace(".0", "") + "M€";
    }
    else if (absValue >= 1000) {
        formatted = (value / 1000).toFixed(1).replace(".0", "") + "k€";
    }
    else {
        formatted = value.toFixed(0) + "€";
    }
    return formatted;
};
// Screen-Size-Watcher
const updateScreenSize = () => {
    isSmallScreen.value = window.innerWidth < 640;
};
// Deutsche Monatsnamen
const getGermanMonthName = (date) => {
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
// Daten für die Prognose
const forecastData = ref([]);
// Bestimmt, ob ein Account angezeigt werden soll
const shouldShowAccount = computed(() => {
    return (accountId) => {
        if (props.filteredAccountId && props.filteredAccountId !== accountId) {
            return false;
        }
        return true;
    };
});
// Aktive Forecastdaten basierend auf Typ und Modus
const activeForecastData = computed(() => {
    if (props.type === "accounts") {
        return forecastData.value;
    }
    else {
        return forecastData.value.filter((item) => {
            const isIncome = item.isIncomeCategory || false;
            return displayMode.value === "expenses" ? !isIncome : isIncome;
        });
    }
});
// Chart-Daten berechnen
const chartData = computed(() => {
    const labels = [];
    const series = [];
    const colorSpectrum = getColorSpectrum();
    // Labels für die nächsten 6 Monate generieren
    const startDate = dayjs(props.startDate);
    for (let i = 0; i < forecastMonths; i++) {
        const month = startDate.add(i, "month");
        labels.push(getGermanMonthName(month));
    }
    // Daten für jedes Element
    activeForecastData.value.forEach((item) => {
        if (props.type === "accounts" && !shouldShowAccount.value(item.id))
            return;
        const data = item.monthlyForecasts.map((f) => Math.round(f.projectedBalance));
        // Bei einzelnem Account: positive und negative Werte trennen
        if (props.type === "accounts" && props.filteredAccountId === item.id) {
            const positiveData = data.map((val) => (val >= 0 ? val : null));
            const negativeData = data.map((val) => val < 0 ? Math.abs(val) : null);
            if (positiveData.some((val) => val !== null)) {
                series.push({
                    name: `${item.name} (Positiv)`,
                    data: positiveData,
                    id: item.id,
                });
            }
            if (negativeData.some((val) => val !== null)) {
                series.push({
                    name: `${item.name} (Negativ)`,
                    data: negativeData,
                    id: item.id,
                });
            }
        }
        else {
            series.push({
                name: item.name,
                data,
                id: item.id,
            });
        }
    });
    return { labels, series, colorSpectrum };
});
// Chart-Optionen
const chartOptions = computed(() => {
    const data = chartData.value;
    const themeColors = getThemeColors();
    const isSingleAccount = props.type === "accounts" && props.filteredAccountId !== undefined;
    // Farben bestimmen
    let colors;
    if (isSingleAccount && data.series.length === 2) {
        // Nur bei Single-Account mit positiv/negativ Aufteilung
        colors = [themeColors.success, themeColors.error]; // Grün für positiv, rot für negativ
    }
    else {
        // Für alle anderen Fälle: Vollständiges 10-Farben-Spektrum verwenden
        colors = data.colorSpectrum;
    }
    return {
        series: data.series.map((s, index) => ({
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
        colors: colors,
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
        dataLabels: {
            enabled: false,
        },
        xaxis: {
            categories: data.labels,
            labels: {
                style: {
                    colors: Array(data.labels.length).fill(themeColors.textColor),
                    fontSize: "12px",
                    fontFamily: themeColors.fontFamily,
                },
            },
            axisBorder: {
                show: true,
                color: themeColors.base300,
                height: 1,
            },
            axisTicks: {
                show: true,
                color: themeColors.base300,
                height: 6,
            },
            title: {
                text: "Monate",
                style: {
                    color: themeColors.baseContent,
                    fontSize: "12px",
                    fontFamily: themeColors.fontFamily,
                },
            },
        },
        yaxis: {
            title: {
                text: props.type === "accounts" ? "Kontostand (€)" : "Kategoriesaldo (€)",
                style: {
                    color: themeColors.baseContent,
                    fontSize: "12px",
                    fontFamily: themeColors.fontFamily,
                },
            },
            labels: {
                style: {
                    colors: Array(10).fill(themeColors.textColor),
                    fontSize: "11px",
                    fontFamily: themeColors.fontFamily,
                },
                formatter: function (val) {
                    return formatCurrency(val);
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
        tooltip: {
            shared: true,
            intersect: false,
            theme: themeStore.isDarkMode ? "dark" : "light",
            style: {
                fontSize: "12px",
            },
            y: {
                formatter: function (val) {
                    return formatCurrency(val);
                },
            },
        },
        legend: {
            show: !isSingleAccount || data.series.length > 1,
            position: isSmallScreen.value ? "top" : "top",
            horizontalAlign: "center",
            floating: false,
            fontSize: isSmallScreen.value ? "8px" : "10px",
            fontFamily: themeColors.fontFamily,
            fontWeight: 400,
            itemMargin: {
                horizontal: isSmallScreen.value ? 12 : 20,
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
                fillColors: undefined,
            },
            onItemClick: {
                toggleDataSeries: true,
            },
            onItemHover: {
                highlightDataSeries: true,
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
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
            },
        },
    };
});
// Prognosedaten generieren
function generateForecastData() {
    const startDate = new Date(props.startDate);
    const data = [];
    if (props.type === "accounts") {
        // Account-Daten generieren
        accountStore.activeAccounts.forEach((account) => {
            if (!shouldShowAccount.value(account.id))
                return;
            const accountData = {
                id: account.id,
                name: account.name,
                currentBalance: account.balance,
                monthlyForecasts: [],
            };
            for (let i = 0; i < forecastMonths; i++) {
                const forecastDate = new Date(startDate);
                forecastDate.setMonth(forecastDate.getMonth() + i);
                const lastDay = new Date(forecastDate.getFullYear(), forecastDate.getMonth() + 1, 0);
                const balance = BalanceService.getTodayBalance("account", account.id, lastDay);
                const projectedBalance = BalanceService.getProjectedBalance("account", account.id, lastDay);
                const monthStart = new Date(forecastDate.getFullYear(), forecastDate.getMonth(), 1);
                const transactions = planningStore
                    .getUpcomingTransactions(365) // 365 Tage statt 35, um alle 6 Monate abzudecken
                    .filter((tx) => {
                    const txDate = new Date(tx.date);
                    return (txDate >= monthStart &&
                        txDate <= lastDay &&
                        tx.transaction?.accountId === account.id);
                })
                    .map((tx) => ({
                    date: tx.date,
                    description: tx.transaction?.name || "Geplante Transaktion",
                    amount: tx.transaction?.amount || 0,
                }));
                accountData.monthlyForecasts.push({
                    month: forecastDate.toLocaleDateString("de-DE", {
                        month: "short",
                        year: "numeric",
                    }),
                    balance,
                    projectedBalance,
                    transactions,
                });
            }
            data.push(accountData);
        });
    }
    else {
        // Category-Daten generieren
        const rootCategories = categoryStore.categories.filter((c) => c.isActive && !c.parentCategoryId && c.name !== "Verfügbare Mittel");
        rootCategories.forEach((category) => {
            const categoryData = {
                id: category.id,
                name: category.name,
                isIncomeCategory: category.isIncomeCategory,
                monthlyForecasts: [],
            };
            for (let i = 0; i < forecastMonths; i++) {
                const forecastDate = new Date(startDate);
                forecastDate.setMonth(forecastDate.getMonth() + i);
                const lastDay = new Date(forecastDate.getFullYear(), forecastDate.getMonth() + 1, 0);
                const balance = BalanceService.getTodayBalance("category", category.id, lastDay);
                const projectedBalance = BalanceService.getProjectedBalance("category", category.id, lastDay);
                const monthStart = new Date(forecastDate.getFullYear(), forecastDate.getMonth(), 1);
                const transactions = planningStore
                    .getUpcomingTransactions(365) // 365 Tage statt 35, um alle 6 Monate abzudecken
                    .filter((tx) => {
                    const txDate = new Date(tx.date);
                    return (txDate >= monthStart &&
                        txDate <= lastDay &&
                        tx.transaction &&
                        tx.transaction.categoryId === category.id);
                })
                    .map((tx) => ({
                    date: tx.date,
                    description: tx.transaction?.name || "Geplante Transaktion",
                    amount: tx.transaction?.amount || 0,
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
            data.push(categoryData);
        });
    }
    forecastData.value = data;
    debugLog("[ForecastChart] generateForecastData", {
        type: props.type,
        items: data.length,
        startDate: props.startDate,
    });
}
// Chart erstellen und aktualisieren
const createChart = async () => {
    if (chartContainer.value && !chart && activeForecastData.value.length > 0) {
        try {
            chart = new ApexCharts(chartContainer.value, chartOptions.value);
            await chart.render();
            debugLog("[ForecastChart] Chart created successfully", {
                type: props.type,
                series: chartOptions.value.series.length,
                container: !!chartContainer.value,
            });
        }
        catch (error) {
            debugLog("[ForecastChart] Error creating chart", error);
        }
    }
};
const updateChart = async () => {
    if (chart && activeForecastData.value.length > 0) {
        try {
            await chart.updateOptions(chartOptions.value, true);
        }
        catch (error) {
            debugLog("[ForecastChart] Error updating chart", error);
        }
    }
};
// Wechselt zwischen Ausgaben- und Einnahmenansicht (nur für Categories)
function toggleDisplayMode(mode) {
    if (props.type === "categories") {
        displayMode.value = mode;
    }
}
// Formatiert einen Betrag für die Anzeige
function formatAmount(amount) {
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
// Watchers
watch([() => props.startDate, () => props.filteredAccountId, () => props.type], async () => {
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
watch(displayMode, async () => {
    if (chart) {
        await updateChart();
    }
    else if (activeForecastData.value.length > 0) {
        await nextTick();
        setTimeout(() => {
            createChart();
        }, 100);
    }
});
watch(() => themeStore.isDarkMode, () => {
    setTimeout(() => {
        updateChart();
    }, 50);
});
watch(isSmallScreen, () => {
    updateChart();
});
// Theme-Observer
let themeObserver = null;
const setupThemeObserver = () => {
    if (themeObserver) {
        themeObserver.disconnect();
    }
    themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes" &&
                mutation.attributeName === "data-theme") {
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
onMounted(async () => {
    updateScreenSize();
    window.addEventListener("resize", updateScreenSize);
    generateForecastData();
    // Warten bis DOM und Daten verfügbar sind
    await nextTick();
    setTimeout(() => {
        createChart();
    }, 100);
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
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
// CSS variable injection 
// CSS variable injection end 
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
    if (__VLS_ctx.type === 'accounts') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        (__VLS_ctx.displayMode === "expenses" ? "Ausgaben" : "Einnahmen");
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-full h-80" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ref: "chartContainer",
        ...{ class: "w-full h-full" },
    });
    /** @type {typeof __VLS_ctx.chartContainer} */ ;
}
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-80']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            chartContainer: chartContainer,
            displayMode: displayMode,
            activeForecastData: activeForecastData,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
