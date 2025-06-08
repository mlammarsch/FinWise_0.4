// src/stores/userStore.ts
/**
 * Pfad zur Datei: src/stores/userStore.ts
 * Pinia-Store zum Verwalten aller lokalen User-Accounts via Dexie.
 * Password-Hashing via bcryptjs (vorerst beibehalten).
 */

import { defineStore } from 'pinia';
import { ref, computed, onMounted } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import Dexie, { type Table } from 'dexie';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { apiService, type UserFromApi, type TenantFromApi } from '@/services/apiService';
import { useSessionStore } from './sessionStore'; // Importiere sessionStore
import { useTenantStore } from './tenantStore'; // Hinzugefügter und korrigierter Import

// Schnittstelle für Daten, die zum Backend gepusht werden
interface UserPushData {
  name: string;
  email: string;
  hashed_password?: string; // Angepasst an Backend-Schema UserSyncPayload
}

// Schnittstellen
export interface LocalUser { // Bleibt für den State und Methoden-Signaturen, die nicht direkt DB-Struktur widerspiegeln
  id: string; // uuid in der DB
  username: string; // wird zu 'name' in der DB
  email: string;
  passwordHash: string; // Nicht in DbUser gespeichert
  createdAt: string;
  updatedAt: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface DbUser { // Struktur für die Dexie 'users' Tabelle
  uuid: string; // Primärschlüssel
  username: string; // Geändert von name zu username
  email: string;
  createdAt: string;
  updatedAt: string;
  needsBackendSync?: boolean; // Flag, um lokale Erstellung/Änderung zu markieren
  passwordHash?: string; // Hinzugefügt für die persistente Speicherung des Hashes bei Offline-Registrierung
}

export interface DbTenant { // Struktur für die Dexie 'tenants' Tabelle
  uuid: string; // Primärschlüssel
  tenantName: string; // Geändert von name zu tenantName
  user_id: string; // Fremdschlüssel zu DbUser.uuid
  createdAt: string;
  updatedAt: string;
}

// Schnittstelle für die Dexie 'session' Tabelle
export interface DbSession {
  id: string; // Fester Schlüssel, z.B. 'currentSession'
  currentUserId: string | null;
  currentTenantId: string | null;
}

// Dexie Datenbankklasse für User-, globale Tenant- und Session-Daten
class FinwiseUserDB extends Dexie {
  dbUsers!: Table<DbUser, string>;
  dbTenants!: Table<DbTenant, string>;
  dbSession!: Table<DbSession, string>; // Neue Tabelle für Session-Daten

