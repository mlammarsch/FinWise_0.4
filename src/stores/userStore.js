// src/stores/userStore.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import Dexie from 'dexie';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { apiService } from '@/services/apiService';
import { useSessionStore } from './sessionStore';
import { useTenantStore } from './tenantStore';
class FinwiseUserDB extends Dexie {
    constructor() {
        super('finwiseUserDB');
        Object.defineProperty(this, "dbUsers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dbTenants", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "dbSession", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.version(3).stores({
            dbUsers: '&uuid, username, email, passwordHash, createdAt, updatedAt, needsBackendSync',
            dbTenants: '&uuid, tenantName, user_id, createdAt, updatedAt',
            dbSession: '&id',
        });
    }
}
export const db = new FinwiseUserDB();
const SALT_ROUNDS = 9;
export const useUserStore = defineStore('user', () => {
    const users = ref([]);
    async function _loadUsersFromDb() {
        try {
            const dbUsersList = await db.dbUsers.toArray();
            users.value = dbUsersList.map((dbUser) => ({
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
        }
        catch (err) {
            errorLog('userStore', 'Fehler beim Laden der User aus der DB', err);
            users.value = [];
        }
    }
    // Initialisierung wird jetzt explizit aufgerufen, nicht automatisch bei Store-Erstellung
    async function initializeUserStore() {
        await _loadUsersFromDb();
        await syncUsers();
        const sessionStore = useSessionStore();
        if (sessionStore.currentUserId) {
            await syncUserTenants(sessionStore.currentUserId);
        }
    }
    const getUserById = computed(() => (id) => users.value.find(u => u.id === id));
    const getUserByUsername = computed(() => (username) => users.value.find(u => u.username.toLowerCase() === username.toLowerCase()));
    /**
     * Registriert einen neuen Benutzer.
     * Versucht die Registrierung online und speichert den Benutzer andernfalls lokal.
     */
    async function registerUser(username, email, plainPassword) {
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
            const newDbUser = {
                uuid: backendUser.uuid,
                username: backendUser.name,
                email: backendUser.email,
                createdAt: backendUser.createdAt,
                updatedAt: backendUser.updatedAt,
                needsBackendSync: false,
            };
            const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
            const newLocalUser = {
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
        }
        catch (error) {
            errorLog('userStore', 'registerUser: Online-Registrierung fehlgeschlagen, versuche lokale Speicherung.', { error });
            const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
            const newDbUser = {
                uuid: userId,
                username: username.trim(),
                email: email.trim().toLowerCase(),
                passwordHash: hash,
                createdAt: now,
                updatedAt: now,
                needsBackendSync: true,
            };
            const newLocalUser = {
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
            }
            catch (dbError) {
                errorLog('userStore', 'registerUser: Fehler beim lokalen Speichern des Users nach fehlgeschlagener Online-Registrierung', { error: dbError });
                return null;
            }
        }
    }
    async function validateLogin(usernameOrEmail, plainPassword) {
        const inputLower = usernameOrEmail.toLowerCase();
        try {
            infoLog('userStore', 'validateLogin: Versuche Online-Login...');
            const backendUser = await apiService.login({
                username_or_email: inputLower,
                password: plainPassword,
            });
            infoLog('userStore', 'validateLogin: Online-Login erfolgreich', { userId: backendUser.uuid });
            const dbUser = {
                uuid: backendUser.uuid,
                username: backendUser.name,
                email: backendUser.email,
                createdAt: backendUser.createdAt,
                updatedAt: backendUser.updatedAt,
                needsBackendSync: false,
            };
            await db.dbUsers.put(dbUser);
            const localUser = {
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
            }
            else {
                users.value.push(localUser);
            }
            infoLog('userStore', `validateLogin: Starte syncUserTenants für User ${localUser.id} nach erfolgreichem Login.`);
            await syncUserTenants(localUser.id);
            infoLog('userStore', `validateLogin: syncUserTenants für User ${localUser.id} abgeschlossen.`);
            return localUser;
        }
        catch (error) {
            errorLog('userStore', 'validateLogin: Online-Login fehlgeschlagen.', { error });
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                warnLog('userStore', 'validateLogin: Netzwerkfehler (vermutlich offline), versuche lokalen Lookup.');
                let dbUser;
                dbUser = await db.dbUsers.where('email').equalsIgnoreCase(inputLower).first();
                if (!dbUser) {
                    dbUser = await db.dbUsers.where('username').equalsIgnoreCase(inputLower).first();
                }
                if (dbUser) {
                    infoLog('userStore', 'validateLogin: User lokal gefunden (Offline-Modus)', { userId: dbUser.uuid });
                    const localUser = {
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
    async function changePassword(userId, newPlainPassword) {
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
        }
        catch (err) {
            errorLog('userStore', 'changePassword: Fehler beim Aktualisieren von updatedAt in DB.', { id: userId, error: err });
        }
        infoLog('userStore', 'changePassword: Passwort (lokal) geändert. Backend-Sync erforderlich.', { id: userId });
        return true;
    }
    async function deleteUser(userId) {
        try {
            await db.transaction('rw', db.dbUsers, db.dbTenants, async () => {
                await db.dbUsers.delete(userId);
                await db.dbTenants.where('user_id').equals(userId).delete();
            });
            users.value = users.value.filter(u => u.id !== userId);
            infoLog('userStore', 'deleteUser: User und zugehörige Tenants aus DB gelöscht', { id: userId });
            return true;
        }
        catch (err) {
            errorLog('userStore', 'deleteUser: Fehler beim Löschen des Users', { id: userId, error: err });
            return false;
        }
    }
    async function reset() {
        try {
            await db.transaction('rw', db.dbUsers, db.dbTenants, async () => {
                await db.dbUsers.clear();
                await db.dbTenants.clear();
            });
            users.value = [];
            infoLog('userStore', 'reset: User- und Tenant-Tabellen in DB geleert.');
        }
        catch (err) {
            errorLog('userStore', 'reset: Fehler beim Leeren der DB-Tabellen', err);
        }
    }
    /**
     * Synchronisiert Benutzerdaten zwischen lokaler DB und Backend.
     * Verantwortlich für das Abrufen, Aktualisieren und Pushen von Benutzerdaten.
     */
    async function syncUsers() {
        infoLog('userStore', 'syncUsers: Starte User-Synchronisation');
        try {
            infoLog('userStore', 'syncUsers: Rufe User vom Backend ab...');
            const backendUsers = await apiService.getUsers();
            infoLog('userStore', 'syncUsers: User vom Backend erhalten', { count: backendUsers.length });
            const localDbUsers = await db.dbUsers.toArray();
            infoLog('userStore', 'syncUsers: Lokale User geladen', { count: localDbUsers.length });
            const usersToUpdateInDb = [];
            const usersToAddToDb = [];
            const usersToPushToBackend = [];
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
                }
                else {
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
                }
                else {
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
                    let backendUserResponse;
                    const userDataToPush = {
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
                    }
                    else {
                        infoLog('userStore', `syncUsers: Versuche, lokalen User ${lUserToPush.uuid} im Backend zu aktualisieren.`);
                        backendUserResponse = await apiService.updateUser(lUserToPush.uuid, userDataToPush);
                        await db.dbUsers.update(lUserToPush.uuid, {
                            updatedAt: backendUserResponse.updatedAt
                        });
                        infoLog('userStore', `syncUsers: Lokaler User ${lUserToPush.uuid} erfolgreich im Backend aktualisiert.`);
                    }
                }
                catch (error) {
                    errorLog('userStore', `syncUsers: Fehler beim Pushen des Users ${lUserToPush.uuid} zum Backend.`, { error });
                }
            }
            await _loadUsersFromDb();
            infoLog('userStore', 'syncUsers: User-Synchronisation abgeschlossen.');
        }
        catch (error) {
            errorLog('userStore', 'syncUsers: Fehler bei der User-Synchronisation', { error });
        }
    }
    async function syncUserTenants(userId) {
        infoLog('userStore', `syncUserTenants: Starte Tenant-Synchronisation für User ${userId}`);
        try {
            const backendTenants = await apiService.getTenantsForUser(userId);
            infoLog('userStore', `syncUserTenants: Tenants für User ${userId} vom Backend erhalten`, { count: backendTenants.length });
            const localTenants = await db.dbTenants.where({ user_id: userId }).toArray();
            infoLog('userStore', `syncUserTenants: Lokale Tenants für User ${userId} geladen`, { count: localTenants.length });
            const tenantsToAddToDbLocal = [];
            const tenantsToUpdateInDbLocal = [];
            const tenantsToPushToBackend = [];
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
                }
                else {
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
                const bTenant = backendTenants.find((t) => t.uuid === lTenant.uuid);
                if (!bTenant) {
                    tenantsToPushToBackend.push(lTenant);
                }
                else {
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
                const bTenant = backendTenants.find(t => t.uuid === lTenantToPush.uuid);
                try {
                    let backendTenantResponse;
                    if (!bTenant) {
                        // Tenant existiert nicht im Backend - erstellen
                        infoLog('userStore', `syncUserTenants: Erstelle neuen Tenant ${lTenantToPush.uuid} ("${lTenantToPush.tenantName}") im Backend.`);
                        const payload = {
                            uuid: lTenantToPush.uuid,
                            name: lTenantToPush.tenantName,
                            user_id: lTenantToPush.user_id,
                        };
                        backendTenantResponse = await apiService.createTenant(payload);
                    }
                    else {
                        // Tenant existiert bereits - aktualisieren
                        infoLog('userStore', `syncUserTenants: Aktualisiere existierenden Tenant ${lTenantToPush.uuid} ("${lTenantToPush.tenantName}") im Backend.`);
                        backendTenantResponse = await apiService.updateTenant(lTenantToPush.uuid, { name: lTenantToPush.tenantName }, lTenantToPush.user_id);
                    }
                    const updatedDbTenant = {
                        uuid: backendTenantResponse.uuid,
                        tenantName: backendTenantResponse.name,
                        user_id: backendTenantResponse.user_id,
                        createdAt: backendTenantResponse.createdAt,
                        updatedAt: backendTenantResponse.updatedAt,
                    };
                    await db.dbTenants.put(updatedDbTenant);
                    infoLog('userStore', 'syncUserTenants: Lokaler Tenant nach Push mit Backend-Daten aktualisiert', { tenantUuid: updatedDbTenant.uuid });
                }
                catch (error) {
                    let errorMessage = 'Unbekannter Synchronisationsfehler beim Pushen des Tenants';
                    if (error instanceof Error) {
                        errorMessage = error.message;
                        if (errorMessage.includes('already exists for this user') || errorMessage.includes('400')) {
                            warnLog('userStore', `syncUserTenants: Tenant ${lTenantToPush.uuid} ("${lTenantToPush.tenantName}") existiert bereits im Backend oder Validierungsfehler. Überspringe.`, { tenantUuid: lTenantToPush.uuid, originalErrorMessage: errorMessage });
                            continue;
                        }
                    }
                    else if (typeof error === 'string') {
                        errorMessage = error;
                    }
                    errorLog('userStore', `syncUserTenants: Fehler beim Pushen des lokalen Tenants ${lTenantToPush.uuid} zum Backend: ${errorMessage}`, { rawError: error, tenantUuid: lTenantToPush.uuid, dataSent: { name: lTenantToPush.tenantName, user_id: lTenantToPush.user_id } });
                }
            }
            const tenantStore = useTenantStore();
            await tenantStore.loadTenants();
            infoLog('userStore', `syncUserTenants: Tenant-Synchronisation für User ${userId} abgeschlossen und tenantStore.loadTenants() aufgerufen.`);
        }
        catch (error) {
            errorLog('userStore', `syncUserTenants: Fehler bei der Tenant-Synchronisation für User ${userId}`, { error });
        }
    }
    return {
        users,
        getUserById,
        getUserByUsername,
        registerUser,
        validateLogin,
        changePassword,
        deleteUser,
        reset,
        syncUsers,
        syncUserTenants,
        _loadUsersFromDb, // Exportiere für sessionStore
        initializeUserStore, // Exportiere für explizite Initialisierung
    };
});
