import { ref, computed, onMounted, onUnmounted } from "vue";
import dayjs from "dayjs";
import { Icon } from "@iconify/vue";
import { useRoute, useRouter } from "vue-router";
import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { useMonthlyBalanceStore } from "@/stores/monthlyBalanceStore";
import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
import ForecastChart from "@/components/ui/charts/ForecastChart.vue";
import DetailedForecastChart from "@/components/ui/charts/DetailedForecastChart.vue";
import { TransactionType } from "../types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import DateRangePicker from "@/components/ui/DateRangePicker.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import InfoToast from "@/components/ui/InfoToast.vue";
import { formatDate } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { PlanningService } from "@/services/PlanningService";
import { BalanceService } from "@/services/BalanceService";
import { BudgetService } from "@/services/BudgetService";
const route = useRoute();
const router = useRouter();
const planningStore = usePlanningStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const monthlyBalanceStore = useMonthlyBalanceStore();
// UI‑Status
const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const showExecuteConfirmation = ref(false);
const selectedPlanning = ref(null);
const searchQuery = ref("");
const selectedAccountId = ref("");
const selectedCategoryId = ref("");
const activeTab = ref("upcoming");
// Für die Ausführungsbestätigung
const pendingExecutionAnalysis = ref(null);
// Toast-System
const toastMessage = ref("");
const toastType = ref("info");
const showToast = ref(false);
// Detailansicht für Charts
const selectedAccountForDetail = ref("");
const selectedCategoryForDetail = ref("");
// DateRangePicker reference for navigation
const dateRangePickerRef = ref(null);
// Zeitraum
const dateRange = ref({
    start: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
    end: dayjs().endOf("month").format("YYYY-MM-DD"),
});
// Letztes Prognose‑Update
const lastUpdateDate = computed(() => {
    const ts = localStorage.getItem("finwise_last_forecast_update");
    return ts ? new Date(parseInt(ts)) : null;
});
// Zeitraum‑Update durch MonthSelector
function handleDateRangeUpdate(payload) {
    dateRange.value = payload;
}
// Navigation methods for chevron buttons
function navigateMonth(direction) {
    if (dateRangePickerRef.value) {
        dateRangePickerRef.value.navigateRangeByMonth(direction);
    }
}
/**
 * Berechnet alle anstehenden Ausführungstermine im ausgewählten Zeitraum.
 * Ergebnis: sortiertes Array aus { date, transaction }.
 */
