<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';
import { CategoryService } from '../../services/CategoryService';
import type { CategoryGroup, Category } from '../../types';
import { debugLog, errorLog } from '../../utils/logger';

const dragContainer = ref<HTMLElement>();
const metaGrid = ref<Muuri | null>(null);
const subGrids = ref<Muuri[]>([]);

// Reale Daten aus CategoryService
const categoryGroups = CategoryService.getCategoryGroups();
const categoriesByGroup = CategoryService.getCategoriesByGroup();

// Expand/Collapse State für jede Gruppe (dynamisch basierend auf echten Daten)
const expandedGroups = ref<Record<string, boolean>>({});

// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref<NodeJS.Timeout | null>(null);

// Debouncing für Sort Order Updates
const sortOrderUpdateTimer = ref<NodeJS.Timeout | null>(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500; // 500ms Debounce

// Sortierte Kategoriegruppen nach Typ und sortOrder (Ausgaben zuerst, dann Einnahmen)
const sortedCategoryGroups = computed(() => {
  const groups = categoryGroups.value.slice();

  // Trennung nach Typ
  const expenseGroups = groups.filter(g => !g.isIncomeGroup).sort((a, b) => a.sortOrder - b.sortOrder);
  const incomeGroups = groups.filter(g => g.isIncomeGroup).sort((a, b) => a.sortOrder - b.sortOrder);

  return [...expenseGroups, ...incomeGroups];
});

// Hilfsfunktion um zu prüfen, ob eine Trennzeile vor einer Gruppe angezeigt werden soll
const shouldShowSeparator = (group: CategoryGroup, index: number) => {
  if (index === 0) return false;
  const groups = sortedCategoryGroups.value;
  const prevGroup = groups[index - 1];
  // Trennzeile zwischen Ausgaben und Einnahmen
  return !prevGroup.isIncomeGroup && group.isIncomeGroup;
};

// Icon-Mapping für Kategoriegruppen (einheitliches Ordnersymbol)
function getGroupIcon(group: CategoryGroup): string {
  return 'mdi:folder-outline';
}

// Icon-Farbe für Kategoriegruppen (einheitlich in base-content)
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
  // Kategorien laden
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
  // Timer aufräumen
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }
  if (autoExpandTimer.value) {
    clearTimeout(autoExpandTimer.value);
  }
});

function initializeGrids() {
  try {
    // Sub-Grids für Kategorien mit korrekter Kanban-Logik
    const subGridElements = document.querySelectorAll('.categories-content') as NodeListOf<HTMLElement>;

    subGridElements.forEach(el => {
      const grid = new Muuri(el, {
        items: '.category-item',
        dragEnabled: true,
        dragHandle: '.category-drag-area',
        dragContainer: dragContainer.value,
        dragSort: function () {
          return subGrids.value;
        },
        // Kanban-CSS-Properties für korrektes Dragging
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
        if (metaGrid.value) {
          metaGrid.value.refreshItems().layout();
        }
      })
      .on('dragStart', function (item: any) {
        // Auto-Expand bei Drag-Over über eingeklappte Gruppen
        setupAutoExpand();
      })
      .on('dragEnd', function (item: any) {
        // Auto-Expand Timer aufräumen
        clearAutoExpandTimer();
        // Sort Order Update mit Debouncing
        handleCategoryDragEnd(item);
      });

      subGrids.value.push(grid);
    });

    // Meta-Grid für Kategoriegruppen (mit gleicher Kanban-Logik)
    metaGrid.value = new Muuri('.muuri-container', {
      items: '.group-wrapper',
      dragEnabled: true,
      dragHandle: '.group-drag-handle',
      dragContainer: dragContainer.value,
      // Gleiche CSS Properties wie bei den Kategorien
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
      // Sort Order Update für CategoryGroups mit Debouncing
      handleCategoryGroupDragEnd(item);
    });

    console.log('Muuri grids initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Muuri grids', error);
  }
}

function destroyGrids() {
  try {
    subGrids.value.forEach(grid => {
      if (grid) {
        grid.destroy();
      }
    });
    subGrids.value = [];

    if (metaGrid.value) {
      metaGrid.value.destroy();
      metaGrid.value = null;
    }
    console.log('Muuri grids destroyed');
  } catch (error) {
    console.error('Failed to destroy Muuri grids', error);
  }
}

// Expand/Collapse Funktionen
function toggleGroup(groupId: string) {
  expandedGroups.value[groupId] = !expandedGroups.value[groupId];

  // Layout nach Zustandsänderung aktualisieren
  nextTick(() => {
    updateLayoutAfterToggle();
  });
}

