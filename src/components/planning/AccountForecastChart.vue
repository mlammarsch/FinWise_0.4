<!-- src/components/planning/AccountForecastChart.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/planning/AccountForecastChart.vue
 * Zeigt eine Prognose der Kontosalden für die nächsten Monate an.
 *
 * Komponenten-Props:
 * - startDate: string - Startdatum für die Prognose (YYYY-MM-DD)
 * - filteredAccountId?: string - Optional: ID eines bestimmten Kontos für die Filterung
 *
 * Emits:
 * - Keine Emits vorhanden
 */
import { ref, computed, onMounted, watch } from "vue";
import { useAccountStore } from "@/stores/accountStore";
import { usePlanningStore } from "@/stores/planningStore";
import CurrencyDisplay from "@/components/ui/CurrencyDisplay.vue";
import { formatDate, toDateOnlyString } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";
import { BalanceService } from "@/services/BalanceService";

const props = defineProps<{
  startDate: string;
  filteredAccountId?: string;
}>();

// Stores
const accountStore = useAccountStore();
const planningStore = usePlanningStore();

// Chart-Konfiguration
const forecastMonths = 6; // Anzahl der Prognosemonate
const chartHeight = 300; // Höhe des Charts in Pixeln

// Daten für die Prognose
const forecastData = ref<
  {
    accountId: string;
    accountName: string;
    currentBalance: number;
    monthlyForecasts: {
      month: string;
      balance: number;
      projectedBalance: number;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
      }>;
    }[];
  }[]
>([]);

// Aktives Konto für detaillierte Ansicht (wenn null, werden alle angezeigt)
const activeAccountId = ref<string | null>(null);

// Berechne das höchste und niedrigste Saldo für die Y-Achsen-Skalierung
const balanceRange = computed(() => {
  let min = 0;
  let max = 0;

  forecastData.value.forEach((account) => {
    account.monthlyForecasts.forEach((forecast) => {
      min = Math.min(min, forecast.projectedBalance);
      max = Math.max(max, forecast.projectedBalance);
    });
  });

  // Etwas Platz oben und unten hinzufügen
  min = Math.floor(min * 1.1);
  max = Math.ceil(max * 1.1);

  return { min, max, range: max - min };
});

// Bestimmt, ob ein Konto angezeigt werden soll basierend auf den Filtern
const shouldShowAccount = computed(() => {
  return (accountId: string) => {
    if (props.filteredAccountId && props.filteredAccountId !== accountId) {
      return false;
    }
    return true;
  };
});

// Berechnet die Y-Position für einen Saldo im Chart
function getYPosition(balance: number): number {
  if (balanceRange.value.range === 0) return chartHeight / 2;

  const percentage =
    (balance - balanceRange.value.min) / balanceRange.value.range;
  return chartHeight - percentage * chartHeight;
}

