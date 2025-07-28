<!-- Datei: src/views/admin/AdminPlanningView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/admin/AdminPlanningView.vue
 * Administrative Verwaltung von Planungstransaktionen.
 */
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { usePlanningStore } from "@/stores/planningStore";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import {
  PlanningTransaction,
  RecurrencePattern,
  TransactionType,
} from "@/types";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PlanningTransactionForm from "@/components/planning/PlanningTransactionForm.vue";
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
const selectedPlanning = ref<PlanningTransaction | null>(null);
const searchQuery = ref("");

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

const filteredPlannings = computed(() => {
  // Erst Gegenbuchungen herausfiltern
  const planningsWithoutCounterBookings =
    planningStore.planningTransactions.filter((p) => {
      // Eine Gegenbuchung erkennt man daran, dass:
      // 1. Sie einen Namen mit "(Gegenbuchung)" hat
      // 2. Oder sie bei Transfers einen positiven Betrag hat (während die Hauptbuchung negativ ist)

      // Prüfung über den Namen - einfachste Methode
      if (p.name && p.name.includes("(Gegenbuchung)")) {
        return false; // Gegenbuchung ausblenden
      }

      // Zusätzliche Prüfung: Bei Transfers mit counterPlanningTransactionId
      // ist die Gegenbuchung diejenige mit positivem Betrag
      if (
        p.counterPlanningTransactionId &&
        (p.transactionType === TransactionType.ACCOUNTTRANSFER ||
          p.transactionType === TransactionType.CATEGORYTRANSFER)
      ) {
        const counterPlanning = planningStore.planningTransactions.find(
          (counter) => counter.id === p.counterPlanningTransactionId
        );

        // Wenn die Gegenbuchung existiert und diese Planung einen positiven Betrag hat,
        // während die Gegenbuchung einen negativen Betrag hat, dann ist dies die Gegenbuchung
        if (counterPlanning && p.amount > 0 && counterPlanning.amount < 0) {
          return false; // Gegenbuchung ausblenden
        }
      }

      return true; // Hauptbuchung oder normale Buchung anzeigen
    });

  // Nach Fälligkeitsdatum aufsteigend sortieren (älteste zuerst)
  const sortedPlannings = planningsWithoutCounterBookings.sort((a, b) => {
    return dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf();
  });

  const term = searchQuery.value.trim().toLowerCase();
  if (!term) return sortedPlannings;

  return sortedPlannings.filter((p) => {
    const payee =
      recipientStore.getRecipientById(p.recipientId || "")?.name || "";
    const acc = accountStore.getAccountById(p.accountId)?.name || "";
    return (
      p.name.toLowerCase().includes(term) ||
      payee.toLowerCase().includes(term) ||
      acc.toLowerCase().includes(term) ||
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
function executeAllDuePlannings() {
  const count = PlanningService.executeAllDuePlanningTransactions();
  alert(`${count} automatische Planungsbuchungen ausgeführt.`);
}

// Button: Play pro Planung - nur fällige ausführen!
function executeDueForPlanning(planning: PlanningTransaction) {
  const today = dayjs().format("YYYY-MM-DD");
  const due = PlanningService.calculateNextOccurrences(
    planning,
    planning.startDate,
    today
  );
  let executed = 0;
  due.forEach((d) => {
    if (PlanningService.executePlanningTransaction(planning.id, d)) executed++;
  });
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
    return categoryStore.getCategoryById(planning.categoryId)?.name || "-";
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
    return categoryStore.getCategoryById(planning.categoryId)?.name || "-";
  }
}

// Hilfsfunktion zur Prüfung, ob das Startdatum die erste Planbuchung einer Serie ist
function isFirstOccurrenceOfSeries(planning: PlanningTransaction): boolean {
  // Bei einmaligen Buchungen ist es immer die erste (und einzige)
  if (planning.recurrencePattern === RecurrencePattern.ONCE) {
    return true;
  }

  // Prüfen, ob das Startdatum heute oder in der Vergangenheit liegt
  const today = dayjs().format("YYYY-MM-DD");
  const startDate = dayjs(planning.startDate).format("YYYY-MM-DD");

  // Wenn das Startdatum heute oder in der Vergangenheit liegt, ist es fällig
  return dayjs(startDate).isSameOrBefore(dayjs(today));
}

// Funktion zur Anzeige des korrekten Labels für das Startdatum
function getStartDateLabel(planning: PlanningTransaction): string {
  return isFirstOccurrenceOfSeries(planning) ? "Fällig" : "geplant für";
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
</script>

<template>
  <!-- Header -->
  <div
    class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
  >
    <h2 class="text-xl font-bold flex-shrink-0">Planungsverwaltung</h2>
    <div class="flex justify-end w-full md:w-auto mt-2 md:mt-0">
      <div class="join">
        <button
          class="btn join-item rounded-l-full btn-sm btn-soft border border-base-300"
          @click="executeAllDuePlannings"
        >
          <Icon
            icon="mdi:play-circle"
            class="mr-2 text-base"
          />
          Alle fälligen ausführen
        </button>
        <button
          class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300"
          @click="createPlanning"
        >
          <Icon
            icon="mdi:plus"
            class="mr-2 text-base"
          />
          Neue Planung
        </button>
      </div>
    </div>
  </div>

  <SearchGroup @search="(q) => (searchQuery = q)" />

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
                  :data-tip="getTransactionTypeLabel(planning.transactionType)"
                >
                  <Icon
                    :icon="getTransactionTypeIcon(planning.transactionType)"
                    :class="getTransactionTypeClass(planning.transactionType)"
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
                    :class="
                      isFirstOccurrenceOfSeries(planning)
                        ? 'text-warning'
                        : 'text-base-content/70'
                    "
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
</template>
