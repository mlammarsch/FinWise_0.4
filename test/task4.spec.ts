import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import fs from 'fs';
import { TenantDbService } from '../src/services/TenantDbService';
import { useTenantStore, FinwiseTenantSpecificDB } from '../src/stores/tenantStore';
import { useWebSocketStore } from '../src/stores/webSocketStore';
import { SyncStatus, BackendStatus, EntityTypeEnum, SyncOperationType, type Account, type AccountGroup, type SyncQueueEntry } from '../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mocking external dependencies
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

// Mock Pinia stores and other utilities
vi.mock('@/utils/logger', () => ({
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  warnLog: vi.fn(),
  errorLog: vi.fn(),
}));

vi.mock('../src/stores/tenantStore', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useTenantStore: vi.fn(),
  };
});

vi.mock('../src/stores/webSocketStore', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useWebSocketStore: vi.fn(),
  };
});

// Mock Dexie table interactions for FinwiseTenantSpecificDB
const mockDbInstance = {
  syncQueue: {
    add: vi.fn(),
    // Weitere Methoden können hier bei Bedarf gemockt werden
  },
  // Weitere Tabellen können hier bei Bedarf gemockt werden
};

const logFilePath = 'test-output/task4-debug.log';
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp} - ${message}`;
  if (data) {
    logMessage += `\n${JSON.stringify(data, null, 2)}`;
  }
  fs.appendFileSync(logFilePath, logMessage + '\n');
};

describe('TenantDbService - addSyncQueueEntry', () => {
  let tenantDbService: TenantDbService;
  let mockTenantStore: any;
  let mockWebSocketStore: any;
  let currentMockUuidCounter: number;

  const mockTenantId = 'test-tenant-id';

  beforeEach(() => {
    // Reset mocks and clear log file before each test
    vi.clearAllMocks();
    if (fs.existsSync(logFilePath)) {
      fs.unlinkSync(logFilePath); // Clear log file for each test run for clarity
    }
    debugLog('Test run started for a new test case.');

    currentMockUuidCounter = 0;
    (uuidv4 as Mock).mockImplementation(() => `mock-uuid-${++currentMockUuidCounter}`);

    mockTenantStore = {
      activeTenantDB: mockDbInstance,
      activeTenantId: mockTenantId,
    };
    (useTenantStore as unknown as Mock).mockReturnValue(mockTenantStore);

    mockWebSocketStore = {
      backendStatus: BackendStatus.OFFLINE, // Default to offline for most tests
      // Weitere Store-Eigenschaften/Methoden hier bei Bedarf
    };
    (useWebSocketStore as unknown as Mock).mockReturnValue(mockWebSocketStore);

    tenantDbService = new TenantDbService();
    debugLog('TenantDbService instance created for test.');
  });

  afterEach(() => {
    debugLog('Test case finished.');
  });

  describe('when offline', () => {
    beforeEach(() => {
      mockWebSocketStore.backendStatus = BackendStatus.OFFLINE;
      debugLog('Set backendStatus to OFFLINE for this block.');
    });

    const accountCreatePayload: Account = {
      id: 'acc-1', name: 'Test Account', accountType: 'CHECKING' as any, isActive: true, isOfflineBudget: false, accountGroupId: 'ag-1', sortOrder: 1, balance: 1000, offset: 0,
    };
    const accountUpdatePayload: Account = {
      id: 'acc-2', name: 'Updated Account', accountType: 'SAVINGS' as any, isActive: true, isOfflineBudget: false, accountGroupId: 'ag-2', sortOrder: 2, balance: 2000, offset: 0,
    };
    const accountGroupDeletePayload = { id: 'ag-delete-1' }; // Nur ID für Delete

    it('should add a valid Account "create" entry to the sync queue', async () => {
      debugLog('Test: add Account "create" entry (offline)');
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: accountCreatePayload.id,
        operationType: SyncOperationType.CREATE,
        payload: accountCreatePayload,
      };
      mockDbInstance.syncQueue.add.mockResolvedValueOnce(entryData.entityId); // Simulate Dexie add success

      const result = await tenantDbService.addSyncQueueEntry(entryData);
      debugLog('Result from addSyncQueueEntry', result);

      expect(mockDbInstance.syncQueue.add).toHaveBeenCalledTimes(1);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      debugLog('Entry passed to db.syncQueue.add', addedEntry);

      expect(addedEntry.id).toBe('mock-uuid-1');
      expect(addedEntry.tenantId).toBe(mockTenantId);
      expect(addedEntry.entityType).toBe(EntityTypeEnum.ACCOUNT);
      expect(addedEntry.entityId).toBe(accountCreatePayload.id);
      expect(addedEntry.operationType).toBe(SyncOperationType.CREATE);
      expect(addedEntry.payload).toEqual(accountCreatePayload);
      expect(addedEntry.status).toBe(SyncStatus.PENDING);
      expect(addedEntry.timestamp).toBeTypeOf('number');
      expect(addedEntry.attempts).toBe(0);
      expect(result).toEqual(addedEntry);
    });

    it('should add a valid Account "update" entry to the sync queue', async () => {
      debugLog('Test: add Account "update" entry (offline)');
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: accountUpdatePayload.id,
        operationType: SyncOperationType.UPDATE,
        payload: accountUpdatePayload,
      };
      mockDbInstance.syncQueue.add.mockResolvedValueOnce(entryData.entityId);

      const result = await tenantDbService.addSyncQueueEntry(entryData);
      debugLog('Result from addSyncQueueEntry', result);

      expect(mockDbInstance.syncQueue.add).toHaveBeenCalledTimes(1);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      debugLog('Entry passed to db.syncQueue.add', addedEntry);

      expect(addedEntry.id).toBe('mock-uuid-1');
      expect(addedEntry.tenantId).toBe(mockTenantId);
      expect(addedEntry.entityType).toBe(EntityTypeEnum.ACCOUNT);
      expect(addedEntry.entityId).toBe(accountUpdatePayload.id);
      expect(addedEntry.operationType).toBe(SyncOperationType.UPDATE);
      expect(addedEntry.payload).toEqual(accountUpdatePayload);
      expect(addedEntry.status).toBe(SyncStatus.PENDING);
      expect(result).toEqual(addedEntry);
    });

    it('should add a valid AccountGroup "delete" entry to the sync queue', async () => {
      debugLog('Test: add AccountGroup "delete" entry (offline)');
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT_GROUP,
        entityId: accountGroupDeletePayload.id,
        operationType: SyncOperationType.DELETE,
        payload: accountGroupDeletePayload, // Bei Delete ist payload { id: "..." }
      };
      mockDbInstance.syncQueue.add.mockResolvedValueOnce(entryData.entityId);

      const result = await tenantDbService.addSyncQueueEntry(entryData);
      debugLog('Result from addSyncQueueEntry', result);

      expect(mockDbInstance.syncQueue.add).toHaveBeenCalledTimes(1);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      debugLog('Entry passed to db.syncQueue.add', addedEntry);

      expect(addedEntry.id).toBe('mock-uuid-1');
      expect(addedEntry.tenantId).toBe(mockTenantId);
      expect(addedEntry.entityType).toBe(EntityTypeEnum.ACCOUNT_GROUP);
      expect(addedEntry.entityId).toBe(accountGroupDeletePayload.id);
      expect(addedEntry.operationType).toBe(SyncOperationType.DELETE);
      expect(addedEntry.payload).toEqual(accountGroupDeletePayload);
      expect(addedEntry.status).toBe(SyncStatus.PENDING);
      expect(result).toEqual(addedEntry);
    });

    const validPayloadsTable = [
      { entity: EntityTypeEnum.ACCOUNT, action: SyncOperationType.CREATE, payload: { id: 'acc-p1', name: 'Payload Acc 1', accountType: 'CHECKING', isActive: true, isOfflineBudget: false, accountGroupId: 'ag-p1', sortOrder: 1, balance: 100, offset: 0 } as Account },
      { entity: EntityTypeEnum.ACCOUNT_GROUP, action: SyncOperationType.UPDATE, payload: { id: 'ag-p2', name: 'Payload AG 2', sortOrder: 2 } as AccountGroup },
      { entity: EntityTypeEnum.ACCOUNT, action: SyncOperationType.DELETE, payload: { id: 'acc-p3-del' } }, // Nur ID für Delete
    ];

    it.each(validPayloadsTable)('should handle various valid payloads for entity $entity and action $action', async ({ entity, action, payload }) => {
      debugLog(`Test.each: entity ${entity}, action ${action} (offline)`, payload);
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: entity,
        entityId: payload.id,
        operationType: action,
        payload: payload,
      };
      mockDbInstance.syncQueue.add.mockResolvedValueOnce(payload.id);

      const result = await tenantDbService.addSyncQueueEntry(entryData);
      debugLog('Result from addSyncQueueEntry (it.each)', result);

      expect(mockDbInstance.syncQueue.add).toHaveBeenCalledTimes(1);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      debugLog('Entry passed to db.syncQueue.add (it.each)', addedEntry);

      expect(addedEntry.id).toBe('mock-uuid-1'); // UUID wird pro Testfall neu generiert (durch beforeEach)
      expect(addedEntry.tenantId).toBe(mockTenantId);
      expect(addedEntry.entityType).toBe(entity);
      expect(addedEntry.entityId).toBe(payload.id);
      expect(addedEntry.operationType).toBe(action);
      expect(addedEntry.payload).toEqual(payload);
      expect(addedEntry.status).toBe(SyncStatus.PENDING);
      expect(addedEntry.attempts).toBe(0);
      expect(result).toEqual(addedEntry);
    });

    it('should assign a new UUID as id', async () => {
      debugLog('Test: assign new UUID (offline)');
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT, entityId: 'any-id', operationType: SyncOperationType.CREATE, payload: { id: 'any-id' } as any,
      };
      mockDbInstance.syncQueue.add.mockResolvedValueOnce('any-id');
      await tenantDbService.addSyncQueueEntry(entryData);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      expect(addedEntry.id).toBe('mock-uuid-1');

      // Zweiter Aufruf sollte eine neue UUID bekommen, basierend auf der beforeEach-Logik.
      // Die `mockImplementation` von uuidv4 aus beforeEach ist: () => `mock-uuid-${++currentMockUuidCounter}`
      // `currentMockUuidCounter` ist nach dem ersten Aufruf von `addSyncQueueEntry` in diesem Test 1.
      // Für den zweiten Aufruf wird `currentMockUuidCounter` innerhalb des Mocks zu 2.
      // Die mock.calls sind 0-indiziert, daher ist der erste Aufruf mock.calls[0], der zweite mock.calls[1].
      // Wichtig: mockDbInstance.syncQueue.add.mock.calls wird NICHT zwischen den `it`-Blöcken zurückgesetzt,
      // aber `vi.clearAllMocks()` in `beforeEach` setzt die `.calls`-Arrays der Mocks zurück.
      // Da dieser Test zwei Aufrufe von addSyncQueueEntry innerhalb desselben `it`-Blocks macht,
      // greifen wir auf mock.calls[0] und mock.calls[1] zu.
      await tenantDbService.addSyncQueueEntry(entryData); // Zweiter Aufruf innerhalb dieses Tests
      const addedEntry2 = mockDbInstance.syncQueue.add.mock.calls[1][0] as SyncQueueEntry;
      expect(addedEntry2.id).toBe('mock-uuid-2');
    });

    it('should set timestamp and status to "pending" for new entries', async () => {
      debugLog('Test: set timestamp and status (offline)');
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT, entityId: 'any-id', operationType: SyncOperationType.CREATE, payload: { id: 'any-id' } as any,
      };
      const mockTimestamp = Date.now(); // Erfasse Zeitstempel vor dem Aufruf
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);
      mockDbInstance.syncQueue.add.mockResolvedValueOnce('any-id');

      await tenantDbService.addSyncQueueEntry(entryData);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      debugLog('Entry for timestamp/status test', addedEntry);

      expect(addedEntry.status).toBe(SyncStatus.PENDING);
      expect(addedEntry.timestamp).toBe(mockTimestamp);
      expect(addedEntry.attempts).toBe(0);
      dateNowSpy.mockRestore();
    });

    it('should reject if Dexie add operation fails', async () => {
      debugLog('Test: Dexie add operation fails (offline)');
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT, entityId: 'fail-id', operationType: SyncOperationType.CREATE, payload: { id: 'fail-id' } as any,
      };
      const dexieError = new Error('Dexie add failed');
      mockDbInstance.syncQueue.add.mockRejectedValueOnce(dexieError);

      await expect(tenantDbService.addSyncQueueEntry(entryData)).rejects.toThrow(dexieError);
      debugLog('Dexie add failed as expected.');
      expect(mockDbInstance.syncQueue.add).toHaveBeenCalledTimes(1);
    });

     it('should throw an error if activeTenantDB is null', async () => {
      debugLog('Test: activeTenantDB is null (offline)');
      mockTenantStore.activeTenantDB = null;
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT, entityId: 'any-id', operationType: SyncOperationType.CREATE, payload: { id: 'any-id' } as any,
      };
      await expect(tenantDbService.addSyncQueueEntry(entryData)).rejects.toThrow('Keine aktive Mandanten-DB oder activeTenantId verfügbar.');
      debugLog('Error thrown for null activeTenantDB as expected.');
    });

    it('should throw an error if activeTenantId is null', async () => {
      debugLog('Test: activeTenantId is null (offline)');
      mockTenantStore.activeTenantId = null;
       const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT, entityId: 'any-id', operationType: SyncOperationType.CREATE, payload: { id: 'any-id' } as any,
      };
      await expect(tenantDbService.addSyncQueueEntry(entryData)).rejects.toThrow('Keine aktive Mandanten-DB oder activeTenantId verfügbar.');
      debugLog('Error thrown for null activeTenantId as expected.');
    });
  });

  describe('when online', () => {
    beforeEach(() => {
      mockWebSocketStore.backendStatus = BackendStatus.ONLINE;
      debugLog('Set backendStatus to ONLINE for this block.');
      // WICHTIG: Die Logik, die entscheidet, ob addSyncQueueEntry überhaupt aufgerufen wird,
      // liegt außerhalb von TenantDbService.addSyncQueueEntry selbst.
      // Diese Tests hier prüfen nur das Verhalten von addSyncQueueEntry, wenn es TROTZDEM aufgerufen wird.
      // In der Realität würde eine übergeordnete Service-Funktion (z.B. in AccountService)
      // bei Online-Status direkt ans Backend senden und addSyncQueueEntry gar nicht erst aufrufen.
      // Da die Aufgabe aber explizit das Verhalten von "Speichern in Sync Queue wenn offline" testet,
      // fokussieren wir uns darauf, dass addSyncQueueEntry *selbst* keine Unterscheidung online/offline trifft,
      // sondern immer versucht hinzuzufügen, wenn es aufgerufen wird. Die Online/Offline-Logik
      // muss in den aufrufenden Services (z.B. AccountService, AccountGroupService) implementiert sein.
      // Für Task 4 ist das Verhalten von addSyncQueueEntry selbst im Fokus.
    });

    it('should still add an entry to the sync queue if called directly (assuming calling service handles online/offline logic)', async () => {
      debugLog('Test: add entry when online (if called directly)');
      // Dieser Test stellt sicher, dass addSyncQueueEntry selbst keine Online/Offline-Prüfung durchführt.
      // Die Verantwortung dafür liegt beim aufrufenden Service.
      const entryData: Omit<SyncQueueEntry, 'id' | 'timestamp' | 'status' | 'tenantId' | 'attempts' | 'lastAttempt' | 'error'> = {
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: 'acc-online',
        operationType: SyncOperationType.CREATE,
        payload: { id: 'acc-online', name: 'Online Acc' } as any,
      };
      mockDbInstance.syncQueue.add.mockResolvedValueOnce(entryData.entityId);

      const result = await tenantDbService.addSyncQueueEntry(entryData);
      debugLog('Result from addSyncQueueEntry (online, direct call)', result);

      expect(mockDbInstance.syncQueue.add).toHaveBeenCalledTimes(1);
      const addedEntry = mockDbInstance.syncQueue.add.mock.calls[0][0] as SyncQueueEntry;
      expect(addedEntry.status).toBe(SyncStatus.PENDING); // Es wird immer als PENDING hinzugefügt
      debugLog('Entry added even when online, as expected for direct call to addSyncQueueEntry.');
    });
  });

  // Die Tests für "with invalid input" sind für addSyncQueueEntry weniger relevant,
  // da die Typisierung von Omit<SyncQueueEntry, ...> bereits viele ungültige Eingaben
  // auf TypeScript-Ebene abfängt. Die Validierung der Payload-Struktur selbst (z.B. ob ein Account-Objekt gültig ist)
  // wäre Aufgabe einer übergeordneten Validierungsschicht oder spezifischer Validatoren für Account, AccountGroup etc.
  // addSyncQueueEntry vertraut darauf, dass die übergebenen entryData-Felder (entityType, entityId, operationType, payload) korrekt sind.
  // Die wichtigsten Fehlerfälle (DB nicht verfügbar) sind oben abgedeckt.
});
