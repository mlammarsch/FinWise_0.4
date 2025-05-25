<!-- src/views/admin/AdminTenantsView.vue -->
<script setup lang="ts">
/**
 * Pfad zur Komponente: src/views/admin/AdminTenantsView.vue
 * Verwaltung der Mandanten (Tenants) des aktuell angemeldeten Users.
 *
 * Komponenten-Props: –
 * Emits:            –
 */

import { ref, computed } from "vue";
import { TenantService } from "@/services/TenantService";
import { useTenantStore } from "@/stores/tenantStore";
import { useSessionStore } from "@/stores/sessionStore";
import SearchGroup from "@/components/ui/SearchGroup.vue";
import PagingComponent from "@/components/ui/PagingComponent.vue";
import ConfirmationModal from "@/components/ui/ConfirmationModal.vue";
import { Icon } from "@iconify/vue";
import { debugLog } from "@/utils/logger";

const session = useSessionStore();
const tenantStore = useTenantStore();

const showModal = ref(false);
const isEditMode = ref(false);
const selectedTenant = ref<{ id: string; tenantName: string } | null>(null);
const nameInput = ref("");
const searchQuery = ref("");
const showDeleteModal = ref(false);
const deleteTargetId = ref<string | null>(null);

const currentPage = ref(1);
const itemsPerPage = ref<number | string>(25);

/* --------------------------------------------- Helper & Computed */
const ownTenants = computed(() => TenantService.getOwnTenants());

const filteredTenants = computed(() => {
  if (!searchQuery.value.trim()) return ownTenants.value;
  const q = searchQuery.value.toLowerCase();
  return ownTenants.value.filter((t) => t.tenantName.toLowerCase().includes(q));
});

const totalPages = computed(() =>
  itemsPerPage.value === "all"
    ? 1
    : Math.ceil(filteredTenants.value.length / Number(itemsPerPage.value))
);

const paginated = computed(() => {
  if (itemsPerPage.value === "all") return filteredTenants.value;
  const start = (currentPage.value - 1) * Number(itemsPerPage.value);
  const end = start + Number(itemsPerPage.value);
  return filteredTenants.value.slice(start, end);
});

/* --------------------------------------------- Actions */
function openCreate() {
  selectedTenant.value = null;
  nameInput.value = "";
  isEditMode.value = false;
  showModal.value = true;
}

function openEdit(t: { id: string; tenantName: string }) {
  selectedTenant.value = t;
  nameInput.value = t.tenantName;
  isEditMode.value = true;
  showModal.value = true;
}

function saveTenant() {
  if (!nameInput.value.trim()) return;

  if (isEditMode.value && selectedTenant.value) {
    TenantService.renameTenant(selectedTenant.value.id, nameInput.value.trim());
    debugLog("[AdminTenantsView] renameTenant", {
      id: selectedTenant.value.id,
      name: nameInput.value.trim(),
    });
  } else {
    const t = TenantService.createTenant(nameInput.value.trim());
    debugLog("[AdminTenantsView] createTenant", { id: t.id });
  }

  showModal.value = false;
  selectedTenant.value = null;
  nameInput.value = "";
}

function confirmDelete(id: string) {
  deleteTargetId.value = id;
  showDeleteModal.value = true;
}

function deleteTenant() {
  if (deleteTargetId.value) {
    TenantService.deleteTenant(deleteTargetId.value);
    debugLog("[AdminTenantsView] deleteTenant", { id: deleteTargetId.value });
  }
  showDeleteModal.value = false;
  deleteTargetId.value = null;
}

function lokalDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE");
}
</script>

<template>
  <div class="max-w-5xl mx-auto flex flex-col min-h-screen py-8">
    <!-- Header -->
    <div
      class="flex flex-wrap md:flex-nowrap justify-between items-center mb-6"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Mandanten verwalten</h2>

      <SearchGroup
        btnRight="Neu"
        btnRightIcon="mdi:plus"
        @search="(q) => (searchQuery = q)"
        @btn-right-click="openCreate"
      />
    </div>

    <!-- Card -->
    <div class="card w-full bg-base-100 border border-base-300 shadow-md">
      <div class="card-body">
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th class="hidden sm:table-cell">Erstellt</th>
                <th class="hidden sm:table-cell">Geändert</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in paginated" :key="t.id">
                <td>{{ t.tenantName }}</td>
                <td class="hidden sm:table-cell">
                  {{ lokalDate(t.createdAt) }}
                </td>
                <td class="hidden sm:table-cell">
                  {{ lokalDate(t.updatedAt) }}
                </td>
                <td class="text-right">
                  <div class="flex justify-end space-x-1">
                    <button
                      class="btn btn-ghost btn-sm text-secondary"
                      @click="openEdit(t)"
                    >
                      <Icon icon="mdi:pencil" class="text-base" />
                    </button>
                    <button
                      class="btn btn-ghost btn-sm text-error"
                      @click="confirmDelete(t.id)"
                    >
                      <Icon icon="mdi:trash-can" class="text-base" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <PagingComponent
          :currentPage="currentPage"
          :totalPages="totalPages"
          :itemsPerPage="itemsPerPage"
          @update:currentPage="(val) => (currentPage = val)"
          @update:itemsPerPage="(val) => (itemsPerPage = val)"
        />
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <dialog v-if="showModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          {{ isEditMode ? "Mandant bearbeiten" : "Neuer Mandant" }}
        </h3>

        <input
          v-model.trim="nameInput"
          type="text"
          placeholder="Name des Mandanten"
          class="input input-bordered w-full mb-4"
        />

        <div class="modal-action">
          <button class="btn" @click="showModal = false">Abbrechen</button>
          <button class="btn btn-primary" @click="saveTenant">Speichern</button>
        </div>
      </div>
      <div class="modal-backdrop bg-black/30" @click="showModal = false"></div>
    </dialog>

    <!-- Delete Confirmation -->
    <ConfirmationModal
      v-if="showDeleteModal"
      title="Mandant löschen"
      message="Möchtest Du diesen Mandanten wirklich löschen?"
      confirmText="Löschen"
      cancelText="Abbrechen"
      @confirm="deleteTenant"
      @cancel="showDeleteModal = false"
    />
  </div>
</template>