function updateLayoutAfterToggle() {
  // Alle Sub-Grids refreshen
  subGrids.value.forEach(grid => {
    if (grid) {
      grid.refreshItems();
      grid.layout(true);
    }
  });

  // Meta-Grid refreshen
  if (metaGrid.value) {
    metaGrid.value.refreshItems();
    metaGrid.value.layout(true);
  }
}

// Auto-Expand bei Drag-Over
function setupAutoExpand() {
  // Event Listener für Drag-Over auf Gruppen-Header
  document.addEventListener('dragover', handleDragOverGroup);
}

function handleDragOverGroup(event: DragEvent) {
  const target = event.target as HTMLElement;
  const groupHeader = target.closest('.group-header');

  if (groupHeader) {
    const groupWrapper = groupHeader.closest('.group-wrapper');
    const groupId = groupWrapper?.getAttribute('data-group-id');

    if (groupId && !expandedGroups.value[groupId]) {
      // Timer für Auto-Expand setzen (1 Sekunde Verzögerung)
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
  // Debouncing: Vorherigen Timer löschen
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const draggedElement = item.getElement();
      const categoryId = draggedElement.getAttribute('data-category-id');
      const newGroupId = draggedElement.getAttribute('data-group-id');

      if (!categoryId) {
        errorLog('MuuriTestView', 'handleCategoryDragEnd - Category ID not found');
        return;
      }

      // Bestimme die neue Gruppe basierend auf dem Container
      const container = draggedElement.closest('.categories-content');
      const groupWrapper = container?.closest('.group-wrapper');
      const actualGroupId = groupWrapper?.getAttribute('data-group-id');

      if (!actualGroupId) {
        errorLog('MuuriTestView', 'handleCategoryDragEnd - Group ID not found');
        return;
      }

      // Hole die neue Reihenfolge direkt vom Muuri-Grid statt vom DOM
      const targetGrid = subGrids.value.find(grid => {
        const gridElement = grid.getElement();
        return gridElement.closest('.group-wrapper')?.getAttribute('data-group-id') === actualGroupId;
      });

      if (!targetGrid) {
        errorLog('MuuriTestView', 'handleCategoryDragEnd - Target grid not found', { actualGroupId });
        return;
      }

      // Hole die Items in der aktuellen Muuri-Reihenfolge
      const items = targetGrid.getItems();
      const newOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-category-id');
        if (id) newOrder.push(id);
      });

      debugLog('MuuriTestView', 'handleCategoryDragEnd', {
        categoryId,
        actualGroupId,
        newOrder,
        itemsCount: items.length,
        draggedItemPosition: newOrder.indexOf(categoryId)
      });

      // Berechne Sort Order Updates
      const sortOrderUpdates = CategoryService.calculateCategorySortOrder(actualGroupId, newOrder);

      // Einzelne Updates durchführen
      const success = await CategoryService.updateCategoriesWithSortOrder(sortOrderUpdates);

      if (success) {
        debugLog('MuuriTestView', 'handleCategoryDragEnd - Sort order updated successfully');
        // UI-Refresh nach erfolgreichem Update
        await reinitializeMuuriGrids();
      } else {
        errorLog('MuuriTestView', 'handleCategoryDragEnd - Failed to update sort order');
      }

    } catch (error) {
      errorLog('MuuriTestView', 'handleCategoryDragEnd - Error updating sort order', error);
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
}

