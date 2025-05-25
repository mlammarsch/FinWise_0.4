// src/stores/categoryStore.ts

/**
 * Pfad: src/stores/categoryStore.ts
 * Kategorie-Store mandantenspezifisch.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Category } from '@/types';
import { debugLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';

type CategoryGroup = {
  id: string;
  name: string;
  sortOrder: number;
  isIncomeGroup: boolean;
};

export const useCategoryStore = defineStore('category', () => {
  /* ----------------------------------------------- State */
  const categories = ref<Category[]>([]);
  const categoryGroups = ref<CategoryGroup[]>([]);
  const expandedCategories = ref<Set<string>>(new Set());

  /* ----------------------------------------------- Getters */
  const getCategoryById = computed(() => (id: string) =>
    categories.value.find(c => c.id === id),
  );

  const rootCategories = computed(() =>
    categories.value
      .filter(c => c.parentCategoryId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  const getCategoriesByParentId = computed(() => (parentId: string | null) =>
    categories.value
      .filter(c => c.parentCategoryId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  const savingsGoals = computed(() =>
    categories.value
      .filter(c => c.isSavingsGoal)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  const categoriesByGroup = computed(() => {
    const grouped: Record<string, Category[]> = {};
    for (const group of categoryGroups.value) {
      grouped[group.id] = categories.value
        .filter(c => c.categoryGroupId === group.id && !c.parentCategoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  });

  /* ----------------------------------------------- Actions */
  function findCategoryById(id: string) {
    return categories.value.find(c => c.id === id);
  }

  function getChildCategories(parentId: string) {
    return categories.value
      .filter(c => c.parentCategoryId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function addCategory(category: Omit<Category, 'id' | 'balance' | 'startBalance' | 'transactionCount' | 'averageTransactionValue'>) {
    // Ableitung des Typs aus der Gruppe
    const group = categoryGroups.value.find(g => g.id === category.categoryGroupId);
    const isIncome = group?.isIncomeGroup ?? false;

    const c: Category = {
      ...category,
      id: uuidv4(),
      balance: 0,
      startBalance: 0,
      transactionCount: 0,
      averageTransactionValue: 0,
      isIncomeCategory: isIncome,
    };
    categories.value.push(c);
    saveCategories();
    debugLog('[categoryStore] addCategory', c);
    return c;
  }

  function updateCategory(id: string, updates: Partial<Category>) {
    const idx = categories.value.findIndex(c => c.id === id);
    if (idx === -1) return false;

    // Wenn Gruppe geändert wird, Typ entsprechend ableiten
    if (updates.categoryGroupId) {
      const group = categoryGroups.value.find(g => g.id === updates.categoryGroupId);
      updates.isIncomeCategory = group?.isIncomeGroup ?? false;
    }

    categories.value[idx] = { ...categories.value[idx], ...updates };
    saveCategories();
    debugLog('[categoryStore] updateCategory', { id, updates });
    return true;
  }

  function deleteCategory(id: string) {
    categories.value = categories.value.filter(c => c.id !== id);
    saveCategories();
    debugLog('[categoryStore] deleteCategory', id);
  }

  function updateCategoryBalance(id: string, amount: number) {
    const category = categories.value.find(c => c.id === id);
    if (!category) return false;
    category.balance += amount;
    category.transactionCount = (category.transactionCount || 0) + 1;
    category.averageTransactionValue = category.balance / category.transactionCount || 0;
    saveCategories();
    debugLog('[categoryStore] updateCategoryBalance', {
      id: category.id,
      balance: category.balance,
      transactionCount: category.transactionCount,
      averageTransactionValue: category.averageTransactionValue,
    });
    return true;
  }

  function addCategoryGroup(group: Omit<CategoryGroup, 'id'>) {
    const g: CategoryGroup = { ...group, id: uuidv4() };
    categoryGroups.value.push(g);
    saveCategoryGroups();
    debugLog('[categoryStore] addCategoryGroup', g);
    return g;
  }

  function deleteCategoryGroup(id: string) {
    if (categories.value.some(c => c.categoryGroupId === id)) {
      debugLog('[categoryStore] deleteCategoryGroup', { id, result: 'Failed' });
      return false;
    }
    categoryGroups.value = categoryGroups.value.filter(g => g.id !== id);
    saveCategoryGroups();
    debugLog('[categoryStore] deleteCategoryGroup', { id, result: 'Success' });
    return true;
  }

  function setMonthlySnapshot() {
    categories.value.forEach(c => {
      c.startBalance = c.balance;
      debugLog('[categoryStore] setMonthlySnapshot', { id: c.id, newStartBalance: c.startBalance });
    });
    saveCategories();
  }

  function getAvailableFundsCategory() {
    return categories.value.find(c => c.name === 'Verfügbare Mittel');
  }

  /* -------------------------- Expanded-Handling (tenant-spezifisch) */
  function loadExpandedCategories() {
    const raw = localStorage.getItem(storageKey('expanded_categories'));
    if (raw) {
      try {
        const ids = JSON.parse(raw);
        expandedCategories.value = new Set(ids);
        debugLog('[categoryStore] loadExpandedCategories', [...expandedCategories.value]);
      } catch (error) {
        debugLog('[categoryStore] loadExpandedCategories - parse error', error);
      }
    }
  }

  function saveExpandedCategories() {
    localStorage.setItem(
      storageKey('expanded_categories'),
      JSON.stringify([...expandedCategories.value]),
    );
    debugLog('[categoryStore] saveExpandedCategories', [...expandedCategories.value]);
  }

  function toggleCategoryExpanded(id: string) {
    if (expandedCategories.value.has(id)) {
      expandedCategories.value.delete(id);
    } else {
      expandedCategories.value.add(id);
    }
    saveExpandedCategories();
    debugLog('[categoryStore] toggleCategoryExpanded', id);
  }

  function expandAllCategories() {
    const parentIds = categories.value.filter(c => !c.parentCategoryId).map(c => c.id);
    expandedCategories.value = new Set(parentIds);
    saveExpandedCategories();
    debugLog('[categoryStore] expandAllCategories', [...expandedCategories.value]);
  }

  function collapseAllCategories() {
    expandedCategories.value.clear();
    saveExpandedCategories();
    debugLog('[categoryStore] collapseAllCategories');
  }

  /* ----------------------------------------------- Persistence */
  function loadCategories() {
    // 1. Lese gespeicherte Kategorien
    const rawCats = localStorage.getItem(storageKey('categories'));
    categories.value = rawCats ? JSON.parse(rawCats) : [];

    // 2. Lese gespeicherte Kategoriegruppen
    const rawGrp = localStorage.getItem(storageKey('categoryGroups'));
    categoryGroups.value = rawGrp ? JSON.parse(rawGrp) : [];

    // 3. Stelle sicher, dass 'Verfügbare Mittel' existiert
    if (!categories.value.find(c => c.name === 'Verfügbare Mittel')) {
      addCategory({
        name: 'Verfügbare Mittel',
        parentCategoryId: null,
        sortOrder: 9999,
        isActive: true,
        isSavingsGoal: false,
        categoryGroupId: null,
      });
      debugLog('[categoryStore] loadCategories - created AvailableFundsCategory');
    }

    // 4. **Migration**: isIncomeCategory aus Kategoriegruppe ableiten
    let migrated = false;
    categories.value.forEach(c => {
      const grp = categoryGroups.value.find(g => g.id === c.categoryGroupId);
      const derived = grp?.isIncomeGroup ?? false;
      if (c.isIncomeCategory !== derived) {
        c.isIncomeCategory = derived;
        migrated = true;
      }
    });
    if (migrated) saveCategories();

    // 5. Lade ausgeklappte Kategorien
    loadExpandedCategories();

    debugLog('[categoryStore] loadCategories', {
      cats: categories.value.length,
      groups: categoryGroups.value.length,
    });
  }

  function saveCategories() {
    localStorage.setItem(
      storageKey('categories'),
      JSON.stringify(categories.value),
    );
  }

  function saveCategoryGroups() {
    localStorage.setItem(
      storageKey('categoryGroups'),
      JSON.stringify(categoryGroups.value),
    );
  }

  function reset() {
    categories.value = [];
    categoryGroups.value = [];
    loadCategories();
  }

  // Initialisierung
  loadCategories();

  /* ----------------------------------------------- Exports */
  return {
    categories,
    categoryGroups,
    expandedCategories,
    getCategoryById,
    findCategoryById,
    getCategoriesByParentId,
    getChildCategories,
    rootCategories,
    savingsGoals,
    categoriesByGroup,
    addCategory,
    updateCategory,
    deleteCategory,
    updateCategoryBalance,
    addCategoryGroup,
    deleteCategoryGroup,
    setMonthlySnapshot,
    getAvailableFundsCategory,
    toggleCategoryExpanded,
    expandAllCategories,
    collapseAllCategories,
    loadCategories,
    reset,
  };
});
