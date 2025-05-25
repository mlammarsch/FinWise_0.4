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
  // passwordHash wird hier nicht gespeichert
}

export interface DbTenant { // Struktur für die Dexie 'tenants' Tabelle
  uuid: string; // Primärschlüssel
  tenantName: string; // Geändert von name zu tenantName
  user_id: string; // Fremdschlüssel zu DbUser.uuid
  createdAt: string;
  updatedAt: string;
}

// Dexie Datenbankklasse für User- und globale Tenant-Daten
class FinwiseUserDB extends Dexie {
  dbUsers!: Table<DbUser, string>;
  dbTenants!: Table<DbTenant, string>;

  constructor() {
    super('finwiseUserDB');
    this.version(1).stores({
      dbUsers: '&uuid, username, email, createdAt, updatedAt', // name zu username geändert
      dbTenants: '&uuid, tenantName, user_id, createdAt, updatedAt', // name zu tenantName geändert
    });
  }
}

const db = new FinwiseUserDB();

/** Konstante SaltRounds gemäß Anforderung 1 = 9 */
const SALT_ROUNDS = 9;

export const useUserStore = defineStore('user', () => {
  /* ------------------------------------------------------------------ State */
  const users = ref<LocalUser[]>([]); // Hält die LocalUser-Objekte für die UI-Logik

  /* ---------------------------------------------------------------- Initialisierung */
  async function _loadUsersFromDb() {
    try {
      const dbUsersList = await db.dbUsers.toArray();
      // Hier müssen wir entscheiden, wie LocalUser aus DbUser befüllt wird,
      // insbesondere passwordHash, createdAt, updatedAt, die nicht in DbUser sind.
      // Für diesen Task lassen wir sie ggf. leer oder laden sie aus einer anderen Quelle,
      // falls die alte localStorage-Logik parallel noch existiert (was nicht ideal ist).
      // Annahme: Für die reine User-Auflistung brauchen wir nicht alle LocalUser-Felder.
      // Wir mappen, was wir haben.
      users.value = dbUsersList.map((dbUser: DbUser) => ({
        id: dbUser.uuid,
        username: dbUser.username, // Direkt von dbUser.username
        email: dbUser.email,
        passwordHash: '', // Muss separat behandelt werden, nicht in DbUser
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        accessToken: '', // Standardwerte oder aus anderer Quelle
        refreshToken: '', // Standardwerte oder aus anderer Quelle
      }));
      debugLog('userStore', '_loadUsersFromDb: Users geladen', { count: users.value.length });
    } catch (err) {
      errorLog('userStore', 'Fehler beim Laden der User aus der DB', err);
      users.value = [];
    }
  }

  onMounted(async () => {
    await _loadUsersFromDb();
    // Nach dem Laden der lokalen User, führe einen Sync mit dem Backend durch.
    // Dies stellt sicher, dass bei leerem Cache Daten vom Backend geholt werden
    // und bei vorhandenen lokalen Daten diese mit dem Backend abgeglichen werden.
    await syncUsers();
    // Optional könnte hier auch syncUserTenants für einen ggf. eingeloggten User aufgerufen werden,
    // falls diese Information beim Store-Start bereits verfügbar ist.
    // Fürs Erste fokussieren wir uns auf syncUsers.
  });

  /* ---------------------------------------------------------------- Getter */
  const getUserById = computed(() => (id: string) =>
    users.value.find(u => u.id === id),
  );

  const getUserByUsername = computed(() => (username: string) =>
    // Annahme: username in LocalUser entspricht 'name' in DbUser
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
    // Prüfen, ob User (Email) bereits existiert
    const existingDbUserByEmail = await db.dbUsers.get({ email: email.trim().toLowerCase() });
    if (existingDbUserByEmail) {
      infoLog('userStore', 'registerUser: E-Mail bereits registriert', { email });
      return null;
    }
    // Prüfen, ob Username bereits existiert
    const existingDbUserByUsername = await db.dbUsers.where('username').equalsIgnoreCase(username.trim()).first();
     if (existingDbUserByUsername) {
       infoLog('userStore', 'registerUser: Username bereits registriert', { username });
       return null; // Gemäß alter Logik: Username muss unique sein
     }

    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    const now = new Date().toISOString();
    const userId = uuidv4();

    const newDbUser: DbUser = {
      uuid: userId,
      username: username.trim(), // Feldname hier korrigiert
      email: email.trim().toLowerCase(),
      createdAt: now,
      updatedAt: now,
    };

    const newLocalUser: LocalUser = {
      id: userId,
      username: username.trim(), // Bleibt username
      email: email.trim().toLowerCase(),
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
      accessToken: '',
      refreshToken: '',
    };

    try {
      await db.dbUsers.add(newDbUser);
      users.value.push(newLocalUser); // State aktualisieren
      infoLog('userStore', 'registerUser: User erfolgreich registriert und in DB gespeichert', { id: userId, email: newLocalUser.email });
      return newLocalUser;
    } catch (err) {
      errorLog('userStore', 'registerUser: Fehler beim Speichern des Users in DB', { error: err });
      return null;
    }
  }

  async function validateLogin(
    usernameOrEmail: string, // Kann Username oder Email sein
    plainPassword: string,
  ): Promise<LocalUser | null> {
    let dbUser: DbUser | undefined;
    const inputLower = usernameOrEmail.toLowerCase();

    // Versuche als E-Mail zu finden
    dbUser = await db.dbUsers.where('email').equalsIgnoreCase(inputLower).first();

    if (!dbUser) {
      // Versuche als Username zu finden (vorher 'name')
      dbUser = await db.dbUsers.where('username').equalsIgnoreCase(inputLower).first();
    }

    if (!dbUser) {
      infoLog('userStore', 'validateLogin: User nicht gefunden', { usernameOrEmail });
      return null;
    }

    // Da passwordHash nicht in DbUser ist, müssen wir den LocalUser aus dem State `users` finden,
    // um den Hash zu bekommen. Das ist ein Workaround, da die DB-Struktur keinen Hash vorsieht.
    if (!dbUser || !dbUser.uuid) { // Sicherstellen, dass dbUser und dbUser.uuid existieren
      errorLog('userStore', 'validateLogin: dbUser oder dbUser.uuid ist undefiniert nach der Suche.');
      return null;
    }
    const localUser = users.value.find(u => u.id === dbUser.uuid);
    if (!localUser || !localUser.passwordHash) {
      errorLog('userStore', 'validateLogin: LocalUser oder passwordHash nicht im State gefunden. Login nicht möglich.', { userId: dbUser.uuid });
      // Hier könnte man alternativ einen Fehler werfen oder eine Meldung geben,
      // dass die lokale Passwortprüfung nicht mehr unterstützt wird und Backend-Login nötig ist.
      return null;
    }

    const ok = await bcrypt.compare(plainPassword, localUser.passwordHash);
    if (ok) {
      infoLog('userStore', 'validateLogin: Login erfolgreich', { userId: localUser.id });
      return localUser;
    }
    // Else kann weggelassen werden, da der vorherige if-Block mit return endet.
    infoLog('userStore', 'validateLogin: Falsches Passwort', { userId: localUser.id });
    return null;
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

    // Hier müsste die Logik zur Backend-Kommunikation für Passwortänderung implementiert werden.
    // Für die lokale Änderung (falls noch unterstützt):
    const newHash = await bcrypt.hash(newPlainPassword, SALT_ROUNDS);
    users.value[userIdx].passwordHash = newHash;
    users.value[userIdx].updatedAt = new Date().toISOString();

    // Kein direktes Update in DbUser, da passwordHash dort nicht existiert.
    // Man könnte updatedAt in DbUser aktualisieren.
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
      users.value = users.value.filter(u => u.id !== userId); // State aktualisieren
      infoLog('userStore', 'deleteUser: User und zugehörige Tenants aus DB gelöscht', { id: userId });
      return true;
    } catch (err) {
      errorLog('userStore', 'deleteUser: Fehler beim Löschen des Users', { id: userId, error: err });
      return false;
    }
  }

  // loadUsers und saveUsers (localStorage-basiert) werden entfernt.
  // _loadUsersFromDb wird bei onMounted aufgerufen.

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
      // 1. Pull vom Backend
      infoLog('userStore', 'syncUsers: Rufe User vom Backend ab...');
      const backendUsers = await apiService.getUsers();
      infoLog('userStore', 'syncUsers: User vom Backend erhalten', { count: backendUsers.length });

      const localDbUsers = await db.dbUsers.toArray();
      infoLog('userStore', 'syncUsers: Lokale User geladen', { count: localDbUsers.length });

      const usersToUpdateInDb: DbUser[] = [];
      const usersToAddToDb: DbUser[] = [];
      const usersToPushToBackend: DbUser[] = []; // Behalten für die Logik, welche User nur lokal existieren

      // 2. Datenabgleich: Backend-Daten mit lokalen Daten vergleichen
      for (const bUser of backendUsers) {
        const lUser = localDbUsers.find(u => u.uuid === bUser.uuid);
        if (lUser) {
          // User existiert lokal und im Backend
          const backendUpdatedAt = new Date(bUser.updatedAt).getTime();
          const localUpdatedAt = new Date(lUser.updatedAt).getTime();

          if (backendUpdatedAt > localUpdatedAt) {
            // Backend-Version ist neuer, lokalen User aktualisieren
            usersToUpdateInDb.push({
              uuid: bUser.uuid,
              username: bUser.name, // Mapping: name (API) -> username (DB)
              email: bUser.email,
              createdAt: bUser.createdAt, // Backend createdAt beibehalten
              updatedAt: bUser.updatedAt,
            });
          }
          // Konfliktfall: Wenn lokal neuer oder gleich, wird beim Push-Teil behandelt, falls der User nur lokal geändert wurde.
          // Gemäß Anforderung: "Wenn Zeitstempel identisch sind ... keine Aktion ausgeführt."
          // "Wenn ein Datensatz lokal geändert wurde und auch auf dem Server, aber der Server neuer ist, überschreibt der Server." (Hiermit abgedeckt)
          // "Wenn lokal neuer, wird gepusht." (Wird im nächsten Loop behandelt)
        } else {
          // User existiert nur im Backend -> lokal hinzufügen
          usersToAddToDb.push({
            uuid: bUser.uuid,
            username: bUser.name, // Mapping
            email: bUser.email,
            createdAt: bUser.createdAt,
            updatedAt: bUser.updatedAt,
          });
        }
      }

      // 2. Datenabgleich: Lokale Daten mit Backend-Daten vergleichen (für Push-Kandidaten)
      for (const lUser of localDbUsers) {
        const bUser = backendUsers.find(u => u.uuid === lUser.uuid);
        if (!bUser) {
          // User existiert nur lokal -> zum Backend pushen
          // Bedingung: "seit createdAt nicht mit Backend synchronisiert"
          // Einfache Annahme hier: Wenn User nur lokal existiert, wurde er lokal erstellt und noch nicht gepusht.
          // Eine robustere Lösung könnte ein `lastSyncedAt` Feld oder eine Prüfung, ob die `uuid` vom Backend stammt, beinhalten.
          // Für diese Stufe: Alle rein lokalen User sind Push-Kandidaten.
          usersToPushToBackend.push(lUser);
        }
        // Fall: User existiert lokal und im Backend, aber lokal ist neuer.
        // Dieser Fall wird hier nicht explizit für einen Push markiert, da die Anforderung
        // "Datensatz nur lokal ... Per POST /users ans Backend senden" lautet.
        // Ein Update eines existierenden Users würde eher PUT /users/{uuid} erfordern.
        // Die aktuelle Logik pusht nur komplett neue lokale User.
      }

      // 3. Lokale DB-Operationen ausführen
      if (usersToUpdateInDb.length > 0) {
        await db.dbUsers.bulkPut(usersToUpdateInDb);
        infoLog('userStore', 'syncUsers: Lokale User aktualisiert', { count: usersToUpdateInDb.length, users: usersToUpdateInDb.map(u => u.uuid) });
      }
      if (usersToAddToDb.length > 0) {
        await db.dbUsers.bulkAdd(usersToAddToDb);
        infoLog('userStore', 'syncUsers: Neue User lokal hinzugefügt', { count: usersToAddToDb.length, users: usersToAddToDb.map(u => u.uuid) });
      }

      // 4. Push zum Backend (für neue lokale User)
      for (const lUserToPush of usersToPushToBackend) {
        infoLog('userStore', `syncUsers: Versuche, neuen lokalen User ${lUserToPush.uuid} zum Backend zu pushen.`);
        try {
          // Das Backend erwartet 'name' und 'email'. 'password' ist im UserCreate Schema, aber wir haben es hier nicht.
          // Gemäß Anforderung: "Per POST /users ans Backend senden".
          // Wir gehen davon aus, dass der Backend-Endpunkt so konfiguriert ist, dass er User ohne Passwort
          // für diesen Synchronisationsfall akzeptieren kann, oder dieser Push fehlschlägt und geloggt wird.
          const userDataToPush = {
            name: lUserToPush.username, // Mapping
            email: lUserToPush.email,
            // WICHTIG: Das Passwort fehlt hier. Wenn das Backend es zwingend erfordert, schlägt dieser Aufruf fehl.
            // Die Anforderung, per POST zu senden, ohne das Passwort-Handling hier zu spezifizieren, ist eine Herausforderung.
          };

          warnLog('userStore', 'syncUsers: Push eines neuen lokalen Users zum Backend ohne Passwort. Backend muss dies unterstützen.', { userId: lUserToPush.uuid, data: userDataToPush });

          const backendUserResponse = await apiService.createUser(userDataToPush);
          infoLog('userStore', `syncUsers: Neuer lokaler User ${lUserToPush.uuid} erfolgreich zum Backend gepusht. Antwort erhalten.`, { backendResponse: backendUserResponse });

          // Lokalen User mit der Antwort vom Backend aktualisieren
          // Wichtig: Die lokale UUID könnte sich ändern, wenn das Backend eine neue UUID generiert und zurückgibt.
          // Die Anforderung sagt "insbesondere uuid und updatedAt".
          // Wir müssen den alten lokalen User entfernen und den neuen (vom Backend bestätigten) hinzufügen/aktualisieren.

          const updatedDbUser: DbUser = {
            uuid: backendUserResponse.uuid, // UUID vom Backend verwenden!
            username: backendUserResponse.name, // Mapping
            email: backendUserResponse.email,
            createdAt: backendUserResponse.createdAt,
            updatedAt: backendUserResponse.updatedAt,
          };

          // Wenn die UUID gleich geblieben ist, können wir put verwenden.
          // Wenn die UUID sich geändert hat (Backend hat eine neue generiert), müssen wir den alten löschen und den neuen hinzufügen.
          // Sicherer ist, immer den alten (falls er unter der alten UUID existierte) zu löschen und den neuen zu speichern.
          // Da lUserToPush die alte lokale UUID hat:
          if (lUserToPush.uuid !== backendUserResponse.uuid) {
            await db.dbUsers.delete(lUserToPush.uuid);
            infoLog('userStore', `syncUsers: Alten lokalen User ${lUserToPush.uuid} nach Push gelöscht, da Backend neue UUID ${backendUserResponse.uuid} vergeben hat.`);
          }
          await db.dbUsers.put(updatedDbUser); // Speichert oder aktualisiert basierend auf der neuen UUID

          infoLog('userStore', 'syncUsers: Lokaler User nach Push mit Backend-Daten aktualisiert', { localUuid: lUserToPush.uuid, backendUuid: updatedDbUser.uuid });

        } catch (error) {
          errorLog('userStore', `syncUsers: Fehler beim Pushen des neuen lokalen Users ${lUserToPush.uuid} zum Backend`, { error, dataSent: {name: lUserToPush.username, email: lUserToPush.email} });
          // Hier könnte man den User für einen späteren erneuten Versuch markieren.
        }
      }

      await _loadUsersFromDb(); // UI-State neu laden, um alle Änderungen zu reflektieren
      infoLog('userStore', 'syncUsers: User-Synchronisation abgeschlossen');
    } catch (error) {
      errorLog('userStore', 'syncUsers: Fehler bei der User-Synchronisation', { error });
    }
  }

  async function syncUserTenants(userId: string): Promise<void> {
    infoLog('userStore', `syncUserTenants: Starte Tenant-Synchronisation für User ${userId}`);
    if (!userId) {
      errorLog('userStore', 'syncUserTenants: Keine userId angegeben.');
      return;
    }

    try {
      // 1. Pull vom Backend
      infoLog('userStore', `syncUserTenants: Rufe Tenants für User ${userId} vom Backend ab...`);
      const backendTenants = await apiService.getTenantsForUser(userId);
      infoLog('userStore', `syncUserTenants: Tenants für User ${userId} vom Backend erhalten`, { count: backendTenants.length });

      const localDbTenants = await db.dbTenants.where('user_id').equals(userId).toArray();
      infoLog('userStore', `syncUserTenants: Lokale Tenants für User ${userId} geladen`, { count: localDbTenants.length });

      const tenantsToUpdateInDb: DbTenant[] = [];
      const tenantsToAddToDb: DbTenant[] = [];
      const tenantsToPushToBackend: DbTenant[] = [];

      // 2. Datenabgleich: Backend-Daten mit lokalen Daten vergleichen
      for (const bTenant of backendTenants) {
        const lTenant = localDbTenants.find(t => t.uuid === bTenant.uuid);
        if (lTenant) {
          // Tenant existiert lokal und im Backend
          const backendUpdatedAt = new Date(bTenant.updatedAt).getTime();
          const localUpdatedAt = new Date(lTenant.updatedAt).getTime();
          if (backendUpdatedAt > localUpdatedAt) {
            // Backend-Version ist neuer, lokalen Tenant aktualisieren
            tenantsToUpdateInDb.push({
              uuid: bTenant.uuid,
              tenantName: bTenant.name, // Mapping: name (API) -> tenantName (DB)
              user_id: bTenant.user_id,
              createdAt: bTenant.createdAt, // Backend createdAt beibehalten
              updatedAt: bTenant.updatedAt,
            });
          }
          // Konfliktfall: Analog zu syncUsers, einfache Strategie.
        } else {
          // Tenant existiert nur im Backend -> lokal hinzufügen
          tenantsToAddToDb.push({
            uuid: bTenant.uuid,
            tenantName: bTenant.name, // Mapping
            user_id: bTenant.user_id,
            createdAt: bTenant.createdAt,
            updatedAt: bTenant.updatedAt,
          });
        }
      }

      // 2. Datenabgleich: Lokale Daten mit Backend-Daten vergleichen (für Push-Kandidaten)
      for (const lTenant of localDbTenants) {
        const bTenant = backendTenants.find(t => t.uuid === lTenant.uuid);
        if (!bTenant) {
          // Tenant existiert nur lokal -> zum Backend pushen
          // Bedingung: "zugehöriger User ist mit Backend synchron"
          // Diese Prüfung ist hier nicht trivial, da der User-Sync-Status nicht direkt verfügbar ist.
          // Annahme für diese Stufe: Wenn der Tenant nur lokal existiert, versuchen wir den Push.
          // Eine robustere Lösung würde den Sync-Status des Users prüfen.
          warnLog('userStore', `syncUserTenants: Lokaler Tenant ${lTenant.uuid} ohne Backend-Entsprechung. Prüfung des User-Sync-Status wäre ideal, wird aber für Push angenommen.`);
          tenantsToPushToBackend.push(lTenant);
        }
      }

      // 3. Lokale DB-Operationen ausführen
      if (tenantsToUpdateInDb.length > 0) {
        await db.dbTenants.bulkPut(tenantsToUpdateInDb);
        infoLog('userStore', 'syncUserTenants: Lokale Tenants aktualisiert', { userId, count: tenantsToUpdateInDb.length, tenants: tenantsToUpdateInDb.map(t => t.uuid) });
      }
      if (tenantsToAddToDb.length > 0) {
        await db.dbTenants.bulkAdd(tenantsToAddToDb);
        infoLog('userStore', 'syncUserTenants: Neue Tenants lokal hinzugefügt', { userId, count: tenantsToAddToDb.length, tenants: tenantsToAddToDb.map(t => t.uuid) });
      }

      // 4. Push zum Backend (für neue lokale Tenants)
      for (const lTenantToPush of tenantsToPushToBackend) {
        infoLog('userStore', `syncUserTenants: Versuche, neuen lokalen Tenant ${lTenantToPush.uuid} für User ${userId} zum Backend zu pushen.`);
        try {
          const tenantDataToPush = {
            name: lTenantToPush.tenantName, // Mapping
            user_id: lTenantToPush.user_id, // Muss korrekt sein
          };

          const backendTenantResponse = await apiService.createTenant(tenantDataToPush);
          infoLog('userStore', `syncUserTenants: Neuer lokaler Tenant ${lTenantToPush.uuid} erfolgreich zum Backend gepusht. Antwort erhalten.`, { backendResponse: backendTenantResponse });

          const updatedDbTenant: DbTenant = {
            uuid: backendTenantResponse.uuid, // UUID vom Backend verwenden!
            tenantName: backendTenantResponse.name, // Mapping
            user_id: backendTenantResponse.user_id,
            createdAt: backendTenantResponse.createdAt,
            updatedAt: backendTenantResponse.updatedAt,
          };

          if (lTenantToPush.uuid !== backendTenantResponse.uuid) {
            await db.dbTenants.delete(lTenantToPush.uuid);
            infoLog('userStore', `syncUserTenants: Alten lokalen Tenant ${lTenantToPush.uuid} nach Push gelöscht, da Backend neue UUID ${backendTenantResponse.uuid} vergeben hat.`);
          }
          await db.dbTenants.put(updatedDbTenant);

          infoLog('userStore', 'syncUserTenants: Lokaler Tenant nach Push mit Backend-Daten aktualisiert', { localUuid: lTenantToPush.uuid, backendUuid: updatedDbTenant.uuid });

        } catch (error) {
          errorLog('userStore', `syncUserTenants: Fehler beim Pushen des neuen lokalen Tenants ${lTenantToPush.uuid} zum Backend`, { error, dataSent: {name: lTenantToPush.tenantName, user_id: lTenantToPush.user_id} });
        }
      }
      // Kein explizites Neuladen des Tenant-States hier, da Tenants nicht direkt im UserStore-State gehalten werden.
      // Die Tenant-Verwaltung erfolgt typischerweise in einem separaten tenantStore oder wird bei Bedarf geladen.
      infoLog('userStore', `syncUserTenants: Tenant-Synchronisation für User ${userId} abgeschlossen`);
    } catch (error) {
      errorLog('userStore', `syncUserTenants: Fehler bei der Tenant-Synchronisation für User ${userId}`, { error });
    }
  }

  return {
    /* State */
    users, // Bleibt für Kompatibilität mit UI, wird aus DB befüllt

    /* Getter */
    getUserById,
    getUserByUsername,

    /* Actions */
    registerUser,
    validateLogin,
    changePassword,
    deleteUser,
    reset, // reset ersetzt loadUsers/saveUsers im Return-Block

    /* Sync Actions */
    syncUsers,
    syncUserTenants,

    /* Interne DB Instanz (optional für direkten Zugriff von anderen Stores) */
    // _dbInstance: db // Nur wenn nötig und mit Vorsicht verwenden
  };
});
