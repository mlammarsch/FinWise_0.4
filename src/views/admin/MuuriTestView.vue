<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Muuri from 'muuri';

const metaGridContainer = ref<HTMLElement>();
const subGrids = ref<Muuri[]>([]);
const metaGrid = ref<Muuri>();

const columns = [
  { id: 'todo', title: 'to do', color: 'bg-pink-500' },
  { id: 'working', title: 'working', color: 'bg-blue-500' },
  { id: 'done', title: 'done', color: 'bg-green-500' }
];

const items = [
  // To Do Items
  { id: 1, text: 'Karte 1-1', column: 'todo' },
  { id: 2, text: 'Karte 1-2', column: 'todo' },
  { id: 3, text: 'Karte 1-3', column: 'todo' },
  { id: 4, text: 'Karte 1-4', column: 'todo' },

  // Working Items
  { id: 5, text: 'Karte 2-1', column: 'working' },
  { id: 6, text: 'Karte 2-2', column: 'working' },
  { id: 7, text: 'Karte 2-3', column: 'working' },
  { id: 8, text: 'Karte 2-4', column: 'working' },

  // Done Items
  { id: 9, text: 'Karte 3-1', column: 'done' },
  { id: 10, text: 'Karte 3-2', column: 'done' },
  { id: 11, text: 'Karte 3-3', column: 'done' },
  { id: 12, text: 'Karte 3-4', column: 'done' }
];

onMounted(() => {
  initializeGrids();
});

onUnmounted(() => {
  // Cleanup grids
  subGrids.value.forEach(grid => grid.destroy());
  if (metaGrid.value) {
    metaGrid.value.destroy();
  }
});

