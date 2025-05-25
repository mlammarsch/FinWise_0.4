// src/services/CategoryService.ts
import { useCategoryStore } from '@/stores/categoryStore';
import { TransactionType, Category, Transaction } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { debugLog } from '@/utils/logger';
import { TransactionService } from './TransactionService';

export const CategoryService = {
  /**
   * Fügt eine Income-Transaktion hinzu und verteilt automatisch nur für Einkommenskategorien
   * zur Kategorie "Verfügbare Mittel".
   *
   * Hinweis: Diese Methode ist weitgehend redundant, da dieselbe Logik jetzt im TransactionService
   * implementiert ist. Sie bleibt vorerst für Abwärtskompatibilität erhalten.
   */
  // async handleIncomeTransaction(transaction: Transaction) {
  //   const categoryStore = useCategoryStore();
  //   const availableFundsCategory = categoryStore.getAvailableFundsCategory();

  //   if (!availableFundsCategory) {
  //     throw new Error("Kategorie 'Verfügbare Mittel' nicht gefunden.");
  //   }

  //   const savedIncome = TransactionService.addTransaction(transaction);

  //   if (transaction.categoryId && savedIncome.amount > 0) {
  //     const cat = categoryStore.getCategoryById(transaction.categoryId);
  //     if (cat?.isIncomeCategory) {
  //       TransactionService.addCategoryTransfer(
  //         transaction.categoryId,
  //         availableFundsCategory.id,
  //         savedIncome.amount,
  //         savedIncome.date,
  //         `Automatischer Transfer von Einnahmen`
  //       );
  //     }
  //   }

  //   debugLog('[CategoryService] handleIncomeTransaction - Income transaction processed.', { transaction });
  // },

  /**
   * Fügt eine Kategorie hinzu
   */
  addCategory(category: Omit<Category, 'id' | 'balance' | 'startBalance' | 'transactionCount' | 'averageTransactionValue'>) {
    const categoryStore = useCategoryStore();

    const newCategory: Category = {
      ...category,
      id: uuidv4(),
      balance: 0,
      startBalance: 0,
      transactionCount: 0,
      averageTransactionValue: 0,
      sortOrder: category.sortOrder ?? categoryStore.categories.length
    };

    const addedCategory = categoryStore.addCategory(newCategory);
    if (addedCategory) {
      debugLog("[CategoryService] addCategory:", addedCategory);
      return addedCategory;
    } else {
      debugLog("[CategoryService] addCategory - Failed to add category");
      return null;
    }
  },

  /**
   * Aktualisiert eine Kategorie
   */
  updateCategory(id: string, updates: Partial<Category>) {
    const categoryStore = useCategoryStore();
    const success = categoryStore.updateCategory(id, updates);
    if (success) {
      debugLog("[CategoryService] updateCategory - Updated:", id);
    } else {
      debugLog("[CategoryService] updateCategory - Failed to update:", id);
    }
    return success;
  },

  /**
   * Löscht eine Kategorie
   */
  deleteCategory(id: string) {
    const categoryStore = useCategoryStore();

    const hasChildren = categoryStore.categories.some(category => category.parentCategoryId === id);
    if (hasChildren) {
      debugLog("[CategoryService] deleteCategory - Failed: Category has children:", id);
      return false;
    }

    const success = categoryStore.deleteCategory(id);
    if (success) {
      debugLog("[CategoryService] deleteCategory - Deleted category id:", id);
    } else {
      debugLog("[CategoryService] deleteCategory - Failed to delete category id:", id);
    }
    return success;
  },

  /**
   * Holt den Namen einer Kategorie anhand ihrer ID.
   */
  getCategoryName(id: string | null): string {
    if (!id) return 'Keine Kategorie';
    const categoryStore = useCategoryStore();
    return categoryStore.getCategoryById(id)?.name || 'Unbekannte Kategorie';
  }
};
