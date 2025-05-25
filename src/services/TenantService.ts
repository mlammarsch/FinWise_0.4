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
import { infoLog, debugLog } from '@/utils/logger';
import { DataService }      from './DataService';

export const TenantService = {
  /* ------------------------------------------- Create Tenant */
  createTenant(tenantName: string) {
    const session = useSessionStore();
    if (!session.currentUserId)
      throw new Error('Kein eingeloggter User');

    /* 1. Tenant-Objekt erstellen (TenantStore) */
    const tenant = useTenantStore().addTenant(
      tenantName,
      session.currentUserId,
    );

    /* 2. Tenant aktivieren + Stores neu laden */
    this.switchTenant(tenant.id);

    /* 3. Stores erneut referenzieren */
    const catStore = useCategoryStore();
    const accStore = useAccountStore();

    /* -------------------- Basis-Kategorien -------------------- */

    // 1. Kategorie „Verfügbare Mittel“
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

    // 2. Kategorie-Gruppen Einnahmen / Ausgaben
    const incomeGroup = catStore.categoryGroups.find(g => g.name === 'Einnahmen')
      ?? catStore.addCategoryGroup({
           name: 'Einnahmen',
           sortOrder: 0,
           isIncomeGroup: true,
         });

    const expenseGroup = catStore.categoryGroups.find(g => g.name === 'Ausgaben')
      ?? catStore.addCategoryGroup({
           name: 'Ausgaben',
           sortOrder: 1,
           isIncomeGroup: false,
         });

    // 3. Standard-Kategorien anlegen
    [
      { name: 'Gehalt',             groupId: incomeGroup.id },
      { name: 'Sonstige Einnahmen', groupId: incomeGroup.id },
      { name: 'Freier Verbrauch',   groupId: expenseGroup.id },
      { name: 'Gesundheitswesen',   groupId: expenseGroup.id },
      { name: 'Haushalt',           groupId: expenseGroup.id },
      { name: 'Hobby',              groupId: expenseGroup.id },
      { name: 'Fuhrpark',           groupId: expenseGroup.id },
      { name: 'Versicherung',       groupId: expenseGroup.id },
    ].forEach(dc => {
      if (!catStore.categories.some(c => c.name === dc.name)) {
        CategoryService.addCategory({
          name: dc.name,
          parentCategoryId: null,
          sortOrder: 0,
          isActive: true,
          isIncomeCategory: dc.groupId === incomeGroup.id,
          isSavingsGoal: false,
          categoryGroupId: dc.groupId,
        });
      }
    });

    /* ------------------ Basis-Konten-Gruppen ------------------ */

    const defaultGroups = [
      { name: 'Girokonten', sortOrder: 0 },
      { name: 'Sparkonten', sortOrder: 1 },
    ];
    defaultGroups.forEach(gd => {
      if (!accStore.accountGroups.find(g => g.name === gd.name)) {
        accStore.addAccountGroup({
          name: gd.name,
          sortOrder: gd.sortOrder,
        });
      }
    });

    /* ---------------------- Basis-Konto ----------------------- */

    const giroGroup = accStore.accountGroups.find(g => g.name === 'Girokonten')!;
    if (!accStore.accounts.find(a => a.name === 'Girokonto')) {
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

    /* 4. Monats-Bilanzen initial berechnen */
    BalanceService.calculateMonthlyBalances();

    infoLog('[TenantService]', 'Tenant angelegt & initialisiert', {
      tenantId: tenant.id,
      tenantName,
    });
    return tenant;
  },

  /* ------------------------------------------- Rename Tenant */
  renameTenant(tenantId: string, newName: string): boolean {
    return useTenantStore().updateTenant(tenantId, newName);
  },

  /* ------------------------------------------- Delete Tenant */
  deleteTenant(tenantId: string): boolean {
    return useTenantStore().deleteTenant(tenantId);
  },

  /* ------------------------------------------- Switch Tenant */
  switchTenant(tenantId: string): boolean {
    const ok = useSessionStore().switchTenant(tenantId);
    if (ok) {
      DataService.reloadTenantData();
    }
    return ok;
  },

  /* -------------------------------- Liste eigener Tenants */
  getOwnTenants() {
    const session = useSessionStore();
    if (!session.currentUserId) return [];
    return useTenantStore().getTenantsByUser(session.currentUserId);
  },

  /* -------------------------------- ensure helper */
  ensureTenantSelected(): boolean {
    const session = useSessionStore();
    const ok = !!session.currentTenantId;
    if (!ok) debugLog('[TenantService] Kein Tenant aktiv – Auswahl erforderlich');
    return ok;
  },
};
