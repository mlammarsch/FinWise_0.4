<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';
import { CategoryService } from '../../services/CategoryService';
import { useCategoryStore } from '../../stores/categoryStore';
import { useTransactionStore } from '../../stores/transactionStore';
import { usePlanningStore } from '../../stores/planningStore';
import type { CategoryGroup, Category } from '../../types';
import { debugLog, errorLog, infoLog } from '../../utils/logger';
import CurrencyDisplay from '../ui/CurrencyDisplay.vue';
import CalculatorInput from '../ui/CalculatorInput.vue';
import { BudgetService } from '../../services/BudgetService';
import { optimizedBudgetService } from '../../services/OptimizedBudgetService';
import { BalanceService } from '../../services/BalanceService';
import { toDateOnlyString } from '../../utils/formatters';
import CategoryTransferModal from './CategoryTransferModal.vue';
import CategoryTransactionModal from './CategoryTransactionModal.vue';
import CategoryPlanningModal from './CategoryPlanningModal.vue';
import { TransactionService } from '../../services/TransactionService';

// Props für Monate
interface Props {
  months?: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
  }>;
}

const props = withDefaults(defineProps<Props>(), {
  months: () => []
});

// Emit für Loading-Status
const emit = defineEmits<{
  muuriReady: []
}>();

// Store-Initialisierung - muss vor der Verwendung stehen
const categoryStore = useCategoryStore();

// Interface für Budget-Daten
interface MonthlyBudgetData {
  budgeted: number;
  forecast: number;
  spent: number;
  saldo: number;
}

// Berechnungsfunktionen für echte Budget-Daten
// Cache für einzelne Kategorie-Budget-Daten
const categoryBudgetCache = ref(new Map<string, MonthlyBudgetData>());

// Reaktiver Trigger für UI-Updates - wird bei Cache-Invalidierung erhöht
const cacheInvalidationCounter = ref(0);

// Hauptfunktion - synchron für Kompatibilität, aber mit optimiertem Backend
function getCategoryBudgetData(categoryId: string, month: { start: Date; end: Date }): MonthlyBudgetData {
  const normalizedStart = new Date(toDateOnlyString(month.start));
  const normalizedEnd = new Date(toDateOnlyString(month.end));

  const cacheKey = `${categoryId}-${toDateOnlyString(normalizedStart)}-${toDateOnlyString(normalizedEnd)}`;

  // Prüfe Cache - WICHTIG: Reaktive Abhängigkeit hier für Cache-Invalidierung
  // Verwende den Cache nur wenn er existiert UND der Counter sich nicht geändert hat
  const cachedData = categoryBudgetCache.value.get(cacheKey);
  if (cachedData && cacheInvalidationCounter.value >= 0) {
    // Für UI-Reaktivität: Immer neu berechnen wenn sich Transaktionen geändert haben
    const freshResult = BudgetService.getSingleCategoryMonthlyBudgetData(categoryId, normalizedStart, normalizedEnd);

    // Vergleiche ob sich die Werte geändert haben
    if (Math.abs(cachedData.budgeted - freshResult.budgeted) < 0.01 &&
        Math.abs(cachedData.spent - freshResult.spent) < 0.01 &&
        Math.abs(cachedData.saldo - freshResult.saldo) < 0.01) {
      return cachedData; // Cache ist noch aktuell
    }

    // Cache ist veraltet, aktualisiere ihn
    categoryBudgetCache.value.set(cacheKey, freshResult);
    return freshResult;
  }

  // KRITISCH: Verwende getSingleCategoryMonthlyBudgetData statt getAggregatedMonthlyBudgetData
  // getAggregated summiert Unterkategorien, getSingle berechnet nur die einzelne Kategorie
  const result = BudgetService.getSingleCategoryMonthlyBudgetData(categoryId, normalizedStart, normalizedEnd);

  // Cache das Ergebnis
  categoryBudgetCache.value.set(cacheKey, result);

  // Starte asynchrone Optimierung im Hintergrund
  preloadOptimizedData(categoryId, normalizedStart, normalizedEnd, cacheKey);

  return result;
}

// Asynchrone Vorab-Optimierung im Hintergrund
async function preloadOptimizedData(categoryId: string, monthStart: Date, monthEnd: Date, cacheKey: string) {
  try {
    const optimizedResult = await optimizedBudgetService.getOptimizedBudgetData(categoryId, monthStart, monthEnd);

    const budgetData: MonthlyBudgetData = {
      budgeted: optimizedResult.budgeted,
      forecast: optimizedResult.forecast,
      spent: optimizedResult.spent,
      saldo: optimizedResult.saldo
    };

    // Aktualisiere Cache mit optimiertem Ergebnis
    categoryBudgetCache.value.set(cacheKey, budgetData);
  } catch (error) {
    // Ignoriere Fehler bei Background-Optimierung
    console.debug(`Background optimization failed for ${categoryId}:`, error);
  }
}

function calculateGroupSummary(groupId: string, month: { start: Date; end: Date }) {
  const categories = getCategoriesForGroup(groupId);
  const summary = {
    budgeted: 0,
    forecast: 0,
    spent: 0,
    saldo: 0
  };

  // Reaktive Abhängigkeit durch getCategoryBudgetData - kein separater Zugriff nötig
  categories.forEach(category => {
    const data = getCategoryBudgetData(category.id, month);
    summary.budgeted += data.budgeted;
    summary.forecast += data.forecast;
    summary.spent += data.spent;
    summary.saldo += data.saldo;
  });

  return summary;
}

// Optimierter asynchroner Cache für Type-Summaries
const typeSummaryCache = ref(new Map<string, any>());
const isLoadingTypeSummary = ref(false);

// Reaktive Abhängigkeiten für Cache-Invalidierung
const cacheInvalidationTrigger = computed(() => {
  const transactionStore = useTransactionStore();
  const planningStore = usePlanningStore();

  return [
    transactionStore.transactions.length,
    planningStore.planningTransactions.length,
    categoryStore.categories.length,
    // Vereinfachter Hash nur der IDs
    transactionStore.transactions.map(t => t.id).join(',').slice(0, 100), // Begrenzt für Performance
    planningStore.planningTransactions.map(p => p.id).join(',').slice(0, 100)
  ].join('|');
});

// Asynchrone Berechnung der Type-Summaries
async function updateTypeSummaryCache() {
  if (isLoadingTypeSummary.value) return;

  isLoadingTypeSummary.value = true;
  const newCache = new Map<string, any>();

  try {
    // Batch-Requests für alle Monate und Typen erstellen
    const batchRequests: Array<{
      categoryIds: string[];
      monthStart: Date;
      monthEnd: Date;
      type: 'expense' | 'income';
      cacheKey: string;
    }> = [];

    props.months.forEach((month: { key: string; start: Date; end: Date }) => {
      const normalizedStart = new Date(toDateOnlyString(month.start));
      const normalizedEnd = new Date(toDateOnlyString(month.end));

      // Expense-Kategorien
      const expenseCategories = categoryStore.categories
        .filter(cat => !cat.isIncomeCategory)
        .map(cat => cat.id);

      batchRequests.push({
        categoryIds: expenseCategories,
        monthStart: normalizedStart,
        monthEnd: normalizedEnd,
        type: 'expense',
        cacheKey: `expense-${month.key}`
      });

      // Income-Kategorien
      const incomeCategories = categoryStore.categories
        .filter(cat => cat.isIncomeCategory)
        .map(cat => cat.id);

      batchRequests.push({
        categoryIds: incomeCategories,
        monthStart: normalizedStart,
        monthEnd: normalizedEnd,
        type: 'income',
        cacheKey: `income-${month.key}`
      });
    });

    // Verarbeite Requests in kleineren Batches für bessere Performance
    const BATCH_SIZE = 4;
    for (let i = 0; i < batchRequests.length; i += BATCH_SIZE) {
      const batch = batchRequests.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (request) => {
        try {
          const result = await optimizedBudgetService.calculateTypeSummary(
            request.categoryIds,
            request.monthStart,
            request.monthEnd,
            request.type
          );

          newCache.set(request.cacheKey, {
            budgeted: result.summary.budgeted,
            forecast: result.summary.forecast,
            spent: result.summary.spentMiddle,
            saldo: result.summary.saldoFull
          });
        } catch (error) {
          // Fallback auf alten Service bei Fehlern
          console.warn(`Fallback to old service for ${request.cacheKey}:`, error);
          const fallbackSummary = BudgetService.getMonthlySummary(
            request.monthStart,
            request.monthEnd,
            request.type
          );
          newCache.set(request.cacheKey, {
            budgeted: fallbackSummary.budgeted,
            forecast: fallbackSummary.forecast,
            spent: fallbackSummary.spentMiddle,
            saldo: fallbackSummary.saldoFull
          });
        }
      }));

      // Kurze Pause zwischen Batches für UI-Responsiveness
      if (i + BATCH_SIZE < batchRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    typeSummaryCache.value = newCache;
  } catch (error) {
    errorLog('[BudgetCategoriesAndValues]', 'Failed to update type summary cache', error);
  } finally {
    isLoadingTypeSummary.value = false;
  }
}

// Watcher für Cache-Invalidierung mit Debouncing für bessere Performance
let cacheInvalidationTimer: NodeJS.Timeout | null = null;
const CACHE_INVALIDATION_DEBOUNCE = 500; // 500ms Debounce

