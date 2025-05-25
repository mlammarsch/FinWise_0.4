<script setup lang="ts">
/**
 * Pfad zur Komponente: src/components/ui/PagingComponent.vue
 * Wiederverwendbare Paginierungskomponente mit Navigation, Seitenanzeige und Paketgrößenauswahl.
 *
 * Komponenten-Props:
 * - currentPage: number - Aktuell ausgewählte Seite
 * - totalPages: number - Gesamtanzahl der Seiten
 * - itemsPerPage: number | string - Aktuell ausgewählte Paketgröße (Zahl oder 'all')
 * - itemsPerPageOptions?: Array<number | string> - Mögliche Paketgrößen zur Auswahl
 *
 * Emits:
 * - update:currentPage - Gibt die neue Seite zurück, wenn sich die aktuelle Seite ändert
 * - update:itemsPerPage - Gibt die neue Paketgröße zurück, wenn sich diese ändert
 */

import { computed } from "vue";
import { Icon } from "@iconify/vue";

const props = defineProps<{
  currentPage: number;
  totalPages: number;
  itemsPerPage: number | string;
  itemsPerPageOptions?: Array<number | string>;
}>();

const emit = defineEmits<{
  (e: "update:currentPage", value: number): void;
  (e: "update:itemsPerPage", value: number | string): void;
}>();

const defaultOptions = [10, 20, 25, 50, 100, 500, "all"];

const pageOptions = computed(() => props.itemsPerPageOptions ?? defaultOptions);

const getPageNumbers = computed(() => {
  const pages: Array<number | string> = [];
  if (props.totalPages <= 5) {
    for (let i = 1; i <= props.totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (props.currentPage > 3) pages.push("...");
    let start = Math.max(2, props.currentPage - 1);
    let end = Math.min(props.totalPages - 1, props.currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (props.currentPage < props.totalPages - 2) pages.push("...");
    pages.push(props.totalPages);
  }
  return pages;
});

const selectPage = (page: number | string) => {
  if (page !== "..." && page !== props.currentPage) {
    emit("update:currentPage", page as number);
  }
};

const changeItemsPerPage = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value;
  const parsed = value === "all" ? "all" : parseInt(value);
  emit("update:itemsPerPage", parsed);
};

const nextPage = () => {
  if (props.currentPage < props.totalPages) {
    emit("update:currentPage", props.currentPage + 1);
  }
};

const prevPage = () => {
  if (props.currentPage > 1) {
    emit("update:currentPage", props.currentPage - 1);
  }
};
</script>

<template>
  <div class="divider mt-5 mb-2" />
  <!-- Paginierung -->
  <div class="flex justify-between items-center flex-wrap gap-4">
    <!-- Paketgrößen-Auswahl -->
    <div class="form-control">
      <label class="label cursor-pointer space-x-2">
        <span class="label-text">Einträge pro Seite:</span>
        <select
          class="select select-sm rounded-full border border-base-300"
          :value="itemsPerPage"
          @change="changeItemsPerPage"
        >
          <option v-for="option in pageOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </label>
    </div>

    <!-- Buttons -->
    <div class="flex justify-center flex-1">
      <div class="join">
        <button
          class="join-item btn btn-sm rounded-l-full border border-base-300 flex items-center justify-center"
          :disabled="currentPage === 1"
          @click="prevPage"
        >
          <Icon icon="mdi:chevron-left" class="text-base" />
        </button>
        <button
          v-for="page in getPageNumbers"
          :key="page"
          class="join-item btn btn-sm border border-base-300 shadow-none"
          :class="{
            'btn-disabled': page === '...',
            'btn-primary': page === currentPage,
          }"
          @click="selectPage(page)"
        >
          {{ page }}
        </button>
        <button
          class="join-item btn btn-sm rounded-r-full border border-base-300 flex items-center justify-center"
          :disabled="currentPage === totalPages"
          @click="nextPage"
        >
          <Icon icon="mdi:chevron-right" class="text-base" />
        </button>
      </div>
    </div>

    <!-- Seitenanzahl -->
    <div class="text-sm text-right whitespace-nowrap">
      Seite {{ currentPage }} von {{ totalPages }}
    </div>
  </div>
</template>
