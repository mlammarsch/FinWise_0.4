<!-- src/views/admin/AdminCategoriesView.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { CategoryService } from "../../services/CategoryService";
import { BalanceService } from "../../services/BalanceService";
import { useTransactionStore } from "../../stores/transactionStore";
import CategoryForm from "../../components/budget/CategoryForm.vue";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay.vue";
import ConfirmationModal from "../../components/ui/ConfirmationModal.vue";
import SearchGroup from "../../components/ui/SearchGroup.vue";
import { Category } from "../../types";
import { Icon } from "@iconify/vue";

// Helper
const isVerfuegbareMittel = (cat: Category) =>
  cat?.name?.trim()?.toLowerCase() === "verfügbare mittel";

// Mehrfachsortierung für Kategorien
interface SortCriteria {
  field: string;
  direction: "asc" | "desc";
}

const categorySortCriteria = ref<SortCriteria[]>([
  { field: "group", direction: "asc" },
  { field: "name", direction: "asc" },
]);

// Sortierung für Kategoriegruppen
const groupSortField = ref<string>("name");
const groupSortDirection = ref<"asc" | "desc">("asc");

// Suchfunktionalität
const searchQuery = ref("");

// Gefilterte und sortierte Daten mit Mehrfachsortierung
const categories = computed(() => {
  let filtered = CategoryService.getCategories().value.filter(
    (c) => !isVerfuegbareMittel(c)
  );

  // Filtern nach Suchbegriff
  if (searchQuery.value.trim() !== "") {
    filtered = filtered.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  return [...filtered].sort((a, b) => {
    for (const criteria of categorySortCriteria.value) {
      let aValue: string | boolean | number;
      let bValue: string | boolean | number;

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
    let aValue: string | boolean;
    let bValue: string | boolean;

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
    groups = groups.filter((g) =>
      g.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  return groups;
});

// Kategorie State
const showCategoryModal = ref(false);
const selectedCategory = ref<Category | null>(null);
const isEditMode = ref(false);

// Gruppe State
const showGroupModal = ref(false);
const groupName = ref("");
const groupSort = ref(0);
const groupIsIncome = ref(false);
const editingGroupId = ref<string | null>(null);

// Confirmation Modal State
const showConfirmationModal = ref(false);
const confirmationTitle = ref("");
const confirmationMessage = ref("");
const confirmationAction = ref<(() => Promise<void>) | null>(null);

// Transaction Store für Prüfungen
const transactionStore = useTransactionStore();

// Hilfsfunktionen zur Prüfung von Transaktions-Zuordnungen
const categoryHasTransactions = (categoryId: string): boolean => {
  const transactions = transactionStore.getTransactionsByCategory(categoryId);
  return transactions.length > 0;
};

const categoryGroupHasCategories = (groupId: string): boolean => {
  return categories.value.some(
    (category) => category.categoryGroupId === groupId
  );
};

const categoryGroupHasTransactions = (groupId: string): boolean => {
  return categories.value
    .filter((category) => category.categoryGroupId === groupId)
    .some((category) => categoryHasTransactions(category.id));
};

const canDeleteCategory = (category: Category): boolean => {
  // Prüfe auf Transaktionen
  return !categoryHasTransactions(category.id);
};

const canDeleteCategoryGroup = (groupId: string): boolean => {
  // Prüfe auf zugeordnete Kategorien
  if (categoryGroupHasCategories(groupId)) return false;

  // Prüfe auf Transaktionen in Kategorien der Gruppe
  return !categoryGroupHasTransactions(groupId);
};

// Confirmation Modal Funktionen
const showDeleteConfirmation = (
  title: string,
  message: string,
  action: () => Promise<void>
) => {
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
const editCategory = (category: Category) => {
  selectedCategory.value = category;
  isEditMode.value = true;
  showCategoryModal.value = true;
};

const createCategory = () => {
  selectedCategory.value = null;
  isEditMode.value = false;
  showCategoryModal.value = true;
};

const saveCategory = async (categoryData: Omit<Category, "id">) => {
  try {
    if (isEditMode.value && selectedCategory.value) {
      await CategoryService.updateCategory(
        selectedCategory.value.id,
        categoryData
      );
    } else {
      await CategoryService.addCategory(categoryData);
    }
    showCategoryModal.value = false;
  } catch (error) {
    console.error("Fehler beim Speichern der Kategorie:", error);
    alert("Fehler beim Speichern der Kategorie.");
  }
};

const deleteCategory = async (category: Category) => {
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
    } catch (error) {
      console.error("Fehler beim Löschen der Kategorie:", error);
      alert("Fehler beim Löschen der Kategorie.");
    }
  };

  showDeleteConfirmation(
    "Kategorie löschen",
    `Möchten Sie die Kategorie "${category.name}" wirklich löschen?`,
    action
  );
};

// Kategoriegruppen-Aktionen
const createCategoryGroup = () => {
  editingGroupId.value = null;
  groupName.value = "";
  groupSort.value = categoryGroups.value?.length || 0;
  groupIsIncome.value = false;
  showGroupModal.value = true;
};

const editCategoryGroup = (groupId: string) => {
  const group = categoryGroups.value.find((g) => g.id === groupId);
  if (!group) return;
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
    } else {
      await CategoryService.addCategoryGroup({
        name: groupName.value,
        sortOrder: groupSort.value,
        isIncomeGroup: groupIsIncome.value,
      });
    }
    showGroupModal.value = false;
  } catch (error) {
    console.error("Fehler beim Speichern der Kategoriegruppe:", error);
    alert("Fehler beim Speichern der Kategoriegruppe.");
  }
};

const deleteCategoryGroup = async (groupId: string) => {
  const group = categoryGroups.value?.find((g) => g.id === groupId);
  if (!group) return;

  // Prüfe ob Kategoriegruppe gelöscht werden kann
  if (!canDeleteCategoryGroup(groupId)) {
    const hasCategories = categoryGroupHasCategories(groupId);
    const hasTransactions = categoryGroupHasTransactions(groupId);

    let message = "Die Kategoriegruppe kann nicht gelöscht werden, da sie ";
    if (hasCategories && hasTransactions) {
      message += "noch Kategorien mit Buchungen enthält.";
    } else if (hasCategories) {
      message += "noch Kategorien enthält.";
    } else if (hasTransactions) {
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
    } catch (error) {
      console.error("Fehler beim Löschen der Kategoriegruppe:", error);
      alert("Fehler beim Löschen der Kategoriegruppe.");
    }
  };

  showDeleteConfirmation(
    "Kategoriegruppe löschen",
    `Möchten Sie die Kategoriegruppe "${group.name}" wirklich löschen?`,
    action
  );
};

/**
 * Schaltet den aktiven Status einer Kategorie um
 */
const toggleCategoryStatus = async (category: Category) => {
  try {
    const newStatus = !category.isActive;
    const success = await CategoryService.updateCategory(category.id, {
      isActive: newStatus,
    });

    if (success) {
      console.log(
        `Kategorie "${category.name}" Status geändert zu: ${
          newStatus ? "Aktiv" : "Inaktiv"
        }`
      );
    } else {
      console.error(
        `Fehler beim Ändern des Status von Kategorie "${category.name}"`
      );
    }
  } catch (error) {
    console.error(
      `Fehler beim Umschalten des Kategorie-Status für "${category.name}":`,
      error
    );
  }
};

/**
 * Schaltet den Sparziel-Status einer Kategorie um
 */
const toggleSavingsGoal = async (category: Category) => {
  try {
    const newSavingsGoalStatus = !category.isSavingsGoal;
    const success = await CategoryService.updateCategory(category.id, {
      isSavingsGoal: newSavingsGoalStatus,
    });

    if (success) {
      console.log(
        `Kategorie "${category.name}" Sparziel-Status geändert zu: ${
          newSavingsGoalStatus ? "Aktiv" : "Inaktiv"
        }`
      );
    } else {
      console.error(
        `Fehler beim Ändern des Sparziel-Status von Kategorie "${category.name}"`
      );
    }
  } catch (error) {
    console.error(
      `Fehler beim Umschalten des Sparziel-Status für "${category.name}":`,
      error
    );
  }
};

// Update-Funktionen für Dropdowns
const updateCategoryGroup = async (category: Category, newGroupId: string) => {
  // Prüfe, ob sich die Gruppe tatsächlich geändert hat
  if (category.categoryGroupId === newGroupId) {
    console.log(
      `Kategorie ${category.name} bleibt in derselben Gruppe ${newGroupId}`
    );
    return;
  }

  try {
    await CategoryService.updateCategory(category.id, {
      categoryGroupId: newGroupId,
    });

    console.log(
      `Kategorie ${category.name} erfolgreich zu Gruppe ${newGroupId} verschoben`
    );
  } catch (error) {
    console.error(
      `Fehler beim Verschieben von Kategorie ${category.name} zu Gruppe ${newGroupId}`,
      error
    );
  }
};


// Sortier-Handler für Kategorien mit Mehrfachsortierung
const sortCategories = (field: string, event?: MouseEvent) => {
  const isShiftPressed = event?.shiftKey || false;
  const existingIndex = categorySortCriteria.value.findIndex(
    (c) => c.field === field
  );

  if (!isShiftPressed) {
    // Kein Shift: Alle Filter löschen und nur das geklickte Feld sortieren
    if (existingIndex >= 0 && categorySortCriteria.value.length === 1) {
      // Wenn nur dieses eine Feld sortiert ist, Richtung umkehren
      categorySortCriteria.value[0].direction =
        categorySortCriteria.value[0].direction === "asc" ? "desc" : "asc";
    } else {
      // Neue Sortierung nur mit diesem Feld
      categorySortCriteria.value = [{ field, direction: "asc" }];
    }
  } else {
    // Shift gedrückt: Bestehende Sortierung erweitern
    if (existingIndex >= 0) {
      // Feld bereits in Sortierung - Richtung umkehren
      categorySortCriteria.value[existingIndex].direction =
        categorySortCriteria.value[existingIndex].direction === "asc"
          ? "desc"
          : "asc";
    } else {
      // Neues Feld - an erste Stelle setzen
      categorySortCriteria.value.unshift({ field, direction: "asc" });
      // Maximal 3 Sortierkriterien behalten
      if (categorySortCriteria.value.length > 3) {
        categorySortCriteria.value = categorySortCriteria.value.slice(0, 3);
      }
    }
  }
};

// Sortier-Handler für Kategoriegruppen
const sortCategoryGroups = (field: string) => {
  if (groupSortField.value === field) {
    groupSortDirection.value =
      groupSortDirection.value === "asc" ? "desc" : "asc";
  } else {
    groupSortField.value = field;
    groupSortDirection.value = "asc";
  }
};

// Helper für Sortier-Icon mit Mehrfachsortierung
const getSortIcon = (field: string) => {
  const criteria = categorySortCriteria.value.find((c) => c.field === field);
  if (!criteria) return "mdi:sort";
  return criteria.direction === "asc"
    ? "mdi:sort-ascending"
    : "mdi:sort-descending";
};

// Helper für Sortier-Priorität (zeigt Nummer bei Mehrfachsortierung)
const getSortPriority = (field: string): number | null => {
  const index = categorySortCriteria.value.findIndex((c) => c.field === field);
  return index >= 0 ? index + 1 : null;
};

// Helper für Kategoriegruppen-Sortier-Icon
const getGroupSortIcon = (
  field: string,
  currentField: string,
  currentDirection: "asc" | "desc"
) => {
  if (field !== currentField) return "mdi:sort";
  return currentDirection === "asc"
    ? "mdi:sort-ascending"
    : "mdi:sort-descending";
};

// Helper
const getGroupName = (groupId: string | undefined): string => {
  if (!groupId) return "Unbekannt";
  return CategoryService.getGroupName(groupId);
};


// Berechnet den aktuellen Saldo einer Kategorie basierend auf allen Transaktionen
const getCategoryBalance = (categoryId: string): number => {
  return BalanceService.getTodayBalance("category", categoryId);
};

// Berechnet den Progress-Wert für Sparziele (Saldo / Sparziel * 100, max. 100)
const getSavingsGoalProgress = (category: Category): number => {
  if (!category.isSavingsGoal || !category.targetAmount || category.targetAmount <= 0) {
    return 0;
  }

  const currentBalance = getCategoryBalance(category.id);
  const progress = (currentBalance / category.targetAmount) * 100;

  // Ergebnis kann nie höher als 100 sein
  return Math.min(Math.max(progress, 0), 100);
};
</script>

<template>
  <div>
    <!-- Header -->
    <div
      class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Kategorien verwalten</h2>
      <SearchGroup
        btnMiddleRight="Neue Gruppe"
        btnMiddleRightIcon="mdi:folder-plus"
        btnRight="Neue Kategorie"
        btnRightIcon="mdi:plus"
        @search="(query: string) => (searchQuery = query)"
        @btn-middle-right-click="createCategoryGroup"
        @btn-right-click="createCategory"
      />
    </div>

    <!-- Kategorien -->
    <div class="card bg-base-100 shadow-md border border-base-300 mb-6">
      <div class="card-body">
        <h3 class="card-title text-lg mb-4">Kategorien</h3>
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('group')"
                >
                  <div class="flex items-center justify-between">
                    <span>Gruppe</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('group')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('group')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("group") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('name', $event)"
                >
                  <div class="flex items-center justify-between">
                    <span>Name</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('name')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('name')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("name") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('monthlyAmount', $event)"
                >
                  <div class="flex items-center justify-between">
                    <span>Mtl. Beitrag</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('monthlyAmount')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('monthlyAmount')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("monthlyAmount") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('priority', $event)"
                >
                  <div class="flex items-center justify-between">
                    <span>Priorität</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('priority')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('priority')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("priority") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('proportion', $event)"
                >
                  <div class="flex items-center justify-between">
                    <span>Anteil</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('proportion')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('proportion')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("proportion") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('savingsGoal', $event)"
                >
                  <div class="flex items-center justify-between">
                    <span>Sparziel</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('savingsGoal')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('savingsGoal')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("savingsGoal") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th>Saldo</th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategories('status', $event)"
                >
                  <div class="flex items-center justify-between">
                    <span>Status</span>
                    <div class="flex items-center">
                      <Icon
                        :icon="getSortIcon('status')"
                        class="w-4 h-4 opacity-60"
                      />
                      <span
                        v-if="getSortPriority('status')"
                        class="ml-1 text-xs bg-primary text-primary-content rounded-full w-4 h-4 flex items-center justify-center"
                      >
                        {{ getSortPriority("status") }}
                      </span>
                    </div>
                  </div>
                </th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="category in categories"
                :key="category.id"
              >
                <td>
                  <select
                    class="select select-sm w-full rounded-full border border-base-300"
                    :value="category.categoryGroupId"
                    @change="
                      updateCategoryGroup(
                        category,
                        ($event.target as HTMLSelectElement).value
                      )
                    "
                  >
                    <option
                      v-for="group in categoryGroups"
                      :key="group.id"
                      :value="group.id"
                    >
                      {{ group.name }}
                    </option>
                  </select>
                </td>
                <td>
                  {{ category.name }}
                </td>
                <td>
                  <CurrencyDisplay
                    v-if="category.monthlyAmount"
                    :amount="category.monthlyAmount"
                    :show-sign="false"
                  />
                  <span v-else class="text-base-content/50">-</span>
                </td>
                <td>
                  <span v-if="category.priority" class="badge badge-outline">
                    {{ category.priority }}
                  </span>
                  <span v-else class="text-base-content/50">-</span>
                </td>
                <td>
                  <span v-if="category.proportion" class="text-sm">
                    {{ category.proportion }}%
                  </span>
                  <span v-else class="text-base-content/50">-</span>
                </td>
                <td>
                  <div class="flex flex-col w-full">
                    <div v-if="category.isSavingsGoal && category.targetAmount && category.goalDate" class="badge badge-primary badge-soft text-xs w-full justify-center mb-1">
                      <CurrencyDisplay :amount="category.targetAmount" :show-sign="false" :as-integer="true" class="mr-1" />
                      - {{ new Date(category.goalDate).toLocaleDateString('de-DE') }}
                    </div>
                    <span v-else class="text-base-content/50">-</span>
                    <progress v-if="category.isSavingsGoal && category.targetAmount && category.goalDate" className="progress progress-primary w-full" :value="getSavingsGoalProgress(category)" max="100"></progress>
                  </div>
                </td>
                <td>
                  <CurrencyDisplay
                    :class="
                      getCategoryBalance(category.id) >= 0
                        ? 'text-success'
                        : 'text-error'
                    "
                    :amount="getCategoryBalance(category.id)"
                    :show-zero="true"
                    :asInteger="false"
                  />
                </td>
                <td>
                  <div
                    class="badge rounded-full badge-soft cursor-pointer hover:opacity-80 transition-opacity"
                    :class="category.isActive ? 'badge-success' : 'badge-error'"
                    @click="toggleCategoryStatus(category)"
                    :title="`Klicken um Status zu ${
                      category.isActive ? 'Inaktiv' : 'Aktiv'
                    } zu ändern`"
                  >
                    {{ category.isActive ? "Aktiv" : "Inaktiv" }}
                  </div>
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-xs"
                      :class="category.isSavingsGoal ? 'text-primary' : 'text-base-content/50'"
                      @click="toggleSavingsGoal(category)"
                      :title="category.isSavingsGoal ? 'Sparziel deaktivieren' : 'Sparziel aktivieren'"
                    >
                      <Icon
                        :icon="category.isSavingsGoal ? 'mdi:piggy-bank' : 'mdi:piggy-bank-outline'"
                        class="text-base"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs"
                      @click="editCategory(category)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs"
                      :class="
                        canDeleteCategory(category)
                          ? 'text-error hover:bg-error hover:text-error-content'
                          : 'text-base-300 cursor-not-allowed'
                      "
                      :disabled="!canDeleteCategory(category)"
                      :title="
                        canDeleteCategory(category)
                          ? 'Kategorie löschen'
                          : 'Kategorie kann nicht gelöscht werden (hat Buchungen)'
                      "
                      @click="
                        canDeleteCategory(category)
                          ? deleteCategory(category)
                          : null
                      "
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="(categories?.length ?? 0) === 0">
                <td
                  colspan="5"
                  class="text-center py-4"
                >
                  Keine Kategorien vorhanden
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Kategoriegruppen -->
    <div class="card bg-base-100 shadow-md border border-base-300">
      <div class="card-body">
        <h3 class="card-title text-lg mb-4">Kategoriegruppen</h3>
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategoryGroups('name')"
                >
                  <div class="flex items-center justify-between">
                    <span>Name</span>
                    <Icon
                      :icon="
                        getGroupSortIcon(
                          'name',
                          groupSortField,
                          groupSortDirection
                        )
                      "
                      class="w-4 h-4 opacity-60"
                    />
                  </div>
                </th>
                <th
                  class="cursor-pointer hover:bg-base-200 select-none"
                  @click="sortCategoryGroups('type')"
                >
                  <div class="flex items-center justify-between">
                    <span>Typ</span>
                    <Icon
                      :icon="
                        getGroupSortIcon(
                          'type',
                          groupSortField,
                          groupSortDirection
                        )
                      "
                      class="w-4 h-4 opacity-60"
                    />
                  </div>
                </th>
                <th>Anzahl Kategorien</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="group in filteredCategoryGroups"
                :key="group.id"
              >
                <td>{{ group.name }}</td>
                <td>
                  <span
                    class="badge badge-sm badge-soft rounded-full"
                    :class="
                      group.isIncomeGroup ? 'badge-success' : 'badge-error'
                    "
                  >
                    {{ group.isIncomeGroup ? "Einnahmen" : "Ausgaben" }}
                  </span>
                </td>
                <td>
                  {{
                    categories?.filter((c) => c.categoryGroupId === group.id)
                      ?.length ?? 0
                  }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-xs"
                      @click="editCategoryGroup(group.id)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs"
                      :class="
                        canDeleteCategoryGroup(group.id)
                          ? 'text-error hover:bg-error hover:text-error-content'
                          : 'text-base-300 cursor-not-allowed'
                      "
                      :disabled="!canDeleteCategoryGroup(group.id)"
                      :title="
                        canDeleteCategoryGroup(group.id)
                          ? 'Kategoriegruppe löschen'
                          : 'Kategoriegruppe kann nicht gelöscht werden (enthält Kategorien oder Buchungen)'
                      "
                      @click="
                        canDeleteCategoryGroup(group.id)
                          ? deleteCategoryGroup(group.id)
                          : null
                      "
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="(filteredCategoryGroups?.length ?? 0) === 0">
                <td
                  colspan="5"
                  class="text-center py-4"
                >
                  Keine Kategoriegruppen vorhanden
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Kategorie-Modal -->
    <div
      v-if="showCategoryModal"
      class="modal modal-open"
    >
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">
          {{ isEditMode ? "Kategorie bearbeiten" : "Neue Kategorie" }}
        </h3>
        <CategoryForm
          :category="selectedCategory || undefined"
          :is-edit="isEditMode"
          @save="saveCategory"
          @cancel="showCategoryModal = false"
        />
      </div>
      <div
        class="modal-backdrop"
        @click="showCategoryModal = false"
      ></div>
    </div>

    <!-- Kategoriegruppe-Modal -->
    <div
      v-if="showGroupModal"
      class="modal modal-open"
    >
      <div class="modal-box max-w-xl">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">
            {{ editingGroupId ? "Gruppe bearbeiten" : "Neue Gruppe" }}
          </h3>
          <button
            type="button"
            @click="showGroupModal = false"
            class="btn btn-sm btn-circle btn-ghost"
            title="Schließen"
          >
            <Icon
              icon="mdi:close"
              class="w-4 h-4"
            />
          </button>
        </div>
        <form
          @submit.prevent="saveCategoryGroup"
          class="space-y-4"
        >
          <fieldset class="fieldset">
            <legend class="fieldset-legend">
              Name<span class="text-error">*</span>
            </legend>
            <input
              v-model="groupName"
              type="text"
              class="input input-bordered w-full"
              required
              placeholder="Name der Kategoriegruppe"
            />
          </fieldset>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">Typ</legend>
            <select
              v-model="groupIsIncome"
              class="select select-bordered w-full"
            >
              <option :value="true">Einnahmen</option>
              <option :value="false">Ausgaben</option>
            </select>
          </fieldset>
          <div class="modal-action">
            <button
              type="submit"
              class="btn btn-primary"
            >
              Speichern
            </button>
            <button
              type="button"
              class="btn"
              @click="showGroupModal = false"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
      <div
        class="modal-backdrop"
        @click="showGroupModal = false"
      ></div>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      v-if="showConfirmationModal"
      :title="confirmationTitle"
      :message="confirmationMessage"
      confirm-text="Löschen"
      cancel-text="Abbrechen"
      @confirm="handleConfirmation"
      @cancel="handleCancellation"
    />
  </div>
</template>
