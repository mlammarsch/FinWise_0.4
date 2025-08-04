<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, computed } from 'vue';
import { Icon } from '@iconify/vue';
import Muuri from 'muuri';
import { AccountService } from '../../services/AccountService';
import type { AccountGroup, Account } from '../../types';
import { debugLog, errorLog } from '../../utils/logger';

const dragContainer = ref<HTMLElement>();
const metaGrid = ref<Muuri | null>(null);
const subGrids = ref<Muuri[]>([]);

// Reale Daten aus AccountService
const accountGroups = AccountService.getAllAccountGroups();
const accountsByGroup = computed(() => {
  const grouped: Record<string, Account[]> = {};
  for (const group of accountGroups) {
    grouped[group.id] = AccountService.getAllAccounts()
      .filter(a => a.accountGroupId === group.id)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }
  return grouped;
});

// Expand/Collapse State für jede Gruppe (dynamisch basierend auf echten Daten)
const expandedGroups = ref<Record<string, boolean>>({});

// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref<NodeJS.Timeout | null>(null);

// Debouncing für Sort Order Updates
const sortOrderUpdateTimer = ref<NodeJS.Timeout | null>(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500; // 500ms Debounce

// Sortierte Kontogruppen nach sortOrder
const sortedAccountGroups = computed(() => {
  return accountGroups.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
});

// Icon-Mapping für Kontogruppen (einheitliches Ordnersymbol)
function getGroupIcon(group: AccountGroup): string {
  return 'mdi:folder-outline';
}

// Icon-Farbe für Kontogruppen (einheitlich in base-content)
function getGroupColor(group: AccountGroup): string {
  return 'text-base-content';
}

// Konten für eine Gruppe (sortiert nach sortOrder)
function getAccountsForGroup(groupId: string): Account[] {
  const accounts = accountsByGroup.value[groupId] || [];
  return accounts
    .slice()
    .sort((a: Account, b: Account) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

onMounted(async () => {
  // Expand-State für alle Gruppen initialisieren
  for (const group of accountGroups) {
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
    // Sub-Grids für Konten mit korrekter Kanban-Logik
    const subGridElements = document.querySelectorAll('.accounts-content') as NodeListOf<HTMLElement>;

    subGridElements.forEach(el => {
      const grid = new Muuri(el, {
        items: '.account-item',
        dragEnabled: true,
        dragHandle: '.account-drag-area',
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
        handleAccountDragEnd(item);
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
      // Sort Order Update für AccountGroups mit Debouncing
      handleAccountGroupDragEnd(item);
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

// Drag & Drop Persistierung für Konten
function handleAccountDragEnd(item: any) {
  // Debouncing: Vorherigen Timer löschen
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const draggedElement = item.getElement();
      const accountId = draggedElement.getAttribute('data-account-id');

      if (!accountId) {
        errorLog('MuuriTestView', 'handleAccountDragEnd - Account ID not found');
        return;
      }

      // Bestimme die neue Gruppe basierend auf dem Container
      const container = draggedElement.closest('.accounts-content');
      const groupWrapper = container?.closest('.group-wrapper');
      const actualGroupId = groupWrapper?.getAttribute('data-group-id');

      if (!actualGroupId) {
        errorLog('MuuriTestView', 'handleAccountDragEnd - Group ID not found');
        return;
      }

      // Hole die neue Reihenfolge direkt vom Muuri-Grid statt vom DOM
      const targetGrid = subGrids.value.find(grid => {
        const gridElement = grid.getElement();
        return gridElement.closest('.group-wrapper')?.getAttribute('data-group-id') === actualGroupId;
      });

      if (!targetGrid) {
        errorLog('MuuriTestView', 'handleAccountDragEnd - Target grid not found', { actualGroupId });
        return;
      }

      // Hole die Items in der aktuellen Muuri-Reihenfolge (ohne Placeholder)
      const items = targetGrid.getItems();
      const newOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-account-id');
        // Ignoriere Placeholder-Elemente
        if (id && !element.classList.contains('empty-group-placeholder')) {
          newOrder.push(id);
        }
      });

      debugLog('MuuriTestView', 'handleAccountDragEnd', {
        accountId,
        actualGroupId,
        newOrder,
        itemsCount: items.length,
        draggedItemPosition: newOrder.indexOf(accountId)
      });

      // Prüfe, ob das Konto in eine andere Gruppe verschoben wurde
      const originalAccount = AccountService.getAllAccounts().find(a => a.id === accountId);
      const originalGroupId = originalAccount?.accountGroupId;

      if (originalGroupId && originalGroupId !== actualGroupId) {
        // Konto wurde zwischen Gruppen verschoben
        const newIndex = newOrder.indexOf(accountId);
        await AccountService.moveAccountToGroup(accountId, actualGroupId, newIndex);
        debugLog('MuuriTestView', 'handleAccountDragEnd - Account moved between groups', {
          accountId,
          fromGroup: originalGroupId,
          toGroup: actualGroupId,
          newIndex
        });
      } else {
        // Konto wurde nur innerhalb der Gruppe neu sortiert
        await AccountService.updateAccountOrder(actualGroupId, newOrder);
        debugLog('MuuriTestView', 'handleAccountDragEnd - Account reordered within group');
      }

      debugLog('MuuriTestView', 'handleAccountDragEnd - Sort order updated successfully');
      // UI-Refresh nach erfolgreichem Update
      await reinitializeMuuriGrids();

    } catch (error) {
      errorLog('MuuriTestView', 'handleAccountDragEnd - Error updating sort order', error);
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
}

// Drag & Drop Persistierung für AccountGroups
function handleAccountGroupDragEnd(item: any) {
  // Debouncing: Vorherigen Timer löschen
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const draggedElement = item.getElement();
      const groupId = draggedElement.getAttribute('data-group-id');

      if (!groupId) {
        errorLog('MuuriTestView', 'handleAccountGroupDragEnd - Group ID not found');
        return;
      }

      // Hole die neue Reihenfolge direkt vom Meta-Grid
      if (!metaGrid.value) {
        errorLog('MuuriTestView', 'handleAccountGroupDragEnd - Meta grid not found');
        return;
      }

      const items = metaGrid.value.getItems();
      const allGroupsInOrder: string[] = [];

      items.forEach((item: any) => {
        const element = item.getElement();
        const id = element.getAttribute('data-group-id');
        if (id) allGroupsInOrder.push(id);
      });

      debugLog('MuuriTestView', 'handleAccountGroupDragEnd', {
        groupId,
        allGroupsInOrder,
        draggedGroupPosition: allGroupsInOrder.indexOf(groupId)
      });

      // Berechne Sort Order Updates
      const sortOrderUpdates = allGroupsInOrder.map((id, index) => ({
        id,
        sortOrder: index
      }));

      // Verwende AccountService für die Sortierung
      await AccountService.updateAccountGroupOrder(sortOrderUpdates);

      debugLog('MuuriTestView', 'handleAccountGroupDragEnd - Sort order updated successfully');
      // UI-Refresh nach erfolgreichem Update
      await reinitializeMuuriGrids();

    } catch (error) {
      errorLog('MuuriTestView', 'handleAccountGroupDragEnd - Error updating sort order', error);
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
      <h1 class="text-3xl font-bold text-center mb-2">Konten Drag & Drop Test</h1>

    </div>

    <!-- Drag Container wie im Kanban -->
    <div ref="dragContainer" class="drag-container"></div>

    <!-- Muuri Container für Kontogruppen -->
    <div class="muuri-container bg-base-100 p-4">
      <!-- Kontogruppen (sortiert nach sortOrder) -->
      <div
        v-for="(group, index) in sortedAccountGroups"
        :key="group.id"
        class="group-wrapper"
        :data-group-id="group.id"
      >
        <div class="account-group-row border-t border-b border-base-300">
          <!-- Kontogruppen-Header -->
          <div class="group-header flex items-center p-1 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer">
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
              {{ getAccountsForGroup(group.id).length }} {{ getAccountsForGroup(group.id).length === 1 ? 'Konto' : 'Konten' }}
            </div>
          </div>

          <!-- Konten-Liste (mit Expand/Collapse und Scrollbalken) -->
          <div
            v-show="expandedGroups[group.id]"
            class="accounts-list"
            :class="{ 'collapsed': !expandedGroups[group.id] }"
          >
            <div class="accounts-content">
              <!-- Konten (sortiert nach sortOrder) -->
              <div
                v-for="account in getAccountsForGroup(group.id)"
                :key="account.id"
                class="account-item"
                :data-account-id="account.id"
                :data-group-id="group.id"
              >
                <div class="flex items-center p-0 pl-8 bg-base-50 border-b border-base-300 hover:bg-base-100 cursor-pointer">
                  <!-- Erweiterte Drag-Area (Handle + Name) -->
                  <div class="account-drag-area flex items-center flex-grow">
                    <!-- Drag Handle für Konto -->
                    <div class="account-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
                      <Icon icon="mdi:drag-vertical" class="w-3 h-3 text-base-content/60" />
                    </div>

                    <!-- Kontoname (auch draggable) -->
                    <div class="flex-grow account-name-drag">
                      <span class="text-xs text-base-content">{{ account.name }}</span>
                    </div>
                  </div>

                  <!-- Konto-Status-Indikatoren (außerhalb der Drag-Area) -->
                  <div class="flex-shrink-0 flex items-center space-x-1">
                    <div v-if="!account.isActive" class="w-2 h-2 bg-warning rounded-full" title="Inaktiv"></div>
                    <div v-if="account.isOfflineBudget" class="w-2 h-2 bg-info rounded-full" title="Offline Budget"></div>
                  </div>
                </div>
              </div>

              <!-- Placeholder für leere Gruppen - ermöglicht Dropping -->
              <div
                v-if="getAccountsForGroup(group.id).length === 0"
                class="empty-group-placeholder account-item"
                :data-group-id="group.id"
                style="position: relative; height: 40px; width: 100%;"
              >
                <div class="flex items-center justify-center h-full text-xs text-base-content/40 italic">
                  Konten hier hinziehen...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 text-center text-gray-600">
      <p class="mb-2">🎯 Drag group headers to reorder groups</p>
      <p class="mb-2">📦 Drag accounts within groups or between groups</p>
      <p class="mb-2">📱 Elements follow mouse cursor smoothly</p>
      <p class="text-xs">📊 Daten aus AccountService - sortiert nach sortOrder</p>
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

/* AccountGroupRow Design */
.account-group-row {
  border-radius: 0rem;
  overflow: hidden;
  background: hsl(var(--b1));
  margin-bottom: 0rem;
}

.group-header {
  background: linear-gradient(to right, hsl(var(--b1)), hsl(var(--b2)));
}

.accounts-list {
  position: relative;
  min-height: 50px;
  max-height: 400px;
  overflow-y: auto;
  transition: all 0.3s ease;
}

.accounts-list.collapsed {
  min-height: 0;
  max-height: 0;
  overflow: hidden;
}

.accounts-content {
  position: relative;
  min-height: 100%;
}

.account-item {
  position: absolute;
  display: block;
  width: 100%;
  margin: 0;
  z-index: 1;
}

.account-item:last-child .flex:last-child {
  border-bottom: none;
}

/* Drag Handle Styles */
.group-drag-handle,
.account-drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease;
}

.group-drag-handle:active,
.account-drag-handle:active {
  cursor: grabbing;
}

/* Erweiterte Drag-Area für Konten */
.account-drag-area {
  cursor: grab;
  transition: all 0.2s ease;
}

.account-drag-area:hover {
  background-color: hsl(var(--b2) / 0.5);
  border-radius: 4px;
}

.account-drag-area:active {
  cursor: grabbing;
}

/* Empty Group Placeholder */
.empty-group-placeholder {
  border: 2px dashed hsl(var(--bc) / 0.2);
  border-radius: 4px;
  margin: 4px 0;
  transition: all 0.2s ease;
}

.empty-group-placeholder:hover {
  border-color: hsl(var(--bc) / 0.4);
  background-color: hsl(var(--b2) / 0.3);
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
