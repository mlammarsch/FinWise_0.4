<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useCategoryStore } from '../../stores/categoryStore';
import { Icon } from '@iconify/vue';
import type { CategoryGroup, Category } from '../../types';
import Muuri from 'muuri';
import { CategoryService } from '../../services/CategoryService';
import { debugLog, errorLog } from '../../utils/logger';

interface Props {
  group: CategoryGroup;
  categories: Category[];
  subGrids?: Muuri[];
}

const props = defineProps<Props>();
const categoryStore = useCategoryStore();

// Muuri Sub-Grid für diese Kategoriengruppe
const subGrid = ref<Muuri | null>(null);
const subGridContainer = ref<HTMLElement | null>(null);

// Kategorien sind immer erweitert angezeigt
const isExpanded = ref(true);

const emit = defineEmits(['subGridReady']);

// Drag-Over Handler (vereinfacht, da immer erweitert)
function handleDragOver(event: DragEvent) {
  // Kategorien sind immer sichtbar, keine Aktion erforderlich
}

// Sub-Grid Initialisierung
function initializeSubGrid() {
  if (!subGridContainer.value || subGrid.value) return;

  try {
    subGrid.value = new Muuri(subGridContainer.value, {
      items: '.category-item',
      dragEnabled: true,
      dragHandle: '.category-drag-handle',
      dragContainer: document.body,
      dragSort: function () {
        // Verbindung zu allen anderen Sub-Grids
        return props.subGrids || [];
      },
      dragPlaceholder: {
        enabled: true,
        createElement: function(item) {
          return document.createElement('div');
        }
      },
      dragRelease: {
        duration: 400,
        easing: 'ease',
        useDragContainer: true
      },
      layout: {
        fillGaps: false,
        horizontal: false,
        alignRight: false,
        alignBottom: false,
        rounding: false
      },
      layoutDuration: 300,
      layoutEasing: 'ease'
    });

    // Event-Handler für Drag-Operationen
    subGrid.value.on('send', function(data) {
      debugLog('CategoryGroupRow2', `Category sent from group ${props.group.id}`);
      handleCategorySend(data);
    });

    subGrid.value.on('receive', function(data) {
      debugLog('CategoryGroupRow2', `Category received in group ${props.group.id}`);
      handleCategoryReceive(data);
    });

    subGrid.value.on('dragEnd', function(item) {
      handleCategoryDragEnd(item);
    });

    // Sub-Grid an Parent-Komponente melden
    emit('subGridReady', subGrid.value);

    debugLog('CategoryGroupRow2', `Sub-grid initialized for group ${props.group.id}`);
  } catch (error) {
    errorLog('CategoryGroupRow2', 'Failed to initialize sub-grid', error);
  }
}

// Sub-Grid zerstören
function destroySubGrid() {
  if (subGrid.value) {
    try {
      subGrid.value.destroy();
      subGrid.value = null;
      debugLog('CategoryGroupRow2', `Sub-grid destroyed for group ${props.group.id}`);
    } catch (error) {
      errorLog('CategoryGroupRow2', 'Failed to destroy sub-grid', error);
    }
  }
}

// Kategorie-Send Handler
async function handleCategorySend(data: any) {
  const item = data.item;
  const element = item.getElement();
  const categoryId = element.getAttribute('data-category-id');

  if (categoryId) {
    try {
      // Kategorie aus aktueller Gruppe entfernen (wird durch Muuri automatisch gemacht)
      debugLog('CategoryGroupRow2', `Category ${categoryId} sent from group ${props.group.id}`);
    } catch (error) {
      errorLog('CategoryGroupRow2', 'Error handling category send', error);
    }
  }
}

// Kategorie-Receive Handler
async function handleCategoryReceive(data: any) {
  const item = data.item;
  const element = item.getElement();
  const categoryId = element.getAttribute('data-category-id');

  if (categoryId) {
    try {
      // Kategorie der neuen Gruppe zuweisen
      const success = await CategoryService.updateCategory(categoryId, {
        categoryGroupId: props.group.id,
        sortOrder: data.toIndex || 0
      });

      if (success) {
        debugLog('CategoryGroupRow2', `Category ${categoryId} successfully moved to group ${props.group.id}`);
        // Element-Attribute aktualisieren
        element.setAttribute('data-group-id', props.group.id);
      } else {
        errorLog('CategoryGroupRow2', `Failed to update category ${categoryId} group assignment`);
      }
    } catch (error) {
      errorLog('CategoryGroupRow2', 'Error handling category receive', error);
    }
  }
}

