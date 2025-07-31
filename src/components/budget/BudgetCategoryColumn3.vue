<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';
import { CategoryService } from '../../services/CategoryService';
import type { CategoryGroup, Category } from '../../types';
import { debugLog, errorLog } from '../../utils/logger';
import CurrencyDisplay from '../ui/CurrencyDisplay.vue';

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

// Mock-Daten für Budget-Werte
interface MockMonthlyBudgetData {
  budgeted: number;
  forecast: number;
  spent: number;
  saldo: number;
}

// Mock-Daten Generator
function generateMockBudgetData(categoryId: string, monthKey: string): MockMonthlyBudgetData {
  // Einfache Hash-Funktion für konsistente Mock-Daten
  const hash = (categoryId + monthKey).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);

  const base = Math.abs(hash) % 1000;
  return {
    budgeted: base + 100,
    forecast: base + 50,
    spent: -(base + 25),
    saldo: base + 125
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

// Expand/Collapse State für jede Gruppe
const expandedGroups = ref<Record<string, boolean>>({});

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

onMounted(async () => {
  await CategoryService.loadCategories();

  // Expand-State für alle Gruppen initialisieren
  for (const group of categoryGroups.value) {
    expandedGroups.value[group.id] = true;
  }

  await nextTick();
  initializeGrids();
});

onUnmounted(() => {
  destroyGrids();
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }
  if (autoExpandTimer.value) {
    clearTimeout(autoExpandTimer.value);
  }
});

function initializeGrids() {
  try {
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

    // Expense Meta-Grid initialisieren
    expenseMetaGrid.value = createMetaGrid('#expense-categories', false);

    // Income Meta-Grid initialisieren
    incomeMetaGrid.value = createMetaGrid('#income-categories', true);

    debugLog('BudgetCategoryColumn3', 'Muuri grids initialized successfully');

    // Event emittieren, dass Muuri-Grids bereit sind
    emit('muuriReady');
  } catch (error) {
    errorLog('BudgetCategoryColumn3', 'Failed to initialize Muuri grids', error);
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
  expandedGroups.value[groupId] = !expandedGroups.value[groupId];

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

    if (groupId && !expandedGroups.value[groupId]) {
      clearAutoExpandTimer();
      autoExpandTimer.value = setTimeout(() => {
        expandedGroups.value[groupId] = true;
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
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Drag Container -->
    <div ref="dragContainer" class="drag-container"></div>

    <!-- Ausgaben-Sektion -->
    <div v-if="expenseGroups.length > 0" class="flex-1">
      <div class="sticky top-0 bg-base-200 px-3 py-2 border-b border-base-300 z-10">
        <div class="flex items-center">
          <Icon icon="mdi:trending-down" class="w-4 h-4 mr-2 text-error" />
          <h3 class="font-semibold text-sm text-base-content">Ausgaben</h3>
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
            <!-- Kategoriegruppen-Header -->
            <div class="group-header flex items-center py-2 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer">
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

              <!-- Gruppenstatus-Indikator -->
              <div class="flex-shrink-0 text-xs text-base-content/60">
                {{ getCategoriesForGroup(group.id).length }} {{ getCategoriesForGroup(group.id).length === 1 ? 'Kategorie' : 'Kategorien' }}
              </div>
            </div>

            <!-- Kategorien-Liste -->
            <div
              v-show="expandedGroups[group.id]"
              class="categories-list"
              :class="{ 'collapsed': !expandedGroups[group.id] }"
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
                    <div class="category-part flex items-center p-0 pl-8 bg-base-50 border-b border-base-300 hover:bg-base-100 cursor-pointer">
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
                        class="month-column flex-1 min-w-[120px] p-1 border-b border-base-300"
                      >
                        <div class="budget-values grid grid-cols-4 gap-1 text-xs">
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).budgeted"
                              :as-integer="true"
                              class="text-base-content/80"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).forecast"
                              :as-integer="true"
                              class="text-base-content/80"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).spent"
                              :as-integer="true"
                              class="text-error"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).saldo"
                              :as-integer="true"
                              :class="generateMockBudgetData(category.id, month.key).saldo >= 0 ? 'text-success' : 'text-error'"
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
    <div v-if="incomeGroups.length > 0" class="flex-1 border-t border-base-300">
      <div class="sticky top-0 bg-base-200 px-3 py-2 border-b border-base-300 z-10">
        <div class="flex items-center">
          <Icon icon="mdi:trending-up" class="w-4 h-4 mr-2 text-success" />
          <h3 class="font-semibold text-sm text-base-content">Einnahmen</h3>
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
            <!-- Kategoriegruppen-Header -->
            <div class="group-header flex items-center py-2 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer">
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

              <!-- Gruppenstatus-Indikator -->
              <div class="flex-shrink-0 text-xs text-base-content/60">
                {{ getCategoriesForGroup(group.id).length }} {{ getCategoriesForGroup(group.id).length === 1 ? 'Kategorie' : 'Kategorien' }}
              </div>
            </div>

            <!-- Kategorien-Liste -->
            <div
              v-show="expandedGroups[group.id]"
              class="categories-list"
              :class="{ 'collapsed': !expandedGroups[group.id] }"
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
                    <div class="category-part flex items-center p-0 pl-8 bg-base-50 border-b border-base-300 hover:bg-base-100 cursor-pointer">
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
                        class="month-column flex-1 min-w-[120px] p-1 border-b border-base-300"
                      >
                        <div class="budget-values grid grid-cols-4 gap-1 text-xs">
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).budgeted"
                              :as-integer="true"
                              class="text-success"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).forecast"
                              :as-integer="true"
                              class="text-success"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).spent"
                              :as-integer="true"
                              class="text-base-content/80"
                            />
                          </div>
                          <div class="text-right">
                            <CurrencyDisplay
                              :amount="generateMockBudgetData(category.id, month.key).saldo"
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
  max-height: 400px;
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