const upcomingTransactionsInRange = computed(() => {
    const start = dateRange.value.start;
    const end = dateRange.value.end;
    const list = [];
    planningStore.planningTransactions.forEach((plan) => {
        if (!plan.isActive)
            return;
        const occurrences = PlanningService.calculateNextOccurrences(plan, start, end);
        occurrences.forEach((dateStr) => {
            list.push({ date: dateStr, transaction: plan });
        });
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
});
// Suche & Filter
const filteredTransactions = computed(() => {
    let data = [...upcomingTransactionsInRange.value];
    // Filter nach Konto
    if (selectedAccountId.value) {
        data = data.filter((e) => {
            const t = e.transaction;
            // Hauptbuchung mit dem gewählten Konto
            if (t.accountId === selectedAccountId.value) {
                return true;
            }
            // Bei Kontotransfers: Zielkonto prüfen
            if (t.transactionType === TransactionType.ACCOUNTTRANSFER &&
                t.transferToAccountId === selectedAccountId.value) {
                return true;
            }
            return false;
        });
    }
    // Filter nach Kategorie
    if (selectedCategoryId.value) {
        data = data.filter((e) => {
            const t = e.transaction;
            // Hauptbuchung mit der gewählten Kategorie
            if (t.categoryId === selectedCategoryId.value) {
                return true;
            }
            // Bei Kategorietransfers: Zielkategorie prüfen
            if (t.transactionType === TransactionType.CATEGORYTRANSFER &&
                t.transferToCategoryId === selectedCategoryId.value) {
                return true;
            }
            return false;
        });
    }
    // Gegenbuchungen IMMER herausfiltern (unabhängig von Filtern)
    data = data.filter((e) => {
        const t = e.transaction;
        // Gegenbuchungen über Namen erkennen und ausblenden
        if (t.name && t.name.includes("(Gegenbuchung)")) {
            return false;
        }
        // Zusätzliche Prüfung: Bei Transfers mit counterPlanningTransactionId
        // ist die Gegenbuchung diejenige mit positivem Betrag
        if (t.counterPlanningTransactionId &&
            (t.transactionType === TransactionType.ACCOUNTTRANSFER ||
                t.transactionType === TransactionType.CATEGORYTRANSFER)) {
            const counterPlanning = planningStore.planningTransactions.find((counter) => counter.id === t.counterPlanningTransactionId);
            if (counterPlanning && t.amount > 0 && counterPlanning.amount < 0) {
                return false; // Gegenbuchung ausblenden
            }
        }
        return true;
    });
    if (searchQuery.value.trim()) {
        const term = searchQuery.value.toLowerCase();
        data = data.filter((e) => {
            const t = e.transaction;
            return (t.name.toLowerCase().includes(term) ||
                (recipientStore
                    .getRecipientById(t.recipientId || "")
                    ?.name.toLowerCase()
                    .includes(term) ??
                    false) ||
                (accountStore
                    .getAccountById(t.accountId)
                    ?.name.toLowerCase()
                    .includes(term) ??
                    false) ||
                (categoryStore
                    .getCategoryById(t.categoryId || "")
                    ?.name.toLowerCase()
                    .includes(term) ??
                    false) ||
                String(t.amount).includes(term));
        });
    }
    return data;
});
// CRUD‑Aktionen
function createPlanning() {
    selectedPlanning.value = null;
    showNewPlanningModal.value = true;
}
function editPlanning(planning) {
    selectedPlanning.value = planning;
    showEditPlanningModal.value = true;
}
function savePlanning(data) {
    // Sofort das Modal schließen
    showNewPlanningModal.value = false;
    showEditPlanningModal.value = false;
    // Dann asynchron die Daten speichern
    (async () => {
        try {
            if (selectedPlanning.value) {
                await PlanningService.updatePlanningTransaction(selectedPlanning.value.id, data);
            }
            else {
                await PlanningService.addPlanningTransaction(data);
            }
        }
        catch (error) {
            console.error("Fehler beim Speichern der Planung:", error);
            showToastMessage("Fehler beim Speichern der Planung", "error");
        }
    })();
}
function deletePlanning(planning) {
    if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
        PlanningService.deletePlanningTransaction(planning.id);
        BalanceService.calculateAllMonthlyBalances();
    }
}
function executePlanning(planningId, date) {
    PlanningService.executePlanningTransaction(planningId, date);
}
function skipPlanning(planningId, date) {
    PlanningService.skipPlanningTransaction(planningId, date);
}
// Neue Methoden für die Anzeige von Transaktionstypen
function getTransactionTypeIcon(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
            return "mdi:bank-transfer";
        case TransactionType.CATEGORYTRANSFER:
            return "mdi:briefcase-transfer-outline";
        case TransactionType.EXPENSE:
            return "mdi:bank-transfer-out";
        case TransactionType.INCOME:
            return "mdi:bank-transfer-in";
        default:
            return "mdi:help-circle-outline";
    }
}
function getTransactionTypeClass(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
        case TransactionType.CATEGORYTRANSFER:
            return "text-warning";
        case TransactionType.EXPENSE:
            return "text-error";
        case TransactionType.INCOME:
            return "text-success";
        default:
            return "";
    }
}
function getTransactionTypeLabel(type) {
    switch (type) {
        case TransactionType.ACCOUNTTRANSFER:
            return "Kontotransfer";
        case TransactionType.CATEGORYTRANSFER:
            return "Kategorietransfer";
        case TransactionType.EXPENSE:
            return "Ausgabe";
        case TransactionType.INCOME:
            return "Einnahme";
        default:
            return "Unbekannt";
    }
}
// Hilfsfunktion zur korrekten Anzeige von Quelle und Ziel je nach Transaktionstyp
function getSourceName(planning) {
    if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        return (categoryStore.getCategoryById(planning.categoryId || "")?.name || "-");
    }
    else {
        return accountStore.getAccountById(planning.accountId)?.name || "-";
    }
}
function getTargetName(planning) {
    if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        return (categoryStore.getCategoryById(planning.transferToCategoryId || "")
            ?.name || "-");
    }
    else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
        return (accountStore.getAccountById(planning.transferToAccountId || "")?.name ||
            "-");
    }
    else {
        return (categoryStore.getCategoryById(planning.categoryId || "")?.name || "-");
    }
}
// Hilfs‑Funktionen
function clearFilters() {
    selectedAccountId.value = "";
    selectedCategoryId.value = "";
    searchQuery.value = "";
}
// Chart-Detail-Funktionen
function showAccountDetail(accountId) {
    selectedAccountForDetail.value = accountId;
}
function showCategoryDetail(categoryId) {
    selectedCategoryForDetail.value = categoryId;
}
function hideAccountDetail() {
    selectedAccountForDetail.value = "";
}
function hideCategoryDetail() {
    selectedCategoryForDetail.value = "";
}
// Forecast-Daten für detaillierte Anzeige (6 Monate ab aktuellem Monat)
function getAccountForecastData(accountId) {
    const forecasts = [];
    const startDate = dayjs(dateRange.value.start).startOf("month");
    let previousMonthProjectedBalance = null;
    // 6 Monate ab dem aktuellen Monat generieren
    for (let i = 0; i < 6; i++) {
        const currentDate = startDate.add(i, "month");
        const monthStart = currentDate.format("YYYY-MM-DD");
        const monthEnd = currentDate.endOf("month").format("YYYY-MM-DD");
        // Startsaldo und Endsaldo berechnen
        let startBalance;
        let projectedBalance;
        if (i === 0) {
            // Erster Monat: Startsaldo ist der projizierte Saldo des Vormonats
            const prevMonth = currentDate.subtract(1, "month");
            const prevMonthEnd = prevMonth.endOf("month");
            startBalance =
                monthlyBalanceStore.getProjectedAccountBalanceForDate(accountId, new Date(prevMonthEnd.format("YYYY-MM-DD"))) ??
                    BalanceService.getProjectedBalance("account", accountId, new Date(prevMonthEnd.format("YYYY-MM-DD")));
            // Endsaldo ist der projizierte Saldo am Monatsende des aktuellen Monats
            projectedBalance =
                monthlyBalanceStore.getProjectedAccountBalanceForDate(accountId, new Date(monthEnd)) ??
                    BalanceService.getProjectedBalance("account", accountId, new Date(monthEnd));
        }
        else {
            // Nachfolgende Monate: Startsaldo ist der projizierte Endsaldo des Vormonats
            startBalance = previousMonthProjectedBalance ?? 0;
            // Endsaldo ist der projizierte Saldo am Monatsende
            projectedBalance =
                monthlyBalanceStore.getProjectedAccountBalanceForDate(accountId, new Date(monthEnd)) ??
                    BalanceService.getProjectedBalance("account", accountId, new Date(monthEnd));
        }
        // Geplante Transaktionen für diesen Monat sammeln
        const monthTransactions = [];
        let plannedTransactionsSum = 0;
        planningStore.planningTransactions.forEach((plan) => {
            if (!plan.isActive || plan.accountId !== accountId)
                return;
            const occurrences = PlanningService.calculateNextOccurrences(plan, monthStart, monthEnd);
            occurrences.forEach((dateStr) => {
                const amount = plan.transactionType === TransactionType.INCOME
                    ? Math.abs(plan.amount)
                    : -Math.abs(plan.amount);
                monthTransactions.push({
                    date: dateStr,
                    description: plan.name,
                    amount: amount,
                });
                plannedTransactionsSum += amount;
            });
        });
        // Monatliche Änderung (nur Planbuchungen)
        const monthlyChangePlanned = plannedTransactionsSum;
        // Monatliche Änderung (inkl. existierende Transaktionen) = Endsaldo - Startsaldo
        const monthlyChangeTotal = projectedBalance - startBalance;
        // Debug-Log für Problemanalyse
        if (i === 0) {
            debugLog("PlanningView", `Aktueller Monat ${monthStart}: Start=${startBalance}€, Ende=${projectedBalance}€, Änderung=${monthlyChangeTotal}€, Planungen=${monthlyChangePlanned}€`);
        }
        // Für den nächsten Monat merken
        previousMonthProjectedBalance = projectedBalance;
        forecasts.push({
            month: currentDate.format("MMMM YYYY"),
            balance: startBalance,
            projectedBalance: projectedBalance,
            monthlyChangePlanned: monthlyChangePlanned,
            monthlyChangeTotal: monthlyChangeTotal,
            transactions: monthTransactions.sort((a, b) => a.date.localeCompare(b.date)),
        });
    }
    return forecasts;
}
// Computed für Category Forecast Data um auf Store-Änderungen zu reagieren
const categoryForecastData = computed(() => {
    return (categoryId) => {
        const forecasts = [];
        const startDate = dayjs(dateRange.value.start).startOf("month");
        // 6 Monate ab dem aktuellen Monat generieren
        for (let i = 0; i < 6; i++) {
            const currentDate = startDate.add(i, "month");
            const monthStart = new Date(currentDate.format("YYYY-MM-DD"));
            const monthEnd = new Date(currentDate.endOf("month").format("YYYY-MM-DD"));
            // Geplante Transaktionen für diese Kategorie in diesem Monat sammeln
            const monthTransactions = [];
            planningStore.planningTransactions.forEach((plan) => {
                if (!plan.isActive || plan.categoryId !== categoryId)
                    return;
                const occurrences = PlanningService.calculateNextOccurrences(plan, currentDate.format("YYYY-MM-DD"), currentDate.endOf("month").format("YYYY-MM-DD"));
                occurrences.forEach((dateStr) => {
                    const amount = plan.transactionType === TransactionType.INCOME
                        ? Math.abs(plan.amount)
                        : -Math.abs(plan.amount);
                    monthTransactions.push({
                        date: dateStr,
                        description: plan.name,
                        amount: amount,
                    });
                });
            });
            // Verwende BudgetService für konsistente Daten wie in BudgetMonthCard.vue
            const budgetData = BudgetService.getAggregatedMonthlyBudgetData(categoryId, monthStart, monthEnd);
            // Werte direkt aus BudgetService übernehmen (wie in BudgetMonthCard.vue)
            const budgeted = budgetData.budgeted;
            const activity = budgetData.spent;
            const forecastAmount = budgetData.forecast;
            const available = budgetData.saldo;
            // Überzogen-Status basierend auf verfügbarem Saldo
            const isOverspent = available < 0;
            debugLog("PlanningView", `Kategorie ${categoryId} ${currentDate.format("MMMM YYYY")}: Budgetiert=${budgeted}€, Aktivität=${activity}€, Prognose=${forecastAmount}€, Verfügbar=${available}€, Überzogen=${isOverspent}`);
            forecasts.push({
                month: currentDate.format("MMMM YYYY"),
                budgeted: budgeted,
                activity: activity,
                available: available,
                isOverspent: isOverspent,
                transactions: monthTransactions.sort((a, b) => a.date.localeCompare(b.date)),
            });
        }
        return forecasts;
    };
});
// Toast-Funktion
function showToastMessage(message, type = "info") {
    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;
}
// Button: Alle fälligen
async function executeAllDuePlannings() {
    // Erst analysieren, was ausgeführt werden würde
    const analysis = await analyzeDuePlannings();
    if (analysis.totalCount === 0) {
        showToastMessage("Keine fälligen Planungsbuchungen gefunden.", "info");
        return;
    }
    // ConfirmationModal anzeigen
    showExecuteConfirmation.value = true;
    pendingExecutionAnalysis.value = analysis;
}
// Analysiert fällige Planungen und kategorisiert sie
async function analyzeDuePlannings() {
    const planningStore = usePlanningStore();
    const today = dayjs().startOf("day");
    let expenses = 0;
    let income = 0;
    let accountTransfers = 0;
    let categoryTransfers = 0;
    const processedPlanningIds = new Set();
    const planningsToProcess = [...planningStore.planningTransactions];
    for (const planning of planningsToProcess) {
        if (processedPlanningIds.has(planning.id) || !planning.isActive) {
            continue;
        }
        // Gegenbuchungen überspringen (erkennbar am Namen)
        if (planning.name && planning.name.includes("(Gegenbuchung)")) {
            continue;
        }
        // Fällige Termine ermitteln
        const overdueOccurrences = PlanningService.calculateNextOccurrences(planning, planning.startDate, today.format("YYYY-MM-DD"));
        if (overdueOccurrences.length > 0) {
            for (const dateStr of overdueOccurrences) {
                if (dayjs(dateStr).isSameOrBefore(today)) {
                    // Nach Transaktionstyp kategorisieren
                    switch (planning.transactionType) {
                        case TransactionType.EXPENSE:
                            expenses++;
                            break;
                        case TransactionType.INCOME:
                            income++;
                            break;
                        case TransactionType.ACCOUNTTRANSFER:
                            accountTransfers++;
                            break;
                        case TransactionType.CATEGORYTRANSFER:
                            categoryTransfers++;
                            break;
                    }
                    // Bei Transfers: Gegenbuchung als verarbeitet markieren
                    if ((planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
                        planning.transactionType === TransactionType.CATEGORYTRANSFER) &&
                        planning.counterPlanningTransactionId) {
                        processedPlanningIds.add(planning.counterPlanningTransactionId);
                    }
                    processedPlanningIds.add(planning.id);
                }
            }
        }
    }
    return {
        expenses,
        income,
        accountTransfers,
        categoryTransfers,
        totalCount: expenses + income + accountTransfers + categoryTransfers,
    };
}
// Bestätigung der Ausführung
async function confirmExecution() {
    if (!pendingExecutionAnalysis.value)
        return;
    try {
        const count = await PlanningService.executeAllDuePlanningTransactions();
        showExecuteConfirmation.value = false;
        pendingExecutionAnalysis.value = null;
        showToastMessage(`${count} automatische Planungsbuchungen erfolgreich ausgeführt.`, "success");
    }
    catch (error) {
        showToastMessage("Fehler beim Ausführen der Planungsbuchungen. Bitte prüfen Sie die Konsole für Details.", "error");
    }
}
// Abbruch der Ausführung
function cancelExecution() {
    showExecuteConfirmation.value = false;
    pendingExecutionAnalysis.value = null;
}
// Erstellt die Bestätigungsnachricht
function getConfirmationMessage() {
    if (!pendingExecutionAnalysis.value)
        return "";
    const analysis = pendingExecutionAnalysis.value;
    const parts = [];
    if (analysis.expenses > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-error badge-sm mr-2">Ausgaben</span><span class="font-semibold">${analysis.expenses} Buchung${analysis.expenses === 1 ? "" : "en"}</span></div>`);
    }
    if (analysis.income > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-success badge-sm mr-2">Einnahmen</span><span class="font-semibold">${analysis.income} Buchung${analysis.income === 1 ? "" : "en"}</span></div>`);
    }
    if (analysis.accountTransfers > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-warning badge-sm mr-2">Kontotransfers</span><span class="font-semibold">${analysis.accountTransfers} Buchung${analysis.accountTransfers === 1 ? "" : "en"}</span></div>`);
    }
    if (analysis.categoryTransfers > 0) {
        parts.push(`<div class="flex items-center mb-2"><span class="badge badge-info badge-sm mr-2">Kategorietransfers</span><span class="font-semibold">${analysis.categoryTransfers} Buchung${analysis.categoryTransfers === 1 ? "" : "en"}</span></div>`);
    }
    if (parts.length === 0)
        return "<p class='text-center text-base-content/70'>Keine fälligen Buchungen gefunden.</p>";
    return `
    <div class="space-y-3">
      <p class="text-sm text-base-content/80 mb-4">Folgende fällige Planungsbuchungen werden ausgeführt:</p>
      <div class="space-y-2">
        ${parts.join("")}
      </div>
      <div class="divider my-4"></div>
      <div class="text-center">
        <span class="badge badge-primary badge-lg">
          Insgesamt: ${analysis.totalCount} Buchung${analysis.totalCount === 1 ? "" : "en"}
        </span>
      </div>
    </div>
  `;
}
// Service‑Aufrufe
function executeAutomaticTransactions() {
    executeAllDuePlannings();
}
function updateForecasts() {
    PlanningService.updateForecasts();
    alert("Prognosen und monatliche Saldi wurden aktualisiert.");
}
// Keyboard Event Handler für ALT+n
function handleKeydown(event) {
    if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        createPlanning();
    }
}
// Auto‑Execute Check bei Mount
onMounted(() => {
    // Keyboard Event Listener hinzufügen
    document.addEventListener("keydown", handleKeydown);
    BalanceService.calculateMonthlyBalances();
    // Prognosebuchungen für zukünftige Zeiträume aktualisieren
    PlanningService.refreshForecastsForFuturePeriod();
    // Prüfe Query-Parameter für automatisches Öffnen des Bearbeitungsmodus
    const editId = route.query.edit;
    if (editId) {
        const planningToEdit = planningStore.getPlanningTransactionById(editId);
        if (planningToEdit) {
            editPlanning(planningToEdit);
            // Query-Parameter nach dem Öffnen entfernen
            router.replace({ query: {} });
        }
        else {
            debugLog("[PlanningView] Planning transaction not found for edit", editId);
        }
    }
    const today = dayjs().format("YYYY-MM-DD");
    let autoCount = 0;
    planningStore.planningTransactions.forEach((plan) => {
        if (!plan.isActive || !plan.autoExecute)
            return;
        const occ = PlanningService.calculateNextOccurrences(plan, today, today);
        if (occ.length)
            autoCount++;
    });
    if (autoCount > 0) {
        const run = confirm(`Es stehen ${autoCount} automatische Planungsbuchungen für heute an. Jetzt ausführen?`);
        if (run)
            executeAutomaticTransactions();
    }
});
// Cleanup bei Unmount
onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "space-y-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onBtnMiddleRightClick': {} },
    ...{ 'onBtnRightClick': {} },
    ...{ 'onSearch': {} },
    btnMiddleRight: "Alle fälligen ausführen",
    btnMiddleRightIcon: "mdi:play-circle",
    btnRight: "Neue Planung",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onBtnMiddleRightClick': {} },
    ...{ 'onBtnRightClick': {} },
    ...{ 'onSearch': {} },
    btnMiddleRight: "Alle fälligen ausführen",
    btnMiddleRightIcon: "mdi:play-circle",
    btnRight: "Neue Planung",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onBtnMiddleRightClick: (__VLS_ctx.executeAllDuePlannings)
};
const __VLS_7 = {
    onBtnRightClick: (__VLS_ctx.createPlanning)
};
const __VLS_8 = {
    onSearch: ((q) => (__VLS_ctx.searchQuery = q))
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tabs tabs-boxed bg-base-200" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'upcoming';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'upcoming' }) },
});
const __VLS_9 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    icon: "mdi:calendar-clock",
    ...{ class: "mr-2" },
}));
const __VLS_11 = __VLS_10({
    icon: "mdi:calendar-clock",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'accounts';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'accounts' }) },
});
const __VLS_13 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    icon: "mdi:chart-line",
    ...{ class: "mr-2" },
}));
const __VLS_15 = __VLS_14({
    icon: "mdi:chart-line",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'categories';
        } },
    ...{ class: "tab" },
    ...{ class: ({ 'tab-active': __VLS_ctx.activeTab === 'categories' }) },
});
const __VLS_17 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    icon: "mdi:chart-areaspline",
    ...{ class: "mr-2" },
}));
const __VLS_19 = __VLS_18({
    icon: "mdi:chart-areaspline",
    ...{ class: "mr-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
if (__VLS_ctx.activeTab === 'upcoming') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap justify-between items-end gap-4 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_21 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_23 = __VLS_22({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_26 = __VLS_25({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    let __VLS_28;
    let __VLS_29;
    let __VLS_30;
    const __VLS_31 = {
        'onUpdate:modelValue': (__VLS_ctx.handleDateRangeUpdate)
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_32 = {};
    var __VLS_27;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'upcoming'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_34 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent(__VLS_34, new __VLS_34({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_36 = __VLS_35({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedAccountId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedAccountId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.accountStore.activeAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (acc.id),
            value: (acc.id),
        });
        (acc.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedCategoryId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedCategoryId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.categoryStore.activeCategories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (cat.id),
            value: (cat.id),
        });
        (cat.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end" },
    });
    const __VLS_38 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_40 = __VLS_39({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "overflow-x-auto" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        ...{ class: "table w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [e] of __VLS_getVForSourceType((__VLS_ctx.filteredTransactions))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            key: (`${e.transaction.id}-${e.date}`),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.formatDate(e.date));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "text-center" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-primary" },
            'data-tip': (__VLS_ctx.getTransactionTypeLabel(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
        });
        const __VLS_42 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
            icon: (__VLS_ctx.getTransactionTypeIcon(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
            ...{ class: (__VLS_ctx.getTransactionTypeClass(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)) },
            ...{ class: "text-2xl" },
        }));
        const __VLS_44 = __VLS_43({
            icon: (__VLS_ctx.getTransactionTypeIcon(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
            ...{ class: (__VLS_ctx.getTransactionTypeClass(e.transaction.transactionType || __VLS_ctx.TransactionType.EXPENSE)) },
            ...{ class: "text-2xl" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_43));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (e.transaction.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.recipientStore.getRecipientById(e.transaction.recipientId || "")?.name || "-");
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.getSourceName(e.transaction));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        (__VLS_ctx.getTargetName(e.transaction));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (e.transaction.amount),
            showZero: (true),
        }));
        const __VLS_47 = __VLS_46({
            amount: (e.transaction.amount),
            showZero: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "text-right" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-end space-x-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-success" },
            'data-tip': "Planungstransaktion ausführen und echte Transaktion erstellen",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'upcoming'))
                        return;
                    __VLS_ctx.executePlanning(e.transaction.id, e.date);
                } },
            ...{ class: "btn btn-ghost btn-xs border-none" },
        });
        const __VLS_49 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_50 = __VLS_asFunctionalComponent(__VLS_49, new __VLS_49({
            icon: "mdi:play",
            ...{ class: "text-base text-success" },
        }));
        const __VLS_51 = __VLS_50({
            icon: "mdi:play",
            ...{ class: "text-base text-success" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_50));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-warning" },
            'data-tip': "Planungstransaktion überspringen (als erledigt markieren ohne Transaktion zu erstellen)",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'upcoming'))
                        return;
                    __VLS_ctx.skipPlanning(e.transaction.id, e.date);
                } },
            ...{ class: "btn btn-ghost btn-xs border-none" },
        });
        const __VLS_53 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_54 = __VLS_asFunctionalComponent(__VLS_53, new __VLS_53({
            icon: "mdi:skip-next",
            ...{ class: "text-base text-warning" },
        }));
        const __VLS_55 = __VLS_54({
            icon: "mdi:skip-next",
            ...{ class: "text-base text-warning" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_54));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-info" },
            'data-tip': "Planungstransaktion bearbeiten",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'upcoming'))
                        return;
                    __VLS_ctx.editPlanning(e.transaction);
                } },
            ...{ class: "btn btn-ghost btn-xs border-none" },
        });
        const __VLS_57 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({
            icon: "mdi:pencil",
            ...{ class: "text-base" },
        }));
        const __VLS_59 = __VLS_58({
            icon: "mdi:pencil",
            ...{ class: "text-base" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_58));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tooltip tooltip-error" },
            'data-tip': "Planungstransaktion löschen",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'upcoming'))
                        return;
                    __VLS_ctx.deletePlanning(e.transaction);
                } },
            ...{ class: "btn btn-ghost btn-xs border-none text-error/75" },
        });
        const __VLS_61 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_62 = __VLS_asFunctionalComponent(__VLS_61, new __VLS_61({
            icon: "mdi:trash-can",
            ...{ class: "text-base" },
        }));
        const __VLS_63 = __VLS_62({
            icon: "mdi:trash-can",
            ...{ class: "text-base" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_62));
    }
    if (__VLS_ctx.filteredTransactions.length === 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            colspan: "8",
            ...{ class: "text-center py-4" },
        });
    }
}
if (__VLS_ctx.activeTab === 'accounts') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap justify-between items-end gap-4 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_65 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent(__VLS_65, new __VLS_65({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_67 = __VLS_66({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_72;
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = {
        'onUpdate:modelValue': (__VLS_ctx.handleDateRangeUpdate)
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_76 = {};
    var __VLS_71;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'accounts'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_78 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_80 = __VLS_79({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedAccountId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedAccountId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.accountStore.activeAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (acc.id),
            value: (acc.id),
        });
        (acc.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedCategoryId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedCategoryId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.categoryStore.activeCategories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (cat.id),
            value: (cat.id),
        });
        (cat.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end" },
    });
    const __VLS_82 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_84 = __VLS_83({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-xl font-bold mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-4 mb-4" },
    });
    for (const [account] of __VLS_getVForSourceType((__VLS_ctx.accountStore.activeAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'accounts'))
                        return;
                    __VLS_ctx.selectedAccountForDetail === account.id
                        ? __VLS_ctx.hideAccountDetail()
                        : __VLS_ctx.showAccountDetail(account.id);
                } },
            key: (account.id),
            ...{ class: "badge badge-lg cursor-pointer" },
            ...{ class: (__VLS_ctx.selectedAccountForDetail === account.id
                    ? 'badge-accent'
                    : 'badge-outline') },
        });
        (account.name);
    }
    if (__VLS_ctx.selectedAccountForDetail) {
        /** @type {[typeof DetailedForecastChart, ]} */ ;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent(DetailedForecastChart, new DetailedForecastChart({
            selectedId: (__VLS_ctx.selectedAccountForDetail),
            startDate: (__VLS_ctx.dateRange.start),
            type: "accounts",
        }));
        const __VLS_87 = __VLS_86({
            selectedId: (__VLS_ctx.selectedAccountForDetail),
            startDate: (__VLS_ctx.dateRange.start),
            type: "accounts",
        }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    }
    else {
        /** @type {[typeof ForecastChart, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(ForecastChart, new ForecastChart({
            startDate: (__VLS_ctx.dateRange.start),
            filteredAccountId: (__VLS_ctx.selectedAccountId),
            selectedAccountForDetail: (__VLS_ctx.selectedAccountForDetail),
            type: "accounts",
        }));
        const __VLS_90 = __VLS_89({
            startDate: (__VLS_ctx.dateRange.start),
            filteredAccountId: (__VLS_ctx.selectedAccountId),
            selectedAccountForDetail: (__VLS_ctx.selectedAccountForDetail),
            type: "accounts",
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    }
    if (__VLS_ctx.selectedAccountForDetail) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
            ...{ class: "divider px-5 m-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "text-lg font-semibold mb-4" },
        });
        (__VLS_ctx.accountStore.getAccountById(__VLS_ctx.selectedAccountForDetail)?.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
        });
        for (const [forecast, i] of __VLS_getVForSourceType((__VLS_ctx.getAccountForecastData(__VLS_ctx.selectedAccountForDetail)))) {
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
            const __VLS_92 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.balance),
                asInteger: (true),
            }));
            const __VLS_93 = __VLS_92({
                amount: (forecast.balance),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_92));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex justify-between" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_95 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.monthlyChangePlanned),
                asInteger: (true),
                showZero: (true),
            }));
            const __VLS_96 = __VLS_95({
                amount: (forecast.monthlyChangePlanned),
                asInteger: (true),
                showZero: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_95));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex justify-between" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_98 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.monthlyChangeTotal),
                asInteger: (true),
                showZero: (true),
            }));
            const __VLS_99 = __VLS_98({
                amount: (forecast.monthlyChangeTotal),
                asInteger: (true),
                showZero: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_98));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex justify-between font-bold border-t border-base-300 pt-1" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_101 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.projectedBalance),
                asInteger: (true),
            }));
            const __VLS_102 = __VLS_101({
                amount: (forecast.projectedBalance),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_101));
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
                    const __VLS_104 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                        amount: (tx.amount),
                        showZero: (true),
                    }));
                    const __VLS_105 = __VLS_104({
                        amount: (tx.amount),
                        showZero: (true),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_104));
                }
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-xs text-base-content/70 border-t border-base-300 pt-2" },
                });
            }
        }
    }
}
if (__VLS_ctx.activeTab === 'categories') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card bg-base-100 shadow-md border border-base-300 p-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap justify-between items-end gap-4 mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap items-end gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center gap-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'categories'))
                    return;
                __VLS_ctx.navigateMonth('prev');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Vorheriger Monat",
    });
    const __VLS_107 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }));
    const __VLS_109 = __VLS_108({
        icon: "mdi:chevron-left",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_108));
    /** @type {[typeof DateRangePicker, ]} */ ;
    // @ts-ignore
    const __VLS_111 = __VLS_asFunctionalComponent(DateRangePicker, new DateRangePicker({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }));
    const __VLS_112 = __VLS_111({
        ...{ 'onUpdate:modelValue': {} },
        ref: "dateRangePickerRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_111));
    let __VLS_114;
    let __VLS_115;
    let __VLS_116;
    const __VLS_117 = {
        'onUpdate:modelValue': (__VLS_ctx.handleDateRangeUpdate)
    };
    /** @type {typeof __VLS_ctx.dateRangePickerRef} */ ;
    var __VLS_118 = {};
    var __VLS_113;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'categories'))
                    return;
                __VLS_ctx.navigateMonth('next');
            } },
        ...{ class: "btn btn-ghost btn-sm btn-circle" },
        title: "Nächster Monat",
    });
    const __VLS_120 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_122 = __VLS_121({
        icon: "mdi:chevron-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_121));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedAccountId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedAccountId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [acc] of __VLS_getVForSourceType((__VLS_ctx.accountStore.activeAccounts))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (acc.id),
            value: (acc.id),
        });
        (acc.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-control" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        ...{ class: "label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "label-text opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.selectedCategoryId),
        ...{ class: "select select-sm select-bordered rounded-full" },
        ...{ class: (__VLS_ctx.selectedCategoryId
                ? 'border-2 border-accent'
                : 'border border-base-300') },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: "",
    });
    for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.categoryStore.activeCategories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (cat.id),
            value: (cat.id),
        });
        (cat.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-end gap-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.clearFilters) },
        ...{ class: "btn btn-sm btn-ghost btn-circle self-end" },
    });
    const __VLS_124 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }));
    const __VLS_126 = __VLS_125({
        icon: "mdi:filter-off",
        ...{ class: "text-xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
        ...{ class: "divider px-5 m-0" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-xl font-bold mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-wrap gap-4 mb-4" },
    });
    for (const [category] of __VLS_getVForSourceType((__VLS_ctx.categoryStore.activeCategories))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.activeTab === 'categories'))
                        return;
                    __VLS_ctx.selectedCategoryForDetail === category.id
                        ? __VLS_ctx.hideCategoryDetail()
                        : __VLS_ctx.showCategoryDetail(category.id);
                } },
            key: (category.id),
            ...{ class: "badge badge-lg cursor-pointer transition-all duration-200" },
            ...{ class: (__VLS_ctx.selectedCategoryForDetail === category.id
                    ? 'badge-accent text-accent-content'
                    : 'badge-outline hover:badge-secondary') },
        });
        if (category.icon) {
            const __VLS_128 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
                icon: (category.icon),
                ...{ class: "mr-1 text-sm" },
            }));
            const __VLS_130 = __VLS_129({
                icon: (category.icon),
                ...{ class: "mr-1 text-sm" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_129));
        }
        (category.name);
    }
    if (__VLS_ctx.selectedCategoryForDetail) {
        /** @type {[typeof DetailedForecastChart, ]} */ ;
        // @ts-ignore
        const __VLS_132 = __VLS_asFunctionalComponent(DetailedForecastChart, new DetailedForecastChart({
            selectedId: (__VLS_ctx.selectedCategoryForDetail),
            startDate: (__VLS_ctx.dateRange.start),
            type: "categories",
        }));
        const __VLS_133 = __VLS_132({
            selectedId: (__VLS_ctx.selectedCategoryForDetail),
            startDate: (__VLS_ctx.dateRange.start),
            type: "categories",
        }, ...__VLS_functionalComponentArgsRest(__VLS_132));
    }
    else {
        /** @type {[typeof ForecastChart, ]} */ ;
        // @ts-ignore
        const __VLS_135 = __VLS_asFunctionalComponent(ForecastChart, new ForecastChart({
            ...{ 'onShowCategoryDetail': {} },
            ...{ 'onHideCategoryDetail': {} },
            startDate: (__VLS_ctx.dateRange.start),
            selectedCategoryForDetail: (__VLS_ctx.selectedCategoryForDetail),
            type: "categories",
        }));
        const __VLS_136 = __VLS_135({
            ...{ 'onShowCategoryDetail': {} },
            ...{ 'onHideCategoryDetail': {} },
            startDate: (__VLS_ctx.dateRange.start),
            selectedCategoryForDetail: (__VLS_ctx.selectedCategoryForDetail),
            type: "categories",
        }, ...__VLS_functionalComponentArgsRest(__VLS_135));
        let __VLS_138;
        let __VLS_139;
        let __VLS_140;
        const __VLS_141 = {
            onShowCategoryDetail: (__VLS_ctx.showCategoryDetail)
        };
        const __VLS_142 = {
            onHideCategoryDetail: (__VLS_ctx.hideCategoryDetail)
        };
        var __VLS_137;
    }
    if (__VLS_ctx.selectedCategoryForDetail) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
            ...{ class: "divider px-5 m-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "text-lg font-semibold mb-4" },
        });
        (__VLS_ctx.categoryStore.getCategoryById(__VLS_ctx.selectedCategoryForDetail)?.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" },
        });
        for (const [forecast, i] of __VLS_getVForSourceType((__VLS_ctx.categoryForecastData(__VLS_ctx.selectedCategoryForDetail).slice(0, 6)))) {
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
            const __VLS_143 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.budgeted),
                asInteger: (true),
            }));
            const __VLS_144 = __VLS_143({
                amount: (forecast.budgeted),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_143));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex justify-between" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_146 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.activity),
                asInteger: (true),
            }));
            const __VLS_147 = __VLS_146({
                amount: (forecast.activity),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_146));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex justify-between" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_149 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.transactions.reduce((sum, tx) => sum + tx.amount, 0)),
                asInteger: (true),
            }));
            const __VLS_150 = __VLS_149({
                amount: (forecast.transactions.reduce((sum, tx) => sum + tx.amount, 0)),
                asInteger: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_149));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex justify-between font-bold border-t border-base-300 pt-1" },
                ...{ class: (forecast.isOverspent ? 'text-error' : '') },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (forecast.isOverspent
                ? "Budget überschritten:"
                : "Verfügbar:");
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_152 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (forecast.available),
                asInteger: (true),
                ...{ class: (forecast.isOverspent ? 'text-error' : '') },
            }));
            const __VLS_153 = __VLS_152({
                amount: (forecast.available),
                asInteger: (true),
                ...{ class: (forecast.isOverspent ? 'text-error' : '') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_152));
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
                    const __VLS_155 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                        amount: (tx.amount),
                        showZero: (true),
                    }));
                    const __VLS_156 = __VLS_155({
                        amount: (tx.amount),
                        showZero: (true),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_155));
                }
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-xs text-base-content/70 border-t border-base-300 pt-2" },
                });
            }
        }
    }
}
if (__VLS_ctx.showNewPlanningModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-3xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof PlanningTransactionForm, ]} */ ;
    // @ts-ignore
    const __VLS_158 = __VLS_asFunctionalComponent(PlanningTransactionForm, new PlanningTransactionForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }));
    const __VLS_159 = __VLS_158({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_158));
    let __VLS_161;
    let __VLS_162;
    let __VLS_163;
    const __VLS_164 = {
        onSave: (__VLS_ctx.savePlanning)
    };
    const __VLS_165 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showNewPlanningModal))
                return;
            __VLS_ctx.showNewPlanningModal = false;
        }
    };
    var __VLS_160;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showNewPlanningModal))
                    return;
                __VLS_ctx.showNewPlanningModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-3xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    /** @type {[typeof PlanningTransactionForm, ]} */ ;
    // @ts-ignore
    const __VLS_166 = __VLS_asFunctionalComponent(PlanningTransactionForm, new PlanningTransactionForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        transaction: (__VLS_ctx.selectedPlanning),
        isEdit: (true),
    }));
    const __VLS_167 = __VLS_166({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        transaction: (__VLS_ctx.selectedPlanning),
        isEdit: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_166));
    let __VLS_169;
    let __VLS_170;
    let __VLS_171;
    const __VLS_172 = {
        onSave: (__VLS_ctx.savePlanning)
    };
    const __VLS_173 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning))
                return;
            __VLS_ctx.showEditPlanningModal = false;
        }
    };
    var __VLS_168;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning))
                    return;
                __VLS_ctx.showEditPlanningModal = false;
            } },
        ...{ class: "modal-backdrop bg-black/30" },
    });
}
if (__VLS_ctx.showExecuteConfirmation && __VLS_ctx.pendingExecutionAnalysis) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_174 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Fällige Planungsbuchungen ausführen",
        message: (__VLS_ctx.getConfirmationMessage()),
        useHtml: (true),
        confirmText: "Ausführen",
        cancelText: "Abbrechen",
    }));
    const __VLS_175 = __VLS_174({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Fällige Planungsbuchungen ausführen",
        message: (__VLS_ctx.getConfirmationMessage()),
        useHtml: (true),
        confirmText: "Ausführen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_174));
    let __VLS_177;
    let __VLS_178;
    let __VLS_179;
    const __VLS_180 = {
        onConfirm: (__VLS_ctx.confirmExecution)
    };
    const __VLS_181 = {
        onCancel: (__VLS_ctx.cancelExecution)
    };
    var __VLS_176;
}
if (__VLS_ctx.showToast) {
    /** @type {[typeof InfoToast, ]} */ ;
    // @ts-ignore
    const __VLS_182 = __VLS_asFunctionalComponent(InfoToast, new InfoToast({
        ...{ 'onClose': {} },
        message: (__VLS_ctx.toastMessage),
        type: (__VLS_ctx.toastType),
    }));
    const __VLS_183 = __VLS_182({
        ...{ 'onClose': {} },
        message: (__VLS_ctx.toastMessage),
        type: (__VLS_ctx.toastType),
    }, ...__VLS_functionalComponentArgsRest(__VLS_182));
    let __VLS_185;
    let __VLS_186;
    let __VLS_187;
    const __VLS_188 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showToast))
                return;
            __VLS_ctx.showToast = false;
        }
    };
    var __VLS_184;
}
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab-active']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-success']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-info']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip-error']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error/75']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['form-control']} */ ;
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['px-5']} */ ;
/** @type {__VLS_StyleScopedClasses['m-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
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
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
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
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
// @ts-ignore
var __VLS_33 = __VLS_32, __VLS_77 = __VLS_76, __VLS_119 = __VLS_118;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            PlanningTransactionForm: PlanningTransactionForm,
            ForecastChart: ForecastChart,
            DetailedForecastChart: DetailedForecastChart,
            TransactionType: TransactionType,
            CurrencyDisplay: CurrencyDisplay,
            SearchGroup: SearchGroup,
            DateRangePicker: DateRangePicker,
            ConfirmationModal: ConfirmationModal,
            InfoToast: InfoToast,
            formatDate: formatDate,
            accountStore: accountStore,
            categoryStore: categoryStore,
            recipientStore: recipientStore,
            showNewPlanningModal: showNewPlanningModal,
            showEditPlanningModal: showEditPlanningModal,
            showExecuteConfirmation: showExecuteConfirmation,
            selectedPlanning: selectedPlanning,
            searchQuery: searchQuery,
            selectedAccountId: selectedAccountId,
            selectedCategoryId: selectedCategoryId,
            activeTab: activeTab,
            pendingExecutionAnalysis: pendingExecutionAnalysis,
            toastMessage: toastMessage,
            toastType: toastType,
            showToast: showToast,
            selectedAccountForDetail: selectedAccountForDetail,
            selectedCategoryForDetail: selectedCategoryForDetail,
            dateRangePickerRef: dateRangePickerRef,
            dateRange: dateRange,
            handleDateRangeUpdate: handleDateRangeUpdate,
            navigateMonth: navigateMonth,
            filteredTransactions: filteredTransactions,
            createPlanning: createPlanning,
            editPlanning: editPlanning,
            savePlanning: savePlanning,
            deletePlanning: deletePlanning,
            executePlanning: executePlanning,
            skipPlanning: skipPlanning,
            getTransactionTypeIcon: getTransactionTypeIcon,
            getTransactionTypeClass: getTransactionTypeClass,
            getTransactionTypeLabel: getTransactionTypeLabel,
            getSourceName: getSourceName,
            getTargetName: getTargetName,
            clearFilters: clearFilters,
            showAccountDetail: showAccountDetail,
            showCategoryDetail: showCategoryDetail,
            hideAccountDetail: hideAccountDetail,
            hideCategoryDetail: hideCategoryDetail,
            getAccountForecastData: getAccountForecastData,
            categoryForecastData: categoryForecastData,
            executeAllDuePlannings: executeAllDuePlannings,
            confirmExecution: confirmExecution,
            cancelExecution: cancelExecution,
            getConfirmationMessage: getConfirmationMessage,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
