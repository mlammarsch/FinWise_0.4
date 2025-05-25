<!-- src/views/admin/AdminCategoriesView.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { useCategoryStore } from "../../stores/categoryStore";
import CategoryForm from "../../components/budget/CategoryForm.vue";
import { Category } from "../../types";
import { Icon } from "@iconify/vue";

// Stores
const categoryStore = useCategoryStore();

// Helper
const isVerfuegbareMittel = (cat: Category) =>
  cat.name.trim().toLowerCase() === "verfügbare mittel";

// Gefilterte Daten (ohne ‚Verfügbare Mittel‘)
const categories = computed(() =>
  categoryStore.categories.filter((c) => !isVerfuegbareMittel(c))
);
const categoryGroups = computed(() => categoryStore.categoryGroups);

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

const saveCategory = (categoryData: Omit<Category, "id">) => {
  if (isEditMode.value && selectedCategory.value) {
    categoryStore.updateCategory(selectedCategory.value.id, categoryData);
  } else {
    categoryStore.addCategory(categoryData);
  }
  showCategoryModal.value = false;
};

const deleteCategory = (category: Category) => {
  if (
    confirm(`Möchten Sie die Kategorie "${category.name}" wirklich löschen?`)
  ) {
    const result = categoryStore.deleteCategory(category.id);
    if (!result) {
      alert(
        "Die Kategorie kann nicht gelöscht werden, da sie Unterkategorien enthält."
      );
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

const saveCategoryGroup = () => {
  if (editingGroupId.value) {
    // Update
    const existing = categoryGroups.value.find(
      (g) => g.id === editingGroupId.value
    );
    if (existing) {
      Object.assign(existing, {
        name: groupName.value,
        sortOrder: groupSort.value,
        isIncomeGroup: groupIsIncome.value,
      });
      categoryStore.loadCategories(); // Refresh
    }
  } else {
    // Neu
    categoryStore.addCategoryGroup({
      name: groupName.value,
      sortOrder: groupSort.value,
      isIncomeGroup: groupIsIncome.value,
    });
  }
  showGroupModal.value = false;
};

const deleteCategoryGroup = (groupId: string) => {
  const group = categoryGroups.value?.find((g) => g.id === groupId);
  if (!group) return;
  if (
    confirm(`Möchten Sie die Kategoriegruppe "${group.name}" wirklich löschen?`)
  ) {
    const result = categoryStore.deleteCategoryGroup(groupId);
    if (!result) {
      alert(
        "Die Kategoriegruppe kann nicht gelöscht werden, da sie noch Kategorien enthält."
      );
    }
  }
};

// Helper
const getGroupName = (groupId: string): string => {
  if (!categoryGroups.value) return "Unbekannt";
  const group = categoryGroups.value.find((g) => g.id === groupId);
  return group ? group.name : "Unbekannt";
};

const getParentCategoryName = (parentId: string | null): string => {
  if (!parentId) return "-";
  const parent = categories.value.find((c) => c.id === parentId);
  return parent ? parent.name : "Unbekannt";
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
            <Icon icon="mdi:folder-plus" class="mr-2 text-base" />
            Neue Gruppe
          </button>
          <button
            class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300"
            @click="createCategory"
          >
            <Icon icon="mdi:plus" class="mr-2 text-base" />
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
              <tr v-for="category in categories" :key="category.id">
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
                <td
                  :class="category.balance >= 0 ? 'text-success' : 'text-error'"
                >
                  {{
                    new Intl.NumberFormat("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    }).format(category.balance)
                  }}
                </td>
                <td>
                  <div
                    class="badge rounded-full badge-soft"
                    :class="category.isActive ? 'badge-success' : 'badge-error'"
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
                      <Icon icon="mdi:pencil" class="text-base" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteCategory(category)"
                    >
                      <Icon icon="mdi:trash-can" class="text-base" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="(categories?.length ?? 0) === 0">
                <td colspan="6" class="text-center py-4">
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
                <th>Sortierung</th>
                <th>Anzahl Kategorien</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in categoryGroups" :key="group.id">
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
                <td>{{ group.sortOrder }}</td>
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
                      <Icon icon="mdi:pencil" class="text-base" />
                    </button>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      @click="deleteCategoryGroup(group.id)"
                    >
                      <Icon icon="mdi:trash-can" class="text-base" />
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="(categoryGroups?.length ?? 0) === 0">
                <td colspan="5" class="text-center py-4">
                  Keine Kategoriegruppen vorhanden
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Kategorie-Modal -->
    <div v-if="showCategoryModal" class="modal modal-open">
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
      <div class="modal-backdrop" @click="showCategoryModal = false"></div>
    </div>

    <!-- Kategoriegruppe-Modal -->
    <div v-if="showGroupModal" class="modal modal-open">
      <div class="modal-box max-w-xl">
        <h3 class="font-bold text-lg mb-4">
          {{ editingGroupId ? "Gruppe bearbeiten" : "Neue Gruppe" }}
        </h3>
        <form @submit.prevent="saveCategoryGroup" class="space-y-4">
          <div>
            <label class="label">Name</label>
            <input
              v-model="groupName"
              type="text"
              class="input input-bordered w-full"
              required
            />
          </div>
          <div>
            <label class="label">Sortierung</label>
            <input
              v-model.number="groupSort"
              type="number"
              class="input input-bordered w-full"
            />
          </div>
          <div>
            <label class="label">Typ</label>
            <select
              v-model="groupIsIncome"
              class="select select-bordered w-full"
            >
              <option :value="true">Einnahmen</option>
              <option :value="false">Ausgaben</option>
            </select>
          </div>
          <div class="modal-action">
            <button type="submit" class="btn btn-primary">Speichern</button>
            <button type="button" class="btn" @click="showGroupModal = false">
              Abbrechen
            </button>
          </div>
        </form>
      </div>
      <div class="modal-backdrop" @click="showGroupModal = false"></div>
    </div>
  </div>
</template>