watch(cacheInvalidationTrigger, () => {
  // Debounce Cache-Invalidierung um excessive Updates zu vermeiden
  if (cacheInvalidationTimer) {
    clearTimeout(cacheInvalidationTimer);
  }

  cacheInvalidationTimer = setTimeout(() => {
    // Invalidiere beide Caches
    categoryBudgetCache.value.clear();
    updateTypeSummaryCache();

    // KRITISCH: Erhöhe Counter für UI-Reaktivität
    cacheInvalidationCounter.value++;
    debugLog('BudgetCategoriesAndValues', `Cache invalidated, UI trigger updated: ${cacheInvalidationCounter.value}`);
  }, CACHE_INVALIDATION_DEBOUNCE);
}, { immediate: true });

// Watcher für Props-Änderungen
watch(() => props.months, () => {
  categoryBudgetCache.value.clear();
  updateTypeSummaryCache();

  // KRITISCH: Erhöhe Counter für UI-Reaktivität
  cacheInvalidationCounter.value++;
  debugLog('BudgetCategoriesAndValues', `Props changed, UI trigger updated: ${cacheInvalidationCounter.value}`);
}, { deep: true });

function calculateTypeSummary(isIncomeType: boolean, month: { key?: string; start: Date; end: Date }) {
  const key = `${isIncomeType ? 'income' : 'expense'}-${month.key || toDateOnlyString(month.start)}`;

  // Reaktive Abhängigkeit durch typeSummaryCache und cacheInvalidationCounter
  const result = typeSummaryCache.value.get(key) || {
    budgeted: 0,
    forecast: 0,
    spent: 0,
    saldo: 0
  };

  // Trigger reaktive Abhängigkeit für Cache-Invalidierung
  if (cacheInvalidationCounter.value >= 0) {
    return result;
  }

  return result;
}

// Drag Container
const dragContainer = ref<HTMLElement>();

// Separate Meta-Grids für Ausgaben und Einnahmen
const expenseMetaGrid = ref<Muuri | null>(null);
const incomeMetaGrid = ref<Muuri | null>(null);

// Separate Sub-Grids für Kategorien
const expenseSubGrids = ref<Muuri[]>([]);
const incomeSubGrids = ref<Muuri[]>([]);

// Reale Daten aus CategoryService
const categoryGroups = CategoryService.getCategoryGroups();
const categoriesByGroup = CategoryService.getCategoriesByGroup();

// CategoryStore bereits oben initialisiert

// Reaktive Kategorie „Verfügbare Mittel"
const availableFundsCategory = computed(() =>
  categoryStore.categories.find(
    (c) => c.name.trim().toLowerCase() === "verfügbare mittel"
  )
);
function isVerfuegbareMittel(cat: Category) {
  return availableFundsCategory.value?.id === cat.id;
}

// Berechnet den aktuellen Saldo einer Kategorie basierend auf allen Transaktionen
const getCategoryBalance = (categoryId: string): number => {
  return BalanceService.getTodayBalance("category", categoryId);
};

// Berechnet den Progress-Wert für Sparziele (Saldo / Sparziel * 100, max. 100)
const getSavingsGoalProgress = (category: Category): number => {
  if (!category.isSavingsGoal || !category.targetAmount || category.targetAmount <= 0) {
    return 0;
  }

  const currentBalance = getCategoryBalance(category.id);
  const progress = (currentBalance / category.targetAmount) * 100;

  // Ergebnis kann nie höher als 100 sein
  return Math.min(Math.max(progress, 0), 100);
};

// Context-Dropdown
const showDropdown = ref(false);
const dropdownX = ref(0);
const dropdownY = ref(0);
const dropdownRef = ref<HTMLElement | null>(null);

// Modal-State
const showTransferModal = ref(false);
const modalData = ref<{
  mode: "fill" | "transfer";
  clickedCategory: Category | null;
  amount: number;
  month: { start: Date; end: Date } | null;
} | null>(null);

// Transaction Modal State
const showTransactionModal = ref(false);
const transactionModalData = ref<{
  categoryId: string;
  month: {
    key: string;
    label: string;
    start: Date;
    end: Date;
  };
} | null>(null);

// Planning Modal State
const showPlanningModal = ref(false);
const planningModalData = ref<{
  categoryId: string;
  month: {
    key: string;
    label: string;
    start: Date;
    end: Date;
  };
} | null>(null);

// Editable Budget State
const activeEditField = ref<string | null>(null); // Format: "categoryId-monthKey"
const processingBudgetUpdate = ref<Set<string>>(new Set()); // Verhindert doppelte Updates

// Debounced Budget Update Queue
const budgetUpdateQueue = ref<Map<string, {
  categoryId: string;
  monthKey: string;
  newValue: number;
  timestamp: number;
}>>(new Map());
const budgetUpdateTimer = ref<NodeJS.Timeout | null>(null);
const BUDGET_UPDATE_DEBOUNCE_DELAY = 1500; // Erhöht von 500ms auf 1500ms für bessere Performance

// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref<NodeJS.Timeout | null>(null);

// Debouncing für Sort Order Updates
const sortOrderUpdateTimer = ref<NodeJS.Timeout | null>(null);
const SORT_ORDER_DEBOUNCE_DELAY = 1000; // Erhöht von 500ms auf 1000ms für bessere Performance

// Getrennte Lebensbereiche nach Typ
const expenseGroups = computed(() => {
  const groups = categoryGroups.value.filter(g => !g.isIncomeGroup);
  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
});

const incomeGroups = computed(() => {
  const groups = categoryGroups.value.filter(g => g.isIncomeGroup);
  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
});

// Icon-Mapping für Lebensbereiche
function getGroupIcon(group: CategoryGroup): string {
  return 'mdi:folder-outline';
}

function getGroupColor(group: CategoryGroup): string {
  return 'text-base-content';
}

// Kategorien für eine Gruppe (sortiert nach sortOrder)
function getCategoriesForGroup(groupId: string): Category[] {
  const categories = categoriesByGroup.value[groupId] || [];
  return categories
    .slice()
    .sort((a: Category, b: Category) => a.sortOrder - b.sortOrder);
}

// Kategorien für eine Gruppe gefiltert nach Sichtbarkeit (für die Anzeige)
function getVisibleCategoriesForGroup(groupId: string): Category[] {
  const categories = getCategoriesForGroup(groupId);
  if (categoryStore.showHiddenCategories) {
    return categories; // Alle Kategorien anzeigen
  }
  return categories.filter(category => !category.isHidden); // Versteckte Kategorien ausblenden
}

// Editable Budget Functions
function isEditingBudget(categoryId: string, monthKey: string): boolean {
  const result = activeEditField.value === `${categoryId}-${monthKey}`;
  return result;
}

// Debounced Budget Update Queue Verarbeitung
async function processBudgetUpdateQueue() {
  if (budgetUpdateQueue.value.size === 0) return;

  debugLog('BudgetCategoriesAndValues', `Verarbeite ${budgetUpdateQueue.value.size} Budget-Updates in Batch`);

  const updates = Array.from(budgetUpdateQueue.value.values());
  const transfers: Array<{
    fromCategoryId: string;
    toCategoryId: string;
    amount: number;
    date: string;
    note: string;
  }> = [];

  // Finde die "Verfügbare Mittel" Kategorie
  const availableFunds = availableFundsCategory.value;
  if (!availableFunds) {
    errorLog('BudgetCategoriesAndValues', 'Kategorie "Verfügbare Mittel" nicht gefunden');
    budgetUpdateQueue.value.clear();
    return;
  }

  // Verarbeite alle Updates und sammle Transfers
  for (const update of updates) {
    try {
      // Finde den entsprechenden Monat
      const targetMonth = props.months.find(month => month.key === update.monthKey);
      if (!targetMonth) {
        errorLog('BudgetCategoriesAndValues', `Monat mit Key ${update.monthKey} nicht gefunden`);
        continue;
      }

      // Berechne den aktuellen Budgetwert
      const currentBudgetData = BudgetService.getSingleCategoryMonthlyBudgetData(
        update.categoryId,
        targetMonth.start,
        targetMonth.end
      );
      const currentBudgetValue = currentBudgetData.budgeted;
      const difference = update.newValue - currentBudgetValue;

      if (Math.abs(difference) < 0.01) {
        debugLog('BudgetCategoriesAndValues', `Keine Änderung erforderlich für ${update.categoryId}-${update.monthKey}`);
        continue;
      }

      const transferDate = toDateOnlyString(targetMonth.start);
      const transferNote = `Budget-Anpassung für ${update.monthKey}`;

      if (difference < 0) {
        // Transfer von Kategorie zu "Verfügbare Mittel"
        transfers.push({
          fromCategoryId: update.categoryId,
          toCategoryId: availableFunds.id,
          amount: Math.abs(difference),
          date: transferDate,
          note: transferNote
        });
      } else {
        // Transfer von "Verfügbare Mittel" zu Kategorie
        transfers.push({
          fromCategoryId: availableFunds.id,
          toCategoryId: update.categoryId,
          amount: difference,
          date: transferDate,
          note: transferNote
        });
      }

      debugLog('BudgetCategoriesAndValues', `Transfer geplant: ${Math.abs(difference)}€ für ${update.categoryId}-${update.monthKey}`);
    } catch (error) {
      errorLog('BudgetCategoriesAndValues', `Fehler bei Budget-Update für ${update.categoryId}-${update.monthKey}`, error);
    }
  }

  // Bulk-Erstellung aller Transfers
  if (transfers.length > 0) {
    try {
      debugLog('BudgetCategoriesAndValues', `Erstelle ${transfers.length} Budget-Transfers in Bulk-Operation`);
      await TransactionService.addMultipleCategoryTransfers(transfers);
      infoLog('BudgetCategoriesAndValues', `Batch Budget-Update abgeschlossen: ${transfers.length} Transfers erstellt`);
    } catch (error) {
      errorLog('BudgetCategoriesAndValues', 'Fehler bei Bulk-Budget-Update', error);

      // Fallback: Einzelne Transfers
      debugLog('BudgetCategoriesAndValues', 'Fallback auf einzelne Budget-Transfers');
      for (const transfer of transfers) {
        try {
          await TransactionService.addCategoryTransfer(
            transfer.fromCategoryId,
            transfer.toCategoryId,
            transfer.amount,
            transfer.date,
            transfer.note
          );
        } catch (singleError) {
          errorLog('BudgetCategoriesAndValues', `Fehler beim einzelnen Budget-Transfer`, singleError);
        }
      }
    }
  }

  // Queue leeren
  budgetUpdateQueue.value.clear();
}

