<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';

const dragContainer = ref<HTMLElement>();
const metaGrid = ref<Muuri | null>(null);
const subGrids = ref<Muuri[]>([]);

// Expand/Collapse State für jede Gruppe
const expandedGroups = ref<Record<string, boolean>>({
  ausgaben: true,
  ruecklagen: true,
  hobby: true
});

// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref<NodeJS.Timeout | null>(null);

// Test-Daten basierend auf dem Bild
const categoryGroups = [
  {
    id: 'ausgaben',
    name: 'Ausgaben',
    icon: 'mdi:trending-down',
    color: 'text-error',
    categories: [
      { id: 'dsl40', name: 'DSL 40' },
      { id: 'arag', name: 'ARAG (Rechtsschutz)' },
      { id: 'garten', name: '[Anl] Garten' },
      { id: 'musik', name: '[Anl] Musik' },
      { id: 'wohnbedarf', name: '[Anl] Wohnbedarf' },
      { id: 'dsl42', name: 'DSL 42' },
      { id: 'brille', name: '[RL] Brille' }
    ]
  },
  {
    id: 'ruecklagen',
    name: 'Rücklagen',
    icon: 'mdi:piggy-bank',
    color: 'text-warning',
    categories: [
      { id: 'bullsparer', name: '[RL] Bullsparer' },
      { id: 'zahnpflege', name: '[RL] Zahnpflege' },
      { id: 'kompensation', name: '[RL] Kompensation 13.' },
      { id: 'pv-anlage', name: '[RL] PV-Anlage (Wartung)' },
      { id: 'benzin', name: '[RL] Benzin/Treibstoff' },
      { id: 'steuer', name: '[RL] EK Steuer' },
      { id: 'urlaub', name: '[RL] Urlaub' }
    ]
  },
  {
    id: 'hobby',
    name: 'Hobby und Freizeit',
    icon: 'mdi:gamepad-variant',
    color: 'text-info',
    categories: [
      { id: 'gaming', name: 'Gaming Equipment' },
      { id: 'sport', name: 'Sport & Fitness' },
      { id: 'reisen', name: 'Reisen & Ausflüge' }
    ]
  }
];

onMounted(async () => {
  await nextTick();
  initializeGrids();
});

onUnmounted(() => {
  destroyGrids();
});

function initializeGrids() {
  try {
    // Sub-Grids für Kategorien mit korrekter Kanban-Logik
    const subGridElements = document.querySelectorAll('.categories-content') as NodeListOf<HTMLElement>;

    subGridElements.forEach(el => {
      const grid = new Muuri(el, {
        items: '.category-item',
        dragEnabled: true,
        dragHandle: '.category-drag-handle',
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
      .on('dragEnd', function () {
        // Auto-Expand Timer aufräumen
        clearAutoExpandTimer();
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
      <!-- Kategoriegruppen -->
      <div
        v-for="group in categoryGroups"
        :key="group.id"
        class="group-wrapper"
        :data-group-id="group.id"
      >
        <div class="category-group-row">
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
                :icon="expandedGroups[group.id] ? 'mdi:chevron-down' : 'mdi:chevron-right'"
                class="w-5 h-5 text-base-content transition-transform duration-200"
                :class="{ 'rotate-90': !expandedGroups[group.id] }"
              />
            </div>

            <!-- Gruppen-Icon -->
            <div class="flex-shrink-0 mr-2">
              <Icon :icon="group.icon" :class="`w-4 h-4 ${group.color}`" />
            </div>

            <!-- Gruppenname -->
            <div class="flex-grow" @click.stop="toggleGroup(group.id)">
              <h4 class="font-semibold text-sm text-base-content">{{ group.name }}</h4>
            </div>

            <!-- Gruppenstatus-Indikator -->
            <div class="flex-shrink-0 text-xs text-base-content/60">
              {{ group.categories.length }} {{ group.categories.length === 1 ? 'Kategorie' : 'Kategorien' }}
            </div>
          </div>

          <!-- Kategorien-Liste (mit Expand/Collapse) -->
          <div
            v-show="expandedGroups[group.id]"
            class="categories-list"
            :class="{ 'collapsed': !expandedGroups[group.id] }"
          >
            <div class="categories-content">
              <!-- Kategorien -->
              <div
                v-for="category in group.categories"
                :key="category.id"
                class="category-item"
                :data-category-id="category.id"
                :data-group-id="group.id"
              >
                <div class="flex items-center p-2 pl-8 bg-base-50 border-b border-base-200 hover:bg-base-100 cursor-pointer">
                  <!-- Drag Handle für Kategorie -->
                  <div class="category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                    <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
                  </div>

                  <!-- Kategoriename -->
                  <div class="flex-grow">
                    <span class="text-sm text-base-content">{{ category.name }}</span>
                  </div>

                  <!-- Kategorie-Status-Indikatoren -->
                  <div class="flex-shrink-0 flex items-center space-x-1">
                    <div class="w-2 h-2 bg-success rounded-full" title="Aktiv"></div>
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
      <p>📱 Elements follow mouse cursor smoothly</p>
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
  border: 1px solid hsl(var(--bc) / 0.2);
  border-radius: 0.5rem;
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

/* Hover-Effekte */
.group-header:hover .group-drag-handle,
.category-item:hover .category-drag-handle {
  opacity: 1;
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
  transition: transform 0.2s ease;
}

/* Custom Tailwind-Klassen für bessere Abstufungen */
.bg-base-25 {
  background-color: color-mix(in srgb, hsl(var(--b1)) 75%, hsl(var(--b2)) 25%);
}
</style>
