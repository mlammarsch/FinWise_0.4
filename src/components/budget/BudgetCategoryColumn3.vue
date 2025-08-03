<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, computed, watch } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';
import { CategoryService } from '../../services/CategoryService';
import { useCategoryStore } from '../../stores/categoryStore';
import type { CategoryGroup, Category } from '../../types';
import { debugLog, errorLog } from '../../utils/logger';
import CurrencyDisplay from '../ui/CurrencyDisplay.vue';
import { BudgetService } from '../../services/BudgetService';
import { toDateOnlyString } from '../../utils/formatters';
import CategoryTransferModal from './CategoryTransferModal.vue';
import CategoryTransactionModal from './CategoryTransactionModal.vue';
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

// Interface für Budget-Daten
interface MonthlyBudgetData {
  budgeted: number;
  forecast: number;
  spent: number;
  saldo: number;
}

// Berechnungsfunktionen für echte Budget-Daten
function getCategoryBudgetData(categoryId: string, month: { start: Date; end: Date }): MonthlyBudgetData {
  const normalizedStart = new Date(toDateOnlyString(month.start));
  const normalizedEnd = new Date(toDateOnlyString(month.end));

  return BudgetService.getAggregatedMonthlyBudgetData(categoryId, normalizedStart, normalizedEnd);
}

function calculateGroupSummary(groupId: string, month: { start: Date; end: Date }) {
  const categories = getCategoriesForGroup(groupId);
  const summary = {
    budgeted: 0,
    forecast: 0,
    spent: 0,
    saldo: 0
  };

  categories.forEach(category => {
    const data = getCategoryBudgetData(category.id, month);
    summary.budgeted += data.budgeted;
    summary.forecast += data.forecast;
    summary.spent += data.spent;
    summary.saldo += data.saldo;
  });

  return summary;
}

const typeSummaryCache = computed(() => {
  const cache = new Map<string, any>();

  props.months.forEach((month: { key: string; start: Date; end: Date }) => {
    const normalizedStart = new Date(toDateOnlyString(month.start));
    const normalizedEnd = new Date(toDateOnlyString(month.end));

    // Cache für Expense-Kategorien
    const expenseSummary = BudgetService.getMonthlySummary(
      normalizedStart,
      normalizedEnd,
      "expense"
    );
    cache.set(`expense-${month.key}`, {
      budgeted: expenseSummary.budgeted,
      forecast: expenseSummary.forecast,
      spent: expenseSummary.spentMiddle,
      saldo: expenseSummary.saldoFull
    });

    // Cache für Income-Kategorien
    const incomeSummary = BudgetService.getMonthlySummary(
      normalizedStart,
      normalizedEnd,
      "income"
    );
    cache.set(`income-${month.key}`, {
      budgeted: incomeSummary.budgeted,
      forecast: incomeSummary.forecast,
      spent: incomeSummary.spentMiddle,
      saldo: incomeSummary.saldoFull
    });
  });

  return cache;
});