// Handler für CalculatorInput - sammelt Updates in Queue
function handleBudgetUpdate(categoryId: string, monthKey: string, newValue: number) {
  const updateKey = `${categoryId}-${monthKey}`;
  debugLog('BudgetCategoriesAndValues', `Budget update queued: ${updateKey} = ${newValue}`);

  // Update in Queue einreihen (überschreibt vorherige Updates für dasselbe Feld)
  budgetUpdateQueue.value.set(updateKey, {
    categoryId,
    monthKey,
    newValue,
    timestamp: Date.now()
  });

  // Debounced Timer zurücksetzen
  if (budgetUpdateTimer.value) {
    clearTimeout(budgetUpdateTimer.value);
  }

  budgetUpdateTimer.value = setTimeout(() => {
    processBudgetUpdateQueue();
  }, BUDGET_UPDATE_DEBOUNCE_DELAY);
}

function handleBudgetFinish(categoryId: string, monthKey: string) {
  const fieldKey = `${categoryId}-${monthKey}`;
  if (activeEditField.value === fieldKey) {
    activeEditField.value = null;
  }
}

function handleBudgetClick(categoryId: string, monthKey: string) {
  debugLog('BudgetCategoriesAndValues', `handleBudgetClick called for category ${categoryId}, month ${monthKey}`);

  if (!isEditingBudget(categoryId, monthKey)) {
    debugLog('BudgetCategoriesAndValues', 'Not currently editing, starting edit mode');
    activeEditField.value = `${categoryId}-${monthKey}`;
    debugLog('BudgetCategoriesAndValues', `activeEditField set to: ${activeEditField.value}`);
  } else {
    debugLog('BudgetCategoriesAndValues', 'Already editing this field');
  }
}

function handleFocusNext(categoryId: string, monthKey: string) {
  debugLog('BudgetCategoriesAndValues', `handleFocusNext called for category ${categoryId}, month ${monthKey}`);

  // Erst das Budget-Update durchführen (wird bereits durch CalculatorInput gemacht)
  // Dann zum nächsten Feld navigieren
  const nextField = findNextBudgetField(categoryId, monthKey);
  if (nextField) {
    debugLog('BudgetCategoriesAndValues', `Focusing next field: ${nextField.categoryId}-${nextField.monthKey}`);
    activeEditField.value = `${nextField.categoryId}-${nextField.monthKey}`;
  } else {
    debugLog('BudgetCategoriesAndValues', 'No next field found, removing focus');
    activeEditField.value = null;
  }
}

function handleFocusPrevious(categoryId: string, monthKey: string) {
  debugLog('BudgetCategoriesAndValues', `handleFocusPrevious called for category ${categoryId}, month ${monthKey}`);

  // Erst das Budget-Update durchführen (wird bereits durch CalculatorInput gemacht)
  // Dann zum vorherigen Feld navigieren
  const previousField = findPreviousBudgetField(categoryId, monthKey);
  if (previousField) {
    debugLog('BudgetCategoriesAndValues', `Focusing previous field: ${previousField.categoryId}-${previousField.monthKey}`);
    activeEditField.value = `${previousField.categoryId}-${previousField.monthKey}`;
  } else {
    debugLog('BudgetCategoriesAndValues', 'No previous field found, removing focus');
    activeEditField.value = null;
  }
}

// Hilfsfunktionen für die Navigation zwischen Budget-Feldern
function findNextBudgetField(currentCategoryId: string, currentMonthKey: string): { categoryId: string; monthKey: string } | null {
  // Erstelle eine Liste aller editierbaren Kategorien im gleichen Monat
  const editableCategories: string[] = [];

  // Durchlaufe alle Gruppen (Ausgaben zuerst, dann Einnahmen)
  const allGroups = [...expenseGroups.value, ...incomeGroups.value];

  allGroups.forEach(group => {
    // Nur erweiterte Gruppen berücksichtigen
    if (categoryStore.expandedCategoryGroups.has(group.id)) {
      const categories = getCategoriesForGroup(group.id);
      categories.forEach(category => {
        // Nur für Ausgaben-Kategorien sind Budget-Felder editierbar
        if (!category.isIncomeCategory) {
          editableCategories.push(category.id);
        }
      });
    }
  });

  // Finde den Index der aktuellen Kategorie
  const currentIndex = editableCategories.findIndex(categoryId => categoryId === currentCategoryId);

  // Wenn aktuelle Kategorie gefunden und es gibt eine nächste Kategorie
  if (currentIndex >= 0 && currentIndex < editableCategories.length - 1) {
    return {
      categoryId: editableCategories[currentIndex + 1],
      monthKey: currentMonthKey // Bleibe im gleichen Monat
    };
  }

  // Kein nächstes Feld gefunden
  return null;
}

function findPreviousBudgetField(currentCategoryId: string, currentMonthKey: string): { categoryId: string; monthKey: string } | null {
  // Erstelle eine Liste aller editierbaren Kategorien im gleichen Monat
  const editableCategories: string[] = [];

  // Durchlaufe alle Gruppen (Ausgaben zuerst, dann Einnahmen)
  const allGroups = [...expenseGroups.value, ...incomeGroups.value];

  allGroups.forEach(group => {
    // Nur erweiterte Gruppen berücksichtigen
    if (categoryStore.expandedCategoryGroups.has(group.id)) {
      const categories = getCategoriesForGroup(group.id);
      categories.forEach(category => {
        // Nur für Ausgaben-Kategorien sind Budget-Felder editierbar
        if (!category.isIncomeCategory) {
          editableCategories.push(category.id);
        }
      });
    }
  });

  // Finde den Index der aktuellen Kategorie
  const currentIndex = editableCategories.findIndex(categoryId => categoryId === currentCategoryId);

  // Wenn aktuelle Kategorie gefunden und es gibt eine vorherige Kategorie
  if (currentIndex > 0) {
    return {
      categoryId: editableCategories[currentIndex - 1],
      monthKey: currentMonthKey // Bleibe im gleichen Monat
    };
  }

  // Kein vorheriges Feld gefunden
  return null;
}

// Outside click handler (nicht mehr benötigt, da CalculatorInput eigenes Outside-Click-Handling hat)

// Outside click handler (nicht mehr benötigt, da CalculatorInput eigenes Outside-Click-Handling hat)
function handleOutsideClick(event: Event) {
  // Leer lassen - CalculatorInput handhabt Outside-Clicks selbst
}

onMounted(async () => {
  // Add outside click listener
  document.addEventListener('click', handleOutsideClick);
  debugLog('BudgetCategoriesAndValues', 'Component mounted, starting initialization');
  debugLog('BudgetCategoriesAndValues', 'Calling CategoryService.loadCategories()');
  await CategoryService.loadCategories();
  debugLog('BudgetCategoriesAndValues', 'CategoryService.loadCategories() completed successfully');

  // Batch-Expansion aller Gruppen über CategoryService
  const groupsToExpand = categoryGroups.value
    .filter(group => !categoryStore.expandedCategoryGroups.has(group.id))
    .map(group => group.id);

  if (groupsToExpand.length > 0) {
    debugLog('BudgetCategoriesAndValues', `Expanding ${groupsToExpand.length} category groups`);
    CategoryService.expandCategoryGroupsBatch(groupsToExpand);
  }

  await nextTick();
  debugLog('BudgetCategoriesAndValues', 'Starting Muuri grid initialization');

  // Muuri-Initialisierung mit mehreren requestAnimationFrame für bessere Animation-Performance
  requestAnimationFrame(() => {
    debugLog('BudgetCategoriesAndValues', 'First animation frame - allowing spinner to animate');
    requestAnimationFrame(() => {
      debugLog('BudgetCategoriesAndValues', 'Second animation frame - calling initializeGrids');
      initializeGrids();
    });
  });
});

onUnmounted(() => {
  destroyGrids();
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }
  if (autoExpandTimer.value) {
    clearTimeout(autoExpandTimer.value);
  }
  if (budgetUpdateTimer.value) {
    clearTimeout(budgetUpdateTimer.value);
    // Verarbeite noch ausstehende Budget-Updates vor dem Unmount
    processBudgetUpdateQueue();
  }
  // Remove outside click listener
  document.removeEventListener('click', handleOutsideClick);
});

// Watcher für globale Expand/Collapse-Änderungen
watch(() => categoryStore.expandedCategoryGroups, () => {
  nextTick(() => {
    updateLayoutAfterToggle();
  });
}, { deep: true });

// Watcher für showHiddenCategories-Änderungen
watch(() => categoryStore.showHiddenCategories, async () => {
  debugLog('BudgetCategoriesAndValues', 'showHiddenCategories changed, destroying and recreating grids');

  // Grids komplett zerstören
  destroyGrids();

  // Kurz warten für DOM-Updates
  await nextTick();

  // Grids komplett neu initialisieren
  setTimeout(() => {
    initializeGrids();
  }, 100); // Kurze Verzögerung für DOM-Updates
});