// Drag & Drop Persistierung für CategoryGroups
function handleCategoryGroupDragEnd(item: any) {
  // Debouncing: Vorherigen Timer löschen
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const draggedElement = item.getElement();
      const groupId = draggedElement.getAttribute('data-group-id');

      if (!groupId) {
        errorLog('MuuriTestView', 'handleCategoryGroupDragEnd - Group ID not found');
        return;
      }

      // Hole die neue Reihenfolge direkt vom Meta-Grid
      if (!metaGrid.value) {
        errorLog('MuuriTestView', 'handleCategoryGroupDragEnd - Meta grid not found');
        return;
      }

      const items = metaGrid.value.getItems();
      const allGroupsInOrder: string[] = [];
      const expenseGroups: string[] = [];
      const incomeGroups: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-group-id');
        if (!id) return;

        allGroupsInOrder.push(id);

        // Bestimme ob es eine Einnahmen- oder Ausgabengruppe ist
        const group = categoryGroups.value.find(g => g.id === id);
        if (group?.isIncomeGroup) {
          incomeGroups.push(id);
        } else {
          expenseGroups.push(id);
        }
      });

      debugLog('MuuriTestView', 'handleCategoryGroupDragEnd', {
        groupId,
        allGroupsInOrder,
        expenseGroups,
        incomeGroups,
        draggedGroupPosition: allGroupsInOrder.indexOf(groupId),
        draggedGroupType: categoryGroups.value.find(g => g.id === groupId)?.isIncomeGroup ? 'income' : 'expense'
      });

      // Berechne Sort Order Updates für beide Typen separat
      const expenseUpdates = CategoryService.calculateCategoryGroupSortOrder(expenseGroups, false);
      const incomeUpdates = CategoryService.calculateCategoryGroupSortOrder(incomeGroups, true);

      // Kombiniere alle Updates
      const allUpdates = [...expenseUpdates, ...incomeUpdates];

      // Einzelne Updates durchführen
      const success = await CategoryService.updateCategoryGroupsWithSortOrder(allUpdates);

      if (success) {
        debugLog('MuuriTestView', 'handleCategoryGroupDragEnd - Sort order updated successfully');
        // UI-Refresh nach erfolgreichem Update
        await reinitializeMuuriGrids();
      } else {
        errorLog('MuuriTestView', 'handleCategoryGroupDragEnd - Failed to update sort order');
      }

    } catch (error) {
      errorLog('MuuriTestView', 'handleCategoryGroupDragEnd - Error updating sort order', error);
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
}

// UI-Refresh-Funktionen
async function refreshMuuriGrids() {
  try {
    debugLog('MuuriTestView', 'refreshMuuriGrids - Starting UI refresh');

    // Warte kurz, damit die reaktiven Updates von Vue durchgeführt werden
    await nextTick();

    // Alle Sub-Grids refreshen und neu layouten
    subGrids.value.forEach((grid, index) => {
      if (grid) {
        try {
          grid.refreshItems();
          grid.layout(true); // force layout
          debugLog('MuuriTestView', `refreshMuuriGrids - Sub-grid ${index} refreshed`);
        } catch (error) {
          errorLog('MuuriTestView', `refreshMuuriGrids - Error refreshing sub-grid ${index}`, error);
        }
      }
    });

    // Meta-Grid refreshen und neu layouten
    if (metaGrid.value) {
      try {
        metaGrid.value.refreshItems();
        metaGrid.value.layout(true); // force layout
        debugLog('MuuriTestView', 'refreshMuuriGrids - Meta-grid refreshed');
      } catch (error) {
        errorLog('MuuriTestView', 'refreshMuuriGrids - Error refreshing meta-grid', error);
      }
    }

    debugLog('MuuriTestView', 'refreshMuuriGrids - UI refresh completed');
  } catch (error) {
    errorLog('MuuriTestView', 'refreshMuuriGrids - Error during UI refresh', error);
  }
}