  constructor() {
    super('finwiseUserDB');
    // Erhöhe die Versionsnummer, da wir eine neue Tabelle hinzufügen und dbUsers erweitern
    this.version(3).stores({
      dbUsers: '&uuid, username, email, passwordHash, createdAt, updatedAt, needsBackendSync', // passwordHash hinzugefügt
      dbTenants: '&uuid, tenantName, user_id, createdAt, updatedAt', // name zu tenantName geändert
      dbSession: '&id', // Neue Tabelle mit 'id' als Primärschlüssel
    });
  }
}

export const db = new FinwiseUserDB(); // Exportiere die db-Instanz

/** Konstante SaltRounds gemäß Anforderung 1 = 9 */
const SALT_ROUNDS = 9;

export const useUserStore = defineStore('user', () => {
  /* ------------------------------------------------------------------ State */
  const users = ref<LocalUser[]>([]); // Hält die LocalUser-Objekte für die UI-Logik

  /* ---------------------------------------------------------------- Initialisierung */
  async function _loadUsersFromDb() {
    try {
      const dbUsersList = await db.dbUsers.toArray();
      users.value = dbUsersList.map((dbUser: DbUser) => ({
        id: dbUser.uuid,
        username: dbUser.username,
        email: dbUser.email,
        passwordHash: '',
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        accessToken: '',
        refreshToken: '',
      }));
      debugLog('userStore', '_loadUsersFromDb: Users geladen', { count: users.value.length });
    } catch (err) {
      errorLog('userStore', 'Fehler beim Laden der User aus der DB', err);
      users.value = [];
    }
  }

  onMounted(async () => {
    await _loadUsersFromDb();
    await syncUsers();
    const sessionStore = useSessionStore();
    if (sessionStore.currentUserId) {
      await syncUserTenants(sessionStore.currentUserId);
    }
  });

  /* ---------------------------------------------------------------- Getter */
  const getUserById = computed(() => (id: string) =>
    users.value.find(u => u.id === id),
  );

  const getUserByUsername = computed(() => (username: string) =>
    users.value.find(
      u => u.username.toLowerCase() === username.toLowerCase(),
    ),
  );

  /* ---------------------------------------------------------------- Actions */
  async function registerUser(
    username: string,
    email: string,
    plainPassword: string,
  ): Promise<LocalUser | null> {
    if (!username.trim() || !plainPassword.trim() || !email.trim()) {
      errorLog('userStore', 'registerUser: Ungültige Eingabe');
      return null;
    }

    const existingDbUserByEmail = await db.dbUsers.get({ email: email.trim().toLowerCase() });
    if (existingDbUserByEmail) {
      infoLog('userStore', 'registerUser: E-Mail bereits lokal registriert', { email });
      return null;
    }
    const existingDbUserByUsername = await db.dbUsers.where('username').equalsIgnoreCase(username.trim()).first();
     if (existingDbUserByUsername) {
       infoLog('userStore', 'registerUser: Username bereits lokal registriert', { username });
       return null;
     }

    const now = new Date().toISOString();
    const userId = uuidv4();

    try {
      infoLog('userStore', 'registerUser: Versuche Online-Registrierung...');
      const backendUser = await apiService.registerUserWithPassword({
        name: username.trim(),
        email: email.trim().toLowerCase(),
        password: plainPassword,
      });

      const newDbUser: DbUser = {
        uuid: backendUser.uuid,
        username: backendUser.name,
        email: backendUser.email,
        createdAt: backendUser.createdAt,
        updatedAt: backendUser.updatedAt,
        needsBackendSync: false,
      };

      const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      const newLocalUser: LocalUser = {
        id: newDbUser.uuid,
        username: newDbUser.username,
        email: newDbUser.email,
        passwordHash: hash,
        createdAt: newDbUser.createdAt,
        updatedAt: newDbUser.updatedAt,
        accessToken: '',
        refreshToken: '',
      };

      await db.dbUsers.put(newDbUser);
      users.value.push(newLocalUser);
      infoLog('userStore', 'registerUser: User erfolgreich online registriert und lokal gespeichert', { id: newDbUser.uuid, email: newDbUser.email });
      return newLocalUser;

    } catch (error) {
      errorLog('userStore', 'registerUser: Online-Registrierung fehlgeschlagen, versuche lokale Speicherung.', { error });

      const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      const newDbUser: DbUser = {
        uuid: userId,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hash,
        createdAt: now,
        updatedAt: now,
        needsBackendSync: true,
      };

      const newLocalUser: LocalUser = {
        id: newDbUser.uuid,
        username: newDbUser.username,
        email: newDbUser.email,
        passwordHash: hash,
        createdAt: newDbUser.createdAt,
        updatedAt: newDbUser.updatedAt,
        accessToken: '',
        refreshToken: '',
      };

      try {
        await db.dbUsers.add(newDbUser);
        users.value.push(newLocalUser);
        warnLog('userStore', 'registerUser: Online-Registrierung fehlgeschlagen, User lokal gespeichert (needsBackendSync=true)', { id: newDbUser.uuid, email: newDbUser.email });
        return newLocalUser;
      } catch (dbError) {
        errorLog('userStore', 'registerUser: Fehler beim lokalen Speichern des Users nach fehlgeschlagener Online-Registrierung', { error: dbError });
        return null;
      }
    }
  }

  async function validateLogin(
    usernameOrEmail: string,
    plainPassword: string,
  ): Promise<LocalUser | null> {
    const inputLower = usernameOrEmail.toLowerCase();

    try {
      infoLog('userStore', 'validateLogin: Versuche Online-Login...');
      const backendUser = await apiService.login({
        username_or_email: inputLower,
        password: plainPassword,
      });

      infoLog('userStore', 'validateLogin: Online-Login erfolgreich', { userId: backendUser.uuid });

      const dbUser: DbUser = {
        uuid: backendUser.uuid,
        username: backendUser.name,
        email: backendUser.email,
        createdAt: backendUser.createdAt,
        updatedAt: backendUser.updatedAt,
        needsBackendSync: false,
      };
      await db.dbUsers.put(dbUser);

      const localUser: LocalUser = {
        id: dbUser.uuid,
        username: dbUser.username,
        email: dbUser.email,
        passwordHash: '',
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        accessToken: backendUser.accessToken,
        refreshToken: backendUser.refreshToken,
      };
      const userIndex = users.value.findIndex(u => u.id === localUser.id);
      if (userIndex > -1) {
        users.value[userIndex] = localUser;
      } else {
        users.value.push(localUser);
      }

      // Mandanten synchronisieren, nachdem der User erfolgreich eingeloggt wurde
      // und bevor die Funktion zurückkehrt, damit TenantSelectView aktuelle Daten hat.
      infoLog('userStore', `validateLogin: Starte syncUserTenants für User ${localUser.id} nach erfolgreichem Login.`);
      await syncUserTenants(localUser.id);
      infoLog('userStore', `validateLogin: syncUserTenants für User ${localUser.id} abgeschlossen.`);

      return localUser;

    } catch (error) {
      errorLog('userStore', 'validateLogin: Online-Login fehlgeschlagen.', { error });

      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
         warnLog('userStore', 'validateLogin: Netzwerkfehler (vermutlich offline), versuche lokalen Lookup.');
         let dbUser: DbUser | undefined;

         dbUser = await db.dbUsers.where('email').equalsIgnoreCase(inputLower).first();

         if (!dbUser) {
           dbUser = await db.dbUsers.where('username').equalsIgnoreCase(inputLower).first();
         }

         if (dbUser) {
           infoLog('userStore', 'validateLogin: User lokal gefunden (Offline-Modus)', { userId: dbUser.uuid });
            const localUser: LocalUser = {
              id: dbUser.uuid,
              username: dbUser.username,
              email: dbUser.email,
              passwordHash: '',
              createdAt: dbUser.createdAt,
              updatedAt: dbUser.updatedAt,
              accessToken: '',
              refreshToken: '',
            };
           return localUser;
         }
         warnLog('userStore', 'validateLogin: User lokal nicht gefunden (Offline-Modus)', { usernameOrEmail });
         return null;
      }
      infoLog('userStore', 'validateLogin: Login fehlgeschlagen (falsche Credentials oder anderer API-Fehler).', { usernameOrEmail });
      return null;
    }
  }

  async function changePassword(
    userId: string,
    newPlainPassword: string,
  ): Promise<boolean> {
    const userIdx = users.value.findIndex(u => u.id === userId);
    if (userIdx === -1) {
      errorLog('userStore', 'changePassword: User nicht im State gefunden', { userId });
      return false;
    }

    const newHash = await bcrypt.hash(newPlainPassword, SALT_ROUNDS);
    users.value[userIdx].passwordHash = newHash;
    users.value[userIdx].updatedAt = new Date().toISOString();

    try {
      await db.dbUsers.update(userId, { updatedAt: new Date().toISOString() });
      infoLog('userStore', 'changePassword: User updatedAt in DB aktualisiert.', { id: userId });
    } catch (err) {
      errorLog('userStore', 'changePassword: Fehler beim Aktualisieren von updatedAt in DB.', { id: userId, error: err });
    }

    infoLog('userStore', 'changePassword: Passwort (lokal) geändert. Backend-Sync erforderlich.', { id: userId });
    return true;
  }

  async function deleteUser(userId: string): Promise<boolean> {
    try {
      await db.transaction('rw', db.dbUsers, db.dbTenants, async () => {
        await db.dbUsers.delete(userId);
        await db.dbTenants.where('user_id').equals(userId).delete();
      });
      users.value = users.value.filter(u => u.id !== userId);
      infoLog('userStore', 'deleteUser: User und zugehörige Tenants aus DB gelöscht', { id: userId });
      return true;
    } catch (err) {
      errorLog('userStore', 'deleteUser: Fehler beim Löschen des Users', { id: userId, error: err });
      return false;
    }
  }

  async function reset(): Promise<void> {
    try {
      await db.transaction('rw', db.dbUsers, db.dbTenants, async () => {
        await db.dbUsers.clear();
        await db.dbTenants.clear();
      });
      users.value = [];
      infoLog('userStore', 'reset: User- und Tenant-Tabellen in DB geleert.');
    } catch (err) {
      errorLog('userStore', 'reset: Fehler beim Leeren der DB-Tabellen', err);
    }
  }

  // --- Sync Implementierung ---
  async function syncUsers(): Promise<void> {
    infoLog('userStore', 'syncUsers: Starte User-Synchronisation');
    try {
      infoLog('userStore', 'syncUsers: Rufe User vom Backend ab...');
      const backendUsers = await apiService.getUsers();
      infoLog('userStore', 'syncUsers: User vom Backend erhalten', { count: backendUsers.length });

      const localDbUsers = await db.dbUsers.toArray();
      infoLog('userStore', 'syncUsers: Lokale User geladen', { count: localDbUsers.length });

      const usersToUpdateInDb: DbUser[] = [];
      const usersToAddToDb: DbUser[] = [];
      const usersToPushToBackend: DbUser[] = [];

      for (const bUser of backendUsers) {
        const lUser = localDbUsers.find(u => u.uuid === bUser.uuid);
        if (lUser) {
          const backendUpdatedAt = new Date(bUser.updatedAt).getTime();
          const localUpdatedAt = new Date(lUser.updatedAt).getTime();

          if (backendUpdatedAt > localUpdatedAt) {
            usersToUpdateInDb.push({
              uuid: bUser.uuid,
              username: bUser.name,
              email: bUser.email,
              createdAt: bUser.createdAt,
              updatedAt: bUser.updatedAt,
            });
          }
        } else {
          usersToAddToDb.push({
            uuid: bUser.uuid,
            username: bUser.name,
            email: bUser.email,
            createdAt: bUser.createdAt,
            updatedAt: bUser.updatedAt,
          });
        }
      }

      for (const lUser of localDbUsers) {
        const bUser = backendUsers.find(u => u.uuid === lUser.uuid);
        const localUpdatedAt = new Date(lUser.updatedAt).getTime();

        if (!bUser) {
          usersToPushToBackend.push(lUser);
        } else {
          const backendUpdatedAt = new Date(bUser.updatedAt).getTime();
          if (localUpdatedAt > backendUpdatedAt) {
            usersToPushToBackend.push(lUser);
          }
        }
      }

      if (usersToUpdateInDb.length > 0) {
        await db.dbUsers.bulkPut(usersToUpdateInDb);
        infoLog('userStore', 'syncUsers: Lokale User aktualisiert', { count: usersToUpdateInDb.length, users: usersToUpdateInDb.map(u => u.uuid) });
      }
      if (usersToAddToDb.length > 0) {
        await db.dbUsers.bulkAdd(usersToAddToDb);
        infoLog('userStore', 'syncUsers: Neue User lokal hinzugefügt', { count: usersToAddToDb.length, users: usersToAddToDb.map(u => u.uuid) });
      }

      for (const lUserToPush of usersToPushToBackend) {
        const bUser = backendUsers.find(u => u.uuid === lUserToPush.uuid);

        try {
          let backendUserResponse: UserFromApi;
          const userDataToPush: UserPushData = {
            name: lUserToPush.username,
            email: lUserToPush.email,
          };

          if (!bUser || lUserToPush.needsBackendSync) {
            infoLog('userStore', `syncUsers: Versuche, neuen lokalen User ${lUserToPush.uuid} zum Backend zu pushen.`);
            if (lUserToPush.passwordHash) {
              userDataToPush.hashed_password = lUserToPush.passwordHash;
              debugLog('userStore', `syncUsers: Sende hashed_password für neuen User ${lUserToPush.uuid}`);
            }
            backendUserResponse = await apiService.createUser({
              uuid: lUserToPush.uuid,
              ...userDataToPush,
            });
            await db.dbUsers.update(lUserToPush.uuid, {
              needsBackendSync: false,
              passwordHash: undefined,
              updatedAt: backendUserResponse.updatedAt
            });
            infoLog('userStore', `syncUsers: Neuer lokaler User ${lUserToPush.uuid} erfolgreich zum Backend gepusht und lokal aktualisiert.`);
          } else {
            infoLog('userStore', `syncUsers: Versuche, lokalen User ${lUserToPush.uuid} im Backend zu aktualisieren.`);
            backendUserResponse = await apiService.updateUser(lUserToPush.uuid, userDataToPush);
            await db.dbUsers.update(lUserToPush.uuid, {
              updatedAt: backendUserResponse.updatedAt
            });
            infoLog('userStore', `syncUsers: Lokaler User ${lUserToPush.uuid} erfolgreich im Backend aktualisiert.`);
          }
        } catch (error) {
          errorLog('userStore', `syncUsers: Fehler beim Pushen des Users ${lUserToPush.uuid} zum Backend.`, { error });
        }
      }
      await _loadUsersFromDb();
      infoLog('userStore', 'syncUsers: User-Synchronisation abgeschlossen.');

    } catch (error) {
      errorLog('userStore', 'syncUsers: Fehler bei der User-Synchronisation', { error });
    }
  }

  async function syncUserTenants(userId: string): Promise<void> {
    infoLog('userStore', `syncUserTenants: Starte Tenant-Synchronisation für User ${userId}`);
    try {
      const backendTenants: TenantFromApi[] = await apiService.getTenantsForUser(userId);
      infoLog('userStore', `syncUserTenants: Tenants für User ${userId} vom Backend erhalten`, { count: backendTenants.length });

      const localTenants = await db.dbTenants.where({ user_id: userId }).toArray();
      infoLog('userStore', `syncUserTenants: Lokale Tenants für User ${userId} geladen`, { count: localTenants.length });

      const tenantsToAddToDbLocal: DbTenant[] = [];
      const tenantsToUpdateInDbLocal: DbTenant[] = [];
      const tenantsToPushToBackend: DbTenant[] = [];

      for (const bTenant of backendTenants) {
        const lTenant = localTenants.find(t => t.uuid === bTenant.uuid);
        if (lTenant) {
          const backendUpdatedAt = new Date(bTenant.updatedAt).getTime();
          const localUpdatedAt = new Date(lTenant.updatedAt).getTime();
          if (backendUpdatedAt > localUpdatedAt) {
            tenantsToUpdateInDbLocal.push({
              uuid: bTenant.uuid,
              tenantName: bTenant.name,
              user_id: bTenant.user_id,
              createdAt: bTenant.createdAt,
              updatedAt: bTenant.updatedAt,
            });
          }
        } else {
          tenantsToAddToDbLocal.push({
            uuid: bTenant.uuid,
            tenantName: bTenant.name,
            user_id: bTenant.user_id,
            createdAt: bTenant.createdAt,
            updatedAt: bTenant.updatedAt,
          });
        }
      }

      for (const lTenant of localTenants) {
        const bTenant = backendTenants.find((t: TenantFromApi) => t.uuid === lTenant.uuid);
        if (!bTenant) {
          tenantsToPushToBackend.push(lTenant);
        } else {
          const localUpdatedAt = new Date(lTenant.updatedAt).getTime();
          const backendUpdatedAt = new Date(bTenant.updatedAt).getTime();
          if (localUpdatedAt > backendUpdatedAt) {
            tenantsToPushToBackend.push(lTenant);
          }
        }
      }

      if (tenantsToAddToDbLocal.length > 0) {
        await db.dbTenants.bulkAdd(tenantsToAddToDbLocal);
        infoLog('userStore', `syncUserTenants: Neue Tenants lokal hinzugefügt`, { userId, count: tenantsToAddToDbLocal.length, tenants: tenantsToAddToDbLocal.map(t => t.uuid) });
      }
      if (tenantsToUpdateInDbLocal.length > 0) {
        await db.dbTenants.bulkPut(tenantsToUpdateInDbLocal);
        infoLog('userStore', `syncUserTenants: Lokale Tenants aktualisiert`, { userId, count: tenantsToUpdateInDbLocal.length, tenants: tenantsToUpdateInDbLocal.map(t => t.uuid) });
      }

      for (const lTenantToPush of tenantsToPushToBackend) {
        try {
          infoLog('userStore', `syncUserTenants: Versuche, lokalen Tenant ${lTenantToPush.uuid} ("${lTenantToPush.tenantName}") zum Backend zu pushen.`);
          const payload = {
            uuid: lTenantToPush.uuid,
            name: lTenantToPush.tenantName,
            user_id: lTenantToPush.user_id,
          };
          const backendTenantResponse = await apiService.createTenant(payload);

          const updatedDbTenant: DbTenant = {
            uuid: backendTenantResponse.uuid,
            tenantName: backendTenantResponse.name,
            user_id: backendTenantResponse.user_id,
            createdAt: backendTenantResponse.createdAt,
            updatedAt: backendTenantResponse.updatedAt,
          };
          await db.dbTenants.put(updatedDbTenant);
          infoLog('userStore', 'syncUserTenants: Lokaler Tenant nach Push mit Backend-Daten aktualisiert', { tenantUuid: updatedDbTenant.uuid });

        } catch (error: unknown) {
          let errorMessage = 'Unbekannter Synchronisationsfehler beim Pushen des Tenants';
          if (error instanceof Error) {
            errorMessage = error.message;
            if (errorMessage.includes('already exists for this user')) {
               warnLog(
                'userStore',
                `syncUserTenants: Tenant ${lTenantToPush.uuid} ("${lTenantToPush.tenantName}") existiert bereits im Backend. Synchronisation wird als behandelt betrachtet.`,
                { tenantUuid: lTenantToPush.uuid, originalErrorMessage: errorMessage },
              );
              continue;
            }
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          errorLog('userStore', `syncUserTenants: Fehler beim Pushen des lokalen Tenants ${lTenantToPush.uuid} zum Backend: ${errorMessage}`, { rawError: error, tenantUuid: lTenantToPush.uuid, dataSent: {name: lTenantToPush.tenantName, user_id: lTenantToPush.user_id} });
        }
      }
      // Nachdem die lokale DB aktualisiert wurde und alle Push-Versuche erfolgt sind,
      // den tenantStore benachrichtigen, seine Liste neu aus der DB zu laden.
      const tenantStore = useTenantStore();
      await tenantStore.loadTenants();
      infoLog('userStore', `syncUserTenants: Tenant-Synchronisation für User ${userId} abgeschlossen und tenantStore.loadTenants() aufgerufen.`);

    } catch (error) {
      errorLog('userStore', `syncUserTenants: Fehler bei der Tenant-Synchronisation für User ${userId}`, { error });
    }
  }

  return {
    /* State */
    users,
    /* Getter */
    getUserById,
    getUserByUsername,
    /* Actions */
    registerUser,
    validateLogin,
    changePassword,
    deleteUser,
    reset,
    /* Sync Actions */
    syncUsers,
    syncUserTenants,
  };
});