// Watcher für Änderungen der months-Props (PagingYearComponent, Spaltenanzahl)
watch(() => props.months, async (newMonths, oldMonths) => {
  if (!newMonths || newMonths.length === 0) return;

  // Prüfe ob sich die Monate tatsächlich geändert haben
  const monthsChanged = !oldMonths ||
    newMonths.length !== oldMonths.length ||
    newMonths.some((month, index) =>
      !oldMonths[index] || month.key !== oldMonths[index].key
    );

  if (monthsChanged) {
    debugLog('BudgetCategoriesAndValues', `Months changed, updating layout. New count: ${newMonths.length}`);

    // Kurz warten für DOM-Updates
    await nextTick();

    // Layout aller Grids aktualisieren
    updateLayoutAfterMonthsChange();
  }
}, { deep: true });

function initializeGrids() {
  debugLog('BudgetCategoriesAndValues', 'initializeGrids() function called');

  try {
    let completedLayouts = 0;
    const totalGrids = 2; // Expense Meta-Grid + Income Meta-Grid

    const checkAllLayoutsComplete = () => {
      completedLayouts++;
      debugLog('BudgetCategoriesAndValues', `Layout completed: ${completedLayouts}/${totalGrids}`);
      if (completedLayouts >= totalGrids) {
        debugLog('BudgetCategoriesAndValues', 'All Muuri grids layouts completed successfully - emitting muuriReady');
        emit('muuriReady');
      }
    };

    // Expense Sub-Grids initialisieren
    const expenseSubGridElements = document.querySelectorAll('#expense-categories .categories-content') as NodeListOf<HTMLElement>;
    expenseSubGridElements.forEach(el => {
      const grid = createSubGrid(el, expenseSubGrids);
      expenseSubGrids.value.push(grid);
    });

    // Income Sub-Grids initialisieren
    const incomeSubGridElements = document.querySelectorAll('#income-categories .categories-content') as NodeListOf<HTMLElement>;
    incomeSubGridElements.forEach(el => {
      const grid = createSubGrid(el, incomeSubGrids);
      incomeSubGrids.value.push(grid);
    });

    // Meta-Grids mit längeren Delays für bessere Animation-Performance
    setTimeout(() => {
      try {
        debugLog('BudgetCategoriesAndValues', 'Initializing Expense Meta-Grid');
        // Expense Meta-Grid initialisieren
        expenseMetaGrid.value = createMetaGrid('#expense-categories', false);

        // Prüfe sofort, ob Layout bereits abgeschlossen ist, oder warte auf layoutEnd
        if (expenseMetaGrid.value.getItems().length === 0) {
          debugLog('BudgetCategoriesAndValues', 'Expense Meta-Grid has no items, layout complete immediately');
          checkAllLayoutsComplete();
        } else {
          expenseMetaGrid.value.on('layoutEnd', () => {
            debugLog('BudgetCategoriesAndValues', 'Expense Meta-Grid layout completed via event');
            checkAllLayoutsComplete();
          });
          // Fallback: Prüfe nach kurzer Zeit, ob Layout abgeschlossen ist
          setTimeout(() => {
            if (completedLayouts < 1) {
              debugLog('BudgetCategoriesAndValues', 'Expense Meta-Grid layout completed via timeout fallback');
              checkAllLayoutsComplete();
            }
          }, 200);
        }

        // Längerer Delay für Income Meta-Grid um Spinner-Animation zu ermöglichen
        setTimeout(() => {
          try {
            debugLog('BudgetCategoriesAndValues', 'Initializing Income Meta-Grid');
            // Income Meta-Grid initialisieren
            incomeMetaGrid.value = createMetaGrid('#income-categories', true);

            // Prüfe sofort, ob Layout bereits abgeschlossen ist, oder warte auf layoutEnd
            if (incomeMetaGrid.value.getItems().length === 0) {
              debugLog('BudgetCategoriesAndValues', 'Income Meta-Grid has no items, layout complete immediately');
              checkAllLayoutsComplete();
            } else {
              incomeMetaGrid.value.on('layoutEnd', () => {
                debugLog('BudgetCategoriesAndValues', 'Income Meta-Grid layout completed via event');
                checkAllLayoutsComplete();
              });
              // Fallback: Prüfe nach kurzer Zeit, ob Layout abgeschlossen ist
              setTimeout(() => {
                if (completedLayouts < 2) {
                  debugLog('BudgetCategoriesAndValues', 'Income Meta-Grid layout completed via timeout fallback');
                  checkAllLayoutsComplete();
                }
              }, 200);
            }

            debugLog('BudgetCategoriesAndValues', 'Muuri grids initialized, waiting for layouts to complete');

          } catch (error) {
            errorLog('BudgetCategoriesAndValues', 'Failed to initialize Income Meta-Grid', error);
            emit('muuriReady'); // Trotzdem Event emittieren
          }
        }, 100); // Erhöht von 50ms auf 100ms für bessere Animation

      } catch (error) {
        errorLog('BudgetCategoriesAndValues', 'Failed to initialize Expense Meta-Grid', error);
        emit('muuriReady'); // Trotzdem Event emittieren
      }
    }, 150); // Erhöht von 100ms auf 150ms für bessere Animation

  } catch (error) {
    errorLog('BudgetCategoriesAndValues', 'Failed to initialize Sub-Grids', error);
    // Auch bei Fehlern das Event emittieren, damit Loading beendet wird
    emit('muuriReady');
  }
}

function createSubGrid(element: HTMLElement, subGridsArray: typeof expenseSubGrids): Muuri {
  return new Muuri(element, {
    items: '.category-item-extended',
    dragEnabled: true,
    dragHandle: '.category-drag-area',
    dragContainer: dragContainer.value,
    dragSort: function () {
      return [...expenseSubGrids.value, ...incomeSubGrids.value];
    },
    dragCssProps: {
      touchAction: 'auto',
      userSelect: 'none',
      userDrag: 'none',
      tapHighlightColor: 'rgba(0, 0, 0, 0)',
      touchCallout: 'none',
      contentZooming: 'none'
    },
    dragAutoScroll: {
      targets: (item: any) => {
        return [
          { element: window, priority: 0 },
          { element: item.getGrid().getElement().parentNode, priority: 1 },
        ];
      }
    },
  })
  .on('dragInit', function (item: any) {
    const element = item.getElement();
    if (element) {
      element.style.width = item.getWidth() + 'px';
      element.style.height = item.getHeight() + 'px';
    }
  })
  .on('dragReleaseEnd', function (item: any) {
    const element = item.getElement();
    const grid = item.getGrid();
    if (element) {
      element.style.width = '';
      element.style.height = '';
    }
    if (grid) {
      grid.refreshItems([item]);
    }
  })
  .on('layoutStart', function () {
    if (expenseMetaGrid.value) {
      expenseMetaGrid.value.refreshItems().layout();
    }
    if (incomeMetaGrid.value) {
      incomeMetaGrid.value.refreshItems().layout();
    }
  })
  .on('dragStart', function (item: any) {
    setupAutoExpand();
  })
  .on('dragEnd', function (item: any) {
    clearAutoExpandTimer();
    handleCategoryDragEnd(item);
  });
}

function createMetaGrid(selector: string, isIncomeGrid: boolean): Muuri {
  return new Muuri(selector, {
    items: '.group-wrapper',
    dragEnabled: true,
    dragHandle: '.group-drag-handle',
    dragContainer: dragContainer.value,
    dragCssProps: {
      touchAction: 'auto',
      userSelect: 'none',
      userDrag: 'none',
      tapHighlightColor: 'rgba(0, 0, 0, 0)',
      touchCallout: 'none',
      contentZooming: 'none'
    },
    dragAutoScroll: {
      targets: (item: any) => {
        return [
          { element: window, priority: 0 },
          { element: item.getGrid().getElement().parentNode, priority: 1 },
        ];
      }
    },
    layout: {
      fillGaps: false,
      horizontal: false,
      alignRight: false,
      alignBottom: false
    },
    layoutDuration: 300,
    layoutEasing: 'ease'
  })
  .on('dragInit', function (item: any) {
    const element = item.getElement();
    if (element) {
      element.style.width = item.getWidth() + 'px';
      element.style.height = item.getHeight() + 'px';
    }
  })
  .on('dragReleaseEnd', function (item: any) {
    const element = item.getElement();
    const grid = item.getGrid();
    if (element) {
      element.style.width = '';
      element.style.height = '';
    }
    if (grid) {
      grid.refreshItems([item]);
    }
  })
  .on('dragEnd', function (item: any) {
    handleCategoryGroupDragEnd(item, isIncomeGrid);
  });
}

function destroyGrids() {
  try {
    // Sub-Grids zerstören
    [...expenseSubGrids.value, ...incomeSubGrids.value].forEach(grid => {
      if (grid) {
        grid.destroy();
      }
    });
    expenseSubGrids.value = [];
    incomeSubGrids.value = [];

    // Meta-Grids zerstören
    if (expenseMetaGrid.value) {
      expenseMetaGrid.value.destroy();
      expenseMetaGrid.value = null;
    }
    if (incomeMetaGrid.value) {
      incomeMetaGrid.value.destroy();
      incomeMetaGrid.value = null;
    }
    debugLog('BudgetCategoriesAndValues', 'Muuri grids destroyed');
  } catch (error) {
    errorLog('BudgetCategoriesAndValues', 'Failed to destroy Muuri grids', error);
  }
}