// Kategorie-DragEnd Handler
async function handleCategoryDragEnd(item: any) {
  const element = item.getElement();
  const categoryId = element.getAttribute('data-category-id');

  if (categoryId && subGrid.value) {
    try {
      const items = subGrid.value.getItems();
      const currentIndex = items.indexOf(item);

      const success = await CategoryService.updateCategory(categoryId, {
        sortOrder: currentIndex
      });

      if (success) {
        debugLog('CategoryGroupRow2', `Category ${categoryId} sort order updated to ${currentIndex}`);
      } else {
        errorLog('CategoryGroupRow2', `Failed to update category ${categoryId} sort order`);
      }
    } catch (error) {
      errorLog('CategoryGroupRow2', 'Error handling category drag end', error);
    }
  }
}

// Untergeordnete Kategorien für jede Hauptkategorie
function getChildCategories(parentId: string): Category[] {
  return categoryStore.categories
    .filter((cat: Category) => cat.parentCategoryId === parentId)
    .sort((a: Category, b: Category) => a.sortOrder - b.sortOrder);
}

// Lifecycle - Sub-Grid immer initialisieren da immer erweitert
onMounted(() => {
  nextTick(() => {
    initializeSubGrid();
  });
});

onUnmounted(() => {
  destroySubGrid();
});

// Watch für Kategorien-Änderungen
watch(() => props.categories, () => {
  if (subGrid.value) {
    nextTick(() => {
      subGrid.value?.refreshItems();
      subGrid.value?.layout();
    });
  }
}, { deep: true });
</script>

<template>
  <div class="category-group-row">
    <!-- Kategoriegruppen-Header -->
    <div
      class="group-header flex items-center p-3 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer"
      @dragover.prevent="handleDragOver"
    >
      <!-- Drag Handle für Gruppe -->
      <div class="group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
        <Icon icon="mdi:drag-vertical" class="w-4 h-4 text-base-content/60" />
      </div>


      <!-- Gruppenname -->
      <div class="flex-grow">
        <h4 class="font-semibold text-sm text-base-content">{{ group.name }}</h4>
      </div>

      <!-- Gruppenstatus-Indikator -->
      <div class="flex-shrink-0 text-xs text-base-content/60">
        {{ categories.length }} {{ categories.length === 1 ? 'Kategorie' : 'Kategorien' }}
      </div>
    </div>

    <!-- Kategorien-Liste (immer sichtbar) -->
    <div
      class="categories-list"
      ref="subGridContainer"
    >
      <!-- Hauptkategorien -->
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        :data-category-id="category.id"
        :data-group-id="group.id"
      >
        <!-- Hauptkategorie -->
        <div class="flex items-center p-2 pl-8 bg-base-50 border-b border-base-200 hover:bg-base-100 cursor-pointer">
          <!-- Drag Handle für Kategorie -->
          <div class="category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
            <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
          </div>

          <!-- Kategorie-Icon (falls vorhanden) -->
          <div v-if="category.icon" class="flex-shrink-0 mr-2">
            <Icon :icon="category.icon" class="w-4 h-4 text-base-content/70" />
          </div>

          <!-- Kategoriename -->
          <div class="flex-grow">
            <span class="text-sm text-base-content">{{ category.name }}</span>
          </div>

          <!-- Kategorie-Status-Indikatoren -->
          <div class="flex-shrink-0 flex items-center space-x-1">
            <div v-if="category.isSavingsGoal" class="w-2 h-2 bg-info rounded-full" title="Sparziel"></div>
            <div v-if="!category.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
            <div v-if="category.isHidden" class="w-2 h-2 bg-base-content/30 rounded-full" title="Versteckt"></div>
          </div>
        </div>

        <!-- Unterkategorien -->
        <div
          v-for="childCategory in getChildCategories(category.id)"
          :key="childCategory.id"
          class="category-item"
          :data-category-id="childCategory.id"
          :data-group-id="group.id"
        >
          <div class="flex items-center p-2 pl-12 bg-base-25 border-b border-base-200 hover:bg-base-50 cursor-pointer">
            <!-- Drag Handle für Unterkategorie -->
            <div class="category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
              <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
            </div>

            <!-- Unterkategorie-Icon (falls vorhanden) -->
            <div v-if="childCategory.icon" class="flex-shrink-0 mr-2">
              <Icon :icon="childCategory.icon" class="w-3 h-3 text-base-content/60" />
            </div>

            <!-- Unterkategoriename -->
            <div class="flex-grow">
              <span class="text-xs text-base-content/80">{{ childCategory.name }}</span>
            </div>

            <!-- Unterkategorie-Status-Indikatoren -->
            <div class="flex-shrink-0 flex items-center space-x-1">
              <div v-if="childCategory.isSavingsGoal" class="w-1.5 h-1.5 bg-info rounded-full" title="Sparziel"></div>
              <div v-if="!childCategory.isActive" class="w-1.5 h-1.5 bg-warning rounded-full" title="Inaktiv"></div>
              <div v-if="childCategory.isHidden" class="w-1.5 h-1.5 bg-base-content/30 rounded-full" title="Versteckt"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-group-row {
  border: 1px solid hsl(var(--bc) / 0.2);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
  background: hsl(var(--b1));
}

