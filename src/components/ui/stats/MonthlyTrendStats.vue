<script setup lang="ts">
import { ref, computed } from "vue";
import dayjs from "dayjs";
import { useRouter } from "vue-router";
import { TransactionService } from "../../../services/TransactionService";
import { formatPercent } from "../../../utils/formatters";
import CurrencyDisplay from "../CurrencyDisplay.vue";

const props = withDefaults(
  defineProps<{
    months?: number;
    monthsOptions?: number[];
    showHeader?: boolean;
    showActions?: boolean;
  }>(),
  {
    months: 6,
    monthsOptions: () => [1, 3, 6, 9, 12],
    showHeader: true,
    showActions: true,
  }
);

const router = useRouter();

const selectedMonths = ref<number>(props.months);
const setMonths = (m: number) => {
  selectedMonths.value = m;
};

type TrendRow = {
  key: string;
  monthLabel: string;
  income: number;
  expense: number;
  balance: number;
  percent: number | null;
  arrow: string;
  badgeClass: string;
};

function monthRange(offset: number) {
  const end = dayjs().subtract(offset, "month").endOf("month");
  const start = end.startOf("month");
  return {
    start: start.format("YYYY-MM-DD"),
    end: end.format("YYYY-MM-DD"),
    iso: start.format("YYYY-MM"),
  };
}

function getPrevComparableRange(start: string, end: string) {
  const s = dayjs(start);
  const e = dayjs(end);
  const months = e.diff(s, "month") + 1;
  const prevEnd = s.subtract(1, "month").endOf("month");
  const prevStart = prevEnd.subtract(months - 1, "month").startOf("month");
  return {
    start: prevStart.format("YYYY-MM-DD"),
    end: prevEnd.format("YYYY-MM-DD"),
  };
}

const rows = computed<TrendRow[]>(() => {
  const list: TrendRow[] = [];
  for (let i = 0; i < selectedMonths.value; i++) {
    const { start, end, iso } = monthRange(i);
    const current = TransactionService.getIncomeExpenseSummary(start, end);
    const prevRange = getPrevComparableRange(start, end);
    const previous = TransactionService.getIncomeExpenseSummary(
      prevRange.start,
      prevRange.end
    );

    const balance = current.balance;
    const prevBalance = previous.balance;

    const denom = Math.abs(prevBalance);
    const percent =
      denom < 1e-9 ? null : ((balance - prevBalance) / denom) * 100;
    const isUp = percent === null ? false : balance - prevBalance >= 0;
    const badgeClass =
      percent === null ? "badge-ghost" : isUp ? "badge-success" : "badge-error";
    const arrow = percent === null ? "" : isUp ? "▲" : "▼";

    list.push({
      key: iso,
      monthLabel: dayjs(iso).format("MMM YY"),
      income: current.income,
      expense: current.expense,
      balance,
      percent,
      arrow,
      badgeClass,
    });
  }
  // Bereits absteigend: aktueller Monat zuerst
  return list;
});

function navigateToStatistics() {
  router.push("/statistics");
}
</script>

<template>
  <div
    class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150"
  >
    <div class="card-body">
      <div class="flex justify-between items-center mb-4">
        <h3
          v-if="showHeader"
          class="card-title text-lg"
        >
          Monatlicher Trend
        </h3>

        <div class="flex gap-2 mb-4">
          <button
            v-for="m in props.monthsOptions"
            :key="m"
            :class="
              selectedMonths === m
                ? 'btn btn-xs btn-primary'
                : 'btn btn-xs btn-outline'
            "
            @click="setMonths(m)"
          >
            {{ m }}
          </button>
        </div>

        <button
          v-if="showActions"
          class="btn btn-sm btn-ghost"
          @click="navigateToStatistics"
        >
          Mehr Statistiken
          <span
            class="iconify ml-1"
            data-icon="mdi:chevron-right"
          ></span>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra w-full table-compact">
          <thead>
            <tr>
              <th>Monat</th>
              <th class="text-right">Einnahmen</th>
              <th class="text-right">Ausgaben</th>
              <th class="text-right">Bilanz</th>
              <th class="text-center">Trend</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr
              v-for="row in rows"
              :key="row.key"
              class="leading-tight"
            >
              <td class="font-medium py-0">{{ row.monthLabel }}</td>

              <td class="text-right py-2 text-success">
                <CurrencyDisplay
                  :amount="row.income"
                  :asInteger="true"
                />
              </td>

              <td class="text-right py-1 text-error">
                <CurrencyDisplay
                  :amount="row.expense"
                  :asInteger="true"
                />
              </td>

              <td
                class="text-right py-1"
                :class="row.balance >= 0 ? 'text-success' : 'text-error'"
              >
                <CurrencyDisplay
                  :amount="row.balance"
                  :asInteger="true"
                />
              </td>

              <td class="text-center py-1">
                <span
                  class="badge badge-soft badge-sm rounded-full border-0"
                  :class="row.badgeClass"
                  aria-label="Bilanz-Trend"
                >
                  <span v-if="row.percent !== null"
                    >{{ row.arrow }} {{ formatPercent(row.percent) }}</span
                  >
                  <span v-else>—</span>
                </span>
              </td>
            </tr>

            <tr v-if="rows.length === 0">
              <td
                colspan="5"
                class="text-center py-4"
              >
                Keine Daten vorhanden
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped></style>
