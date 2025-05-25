<!-- src/views/BudgetsView2.vue -->
<script setup lang="ts">
/**
 * Pfad: src/views/BudgetsView2.vue
 * Budget‑Übersicht mit Kategorie‑Transfers.
 * Utils‑Abhängigkeiten entfernt – verwendet nun CategoryService.
 */

import { ref, computed } from "vue";
import { useCategoryStore } from "../stores/categoryStore";
import { useTransactionStore } from "../stores/transactionStore";
import { CategoryService } from "@/services/CategoryService"; // neu
import BudgetCard from "../components/budget/BudgetCard.vue";
import CategoryForm from "../components/budget/CategoryForm.vue";
import CategoryTransferModal from "../components/budget/CategoryTransferModal.vue";
import { Category } from "../types";
import CurrencyDisplay from "../components/ui/CurrencyDisplay.vue";

const categoryStore = useCategoryStore();
const transactionStore = useTransactionStore();

const showCategoryModal = ref(false);
const showTransferModal = ref(false);
const selectedCategory = ref<Category | null>(null);
const isEditMode = ref(false);

const categoriesByGroup = computed(() => categoryStore.categoriesByGroup);
const categoryGroups = computed(() => categoryStore.categoryGroups);
const savingsGoals = computed(() => categoryStore.savingsGoals);

/* ----------------------------------------------------------- */
/* ---------------------- CRUD Kategorie --------------------- */
/* ----------------------------------------------------------- */
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
    const ok = categoryStore.deleteCategory(category.id);
    if (!ok)
      alert(
        "Die Kategorie besitzt Unterkategorien und kann nicht gelöscht werden."
      );
  }
};

/* ----------------------------------------------------------- */
/* ---------------------- Transfers UI ----------------------- */
/* ----------------------------------------------------------- */
const showTransfer = (category: Category) => {
  selectedCategory.value = category;
  showTransferModal.value = true;
};

const transferBetweenCategories = (data: {
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  date: string;
  note: string;
}) => {
  CategoryService.addCategoryTransfer(
    // Utils‑Call ersetzt
    data.fromCategoryId,
    data.toCategoryId,
    data.amount,
    data.date,
    data.note
  );
  showTransferModal.value = false;
};
</script>

<template>
  <div>
    <!-- Kopfbereich -->
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold">Budgets &amp; Kategorien</h2>
      <button class="btn btn-primary" @click="createCategory">
        <span class="iconify mr-2" data-icon="mdi:plus" />
        Neue Kategorie
      </button>
    </div>

    <!-- Sparziele -->
    <div v-if="savingsGoals.length" class="mb-8">
      <h3 class="text-lg font-bold mb-4">Sparziele</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <BudgetCard
          v-for="cat in savingsGoals"
          :key="cat.id"
          :category="cat"
          @edit="editCategory(cat)"
          @transfer="showTransfer(cat)"
        />
      </div>
    </div>

    <!-- Kategorien nach Gruppe -->
    <div v-for="group in categoryGroups" :key="group.id" class="mb-8">
      <h3 class="text-lg font-bold mb-4">{{ group.name }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="cat in categoriesByGroup[group.id]" :key="cat.id">
          <BudgetCard
            :category="cat"
            @edit="editCategory(cat)"
            @transfer="showTransfer(cat)"
          />

          <!-- Unterkategorien -->
          <div
            v-if="categoryStore.getChildCategories(cat.id).length"
            class="ml-4 mt-2 space-y-2"
          >
            <div
              v-for="child in categoryStore.getChildCategories(cat.id)"
              :key="child.id"
              class="card bg-base-200 p-3"
            >
              <div class="flex justify-between items-center">
                <div>
                  <h4 class="font-medium">{{ child.name }}</h4>
                  <p class="text-sm">
                    Saldo:
                    <CurrencyDisplay
                      :amount="child.balance"
                      :show-zero="true"
                      :asInteger="false"
                    />
                  </p>
                </div>
                <div class="dropdown dropdown-end">
                  <label tabindex="0" class="btn btn-ghost btn-xs btn-circle">
                    <span class="iconify" data-icon="mdi:dots-vertical" />
                  </label>
                  <ul
                    tabindex="0"
                    class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
                  >
                    <li><a @click="editCategory(child)">Bearbeiten</a></li>
                    <li><a @click="showTransfer(child)">Übertragen</a></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <!-- /Unterkategorien -->
        </div>
      </div>
    </div>

    <!-- Kategorie‑Modal -->
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
      <div class="modal-backdrop" @click="showCategoryModal = false" />
    </div>

    <!-- Transfer‑Modal -->
    <CategoryTransferModal
      :category="selectedCategory"
      :is-open="showTransferModal"
      @close="showTransferModal = false"
      @transfer="transferBetweenCategories"
    />
  </div>
</template>

<style scoped></style>