function calculateTypeSummary(isIncomeType: boolean, month: { key?: string; start: Date; end: Date }) {
  const key = `${isIncomeType ? 'income' : 'expense'}-${month.key || toDateOnlyString(month.start)}`;
  return typeSummaryCache.value.get(key) || {
    budgeted: 0,
    forecast: 0,
    spent: 0,
    saldo: 0
  };
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

// CategoryStore für globalen Expand/Collapse-Zustand
const categoryStore = useCategoryStore();

// Reaktive Kategorie „Verfügbare Mittel"
const availableFundsCategory = computed(() =>
  categoryStore.categories.find(
    (c) => c.name.trim().toLowerCase() === "verfügbare mittel"
  )
);
function isVerfuegbareMittel(cat: Category) {
  return availableFundsCategory.value?.id === cat.id;
}

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

// Editable Budget State
const activeEditField = ref<string | null>(null); // Format: "categoryId-monthKey"
const editValue = ref<string>('');

// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref<NodeJS.Timeout | null>(null);

// Debouncing für Sort Order Updates
const sortOrderUpdateTimer = ref<NodeJS.Timeout | null>(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500;

// Getrennte Kategoriegruppen nach Typ
const expenseGroups = computed(() => {
  const groups = categoryGroups.value.filter(g => !g.isIncomeGroup);
  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
});

const incomeGroups = computed(() => {
  const groups = categoryGroups.value.filter(g => g.isIncomeGroup);
  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
});

// Icon-Mapping für Kategoriegruppen
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

// Editable Budget Functions
function startEditBudget(categoryId: string, monthKey: string, currentValue: number) {
  debugLog('BudgetCategoryColumn3', `startEditBudget called: ${categoryId}-${monthKey}, value: ${currentValue}`);

  const fieldKey = `${categoryId}-${monthKey}`;
  activeEditField.value = fieldKey;
  editValue.value = Math.abs(currentValue).toString();

  debugLog('BudgetCategoryColumn3', `activeEditField set to: ${activeEditField.value}, editValue: ${editValue.value}`);

  nextTick(() => {
    const inputElement = document.querySelector(`input[data-field-key="${fieldKey}"]`) as HTMLInputElement;
    if (inputElement) {
      debugLog('BudgetCategoryColumn3', 'Input element found, focusing and selecting');
      inputElement.focus();
      inputElement.select();
    } else {
      debugLog('BudgetCategoryColumn3', 'Input element not found');
    }
  });
}

function finishEditBudget() {
  activeEditField.value = null;
  editValue.value = '';
}

function handleBudgetKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    finishEditBudget();
  }
}

function isEditingBudget(categoryId: string, monthKey: string): boolean {
  const result = activeEditField.value === `${categoryId}-${monthKey}`;
  // debugLog('BudgetCategoryColumn3', `isEditingBudget(${categoryId}, ${monthKey}): ${result}, activeEditField: ${activeEditField.value}`);
  return result;
}

// Event handlers for hover effects
function handleBudgetMouseEnter(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target) {
    target.classList.add('border-primary');
  }
}

function handleBudgetMouseLeave(event: MouseEvent, categoryId: string, monthKey: string) {
  const target = event.target as HTMLElement;
  if (target && !isEditingBudget(categoryId, monthKey)) {
    target.classList.remove('border-primary');
  }
}

function handleBudgetClick(categoryId: string, monthKey: string) {
  debugLog('BudgetCategoryColumn3', `handleBudgetClick called for category ${categoryId}, month ${monthKey}`);

  if (!isEditingBudget(categoryId, monthKey)) {
    debugLog('BudgetCategoryColumn3', 'Not currently editing, starting edit mode');
    // Find the month data from props.months
    const monthData = props.months.find(m => m.key === monthKey);
    if (monthData) {
      const budgetData = getCategoryBudgetData(categoryId, monthData);
      debugLog('BudgetCategoryColumn3', `Budget data found: ${budgetData.budgeted}`);
      startEditBudget(categoryId, monthKey, budgetData.budgeted);
    } else {
      debugLog('BudgetCategoryColumn3', `Month data not found for key: ${monthKey}`);
    }
  } else {
    debugLog('BudgetCategoryColumn3', 'Already editing this field');
  }
}

// Outside click handler
function handleOutsideClick(event: Event) {
  if (activeEditField.value) {
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' && target.hasAttribute('data-field-key');

    if (!isInputField) {
      finishEditBudget();
    }
  }
}

