<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import { useCategoryStore } from "../../stores/categoryStore";
import { Category } from "../../types";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CategoryTransferModal from "./CategoryTransferModal.vue";
import { BudgetService } from "@/services/BudgetService";
import { toDateOnlyString } from "@/utils/formatters";
import { debugLog } from "@/utils/logger";

const props = defineProps<{
  month: { start: Date; end: Date; label: string };
}>();

const categoryStore = useCategoryStore();
const budgetService = BudgetService;

// Reaktive Kategorie „Verfügbare Mittel“
const availableFundsCategory = computed(() =>
  categoryStore.categories.find(
    (c) => c.name.trim().toLowerCase() === "verfügbare mittel"
  )
);
function isVerfuegbareMittel(cat: Category) {
  return availableFundsCategory.value?.id === cat.id;
}

// Normalisierte Zeitgrenzen
const normalizedMonthStart = computed(
  () => new Date(toDateOnlyString(props.month.start))
);
const normalizedMonthEnd = computed(
  () => new Date(toDateOnlyString(props.month.end))
);

// Hilfsfunktionen für Budget-Daten
function getAggregatedData(cat: Category) {
  return budgetService.getAggregatedMonthlyBudgetData(
    cat.id,
    normalizedMonthStart.value,
    normalizedMonthEnd.value
  );
}
function getSingleCategoryData(catId: string) {
  return budgetService.getAggregatedMonthlyBudgetData(
    catId,
    normalizedMonthStart.value,
    normalizedMonthEnd.value
  );
}

// Prüft, ob wir aktuell im selben Monat sind
const isCurrentMonth = computed(() => {
  const now = new Date();
  return (
    now.getFullYear() === normalizedMonthStart.value.getFullYear() &&
    now.getMonth() === normalizedMonthStart.value.getMonth()
  );
});

// Summen für Kopfzeilen
const sumExpensesSummary = computed(() =>
  budgetService.getMonthlySummary(
    normalizedMonthStart.value,
    normalizedMonthEnd.value,
    "expense"
  )
);
const sumIncomesSummary = computed(() =>
  budgetService.getMonthlySummary(
    normalizedMonthStart.value,
    normalizedMonthEnd.value,
    "income"
  )
);

// **NEU**: Reaktive Kategorie-Listen
const expenseCategories = computed(() =>
  categoryStore.categories.filter(
    (c) => c.isActive && !c.isIncomeCategory && !isVerfuegbareMittel(c)
  )
);
const incomeCategories = computed(() =>
  categoryStore.categories.filter(
    (c) => c.isActive && c.isIncomeCategory && !isVerfuegbareMittel(c)
  )
);

// Context-Dropdown
const showDropdown = ref(false);
const dropdownX = ref(0);
const dropdownY = ref(0);
const containerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

// Modal-State
const showTransferModal = ref(false);
const modalData = ref<{
  mode: "fill" | "transfer";
  clickedCategory: Category | null;
  amount: number;
} | null>(null);

function openDropdown(event: MouseEvent, cat: Category) {
  event.preventDefault();
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dropdownX.value = event.clientX - rect.left;
    dropdownY.value = event.clientY - rect.top;
  } else {
    dropdownX.value = event.clientX;
    dropdownY.value = event.clientY;
  }

  modalData.value = { mode: "transfer", clickedCategory: cat, amount: 0 };
  showDropdown.value = true;
  nextTick(() => dropdownRef.value?.focus());
  debugLog("[BudgetMonthCard] openDropdown", { category: cat });
}

function closeDropdown() {
  showDropdown.value = false;
}

function onDropdownBlur(e: FocusEvent) {
  const next = e.relatedTarget as HTMLElement | null;
  if (!dropdownRef.value?.contains(next)) {
    closeDropdown();
  }
}

function optionTransfer() {
  if (!modalData.value?.clickedCategory) return;
  const cat = modalData.value.clickedCategory;
  modalData.value = { mode: "transfer", clickedCategory: cat, amount: 0 };
  debugLog("[BudgetMonthCard] optionTransfer", { category: cat });
  closeDropdown();
  showTransferModal.value = true;
}

