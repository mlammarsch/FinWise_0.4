# Implementierungsplan: BudgetsView2 mit Kategoriegruppen - Überarbeitet

## Überblick

Dieser Plan beschreibt die schrittweise Implementierung der neuen BudgetsView2 unter **strikter Beibehaltung des bestehenden Layouts** der aktuellen BudgetsView. Das Ziel ist die Integration von Kategoriegruppen ohne Änderung der bewährten Benutzeroberfläche.

## Phase 1: Layout-Übernahme und Grundstruktur (Woche 1)

### 1.1 Navigation und Routing

**Dateien zu ändern:**
- `src/router/index.ts`
- `src/components/ui/MainNavigation.vue`

**Aufgaben:**
1. Neue Route `/budgets2` hinzufügen
2. "Budgets 2" Menüeintrag in MainNavigation einfügen
3. BudgetsView2.vue als exakte Kopie der BudgetsView.vue erstellen

**Code-Beispiel für Router:**
```typescript
// In src/router/index.ts
{
  path: '/budgets2',
  name: 'budgets2',
  component: () => import('@/views/BudgetsView2.vue'),
  meta: { title: 'Budgets 2', breadcrumb: 'Budgets 2' }
}
```

### 1.2 BudgetsView2.vue - Exakte Layout-Übernahme

**Neue Datei:**
- `src/views/BudgetsView2.vue` (basiert auf BudgetsView.vue)

**Template-Struktur (identisch zu BudgetsView):**
```vue
<template>
  <div class="h-[calc(100vh-189px)] flex flex-col overflow-hidden">
    <!-- Header - IDENTISCH -->
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
        <!-- Kategorie-Spalte - NEUE KOMPONENTE -->
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

### 1.3 Script-Logik (identisch zu BudgetsView)

```typescript
<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useCategoryStore } from "../stores/categoryStore";
import { useTransactionStore } from "../stores/transactionStore";
import BudgetCategoryColumn2 from "../components/budget/BudgetCategoryColumn2.vue";
import BudgetMonthCard from "../components/budget/BudgetMonthCard.vue";
import BudgetMonthHeaderCard from "../components/budget/BudgetMonthHeaderCard.vue";
import PagingYearComponent from "../components/ui/PagingYearComponent.vue";
import { toDateOnlyString } from "@/utils/formatters";
import { BalanceService } from "@/services/BalanceService";

const categoryStore = useCategoryStore();
const transactionStore = useTransactionStore();

// IDENTISCHE Logik zu BudgetsView
const localStorageKey = "finwise_budget2_months";
const numMonths = ref<number>(3);
const monthOffset = ref<number>(0);

// IDENTISCHE Event-Handler
function onUpdateStartOffset(newOffset: number) {
  monthOffset.value = newOffset;
}

function onUpdateDisplayedMonths(newCount: number) {
  numMonths.value = newCount;
}

// IDENTISCHE Computed Properties
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

const totalColumns = computed(() => months.value.length + 1);

// NEUE Logik für Kategoriegruppen
const categoriesForMonthCard = computed(() => {
  // Flache Liste für BudgetMonthCard (kompatibel)
  return categoryStore.categories.filter((cat) => !cat.parentCategoryId);
});

// Toggle-Funktionalität (identisch)
const expanded = categoryStore.expandedCategories;

function toggleAll() {
  if (expanded.value.size > 0) {
    categoryStore.collapseAllCategories();
  } else {
    categoryStore.expandAllCategories();
  }
}
</script>
```

## Phase 2: BudgetCategoryColumn2 - Kategoriegruppen-Integration (Woche 2)

### 2.1 Neue Kategoriespalte mit Gruppierung

**Neue Datei:**
- `src/components/budget/BudgetCategoryColumn2.vue`

**Template-Struktur:**
```vue
<template>
  <div
    class="bg-base-100 p-1 rounded-lg z-10"
    :style="$attrs.style"
  >
    <!-- Header-Ersatz: Identisch zu BudgetCategoryColumn -->
    <div class="sticky top-0 bg-base-100 z-20">
      <div class="p-2 font-bold text-sm border-b border-base-300">
        Kategorie
      </div>
    </div>

    <!-- Muuri-Container für Drag & Drop -->
    <div ref="muuriContainer" class="muuri-grid-2">

      <!-- Ausgaben-Sektion -->
      <div class="expense-section">
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
          <CategoryGroupRow2
            :group="group"
            :categories="categoriesByGroup[group.id] || []"
            :isExpanded="expandedGroups.has(group.id)"
            @toggle-expand="toggleGroupExpanded"
          />
        </div>
      </div>

      <!-- Einnahmen-Sektion -->
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
          <CategoryGroupRow2
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

