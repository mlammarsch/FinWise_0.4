<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCategoryStore } from '../../stores/categoryStore';
import { Icon } from '@iconify/vue';
import type { CategoryGroup, Category } from '../../types';

interface Props {
  group: CategoryGroup;
  categories: Category[];
}

const props = defineProps<Props>();
const categoryStore = useCategoryStore();

// Lokaler Expand/Collapse State für diese Gruppe
const isExpanded = computed({
  get: () => categoryStore.expandedCategories.has(props.group.id),
  set: (value: boolean) => {
    if (value) {
      categoryStore.expandedCategories.add(props.group.id);
    } else {
      categoryStore.expandedCategories.delete(props.group.id);
    }
  }
});

const emit = defineEmits(['toggle']);

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
  emit('toggle');
}

// Untergeordnete Kategorien für jede Hauptkategorie
function getChildCategories(parentId: string): Category[] {
  return categoryStore.categories
    .filter((cat: Category) => cat.parentCategoryId === parentId)
    .sort((a: Category, b: Category) => a.sortOrder - b.sortOrder);
}
</script>

<template>
  <div class="category-group-row">
    <!-- Kategoriegruppen-Header -->
    <div class="group-header flex items-center p-3 bg-base-100 border-b border-base-300 hover:bg-base-50 cursor-pointer">
      <!-- Drag Handle für Gruppe -->
      <div class="drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
        <Icon icon="mdi:drag-vertical" class="w-4 h-4 text-base-content/60" />
      </div>

      <!-- Toggle Button -->
      <button
        @click="toggleExpanded"
        class="flex-shrink-0 mr-2 p-1 rounded hover:bg-base-200 transition-colors"
      >
        <Icon
          :icon="isExpanded ? 'mdi:chevron-down' : 'mdi:chevron-right'"
          class="w-4 h-4 text-base-content/80"
        />
      </button>

      <!-- Gruppenname -->
      <div class="flex-grow">
        <h4 class="font-semibold text-sm text-base-content">{{ group.name }}</h4>
      </div>

      <!-- Gruppenstatus-Indikator -->
      <div class="flex-shrink-0 text-xs text-base-content/60">
        {{ categories.length }} {{ categories.length === 1 ? 'Kategorie' : 'Kategorien' }}
      </div>
    </div>

    <!-- Kategorien-Liste (nur wenn erweitert) -->
    <div v-if="isExpanded" class="categories-list">
      <!-- Hauptkategorien -->
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item muuri-item"
        :data-category-id="category.id"
        :data-group-id="group.id"
      >
        <!-- Hauptkategorie -->
        <div class="flex items-center p-2 pl-8 bg-base-50 border-b border-base-200 hover:bg-base-100 cursor-pointer">
          <!-- Drag Handle für Kategorie -->
          <div class="drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
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
          class="flex items-center p-2 pl-12 bg-base-25 border-b border-base-200 hover:bg-base-50 cursor-pointer muuri-item"
          :data-category-id="childCategory.id"
          :data-group-id="group.id"
        >
          <!-- Drag Handle für Unterkategorie -->
          <div class="drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100">
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
