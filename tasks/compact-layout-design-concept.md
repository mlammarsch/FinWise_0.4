# Layout-Konzept für kompakte Darstellung - BudgetsView2

## Überblick

Dieses Dokument beschreibt das Layout-Konzept für die neue BudgetsView2 mit Fokus auf maximale Informationsdichte bei optimaler Benutzerfreundlichkeit. Das Design zielt darauf ab, möglichst viele Budgetinformationen auf einer Bildschirmseite darzustellen.

## Design-Prinzipien

### 1. Informationsdichte maximieren
- Kleine, aber lesbare Schriftgrößen
- Kompakte Zeilenhöhen
- Effiziente Nutzung des verfügbaren Platzes
- Minimale Abstände zwischen Elementen

### 2. Visuelle Hierarchie beibehalten
- Klare Unterscheidung zwischen Gruppen und Kategorien
- Farbkodierung für Ausgaben vs. Einnahmen
- Konsistente Einrückungen und Gruppierungen

### 3. Skalierbarkeit gewährleisten
- Responsive Design für verschiedene Bildschirmgrößen
- Horizontales Scrolling für viele Monate
- Vertikales Scrolling für viele Kategorien

## Layout-Spezifikationen

### Gesamtlayout

```css
.budgets-view-2 {
  height: calc(100vh - 189px); /* Abzüglich Navigation und Header */
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 0.75rem; /* 12px - Basis für kompakte Darstellung */
  line-height: 1.2;
}

.budget-header-2 {
  flex-shrink: 0;
  height: 80px; /* Kompakter Header */
  background: theme('colors.base.100');
  border-bottom: 1px solid theme('colors.base.300');
  z-index: 20;
}

.budget-content-2 {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.budget-sidebar-2 {
  width: 280px; /* Feste Breite für Kategorien */
  flex-shrink: 0;
  background: theme('colors.base.50');
  border-right: 1px solid theme('colors.base.300');
  overflow-y: auto;
}

.budget-grid-2 {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}
```

### Header-Layout

```vue
<!-- BudgetHeader2.vue -->
<template>
  <div class="budget-header-2 px-4 py-2">
    <div class="flex items-center justify-between h-full">
      <!-- Links: Titel und Controls -->
      <div class="flex items-center space-x-4">
        <h1 class="text-lg font-bold text-base-content">Budgets 2</h1>
        <button
          class="btn btn-xs btn-ghost"
          @click="toggleAllGroups"
        >
          <Icon :icon="allExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
          <span class="ml-1 text-xs">{{ allExpanded ? 'Alle einklappen' : 'Alle ausklappen' }}</span>
        </button>
      </div>

      <!-- Mitte: Monatsnavigation -->
      <div class="flex-1 flex justify-center">
        <PagingYearComponent
          :displayedMonths="numMonths"
          :currentStartMonthOffset="monthOffset"
          @updateStartOffset="onUpdateStartOffset"
          @updateDisplayedMonths="onUpdateDisplayedMonths"
          compact
        />
      </div>

      <!-- Rechts: Zusätzliche Controls -->
      <div class="flex items-center space-x-2">
        <div class="text-xs text-base-content/70">
          {{ totalCategories }} Kategorien
        </div>
      </div>
    </div>
  </div>
</template>
```

### Sidebar-Layout (Kategorien)

```vue
<!-- BudgetSidebar2.vue -->
<template>
  <div class="budget-sidebar-2">
    <!-- Sticky Header -->
    <div class="sticky top-0 bg-base-50 z-10 px-3 py-2 border-b border-base-300">
      <div class="text-xs font-semibold text-base-content/80 uppercase tracking-wide">
        Kategorien
      </div>
    </div>

    <!-- Ausgaben-Sektion -->
    <div class="expense-section">
      <div class="section-header px-3 py-2 bg-red-50 border-b border-red-200">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-red-800">Ausgaben</span>
          <span class="text-xs text-red-600">{{ expenseGroups.length }} Bereiche</span>
        </div>
      </div>

      <div class="muuri-container" data-section="expense">
        <div
          v-for="group in expenseGroups"
          :key="group.id"
          class="muuri-item-2 category-group-item"
          :data-group-id="group.id"
          :data-group-type="expense"
        >
          <CategoryGroupItem2
            :group="group"
            :categories="categoriesByGroup[group.id] || []"
            :isExpanded="expandedGroups.has(group.id)"
            @toggle-expand="toggleGroupExpanded"
          />
        </div>
      </div>
    </div>

    <!-- Einnahmen-Sektion -->
    <div class="income-section mt-4">
      <div class="section-header px-3 py-2 bg-green-50 border-b border-green-200">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-green-800">Einnahmen</span>
          <span class="text-xs text-green-600">{{ incomeGroups.length }} Bereiche</span>
        </div>
      </div>

      <div class="muuri-container" data-section="income">
        <div
          v-for="group in incomeGroups"
          :key="group.id"
          class="muuri-item-2 category-group-item"
          :data-group-id="group.id"
          :data-group-type="income"
        >
          <CategoryGroupItem2
            :group="group"
            :categories="categoriesByGroup[group.id] || []"
            :isExpanded="expandedGroups.has(group.id)"
            @toggle-expand="toggleGroupExpanded"
          />
        </div>
      </div>
    </div>
  </div>
</template>
```

