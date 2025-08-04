<!-- src/components/budget/BudgetMonthHeaderCard.vue -->
<script setup lang="ts">
/**
 * Kopf‑Karte eines Budget‑Monats.
 * Utils‑Abhängigkeit (addCategoryTransfer) entfällt – es wird nun TransactionService genutzt.
 */
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useCategoryStore } from "../../stores/categoryStore";
import CategoryTransferModal from "../budget/CategoryTransferModal.vue";
import ConfirmationModal from "../ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";
import { TransactionService } from "@/services/TransactionService";
import { BudgetService } from "@/services/BudgetService";
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
/* ------------------- Budget-Aktions-Menü ------------------- */
/* ----------------------------------------------------------- */
const isBudgetMenuOpen = ref(false);
const budgetMenuButtonRef = ref<HTMLButtonElement | null>(null);
const budgetMenuRef = ref<HTMLUListElement | null>(null);
const budgetMenuStyle = ref({});

function openBudgetMenu() {
  if (!budgetMenuButtonRef.value) return;
  const rect = budgetMenuButtonRef.value.getBoundingClientRect();
  budgetMenuStyle.value = {
    position: "fixed",
    top: `${rect.bottom}px`,
    left: `${rect.right}px`,
    transform: "translateX(-100%)",
    zIndex: 5000,
  };
  isBudgetMenuOpen.value = true;
}

function closeBudgetMenu() {
  isBudgetMenuOpen.value = false;
}

function toggleBudgetMenu() {
  if (isBudgetMenuOpen.value) {
    closeBudgetMenu();
  } else {
    openBudgetMenu();
  }
}

function handleBudgetMenuClickOutside(event: MouseEvent) {
  if (
    (budgetMenuRef.value && budgetMenuRef.value.contains(event.target as Node)) ||
    (budgetMenuButtonRef.value &&
      budgetMenuButtonRef.value.contains(event.target as Node))
  ) {
    return;
  }
  closeBudgetMenu();
}

function handleBudgetAction(action: string) {
  debugLog("[BudgetMonthHeaderCard] Budget-Aktion ausgeführt", { action });
  // TODO: Implementierung der Budget-Aktionen
  switch (action) {
    case 'carry-surplus':
      console.log('Überschuss in Folgemonat übertragen');
      break;
    case 'show-template':
      console.log('Budget-Template anzeigen');
      break;
    case 'apply-template':
      console.log('Budget-Template anwenden');
      break;
    case 'overwrite-template':
      console.log('Mit Budget-Template überschreiben');
      break;
    case 'copy-last-month':
      console.log('Letztes Monatsbudget kopieren');
      break;
    case 'set-3month-average':
      console.log('3-Monats-Durchschnitt setzen');
      break;
    case 'reset-budget':
      handleResetBudget();
      break;
  }
  closeBudgetMenu();
}

function handleResetBudget() {
  if (!props.month) {
    console.warn('Kein Monat definiert für Budget-Reset');
    return;
  }

  showConfirmationModal.value = true;
}

async function confirmResetBudget() {
  if (!props.month) return;

  try {
    const deletedCount = await BudgetService.resetMonthBudget(props.month.start, props.month.end);
    console.log(`Budget zurückgesetzt: ${deletedCount} Kategorieumbuchungen gelöscht`);
    showConfirmationModal.value = false;
  } catch (error) {
    console.error('Fehler beim Zurücksetzen des Budgets:', error);
    showConfirmationModal.value = false;
  }
}

function cancelResetBudget() {
  showConfirmationModal.value = false;
}

onMounted(() => {
  document.addEventListener("click", handleBudgetMenuClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleBudgetMenuClickOutside);
});

/* ----------------------------------------------------------- */
/* --------------------- Transfer‑Modal ---------------------- */
/* ----------------------------------------------------------- */
const showTransferModal = ref(false);
const modalData = ref<{ mode: "header" } | null>({ mode: "header" });