### 2.2 CategoryGroupRow2 - Einzelne Kategoriegruppe

**Neue Datei:**
- `src/components/budget/CategoryGroupRow2.vue`

```vue
<template>
  <div class="category-group-row">
    <!-- Gruppen-Header -->
    <div class="group-header p-2 border-b border-base-200 flex items-center">
      <!-- Drag-Handle für Gruppe -->
      <div class="drag-handle-2 group-drag-handle mr-2 opacity-0 hover:opacity-60">
        <Icon icon="mdi:drag-vertical" class="w-4 h-4" />
      </div>

      <!-- Expand/Collapse Button -->
      <button
        class="btn btn-ghost btn-xs px-1 mr-1"
        @click="$emit('toggle-expand', group.id)"
      >
        <Icon
          :icon="isExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
          class="w-4 h-4"
        />
      </button>

      <!-- Gruppenname -->
      <span class="font-medium">{{ group.name }}</span>
    </div>

    <!-- Kategorien (wenn expandiert) -->
    <template v-if="isExpanded">
      <div
        v-for="category in categories"
        :key="category.id"
        class="muuri-item-2 category-item pl-6"
        :data-category-id="category.id"
        :data-group-id="category.categoryGroupId"
        :data-group-type="group.isIncomeGroup ? 'income' : 'expense'"
        :data-sort-order="category.sortOrder"
      >
        <div class="category-row text-sm p-2 border-b border-base-200 flex items-center">
          <!-- Drag-Handle für Kategorie -->
          <div class="drag-handle-2 category-drag-handle mr-2 opacity-0 hover:opacity-60">
            <Icon icon="mdi:drag-horizontal" class="w-4 h-4" />
          </div>

          <!-- Kategoriename -->
          <span>{{ category.name }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import type { CategoryGroup, Category } from "@/types";

defineProps<{
  group: CategoryGroup;
  categories: Category[];
  isExpanded: boolean;
}>();

defineEmits<{
  'toggle-expand': [groupId: string];
}>();
</script>
```

### 2.3 Computed Properties für Kategoriegruppen

```typescript
// In BudgetCategoryColumn2.vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCategoryStore } from '@/stores/categoryStore';

const categoryStore = useCategoryStore();

// Kategoriegruppen nach Typ getrennt
const expenseGroups = computed(() =>
  categoryStore.categoryGroups
    .filter(g => !g.isIncomeGroup)
    .sort((a, b) => a.sortOrder - b.sortOrder)
);

const incomeGroups = computed(() =>
  categoryStore.categoryGroups
    .filter(g => g.isIncomeGroup)
    .sort((a, b) => a.sortOrder - b.sortOrder)
);

// Kategorien nach Gruppen organisiert
const categoriesByGroup = computed(() => {
  const grouped: Record<string, Category[]> = {};
  for (const group of categoryStore.categoryGroups) {
    grouped[group.id] = categoryStore.categories
      .filter(c => c.categoryGroupId === group.id && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return grouped;
});

// Expand/Collapse State (wiederverwendet)
const expandedGroups = computed(() => categoryStore.expandedCategories);

function toggleGroupExpanded(groupId: string) {
  categoryStore.toggleCategoryExpanded(groupId);
}
</script>
```

## Phase 3: Muuri-Integration (Woche 3)

### 3.1 Muuri-Setup in BudgetCategoryColumn2

