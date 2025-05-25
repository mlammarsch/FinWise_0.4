<!-- src/components/budget/BudgetMonthHeaderCard.vue -->
<script setup lang="ts">
/**
 * Kopf‑Karte eines Budget‑Monats.
 * Utils‑Abhängigkeit (addCategoryTransfer) entfällt – es wird nun TransactionService genutzt.
 */
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { ref, computed, nextTick } from "vue";
import { useCategoryStore } from "../../stores/categoryStore";
import CategoryTransferModal from "../budget/CategoryTransferModal.vue";
import { TransactionService } from "@/services/TransactionService";
import { debugLog } from "@/utils/logger";
import { toDateOnlyString } from "@/utils/formatters";

const props = defineProps<{
  label: string;
  toBudget: number;
  available?: number;
  overspent?: number;
  budgeted?: number;
  nextMonth?: number;
  month?: { start: Date; end: Date };
}>();

const categoryStore = useCategoryStore();

/* ----------------------------------------------------------- */
/* ------------------- Monats‑Hilfslogik --------------------- */
/* ----------------------------------------------------------- */
const isCurrentMonth = computed(() => {
  if (!props.month) return false;
  const now = new Date(toDateOnlyString(new Date()));
  const monthStart = new Date(toDateOnlyString(props.month.start));
  return (
    now.getFullYear() === monthStart.getFullYear() &&
    now.getMonth() === monthStart.getMonth()
  );
});

/* ----------------------------------------------------------- */
/* ---------------- Dropdown / Kontextmenü ------------------- */
/* ----------------------------------------------------------- */
const containerRef = ref<HTMLElement | null>(null);
const showHeaderDropdown = ref(false);
const headerDropdownX = ref(0);
const headerDropdownY = ref(0);
const headerDropdownRef = ref<HTMLElement | null>(null);

function openHeaderDropdown(event: MouseEvent) {
  event.preventDefault();
  const targetRect = (
    event.currentTarget as HTMLElement
  ).getBoundingClientRect();
  headerDropdownX.value = event.clientX - targetRect.left;
  headerDropdownY.value = event.clientY - targetRect.top;
  debugLog("[BudgetMonthHeaderCard] openHeaderDropdown", {
    x: headerDropdownX.value,
    y: headerDropdownY.value,
  });
  showHeaderDropdown.value = true;
  nextTick(() => headerDropdownRef.value?.focus());
}

function closeHeaderDropdown() {
  showHeaderDropdown.value = false;
}

function handleEscHeaderDropdown(event: KeyboardEvent) {
  if (event.key === "Escape") closeHeaderDropdown();
}

/* ----------------------------------------------------------- */
/* --------------------- Transfer‑Modal ---------------------- */
/* ----------------------------------------------------------- */
const showTransferModal = ref(false);
const modalData = ref<{ mode: "header" } | null>({ mode: "header" });

const availableCategory = computed(() =>
  categoryStore.categories.find(
    (cat) => cat.name.trim().toLowerCase() === "verfügbare mittel"
  )
);

function openHeaderTransfer() {
  modalData.value = { mode: "header" };
  showTransferModal.value = true;
  closeHeaderDropdown();
}

function closeModal() {
  showTransferModal.value = false;
}

function handleTransfer(data: {
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  date: string;
  note: string;
}) {
  TransactionService.addCategoryTransfer(
    data.fromCategoryId,
    data.toCategoryId,
    data.amount,
    data.date,
    data.note
  );
  closeModal();
}
</script>

<template>
  <!-- (Template unverändert) -->
  <div
    ref="containerRef"
    :class="[
      'relative min-w-[12rem] border border-accent/50 rounded-lg shadow-md sticky top-0 z-10 m-2',
      isCurrentMonth
        ? 'border border-none outline-accent/75 outline-double outline-2 outline-offset-2'
        : 'border border-base-300',
    ]"
  >
    <div
      :class="[
        'p-2 text-center font-bold',
        isCurrentMonth
          ? 'border-b border-accent opacity-70 bg-accent/20'
          : 'border-b border-base-300',
      ]"
    >
      {{ props.label }}
    </div>
    <div class="p-2 text-sm space-y-1 flex flex-col items-center">
      <div @contextmenu.prevent="openHeaderDropdown" class="cursor-pointer">
        <CurrencyDisplay :amount="props.available ?? 0" :as-integer="true" />
        verfügbare Mittel
      </div>
      <div>-{{ props.overspent ?? 0 }} Overspent in prev</div>
      <div>-{{ props.budgeted ?? 0 }} Budgeted</div>
      <div>-{{ props.nextMonth ?? 0 }} For next month</div>
    </div>
  </div>

  <!-- Kontext‑Dropdown -->
  <div
    v-if="showHeaderDropdown"
    ref="headerDropdownRef"
    class="absolute z-40 w-40 bg-base-100 border border-base-300 rounded shadow p-2"
    :style="{ left: `${headerDropdownX}px`, top: `${headerDropdownY}px` }"
    tabindex="0"
    @keydown.escape="closeHeaderDropdown"
    @click.outside="closeHeaderDropdown"
  >
    <ul>
      <li>
        <button class="btn btn-ghost btn-sm w-full" @click="openHeaderTransfer">
          Transfer zu…
        </button>
      </li>
    </ul>
  </div>

  <!-- Transfer‑Modal -->
  <CategoryTransferModal
    v-if="showTransferModal"
    :is-open="showTransferModal"
    :month="props.month"
    mode="header"
    :category="availableCategory"
    @close="closeModal"
    @transfer="handleTransfer"
  />
</template>

<style scoped>
/* Keine zusätzlichen Styles benötigt */
</style>
