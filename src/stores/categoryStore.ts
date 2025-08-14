import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { Category, CategoryGroup } from '@/types';
import { SyncOperationType, EntityTypeEnum } from '@/types';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';
import { TenantDbService } from '@/services/TenantDbService';

export const useCategoryStore = defineStore('category', () => {
  const tenantDbService = new TenantDbService();

  /* ----------------------------------------------- State */
  const categories = ref<Category[]>([]);
  const categoryGroups = ref<CategoryGroup[]>([]);
  const expandedCategories = ref<Set<string>>(new Set());
  const expandedCategoryGroups = ref<Set<string>>(new Set());
  const showHiddenCategories = ref<boolean>(false);

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

  const activeCategories = computed(() =>
    categories.value
      .filter(c => c.isActive && !c.isHidden)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /* ----------------------------------------------- Actions */
  function findCategoryById(id: string) {
    return categories.value.find(c => c.id === id);
  }

  function getChildCategories(parentId: string) {
    return categories.value
      .filter(c => c.parentCategoryId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async function addCategory(categoryData: Omit<Category, 'id' | 'updatedAt'> | Category, fromSync = false): Promise<Category> {
    const group = categoryGroups.value.find(g => g.id === categoryData.categoryGroupId);
    const isIncome = group?.isIncomeGroup ?? false;

    const categoryWithTimestamp: Category = {
      ...categoryData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: (categoryData as any).id || uuidv4(),
      isIncomeCategory: (categoryData as any).isIncomeCategory ?? isIncome,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: (categoryData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      const localCategory = await tenantDbService.getCategoryById(categoryWithTimestamp.id);
      if (localCategory && localCategory.updatedAt && categoryWithTimestamp.updatedAt &&
        new Date(localCategory.updatedAt) >= new Date(categoryWithTimestamp.updatedAt)) {
        infoLog('categoryStore', `addCategory (fromSync): Lokale Kategorie ${localCategory.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localCategory;
      }
      await tenantDbService.addCategory(categoryWithTimestamp);
      infoLog('categoryStore', `addCategory (fromSync): Eingehende Kategorie ${categoryWithTimestamp.id} angewendet.`);
    } else {
      await tenantDbService.addCategory(categoryWithTimestamp);
    }

    const existingCategoryIndex = categories.value.findIndex(c => c.id === categoryWithTimestamp.id);
    if (existingCategoryIndex === -1) {
      categories.value.push(categoryWithTimestamp);
    } else {
      if (!fromSync || (categoryWithTimestamp.updatedAt && (!categories.value[existingCategoryIndex].updatedAt || new Date(categoryWithTimestamp.updatedAt) > new Date(categories.value[existingCategoryIndex].updatedAt!)))) {
        categories.value[existingCategoryIndex] = categoryWithTimestamp;
      } else if (fromSync) {
        warnLog('categoryStore', `addCategory (fromSync): Store-Kategorie ${categories.value[existingCategoryIndex].id} war neuer als eingehende ${categoryWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('categoryStore', `Category "${categoryWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${categoryWithTimestamp.id}).`);

    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.CATEGORY,
          entityId: categoryWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(categoryWithTimestamp),
        });
        infoLog('categoryStore', `Category "${categoryWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('categoryStore', `Fehler beim Hinzufügen von Category "${categoryWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return categoryWithTimestamp;
  }

  async function updateCategory(categoryUpdatesData: Category, fromSync = false): Promise<boolean> {
    const categoryUpdatesWithTimestamp: Category = {
      ...categoryUpdatesData,
      updatedAt: categoryUpdatesData.updatedAt || new Date().toISOString(),
    };

    if (categoryUpdatesWithTimestamp.categoryGroupId) {
      const group = categoryGroups.value.find(g => g.id === categoryUpdatesWithTimestamp.categoryGroupId);
      categoryUpdatesWithTimestamp.isIncomeCategory = group?.isIncomeGroup ?? false;
    }

    if (fromSync) {
      const localCategory = await tenantDbService.getCategoryById(categoryUpdatesWithTimestamp.id);
      if (!localCategory) {
        infoLog('categoryStore', `updateCategory (fromSync): Lokale Kategorie ${categoryUpdatesWithTimestamp.id} nicht gefunden. Behandle als addCategory.`);
        await addCategory(categoryUpdatesWithTimestamp, true);
        return true;
      }

      if (localCategory.updatedAt && categoryUpdatesWithTimestamp.updatedAt &&
        new Date(localCategory.updatedAt) >= new Date(categoryUpdatesWithTimestamp.updatedAt)) {
        infoLog('categoryStore', `updateCategory (fromSync): Lokale Kategorie ${localCategory.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true;
      }
      await tenantDbService.updateCategory(categoryUpdatesWithTimestamp);
      infoLog('categoryStore', `updateCategory (fromSync): Eingehendes Update für Kategorie ${categoryUpdatesWithTimestamp.id} angewendet.`);
    } else {
      await tenantDbService.updateCategory(categoryUpdatesWithTimestamp);
    }

    const idx = categories.value.findIndex(c => c.id === categoryUpdatesWithTimestamp.id);
    if (idx !== -1) {
      if (!fromSync || (categoryUpdatesWithTimestamp.updatedAt && (!categories.value[idx].updatedAt || new Date(categoryUpdatesWithTimestamp.updatedAt) > new Date(categories.value[idx].updatedAt!)))) {
        categories.value[idx] = { ...categories.value[idx], ...categoryUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('categoryStore', `updateCategory (fromSync): Store-Kategorie ${categories.value[idx].id} war neuer als eingehende ${categoryUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('categoryStore', `Category "${categoryUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${categoryUpdatesWithTimestamp.id}).`);

      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.CATEGORY,
            entityId: categoryUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(categoryUpdatesWithTimestamp),
          });
          infoLog('categoryStore', `Category "${categoryUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('categoryStore', `Fehler beim Hinzufügen von Category Update "${categoryUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('categoryStore', `updateCategory: Category ${categoryUpdatesWithTimestamp.id} not found in store during sync. Adding it.`);
      await addCategory(categoryUpdatesWithTimestamp, true);
      return true;
    }
    return false;
  }

  async function deleteCategory(categoryId: string, fromSync = false): Promise<void> {
    const categoryToDelete = categories.value.find(c => c.id === categoryId);

    await tenantDbService.deleteCategory(categoryId);
    categories.value = categories.value.filter(c => c.id !== categoryId);
    infoLog('categoryStore', `Category mit ID "${categoryId}" aus Store und lokaler DB entfernt.`);

    // SyncQueue-Logik für alle lokalen Änderungen
    if (!fromSync && categoryToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.CATEGORY,
          entityId: categoryId,
          operationType: SyncOperationType.DELETE,
          payload: { id: categoryId },
        });
        infoLog('categoryStore', `Category mit ID "${categoryId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('categoryStore', `Fehler beim Hinzufügen von Category Delete (ID: "${categoryId}") zur Sync Queue.`, e);
      }
    }
  }

  async function updateCategoryBalance(id: string, amount: number) {
    const category = categories.value.find(c => c.id === id);
    if (!category) return false;

    // Update activity (equivalent to balance in the new schema)
    category.activity += amount;
    category.updatedAt = new Date().toISOString();

    await tenantDbService.updateCategory(category);
    debugLog('categoryStore', `updateCategoryBalance für Kategorie ${id}`, { amount, newActivity: category.activity });
    return true;
  }

  async function addCategoryGroup(categoryGroupData: Omit<CategoryGroup, 'id' | 'updatedAt'> | CategoryGroup, fromSync = false): Promise<CategoryGroup> {
    const categoryGroupWithTimestamp: CategoryGroup = {
      ...categoryGroupData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: (categoryGroupData as any).id || uuidv4(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updatedAt: (categoryGroupData as any).updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (CREATE)
      const localGroup = await tenantDbService.getCategoryGroupById(categoryGroupWithTimestamp.id);
      if (localGroup && localGroup.updatedAt && categoryGroupWithTimestamp.updatedAt &&
        new Date(localGroup.updatedAt) >= new Date(categoryGroupWithTimestamp.updatedAt)) {
        infoLog('categoryStore', `addCategoryGroup (fromSync): Lokale Gruppe ${localGroup.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return localGroup;
      }
      await tenantDbService.addCategoryGroup(categoryGroupWithTimestamp);
      infoLog('categoryStore', `addCategoryGroup (fromSync): Eingehende Gruppe ${categoryGroupWithTimestamp.id} angewendet.`);
    } else {
      await tenantDbService.addCategoryGroup(categoryGroupWithTimestamp);
    }

    const existingGroupIndex = categoryGroups.value.findIndex(g => g.id === categoryGroupWithTimestamp.id);
    if (existingGroupIndex === -1) {
      categoryGroups.value.push(categoryGroupWithTimestamp);
    } else {
      if (!fromSync || (categoryGroupWithTimestamp.updatedAt && (!categoryGroups.value[existingGroupIndex].updatedAt || new Date(categoryGroupWithTimestamp.updatedAt) > new Date(categoryGroups.value[existingGroupIndex].updatedAt!)))) {
        categoryGroups.value[existingGroupIndex] = categoryGroupWithTimestamp;
      } else if (fromSync) {
        warnLog('categoryStore', `addCategoryGroup (fromSync): Store-Gruppe ${categoryGroups.value[existingGroupIndex].id} war neuer als eingehende ${categoryGroupWithTimestamp.id}. Store nicht geändert.`);
      }
    }
    infoLog('categoryStore', `CategoryGroup "${categoryGroupWithTimestamp.name}" im Store hinzugefügt/aktualisiert (ID: ${categoryGroupWithTimestamp.id}).`);

    // SyncQueue-Logik für alle lokalen Änderungen
    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.CATEGORY_GROUP,
          entityId: categoryGroupWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: tenantDbService.toPlainObject(categoryGroupWithTimestamp),
        });
        infoLog('categoryStore', `CategoryGroup "${categoryGroupWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('categoryStore', `Fehler beim Hinzufügen von CategoryGroup "${categoryGroupWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }
    return categoryGroupWithTimestamp;
  }

  async function updateCategoryGroup(categoryGroupUpdatesData: CategoryGroup, fromSync = false): Promise<boolean> {
    const categoryGroupUpdatesWithTimestamp: CategoryGroup = {
      ...categoryGroupUpdatesData,
      updatedAt: categoryGroupUpdatesData.updatedAt || new Date().toISOString(),
    };

    if (fromSync) {
      // LWW-Logik für eingehende Sync-Daten (UPDATE)
      const localGroup = await tenantDbService.getCategoryGroupById(categoryGroupUpdatesWithTimestamp.id);
      if (!localGroup) {
        infoLog('categoryStore', `updateCategoryGroup (fromSync): Lokale Gruppe ${categoryGroupUpdatesWithTimestamp.id} nicht gefunden. Behandle als addCategoryGroup.`);
        await addCategoryGroup(categoryGroupUpdatesWithTimestamp, true);
        return true;
      }

      if (localGroup.updatedAt && categoryGroupUpdatesWithTimestamp.updatedAt &&
        new Date(localGroup.updatedAt) >= new Date(categoryGroupUpdatesWithTimestamp.updatedAt)) {
        infoLog('categoryStore', `updateCategoryGroup (fromSync): Lokale Gruppe ${localGroup.id} ist neuer oder gleich aktuell. Eingehende Änderung verworfen.`);
        return true;
      }
      await tenantDbService.updateCategoryGroup(categoryGroupUpdatesWithTimestamp);
      infoLog('categoryStore', `updateCategoryGroup (fromSync): Eingehendes Update für Gruppe ${categoryGroupUpdatesWithTimestamp.id} angewendet.`);
    } else {
      await tenantDbService.updateCategoryGroup(categoryGroupUpdatesWithTimestamp);
    }

    const idx = categoryGroups.value.findIndex(g => g.id === categoryGroupUpdatesWithTimestamp.id);
    if (idx !== -1) {
      if (!fromSync || (categoryGroupUpdatesWithTimestamp.updatedAt && (!categoryGroups.value[idx].updatedAt || new Date(categoryGroupUpdatesWithTimestamp.updatedAt) > new Date(categoryGroups.value[idx].updatedAt!)))) {
        categoryGroups.value[idx] = { ...categoryGroups.value[idx], ...categoryGroupUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('categoryStore', `updateCategoryGroup (fromSync): Store-Gruppe ${categoryGroups.value[idx].id} war neuer als eingehende ${categoryGroupUpdatesWithTimestamp.id}. Store nicht geändert.`);
      }
      infoLog('categoryStore', `CategoryGroup "${categoryGroupUpdatesWithTimestamp.name}" im Store aktualisiert (ID: ${categoryGroupUpdatesWithTimestamp.id}).`);

      // SyncQueue-Logik für alle lokalen Änderungen
      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.CATEGORY_GROUP,
            entityId: categoryGroupUpdatesWithTimestamp.id,
            operationType: SyncOperationType.UPDATE,
            payload: tenantDbService.toPlainObject(categoryGroupUpdatesWithTimestamp),
          });
          infoLog('categoryStore', `CategoryGroup "${categoryGroupUpdatesWithTimestamp.name}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('categoryStore', `Fehler beim Hinzufügen von CategoryGroup Update "${categoryGroupUpdatesWithTimestamp.name}" zur Sync Queue.`, e);
        }
      }
      return true;
    }
    if (fromSync) {
      warnLog('categoryStore', `updateCategoryGroup: CategoryGroup ${categoryGroupUpdatesWithTimestamp.id} not found in store during sync. Adding it.`);
      await addCategoryGroup(categoryGroupUpdatesWithTimestamp, true);
      return true;
    }
    return false;
  }

  async function deleteCategoryGroup(categoryGroupId: string, fromSync = false): Promise<boolean> {
    if (!fromSync && categories.value.some(c => c.categoryGroupId === categoryGroupId)) {
      errorLog('categoryStore', `deleteCategoryGroup: Group ${categoryGroupId} is still in use by categories. Deletion aborted.`);
      return false;
    }
    const groupToDelete = categoryGroups.value.find(g => g.id === categoryGroupId);

    await tenantDbService.deleteCategoryGroup(categoryGroupId);
    categoryGroups.value = categoryGroups.value.filter(g => g.id !== categoryGroupId);
    infoLog('categoryStore', `CategoryGroup mit ID "${categoryGroupId}" aus Store und lokaler DB entfernt.`);

    // SyncQueue-Logik für alle lokalen Änderungen
    if (!fromSync && groupToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.CATEGORY_GROUP,
          entityId: categoryGroupId,
          operationType: SyncOperationType.DELETE,
          payload: { id: categoryGroupId },
        });
        infoLog('categoryStore', `CategoryGroup mit ID "${categoryGroupId}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('categoryStore', `Fehler beim Hinzufügen von CategoryGroup Delete (ID: "${categoryGroupId}") zur Sync Queue.`, e);
      }
    }
    return true;
  }

  async function setMonthlySnapshot() {
    for (const category of categories.value) {
      // Reset activity to 0 for new month (equivalent to startBalance logic)
      category.activity = 0;
      category.updatedAt = new Date().toISOString();
      await tenantDbService.updateCategory(category);
      debugLog('categoryStore', `setMonthlySnapshot für Kategorie ${category.id}`, { resetActivity: category.activity });
    }
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
        debugLog('categoryStore', 'loadExpandedCategories', [...expandedCategories.value].join(', '));
      } catch (error) {
        debugLog('categoryStore', 'loadExpandedCategories - parse error', String(error));
      }
    }
  }

  function saveExpandedCategories() {
    localStorage.setItem(
      storageKey('expanded_categories'),
      JSON.stringify([...expandedCategories.value]),
    );
    debugLog('categoryStore', 'saveExpandedCategories', [...expandedCategories.value].join(', '));
  }

  function toggleCategoryExpanded(id: string) {
    if (expandedCategories.value.has(id)) {
      expandedCategories.value.delete(id);
    } else {
      expandedCategories.value.add(id);
    }
    saveExpandedCategories();
    debugLog('categoryStore', 'toggleCategoryExpanded', id);
  }

  function expandAllCategories() {
    const parentIds = categories.value.filter(c => !c.parentCategoryId).map(c => c.id);
    expandedCategories.value = new Set(parentIds);
    saveExpandedCategories();
    debugLog('categoryStore', 'expandAllCategories', [...expandedCategories.value].join(', '));
  }

  function collapseAllCategories() {
    expandedCategories.value.clear();
    saveExpandedCategories();
    debugLog('categoryStore', 'collapseAllCategories', 'completed');
  }

  /* -------------------------- CategoryGroup Expanded-Handling */
  function loadExpandedCategoryGroups() {
    const raw = localStorage.getItem(storageKey('expanded_category_groups'));
    if (raw) {
      try {
        const ids = JSON.parse(raw);
        expandedCategoryGroups.value = new Set(ids);
        debugLog('categoryStore', 'loadExpandedCategoryGroups', [...expandedCategoryGroups.value].join(', '));
      } catch (error) {
        debugLog('categoryStore', 'loadExpandedCategoryGroups - parse error', String(error));
      }
    }
  }

  function saveExpandedCategoryGroups() {
    localStorage.setItem(
      storageKey('expanded_category_groups'),
      JSON.stringify([...expandedCategoryGroups.value]),
    );
    debugLog('categoryStore', 'saveExpandedCategoryGroups', [...expandedCategoryGroups.value].join(', '));
  }

  function toggleCategoryGroupExpanded(id: string) {
    if (expandedCategoryGroups.value.has(id)) {
      expandedCategoryGroups.value.delete(id);
    } else {
      expandedCategoryGroups.value.add(id);
    }
    saveExpandedCategoryGroups();
    debugLog('categoryStore', 'toggleCategoryGroupExpanded', id);
  }

  function expandAllCategoryGroups() {
    const allGroupIds = categoryGroups.value.map(g => g.id);
    expandedCategoryGroups.value = new Set(allGroupIds);
    saveExpandedCategoryGroups();
    debugLog('categoryStore', 'expandAllCategoryGroups', [...expandedCategoryGroups.value].join(', '));
  }

  function collapseAllCategoryGroups() {
    expandedCategoryGroups.value.clear();
    saveExpandedCategoryGroups();
    debugLog('categoryStore', 'collapseAllCategoryGroups', 'completed');
  }

  function expandCategoryGroupsBatch(groupIds: string[]) {
    // Batch-Expansion ohne einzelne Toggle-Aufrufe für bessere Performance
    groupIds.forEach(id => {
      expandedCategoryGroups.value.add(id);
    });
    saveExpandedCategoryGroups();
    debugLog('categoryStore', 'expandCategoryGroupsBatch', groupIds.join(', '));
  }

  /* -------------------------- Hidden Categories Handling */
  function toggleShowHiddenCategories() {
    showHiddenCategories.value = !showHiddenCategories.value;
    localStorage.setItem(storageKey('show_hidden_categories'), JSON.stringify(showHiddenCategories.value));
    debugLog('categoryStore', 'toggleShowHiddenCategories', showHiddenCategories.value);
  }

  function setShowHiddenCategories(show: boolean) {
    showHiddenCategories.value = show;
    localStorage.setItem(storageKey('show_hidden_categories'), JSON.stringify(show));
    debugLog('categoryStore', 'setShowHiddenCategories', show);
  }

  function loadShowHiddenCategories() {
    const raw = localStorage.getItem(storageKey('show_hidden_categories'));
    if (raw) {
      try {
        showHiddenCategories.value = JSON.parse(raw);
        debugLog('categoryStore', 'loadShowHiddenCategories', showHiddenCategories.value);
      } catch (error) {
        debugLog('categoryStore', 'loadShowHiddenCategories - parse error', String(error));
        showHiddenCategories.value = false; // Default: versteckte Kategorien ausblenden
      }
    } else {
      showHiddenCategories.value = false; // Default: versteckte Kategorien ausblenden
    }
  }

  /* ----------------------------------------------- Persistence */
  async function loadCategories(): Promise<void> {
    try {
      const [loadedCategories, loadedCategoryGroups] = await Promise.all([
        tenantDbService.getAllCategories(),
        tenantDbService.getAllCategoryGroups(),
      ]);
      categories.value = loadedCategories || [];
      categoryGroups.value = loadedCategoryGroups || [];

      await ensureAvailableFundsCategory();

      let migrated = false;
      for (const category of categories.value) {
        const group = categoryGroups.value.find(g => g.id === category.categoryGroupId);
        const derived = group?.isIncomeGroup ?? false;
        if (category.isIncomeCategory !== derived) {
          category.isIncomeCategory = derived;
          category.updatedAt = new Date().toISOString();
          await tenantDbService.updateCategory(category);
          migrated = true;
        }
      }

      loadExpandedCategories();
      loadExpandedCategoryGroups();
      loadShowHiddenCategories();

      debugLog('categoryStore', 'loadCategories completed', {
        categories: categories.value.length,
        groups: categoryGroups.value.length,
        migrated,
      });
    } catch (error) {
      errorLog('categoryStore', 'Fehler beim Laden der Kategorien', error);
      categories.value = [];
      categoryGroups.value = [];
    }
  }

  async function ensureAvailableFundsCategory() {
    if (!categories.value.find(c => c.name === 'Verfügbare Mittel')) {
      // Erstelle die Kategorie direkt ohne Sync-Queue zu triggern
      const availableFundsCategory: Category = {
        id: uuidv4(),
        name: 'Verfügbare Mittel',
        parentCategoryId: undefined,
        sortOrder: 9999,
        isActive: true,
        isSavingsGoal: false,
        categoryGroupId: undefined,
        icon: undefined,
        budgeted: 0,
        activity: 0,
        available: 0,
        isIncomeCategory: false,
        isHidden: false,
        updatedAt: new Date().toISOString(),
      };

      // Direkt in IndexedDB speichern ohne Sync-Queue
      await tenantDbService.addCategory(availableFundsCategory);

      // Zum lokalen Store hinzufügen
      categories.value.push(availableFundsCategory);

      debugLog('categoryStore', 'ensureAvailableFundsCategory - created AvailableFundsCategory without triggering sync');
    }
  }

  async function reset(): Promise<void> {
    // Nur lokale Arrays leeren - KEINE DB-Löschung beim Tenant-Switch!
    categories.value = [];
    categoryGroups.value = [];
    await loadCategories();
    infoLog('categoryStore', 'Reset erfolgreich - Kategorien aus neuer Tenant-DB geladen');
  }

  /** Initialisiert den Store beim Tenantwechsel oder App-Start */
  async function initializeStore(): Promise<void> {
    await loadCategories();
    debugLog('categoryStore', 'initializeStore completed');
  }

  /* ----------------------------------------------- Exports */
  return {
    categories,
    categoryGroups,
    expandedCategories,
    expandedCategoryGroups,
    showHiddenCategories,
    getCategoryById,
    findCategoryById,
    getCategoriesByParentId,
    getChildCategories,
    rootCategories,
    savingsGoals,
    categoriesByGroup,
    activeCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    updateCategoryBalance,
    addCategoryGroup,
    updateCategoryGroup,
    deleteCategoryGroup,
    setMonthlySnapshot,
    getAvailableFundsCategory,
    toggleCategoryExpanded,
    expandAllCategories,
    collapseAllCategories,
    toggleCategoryGroupExpanded,
    expandAllCategoryGroups,
    collapseAllCategoryGroups,
    expandCategoryGroupsBatch,
    toggleShowHiddenCategories,
    setShowHiddenCategories,
    loadCategories,
    reset,
    initializeStore,
  };
});
