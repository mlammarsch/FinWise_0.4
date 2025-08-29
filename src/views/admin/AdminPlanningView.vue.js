import { ref, computed, onMounted, onUnmounted } from "vue";
import dayjs from "dayjs";
import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { RecurrencePattern, TransactionType, } from "../../types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import InfoToast from "@/components/ui/InfoToast.vue";
import { infoLog, errorLog } from "@/utils/logger";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import { formatDate } from "@/utils/formatters";
import { PlanningService } from "@/services/PlanningService";
import { Icon } from "@iconify/vue";
const planningStore = usePlanningStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();
const showNewPlanningModal = ref(false);
const showEditPlanningModal = ref(false);
const showExecuteConfirmation = ref(false);
const selectedPlanning = ref(null);
const searchQuery = ref("");
const selectedAccountId = ref("all");
const selectedCategoryId = ref("all");
const currentPage = ref(1);
const itemsPerPage = ref(25);
// Für die Ausführungsbestätigung
const pendingExecutionAnalysis = ref(null);
// Toast-System
const toastMessage = ref("");
const toastType = ref("info");
const showToast = ref(false);
const filteredPlannings = computed(() => {
    let plannings = planningStore.planningTransactions;
    // Filter nach Konto anwenden
    if (selectedAccountId.value !== "all") {
        plannings = plannings.filter((p) => {
            // Hauptbuchung mit dem gewählten Konto
            if (p.accountId === selectedAccountId.value) {
                return true;
            }
            // Bei Kontotransfers: Zielkonto prüfen
            if (p.transactionType === TransactionType.ACCOUNTTRANSFER &&
                p.transferToAccountId === selectedAccountId.value) {
                return true;
            }
            // Gegenbuchung anzeigen, wenn die Hauptbuchung das gewählte Konto betrifft
            if (p.counterPlanningTransactionId &&
                p.name &&
                p.name.includes("(Gegenbuchung)")) {
                const mainPlanning = planningStore.planningTransactions.find((main) => main.id === p.counterPlanningTransactionId);
                if (mainPlanning &&
                    (mainPlanning.accountId === selectedAccountId.value ||
                        mainPlanning.transferToAccountId === selectedAccountId.value)) {
                    return true;
                }
            }
            return false;
        });
    }
    // Filter nach Kategorie anwenden
    if (selectedCategoryId.value !== "all") {
        plannings = plannings.filter((p) => {
            // Hauptbuchung mit der gewählten Kategorie
            if (p.categoryId === selectedCategoryId.value) {
                return true;
            }
            // Bei Kategorietransfers: Zielkategorie prüfen
            if (p.transactionType === TransactionType.CATEGORYTRANSFER &&
                p.transferToCategoryId === selectedCategoryId.value) {
                return true;
            }
            // Gegenbuchung anzeigen, wenn die Hauptbuchung die gewählte Kategorie betrifft
            if (p.counterPlanningTransactionId &&
                p.name &&
                p.name.includes("(Gegenbuchung)")) {
                const mainPlanning = planningStore.planningTransactions.find((main) => main.id === p.counterPlanningTransactionId);
                if (mainPlanning &&
                    (mainPlanning.categoryId === selectedCategoryId.value ||
                        mainPlanning.transferToCategoryId === selectedCategoryId.value)) {
                    return true;
                }
            }
            return false;
        });
    }
    // Gegenbuchungen herausfiltern (außer wenn durch Filter explizit gewünscht)
    const planningsWithoutCounterBookings = plannings.filter((p) => {
        // Wenn ein Filter aktiv ist, wurden die relevanten Gegenbuchungen bereits oben eingeschlossen
        if (selectedAccountId.value !== "all" ||
            selectedCategoryId.value !== "all") {
            return true; // Alle bereits gefilterten Planungen beibehalten
        }
        // Ohne aktive Filter: Gegenbuchungen ausblenden
        if (p.name && p.name.includes("(Gegenbuchung)")) {
            return false;
        }
        // Zusätzliche Prüfung: Bei Transfers mit counterPlanningTransactionId
        // ist die Gegenbuchung diejenige mit positivem Betrag
        if (p.counterPlanningTransactionId &&
            (p.transactionType === TransactionType.ACCOUNTTRANSFER ||
                p.transactionType === TransactionType.CATEGORYTRANSFER)) {
            const counterPlanning = planningStore.planningTransactions.find((counter) => counter.id === p.counterPlanningTransactionId);
            if (counterPlanning && p.amount > 0 && counterPlanning.amount < 0) {
                return false; // Gegenbuchung ausblenden
            }
        }
        return true;
    });
    // Nach Fälligkeitsdatum aufsteigend sortieren (älteste zuerst)
    const sortedPlannings = planningsWithoutCounterBookings.sort((a, b) => {
        return dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf();
    });
    // Suchfilter anwenden
    const term = searchQuery.value.trim().toLowerCase();
    if (!term)
        return sortedPlannings;
    return sortedPlannings.filter((p) => {
        const payee = recipientStore.getRecipientById(p.recipientId || "")?.name || "";
        const acc = accountStore.getAccountById(p.accountId)?.name || "";
        const cat = categoryStore.getCategoryById(p.categoryId || "")?.name || "";
        return (p.name.toLowerCase().includes(term) ||
            payee.toLowerCase().includes(term) ||
            acc.toLowerCase().includes(term) ||
            cat.toLowerCase().includes(term) ||
            String(p.amount).includes(term));
    });
});
const totalPages = computed(() => itemsPerPage.value === "all"
    ? 1
    : Math.ceil(filteredPlannings.value.length / Number(itemsPerPage.value)));
