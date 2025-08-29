import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import Dexie from 'dexie';
import { debugLog, infoLog, errorLog, warnLog } from '@/utils/logger';
import { apiService } from '@/services/apiService';
export class FinwiseTenantSpecificDB extends Dexie {
    constructor(databaseName) {
        super(databaseName);
        Object.defineProperty(this, "accounts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "accountGroups", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "categories", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "categoryGroups", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "transactions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "planningTransactions", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "recipients", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tags", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "rules", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "monthlyBalances", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "syncQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "logoCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.version(1).stores({
            accounts: '&id, name, accountType, isActive, accountGroupId',
            accountGroups: '&id, name',
        });
        this.version(2).stores({
            accounts: '&id, name, accountType, isActive, accountGroupId',
            accountGroups: '&id, name',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status',
        });
        this.version(3).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status',
        });
        this.version(4).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(5).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(6).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(7).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
            recipients: '&id, name, defaultCategoryId, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(8).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
            recipients: '&id, name, defaultCategoryId, updated_at',
            tags: '&id, name, parentTagId, color, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(9).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
            recipients: '&id, name, defaultCategoryId, updated_at',
            tags: '&id, name, parentTagId, color, updated_at',
            rules: '&id, name, stage, priority, isActive, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(10).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
            planningTransactions: '&id, name, accountId, categoryId, startDate, isActive, recurrencePattern, transactionType, updated_at',
            recipients: '&id, name, defaultCategoryId, updated_at',
            tags: '&id, name, parentTagId, color, updated_at',
            rules: '&id, name, stage, priority, isActive, updated_at',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(11).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, valueDate, amount, description, type, runningBalance, [accountId+date], [categoryId+date]',
            planningTransactions: '&id, name, accountId, categoryId, startDate, isActive, recurrencePattern, transactionType, updated_at',
            recipients: '&id, name, defaultCategoryId, updated_at',
            tags: '&id, name, parentTagId, color, updated_at',
            rules: '&id, name, stage, priority, isActive, updated_at',
            monthlyBalances: '&[year+month], year, month',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
        });
        this.version(12).stores({
            logoCache: '&path',
        });
        this.version(13).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, recipientId, valueDate, amount, description, type, runningBalance, updated_at, [accountId+date], [categoryId+date]',
            planningTransactions: '&id, name, accountId, categoryId, startDate, isActive, recurrencePattern, transactionType, updated_at',
            recipients: '&id, name, defaultCategoryId, updated_at',
            tags: '&id, name, parentTagId, color, updated_at',
            rules: '&id, name, stage, priority, isActive, updated_at',
            monthlyBalances: '&[year+month], year, month',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
            logoCache: '&path',
        });
        this.version(14).stores({
            accounts: '&id, name, description, note, accountType, isActive, isOfflineBudget, accountGroupId, sortOrder, iban, balance, creditLimit, offset, image, updated_at',
            accountGroups: '&id, name, sortOrder, image, updated_at',
            categories: '&id, name, isActive, categoryGroupId, parentCategoryId, sortOrder, isIncomeCategory, isSavingsGoal, goalDate, priority, proportion, monthlyAmount, note, updated_at',
            categoryGroups: '&id, name, sortOrder, isIncomeGroup, updated_at',
            transactions: '&id, accountId, categoryId, date, recipientId, valueDate, amount, description, type, runningBalance, updated_at, [accountId+date], [categoryId+date]',
            planningTransactions: '&id, name, accountId, categoryId, startDate, isActive, recurrencePattern, transactionType, updated_at',
            recipients: '&id, name, defaultCategoryId, updated_at',
            tags: '&id, name, parentTagId, color, updated_at',
            rules: '&id, name, stage, priority, isActive, updated_at',
            monthlyBalances: '&[year+month], year, month',
            syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]',
            logoCache: '&path',
        });
    }
}
class FinwiseUserDBGlobal extends Dexie {
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
        this.version(1).stores({
            dbUsers: '&uuid, username, email, createdAt, updatedAt',
            dbTenants: '&uuid, tenantName, user_id, createdAt, updatedAt',
        });
    }
}
const userDB = new FinwiseUserDBGlobal();
import { useAccountStore } from './accountStore';
import { useCategoryStore } from './categoryStore';
import { useSessionStore } from './sessionStore';
import { WebSocketService } from '@/services/WebSocketService';
export const useTenantStore = defineStore('tenant', () => {
    const tenants = ref([]);
    const activeTenantId = ref(null);
    const activeTenantDB = ref(null);
    const getTenantsByUser = computed(() => (userId) => tenants.value.filter(t => t.user_id === userId));
    const activeTenant = computed(() => tenants.value.find(t => t.uuid === activeTenantId.value) || null);
    async function loadTenants() {
        try {
            tenants.value = await userDB.dbTenants.toArray();
            debugLog('tenantStore', 'loadTenants: Tenants geladen', { count: tenants.value.length });
            const storedActiveTenantId = localStorage.getItem('finwise_activeTenant');
            if (storedActiveTenantId && tenants.value.some(t => t.uuid === storedActiveTenantId)) {
                activeTenantId.value = storedActiveTenantId;
                infoLog('tenantStore', 'loadTenants: Aktiver Tenant aus localStorage wiederhergestellt', { activeTenantId: storedActiveTenantId });
            }
            else if (activeTenantId.value && !tenants.value.some(t => t.uuid === activeTenantId.value)) {
                activeTenantId.value = null;
                localStorage.removeItem('finwise_activeTenant');
            }
        }
        catch (err) {
            errorLog('tenantStore', 'Fehler beim Ausführen von loadTenants', err);
            tenants.value = [];
        }
    }
    // Initialisierung wird jetzt explizit aufgerufen, nicht automatisch bei Store-Erstellung
    async function initializeTenantStore() {
        await loadTenants();
    }
    async function addTenant(tenantName, userId) {
        if (!tenantName.trim() || !userId) {
            errorLog('tenantStore', 'addTenant: Ungültiger Name oder UserID');
            return null;
        }
        const now = new Date().toISOString();
        const newTenant = {
            uuid: uuidv4(),
            tenantName: tenantName.trim(),
            user_id: userId,
            createdAt: now,
            updatedAt: now,
        };
        try {
            await userDB.dbTenants.add(newTenant);
            tenants.value.push(newTenant);
            infoLog('tenantStore', `Neuer Tenant "${newTenant.tenantName}" für User ${userId} lokal angelegt`, { tenantId: newTenant.uuid });
            _syncTenantWithBackend(newTenant).then(syncSuccess => {
                if (syncSuccess) {
                    infoLog('tenantStore', `Tenant ${newTenant.uuid} erfolgreich im Hintergrund mit Backend synchronisiert.`);
                }
                else {
                    warnLog('tenantStore', `Hintergrund-Synchronisation für Tenant ${newTenant.uuid} mit Backend fehlgeschlagen. Lokale Anlage bleibt bestehen.`);
                }
            });
            await setActiveTenant(newTenant.uuid);
            return newTenant;
        }
        catch (err) {
            errorLog('tenantStore', 'Fehler beim Hinzufügen des Tenants zur DB', { error: err });
            return null;
        }
    }
    async function updateTenant(id, tenantName) {
        if (!tenantName.trim())
            return false;
        const now = new Date().toISOString();
        try {
            const updateCount = await userDB.dbTenants.update(id, {
                tenantName: tenantName.trim(),
                updatedAt: now,
            });
            if (updateCount > 0) {
                const idx = tenants.value.findIndex(t => t.uuid === id);
                if (idx !== -1) {
                    tenants.value[idx].tenantName = tenantName.trim();
                    tenants.value[idx].updatedAt = now;
                }
                debugLog('tenantStore', 'updateTenant: Tenant lokal aktualisiert', { id, tenantName });
                return true;
            }
            warnLog('tenantStore', 'updateTenant: Tenant nicht gefunden oder keine Änderungen', { id });
            return false;
        }
        catch (err) {
            errorLog('tenantStore', `Fehler beim Aktualisieren des Tenants ${id}`, err);
            return false;
        }
    }
    async function deleteTenant(id, sendBackendSignal = true) {
        try {
            // Signal ans Backend senden, um Datenbankressourcen freizugeben
            if (sendBackendSignal) {
                try {
                    const { WebSocketService } = await import('@/services/WebSocketService');
                    const success = WebSocketService.sendTenantDisconnect(id, 'tenant_deletion');
                    if (success) {
                        infoLog('tenantStore', 'Tenant deletion signal sent to backend', { tenantId: id });
                        // Kurze Pause, um dem Backend Zeit zu geben, Ressourcen freizugeben
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    else {
                        warnLog('tenantStore', 'Failed to send tenant deletion signal - WebSocket not connected', { tenantId: id });
                    }
                }
                catch (error) {
                    warnLog('tenantStore', 'Error sending tenant deletion signal', { tenantId: id, error });
                }
            }
            await userDB.dbTenants.delete(id);
            const dbName = `finwiseTenantDB_${id}`;
            await Dexie.delete(dbName);
            infoLog('tenantStore', `Mandantenspezifische DB ${dbName} gelöscht.`);
            tenants.value = tenants.value.filter(t => t.uuid !== id);
            if (activeTenantId.value === id) {
                if (activeTenantDB.value) {
                    activeTenantDB.value.close();
                    activeTenantDB.value = null;
                }
                activeTenantId.value = null;
                localStorage.removeItem('finwise_activeTenant');
            }
            infoLog('tenantStore', 'Tenant gelöscht', { tenantId: id });
            return true;
        }
        catch (err) {
            errorLog('tenantStore', `Fehler beim Löschen des Tenants ${id}`, err);
            return false;
        }
    }
    async function deleteTenantCompletely(id, userId) {
        try {
            // Zuerst Backend-Signal senden, um Datenbankressourcen freizugeben
            try {
                const { WebSocketService } = await import('@/services/WebSocketService');
                const success = WebSocketService.sendTenantDisconnect(id, 'tenant_deletion');
                if (success) {
                    infoLog('tenantStore', 'Tenant deletion signal sent to backend', { tenantId: id });
                    // Kurze Pause, um dem Backend Zeit zu geben, Ressourcen freizugeben
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                else {
                    warnLog('tenantStore', 'Failed to send tenant deletion signal - WebSocket not connected', { tenantId: id });
                }
            }
            catch (error) {
                warnLog('tenantStore', 'Error sending tenant deletion signal', { tenantId: id, error });
            }
            // Backend-API für vollständige Löschung aufrufen
            try {
                await apiService.delete(`/tenants/${id}/complete?user_id=${userId}`);
                infoLog('tenantStore', `Tenant ${id} erfolgreich im Backend gelöscht`);
            }
            catch (apiError) {
                // Wenn Tenant bereits gelöscht (404), ist das OK
                if (apiError?.status === 404 || apiError?.message?.includes('404') || apiError?.message?.includes('not found')) {
                    warnLog('tenantStore', `Tenant ${id} war bereits im Backend gelöscht`, apiError);
                }
                else {
                    errorLog('tenantStore', `Fehler beim Löschen des Tenants ${id} im Backend`, apiError);
                    // Bei anderen Fehlern trotzdem lokale Löschung durchführen
                }
            }
            // Lokale Löschung durchführen
            await userDB.dbTenants.delete(id);
            const dbName = `finwiseTenantDB_${id}`;
            await Dexie.delete(dbName);
            infoLog('tenantStore', `Mandantenspezifische DB ${dbName} gelöscht.`);
            tenants.value = tenants.value.filter(t => t.uuid !== id);
            if (activeTenantId.value === id) {
                if (activeTenantDB.value) {
                    activeTenantDB.value.close();
                    activeTenantDB.value = null;
                }
                activeTenantId.value = null;
                localStorage.removeItem('finwise_activeTenant');
            }
            infoLog('tenantStore', 'Tenant vollständig gelöscht', { tenantId: id });
            return true;
        }
        catch (err) {
            errorLog('tenantStore', `Fehler beim vollständigen Löschen des Tenants ${id}`, err);
            return false;
        }
    }
    async function setActiveTenant(id) {
        if (activeTenantId.value === id && activeTenantDB.value?.isOpen()) {
            debugLog('tenantStore', `Tenant ${id} ist bereits aktiv und DB verbunden.`);
            return true;
        }
        const previousDbInstance = activeTenantDB.value;
        if (previousDbInstance instanceof Dexie) {
            previousDbInstance.close();
            activeTenantDB.value = null;
            debugLog('tenantStore', 'Vorherige aktive Mandanten-DB (Dexie-Instanz) geschlossen.');
        }
        else if (previousDbInstance) {
            warnLog('tenantStore', 'Vorherige aktive Mandanten-DB war keine Dexie-Instanz, konnte nicht sicher geschlossen werden.', previousDbInstance);
            activeTenantDB.value = null;
        }
        if (!id) {
            activeTenantId.value = null;
            localStorage.removeItem('finwise_activeTenant');
            infoLog('tenantStore', 'Kein Tenant aktiv.');
            return true;
        }
        let tenantExists = tenants.value.find(t => t.uuid === id);
        if (!tenantExists) {
            warnLog('tenantStore', `setActiveTenant: Tenant ${id} nicht sofort in der Liste gefunden. Versuche erneutes Laden der Tenants aus der userDB.`);
            await loadTenants();
            tenantExists = tenants.value.find(t => t.uuid === id);
        }
        if (!tenantExists) {
            errorLog('tenantStore', `setActiveTenant: Tenant mit ID ${id} auch nach erneutem Laden aus userDB nicht gefunden. Mandantenspezifische DB wird nicht geöffnet.`);
            if (activeTenantId.value === id) {
                activeTenantId.value = null;
                localStorage.removeItem('finwise_activeTenant');
                const dbInstanceToClose = activeTenantDB.value;
                const dbToCloseDueToNotFoundTenant = activeTenantDB.value;
                if (dbToCloseDueToNotFoundTenant instanceof Dexie) {
                    dbToCloseDueToNotFoundTenant.close();
                    activeTenantDB.value = null;
                    debugLog('tenantStore', 'setActiveTenant: DB für nicht gefundenen (aber zuvor aktiven) Tenant geschlossen.');
                }
                else if (dbToCloseDueToNotFoundTenant) {
                    warnLog('tenantStore', 'setActiveTenant: DB-Instanz für nicht gefundenen Tenant war keine Dexie-Instanz.', dbToCloseDueToNotFoundTenant);
                    activeTenantDB.value = null;
                }
            }
            const session = useSessionStore();
            if (session.currentTenantId === id) {
                session.currentTenantId = null;
                warnLog('tenantStore', `setActiveTenant: currentTenantId im sessionStore für ungültigen Tenant ${id} zurückgesetzt.`);
            }
            return false;
        }
        activeTenantId.value = id;
        localStorage.setItem('finwise_activeTenant', id);
        const session = useSessionStore();
        try {
            const dbName = `finwiseTenantDB_${id}`;
            const tenantDB = new FinwiseTenantSpecificDB(dbName);
            await tenantDB.open();
            activeTenantDB.value = tenantDB;
            // KRITISCH: Session erst NACH erfolgreicher DB-Verbindung setzen
            // Dies verhindert Race Conditions beim WebSocket-Reconnect
            debugLog('tenantStore', `DB erfolgreich geöffnet für Tenant ${id}, setze jetzt Session`);
            session.currentTenantId = id;
            infoLog('tenantStore', `Tenant "${tenantExists.tenantName}" (DB: ${dbName}) aktiviert und DB verbunden. SessionStore aktualisiert.`);
            // Stores vollständig zurücksetzen und neu initialisieren
            debugLog('tenantStore', `Initialisiere alle Stores für neuen Tenant ${id}`);
            // Alle relevanten Stores resetten
            const accountStore = useAccountStore();
            await accountStore.reset();
            const categoryStore = useCategoryStore();
            await categoryStore.reset();
            // Weitere Stores importieren und resetten
            const { useRecipientStore } = await import('./recipientStore');
            const recipientStore = useRecipientStore();
            await recipientStore.reset();
            const { useTagStore } = await import('./tagStore');
            const tagStore = useTagStore();
            await tagStore.reset();
            const { useRuleStore } = await import('./ruleStore');
            const ruleStore = useRuleStore();
            await ruleStore.reset();
            const { usePlanningStore } = await import('./planningStore');
            const planningStore = usePlanningStore();
            await planningStore.reset();
            const { useTransactionStore } = await import('./transactionStore');
            const transactionStore = useTransactionStore();
            await transactionStore.reset();
            // Stores neu initialisieren
            await accountStore.initializeStore();
            await categoryStore.initializeStore();
            debugLog('tenantStore', `Alle Stores für Tenant ${id} zurückgesetzt und Account/Category-Stores initialisiert`);
            if (id) {
                WebSocketService.requestInitialData(id);
                infoLog('tenantStore', `setActiveTenant: Anforderung für initiale Daten für Tenant ${id} an WebSocketService gesendet.`);
            }
            return true;
        }
        catch (err) {
            errorLog('tenantStore', `Fehler beim Verbinden/Initialisieren der Mandanten-DB für ${id}`, err);
            activeTenantDB.value = null;
            activeTenantId.value = null;
            localStorage.removeItem('finwise_activeTenant');
            session.currentTenantId = null;
            return false;
        }
    }
    async function reset() {
        try {
            await userDB.dbTenants.clear();
            tenants.value = [];
            if (activeTenantDB.value) {
                activeTenantDB.value.close();
            }
            activeTenantDB.value = null;
            activeTenantId.value = null;
            localStorage.removeItem('finwise_activeTenant');
            useSessionStore().currentTenantId = null;
            infoLog('tenantStore', 'Alle Tenant-Einträge in finwiseUserDB geleert und aktiver Tenant zurückgesetzt.');
        }
        catch (err) {
            errorLog('tenantStore', 'Fehler beim Reset des TenantStores (Tenant-Liste)', err);
        }
    }
    async function syncCurrentTenantData() {
        if (!activeTenantDB.value || !activeTenantId.value) {
            warnLog('tenantStore', 'syncCurrentTenantData: Kein aktiver Mandant oder DB-Verbindung.');
            return;
        }
        debugLog('tenantStore', `syncCurrentTenantData für Mandant ${activeTenantId.value} aufgerufen (Platzhalter)`);
    }
    async function _syncTenantWithBackend(tenant) {
        debugLog('tenantStore', `Versuche Tenant ${tenant.uuid} mit Backend zu synchronisieren via apiService.`);
        try {
            const payload = {
                uuid: tenant.uuid,
                name: tenant.tenantName,
                user_id: tenant.user_id,
            };
            await apiService.post('/tenants/', payload);
            infoLog('tenantStore', `Tenant ${tenant.uuid} ("${tenant.tenantName}") erfolgreich mit Backend synchronisiert.`);
            return true;
        }
        catch (error) {
            let errorMessage = 'Unbekannter Synchronisationsfehler';
            if (error instanceof Error) {
                errorMessage = error.message;
                if (errorMessage.includes('already exists for this user')) {
                    warnLog('tenantStore', `Tenant ${tenant.uuid} ("${tenant.tenantName}") existiert bereits im Backend oder ein anderer Fehler mit dieser Meldung ist aufgetreten.`, { tenantUuid: tenant.uuid, originalErrorMessage: errorMessage });
                    return true;
                }
            }
            else if (typeof error === 'string') {
                errorMessage = error;
            }
            errorLog('tenantStore', `Fehler bei der Synchronisation von Tenant ${tenant.uuid} ("${tenant.tenantName}") mit Backend: ${errorMessage}`, { rawError: error, tenantUuid: tenant.uuid });
            return false;
        }
    }
    return {
        tenants,
        activeTenantId,
        activeTenantDB,
        getTenantsByUser,
        activeTenant,
        loadTenants,
        addTenant,
        updateTenant,
        deleteTenant,
        deleteTenantCompletely,
        setActiveTenant,
        reset,
        syncCurrentTenantData,
        initializeTenantStore, // Exportiere für explizite Initialisierung
    };
});
