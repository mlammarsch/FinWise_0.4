# Muuri-Integration Spezifikation für BudgetsView2

## Überblick

Diese Spezifikation beschreibt die detaillierte Integration von Muuri.js in die neue BudgetsView2 für Drag & Drop-Funktionalität von Kategorien und Kategoriegruppen (Lebensbereichen).

## Muuri-Konfiguration

### Basis-Setup

```typescript
// In BudgetGrid2.vue
import Muuri from 'muuri';

interface MuuriConfig {
  items: string;
  dragEnabled: boolean;
  dragHandle: string;
  dragStartPredicate: {
    distance: number;
    delay: number;
  };
  dragSortPredicate: {
    threshold: number;
    action: 'move' | 'swap';
  };
  layout: {
    fillGaps: boolean;
    horizontal: boolean;
    alignRight: boolean;
    alignBottom: boolean;
  };
  dragCssProps: {
    touchAction: string;
    userSelect: string;
    userDrag: string;
  };
}

const muuriConfig: MuuriConfig = {
  items: '.muuri-item-2',
  dragEnabled: true,
  dragHandle: '.drag-handle-2',
  dragStartPredicate: {
    distance: 5,
    delay: 100
  },
  dragSortPredicate: {
    threshold: 50,
    action: 'move'
  },
  layout: {
    fillGaps: false,
    horizontal: false,
    alignRight: false,
    alignBottom: false
  },
  dragCssProps: {
    touchAction: 'none',
    userSelect: 'none',
    userDrag: 'none'
  }
};
```

### Grid-Initialisierung

```typescript
// BudgetGrid2.vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import Muuri from 'muuri';

const gridContainer = ref<HTMLElement | null>(null);
let muuriInstance: Muuri | null = null;

onMounted(async () => {
  await nextTick();
  initializeMuuri();
});

onUnmounted(() => {
  if (muuriInstance) {
    muuriInstance.destroy();
    muuriInstance = null;
  }
});

function initializeMuuri() {
  if (!gridContainer.value) return;

  muuriInstance = new Muuri(gridContainer.value, muuriConfig);

  // Event-Listener registrieren
  muuriInstance.on('dragInit', handleDragInit);
  muuriInstance.on('dragStart', handleDragStart);
  muuriInstance.on('dragMove', handleDragMove);
  muuriInstance.on('dragEnd', handleDragEnd);
  muuriInstance.on('dragReleaseEnd', handleDragReleaseEnd);
}
</script>
```

## HTML-Struktur für Muuri

### Grid-Container Template

```vue
<template>
  <div
    ref="gridContainer"
    class="muuri-grid-2"
    :class="{ 'is-dragging': isDragging }"
  >
    <!-- Ausgaben-Sektion -->
    <div class="expense-section">
      <div class="section-header">
        <h3>Ausgaben</h3>
      </div>

      <!-- Kategoriegruppen (Lebensbereiche) -->
      <div
        v-for="group in expenseGroups"
        :key="`group-${group.id}`"
        class="muuri-item-2 category-group-item"
        :data-group-id="group.id"
        :data-group-type="expense"
        :data-sort-order="group.sortOrder"
      >
        <div class="drag-handle-2 group-drag-handle">
          <Icon icon="mdi:drag-vertical" />
        </div>

        <BudgetCategoryGroup2
          :group="group"
          :categories="categoriesByGroup[group.id] || []"
          :isExpanded="expandedGroups.has(group.id)"
          @toggle-expand="toggleGroupExpanded"
        />
      </div>
    </div>

    <!-- Einnahmen-Sektion -->
    <div class="income-section">
      <div class="section-header">
        <h3>Einnahmen</h3>
      </div>

      <!-- Kategoriegruppen (Lebensbereiche) -->
      <div
        v-for="group in incomeGroups"
        :key="`group-${group.id}`"
        class="muuri-item-2 category-group-item"
        :data-group-id="group.id"
        :data-group-type="income"
        :data-sort-order="group.sortOrder"
      >
        <div class="drag-handle-2 group-drag-handle">
          <Icon icon="mdi:drag-vertical" />
        </div>

        <BudgetCategoryGroup2
          :group="group"
          :categories="categoriesByGroup[group.id] || []"
          :isExpanded="expandedGroups.has(group.id)"
          @toggle-expand="toggleGroupExpanded"
        />
      </div>
    </div>
  </div>
</template>
```