const paginatedPlannings = computed(() => {
    if (itemsPerPage.value === "all")
        return filteredPlannings.value;
    const start = (currentPage.value - 1) * Number(itemsPerPage.value);
    return filteredPlannings.value.slice(start, start + Number(itemsPerPage.value));
});
function createPlanning() {
    selectedPlanning.value = null;
    showNewPlanningModal.value = true;
}
function editPlanning(planning) {
    selectedPlanning.value = planning;
    showEditPlanningModal.value = true;
}
async function savePlanning(data) {
    if (selectedPlanning.value) {
        // Hauptbuchung aktualisieren
        await PlanningService.updatePlanningTransaction(selectedPlanning.value.id, data);
        // Bei Transfers auch die Gegenbuchung aktualisieren
        if (selectedPlanning.value.counterPlanningTransactionId &&
            (selectedPlanning.value.transactionType ===
                TransactionType.ACCOUNTTRANSFER ||
                selectedPlanning.value.transactionType ===
                    TransactionType.CATEGORYTRANSFER)) {
            const counterPlanning = planningStore.getPlanningTransactionById(selectedPlanning.value.counterPlanningTransactionId);
            if (counterPlanning) {
                // Gegenbuchung mit entsprechenden Daten aktualisieren
                const counterData = {
                    name: data.name
                        ? `${data.name} (Gegenbuchung)`
                        : counterPlanning.name,
                    note: data.note !== undefined ? data.note : counterPlanning.note,
                    startDate: data.startDate !== undefined
                        ? data.startDate
                        : counterPlanning.startDate,
                    valueDate: data.valueDate !== undefined
                        ? data.valueDate
                        : counterPlanning.valueDate,
                    endDate: data.endDate !== undefined ? data.endDate : counterPlanning.endDate,
                    recurrencePattern: data.recurrencePattern !== undefined
                        ? data.recurrencePattern
                        : counterPlanning.recurrencePattern,
                    recurrenceEndType: data.recurrenceEndType !== undefined
                        ? data.recurrenceEndType
                        : counterPlanning.recurrenceEndType,
                    recurrenceCount: data.recurrenceCount !== undefined
                        ? data.recurrenceCount
                        : counterPlanning.recurrenceCount,
                    executionDay: data.executionDay !== undefined
                        ? data.executionDay
                        : counterPlanning.executionDay,
                    weekendHandling: data.weekendHandling !== undefined
                        ? data.weekendHandling
                        : counterPlanning.weekendHandling,
                    isActive: data.isActive !== undefined
                        ? data.isActive
                        : counterPlanning.isActive,
                    forecastOnly: data.forecastOnly !== undefined
                        ? data.forecastOnly
                        : counterPlanning.forecastOnly,
                    amountType: data.amountType !== undefined
                        ? data.amountType
                        : counterPlanning.amountType,
                    approximateAmount: data.approximateAmount !== undefined
                        ? data.approximateAmount
                        : counterPlanning.approximateAmount,
                    minAmount: data.minAmount !== undefined
                        ? data.minAmount
                        : counterPlanning.minAmount,
                    maxAmount: data.maxAmount !== undefined
                        ? data.maxAmount
                        : counterPlanning.maxAmount,
                    tagIds: data.tagIds !== undefined ? data.tagIds : counterPlanning.tagIds,
                    autoExecute: data.autoExecute !== undefined
                        ? data.autoExecute
                        : counterPlanning.autoExecute,
                };
                // Betrag für Gegenbuchung umkehren, falls geändert
                if (data.amount !== undefined) {
                    counterData.amount = -data.amount;
                }
                await PlanningService.updatePlanningTransaction(selectedPlanning.value.counterPlanningTransactionId, counterData);
            }
        }
    }
    else {
        await PlanningService.addPlanningTransaction(data);
    }
    showNewPlanningModal.value = false;
    showEditPlanningModal.value = false;
}
function deletePlanning(planning) {
    if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
        PlanningService.deletePlanningTransaction(planning.id);
    }
}
/**
 * Schaltet den aktiven Status einer Planungstransaktion um
 */