function optionFill() {
  if (!modalData.value?.clickedCategory) return;
  const cat = modalData.value.clickedCategory;
  const data = getAggregatedData(cat);
  const amt = data.saldo < 0 ? Math.abs(data.saldo) : 0;
  modalData.value = { mode: "fill", clickedCategory: cat, amount: amt };
  debugLog("[BudgetMonthCard] optionFill", { category: cat, amount: amt });
  closeDropdown();
  showTransferModal.value = true;
}

function executeTransfer(payload: {
  transactionId?: string;
  gegentransactionId?: string;
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  date: string;
  note: string;
}) {
  showTransferModal.value = false;
  debugLog("[BudgetMonthCard] executeTransfer", payload);
  // TODO: Persistiere hier über BudgetService oder Store
}
</script>

<template>
  <div class="flex w-full">
    <!-- Linker Zeitstrich -->
    <div class="p-1">
      <div
        class="w-px h-full"
        :class="
          isCurrentMonth
            ? 'bg-accent opacity-75 border-1 border-accent/75'
            : 'bg-base-300'
        "
      ></div>
    </div>

    <div class="flex-grow">
      <div
        ref="containerRef"
        class="relative w-full p-1 rounded-lg bg-base-100"
      >
        <!-- Tabellen-Header -->
        <div class="sticky top-0 bg-base-100 z-20 p-2 border-b border-base-300">
          <div class="grid grid-cols-4">
            <Icon
              icon="mdi:envelope-outline"
              width="21"
              height="21"
              class="justify-self-end"
            />
            <Icon
              icon="mdi:target-arrow"
              width="21"
              height="21"
              class="justify-self-end"
            />
            <Icon
              icon="mdi:bank-transfer"
              width="22"
              height="22"
              class="justify-self-end"
            />
            <Icon
              icon="mdi:scale-balance"
              width="20"
              height="20"
              class="justify-self-end"
            />
          </div>
        </div>

        <!-- Ausgaben-Summary -->
        <div class="p-2 font-bold border-b border-base-300 mt-2">
          <div class="grid grid-cols-4">
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumExpensesSummary.budgeted"
                :as-integer="true"
                class="text-sm"
              />
            </div>
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumExpensesSummary.forecast"
                :as-integer="true"
                :class="[
                  'text-sm',
                  sumExpensesSummary.forecast >= 0 ? 'text-base' : 'text-error',
                ]"
              />
            </div>
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumExpensesSummary.spentMiddle"
                :as-integer="true"
                :class="[
                  'text-sm',
                  sumExpensesSummary.spentMiddle >= 0
                    ? 'text-base'
                    : 'text-error',
                ]"
              />
            </div>
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumExpensesSummary.saldoFull"
                :as-integer="true"
                :class="[
                  'text-sm',
                  sumExpensesSummary.saldoFull >= 0
                    ? 'text-base'
                    : 'text-error',
                ]"
              />
            </div>
          </div>
        </div>

        <!-- Ausgabenkategorien -->
        <div class="grid grid-rows-auto">
          <template v-for="cat in expenseCategories" :key="cat.id">
            <div
              class="grid grid-cols-4 p-2 border-b border-base-200 cursor-context-menu hover:bg-base-200"
              @contextmenu="openDropdown($event, cat)"
            >
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).budgeted"
                  :as-integer="true"
                  class="text-sm"
                />
              </div>
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).forecast"
                  :as-integer="true"
                  :class="[
                    'text-sm',
                    getAggregatedData(cat).forecast >= 0
                      ? 'text-base'
                      : 'text-error',
                  ]"
                />
              </div>
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).spent"
                  :as-integer="true"
                  :class="[
                    'text-sm',
                    getAggregatedData(cat).spent >= 0
                      ? 'text-base'
                      : 'text-error',
                  ]"
                />
              </div>
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).saldo"
                  :as-integer="true"
                  :class="[
                    'text-sm',
                    getAggregatedData(cat).saldo >= 0
                      ? 'text-base'
                      : 'text-error',
                  ]"
                />
              </div>
            </div>

            <template v-if="categoryStore.expandedCategories.has(cat.id)">
              <div
                v-for="child in categoryStore
                  .getChildCategories(cat.id)
                  .filter((c) => c.isActive && !isVerfuegbareMittel(c))"
                :key="child.id"
                class="grid grid-cols-4 pl-6 text-sm p-2 border-b border-base-200 cursor-context-menu hover:bg-base-200/50"
                @contextmenu="openDropdown($event, child)"
              >
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).budgeted"
                    :as-integer="true"
                    class="text-sm"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).forecast"
                    :as-integer="true"
                    :class="[
                      'text-sm',
                      getSingleCategoryData(child.id).forecast >= 0
                        ? 'text-base'
                        : 'text-error',
                    ]"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).spent"
                    :as-integer="true"
                    :class="[
                      'text-sm',
                      getSingleCategoryData(child.id).spent >= 0
                        ? 'text-base'
                        : 'text-error',
                    ]"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).saldo"
                    :as-integer="true"
                    :class="[
                      'text-sm',
                      getSingleCategoryData(child.id).saldo >= 0
                        ? 'text-base'
                        : 'text-error',
                    ]"
                  />
                </div>
              </div>
            </template>
          </template>
        </div>

        <!-- Einnahmen-Summary -->
        <div class="p-2 font-bold border-b border-base-300 text-sm mt-4">
          <div class="grid grid-cols-4">
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumIncomesSummary.budgeted"
                :as-integer="true"
                class="text-sm text-success"
              />
            </div>
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumIncomesSummary.forecast"
                :as-integer="true"
                class="text-sm text-success"
              />
            </div>
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumIncomesSummary.spentMiddle"
                :as-integer="true"
                class="text-sm"
              />
            </div>
            <div class="text-right text-sm">
              <CurrencyDisplay
                :amount="sumIncomesSummary.saldoFull"
                :as-integer="true"
                class="text-sm"
              />
            </div>
          </div>
        </div>

        <!-- Einnahmen-Kategorien -->
        <div class="grid grid-rows-auto">
          <template v-for="cat in incomeCategories" :key="cat.id">
            <div class="grid grid-cols-4 p-2 border-b border-base-200 text-sm">
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).budgeted"
                  :as-integer="true"
                  class="text-sm text-success"
                />
              </div>
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).forecast"
                  :as-integer="true"
                  class="text-sm text-success"
                />
              </div>
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).spent"
                  :as-integer="true"
                  class="text-sm"
                />
              </div>
              <div class="text-right">
                <CurrencyDisplay
                  :amount="getAggregatedData(cat).saldo"
                  :as-integer="true"
                  class="text-sm"
                />
              </div>
            </div>

            <template v-if="categoryStore.expandedCategories.has(cat.id)">
              <div
                v-for="child in categoryStore
                  .getChildCategories(cat.id)
                  .filter((c) => c.isActive && !isVerfuegbareMittel(c))"
                :key="child.id"
                class="grid grid-cols-4 pl-6 text-sm p-2 border-b border-base-200"
              >
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).budgeted"
                    :as-integer="true"
                    class="text-sm text-success"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).forecast"
                    :as-integer="true"
                    class="text-sm text-success"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).spent"
                    :as-integer="true"
                    class="text-sm"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="getSingleCategoryData(child.id).saldo"
                    :as-integer="true"
                    class="text-sm"
                  />
                </div>
              </div>
            </template>
          </template>
        </div>

        <!-- Kontext-Dropdown -->
        <div
          v-if="showDropdown"
          ref="dropdownRef"
          tabindex="0"
          class="absolute z-40 w-48 bg-base-100 border border-base-300 rounded shadow p-2"
          :style="`left: ${dropdownX}px; top: ${dropdownY}px;`"
          @keydown.escape="closeDropdown"
          @blur="onDropdownBlur"
        >
          <ul>
            <li>
              <button class="btn btn-ghost btn-sm w-full" @click="optionFill">
                <Icon icon="mdi:arrow-collapse-right" />
                <span>Fülle auf von …</span>
              </button>
            </li>
            <li>
              <button
                class="btn btn-ghost btn-sm w-full"
                @click="optionTransfer"
              >
                <Icon icon="mdi:arrow-expand-right" />
                <span>Transferiere zu …</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- Transfer-Modal -->
  <CategoryTransferModal
    v-if="showTransferModal && modalData"
    :is-open="showTransferModal"
    :month="props.month"
    :mode="modalData.mode"
    :prefillAmount="modalData.amount"
    :preselectedCategoryId="modalData.clickedCategory?.id"
    @close="showTransferModal = false"
    @transfer="executeTransfer"
  />
</template>

<style scoped>
/* Keine zusätzlichen Styles notwendig */
</style>
