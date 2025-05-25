<!-- src/views/auth/TenantSelectView.vue -->
<script setup lang="ts">
/**
 * Pfad: src/views/auth/TenantSelectView.vue
 * Listet alle Tenants des eingeloggten Users,
 * erlaubt Auswahl oder Neuanlage.
 */

import { ref, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import { TenantService } from "@/services/TenantService";
import { useSessionStore } from "@/stores/sessionStore";
import { debugLog } from "@/utils/logger";

const router = useRouter();
const session = useSessionStore();

const newTenantName = ref("");
const showCreate = ref(false);

const tenants = computed(() => TenantService.getOwnTenants());

function selectTenant(id: string) {
  TenantService.switchTenant(id);
  router.push("/");
}

async function createTenant() {
  if (!newTenantName.value.trim()) return;
  const tenant = TenantService.createTenant(newTenantName.value);
  debugLog("[TenantSelectView] tenant created", { id: tenant.id });
  newTenantName.value = "";
  showCreate.value = false;
  // Auswahl wurde schon im Service gesetzt
  router.push("/");
}

nextTick(() => {
  // Falls bereits ein Tenant aktiv ist → sofort weiter
  if (session.currentTenantId) router.push("/");
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="card w-full max-w-md bg-base-100 border border-base-300 shadow">
      <div class="card-body space-y-4">
        <h2 class="text-xl font-bold text-center">Mandant wählen</h2>

        <template v-if="tenants.length">
          <ul class="menu w-full">
            <li
              v-for="t in tenants"
              :key="t.id"
              @click="selectTenant(t.id)"
              class="rounded-box cursor-pointer hover:bg-base-200"
            >
              <span>{{ t.tenantName }}</span>
            </li>
          </ul>
        </template>

        <p v-else class="text-center opacity-70">
          Noch kein Mandant vorhanden.
        </p>

        <button
          class="btn btn-primary w-full"
          @click="showCreate = !showCreate"
        >
          {{ showCreate ? "Abbrechen" : "Neuen Mandanten anlegen" }}
        </button>

        <div v-if="showCreate" class="space-y-3">
          <input
            v-model.trim="newTenantName"
            type="text"
            placeholder="Name des Mandanten"
            class="input input-bordered w-full"
            autocomplete="off"
          />
          <button class="btn btn-secondary w-full" @click="createTenant">
            Anlegen & wechseln
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
