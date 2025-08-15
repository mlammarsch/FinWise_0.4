<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

interface Props {
  categories: any[];
  months: any[];
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
}

const props = withDefaults(defineProps<Props>(), {
  itemHeight: 60, // Höhe pro Kategorie-Zeile in Pixeln
  containerHeight: 600, // Standard-Container-Höhe
  overscan: 5 // Anzahl zusätzlicher Items außerhalb des sichtbaren Bereichs
});

const emit = defineEmits<{
  'item-click': [category: any];
  'budget-update': [categoryId: string, monthKey: string, value: number];
}>();

// Refs für Virtualisierung
const containerRef = ref<HTMLElement>();
const scrollTop = ref(0);
const containerHeightRef = ref(props.containerHeight);

// Berechne sichtbare Items
const visibleRange = computed(() => {
  const startIndex = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan);
  const endIndex = Math.min(
    props.categories.length - 1,
    Math.ceil((scrollTop.value + containerHeightRef.value) / props.itemHeight) + props.overscan
  );

  return { startIndex, endIndex };
});

const visibleCategories = computed(() => {
  const { startIndex, endIndex } = visibleRange.value;
  return props.categories.slice(startIndex, endIndex + 1).map((category, index) => ({
    ...category,
    virtualIndex: startIndex + index,
    offsetTop: (startIndex + index) * props.itemHeight
  }));
});

// Gesamthöhe des virtuellen Containers
const totalHeight = computed(() => props.categories.length * props.itemHeight);

// Scroll-Handler
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement;
  scrollTop.value = target.scrollTop;
};

// Resize-Observer für dynamische Container-Höhe
let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  await nextTick();

  if (containerRef.value) {
    // Initiale Höhe setzen
    containerHeightRef.value = containerRef.value.clientHeight || props.containerHeight;

    // Resize-Observer für dynamische Anpassung
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerHeightRef.value = entry.contentRect.height;
      }
    });

    resizeObserver.observe(containerRef.value);

    console.debug('[VirtualizedBudgetTable]', `Initialized with ${props.categories.length} categories, container height: ${containerHeightRef.value}px`);
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

// Scroll zu bestimmter Kategorie
const scrollToCategory = (categoryIndex: number) => {
  if (containerRef.value) {
    const targetScrollTop = categoryIndex * props.itemHeight;
    containerRef.value.scrollTop = targetScrollTop;
    scrollTop.value = targetScrollTop;
  }
};

// Expose für Parent-Komponente
defineExpose({
  scrollToCategory
});

// Event-Handler
const handleCategoryClick = (category: any) => {
  emit('item-click', category);
};

const handleBudgetUpdate = (categoryId: string, monthKey: string, value: number) => {
  emit('budget-update', categoryId, monthKey, value);
};
</script>

<template>
  <div
    ref="containerRef"
    class="virtualized-budget-table"
    :style="{ height: `${containerHeight}px`, overflow: 'auto' }"
    @scroll="handleScroll"
  >
    <!-- Virtueller Container mit Gesamthöhe -->
    <div
      class="virtual-container"
      :style="{ height: `${totalHeight}px`, position: 'relative' }"
    >
      <!-- Nur sichtbare Kategorien rendern -->
      <div
        v-for="category in visibleCategories"
        :key="category.id"
        class="budget-category-row"
        :style="{
          position: 'absolute',
          top: `${category.offsetTop}px`,
          left: '0',
          right: '0',
          height: `${itemHeight}px`
        }"
        @click="handleCategoryClick(category)"
      >
        <!-- Kategorie-Name -->
        <div class="category-name">
          <span class="category-icon" v-if="category.icon">{{ category.icon }}</span>
          <span class="category-title">{{ category.name }}</span>
          <span class="category-balance" v-if="category.balance !== undefined">
            {{ category.balance.toFixed(2) }}€
          </span>
        </div>

        <!-- Budget-Werte für jeden Monat -->
        <div class="budget-months">
          <div
            v-for="month in months"
            :key="month.key"
            class="budget-month"
          >
            <div class="budget-values">
              <input
                type="number"
                :value="category.budgets?.[month.key]?.budgeted || 0"
                @input="handleBudgetUpdate(category.id, month.key, parseFloat(($event.target as HTMLInputElement).value) || 0)"
                class="budget-input"
                step="0.01"
                placeholder="0.00"
              />
              <div class="budget-spent">
                {{ (category.budgets?.[month.key]?.spent || 0).toFixed(2) }}€
              </div>
              <div class="budget-saldo" :class="{
                'positive': (category.budgets?.[month.key]?.saldo || 0) > 0,
                'negative': (category.budgets?.[month.key]?.saldo || 0) < 0
              }">
                {{ (category.budgets?.[month.key]?.saldo || 0).toFixed(2) }}€
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.virtualized-budget-table {
  @apply border border-gray-200 rounded-lg;
}

.virtual-container {
  @apply w-full;
}

.budget-category-row {
  @apply flex items-center px-4 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer;
  transition: background-color 0.15s ease;
}

.category-name {
  @apply flex items-center space-x-2 min-w-0 flex-1;
}

.category-icon {
  @apply text-lg flex-shrink-0;
}

.category-title {
  @apply font-medium text-gray-900 truncate;
}

.category-balance {
  @apply text-sm text-gray-600 ml-auto;
}

.budget-months {
  @apply flex space-x-4 ml-4;
}

.budget-month {
  @apply min-w-0 flex-shrink-0;
  width: 120px;
}

.budget-values {
  @apply space-y-1;
}

.budget-input {
  @apply w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.budget-spent {
  @apply text-xs text-gray-600 text-center;
}

.budget-saldo {
  @apply text-xs font-medium text-center;
}

.budget-saldo.positive {
  @apply text-green-600;
}

.budget-saldo.negative {
  @apply text-red-600;
}

/* Scrollbar-Styling */
.virtualized-budget-table::-webkit-scrollbar {
  width: 8px;
}

.virtualized-budget-table::-webkit-scrollbar-track {
  @apply bg-gray-100 rounded;
}

.virtualized-budget-table::-webkit-scrollbar-thumb {
  @apply bg-gray-400 rounded hover:bg-gray-500;
}
</style>
