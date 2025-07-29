# Layout-Konzept für BudgetsView2 - Überarbeitet

## Überblick

Dieses Dokument beschreibt das Layout-Konzept für die neue BudgetsView2 unter **strikter Beibehaltung des bestehenden BudgetsView-Layouts**. Das Design übernimmt die bewährte Struktur mit sticky Header, sticky Kategoriespalte und horizontalem Scrolling für die Monate.

## Design-Prinzipien

### 1. Layout-Konsistenz
- **Exakte Übernahme** des bestehenden BudgetsView-Layouts gesamt betrachtet
- **Wiederverwendung** Prüfe die Zusammenlegung der Komponenten, da die Maße ncht genau passen, bei Anzeige vieler Kategorien. Nicht konsistent
- **Beibehaltung** der bewährten Benutzerführung

### 2. Sticky-Bereiche
- **Header-Bereich**: Bleibt beim vertikalen Scrollen fixiert
- **Kategoriespalte**: Immer linksbündig halten. Mit der Monatsnavigation verändern sich nur die Wertebereiche.
- **Monats-Header**: Bleibt beim vertikalen Scrollen fixiert

### 3. Responsive Verhalten
- **Spaltenbreite**: Automatische Anpassung basierend auf Monatsanzahl
- **Horizontales Scrolling**: Kein Scrolling im herkömmlichen Sinne zulassen. Es können nur so viele Monate angezeigt werden, wie für den Benutzer lessbar gehalten werden können. Je nach Breite des Bildschirms die Maximalanzahl anzeigbarer Monate einschränken.
- **Monatsnavigation**: 1-6 Monate einstellbar (sehr Kleine Breite max 3 Monate; widescreen 6 monate). Bei Bildschirmgrößenänderung automatisch Monatsspalten reduzieren oder hinzunehmen bis die eingestellte Anzahl Monate erreicht ist als Maximalwert.

## Layout-Spezifikationen

### Gesamtlayout (identisch zu BudgetsView)

```css
.budgets-view-2 {
  height: calc(100vh - 189px); /* Identisch zu BudgetsView */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.budget-header-2 {
  flex-shrink: 0; /* Sticky Header */
}

.budget-content-2 {
  flex: 1;
  overflow-y: scroll; /* Vertikales Scrolling für Kategorien */
}

.budget-grid-2 {
  display: flex; /* Horizontales Layout */
}

.category-column-2 {
  flex: 0 0 calc(100% / (numMonths + 1)); /* Dynamische Breite */
}

.month-column-2 {
  flex: 0 0 calc(100% / (numMonths + 1)); /* Dynamische Breite */
}
```

### Header-Layout (identisch zu BudgetsView)

```vue
<!-- BudgetsView2.vue Header-Bereich -->
<template>
  <div class="h-[calc(100vh-189px)] flex flex-col overflow-hidden">
    <!-- Header - IDENTISCH zu BudgetsView -->
    <div class="flex-shrink-0">
      <div class="p-4 flex flex-col">
        <!-- Feste Header-Row mit drei Bereichen -->
        <div class="mb-4 flex items-center justify-between w-full">
          <!-- Links: Überschrift -->
          <div class="flex-shrink-0">
            <h1 class="text-2xl font-bold">Budgets 2</h1>
          </div>

          <!-- Mitte: Kalenderansicht - WIEDERVERWENDET -->
          <div class="flex-grow flex justify-center">
            <PagingYearComponent
              :displayedMonths="numMonths"
              :currentStartMonthOffset="monthOffset"
              @updateStartOffset="onUpdateStartOffset"
              @updateDisplayedMonths="onUpdateDisplayedMonths"
            />
          </div>

          <!-- Rechts: Platzhalter -->
          <div class="flex-shrink-0">
            <!-- Hier können später weitere Elemente hinzugefügt werden -->
          </div>
        </div>
      </div>

      <!-- Tabellenkopf - IDENTISCH -->
      <div class="flex overflow-y-scroll">
        <!-- Kategorie-Header -->
        <div
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col justify-end"
        >
          <!-- Toggle-Control - IDENTISCH -->
          <div
            class="text-sm flex items-center cursor-pointer"
            @click="toggleAll"
          >
            <Icon
              :icon="expanded.size > 0 ? 'mdi:chevron-up' : 'mdi:chevron-down'"
              class="text-md mr-1"
            />
            <span>{{
              expanded.size > 0 ? "alle einklappen" : "alle ausklappen"
            }}</span>
          </div>
        </div>

        <!-- Monats-Header - WIEDERVERWENDET -->
        <div
          v-for="(month, i) in months"
          :key="month.key"
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col"
        >
          <BudgetMonthHeaderCard
            :label="month.label"
            :toBudget="200"
            :budgeted="0"
            :overspent="0"
            :available="availableByMonth[i]"
            :nextMonth="0"
            :month="month"
          />
        </div>
      </div>
    </div>

    <!-- Scrollbarer Datenbereich - IDENTISCH -->
    <div class="flex-grow overflow-y-scroll">
      <div class="flex">
        <!-- Kategorie-Spalte - NEUE KOMPONENTE mit Gruppierung -->
        <div
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col"
        >
          <BudgetCategoryColumn2 />
        </div>

        <!-- Monats-Spalten - WIEDERVERWENDET -->
        <div
          v-for="month in months"
          :key="month.key"
          :style="{ flex: '0 0 calc(100% / ' + totalColumns + ')' }"
          class="flex flex-col"
        >
          <BudgetMonthCard
            :month="month"
            :categories="categoriesForMonthCard"
          />
        </div>
      </div>
    </div>
  </div>
</template>
```

