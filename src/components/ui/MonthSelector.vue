<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useTransactionFilterStore } from "@/stores/transactionFilterStore";
import { debugLog } from "@/utils/logger";

const emit = defineEmits<{
  (e: "update-daterange", payload: { start: string; end: string }): void;
}>();

const currentMonth = ref(
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
);

const formattedMonthYear = computed(() =>
  currentMonth.value.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
  })
);

// Hilfsfunktion für saubere YYYY-MM-DD-Ausgabe
function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

// Start- und Enddatum aus Jahr/Monat
const startDate = computed(() => {
  const y = currentMonth.value.getFullYear();
  const m = currentMonth.value.getMonth();
  return toDateString(y, m, 1);
});

const endDate = computed(() => {
  const y = currentMonth.value.getFullYear();
  const m = currentMonth.value.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return toDateString(y, m, lastDay);
});

watch(
  currentMonth,
  () => {
    const payload = { start: startDate.value, end: endDate.value };
    debugLog("[MonthSelector] update-daterange", payload);
    emit("update-daterange", payload);
  },
  { immediate: true }
);

function previousMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() - 1,
    1
  );
  debugLog("[MonthSelector] previousMonth", currentMonth.value);
}

function nextMonth() {
  currentMonth.value = new Date(
    currentMonth.value.getFullYear(),
    currentMonth.value.getMonth() + 1,
    1
  );
  debugLog("[MonthSelector] nextMonth", currentMonth.value);
}
</script>

<template>
  <div class="join">
    <button
      class="btn join-item rounded-l-full btn-sm btn-soft border border-base-300 w-10"
      @click="previousMonth"
    >
      <Icon icon="mdi:chevron-left" class="text-lg" />
    </button>
    <button
      class="btn join-item btn-sm bg-base-100 border border-base-300 text-neutral w-30"
    >
      {{ formattedMonthYear }}
    </button>
    <button
      class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300 w-10"
      @click="nextMonth"
    >
      <Icon icon="mdi:chevron-right" class="text-lg" />
    </button>
  </div>
</template>
