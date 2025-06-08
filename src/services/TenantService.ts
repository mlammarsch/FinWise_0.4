// src/services/TenantService.ts
/**
 * TenantService – zentrale API für Mandanten-Management.
 */

import { useTenantStore }   from '@/stores/tenantStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useSessionStore }  from '@/stores/sessionStore';

import { CategoryService }  from '@/services/CategoryService';
import { AccountService }   from '@/services/AccountService';
import { BalanceService }   from '@/services/BalanceService';

import { infoLog, debugLog, errorLog } from '@/utils/logger';
import { DataService }      from './DataService';

export const TenantService = {
  /**
   * Erstellt einen neuen Tenant mit Standardkategorien und -konten.
   */
  async createTenant(tenantName: string) {
    const session = useSessionStore();
    if (!session.currentUserId)
      throw new Error('Kein eingeloggter User');

    const tenant = await useTenantStore().addTenant(tenantName, session.currentUserId);
    if (!tenant)
      throw new Error('Fehler beim lokalen Anlegen des Tenants.');

    await this.switchTenant(tenant.uuid);

    const catStore = useCategoryStore();

    if (!catStore.categories.find(c => c.name === 'Verfügbare Mittel')) {
      CategoryService.addCategory({
        name: 'Verfügbare Mittel',
        sortOrder: 0,
        isActive: true,
        isIncomeCategory: true,
        categoryGroupId: undefined,
        budgeted: 0,
        activity: 0,
        available: 0,
        isHidden: false,
      });
    }

    const incomeGroup = catStore.categoryGroups.find(g => g.name === 'Einnahmen')
      ?? await catStore.addCategoryGroup({ name: 'Einnahmen', sortOrder: 0, isIncomeGroup: true });

    const expenseGroup = catStore.categoryGroups.find(g => g.name === 'Ausgaben')
      ?? await catStore.addCategoryGroup({ name: 'Ausgaben', sortOrder: 1, isIncomeGroup: false });

    for (const dc of [
      { name: 'Gehalt',             groupId: incomeGroup.id },
      { name: 'Sonstige Einnahmen', groupId: incomeGroup.id },
      { name: 'Freier Verbrauch',   groupId: expenseGroup.id },
      { name: 'Gesundheitswesen',   groupId: expenseGroup.id },
      { name: 'Haushalt',           groupId: expenseGroup.id },
      { name: 'Hobby',              groupId: expenseGroup.id },
      { name: 'Fuhrpark',           groupId: expenseGroup.id },
      { name: 'Versicherung',       groupId: expenseGroup.id },
    ]) {
      if (!catStore.categories.some(c => c.name === dc.name)) {
        CategoryService.addCategory({
          name: dc.name,
          sortOrder: 0,
          isActive: true,
          isIncomeCategory: dc.groupId === incomeGroup.id,
          categoryGroupId: dc.groupId,
          budgeted: 0,
          activity: 0,
          available: 0,
          isHidden: false,
        });
      }
    }

    try {
      await AccountService.initializeDefaultAccountsAndGroups();
      debugLog('[TenantService]', 'Standardkonten und -gruppen erfolgreich initialisiert.');
    } catch (err) {
      errorLog('[TenantService]', 'Fehler bei der Initialisierung der Standardkonten und -gruppen.', { error: err });
    }

    BalanceService.calculateMonthlyBalances();

    infoLog('[TenantService]', 'Tenant angelegt & initialisiert', {
      tenantId: tenant.uuid,
      tenantName,
    });
    return tenant;
  },

  async renameTenant(tenantId: string, newName: string): Promise<boolean> {
    return useTenantStore().updateTenant(tenantId, newName);
  },

  async deleteTenant(tenantId: string): Promise<boolean> {
    return useTenantStore().deleteTenant(tenantId);
  },

  async switchTenant(tenantId: string): Promise<boolean> {
    debugLog('[TenantService] switchTenant', JSON.stringify({ tenantId }));
    const ok = await useSessionStore().switchTenant(tenantId);
    if (ok) {
      DataService.reloadTenantData();
    }
    return ok;
  },

  getOwnTenants() {
    const session = useSessionStore();
    if (!session.currentUserId) {
      debugLog('[TenantService] getOwnTenants', 'Kein eingeloggter User, gibt leeres Array zurück');
      return [];
    }
    const tenants = useTenantStore().getTenantsByUser(session.currentUserId);
    debugLog('[TenantService] getOwnTenants', JSON.stringify({ tenantCount: tenants.length, tenants: tenants.map(t => ({ id: t.uuid, name: t.tenantName })) }));
    return tenants;
  },

  ensureTenantSelected(): boolean {
    const session = useSessionStore();
    const ok = !!session.currentTenantId;
    if (!ok) debugLog('[TenantService]', 'Kein Tenant aktiv – Auswahl erforderlich');
    return ok;
  },
};