```typescript
// In BudgetCategoryColumn2.vue
import Muuri from 'muuri';
import { onMounted, onUnmounted, nextTick } from 'vue';

const muuriContainer = ref<HTMLElement | null>(null);
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

  // Event-Listener
  muuriInstance.on('dragEnd', handleDragEnd);
}

function handleDragEnd(item: any) {
  const element = item.getElement();
  const isCategory = element.classList.contains('category-item');
  const isGroup = element.classList.contains('category-group-item');

  if (isCategory) {
    handleCategoryDrop(item);
  } else if (isGroup) {
    handleGroupDrop(item);
  }
}
```

### 3.2 Drag & Drop-Handler

```typescript
async function handleCategoryDrop(item: any) {
  const element = item.getElement();
  const categoryId = element.dataset.categoryId;
  const newIndex = item.getGrid().getItems().indexOf(item);

  // Neue Gruppe ermitteln
  const newGroupId = findTargetGroupId(element);
  const newSortOrder = calculateNewSortOrder(newIndex);

  try {
    await CategoryService.updateCategory(categoryId, {
      sortOrder: newSortOrder,
      categoryGroupId: newGroupId,
      updated_at: new Date().toISOString()
    });

    infoLog('BudgetCategoryColumn2', 'Category reordered', { categoryId, newSortOrder });

  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Failed to reorder category', error);
    // Rollback Muuri position
    await rollbackMuuriPosition();
  }
}

async function handleGroupDrop(item: any) {
  const element = item.getElement();
  const groupId = element.dataset.groupId;
  const newIndex = item.getGrid().getItems().indexOf(item);
  const newSortOrder = calculateNewSortOrder(newIndex);

  try {
    await CategoryService.updateCategoryGroup(groupId, {
      sortOrder: newSortOrder,
      updated_at: new Date().toISOString()
    });

    infoLog('BudgetCategoryColumn2', 'Group reordered', { groupId, newSortOrder });

  } catch (error) {
    errorLog('BudgetCategoryColumn2', 'Failed to reorder group', error);
    await rollbackMuuriPosition();
  }
}
```

## Datenkompatibilität

### BudgetMonthCard-Kompatibilität

Die bestehende BudgetMonthCard erwartet eine flache Kategorienliste. Diese wird bereitgestellt:

```typescript
// In BudgetsView2.vue
const categoriesForMonthCard = computed(() => {
  // Flache Liste aller aktiven Kategorien (kompatibel mit BudgetMonthCard)
  return categoryStore.categories.filter((cat) =>
    cat.isActive && !cat.parentCategoryId
  );
});
```

### BudgetService-Integration

Alle bestehenden BudgetService-Methoden funktionieren unverändert:

```typescript
// BudgetService.getAggregatedMonthlyBudgetData() bleibt unverändert
// BudgetService.getSingleCategoryMonthlyBudgetData() bleibt unverändert
// BudgetService.getMonthlySummary() bleibt unverändert
```

## CSS-Anpassungen

### Drag & Drop-Styles

```css
/* Drag-Handles */
.drag-handle-2 {
  @apply cursor-move transition-opacity duration-200;
}

.muuri-item-2:hover .drag-handle-2 {
  @apply opacity-60;
}

/* Drag-States */
.muuri-item-2.muuri-item-dragging {
  @apply shadow-lg z-50 rotate-1;
}

.muuri-item-2.muuri-item-releasing {
  @apply transition-all duration-300;
}

/* Grid-Container */
.muuri-grid-2 {
  @apply relative;
}
```

## Rollout-Plan

### Entwicklung
1. **Woche 1**: Layout-Übernahme und Grundstruktur
2. **Woche 2**: Kategoriegruppen-Integration
3. **Woche 3**: Muuri-Integration und Drag & Drop

### Bereitstellung
- **Woche 4**: Finale Tests und Bereitstellung als "Budgets 2"

## Erfolgskriterien

1. **Layout-Identität**: 100% visuelle Übereinstimmung mit BudgetsView
2. **Komponenten-Wiederverwendung**: BudgetMonthHeaderCard und BudgetMonthCard unverändert
3. **Funktionalität**: Alle bestehenden Features funktionieren identisch
4. **Performance**: Keine Verschlechterung der Ladezeiten
5. **Drag & Drop**: Intuitive Sortierung von Kategorien und Gruppen
