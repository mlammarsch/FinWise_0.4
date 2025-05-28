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
import { decodeJwt } from '@/utils/auth'; // Importiere decodeJwt
import type { Token, JwtPayload } from '@/types'; // Korrigierter Import für Typen

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

    // Nach erfolgreichem User-Sync, versuche Tenants zu synchronisieren, falls ein User angemeldet ist.
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

    // Prüfen, ob User (Email) bereits lokal existiert
    const existingDbUserByEmail = await db.dbUsers.get({ email: email.trim().toLowerCase() });
    if (existingDbUserByEmail) {
      infoLog('userStore', 'registerUser: E-Mail bereits lokal registriert', { email });
      return null;
    }
    // Prüfen, ob Username bereits lokal existiert
    const existingDbUserByUsername = await db.dbUsers.where('username').equalsIgnoreCase(username.trim()).first();
     if (existingDbUserByUsername) {
       infoLog('userStore', 'registerUser: Username bereits lokal registriert', { username });
       return null; // Gemäß alter Logik: Username muss unique sein
     }

    const now = new Date().toISOString();
    const userId = uuidv4(); // Frontend generiert UUID

    try {
      // Versuche Online-Registrierung mit Passwort
      infoLog('userStore', 'registerUser: Versuche Online-Registrierung...');
      const backendUser = await apiService.registerUserWithPassword({
        name: username.trim(), // Backend erwartet 'name'
        email: email.trim().toLowerCase(),
        password: plainPassword, // Klartext-Passwort für Registrierungs-Endpoint
      });

      // Erfolgreiche Online-Registrierung
      const newDbUser: DbUser = {
        uuid: backendUser.uuid, // Backend UUID verwenden
        username: backendUser.name, // Mapping
        email: backendUser.email,
        createdAt: backendUser.createdAt,
        updatedAt: backendUser.updatedAt,
        needsBackendSync: false, // Erfolgreich synchronisiert
      };

      // Passwort-Hash wird NICHT in DbUser gespeichert.
      // Der LocalUser State kann den Hash temporär halten, falls nötig (z.B. für Offline-Login-Versuch nach Online-Login)
      // Für diesen Plan speichern wir den Hash lokal im State, aber nicht in der DB.
      const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      const newLocalUser: LocalUser = {
        id: newDbUser.uuid,
        username: newDbUser.username,
        email: newDbUser.email,
        passwordHash: hash, // Lokal gehashter Passwort für State
        createdAt: newDbUser.createdAt,
        updatedAt: newDbUser.updatedAt,
        accessToken: '', // Tokens vom Backend könnten hier gesetzt werden, falls der Register-Endpoint sie zurückgibt
        refreshToken: '',
      };

      await db.dbUsers.put(newDbUser); // put() statt add() falls Backend dieselbe UUID zurückgibt
      users.value.push(newLocalUser); // State aktualisieren
      infoLog('userStore', 'registerUser: User erfolgreich online registriert und lokal gespeichert', { id: newDbUser.uuid, email: newDbUser.email });
      return newLocalUser;

    } catch (error) {
      // Fehler bei Online-Registrierung (z.B. Offline, Backend-Fehler)
      errorLog('userStore', 'registerUser: Online-Registrierung fehlgeschlagen, versuche lokale Speicherung.', { error });

      // Lokale Speicherung mit needsBackendSync
      const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
      const newDbUser: DbUser = {
        uuid: userId, // Frontend generierte UUID verwenden
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hash, // Passwort-Hash jetzt in DbUser speichern
        createdAt: now,
        updatedAt: now,
        needsBackendSync: true, // Muss noch mit Backend synchronisiert werden
      };

      // Für den LocalUser State verwenden wir den gleichen Hash.
      const newLocalUser: LocalUser = {
        id: newDbUser.uuid,
        username: newDbUser.username,
        email: newDbUser.email,
        passwordHash: hash, // Lokal gehashter Passwort für State
        createdAt: newDbUser.createdAt,
        updatedAt: newDbUser.updatedAt,
        accessToken: '',
        refreshToken: '',
      };

      try {
        await db.dbUsers.add(newDbUser); // add() verwenden, da es eine neue lokale UUID ist
        users.value.push(newLocalUser); // State aktualisieren
        warnLog('userStore', 'registerUser: Online-Registrierung fehlgeschlagen, User lokal gespeichert (needsBackendSync=true)', { id: newDbUser.uuid, email: newDbUser.email });
        return newLocalUser;
      } catch (dbError) {
        errorLog('userStore', 'registerUser: Fehler beim lokalen Speichern des Users nach fehlgeschlagener Online-Registrierung', { error: dbError });
        return null;
      }
    }
  }

  async function validateLogin(
    usernameOrEmail: string, // Kann Username oder Email sein
    plainPassword: string,
  ): Promise<LocalUser | null> {
    const inputLower = usernameOrEmail.toLowerCase();

    try {
      // Versuche Online-Login über API
      infoLog('userStore', 'validateLogin: Versuche Online-Login...');
      const tokenResponse: Token = await apiService.login({ // Erwarte Token-Antwort
        username_or_email: inputLower,
        password: plainPassword,
      });

      // Erfolgreicher Online-Login - Token erhalten
      infoLog('userStore', 'validateLogin: Online-Login erfolgreich - Token erhalten.');

      // Extrahiere Benutzer-ID aus dem Token
      const decodedToken = decodeJwt(tokenResponse.access_token);
      if (!decodedToken || typeof decodedToken !== 'object' || !('sub' in decodedToken) || typeof decodedToken.sub !== 'string') {
          errorLog('userStore', 'validateLogin: Konnte Benutzer-ID nicht aus Token extrahieren oder Token ungültig.');
          return null;
      }
      const userIdFromToken = decodedToken.sub as string; // Sicherer Zugriff nach Prüfung
      infoLog('userStore', 'validateLogin: Benutzer-ID aus Token extrahiert.', { userId: userIdFromToken });


      // Rufe vollständige Benutzerdaten vom Backend ab (optional, falls nicht im Token)
      // Annahme: Es gibt einen /users/{user_id} Endpunkt, der UserFromApi zurückgibt
      let backendUser: UserFromApi | undefined;
      try {
          backendUser = await apiService.get<UserFromApi>(`/users/${userIdFromToken}`);
          infoLog('userStore', 'validateLogin: Vollständige Benutzerdaten vom Backend abgerufen.', { userId: userIdFromToken });
      } catch (fetchError) {
          errorLog('userStore', 'validateLogin: Fehler beim Abrufen vollständiger Benutzerdaten vom Backend.', { userId: userIdFromToken, error: fetchError });
          // Versuche, den Benutzer lokal zu finden, falls Backend nicht erreichbar ist
          const localDbUser = await db.dbUsers.get(userIdFromToken);
          if (localDbUser) {
              warnLog('userStore', 'validateLogin: Konnte Benutzerdaten nicht vom Backend abrufen, verwende lokale Daten.', { userId: userIdFromToken });
              // Erstelle LocalUser aus lokalen DB-Daten und dem neuen Token
              const localUser: LocalUser = {
                  id: localDbUser.uuid,
                  username: localDbUser.username,
                  email: localDbUser.email,
                  passwordHash: localDbUser.passwordHash || '', // Verwende lokalen Hash, falls vorhanden
                  createdAt: localDbUser.createdAt,
                  updatedAt: localDbUser.updatedAt,
                  accessToken: tokenResponse.access_token, // Neues Token verwenden
                  refreshToken: tokenResponse.token_type, // token_type hier als refreshToken speichern (ggf. anpassen)
              };
              debugLog('userStore', 'validateLogin: LocalUser object created from local DB and token:', JSON.stringify(localUser));
              // Finde und ersetze den Benutzer im State oder füge ihn hinzu
              const userIndex = users.value.findIndex(u => u.id === localUser.id);
              if (userIndex > -1) {
                  users.value[userIndex] = localUser;
              } else {
                  users.value.push(localUser);
              }
              return localUser; // Rückgabe des lokalen Users mit neuem Token
          }
          // Dieser else-Block wird entfernt, da der vorherige if-Block mit return endet.
          errorLog('userStore', 'validateLogin: Konnte Benutzerdaten weder vom Backend abrufen noch lokal finden.', { userId: userIdFromToken });
          return null; // Login fehlgeschlagen
      }

      // Wenn backendUser nicht definiert ist (weil fetchError aufgetreten ist und kein lokaler User gefunden wurde),
      // sollte dieser Block nicht erreicht werden, da wir vorher null zurückgegeben haben.
      // Füge eine Prüfung hinzu, um TypeScript zu beruhigen, obwohl die Logik dies verhindern sollte.
      if (!backendUser) {
          errorLog('userStore', 'validateLogin: Unerwarteter Fehler: backendUser ist nach Abruf/Fallback nicht definiert.');
          return null;
      }

      // Benutzerdaten vom Backend und Token in IndexedDB speichern/aktualisieren
      // Annahme: backendUser enthält die notwendigen Felder (uuid, name, email, createdAt, updatedAt)
      const dbUser: DbUser = {
        uuid: backendUser.uuid,
        username: backendUser.name, // Mapping
        email: backendUser.email,
        createdAt: backendUser.createdAt,
        updatedAt: backendUser.updatedAt,
        needsBackendSync: false, // Erfolgreich synchronisiert
        passwordHash: undefined, // Passwort-Hash wird nicht in DbUser gespeichert, wenn vom Backend synchronisiert
      };
      await db.dbUsers.put(dbUser); // put() aktualisiert oder fügt hinzu
      infoLog('userStore', 'validateLogin: Benutzerdaten in IndexedDB gespeichert/aktualisiert.', { userId: dbUser.uuid });


      // State aktualisieren
      const localUser: LocalUser = {
        id: dbUser.uuid,
        username: dbUser.username,
        email: dbUser.email,
        passwordHash: '', // Passwort-Hash wird nicht persistent im State gespeichert nach Online-Login
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
        accessToken: tokenResponse.access_token, // Tokens vom Backend übernehmen
        refreshToken: tokenResponse.token_type, // token_type hier als refreshToken speichern (ggf. anpassen)
      };
      debugLog('userStore', 'validateLogin: LocalUser object created with backend data and token:', JSON.stringify(localUser));

      // Finde und ersetze den Benutzer im State oder füge ihn hinzu
      const userIndex = users.value.findIndex(u => u.id === localUser.id);
      if (userIndex > -1) {
        users.value[userIndex] = localUser;
      } else {
        users.value.push(localUser);
      }

      infoLog('userStore', 'validateLogin: Login-Prozess abgeschlossen, Benutzer im State aktualisiert.', { userId: localUser.id });
      return localUser; // Erfolgreicher Login
      // Unerreichbarer Code 'return localUser;' wurde entfernt.
    } catch (error) {
      // Fehler bei Online-Login (z.B. Offline, falsche Credentials)
      errorLog('userStore', 'validateLogin: Online-Login fehlgeschlagen.', { error });

      // Bei Netzwerkfehlern (Offline-Szenario) versuchen, lokal zu finden
      // Beachte: Lokale Passwortvalidierung wird hier NICHT durchgeführt.
      // Ein Offline-Login ist nur eine "Daten-Verfügbarkeitsprüfung" für zuvor synchronisierte User.
      // Echte Offline-Authentifizierung würde Tokens oder andere Mechanismen erfordern.
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
         warnLog('userStore', 'validateLogin: Netzwerkfehler (vermutlich offline), versuche lokalen Lookup.');
         let dbUser: DbUser | undefined;

         // Versuche als E-Mail zu finden
         dbUser = await db.dbUsers.where('email').equalsIgnoreCase(inputLower).first();

         if (!dbUser) {
           // Versuche als Username zu finden
           dbUser = await db.dbUsers.where('username').equalsIgnoreCase(inputLower).first();
         }

         if (dbUser) {
           infoLog('userStore', 'validateLogin: User lokal gefunden (Offline-Modus)', { userId: dbUser.uuid });
            // Erstelle LocalUser aus DbUser (ohne Passwort-Hash)
            const localUser: LocalUser = {
              id: dbUser.uuid,
              username: dbUser.username,
              email: dbUser.email,
              passwordHash: '', // Kein Hash im Offline-Lookup
              createdAt: dbUser.createdAt,
              updatedAt: dbUser.updatedAt,
              accessToken: '', // Keine Tokens im Offline-Lookup
              refreshToken: '',
            };
           return localUser; // Rückgabe des lokalen Users (ohne Authentifizierung)
         }
         warnLog('userStore', 'validateLogin: User lokal nicht gefunden (Offline-Modus)', { usernameOrEmail });
         return null;
      }
      // Andere API-Fehler (z.B. falsche Credentials)
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
        const localUpdatedAt = new Date(lUser.updatedAt).getTime();

        if (!bUser) {
          // User existiert nur lokal -> zum Backend pushen (neue lokale User)
          usersToPushToBackend.push(lUser);
        } else {
          // User existiert lokal und im Backend
          const backendUpdatedAt = new Date(bUser.updatedAt).getTime();
          if (localUpdatedAt > backendUpdatedAt) {
            // Lokale Version ist neuer -> zum Backend pushen (geänderte lokale User)
            usersToPushToBackend.push(lUser);
          }
          // Wenn Backend neuer oder gleich, wird er im ersten Loop gehandhabt (Pull).
        }
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

      // 4. Push zum Backend (für neue und geänderte lokale User)
      for (const lUserToPush of usersToPushToBackend) {
        const bUser = backendUsers.find(u => u.uuid === lUserToPush.uuid); // Find backend counterpart

        try {
          let backendUserResponse: UserFromApi;
          const userDataToPush: UserPushData = {
            name: lUserToPush.username, // Mapping
            email: lUserToPush.email,
          };

          if (!bUser || lUserToPush.needsBackendSync) {
            // User existiert nur lokal ODER ist als needing sync markiert (neue lokale User)
            infoLog('userStore', `syncUsers: Versuche, neuen lokalen User ${lUserToPush.uuid} zum Backend zu pushen.`);
            if (lUserToPush.passwordHash) {
              // WICHTIG: Backend muss dieses Feld (jetzt 'hashed_password') akzeptieren.
              // Dies wurde im Backend-Schema UserSyncPayload bereits so definiert.
              userDataToPush.hashed_password = lUserToPush.passwordHash;
              debugLog('userStore', `syncUsers: Sende hashed_password für neuen User ${lUserToPush.uuid}`);
            }
            backendUserResponse = await apiService.createUser({
              uuid: lUserToPush.uuid,
              ...userDataToPush,
            });
            infoLog('userStore', `syncUsers: Neuer lokaler User ${lUserToPush.uuid} erfolgreich zum Backend gepusht.`, { backendResponse: backendUserResponse });

            // Nach erfolgreichem Push: needsBackendSync auf false setzen und passwordHash aus lokaler DB entfernen
            await db.dbUsers.update(lUserToPush.uuid, {
              needsBackendSync: false,
              passwordHash: undefined, // Entfernt das Feld aus dem Dexie-Objekt
              updatedAt: backendUserResponse.updatedAt, // Backend-Zeitstempel verwenden
            });
            debugLog('userStore', `syncUsers: needsBackendSync auf false gesetzt und passwordHash für User ${lUserToPush.uuid} in lokaler DB entfernt/aktualisiert.`);
          } else {
            // User existiert lokal und im Backend, und lokale Version ist neuer (geänderte lokale User)
            infoLog('userStore', `syncUsers: Versuche, geänderten lokalen User ${lUserToPush.uuid} zum Backend zu pushen.`);
            // apiService.updateUser expects uuid and data (name, email)
            backendUserResponse = await apiService.updateUser(lUserToPush.uuid, userDataToPush);
            infoLog('userStore', `syncUsers: Geänderter lokaler User ${lUserToPush.uuid} erfolgreich zum Backend gepusht.`, { backendResponse: backendUserResponse });
          }

          // Lokalen User mit der Antwort vom Backend aktualisieren
          // Wichtig: Die lokale UUID sollte nach einem erfolgreichen Push/Update die Backend-UUID sein.
          // Da wir Frontend-generierte UUIDs für neue User senden, sollte die Backend-UUID gleich sein.
          // Aber wir aktualisieren sicherheitshalber mit der Antwort.
          const updatedDbUser: DbUser = {
            uuid: backendUserResponse.uuid, // UUID vom Backend verwenden!
            username: backendUserResponse.name, // Mapping
            email: backendUserResponse.email,
            createdAt: backendUserResponse.createdAt,
            updatedAt: backendUserResponse.updatedAt,
            needsBackendSync: false, // Erfolgreich synchronisiert
          };

          await db.dbUsers.put(updatedDbUser); // Speichert oder aktualisiert basierend auf der Backend-UUID

          infoLog('userStore', 'syncUsers: Lokaler User nach Push/Update mit Backend-Daten aktualisiert', { localUuid: lUserToPush.uuid, backendUuid: updatedDbUser.uuid });

        } catch (error) {
          errorLog('userStore', `syncUsers: Fehler beim Pushen/Updaten des lokalen Users ${lUserToPush.uuid} zum Backend`, { error, dataSent: {name: lUserToPush.username, email: lUserToPush.email} });
          // Hier könnte man den User für einen späteren erneuten Versuch markieren,
          // z.B. durch Beibehalten von needsBackendSync oder Hinzufügen eines retryCount.
          // Für diesen Plan belassen wir es beim Logging.
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
            uuid: lTenantToPush.uuid, // Füge lokale UUID hinzu
            name: lTenantToPush.tenantName, // Mapping
            user_id: lTenantToPush.user_id, // Muss korrekt sein
          };

          // apiService.createTenant erwartet Omit<TenantFromApi, 'uuid' | 'createdAt' | 'updatedAt'>
          // Wir müssen hier apiService.post direkt verwenden, da wir die UUID mitsenden.
          // Alternativ könnte apiService.createTenant angepasst werden, um optional UUID zu akzeptieren.
          // Für den Moment ist der direkte Aufruf klarer.
          const backendTenantResponse = await apiService.post<TenantFromApi, typeof tenantDataToPush>('/tenants/', tenantDataToPush);

          infoLog('userStore', `syncUserTenants: Lokaler Tenant ${lTenantToPush.uuid} für User ${userId} erfolgreich zum Backend gepusht. Antwort erhalten.`, { backendResponse: backendTenantResponse });

          // Nach erfolgreichem Push: Lokalen Tenant mit Backend-Daten aktualisieren
          // (falls Backend z.B. createdAt/updatedAt setzt)
          const updatedDbTenant: DbTenant = {
            uuid: backendTenantResponse.uuid, // Sollte jetzt dieselbe sein wie lTenantToPush.uuid
            tenantName: backendTenantResponse.name, // Mapping
            user_id: backendTenantResponse.user_id,
            createdAt: backendTenantResponse.createdAt,
            updatedAt: backendTenantResponse.updatedAt,
          };

          // Da wir die UUID mitsenden, sollte die Backend-UUID gleich der lokalen sein.
          // Die Logik zum Löschen des alten lokalen Tenants ist dann nicht mehr nötig.
          await db.dbTenants.put(updatedDbTenant); // put() aktualisiert den bestehenden Eintrag mit derselben UUID

          infoLog('userStore', 'syncUserTenants: Lokaler Tenant nach Push mit Backend-Daten aktualisiert', { tenantUuid: updatedDbTenant.uuid });

        } catch (error: unknown) { // error: any zu unknown
          let errorMessage = 'Unbekannter Synchronisationsfehler beim Pushen des Tenants';
          if (error instanceof Error) {
            errorMessage = error.message;
            // Spezifische Prüfung für den Fall, dass der Tenant bereits existiert.
            // Backend-Fehlermeldung: "Tenant with name '{tenant.name}' already exists for this user."
            if (errorMessage.includes('already exists for this user')) {
               warnLog(
                'userStore',
                `syncUserTenants: Tenant ${lTenantToPush.uuid} ("${lTenantToPush.tenantName}") existiert bereits im Backend. Synchronisation wird als behandelt betrachtet.`,
                { tenantUuid: lTenantToPush.uuid, originalErrorMessage: errorMessage },
              );
              continue; // Springe zum nächsten Tenant in der Schleife
            }
          } else if (typeof error === 'string') {
            errorMessage = error;
          }

          errorLog('userStore', `syncUserTenants: Fehler beim Pushen des lokalen Tenants ${lTenantToPush.uuid} zum Backend: ${errorMessage}`, { rawError: error, tenantUuid: lTenantToPush.uuid, dataSent: {name: lTenantToPush.tenantName, user_id: lTenantToPush.user_id} });
          // Fehler wird geloggt, aber die Schleife läuft weiter, um andere Tenants zu versuchen.
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