### Kategorie-Items Template

```vue
<!-- In BudgetCategoryGroup2.vue -->
<template>
  <div class="category-group-container">
    <CategoryGroupHeader2
      :group="group"
      :isExpanded="isExpanded"
      @toggle="$emit('toggle-expand', group.id)"
    />

    <div
      v-if="isExpanded"
      class="categories-container"
      :data-group-id="group.id"
    >
      <div
        v-for="category in categories"
        :key="`category-${category.id}`"
        class="muuri-item-2 category-item"
        :data-category-id="category.id"
        :data-group-id="category.categoryGroupId"
        :data-group-type="group.isIncomeGroup ? 'income' : 'expense'"
        :data-sort-order="category.sortOrder"
      >
        <div class="drag-handle-2 category-drag-handle">
          <Icon icon="mdi:drag-horizontal" />
        </div>

        <BudgetCategoryRow2
          :category="category"
          :months="months"
        />
      </div>
    </div>
  </div>
</template>
```

## Event-Handler Implementierung

### Drag-Initialisierung

```typescript
interface DragState {
  isDragging: boolean;
  draggedItem: {
    id: string;
    type: 'group' | 'category';
    groupType: 'expense' | 'income';
    originalIndex: number;
  } | null;
  dropZones: string[];
}

const dragState = ref<DragState>({
  isDragging: false,
  draggedItem: null,
  dropZones: []
});

function handleDragInit(item: any) {
  const element = item.getElement();
  const isGroup = element.classList.contains('category-group-item');
  const isCategory = element.classList.contains('category-item');

  if (isGroup) {
    const groupId = element.dataset.groupId;
    const groupType = element.dataset.groupType;

    dragState.value.draggedItem = {
      id: groupId,
      type: 'group',
      groupType: groupType as 'expense' | 'income',
      originalIndex: item.getGrid().getItems().indexOf(item)
    };

    // Definiere gültige Drop-Zonen für Gruppen
    dragState.value.dropZones = getValidGroupDropZones(groupType);

  } else if (isCategory) {
    const categoryId = element.dataset.categoryId;
    const groupType = element.dataset.groupType;

    dragState.value.draggedItem = {
      id: categoryId,
      type: 'category',
      groupType: groupType as 'expense' | 'income',
      originalIndex: item.getGrid().getItems().indexOf(item)
    };

    // Definiere gültige Drop-Zonen für Kategorien
    dragState.value.dropZones = getValidCategoryDropZones(groupType);
  }

  debugLog('Muuri', 'Drag initialized', dragState.value.draggedItem);
}
```

### Drag-Start

```typescript
function handleDragStart(item: any) {
  dragState.value.isDragging = true;

  // Visuelle Hinweise für gültige Drop-Zonen
  highlightDropZones(dragState.value.dropZones);

  // Drag-Feedback
  const element = item.getElement();
  element.classList.add('is-dragging');

  debugLog('Muuri', 'Drag started', {
    itemId: dragState.value.draggedItem?.id,
    type: dragState.value.draggedItem?.type
  });
}
```

### Drag-Move

```typescript
function handleDragMove(item: any, event: any) {
  const element = item.getElement();
  const rect = element.getBoundingClientRect();

  // Finde potentielle Drop-Ziele
  const dropTarget = findDropTarget(event.clientX, event.clientY);

  if (dropTarget && isValidDropTarget(dropTarget)) {
    highlightDropTarget(dropTarget);
  } else {
    clearDropTargetHighlight();
  }
}
```