### Kategoriegruppen-Layout

```vue
<!-- CategoryGroupItem2.vue -->
<template>
  <div class="category-group-item-2">
    <!-- Gruppen-Header -->
    <div
      class="group-header flex items-center px-2 py-1.5 hover:bg-base-100 cursor-pointer"
      @click="$emit('toggle-expand', group.id)"
    >
      <div class="drag-handle-2 group-drag-handle mr-2 opacity-0 group-hover:opacity-60">
        <Icon icon="mdi:drag-vertical" class="w-3 h-3" />
      </div>

      <Icon
        :icon="isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'"
        class="w-3 h-3 mr-2 text-base-content/60"
      />

      <span class="text-xs font-medium text-base-content flex-1 truncate">
        {{ group.name }}
      </span>

      <div class="text-xs text-base-content/50 ml-2">
        {{ categories.length }}
      </div>
    </div>

    <!-- Kategorien (expandiert) -->
    <div
      v-if="isExpanded"
      class="categories-container ml-4 border-l border-base-200"
    >
      <div
        v-for="category in categories"
        :key="category.id"
        class="muuri-item-2 category-item"
        :data-category-id="category.id"
        :data-group-id="category.categoryGroupId"
      >
        <div class="category-row flex items-center px-2 py-1 hover:bg-base-100 group">
          <div class="drag-handle-2 category-drag-handle mr-2 opacity-0 group-hover:opacity-60">
            <Icon icon="mdi:drag-horizontal" class="w-3 h-3" />
          </div>

          <div class="w-2 h-2 rounded-full mr-2" :class="getCategoryColor(category)"></div>

          <span class="text-xs text-base-content flex-1 truncate">
            {{ category.name }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-group-item-2 {
  @apply border-b border-base-200 last:border-b-0;
}

.group-header {
  @apply transition-colors duration-150;
}

.category-row {
  @apply transition-colors duration-150;
  min-height: 24px; /* Sehr kompakte Zeilen */
}
</style>
```

### Monats-Grid-Layout

```vue
<!-- BudgetMonthGrid2.vue -->
<template>
  <div class="budget-month-grid">
    <!-- Sticky Header mit Monaten -->
    <div class="month-header sticky top-0 bg-base-100 z-10 border-b border-base-300">
      <div class="grid-header flex">
        <div
          v-for="month in months"
          :key="month.key"
          class="month-column"
          :style="{ minWidth: `${columnWidth}px` }"
        >
          <div class="month-header-content p-2">
            <div class="text-xs font-semibold text-center text-base-content">
              {{ month.label }}
            </div>
            <div class="grid grid-cols-4 gap-1 mt-1 text-xs">
              <div class="text-center text-base-content/60">Budget</div>
              <div class="text-center text-base-content/60">Prognose</div>
              <div class="text-center text-base-content/60">Ist</div>
              <div class="text-center text-base-content/60">Saldo</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Daten-Grid -->
    <div class="data-grid">
      <!-- Ausgaben-Sektion -->
      <div class="expense-data-section">
        <div
          v-for="group in expenseGroups"
          :key="group.id"
          class="group-data-row"
        >
          <!-- Gruppen-Zeile -->
          <div class="group-row flex bg-red-50">
            <div
              v-for="month in months"
              :key="`${group.id}-${month.key}`"
              class="month-column"
              :style="{ minWidth: `${columnWidth}px` }"
            >
              <GroupMonthData2
                :group="group"
                :month="month"
                :categories="categoriesByGroup[group.id] || []"
              />
            </div>
          </div>

          <!-- Kategorie-Zeilen (wenn expandiert) -->
          <template v-if="expandedGroups.has(group.id)">
            <div
              v-for="category in categoriesByGroup[group.id] || []"
              :key="category.id"
              class="category-row flex hover:bg-base-50"
            >
              <div
                v-for="month in months"
                :key="`${category.id}-${month.key}`"
                class="month-column"
                :style="{ minWidth: `${columnWidth}px` }"
              >
                <CategoryMonthData2
                  :category="category"
                  :month="month"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Einnahmen-Sektion -->
      <div class="income-data-section mt-4">
        <div
          v-for="group in incomeGroups"
          :key="group.id"
          class="group-data-row"
        >
          <!-- Analog zu Ausgaben-Sektion -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const columnWidth = computed(() => {
  // Dynamische Spaltenbreite basierend auf Anzahl der Monate
  const availableWidth = window.innerWidth - 280; // Abzüglich Sidebar
  const minColumnWidth = 120;
  const maxColumnWidth = 160;

  const calculatedWidth = Math.floor(availableWidth / months.value.length);
  return Math.max(minColumnWidth, Math.min(maxColumnWidth, calculatedWidth));
});
</script>
```

