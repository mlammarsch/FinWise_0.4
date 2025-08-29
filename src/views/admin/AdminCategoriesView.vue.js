import { ref, computed, onMounted, onUnmounted } from "vue";
import { CategoryService } from "../../services/CategoryService";
import { BalanceService } from "../../services/BalanceService";
import { useTransactionStore } from "../../stores/transactionStore";
import CategoryForm from "../../components/budget/CategoryForm.vue";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay.vue";
import ConfirmationModal from "../../components/ui/ConfirmationModal.vue";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import TextInput from "../../components/ui/TextInput.vue";
import CalculatorInput from "../../components/ui/CalculatorInput.vue";
import { Icon } from "@iconify/vue";
// Helper
const isVerfuegbareMittel = (cat) => cat?.name?.trim()?.toLowerCase() === "verfügbare mittel";
const categorySortCriteria = ref([
    { field: "group", direction: "asc" },
    { field: "name", direction: "asc" },
]);
// Sortierung für Lebensbereiche
const groupSortField = ref("name");
const groupSortDirection = ref("asc");
// Suchfunktionalität
const searchQuery = ref("");
// Gefilterte und sortierte Daten mit Mehrfachsortierung
const categories = computed(() => {
    let filtered = CategoryService.getCategories().value.filter((c) => !isVerfuegbareMittel(c));
    // Filtern nach Suchbegriff
    if (searchQuery.value.trim() !== "") {
        filtered = filtered.filter((c) => c.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
    }
    return [...filtered].sort((a, b) => {
        for (const criteria of categorySortCriteria.value) {
            let aValue;
            let bValue;
            switch (criteria.field) {
                case "name":
                    aValue = a.name?.toLowerCase() || "";
                    bValue = b.name?.toLowerCase() || "";
                    break;
                case "group":
                    aValue = getGroupName(a.categoryGroupId).toLowerCase();
                    bValue = getGroupName(b.categoryGroupId).toLowerCase();
                    break;
                case "status":
                    aValue = a.isActive;
                    bValue = b.isActive;
                    break;
                case "monthlyAmount":
                    aValue = a.monthlyAmount || 0;
                    bValue = b.monthlyAmount || 0;
                    break;
                case "priority":
                    aValue = a.priority || 0;
                    bValue = b.priority || 0;
                    break;
                case "proportion":
                    aValue = a.proportion || 0;
                    bValue = b.proportion || 0;
                    break;
                case "savingsGoal":
                    aValue = a.isSavingsGoal || false;
                    bValue = b.isSavingsGoal || false;
                    break;
                default:
                    continue;
            }
            if (aValue < bValue) {
                return criteria.direction === "asc" ? -1 : 1;
            }
            if (aValue > bValue) {
                return criteria.direction === "asc" ? 1 : -1;
            }
            // Wenn gleich, weiter zur nächsten Sortierkriterium
        }
        return 0;
    });
});
const categoryGroups = computed(() => {
    const groups = CategoryService.getCategoryGroups().value;
    return [...groups].sort((a, b) => {
        let aValue;
        let bValue;
        switch (groupSortField.value) {
            case "name":
                aValue = a.name?.toLowerCase() || "";
                bValue = b.name?.toLowerCase() || "";
                break;
            case "type":
                aValue = a.isIncomeGroup;
                bValue = b.isIncomeGroup;
                break;
            default:
                return 0;
        }
        if (aValue < bValue) {
            return groupSortDirection.value === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
            return groupSortDirection.value === "asc" ? 1 : -1;
        }
        return 0;
    });
});
const filteredCategoryGroups = computed(() => {
    let groups = categoryGroups.value;
    // Filtern nach Suchbegriff
    if (searchQuery.value.trim() !== "") {
        groups = groups.filter((g) => g.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
    }
    return groups;
});
// Kategorie State
const showCategoryModal = ref(false);
const selectedCategory = ref(null);
const isEditMode = ref(false);
// Gruppe State
const showGroupModal = ref(false);
const groupName = ref("");
const groupSort = ref(0);
const groupIsIncome = ref(false);
const editingGroupId = ref(null);
// Confirmation Modal State
const showConfirmationModal = ref(false);
const confirmationTitle = ref("");
const confirmationMessage = ref("");
const confirmationAction = ref(null);
// Transaction Store für Prüfungen
const transactionStore = useTransactionStore();
// Inline Edit State
const activeEditField = ref(null); // Format: "categoryId-fieldName"
// Outside click handler für Edit-Felder
const handleOutsideClick = (event) => {
    if (activeEditField.value) {
        const target = event.target;
        // Prüfe ob der Klick außerhalb aller Input-Felder war
        const isInsideInput = target.closest('input') || target.closest('.editable-field');
        if (!isInsideInput) {
            activeEditField.value = null;
        }
    }
};
// Event-Listener für Outside-Clicks werden in den bestehenden onMounted/onUnmounted Hooks hinzugefügt
// Hilfsfunktionen zur Prüfung von Transaktions-Zuordnungen
const categoryHasTransactions = (categoryId) => {
    const transactions = transactionStore.getTransactionsByCategory(categoryId);
    return transactions.length > 0;
};
const categoryGroupHasCategories = (groupId) => {
    return categories.value.some((category) => category.categoryGroupId === groupId);
};
const categoryGroupHasTransactions = (groupId) => {
    return categories.value
        .filter((category) => category.categoryGroupId === groupId)
        .some((category) => categoryHasTransactions(category.id));
};
const canDeleteCategory = (category) => {
    // Prüfe auf Transaktionen
    return !categoryHasTransactions(category.id);
};
const canDeleteCategoryGroup = (groupId) => {
    // Prüfe auf zugeordnete Kategorien
    if (categoryGroupHasCategories(groupId))
        return false;
    // Prüfe auf Transaktionen in Kategorien der Gruppe
    return !categoryGroupHasTransactions(groupId);
};
// Confirmation Modal Funktionen
const showDeleteConfirmation = (title, message, action) => {
    confirmationTitle.value = title;
    confirmationMessage.value = message;
    confirmationAction.value = action;
    showConfirmationModal.value = true;
};
const handleConfirmation = async () => {
    if (confirmationAction.value) {
        await confirmationAction.value();
    }
    showConfirmationModal.value = false;
    confirmationAction.value = null;
};
const handleCancellation = () => {
    showConfirmationModal.value = false;
    confirmationAction.value = null;
};
// Kategorie-Aktionen
const editCategory = (category) => {
    selectedCategory.value = category;
    isEditMode.value = true;
    showCategoryModal.value = true;
};
const createCategory = () => {
    selectedCategory.value = null;
    isEditMode.value = false;
    showCategoryModal.value = true;
};
const saveCategory = async (categoryData) => {
    try {
        if (isEditMode.value && selectedCategory.value) {
            await CategoryService.updateCategory(selectedCategory.value.id, categoryData);
        }
        else {
            await CategoryService.addCategory(categoryData);
        }
        showCategoryModal.value = false;
    }
    catch (error) {
        console.error("Fehler beim Speichern der Kategorie:", error);
        alert("Fehler beim Speichern der Kategorie.");
    }
};
const deleteCategory = async (category) => {
    // Prüfe ob Kategorie gelöscht werden kann
    if (!canDeleteCategory(category)) {
        alert("Die Kategorie kann nicht gelöscht werden, da sie Buchungen zugeordnet hat.");
        return;
    }
    const action = async () => {
        try {
            const result = await CategoryService.deleteCategory(category.id);
            if (!result) {
                alert("Die Kategorie konnte nicht gelöscht werden.");
            }
        }
        catch (error) {
            console.error("Fehler beim Löschen der Kategorie:", error);
            alert("Fehler beim Löschen der Kategorie.");
        }
    };
    showDeleteConfirmation("Kategorie löschen", `Möchten Sie die Kategorie "${category.name}" wirklich löschen?`, action);
};
// Lebensbereiche-Aktionen
const createCategoryGroup = () => {
    editingGroupId.value = null;
    groupName.value = "";
    groupSort.value = categoryGroups.value?.length || 0;
    groupIsIncome.value = false;
    showGroupModal.value = true;
};
const editCategoryGroup = (groupId) => {
    const group = categoryGroups.value.find((g) => g.id === groupId);
    if (!group)
        return;
    editingGroupId.value = group.id;
    groupName.value = group.name;
    groupSort.value = group.sortOrder;
    groupIsIncome.value = group.isIncomeGroup;
    showGroupModal.value = true;
};
const saveCategoryGroup = async () => {
    try {
        if (editingGroupId.value) {
            await CategoryService.updateCategoryGroup(editingGroupId.value, {
                name: groupName.value,
                sortOrder: groupSort.value,
                isIncomeGroup: groupIsIncome.value,
            });
        }
        else {
            await CategoryService.addCategoryGroup({
                name: groupName.value,
                sortOrder: groupSort.value,
                isIncomeGroup: groupIsIncome.value,
            });
        }
        showGroupModal.value = false;
    }
    catch (error) {
        console.error("Fehler beim Speichern der Kategoriegruppe:", error);
        alert("Fehler beim Speichern der Kategoriegruppe.");
    }
};
const deleteCategoryGroup = async (groupId) => {
    const group = categoryGroups.value?.find((g) => g.id === groupId);
    if (!group)
        return;
    // Prüfe ob Kategoriegruppe gelöscht werden kann
    if (!canDeleteCategoryGroup(groupId)) {
        const hasCategories = categoryGroupHasCategories(groupId);
        const hasTransactions = categoryGroupHasTransactions(groupId);
        let message = "Die Kategoriegruppe kann nicht gelöscht werden, da sie ";
        if (hasCategories && hasTransactions) {
            message += "noch Kategorien mit Buchungen enthält.";
        }
        else if (hasCategories) {
            message += "noch Kategorien enthält.";
        }
        else if (hasTransactions) {
            message += "Kategorien mit Buchungen enthält.";
        }
        alert(message);
        return;
    }
    const action = async () => {
        try {
            const result = await CategoryService.deleteCategoryGroup(groupId);
            if (!result) {
                alert("Die Kategoriegruppe konnte nicht gelöscht werden.");
            }
        }
        catch (error) {
            console.error("Fehler beim Löschen der Kategoriegruppe:", error);
            alert("Fehler beim Löschen der Kategoriegruppe.");
        }
    };
    showDeleteConfirmation("Kategoriegruppe löschen", `Möchten Sie die Kategoriegruppe "${group.name}" wirklich löschen?`, action);
};
/**
 * Schaltet den aktiven Status einer Kategorie um
 */
const toggleCategoryStatus = async (category) => {
    try {
        const newStatus = !category.isActive;
        const success = await CategoryService.updateCategory(category.id, {
            isActive: newStatus,
        });
        if (success) {
            console.log(`Kategorie "${category.name}" Status geändert zu: ${newStatus ? "Aktiv" : "Inaktiv"}`);
        }
        else {
            console.error(`Fehler beim Ändern des Status von Kategorie "${category.name}"`);
        }
    }
    catch (error) {
        console.error(`Fehler beim Umschalten des Kategorie-Status für "${category.name}":`, error);
    }
};
/**
 * Schaltet den Sparziel-Status einer Kategorie um
 */
const toggleSavingsGoal = async (category) => {
    try {
        const newSavingsGoalStatus = !category.isSavingsGoal;
        const success = await CategoryService.updateCategory(category.id, {
            isSavingsGoal: newSavingsGoalStatus,
        });
        if (success) {
            console.log(`Kategorie "${category.name}" Sparziel-Status geändert zu: ${newSavingsGoalStatus ? "Aktiv" : "Inaktiv"}`);
        }
        else {
            console.error(`Fehler beim Ändern des Sparziel-Status von Kategorie "${category.name}"`);
        }
    }
    catch (error) {
        console.error(`Fehler beim Umschalten des Sparziel-Status für "${category.name}":`, error);
    }
};
// Update-Funktionen für Dropdowns
const updateCategoryGroup = async (category, newGroupId) => {
    // Prüfe, ob sich die Gruppe tatsächlich geändert hat
    if (category.categoryGroupId === newGroupId) {
        console.log(`Kategorie ${category.name} bleibt in derselben Gruppe ${newGroupId}`);
        return;
    }
    try {
        await CategoryService.updateCategory(category.id, {
            categoryGroupId: newGroupId,
        });
        console.log(`Kategorie ${category.name} erfolgreich zu Gruppe ${newGroupId} verschoben`);
    }
    catch (error) {
        console.error(`Fehler beim Verschieben von Kategorie ${category.name} zu Gruppe ${newGroupId}`, error);
    }
};
// Sortier-Handler für Kategorien mit Mehrfachsortierung
const sortCategories = (field, event) => {
    const isShiftPressed = event?.shiftKey || false;
    const existingIndex = categorySortCriteria.value.findIndex((c) => c.field === field);
    if (!isShiftPressed) {
        // Kein Shift: Alle Filter löschen und nur das geklickte Feld sortieren
        if (existingIndex >= 0 && categorySortCriteria.value.length === 1) {
            // Wenn nur dieses eine Feld sortiert ist, Richtung umkehren
            categorySortCriteria.value[0].direction =
                categorySortCriteria.value[0].direction === "asc" ? "desc" : "asc";
        }
        else {
            // Neue Sortierung nur mit diesem Feld
            categorySortCriteria.value = [{ field, direction: "asc" }];
        }
    }
    else {
        // Shift gedrückt: Bestehende Sortierung erweitern
        if (existingIndex >= 0) {
            // Feld bereits in Sortierung - Richtung umkehren
            categorySortCriteria.value[existingIndex].direction =
                categorySortCriteria.value[existingIndex].direction === "asc"
                    ? "desc"
                    : "asc";
        }
        else {
            // Neues Feld - an erste Stelle setzen
            categorySortCriteria.value.unshift({ field, direction: "asc" });
            // Maximal 3 Sortierkriterien behalten
            if (categorySortCriteria.value.length > 3) {
                categorySortCriteria.value = categorySortCriteria.value.slice(0, 3);
            }
        }
    }
};
// Sortier-Handler für Lebensbereiche
const sortCategoryGroups = (field) => {
    if (groupSortField.value === field) {
        groupSortDirection.value =
            groupSortDirection.value === "asc" ? "desc" : "asc";
    }
    else {
        groupSortField.value = field;
        groupSortDirection.value = "asc";
    }
};
// Helper für Sortier-Icon mit Mehrfachsortierung
const getSortIcon = (field) => {
    const criteria = categorySortCriteria.value.find((c) => c.field === field);
    if (!criteria)
        return "mdi:sort";
    return criteria.direction === "asc"
        ? "mdi:sort-ascending"
        : "mdi:sort-descending";
};
// Helper für Sortier-Priorität (zeigt Nummer bei Mehrfachsortierung)
const getSortPriority = (field) => {
    const index = categorySortCriteria.value.findIndex((c) => c.field === field);
    return index >= 0 ? index + 1 : null;
};
// Helper für Lebensbereiche-Sortier-Icon
const getGroupSortIcon = (field, currentField, currentDirection) => {
    if (field !== currentField)
        return "mdi:sort";
    return currentDirection === "asc"
        ? "mdi:sort-ascending"
        : "mdi:sort-descending";
};
// Helper
const getGroupName = (groupId) => {
    if (!groupId)
        return "Unbekannt";
    return CategoryService.getGroupName(groupId);
};
// Berechnet den aktuellen Saldo einer Kategorie basierend auf allen Transaktionen
const getCategoryBalance = (categoryId) => {
    return BalanceService.getTodayBalance("category", categoryId);
};
// Berechnet den Progress-Wert für Sparziele (Saldo / Sparziel * 100, max. 100)
const getSavingsGoalProgress = (category) => {
    if (!category.isSavingsGoal || !category.targetAmount || category.targetAmount <= 0) {
        return 0;
    }
    const currentBalance = getCategoryBalance(category.id);
    const progress = (currentBalance / category.targetAmount) * 100;
    // Ergebnis kann nie höher als 100 sein
    return Math.min(Math.max(progress, 0), 100);
};
// Inline Edit Functions
const isEditingField = (categoryId, fieldName) => {
    return activeEditField.value === `${categoryId}-${fieldName}`;
};
const handleFieldClick = (categoryId, fieldName, event) => {
    // Verhindere Event-Propagation
    event.stopPropagation();
    event.preventDefault();
    if (!isEditingField(categoryId, fieldName)) {
        activeEditField.value = `${categoryId}-${fieldName}`;
    }
};
const handleFieldFinish = (categoryId, fieldName) => {
    const fieldKey = `${categoryId}-${fieldName}`;
    if (activeEditField.value === fieldKey) {
        activeEditField.value = null;
    }
};
// Update Handler für Name-Feld
const handleNameUpdate = async (categoryId, newValue) => {
    // Sofort den Edit-Modus beenden für bessere UX
    handleFieldFinish(categoryId, 'name');
    // Validierung: Leerer Name nicht erlaubt
    if (!newValue.trim()) {
        console.warn(`Leerer Name für Kategorie ${categoryId} nicht erlaubt`);
        return;
    }
    try {
        const success = await CategoryService.updateCategory(categoryId, {
            name: newValue.trim()
        });
        if (!success) {
            console.error(`Fehler beim Aktualisieren des Namens für Kategorie ${categoryId}`);
        }
    }
    catch (error) {
        console.error(`Fehler beim Aktualisieren des Namens für Kategorie ${categoryId}:`, error);
    }
};
// Update Handler für Mtl. Beitrag
const handleMonthlyAmountUpdate = async (categoryId, newValue) => {
    // Sofort den Edit-Modus beenden für bessere UX
    handleFieldFinish(categoryId, 'monthlyAmount');
    try {
        const success = await CategoryService.updateCategory(categoryId, {
            monthlyAmount: newValue
        });
        if (!success) {
            console.error(`Fehler beim Aktualisieren des monatlichen Betrags für Kategorie ${categoryId}`);
        }
    }
    catch (error) {
        console.error(`Fehler beim Aktualisieren des monatlichen Betrags für Kategorie ${categoryId}:`, error);
    }
};
// Update Handler für Priorität
const handlePriorityUpdate = async (categoryId, newValue) => {
    // Sofort den Edit-Modus beenden für bessere UX
    handleFieldFinish(categoryId, 'priority');
    try {
        const success = await CategoryService.updateCategory(categoryId, {
            priority: Math.round(newValue) // Priorität als ganze Zahl
        });
        if (!success) {
            console.error(`Fehler beim Aktualisieren der Priorität für Kategorie ${categoryId}`);
        }
    }
    catch (error) {
        console.error(`Fehler beim Aktualisieren der Priorität für Kategorie ${categoryId}:`, error);
    }
};
// Update Handler für Anteil
const handleProportionUpdate = async (categoryId, newValue) => {
    // Sofort den Edit-Modus beenden für bessere UX
    handleFieldFinish(categoryId, 'proportion');
    try {
        const success = await CategoryService.updateCategory(categoryId, {
            proportion: newValue
        });
        if (!success) {
            console.error(`Fehler beim Aktualisieren des Anteils für Kategorie ${categoryId}`);
        }
    }
    catch (error) {
        console.error(`Fehler beim Aktualisieren des Anteils für Kategorie ${categoryId}:`, error);
    }
};
// Lifecycle Hooks
onMounted(() => {
    document.addEventListener('click', handleOutsideClick);
});
onUnmounted(() => {
    document.removeEventListener('click', handleOutsideClick);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    ...{ class: "text-xl font-bold flex-shrink-0" },
});
/** @type {[typeof SearchGroup, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(SearchGroup, new SearchGroup({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleRightClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddleRight: "Neue Gruppe",
    btnMiddleRightIcon: "mdi:folder-plus",
    btnRight: "Neue Kategorie",
    btnRightIcon: "mdi:plus",
}));
const __VLS_1 = __VLS_0({
    ...{ 'onSearch': {} },
    ...{ 'onBtnMiddleRightClick': {} },
    ...{ 'onBtnRightClick': {} },
    btnMiddleRight: "Neue Gruppe",
    btnMiddleRightIcon: "mdi:folder-plus",
    btnRight: "Neue Kategorie",
    btnRightIcon: "mdi:plus",
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onSearch: ((query) => (__VLS_ctx.searchQuery = query))
};
const __VLS_7 = {
    onBtnMiddleRightClick: (__VLS_ctx.createCategoryGroup)
};
const __VLS_8 = {
    onBtnRightClick: (__VLS_ctx.createCategory)
};
var __VLS_2;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300 mb-6" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "card-title text-lg mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('group');
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_9 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_10 = __VLS_asFunctionalComponent(__VLS_9, new __VLS_9({
    icon: (__VLS_ctx.getSortIcon('group')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_11 = __VLS_10({
    icon: (__VLS_ctx.getSortIcon('group')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_10));
if (__VLS_ctx.getSortPriority('group')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("group"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('name', $event);
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_13 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_14 = __VLS_asFunctionalComponent(__VLS_13, new __VLS_13({
    icon: (__VLS_ctx.getSortIcon('name')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_15 = __VLS_14({
    icon: (__VLS_ctx.getSortIcon('name')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_14));
if (__VLS_ctx.getSortPriority('name')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("name"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('monthlyAmount', $event);
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_17 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent(__VLS_17, new __VLS_17({
    icon: (__VLS_ctx.getSortIcon('monthlyAmount')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_19 = __VLS_18({
    icon: (__VLS_ctx.getSortIcon('monthlyAmount')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
if (__VLS_ctx.getSortPriority('monthlyAmount')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("monthlyAmount"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('priority', $event);
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_21 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({
    icon: (__VLS_ctx.getSortIcon('priority')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_23 = __VLS_22({
    icon: (__VLS_ctx.getSortIcon('priority')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
if (__VLS_ctx.getSortPriority('priority')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("priority"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('proportion', $event);
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_25 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent(__VLS_25, new __VLS_25({
    icon: (__VLS_ctx.getSortIcon('proportion')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_27 = __VLS_26({
    icon: (__VLS_ctx.getSortIcon('proportion')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_26));
if (__VLS_ctx.getSortPriority('proportion')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("proportion"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('savingsGoal', $event);
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_29 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent(__VLS_29, new __VLS_29({
    icon: (__VLS_ctx.getSortIcon('savingsGoal')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_31 = __VLS_30({
    icon: (__VLS_ctx.getSortIcon('savingsGoal')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
if (__VLS_ctx.getSortPriority('savingsGoal')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("savingsGoal"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategories('status', $event);
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center" },
});
const __VLS_33 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({
    icon: (__VLS_ctx.getSortIcon('status')),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_35 = __VLS_34({
    icon: (__VLS_ctx.getSortIcon('status')),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
if (__VLS_ctx.getSortPriority('status')) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center" },
    });
    (__VLS_ctx.getSortPriority("status"));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [category] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (category.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        ...{ onChange: (...[$event]) => {
                __VLS_ctx.updateCategoryGroup(category, $event.target.value);
            } },
        ...{ class: "select select-sm w-full rounded-full border border-base-300" },
        value: (category.categoryGroupId),
    });
    for (const [group] of __VLS_getVForSourceType((__VLS_ctx.categoryGroups))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (group.id),
            value: (group.id),
        });
        (group.name);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "min-w-[120px]" },
    });
    if (!__VLS_ctx.isEditingField(category.id, 'name')) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.isEditingField(category.id, 'name')))
                        return;
                    __VLS_ctx.handleFieldClick(category.id, 'name', $event);
                } },
            ...{ class: "editable-field cursor-pointer hover:border hover:border-primary hover:rounded px-2 py-1 transition-all min-h-[32px] flex items-center" },
        });
        (category.name);
    }
    else {
        /** @type {[typeof TextInput, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(TextInput, new TextInput({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.name),
            isActive: (true),
            fieldKey: (`${category.id}-name`),
        }));
        const __VLS_38 = __VLS_37({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.name),
            isActive: (true),
            fieldKey: (`${category.id}-name`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        let __VLS_40;
        let __VLS_41;
        let __VLS_42;
        const __VLS_43 = {
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'name')))
                    return;
                __VLS_ctx.handleNameUpdate(category.id, $event);
            }
        };
        const __VLS_44 = {
            onFinish: (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'name')))
                    return;
                __VLS_ctx.handleFieldFinish(category.id, 'name');
            }
        };
        var __VLS_39;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "min-w-[100px]" },
    });
    if (!__VLS_ctx.isEditingField(category.id, 'monthlyAmount')) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.isEditingField(category.id, 'monthlyAmount')))
                        return;
                    __VLS_ctx.handleFieldClick(category.id, 'monthlyAmount', $event);
                } },
            ...{ class: "editable-field cursor-pointer hover:border hover:border-primary hover:rounded px-2 py-1 transition-all min-h-[32px] flex items-center justify-end" },
        });
        if (category.monthlyAmount) {
            /** @type {[typeof CurrencyDisplay, ]} */ ;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
                amount: (category.monthlyAmount),
                showSign: (false),
            }));
            const __VLS_46 = __VLS_45({
                amount: (category.monthlyAmount),
                showSign: (false),
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-base-content/50" },
            });
        }
    }
    else {
        /** @type {[typeof CalculatorInput, ]} */ ;
        // @ts-ignore
        const __VLS_48 = __VLS_asFunctionalComponent(CalculatorInput, new CalculatorInput({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.monthlyAmount || 0),
            isActive: (true),
            fieldKey: (`${category.id}-monthlyAmount`),
        }));
        const __VLS_49 = __VLS_48({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.monthlyAmount || 0),
            isActive: (true),
            fieldKey: (`${category.id}-monthlyAmount`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_48));
        let __VLS_51;
        let __VLS_52;
        let __VLS_53;
        const __VLS_54 = {
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'monthlyAmount')))
                    return;
                __VLS_ctx.handleMonthlyAmountUpdate(category.id, $event);
            }
        };
        const __VLS_55 = {
            onFinish: (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'monthlyAmount')))
                    return;
                __VLS_ctx.handleFieldFinish(category.id, 'monthlyAmount');
            }
        };
        var __VLS_50;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "min-w-[80px]" },
    });
    if (!__VLS_ctx.isEditingField(category.id, 'priority')) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.isEditingField(category.id, 'priority')))
                        return;
                    __VLS_ctx.handleFieldClick(category.id, 'priority', $event);
                } },
            ...{ class: "editable-field cursor-pointer hover:border hover:border-primary hover:rounded px-2 py-1 transition-all min-h-[32px] flex items-center justify-center" },
        });
        if (category.priority) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "badge badge-sm badge-outline" },
            });
            (category.priority);
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-base-content/50" },
            });
        }
    }
    else {
        /** @type {[typeof CalculatorInput, ]} */ ;
        // @ts-ignore
        const __VLS_56 = __VLS_asFunctionalComponent(CalculatorInput, new CalculatorInput({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.priority || 0),
            isActive: (true),
            fieldKey: (`${category.id}-priority`),
        }));
        const __VLS_57 = __VLS_56({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.priority || 0),
            isActive: (true),
            fieldKey: (`${category.id}-priority`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_56));
        let __VLS_59;
        let __VLS_60;
        let __VLS_61;
        const __VLS_62 = {
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'priority')))
                    return;
                __VLS_ctx.handlePriorityUpdate(category.id, $event);
            }
        };
        const __VLS_63 = {
            onFinish: (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'priority')))
                    return;
                __VLS_ctx.handleFieldFinish(category.id, 'priority');
            }
        };
        var __VLS_58;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "min-w-[80px]" },
    });
    if (!__VLS_ctx.isEditingField(category.id, 'proportion')) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.isEditingField(category.id, 'proportion')))
                        return;
                    __VLS_ctx.handleFieldClick(category.id, 'proportion', $event);
                } },
            ...{ class: "editable-field cursor-pointer hover:border hover:border-primary hover:rounded px-2 py-1 transition-all min-h-[32px] flex items-center justify-center" },
        });
        if (category.proportion) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-sm" },
            });
            (category.proportion);
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "text-base-content/50" },
            });
        }
    }
    else {
        /** @type {[typeof CalculatorInput, ]} */ ;
        // @ts-ignore
        const __VLS_64 = __VLS_asFunctionalComponent(CalculatorInput, new CalculatorInput({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.proportion || 0),
            isActive: (true),
            fieldKey: (`${category.id}-proportion`),
        }));
        const __VLS_65 = __VLS_64({
            ...{ 'onUpdate:modelValue': {} },
            ...{ 'onFinish': {} },
            modelValue: (category.proportion || 0),
            isActive: (true),
            fieldKey: (`${category.id}-proportion`),
        }, ...__VLS_functionalComponentArgsRest(__VLS_64));
        let __VLS_67;
        let __VLS_68;
        let __VLS_69;
        const __VLS_70 = {
            'onUpdate:modelValue': (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'proportion')))
                    return;
                __VLS_ctx.handleProportionUpdate(category.id, $event);
            }
        };
        const __VLS_71 = {
            onFinish: (...[$event]) => {
                if (!!(!__VLS_ctx.isEditingField(category.id, 'proportion')))
                    return;
                __VLS_ctx.handleFieldFinish(category.id, 'proportion');
            }
        };
        var __VLS_66;
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col w-full" },
    });
    if (category.isSavingsGoal && category.targetAmount && category.goalDate) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "badge badge-xs badge-primary badge-soft text-xs w-full justify-center mb-1" },
        });
        /** @type {[typeof CurrencyDisplay, ]} */ ;
        // @ts-ignore
        const __VLS_72 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
            amount: (category.targetAmount),
            showSign: (false),
            asInteger: (true),
            ...{ class: "mr-0" },
        }));
        const __VLS_73 = __VLS_72({
            amount: (category.targetAmount),
            showSign: (false),
            asInteger: (true),
            ...{ class: "mr-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_72));
        (new Date(category.goalDate).toLocaleDateString('de-DE'));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-base-content/50" },
        });
    }
    if (category.isSavingsGoal && category.targetAmount && category.goalDate) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.progress, __VLS_intrinsicElements.progress)({
            className: "progress progress-primary w-full",
            value: (__VLS_ctx.getSavingsGoalProgress(category)),
            max: "100",
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    /** @type {[typeof CurrencyDisplay, ]} */ ;
    // @ts-ignore
    const __VLS_75 = __VLS_asFunctionalComponent(CurrencyDisplay, new CurrencyDisplay({
        ...{ class: (__VLS_ctx.getCategoryBalance(category.id) >= 0
                ? 'text-success'
                : 'text-error') },
        amount: (__VLS_ctx.getCategoryBalance(category.id)),
        showZero: (true),
        asInteger: (false),
    }));
    const __VLS_76 = __VLS_75({
        ...{ class: (__VLS_ctx.getCategoryBalance(category.id) >= 0
                ? 'text-success'
                : 'text-error') },
        amount: (__VLS_ctx.getCategoryBalance(category.id)),
        showZero: (true),
        asInteger: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_75));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleCategoryStatus(category);
            } },
        ...{ class: "badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity" },
        ...{ class: (category.isActive ? 'badge-success' : 'badge-error') },
        title: (`Klicken um Status zu ${category.isActive ? 'Inaktiv' : 'Aktiv'} zu ändern`),
    });
    (category.isActive ? "Aktiv" : "Inaktiv");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleSavingsGoal(category);
            } },
        ...{ class: "btn btn-ghost btn-xs" },
        ...{ class: (category.isSavingsGoal ? 'text-primary' : 'text-base-content/50') },
        title: (category.isSavingsGoal ? 'Sparziel deaktivieren' : 'Sparziel aktivieren'),
    });
    const __VLS_78 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent(__VLS_78, new __VLS_78({
        icon: (category.isSavingsGoal ? 'mdi:piggy-bank' : 'mdi:piggy-bank-outline'),
        ...{ class: "text-base" },
    }));
    const __VLS_80 = __VLS_79({
        icon: (category.isSavingsGoal ? 'mdi:piggy-bank' : 'mdi:piggy-bank-outline'),
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editCategory(category);
            } },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    const __VLS_82 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_83 = __VLS_asFunctionalComponent(__VLS_82, new __VLS_82({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_84 = __VLS_83({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_83));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.canDeleteCategory(category)
                    ? __VLS_ctx.deleteCategory(category)
                    : null;
            } },
        ...{ class: "btn btn-ghost btn-xs" },
        ...{ class: (__VLS_ctx.canDeleteCategory(category)
                ? 'text-error hover:bg-error hover:text-error-content'
                : 'text-base-300 cursor-not-allowed') },
        disabled: (!__VLS_ctx.canDeleteCategory(category)),
        title: (__VLS_ctx.canDeleteCategory(category)
            ? 'Kategorie löschen'
            : 'Kategorie kann nicht gelöscht werden (hat Buchungen)'),
    });
    const __VLS_86 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_88 = __VLS_87({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_87));
}
if ((__VLS_ctx.categories?.length ?? 0) === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "5",
        ...{ class: "text-center py-4" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card bg-base-100 shadow-md border border-base-300" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card-body" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
    ...{ class: "card-title text-lg mb-4" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "overflow-x-auto" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
    ...{ class: "table table-zebra w-full" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategoryGroups('name');
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_90 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_91 = __VLS_asFunctionalComponent(__VLS_90, new __VLS_90({
    icon: (__VLS_ctx.getGroupSortIcon('name', __VLS_ctx.groupSortField, __VLS_ctx.groupSortDirection)),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_92 = __VLS_91({
    icon: (__VLS_ctx.getGroupSortIcon('name', __VLS_ctx.groupSortField, __VLS_ctx.groupSortDirection)),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_91));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.sortCategoryGroups('type');
        } },
    ...{ class: "cursor-pointer hover:bg-base-200 select-none" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "flex items-center justify-between" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
const __VLS_94 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_95 = __VLS_asFunctionalComponent(__VLS_94, new __VLS_94({
    icon: (__VLS_ctx.getGroupSortIcon('type', __VLS_ctx.groupSortField, __VLS_ctx.groupSortDirection)),
    ...{ class: "w-4 h-4 opacity-60" },
}));
const __VLS_96 = __VLS_95({
    icon: (__VLS_ctx.getGroupSortIcon('type', __VLS_ctx.groupSortField, __VLS_ctx.groupSortDirection)),
    ...{ class: "w-4 h-4 opacity-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_95));
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({
    ...{ class: "text-right" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
for (const [group] of __VLS_getVForSourceType((__VLS_ctx.filteredCategoryGroups))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
        key: (group.id),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (group.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "badge badge-sm badge-soft rounded-full" },
        ...{ class: (group.isIncomeGroup ? 'badge-success' : 'badge-error') },
    });
    (group.isIncomeGroup ? "Einnahmen" : "Ausgaben");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
    (__VLS_ctx.categories?.filter((c) => c.categoryGroupId === group.id)
        ?.length ?? 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        ...{ class: "text-right" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-end space-x-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.editCategoryGroup(group.id);
            } },
        ...{ class: "btn btn-ghost btn-xs" },
    });
    const __VLS_98 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }));
    const __VLS_100 = __VLS_99({
        icon: "mdi:pencil",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_99));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.canDeleteCategoryGroup(group.id)
                    ? __VLS_ctx.deleteCategoryGroup(group.id)
                    : null;
            } },
        ...{ class: "btn btn-ghost btn-xs" },
        ...{ class: (__VLS_ctx.canDeleteCategoryGroup(group.id)
                ? 'text-error hover:bg-error hover:text-error-content'
                : 'text-base-300 cursor-not-allowed') },
        disabled: (!__VLS_ctx.canDeleteCategoryGroup(group.id)),
        title: (__VLS_ctx.canDeleteCategoryGroup(group.id)
            ? 'Kategoriegruppe löschen'
            : 'Kategoriegruppe kann nicht gelöscht werden (enthält Kategorien oder Buchungen)'),
    });
    const __VLS_102 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_103 = __VLS_asFunctionalComponent(__VLS_102, new __VLS_102({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }));
    const __VLS_104 = __VLS_103({
        icon: "mdi:trash-can",
        ...{ class: "text-base" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_103));
}
if ((__VLS_ctx.filteredCategoryGroups?.length ?? 0) === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
        colspan: "5",
        ...{ class: "text-center py-4" },
    });
}
if (__VLS_ctx.showCategoryModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-2xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg mb-4" },
    });
    (__VLS_ctx.isEditMode ? "Kategorie bearbeiten" : "Neue Kategorie");
    /** @type {[typeof CategoryForm, ]} */ ;
    // @ts-ignore
    const __VLS_106 = __VLS_asFunctionalComponent(CategoryForm, new CategoryForm({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        category: (__VLS_ctx.selectedCategory || undefined),
        isEdit: (__VLS_ctx.isEditMode),
    }));
    const __VLS_107 = __VLS_106({
        ...{ 'onSave': {} },
        ...{ 'onCancel': {} },
        category: (__VLS_ctx.selectedCategory || undefined),
        isEdit: (__VLS_ctx.isEditMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_106));
    let __VLS_109;
    let __VLS_110;
    let __VLS_111;
    const __VLS_112 = {
        onSave: (__VLS_ctx.saveCategory)
    };
    const __VLS_113 = {
        onCancel: (...[$event]) => {
            if (!(__VLS_ctx.showCategoryModal))
                return;
            __VLS_ctx.showCategoryModal = false;
        }
    };
    var __VLS_108;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showCategoryModal))
                    return;
                __VLS_ctx.showCategoryModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
