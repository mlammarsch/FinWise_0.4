// src/stores/tenantStore.ts
/**
 * Pinia-Store für Mandanten (Tenants).
 *
 * Jeder Tenant gehört genau einem User (userId-FK).
 * Persistenz in LocalStorage unter 'finwise_tenants'.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { debugLog, infoLog } from '@/utils/logger';
import { useAccountStore } from './accountStore';
import { useCategoryStore } from './categoryStore';
import { usePlanningStore } from './planningStore';
import { useTransactionStore } from './transactionStore';
import { useRecipientStore } from './recipientStore';
import { useTagStore } from './tagStore';
import { useRuleStore } from './ruleStore';
import { CategoryService } from '@/services/CategoryService';

export interface Tenant {
  id: string;
  tenantName: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export const useTenantStore = defineStore('tenant', () => {
  /* ---------------------------------------------------------------- State */
  const tenants         = ref<Tenant[]>([]);
  const activeTenantId  = ref<string | null>(null);

  /* -------------------------------------------------------------- Getters */
  const getTenantsByUser = computed(() => (userId: string) =>
    tenants.value.filter(t => t.userId === userId),
  );

  const activeTenant = computed(() =>
    tenants.value.find(t => t.id === activeTenantId.value) || null,
  );

  /* -------------------------------------------------------------- Actions */
  /**
   * Legt einen neuen Mandanten für einen User an.
   * Erstellt Basis-Kategorie „Verfügbare Mittel“, falls nicht vorhanden.
   */
  function addTenant(tenantName: string, userId: string): Tenant {
    const now = new Date().toISOString();
    const newTenant: Tenant = {
      id: uuidv4(),
      tenantName: tenantName.trim(),
      userId,
      createdAt: now,
      updatedAt: now,
    };
    tenants.value.push(newTenant);
    saveTenants();

    // Direkt aktiv schalten
    setActiveTenant(newTenant.id);

    // Basis-Kategorie sicherstellen
    const catStore = useCategoryStore();
    if (!catStore.categories.find(c => c.name === 'Verfügbare Mittel')) {
      CategoryService.addCategory({
        name: 'Verfügbare Mittel',
        parentCategoryId: null,
        sortOrder: 0,
        isActive: true,
        isIncomeCategory: true,
        isSavingsGoal: false,
        categoryGroupId: null,
      });
    }

    infoLog('[TenantStore]', `Neuer Tenant “${newTenant.tenantName}” angelegt`, {
      tenantId: newTenant.id,
      userId,
    });
    return newTenant;
  }

  /**
   * Ändert den Namen eines Tenants.
   */
  function updateTenant(id: string, tenantName: string): boolean {
    const idx = tenants.value.findIndex(t => t.id === id);
    if (idx === -1) return false;
    tenants.value[idx].tenantName = tenantName.trim();
    tenants.value[idx].updatedAt  = new Date().toISOString();
    saveTenants();

    debugLog('[TenantStore] updateTenant', {
      id,
      name: tenantName,
    });
    return true;
  }

  /**
   * Löscht einen Tenant inkl. aller fachlichen Daten.
   */
  function deleteTenant(id: string): boolean {
    const idx = tenants.value.findIndex(t => t.id === id);
    if (idx === -1) return false;

    // 1. Cascade-Delete aller Daten-Stores
    useAccountStore().reset();
    useTransactionStore().reset();
    useCategoryStore().reset();
    usePlanningStore().reset();
    useRecipientStore().reset();
    useTagStore().reset();
    useRuleStore().reset();

    // 2. Tenant entfernen
    tenants.value.splice(idx, 1);
    if (activeTenantId.value === id) activeTenantId.value = null;

    saveTenants();
    infoLog('[TenantStore]', 'Tenant gelöscht', { tenantId: id });
    return true;
  }

  /**
   * Setzt den aktiven Tenant (Router-Guard greift darauf zu).
   */
  function setActiveTenant(id: string): boolean {
    const exists = tenants.value.find(t => t.id === id);
    if (!exists) return false;
    activeTenantId.value = id;
    localStorage.setItem('finwise_activeTenant', id);

    infoLog('[TenantStore]', 'Tenant gewechselt', {
      tenantId: id,
      tenantName: exists.tenantName,
    });
    return true;
  }

  /* -------------------------------------------------------- Persistence */
  function loadTenants(): void {
    const raw = localStorage.getItem('finwise_tenants');
    if (raw) {
      try {
        tenants.value = JSON.parse(raw);
      } catch {
        tenants.value = [];
      }
    }
    activeTenantId.value =
      localStorage.getItem('finwise_activeTenant') || null;

    debugLog('[TenantStore] loadTenants', {
      count: tenants.value.length,
      activeTenantId: activeTenantId.value,
    });
  }

  function saveTenants(): void {
    localStorage.setItem('finwise_tenants', JSON.stringify(tenants.value));
  }

  function reset(): void {
    tenants.value = [];
    activeTenantId.value = null;
    loadTenants();
  }

  loadTenants();

  return {
    /* State */
    tenants,
    activeTenantId,

    /* Getter */
    getTenantsByUser,
    activeTenant,

    /* Actions */
    addTenant,
    updateTenant,
    deleteTenant,
    setActiveTenant,
    loadTenants,
    reset,
  };
});
