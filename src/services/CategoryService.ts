// src/services/CategoryService.ts
import { useCategoryStore } from '@/stores/categoryStore';
import { Category, CategoryGroup } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { debugLog, errorLog } from '@/utils/logger';
import { computed, type ComputedRef } from 'vue';

export const CategoryService = {
  /* ----------------------------------------------- Reactive Getter-Methoden */

  /**
   * Gibt alle Kategorien als reactive computed property zurück
   */
  getCategories(): ComputedRef<Category[]> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.categories);
  },

  /**
   * Gibt eine Kategorie anhand ihrer ID als reactive computed property zurück
   */
  getCategoryById(id: string): ComputedRef<Category | undefined> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.getCategoryById(id));
  },

  /**
   * Gibt alle Kindkategorien einer Elternkategorie als reactive computed property zurück
   */
  getChildCategories(parentId: string): ComputedRef<Category[]> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.getChildCategories(parentId));
  },

  /**
   * Gibt alle Root-Kategorien (ohne Elternkategorie) als reactive computed property zurück
   */
  getRootCategories(): ComputedRef<Category[]> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.rootCategories);
  },

  /**
   * Gibt Kategorien gruppiert nach CategoryGroup als reactive computed property zurück
   */
  getCategoriesByGroup(): ComputedRef<Record<string, Category[]>> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.categoriesByGroup);
  },

  /**
   * Gibt alle Sparziel-Kategorien als reactive computed property zurück
   */
  getSavingsGoals(): ComputedRef<Category[]> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.savingsGoals);
  },

  /* ----------------------------------------------- CategoryGroup Reactive Getter-Methoden */

  /**
   * Gibt alle CategoryGroups als reactive computed property zurück
   */
  getCategoryGroups(): ComputedRef<CategoryGroup[]> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.categoryGroups);
  },

  /**
   * Gibt eine CategoryGroup anhand ihrer ID als reactive computed property zurück
   */
  getCategoryGroupById(id: string): ComputedRef<CategoryGroup | undefined> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.categoryGroups.find(g => g.id === id));
  },

  /* ----------------------------------------------- UI-State-Management-Methoden */

  /**
   * Gibt die erweiterten Kategorien als reactive computed property zurück
   */
  getExpandedCategories(): ComputedRef<Set<string>> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.expandedCategories);
  },

  /**
   * Schaltet den erweiterten Zustand einer Kategorie um
   */
  toggleCategoryExpanded(id: string): void {
    if (!id) {
      debugLog("CategoryService", "toggleCategoryExpanded - Invalid ID provided");
      return;
    }
    const categoryStore = useCategoryStore();
    categoryStore.toggleCategoryExpanded(id);
    debugLog("CategoryService", "toggleCategoryExpanded", { id });
  },

  /**
   * Erweitert alle Kategorien
   */
  expandAllCategories(): void {
    const categoryStore = useCategoryStore();
    categoryStore.expandAllCategories();
    debugLog("CategoryService", "expandAllCategories - All categories expanded");
  },

  /**
   * Klappt alle Kategorien zusammen
   */
  collapseAllCategories(): void {
    const categoryStore = useCategoryStore();
    categoryStore.collapseAllCategories();
    debugLog("CategoryService", "collapseAllCategories - All categories collapsed");
  },

  /* ----------------------------------------------- Async Methoden */

  /**
   * Lädt alle Kategorien und CategoryGroups
   */
  async loadCategories(): Promise<void> {
    try {
      const categoryStore = useCategoryStore();
      await categoryStore.loadCategories();
      debugLog("CategoryService", "loadCategories - Categories loaded successfully");
    } catch (error) {
      errorLog("CategoryService", "loadCategories - Failed to load categories", error);
      throw error;
    }
  },

  /* ----------------------------------------------- Category CRUD-Methoden */

  /**
   * Fügt eine Kategorie hinzu - mit kompletter Businesslogik
   */
  async addCategory(category: Omit<Category, 'id' | 'updated_at'>): Promise<Category | null> {
    if (!category.name?.trim()) {
      errorLog("CategoryService", "addCategory - Category name is required");
      return null;
    }

    try {
      const categoryStore = useCategoryStore();

      // Businesslogik: Automatische isIncomeCategory Ableitung aus CategoryGroup
      const group = categoryStore.categoryGroups.find(g => g.id === category.categoryGroupId);
      const isIncome = group?.isIncomeGroup ?? false;

      const categoryWithTimestamp: Category = {
        ...category,
        id: uuidv4(),
        isIncomeCategory: category.isIncomeCategory ?? isIncome,
        sortOrder: category.sortOrder ?? categoryStore.categories.length,
        updated_at: new Date().toISOString()
      };

      // Verwende die Store-Methode für die Persistierung
      const addedCategory = await categoryStore.addCategory(categoryWithTimestamp);
      if (!addedCategory) {
        errorLog("CategoryService", "addCategory - Store method returned null");
        return null;
      }

      debugLog("CategoryService", "addCategory - Category added successfully", {
        id: categoryWithTimestamp.id,
        name: categoryWithTimestamp.name,
        isIncomeCategory: categoryWithTimestamp.isIncomeCategory
      });
      return categoryWithTimestamp;
    } catch (error) {
      errorLog("CategoryService", "addCategory - Failed to add category", error);
      return null;
    }
  },

  /**
   * Aktualisiert eine Kategorie
   */
  async updateCategory(id: string, updates: Partial<Category>): Promise<boolean> {
    if (!id) {
      errorLog("CategoryService", "updateCategory - Category ID is required");
      return false;
    }

    try {
      const categoryStore = useCategoryStore();
      const existingCategory = categoryStore.findCategoryById(id);

      if (!existingCategory) {
        errorLog("CategoryService", `updateCategory - Category with ID ${id} not found`);
        return false;
      }

      const updatedCategory: Category = {
        ...existingCategory,
        ...updates,
        id,
        updated_at: new Date().toISOString()
      };

      const success = await categoryStore.updateCategory(updatedCategory);
      if (success) {
        debugLog("CategoryService", "updateCategory - Category updated", { id });
      } else {
        debugLog("CategoryService", "updateCategory - Failed to update category", { id });
      }
      return success;
    } catch (error) {
      errorLog("CategoryService", `updateCategory - Failed to update category ${id}`, error);
      return false;
    }
  },

  /**
   * Löscht eine Kategorie
   */
  async deleteCategory(id: string): Promise<boolean> {
    if (!id) {
      errorLog("CategoryService", "deleteCategory - Category ID is required");
      return false;
    }

    try {
      const categoryStore = useCategoryStore();

      // Prüfe auf Kindkategorien
      const hasChildren = categoryStore.categories.some(category => category.parentCategoryId === id);
      if (hasChildren) {
        errorLog("CategoryService", `deleteCategory - Category ${id} has child categories and cannot be deleted`);
        return false;
      }

      await categoryStore.deleteCategory(id);
      debugLog("CategoryService", "deleteCategory - Category deleted", { id });
      return true;
    } catch (error) {
      errorLog("CategoryService", `deleteCategory - Failed to delete category ${id}`, error);
      return false;
    }
  },

  /* ----------------------------------------------- CategoryGroup CRUD-Methoden */

  /**
   * Fügt eine CategoryGroup hinzu
   */
  async addCategoryGroup(data: Omit<CategoryGroup, 'id' | 'updated_at'>): Promise<CategoryGroup | null> {
    if (!data.name?.trim()) {
      errorLog("CategoryService", "addCategoryGroup - CategoryGroup name is required");
      return null;
    }

    try {
      const categoryStore = useCategoryStore();
      const newCategoryGroup: CategoryGroup = {
        ...data,
        id: uuidv4(),
        updated_at: new Date().toISOString()
      };

      const addedGroup = await categoryStore.addCategoryGroup(newCategoryGroup);
      debugLog("CategoryService", "addCategoryGroup - CategoryGroup added", { id: addedGroup.id });
      return addedGroup;
    } catch (error) {
      errorLog("CategoryService", "addCategoryGroup - Failed to add CategoryGroup", error);
      return null;
    }
  },

  /**
   * Aktualisiert eine CategoryGroup
   */
  async updateCategoryGroup(id: string, updates: Partial<CategoryGroup>): Promise<boolean> {
    if (!id) {
      errorLog("CategoryService", "updateCategoryGroup - CategoryGroup ID is required");
      return false;
    }

    try {
      const categoryStore = useCategoryStore();
      const existingGroup = categoryStore.categoryGroups.find(g => g.id === id);

      if (!existingGroup) {
        errorLog("CategoryService", `updateCategoryGroup - CategoryGroup with ID ${id} not found`);
        return false;
      }

      const updatedGroup: CategoryGroup = {
        ...existingGroup,
        ...updates,
        id,
        updated_at: new Date().toISOString()
      };

      const success = await categoryStore.updateCategoryGroup(updatedGroup);
      if (success) {
        debugLog("CategoryService", "updateCategoryGroup - CategoryGroup updated", { id });
      } else {
        debugLog("CategoryService", "updateCategoryGroup - Failed to update CategoryGroup", { id });
      }
      return success;
    } catch (error) {
      errorLog("CategoryService", `updateCategoryGroup - Failed to update CategoryGroup ${id}`, error);
      return false;
    }
  },

  /**
   * Löscht eine CategoryGroup
   */
  async deleteCategoryGroup(id: string): Promise<boolean> {
    if (!id) {
      errorLog("CategoryService", "deleteCategoryGroup - CategoryGroup ID is required");
      return false;
    }

    try {
      const categoryStore = useCategoryStore();
      const success = await categoryStore.deleteCategoryGroup(id);

      if (success) {
        debugLog("CategoryService", "deleteCategoryGroup - CategoryGroup deleted", { id });
      } else {
        debugLog("CategoryService", "deleteCategoryGroup - Failed to delete CategoryGroup", { id });
      }
      return success;
    } catch (error) {
      errorLog("CategoryService", `deleteCategoryGroup - Failed to delete CategoryGroup ${id}`, error);
      return false;
    }
  },

  /* ----------------------------------------------- Utility-Methoden */

  /**
   * Gibt die "Verfügbare Mittel" Kategorie als reactive computed property zurück
   */
  getAvailableFundsCategory(): ComputedRef<Category | undefined> {
    const categoryStore = useCategoryStore();
    return computed(() => categoryStore.getAvailableFundsCategory());
  },

  /**
   * Aktualisiert das Guthaben einer Kategorie
   */
  async updateCategoryBalance(id: string, amount: number): Promise<boolean> {
    if (!id) {
      errorLog("CategoryService", "updateCategoryBalance - Category ID is required");
      return false;
    }

    if (typeof amount !== 'number' || isNaN(amount)) {
      errorLog("CategoryService", "updateCategoryBalance - Valid amount is required");
      return false;
    }

    try {
      const categoryStore = useCategoryStore();
      const success = await categoryStore.updateCategoryBalance(id, amount);

      if (success) {
        debugLog("CategoryService", "updateCategoryBalance - Balance updated", { id, amount });
      } else {
        debugLog("CategoryService", "updateCategoryBalance - Failed to update balance", { id, amount });
      }
      return success;
    } catch (error) {
      errorLog("CategoryService", `updateCategoryBalance - Failed to update balance for category ${id}`, error);
      return false;
    }
  },

  /**
   * Gibt den Namen einer CategoryGroup anhand ihrer ID zurück
   */
  getGroupName(groupId: string): string {
    if (!groupId) return 'Keine Gruppe';

    const categoryStore = useCategoryStore();
    const group = categoryStore.categoryGroups.find(g => g.id === groupId);
    return group?.name || 'Unbekannte Gruppe';
  },

  /**
   * Gibt den Namen einer Elternkategorie anhand ihrer ID zurück
   */
  getParentCategoryName(parentId: string | null): string {
    if (!parentId) return 'Keine Elternkategorie';

    const categoryStore = useCategoryStore();
    const category = categoryStore.findCategoryById(parentId);
    return category?.name || 'Unbekannte Kategorie';
  },

  /**
   * Gibt den Namen einer Kategorie anhand ihrer ID zurück
   */
  getCategoryName(id: string | null): string {
    if (!id) return 'Keine Kategorie';

    const categoryStore = useCategoryStore();
    const category = categoryStore.findCategoryById(id);
    return category?.name || 'Unbekannte Kategorie';
  }
};
