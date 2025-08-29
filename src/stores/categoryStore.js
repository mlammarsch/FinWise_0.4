import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { SyncOperationType, EntityTypeEnum } from '@/types';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { storageKey } from '@/utils/storageKey';
import { TenantDbService } from '@/services/TenantDbService';
export const useCategoryStore = defineStore('category', () => {
    const tenantDbService = new TenantDbService();
    /* ----------------------------------------------- State */
    const categories = ref([]);
    const categoryGroups = ref([]);
    const expandedCategories = ref(new Set());
    const expandedCategoryGroups = ref(new Set());
    const showHiddenCategories = ref(false);
    // Loading Guards
    const isLoading = ref(false);
    const isLoaded = ref(false);
    /* ----------------------------------------------- Getters */
    const getCategoryById = computed(() => (id) => categories.value.find(c => c.id === id));
    const rootCategories = computed(() => categories.value
        .filter(c => c.parentCategoryId === null)
        .sort((a, b) => a.sortOrder - b.sortOrder));
    const getCategoriesByParentId = computed(() => (parentId) => categories.value
        .filter(c => c.parentCategoryId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder));
    const savingsGoals = computed(() => categories.value
        .filter(c => c.isSavingsGoal)
        .sort((a, b) => a.sortOrder - b.sortOrder));
    const categoriesByGroup = computed(() => {
        const grouped = {};
        for (const group of categoryGroups.value) {
            grouped[group.id] = categories.value
                .filter(c => c.categoryGroupId === group.id && !c.parentCategoryId)
                .sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return grouped;
    });
    const activeCategories = computed(() => categories.value
        .filter(c => c.isActive && !c.isHidden)
        .sort((a, b) => a.sortOrder - b.sortOrder));
    /* ----------------------------------------------- Actions */
    function findCategoryById(id) {
        return categories.value.find(c => c.id === id);
    }
    function getChildCategories(parentId) {
        return categories.value
            .filter(c => c.parentCategoryId === parentId)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }
    async function addCategory(categoryData, fromSync = false) {
        const group = categoryGroups.value.find(g => g.id === categoryData.categoryGroupId);
        const isIncome = group?.isIncomeGroup ?? false;
        const categoryWithTimestamp = {
            ...categoryData,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: categoryData.id || uuidv4(),
            isIncomeCategory: categoryData.isIncomeCategory ?? isIncome,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedAt: categoryData.updatedAt || new Date().toISOString(),
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
        }
        else {
            await tenantDbService.addCategory(categoryWithTimestamp);
        }
        const existingCategoryIndex = categories.value.findIndex(c => c.id === categoryWithTimestamp.id);
        if (existingCategoryIndex === -1) {
            categories.value.push(categoryWithTimestamp);
        }
        else {
            if (!fromSync || (categoryWithTimestamp.updatedAt && (!categories.value[existingCategoryIndex].updatedAt || new Date(categoryWithTimestamp.updatedAt) > new Date(categories.value[existingCategoryIndex].updatedAt)))) {
                categories.value[existingCategoryIndex] = categoryWithTimestamp;
            }
            else if (fromSync) {
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
            }
            catch (e) {
                errorLog('categoryStore', `Fehler beim Hinzufügen von Category "${categoryWithTimestamp.name}" zur Sync Queue.`, e);
            }
        }
        return categoryWithTimestamp;
    }
    /**
     * Fügt mehrere Kategorien in einem Batch hinzu - optimiert für große Datenmengen
     */
    async function addMultipleCategories(categoriesToAdd, fromSync = false) {
        if (categoriesToAdd.length === 0) {
            debugLog('categoryStore', 'addMultipleCategories: Keine Kategorien zum Hinzufügen');
            return [];
        }
        const processedCategories = [];
        try {
            // Bereite alle Kategorien vor
            const categoriesWithTimestamp = categoriesToAdd.map(categoryData => {
                const group = categoryGroups.value.find(g => g.id === categoryData.categoryGroupId);
                const isIncome = group?.isIncomeGroup ?? false;
                return {
                    ...categoryData,
                    isIncomeCategory: categoryData.isIncomeCategory ?? isIncome,
                    updatedAt: categoryData.updatedAt || new Date().toISOString(),
                };
            });
            if (fromSync) {
                // Verwende intelligente Batch-Operation für Sync
                const result = await tenantDbService.addCategoriesBatchIntelligent(categoriesWithTimestamp);
                infoLog('categoryStore', `Kategorien Sync-Batch abgeschlossen: ${result.updated} aktualisiert, ${result.skipped} übersprungen`);
                // Aktualisiere nur die tatsächlich geänderten Kategorien im Store
                for (const category of categoriesWithTimestamp) {
                    const existingIndex = categories.value.findIndex(c => c.id === category.id);
                    if (existingIndex === -1) {
                        categories.value.push(category);
                        processedCategories.push(category);
                    }
                    else if (category.updatedAt && (!categories.value[existingIndex].updatedAt ||
                        new Date(category.updatedAt) > new Date(categories.value[existingIndex].updatedAt))) {
                        categories.value[existingIndex] = category;
                        processedCategories.push(category);
                    }
                }
            }
            else {
                // Normale Batch-Operation für lokale Änderungen
                await tenantDbService.addCategoriesBatch(categoriesWithTimestamp);
                // Füge alle Kategorien zum Store hinzu
                for (const category of categoriesWithTimestamp) {
                    const existingIndex = categories.value.findIndex(c => c.id === category.id);
                    if (existingIndex === -1) {
                        categories.value.push(category);
                    }
                    else {
                        categories.value[existingIndex] = category;
                    }
                    processedCategories.push(category);
                }
                // Füge alle zur Sync-Queue hinzu (einzeln, da keine Batch-Methode für Categories existiert)
                for (const category of categoriesWithTimestamp) {
                    try {
                        await tenantDbService.addSyncQueueEntry({
                            entityType: EntityTypeEnum.CATEGORY,
                            entityId: category.id,
                            operationType: SyncOperationType.CREATE,
                            payload: tenantDbService.toPlainObject(category),
                        });
                    }
                    catch (e) {
                        errorLog('categoryStore', `Fehler beim Hinzufügen von Category "${category.name}" zur Sync Queue.`, e);
                    }
                }
                infoLog('categoryStore', `${categoriesWithTimestamp.length} Kategorien zur Sync Queue hinzugefügt`);
            }
            infoLog('categoryStore', `${processedCategories.length} Kategorien erfolgreich als Batch verarbeitet`);
            return processedCategories;
        }
        catch (error) {
            errorLog('categoryStore', `Fehler beim Batch-Hinzufügen von ${categoriesToAdd.length} Kategorien`, error);
            throw error;
        }
    }
    /**
     * Fügt mehrere Kategoriegruppen in einem Batch hinzu - optimiert für große Datenmengen
     */
    async function addMultipleCategoryGroups(categoryGroupsToAdd, fromSync = false) {
        if (categoryGroupsToAdd.length === 0) {
            debugLog('categoryStore', 'addMultipleCategoryGroups: Keine Kategoriegruppen zum Hinzufügen');
            return [];
        }
        const processedCategoryGroups = [];
        try {
            // Bereite alle Kategoriegruppen vor
            const categoryGroupsWithTimestamp = categoryGroupsToAdd.map(categoryGroupData => ({
                ...categoryGroupData,
                updatedAt: categoryGroupData.updatedAt || new Date().toISOString(),
            }));
            if (fromSync) {
                // Für Sync verwende einzelne Operationen mit LWW-Logik (da keine intelligente Batch-Operation existiert)
                for (const categoryGroup of categoryGroupsWithTimestamp) {
                    const result = await addCategoryGroup(categoryGroup, true);
                    processedCategoryGroups.push(result);
                }
            }
            else {
                // Normale Batch-Operation für lokale Änderungen
                await tenantDbService.addCategoryGroupsBatch(categoryGroupsWithTimestamp);
                // Füge alle Kategoriegruppen zum Store hinzu
                for (const categoryGroup of categoryGroupsWithTimestamp) {
                    const existingIndex = categoryGroups.value.findIndex(g => g.id === categoryGroup.id);
                    if (existingIndex === -1) {
                        categoryGroups.value.push(categoryGroup);
                    }
                    else {
                        categoryGroups.value[existingIndex] = categoryGroup;
                    }
                    processedCategoryGroups.push(categoryGroup);
                }
                // Füge alle zur Sync-Queue hinzu
                for (const categoryGroup of categoryGroupsWithTimestamp) {
                    try {
                        await tenantDbService.addSyncQueueEntry({
                            entityType: EntityTypeEnum.CATEGORY_GROUP,
                            entityId: categoryGroup.id,
                            operationType: SyncOperationType.CREATE,
                            payload: tenantDbService.toPlainObject(categoryGroup),
                        });
                    }
                    catch (e) {
                        errorLog('categoryStore', `Fehler beim Hinzufügen von CategoryGroup "${categoryGroup.name}" zur Sync Queue.`, e);
                    }
                }
                infoLog('categoryStore', `${categoryGroupsWithTimestamp.length} Kategoriegruppen zur Sync Queue hinzugefügt`);
            }
            infoLog('categoryStore', `${processedCategoryGroups.length} Kategoriegruppen erfolgreich als Batch verarbeitet`);
            return processedCategoryGroups;
        }
        catch (error) {
            errorLog('categoryStore', `Fehler beim Batch-Hinzufügen von ${categoryGroupsToAdd.length} Kategoriegruppen`, error);
            throw error;
        }
    }
    async function updateCategory(categoryUpdatesData, fromSync = false) {
        const categoryUpdatesWithTimestamp = {
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
        }
        else {
            await tenantDbService.updateCategory(categoryUpdatesWithTimestamp);
        }
        const idx = categories.value.findIndex(c => c.id === categoryUpdatesWithTimestamp.id);
        if (idx !== -1) {
            if (!fromSync || (categoryUpdatesWithTimestamp.updatedAt && (!categories.value[idx].updatedAt || new Date(categoryUpdatesWithTimestamp.updatedAt) > new Date(categories.value[idx].updatedAt)))) {
                categories.value[idx] = { ...categories.value[idx], ...categoryUpdatesWithTimestamp };
            }
            else if (fromSync) {
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
                }
                catch (e) {
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
    async function deleteCategory(categoryId, fromSync = false) {
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
            }
            catch (e) {
                errorLog('categoryStore', `Fehler beim Hinzufügen von Category Delete (ID: "${categoryId}") zur Sync Queue.`, e);
            }
        }
    }
    async function updateCategoryBalance(id, amount) {
        const category = categories.value.find(c => c.id === id);
        if (!category)
            return false;
        // Update activity (equivalent to balance in the new schema)
        category.activity += amount;
        category.updatedAt = new Date().toISOString();
        await tenantDbService.updateCategory(category);
        debugLog('categoryStore', `updateCategoryBalance für Kategorie ${id}`, { amount, newActivity: category.activity });
        return true;
    }
    async function addCategoryGroup(categoryGroupData, fromSync = false) {
        const categoryGroupWithTimestamp = {
            ...categoryGroupData,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            id: categoryGroupData.id || uuidv4(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            updatedAt: categoryGroupData.updatedAt || new Date().toISOString(),
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
        }
        else {
            await tenantDbService.addCategoryGroup(categoryGroupWithTimestamp);
        }
        const existingGroupIndex = categoryGroups.value.findIndex(g => g.id === categoryGroupWithTimestamp.id);
        if (existingGroupIndex === -1) {
            categoryGroups.value.push(categoryGroupWithTimestamp);
        }
        else {
            if (!fromSync || (categoryGroupWithTimestamp.updatedAt && (!categoryGroups.value[existingGroupIndex].updatedAt || new Date(categoryGroupWithTimestamp.updatedAt) > new Date(categoryGroups.value[existingGroupIndex].updatedAt)))) {
                categoryGroups.value[existingGroupIndex] = categoryGroupWithTimestamp;
            }
            else if (fromSync) {
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
            }
            catch (e) {
                errorLog('categoryStore', `Fehler beim Hinzufügen von CategoryGroup "${categoryGroupWithTimestamp.name}" zur Sync Queue.`, e);
            }
        }
        return categoryGroupWithTimestamp;
    }
    async function updateCategoryGroup(categoryGroupUpdatesData, fromSync = false) {
        const categoryGroupUpdatesWithTimestamp = {
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
        }
        else {
            await tenantDbService.updateCategoryGroup(categoryGroupUpdatesWithTimestamp);
        }
        const idx = categoryGroups.value.findIndex(g => g.id === categoryGroupUpdatesWithTimestamp.id);
        if (idx !== -1) {
            if (!fromSync || (categoryGroupUpdatesWithTimestamp.updatedAt && (!categoryGroups.value[idx].updatedAt || new Date(categoryGroupUpdatesWithTimestamp.updatedAt) > new Date(categoryGroups.value[idx].updatedAt)))) {
                categoryGroups.value[idx] = { ...categoryGroups.value[idx], ...categoryGroupUpdatesWithTimestamp };
            }
            else if (fromSync) {
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
                }
                catch (e) {
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
    async function deleteCategoryGroup(categoryGroupId, fromSync = false) {
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
            }
            catch (e) {
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
            }
            catch (error) {
                debugLog('categoryStore', 'loadExpandedCategories - parse error', String(error));
            }
        }
    }
    function saveExpandedCategories() {
        localStorage.setItem(storageKey('expanded_categories'), JSON.stringify([...expandedCategories.value]));
        debugLog('categoryStore', 'saveExpandedCategories', [...expandedCategories.value].join(', '));
    }
    function toggleCategoryExpanded(id) {
        if (expandedCategories.value.has(id)) {
            expandedCategories.value.delete(id);
        }
        else {
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
            }
            catch (error) {
                debugLog('categoryStore', 'loadExpandedCategoryGroups - parse error', String(error));
            }
        }
    }
    function saveExpandedCategoryGroups() {
        localStorage.setItem(storageKey('expanded_category_groups'), JSON.stringify([...expandedCategoryGroups.value]));
        debugLog('categoryStore', 'saveExpandedCategoryGroups', [...expandedCategoryGroups.value].join(', '));
    }
    function toggleCategoryGroupExpanded(id) {
        if (expandedCategoryGroups.value.has(id)) {
            expandedCategoryGroups.value.delete(id);
        }
        else {
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
    function expandCategoryGroupsBatch(groupIds) {
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
    function setShowHiddenCategories(show) {
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
            }
            catch (error) {
                debugLog('categoryStore', 'loadShowHiddenCategories - parse error', String(error));
                showHiddenCategories.value = false; // Default: versteckte Kategorien ausblenden
            }
        }
        else {
            showHiddenCategories.value = false; // Default: versteckte Kategorien ausblenden
        }
    }
    /* ----------------------------------------------- Persistence */
    async function loadCategories() {
        // Loading Guard: Verhindere mehrfaches gleichzeitiges Laden
        if (isLoading.value) {
            debugLog('categoryStore', 'loadCategories: Bereits am Laden, überspringe redundanten Aufruf');
            return;
        }
        // Wenn bereits geladen und Daten vorhanden, überspringe
        if (isLoaded.value && categories.value.length > 0 && categoryGroups.value.length > 0) {
            debugLog('categoryStore', 'loadCategories: Bereits geladen, überspringe redundanten Aufruf');
            return;
        }
        isLoading.value = true;
        try {
            debugLog('categoryStore', 'loadCategories: Starte Laden der Kategorien und Gruppen');
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
            isLoaded.value = true;
            debugLog('categoryStore', 'loadCategories completed', {
                categories: categories.value.length,
                groups: categoryGroups.value.length,
                migrated,
            });
        }
        catch (error) {
            errorLog('categoryStore', 'Fehler beim Laden der Kategorien', error);
            categories.value = [];
            categoryGroups.value = [];
            isLoaded.value = false;
        }
        finally {
            isLoading.value = false;
        }
    }
    async function ensureAvailableFundsCategory() {
        if (!categories.value.find(c => c.name === 'Verfügbare Mittel')) {
            // Erstelle die Kategorie direkt ohne Sync-Queue zu triggern
            const availableFundsCategory = {
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
    async function reset() {
        // Nur lokale Arrays leeren - KEINE DB-Löschung beim Tenant-Switch!
        categories.value = [];
        categoryGroups.value = [];
        // Loading-Status zurücksetzen für neuen Tenant
        isLoading.value = false;
        isLoaded.value = false;
        await loadCategories();
        infoLog('categoryStore', 'Reset erfolgreich - Kategorien aus neuer Tenant-DB geladen');
    }
    /** Initialisiert den Store beim Tenantwechsel oder App-Start */
    async function initializeStore() {
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
        isLoading,
        isLoaded,
        getCategoryById,
        findCategoryById,
        getCategoriesByParentId,
        getChildCategories,
        rootCategories,
        savingsGoals,
        categoriesByGroup,
        activeCategories,
        addCategory,
        addMultipleCategories,
        updateCategory,
        deleteCategory,
        updateCategoryBalance,
        addCategoryGroup,
        addMultipleCategoryGroups,
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
