// src/services/TenantService.ts
/**
 * TenantService – zentrale API für Mandanten-Management.
 */

import { useTenantStore } from '@/stores/tenantStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useSessionStore } from '@/stores/sessionStore';

import { CategoryService } from '@/services/CategoryService';
import { AccountService } from '@/services/AccountService';
import { BalanceService } from '@/services/BalanceService';
import { SessionService } from '@/services/SessionService';

import { infoLog, debugLog, errorLog, warnLog } from '@/utils/logger';
import { DataService } from './DataService';
import { apiService } from './apiService';

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
      { name: 'Gehalt', groupId: incomeGroup.id },
      { name: 'Sonstige Einnahmen', groupId: incomeGroup.id },
      { name: 'Freier Verbrauch', groupId: expenseGroup.id },
      { name: 'Gesundheitswesen', groupId: expenseGroup.id },
      { name: 'Haushalt', groupId: expenseGroup.id },
      { name: 'Hobby', groupId: expenseGroup.id },
      { name: 'Fuhrpark', groupId: expenseGroup.id },
      { name: 'Versicherung', groupId: expenseGroup.id },
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

    BalanceService.calculateAllMonthlyBalances();

    infoLog('[TenantService]', 'Tenant angelegt & initialisiert', {
      tenantId: tenant.uuid,
      tenantName,
    });
    return tenant;
  },

  async renameTenant(tenantId: string, newName: string): Promise<boolean> {
    try {
      const session = useSessionStore();
      if (!session.currentUserId) {
        throw new Error('Kein eingeloggter User');
      }

      // Backend-API aufrufen
      await apiService.updateTenant(tenantId, { name: newName }, session.currentUserId);

      // Lokalen Store aktualisieren
      const success = await useTenantStore().updateTenant(tenantId, newName);

      if (success) {
        infoLog('TenantService', `Mandant ${tenantId} erfolgreich umbenannt zu "${newName}"`);
      }

      return success;
    } catch (error) {
      errorLog('TenantService', `Fehler beim Umbenennen des Mandanten ${tenantId}`, { error });
      return false;
    }
  },

  async deleteTenant(tenantId: string): Promise<boolean> {
    return useTenantStore().deleteTenant(tenantId);
  },

  async switchTenant(tenantId: string): Promise<boolean> {
    debugLog('[TenantService] switchTenant', JSON.stringify({ tenantId }));
    const ok = await useSessionStore().switchTenant(tenantId);
    if (ok) {
      await DataService.reloadTenantData();
      // Logo-Cache nach Mandantenwechsel aktualisieren
      await SessionService.preloadLogosForTenant();
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

  /**
   * Löscht einen Mandanten vollständig (Backend + Frontend)
   * Bei aktivem Mandanten: Logout + IndexedDB löschen + Redirect
   * Bei inaktivem Mandanten: Nur Backend-Löschung
   */
  async deleteTenantCompletely(tenantId: string, router?: any): Promise<boolean> {
    try {
      const session = useSessionStore();
      const tenantStore = useTenantStore();

      if (!session.currentUserId) {
        throw new Error('Kein eingeloggter User');
      }

      const isActiveTenant = session.currentTenantId === tenantId;

      infoLog('TenantService', `Lösche Mandant ${tenantId} vollständig`, {
        isActiveTenant,
        currentUserId: session.currentUserId
      });

      // Backend-API aufrufen - löscht auch die Tenant-Datenbank
      await apiService.deleteTenantCompletely(tenantId, session.currentUserId);

      // Lokalen Mandanten aus Store entfernen
      await tenantStore.deleteTenant(tenantId);

      if (isActiveTenant) {
        // Bei aktivem Mandanten: IndexedDB löschen
        try {
          const tenantDbService = new (await import('./TenantDbService')).TenantDbService();
          await tenantDbService.deleteTenantDatabase();
        } catch (dbError) {
          warnLog('TenantService', 'Fehler beim Löschen der IndexedDB, fahre fort', { error: dbError });
        }

        // Mandant aus Session entfernen (OHNE User-Logout)
        session.currentTenantId = null;

        // Optional: Router-Redirect (wird von aufrufender Komponente gesteuert)
        if (router) {
          debugLog('TenantService', 'Router-Redirect wird von aufrufender Komponente gesteuert');
        }
      }

      infoLog('TenantService', `Mandant ${tenantId} erfolgreich gelöscht`);
      return true;

    } catch (error) {
      errorLog('TenantService', `Fehler beim Löschen des Mandanten ${tenantId}`, { error });
      return false;
    }
  },

  /**
   * Setzt die Datenbank eines Mandanten zurück
   * Löscht lokale IndexedDB und führt Firstload durch
   */
  async resetTenantDatabase(tenantId: string, router?: any): Promise<boolean> {
    try {
      debugLog('TenantService', `resetTenantDatabase aufgerufen für Mandant ${tenantId}`);

      const session = useSessionStore();
      const tenantStore = useTenantStore();

      if (!session.currentUserId) {
        throw new Error('Kein eingeloggter User');
      }

      const isActiveTenant = session.currentTenantId === tenantId;

      // Mandanten-Name für Neuanlage merken
      const tenant = tenantStore.tenants.find(t => t.uuid === tenantId);
      if (!tenant) {
        throw new Error(`Mandant ${tenantId} nicht gefunden`);
      }

      const tenantName = tenant.tenantName;

      infoLog('TenantService', `Setze Mandant ${tenantId} ("${tenantName}") komplett zurück (löschen + neu anlegen)`, {
        isActiveTenant,
        currentUserId: session.currentUserId
      });

      // Schritt 1: Mandanten komplett löschen (Backend + Frontend)
      debugLog('TenantService', `Lösche Mandant ${tenantId} komplett`);
      await this.deleteTenantCompletely(tenantId);
      debugLog('TenantService', `Mandant ${tenantId} erfolgreich gelöscht`);

      // Schritt 2: Neuen Mandanten mit gleichem Namen anlegen
      debugLog('TenantService', `Lege neuen Mandanten "${tenantName}" an`);
      const newTenant = await this.createTenant(tenantName);
      debugLog('TenantService', `Neuer Mandant "${tenantName}" erfolgreich angelegt mit ID ${newTenant.uuid}`);

      // Schritt 3: Zur TenantSelectView navigieren
      if (router) {
        debugLog('TenantService', `Navigiere zur TenantSelectView`);
        router.push('/tenant-select');
      }

      infoLog('TenantService', `Mandant "${tenantName}" erfolgreich zurückgesetzt (gelöscht und neu angelegt)`);
      return true;

    } catch (error) {
      errorLog('TenantService', `Fehler beim Zurücksetzen des Mandanten ${tenantId}`, { error });
      return false;
    }
  },

  /**
   * Löscht die Sync-Queue eines Mandanten
   */
  async clearSyncQueue(tenantId: string): Promise<boolean> {
    try {
      const session = useSessionStore();

      if (!session.currentUserId) {
        throw new Error('Kein eingeloggter User');
      }

      const isActiveTenant = session.currentTenantId === tenantId;

      infoLog('TenantService', `Lösche Sync-Queue für Mandant ${tenantId}`, {
        isActiveTenant,
        currentUserId: session.currentUserId
      });

      // Backend-API aufrufen
      debugLog('TenantService', `Rufe Backend-API clearTenantSyncQueue auf für Mandant ${tenantId}`);
      await apiService.clearTenantSyncQueue(tenantId, session.currentUserId);
      debugLog('TenantService', `Backend-API clearTenantSyncQueue erfolgreich für Mandant ${tenantId}`);

      if (isActiveTenant) {
        // Lokale SyncQueue löschen
        debugLog('TenantService', `Lösche lokale SyncQueue für aktiven Mandant ${tenantId}`);
        const tenantDbService = new (await import('./TenantDbService')).TenantDbService();
        await tenantDbService.clearSyncQueue();
        debugLog('TenantService', `Lokale SyncQueue erfolgreich gelöscht für Mandant ${tenantId}`);

        // KRITISCH: Nach dem Löschen der SyncQueue sollte eine Initial Data Load ausgelöst werden
        debugLog('TenantService', `Löse Initial Data Load aus für Mandant ${tenantId}`);
        const { WebSocketService } = await import('./WebSocketService');
        WebSocketService.requestInitialData(tenantId);
        debugLog('TenantService', `Initial Data Load angefordert für Mandant ${tenantId}`);
      }

      infoLog('TenantService', `Sync-Queue für Mandant ${tenantId} erfolgreich gelöscht und Synchronisation ausgelöst`);
      return true;

    } catch (error) {
      errorLog('TenantService', `Fehler beim Löschen der Sync-Queue für Mandant ${tenantId}`, { error });
      return false;
    }
  },

  /**
   * Setzt einen Mandanten in den Urzustand zurück (löschen + neu anlegen)
   * Bei aktivem Mandanten: Logout + Redirect zu TenantSelectView
   */
  async resetTenantToInitialState(tenantId: string, router?: any): Promise<boolean> {
    try {
      const session = useSessionStore();
      const tenantStore = useTenantStore();

      if (!session.currentUserId) {
        throw new Error('Kein eingeloggter User');
      }

      // Mandanten-Name für Neuanlage merken
      const tenant = tenantStore.tenants.find(t => t.uuid === tenantId);
      if (!tenant) {
        throw new Error(`Mandant ${tenantId} nicht gefunden`);
      }

      const tenantName = tenant.tenantName;
      const isActiveTenant = session.currentTenantId === tenantId;

      infoLog('TenantService', `Setze Mandant ${tenantId} ("${tenantName}") in Urzustand zurück`, {
        isActiveTenant,
        currentUserId: session.currentUserId
      });

      // Backend-API aufrufen
      await apiService.resetTenantToInitialState(tenantId, session.currentUserId);

      if (isActiveTenant) {
        // Bei aktivem Mandanten: IndexedDB löschen und Logout
        try {
          const tenantDbService = new (await import('./TenantDbService')).TenantDbService();
          await tenantDbService.deleteTenantDatabase();
        } catch (dbError) {
          warnLog('TenantService', 'Fehler beim Löschen der IndexedDB, fahre mit Logout fort', { error: dbError });
        }

        // Logout und Redirect zu TenantSelectView
        if (router) {
          const { SessionService } = await import('./SessionService');
          await SessionService.logoutWithCleanupAndRedirect(router);
          // Nach Logout zu TenantSelectView navigieren
          router.push('/tenant-select');
        } else {
          session.logout();
        }
      } else {
        // Bei inaktivem Mandanten: Nur lokalen Store aktualisieren
        await tenantStore.loadTenants();
      }

      infoLog('TenantService', `Mandant ${tenantId} erfolgreich in Urzustand zurückgesetzt`);
      return true;

    } catch (error) {
      errorLog('TenantService', `Fehler beim Zurücksetzen des Mandanten ${tenantId} in Urzustand`, { error });
      return false;
    }
  },
};
