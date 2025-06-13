<!-- Datei: src/components/budget/BudgetCategoryColumn.vue -->
<script setup lang="ts">
/**
 * Zeigt links die Kategorien an, unterteilt in Ausgaben und Einnahmen.
 */
import { computed } from "vue";
import { CategoryService } from "../../services/CategoryService";
import { Icon } from "@iconify/vue";

const isVerfuegbareMittel = (cat: { name: string }) =>
  cat.name.trim().toLowerCase() === "verfügbare mittel";

const rootCategories = computed(() =>
  CategoryService.getCategories().value.filter(
    (c) => c.isActive && !c.parentCategoryId && !isVerfuegbareMittel(c)
  )
);

const toggleExpand = (id: string) => {
  CategoryService.toggleCategoryExpanded(id);
};
</script>

<template>
  <div
    class="bg-base-100 p-1 rounded-lg z-10"
    :style="$attrs.style"
  >
    <!-- Header-Ersatz: Leerzeile, da wir im BudgetMonthHeaderCard den Spaltenkopf haben -->
    <div class="sticky top-0 bg-base-100 z-20">
      <div class="p-2 font-bold text-sm border-b border-base-300">
        Kategorie
      </div>
    </div>

    <!-- Ausgaben -->
    <div class="p-2 font-bold text-sm border-b border-base-300 mt-2">
      Ausgaben
    </div>
    <div
      v-for="cat in rootCategories.filter((c) => !c.isIncomeCategory)"
      :key="cat.id"
    >
      <div class="p-2 border-b border-base-200 flex items-center">
        <button
          v-if="
            CategoryService.getChildCategories(cat.id).value.filter(
              (c) => c.isActive && !isVerfuegbareMittel(c)
            ).length > 0
          "
          class="btn btn-ghost btn-xs px-1 mr-1"
          @click="toggleExpand(cat.id)"
        >
          <Icon
            v-if="CategoryService.getExpandedCategories().value.has(cat.id)"
            icon="mdi:chevron-up"
          />
          <Icon
            v-else
            icon="mdi:chevron-down"
          />
        </button>
        <span>{{ cat.name }}</span>
      </div>
      <template
        v-if="CategoryService.getExpandedCategories().value.has(cat.id)"
      >
        <div
          v-for="child in CategoryService.getChildCategories(
            cat.id
          ).value.filter((c) => c.isActive && !isVerfuegbareMittel(c))"
          :key="child.id"
          class="pl-6 text-sm p-2 border-b border-base-200"
        >
          {{ child.name }}
        </div>
      </template>
    </div>

    <!-- Einnahmen -->
    <div class="p-2 font-bold text-sm border-b border-base-300 mt-4">
      Einnahmen
    </div>
    <div
      v-for="cat in rootCategories.filter((c) => c.isIncomeCategory)"
      :key="cat.id"
    >
      <div class="p-2 border-b border-base-200 flex items-center">
        <button
          v-if="
            CategoryService.getChildCategories(cat.id).value.filter(
              (c) => c.isActive && !isVerfuegbareMittel(c)
            ).length > 0
          "
          class="btn btn-ghost btn-xs px-1 mr-1"
          @click="toggleExpand(cat.id)"
        >
          <Icon
            v-if="CategoryService.getExpandedCategories().value.has(cat.id)"
            icon="mdi:chevron-up"
          />
          <Icon
            v-else
            icon="mdi:chevron-down"
          />
        </button>
        <span>{{ cat.name }}</span>
      </div>
      <template
        v-if="CategoryService.getExpandedCategories().value.has(cat.id)"
      >
        <div
          v-for="child in CategoryService.getChildCategories(
            cat.id
          ).value.filter((c) => c.isActive && !isVerfuegbareMittel(c))"
          :key="child.id"
          class="pl-6 text-sm p-2 border-b border-base-200"
        >
          {{ child.name }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped></style>
