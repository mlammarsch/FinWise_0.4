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

// Meta-Grids für Kategoriegruppen
const expenseMetaGrid = ref<Muuri | null>(null);
const incomeMetaGrid = ref<Muuri | null>(null);

// Sub-Grids für Kategorien innerhalb der Gruppen
const expenseSubGrids = ref<Muuri[]>([]);
const incomeSubGrids = ref<Muuri[]>([]);

const allSubGrids = computed(() => [...expenseSubGrids.value, ...incomeSubGrids.value]);

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
    // Expense Meta-Grid initialisieren
    const expenseContainer = document.getElementById('expense-categories');
    if (expenseContainer) {
      expenseMetaGrid.value = new Muuri(expenseContainer, {
        items: '.group-wrapper',
        dragEnabled: true,
        dragHandle: '.group-drag-handle',
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

      expenseMetaGrid.value.on('dragEnd', (item: any, event: any) => {
        handleGroupDragEnd(item, event, false); // false = Ausgaben
      });
    }

    // Income Meta-Grid initialisieren
    const incomeContainer = document.getElementById('income-categories');
    if (incomeContainer) {
      incomeMetaGrid.value = new Muuri(incomeContainer, {
        items: '.group-wrapper',
        dragEnabled: true,
        dragHandle: '.group-drag-handle',
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

      incomeMetaGrid.value.on('dragEnd', (item: any, event: any) => {
        handleGroupDragEnd(item, event, true); // true = Einnahmen
      });
    }

    debugLog('BudgetCategoryColumn2', 'Muuri meta-grids initialized successfully');
  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Failed to initialize Muuri meta-grids', error);
  }
}

function destroyMuuri() {
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
    debugLog('BudgetCategoryColumn2', 'Muuri grids destroyed');
  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Failed to destroy Muuri grids', error);
  }
}

// Sub-Grid Ready Handler
function handleSubGridReady(subGrid: Muuri, isIncomeGroup: boolean) {
  if (isIncomeGroup) {
    if (!incomeSubGrids.value.includes(subGrid)) {
      incomeSubGrids.value.push(subGrid);
    }
  } else {
    if (!expenseSubGrids.value.includes(subGrid)) {
      expenseSubGrids.value.push(subGrid);
    }
  }

  debugLog('BudgetCategoryColumn2', `Sub-grid registered for ${isIncomeGroup ? 'income' : 'expense'} group`);
}

// Group Drag End Event Handler
async function handleGroupDragEnd(item: any, event: any, isIncomeGroup: boolean) {
  try {
    const element = item.getElement();
    const groupId = element.getAttribute('data-group-id');

    if (groupId) {
      const metaGrid = isIncomeGroup ? incomeMetaGrid.value : expenseMetaGrid.value;
      if (!metaGrid) return;

      const items = metaGrid.getItems();
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
        metaGrid.refreshItems();
        metaGrid.layout();
      } else {
        errorLog("BudgetCategoryColumn2", "Failed to update group sort order", { groupId });
        metaGrid.layout();
      }
    }
  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Error in handleGroupDragEnd', error);
  }
}

function refreshGrids() {
  nextTick(() => {
    // Meta-Grids refreshen
    if (expenseMetaGrid.value) {
      expenseMetaGrid.value.refreshItems();
      expenseMetaGrid.value.layout(true);
    }
    if (incomeMetaGrid.value) {
      incomeMetaGrid.value.refreshItems();
      incomeMetaGrid.value.layout(true);
    }

    // Sub-Grids refreshen
    allSubGrids.value.forEach(grid => {
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
          :subGrids="allSubGrids"
          class="group-wrapper"
          :data-group-id="group.id"
          @subGridReady="(subGrid) => handleSubGridReady(subGrid, false)"
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
          :subGrids="allSubGrids"
          class="group-wrapper"
          :data-group-id="group.id"
          @subGridReady="(subGrid) => handleSubGridReady(subGrid, true)"
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

.group-wrapper {
  position: absolute;
  display: block;
  margin: 0;
  z-index: 1;
  width: 100%;
}

.group-wrapper.muuri-item-dragging {
  z-index: 3;
  transform: rotate(2deg) !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2) !important;
}

.group-wrapper.muuri-item-releasing {
  z-index: 2;
  transform: rotate(0deg) !important;
}

.group-wrapper.muuri-item-hidden {
  z-index: 0;
}
</style>