.group-header {
  background: linear-gradient(to right, hsl(var(--b1)), hsl(var(--b2)));
}

.categories-list {
  position: relative;
  min-height: 50px;
  max-height: 400px;
  overflow-y: auto;
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

/* Drag Handle Styles für Muuri */
.group-drag-handle,
.category-drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease;
}

.group-drag-handle:active,
.category-drag-handle:active {
  cursor: grabbing;
}

/* Hover-Effekte */
.group-header:hover .group-drag-handle,
.category-item:hover .category-drag-handle {
  opacity: 1;
}

/* Muuri Drag States für Kategorien */
.category-item.muuri-item-dragging {
  z-index: 1000 !important;
  cursor: grabbing !important;
  transform: scale(1.05) rotate(3deg) !important;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2) !important;
  transition: transform 200ms ease, box-shadow 200ms ease !important;
  pointer-events: none !important;
}

.category-item.muuri-item-releasing {
  z-index: 2 !important;
  transform: scale(1) rotate(0deg) !important;
  transition: transform 400ms ease, box-shadow 400ms ease !important;
  pointer-events: auto !important;
}

.category-item.muuri-item-hidden {
  z-index: 0 !important;
  opacity: 0 !important;
}

/* Placeholder styling für den "freien Platz" Effekt */
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

/* Sicherstellen, dass gezogene Items im Body-Container richtig gestylt sind */
body > .category-item.muuri-item-dragging {
  position: fixed !important;
  z-index: 9999 !important;
  pointer-events: none !important;
  transform: scale(1.05) rotate(3deg) !important;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4) !important;
}

/* Custom Tailwind-Klassen für bessere Abstufungen */
.bg-base-25 {
  background-color: color-mix(in srgb, hsl(var(--b1)) 75%, hsl(var(--b2)) 25%);
}

.categories-list {
  max-height: 400px;
  overflow-y: auto;
}

.category-item:last-child .flex:last-child {
  border-bottom: none;
}

/* Drag Handle Styles für Muuri */
.drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease;
}

.drag-handle:active {
  cursor: grabbing;
}

/* Hover-Effekte */
.group-header:hover .drag-handle,
.category-item:hover .drag-handle {
  opacity: 1;
}

/* Muuri Drag States */
.muuri-item-dragging {
  z-index: 3;
  opacity: 0.8;
  transform: rotate(2deg);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.muuri-item-releasing {
  z-index: 2;
}

.muuri-item-hidden {
  z-index: 0;
  opacity: 0;
}

/* Custom Tailwind-Klassen für bessere Abstufungen */
.bg-base-25 {
  background-color: color-mix(in srgb, hsl(var(--b1)) 75%, hsl(var(--b2)) 25%);
}
</style>
