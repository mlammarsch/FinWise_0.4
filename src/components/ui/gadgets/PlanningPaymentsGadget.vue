<script setup lang="ts">
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { usePlanningStore } from "../../../stores/planningStore";
import { useCategoryStore } from "../../../stores/categoryStore";
import { useAccountStore } from "../../../stores/accountStore";
import { PlanningService } from "../../../services/PlanningService";
import { TransactionType, PlanningTransaction } from "../../../types";
import CurrencyDisplay from "../CurrencyDisplay.vue";

const props = withDefaults(
  defineProps<{
    showHeader?: boolean;
    showActions?: boolean;
  }>(),
  {
    showHeader: true,
    showActions: true,
  }
);

const router = useRouter();
const planningStore = usePlanningStore();
const categoryStore = useCategoryStore();
const accountStore = useAccountStore();

const planningLimit = ref(3);
function setPlanningLimit(limit: number) {
  planningLimit.value = limit;
}

function navigateToPlanning() {
  router.push("/planning");
}

function navigateToPlanningEdit(planningTransactionId: string) {
  router.push({
    path: "/planning",
    query: { edit: planningTransactionId },
  });
}

const upcomingPlanningTransactions = computed(() => {
  const today = dayjs();
  const startDate = today.subtract(30, "days");
  const endDate = today.add(14, "days");

  const upcomingTransactions: Array<{
    planningTransaction: PlanningTransaction;
    executionDate: string;
    formattedDate: string;
    isDue: boolean;
    isOverdue: boolean;
  }> = [];

  planningStore.planningTransactions
    .filter(
      (pt) =>
        pt.isActive && !pt.forecastOnly && !pt.counterPlanningTransactionId
    )
    .forEach((planningTransaction) => {
      try {
        const occurrences = PlanningService.calculateNextOccurrences(
          planningTransaction,
          startDate.format("YYYY-MM-DD"),
          endDate.format("YYYY-MM-DD")
        );

        occurrences.forEach((executionDate) => {
          const executionDay = dayjs(executionDate);
          const isDue = executionDay.isSameOrBefore(today, "day");
          const isOverdue = executionDay.isBefore(
            today.subtract(2, "days"),
            "day"
          );

          upcomingTransactions.push({
            planningTransaction,
            executionDate: executionDate,
            formattedDate: executionDay.format("DD.MM.YYYY"),
            isDue: isDue,
            isOverdue: isOverdue,
          });
        });
      } catch (error) {
        console.warn(
          "Fehler beim Berechnen der Occurrences für Planning Transaction:",
          planningTransaction.id,
          error
        );
      }
    });

  return upcomingTransactions.sort(
    (a, b) =>
      dayjs(a.executionDate).valueOf() - dayjs(b.executionDate).valueOf()
  );
});

// Sichtbare Items entsprechend Button-Einstellung (3 oder 8)
const visibleItems = computed(() =>
  upcomingPlanningTransactions.value.slice(0, planningLimit.value)
);

// Konstanten für Zeilenhöhe und Zwischenabstand (px)
const ROW_HEIGHT = 56; // Höhe je Kartenzeile (inkl. Padding)
const ROW_GAP = 4; // Abstand zwischen Karten (space-y-1 ≈ 0.25rem = 4px)

// Anzahl der Zeilen, die maximal sichtbar sein dürfen (Hardcap 4)
const containerRows = computed(() => Math.min(visibleItems.value.length, 4));

// Scrollbar aktiv, wenn mehr als 4 sichtbar konfiguriert sind
const isScrollable = computed(
  () => planningLimit.value > 4 && visibleItems.value.length > 4
);

// Dynamischer Stil für den Scroll-Container: max-height + overflow nur vertikal
const listContainerStyle = computed(() => {
  const rows = containerRows.value;
  const maxHeight = rows > 0 ? rows * ROW_HEIGHT + (rows - 1) * ROW_GAP : 0;
  // Wenn mehr Items als sichtbare Zeilen vorhanden: vertikal scrollen
  const needScroll = visibleItems.value.length > rows;
  return {
    maxHeight: `${maxHeight}px`,
    overflowY: needScroll ? "auto" : "hidden",
    overflowX: "hidden",
  } as Record<string, string>;
});

// Kompakteres Padding, sobald Scroll aktiv ist (verhindert horizontalen Scroll)
const rowPaddingClass = computed(() => (isScrollable.value ? "p-1" : "p-2"));

const dueTransactions = computed(() => {
  return upcomingPlanningTransactions.value.filter((item) => item.isDue);
});

async function executePlanning(
  planningTransactionId: string,
  executionDate: string
) {
  try {
    await PlanningService.executePlanningTransaction(
      planningTransactionId,
      executionDate
    );
  } catch (error) {
    console.error("Fehler beim Ausführen der geplanten Transaktion:", error);
  }
}

async function skipPlanning(
  planningTransactionId: string,
  executionDate: string
) {
  try {
    await PlanningService.skipPlanningTransaction(
      planningTransactionId,
      executionDate
    );
  } catch (error) {
    console.error("Fehler beim Überspringen der geplanten Transaktion:", error);
  }
}

async function executeAutomaticTransactions() {
  try {
    const count = await PlanningService.executeAllDuePlanningTransactions();
    if (count > 0) {
      alert(`${count} fällige Planungsbuchungen wurden ausgeführt.`);
    } else {
      alert("Keine fälligen Planungsbuchungen gefunden.");
    }
  } catch (error) {
    console.error(
      "Fehler beim Ausführen der fälligen Planungsbuchungen:",
      error
    );
    alert("Fehler beim Ausführen der fälligen Planungsbuchungen.");
  }
}