/* ------------------- Confirmation Modal -------------------- */
/* ----------------------------------------------------------- */
const showConfirmationModal = ref(false);

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
        'p-2 text-center font-bold relative',
        isCurrentMonth
          ? 'border-b border-accent opacity-70 bg-accent/20'
          : 'border-b border-base-300',
      ]"
    >
      {{ props.label }}

      <!-- 3-Punkt-Menü Button -->
      <button
        ref="budgetMenuButtonRef"
        @click.stop="toggleBudgetMenu"
        class="btn btn-xs btn-ghost btn-circle absolute top-1 right-1 opacity-60 hover:opacity-100"
        title="Budget-Aktionen"
      >
        <Icon
          icon="mdi:dots-vertical"
          class="text-sm"
        />
      </button>
    </div>
    <div class="p-2 text-sm space-y-1 flex flex-col items-center">
      <div @contextmenu.prevent="openHeaderDropdown" class="cursor-pointer">
        <CurrencyDisplay :amount="props.available ?? 0" :as-integer="true" :show-zero="false" />
        verfügbare Mittel
      </div>
      <div>
        <CurrencyDisplay :amount="props.overspent ?? 0" :as-integer="true" :show-zero="false" /> Def./Übersch. Vormonat
      </div>
      <div>
        <CurrencyDisplay :amount="props.budgeted ?? 0" :as-integer="true" :show-zero="false" /> Budgetiert
      </div>
      <div>
        <CurrencyDisplay :amount="props.nextMonth ?? 0" :as-integer="true" :show-zero="false" /> Übertrag
      </div>
    </div>
  </div>
  <!-- Vier Symbole unter der Card -->
    <div class="pt-2 pb-1 pl-2 mr-[2.6%]">
      <div class="grid grid-cols-4 gap-1">
        <div class="flex justify-end">
          <Icon
            icon="mdi:envelope-outline"
            width="21"
            height="21"
            class="text-base-content/60 mr-5"
          />
        </div>
        <div class="flex justify-end">
          <Icon
            icon="mdi:target-arrow"
            width="21"
            height="21"
            class="text-base-content/60 mr-5"
          />
        </div>
        <div class="flex justify-end">
          <Icon
            icon="mdi:bank-transfer"
            width="22"
            height="22"
            class="text-base-content/60 mr-5"
          />
        </div>
        <div class="flex justify-end">
          <Icon
            icon="mdi:scale-balance"
            width="20"
            height="20"
            class="text-base-content/60 mr-5"
          />
        </div>
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

  <!-- Budget-Aktions-Menü -->
  <Teleport to="body">
    <ul
      v-if="isBudgetMenuOpen"
      ref="budgetMenuRef"
      :style="budgetMenuStyle"
      class="menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-64"
    >
      <!-- Überschrift -->
      <li class="menu-title">
        <span>Budget-Aktionen</span>
      </li>

      <!-- Überschuss in Folgemonat -->
      <li>
        <a @click="handleBudgetAction('carry-surplus')">
          <Icon
            icon="mdi:arrow-right-circle"
            class="text-lg"
          />
          Überschuss in Folgemonat
        </a>
      </li>

      <!-- Budget-Template anzeigen -->
      <li>
        <a @click="handleBudgetAction('show-template')">
          <Icon
            icon="mdi:eye"
            class="text-lg"
          />
          Zeige Budget-Template
        </a>
      </li>

      <!-- Budget-Template anwenden -->
      <li>
        <a @click="handleBudgetAction('apply-template')">
          <Icon
            icon="mdi:content-paste"
            class="text-lg"
          />
          Wende Budget-Template an
        </a>
      </li>

      <!-- Mit Budget-Template überschreiben -->
      <li>
        <a @click="handleBudgetAction('overwrite-template')">
          <Icon
            icon="mdi:file-replace"
            class="text-lg"
          />
          Überschreibe mit Budget-Template
        </a>
      </li>

      <li class="divider"></li>

      <!-- Letztes Monatsbudget kopieren -->
      <li>
        <a @click="handleBudgetAction('copy-last-month')">
          <Icon
            icon="mdi:content-copy"
            class="text-lg"
          />
          Kopiere letztes Monatsbudget
        </a>
      </li>

      <!-- 3-Monats-Durchschnitt setzen -->
      <li>
        <a @click="handleBudgetAction('set-3month-average')">
          <Icon
            icon="mdi:chart-line"
            class="text-lg"
          />
          Setze 3-Monats-Durchschnitt
        </a>
      </li>

      <li class="divider"></li>

      <!-- Budget auf 0 setzen -->
      <li>
        <a
          @click="handleBudgetAction('reset-budget')"
          class="text-warning"
        >
          <Icon
            icon="mdi:refresh"
            class="text-lg"
          />
          Setze Budget auf 0
        </a>
      </li>
    </ul>
  </Teleport>

  <!-- Transfer‑Modal -->
  <CategoryTransferModal
    v-if="showTransferModal"
    :is-open="showTransferModal"
    :month="props.month"
    mode="transfer"
    :category="availableCategory"
    @close="closeModal"
    @transfer="handleTransfer"
  />

  <!-- Confirmation Modal für Budget Reset -->
  <ConfirmationModal
    v-if="showConfirmationModal"
    title="Budget auf 0 setzen"
    message="Möchten Sie wirklich alle Kategorieumbuchungen dieses Monats löschen? Diese Aktion betrifft nur Ausgabenkategorien und kann nicht rückgängig gemacht werden.

Alle CATEGORYTRANSFER-Buchungen des Monats für Ausgabenkategorien werden unwiderruflich gelöscht. Buchungen von Einnahmekategorien zu 'Verfügbare Mittel' bleiben unberührt."
    confirm-text="Ja, Budget zurücksetzen"
    cancel-text="Abbrechen"
    @confirm="confirmResetBudget"
    @cancel="cancelResetBudget"
  />
</template>

<style scoped>
/* Keine zusätzlichen Styles benötigt */
</style>
