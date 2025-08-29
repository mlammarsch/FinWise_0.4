import { Category, CategoryGroup } from '@/types';
import { type ComputedRef } from 'vue';
export declare const CategoryService: {
    /**
     * Gibt alle Kategorien als reactive computed property zurück
     */
    getCategories(): ComputedRef<Category[]>;
    /**
     * Gibt eine Kategorie anhand ihrer ID als reactive computed property zurück
     */
    getCategoryById(id: string): ComputedRef<Category | undefined>;
    /**
     * Gibt Kategorien gruppiert nach CategoryGroup als reactive computed property zurück
     */
    getCategoriesByGroup(): ComputedRef<Record<string, Category[]>>;
    /**
     * Gibt alle Sparziel-Kategorien als reactive computed property zurück
     */
    getSavingsGoals(): ComputedRef<Category[]>;
    /**
     * Gibt alle CategoryGroups als reactive computed property zurück
     */
    getCategoryGroups(): ComputedRef<CategoryGroup[]>;
    /**
     * Gibt eine CategoryGroup anhand ihrer ID als reactive computed property zurück
     */
    getCategoryGroupById(id: string): ComputedRef<CategoryGroup | undefined>;
    /**
     * Gibt die erweiterten Kategorien als reactive computed property zurück
     */
    getExpandedCategories(): ComputedRef<Set<string>>;
    /**
     * Schaltet den erweiterten Zustand einer Kategorie um
     */
    toggleCategoryExpanded(id: string): void;
    /**
     * Erweitert alle Kategorien
     */
    expandAllCategories(): void;
    /**
     * Klappt alle Kategorien zusammen
     */
    collapseAllCategories(): void;
    /**
     * Erweitert mehrere CategoryGroups in einem Batch-Vorgang (Performance-optimiert)
     */
    expandCategoryGroupsBatch(groupIds: string[]): void;
    /**
     * Lädt alle Kategorien und CategoryGroups
     */
    loadCategories(): Promise<void>;
    /**
     * Fügt eine Kategorie hinzu - mit kompletter Businesslogik
     */
    addCategory(category: Omit<Category, "id" | "updated_at">): Promise<Category | null>;
    /**
     * Aktualisiert eine Kategorie
     */
    updateCategory(id: string, updates: Partial<Category>): Promise<boolean>;
    /**
     * Löscht eine Kategorie
     */
    deleteCategory(id: string): Promise<boolean>;
    /**
     * Fügt eine CategoryGroup hinzu
     */
    addCategoryGroup(data: Omit<CategoryGroup, "id" | "updated_at">): Promise<CategoryGroup | null>;
    /**
     * Aktualisiert eine CategoryGroup
     */
    updateCategoryGroup(id: string, updates: Partial<CategoryGroup>): Promise<boolean>;
    /**
     * Löscht eine CategoryGroup
     */
    deleteCategoryGroup(id: string): Promise<boolean>;
    /**
     * Gibt die "Verfügbare Mittel" Kategorie als reactive computed property zurück
     */
    getAvailableFundsCategory(): ComputedRef<Category | undefined>;
    /**
     * Aktualisiert das Guthaben einer Kategorie
     */
    updateCategoryBalance(id: string, amount: number): Promise<boolean>;
    /**
     * Gibt den Namen einer CategoryGroup anhand ihrer ID zurück
     */
    getGroupName(groupId: string): string;
    /**
     * Gibt den Namen einer Kategorie anhand ihrer ID zurück
     */
    getCategoryName(id: string | null): string;
    /**
     * Update für Kategorien mit Sort Order-Berechnung (einzelne Updates)
     */
    updateCategoriesWithSortOrder(categoryUpdates: Array<{
        id: string;
        sortOrder: number;
        categoryGroupId?: string;
    }>): Promise<boolean>;
    /**
     * Update für CategoryGroups mit Sort Order-Berechnung (einzelne Updates)
     */
    updateCategoryGroupsWithSortOrder(groupUpdates: Array<{
        id: string;
        sortOrder: number;
    }>): Promise<boolean>;
    /**
     * Berechnet neue Sort Order für Kategorien innerhalb einer Gruppe
     */
    calculateCategorySortOrder(groupId: string, newOrder: string[]): Array<{
        id: string;
        sortOrder: number;
        categoryGroupId: string;
    }>;
    /**
     * Berechnet neue Sort Order für CategoryGroups (getrennt für Einnahmen/Ausgaben)
     */
    calculateCategoryGroupSortOrder(newOrder: string[], isIncomeGroups: boolean): Array<{
        id: string;
        sortOrder: number;
    }>;
};