### BudgetCategoryColumn2 - Neue Kategoriespalte mit Gruppierung

```vue
<!-- BudgetCategoryColumn2.vue -->
<template>
  <div
    class="bg-base-100 p-1 rounded-lg z-10"
    :style="$attrs.style"
  >
    <!-- Header-Ersatz: IDENTISCH zu BudgetCategoryColumn -->
    <div class="sticky top-0 bg-base-100 z-20">
      <div class="p-2 font-bold text-sm border-b border-base-300">
        Kategorie
      </div>
    </div>

    <!-- Muuri-Container für Drag & Drop -->
    <div ref="muuriContainer" class="muuri-grid-2">

      <!-- Ausgaben-Sektion -->
      <div class="expense-section">
        <!-- Sektion-Header -->
        <div class="p-2 font-bold text-sm border-b border-base-300 mt-2">
          Ausgaben
        </div>

        <!-- Kategoriegruppen (Lebensbereiche) -->
        <div
          v-for="group in expenseGroups"
          :key="group.id"
          class="muuri-item-2 category-group-item"
          :data-group-id="group.id"
          :data-group-type="expense"
          :data-sort-order="group.sortOrder"
        >
          <!-- Gruppen-Header -->
          <div class="group-header p-2 border-b border-base-200 flex items-center">
            <!-- Drag-Handle für Gruppe -->
            <div class="drag-handle-2 group-drag-handle mr-2 opacity-0 group-hover:opacity-60">
              <Icon icon="mdi:drag-vertical" class="w-4 h-4 text-base-content/60" />
            </div>

            <!-- Expand/Collapse Button - IDENTISCH zu BudgetCategoryColumn -->
            <button
              v-if="categoriesByGroup[group.id]?.length > 0"
              class="btn btn-ghost btn-xs px-1 mr-1"
              @click="toggleGroupExpanded(group.id)"
            >
              <Icon
                v-if="expandedGroups.has(group.id)"
                icon="mdi:chevron-up"
              />
              <Icon
                v-else
                icon="mdi:chevron-down"
              />
            </button>

            <!-- Gruppenname -->
            <span class="font-medium">{{ group.name }}</span>
          </div>

          <!-- Kategorien (wenn expandiert) - IDENTISCH zu BudgetCategoryColumn -->
          <template v-if="expandedGroups.has(group.id)">
            <div
              v-for="category in categoriesByGroup[group.id] || []"
              :key="category.id"
              class="muuri-item-2 category-item"
              :data-category-id="category.id"
              :data-group-id="category.categoryGroupId"
              :data-group-type="expense"
              :data-sort-order="category.sortOrder"
            >
              <div class="pl-6 text-sm p-2 border-b border-base-200 flex items-center group">
                <!-- Drag-Handle für Kategorie -->
                <div class="drag-handle-2 category-drag-handle mr-2 opacity-0 group-hover:opacity-60">
                  <Icon icon="mdi:drag-horizontal" class="w-4 h-4 text-base-content/60" />
                </div>

                <!-- Kategoriename -->
                <span>{{ category.name }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Einnahmen-Sektion - ANALOG zu Ausgaben -->
      <div class="income-section mt-4">
        <div class="p-2 font-bold text-sm border-b border-base-300">
          Einnahmen
        </div>

        <!-- Kategoriegruppen (Lebensbereiche) -->
        <div
          v-for="group in incomeGroups"
          :key="group.id"
          class="muuri-item-2 category-group-item"
          :data-group-id="group.id"
          :data-group-type="income"
          :data-sort-order="group.sortOrder"
        >
          <!-- Analog zu Ausgaben-Gruppen -->
        </div>
      </div>
    </div>
  </div>
</template>
```