onMounted(async () => {
  // Add outside click listener
  document.addEventListener('click', handleOutsideClick);
  debugLog('BudgetCategoryColumn3', 'Component mounted, starting initialization');

  await CategoryService.loadCategories();
  debugLog('BudgetCategoryColumn3', 'Categories loaded successfully');

  // Batch-Expansion aller Gruppen über CategoryService
  const groupsToExpand = categoryGroups.value
    .filter(group => !categoryStore.expandedCategoryGroups.has(group.id))
    .map(group => group.id);

  if (groupsToExpand.length > 0) {
    debugLog('BudgetCategoryColumn3', `Expanding ${groupsToExpand.length} category groups`);
    CategoryService.expandCategoryGroupsBatch(groupsToExpand);
  }

  await nextTick();
  debugLog('BudgetCategoryColumn3', 'Starting Muuri grid initialization');

  // Muuri-Initialisierung mit mehreren requestAnimationFrame für bessere Animation-Performance
  requestAnimationFrame(() => {
    debugLog('BudgetCategoryColumn3', 'First animation frame - allowing spinner to animate');
    requestAnimationFrame(() => {
      debugLog('BudgetCategoryColumn3', 'Second animation frame - calling initializeGrids');
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
  // Remove outside click listener
  document.removeEventListener('click', handleOutsideClick);
});

// Watcher für globale Expand/Collapse-Änderungen
watch(() => categoryStore.expandedCategoryGroups, () => {
  nextTick(() => {
    updateLayoutAfterToggle();
  });
}, { deep: true });

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
    debugLog('BudgetCategoryColumn3', `Months changed, updating layout. New count: ${newMonths.length}`);

    // Kurz warten für DOM-Updates
    await nextTick();

    // Layout aller Grids aktualisieren
    updateLayoutAfterMonthsChange();
  }
}, { deep: true });

function initializeGrids() {
  debugLog('BudgetCategoryColumn3', 'initializeGrids() function called');

  try {
    let completedLayouts = 0;
    const totalGrids = 2; // Expense Meta-Grid + Income Meta-Grid

    const checkAllLayoutsComplete = () => {
      completedLayouts++;
      debugLog('BudgetCategoryColumn3', `Layout completed: ${completedLayouts}/${totalGrids}`);
      if (completedLayouts >= totalGrids) {
        debugLog('BudgetCategoryColumn3', 'All Muuri grids layouts completed successfully - emitting muuriReady');
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
        debugLog('BudgetCategoryColumn3', 'Initializing Expense Meta-Grid');
        // Expense Meta-Grid initialisieren
        expenseMetaGrid.value = createMetaGrid('#expense-categories', false);

        // Prüfe sofort, ob Layout bereits abgeschlossen ist, oder warte auf layoutEnd
        if (expenseMetaGrid.value.getItems().length === 0) {
          debugLog('BudgetCategoryColumn3', 'Expense Meta-Grid has no items, layout complete immediately');
          checkAllLayoutsComplete();
        } else {
          expenseMetaGrid.value.on('layoutEnd', () => {
            debugLog('BudgetCategoryColumn3', 'Expense Meta-Grid layout completed via event');
            checkAllLayoutsComplete();
          });
          // Fallback: Prüfe nach kurzer Zeit, ob Layout abgeschlossen ist
          setTimeout(() => {
            if (completedLayouts < 1) {
              debugLog('BudgetCategoryColumn3', 'Expense Meta-Grid layout completed via timeout fallback');
              checkAllLayoutsComplete();
            }
          }, 200);
        }

        // Längerer Delay für Income Meta-Grid um Spinner-Animation zu ermöglichen
        setTimeout(() => {
          try {
            debugLog('BudgetCategoryColumn3', 'Initializing Income Meta-Grid');
            // Income Meta-Grid initialisieren
            incomeMetaGrid.value = createMetaGrid('#income-categories', true);

            // Prüfe sofort, ob Layout bereits abgeschlossen ist, oder warte auf layoutEnd
            if (incomeMetaGrid.value.getItems().length === 0) {
              debugLog('BudgetCategoryColumn3', 'Income Meta-Grid has no items, layout complete immediately');
              checkAllLayoutsComplete();
            } else {
              incomeMetaGrid.value.on('layoutEnd', () => {
                debugLog('BudgetCategoryColumn3', 'Income Meta-Grid layout completed via event');
                checkAllLayoutsComplete();
              });
              // Fallback: Prüfe nach kurzer Zeit, ob Layout abgeschlossen ist
              setTimeout(() => {
                if (completedLayouts < 2) {
                  debugLog('BudgetCategoryColumn3', 'Income Meta-Grid layout completed via timeout fallback');
                  checkAllLayoutsComplete();
                }
              }, 200);
            }

            debugLog('BudgetCategoryColumn3', 'Muuri grids initialized, waiting for layouts to complete');

          } catch (error) {
            errorLog('BudgetCategoryColumn3', 'Failed to initialize Income Meta-Grid', error);
            emit('muuriReady'); // Trotzdem Event emittieren
          }
        }, 100); // Erhöht von 50ms auf 100ms für bessere Animation

      } catch (error) {
        errorLog('BudgetCategoryColumn3', 'Failed to initialize Expense Meta-Grid', error);
        emit('muuriReady'); // Trotzdem Event emittieren
      }
    }, 150); // Erhöht von 100ms auf 150ms für bessere Animation

  } catch (error) {
    errorLog('BudgetCategoryColumn3', 'Failed to initialize Sub-Grids', error);
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
    debugLog('BudgetCategoryColumn3', 'Muuri grids destroyed');
  } catch (error) {
    errorLog('BudgetCategoryColumn3', 'Failed to destroy Muuri grids', error);
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
  debugLog('BudgetCategoryColumn3', 'updateLayoutAfterMonthsChange() called');

  try {
    let completedLayouts = 0;
    const totalGrids = 2; // Expense Meta-Grid + Income Meta-Grid

    const checkAllLayoutsComplete = () => {
      completedLayouts++;
      debugLog('BudgetCategoryColumn3', `Layout update completed: ${completedLayouts}/${totalGrids}`);
      if (completedLayouts >= totalGrids) {
        debugLog('BudgetCategoryColumn3', 'All layouts updated after months change - emitting muuriReady');
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
        debugLog('BudgetCategoryColumn3', 'Expense Meta-Grid has no items, layout complete immediately');
        checkAllLayoutsComplete();
      } else {
        // Einmaliger Event-Listener für layoutEnd
        const handleExpenseLayoutEnd = () => {
          expenseMetaGrid.value?.off('layoutEnd', handleExpenseLayoutEnd);
          debugLog('BudgetCategoryColumn3', 'Expense Meta-Grid layout update completed');
          checkAllLayoutsComplete();
        };
        expenseMetaGrid.value.on('layoutEnd', handleExpenseLayoutEnd);
        expenseMetaGrid.value.layout(true);

        // Fallback nach 300ms
        setTimeout(() => {
          if (completedLayouts < 1) {
            expenseMetaGrid.value?.off('layoutEnd', handleExpenseLayoutEnd);
            debugLog('BudgetCategoryColumn3', 'Expense Meta-Grid layout completed via timeout fallback');
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
        debugLog('BudgetCategoryColumn3', 'Income Meta-Grid has no items, layout complete immediately');
        checkAllLayoutsComplete();
      } else {
        // Einmaliger Event-Listener für layoutEnd
        const handleIncomeLayoutEnd = () => {
          incomeMetaGrid.value?.off('layoutEnd', handleIncomeLayoutEnd);
          debugLog('BudgetCategoryColumn3', 'Income Meta-Grid layout update completed');
          checkAllLayoutsComplete();
        };
        incomeMetaGrid.value.on('layoutEnd', handleIncomeLayoutEnd);
        incomeMetaGrid.value.layout(true);

        // Fallback nach 300ms
        setTimeout(() => {
          if (completedLayouts < 2) {
            incomeMetaGrid.value?.off('layoutEnd', handleIncomeLayoutEnd);
            debugLog('BudgetCategoryColumn3', 'Income Meta-Grid layout completed via timeout fallback');
            checkAllLayoutsComplete();
          }
        }, 300);
      }
    } else {
      checkAllLayoutsComplete();
    }

  } catch (error) {
    errorLog('BudgetCategoryColumn3', 'Failed to update layout after months change', error);
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
        errorLog('BudgetCategoryColumn3', 'handleCategoryDragEnd - Category ID not found');
        return;
      }

      const container = draggedElement.closest('.categories-content');
      const groupWrapper = container?.closest('.group-wrapper');
      const actualGroupId = groupWrapper?.getAttribute('data-group-id');

      if (!actualGroupId) {
        errorLog('BudgetCategoryColumn3', 'handleCategoryDragEnd - Group ID not found');
        return;
      }

      // Bestimme das richtige Sub-Grid
      const allSubGrids = [...expenseSubGrids.value, ...incomeSubGrids.value];
      const targetGrid = allSubGrids.find(grid => {
        const gridElement = grid.getElement();
        return gridElement.closest('.group-wrapper')?.getAttribute('data-group-id') === actualGroupId;
      });

      if (!targetGrid) {
        errorLog('BudgetCategoryColumn3', 'handleCategoryDragEnd - Target grid not found', { actualGroupId });
        return;
      }

      const items = targetGrid.getItems();
      const newOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-category-id');
        if (id) newOrder.push(id);
      });

      debugLog('BudgetCategoryColumn3', 'handleCategoryDragEnd', {
        categoryId,
        actualGroupId,
        newOrder,
        itemsCount: items.length,
        draggedItemPosition: newOrder.indexOf(categoryId)
      });

      const sortOrderUpdates = CategoryService.calculateCategorySortOrder(actualGroupId, newOrder);
      const success = await CategoryService.updateCategoriesWithSortOrder(sortOrderUpdates);

      if (success) {
        debugLog('BudgetCategoryColumn3', 'handleCategoryDragEnd - Sort order updated successfully');
        await reinitializeMuuriGrids();
      } else {
        errorLog('BudgetCategoryColumn3', 'handleCategoryDragEnd - Failed to update sort order');
      }

    } catch (error) {
      errorLog('BudgetCategoryColumn3', 'handleCategoryDragEnd - Error updating sort order', error);
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
        errorLog('BudgetCategoryColumn3', 'handleCategoryGroupDragEnd - Group ID not found');
        return;
      }

      const metaGrid = isIncomeGrid ? incomeMetaGrid.value : expenseMetaGrid.value;
      if (!metaGrid) {
        errorLog('BudgetCategoryColumn3', 'handleCategoryGroupDragEnd - Meta grid not found');
        return;
      }

      const items = metaGrid.getItems();
      const groupsInOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-group-id');
        if (id) groupsInOrder.push(id);
      });

      debugLog('BudgetCategoryColumn3', 'handleCategoryGroupDragEnd', {
        groupId,
        groupsInOrder,
        isIncomeGrid,
        draggedGroupPosition: groupsInOrder.indexOf(groupId)
      });

      const sortOrderUpdates = CategoryService.calculateCategoryGroupSortOrder(groupsInOrder, isIncomeGrid);
      const success = await CategoryService.updateCategoryGroupsWithSortOrder(sortOrderUpdates);

      if (success) {
        debugLog('BudgetCategoryColumn3', 'handleCategoryGroupDragEnd - Sort order updated successfully');
        await reinitializeMuuriGrids();
      } else {
        errorLog('BudgetCategoryColumn3', 'handleCategoryGroupDragEnd - Failed to update sort order');
      }

    } catch (error) {
      errorLog('BudgetCategoryColumn3', 'handleCategoryGroupDragEnd - Error updating sort order', error);
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
}

