import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useThemeStore } from "../../../stores/themeStore";
import { TransactionService } from "../../../services/TransactionService";
import ApexCharts from "apexcharts";
const props = withDefaults(defineProps(), {
    showHeader: true,
});
// Stores
const themeStore = useThemeStore();
// Chart-Referenzen
const chartContainer = ref();
let chart = null;
let themeObserver = null;
let resizeObserver = null;
const cardBodyRef = ref();
const headerRef = ref(null);
// Responsive
const isSmallScreen = ref(false);
// Formatiert Währungsbeträge als vollständige Integer-Werte
const formatFullCurrency = (value) => {
    if (value === 0)
        return "0€";
    return Math.round(value).toLocaleString("de-DE") + "€";
};
// Formatiert Y-Achsen-Labels in gekürzter k-Angabe
const formatYAxisCurrency = (value) => {
    if (value === 0)
        return "0€";
    const absValue = Math.abs(value);
    let formatted = "";
    if (absValue >= 1000000) {
        formatted = Math.round(value / 1000000) + "M€";
    }
    else if (absValue >= 1000) {
        formatted = Math.round(value / 1000) + "k€";
    }
    else {
        formatted = Math.round(value) + "€";
    }
    return formatted;
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
// Screen-Size-Watcher
const updateScreenSize = () => {
    isSmallScreen.value = window.innerWidth < 640;
};
// Daten berechnen
const chartData = computed(() => {
    const summary = TransactionService.getIncomeExpenseSummary(props.startDate, props.endDate);
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
            formatter: (val) => formatFullCurrency(val),
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
                formatter: (val) => formatYAxisCurrency(val),
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
                formatter: (val) => formatFullCurrency(val),
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
    const availableH = Math.max(80, totalH - headerH - verticalPadding - gapBelowHeader);
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
    if (!chartContainer.value)
        return;
    if (chart) {
        chart.destroy();
    }
    chart = new ApexCharts(chartContainer.value, getSizedOptions());
    chart.render();
};
// Chart aktualisieren
const updateChart = (animate = true) => {
    if (chart) {
        // keine Pfad-Neuzeichnung, keine Animation -> weniger Reflows/Jank
        chart.updateOptions(getSizedOptions(), false, animate);
    }
};
// rAF-Coalescing + optionales Debounce
const DEBOUNCE_RESIZE_MS = 120;
let rafId = null;
let debounceId = null;
let pendingAnimate = true;
const scheduleUpdate = (opts) => {
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
        if (debounceId)
            window.clearTimeout(debounceId);
        debounceId = window.setTimeout(() => {
            debounceId = null;
            if (rafId)
                return; // bereits geplant
            rafId = requestAnimationFrame(flush);
        }, debounceMs);
        return;
    }
    if (rafId)
        return;
    rafId = requestAnimationFrame(flush);
};
// Theme-Observer Setup
const setupThemeObserver = () => {
    themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === "attributes" &&
                mutation.attributeName === "data-theme") {
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
watch(() => [props.startDate, props.endDate], () => {
    scheduleUpdate();
}, { deep: true });
watch(() => themeStore.isDarkMode, () => {
    setTimeout(() => {
        scheduleUpdate();
    }, 50);
});
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
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    showHeader: true,
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['eisc-container']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body h-[160px] p-4 flex flex-col overflow-hidden" },
    ref: "cardBodyRef",
});
/** @type {typeof __VLS_ctx.cardBodyRef} */ ;
if (__VLS_ctx.showHeader) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2" },
        ref: "headerRef",
    });
    /** @type {typeof __VLS_ctx.headerRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "card-title text-lg" },
    });
    const __VLS_0 = {}.RouterLink;
    /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.RouterLink, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        to: ({ name: 'transactions' }),
        ...{ class: "btn btn-sm btn-ghost" },
    }));
    const __VLS_2 = __VLS_1({
        to: ({ name: 'transactions' }),
        ...{ class: "btn btn-sm btn-ghost" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_3.slots.default;
    var __VLS_3;
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "card-title text-lg mb-2" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "chartContainer",
    ...{ class: "w-full flex-1 min-h-0 overflow-hidden h-full eisc-container" },
});
/** @type {typeof __VLS_ctx.chartContainer} */ ;
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
/** @type {__VLS_StyleScopedClasses['h-[160px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['eisc-container']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            chartContainer: chartContainer,
            cardBodyRef: cardBodyRef,
            headerRef: headerRef,
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