function initializeGrids() {
  // Step 1: Initialize Sub-Grids first (critical for proper hierarchy)
  const subGridElements = document.querySelectorAll('.sub-grid-content') as NodeListOf<HTMLElement>;

  subGridElements.forEach(el => {
    const grid = new Muuri(el, {
      items: '.item',
      dragEnabled: true,
      dragContainer: document.body, // Items follow mouse cursor
      dragSort: function () {
        // Return all sub-grids to enable cross-grid dragging
        return subGrids.value;
      },
      dragPlaceholder: {
        enabled: true,
        createElement: function(item) {
          // Create empty div for cleaner placeholder
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

    // Event handlers for cross-grid communication and layout synchronization
    grid.on('send', function(data) {
      console.log(`Item sent from grid to another grid`);
      // Force layout update for both source and target grids
      setTimeout(() => {
        // Update the source grid (this grid) layout
        grid.layout();
        // Update meta-grid layout to adjust column positions
        if (metaGrid.value) {
          metaGrid.value.layout();
        }
      }, 50);
    });

    grid.on('receive', function(data) {
      console.log(`Item received in grid from another grid`);
      // Force layout update for both source and target grids
      setTimeout(() => {
        // Update the target grid (this grid) layout
        grid.layout();
        // Update meta-grid layout to adjust column positions
        if (metaGrid.value) {
          metaGrid.value.layout();
        }
      }, 50);
    });

    // Additional layout synchronization on drag end
    grid.on('dragEnd', function(item) {
      setTimeout(() => {
        // Refresh all grid layouts to ensure proper sizing
        subGrids.value.forEach(subGrid => {
          if (subGrid !== grid) {
            subGrid.layout();
          }
        });
        if (metaGrid.value) {
          metaGrid.value.layout();
        }
      }, 100);
    });

    subGrids.value.push(grid);
  });

  // Step 2: Initialize Meta-Grid after Sub-Grids
  if (metaGridContainer.value) {
    metaGrid.value = new Muuri(metaGridContainer.value, {
      items: '.sub-grid-wrapper',
      dragEnabled: true,
      dragHandle: '.sub-grid-header', // Only drag by header to avoid conflicts
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

    console.log('Muuri grids initialized:', {
      metaGrid: metaGrid.value,
      subGrids: subGrids.value.length
    });
  }
}
</script>

<template>
  <div class="container mx-auto p-6">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-center mb-2 text-pink-500">KANBAN DEMO</h1>
      <div class="w-full h-1 bg-gradient-to-r from-pink-400 via-blue-400 to-green-400 rounded"></div>
    </div>

    <!-- Meta-Grid Container -->
    <div
      ref="metaGridContainer"
      class="meta-grid p-4 bg-gradient-to-br from-pink-100 via-blue-100 to-green-100 rounded-lg border-4 border-green-400"
    >
      <!-- Sub-Grid Wrappers (Items of Meta-Grid) -->
      <div
        v-for="column in columns"
        :key="column.id"
        class="sub-grid-wrapper"
      >
        <!-- Sub-Grid Header (Drag Handle for Meta-Grid) -->
        <div
          class="sub-grid-header"
          :class="column.color"
        >
          <span>{{ column.title }}</span>
          <span class="text-2xl">+</span>
        </div>

        <!-- Sub-Grid Content Container -->
        <div class="sub-grid-content">
          <!-- Items within Sub-Grid -->
          <div
            v-for="item in items.filter(i => i.column === column.id)"
            :key="item.id"
            class="item"
            :data-id="item.id"
          >
            <div class="item-content">
              {{ item.text }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 text-center text-gray-600">
      <p class="mb-2">🎯 Drag column headers to reorder columns</p>
      <p class="mb-2">📦 Drag items within columns or between columns</p>
      <p>📱 All columns are arranged vertically as requested</p>
    </div>
  </div>
</template>

<style scoped>
/* Meta-Grid Styling */
.meta-grid {
  position: relative;
}

/* Sub-Grid Wrapper Styling (Items of Meta-Grid) */
.sub-grid-wrapper {
  display: block;
  position: absolute;
  width: calc(100% - 2rem);
  margin: 1rem;
  margin-bottom: 2rem; /* More space between columns */
  padding: 0;
  border: 2px solid #ddd;
  background: #f9f9f9;
  border-radius: 8px;
  overflow: hidden;
}

/* Sub-Grid Header (Drag Handle for Meta-Grid) */
.sub-grid-header {
  padding: 12px 16px;
  color: white;
  font-weight: bold;
  text-xl: true;
  cursor: move;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.sub-grid-header:hover {
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

/* Sub-Grid Content Container */
.sub-grid-content {
  position: relative;
  min-height: 200px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
  border-top: 2px dashed #aaa;
}

/* Items within Sub-Grids */
.item {
  display: block;
  position: absolute;
  width: calc(100% - 1rem);
  margin: 0.25rem; /* Tighter spacing between cards */
  z-index: 1;
  background: white;
  border: 2px solid #ffd700;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: grab;
  transition: box-shadow 0.2s ease;
}

.item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.item-content {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 12px;
  color: #333;
  font-weight: 500;
  text-align: left;
}

/* Muuri-specific classes for visual feedback */
.item.muuri-item-dragging {
  z-index: 1000 !important;
  cursor: grabbing !important;
  transform: scale(1.05) rotate(3deg) !important;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3) !important;
  transition: none !important; /* No transition during drag for smooth following */
  pointer-events: none !important; /* Prevent interference with drag detection */
}

.item.muuri-item-releasing {
  z-index: 2 !important;
  transform: scale(1) rotate(0deg) !important;
  transition: transform 400ms ease, box-shadow 400ms ease !important;
  pointer-events: auto !important;
}

.item.muuri-item-hidden {
  z-index: 0 !important;
  opacity: 0 !important;
}

/* Placeholder styling for the "free space" effect */
.muuri-item-placeholder {
  margin: 0.25rem !important; /* Must match item margin */
  background-color: #add8e6 !important;
  border: 1px dashed #007bff !important;
  opacity: 0.7 !important;
  border-radius: 4px !important;
  pointer-events: none !important;
}

/* Ensure dragged items in body container are properly styled */
body > .item.muuri-item-dragging {
  position: fixed !important;
  z-index: 9999 !important;
  pointer-events: none !important;
  transform: scale(1.05) rotate(3deg) !important;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.4) !important;
}

/* Meta-Grid item dragging */
.sub-grid-wrapper.muuri-item-dragging {
  z-index: 3;
  transform: rotate(2deg) !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2) !important;
}

.sub-grid-wrapper.muuri-item-releasing {
  z-index: 2;
  transform: rotate(0deg) !important;
}
</style>
