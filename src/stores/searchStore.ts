// src/stores/searchStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { debugLog } from '@/utils/logger'

export const useSearchStore = defineStore('search', () => {
  // State
  const globalSearchQuery = ref("");
  const lastSearches = ref<string[]>([]);

  // Computed
  const hasActiveSearch = computed(() => globalSearchQuery.value.trim() !== "");

  // Actions
  function search(query: string) {
    const trimmedQuery = query.trim();
    globalSearchQuery.value = trimmedQuery;

    // Speichern der Suche im Suchverlauf
    if (trimmedQuery && !lastSearches.value.includes(trimmedQuery)) {
      lastSearches.value.unshift(trimmedQuery);
      // Beschränke auf die letzten 10 Einträge
      if (lastSearches.value.length > 10) {
        lastSearches.value.pop();
      }
      saveSearchHistory();
    }

    debugLog('[searchStore] search', { query: trimmedQuery });
    return trimmedQuery;
  }

  function clearSearch() {
    globalSearchQuery.value = "";
    debugLog('[searchStore] clearSearch');
  }

  function saveSearchHistory() {
    localStorage.setItem('finwise_search_history', JSON.stringify(lastSearches.value));
    debugLog('[searchStore] saveSearchHistory', { historyCount: lastSearches.value.length });
  }

  function loadSearchHistory() {
    const saved = localStorage.getItem('finwise_search_history');
    if (saved) {
      try {
        lastSearches.value = JSON.parse(saved);
        debugLog('[searchStore] loadSearchHistory', { loaded: lastSearches.value.length });
      } catch (err) {
        debugLog('[searchStore] loadSearchHistory - Error parsing history', err);
        lastSearches.value = [];
      }
    }
  }

  // Initialisierung
  loadSearchHistory();

  return {
    // State
    globalSearchQuery,
    lastSearches,

    // Computed
    hasActiveSearch,

    // Actions
    search,
    clearSearch,
    loadSearchHistory
  }
});
