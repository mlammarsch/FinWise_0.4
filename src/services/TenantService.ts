// src/services/TenantService.ts
/**
 * TenantService – zentrale API für Mandanten-Management.
 */

import { useTenantStore }   from '@/stores/tenantStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useSessionStore }  from '@/stores/sessionStore'; // useAccountStore entfernt, da nicht mehr direkt hier genutzt

import { CategoryService }  from '@/services/CategoryService';
import { AccountService }   from '@/services/AccountService';
import { BalanceService }   from '@/services/BalanceService';

// AccountType, AccountGroup und uuidv4 entfernt, da Logik in AccountService verschoben
import { infoLog, debugLog, errorLog } from '@/utils/logger';
import { DataService }      from './DataService';
// import { v4 as uuidv4 } from 'uuid'; // Entfernt

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

    await this.switchTenant(tenant.uuid); // Warten bis switchTenant abgeschlossen ist

    const catStore = useCategoryStore();
    // const accStore = useAccountStore(); // Entfernt, Logik in AccountService

    // Initialisierung der Standard-Kategorien (bleibt hier)
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
      ?? await catStore.addCategoryGroup({ name: 'Einnahmen', sortOrder: 0, isIncomeGroup: true }); // await hinzugefügt

    const expenseGroup = catStore.categoryGroups.find(g => g.name === 'Ausgaben')
      ?? await catStore.addCategoryGroup({ name: 'Ausgaben', sortOrder: 1, isIncomeGroup: false }); // await hinzugefügt

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
        CategoryService.addCategory({ // Annahme: addCategory ist asynchron oder synchronisiert den Store korrekt
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

    // Initialisierung der Standard-Kontogruppen und des Girokontos über den AccountService
    // Dies geschieht nach switchTenant und der Initialisierung der Kategorien
    try {
      await AccountService.initializeDefaultAccountsAndGroups();
      debugLog('[TenantService]', 'Standardkonten und -gruppen erfolgreich initialisiert.');
    } catch (err) {
      errorLog('[TenantService]', 'Fehler bei der Initialisierung der Standardkonten und -gruppen.', { error: err });
      // Hier könnte man überlegen, ob der Tenant trotzdem als "erstellt" gilt oder ob ein Rollback nötig ist.
      // Fürs Erste wird der Fehler geloggt und der Prozess fortgesetzt.
    }

    BalanceService.calculateMonthlyBalances(); // Bleibt hier, da es nach allen Datenänderungen erfolgen sollte

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
