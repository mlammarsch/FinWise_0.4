<!-- Datei: src/views/admin/AdminPlanningView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/admin/AdminPlanningView.vue
 * Administrative Verwaltung von Planungstransaktionen.
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import dayjs from "dayjs";
import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import {
  PlanningTransaction,
  RecurrencePattern,
  TransactionType,
} from "../../types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import InfoToast from "@/components/ui/InfoToast.vue";
import { debugLog, infoLog, errorLog } from "@/utils/logger";
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
const selectedPlanning = ref<PlanningTransaction | null>(null);
const searchQuery = ref("");
const selectedAccountId = ref<string>("all");
const selectedCategoryId = ref<string>("all");

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

// Für die Ausführungsbestätigung
const pendingExecutionAnalysis = ref<{
  expenses: number;
  income: number;
  accountTransfers: number;
  categoryTransfers: number;
  totalCount: number;
} | null>(null);

// Toast-System
const toastMessage = ref("");
const toastType = ref<"success" | "error" | "info" | "warning">("info");
const showToast = ref(false);

const filteredPlannings = computed(() => {
  let plannings = planningStore.planningTransactions;

  // Filter nach Konto anwenden
  if (selectedAccountId.value !== "all") {
    plannings = plannings.filter((p: PlanningTransaction) => {
      // Hauptbuchung mit dem gewählten Konto
      if (p.accountId === selectedAccountId.value) {
        return true;
      }
      // Bei Kontotransfers: Zielkonto prüfen
      if (
        p.transactionType === TransactionType.ACCOUNTTRANSFER &&
        p.transferToAccountId === selectedAccountId.value
      ) {
        return true;
      }
      // Gegenbuchung anzeigen, wenn die Hauptbuchung das gewählte Konto betrifft
      if (
        p.counterPlanningTransactionId &&
        p.name &&
        p.name.includes("(Gegenbuchung)")
      ) {
        const mainPlanning = planningStore.planningTransactions.find(
          (main: PlanningTransaction) =>
            main.id === p.counterPlanningTransactionId
        );
        if (
          mainPlanning &&
          (mainPlanning.accountId === selectedAccountId.value ||
            mainPlanning.transferToAccountId === selectedAccountId.value)
        ) {
          return true;
        }
      }
      return false;
    });
  }

  // Filter nach Kategorie anwenden
  if (selectedCategoryId.value !== "all") {
    plannings = plannings.filter((p: PlanningTransaction) => {
      // Hauptbuchung mit der gewählten Kategorie
      if (p.categoryId === selectedCategoryId.value) {
        return true;
      }
      // Bei Kategorietransfers: Zielkategorie prüfen
      if (
        p.transactionType === TransactionType.CATEGORYTRANSFER &&
        p.transferToCategoryId === selectedCategoryId.value
      ) {
        return true;
      }
      // Gegenbuchung anzeigen, wenn die Hauptbuchung die gewählte Kategorie betrifft
      if (
        p.counterPlanningTransactionId &&
        p.name &&
        p.name.includes("(Gegenbuchung)")
      ) {
        const mainPlanning = planningStore.planningTransactions.find(
          (main: PlanningTransaction) =>
            main.id === p.counterPlanningTransactionId
        );
        if (
          mainPlanning &&
          (mainPlanning.categoryId === selectedCategoryId.value ||
            mainPlanning.transferToCategoryId === selectedCategoryId.value)
        ) {
          return true;
        }
      }
      return false;
    });
  }

  // Gegenbuchungen herausfiltern (außer wenn durch Filter explizit gewünscht)
  const planningsWithoutCounterBookings = plannings.filter(
    (p: PlanningTransaction) => {
      // Wenn ein Filter aktiv ist, wurden die relevanten Gegenbuchungen bereits oben eingeschlossen
      if (
        selectedAccountId.value !== "all" ||
        selectedCategoryId.value !== "all"
      ) {
        return true; // Alle bereits gefilterten Planungen beibehalten
      }

      // Ohne aktive Filter: Gegenbuchungen ausblenden
      if (p.name && p.name.includes("(Gegenbuchung)")) {
        return false;
      }

      // Zusätzliche Prüfung: Bei Transfers mit counterPlanningTransactionId
      // ist die Gegenbuchung diejenige mit positivem Betrag
      if (
        p.counterPlanningTransactionId &&
        (p.transactionType === TransactionType.ACCOUNTTRANSFER ||
          p.transactionType === TransactionType.CATEGORYTRANSFER)
      ) {
        const counterPlanning = planningStore.planningTransactions.find(
          (counter: PlanningTransaction) =>
            counter.id === p.counterPlanningTransactionId
        );

        if (counterPlanning && p.amount > 0 && counterPlanning.amount < 0) {
          return false; // Gegenbuchung ausblenden
        }
      }

      return true;
    }
  );

  // Nach Fälligkeitsdatum aufsteigend sortieren (älteste zuerst)
  const sortedPlannings = planningsWithoutCounterBookings.sort(
    (a: PlanningTransaction, b: PlanningTransaction) => {
      return dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf();
    }
  );

  // Suchfilter anwenden
  const term = searchQuery.value.trim().toLowerCase();
  if (!term) return sortedPlannings;

  return sortedPlannings.filter((p: PlanningTransaction) => {
    const payee =
      recipientStore.getRecipientById(p.recipientId || "")?.name || "";
    const acc = accountStore.getAccountById(p.accountId)?.name || "";
    const cat = categoryStore.getCategoryById(p.categoryId || "")?.name || "";
    return (
      p.name.toLowerCase().includes(term) ||
      payee.toLowerCase().includes(term) ||
      acc.toLowerCase().includes(term) ||
      cat.toLowerCase().includes(term) ||
      String(p.amount).includes(term)
    );
  });
});

