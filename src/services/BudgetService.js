// src/services/BudgetService.ts
import { useCategoryStore } from "@/stores/categoryStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { usePlanningStore } from "@/stores/planningStore";
import { PlanningService } from "./PlanningService";
import { TransactionService } from "./TransactionService";
import { TransactionType } from "@/types";
import { toDateOnlyString } from "@/utils/formatters";
import { debugLog, infoLog, warnLog, errorLog } from "@/utils/logger";
import { BalanceService } from "./BalanceService";
// Performance-Cache für BudgetService
const summaryCache = new Map();
const categoryCache = new Map();
const CACHE_TTL = 5000; // 5 Sekunden Cache-Zeit (länger für bessere Performance)
let lastCacheClean = 0;
function getCacheKey(monthStart, monthEnd, type) {
    return `${type}-${monthStart.toISOString().split('T')[0]}-${monthEnd.toISOString().split('T')[0]}`;
}
function getCategoryCacheKey(categoryId, monthStart, monthEnd) {
    return `cat-${categoryId}-${monthStart.toISOString().split('T')[0]}-${monthEnd.toISOString().split('T')[0]}`;
}
function cleanExpiredCache() {
    const now = Date.now();
    if (now - lastCacheClean < 10000)
        return; // Nur alle 10 Sekunden cleanen
    lastCacheClean = now;
    for (const [key, value] of summaryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            summaryCache.delete(key);
        }
    }
    for (const [key, value] of categoryCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            categoryCache.delete(key);
        }
    }
}
function invalidateCache() {
    summaryCache.clear();
    categoryCache.clear();
}
// Granulare Cache-Invalidierung für spezifische Kategorien und Monate
function invalidateCacheForTransaction(transaction) {
    if (!transaction.categoryId && !transaction.toCategoryId)
        return;
    const transactionDate = new Date(transaction.date);
    const monthStart = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), 1);
    const monthEnd = new Date(transactionDate.getFullYear(), transactionDate.getMonth() + 1, 0);
    // Invalidiere nur die betroffenen Kategorien und den spezifischen Monat
    const categoriesToInvalidate = [transaction.categoryId, transaction.toCategoryId].filter(Boolean);
    categoriesToInvalidate.forEach(categoryId => {
        if (categoryId) {
            const categoryKey = getCategoryCacheKey(categoryId, monthStart, monthEnd);
            categoryCache.delete(categoryKey);
            debugLog("[BudgetService] Cache invalidated", `Category ${categoryId} for month ${monthStart.toISOString().split('T')[0]}`);
        }
    });
    // Invalidiere nur die Summary-Caches für den betroffenen Monat
    const expenseKey = getCacheKey(monthStart, monthEnd, "expense");
    const incomeKey = getCacheKey(monthStart, monthEnd, "income");
    summaryCache.delete(expenseKey);
    summaryCache.delete(incomeKey);
    debugLog("[BudgetService] Cache invalidated", `Month summaries for ${monthStart.toISOString().split('T')[0]}`);
}
/* ----------------------------- Hilfsfunktionen ----------------------------- */
function getPlannedAmountForCategory(categoryId, monthStart, monthEnd) {
    const planningStore = usePlanningStore();
    const categoryStore = useCategoryStore();
    let amount = 0;
    const startStr = toDateOnlyString(monthStart);
    const endStr = toDateOnlyString(monthEnd);
    planningStore.planningTransactions.forEach(planTx => {
        if (planTx.isActive && planTx.categoryId === categoryId) {
            const occurrences = PlanningService.calculateNextOccurrences(planTx, startStr, endStr);
            amount += planTx.amount * occurrences.length;
        }
    });
    // Kinder rekursiv
    categoryStore
        .getChildCategories(categoryId)
        .filter(c => c.isActive)
        .forEach(child => {
        amount += getPlannedAmountForCategory(child.id, monthStart, monthEnd);
    });
    return amount;
}
/* ----------------------- Expense-Kategorie-Berechnung ----------------------- */
function computeExpenseCategoryDataSingle(categoryId, monthStart, monthEnd) {
    const categoryStore = useCategoryStore();
    const transactionStore = useTransactionStore();
    const cat = categoryStore.getCategoryById(categoryId);
    if (!cat)
        return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    // Vormonats-Saldo
    const prev = new Date(monthStart);
    prev.setDate(prev.getDate() - 1);
    const previousSaldo = BalanceService.getProjectedBalance('category', categoryId, prev);
    // Buchungen dieses Monats nach valueDate
    const txs = transactionStore.transactions.filter(tx => {
        const d = new Date(toDateOnlyString(tx.valueDate));
        return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
    });
    // Budget-Transfers (nur Quelle)
    const budgetAmount = txs
        .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
        .reduce((s, tx) => s + tx.amount, 0);
    // echte Ausgaben UND Einnahmen für diese Kategorie
    const expenseAmount = txs
        .filter(tx => tx.type === TransactionType.EXPENSE || tx.type === TransactionType.INCOME)
        .reduce((s, tx) => s + tx.amount, 0);
    // Prognose - Summe aller Plan- und Prognosebuchungen des Types EXPENSE & INCOME (nur für diese Kategorie)
    const planningStore = usePlanningStore();
    let forecastAmount = 0;
    const startStr = toDateOnlyString(monthStart);
    const endStr = toDateOnlyString(monthEnd);
    planningStore.planningTransactions.forEach(planTx => {
        if (planTx.isActive && planTx.categoryId === categoryId) {
            const occurrences = PlanningService.calculateNextOccurrences(planTx, startStr, endStr);
            forecastAmount += planTx.amount * occurrences.length;
        }
    });
    const spent = expenseAmount;
    const saldo = previousSaldo + budgetAmount + spent + forecastAmount;
    return {
        budgeted: budgetAmount,
        forecast: forecastAmount,
        spent: spent,
        saldo: saldo
    };
}
function computeExpenseCategoryData(categoryId, monthStart, monthEnd) {
    const categoryStore = useCategoryStore();
    const transactionStore = useTransactionStore();
    const cat = categoryStore.getCategoryById(categoryId);
    if (!cat)
        return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    // Vormonats-Saldo
    const prev = new Date(monthStart);
    prev.setDate(prev.getDate() - 1);
    const previousSaldo = BalanceService.getProjectedBalance('category', categoryId, prev);
    // Buchungen dieses Monats nach valueDate
    const txs = transactionStore.transactions.filter(tx => {
        const d = new Date(toDateOnlyString(tx.valueDate));
        return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
    });
    // Budget-Transfers (nur Quelle)
    const budgetAmount = txs
        .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
        .reduce((s, tx) => s + tx.amount, 0);
    // echte Ausgaben UND Einnahmen für diese Kategorie
    const expenseAmount = txs
        .filter(tx => tx.type === TransactionType.EXPENSE || tx.type === TransactionType.INCOME)
        .reduce((s, tx) => s + tx.amount, 0);
    // Prognose - Summe aller Plan- und Prognosebuchungen des Types EXPENSE & INCOME
    const forecastAmount = getPlannedAmountForCategory(categoryId, monthStart, monthEnd);
    const spent = expenseAmount;
    const saldo = previousSaldo + budgetAmount + spent + forecastAmount;
    // Kinder
    let totalBudget = budgetAmount;
    let totalForecast = forecastAmount;
    let totalSpent = spent;
    let totalSaldo = saldo;
    categoryStore
        .getChildCategories(categoryId)
        .filter(c => c.isActive)
        .forEach(child => {
        const childData = computeExpenseCategoryData(child.id, monthStart, monthEnd);
        totalBudget += childData.budgeted;
        totalForecast += childData.forecast;
        totalSpent += childData.spent;
        totalSaldo += childData.saldo;
    });
    return {
        budgeted: totalBudget,
        forecast: totalForecast,
        spent: totalSpent,
        saldo: totalSaldo
    };
}
/* ------------------------ Income-Kategorie-Berechnung ----------------------- */
function computeIncomeCategoryDataSingle(categoryId, monthStart, monthEnd) {
    const categoryStore = useCategoryStore();
    const transactionStore = useTransactionStore();
    const cat = categoryStore.getCategoryById(categoryId);
    if (!cat)
        return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    // Buchungen dieses Monats nach valueDate
    const txs = transactionStore.transactions.filter(tx => {
        const d = new Date(toDateOnlyString(tx.valueDate));
        return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
    });
    // Budget-Transfers (analog zu Expense)
    const budgetAmount = txs
        .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
        .reduce((s, tx) => s + tx.amount, 0);
    // Prognose - Plan- und Prognosebuchungen (nur für diese Kategorie)
    const planningStore = usePlanningStore();
    let forecastAmount = 0;
    const startStr = toDateOnlyString(monthStart);
    const endStr = toDateOnlyString(monthEnd);
    planningStore.planningTransactions.forEach(planTx => {
        if (planTx.isActive && planTx.categoryId === categoryId) {
            const occurrences = PlanningService.calculateNextOccurrences(planTx, startStr, endStr);
            forecastAmount += planTx.amount * occurrences.length;
        }
    });
    // Einnahmen-Transaktionen
    const incomeAmount = txs
        .filter(tx => tx.type === TransactionType.INCOME)
        .reduce((s, tx) => s + tx.amount, 0);
    return {
        budgeted: budgetAmount,
        forecast: forecastAmount,
        spent: incomeAmount,
        saldo: budgetAmount + incomeAmount + forecastAmount
    };
}
function computeIncomeCategoryData(categoryId, monthStart, monthEnd) {
    const categoryStore = useCategoryStore();
    const transactionStore = useTransactionStore();
    const cat = categoryStore.getCategoryById(categoryId);
    if (!cat)
        return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
    // Buchungen dieses Monats nach valueDate
    const txs = transactionStore.transactions.filter(tx => {
        const d = new Date(toDateOnlyString(tx.valueDate));
        return tx.categoryId === categoryId && d >= monthStart && d <= monthEnd;
    });
    // Budget-Transfers (analog zu Expense)
    const budgetAmount = txs
        .filter(tx => tx.type === TransactionType.CATEGORYTRANSFER && tx.categoryId === categoryId)
        .reduce((s, tx) => s + tx.amount, 0);
    // Prognose - Plan- und Prognosebuchungen
    const forecastAmount = getPlannedAmountForCategory(categoryId, monthStart, monthEnd);
    // Einnahmen-Transaktionen
    const incomeAmount = txs
        .filter(tx => tx.type === TransactionType.INCOME)
        .reduce((s, tx) => s + tx.amount, 0);
    let totalBudget = budgetAmount;
    let totalForecast = forecastAmount;
    let totalSpent = incomeAmount;
    let totalSaldo = budgetAmount + incomeAmount + forecastAmount;
    categoryStore
        .getChildCategories(categoryId)
        .filter(c => c.isActive)
        .forEach(child => {
        const childData = computeIncomeCategoryData(child.id, monthStart, monthEnd);
        totalBudget += childData.budgeted;
        totalForecast += childData.forecast;
        totalSpent += childData.spent;
        totalSaldo += childData.saldo;
    });
    return {
        budgeted: totalBudget,
        forecast: totalForecast,
        spent: totalSpent,
        saldo: totalSaldo
    };
}
/* ------------------------------ Public API ---------------------------------- */
export const BudgetService = {
    getAggregatedMonthlyBudgetData(categoryId, monthStart, monthEnd) {
        const cat = useCategoryStore().getCategoryById(categoryId);
        if (!cat) {
            debugLog("[BudgetService] Category not found", categoryId);
            return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
        }
        return cat.isIncomeCategory
            ? computeIncomeCategoryData(categoryId, monthStart, monthEnd)
            : computeExpenseCategoryData(categoryId, monthStart, monthEnd);
    },
    getSingleCategoryMonthlyBudgetData(categoryId, monthStart, monthEnd) {
        const cat = useCategoryStore().getCategoryById(categoryId);
        if (!cat) {
            debugLog("[BudgetService] Category not found", categoryId);
            return { budgeted: 0, forecast: 0, spent: 0, saldo: 0 };
        }
        return cat.isIncomeCategory
            ? computeIncomeCategoryDataSingle(categoryId, monthStart, monthEnd)
            : computeExpenseCategoryDataSingle(categoryId, monthStart, monthEnd);
    },
    getMonthlySummary(monthStart, monthEnd, type) {
        // Cache-Check
        const cacheKey = getCacheKey(monthStart, monthEnd, type);
        const cached = summaryCache.get(cacheKey);
        const now = Date.now();
        if (cached && (now - cached.timestamp) < CACHE_TTL) {
            return cached.data;
        }
        // Cache-Cleanup
        cleanExpiredCache();
        // Berechnung
        const categoryStore = useCategoryStore();
        const isIncome = type === "income";
        const roots = categoryStore.categories.filter(c => c.isActive &&
            !c.parentCategoryId &&
            c.isIncomeCategory === isIncome &&
            c.name !== "Verfügbare Mittel");
        const sum = { budgeted: 0, forecast: 0, spentMiddle: 0, saldoFull: 0 };
        roots.forEach(cat => {
            const d = this.getAggregatedMonthlyBudgetData(cat.id, monthStart, monthEnd);
            sum.budgeted += d.budgeted;
            sum.forecast += d.forecast;
            sum.spentMiddle += d.spent;
            sum.saldoFull += d.saldo;
        });
        // Cache speichern
        summaryCache.set(cacheKey, { data: sum, timestamp: now });
        debugLog("[BudgetService] Monthly summary", `${type} summary for ${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]} (${cached ? 'CACHED' : 'CALCULATED'})`);
        return sum;
    },
    // Cache-Invalidierung für externe Aufrufe
    invalidateCache() {
        invalidateCache();
    },
    // Granulare Cache-Invalidierung für spezifische Transaktionen
    invalidateCacheForTransaction(transaction) {
        invalidateCacheForTransaction(transaction);
    },
    /**
     * Setzt das Budget für einen Monat auf 0 zurück, indem alle CATEGORYTRANSFER-Transaktionen
     * des Monats für Ausgabenkategorien (isIncomeCategory: false) gelöscht werden.
     * Einnahme-Kategorietransfers werden ignoriert.
     * OPTIMIERT: Verwendet Bulk-Löschung für bessere Performance.
     */
    async resetMonthBudget(monthStart, monthEnd) {
        const transactionStore = useTransactionStore();
        const categoryStore = useCategoryStore();
        debugLog('[BudgetService]', 'resetMonthBudget gestartet', {
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0]
        });
        // Finde alle CATEGORYTRANSFER-Transaktionen im angegebenen Monat
        const categoryTransfers = transactionStore.transactions.filter(tx => {
            const txValueDate = new Date(toDateOnlyString(tx.valueDate));
            return (tx.type === TransactionType.CATEGORYTRANSFER &&
                txValueDate >= monthStart &&
                txValueDate <= monthEnd);
        });
        debugLog('[BudgetService]', `Gefundene CATEGORYTRANSFER-Transaktionen: ${categoryTransfers.length}`);
        // Filtere nur Transfers, die Ausgabenkategorien betreffen
        const expenseTransfers = categoryTransfers.filter(tx => {
            // Prüfe sowohl Quell- als auch Zielkategorie
            const sourceCategory = tx.categoryId ? categoryStore.getCategoryById(tx.categoryId) : null;
            const targetCategory = tx.toCategoryId ? categoryStore.getCategoryById(tx.toCategoryId) : null;
            // Nur löschen wenn mindestens eine der Kategorien eine Ausgabenkategorie ist
            // Ignoriere Transfers von Einnahmekategorien zu "Verfügbare Mittel"
            const isExpenseTransfer = (sourceCategory && !sourceCategory.isIncomeCategory) ||
                (targetCategory && !targetCategory.isIncomeCategory);
            return isExpenseTransfer;
        });
        debugLog('[BudgetService]', `Zu löschende Ausgaben-CATEGORYTRANSFER: ${expenseTransfers.length}`);
        if (expenseTransfers.length === 0) {
            infoLog('[BudgetService]', 'resetMonthBudget abgeschlossen: Keine Transaktionen zu löschen');
            return 0;
        }
        // OPTIMIERUNG: Verwende Bulk-Löschung statt einzelner Löschungen
        try {
            const transferIds = expenseTransfers.map(tx => tx.id);
            const result = await TransactionService.bulkDeleteTransactions(transferIds);
            if (result.success) {
                debugLog('[BudgetService]', `Bulk-Löschung erfolgreich: ${result.deletedCount} Transaktionen gelöscht`);
                // Cache invalidieren
                this.invalidateCache();
                infoLog('[BudgetService]', `resetMonthBudget abgeschlossen: ${result.deletedCount} Transaktionen gelöscht`);
                return result.deletedCount;
            }
            else {
                errorLog('[BudgetService]', 'Bulk-Löschung fehlgeschlagen');
                return 0;
            }
        }
        catch (error) {
            errorLog('[BudgetService]', 'Fehler bei Bulk-Löschung von CATEGORYTRANSFER-Transaktionen', error);
            // Fallback: Einzelne Löschungen
            warnLog('[BudgetService]', 'Fallback auf einzelne Löschungen');
            let deletedCount = 0;
            for (const transfer of expenseTransfers) {
                try {
                    const success = await TransactionService.deleteTransaction(transfer.id);
                    if (success) {
                        deletedCount++;
                        debugLog('[BudgetService]', `CATEGORYTRANSFER gelöscht: ${transfer.description} (${transfer.amount}€)`);
                    }
                    else {
                        warnLog('[BudgetService]', `Fehler beim Löschen von CATEGORYTRANSFER: ${transfer.id}`);
                    }
                }
                catch (individualError) {
                    errorLog('[BudgetService]', `Fehler beim Löschen von CATEGORYTRANSFER ${transfer.id}`, individualError);
                }
            }
            // Cache invalidieren
            this.invalidateCache();
            infoLog('[BudgetService]', `resetMonthBudget abgeschlossen (Fallback): ${deletedCount} Transaktionen gelöscht`);
            return deletedCount;
        }
    },
    /**
     * Wendet das Budget-Template auf einen Monat an.
     * Durchläuft Kategorien nach Prioritäten und wendet monatliche Beträge oder Anteile an.
     */
    async applyBudgetTemplate(monthStart, monthEnd, additive = true) {
        const categoryStore = useCategoryStore();
        debugLog('[BudgetService]', 'applyBudgetTemplate gestartet', {
            monthStart: monthStart.toISOString().split('T')[0],
            monthEnd: monthEnd.toISOString().split('T')[0],
            additive
        });
        // Finde "Verfügbare Mittel" Kategorie
        const availableFundsCategory = categoryStore.categories.find(c => c.name.trim().toLowerCase() === "verfügbare mittel");
        if (!availableFundsCategory) {
            errorLog('[BudgetService]', 'Kategorie "Verfügbare Mittel" nicht gefunden');
            return 0;
        }
        // Ermittle verfügbare Mittel zu Beginn
        let availableFunds = BalanceService.getTodayBalance("category", availableFundsCategory.id);
        debugLog('[BudgetService]', `Verfügbare Mittel zu Beginn: ${availableFunds}€`);
        // Hole alle aktiven Ausgabenkategorien mit Template-Daten
        const templateCategories = categoryStore.categories
            .filter(c => c.isActive &&
            !c.isIncomeCategory &&
            c.name.trim().toLowerCase() !== "verfügbare mittel" &&
            (c.monthlyAmount || c.proportion) // Nur Kategorien mit Template-Daten
        )
            .map(c => {
            const group = categoryStore.categoryGroups.find(g => g.id === c.categoryGroupId);
            return {
                ...c,
                groupSortOrder: group?.sortOrder || 999
            };
        })
            .sort((a, b) => {
            // Sortierung: Gruppe sortOrder, dann Kategorie sortOrder
            if (a.groupSortOrder !== b.groupSortOrder) {
                return a.groupSortOrder - b.groupSortOrder;
            }
            return a.sortOrder - b.sortOrder;
        });
        debugLog('[BudgetService]', `Gefundene Template-Kategorien: ${templateCategories.length}`);
        // Ermittle alle vorhandenen Prioritäten
        const priorities = [...new Set(templateCategories
                .map(c => c.priority)
                .filter(p => p !== undefined && p !== null))].sort((a, b) => a - b);
        debugLog('[BudgetService]', `Gefundene Prioritäten: ${priorities.join(', ')}`);
        const transferDate = toDateOnlyString(monthEnd); // Monatsende für Budget-Transfers
        const allTransfers = [];
        // Durchlauf 1: Kategorien ohne Priorität (Festbeträge)
        const noPriorityCategories = templateCategories.filter(c => !c.priority);
        for (const category of noPriorityCategories) {
            if (availableFunds <= 0)
                break;
            if (category.monthlyAmount && category.monthlyAmount > 0) {
                let transferAmount = Math.min(category.monthlyAmount, availableFunds);
                // Sparziel-Prüfung: Begrenze Transfer auf noch benötigten Betrag
                if (category.isSavingsGoal && category.targetAmount) {
                    const currentBalance = BalanceService.getTodayBalance("category", category.id);
                    const remainingToGoal = category.targetAmount - currentBalance;
                    if (remainingToGoal <= 0) {
                        debugLog('[BudgetService]', `Sparziel bereits erreicht für ${category.name} (${currentBalance}€ >= ${category.targetAmount}€)`);
                        continue; // Überspringe diese Kategorie
                    }
                    if (transferAmount > remainingToGoal) {
                        transferAmount = remainingToGoal;
                        debugLog('[BudgetService]', `Transfer begrenzt auf Sparziel für ${category.name}: ${transferAmount}€ (noch benötigt: ${remainingToGoal}€)`);
                    }
                }
                allTransfers.push({
                    fromCategoryId: availableFundsCategory.id,
                    toCategoryId: category.id,
                    amount: transferAmount,
                    date: transferDate,
                    note: `Budget-Template: ${category.name}`
                });
                availableFunds -= transferAmount;
                debugLog('[BudgetService]', `Transfer geplant: ${transferAmount}€ für ${category.name} (ohne Priorität)`);
            }
        }
        // Durchläufe 2-n: Kategorien nach Prioritäten
        for (const priority of priorities) {
            if (availableFunds <= 0)
                break;
            const priorityCategories = templateCategories.filter(c => c.priority === priority);
            for (const category of priorityCategories) {
                if (availableFunds <= 0)
                    break;
                let transferAmount = 0;
                // Primär: Monatlicher Betrag
                if (category.monthlyAmount && category.monthlyAmount > 0) {
                    transferAmount = Math.min(category.monthlyAmount, availableFunds);
                }
                // Sekundär: Anteil von verfügbaren Mitteln
                else if (category.proportion && category.proportion > 0) {
                    transferAmount = Math.min(Math.round(availableFunds * (category.proportion / 100) * 100) / 100, availableFunds);
                }
                // Sparziel-Prüfung: Begrenze Transfer auf noch benötigten Betrag
                if (category.isSavingsGoal && category.targetAmount && transferAmount > 0) {
                    const currentBalance = BalanceService.getTodayBalance("category", category.id);
                    const remainingToGoal = category.targetAmount - currentBalance;
                    if (remainingToGoal <= 0) {
                        debugLog('[BudgetService]', `Sparziel bereits erreicht für ${category.name} (${currentBalance}€ >= ${category.targetAmount}€)`);
                        continue; // Überspringe diese Kategorie
                    }
                    if (transferAmount > remainingToGoal) {
                        transferAmount = remainingToGoal;
                        debugLog('[BudgetService]', `Transfer begrenzt auf Sparziel für ${category.name}: ${transferAmount}€ (noch benötigt: ${remainingToGoal}€)`);
                    }
                }
                if (transferAmount > 0) {
                    allTransfers.push({
                        fromCategoryId: availableFundsCategory.id,
                        toCategoryId: category.id,
                        amount: transferAmount,
                        date: transferDate,
                        note: `Budget-Template: ${category.name} (Priorität ${priority})`
                    });
                    availableFunds -= transferAmount;
                    debugLog('[BudgetService]', `Transfer geplant: ${transferAmount}€ für ${category.name} (Priorität ${priority})`);
                }
            }
        }
        // Bulk-Erstellung aller Transfers
        let transfersCreated = 0;
        if (allTransfers.length > 0) {
            try {
                debugLog('[BudgetService]', `Erstelle ${allTransfers.length} Transfers in Bulk-Operation`);
                const results = await TransactionService.addMultipleCategoryTransfers(allTransfers);
                transfersCreated = results.length;
                debugLog('[BudgetService]', `Bulk-Transfer erfolgreich: ${transfersCreated} Transfers erstellt`);
            }
            catch (error) {
                errorLog('[BudgetService]', 'Fehler bei Bulk-Transfer-Erstellung', error);
                // Fallback: Einzelne Transfers bei Bulk-Fehler
                debugLog('[BudgetService]', 'Fallback auf einzelne Transfers');
                for (const transfer of allTransfers) {
                    try {
                        await TransactionService.addCategoryTransfer(transfer.fromCategoryId, transfer.toCategoryId, transfer.amount, transfer.date, transfer.note);
                        transfersCreated++;
                    }
                    catch (singleError) {
                        errorLog('[BudgetService]', `Fehler beim einzelnen Transfer für Kategorie ${transfer.toCategoryId}`, singleError);
                    }
                }
            }
        }
        // Cache invalidieren
        this.invalidateCache();
        infoLog('[BudgetService]', `applyBudgetTemplate abgeschlossen: ${transfersCreated} Transfers erstellt, ${availableFunds}€ verbleibend`);
        return transfersCreated;
    },
    /**
     * Überschreibt das Budget mit dem Template (resetBudgetMonth + applyBudgetTemplate)
     */
    async overwriteWithBudgetTemplate(monthStart, monthEnd) {
        debugLog('[BudgetService]', 'overwriteWithBudgetTemplate gestartet');
        try {
            // Schritt 1: Budget zurücksetzen
            const deletedCount = await this.resetMonthBudget(monthStart, monthEnd);
            // Schritt 2: Template anwenden
            const createdCount = await this.applyBudgetTemplate(monthStart, monthEnd, false);
            infoLog('[BudgetService]', `overwriteWithBudgetTemplate abgeschlossen: ${deletedCount} gelöscht, ${createdCount} erstellt`);
            return { deleted: deletedCount, created: createdCount };
        }
        catch (error) {
            errorLog('[BudgetService]', 'Fehler bei overwriteWithBudgetTemplate', error);
            throw error;
        }
    },
};