// UI-Refresh-Funktionen
async function reinitializeMuuriGrids() {
  try {
    debugLog('BudgetCategoryColumn3', 'reinitializeMuuriGrids - Starting grid reinitialization');

    destroyGrids();
    await nextTick();
    initializeGrids();

    debugLog('BudgetCategoryColumn3', 'reinitializeMuuriGrids - Grid reinitialization completed');
  } catch (error) {
    errorLog('BudgetCategoryColumn3', 'reinitializeMuuriGrids - Error during grid reinitialization', error);
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
      "BudgetCategoryColumn3",
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
  debugLog("BudgetCategoryColumn3", "openDropdown", {
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
  modalData.value = { mode: "transfer", clickedCategory: cat, amount: 0, month };
  debugLog("BudgetCategoryColumn3", "optionTransfer", { category: cat });
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
  debugLog("BudgetCategoryColumn3", "optionFill", { category: cat, amount: amt });
  closeDropdown();
  showTransferModal.value = true;
}

function executeTransfer() {
  showTransferModal.value = false;
  debugLog("BudgetCategoryColumn3", "Transfer completed, modal closed");
}

// Transaction Modal Functions
function openTransactionModal(category: Category, month: { key: string; label: string; start: Date; end: Date }) {
  transactionModalData.value = {
    categoryId: category.id,
    month: month
  };
  showTransactionModal.value = true;
  debugLog("BudgetCategoryColumn3", "Transaction modal opened", {
    categoryId: category.id,
    categoryName: category.name,
    month: month.label
  });
}

function closeTransactionModal() {
  showTransactionModal.value = false;
  transactionModalData.value = null;
  debugLog("BudgetCategoryColumn3", "Transaction modal closed");
}

function handleTransactionUpdated() {
  // Refresh budget data after transaction changes
  debugLog("BudgetCategoryColumn3", "Transaction updated, refreshing budget data");
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
          <div class="type-part flex items-center">
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
                    class="text-base-content"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).forecast"
                    :as-integer="true"
                    class="text-base-content"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).spent"
                    :as-integer="true"
                    :class="calculateTypeSummary(false, month).spent >= 0 ? 'text-base-content' : 'text-error'"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(false, month).saldo"
                    :as-integer="true"
                    :class="calculateTypeSummary(false, month).saldo >= 0 ? 'text-success' : 'text-error'"
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
            <!-- Kategoriegruppen-Header mit Summenwerten -->
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
                        class="text-base-content"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).forecast"
                        :as-integer="true"
                        class="text-base-content"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).spent"
                        :as-integer="true"
                        :class="calculateGroupSummary(group.id, month).spent >= 0 ? 'text-base-content' : 'text-error'"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).saldo"
                        :as-integer="true"
                        :class="calculateGroupSummary(group.id, month).saldo >= 0 ? 'text-success' : 'text-error'"
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
                  v-for="category in getCategoriesForGroup(group.id)"
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

                      <div class="flex-shrink-0 flex items-center space-x-1">
                        <div v-if="category.isSavingsGoal" class="w-2 h-2 bg-info rounded-full" title="Sparziel"></div>
                        <div v-if="!category.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
                        <div v-if="category.isHidden" class="w-2 h-2 bg-base-content/30 rounded-full" title="Versteckt"></div>
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
                            class="text-right cursor-pointer transition-all duration-200 rounded px-1 py-0.5 border"
                            :class="{
                              'border-transparent hover:border-primary': !isEditingBudget(category.id, month.key),
                              'border-primary': isEditingBudget(category.id, month.key)
                            }"
                            @click.stop="handleBudgetClick(category.id, month.key)"
                          >
                            <input
                              v-if="isEditingBudget(category.id, month.key)"
                              v-model="editValue"
                              :data-field-key="`${category.id}-${month.key}`"
                              type="text"
                              class="w-full text-right text-xs bg-transparent border-none outline-none text-base-content p-0 m-0"
                              @keydown="handleBudgetKeydown"
                              @click.stop
                            />
                            <CurrencyDisplay
                              v-else
                              :amount="getCategoryBudgetData(category.id, month).budgeted"
                              :as-integer="true"
                              class="text-base-content/80"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).forecast"
                              :as-integer="true"
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
                              class="text-error"
                            />
                          </div>
                          <div
                            class="text-right"
                            :class="{
                              'cursor-context-menu hover:bg-base-200': !category.isIncomeCategory || getCategoryBudgetData(category.id, month).saldo > 0
                            }"
                            @contextmenu="openDropdown($event, category, month)"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).saldo"
                              :as-integer="true"
                              :class="getCategoryBudgetData(category.id, month).saldo >= 0 ? 'text-success' : 'text-error'"
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
          <div class="type-part flex items-center">
            <Icon icon="mdi:trending-up" class="w-4 h-4 mr-2 text-success" />
            <h3 class="font-semibold text-sm text-base-content">Einnahmen</h3>
          </div>

          <!-- Dynamische Typ-Gesamtsummen -->
          <div class="type-values-part flex">
            <div
              v-for="month in months"
              :key="month.key"
              class="month-column flex-1 min-w-[120px] p-0"
            >
              <div class="type-summary-values grid grid-cols-4 gap-1 text-xs font-bold mr-[4%]">
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).budgeted"
                    :as-integer="true"
                    class="text-success"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).forecast"
                    :as-integer="true"
                    class="text-success"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).spent"
                    :as-integer="true"
                    class="text-base-content"
                  />
                </div>
                <div class="text-right">
                  <CurrencyDisplay
                    :amount="calculateTypeSummary(true, month).saldo"
                    :as-integer="true"
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
            <!-- Kategoriegruppen-Header mit Summenwerten -->
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
                  class="month-column flex-1 min-w-[120px] py-2 border-r border-base-300"
                >
                  <div class="group-summary-values grid grid-cols-4 gap-1 text-xs font-semibold mr-[4%]">
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).budgeted"
                        :as-integer="true"
                        class="text-success"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).forecast"
                        :as-integer="true"
                        class="text-success"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).spent"
                        :as-integer="true"
                        class="text-base-content"
                      />
                    </div>
                    <div class="text-right">
                      <CurrencyDisplay
                        :amount="calculateGroupSummary(group.id, month).saldo"
                        :as-integer="true"
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
                  v-for="category in getCategoriesForGroup(group.id)"
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

                      <div class="flex-shrink-0 flex items-center space-x-1">
                        <div v-if="category.isSavingsGoal" class="w-2 h-2 bg-info rounded-full" title="Sparziel"></div>
                        <div v-if="!category.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
                        <div v-if="category.isHidden" class="w-2 h-2 bg-base-content/30 rounded-full" title="Versteckt"></div>
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
                          <div
                            class="text-right cursor-pointer transition-all duration-200 rounded px-1 py-0.5 border"
                            :class="{
                              'border-transparent hover:border-primary': !isEditingBudget(category.id, month.key),
                              'border-primary': isEditingBudget(category.id, month.key)
                            }"
                            @click="handleBudgetClick(category.id, month.key)"
                          >
                            <input
                              v-if="isEditingBudget(category.id, month.key)"
                              v-model="editValue"
                              :data-field-key="`${category.id}-${month.key}`"
                              type="text"
                              class="w-full text-right text-xs bg-transparent border-none outline-none text-success p-0 m-0"
                              @keydown="handleBudgetKeydown"
                              @click.stop
                            />
                            <CurrencyDisplay
                              v-else
                              :amount="getCategoryBudgetData(category.id, month).budgeted"
                              :as-integer="true"
                              class="text-success"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).forecast"
                              :as-integer="true"
                              class="text-success"
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
                              class="text-base-content/80"
                            />
                          </div>
                          <div
                            class="text-right"
                            :class="{
                              'cursor-context-menu hover:bg-base-200': getCategoryBudgetData(category.id, month).saldo > 0
                            }"
                            @contextmenu="openDropdown($event, category, month)"
                          >
                            <CurrencyDisplay
                              :amount="getCategoryBudgetData(category.id, month).saldo"
                              :as-integer="true"
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
        <p class="text-sm font-medium">Keine Kategoriegruppen</p>
        <p class="text-xs mt-1">Erstellen Sie zunächst Kategoriegruppen</p>
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
