import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "@/stores/themeStore";
import { useAccountStore } from "@/stores/accountStore";
import { useMonthlyBalanceStore } from "@/stores/monthlyBalanceStore";
import { usePlanningStore } from "@/stores/planningStore";
import { BalanceService } from "@/services/BalanceService";
import ApexCharts from "apexcharts";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import "dayjs/locale/de";
dayjs.extend(isBetween);
dayjs.locale("de");
const props = withDefaults(defineProps(), {
    accountId: "all",
    days: 30,
    accountGrouping: "all",
    mode: "history",
    showHeader: true,
});
// Stores
const themeStore = useThemeStore();
const accountStore = useAccountStore();
const monthlyBalanceStore = useMonthlyBalanceStore();
const planningStore = usePlanningStore();
// Chart-Referenzen
const chartContainer = ref();
let chart = null;
let themeObserver = null;
// Responsive
const isSmallScreen = ref(false);
// Interne State für autarke Komponente (wenn showHeader = true)
const selectedAccountId = ref(props.accountId || "all");
const accountTrendDays = ref(props.days || 30);
const accountTrendMode = ref(props.mode || "history");
// Konten für das Dropdown
const accounts = computed(() => {
    const activeAccounts = accountStore.activeAccounts.filter((acc) => !acc.isOfflineBudget && acc.isActive);
    const accountTypes = [
        ...new Set(activeAccounts.map((acc) => acc.accountType)),
    ];
    const groupsWithActiveAccounts = accountStore.accountGroups.filter((g) => activeAccounts.some((acc) => acc.accountGroupId === g.id));
    // Alphabetische Sortierung je Abschnitt
    const sortedAccounts = [...activeAccounts].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de", {
        sensitivity: "base",
    }));
    const sortedTypes = [...accountTypes].sort((a, b) => String(a ?? "").localeCompare(String(b ?? ""), "de", {
        sensitivity: "base",
    }));
    const sortedGroups = [...groupsWithActiveAccounts].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "de", {
        sensitivity: "base",
    }));
    return {
        all: sortedAccounts,
        types: sortedTypes,
        groups: sortedGroups,
    };
});
// Account-Filter-Optionen
const getAccountFilterLabel = (accountId) => {
    if (accountId === "all")
        return "Alle Konten";
    if (accountId.startsWith("type:")) {
        const type = accountId.substring("type:".length);
        return `Konto-Typ: ${type}`;
    }
    if (accountId.startsWith("group:")) {
        const groupId = accountId.substring("group:".length);
        const group = accountStore.accountGroups.find((g) => g.id === groupId);
        return group ? `Konto-Gruppe: ${group.name}` : "Konto-Gruppe";
    }
    const account = accountStore.getAccountById(accountId);
    return account ? account.name : "Unbekanntes Konto";
};
// DaisyUI Theme-Integration
const getCSSVariableValue = (variableName) => {
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
const getFontFamily = () => {
    const htmlElement = document.documentElement;
    const computedStyle = getComputedStyle(htmlElement);
    const fontFamily = computedStyle.fontFamily;
    return (fontFamily || "Inter, 'Source Sans Pro', Roboto, system-ui, sans-serif");
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
const getDateFormat = (days) => {
    if (days <= 30) {
        return "DD.MM";
    }
    else {
        return "DD.MM.YYYY";
    }
};
// Daten berechnen
const chartData = computed(() => {
    // Verwende interne State wenn showHeader=true, sonst Props
    const currentAccountId = props.showHeader
        ? selectedAccountId.value
        : props.accountId;
    const currentDays = props.showHeader ? accountTrendDays.value : props.days;
    const currentMode = props.showHeader
        ? accountTrendMode.value
        : props.mode || "history";
    let startDate, endDate;
    if (currentMode === "forecast") {
        // Prognose: Von heute in die Zukunft
        startDate = new Date();
        endDate = new Date();
        endDate.setDate(endDate.getDate() + currentDays);
    }
    else {
        // Vergangenheit: Von X Tagen zurück bis heute
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - currentDays);
    }
    const dateFormat = getDateFormat(currentDays);
    let series = [];
    // Hilfsfunktion: Aggregierte Serie über mehrere Konten (immer als verlaufender Gesamtsaldo)
    const buildAggregatedSeries = (name, accountIds, isForecast) => {
        // 1) Tagesachse aufbauen
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        const dateKeys = [];
        let cursor = start.clone();
        while (cursor.isSameOrBefore(end)) {
            dateKeys.push(cursor.format("YYYY-MM-DD"));
            cursor = cursor.add(1, "day");
        }
        if (isForecast) {
            // 2) Prognose: pro Konto mit aktuellem Saldo starten und geplante Buchungen kumulativ addieren
            const running = {};
            accountIds.forEach((accId) => {
                running[accId] = BalanceService.getTodayBalance("account", accId);
            });
            // Geplante Transaktionen für alle betroffenen Konten im Zeitraum vorgruppieren
            const horizon = (props.showHeader ? accountTrendDays.value : props.days) ?? 30;
            const allPlanned = planningStore.getUpcomingTransactions(horizon + 30);
            const plansByDateByAcc = {};
            allPlanned.forEach((tx) => {
                const accId = tx.transaction?.accountId;
                if (!accId || !accountIds.includes(accId))
                    return;
                const d = dayjs(tx.date);
                if (d.isBefore(start) || d.isAfter(end))
                    return;
                const k = d.format("YYYY-MM-DD");
                if (!plansByDateByAcc[k])
                    plansByDateByAcc[k] = {};
                plansByDateByAcc[k][accId] =
                    (plansByDateByAcc[k][accId] || 0) + (tx.transaction?.amount || 0);
            });
            const data = [];
            dateKeys.forEach((k) => {
                let total = 0;
                const dayPlans = plansByDateByAcc[k] || {};
                accountIds.forEach((accId) => {
                    const add = dayPlans[accId] || 0;
                    running[accId] += add;
                    total += Math.round(running[accId]);
                });
                data.push({ x: dayjs(k).valueOf(), y: total });
            });
            series.push({
                name,
                data,
                id: `agg_${name.replace(/\s+/g, "_").toLowerCase()}_forecast`,
            });
        }
        else {
            // 3) Vergangenheit: pro Konto die echten Tages-Laufsalden summieren
            const byAcc = {};
            accountIds.forEach((accId) => {
                const balances = BalanceService.getRunningBalances("account", accId, [startDate, endDate], { includeProjection: false });
                byAcc[accId] = {};
                balances.forEach((b) => {
                    byAcc[accId][b.date] = Math.round(b.balance);
                });
            });
            const data = [];
            dateKeys.forEach((k) => {
                let total = 0;
                accountIds.forEach((accId) => {
                    total += byAcc[accId][k] ?? 0;
                });
                data.push({ x: dayjs(k).valueOf(), y: total });
            });
            series.push({
                name,
                data,
                id: `agg_${name.replace(/\s+/g, "_").toLowerCase()}`,
            });
        }
    };
    if (currentAccountId === "all") {
        // Gesamtentwicklung aller aktiven Konten (Netto)
        const activeAccounts = accountStore.activeAccounts.filter((acc) => !acc.isOfflineBudget && acc.isActive);
        const ids = activeAccounts.map((a) => a.id);
        buildAggregatedSeries("Alle Konten", ids, currentMode === "forecast");
    }
    else if (typeof currentAccountId === "string" &&
        currentAccountId.startsWith("type:")) {
        // Aggregation nach Konto-Typ
        const type = currentAccountId.substring("type:".length);
        const activeTypeAccounts = accountStore.activeAccounts.filter((acc) => !acc.isOfflineBudget && acc.isActive && String(acc.accountType) === type);
        buildAggregatedSeries(`Typ ${type}`, activeTypeAccounts.map((a) => a.id), currentMode === "forecast");
    }
    else if (typeof currentAccountId === "string" &&
        currentAccountId.startsWith("group:")) {
        // Aggregation nach Konto-Gruppe
        const groupId = currentAccountId.substring("group:".length);
        const groupAccounts = accountStore.activeAccounts.filter((acc) => !acc.isOfflineBudget && acc.isActive && acc.accountGroupId === groupId);
        const groupName = accountStore.accountGroups.find((g) => g.id === groupId)?.name ||
            "Konto-Gruppe";
        buildAggregatedSeries(`${groupName}`, groupAccounts.map((a) => a.id), currentMode === "forecast");
    }
    else {
        // Einzelnes Konto
        const account = accountStore.getAccountById(currentAccountId);
        if (account) {
            if (currentMode === "forecast") {
                // Prognose: Berechne echte Prognose-Salden basierend auf aktuellem Saldo + geplante Transaktionen
                const currentBalance = BalanceService.getTodayBalance("account", currentAccountId);
                const data = [];
                let runningBalance = currentBalance;
                let current = dayjs(startDate);
                const end = dayjs(endDate);
                // Hole alle geplanten Transaktionen für den Zeitraum aus planningStore
                const allPlannedTransactions = planningStore.getUpcomingTransactions(currentDays + 30);
                const accountPlannedTransactions = allPlannedTransactions.filter((tx) => {
                    const txDate = dayjs(tx.date);
                    return (tx.transaction?.accountId === currentAccountId &&
                        txDate.isSameOrAfter(dayjs(startDate)) &&
                        txDate.isSameOrBefore(dayjs(endDate)));
                });
                while (current.isSameOrBefore(end)) {
                    const currentDate = current.format("YYYY-MM-DD");
                    // Addiere alle geplanten Transaktionen für diesen Tag
                    const dayTransactions = accountPlannedTransactions.filter((tx) => dayjs(tx.date).format("YYYY-MM-DD") === currentDate);
                    dayTransactions.forEach((tx) => {
                        runningBalance += tx.transaction?.amount || 0;
                    });
                    data.push({
                        x: current.valueOf(),
                        y: Math.round(runningBalance),
                    });
                    current = current.add(1, "day");
                }
                if (data.length > 0) {
                    series.push({
                        name: `${account.name} (Prognose)`,
                        data,
                        id: `${account.id}_forecast`,
                    });
                }
            }
            else {
                // Vergangenheit: Verwende BalanceService für echte Kontostände
                const balances = BalanceService.getRunningBalances("account", currentAccountId, [startDate, endDate], { includeProjection: false });
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
    // Zeitraum bestimmen und Y-Achse für kurze Zeiträume stabilisieren
    const daysVal = (props.showHeader ? accountTrendDays.value : props.days) ?? 30;
    const isShortRange = daysVal < 90;
    let yAxisMin;
    let yAxisMax;
    // Für "schöne" Y-Achse
    let tickSpacing = 1;
    let computedTickAmount = 6;
    {
        const allY = data.series
            .flatMap((s) => s.data.map((p) => p.y))
            .filter((v) => typeof v === "number" && isFinite(v));
        if (allY.length > 0) {
            const minY = Math.min(...allY);
            const maxY = Math.max(...allY);
            const rawRange = maxY - minY;
            const base = Math.max(Math.abs(maxY), Math.abs(minY), 1);
            const safeRange = rawRange === 0 ? Math.max(1, Math.round(base * 0.02)) : rawRange;
            const pad = Math.max(1, Math.round(safeRange * 0.1));
            const roughMin = Math.floor(minY - pad);
            const roughMax = Math.ceil(maxY + pad);
            // "Nice numbers" Algorithmus für saubere Ticks (1-2-5 Raster)
            const niceNumber = (range, round) => {
                if (!isFinite(range) || range === 0)
                    return 1;
                const exp = Math.floor(Math.log10(Math.abs(range)));
                const frac = Math.abs(range) / Math.pow(10, exp);
                let niceFrac = 0;
                if (round) {
                    niceFrac = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
                }
                else {
                    niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
                }
                return niceFrac * Math.pow(10, exp);
            };
            const desiredTicks = 6;
            const niceRange = niceNumber(roughMax - roughMin, false);
            tickSpacing = niceNumber(niceRange / (desiredTicks - 1), true);
            // Für Währungsachsen auf "k" Raster normalisieren (1k,2k,5k,10k,...)
            if (tickSpacing >= 1000) {
                const allowed = [
                    1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000,
                ];
                tickSpacing = allowed.reduce((prev, curr) => Math.abs(curr - tickSpacing) < Math.abs(prev - tickSpacing)
                    ? curr
                    : prev, allowed[0]);
            }
            // Spezifische Korrektur: 30-Tage-Vergangenheit hatte unruhige Skala
            // Erzwinge ein sauberes 1-2-5-Raster im 100/200/500/1k Bereich und begrenze Tickanzahl
            const isHistoryMode = (props.showHeader
                ? accountTrendMode.value
                : props.mode || "history") === "history";
            const daysValLocal = (props.showHeader ? accountTrendDays.value : props.days) ?? 30;
            if (isHistoryMode && daysValLocal === 30) {
                const allowedSmall = [100, 200, 500, 1000, 2000, 5000];
                const span = Math.max(1, roughMax - roughMin);
                // Wähle Schrittweite so, dass 4-8 Ticks entstehen
                const target = span / 6;
                tickSpacing = allowedSmall.reduce((prev, curr) => Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev, allowedSmall[0]);
            }
            const niceMin = Math.floor(roughMin / tickSpacing) * tickSpacing;
            const niceMax = Math.ceil(roughMax / tickSpacing) * tickSpacing;
            yAxisMin = niceMin;
            yAxisMax = niceMax;
            computedTickAmount = Math.max(2, Math.round((niceMax - niceMin) / tickSpacing) + 1);
            // Für 30 Tage Vergangenheit: 5–7 Ticks sind am lesbarsten
            if (isHistoryMode && daysValLocal === 30) {
                computedTickAmount = Math.min(7, Math.max(5, computedTickAmount));
            }
            else {
                computedTickAmount = Math.min(10, computedTickAmount);
            }
        }
    }
    // Bestimme Farben basierend auf Anzahl der Serien
    let colors;
    if (data.series.length === 2 && data.series[1].id.includes("_projected")) {
        // Einzelkonto mit Prognose: Hauptfarbe und gestrichelte Variante
        colors = [themeColors.primary, themeColors.accent];
    }
    else {
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
                autoScaleYaxis: false,
            },
        },
        colors: colors,
        stroke: {
            width: data.series.map((s, index) => s.id.includes("_projected") ||
                s.id.includes("_forecast") ||
                (props.showHeader ? accountTrendMode.value : props.mode) === "forecast"
                ? 2
                : 3),
            curve: "smooth",
            dashArray: data.series.map((s, index) => s.id.includes("_projected") ||
                s.id.includes("_forecast") ||
                (props.showHeader ? accountTrendMode.value : props.mode) === "forecast"
                ? 5
                : 0),
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
                formatter: (value, timestamp, opts) => {
                    const date = dayjs(typeof value === "number" ? value : parseInt(value));
                    if ((props.showHeader ? accountTrendDays.value : props.days) >= 90) {
                        return date.format("MM/YYYY");
                    }
                    else if ((props.showHeader ? accountTrendDays.value : props.days) <= 30) {
                        return date.format("DD.MM");
                    }
                    else {
                        return date.format("DD.MM.YYYY");
                    }
                },
                showDuplicates: false,
                maxHeight: (props.showHeader ? accountTrendDays.value : props.days) >= 90
                    ? 60
                    : undefined,
                datetimeUTC: false,
                datetimeFormatter: {
                    year: "yyyy",
                    month: (props.showHeader ? accountTrendDays.value : props.days) >= 90
                        ? "MM/yyyy"
                        : "MMM",
                    day: (props.showHeader ? accountTrendDays.value : props.days) <= 30
                        ? "dd.MM"
                        : "dd.MM.yyyy",
                    hour: "HH:mm",
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
                    ? props.showHeader
                        ? accountTrendDays.value
                        : props.days
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
                formatter: (val) => {
                    const absStep = Math.abs(tickSpacing);
                    if (absStep >= 1000000) {
                        const decimals = Number.isInteger(absStep / 1000000) ? 0 : 1;
                        return (val / 1000000).toFixed(decimals) + "M€";
                    }
                    if (absStep >= 1000) {
                        const decimals = Number.isInteger(absStep / 1000) ? 0 : 1;
                        return (val / 1000).toFixed(decimals) + "k€";
                    }
                    return Math.round(val) + "€";
                },
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
            logarithmic: false,
            // Eigene "Nice Scale" - Apex nicht erneut skalieren lassen
            forceNiceScale: false,
            floating: false,
            ...(typeof yAxisMin === "number" && typeof yAxisMax === "number"
                ? {
                    min: yAxisMin,
                    max: yAxisMax,
                }
                : {}),
            tickAmount: computedTickAmount,
            decimalsInFloat: 0,
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
                // Tooltip: immer exakter Integerwert in € (kein k/M-Kürzel)
                formatter: (val) => `${Math.round(val).toLocaleString("de-DE")}€`,
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
            position: "back",
            ...(props.days >= 90 && {
                row: {
                    colors: ["transparent"],
                    opacity: 0.5,
                },
                column: {
                    colors: ["transparent"],
                    opacity: 0.1,
                },
            }),
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
    if (!chartContainer.value || !chartOptions.value)
        return;
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
    }
    else if (chartOptions.value) {
        createChart();
    }
};
// Theme-Observer Setup
const setupThemeObserver = () => {
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
// Watchers
watch(() => [props.accountId, props.days, props.accountGrouping, props.mode], () => {
    updateChart();
}, { deep: true });
// Watchers für interne State (wenn showHeader = true)
watch(() => [
    selectedAccountId.value,
    accountTrendDays.value,
    accountTrendMode.value,
], () => {
    if (props.showHeader) {
        updateChart();
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
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    accountId: "all",
    days: 30,
    accountGrouping: "all",
    mode: "history",
    showHeader: true,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (__VLS_ctx.showHeader) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "card-title text-lg" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedAccountId),
        ...{ class: "select select-bordered select-xs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "all",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.optgroup, __VLS_intrinsicElements.optgroup)({
        label: "Konten",
    });
    for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accounts.all))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (account.id),
            value: (account.id),
        });
        (account.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.optgroup, __VLS_intrinsicElements.optgroup)({
        label: "Konto-Typ",
    });
    for (const [accountType] of __VLS_getVForSourceType((__VLS_ctx.accounts.types))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (`type-${accountType}`),
            value: (`type:${accountType}`),
        });
        (accountType);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.optgroup, __VLS_intrinsicElements.optgroup)({
        label: "Konto-Gruppen",
    });
    for (const [group] of __VLS_getVForSourceType((__VLS_ctx.accounts.groups))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (`group-${group.id}`),
            value: (`group:${group.id}`),
        });
        (group.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.accountTrendMode),
        ...{ class: "select select-bordered select-xs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "history",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "forecast",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.accountTrendDays),
        ...{ class: "select select-bordered select-xs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (7),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (30),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (90),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (180),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (365),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "h-64" },
    });
    if (!__VLS_ctx.chartData.hasData) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center justify-center h-full text-base-content/70" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-lg mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ref: "chartContainer",
            ...{ class: "w-full h-full" },
        });
        /** @type {typeof __VLS_ctx.chartContainer} */ ;
    }
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-full h-full" },
    });
    if (!__VLS_ctx.chartData.hasData) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center justify-center h-full text-base-content/70" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-lg mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ref: "chartContainer",
            ...{ class: "w-full h-full" },
        });
        /** @type {typeof __VLS_ctx.chartContainer} */ ;
    }
}
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['transition']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-150']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            chartContainer: chartContainer,
            selectedAccountId: selectedAccountId,
            accountTrendDays: accountTrendDays,
            accountTrendMode: accountTrendMode,
            accounts: accounts,
            chartData: chartData,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