### Drag-End

```typescript
function handleDragEnd(item: any) {
  const element = item.getElement();
  const newIndex = item.getGrid().getItems().indexOf(item);

  if (dragState.value.draggedItem) {
    const { id, type, groupType, originalIndex } = dragState.value.draggedItem;

    if (newIndex !== originalIndex) {
      // Position hat sich geändert - Update durchführen
      if (type === 'group') {
        handleGroupReorder(id, newIndex, groupType);
      } else if (type === 'category') {
        handleCategoryReorder(id, newIndex, element);
      }
    }
  }

  // Cleanup
  element.classList.remove('is-dragging');
  clearDropZoneHighlights();
  clearDropTargetHighlight();

  debugLog('Muuri', 'Drag ended', {
    originalIndex: dragState.value.draggedItem?.originalIndex,
    newIndex
  });
}
```

### Drag-Release-End

```typescript
function handleDragReleaseEnd(item: any) {
  dragState.value.isDragging = false;
  dragState.value.draggedItem = null;
  dragState.value.dropZones = [];

  debugLog('Muuri', 'Drag release completed');
}
```

## Drop-Validierung

### Gültige Drop-Zonen ermitteln

```typescript
function getValidGroupDropZones(groupType: 'expense' | 'income'): string[] {
  const zones: string[] = [];

  if (groupType === 'expense') {
    // Gruppen können nur innerhalb der Ausgaben-Sektion verschoben werden
    zones.push('.expense-section');
  } else {
    // Gruppen können nur innerhalb der Einnahmen-Sektion verschoben werden
    zones.push('.income-section');
  }

  return zones;
}

function getValidCategoryDropZones(groupType: 'expense' | 'income'): string[] {
  const zones: string[] = [];

  // Kategorien können in jede Gruppe des gleichen Typs
  const groups = groupType === 'expense' ? expenseGroups.value : incomeGroups.value;

  groups.forEach(group => {
    zones.push(`[data-group-id="${group.id}"]`);
  });

  return zones;
}

function isValidDropTarget(target: Element): boolean {
  const draggedItem = dragState.value.draggedItem;
  if (!draggedItem) return false;

  if (draggedItem.type === 'group') {
    // Gruppen-Validierung
    const targetSection = target.closest('.expense-section, .income-section');
    const expectedSection = draggedItem.groupType === 'expense' ? 'expense-section' : 'income-section';

    return targetSection?.classList.contains(expectedSection) || false;

  } else if (draggedItem.type === 'category') {
    // Kategorie-Validierung
    const targetGroupId = target.dataset.groupId;
    const targetGroup = categoryStore.categoryGroups.find(g => g.id === targetGroupId);

    if (!targetGroup) return false;

    // Kategorie kann nur in Gruppe des gleichen Typs
    const expectedIncomeGroup = draggedItem.groupType === 'income';
    return targetGroup.isIncomeGroup === expectedIncomeGroup;
  }

  return false;
}
```

## Sortierung-Updates

### Gruppen-Reorder

```typescript
async function handleGroupReorder(groupId: string, newIndex: number, groupType: 'expense' | 'income') {
  try {
    const groups = groupType === 'expense' ? expenseGroups.value : incomeGroups.value;
    const newSortOrder = calculateNewSortOrder(groups, newIndex);

    await CategoryService.updateCategoryGroup(groupId, {
      sortOrder: newSortOrder,
      updated_at: new Date().toISOString()
    });

    infoLog('Muuri', 'Group reordered successfully', {
      groupId,
      newSortOrder,
      groupType
    });

    // Muuri-Layout aktualisieren
    await nextTick();
    muuriInstance?.refreshItems();
    muuriInstance?.layout();

  } catch (error) {
    errorLog('Muuri', 'Failed to reorder group', { groupId, error });

    // Rollback: Muuri-Position zurücksetzen
    await rollbackMuuriPosition();
  }
}
```

