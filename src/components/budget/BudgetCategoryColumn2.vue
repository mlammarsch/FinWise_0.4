<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue';
import { useCategoryStore } from '../../stores/categoryStore';
import CategoryGroupRow2 from './CategoryGroupRow2.vue';
import { Icon } from '@iconify/vue';
import type { CategoryGroup, Category } from '../../types';
import Muuri from 'muuri';
import { CategoryService } from '../../services/CategoryService';
import { debugLog, errorLog } from '../../utils/logger';

const categoryStore = useCategoryStore();

// Muuri-Instanzen
const expenseGrid = ref<Muuri | null>(null);
const incomeGrid = ref<Muuri | null>(null);

const grids = computed(() => [expenseGrid.value, incomeGrid.value].filter(g => g));

// Computed Properties für Kategoriegruppen
const expenseGroups = computed(() => {
  return categoryStore.categoryGroups.filter((group: CategoryGroup) => !group.isIncomeGroup)
    .sort((a: CategoryGroup, b: CategoryGroup) => a.sortOrder - b.sortOrder);
});

const incomeGroups = computed(() => {
  return categoryStore.categoryGroups.filter((group: CategoryGroup) => group.isIncomeGroup)
    .sort((a: CategoryGroup, b: CategoryGroup) => a.sortOrder - b.sortOrder);
});

const categoriesByGroup = computed(() => {
  const grouped: Record<string, Category[]> = {};

  for (const group of categoryStore.categoryGroups) {
    // Kategoriegruppen sind Kategorien ohne parentCategoryId
    const groupCategories = categoryStore.categories
      .filter((cat: Category) => cat.categoryGroupId === group.id && !cat.parentCategoryId)
      .sort((a: Category, b: Category) => a.sortOrder - b.sortOrder);

    grouped[group.id] = groupCategories;
  }

  return grouped;
});

// Muuri-Initialisierung
onMounted(async () => {
  await nextTick();
  initializeMuuri();
});

onUnmounted(() => {
  destroyMuuri();
});

function initializeMuuri() {
  try {
    // Expense Grid initialisieren
    const expenseContainer = document.getElementById('expense-categories');
    if (expenseContainer) {
      expenseGrid.value = new Muuri(expenseContainer, {
        items: '.muuri-item',
        dragEnabled: true,
        dragHandle: '.drag-handle',
        dragSort: () => [expenseGrid.value, incomeGrid.value].filter(g => g) as Muuri[],
        dragSortPredicate: {
          threshold: 50,
          action: 'move'
        },
        dragSortHeuristics: {
          sortInterval: 100,
          minDragDistance: 10,
          minBounceBackAngle: 1
        },
        layout: {
          fillGaps: false,
          horizontal: false,
          alignRight: false,
          alignBottom: false
        }
      });

      expenseGrid.value.on('dragEnd', (item, event) => {
        handleDragEnd(item, event, false); // false = Ausgaben
      });
    }

    // Income Grid initialisieren
    const incomeContainer = document.getElementById('income-categories');
    if (incomeContainer) {
      incomeGrid.value = new Muuri(incomeContainer, {
        items: '.muuri-item',
        dragEnabled: true,
        dragHandle: '.drag-handle',
        dragSort: () => [expenseGrid.value, incomeGrid.value].filter(g => g) as Muuri[],
        dragSortPredicate: {
          threshold: 50,
          action: 'move'
        },
        dragSortHeuristics: {
          sortInterval: 100,
          minDragDistance: 10,
          minBounceBackAngle: 1
        },
        layout: {
          fillGaps: false,
          horizontal: false,
          alignRight: false,
          alignBottom: false
        }
      });

      incomeGrid.value.on('dragEnd', (item, event) => {
        handleDragEnd(item, event, true); // true = Einnahmen
      });
    }

    debugLog('BudgetCategoryColumn2', 'Muuri grids initialized successfully');
  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Failed to initialize Muuri grids', error);
  }
}

function destroyMuuri() {
  try {
    if (expenseGrid.value) {
      expenseGrid.value.destroy();
      expenseGrid.value = null;
    }
    if (incomeGrid.value) {
      incomeGrid.value.destroy();
      incomeGrid.value = null;
    }
    debugLog('BudgetCategoryColumn2', 'Muuri grids destroyed');
  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Failed to destroy Muuri grids', error);
  }
}