### Monatsdaten-Komponenten

```vue
<!-- CategoryMonthData2.vue -->
<template>
  <div class="category-month-data p-1">
    <div class="grid grid-cols-4 gap-1 text-xs">
      <!-- Budget -->
      <div class="text-right" :class="getBudgetColor(budgetData.budgeted)">
        <CurrencyDisplay
          :amount="budgetData.budgeted"
          :showCurrency="false"
          compact
        />
      </div>

      <!-- Prognose -->
      <div class="text-right text-blue-600">
        <CurrencyDisplay
          :amount="budgetData.forecast"
          :showCurrency="false"
          compact
        />
      </div>

      <!-- Ist-Wert -->
      <div class="text-right" :class="getSpentColor(budgetData.spent)">
        <CurrencyDisplay
          :amount="budgetData.spent"
          :showCurrency="false"
          compact
        />
      </div>

      <!-- Saldo -->
      <div class="text-right font-medium" :class="getSaldoColor(budgetData.saldo)">
        <CurrencyDisplay
          :amount="budgetData.saldo"
          :showCurrency="false"
          compact
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-month-data {
  min-height: 24px; /* Sehr kompakte Zeilen */
  @apply border-b border-base-200 last:border-b-0;
}
</style>
```

## Responsive Design

### Breakpoint-Definitionen

```css
/* Tailwind Custom Breakpoints */
@screen xs {
  /* 480px - Sehr kleine Bildschirme */
}

@screen sm {
  /* 640px - Kleine Bildschirme */
}

@screen md {
  /* 768px - Mittlere Bildschirme */
}

@screen lg {
  /* 1024px - Große Bildschirme */
}

@screen xl {
  /* 1280px - Sehr große Bildschirme */
}

@screen 2xl {
  /* 1536px - Ultra-große Bildschirme */
}
```

### Responsive Anpassungen

```css
/* Mobile First Approach */
.budgets-view-2 {
  font-size: 0.625rem; /* 10px auf mobilen Geräten */
}

@screen sm {
  .budgets-view-2 {
    font-size: 0.75rem; /* 12px auf kleinen Bildschirmen */
  }
}

@screen lg {
  .budgets-view-2 {
    font-size: 0.875rem; /* 14px auf großen Bildschirmen */
  }
}

/* Sidebar-Anpassungen */
.budget-sidebar-2 {
  width: 240px; /* Schmaler auf kleineren Bildschirmen */
}

@screen lg {
  .budget-sidebar-2 {
    width: 280px;
  }
}

@screen xl {
  .budget-sidebar-2 {
    width: 320px; /* Breiter auf sehr großen Bildschirmen */
  }
}

/* Spaltenbreiten */
.month-column {
  min-width: 100px; /* Minimum auf mobilen Geräten */
}

@screen sm {
  .month-column {
    min-width: 120px;
  }
}

@screen lg {
  .month-column {
    min-width: 140px;
  }
}

@screen xl {
  .month-column {
    min-width: 160px;
  }
}
```

## Farbschema und Visuelle Hierarchie

### Farbdefinitionen

```css
:root {
  /* Ausgaben-Farben */
  --expense-primary: theme('colors.red.600');
  --expense-secondary: theme('colors.red.100');
  --expense-hover: theme('colors.red.50');

  /* Einnahmen-Farben */
  --income-primary: theme('colors.green.600');
  --income-secondary: theme('colors.green.100');
  --income-hover: theme('colors.green.50');

  /* Status-Farben */
  --positive: theme('colors.green.600');
  --negative: theme('colors.red.600');
  --neutral: theme('colors.gray.600');
  --warning: theme('colors.yellow.600');
}
```