### Kategorie-Reorder

```typescript
async function handleCategoryReorder(categoryId: string, newIndex: number, element: Element) {
  try {
    const newGroupId = findTargetGroupId(element);
    const targetGroup = categoryStore.categoryGroups.find(g => g.id === newGroupId);

    if (!targetGroup) {
      throw new Error(`Target group ${newGroupId} not found`);
    }

    const categoriesInGroup = categoriesByGroup.value[newGroupId] || [];
    const newSortOrder = calculateNewSortOrder(categoriesInGroup, newIndex);

    const updates: Partial<Category> = {
      sortOrder: newSortOrder,
      updated_at: new Date().toISOString()
    };

    // Wenn Kategorie in neue Gruppe verschoben wird
    if (newGroupId !== categoryStore.findCategoryById(categoryId)?.categoryGroupId) {
      updates.categoryGroupId = newGroupId;
      updates.isIncomeCategory = targetGroup.isIncomeGroup;
    }

    await CategoryService.updateCategory(categoryId, updates);

    infoLog('Muuri', 'Category reordered successfully', {
      categoryId,
      newGroupId,
      newSortOrder
    });

    // Muuri-Layout aktualisieren
    await nextTick();
    muuriInstance?.refreshItems();
    muuriInstance?.layout();

  } catch (error) {
    errorLog('Muuri', 'Failed to reorder category', { categoryId, error });

    // Rollback: Muuri-Position zurücksetzen
    await rollbackMuuriPosition();
  }
}
```

### SortOrder-Berechnung

```typescript
function calculateNewSortOrder(items: Array<{sortOrder: number}>, newIndex: number): number {
  if (items.length === 0) return 0;

  // Sortiere Items nach sortOrder
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  if (newIndex === 0) {
    // An den Anfang
    return sortedItems[0].sortOrder - 10;
  } else if (newIndex >= sortedItems.length) {
    // An das Ende
    return sortedItems[sortedItems.length - 1].sortOrder + 10;
  } else {
    // Zwischen zwei Items
    const prevOrder = sortedItems[newIndex - 1].sortOrder;
    const nextOrder = sortedItems[newIndex].sortOrder;
    return Math.floor((prevOrder + nextOrder) / 2);
  }
}
```

## Visuelle Feedback-Mechanismen

### Drop-Zone Highlighting

```typescript
function highlightDropZones(zones: string[]) {
  zones.forEach(zone => {
    const elements = document.querySelectorAll(zone);
    elements.forEach(el => {
      el.classList.add('drop-zone-active');
    });
  });
}

function clearDropZoneHighlights() {
  const activeZones = document.querySelectorAll('.drop-zone-active');
  activeZones.forEach(el => {
    el.classList.remove('drop-zone-active');
  });
}

function highlightDropTarget(target: Element) {
  clearDropTargetHighlight();
  target.classList.add('drop-target-hover');
}

function clearDropTargetHighlight() {
  const activeTargets = document.querySelectorAll('.drop-target-hover');
  activeTargets.forEach(el => {
    el.classList.remove('drop-target-hover');
  });
}
```

### CSS für Drag-Feedback