// Expand/Collapse Funktionen
function toggleGroup(groupId: string) {
  categoryStore.toggleCategoryGroupExpanded(groupId);

  nextTick(() => {
    updateLayoutAfterToggle();
  });
}

function updateLayoutAfterToggle() {
  // Alle Sub-Grids refreshen
  [...expenseSubGrids.value, ...incomeSubGrids.value].forEach(grid => {
    if (grid) {
      grid.refreshItems();
      grid.layout(true);
    }
  });

  // Meta-Grids refreshen
  if (expenseMetaGrid.value) {
    expenseMetaGrid.value.refreshItems();
    expenseMetaGrid.value.layout(true);
  }
  if (incomeMetaGrid.value) {
    incomeMetaGrid.value.refreshItems();
    incomeMetaGrid.value.layout(true);
  }
}

function updateLayoutAfterMonthsChange() {
  debugLog('BudgetCategoriesAndValues', 'updateLayoutAfterMonthsChange() called');

  try {
    let completedLayouts = 0;
    const totalGrids = 2; // Expense Meta-Grid + Income Meta-Grid

    const checkAllLayoutsComplete = () => {
      completedLayouts++;
      debugLog('BudgetCategoriesAndValues', `Layout update completed: ${completedLayouts}/${totalGrids}`);
      if (completedLayouts >= totalGrids) {
        debugLog('BudgetCategoriesAndValues', 'All layouts updated after months change - emitting muuriReady');
        emit('muuriReady');
      }
    };

    // Alle Sub-Grids refreshen
    [...expenseSubGrids.value, ...incomeSubGrids.value].forEach(grid => {
      if (grid) {
        grid.refreshItems();
        grid.layout(true);
      }
    });

    // Meta-Grids refreshen mit Layout-Completion-Tracking
    if (expenseMetaGrid.value) {
      expenseMetaGrid.value.refreshItems();

      // Prüfe ob Items vorhanden sind
      if (expenseMetaGrid.value.getItems().length === 0) {
        debugLog('BudgetCategoriesAndValues', 'Expense Meta-Grid has no items, layout complete immediately');
        checkAllLayoutsComplete();
      } else {
        // Einmaliger Event-Listener für layoutEnd
        const handleExpenseLayoutEnd = () => {
          expenseMetaGrid.value?.off('layoutEnd', handleExpenseLayoutEnd);
          debugLog('BudgetCategoriesAndValues', 'Expense Meta-Grid layout update completed');
          checkAllLayoutsComplete();
        };
        expenseMetaGrid.value.on('layoutEnd', handleExpenseLayoutEnd);
        expenseMetaGrid.value.layout(true);

        // Fallback nach 300ms
        setTimeout(() => {
          if (completedLayouts < 1) {
            expenseMetaGrid.value?.off('layoutEnd', handleExpenseLayoutEnd);
            debugLog('BudgetCategoriesAndValues', 'Expense Meta-Grid layout completed via timeout fallback');
            checkAllLayoutsComplete();
          }
        }, 300);
      }
    } else {
      checkAllLayoutsComplete();
    }

    if (incomeMetaGrid.value) {
      incomeMetaGrid.value.refreshItems();

      // Prüfe ob Items vorhanden sind
      if (incomeMetaGrid.value.getItems().length === 0) {
        debugLog('BudgetCategoriesAndValues', 'Income Meta-Grid has no items, layout complete immediately');
        checkAllLayoutsComplete();
      } else {
        // Einmaliger Event-Listener für layoutEnd
        const handleIncomeLayoutEnd = () => {
          incomeMetaGrid.value?.off('layoutEnd', handleIncomeLayoutEnd);
          debugLog('BudgetCategoriesAndValues', 'Income Meta-Grid layout update completed');
          checkAllLayoutsComplete();
        };
        incomeMetaGrid.value.on('layoutEnd', handleIncomeLayoutEnd);
        incomeMetaGrid.value.layout(true);

        // Fallback nach 300ms
        setTimeout(() => {
          if (completedLayouts < 2) {
            incomeMetaGrid.value?.off('layoutEnd', handleIncomeLayoutEnd);
            debugLog('BudgetCategoriesAndValues', 'Income Meta-Grid layout completed via timeout fallback');
            checkAllLayoutsComplete();
          }
        }, 300);
      }
    } else {
      checkAllLayoutsComplete();
    }

  } catch (error) {
    errorLog('BudgetCategoriesAndValues', 'Failed to update layout after months change', error);
    // Auch bei Fehlern das Event emittieren, damit Loading beendet wird
    emit('muuriReady');
  }
}

// Auto-Expand bei Drag-Over
function setupAutoExpand() {
  document.addEventListener('dragover', handleDragOverGroup);
}

function handleDragOverGroup(event: DragEvent) {
  const target = event.target as HTMLElement;
  const groupHeader = target.closest('.group-header');

  if (groupHeader) {
    const groupWrapper = groupHeader.closest('.group-wrapper');
    const groupId = groupWrapper?.getAttribute('data-group-id');

    if (groupId && !categoryStore.expandedCategoryGroups.has(groupId)) {
      clearAutoExpandTimer();
      autoExpandTimer.value = setTimeout(() => {
        categoryStore.toggleCategoryGroupExpanded(groupId);
        nextTick(() => {
          updateLayoutAfterToggle();
        });
      }, 1000);
    }
  }
}

function clearAutoExpandTimer() {
  if (autoExpandTimer.value) {
    clearTimeout(autoExpandTimer.value);
    autoExpandTimer.value = null;
  }
  document.removeEventListener('dragover', handleDragOverGroup);
}

// Drag & Drop Persistierung für Kategorien
function handleCategoryDragEnd(item: any) {
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const draggedElement = item.getElement();
      const categoryId = draggedElement.getAttribute('data-category-id');

      if (!categoryId) {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd - Category ID not found');
        return;
      }

      const container = draggedElement.closest('.categories-content');
      const groupWrapper = container?.closest('.group-wrapper');
      const actualGroupId = groupWrapper?.getAttribute('data-group-id');

      if (!actualGroupId) {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd - Group ID not found');
        return;
      }

      // Bestimme das richtige Sub-Grid
      const allSubGrids = [...expenseSubGrids.value, ...incomeSubGrids.value];
      const targetGrid = allSubGrids.find(grid => {
        const gridElement = grid.getElement();
        return gridElement.closest('.group-wrapper')?.getAttribute('data-group-id') === actualGroupId;
      });

      if (!targetGrid) {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd - Target grid not found', { actualGroupId });
        return;
      }

      const items = targetGrid.getItems();
      const newOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-category-id');
        if (id) newOrder.push(id);
      });

      debugLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd', {
        categoryId,
        actualGroupId,
        newOrder,
        itemsCount: items.length,
        draggedItemPosition: newOrder.indexOf(categoryId)
      });

      const sortOrderUpdates = CategoryService.calculateCategorySortOrder(actualGroupId, newOrder);
      const success = await CategoryService.updateCategoriesWithSortOrder(sortOrderUpdates);

      if (success) {
        debugLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd - Sort order updated successfully');
        await reinitializeMuuriGrids();
      } else {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd - Failed to update sort order');
      }

    } catch (error) {
      errorLog('BudgetCategoriesAndValues', 'handleCategoryDragEnd - Error updating sort order', error);
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
}

// Drag & Drop Persistierung für CategoryGroups
function handleCategoryGroupDragEnd(item: any, isIncomeGrid: boolean) {
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const draggedElement = item.getElement();
      const groupId = draggedElement.getAttribute('data-group-id');

      if (!groupId) {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryGroupDragEnd - Group ID not found');
        return;
      }

      const metaGrid = isIncomeGrid ? incomeMetaGrid.value : expenseMetaGrid.value;
      if (!metaGrid) {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryGroupDragEnd - Meta grid not found');
        return;
      }

      const items = metaGrid.getItems();
      const groupsInOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-group-id');
        if (id) groupsInOrder.push(id);
      });

      debugLog('BudgetCategoriesAndValues', 'handleCategoryGroupDragEnd', {
        groupId,
        groupsInOrder,
        isIncomeGrid,
        draggedGroupPosition: groupsInOrder.indexOf(groupId)
      });

      const sortOrderUpdates = CategoryService.calculateCategoryGroupSortOrder(groupsInOrder, isIncomeGrid);
      const success = await CategoryService.updateCategoryGroupsWithSortOrder(sortOrderUpdates);

      if (success) {
        debugLog('BudgetCategoriesAndValues', 'handleCategoryGroupDragEnd - Sort order updated successfully');
        await reinitializeMuuriGrids();
      } else {
        errorLog('BudgetCategoriesAndValues', 'handleCategoryGroupDragEnd - Failed to update sort order');
      }

    } catch (error) {
      errorLog('BudgetCategoriesAndValues', 'handleCategoryGroupDragEnd - Error updating sort order', error);
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
}

// UI-Refresh-Funktionen
async function reinitializeMuuriGrids() {
  try {
    debugLog('BudgetCategoriesAndValues', 'reinitializeMuuriGrids - Starting grid reinitialization');

    destroyGrids();
    await nextTick();
    initializeGrids();

    debugLog('BudgetCategoriesAndValues', 'reinitializeMuuriGrids - Grid reinitialization completed');
  } catch (error) {
    errorLog('BudgetCategoriesAndValues', 'reinitializeMuuriGrids - Error during grid reinitialization', error);
  }
}