const totalPages = computed(() =>
  itemsPerPage.value === "all"
    ? 1
    : Math.ceil(filteredPlannings.value.length / Number(itemsPerPage.value))
);

const paginatedPlannings = computed(() => {
  if (itemsPerPage.value === "all") return filteredPlannings.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  return filteredPlannings.value.slice(
    start,
    start + Number(itemsPerPage.value)
  );
});

function createPlanning() {
  selectedPlanning.value = null;
  showNewPlanningModal.value = true;
}

function editPlanning(planning: PlanningTransaction) {
  selectedPlanning.value = planning;
  showEditPlanningModal.value = true;
}

async function savePlanning(data: any) {
  if (selectedPlanning.value) {
    // Hauptbuchung aktualisieren
    await PlanningService.updatePlanningTransaction(
      selectedPlanning.value.id,
      data
    );

    // Bei Transfers auch die Gegenbuchung aktualisieren
    if (
      selectedPlanning.value.counterPlanningTransactionId &&
      (selectedPlanning.value.transactionType ===
        TransactionType.ACCOUNTTRANSFER ||
        selectedPlanning.value.transactionType ===
          TransactionType.CATEGORYTRANSFER)
    ) {
      const counterPlanning = planningStore.getPlanningTransactionById(
        selectedPlanning.value.counterPlanningTransactionId
      );
      if (counterPlanning) {
        // Gegenbuchung mit entsprechenden Daten aktualisieren
        const counterData: any = {
          name: data.name
            ? `${data.name} (Gegenbuchung)`
            : counterPlanning.name,
          note: data.note !== undefined ? data.note : counterPlanning.note,
          startDate:
            data.startDate !== undefined
              ? data.startDate
              : counterPlanning.startDate,
          valueDate:
            data.valueDate !== undefined
              ? data.valueDate
              : counterPlanning.valueDate,
          endDate:
            data.endDate !== undefined ? data.endDate : counterPlanning.endDate,
          recurrencePattern:
            data.recurrencePattern !== undefined
              ? data.recurrencePattern
              : counterPlanning.recurrencePattern,
          recurrenceEndType:
            data.recurrenceEndType !== undefined
              ? data.recurrenceEndType
              : counterPlanning.recurrenceEndType,
          recurrenceCount:
            data.recurrenceCount !== undefined
              ? data.recurrenceCount
              : counterPlanning.recurrenceCount,
          executionDay:
            data.executionDay !== undefined
              ? data.executionDay
              : counterPlanning.executionDay,
          weekendHandling:
            data.weekendHandling !== undefined
              ? data.weekendHandling
              : counterPlanning.weekendHandling,
          isActive:
            data.isActive !== undefined
              ? data.isActive
              : counterPlanning.isActive,
          forecastOnly:
            data.forecastOnly !== undefined
              ? data.forecastOnly
              : counterPlanning.forecastOnly,
          amountType:
            data.amountType !== undefined
              ? data.amountType
              : counterPlanning.amountType,
          approximateAmount:
            data.approximateAmount !== undefined
              ? data.approximateAmount
              : counterPlanning.approximateAmount,
          minAmount:
            data.minAmount !== undefined
              ? data.minAmount
              : counterPlanning.minAmount,
          maxAmount:
            data.maxAmount !== undefined
              ? data.maxAmount
              : counterPlanning.maxAmount,
          tagIds:
            data.tagIds !== undefined ? data.tagIds : counterPlanning.tagIds,
          autoExecute:
            data.autoExecute !== undefined
              ? data.autoExecute
              : counterPlanning.autoExecute,
        };

        // Betrag für Gegenbuchung umkehren, falls geändert
        if (data.amount !== undefined) {
          counterData.amount = -data.amount;
        }

        await PlanningService.updatePlanningTransaction(
          selectedPlanning.value.counterPlanningTransactionId,
          counterData
        );
      }
    }
  } else {
    await PlanningService.addPlanningTransaction(data);
  }
  showNewPlanningModal.value = false;
  showEditPlanningModal.value = false;
}