// Alternative: Vollständige Neuinitialisierung der Grids (falls nötig)
async function reinitializeMuuriGrids() {
  try {
    debugLog('MuuriTestView', 'reinitializeMuuriGrids - Starting grid reinitialization');

    // Grids zerstören
    destroyGrids();

    // Warten auf Vue-Updates
    await nextTick();

    // Grids neu initialisieren
    initializeGrids();

    debugLog('MuuriTestView', 'reinitializeMuuriGrids - Grid reinitialization completed');
  } catch (error) {
    errorLog('MuuriTestView', 'reinitializeMuuriGrids - Error during grid reinitialization', error);
  }
}
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-center mb-2">Kategorien Drag & Drop Test</h1>
      <div class="w-full h-1 bg-gradient-to-r from-blue-400 via-orange-400 to-green-400 rounded"></div>
    </div>

    <!-- Drag Container wie im Kanban -->
    <div ref="dragContainer" class="drag-container"></div>

    <!-- Muuri Container für Kategoriegruppen (BudgetCategoryColumn2 Design) -->
    <div class="muuri-container bg-base-100 rounded-lg p-4">
      <!-- Kategoriegruppen (sortiert nach Typ und sortOrder) -->
      <div
        v-for="(group, index) in sortedCategoryGroups"
        :key="group.id"
        class="group-wrapper"
        :data-group-id="group.id"
      >
        <!-- Trennzeile zwischen Ausgaben und Einnahmen -->
        <div v-if="shouldShowSeparator(group, index)" class="type-separator mb-4 mt-2">
          <div class="flex items-center">
            <div class="flex-grow h-px bg-base-300"></div>
            <div class="px-4 text-sm font-medium text-base-content/60 bg-base-100">
              Einnahmen
            </div>
            <div class="flex-grow h-px bg-base-300"></div>
          </div>
        </div>

        <div class="category-group-row border-t border-b border-base-300">
          <!-- Kategoriegruppen-Header -->
          <div class="group-header flex items-center p-3 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer">
            <!-- Drag Handle für Gruppe -->
            <div class="group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
              <Icon icon="mdi:drag-vertical" class="w-4 h-4 text-base-content/60" />
            </div>

            <!-- Expand/Collapse Chevron -->
            <div
              class="flex-shrink-0 mr-3 cursor-pointer hover:bg-base-200 rounded-full p-2 transition-colors"
              @click.stop="toggleGroup(group.id)"
              title="Gruppe ein-/ausklappen"
            >
              <Icon
                icon="mdi:chevron-up"
                class="w-5 h-5 text-base-content transition-transform duration-300 ease-in-out"
                :class="{ 'rotate-180': !expandedGroups[group.id] }"
              />
            </div>

            <!-- Gruppen-Icon (dynamisch basierend auf Typ) -->
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

          <!-- Kategorien-Liste (mit Expand/Collapse und Scrollbalken) -->
          <div
            v-show="expandedGroups[group.id]"
            class="categories-list"
            :class="{ 'collapsed': !expandedGroups[group.id] }"
          >
            <div class="categories-content">
              <!-- Kategorien (sortiert nach sortOrder) -->
              <div
                v-for="category in getCategoriesForGroup(group.id)"
                :key="category.id"
                class="category-item"
                :data-category-id="category.id"
                :data-group-id="group.id"
              >
                <div class="flex items-center p-2 pl-8 bg-base-50 border-b border-base-300 hover:bg-base-100 cursor-pointer">
                  <!-- Erweiterte Drag-Area (Handle + Name) -->
                  <div class="category-drag-area flex items-center flex-grow">
                    <!-- Drag Handle für Kategorie -->
                    <div class="category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                      <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
                    </div>

                    <!-- Kategorie-Icon (falls vorhanden) -->
                    <div v-if="category.icon" class="flex-shrink-0 mr-2">
                      <Icon :icon="category.icon" class="w-3 h-3 text-base-content/70" />
                    </div>

                    <!-- Kategoriename (auch draggable) -->
                    <div class="flex-grow category-name-drag">
                      <span class="text-sm text-base-content">{{ category.name }}</span>
                    </div>
                  </div>

                  <!-- Kategorie-Status-Indikatoren (außerhalb der Drag-Area) -->
                  <div class="flex-shrink-0 flex items-center space-x-1">
                    <div v-if="category.isSavingsGoal" class="w-2 h-2 bg-info rounded-full" title="Sparziel"></div>
                    <div v-if="!category.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
                    <div v-if="category.isHidden" class="w-2 h-2 bg-base-content/30 rounded-full" title="Versteckt"></div>
                    <div v-if="category.isActive && !category.isHidden && !category.isSavingsGoal" class="w-2 h-2 bg-success rounded-full" title="Aktiv"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 text-center text-gray-600">
      <p class="mb-2">🎯 Drag group headers to reorder groups</p>
      <p class="mb-2">📦 Drag categories within groups or between groups</p>
      <p class="mb-2">📱 Elements follow mouse cursor smoothly</p>
      <p class="text-xs">📊 Daten aus CategoryService - sortiert nach sortOrder</p>
    </div>
  </div>
</template>

<style scoped>
/* Drag Container wie im Kanban */
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
  margin: 0 0 0.5rem 0;
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

/* CategoryGroupRow2 Design */
.category-group-row {
  border-radius: 0.5rem;
  overflow: hidden;
  background: hsl(var(--b1));
  margin-bottom: 0.5rem;
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

.category-item {
  position: absolute;
  display: block;
  width: 100%;
  margin: 0;
  z-index: 1;
}

.category-item:last-child .flex:last-child {
  border-bottom: none;
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
.category-item:hover .category-drag-handle {
  opacity: 1;
}

.category-item:hover .category-drag-area {
  background-color: hsl(var(--b2) / 0.3);
}

/* Muuri Drag States für Kategorien (wie im Kanban) */
.category-item.muuri-item-dragging {
  z-index: 9999 !important;
  cursor: move !important;
}

.category-item.muuri-item-releasing {
  z-index: 9998 !important;
}

.category-item.muuri-item-hidden {
  z-index: 0 !important;
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

/* Trennzeile Styling */
.type-separator {
  position: relative;
  z-index: 10;
}
</style>
