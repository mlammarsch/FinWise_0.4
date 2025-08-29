import { onMounted, onUnmounted, ref, nextTick, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import Muuri from "muuri";
import { CategoryService } from "../../services/CategoryService";
import { useCategoryStore } from "../../stores/categoryStore";
import { useTransactionStore } from "../../stores/transactionStore";
import { usePlanningStore } from "../../stores/planningStore";
import { debugLog, errorLog, infoLog } from "../../utils/logger";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import CalculatorInput from "../ui/CalculatorInput.vue";
import { BudgetService } from "../../services/BudgetService";
import { BalanceService } from "../../services/BalanceService";
import { toDateOnlyString } from "../../utils/formatters";
import CategoryTransferModal from "./CategoryTransferModal.vue";
import CategoryTransactionModal from "./CategoryTransactionModal.vue";
import CategoryPlanningModal from "./CategoryPlanningModal.vue";
import { TransactionService } from "../../services/TransactionService";
const props = withDefaults(defineProps(), {
    months: () => [],
});
const emit = defineEmits();
// Berechnungsfunktionen für echte Budget-Daten
function getCategoryBudgetData(categoryId, month) {
    const normalizedStart = new Date(toDateOnlyString(month.start));
    const normalizedEnd = new Date(toDateOnlyString(month.end));
    return BudgetService.getAggregatedMonthlyBudgetData(categoryId, normalizedStart, normalizedEnd);
}
function calculateGroupSummary(groupId, month) {
    const categories = getCategoriesForGroup(groupId);
    const summary = {
        budgeted: 0,
        forecast: 0,
        spent: 0,
        saldo: 0,
    };
    categories.forEach((category) => {
        const data = getCategoryBudgetData(category.id, month);
        summary.budgeted += data.budgeted;
        summary.forecast += data.forecast;
        summary.spent += data.spent;
        summary.saldo += data.saldo;
    });
    return summary;
}
const typeSummaryCache = computed(() => {
    // Abhängigkeiten zu Stores hinzufügen für Reaktivität
    const transactionStore = useTransactionStore();
    const planningStore = usePlanningStore();
    // Diese Abhängigkeiten sorgen dafür, dass der Cache neu berechnet wird
    // wenn sich Transaktionen oder Planungen ändern
    const _ = [
        transactionStore.transactions.length,
        planningStore.planningTransactions.length,
        // Zusätzlich auf Änderungen der Kategorien reagieren
        categoryStore.categories.length,
        // Wichtig: Auch auf Transaktionsinhalte reagieren (für Budgettemplate-Anwendung)
        // Erstelle einen Hash aus allen relevanten Transaktionsdaten
        transactionStore.transactions
            .map((t) => `${t.id}-${t.amount}-${t.categoryId}-${t.type}-${t.valueDate}`)
            .join("|"),
        planningStore.planningTransactions
            .map((p) => `${p.id}-${p.amount}-${p.categoryId}-${p.isActive}`)
            .join("|"),
    ];
    const cache = new Map();
    props.months.forEach((month) => {
        const normalizedStart = new Date(toDateOnlyString(month.start));
        const normalizedEnd = new Date(toDateOnlyString(month.end));
        // Cache für Expense-Kategorien
        const expenseSummary = BudgetService.getMonthlySummary(normalizedStart, normalizedEnd, "expense");
        cache.set(`expense-${month.key}`, {
            budgeted: expenseSummary.budgeted,
            forecast: expenseSummary.forecast,
            spent: expenseSummary.spentMiddle,
            saldo: expenseSummary.saldoFull,
        });
        // Cache für Income-Kategorien
        const incomeSummary = BudgetService.getMonthlySummary(normalizedStart, normalizedEnd, "income");
        cache.set(`income-${month.key}`, {
            budgeted: incomeSummary.budgeted,
            forecast: incomeSummary.forecast,
            spent: incomeSummary.spentMiddle,
            saldo: incomeSummary.saldoFull,
        });
    });
    return cache;
});
function calculateTypeSummary(isIncomeType, month) {
    const key = `${isIncomeType ? "income" : "expense"}-${month.key || toDateOnlyString(month.start)}`;
    return (typeSummaryCache.value.get(key) || {
        budgeted: 0,
        forecast: 0,
        spent: 0,
        saldo: 0,
    });
}
// Drag Container
const dragContainer = ref();
// Separate Meta-Grids für Ausgaben und Einnahmen
const expenseMetaGrid = ref(null);
const incomeMetaGrid = ref(null);
// Separate Sub-Grids für Kategorien
const expenseSubGrids = ref([]);
const incomeSubGrids = ref([]);
// Reale Daten aus CategoryService
const categoryGroups = CategoryService.getCategoryGroups();
const categoriesByGroup = CategoryService.getCategoriesByGroup();
// CategoryStore für globalen Expand/Collapse-Zustand
const categoryStore = useCategoryStore();
// Reaktive Kategorie „Verfügbare Mittel"
const availableFundsCategory = computed(() => categoryStore.categories.find((c) => c.name.trim().toLowerCase() === "verfügbare mittel"));
function isVerfuegbareMittel(cat) {
    return availableFundsCategory.value?.id === cat.id;
}
// Berechnet den aktuellen Saldo einer Kategorie basierend auf allen Transaktionen
const getCategoryBalance = (categoryId) => {
    return BalanceService.getTodayBalance("category", categoryId);
};
// Berechnet den Progress-Wert für Sparziele (Saldo / Sparziel * 100, max. 100)
const getSavingsGoalProgress = (category) => {
    if (!category.isSavingsGoal ||
        !category.targetAmount ||
        category.targetAmount <= 0) {
        return 0;
    }
    const currentBalance = getCategoryBalance(category.id);
    const progress = (currentBalance / category.targetAmount) * 100;
    // Ergebnis kann nie höher als 100 sein
    return Math.min(Math.max(progress, 0), 100);
};
// Context-Dropdown
const showDropdown = ref(false);
const dropdownX = ref(0);
const dropdownY = ref(0);
const dropdownRef = ref(null);
// Modal-State
const showTransferModal = ref(false);
const modalData = ref(null);
// Transaction Modal State
const showTransactionModal = ref(false);
const transactionModalData = ref(null);
// Planning Modal State
const showPlanningModal = ref(false);
const planningModalData = ref(null);
// Editable Budget State
const activeEditField = ref(null); // Format: "categoryId-monthKey"
const processingBudgetUpdate = ref(new Set()); // Verhindert doppelte Updates
// Debounced Budget Update Queue
const budgetUpdateQueue = ref(new Map());
const budgetUpdateTimer = ref(null);
const BUDGET_UPDATE_DEBOUNCE_DELAY = 500;
// Auto-Expand Timer für Drag-Over
const autoExpandTimer = ref(null);
// Debouncing für Sort Order Updates
const sortOrderUpdateTimer = ref(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500;
// Getrennte Lebensbereiche nach Typ
const expenseGroups = computed(() => {
    const groups = categoryGroups.value.filter((g) => !g.isIncomeGroup);
    return groups.sort((a, b) => a.sortOrder - b.sortOrder);
});
const incomeGroups = computed(() => {
    const groups = categoryGroups.value.filter((g) => g.isIncomeGroup);
    return groups.sort((a, b) => a.sortOrder - b.sortOrder);
});
// Icon-Mapping für Lebensbereiche
function getGroupIcon(group) {
    return "mdi:folder-outline";
}
function getGroupColor(group) {
    return "text-base-content";
}
// Kategorien für eine Gruppe (sortiert nach sortOrder)
function getCategoriesForGroup(groupId) {
    const categories = categoriesByGroup.value[groupId] || [];
    return categories
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
}
// Kategorien für eine Gruppe gefiltert nach Sichtbarkeit (für die Anzeige)
function getVisibleCategoriesForGroup(groupId) {
    const categories = getCategoriesForGroup(groupId);
    if (categoryStore.showHiddenCategories) {
        return categories; // Alle Kategorien anzeigen
    }
    return categories.filter((category) => !category.isHidden); // Versteckte Kategorien ausblenden
}
// Editable Budget Functions
function isEditingBudget(categoryId, monthKey) {
    const result = activeEditField.value === `${categoryId}-${monthKey}`;
    return result;
}
// Debounced Budget Update Queue Verarbeitung
async function processBudgetUpdateQueue() {
    if (budgetUpdateQueue.value.size === 0)
        return;
    debugLog("BudgetCategoriesAndValues", `Verarbeite ${budgetUpdateQueue.value.size} Budget-Updates in Batch`);
    const updates = Array.from(budgetUpdateQueue.value.values());
    const transfers = [];
    // Finde die "Verfügbare Mittel" Kategorie
    const availableFunds = availableFundsCategory.value;
    if (!availableFunds) {
        errorLog("BudgetCategoriesAndValues", 'Kategorie "Verfügbare Mittel" nicht gefunden');
        budgetUpdateQueue.value.clear();
        return;
    }
    // Verarbeite alle Updates und sammle Transfers
    for (const update of updates) {
        try {
            // Finde den entsprechenden Monat
            const targetMonth = props.months.find((month) => month.key === update.monthKey);
            if (!targetMonth) {
                errorLog("BudgetCategoriesAndValues", `Monat mit Key ${update.monthKey} nicht gefunden`);
                continue;
            }
            // Berechne den aktuellen Budgetwert
            const currentBudgetData = BudgetService.getSingleCategoryMonthlyBudgetData(update.categoryId, targetMonth.start, targetMonth.end);
            const currentBudgetValue = currentBudgetData.budgeted;
            const difference = update.newValue - currentBudgetValue;
            if (Math.abs(difference) < 0.01) {
                debugLog("BudgetCategoriesAndValues", `Keine Änderung erforderlich für ${update.categoryId}-${update.monthKey}`);
                continue;
            }
            const transferDate = toDateOnlyString(targetMonth.start);
            const transferNote = `Budget-Anpassung für ${update.monthKey}`;
            if (difference < 0) {
                // Transfer von Kategorie zu "Verfügbare Mittel"
                transfers.push({
                    fromCategoryId: update.categoryId,
                    toCategoryId: availableFunds.id,
                    amount: Math.abs(difference),
                    date: transferDate,
                    note: transferNote,
                });
            }
            else {
                // Transfer von "Verfügbare Mittel" zu Kategorie
                transfers.push({
                    fromCategoryId: availableFunds.id,
                    toCategoryId: update.categoryId,
                    amount: difference,
                    date: transferDate,
                    note: transferNote,
                });
            }
            debugLog("BudgetCategoriesAndValues", `Transfer geplant: ${Math.abs(difference)}€ für ${update.categoryId}-${update.monthKey}`);
        }
        catch (error) {
            errorLog("BudgetCategoriesAndValues", `Fehler bei Budget-Update für ${update.categoryId}-${update.monthKey}`, error);
        }
    }
    // Bulk-Erstellung aller Transfers
    if (transfers.length > 0) {
        try {
            debugLog("BudgetCategoriesAndValues", `Erstelle ${transfers.length} Budget-Transfers in Bulk-Operation`);
            await TransactionService.addMultipleCategoryTransfers(transfers);
            infoLog("BudgetCategoriesAndValues", `Batch Budget-Update abgeschlossen: ${transfers.length} Transfers erstellt`);
        }
        catch (error) {
            errorLog("BudgetCategoriesAndValues", "Fehler bei Bulk-Budget-Update", error);
            // Fallback: Einzelne Transfers
            debugLog("BudgetCategoriesAndValues", "Fallback auf einzelne Budget-Transfers");
            for (const transfer of transfers) {
                try {
                    await TransactionService.addCategoryTransfer(transfer.fromCategoryId, transfer.toCategoryId, transfer.amount, transfer.date, transfer.note);
                }
                catch (singleError) {
                    errorLog("BudgetCategoriesAndValues", `Fehler beim einzelnen Budget-Transfer`, singleError);
                }
            }
        }
    }
    // Queue leeren
    budgetUpdateQueue.value.clear();
}
// Handler für CalculatorInput - sammelt Updates in Queue
function handleBudgetUpdate(categoryId, monthKey, newValue) {
    const updateKey = `${categoryId}-${monthKey}`;
    debugLog("BudgetCategoriesAndValues", `Budget update queued: ${updateKey} = ${newValue}`);
    // Update in Queue einreihen (überschreibt vorherige Updates für dasselbe Feld)
    budgetUpdateQueue.value.set(updateKey, {
        categoryId,
        monthKey,
        newValue,
        timestamp: Date.now(),
    });
    // Debounced Timer zurücksetzen
    if (budgetUpdateTimer.value) {
        clearTimeout(budgetUpdateTimer.value);
    }
    budgetUpdateTimer.value = setTimeout(() => {
        processBudgetUpdateQueue();
    }, BUDGET_UPDATE_DEBOUNCE_DELAY);
}
function handleBudgetFinish(categoryId, monthKey) {
    const fieldKey = `${categoryId}-${monthKey}`;
    if (activeEditField.value === fieldKey) {
        activeEditField.value = null;
    }
}
function handleBudgetClick(categoryId, monthKey) {
    debugLog("BudgetCategoriesAndValues", `handleBudgetClick called for category ${categoryId}, month ${monthKey}`);
    if (!isEditingBudget(categoryId, monthKey)) {
        debugLog("BudgetCategoriesAndValues", "Not currently editing, starting edit mode");
        activeEditField.value = `${categoryId}-${monthKey}`;
        debugLog("BudgetCategoriesAndValues", `activeEditField set to: ${activeEditField.value}`);
    }
    else {
        debugLog("BudgetCategoriesAndValues", "Already editing this field");
    }
}
function handleFocusNext(categoryId, monthKey) {
    debugLog("BudgetCategoriesAndValues", `handleFocusNext called for category ${categoryId}, month ${monthKey}`);
    // Erst das Budget-Update durchführen (wird bereits durch CalculatorInput gemacht)
    // Dann zum nächsten Feld navigieren
    const nextField = findNextBudgetField(categoryId, monthKey);
    if (nextField) {
        debugLog("BudgetCategoriesAndValues", `Focusing next field: ${nextField.categoryId}-${nextField.monthKey}`);
        activeEditField.value = `${nextField.categoryId}-${nextField.monthKey}`;
    }
    else {
        debugLog("BudgetCategoriesAndValues", "No next field found, removing focus");
        activeEditField.value = null;
    }
}
function handleFocusPrevious(categoryId, monthKey) {
    debugLog("BudgetCategoriesAndValues", `handleFocusPrevious called for category ${categoryId}, month ${monthKey}`);
    // Erst das Budget-Update durchführen (wird bereits durch CalculatorInput gemacht)
    // Dann zum vorherigen Feld navigieren
    const previousField = findPreviousBudgetField(categoryId, monthKey);
    if (previousField) {
        debugLog("BudgetCategoriesAndValues", `Focusing previous field: ${previousField.categoryId}-${previousField.monthKey}`);
        activeEditField.value = `${previousField.categoryId}-${previousField.monthKey}`;
    }
    else {
        debugLog("BudgetCategoriesAndValues", "No previous field found, removing focus");
        activeEditField.value = null;
    }
}
// Hilfsfunktionen für die Navigation zwischen Budget-Feldern
function findNextBudgetField(currentCategoryId, currentMonthKey) {
    // Erstelle eine Liste aller editierbaren Kategorien im gleichen Monat
    const editableCategories = [];
    // Durchlaufe alle Gruppen (Ausgaben zuerst, dann Einnahmen)
    const allGroups = [...expenseGroups.value, ...incomeGroups.value];
    allGroups.forEach((group) => {
        // Nur erweiterte Gruppen berücksichtigen
        if (categoryStore.expandedCategoryGroups.has(group.id)) {
            const categories = getCategoriesForGroup(group.id);
            categories.forEach((category) => {
                // Nur für Ausgaben-Kategorien sind Budget-Felder editierbar
                if (!category.isIncomeCategory) {
                    editableCategories.push(category.id);
                }
            });
        }
    });
    // Finde den Index der aktuellen Kategorie
    const currentIndex = editableCategories.findIndex((categoryId) => categoryId === currentCategoryId);
    // Wenn aktuelle Kategorie gefunden und es gibt eine nächste Kategorie
    if (currentIndex >= 0 && currentIndex < editableCategories.length - 1) {
        return {
            categoryId: editableCategories[currentIndex + 1],
            monthKey: currentMonthKey, // Bleibe im gleichen Monat
        };
    }
    // Kein nächstes Feld gefunden
    return null;
}
function findPreviousBudgetField(currentCategoryId, currentMonthKey) {
    // Erstelle eine Liste aller editierbaren Kategorien im gleichen Monat
    const editableCategories = [];
    // Durchlaufe alle Gruppen (Ausgaben zuerst, dann Einnahmen)
    const allGroups = [...expenseGroups.value, ...incomeGroups.value];
    allGroups.forEach((group) => {
        // Nur erweiterte Gruppen berücksichtigen
        if (categoryStore.expandedCategoryGroups.has(group.id)) {
            const categories = getCategoriesForGroup(group.id);
            categories.forEach((category) => {
                // Nur für Ausgaben-Kategorien sind Budget-Felder editierbar
                if (!category.isIncomeCategory) {
                    editableCategories.push(category.id);
                }
            });
        }
    });
    // Finde den Index der aktuellen Kategorie
    const currentIndex = editableCategories.findIndex((categoryId) => categoryId === currentCategoryId);
    // Wenn aktuelle Kategorie gefunden und es gibt eine vorherige Kategorie
    if (currentIndex > 0) {
        return {
            categoryId: editableCategories[currentIndex - 1],
            monthKey: currentMonthKey, // Bleibe im gleichen Monat
        };
    }
    // Kein vorheriges Feld gefunden
    return null;
}
// Outside click handler (nicht mehr benötigt, da CalculatorInput eigenes Outside-Click-Handling hat)
// Outside click handler (nicht mehr benötigt, da CalculatorInput eigenes Outside-Click-Handling hat)
function handleOutsideClick(event) {
    // Leer lassen - CalculatorInput handhabt Outside-Clicks selbst
}
onMounted(async () => {
    // Add outside click listener
    document.addEventListener("click", handleOutsideClick);
    debugLog("BudgetCategoriesAndValues", "Component mounted, starting initialization");
    // Kategorien sind bereits durch Store-Initialisierung geladen
    // Warte nur auf Reaktivität der categoryGroups
    await nextTick();
    // Batch-Expansion aller Gruppen über CategoryService
    const groupsToExpand = categoryGroups.value
        .filter((group) => !categoryStore.expandedCategoryGroups.has(group.id))
        .map((group) => group.id);
    if (groupsToExpand.length > 0) {
        debugLog("BudgetCategoriesAndValues", `Expanding ${groupsToExpand.length} category groups`);
        CategoryService.expandCategoryGroupsBatch(groupsToExpand);
    }
    await nextTick();
    debugLog("BudgetCategoriesAndValues", "Starting Muuri grid initialization");
    // Muuri-Initialisierung mit mehreren requestAnimationFrame für bessere Animation-Performance
    requestAnimationFrame(() => {
        debugLog("BudgetCategoriesAndValues", "First animation frame - allowing spinner to animate");
        requestAnimationFrame(() => {
            debugLog("BudgetCategoriesAndValues", "Second animation frame - calling initializeGrids");
            initializeGrids();
        });
    });
});
onUnmounted(() => {
    destroyGrids();
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    if (autoExpandTimer.value) {
        clearTimeout(autoExpandTimer.value);
    }
    if (budgetUpdateTimer.value) {
        clearTimeout(budgetUpdateTimer.value);
        // Verarbeite noch ausstehende Budget-Updates vor dem Unmount
        processBudgetUpdateQueue();
    }
    // Remove outside click listener
    document.removeEventListener("click", handleOutsideClick);
});
// Watcher für globale Expand/Collapse-Änderungen
watch(() => categoryStore.expandedCategoryGroups, () => {
    nextTick(() => {
        updateLayoutAfterToggle();
    });
}, { deep: true });
// Watcher für showHiddenCategories-Änderungen
watch(() => categoryStore.showHiddenCategories, async () => {
    debugLog("BudgetCategoriesAndValues", "showHiddenCategories changed, destroying and recreating grids");
    // Grids komplett zerstören
    destroyGrids();
    // Kurz warten für DOM-Updates
    await nextTick();
    // Grids komplett neu initialisieren
    setTimeout(() => {
        initializeGrids();
    }, 100); // Kurze Verzögerung für DOM-Updates
});
// Watcher für Änderungen der months-Props (PagingYearComponent, Spaltenanzahl)
watch(() => props.months, async (newMonths, oldMonths) => {
    if (!newMonths || newMonths.length === 0)
        return;
    // Prüfe ob sich die Monate tatsächlich geändert haben
    const monthsChanged = !oldMonths ||
        newMonths.length !== oldMonths.length ||
        newMonths.some((month, index) => !oldMonths[index] || month.key !== oldMonths[index].key);
    if (monthsChanged) {
        debugLog("BudgetCategoriesAndValues", `Months changed, updating layout. New count: ${newMonths.length}`);
        // Kurz warten für DOM-Updates
        await nextTick();
        // Layout aller Grids aktualisieren
        updateLayoutAfterMonthsChange();
    }
}, { deep: true });
// Optimierte Muuri-Grid-Initialisierung mit Chunking für bessere Performance
async function initializeGrids() {
    debugLog("BudgetCategoriesAndValues", "initializeGrids() function called - starting chunked initialization");
    try {
        let completedLayouts = 0;
        const totalGrids = 2; // Expense Meta-Grid + Income Meta-Grid
        const checkAllLayoutsComplete = () => {
            completedLayouts++;
            debugLog("BudgetCategoriesAndValues", `Layout completed: ${completedLayouts}/${totalGrids}`);
            if (completedLayouts >= totalGrids) {
                debugLog("BudgetCategoriesAndValues", "All Muuri grids layouts completed successfully - emitting muuriReady");
                emit("muuriReady");
            }
        };
        // Schritt 1: Sub-Grids in Chunks initialisieren
        await initializeSubGridsInChunks();
        // Schritt 2: Meta-Grids mit gestaffelten Delays
        await initializeMetaGridsSequentially(checkAllLayoutsComplete);
    }
    catch (error) {
        errorLog("BudgetCategoriesAndValues", "Failed to initialize grids with chunking", error);
        // Auch bei Fehlern das Event emittieren, damit Loading beendet wird
        emit("muuriReady");
    }
}
// Initialisiert Sub-Grids in kleineren Chunks für bessere Performance
async function initializeSubGridsInChunks() {
    debugLog("BudgetCategoriesAndValues", "Starting chunked sub-grid initialization");
    // Expense Sub-Grids in Chunks
    const expenseSubGridElements = document.querySelectorAll("#expense-categories .categories-content");
    await processElementsInChunks(Array.from(expenseSubGridElements), expenseSubGrids, "expense");
    // Kurze Pause zwischen Expense und Income
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Income Sub-Grids in Chunks
    const incomeSubGridElements = document.querySelectorAll("#income-categories .categories-content");
    await processElementsInChunks(Array.from(incomeSubGridElements), incomeSubGrids, "income");
    debugLog("BudgetCategoriesAndValues", "Chunked sub-grid initialization completed");
}
// Verarbeitet Elemente in kleineren Chunks
async function processElementsInChunks(elements, subGridsArray, type) {
    // Frame-by-Frame Initialisierung: nach jedem Grid an den Browser yielden,
    // damit der Spinner/Skeleton flüssig animieren kann.
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        debugLog("BudgetCategoriesAndValues", `Initializing ${type} sub-grid ${i + 1}/${elements.length}`);
        try {
            const grid = createSubGrid(el, subGridsArray);
            subGridsArray.value.push(grid);
        }
        catch (error) {
            errorLog("BudgetCategoriesAndValues", `Failed to create ${type} sub-grid`, error);
        }
        // Yield bis zum nächsten Animation-Frame (rAF), um den Main-Thread freizugeben
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
}
// Initialisiert Meta-Grids sequenziell mit optimierten Delays
async function initializeMetaGridsSequentially(checkAllLayoutsComplete) {
    debugLog("BudgetCategoriesAndValues", "Starting sequential meta-grid initialization");
    // Schritt 1: Expense Meta-Grid
    await new Promise((resolve) => {
        setTimeout(() => {
            try {
                debugLog("BudgetCategoriesAndValues", "Initializing Expense Meta-Grid");
                expenseMetaGrid.value = createMetaGrid("#expense-categories", false);
                if (expenseMetaGrid.value.getItems().length === 0) {
                    debugLog("BudgetCategoriesAndValues", "Expense Meta-Grid has no items, layout complete immediately");
                    checkAllLayoutsComplete();
                    resolve();
                }
                else {
                    let layoutCompleted = false;
                    expenseMetaGrid.value.on("layoutEnd", () => {
                        if (!layoutCompleted) {
                            layoutCompleted = true;
                            debugLog("BudgetCategoriesAndValues", "Expense Meta-Grid layout completed via event");
                            checkAllLayoutsComplete();
                            resolve();
                        }
                    });
                    // Fallback-Timer
                    setTimeout(() => {
                        if (!layoutCompleted) {
                            layoutCompleted = true;
                            debugLog("BudgetCategoriesAndValues", "Expense Meta-Grid layout completed via timeout fallback");
                            checkAllLayoutsComplete();
                            resolve();
                        }
                    }, 300);
                }
            }
            catch (error) {
                errorLog("BudgetCategoriesAndValues", "Failed to initialize Expense Meta-Grid", error);
                checkAllLayoutsComplete(); // Trotzdem als abgeschlossen markieren
                resolve();
            }
        }, 100); // Reduziert von 150ms auf 100ms
    });
    // Schritt 2: Income Meta-Grid
    await new Promise((resolve) => {
        setTimeout(() => {
            try {
                debugLog("BudgetCategoriesAndValues", "Initializing Income Meta-Grid");
                incomeMetaGrid.value = createMetaGrid("#income-categories", true);
                if (incomeMetaGrid.value.getItems().length === 0) {
                    debugLog("BudgetCategoriesAndValues", "Income Meta-Grid has no items, layout complete immediately");
                    checkAllLayoutsComplete();
                    resolve();
                }
                else {
                    let layoutCompleted = false;
                    incomeMetaGrid.value.on("layoutEnd", () => {
                        if (!layoutCompleted) {
                            layoutCompleted = true;
                            debugLog("BudgetCategoriesAndValues", "Income Meta-Grid layout completed via event");
                            checkAllLayoutsComplete();
                            resolve();
                        }
                    });
                    // Fallback-Timer
                    setTimeout(() => {
                        if (!layoutCompleted) {
                            layoutCompleted = true;
                            debugLog("BudgetCategoriesAndValues", "Income Meta-Grid layout completed via timeout fallback");
                            checkAllLayoutsComplete();
                            resolve();
                        }
                    }, 300);
                }
            }
            catch (error) {
                errorLog("BudgetCategoriesAndValues", "Failed to initialize Income Meta-Grid", error);
                checkAllLayoutsComplete(); // Trotzdem als abgeschlossen markieren
                resolve();
            }
        }, 75); // Reduziert von 100ms auf 75ms
    });
    debugLog("BudgetCategoriesAndValues", "Sequential meta-grid initialization completed");
}
function createSubGrid(element, subGridsArray) {
    return new Muuri(element, {
        items: ".category-item-extended",
        dragEnabled: true,
        dragHandle: ".category-drag-area",
        dragContainer: dragContainer.value,
        dragSort: function () {
            return [...expenseSubGrids.value, ...incomeSubGrids.value];
        },
        dragCssProps: {
            touchAction: "auto",
            userSelect: "none",
            userDrag: "none",
            tapHighlightColor: "rgba(0, 0, 0, 0)",
            touchCallout: "none",
            contentZooming: "none",
        },
        dragAutoScroll: {
            targets: (item) => {
                return [
                    { element: window, priority: 0 },
                    { element: item.getGrid().getElement().parentNode, priority: 1 },
                ];
            },
        },
    })
        .on("dragInit", function (item) {
        const element = item.getElement();
        if (element) {
            element.style.width = item.getWidth() + "px";
            element.style.height = item.getHeight() + "px";
        }
    })
        .on("dragReleaseEnd", function (item) {
        const element = item.getElement();
        const grid = item.getGrid();
        if (element) {
            element.style.width = "";
            element.style.height = "";
        }
        if (grid) {
            grid.refreshItems([item]);
        }
    })
        .on("layoutStart", function () {
        if (expenseMetaGrid.value) {
            expenseMetaGrid.value.refreshItems().layout();
        }
        if (incomeMetaGrid.value) {
            incomeMetaGrid.value.refreshItems().layout();
        }
    })
        .on("dragStart", function (item) {
        setupAutoExpand();
    })
        .on("dragEnd", function (item) {
        clearAutoExpandTimer();
        handleCategoryDragEnd(item);
    });
}
function createMetaGrid(selector, isIncomeGrid) {
    return new Muuri(selector, {
        items: ".group-wrapper",
        dragEnabled: true,
        dragHandle: ".group-drag-handle",
        dragContainer: dragContainer.value,
        dragCssProps: {
            touchAction: "auto",
            userSelect: "none",
            userDrag: "none",
            tapHighlightColor: "rgba(0, 0, 0, 0)",
            touchCallout: "none",
            contentZooming: "none",
        },
        dragAutoScroll: {
            targets: (item) => {
                return [
                    { element: window, priority: 0 },
                    { element: item.getGrid().getElement().parentNode, priority: 1 },
                ];
            },
        },
        layout: {
            fillGaps: false,
            horizontal: false,
            alignRight: false,
            alignBottom: false,
        },
        layoutDuration: 300,
        layoutEasing: "ease",
    })
        .on("dragInit", function (item) {
        const element = item.getElement();
        if (element) {
            element.style.width = item.getWidth() + "px";
            element.style.height = item.getHeight() + "px";
        }
    })
        .on("dragReleaseEnd", function (item) {
        const element = item.getElement();
        const grid = item.getGrid();
        if (element) {
            element.style.width = "";
            element.style.height = "";
        }
        if (grid) {
            grid.refreshItems([item]);
        }
    })
        .on("dragEnd", function (item) {
        handleCategoryGroupDragEnd(item, isIncomeGrid);
    });
}
function destroyGrids() {
    try {
        // Sub-Grids zerstören
        [...expenseSubGrids.value, ...incomeSubGrids.value].forEach((grid) => {
            if (grid) {
                grid.destroy();
            }
        });
        expenseSubGrids.value = [];
        incomeSubGrids.value = [];
        // Meta-Grids zerstören
        if (expenseMetaGrid.value) {
            expenseMetaGrid.value.destroy();
            expenseMetaGrid.value = null;
        }
        if (incomeMetaGrid.value) {
            incomeMetaGrid.value.destroy();
            incomeMetaGrid.value = null;
        }
        debugLog("BudgetCategoriesAndValues", "Muuri grids destroyed");
    }
    catch (error) {
        errorLog("BudgetCategoriesAndValues", "Failed to destroy Muuri grids", error);
    }
}
// Expand/Collapse Funktionen
function toggleGroup(groupId) {
    categoryStore.toggleCategoryGroupExpanded(groupId);
    nextTick(() => {
        updateLayoutAfterToggle();
    });
}
function updateLayoutAfterToggle() {
    // Alle Sub-Grids refreshen
    [...expenseSubGrids.value, ...incomeSubGrids.value].forEach((grid) => {
        if (grid) {
            grid.refreshItems();
            grid.layout(true);
        }
    });
    // Meta-Grids refreshen
    if (expenseMetaGrid.value) {
        expenseMetaGrid.value.refreshItems();
        expenseMetaGrid.value.layout(true);
    }
    if (incomeMetaGrid.value) {
        incomeMetaGrid.value.refreshItems();
        incomeMetaGrid.value.layout(true);
    }
}
function updateLayoutAfterMonthsChange() {
    debugLog("BudgetCategoriesAndValues", "updateLayoutAfterMonthsChange() called");
    try {
        let completedLayouts = 0;
        const totalGrids = 2; // Expense Meta-Grid + Income Meta-Grid
        const checkAllLayoutsComplete = () => {
            completedLayouts++;
            debugLog("BudgetCategoriesAndValues", `Layout update completed: ${completedLayouts}/${totalGrids}`);
            if (completedLayouts >= totalGrids) {
                debugLog("BudgetCategoriesAndValues", "All layouts updated after months change - emitting muuriReady");
                emit("muuriReady");
            }
        };
        // Alle Sub-Grids refreshen
        [...expenseSubGrids.value, ...incomeSubGrids.value].forEach((grid) => {
            if (grid) {
                grid.refreshItems();
                grid.layout(true);
            }
        });
        // Meta-Grids refreshen mit Layout-Completion-Tracking
        if (expenseMetaGrid.value) {
            expenseMetaGrid.value.refreshItems();
            // Prüfe ob Items vorhanden sind
            if (expenseMetaGrid.value.getItems().length === 0) {
                debugLog("BudgetCategoriesAndValues", "Expense Meta-Grid has no items, layout complete immediately");
                checkAllLayoutsComplete();
            }
            else {
                // Einmaliger Event-Listener für layoutEnd
                const handleExpenseLayoutEnd = () => {
                    expenseMetaGrid.value?.off("layoutEnd", handleExpenseLayoutEnd);
                    debugLog("BudgetCategoriesAndValues", "Expense Meta-Grid layout update completed");
                    checkAllLayoutsComplete();
                };
                expenseMetaGrid.value.on("layoutEnd", handleExpenseLayoutEnd);
                expenseMetaGrid.value.layout(true);
                // Fallback nach 300ms
                setTimeout(() => {
                    if (completedLayouts < 1) {
                        expenseMetaGrid.value?.off("layoutEnd", handleExpenseLayoutEnd);
                        debugLog("BudgetCategoriesAndValues", "Expense Meta-Grid layout completed via timeout fallback");
                        checkAllLayoutsComplete();
                    }
                }, 300);
            }
        }
        else {
            checkAllLayoutsComplete();
        }
        if (incomeMetaGrid.value) {
            incomeMetaGrid.value.refreshItems();
            // Prüfe ob Items vorhanden sind
            if (incomeMetaGrid.value.getItems().length === 0) {
                debugLog("BudgetCategoriesAndValues", "Income Meta-Grid has no items, layout complete immediately");
                checkAllLayoutsComplete();
            }
            else {
                // Einmaliger Event-Listener für layoutEnd
                const handleIncomeLayoutEnd = () => {
                    incomeMetaGrid.value?.off("layoutEnd", handleIncomeLayoutEnd);
                    debugLog("BudgetCategoriesAndValues", "Income Meta-Grid layout update completed");
                    checkAllLayoutsComplete();
                };
                incomeMetaGrid.value.on("layoutEnd", handleIncomeLayoutEnd);
                incomeMetaGrid.value.layout(true);
                // Fallback nach 300ms
                setTimeout(() => {
                    if (completedLayouts < 2) {
                        incomeMetaGrid.value?.off("layoutEnd", handleIncomeLayoutEnd);
                        debugLog("BudgetCategoriesAndValues", "Income Meta-Grid layout completed via timeout fallback");
                        checkAllLayoutsComplete();
                    }
                }, 300);
            }
        }
        else {
            checkAllLayoutsComplete();
        }
    }
    catch (error) {
        errorLog("BudgetCategoriesAndValues", "Failed to update layout after months change", error);
        // Auch bei Fehlern das Event emittieren, damit Loading beendet wird
        emit("muuriReady");
    }
}
// Auto-Expand bei Drag-Over
function setupAutoExpand() {
    document.addEventListener("dragover", handleDragOverGroup);
}
function handleDragOverGroup(event) {
    const target = event.target;
    const groupHeader = target.closest(".group-header");
    if (groupHeader) {
        const groupWrapper = groupHeader.closest(".group-wrapper");
        const groupId = groupWrapper?.getAttribute("data-group-id");
        if (groupId && !categoryStore.expandedCategoryGroups.has(groupId)) {
            clearAutoExpandTimer();
            autoExpandTimer.value = setTimeout(() => {
                categoryStore.toggleCategoryGroupExpanded(groupId);
                nextTick(() => {
                    updateLayoutAfterToggle();
                });
            }, 1000);
        }
    }
}
function clearAutoExpandTimer() {
    if (autoExpandTimer.value) {
        clearTimeout(autoExpandTimer.value);
        autoExpandTimer.value = null;
    }
    document.removeEventListener("dragover", handleDragOverGroup);
}
// Drag & Drop Persistierung für Kategorien
function handleCategoryDragEnd(item) {
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    sortOrderUpdateTimer.value = setTimeout(async () => {
        try {
            const draggedElement = item.getElement();
            const categoryId = draggedElement.getAttribute("data-category-id");
            if (!categoryId) {
                errorLog("BudgetCategoriesAndValues", "handleCategoryDragEnd - Category ID not found");
                return;
            }
            const container = draggedElement.closest(".categories-content");
            const groupWrapper = container?.closest(".group-wrapper");
            const actualGroupId = groupWrapper?.getAttribute("data-group-id");
            if (!actualGroupId) {
                errorLog("BudgetCategoriesAndValues", "handleCategoryDragEnd - Group ID not found");
                return;
            }
            // Bestimme das richtige Sub-Grid
            const allSubGrids = [...expenseSubGrids.value, ...incomeSubGrids.value];
            const targetGrid = allSubGrids.find((grid) => {
                const gridElement = grid.getElement();
                return (gridElement
                    .closest(".group-wrapper")
                    ?.getAttribute("data-group-id") === actualGroupId);
            });
            if (!targetGrid) {
                errorLog("BudgetCategoriesAndValues", "handleCategoryDragEnd - Target grid not found", { actualGroupId });
                return;
            }
            const items = targetGrid.getItems();
            const newOrder = [];
            items.forEach((item) => {
                const element = item.getElement();
                const id = element.getAttribute("data-category-id");
                if (id)
                    newOrder.push(id);
            });
            debugLog("BudgetCategoriesAndValues", "handleCategoryDragEnd", {
                categoryId,
                actualGroupId,
                newOrder,
                itemsCount: items.length,
                draggedItemPosition: newOrder.indexOf(categoryId),
            });
            const sortOrderUpdates = CategoryService.calculateCategorySortOrder(actualGroupId, newOrder);
            const success = await CategoryService.updateCategoriesWithSortOrder(sortOrderUpdates);
            if (success) {
                debugLog("BudgetCategoriesAndValues", "handleCategoryDragEnd - Sort order updated successfully");
                await reinitializeMuuriGrids();
            }
            else {
                errorLog("BudgetCategoriesAndValues", "handleCategoryDragEnd - Failed to update sort order");
            }
        }
        catch (error) {
            errorLog("BudgetCategoriesAndValues", "handleCategoryDragEnd - Error updating sort order", error);
        }
    }, SORT_ORDER_DEBOUNCE_DELAY);
}
// Drag & Drop Persistierung für CategoryGroups
function handleCategoryGroupDragEnd(item, isIncomeGrid) {
    if (sortOrderUpdateTimer.value) {
        clearTimeout(sortOrderUpdateTimer.value);
    }
    sortOrderUpdateTimer.value = setTimeout(async () => {
        try {
            const draggedElement = item.getElement();
            const groupId = draggedElement.getAttribute("data-group-id");
            if (!groupId) {
                errorLog("BudgetCategoriesAndValues", "handleCategoryGroupDragEnd - Group ID not found");
                return;
            }
            const metaGrid = isIncomeGrid
                ? incomeMetaGrid.value
                : expenseMetaGrid.value;
            if (!metaGrid) {
                errorLog("BudgetCategoriesAndValues", "handleCategoryGroupDragEnd - Meta grid not found");
                return;
            }
            const items = metaGrid.getItems();
            const groupsInOrder = [];
            items.forEach((item) => {
                const element = item.getElement();
                const id = element.getAttribute("data-group-id");
                if (id)
                    groupsInOrder.push(id);
            });
            debugLog("BudgetCategoriesAndValues", "handleCategoryGroupDragEnd", {
                groupId,
                groupsInOrder,
                isIncomeGrid,
                draggedGroupPosition: groupsInOrder.indexOf(groupId),
            });
            const sortOrderUpdates = CategoryService.calculateCategoryGroupSortOrder(groupsInOrder, isIncomeGrid);
            const success = await CategoryService.updateCategoryGroupsWithSortOrder(sortOrderUpdates);
            if (success) {
                debugLog("BudgetCategoriesAndValues", "handleCategoryGroupDragEnd - Sort order updated successfully");
                await reinitializeMuuriGrids();
            }
            else {
                errorLog("BudgetCategoriesAndValues", "handleCategoryGroupDragEnd - Failed to update sort order");
            }
        }
        catch (error) {
            errorLog("BudgetCategoriesAndValues", "handleCategoryGroupDragEnd - Error updating sort order", error);
        }
    }, SORT_ORDER_DEBOUNCE_DELAY);
}
// UI-Refresh-Funktionen
async function reinitializeMuuriGrids() {
    try {
        debugLog("BudgetCategoriesAndValues", "reinitializeMuuriGrids - Starting grid reinitialization");
        destroyGrids();
        await nextTick();
        initializeGrids();
        debugLog("BudgetCategoriesAndValues", "reinitializeMuuriGrids - Grid reinitialization completed");
    }
    catch (error) {
        errorLog("BudgetCategoriesAndValues", "reinitializeMuuriGrids - Error during grid reinitialization", error);
    }
}
// Context-Menu Funktionen
function openDropdown(event, cat, month) {
    event.preventDefault();
    const categoryData = getCategoryBudgetData(cat.id, month);
    const hasAvailableAmount = categoryData.saldo > 0;
    // Bei Einnahmenkategorien nur anzeigen, wenn Betrag verfügbar
    if (cat.isIncomeCategory && !hasAvailableAmount) {
        debugLog("BudgetCategoriesAndValues", "Context menu on income category without funds prevented.", { category: cat.name, saldo: categoryData.saldo });
        return;
    }
    // Dynamische Positionierung mit Viewport-Berücksichtigung
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuHeight = 120; // Geschätzte Höhe des Menüs (2 Buttons + Padding)
    let x = event.clientX;
    let y = event.clientY;
    // Viewport-Dimensionen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    // Horizontale Anpassung - Menü nach links verschieben wenn es rechts rausragen würde
    if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10; // 10px Puffer
    }
    // Vertikale Anpassung - Menü nach oben verschieben wenn es unten rausragen würde
    if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10; // 10px Puffer
    }
    // Mindestabstände einhalten
    x = Math.max(10, x); // Mindestens 10px vom linken Rand
    y = Math.max(10, y); // Mindestens 10px vom oberen Rand
    dropdownX.value = x;
    dropdownY.value = y;
    modalData.value = {
        mode: "transfer",
        clickedCategory: cat,
        amount: 0,
        month,
    };
    showDropdown.value = true;
    nextTick(() => dropdownRef.value?.focus());
    debugLog("BudgetCategoriesAndValues", "openDropdown", {
        category: cat,
        isIncomeCategory: cat.isIncomeCategory,
        hasAvailableAmount,
        saldo: categoryData.saldo,
        position: { x, y },
        viewport: { width: viewportWidth, height: viewportHeight },
    });
}
function closeDropdown() {
    showDropdown.value = false;
}
function onDropdownBlur(e) {
    const next = e.relatedTarget;
    if (!dropdownRef.value?.contains(next)) {
        closeDropdown();
    }
}
function optionTransfer() {
    if (!modalData.value?.clickedCategory || !modalData.value?.month)
        return;
    const cat = modalData.value.clickedCategory;
    const month = modalData.value.month;
    // Hole den aktuellen Saldo der Kategorie
    const categoryData = getCategoryBudgetData(cat.id, month);
    const currentSaldo = categoryData.saldo;
    // Setze den Betrag nur wenn der Saldo positiv ist
    const prefillAmount = currentSaldo > 0 ? currentSaldo : 0;
    // Alle Kategorien verwenden "transfer" Modus
    // Bei Einnahmen-Kategorien wird automatisch "Verfügbare Mittel" als Zielkategorie gesetzt
    modalData.value = {
        mode: "transfer",
        clickedCategory: cat,
        amount: prefillAmount,
        month,
    };
    debugLog("BudgetCategoriesAndValues", "optionTransfer", {
        category: cat,
        currentSaldo,
        prefillAmount,
        isIncomeCategory: cat.isIncomeCategory,
        mode: "transfer",
    });
    closeDropdown();
    showTransferModal.value = true;
}
function optionFill() {
    if (!modalData.value?.clickedCategory || !modalData.value?.month)
        return;
    const cat = modalData.value.clickedCategory;
    const month = modalData.value.month;
    const data = getCategoryBudgetData(cat.id, month);
    const amt = data.saldo < 0 ? Math.abs(data.saldo) : 0;
    modalData.value = { mode: "fill", clickedCategory: cat, amount: amt, month };
    debugLog("BudgetCategoriesAndValues", "optionFill", {
        category: cat,
        amount: amt,
    });
    closeDropdown();
    showTransferModal.value = true;
}
function executeTransfer() {
    showTransferModal.value = false;
    debugLog("BudgetCategoriesAndValues", "Transfer completed, modal closed");
}
// Transaction Modal Functions
function openTransactionModal(category, month) {
    transactionModalData.value = {
        categoryId: category.id,
        month: month,
    };
    showTransactionModal.value = true;
    debugLog("BudgetCategoriesAndValues", "Transaction modal opened", {
        categoryId: category.id,
        categoryName: category.name,
        month: month.label,
    });
}
function closeTransactionModal() {
    showTransactionModal.value = false;
    transactionModalData.value = null;
    debugLog("BudgetCategoriesAndValues", "Transaction modal closed");
}
// Planning Modal Functions
function openPlanningModal(category, month) {
    planningModalData.value = {
        categoryId: category.id,
        month,
    };
    showPlanningModal.value = true;
    debugLog("BudgetCategoriesAndValues", "Planning modal opened", {
        categoryId: category.id,
        categoryName: category.name,
        month: month.label,
    });
}
function closePlanningModal() {
    showPlanningModal.value = false;
    planningModalData.value = null;
    debugLog("BudgetCategoriesAndValues", "Planning modal closed");
}
function handleTransactionUpdated() {
    // Refresh budget data after transaction changes
    debugLog("BudgetCategoriesAndValues", "Transaction updated, refreshing budget data");
    // The reactive computed properties will automatically update
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({
    months: () => [],
});
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['categories-list']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['type-summary-values']} */ ;
/** @type {__VLS_StyleScopedClasses['group-summary-values']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['category-name-drag']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-dragging']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-releasing']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-dragging']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-releasing']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-item-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex flex-col h-full transform-gpu" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "dragContainer",
    ...{ class: "drag-container transform-gpu" },
    ...{ style: {} },
});
/** @type {typeof __VLS_ctx.dragContainer} */ ;
if (__VLS_ctx.expenseGroups.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sticky top-0 bg-base-200 px-0 py-2 border-b border-base-300 z-10" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "type-header-extended flex w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "type-part flex items-center pl-2" },
    });
    const __VLS_0 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
        icon: "mdi:trending-down",
        ...{ class: "w-4 h-4 mr-2 text-error" },
    }));
    const __VLS_2 = __VLS_1({
        icon: "mdi:trending-down",
        ...{ class: "w-4 h-4 mr-2 text-error" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-semibold text-sm text-base-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "type-values-part flex" },
    });
    for (const [month] of __VLS_getVForSourceType((__VLS_ctx.months))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (month.key),
            ...{ class: "month-column flex-1 min-w-[120px] p-1 border-base-300" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "type-summary-values grid grid-cols-4 gap-1 text-xs font-bold mr-[4%]" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_4 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).budgeted),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }));
        const __VLS_5 = __VLS_4({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).budgeted),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_4));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).forecast),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }));
        const __VLS_8 = __VLS_7({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).forecast),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_10 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).spent),
            asInteger: (true),
            showZero: (false),
            ...{ class: (__VLS_ctx.calculateTypeSummary(false, month).spent >= 0
                    ? 'text-base-content'
                    : 'text-error') },
        }));
        const __VLS_11 = __VLS_10({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).spent),
            asInteger: (true),
            showZero: (false),
            ...{ class: (__VLS_ctx.calculateTypeSummary(false, month).spent >= 0
                    ? 'text-base-content'
                    : 'text-error') },
        }, ...__VLS_functionalComponentArgsRest(__VLS_10));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).saldo),
            asInteger: (true),
            showZero: (false),
        }));
        const __VLS_14 = __VLS_13({
            amount: (__VLS_ctx.calculateTypeSummary(false, month).saldo),
            asInteger: (true),
            showZero: (false),
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muuri-container bg-base-100 p-4 transform-gpu" },
        id: "expense-categories",
        ...{ style: {} },
    });
    for (const [group] of __VLS_getVForSourceType((__VLS_ctx.expenseGroups))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (group.id),
            ...{ class: "group-wrapper" },
            'data-group-id': (group.id),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "category-group-row border-b border-base-300" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-header-extended flex w-full bg-base-200 border-b border-t border-base-300 hover:bg-base-50 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-part flex items-center border-r border-base-300 py-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100" },
        });
        const __VLS_16 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
            icon: "mdi:drag-vertical",
            ...{ class: "w-4 h-4 text-base-content/60" },
        }));
        const __VLS_18 = __VLS_17({
            icon: "mdi:drag-vertical",
            ...{ class: "w-4 h-4 text-base-content/60" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-shrink-0 mr-2" },
        });
        const __VLS_20 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
            icon: (__VLS_ctx.getGroupIcon(group)),
            ...{ class: (`w-4 h-4 ${__VLS_ctx.getGroupColor(group)}`) },
        }));
        const __VLS_22 = __VLS_21({
            icon: (__VLS_ctx.getGroupIcon(group)),
            ...{ class: (`w-4 h-4 ${__VLS_ctx.getGroupColor(group)}`) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.expenseGroups.length > 0))
                        return;
                    __VLS_ctx.toggleGroup(group.id);
                } },
            ...{ class: "flex-grow" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "font-semibold text-sm text-base-content" },
        });
        (group.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-values-part flex" },
        });
        for (const [month] of __VLS_getVForSourceType((__VLS_ctx.months))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (month.key),
                ...{ class: "month-column flex-1 min-w-[120px] py-2 px-1 border-r border-base-300" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "group-summary-values grid grid-cols-4 gap-1 text-xs font-semibold mr-[4%]" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_24 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).budgeted),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }));
            const __VLS_25 = __VLS_24({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).budgeted),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_24));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_27 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).forecast),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }));
            const __VLS_28 = __VLS_27({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).forecast),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_27));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_30 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).spent),
                asInteger: (true),
                showZero: (false),
                ...{ class: (__VLS_ctx.calculateGroupSummary(group.id, month).spent >= 0
                        ? 'text-base-content'
                        : 'text-error') },
            }));
            const __VLS_31 = __VLS_30({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).spent),
                asInteger: (true),
                showZero: (false),
                ...{ class: (__VLS_ctx.calculateGroupSummary(group.id, month).spent >= 0
                        ? 'text-base-content'
                        : 'text-error') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_30));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).saldo),
                asInteger: (true),
                showZero: (false),
            }));
            const __VLS_34 = __VLS_33({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).saldo),
                asInteger: (true),
                showZero: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "categories-list" },
            ...{ class: ({
                    collapsed: !__VLS_ctx.categoryStore.expandedCategoryGroups.has(group.id),
                }) },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.categoryStore.expandedCategoryGroups.has(group.id)) }, null, null);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "categories-content" },
        });
        for (const [category] of __VLS_getVForSourceType((__VLS_ctx.getVisibleCategoriesForGroup(group.id)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (category.id),
                ...{ class: "category-item-extended" },
                'data-category-id': (category.id),
                'data-group-id': (group.id),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex w-full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "category-part flex items-center p-0 pl-8 bg-base-50 border-b border-r border-base-300 hover:bg-base-100 cursor-pointer" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "category-drag-area flex items-center flex-grow" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100" },
            });
            const __VLS_36 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
                icon: "mdi:drag-vertical",
                ...{ class: "w-3 h-3 text-base-content/60" },
            }));
            const __VLS_38 = __VLS_37({
                icon: "mdi:drag-vertical",
                ...{ class: "w-3 h-3 text-base-content/60" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            if (category.icon) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex-shrink-0 mr-2" },
                });
                const __VLS_40 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                    icon: (category.icon),
                    ...{ class: "w-3 h-3 text-base-content/70" },
                }));
                const __VLS_42 = __VLS_41({
                    icon: (category.icon),
                    ...{ class: "w-3 h-3 text-base-content/70" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-grow category-name-drag" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-xs text-base-content" },
            });
            (category.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-shrink-0 flex items-center space-x-2" },
            });
            if (category.isSavingsGoal &&
                category.targetAmount &&
                category.goalDate) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center space-x-2" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex flex-col w-full mr-1 items-center" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "badge badge-xs badge-primary badge-soft text-xs w-full" },
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_44 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (category.targetAmount),
                    showSign: (false),
                    asInteger: (true),
                    ...{ class: "mr-0" },
                }));
                const __VLS_45 = __VLS_44({
                    amount: (category.targetAmount),
                    showSign: (false),
                    asInteger: (true),
                    ...{ class: "mr-0" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_44));
                (new Date(category.goalDate).toLocaleDateString("de-DE", { month: "2-digit", year: "2-digit" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.progress, __VLS_intrinsicElements.progress)({
                    ...{ class: "progress progress-primary w-28 mt-1" },
                    value: (__VLS_ctx.getSavingsGoalProgress(category)),
                    max: "100",
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center space-x-1" },
                });
                if (category.isSavingsGoal) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "w-2 h-2 bg-info rounded-full" },
                        title: "Sparziel",
                    });
                }
                if (!category.isActive) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "w-2 h-2 bg-warning rounded-full" },
                        title: "Inaktiv",
                    });
                }
                if (category.isHidden) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "w-2 h-2 bg-base-content/30 rounded-full" },
                        title: "Versteckt",
                    });
                }
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "values-part flex" },
            });
            for (const [month] of __VLS_getVForSourceType((__VLS_ctx.months))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (month.key),
                    ...{ class: "month-column flex-1 min-w-[120px] p-[3px] border-b border-r border-base-300" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "budget-values grid grid-cols-4 gap-1 text-xs mr-[4%]" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            __VLS_ctx.handleBudgetClick(category.id, month.key);
                        } },
                    ...{ class: "text-right transition-all duration-200 rounded px-1 py-0.5 border" },
                    ...{ class: ({
                            'cursor-pointer border-transparent hover:border-primary': !__VLS_ctx.isEditingBudget(category.id, month.key),
                            'border-transparent': __VLS_ctx.isEditingBudget(category.id, month.key),
                        }) },
                });
                if (__VLS_ctx.isEditingBudget(category.id, month.key)) {
                    /** @type {[typeof CalculatorInput, ]} */ ;
                    // @ts-ignore
                    const __VLS_47 = __VLS_asFunctionalComponent(CalculatorInput, new CalculatorInput({
                        ...{ 'onUpdate:modelValue': {} },
                        ...{ 'onFinish': {} },
                        ...{ 'onFocusNext': {} },
                        ...{ 'onFocusPrevious': {} },
                        modelValue: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                            .budgeted),
                        isActive: (true),
                        fieldKey: (`${category.id}-${month.key}`),
                    }));
                    const __VLS_48 = __VLS_47({
                        ...{ 'onUpdate:modelValue': {} },
                        ...{ 'onFinish': {} },
                        ...{ 'onFocusNext': {} },
                        ...{ 'onFocusPrevious': {} },
                        modelValue: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                            .budgeted),
                        isActive: (true),
                        fieldKey: (`${category.id}-${month.key}`),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
                    let __VLS_50;
                    let __VLS_51;
                    let __VLS_52;
                    const __VLS_53 = {
                        'onUpdate:modelValue': (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            if (!(__VLS_ctx.isEditingBudget(category.id, month.key)))
                                return;
                            __VLS_ctx.handleBudgetUpdate(category.id, month.key, $event);
                        }
                    };
                    const __VLS_54 = {
                        onFinish: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            if (!(__VLS_ctx.isEditingBudget(category.id, month.key)))
                                return;
                            __VLS_ctx.handleBudgetFinish(category.id, month.key);
                        }
                    };
                    const __VLS_55 = {
                        onFocusNext: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            if (!(__VLS_ctx.isEditingBudget(category.id, month.key)))
                                return;
                            __VLS_ctx.handleFocusNext(category.id, month.key);
                        }
                    };
                    const __VLS_56 = {
                        onFocusPrevious: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            if (!(__VLS_ctx.isEditingBudget(category.id, month.key)))
                                return;
                            __VLS_ctx.handleFocusPrevious(category.id, month.key);
                        }
                    };
                    var __VLS_49;
                }
                else {
                    /** @type {[typeof CurrencyDisplay, ]} */ ;
                    // @ts-ignore
                    const __VLS_57 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                        ...{ 'onClick': {} },
                        amount: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                            .budgeted),
                        asInteger: (true),
                        showZero: (false),
                        ...{ class: "text-base-content/80" },
                    }));
                    const __VLS_58 = __VLS_57({
                        ...{ 'onClick': {} },
                        amount: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                            .budgeted),
                        asInteger: (true),
                        showZero: (false),
                        ...{ class: "text-base-content/80" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
                    let __VLS_60;
                    let __VLS_61;
                    let __VLS_62;
                    const __VLS_63 = {
                        onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            if (!!(__VLS_ctx.isEditingBudget(category.id, month.key)))
                                return;
                            __VLS_ctx.handleBudgetClick(category.id, month.key);
                        }
                    };
                    var __VLS_59;
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            __VLS_ctx.openPlanningModal(category, month);
                        } },
                    ...{ class: "text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors" },
                    title: "Klicken um Planungen anzuzeigen",
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_64 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                        .forecast),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-base-content/80" },
                }));
                const __VLS_65 = __VLS_64({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                        .forecast),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-base-content/80" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_64));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            __VLS_ctx.openTransactionModal(category, month);
                        } },
                    ...{ class: "text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors" },
                    title: "Klicken um Transaktionen anzuzeigen",
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_67 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).spent),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-error" },
                }));
                const __VLS_68 = __VLS_67({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).spent),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-error" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_67));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onContextmenu: (...[$event]) => {
                            if (!(__VLS_ctx.expenseGroups.length > 0))
                                return;
                            __VLS_ctx.openDropdown($event, category, month);
                        } },
                    ...{ class: "text-right py-0.5" },
                    ...{ class: ({
                            'cursor-context-menu hover:bg-base-200': !category.isIncomeCategory ||
                                __VLS_ctx.getCategoryBudgetData(category.id, month)
                                    .saldo > 0,
                        }) },
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_70 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).saldo),
                    asInteger: (true),
                    showZero: (false),
                }));
                const __VLS_71 = __VLS_70({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).saldo),
                    asInteger: (true),
                    showZero: (false),
                }, ...__VLS_functionalComponentArgsRest(__VLS_70));
            }
        }
    }
}
if (__VLS_ctx.incomeGroups.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 border-b border-t border-base-300 mt-3" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sticky top-0 bg-base-200 px-0 py-3 border-b border-r border-base-300 z-10" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "type-header-extended flex w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "type-part flex items-center pl-2" },
    });
    const __VLS_73 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_74 = __VLS_asFunctionalComponent(__VLS_73, new __VLS_73({
        icon: "mdi:trending-up",
        ...{ class: "w-4 h-4 mr-2 text-success" },
    }));
    const __VLS_75 = __VLS_74({
        icon: "mdi:trending-up",
        ...{ class: "w-4 h-4 mr-2 text-success" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_74));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-semibold text-sm text-base-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "type-values-part flex" },
    });
    for (const [month] of __VLS_getVForSourceType((__VLS_ctx.months))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (month.key),
            ...{ class: "month-column flex-1 min-w-[120px] p-0 px-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "type-summary-values grid grid-cols-4 gap-1 text-xs font-bold mr-[4%]" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right opacity-0" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(true, month).forecast),
            asInteger: (true),
            showZero: (false),
        }));
        const __VLS_78 = __VLS_77({
            amount: (__VLS_ctx.calculateTypeSummary(true, month).forecast),
            asInteger: (true),
            showZero: (false),
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_80 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(true, month).spent),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }));
        const __VLS_81 = __VLS_80({
            amount: (__VLS_ctx.calculateTypeSummary(true, month).spent),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_80));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-right" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_83 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (__VLS_ctx.calculateTypeSummary(true, month).saldo),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }));
        const __VLS_84 = __VLS_83({
            amount: (__VLS_ctx.calculateTypeSummary(true, month).saldo),
            asInteger: (true),
            showZero: (false),
            ...{ class: "text-base-content" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "muuri-container bg-base-100 p-4 transform-gpu" },
        id: "income-categories",
        ...{ style: {} },
    });
    for (const [group] of __VLS_getVForSourceType((__VLS_ctx.incomeGroups))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (group.id),
            ...{ class: "group-wrapper" },
            'data-group-id': (group.id),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "category-group-row border-b border-base-300" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-header-extended flex w-full py-0 bg-base-200 border-b border-t border-base-300 hover:bg-base-50 cursor-pointer" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-part flex items-center border-r border-base-300 py-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100" },
        });
        const __VLS_86 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
            icon: "mdi:drag-vertical",
            ...{ class: "w-4 h-4 text-base-content/60" },
        }));
        const __VLS_88 = __VLS_87({
            icon: "mdi:drag-vertical",
            ...{ class: "w-4 h-4 text-base-content/60" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_87));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex-shrink-0 mr-2" },
        });
        const __VLS_90 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
            icon: (__VLS_ctx.getGroupIcon(group)),
            ...{ class: (`w-4 h-4 ${__VLS_ctx.getGroupColor(group)}`) },
        }));
        const __VLS_92 = __VLS_91({
            icon: (__VLS_ctx.getGroupIcon(group)),
            ...{ class: (`w-4 h-4 ${__VLS_ctx.getGroupColor(group)}`) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_91));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.incomeGroups.length > 0))
                        return;
                    __VLS_ctx.toggleGroup(group.id);
                } },
            ...{ class: "flex-grow" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h4, __VLS_intrinsicElements.h4)({
            ...{ class: "font-semibold text-sm text-base-content" },
        });
        (group.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "group-values-part flex" },
        });
        for (const [month] of __VLS_getVForSourceType((__VLS_ctx.months))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (month.key),
                ...{ class: "month-column flex-1 min-w-[120px] py-2 px-1 border-r border-base-300" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "group-summary-values grid grid-cols-4 gap-1 text-xs font-semibold mr-[4%]" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right opacity-0" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_94 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).forecast),
                asInteger: (true),
                showZero: (false),
            }));
            const __VLS_95 = __VLS_94({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).forecast),
                asInteger: (true),
                showZero: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_94));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_97 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).spent),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }));
            const __VLS_98 = __VLS_97({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).spent),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_97));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "text-right" },
            });
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_100 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).saldo),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }));
            const __VLS_101 = __VLS_100({
                amount: (__VLS_ctx.calculateGroupSummary(group.id, month).saldo),
                asInteger: (true),
                showZero: (false),
                ...{ class: "text-base-content" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_100));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "categories-list" },
            ...{ class: ({
                    collapsed: !__VLS_ctx.categoryStore.expandedCategoryGroups.has(group.id),
                }) },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.categoryStore.expandedCategoryGroups.has(group.id)) }, null, null);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "categories-content" },
        });
        for (const [category] of __VLS_getVForSourceType((__VLS_ctx.getVisibleCategoriesForGroup(group.id)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (category.id),
                ...{ class: "category-item-extended" },
                'data-category-id': (category.id),
                'data-group-id': (group.id),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex w-full" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "category-part flex items-center p-0 pl-8 bg-base-50 border-b border-r border-base-300 hover:bg-base-100 cursor-pointer" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "category-drag-area flex items-center flex-grow" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "category-drag-handle flex-shrink-0 mr-2 opacity-50 hover:opacity-100" },
            });
            const __VLS_103 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_104 = __VLS_asFunctionalComponent(__VLS_103, new __VLS_103({
                icon: "mdi:drag-vertical",
                ...{ class: "w-3 h-3 text-base-content/60" },
            }));
            const __VLS_105 = __VLS_104({
                icon: "mdi:drag-vertical",
                ...{ class: "w-3 h-3 text-base-content/60" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_104));
            if (category.icon) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex-shrink-0 mr-2" },
                });
                const __VLS_107 = {}.Icon;
                /** @type {[typeof __VLS_components.Icon, ]} */ ;
                // @ts-ignore
                const __VLS_108 = __VLS_asFunctionalComponent(__VLS_107, new __VLS_107({
                    icon: (category.icon),
                    ...{ class: "w-3 h-3 text-base-content/70" },
                }));
                const __VLS_109 = __VLS_108({
                    icon: (category.icon),
                    ...{ class: "w-3 h-3 text-base-content/70" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_108));
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-grow category-name-drag" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-xs text-base-content" },
            });
            (category.name);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "flex-shrink-0 flex items-center space-x-2" },
            });
            if (category.isSavingsGoal &&
                category.targetAmount &&
                category.goalDate) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center space-x-2" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "badge badge-primary badge-soft text-xs" },
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_111 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (category.targetAmount),
                    showSign: (false),
                    asInteger: (true),
                    ...{ class: "mr-1" },
                }));
                const __VLS_112 = __VLS_111({
                    amount: (category.targetAmount),
                    showSign: (false),
                    asInteger: (true),
                    ...{ class: "mr-1" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_111));
                (new Date(category.goalDate).toLocaleDateString("de-DE", { month: "2-digit", year: "2-digit" }));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.progress, __VLS_intrinsicElements.progress)({
                    ...{ class: "progress progress-primary w-16" },
                    value: (__VLS_ctx.getSavingsGoalProgress(category)),
                    max: "100",
                });
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "flex items-center space-x-1" },
                });
                if (category.isSavingsGoal) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "w-2 h-2 bg-info rounded-full" },
                        title: "Sparziel",
                    });
                }
                if (!category.isActive) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "w-2 h-2 bg-warning rounded-full" },
                        title: "Inaktiv",
                    });
                }
                if (category.isHidden) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "w-2 h-2 bg-base-content/30 rounded-full" },
                        title: "Versteckt",
                    });
                }
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "values-part flex" },
            });
            for (const [month] of __VLS_getVForSourceType((__VLS_ctx.months))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (month.key),
                    ...{ class: "month-column flex-1 min-w-[120px] p-1 border-b border-r border-base-300" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "budget-values grid grid-cols-4 gap-1 text-xs mr-[4%]" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "text-right opacity-0" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.incomeGroups.length > 0))
                                return;
                            __VLS_ctx.openPlanningModal(category, month);
                        } },
                    ...{ class: "text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors" },
                    title: "Klicken um Planungen anzuzeigen",
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_114 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                        .forecast),
                    asInteger: (true),
                    showZero: (false),
                }));
                const __VLS_115 = __VLS_114({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month)
                        .forecast),
                    asInteger: (true),
                    showZero: (false),
                }, ...__VLS_functionalComponentArgsRest(__VLS_114));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.incomeGroups.length > 0))
                                return;
                            __VLS_ctx.openTransactionModal(category, month);
                        } },
                    ...{ class: "text-right cursor-pointer hover:bg-base-200 rounded px-1 py-0.5 transition-colors" },
                    title: "Klicken um Transaktionen anzuzeigen",
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_117 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).spent),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-base-content/80" },
                }));
                const __VLS_118 = __VLS_117({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).spent),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-base-content/80" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_117));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ onContextmenu: (...[$event]) => {
                            if (!(__VLS_ctx.incomeGroups.length > 0))
                                return;
                            __VLS_ctx.openDropdown($event, category, month);
                        } },
                    ...{ class: "text-right py-0.5" },
                    ...{ class: ({
                            'cursor-context-menu hover:bg-base-200': __VLS_ctx.getCategoryBudgetData(category.id, month)
                                .saldo > 0,
                        }) },
                });
                /** @type {[typeof CurrencyDisplay, ]} */ ;
                // @ts-ignore
                const __VLS_120 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).saldo),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-base-content/80" },
                }));
                const __VLS_121 = __VLS_120({
                    amount: (__VLS_ctx.getCategoryBudgetData(category.id, month).saldo),
                    asInteger: (true),
                    showZero: (false),
                    ...{ class: "text-base-content/80" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_120));
            }
        }
    }
}
if (__VLS_ctx.expenseGroups.length === 0 && __VLS_ctx.incomeGroups.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex-1 flex items-center justify-center p-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "text-center text-base-content/60" },
    });
    const __VLS_123 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_124 = __VLS_asFunctionalComponent(__VLS_123, new __VLS_123({
        icon: "mdi:folder-outline",
        ...{ class: "w-12 h-12 mx-auto mb-3" },
    }));
    const __VLS_125 = __VLS_124({
        icon: "mdi:folder-outline",
        ...{ class: "w-12 h-12 mx-auto mb-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_124));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-sm font-medium" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-xs mt-1" },
    });
}
if (__VLS_ctx.showDropdown) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ onKeydown: (__VLS_ctx.closeDropdown) },
        ...{ onBlur: (__VLS_ctx.onDropdownBlur) },
        ref: "dropdownRef",
        tabindex: "0",
        ...{ class: "fixed z-40 menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-56" },
        ...{ style: (`left: ${__VLS_ctx.dropdownX}px; top: ${__VLS_ctx.dropdownY}px;`) },
    });
    /** @type {typeof __VLS_ctx.dropdownRef} */ ;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
        ...{ class: "menu-title" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    if (__VLS_ctx.modalData?.clickedCategory &&
        !__VLS_ctx.modalData.clickedCategory.isIncomeCategory) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
            ...{ onClick: (__VLS_ctx.optionFill) },
        });
        const __VLS_127 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_128 = __VLS_asFunctionalComponent(__VLS_127, new __VLS_127({
            icon: "mdi:arrow-collapse-right",
            ...{ class: "text-lg" },
        }));
        const __VLS_129 = __VLS_128({
            icon: "mdi:arrow-collapse-right",
            ...{ class: "text-lg" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_128));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
        ...{ onClick: (__VLS_ctx.optionTransfer) },
    });
    const __VLS_131 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_132 = __VLS_asFunctionalComponent(__VLS_131, new __VLS_131({
        icon: "mdi:arrow-expand-right",
        ...{ class: "text-lg" },
    }));
    const __VLS_133 = __VLS_132({
        icon: "mdi:arrow-expand-right",
        ...{ class: "text-lg" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_132));
}
if (__VLS_ctx.showTransferModal && __VLS_ctx.modalData && __VLS_ctx.modalData.month) {
    /** @type {[typeof CategoryTransferModal, ]} */ ;
    // @ts-ignore
    const __VLS_135 = __VLS_asFunctionalComponent(CategoryTransferModal, new CategoryTransferModal({
        ...{ 'onClose': {} },
        ...{ 'onTransfer': {} },
        isOpen: (__VLS_ctx.showTransferModal),
        month: (__VLS_ctx.modalData.month),
        mode: (__VLS_ctx.modalData.mode),
        prefillAmount: (__VLS_ctx.modalData.amount),
        preselectedCategoryId: (__VLS_ctx.modalData.clickedCategory?.id),
        isIncomeCategory: (__VLS_ctx.modalData.clickedCategory?.isIncomeCategory || false),
    }));
    const __VLS_136 = __VLS_135({
        ...{ 'onClose': {} },
        ...{ 'onTransfer': {} },
        isOpen: (__VLS_ctx.showTransferModal),
        month: (__VLS_ctx.modalData.month),
        mode: (__VLS_ctx.modalData.mode),
        prefillAmount: (__VLS_ctx.modalData.amount),
        preselectedCategoryId: (__VLS_ctx.modalData.clickedCategory?.id),
        isIncomeCategory: (__VLS_ctx.modalData.clickedCategory?.isIncomeCategory || false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_135));
    let __VLS_138;
    let __VLS_139;
    let __VLS_140;
    const __VLS_141 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.showTransferModal && __VLS_ctx.modalData && __VLS_ctx.modalData.month))
                return;
            __VLS_ctx.showTransferModal = false;
        }
    };
    const __VLS_142 = {
        onTransfer: (__VLS_ctx.executeTransfer)
    };
    var __VLS_137;
}
if (__VLS_ctx.showTransactionModal && __VLS_ctx.transactionModalData) {
    /** @type {[typeof CategoryTransactionModal, ]} */ ;
    // @ts-ignore
    const __VLS_143 = __VLS_asFunctionalComponent(CategoryTransactionModal, new CategoryTransactionModal({
        ...{ 'onClose': {} },
        ...{ 'onTransactionUpdated': {} },
        isOpen: (__VLS_ctx.showTransactionModal),
        categoryId: (__VLS_ctx.transactionModalData.categoryId),
        month: (__VLS_ctx.transactionModalData.month),
    }));
    const __VLS_144 = __VLS_143({
        ...{ 'onClose': {} },
        ...{ 'onTransactionUpdated': {} },
        isOpen: (__VLS_ctx.showTransactionModal),
        categoryId: (__VLS_ctx.transactionModalData.categoryId),
        month: (__VLS_ctx.transactionModalData.month),
    }, ...__VLS_functionalComponentArgsRest(__VLS_143));
    let __VLS_146;
    let __VLS_147;
    let __VLS_148;
    const __VLS_149 = {
        onClose: (__VLS_ctx.closeTransactionModal)
    };
    const __VLS_150 = {
        onTransactionUpdated: (__VLS_ctx.handleTransactionUpdated)
    };
    var __VLS_145;
}
if (__VLS_ctx.showPlanningModal && __VLS_ctx.planningModalData) {
    /** @type {[typeof CategoryPlanningModal, ]} */ ;
    // @ts-ignore
    const __VLS_151 = __VLS_asFunctionalComponent(CategoryPlanningModal, new CategoryPlanningModal({
        ...{ 'onClose': {} },
        isOpen: (__VLS_ctx.showPlanningModal),
        categoryId: (__VLS_ctx.planningModalData.categoryId),
        month: (__VLS_ctx.planningModalData.month),
    }));
    const __VLS_152 = __VLS_151({
        ...{ 'onClose': {} },
        isOpen: (__VLS_ctx.showPlanningModal),
        categoryId: (__VLS_ctx.planningModalData.categoryId),
        month: (__VLS_ctx.planningModalData.month),
    }, ...__VLS_functionalComponentArgsRest(__VLS_151));
    let __VLS_154;
    let __VLS_155;
    let __VLS_156;
    const __VLS_157 = {
        onClose: (__VLS_ctx.closePlanningModal)
    };
    var __VLS_153;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['drag-container']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['type-header-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['type-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['type-values-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['month-column']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['type-summary-values']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[4%]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-container']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['category-group-row']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['group-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['group-values-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['month-column']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['group-summary-values']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[4%]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['categories-list']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['categories-content']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['category-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['category-name-drag']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-0']} */ ;
/** @type {__VLS_StyleScopedClasses['progress']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-28']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-info']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-content/30']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['values-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['month-column']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-[3px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['budget-values']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[4%]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['border-transparent']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-context-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sticky']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['px-0']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['type-header-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['type-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-success']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['type-values-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['month-column']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['type-summary-values']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[4%]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['muuri-container']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['transform-gpu']} */ ;
/** @type {__VLS_StyleScopedClasses['group-wrapper']} */ ;
/** @type {__VLS_StyleScopedClasses['category-group-row']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['group-header-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['group-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['group-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['group-values-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['month-column']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['group-summary-values']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[4%]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['categories-list']} */ ;
/** @type {__VLS_StyleScopedClasses['collapsed']} */ ;
/** @type {__VLS_StyleScopedClasses['categories-content']} */ ;
/** @type {__VLS_StyleScopedClasses['category-item-extended']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['category-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['pl-8']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-50']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-area']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['category-drag-handle']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-100']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3']} */ ;
/** @type {__VLS_StyleScopedClasses['h-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['category-name-drag']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
/** @type {__VLS_StyleScopedClasses['progress']} */ ;
/** @type {__VLS_StyleScopedClasses['progress-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['w-16']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-info']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-warning']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-content/30']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['values-part']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['month-column']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['budget-values']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-[4%]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-colors']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-context-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
/** @type {__VLS_StyleScopedClasses['w-56']} */ ;
/** @type {__VLS_StyleScopedClasses['menu-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            CurrencyDisplay: CurrencyDisplay,
            CalculatorInput: CalculatorInput,
            CategoryTransferModal: CategoryTransferModal,
            CategoryTransactionModal: CategoryTransactionModal,
            CategoryPlanningModal: CategoryPlanningModal,
            getCategoryBudgetData: getCategoryBudgetData,
            calculateGroupSummary: calculateGroupSummary,
            calculateTypeSummary: calculateTypeSummary,
            dragContainer: dragContainer,
            categoryStore: categoryStore,
            getSavingsGoalProgress: getSavingsGoalProgress,
            showDropdown: showDropdown,
            dropdownX: dropdownX,
            dropdownY: dropdownY,
            dropdownRef: dropdownRef,
            showTransferModal: showTransferModal,
            modalData: modalData,
            showTransactionModal: showTransactionModal,
            transactionModalData: transactionModalData,
            showPlanningModal: showPlanningModal,
            planningModalData: planningModalData,
            expenseGroups: expenseGroups,
            incomeGroups: incomeGroups,
            getGroupIcon: getGroupIcon,
            getGroupColor: getGroupColor,
            getVisibleCategoriesForGroup: getVisibleCategoriesForGroup,
            isEditingBudget: isEditingBudget,
            handleBudgetUpdate: handleBudgetUpdate,
            handleBudgetFinish: handleBudgetFinish,
            handleBudgetClick: handleBudgetClick,
            handleFocusNext: handleFocusNext,
            handleFocusPrevious: handleFocusPrevious,
            toggleGroup: toggleGroup,
            openDropdown: openDropdown,
            closeDropdown: closeDropdown,
            onDropdownBlur: onDropdownBlur,
            optionTransfer: optionTransfer,
            optionFill: optionFill,
            executeTransfer: executeTransfer,
            openTransactionModal: openTransactionModal,
            closeTransactionModal: closeTransactionModal,
            openPlanningModal: openPlanningModal,
            closePlanningModal: closePlanningModal,
            handleTransactionUpdated: handleTransactionUpdated,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