## Sticky-Bereiche Implementierung

### CSS für Sticky-Verhalten

```css
/* Header-Bereich - bleibt beim vertikalen Scrollen fixiert */
.budget-header-2 {
  position: sticky;
  top: 0;
  z-index: 30;
  background: theme('colors.base.100');
}

/* Kategoriespalte - bleibt beim horizontalen Scrollen fixiert */
.category-column-2 {
  position: sticky;
  left: 0;
  z-index: 20;
  background: theme('colors.base.100');
}

/* Monats-Header - bleibt beim vertikalen Scrollen fixiert */
.month-header-sticky {
  position: sticky;
  top: 0;
  z-index: 25;
  background: theme('colors.base.100');
}

/* Kategorie-Header innerhalb der Spalte */
.category-header-sticky {
  position: sticky;
  top: 0;
  z-index: 15;
  background: theme('colors.base.100');
}
```

## Spaltenbreiten-Berechnung

### Dynamische Spaltenbreiten (identisch zu BudgetsView)

```typescript
// In BudgetsView2.vue
const totalColumns = computed(() => months.value.length + 1);

// CSS-Berechnung für Spaltenbreiten
const columnStyle = computed(() => ({
  flex: `0 0 calc(100% / ${totalColumns.value})`
}));
```

### Responsive Anpassungen

```css
/* Minimale Spaltenbreite für bessere Lesbarkeit */
.category-column-2,
.month-column-2 {
  min-width: 200px; /* Mindestbreite für Kategoriespalte */
}

.month-column-2 {
  min-width: 150px; /* Mindestbreite für Monatsspalten */
}

/* Bei sehr vielen Monaten: Horizontales Scrolling */
@media (max-width: 1200px) {
  .budget-grid-2 {
    overflow-x: auto;
  }

  .category-column-2 {
    min-width: 180px;
  }

  .month-column-2 {
    min-width: 120px;
  }
}
```

## Drag & Drop-Integration

### Muuri-Setup (nur in Kategoriespalte)

```typescript
// In BudgetCategoryColumn2.vue
import Muuri from 'muuri';

const muuriContainer = ref<HTMLElement | null>(null);
let muuriInstance: Muuri | null = null;

onMounted(async () => {
  await nextTick();
  initializeMuuri();
});

function initializeMuuri() {
  if (!muuriContainer.value) return;

  muuriInstance = new Muuri(muuriContainer.value, {
    items: '.muuri-item-2',
    dragEnabled: true,
    dragHandle: '.drag-handle-2',
    dragSortPredicate: {
      threshold: 50,
      action: 'move'
    },
    layout: {
      fillGaps: false,
      horizontal: false
    }
  });

  muuriInstance.on('dragEnd', handleDragEnd);
}
```

### Drag-Handles Styling

```css
/* Drag-Handles - nur sichtbar beim Hover */
.drag-handle-2 {
  @apply cursor-move transition-opacity duration-200;
  opacity: 0;
}

.group:hover .drag-handle-2,
.category-group-item:hover .drag-handle-2 {
  opacity: 0.6;
}

.muuri-item-2.muuri-item-dragging .drag-handle-2 {
  opacity: 1;
}

/* Drag-States */
.muuri-item-2.muuri-item-dragging {
  @apply shadow-lg z-50 rotate-1 scale-105;
  @apply transition-transform duration-200;
}

.muuri-item-2.muuri-item-releasing {
  @apply transition-all duration-300 ease-out;
}
```