// Context-Menu Funktionen
function openDropdown(event: MouseEvent, cat: Category, month: { start: Date; end: Date }) {
  event.preventDefault();

  const categoryData = getCategoryBudgetData(cat.id, month);
  const hasAvailableAmount = categoryData.saldo > 0;

  // Bei Einnahmenkategorien nur anzeigen, wenn Betrag verfügbar
  if (cat.isIncomeCategory && !hasAvailableAmount) {
    debugLog(
      "BudgetCategoriesAndValues",
      "Context menu on income category without funds prevented.",
      { category: cat.name, saldo: categoryData.saldo }
    );
    return;
  }

  // Dynamische Positionierung mit Viewport-Berücksichtigung
  const menuWidth = 192; // w-48 = 12rem = 192px
  const menuHeight = 120; // Geschätzte Höhe des Menüs (2 Buttons + Padding)

  let x = event.clientX;
  let y = event.clientY;

  // Viewport-Dimensionen
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Horizontale Anpassung - Menü nach links verschieben wenn es rechts rausragen würde
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth - 10; // 10px Puffer
  }

  // Vertikale Anpassung - Menü nach oben verschieben wenn es unten rausragen würde
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight - 10; // 10px Puffer
  }

  // Mindestabstände einhalten
  x = Math.max(10, x); // Mindestens 10px vom linken Rand
  y = Math.max(10, y); // Mindestens 10px vom oberen Rand

  dropdownX.value = x;
  dropdownY.value = y;

  modalData.value = { mode: "transfer", clickedCategory: cat, amount: 0, month };
  showDropdown.value = true;
  nextTick(() => dropdownRef.value?.focus());
  debugLog("BudgetCategoriesAndValues", "openDropdown", {
    category: cat,
    isIncomeCategory: cat.isIncomeCategory,
    hasAvailableAmount,
    saldo: categoryData.saldo,
    position: { x, y },
    viewport: { width: viewportWidth, height: viewportHeight }
  });
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
  if (!modalData.value?.clickedCategory || !modalData.value?.month) return;
  const cat = modalData.value.clickedCategory;
  const month = modalData.value.month;

  // Hole den aktuellen Saldo der Kategorie
  const categoryData = getCategoryBudgetData(cat.id, month);
  const currentSaldo = categoryData.saldo;

  // Setze den Betrag nur wenn der Saldo positiv ist
  const prefillAmount = currentSaldo > 0 ? currentSaldo : 0;

  // Alle Kategorien verwenden "transfer" Modus
  // Bei Einnahmen-Kategorien wird automatisch "Verfügbare Mittel" als Zielkategorie gesetzt
  modalData.value = { mode: "transfer", clickedCategory: cat, amount: prefillAmount, month };
  debugLog("BudgetCategoriesAndValues", "optionTransfer", {
    category: cat,
    currentSaldo,
    prefillAmount,
    isIncomeCategory: cat.isIncomeCategory,
    mode: "transfer"
  });

  closeDropdown();
  showTransferModal.value = true;
}

function optionFill() {
  if (!modalData.value?.clickedCategory || !modalData.value?.month) return;
  const cat = modalData.value.clickedCategory;
  const month = modalData.value.month;
  const data = getCategoryBudgetData(cat.id, month);
  const amt = data.saldo < 0 ? Math.abs(data.saldo) : 0;
  modalData.value = { mode: "fill", clickedCategory: cat, amount: amt, month };
  debugLog("BudgetCategoriesAndValues", "optionFill", { category: cat, amount: amt });
  closeDropdown();
  showTransferModal.value = true;
}

function executeTransfer() {
  showTransferModal.value = false;
  debugLog("BudgetCategoriesAndValues", "Transfer completed, modal closed");
}

// Transaction Modal Functions
function openTransactionModal(category: Category, month: { key: string; label: string; start: Date; end: Date }) {
  transactionModalData.value = {
    categoryId: category.id,
    month: month
  };
  showTransactionModal.value = true;
  debugLog("BudgetCategoriesAndValues", "Transaction modal opened", {
    categoryId: category.id,
    categoryName: category.name,
    month: month.label
  });
}

function closeTransactionModal() {
  showTransactionModal.value = false;
  transactionModalData.value = null;
  debugLog("BudgetCategoriesAndValues", "Transaction modal closed");
}

// Planning Modal Functions
function openPlanningModal(category: Category, month: { key: string; label: string; start: Date; end: Date }) {
  planningModalData.value = {
    categoryId: category.id,
    month
  };
  showPlanningModal.value = true;
  debugLog("BudgetCategoriesAndValues", "Planning modal opened", {
    categoryId: category.id,
    categoryName: category.name,
    month: month.label
  });
}

function closePlanningModal() {
  showPlanningModal.value = false;
  planningModalData.value = null;
  debugLog("BudgetCategoriesAndValues", "Planning modal closed");
}