### Kategoriefarben

```typescript
function getCategoryColor(category: Category): string {
  if (category.isIncomeCategory) {
    return 'bg-green-400';
  }

  // Farbzuordnung basierend auf Kategoriegruppe
  const colorMap: Record<string, string> = {
    'haushalt': 'bg-blue-400',
    'fuhrpark': 'bg-purple-400',
    'hobby': 'bg-pink-400',
    'gesundheit': 'bg-teal-400',
    'versicherung': 'bg-orange-400',
  };

  const groupName = category.categoryGroupId ?
    categoryStore.categoryGroups.find(g => g.id === category.categoryGroupId)?.name.toLowerCase() :
    'default';

  return colorMap[groupName] || 'bg-gray-400';
}
```

### Betragsfarben

```typescript
function getBudgetColor(amount: number): string {
  if (amount > 0) return 'text-blue-600';
  if (amount < 0) return 'text-red-600';
  return 'text-gray-500';
}

function getSpentColor(amount: number): string {
  if (amount > 0) return 'text-red-600';
  if (amount < 0) return 'text-green-600';
  return 'text-gray-500';
}

function getSaldoColor(amount: number): string {
  if (amount > 0) return 'text-green-600 font-semibold';
  if (amount < 0) return 'text-red-600 font-semibold';
  return 'text-gray-600';
}
```

## Performance-Optimierungen

### Virtualisierung für große Listen

```vue
<!-- Für sehr viele Kategorien -->
<template>
  <RecycleScroller
    class="scroller"
    :items="categories"
    :item-size="24"
    key-field="id"
    v-slot="{ item }"
  >
    <CategoryRow2 :category="item" />
  </RecycleScroller>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller';
</script>
```

### Lazy Loading von Monatsdaten

```typescript
const monthDataCache = new Map<string, MonthlyBudgetData>();

const getMonthData = computed(() => (categoryId: string, monthKey: string) => {
  const cacheKey = `${categoryId}-${monthKey}`;

  if (!monthDataCache.has(cacheKey)) {
    const data = BudgetService.getAggregatedMonthlyBudgetData(
      categoryId,
      month.start,
      month.end
    );
    monthDataCache.set(cacheKey, data);
  }

  return monthDataCache.get(cacheKey);
});
```

## Accessibility-Überlegungen

### Keyboard Navigation

```css
/* Focus-Styles für Tastaturnavigation */
.category-row:focus,
.group-header:focus {
  @apply outline-none ring-2 ring-primary ring-offset-2;
}

/* Skip-Links für Screenreader */
.skip-link {
  @apply sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4;
  @apply bg-primary text-primary-content px-4 py-2 rounded;
  @apply z-50;
}
```

### ARIA-Labels

```vue
<template>
  <div
    class="category-group-item-2"
    role="group"
    :aria-label="`Lebensbereich ${group.name} mit ${categories.length} Kategorien`"
  >
    <button
      class="group-header"
      :aria-expanded="isExpanded"
      :aria-controls="`categories-${group.id}`"
      @click="$emit('toggle-expand', group.id)"
    >
      <!-- Header Content -->
    </button>

    <div
      v-if="isExpanded"
      :id="`categories-${group.id}`"
      class="categories-container"
      role="list"
    >
      <div
        v-for="category in categories"
        :key="category.id"
        role="listitem"
        :aria-label="`Kategorie ${category.name}`"
      >
        <!-- Category Content -->
      </div>
    </div>
  </div>
</template>
```

## Print-Styles

```css
@media print {
  .budgets-view-2 {
    height: auto;
    overflow: visible;
    font-size: 8pt;
  }

  .budget-sidebar-2 {
    width: 30%;
    float: left;
  }

  .budget-month-grid {
    width: 70%;
    float: right;
    overflow: visible;
  }

  .drag-handle-2 {
    display: none;
  }

  .month-column {
    min-width: auto;
    width: auto;
  }

  /* Seitenumbrüche */
  .category-group-item-2 {
    break-inside: avoid;
  }

  .group-data-row {
    break-inside: avoid;
  }
}
```

Dieses Layout-Konzept bietet eine hochkompakte, aber dennoch benutzerfreundliche Darstellung der Budgetdaten mit maximaler Informationsdichte und optimaler Performance.