if (__VLS_ctx.showGroupModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal modal-open" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-box max-w-xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-between items-center mb-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "font-bold text-lg" },
    });
    (__VLS_ctx.editingGroupId ? "Gruppe bearbeiten" : "Neue Gruppe");
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showGroupModal))
                    return;
                __VLS_ctx.showGroupModal = false;
            } },
        type: "button",
        ...{ class: "btn btn-sm btn-circle btn-ghost" },
        title: "Schließen",
    });
    const __VLS_114 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent(__VLS_114, new __VLS_114({
        icon: "mdi:close",
        ...{ class: "w-4 h-4" },
    }));
    const __VLS_116 = __VLS_115({
        icon: "mdi:close",
        ...{ class: "w-4 h-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.saveCategoryGroup) },
        ...{ class: "space-y-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-error" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        value: (__VLS_ctx.groupName),
        type: "text",
        ...{ class: "input input-bordered w-full" },
        required: true,
        placeholder: "Name der Kategoriegruppe",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "fieldset" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({
        ...{ class: "fieldset-legend" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        value: (__VLS_ctx.groupIsIncome),
        ...{ class: "select select-bordered w-full" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (true),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (false),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-action" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        type: "submit",
        ...{ class: "btn btn-primary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showGroupModal))
                    return;
                __VLS_ctx.showGroupModal = false;
            } },
        type: "button",
        ...{ class: "btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showGroupModal))
                    return;
                __VLS_ctx.showGroupModal = false;
            } },
        ...{ class: "modal-backdrop" },
    });
}
if (__VLS_ctx.showConfirmationModal) {
    /** @type {[typeof ConfirmationModal, ]} */ ;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent(ConfirmationModal, new ConfirmationModal({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: (__VLS_ctx.confirmationTitle),
        message: (__VLS_ctx.confirmationMessage),
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }));
    const __VLS_119 = __VLS_118({
        ...{ 'onConfirm': {} },
        ...{ 'onCancel': {} },
        title: (__VLS_ctx.confirmationTitle),
        message: (__VLS_ctx.confirmationMessage),
        confirmText: "Löschen",
        cancelText: "Abbrechen",
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
    let __VLS_121;
    let __VLS_122;
    let __VLS_123;
    const __VLS_124 = {
        onConfirm: (__VLS_ctx.handleConfirmation)
    };
    const __VLS_125 = {
        onCancel: (__VLS_ctx.handleCancellation)
    };
    var __VLS_120;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['md:flex-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary-content']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[120px]']} */ ;
/** @type {__VLS_StyleScopedClasses['editable-field']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[100px]']} */ ;
/** @type {__VLS_StyleScopedClasses['editable-field']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[80px]']} */ ;
/** @type {__VLS_StyleScopedClasses['editable-field']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[80px]']} */ ;
/** @type {__VLS_StyleScopedClasses['editable-field']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:border-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mr-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-opacity']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-300']} */ ;
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['space-x-1']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-open']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset']} */ ;
/** @type {__VLS_StyleScopedClasses['fieldset-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-action']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CategoryForm: CategoryForm,
            CurrencyDisplay: CurrencyDisplay,
            ConfirmationModal: ConfirmationModal,
            SearchGroup: SearchGroup,
            TextInput: TextInput,
            CalculatorInput: CalculatorInput,
            Icon: Icon,
            groupSortField: groupSortField,
            groupSortDirection: groupSortDirection,
            searchQuery: searchQuery,
            categories: categories,
            categoryGroups: categoryGroups,
            filteredCategoryGroups: filteredCategoryGroups,
            showCategoryModal: showCategoryModal,
            selectedCategory: selectedCategory,
            isEditMode: isEditMode,
            showGroupModal: showGroupModal,
            groupName: groupName,
            groupIsIncome: groupIsIncome,
            editingGroupId: editingGroupId,
            showConfirmationModal: showConfirmationModal,
            confirmationTitle: confirmationTitle,
            confirmationMessage: confirmationMessage,
            canDeleteCategory: canDeleteCategory,
            canDeleteCategoryGroup: canDeleteCategoryGroup,
            handleConfirmation: handleConfirmation,
            handleCancellation: handleCancellation,
            editCategory: editCategory,
            createCategory: createCategory,
            saveCategory: saveCategory,
            deleteCategory: deleteCategory,
            createCategoryGroup: createCategoryGroup,
            editCategoryGroup: editCategoryGroup,
            saveCategoryGroup: saveCategoryGroup,
            deleteCategoryGroup: deleteCategoryGroup,
            toggleCategoryStatus: toggleCategoryStatus,
            toggleSavingsGoal: toggleSavingsGoal,
            updateCategoryGroup: updateCategoryGroup,
            sortCategories: sortCategories,
            sortCategoryGroups: sortCategoryGroups,
            getSortIcon: getSortIcon,
            getSortPriority: getSortPriority,
            getGroupSortIcon: getGroupSortIcon,
            getCategoryBalance: getCategoryBalance,
            getSavingsGoalProgress: getSavingsGoalProgress,
            isEditingField: isEditingField,
            handleFieldClick: handleFieldClick,
            handleFieldFinish: handleFieldFinish,
            handleNameUpdate: handleNameUpdate,
            handleMonthlyAmountUpdate: handleMonthlyAmountUpdate,
            handlePriorityUpdate: handlePriorityUpdate,
            handleProportionUpdate: handleProportionUpdate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