function handleTransactionUpdated() {
  // Refresh budget data after transaction changes
  debugLog("BudgetCategoriesAndValues", "Transaction updated, refreshing budget data");
  // The reactive computed properties will automatically update
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Drag Container -->
    <div ref="dragContainer" class="drag-container"></div>

    <!-- Ausgaben-Sektion -->
    <div v-if="expenseGroups.length > 0" class="flex-1">
      <div class="sticky top-0 bg-base-200 px-0 py-2 border-b border-base-300 z-10">
        <!-- Typ-Header mit Gesamtsummen -->
        <div class="type-header-extended flex w-full">
          <!-- Sticky Typ-Teil -->
          <div class="type-part flex items-center pl-2">
            <Icon icon="mdi:trending-down" class="w-4 h-4 mr-2 text-error" />
            <h3 class="font-semibold text-sm text-base-content">Ausgaben</h3>
          </div>

          <!-- Dynamische Typ-Gesamtsummen -->
          <div class="type-values-part flex">
            <div
              v-for="month in months"
              :key="month.key"
              class="month-column flex-1 min-w-[120px] p-1 border-base-300"
            >
              <div class="type-summary-values grid grid-cols-4 gap-1 text-xs font-bold mr-[4%]">
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).budgeted"
                    :as-integer="true"
                    :show-zero="false"
                    class="text-base-content"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).forecast"
                    :as-integer="true"
                    :show-zero="false"
                    class="text-base-content"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).spent"
                    :as-integer="true"
                    :show-zero="false"
                    :class="calculateTypeSummary(false, month).spent >= 0 ? 'text-base-content' : 'text-error'"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).saldo"
                    :as-integer="true"
                    :show-zero="false"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="muuri-container bg-base-100 p-4" id="expense-categories">
        <div
          v-for="group in expenseGroups"
          :key="group.id"
          class="group-wrapper"
          :data-group-id="group.id"
        >
          <div class="category-group-row border-b border-base-300">
            <!-- Lebensbereiche-Header mit Summenwerten -->
            <div class="group-header-extended flex w-full bg-base-200 border-b border-t border-base-300 hover:bg-base-50 cursor-pointer">
              <!-- Sticky Gruppen-Teil -->
              <div class="group-part flex items-center border-r border-base-300 py-2">
                <!-- Drag Handle für Gruppe -->
                <div class="group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                  <Icon icon="mdi:drag-vertical" class="w-4 h-4 text-base-content/60" />
                </div>

                <!-- Gruppen-Icon -->
                <div class="flex-shrink-0 mr-2">
                  <Icon :icon="getGroupIcon(group)" :class="`w-4 h-4 ${getGroupColor(group)}`" />
                </div>

                <!-- Gruppenname -->
                <div class="flex-grow" @click.stop="toggleGroup(group.id)">
                  <h4 class="font-semibold text-sm text-base-content">{{ group.name }}</h4>
                </div>
              </div>

              <!-- Dynamische Gruppen-Summen-Teile -->
              <div class="group-values-part flex">
                <div
                  v-for="month in months"
                  :key="month.key"
                  class="month-column flex-1 min-w-[120px] py-2 px-1 border-r border-base-300"
                >
                  <div class="group-summary-values grid grid-cols-4 gap-1 text-xs font-semibold mr-[4%]">
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).budgeted"
                        :as-integer="true"
                        :show-zero="false"
                        class="text-base-content"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).forecast"
                        :as-integer="true"
                        :show-zero="false"
                        class="text-base-content"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).spent"
                        :as-integer="true"
                        :show-zero="false"
                        :class="calculateGroupSummary(group.id, month).spent >= 0 ? 'text-base-content' : 'text-error'"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).saldo"
                        :as-integer="true"
                        :show-zero="false"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Kategorien-Liste -->
            <div
              v-show="categoryStore.expandedCategoryGroups.has(group.id)"
              class="categories-list"
              :class="{ 'collapsed': !categoryStore.expandedCategoryGroups.has(group.id) }"
            >
              <div class="categories-content">
                <div
                  v-for="category in getVisibleCategoriesForGroup(group.id)"
                  :key="category.id"
                  class="category-item-extended"
                  :data-category-id="category.id"
                  :data-group-id="group.id"
                >
                  <!-- Unified Muuri Item: Kategorie + Werte -->
                  <div class="flex w-full">
                    <!-- Sticky Kategorie-Teil -->
                    <div class="category-part flex items-center p-0 pl-8 bg-base-50 border-b border-r border-base-300 hover:bg-base-100 cursor-pointer">
                      <div class="category-drag-area flex items-center flex-grow">
                        <div class="category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                          <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
                        </div>

                        <div v-if="category.icon" class="flex-shrink-0 mr-2">
                          <Icon :icon="category.icon" class="w-3 h-3 text-base-content/70" />
                        </div>

                        <div class="flex-grow category-name-drag">
                          <span class="text-xs text-base-content">{{ category.name }}</span>
                        </div>
                      </div>

                      <div class="flex-shrink-0 flex items-center space-x-2">
                        <div v-if="category.isSavingsGoal && category.targetAmount && category.goalDate" class="flex items-center space-x-2">
                          <div class="flex flex-col w-full mr-1 items-center">

                            <div class="badge badge-xs badge-primary badge-soft text-xs w-full">
                              <CurrencyDisplay :amount="category.targetAmount" :show-sign="false" :as-integer="true" class="mr-0" />
                              - {{ new Date(category.goalDate).toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' }) }}
                            </div>
                            <progress class="progress progress-primary w-28 mt-1" :value="getSavingsGoalProgress(category)" max="100"></progress>
                          </div>
                        </div>
                        <div v-else class="flex items-center space-x-1">
                          <div v-if="category.isSavingsGoal" class="w-2 h-2 bg-info rounded-full" title="Sparziel"></div>
                          <div v-if="!category.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
                          <div v-if="category.isHidden" class="w-2 h-2 bg-base-content/30 rounded-full" title="Versteckt"></div>
                        </div>
                      </div>
                    </div>

                    <!-- Dynamische Werte-Teile -->
                    <div class="values-part flex">
                      <div
                        v-for="month in months"
                        :key="month.key"
                        class="month-column flex-1 min-w-[120px] p-[3px] border-b border-r border-base-300"
                      >
                        <div class="budget-values grid grid-cols-4 gap-1 text-xs mr-[4%]">
                          <div
                            class="text-right transition-all duration-200 rounded px-1 py-0.5 border"
                            :class="{
                              'cursor-pointer border-transparent hover:border-primary': !isEditingBudget(category.id, month.key),
                              'border-transparent': isEditingBudget(category.id, month.key)
                            }"
                            @click.stop="handleBudgetClick(category.id, month.key)"
                          >
                            <!-- Edit-Modus: CalculatorInput -->
                            <CalculatorInput
                              v-if="isEditingBudget(category.id, month.key)"
                              :model-value="getCategoryBudgetData(category.id, month).budgeted"
                              :is-active="true"
                              :field-key="`${category.id}-${month.key}`"
                              @update:model-value="handleBudgetUpdate(category.id, month.key, $event)"
                              @finish="handleBudgetFinish(category.id, month.key)"
                              @focus-next="handleFocusNext(category.id, month.key)"
                              @focus-previous="handleFocusPrevious(category.id, month.key)"
                            />
                            <!-- Anzeige-Modus: CurrencyDisplay -->
                            <CurrencyDisplay
                              v-else
                              :amount="getCategoryBudgetData(category.id, month).budgeted"
                              :as-integer="true"
                              :show-zero="false"
                              class="text-base-content/80"
                              @click.stop="handleBudgetClick(category.id, month.key)"
                            />
                          </div>
                          <div
                            class="text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors"
                            @click="openPlanningModal(category, month)"
                            title="Klicken um Planungen anzuzeigen"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).forecast"
                              :as-integer="true"
                              :show-zero="false"
                              class="text-base-content/80"
                            />
                          </div>
                          <div
                            class="text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors"
                            @click="openTransactionModal(category, month)"
                            title="Klicken um Transaktionen anzuzeigen"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).spent"
                              :as-integer="true"
                              :show-zero="false"
                              class="text-error"
                            />
                          </div>
                          <div
                            class="text-right py-0.5 "
                            :class="{
                              'cursor-context-menu hover:bg-base-200': !category.isIncomeCategory || getCategoryBudgetData(category.id, month).saldo > 0
                            }"
                            @contextmenu="openDropdown($event, category, month)"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).saldo"
                              :as-integer="true"
                              :show-zero="false"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Einnahmen-Sektion -->
    <div v-if="incomeGroups.length > 0" class="flex-1 border-b border-t border-base-300 mt-3">
      <div class="sticky top-0 bg-base-200 px-0 py-3 border-b border-r border-base-300 z-10">
        <!-- Typ-Header mit Gesamtsummen -->
        <div class="type-header-extended flex w-full">
          <!-- Sticky Typ-Teil -->
          <div class="type-part flex items-center pl-2">
            <Icon icon="mdi:trending-up" class="w-4 h-4 mr-2 text-success" />
            <h3 class="font-semibold text-sm text-base-content">Einnahmen</h3>
          </div>

          <!-- Dynamische Typ-Gesamtsummen -->
          <div class="type-values-part flex">
            <div
              v-for="month in months"
              :key="month.key"
              class="month-column flex-1 min-w-[120px] p-0 px-1"
            >
              <div class="type-summary-values grid grid-cols-4 gap-1 text-xs font-bold mr-[4%]">
                <div class="text-right opacity-0">
                  <!-- Transparente Leerzelle für budgeted bei Einnahmen -->
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).forecast"
                    :as-integer="true"
                    :show-zero="false"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).spent"
                    :as-integer="true"
                    :show-zero="false"
                    class="text-base-content"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).saldo"
                    :as-integer="true"
                    :show-zero="false"
                    class="text-base-content"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="muuri-container bg-base-100 p-4" id="income-categories">
        <div
          v-for="group in incomeGroups"
          :key="group.id"
          class="group-wrapper"
          :data-group-id="group.id"
        >
          <div class="category-group-row border-b border-base-300">
            <!-- Lebensbereiche-Header mit Summenwerten -->
            <div class="group-header-extended flex w-full py-0 bg-base-200 border-b border-t border-base-300 hover:bg-base-50 cursor-pointer">
              <!-- Sticky Gruppen-Teil -->
              <div class="group-part flex items-center border-r border-base-300 py-2">
                <!-- Drag Handle für Gruppe -->
                <div class="group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                  <Icon icon="mdi:drag-vertical" class="w-4 h-4 text-base-content/60" />
                </div>

                <!-- Gruppen-Icon -->
                <div class="flex-shrink-0 mr-2">
                  <Icon :icon="getGroupIcon(group)" :class="`w-4 h-4 ${getGroupColor(group)}`" />
                </div>

                <!-- Gruppenname -->
                <div class="flex-grow" @click.stop="toggleGroup(group.id)">
                  <h4 class="font-semibold text-sm text-base-content">{{ group.name }}</h4>
                </div>
              </div>

              <!-- Dynamische Gruppen-Summen-Teile -->
              <div class="group-values-part flex">
                <div
                  v-for="month in months"
                  :key="month.key"
                  class="month-column flex-1 min-w-[120px] py-2 px-1 border-r border-base-300"
                >
                  <div class="group-summary-values grid grid-cols-4 gap-1 text-xs font-semibold mr-[4%]">
                    <div class="text-right opacity-0">
                      <!-- Transparente Leerzelle für budgeted bei Einnahmen-Gruppen -->
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).forecast"
                        :as-integer="true"
                        :show-zero="false"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).spent"
                        :as-integer="true"
                        :show-zero="false"
                        class="text-base-content"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).saldo"
                        :as-integer="true"
                        :show-zero="false"
                        class="text-base-content"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Kategorien-Liste -->
            <div
              v-show="categoryStore.expandedCategoryGroups.has(group.id)"
              class="categories-list"
              :class="{ 'collapsed': !categoryStore.expandedCategoryGroups.has(group.id) }"
            >
              <div class="categories-content">
                <div
                  v-for="category in getVisibleCategoriesForGroup(group.id)"
                  :key="category.id"
                  class="category-item-extended"
                  :data-category-id="category.id"
                  :data-group-id="group.id"
                >
                  <!-- Unified Muuri Item: Kategorie + Werte -->
                  <div class="flex w-full">
                    <!-- Sticky Kategorie-Teil -->
                    <div class="category-part flex items-center p-0 pl-8 bg-base-50 border-b border-r border-base-300 hover:bg-base-100 cursor-pointer">
                      <div class="category-drag-area flex items-center flex-grow">
                        <div class="category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                          <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
                        </div>

                        <div v-if="category.icon" class="flex-shrink-0 mr-2">
                          <Icon :icon="category.icon" class="w-3 h-3 text-base-content/70" />
                        </div>

                        <div class="flex-grow category-name-drag">
                          <span class="text-xs text-base-content">{{ category.name }}</span>
                        </div>
                      </div>

                      <div class="flex-shrink-0 flex items-center space-x-2">
                        <div v-if="category.isSavingsGoal && category.targetAmount && category.goalDate" class="flex items-center space-x-2">
                          <div class="badge badge-primary badge-soft text-xs">
                            <CurrencyDisplay :amount="category.targetAmount" :show-sign="false" :as-integer="true" class="mr-1" />
                            bis {{ new Date(category.goalDate).toLocaleDateString('de-DE', { month: '2-digit', year: '2-digit' }) }}
                          </div>
                          <progress class="progress progress-primary w-16" :value="getSavingsGoalProgress(category)" max="100"></progress>
                        </div>
                        <div v-else class="flex items-center space-x-1">
                          <div v-if="category.isSavingsGoal" class="w-2 h-2 bg-info rounded-full" title="Sparziel"></div>
                          <div v-if="!category.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
                          <div v-if="category.isHidden" class="w-2 h-2 bg-base-content/30 rounded-full" title="Versteckt"></div>
                        </div>
                      </div>
                    </div>

                    <!-- Dynamische Werte-Teile -->
                    <div class="values-part flex">
                      <div
                        v-for="month in months"
                        :key="month.key"
                        class="month-column flex-1 min-w-[120px] p-1 border-b border-r border-base-300"
                      >
                        <div class="budget-values grid grid-cols-4 gap-1 text-xs mr-[4%]">
                          <div class="text-right opacity-0">
                            <!-- Transparente Leerzelle für budgeted bei Einnahmen-Kategorien -->
                          </div>
                          <div
                            class="text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors"
                            @click="openPlanningModal(category, month)"
                            title="Klicken um Planungen anzuzeigen"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).forecast"
                              :as-integer="true"
                              :show-zero="false"
                            />
                          </div>
                          <div
                            class="text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors"
                            @click="openTransactionModal(category, month)"
                            title="Klicken um Transaktionen anzuzeigen"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).spent"
                              :as-integer="true"
                              :show-zero="false"
                              class="text-base-content/80"
                            />
                          </div>
                          <div
                            class="text-right py-0.5 "
                            :class="{
                              'cursor-context-menu hover:bg-base-200': getCategoryBudgetData(category.id, month).saldo > 0
                            }"
                            @contextmenu="openDropdown($event, category, month)"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).saldo"
                              :as-integer="true"
                              :show-zero="false"
                              class="text-base-content/80"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fallback wenn keine Gruppen vorhanden -->
    <div v-if="expenseGroups.length === 0 && incomeGroups.length === 0" class="flex-1 flex items-center justify-center p-8">
      <div class="text-center text-base-content/60">
        <Icon icon="mdi:folder-outline" class="w-12 h-12 mx-auto mb-3" />
        <p class="text-sm font-medium">Keine Lebensbereiche</p>
        <p class="text-xs mt-1">Erstellen Sie zunächst Lebensbereiche</p>
      </div>
    </div>
    <!-- Kontext-Dropdown -->
    <ul
      v-if="showDropdown"
      ref="dropdownRef"
      tabindex="0"
      class="fixed z-40 menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-56"
      :style="`left: ${dropdownX}px; top: ${dropdownY}px;`"
      @keydown.escape="closeDropdown"
      @blur="onDropdownBlur"
    >
      <!-- Überschrift -->
      <li class="menu-title">
        <span>Budget-Aktionen</span>
      </li>

      <!-- Fülle auf - nur bei Ausgabenkategorien -->
      <li
        v-if="
          modalData?.clickedCategory &&
          !modalData.clickedCategory.isIncomeCategory
        "
      >
        <a @click="optionFill">
          <Icon
            icon="mdi:arrow-collapse-right"
            class="text-lg"
          />
          Fülle auf von …
        </a>
      </li>

      <!-- Transferiere zu - bei allen Kategorien -->
      <li>
        <a @click="optionTransfer">
          <Icon
            icon="mdi:arrow-expand-right"
            class="text-lg"
          />
          Transferiere zu …
        </a>
      </li>
    </ul>

    <!-- Transfer-Modal -->
    <CategoryTransferModal
      v-if="showTransferModal && modalData && modalData.month"
      :is-open="showTransferModal"
      :month="modalData.month"
      :mode="modalData.mode"
      :prefillAmount="modalData.amount"
      :preselectedCategoryId="modalData.clickedCategory?.id"
      :isIncomeCategory="modalData.clickedCategory?.isIncomeCategory || false"
      @close="showTransferModal = false"
      @transfer="executeTransfer"
    />

    <!-- Transaction Modal -->
    <CategoryTransactionModal
      v-if="showTransactionModal && transactionModalData"
      :is-open="showTransactionModal"
      :category-id="transactionModalData.categoryId"
      :month="transactionModalData.month"
      @close="closeTransactionModal"
      @transaction-updated="handleTransactionUpdated"
    />

    <!-- Planning Modal -->
    <CategoryPlanningModal
      v-if="showPlanningModal && planningModalData"
      :is-open="showPlanningModal"
      :category-id="planningModalData.categoryId"
      :month="planningModalData.month"
      @close="closePlanningModal"
    />
  </div>