## Komponenten-Wiederverwendung

### Bestehende Komponenten (unverändert)

1. **PagingYearComponent**: Komplette Wiederverwendung
2. **BudgetMonthHeaderCard**: Komplette Wiederverwendung
3. **BudgetMonthCard**: Komplette Wiederverwendung

### Neue Komponenten

1. **BudgetCategoryColumn2**: Neue Kategoriespalte mit Gruppierung
2. **BudgetsView2**: Neue Hauptview (basiert auf BudgetsView)

## Datenfluss (identisch zu BudgetsView)

### Computed Properties

```typescript
// In BudgetsView2.vue - IDENTISCH zu BudgetsView
const months = computed(() => {
  // Exakt gleiche Logik wie BudgetsView
  const result = [];
  const now = new Date();
  const leftDate = new Date(
    now.getFullYear(),
    now.getMonth() + monthOffset.value,
    1
  );

  for (let i = 0; i < numMonths.value; i++) {
    const d = new Date(leftDate.getFullYear(), leftDate.getMonth() + i, 1);
    const normalizedStart = new Date(toDateOnlyString(d));
    const lastDay = new Date(
      normalizedStart.getFullYear(),
      normalizedStart.getMonth() + 1,
      0
    );
    const normalizedEnd = new Date(toDateOnlyString(lastDay));
    result.push({
      key: `${normalizedStart.getFullYear()}-${normalizedStart.getMonth() + 1}`,
      label: normalizedStart.toLocaleString("de-DE", {
        month: "long",
        year: "numeric",
      }),
      start: normalizedStart,
      end: normalizedEnd,
    });
  }
  return result;
});

// Kompatibilität für BudgetMonthCard
const categoriesForMonthCard = computed(() => {
  return categoryStore.categories.filter((cat) => !cat.parentCategoryId);
});
```

### Event-Handler (identisch zu BudgetsView)

```typescript
// IDENTISCHE Event-Handler
function onUpdateStartOffset(newOffset: number) {
  monthOffset.value = newOffset;
}

function onUpdateDisplayedMonths(newCount: number) {
  numMonths.value = newCount;
}

function toggleAll() {
  if (expanded.value.size > 0) {
    categoryStore.collapseAllCategories();
  } else {
    categoryStore.expandAllCategories();
  }
}
```

## Performance-Überlegungen

### Identische Performance zu BudgetsView

- **Gleiche Komponenten**: BudgetMonthHeaderCard und BudgetMonthCard unverändert
- **Gleiche Datenlogik**: BudgetService-Aufrufe identisch
- **Zusätzlicher Overhead**: Nur durch Muuri in der Kategoriespalte

### Optimierungen

```typescript
// Lazy Loading für Muuri (nur bei Bedarf)
const enableDragDrop = ref(false);

function enableDragDropMode() {
  enableDragDrop.value = true;
  nextTick(() => {
    initializeMuuri();
  });
}
```

## Accessibility

### Keyboard Navigation (identisch zu BudgetsView)

```css
/* Focus-Styles */
.group-header:focus,
.category-row:focus {
  @apply outline-none ring-2 ring-primary ring-offset-2;
}
```

### ARIA-Labels

```vue
<template>
  <div
    class="category-group-item"
    role="group"
    :aria-label="`Lebensbereich ${group.name} mit ${categories.length} Kategorien`"
  >
    <button
      class="group-header"
      :aria-expanded="isExpanded"
      :aria-controls="`categories-${group.id}`"
      @click="toggleGroupExpanded(group.id)"
    >
      <!-- Header Content -->
    </button>

    <div
      v-if="isExpanded"
      :id="`categories-${group.id}`"
      class="categories-container"
      role="list"
    >
      <!-- Categories -->
    </div>
  </div>
</template>
```

Dieses Layout-Konzept gewährleistet 100%ige Kompatibilität mit der bestehenden BudgetsView bei gleichzeitiger Integration der neuen Kategoriegruppen-Funktionalität.