// Funktionen zum Konvertieren von Monatsindex zu Datum und zurück
function getMonthLabel(index: number): string {
  const date = new Date(props.startDate);
  date.setMonth(date.getMonth() + index);
  return date.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

// Generiert Prognosedaten für die Konten
function generateForecastData() {
  const startDate = new Date(props.startDate);
  const data: typeof forecastData.value = [];

  // Generiere Daten für jedes aktive Konto
  accountStore.activeAccounts.forEach((account) => {
    if (!shouldShowAccount.value(account.id)) return;

    const accountData = {
      accountId: account.id,
      accountName: account.name,
      currentBalance: account.balance,
      monthlyForecasts: [] as {
        month: string;
        balance: number;
        projectedBalance: number;
        transactions: Array<{
          date: string;
          description: string;
          amount: number;
        }>;
      }[],
    };

    // Erstelle Prognose für jeden Monat
    for (let i = 0; i < forecastMonths; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setMonth(forecastDate.getMonth() + i);

      // Letzter Tag des Monats
      const lastDay = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth() + 1,
        0
      );

      // Aktueller und prognostizierter Kontostand
      const balance = BalanceService.getTodayBalance(
        "account",
        account.id,
        lastDay
      );
      const projectedBalance = BalanceService.getProjectedBalance(
        "account",
        account.id,
        lastDay
      );

      // Hole alle geplanten Transaktionen für diesen Monat
      const monthStart = new Date(
        forecastDate.getFullYear(),
        forecastDate.getMonth(),
        1
      );
      const transactions = planningStore
        .getUpcomingTransactions(35) // Maximal 35 Tage pro Monat
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return (
            txDate >= monthStart &&
            txDate <= lastDay &&
            tx.transaction.accountId === account.id
          );
        })
        .map((tx) => ({
          date: tx.date,
          description: tx.transaction.name || "Geplante Transaktion",
          amount: tx.transaction.amount,
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
  debugLog("[AccountForecastChart] generateForecastData", {
    accounts: data.length,
    startDate: props.startDate,
  });
}

// Formatiert einen Betrag für die Anzeige
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Zeige detaillierte Ansicht für ein Konto
function showAccountDetails(accountId: string) {
  activeAccountId.value =
    activeAccountId.value === accountId ? null : accountId;
}

// Aktualisiere die Daten, wenn sich die Props ändern
watch([() => props.startDate, () => props.filteredAccountId], () => {
  generateForecastData();
});

// Initialisierung
onMounted(() => {
  generateForecastData();
});
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-xl font-bold">Kontenprognose</h3>

    <!-- Kontoübersicht und Legende -->
    <div class="flex flex-wrap gap-4">
      <div
        v-for="account in forecastData"
        :key="account.accountId"
        class="badge badge-lg cursor-pointer"
        :class="
          activeAccountId === account.accountId
            ? 'badge-accent'
            : 'badge-outline'
        "
        @click="showAccountDetails(account.accountId)"
      >
        {{ account.accountName }}
      </div>
    </div>

    <!-- Keine Daten Hinweis -->
    <div v-if="forecastData.length === 0" class="text-center py-10">
      <Icon
        icon="mdi:alert-circle-outline"
        class="text-4xl text-warning mb-2"
      />
      <p>Keine Kontodaten verfügbar oder alle Konten gefiltert.</p>
    </div>

    <!-- Prognose-Visualisierung -->
    <div v-else class="overflow-x-auto">
      <div class="min-w-[800px]">
        <!-- Chart-Bereich -->
        <div
          class="relative"
          :style="`height: ${chartHeight}px; margin-bottom: 30px;`"
        >
          <!-- Y-Achse Beschriftungen -->
          <div
            class="absolute inset-y-0 left-0 w-20 flex flex-col justify-between"
          >
            <div class="text-xs text-right pr-2">
              {{ formatAmount(balanceRange.max) }}
            </div>
            <div class="text-xs text-right pr-2">
              {{ formatAmount(balanceRange.min) }}
            </div>
          </div>

          <!-- Horizontale Hilfslinien -->
          <div class="absolute inset-x-0 inset-y-0 left-20" style="z-index: 1">
            <div
              v-for="i in 5"
              :key="i"
              class="absolute w-full border-t border-base-300"
              :style="`top: ${((i - 1) * chartHeight) / 4}px;`"
            ></div>
            <!-- Nulllinie -->
            <div
              class="absolute w-full border-t border-neutral"
              :style="`top: ${getYPosition(0)}px;`"
            ></div>
          </div>

          <!-- X-Achse Beschriftungen -->
          <div class="absolute bottom-0 left-20 right-0 flex justify-between">
            <div
              v-for="i in forecastMonths"
              :key="i"
              class="text-xs text-center"
              :style="`width: ${100 / forecastMonths}%;`"
            >
              {{ getMonthLabel(i - 1) }}
            </div>
          </div>

          <!-- Linien für jedes Konto -->
          <div class="absolute inset-y-0 left-20 right-0">
            <svg width="100%" height="100%" class="overflow-visible">
              <g
                v-for="(account, accountIndex) in forecastData"
                :key="account.accountId"
              >
                <!-- Verbindungslinien zwischen Punkten -->
                <path
                  :d="
                    account.monthlyForecasts
                      .map(
                        (forecast, i) =>
                          `${i === 0 ? 'M' : 'L'} ${
                            i * (100 / (forecastMonths - 1))
                          }% ${getYPosition(forecast.projectedBalance)}`
                      )
                      .join(' ')
                  "
                  :stroke="
                    activeAccountId === account.accountId
                      ? 'var(--color-accent)'
                      : `hsl(${accountIndex * 60}, 70%, 60%)`
                  "
                  stroke-width="2"
                  fill="none"
                />

                <!-- Punkte für jeden Monat -->
                <circle
                  v-for="(forecast, i) in account.monthlyForecasts"
                  :key="i"
                  :cx="`${i * (100 / (forecastMonths - 1))}%`"
                  :cy="getYPosition(forecast.projectedBalance)"
                  r="4"
                  :fill="
                    activeAccountId === account.accountId
                      ? 'var(--color-accent)'
                      : `hsl(${accountIndex * 60}, 70%, 60%)`
                  "
                />
              </g>
            </svg>
          </div>
        </div>

        <!-- Detaillierte Daten für ausgewähltes Konto -->
        <div v-if="activeAccountId" class="mt-8">
          <h4 class="text-lg font-semibold mb-4">
            Detaillierte Prognose für
            {{
              forecastData.find((a) => a.accountId === activeAccountId)
                ?.accountName
            }}
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div
              v-for="(forecast, i) in forecastData.find(
                (a) => a.accountId === activeAccountId
              )?.monthlyForecasts"
              :key="i"
              class="card bg-base-200 shadow-sm"
            >
              <div class="card-body p-4">
                <h5 class="card-title text-base">{{ forecast.month }}</h5>
                <div class="text-sm mb-2">
                  <div class="flex justify-between">
                    <span>Aktueller Saldo:</span>
                    <CurrencyDisplay
                      :amount="forecast.balance"
                      :as-integer="true"
                    />
                  </div>
                  <div class="flex justify-between font-bold">
                    <span>Prognostizierter Saldo:</span>
                    <CurrencyDisplay
                      :amount="forecast.projectedBalance"
                      :as-integer="true"
                    />
                  </div>
                </div>
                <div
                  v-if="forecast.transactions.length > 0"
                  class="text-xs space-y-1 border-t border-base-300 pt-2"
                >
                  <div class="font-semibold">Geplante Transaktionen:</div>
                  <div
                    v-for="(tx, j) in forecast.transactions"
                    :key="j"
                    class="flex justify-between"
                  >
                    <span
                      >{{ formatDate(tx.date) }} - {{ tx.description }}</span
                    >
                    <CurrencyDisplay :amount="tx.amount" :show-zero="true" />
                  </div>
                </div>
                <div
                  v-else
                  class="text-xs text-base-content/70 border-t border-base-300 pt-2"
                >
                  Keine geplanten Transaktionen in diesem Monat.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