</template>

<style scoped>
/* Drag Container */
.drag-container {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
}

/* Muuri Container */
.muuri-container {
  position: relative;
  min-height: 100px;
}

.group-wrapper {
  position: absolute;
  display: block;
  margin: 0 0 0 0;
  z-index: 1;
  width: 100%;
}

.group-wrapper.muuri-item-dragging {
  z-index: 9999 !important;
  cursor: move !important;
}

.group-wrapper.muuri-item-releasing {
  z-index: 9998 !important;
}

/* CategoryGroupRow Design */
.category-group-row {
  border-radius: 0rem;
  overflow: hidden;
  background: hsl(var(--b1));
  margin-bottom: 0rem;
}

.group-header {
  background: linear-gradient(to right, hsl(var(--b1)), hsl(var(--b2)));
}

.categories-list {
  position: relative;
  min-height: 50px;
  /*max-height: 400px;*/
  overflow-y: auto;
  transition: all 0.3s ease;
}

.categories-list.collapsed {
  min-height: 0;
  max-height: 0;
  overflow: hidden;
}

.categories-content {
  position: relative;
  min-height: 100%;
}

.category-item-extended {
  position: absolute;
  display: block;
  width: 100%;
  margin: 0;
  z-index: 1;
}

.category-item-extended:last-child .flex:last-child {
  border-bottom: none;
}

/* Layout für erweiterte Items */
.category-part {
  flex: 0 0 300px;
  position: sticky;
  left: 0;
  z-index: 10;
  background: inherit;
}

.values-part {
  flex: 1;
  display: flex;
  overflow-x: auto;
}

.month-column {
  flex: 1;
  min-width: 120px;
  background: hsl(var(--b1));
}

.budget-values {
  padding: 4px;
}

/* Layout für erweiterte Header */
.type-header-extended {
  align-items: center;
}

.type-part {
  flex: 0 0 300px;
  position: sticky;
  left: 0;
  z-index: 10;
  background: inherit;
}

.type-values-part {
  flex: 1;
  display: flex;
  overflow-x: auto;
}

.group-header-extended {
  align-items: center;
}

.group-part {
  flex: 0 0 300px;
  position: sticky;
  left: 0;
  z-index: 10;
  background: inherit;
}

.group-values-part {
  flex: 1;
  display: flex;
  overflow-x: auto;
}

.type-summary-values,
.group-summary-values {
  padding: 2px;
}

.type-summary-values {
  background: hsl(var(--b3) / 0.3);
  border-radius: 4px;
}

.group-summary-values {
  background: hsl(var(--b2) / 0.3);
  border-radius: 4px;
}

/* Drag Handle Styles */
.group-drag-handle,
.category-drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease;
}

.group-drag-handle:active,
.category-drag-handle:active {
  cursor: grabbing;
}

/* Erweiterte Drag-Area für Kategorien */
.category-drag-area {
  cursor: grab;
  transition: all 0.2s ease;
}

.category-drag-area:hover {
  background-color: hsl(var(--b2) / 0.5);
  border-radius: 4px;
}

.category-drag-area:active {
  cursor: grabbing;
}

.category-name-drag {
  cursor: grab;
  padding: 2px 4px;
  border-radius: 3px;
  transition: background-color 0.2s ease;
}

.category-name-drag:hover {
  background-color: hsl(var(--b3) / 0.3);
}

/* Hover-Effekte */
.group-header:hover .group-drag-handle,
.category-item-extended:hover .category-drag-handle {
  opacity: 1;
}

.category-item-extended:hover .category-drag-area {
  background-color: hsl(var(--b2) / 0.3);
}

/* Muuri Drag States für erweiterte Kategorien - exakt wie in MuuriTestView */
.category-item-extended {
  display: block;
  position: absolute;
  width: 100%;
  margin: 0;
  z-index: 1;
}

.category-item-extended.muuri-item-dragging {
  z-index: 3 !important;
}

.category-item-extended.muuri-item-releasing {
  z-index: 2 !important;
}

.category-item-extended.muuri-item-hidden {
  z-index: 0 !important;
}

/* Gruppe Drag States - exakt wie in MuuriTestView */
.group-wrapper {
  display: block;
  position: absolute;
  width: 100%;
  margin: 0;
  z-index: 1;
}

.group-wrapper.muuri-item-dragging {
  z-index: 3 !important;
}

.group-wrapper.muuri-item-releasing {
  z-index: 2 !important;
}

.group-wrapper.muuri-item-hidden {
  z-index: 0 !important;
}

/* Sicherstellen, dass die Drag-Area korrekt funktioniert */
.category-drag-area {
  position: relative;
  cursor: grab;
}

.category-drag-area:active {
  cursor: grabbing;
}

/* Drag Handle Styles */
.category-drag-handle,
.group-drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease;
}

.category-drag-handle:active,
.group-drag-handle:active {
  cursor: grabbing;
}

/* Placeholder styling */
.muuri-item-placeholder {
  margin: 0 !important;
  background-color: #add8e6 !important;
  border: 1px dashed #007bff !important;
  opacity: 0.7 !important;
  border-radius: 4px !important;
  pointer-events: none !important;
}

/* Drag-Over Effekt für Gruppen-Header */
.group-header:hover {
  background: linear-gradient(to right, hsl(var(--b2)), hsl(var(--b3)));
  transition: background 0.2s ease;
}

/* Auto-Expand Highlight */
.group-header.drag-over-expand {
  background: linear-gradient(to right, hsl(var(--p) / 0.1), hsl(var(--p) / 0.2));
  border: 2px dashed hsl(var(--p));
}

/* Chevron Animation */
.group-header .transition-transform {
  transition: transform 0.3s ease-in-out;
}

/* Chevron Rotation States */
.rotate-180 {
  transform: rotate(180deg);
}

/* Custom Tailwind-Klassen für bessere Abstufungen */
.bg-base-25 {
  background-color: color-mix(in srgb, hsl(var(--b1)) 75%, hsl(var(--b2)) 25%);
}
</style>