```css
/* Drag-Handles */
.drag-handle-2 {
  @apply opacity-0 cursor-move transition-opacity duration-200;
  @apply flex items-center justify-center w-6 h-6;
}

.muuri-item-2:hover .drag-handle-2 {
  @apply opacity-60;
}

.muuri-item-2.is-dragging .drag-handle-2 {
  @apply opacity-100;
}

/* Drag-States */
.muuri-item-2.is-dragging {
  @apply shadow-2xl z-50 rotate-1 scale-105;
  @apply transition-transform duration-200;
}

.muuri-item-2.muuri-item-releasing {
  @apply transition-all duration-300 ease-out;
}

.muuri-item-2.muuri-item-hidden {
  @apply opacity-0 scale-95;
}

/* Drop-Zones */
.drop-zone-active {
  @apply ring-2 ring-primary ring-opacity-50;
  @apply bg-primary bg-opacity-5;
  @apply transition-all duration-200;
}

.drop-target-hover {
  @apply ring-2 ring-success ring-opacity-75;
  @apply bg-success bg-opacity-10;
  @apply transition-all duration-150;
}

/* Grid-Container */
.muuri-grid-2 {
  @apply relative min-h-full;
}

.muuri-grid-2.is-dragging {
  @apply select-none;
}

/* Sections */
.expense-section,
.income-section {
  @apply mb-6 p-4 rounded-lg border border-base-300;
  @apply transition-all duration-200;
}

.expense-section {
  @apply bg-red-50 dark:bg-red-950;
}

.income-section {
  @apply bg-green-50 dark:bg-green-950;
}
```

## Error-Handling und Rollback

### Rollback-Mechanismus

```typescript
interface MuuriSnapshot {
  itemPositions: Array<{
    id: string;
    index: number;
  }>;
  timestamp: number;
}

let lastValidSnapshot: MuuriSnapshot | null = null;

function createMuuriSnapshot(): MuuriSnapshot {
  if (!muuriInstance) throw new Error('Muuri instance not available');

  const items = muuriInstance.getItems();
  const itemPositions = items.map((item, index) => ({
    id: item.getElement().dataset.categoryId || item.getElement().dataset.groupId || '',
    index
  }));

  return {
    itemPositions,
    timestamp: Date.now()
  };
}

async function rollbackMuuriPosition() {
  if (!lastValidSnapshot || !muuriInstance) return;

  try {
    // Sortiere Items zurück zur letzten gültigen Position
    const items = muuriInstance.getItems();
    const sortedItems = lastValidSnapshot.itemPositions
      .map(pos => items.find(item => {
        const element = item.getElement();
        const id = element.dataset.categoryId || element.dataset.groupId;
        return id === pos.id;
      }))
      .filter(Boolean);

    muuriInstance.sort(sortedItems, { layout: true });

    warnLog('Muuri', 'Position rolled back to last valid state');

  } catch (error) {
    errorLog('Muuri', 'Failed to rollback position', error);
  }
}

// Snapshot vor jeder Drag-Operation erstellen
function handleDragInit(item: any) {
  lastValidSnapshot = createMuuriSnapshot();
  // ... rest of drag init logic
}
```

## Performance-Optimierungen

### Debounced Updates

```typescript
import { debounce } from 'lodash';

const debouncedSortUpdate = debounce(async (updates: SortUpdate[]) => {
  try {
    await Promise.all(updates.map(update =>
      update.type === 'group'
        ? CategoryService.updateCategoryGroup(update.id, { sortOrder: update.sortOrder })
        : CategoryService.updateCategory(update.id, { sortOrder: update.sortOrder })
    ));

    infoLog('Muuri', 'Batch sort updates completed', { count: updates.length });

  } catch (error) {
    errorLog('Muuri', 'Batch sort updates failed', error);
    await rollbackMuuriPosition();
  }
}, 500);
```

### Layout-Optimierung

```typescript
function optimizedLayout() {
  if (!muuriInstance) return;

  // Layout nur wenn notwendig
  if (muuriInstance.getItems().some(item => item.isPositioning())) {
    return; // Layout bereits in Progress
  }

  muuriInstance.layout(false); // Instant layout ohne Animation
}

// Layout-Updates batchen
const batchedLayoutUpdate = debounce(() => {
  optimizedLayout();
}, 100);
```

Diese Spezifikation bietet eine vollständige Anleitung für die Integration von Muuri.js in die BudgetsView2, einschließlich aller notwendigen Event-Handler, Validierungslogik und Performance-Optimierungen.