// Drag End Event Handler
function handleDragEnd(item: any, event: any, isIncomeGroup: boolean) {
  try {
    const element = item.getElement();
    const groupId = element.getAttribute('data-group-id');
    const categoryId = element.getAttribute('data-category-id');

    if (categoryId) {
      // Kategorie wurde verschoben
      handleCategoryDrop(categoryId, item, isIncomeGroup);
    } else if (groupId) {
      handleGroupDrop(groupId, item, isIncomeGroup);
    }
  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Error in handleDragEnd', error);
  }
}

// Kategorie-Drop-Handler
async function handleCategoryDrop(categoryId: string, item: any, isIncomeGroup: boolean) {
  const grid = isIncomeGroup ? incomeGrid.value : expenseGrid.value;
  if (!grid) return;

  try {
    const items = grid.getItems();
    const currentIndex = items.indexOf(item);
    const newSortOrder = currentIndex;

    const success = await CategoryService.updateCategory(categoryId, {
      sortOrder: newSortOrder,
    });

    if (success) {
      debugLog("BudgetCategoryColumn2", "Category drop handled successfully", {
        categoryId,
        newSortOrder,
        isIncomeGroup,
      });
      grid.refreshItems();
      grid.layout();
    } else {
      errorLog("BudgetCategoryColumn2", "Failed to update category sort order", { categoryId });
      grid.layout();
    }
  } catch (error) {
    errorLog("BudgetCategoryColumn2", "Error in handleCategoryDrop", error);
    grid.layout();
  }
}

// Kategoriegruppen-Drop-Handler
async function handleGroupDrop(groupId: string, item: any, isIncomeGroup: boolean) {
  const grid = isIncomeGroup ? incomeGrid.value : expenseGrid.value;
  if (!grid) return;

  try {
    const items = grid.getItems();
    const currentIndex = items.indexOf(item);
    const newSortOrder = currentIndex;

    const success = await CategoryService.updateCategoryGroup(groupId, {
      sortOrder: newSortOrder,
    });

    if (success) {
      debugLog("BudgetCategoryColumn2", "Group drop handled successfully", {
        groupId,
        newSortOrder,
        isIncomeGroup,
      });
      grid.refreshItems();
      grid.layout();
    } else {
      errorLog("BudgetCategoryColumn2", "Failed to update group sort order", { groupId });
      grid.layout();
    }
  } catch (error) {
    errorLog("BudgetCategoryColumn2", "Error in handleGroupDrop", error);
    grid.layout();
  }
}

function refreshGrids() {
  nextTick(() => {
    grids.value.forEach(grid => {
      if (grid) {
        grid.refreshItems();
        grid.layout(true);
      }
    });
  });
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Ausgaben-Sektion -->
    <div v-if="expenseGroups.length > 0" class="flex-1">
      <div class="sticky top-0 bg-base-200 px-3 py-2 border-b border-base-300 z-10">
        <div class="flex items-center">
          <Icon icon="mdi:trending-down" class="w-4 h-4 mr-2 text-error" />
          <h3 class="font-semibold text-sm text-base-content">Ausgaben</h3>
        </div>
      </div>

      <div class="muuri-container" id="expense-categories">
        <CategoryGroupRow2
          v-for="group in expenseGroups"
          :key="group.id"
          :group="group"
          :categories="categoriesByGroup[group.id] || []"
          class="muuri-item"
          :data-group-id="group.id"
          @toggle="refreshGrids"
        />
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

      <div class="muuri-container" id="income-categories">
        <CategoryGroupRow2
          v-for="group in incomeGroups"
          :key="group.id"
          :group="group"
          :categories="categoriesByGroup[group.id] || []"
          class="muuri-item"
          :data-group-id="group.id"
          @toggle="refreshGrids"
        />
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
.muuri-container {
  position: relative;
  min-height: 100px;
}

.muuri-item {
  position: absolute;
  display: block;
  margin: 0;
  z-index: 1;
  width: 100%;
}

.muuri-item.muuri-item-dragging {
  z-index: 3;
}

.muuri-item.muuri-item-releasing {
  z-index: 2;
}

.muuri-item.muuri-item-hidden {
  z-index: 0;
}
</style>