async function togglePlanningStatus(planning) {
    try {
        const newStatus = !planning.isActive;
        const success = await PlanningService.updatePlanningTransaction(planning.id, {
            isActive: newStatus,
        });
        if (success) {
            infoLog("AdminPlanningView", `Planungstransaktion "${planning.name}" Status geändert zu: ${newStatus ? "Aktiv" : "Inaktiv"}`, { planningId: planning.id, newStatus });
        }
        else {
            errorLog("AdminPlanningView", `Fehler beim Ändern des Status von Planungstransaktion "${planning.name}"`, { planningId: planning.id, targetStatus: newStatus });
        }
    }
    catch (error) {
        errorLog("AdminPlanningView", `Fehler beim Umschalten des Planungstransaktion-Status für "${planning.name}"`, { planningId: planning.id, error });
    }
}
// Button: Alle fälligen
async function executeAllDuePlannings() {
    // Erst analysieren, was ausgeführt werden würde
    const analysis = await analyzeDuePlannings();
    if (analysis.totalCount === 0) {
        alert("Keine fälligen Planungsbuchungen gefunden.");
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
// Toast-Funktion
function showToastMessage(message, type = "info") {
    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;
}
// Bestätigung der Ausführung
async function confirmExecution() {
    if (!pendingExecutionAnalysis.value)
        return;
    try {
        const count = await PlanningService.executeAllDuePlanningTransactions();
        showExecuteConfirmation.value = false;
        pendingExecutionAnalysis.value = null;
        infoLog("AdminPlanningView", `${count} automatische Planungsbuchungen erfolgreich ausgeführt`);
        showToastMessage(`${count} automatische Planungsbuchungen erfolgreich ausgeführt.`, "success");
    }
    catch (error) {
        errorLog("AdminPlanningView", "Fehler beim Ausführen der Planungsbuchungen", error);
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
// Button: Play pro Planung - nur fällige ausführen!
async function executeDueForPlanning(planning) {
    const today = dayjs().format("YYYY-MM-DD");
    const due = PlanningService.calculateNextOccurrences(planning, planning.startDate, today);
    let executed = 0;
    for (const d of due) {
        const ok = await PlanningService.executePlanningTransaction(planning.id, d);
        if (ok)
            executed++;
    }
    alert(`${executed} Buchungen für "${planning.name}" ausgeführt.`);
}
function formatRecurrencePattern(pattern) {
    return {
        [RecurrencePattern.ONCE]: "Einmalig",
        [RecurrencePattern.DAILY]: "Täglich",
        [RecurrencePattern.WEEKLY]: "Wöchentlich",
        [RecurrencePattern.BIWEEKLY]: "Alle 2 Wochen",
        [RecurrencePattern.MONTHLY]: "Monatlich",
        [RecurrencePattern.QUARTERLY]: "Vierteljährlich",
        [RecurrencePattern.YEARLY]: "Jährlich",
    }[pattern];
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
/**
 * Fälligkeitslogik:
 * - "Überfällig": Startdatum liegt mehr als 2 Tage vor heute und wurde noch nicht ausgeführt (Startdatum wurde noch nicht weitergeschoben).
 * - "Fällig": Startdatum ist heute oder in der Vergangenheit (max. 2 Tage alt).
 * - "geplant für": Startdatum liegt in der Zukunft.
 */
function isOverdueByDays(planning, days = 2) {
    const today = dayjs().startOf("day");
    const start = dayjs(planning.startDate).startOf("day");
    return start.isBefore(today.subtract(days, "day"), "day");
}
function isDue(planning) {
    const today = dayjs().startOf("day");
    const start = dayjs(planning.startDate).startOf("day");
    return start.isSameOrBefore(today, "day");
}
function getStartDateLabel(planning) {
    if (isOverdueByDays(planning, 2))
        return "Überfällig";
    return isDue(planning) ? "Fällig" : "geplant für";
}
function getStartDateClass(planning) {
    if (isOverdueByDays(planning, 2))
        return "text-error";
    return isDue(planning) ? "text-warning" : "text-base-content/70";
}
// Hilfsfunktion für Wiederholungstyp-Icon
function getRecurrenceIcon(planning) {
    if (planning.recurrencePattern === RecurrencePattern.ONCE) {
        return "mdi:repeat-once";
    }
    return "mdi:repeat-variant";
}
// Hilfsfunktion für Wiederholungstyp-Tooltip
function getRecurrenceTooltip(planning) {
    if (planning.recurrencePattern === RecurrencePattern.ONCE) {
        return "Einzelbuchung";
    }
    return `Wiederholende Buchung: ${formatRecurrencePattern(planning.recurrencePattern)}`;
}
// Hotkey-Handler für STRG-N
function handleKeydown(event) {
    if (event.altKey && event.key === "n") {
        event.preventDefault();
        createPlanning();
    }
}
// Event-Handler für ButtonGroup
function handleSearchInput(query) {
    searchQuery.value = query;
}
function handleExecuteAllDue() {
    executeAllDuePlannings();
}
function handleCreatePlanning() {
    createPlanning();
}
// Lifecycle-Hooks für Hotkey-Listener
onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
});
onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddle: "Alle fälligen ausführen",
    btnMiddleIcon: "mdi:play-circle",
    btnRight: "Neue Planung",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddle: "Alle fälligen ausführen",
    btnMiddleIcon: "mdi:play-circle",
    btnRight: "Neue Planung",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: (__VLS_ctx.handleSearchInput)
};
const __VLS_7 = {
    onBtnMiddleClick: (__VLS_ctx.handleExecuteAllDue)
};
const __VLS_8 = {
    onBtnRightClick: (__VLS_ctx.handleCreatePlanning)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 w-full mt-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
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
    ...{ class: "text-center" },
});
const __VLS_9 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    icon: "mdi:calendar-repeat-outline",
    ...{ class: "text-lg" },
}));
const __VLS_11 = __VLS_10({
    icon: "mdi:calendar-repeat-outline",
    ...{ class: "text-lg" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [planning] of __VLS_getVForSourceType((__VLS_ctx.paginatedPlannings))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (planning.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (planning.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip" },
        'data-tip': (__VLS_ctx.getTransactionTypeLabel(planning.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
    });
    const __VLS_13 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
        icon: (__VLS_ctx.getTransactionTypeIcon(planning.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
        ...{ class: (__VLS_ctx.getTransactionTypeClass(planning.transactionType || __VLS_ctx.TransactionType.EXPENSE)) },
        ...{ class: "text-2xl" },
    }));
    const __VLS_15 = __VLS_14({
        icon: (__VLS_ctx.getTransactionTypeIcon(planning.transactionType || __VLS_ctx.TransactionType.EXPENSE)),
        ...{ class: (__VLS_ctx.getTransactionTypeClass(planning.transactionType || __VLS_ctx.TransactionType.EXPENSE)) },
        ...{ class: "text-2xl" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.recipientStore.getRecipientById(planning.recipientId || "")
        ?.name || "-");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.getSourceName(planning));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.getTargetName(planning));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.formatRecurrencePattern(planning.recurrencePattern));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "tooltip" },
        'data-tip': (__VLS_ctx.getRecurrenceTooltip(planning)),
    });
    const __VLS_17 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
        icon: (__VLS_ctx.getRecurrenceIcon(planning)),
        ...{ class: "text-xl text-base-content/70" },
    }));
    const __VLS_19 = __VLS_18({
        icon: (__VLS_ctx.getRecurrenceIcon(planning)),
        ...{ class: "text-xl text-base-content/70" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-xs font-medium" },
        ...{ class: (__VLS_ctx.getStartDateClass(planning)) },
    });
    (__VLS_ctx.getStartDateLabel(planning));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-sm" },
    });
    (__VLS_ctx.formatDate(planning.startDate));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        amount: (planning.amount),
        showZero: (true),
    }));
    const __VLS_22 = __VLS_21({
        amount: (planning.amount),
        showZero: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.togglePlanningStatus(planning);
            } },
        ...{ class: "badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity" },
        ...{ class: (planning.isActive ? 'badge-success' : 'badge-error') },
        title: (`Klicken um Status zu ${planning.isActive ? 'Inaktiv' : 'Aktiv'} zu ändern`),
    });
    (planning.isActive ? "Aktiv" : "Inaktiv");
    if (planning.autoExecute) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "badge badge-info" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editPlanning(planning);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none" },
    });
    const __VLS_24 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_26 = __VLS_25({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deletePlanning(planning);
            } },
        ...{ class: "btn btn-ghost btn-xs border-none text-error/75" },
    });
    const __VLS_28 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_30 = __VLS_29({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
if (__VLS_ctx.paginatedPlannings.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "11",
        ...{ class: "text-center py-4" },
    });
}
/** @type {[typeof PagingComponent, ]} */ ;
// @ts-ignore
const __VLS_32 = __VLS_asFunctionalComponent(PagingComponent, new PagingComponent({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}));
const __VLS_33 = __VLS_32({
    ...{ 'onUpdate:currentPage': {} },
    ...{ 'onUpdate:itemsPerPage': {} },
    currentPage: (__VLS_ctx.currentPage),
    totalPages: (__VLS_ctx.totalPages),
    itemsPerPage: (__VLS_ctx.itemsPerPage),
}, ...__VLS_functionalComponentArgsRest(__VLS_32));
let __VLS_35;
let __VLS_36;
let __VLS_37;
const __VLS_38 = {
    'onUpdate:currentPage': ((v) => (__VLS_ctx.currentPage = v))
};
const __VLS_39 = {
    'onUpdate:itemsPerPage': ((v) => (__VLS_ctx.itemsPerPage = v))
};
var __VLS_34;
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
    const __VLS_40 = __VLS_asFunctionalComponent(PlanningTransactionForm, new PlanningTransactionForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }));
    const __VLS_41 = __VLS_40({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_40));
    let __VLS_43;
    let __VLS_44;
    let __VLS_45;
    const __VLS_46 = {
        onSave: (__VLS_ctx.savePlanning)
    };
    const __VLS_47 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showNewPlanningModal))
                return;
            __VLS_ctx.showNewPlanningModal = false;
        }
    };
    var __VLS_42;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
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
    const __VLS_48 = __VLS_asFunctionalComponent(PlanningTransactionForm, new PlanningTransactionForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        transaction: (__VLS_ctx.selectedPlanning),
        isEdit: (true),
    }));
    const __VLS_49 = __VLS_48({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        transaction: (__VLS_ctx.selectedPlanning),
        isEdit: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_48));
    let __VLS_51;
    let __VLS_52;
    let __VLS_53;
    const __VLS_54 = {
        onSave: (__VLS_ctx.savePlanning)
    };
    const __VLS_55 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showEditPlanningModal && __VLS_ctx.selectedPlanning))
                return;
            __VLS_ctx.showEditPlanningModal = false;
        }
    };
    var __VLS_50;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div)({
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
    const __VLS_56 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Fällige Planungsbuchungen ausführen",
        message: (__VLS_ctx.getConfirmationMessage()),
        useHtml: (true),
        confirmText: "Ausführen",
        cancelText: "Abbrechen",
    }));
    const __VLS_57 = __VLS_56({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: "Fällige Planungsbuchungen ausführen",
        message: (__VLS_ctx.getConfirmationMessage()),
        useHtml: (true),
        confirmText: "Ausführen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    let __VLS_59;
    let __VLS_60;
    let __VLS_61;
    const __VLS_62 = {
        onConfirm: (__VLS_ctx.confirmExecution)
    };
    const __VLS_63 = {
        onCancel: (__VLS_ctx.cancelExecution)
    };
    var __VLS_58;
}
if (__VLS_ctx.showToast) {
    /** @type {[typeof InfoToast, ]} */ ;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(InfoToast, new InfoToast({
        ...{ 'onClose': {} },
        message: (__VLS_ctx.toastMessage),
        type: (__VLS_ctx.toastType),
    }));
    const __VLS_65 = __VLS_64({
        ...{ 'onClose': {} },
        message: (__VLS_ctx.toastMessage),
        type: (__VLS_ctx.toastType),
    }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    let __VLS_67;
    let __VLS_68;
    let __VLS_69;
    const __VLS_70 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showToast))
                return;
            __VLS_ctx.showToast = false;
        }
    };
    var __VLS_66;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['tooltip']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error/75']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
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
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            TransactionType: TransactionType,
            CurrencyDisplay: CurrencyDisplay,
            SearchGroup: SearchGroup,
            PlanningTransactionForm: PlanningTransactionForm,
            ConfirmationModal: ConfirmationModal,
            InfoToast: InfoToast,
            PagingComponent: PagingComponent,
            formatDate: formatDate,
            Icon: Icon,
            recipientStore: recipientStore,
            showNewPlanningModal: showNewPlanningModal,
            showEditPlanningModal: showEditPlanningModal,
            showExecuteConfirmation: showExecuteConfirmation,
            selectedPlanning: selectedPlanning,
            currentPage: currentPage,
            itemsPerPage: itemsPerPage,
            pendingExecutionAnalysis: pendingExecutionAnalysis,
            toastMessage: toastMessage,
            toastType: toastType,
            showToast: showToast,
            totalPages: totalPages,
            paginatedPlannings: paginatedPlannings,
            editPlanning: editPlanning,
            savePlanning: savePlanning,
            deletePlanning: deletePlanning,
            togglePlanningStatus: togglePlanningStatus,
            confirmExecution: confirmExecution,
            cancelExecution: cancelExecution,
            getConfirmationMessage: getConfirmationMessage,
            formatRecurrencePattern: formatRecurrencePattern,
            getTransactionTypeIcon: getTransactionTypeIcon,
            getTransactionTypeClass: getTransactionTypeClass,
            getTransactionTypeLabel: getTransactionTypeLabel,
            getSourceName: getSourceName,
            getTargetName: getTargetName,
            getStartDateLabel: getStartDateLabel,
            getStartDateClass: getStartDateClass,
            getRecurrenceIcon: getRecurrenceIcon,
            getRecurrenceTooltip: getRecurrenceTooltip,
            handleSearchInput: handleSearchInput,
            handleExecuteAllDue: handleExecuteAllDue,
            handleCreatePlanning: handleCreatePlanning,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
