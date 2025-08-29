<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { TransactionService } from '../../../services/TransactionService';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

const props = defineProps<{
  startDate: string;
  endDate: string;
}>();

function getPrevComparableRange(start: string, end: string) {
  const s = dayjs(start);
  const e = dayjs(end);

  const monthAligned =
    s.format('YYYY-MM-DD') === s.startOf('month').format('YYYY-MM-DD') &&
    e.format('YYYY-MM-DD') === e.endOf('month').format('YYYY-MM-DD');

  if (monthAligned) {
    const months = e.diff(s, 'month') + 1;
    const prevEnd = s.subtract(1, 'month').endOf('month');
    const prevStart = prevEnd.subtract(months - 1, 'month').startOf('month');
    return {
      start: prevStart.format('YYYY-MM-DD'),
      end: prevEnd.format('YYYY-MM-DD'),
    };
  }

  const days = e.diff(s, 'day') + 1;
  const prevEnd = s.subtract(1, 'day');
  const prevStart = prevEnd.subtract(days - 1, 'day');
  return {
    start: prevStart.format('YYYY-MM-DD'),
    end: prevEnd.format('YYYY-MM-DD'),
  };
}

const current = computed(() => TransactionService.getIncomeExpenseSummary(props.startDate, props.endDate));
const prevRange = computed(() => getPrevComparableRange(props.startDate, props.endDate));
const previous = computed(() => TransactionService.getIncomeExpenseSummary(prevRange.value.start, prevRange.value.end));

const value = computed(() => current.value.income);
const prevValue = computed(() => previous.value.income);

const percent = computed(() => {
  const denom = Math.abs(prevValue.value);
  if (denom < 1e-9) return null;
  return ((value.value - prevValue.value) / denom) * 100;
});

const isUp = computed(() => value.value - prevValue.value >= 0);
const badgeClass = computed(() => {
  if (percent.value === null) return 'badge-ghost';
  return isUp.value ? 'badge-success' : 'badge-error';
});
const arrow = computed(() => percent.value === null ? '' : (isUp.value ? '▲' : '▼'));
</script>

<template>
  <div class="card rounded-md border border-base-300 bg-base-100 shadow-md hover:bg-base-200 transition duration-150">
    <div class="card-body">
      <div class="grid grid-cols-1 md:grid-cols-2 items-center gap-y-2">
        <div class="flex flex-col">
          <h3 class="card-title text-lg">Einnahmen</h3>
          <p class="text-2xl font-bold text-success">
            {{ formatCurrency(value) }}
          </p>
        </div>
        <div class="flex flex-col items-start md:items-end gap-1">
          <span class="text-xs opacity-70 mb-2">vs. Vorperiode</span>
          <span
            class="badge badge-soft badge-sm rounded-full border-0"
            :class="badgeClass"
            aria-label="Einnahmen-Trend"
          >
            <span v-if="percent !== null">{{ arrow }} {{ formatPercent(percent) }}</span>
            <span v-else>—</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
</style>
