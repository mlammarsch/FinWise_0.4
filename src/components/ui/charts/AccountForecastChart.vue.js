import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import { usePlanningStore } from "@/stores/planningStore";
import { useThemeStore } from "@/stores/themeStore";
import { useMonthlyBalanceStore } from "@/stores/monthlyBalanceStore";
import { BalanceService } from "@/services/BalanceService";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import { formatDate } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { Icon } from "@iconify/vue";
import dayjs from "dayjs";
import "dayjs/locale/de";
// ApexCharts importieren
import ApexCharts from "apexcharts";
dayjs.locale("de");
const props = defineProps();
// Stores
const accountStore = useAccountStore();
const planningStore = usePlanningStore();
const themeStore = useThemeStore();
const monthlyBalanceStore = useMonthlyBalanceStore();
// Chart-Konfiguration
const forecastMonths = computed(() => {
    const start = dayjs(props.dateRange.start).startOf("month");
    const end = dayjs(props.dateRange.end).endOf("month");
    const diff = end.diff(start, "month") + 1;
    return Math.min(12, Math.max(1, diff));
});
const chartContainer = ref();
let chart = null;
// Responsive Verhalten
const isSmallScreen = ref(false);
// Aktives Konto für detaillierte Ansicht
const activeAccountId = ref(null);
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
// Sortierte Prognosedaten für Badges
const sortedForecastData = computed(() => {
    return [...forecastData.value].sort((a, b) => {
        // Erst nach Kontogruppen-sortOrder sortieren
        const groupSortA = a.accountGroupSortOrder ?? 999;
        const groupSortB = b.accountGroupSortOrder ?? 999;
        if (groupSortA !== groupSortB) {
            return groupSortA - groupSortB;
        }
        // Dann nach Konto-sortOrder
        const accountSortA = a.accountSortOrder ?? 999;
        const accountSortB = b.accountSortOrder ?? 999;
        return accountSortA - accountSortB;
    });
});
// Bestimmt, ob ein Konto berücksichtigt wird
const shouldShowAccount = computed(() => {
    return (accountId) => {
        if (props.filteredAccountId) {
            return props.filteredAccountId === accountId;
        }
        // Aggregierte Ansicht: alle Konten berücksichtigen
        return true;
    };
});
// Bestimmt, ob das Chart angezeigt werden soll
const shouldShowChart = computed(() => {
    // Ohne Badges oder mit gesetztem Filter immer anzeigen, sofern Daten vorhanden
    if (!props.hideBadges && !props.filteredAccountId) {
        return activeAccountId.value !== null && forecastData.value.length > 0;
    }
    return forecastData.value.length > 0;
});
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
    const isSingleAccount = !!props.filteredAccountId;
    if (isSingleAccount) {
        // Nur die ausgewählte Kontoserie mit Positiv/Negativ-Trennung
        const account = forecastData.value.find((a) => a.accountId === props.filteredAccountId);
        const data = (account?.monthlyForecasts ?? []).map((f) => Math.round(f.projectedBalance));
        const positiveData = data.map((val) => (val >= 0 ? val : null));
        const negativeData = data.map((val) => val < 0 ? Math.abs(val) : null);
        if (positiveData.some((v) => v !== null)) {
            series.push({
                name: `${account?.accountName ?? "Konto"} (Positiv)`,
                data: positiveData,
                accountId: account?.accountId ?? "N/A",
            });
        }
        if (negativeData.some((v) => v !== null)) {
            series.push({
                name: `${account?.accountName ?? "Konto"} (Negativ)`,
                data: negativeData,
                accountId: account?.accountId ?? "N/A",
            });
        }
    }
    else {
        // Aggregierte Summe über alle Konten je Monat
        const aggregated = [];
        for (let i = 0; i < months; i++) {
            let sum = 0;
            for (const acc of forecastData.value) {
                const v = acc.monthlyForecasts[i]?.projectedBalance ?? 0;
                sum += Math.round(v);
            }
            aggregated.push(sum);
        }
        series.push({ name: "Alle Konten", data: aggregated, accountId: "ALL" });
    }
    return { labels, series, colorSpectrum };
});
// Chart-Optionen
const chartOptions = computed(() => {
    const data = chartData.value;
    const themeColors = getThemeColors();
    const isSingleAccount = !!props.filteredAccountId;
    // Farben bestimmen
    let colors;
    if (isSingleAccount) {
        colors = [themeColors.success, themeColors.error]; // Grün für positiv, rot für negativ
    }
    else {
        colors = [themeColors.primary];
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
                text: "Kontostand (€)",
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
            show: shouldShowChart.value && (!isSingleAccount || data.series.length > 1), // Legende nur wenn Chart angezeigt wird und bei mehreren Konten oder pos/neg Trennung
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
async function generateForecastData() {
    const startDate = new Date(props.dateRange.start);
    const data = [];
    // Sicherstellen, dass monthlyBalanceStore geladen ist
    if (!monthlyBalanceStore.isLoaded) {
        await monthlyBalanceStore.loadMonthlyBalances();
    }
    accountStore.activeAccounts.forEach((account) => {
        if (!shouldShowAccount.value(account.id))
            return;
        const accountData = {
            accountId: account.id,
            accountName: account.name,
            currentBalance: account.balance,
            monthlyForecasts: [],
        };
        for (let i = 0; i < forecastMonths.value; i++) {
            const forecastDate = new Date(startDate);
            forecastDate.setMonth(forecastDate.getMonth() + i);
            const lastDay = new Date(forecastDate.getFullYear(), forecastDate.getMonth() + 1, 0);
            // Verwende monthlyBalanceStore für bessere Performance und Genauigkeit
            const year = forecastDate.getFullYear();
            const month = forecastDate.getMonth();
            let balance = monthlyBalanceStore.getAccountBalanceForDate(account.id, lastDay);
            let projectedBalance = monthlyBalanceStore.getProjectedAccountBalanceForDate(account.id, lastDay);
            // Fallback auf BalanceService wenn keine Daten im monthlyBalanceStore
            if (balance === null) {
                balance = BalanceService.getTodayBalance("account", account.id, lastDay);
            }
            if (projectedBalance === null) {
                projectedBalance = BalanceService.getProjectedBalance("account", account.id, lastDay);
            }
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            // Geplante Transaktionen für 6 Monate (statt 35 Tage) berücksichtigen
            const sixMonthsFromNow = new Date();
            sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
            const transactions = planningStore
                .getUpcomingTransactions(forecastMonths.value * 30)
                .filter((tx) => {
                const txDate = new Date(tx.date);
                return (txDate >= monthStart &&
                    txDate <= monthEnd &&
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
    forecastData.value = data;
    // Aktives Konto an Dropdown-Filter koppeln (oder aggregiert anzeigen)
    activeAccountId.value = props.filteredAccountId || null;
    debugLog("[AccountForecastChart] generateForecastData", {
        accounts: data.length,
        dateRange: props.dateRange,
        autoSelectedAccount: activeAccountId.value,
        monthlyBalanceStoreLoaded: monthlyBalanceStore.isLoaded,
    });
}
// Chart erstellen und aktualisieren
const createChart = async () => {
    if (chartContainer.value && !chart && forecastData.value.length > 0) {
        try {
            chart = new ApexCharts(chartContainer.value, chartOptions.value);
            await chart.render();
            debugLog("[AccountForecastChart] Chart created successfully", {
                series: chartOptions.value.series.length,
                container: !!chartContainer.value,
            });
        }
        catch (error) {
            debugLog("[AccountForecastChart] Error creating chart", error);
        }
    }
};
const updateChart = async () => {
    if (chart && shouldShowChart.value && forecastData.value.length > 0) {
        try {
            await chart.updateOptions(chartOptions.value, true);
        }
        catch (error) {
            debugLog("[AccountForecastChart] Error updating chart", error);
        }
    }
    else if (chart && !shouldShowChart.value) {
        // Chart zerstören wenn kein Konto ausgewählt
        chart.destroy();
        chart = null;
    }
};
// Zeige detaillierte Ansicht für ein Konto
function showAccountDetails(accountId) {
    activeAccountId.value =
        activeAccountId.value === accountId ? null : accountId;
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
watch([
    () => props.dateRange.start,
    () => props.dateRange.end,
    () => props.filteredAccountId,
], async () => {
    await generateForecastData();
    await nextTick();
    if (!chart) {
        setTimeout(() => {
            createChart();
        }, 100);
    }
});
watch(chartData, async () => {
    if (chart && shouldShowChart.value) {
        await updateChart();
    }
    else if (shouldShowChart.value && forecastData.value.length > 0) {
        await nextTick();
        setTimeout(() => {
            createChart();
        }, 100);
    }
    else if (!shouldShowChart.value && chart) {
        chart.destroy();
        chart = null;
    }
}, { deep: true });
// Watcher für activeAccountId um Chart zu erstellen/zerstören
watch(activeAccountId, async () => {
    if (shouldShowChart.value && !chart && forecastData.value.length > 0) {
        await nextTick();
        setTimeout(() => {
            createChart();
        }, 100);
    }
    else if (!shouldShowChart.value && chart) {
        chart.destroy();
        chart = null;
    }
    else if (chart && shouldShowChart.value) {
        await updateChart();
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
    await generateForecastData();
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
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-6" },
});
if (!__VLS_ctx.hideBadges) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-4" },
    });
    for (const [account] of __VLS_getVForSourceType((__VLS_ctx.sortedForecastData))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.hideBadges))
                        return;
                    __VLS_ctx.showAccountDetails(account.accountId);
                } },
            key: (account.accountId),
            ...{ class: "badge badge-sm badge-soft cursor-pointer rounded-full" },
            ...{ class: (__VLS_ctx.activeAccountId === account.accountId
                    ? 'badge-accent'
                    : 'badge-outline') },
        });
        (account.accountName);
    }
}
if (__VLS_ctx.forecastData.length === 0) {
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
if (__VLS_ctx.shouldShowChart && __VLS_ctx.forecastData.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md h-80" },
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
else if (__VLS_ctx.forecastData.length > 0 && !__VLS_ctx.shouldShowChart) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center py-10" },
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: "mdi:chart-line",
        ...{ class: "text-4xl text-info mb-2" },
    }));
    const __VLS_6 = __VLS_5({
        icon: "mdi:chart-line",
        ...{ class: "text-4xl text-info mb-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
}
if (__VLS_ctx.activeAccountId) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mt-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
        ...{ class: "text-lg font-semibold mb-4" },
    });
    (__VLS_ctx.forecastData.find((a) => a.accountId === __VLS_ctx.activeAccountId)?.accountName);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "grid grid-cols-2 md:grid-cols-3 gap-4" },
    });
    for (const [forecast, i] of __VLS_getVForSourceType((__VLS_ctx.forecastData.find((a) => a.accountId === __VLS_ctx.activeAccountId)?.monthlyForecasts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (i),
            ...{ class: "card bg-base-200 shadow-sm" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-body p-4" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h5, __VLS_intrinsicElements.h5)({
            ...{ class: "card-title text-base" },
        });
        (forecast.month);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-sm mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (forecast.balance),
            asInteger: (true),
        }));
        const __VLS_9 = __VLS_8({
            amount: (forecast.balance),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between font-bold" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (forecast.projectedBalance),
            asInteger: (true),
        }));
        const __VLS_12 = __VLS_11({
            amount: (forecast.projectedBalance),
            asInteger: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        if (forecast.transactions.length > 0) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-xs space-y-1 border-t border-base-300 pt-2" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "font-semibold" },
            });
            for (const [tx, j] of __VLS_getVForSourceType((forecast.transactions))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (j),
                    ...{ class: "flex justify-between" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (__VLS_ctx.formatDate(tx.date));
                (tx.description);
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_14 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (tx.amount),
                    showZero: (true),
                }));
                const __VLS_15 = __VLS_14({
                    amount: (tx.amount),
                    showZero: (true),
                }, ...__VLS_functionalComponentArgsRest(__VLS_14));
            }
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-xs text-base-content/70 border-t border-base-300 pt-2" },
            });
        }
    }
}
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['h-80']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-info']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CurrencyDisplay: CurrencyDisplay,
            formatDate: formatDate,
            Icon: Icon,
            chartContainer: chartContainer,
            activeAccountId: activeAccountId,
            forecastData: forecastData,
            sortedForecastData: sortedForecastData,
            shouldShowChart: shouldShowChart,
            showAccountDetails: showAccountDetails,
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
