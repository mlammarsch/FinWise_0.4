<!-- src/views/admin/AdminCategoriesView.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { CategoryService } from "../../services/CategoryService";
import { BalanceService } from "../../services/BalanceService";
import CategoryForm from "../../components/budget/CategoryForm.vue";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay.vue";
import { Category } from "../../types";
import { Icon } from "@iconify/vue";

// Helper
const isVerfuegbareMittel = (cat: Category) =>
  cat?.name?.trim()?.toLowerCase() === "verfügbare mittel";

// Gefilterte Daten (ohne ‚Verfügbare Mittel')
const categories = computed(() =>
  CategoryService.getCategories().value.filter((c) => !isVerfuegbareMittel(c))
);
const categoryGroups = computed(
  () => CategoryService.getCategoryGroups().value
);

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
  if (
    confirm(`Möchten Sie die Kategorie "${category.name}" wirklich löschen?`)
  ) {
    try {
      const result = await CategoryService.deleteCategory(category.id);
      if (!result) {
        alert(
          "Die Kategorie kann nicht gelöscht werden, da sie Unterkategorien enthält."
        );
      }
    } catch (error) {
      console.error("Fehler beim Löschen der Kategorie:", error);
      alert("Fehler beim Löschen der Kategorie.");
    }
  }
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
  if (
    confirm(`Möchten Sie die Kategoriegruppe "${group.name}" wirklich löschen?`)
  ) {
    try {
      const result = await CategoryService.deleteCategoryGroup(groupId);
      if (!result) {
        alert(
          "Die Kategoriegruppe kann nicht gelöscht werden, da sie noch Kategorien enthält."
        );
      }
    } catch (error) {
      console.error("Fehler beim Löschen der Kategoriegruppe:", error);
      alert("Fehler beim Löschen der Kategoriegruppe.");
    }
  }
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

// Helper
const getGroupName = (groupId: string | undefined): string => {
  if (!groupId) return "Unbekannt";
  return CategoryService.getGroupName(groupId);
};

const getParentCategoryName = (parentId: string | null | undefined): string => {
  if (parentId === undefined) return "-";
  return CategoryService.getParentCategoryName(parentId);
};

// Berechnet den aktuellen Saldo einer Kategorie basierend auf allen Transaktionen
const getCategoryBalance = (categoryId: string): number => {
  return BalanceService.getTodayBalance("category", categoryId);
};
</script>

<template>
  <div>
    <!-- Header -->
    <div
      class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Kategorien verwalten</h2>
      <div class="flex justify-end w-full md:w-auto mt-2 md:mt-0">
        <div class="join">
          <button
            class="btn join-item rounded-l-full btn-sm btn-soft border border-base-300"
            @click="createCategoryGroup"
          >
            <Icon
              icon="mdi:folder-plus"
              class="mr-2 text-base"
            />
            Neue Gruppe
          </button>
          <button
            class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300"
            @click="createCategory"
          >
            <Icon
              icon="mdi:plus"
              class="mr-2 text-base"
            />
            Neue Kategorie
          </button>
        </div>
      </div>
    </div>

    <!-- Kategorien -->
    <div class="card bg-base-100 shadow-md border border-base-300 mb-6">
      <div class="card-body">
        <h3 class="card-title text-lg mb-4">Kategorien</h3>
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Gruppe</th>
                <th>Übergeordnete Kategorie</th>
                <th>Saldo</th>
                <th>Status</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="category in categories"
                :key="category.id"
              >
                <td>
                  {{ category.name }}
                  <span
                    v-if="category.isSavingsGoal"
                    class="badge badge-sm badge-accent ml-1"
                    >Sparziel</span
                  >
                </td>
                <td>{{ getGroupName(category.categoryGroupId) }}</td>
                <td>{{ getParentCategoryName(category.parentCategoryId) }}</td>
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
                      @click="editCategory(category)"
                    >
                      <Icon
                        icon="mdi:pencil"
                        class="text-base"
                      />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteCategory(category)"
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
                  colspan="6"
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
                <th>Name</th>
                <th>Typ</th>
                <th>Anzahl Kategorien</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="group in categoryGroups"
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
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteCategoryGroup(group.id)"
                    >
                      <Icon
                        icon="mdi:trash-can"
                        class="text-base"
                      />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="(categoryGroups?.length ?? 0) === 0">
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
  </div>
</template>
