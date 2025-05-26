// src/services/TenantService.ts
/**
 * TenantService – zentrale API für Mandanten-Management.
 */

import { useTenantStore }   from '@/stores/tenantStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore }  from '@/stores/accountStore';
import { useSessionStore }  from '@/stores/sessionStore';

import { CategoryService }  from '@/services/CategoryService';
import { AccountService }   from '@/services/AccountService';
import { BalanceService }   from '@/services/BalanceService';

import { AccountType }      from '@/types';
import { infoLog, debugLog, errorLog } from '@/utils/logger';
import { DataService }      from './DataService';

export const TenantService = {
  /**
   * Erstellt einen neuen Tenant und legt Basis-Kategorien, Konten-Gruppen und Girokonto an.
   */
  async createTenant(tenantName: string) {
    const session = useSessionStore();
    if (!session.currentUserId)
      throw new Error('Kein eingeloggter User');

    const tenant = await useTenantStore().addTenant(tenantName, session.currentUserId);
    if (!tenant)
      throw new Error('Fehler beim lokalen Anlegen des Tenants.');

    this.switchTenant(tenant.uuid);

    const catStore = useCategoryStore();
    const accStore = useAccountStore();

    if (!catStore.categories.find(c => c.name === 'Verfügbare Mittel')) {
      CategoryService.addCategory({
        name: 'Verfügbare Mittel',
        parentCategoryId: undefined,
        sortOrder: 0,
        isActive: true,
        isIncomeCategory: true,
        isSavingsGoal: false,
        categoryGroupId: undefined,
      });
    }

    const incomeGroup = catStore.categoryGroups.find(g => g.name === 'Einnahmen')
      ?? catStore.addCategoryGroup({ name: 'Einnahmen', sortOrder: 0, isIncomeGroup: true });

    const expenseGroup = catStore.categoryGroups.find(g => g.name === 'Ausgaben')
      ?? catStore.addCategoryGroup({ name: 'Ausgaben', sortOrder: 1, isIncomeGroup: false });

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
          parentCategoryId: undefined,
          sortOrder: 0,
          isActive: true,
          isIncomeCategory: dc.groupId === incomeGroup.id,
          isSavingsGoal: false,
          categoryGroupId: dc.groupId,
        });
      }
    }

    const defaultGroups = [
      { name: 'Girokonten', sortOrder: 0 },
      { name: 'Sparkonten', sortOrder: 1 },
    ];
    for (const gd of defaultGroups) {
      if (!accStore.accountGroups.find(g => g.name === gd.name)) {
        accStore.addAccountGroup({ name: gd.name, sortOrder: gd.sortOrder });
      }
    }

    const giroGroup = accStore.accountGroups.find(g => g.name === 'Girokonten');
    if (!giroGroup) {
      errorLog('[TenantService]', 'Basis-Kontengruppe "Girokonten" nicht gefunden.');
    } else if (!accStore.accounts.find(a => a.name === 'Girokonto')) {
      AccountService.addAccount({
        name: 'Girokonto',
        description: '',
        note: '',
        accountType: AccountType.CHECKING,
        isActive: true,
        isOfflineBudget: false,
        accountGroupId: giroGroup.id,
        sortOrder: 0,
        iban: '',
        creditLimit: 0,
        offset: 0,
        image: '',
      });
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
    const ok = await useSessionStore().switchTenant(tenantId);
    if (ok) {
      DataService.reloadTenantData();
    }
    return ok;
  },

  getOwnTenants() {
    const session = useSessionStore();
    if (!session.currentUserId) return [];
    return useTenantStore().getTenantsByUser(session.currentUserId);
  },

  ensureTenantSelected(): boolean {
    const session = useSessionStore();
    const ok = !!session.currentTenantId;
    if (!ok) debugLog('[TenantService]', 'Kein Tenant aktiv – Auswahl erforderlich');
    return ok;
  },
};