function deletePlanning(planning: PlanningTransaction) {
  if (confirm("Möchten Sie diese geplante Transaktion wirklich löschen?")) {
    PlanningService.deletePlanningTransaction(planning.id);
  }
}

/**
 * Schaltet den aktiven Status einer Planungstransaktion um
 */
async function togglePlanningStatus(planning: PlanningTransaction) {
  try {
    const newStatus = !planning.isActive;
    const success = await PlanningService.updatePlanningTransaction(
      planning.id,
      {
        isActive: newStatus,
      }
    );

    if (success) {
      infoLog(
        "AdminPlanningView",
        `Planungstransaktion "${planning.name}" Status geändert zu: ${
          newStatus ? "Aktiv" : "Inaktiv"
        }`,
        { planningId: planning.id, newStatus }
      );
    } else {
      errorLog(
        "AdminPlanningView",
        `Fehler beim Ändern des Status von Planungstransaktion "${planning.name}"`,
        { planningId: planning.id, targetStatus: newStatus }
      );
    }
  } catch (error) {
    errorLog(
      "AdminPlanningView",
      `Fehler beim Umschalten des Planungstransaktion-Status für "${planning.name}"`,
      { planningId: planning.id, error }
    );
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

  const processedPlanningIds = new Set<string>();
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
    const overdueOccurrences = PlanningService.calculateNextOccurrences(
      planning,
      planning.startDate,
      today.format("YYYY-MM-DD")
    );

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
          if (
            (planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
              planning.transactionType === TransactionType.CATEGORYTRANSFER) &&
            planning.counterPlanningTransactionId
          ) {
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
function showToastMessage(
  message: string,
  type: "success" | "error" | "info" | "warning" = "info"
) {
  toastMessage.value = message;
  toastType.value = type;
  showToast.value = true;
}

// Bestätigung der Ausführung
async function confirmExecution() {
  if (!pendingExecutionAnalysis.value) return;

  try {
    const count = await PlanningService.executeAllDuePlanningTransactions();
    showExecuteConfirmation.value = false;
    pendingExecutionAnalysis.value = null;

    infoLog(
      "AdminPlanningView",
      `${count} automatische Planungsbuchungen erfolgreich ausgeführt`
    );
    showToastMessage(
      `${count} automatische Planungsbuchungen erfolgreich ausgeführt.`,
      "success"
    );
  } catch (error) {
    errorLog(
      "AdminPlanningView",
      "Fehler beim Ausführen der Planungsbuchungen",
      error
    );
    showToastMessage(
      "Fehler beim Ausführen der Planungsbuchungen. Bitte prüfen Sie die Konsole für Details.",
      "error"
    );
  }
}

// Abbruch der Ausführung
function cancelExecution() {
  showExecuteConfirmation.value = false;
  pendingExecutionAnalysis.value = null;
}

// Erstellt die Bestätigungsnachricht
function getConfirmationMessage(): string {
  if (!pendingExecutionAnalysis.value) return "";

  const analysis = pendingExecutionAnalysis.value;
  const parts: string[] = [];

  if (analysis.expenses > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-error badge-sm mr-2">Ausgaben</span><span class="font-semibold">${
        analysis.expenses
      } Buchung${analysis.expenses === 1 ? "" : "en"}</span></div>`
    );
  }
  if (analysis.income > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-success badge-sm mr-2">Einnahmen</span><span class="font-semibold">${
        analysis.income
      } Buchung${analysis.income === 1 ? "" : "en"}</span></div>`
    );
  }
  if (analysis.accountTransfers > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-warning badge-sm mr-2">Kontotransfers</span><span class="font-semibold">${
        analysis.accountTransfers
      } Buchung${analysis.accountTransfers === 1 ? "" : "en"}</span></div>`
    );
  }
  if (analysis.categoryTransfers > 0) {
    parts.push(
      `<div class="flex items-center mb-2"><span class="badge badge-info badge-sm mr-2">Kategorietransfers</span><span class="font-semibold">${
        analysis.categoryTransfers
      } Buchung${analysis.categoryTransfers === 1 ? "" : "en"}</span></div>`
    );
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
          Insgesamt: ${analysis.totalCount} Buchung${
    analysis.totalCount === 1 ? "" : "en"
  }
        </span>
      </div>
    </div>
  `;
}

// Button: Play pro Planung - nur fällige ausführen!
async function executeDueForPlanning(planning: PlanningTransaction) {
  const today = dayjs().format("YYYY-MM-DD");
  const due = PlanningService.calculateNextOccurrences(
    planning,
    planning.startDate,
    today
  );
  let executed = 0;
  for (const d of due) {
    const ok = await PlanningService.executePlanningTransaction(planning.id, d);
    if (ok) executed++;
  }
  alert(`${executed} Buchungen für "${planning.name}" ausgeführt.`);
}

function formatRecurrencePattern(pattern: RecurrencePattern): string {
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
function getTransactionTypeIcon(type: TransactionType): string {
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

function getTransactionTypeClass(type: TransactionType): string {
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

function getTransactionTypeLabel(type: TransactionType): string {
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
function getSourceName(planning: PlanningTransaction): string {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return (
      categoryStore.getCategoryById(planning.categoryId || "")?.name || "-"
    );
  } else {
    return accountStore.getAccountById(planning.accountId)?.name || "-";
  }
}

function getTargetName(planning: PlanningTransaction): string {
  if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    return (
      categoryStore.getCategoryById(planning.transferToCategoryId || "")
        ?.name || "-"
    );
  } else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
    return (
      accountStore.getAccountById(planning.transferToAccountId || "")?.name ||
      "-"
    );
  } else {
    return (
      categoryStore.getCategoryById(planning.categoryId || "")?.name || "-"
    );
  }
}

/**
 * Fälligkeitslogik:
 * - "Überfällig": Startdatum liegt mehr als 2 Tage vor heute und wurde noch nicht ausgeführt (Startdatum wurde noch nicht weitergeschoben).
 * - "Fällig": Startdatum ist heute oder in der Vergangenheit (max. 2 Tage alt).
 * - "geplant für": Startdatum liegt in der Zukunft.
 */
function isOverdueByDays(planning: PlanningTransaction, days = 2): boolean {
  const today = dayjs().startOf("day");
  const start = dayjs(planning.startDate).startOf("day");
  return start.isBefore(today.subtract(days, "day"), "day");
}

function isDue(planning: PlanningTransaction): boolean {
  const today = dayjs().startOf("day");
  const start = dayjs(planning.startDate).startOf("day");
  return start.isSameOrBefore(today, "day");
}

function getStartDateLabel(planning: PlanningTransaction): string {
  if (isOverdueByDays(planning, 2)) return "Überfällig";
  return isDue(planning) ? "Fällig" : "geplant für";
}

function getStartDateClass(planning: PlanningTransaction): string {
  if (isOverdueByDays(planning, 2)) return "text-error";
  return isDue(planning) ? "text-warning" : "text-base-content/70";
}

// Hilfsfunktion für Wiederholungstyp-Icon
function getRecurrenceIcon(planning: PlanningTransaction): string {
  if (planning.recurrencePattern === RecurrencePattern.ONCE) {
    return "mdi:repeat-once";
  }
  return "mdi:repeat-variant";
}

// Hilfsfunktion für Wiederholungstyp-Tooltip
function getRecurrenceTooltip(planning: PlanningTransaction): string {
  if (planning.recurrencePattern === RecurrencePattern.ONCE) {
    return "Einzelbuchung";
  }
  return `Wiederholende Buchung: ${formatRecurrencePattern(
    planning.recurrencePattern
  )}`;
}

// Hotkey-Handler für STRG-N
function handleKeydown(event: KeyboardEvent) {
  if (event.altKey && event.key === "n") {
    event.preventDefault();
    createPlanning();
  }
}

// Event-Handler für ButtonGroup
function handleSearchInput(query: string) {
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
</script>

<template>
  <!-- Header -->
  <div
    class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
  >
    <h2 class="text-xl font-bold flex-shrink-0">
      Planungsverwaltung und Regelbuchungen
    </h2>
    <SearchGroup
      btnMiddle="Alle fälligen ausführen"
      btnMiddleIcon="mdi:play-circle"
      btnRight="Neue Planung"
      btnRightIcon="mdi:plus"
      @search="handleSearchInput"
      @btn-middle-click="handleExecuteAllDue"
      @btn-right-click="handleCreatePlanning"
    />
  </div>

  <div class="card bg-base-100 shadow-md border border-base-300 w-full mt-6">
    <div class="card-body">
      <div class="overflow-x-auto">
        <table class="table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Buchungstyp</th>
              <th>Empfänger</th>
              <th>Quelle</th>
              <th>Ziel</th>
              <th>Intervall</th>
              <th class="text-center">
                <Icon
                  icon="mdi:calendar-repeat-outline"
                  class="text-lg"
                />
              </th>
              <th>Fällig</th>
              <th class="text-right">Betrag</th>
              <th>Status</th>
              <th class="text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="planning in paginatedPlannings"
              :key="planning.id"
            >
              <td>{{ planning.name }}</td>
              <td class="text-center">
                <div
                  class="tooltip"
                  :data-tip="
                    getTransactionTypeLabel(
                      planning.transactionType || TransactionType.EXPENSE
                    )
                  "
                >
                  <Icon
                    :icon="
                      getTransactionTypeIcon(
                        planning.transactionType || TransactionType.EXPENSE
                      )
                    "
                    :class="
                      getTransactionTypeClass(
                        planning.transactionType || TransactionType.EXPENSE
                      )
                    "
                    class="text-2xl"
                  />
                </div>
              </td>
              <td>
                {{
                  recipientStore.getRecipientById(planning.recipientId || "")
                    ?.name || "-"
                }}
              </td>
              <td>{{ getSourceName(planning) }}</td>
              <td>{{ getTargetName(planning) }}</td>
              <td>{{ formatRecurrencePattern(planning.recurrencePattern) }}</td>
              <td class="text-center">
                <div
                  class="tooltip"
                  :data-tip="getRecurrenceTooltip(planning)"
                >
                  <Icon
                    :icon="getRecurrenceIcon(planning)"
                    class="text-xl text-base-content/70"
                  />
                </div>
              </td>
              <td>
                <div class="flex flex-col">
                  <span
                    class="text-xs font-medium"
                    :class="getStartDateClass(planning)"
                  >
                    {{ getStartDateLabel(planning) }}
                  </span>
                  <span class="text-sm">{{
                    formatDate(planning.startDate)
                  }}</span>
                </div>
              </td>
              <td class="text-right">
                <CurrencyDisplay
                  :amount="planning.amount"
                  :show-zero="true"
                />
              </td>
              <td>
                <div class="flex space-x-1">
                  <div
                    class="badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity"
                    :class="planning.isActive ? 'badge-success' : 'badge-error'"
                    @click="togglePlanningStatus(planning)"
                    :title="`Klicken um Status zu ${
                      planning.isActive ? 'Inaktiv' : 'Aktiv'
                    } zu ändern`"
                  >
                    {{ planning.isActive ? "Aktiv" : "Inaktiv" }}
                  </div>
                  <span
                    v-if="planning.autoExecute"
                    class="badge badge-info"
                    >Auto</span
                  >
                </div>
              </td>
              <td class="text-right">
                <div class="flex justify-end space-x-1">
                  <button
                    class="btn btn-ghost btn-xs border-none"
                    @click="editPlanning(planning)"
                  >
                    <Icon
                      icon="mdi:pencil"
                      class="text-base"
                    />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs border-none text-error/75"
                    @click="deletePlanning(planning)"
                  >
                    <Icon
                      icon="mdi:trash-can"
                      class="text-base"
                    />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="paginatedPlannings.length === 0">
              <td
                colspan="11"
                class="text-center py-4"
              >
                Keine geplanten Transaktionen vorhanden.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <PagingComponent
        :currentPage="currentPage"
        :totalPages="totalPages"
        :itemsPerPage="itemsPerPage"
        @update:currentPage="(v) => (currentPage = v)"
        @update:itemsPerPage="(v) => (itemsPerPage = v)"
      />
    </div>
  </div>

  <div
    v-if="showNewPlanningModal"
    class="modal modal-open"
  >
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg mb-4">Neue geplante Transaktion</h3>
      <PlanningTransactionForm
        @save="savePlanning"
        @cancel="showNewPlanningModal = false"
      />
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="showNewPlanningModal = false"
    />
  </div>

  <div
    v-if="showEditPlanningModal && selectedPlanning"
    class="modal modal-open"
  >
    <div class="modal-box max-w-3xl">
      <h3 class="font-bold text-lg mb-4">Geplante Transaktion bearbeiten</h3>
      <PlanningTransactionForm
        :transaction="selectedPlanning"
        :is-edit="true"
        @save="savePlanning"
        @cancel="showEditPlanningModal = false"
      />
    </div>
    <div
      class="modal-backdrop bg-black/30"
      @click="showEditPlanningModal = false"
    />
  </div>

  <!-- Bestätigungsmodal für Ausführung aller fälligen Buchungen -->
  <ConfirmationModal
    v-if="showExecuteConfirmation && pendingExecutionAnalysis"
    title="Fällige Planungsbuchungen ausführen"
    :message="getConfirmationMessage()"
    :use-html="true"
    confirm-text="Ausführen"
    cancel-text="Abbrechen"
    @confirm="confirmExecution"
    @cancel="cancelExecution"
  />

  <!-- Toast-System -->
  <InfoToast
    v-if="showToast"
    :message="toastMessage"
    :type="toastType"
    @close="showToast = false"
  />
</template>