function getTransactionTypeIcon(type: TransactionType | undefined): string {
  if (!type) return "mdi:help-circle-outline";
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

function getTransactionTypeClass(type: TransactionType | undefined): string {
  if (!type) return "";
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
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <div>
        <h3
          v-if="showHeader"
          class="card-title text-lg"
        >
          Geplante Zahlungen
        </h3>
        <p class="text-sm">Nächste 14 Tage</p>
      </div>

      <div
        v-if="showActions"
        class="flex gap-2 items-center"
      >
        <div class="flex gap-2">
          <button
            :class="
              planningLimit === 3
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline'
            "
            @click="setPlanningLimit(3)"
          >
            3
          </button>
          <button
            :class="
              planningLimit === 8
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline'
            "
            @click="setPlanningLimit(8)"
          >
            8
          </button>
        </div>

        <button
          class="btn btn-xs btn-outline"
          @click="navigateToPlanning"
        >
          Alle
        </button>

        <button
          v-if="dueTransactions.length > 0"
          class="btn btn-xs btn-info btn-outline"
          @click="executeAutomaticTransactions"
          :title="`${dueTransactions.length} fällige Planungen ausführen`"
        >
          <Icon
            icon="mdi:play-circle"
            class="mr-1"
          />
          Fällige ({{ dueTransactions.length }})
        </button>
      </div>
    </div>

    <div
      v-if="upcomingPlanningTransactions.length > 0"
      class="mt-3"
    >
      <!-- Scroll-Container: zeigt max. 4 Zeilen, bei >4 vertikal scrollbar, niemals horizontal -->
      <div
        class="ppg-list space-y-1"
        :style="listContainerStyle"
      >
        <div
          v-for="item in visibleItems"
          :key="`${item.planningTransaction.id}-${item.executionDate}`"
          :class="[
            'ppg-row flex items-center justify-between rounded-lg cursor-pointer transition-colors',
            rowPaddingClass,
            item.isOverdue
              ? 'bg-error/10 hover:bg-error/20 border border-error/20'
              : item.isDue
              ? 'bg-info/10 hover:bg-info/20 border border-info/20'
              : 'bg-base-200 hover:bg-base-300',
          ]"
          @click="navigateToPlanningEdit(item.planningTransaction.id)"
        >
          <div class="flex items-center space-x-1 flex-1 min-w-0">
            <div class="flex-shrink-0">
              <span
                class="iconify text-lg"
                :class="
                  getTransactionTypeClass(
                    item.planningTransaction.transactionType
                  )
                "
                :data-icon="
                  getTransactionTypeIcon(
                    item.planningTransaction.transactionType
                  )
                "
              ></span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium truncate">
                {{ item.planningTransaction.name }}
              </div>
              <div class="text-xs opacity-60 truncate">
                {{ item.formattedDate }} •
                {{ getSourceName(item.planningTransaction) }} →
                {{ getTargetName(item.planningTransaction) }}
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2 flex-shrink-0">
            <div class="text-right">
              <div
                class="text-sm font-semibold"
                :class="
                  getTransactionTypeClass(
                    item.planningTransaction.transactionType
                  )
                "
              >
                <CurrencyDisplay
                  :amount="item.planningTransaction.amount"
                  :asInteger="true"
                />
              </div>
            </div>

            <div class="flex space-x-1">
              <div
                class="tooltip tooltip-top max-w-xs"
                data-tip="Planungstransaktion ausführen und echte Transaktion erstellen"
              >
                <button
                  class="btn btn-ghost btn-xs border-none"
                  @click.stop="
                    executePlanning(
                      item.planningTransaction.id,
                      item.executionDate
                    )
                  "
                >
                  <Icon
                    icon="mdi:play"
                    class="text-base text-success"
                  />
                </button>
              </div>
              <div
                class="tooltip tooltip-top max-w-xs"
                data-tip="Planungstransaktion überspringen (als erledigt markieren ohne Transaktion zu erstellen)"
              >
                <button
                  class="btn btn-ghost btn-xs border-none"
                  @click.stop="
                    skipPlanning(
                      item.planningTransaction.id,
                      item.executionDate
                    )
                  "
                >
                  <Icon
                    icon="mdi:skip-next"
                    class="text-base text-warning"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Hinweis, dass es mehr als konfiguriert (3/8) gibt -->
      <div
        v-if="upcomingPlanningTransactions.length > planningLimit"
        class="text-center pt-2"
      >
        <p class="text-xs opacity-60">
          ... und
          {{ upcomingPlanningTransactions.length - planningLimit }}
          weitere
        </p>
      </div>
    </div>

    <div
      v-else
      class="text-center py-4"
    >
      <p class="text-sm italic opacity-60">Keine anstehenden Zahlungen</p>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
/* Scroll-Container ausschließlich vertikal scrollbar, horizontal verborgen */
.ppg-list {
  overflow-x: hidden;
}

/* Dünne Scrollbar, unaufdringlich */
.ppg-list::-webkit-scrollbar {
  width: 8px;
}
.ppg-list::-webkit-scrollbar-thumb {
  @apply rounded-full;
  background-color: color-mix(
    in oklab,
    var(--fallback-bc, oklch(var(--bc) / 1)) 30%,
    transparent
  );
}
.ppg-list {
  scrollbar-width: thin; /* Firefox */
}

/* Einheitliche Mindesthöhe je Kartenzeile, passend zu ROW_HEIGHT (56px) */
.ppg-row {
  min-height: 56px;
}
</style>
