// test/task5.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, type Mocked } from 'vitest';
import { WebSocketService } from '../src/services/WebSocketService';
import { TenantDbService } from '../src/services/TenantDbService';
import { useWebSocketStore, WebSocketConnectionStatus } from '../src/stores/webSocketStore';
import { useTenantStore } from '../src/stores/tenantStore';
import { useSessionStore } from '../src/stores/sessionStore';
import { BackendStatus, SyncStatus, EntityTypeEnum, SyncOperationType, type SyncQueueEntry } from '../src/types';
import * as logger from '../src/utils/logger';
import fs from 'fs/promises';
import path from 'path';

const TEST_TENANT_ID = 'test-tenant-id-123';
const DEBUG_LOG_PATH = path.resolve(__dirname, '../test-output/task5-debug.log');

// Mocking Pinia Stores
vi.mock('../src/stores/webSocketStore', async (importOriginal) => {
  const actual = await importOriginal() as typeof import('../src/stores/webSocketStore');
  const webSocketStoreInstance = actual.useWebSocketStore(); // Call the actual store function to get an instance
  return {
    ...actual,
    useWebSocketStore: () => ({
      ...webSocketStoreInstance, // Spread the actual instance properties
      connectionStatus: webSocketStoreInstance.connectionStatus, // Use ref value
      backendStatus: webSocketStoreInstance.backendStatus, // Use ref value
      lastError: webSocketStoreInstance.lastError, // Use ref value
      lastMessage: webSocketStoreInstance.lastMessage, // Use ref value
      setConnectionStatus: vi.fn((status: WebSocketConnectionStatus) => {
        webSocketStoreInstance.connectionStatus = status;
        if (status === WebSocketConnectionStatus.DISCONNECTED || status === WebSocketConnectionStatus.ERROR) {
          webSocketStoreInstance.backendStatus = BackendStatus.OFFLINE;
        }
        // Simulate watch trigger by directly calling the method that would be watched
        WebSocketService.checkAndProcessSyncQueue();
      }),
      setBackendStatus: vi.fn((status: BackendStatus) => {
        webSocketStoreInstance.backendStatus = status;
        // Simulate watch trigger
        WebSocketService.checkAndProcessSyncQueue();
      }),
      setError: vi.fn((error: string | null) => {
        webSocketStoreInstance.lastError = error;
        if (error) webSocketStoreInstance.connectionStatus = WebSocketConnectionStatus.ERROR;
      }),
      setLastMessage: vi.fn(),
      reset: vi.fn(),
    }),
  };
});

vi.mock('../src/stores/tenantStore', () => ({
  useTenantStore: vi.fn(() => ({
    activeTenantId: TEST_TENANT_ID,
    activeTenantDB: {
      // Mock DB methods if directly used by WebSocketService,
      // but for these tests, TenantDbService is the primary interaction point.
    },
  })),
}));

vi.mock('../src/stores/sessionStore', () => ({
  useSessionStore: vi.fn(() => ({
    currentTenantId: TEST_TENANT_ID,
  })),
}));

// Mocking Services
vi.mock('../src/services/TenantDbService');

// Mocking WebSocket itself (native WebSocket)
const mockWebSocketInstance = {
  onopen: vi.fn(),
  onmessage: vi.fn(),
  onerror: vi.fn(),
  onclose: vi.fn(),
  close: vi.fn(),
  send: vi.fn(),
  readyState: WebSocket.OPEN, // Default to open for sendMessage tests, can be changed
};
global.WebSocket = vi.fn(() => mockWebSocketInstance) as any;


// Mocking logger
vi.mock('../src/utils/logger', () => ({
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  warnLog: vi.fn(),
  errorLog: vi.fn(),
}));

// Mock für eine hypothetische Datenabruffunktion (FR5)
const mockFetchLatestDataFromServer = vi.fn<() => Promise<{ success: boolean; data?: any; error?: any }>>();
// Wir heften diese Funktion dynamisch an das WebSocketService-Objekt für Testzwecke.
// Dies ist unüblich für Unit-Tests von externen Modulen, aber folgt der vorherigen Logik.
// Besser wäre es, wenn WebSocketService eine Methode dafür hätte oder es über Dependency Injection käme.
(WebSocketService as any).fetchLatestDataFromServer = mockFetchLatestDataFromServer;


describe('Sync Queue Processing on Reconnect', () => {
  let webSocketStoreMock: ReturnType<typeof useWebSocketStore>;

  const mockPendingEntries: SyncQueueEntry[] = [
    { id: 'sq1', tenantId: TEST_TENANT_ID, entityType: EntityTypeEnum.ACCOUNT, entityId: 'acc1', operationType: SyncOperationType.CREATE, payload: { id: 'acc1', name: 'Test Account 1' } as any, timestamp: Date.now() - 1000, status: SyncStatus.PENDING, attempts: 0 },
    { id: 'sq2', tenantId: TEST_TENANT_ID, entityType: EntityTypeEnum.ACCOUNT_GROUP, entityId: 'ag1', operationType: SyncOperationType.UPDATE, payload: { id: 'ag1', name: 'Test Account Group 1 Updated' } as any, timestamp: Date.now() - 500, status: SyncStatus.PENDING, attempts: 0 },
  ];

  const mockEmptyPendingEntries: SyncQueueEntry[] = [];

  beforeAll(async () => {
    try {
      await fs.mkdir(path.dirname(DEBUG_LOG_PATH), { recursive: true });
      await fs.writeFile(DEBUG_LOG_PATH, ''); // Clear log file
    } catch (error) {
      console.error("Failed to clear debug log for task5:", error);
    }
    // Redefine logger.debugLog to append to file for testing purposes
    const originalDebugLog = logger.debugLog; // Assuming logger.debugLog is the one we want to spy on
    vi.spyOn(logger, 'debugLog').mockImplementation(async (moduleName: string, message: string, details?: any) => {
      if (originalDebugLog && typeof originalDebugLog === 'function') {
        originalDebugLog(moduleName, message, details); // Keep console logging if desired
      }
      const logEntry = `${new Date().toISOString()} [${moduleName}] ${message}${details ? ' | ' + JSON.stringify(details) : ''}\n`;
      try {
        await fs.appendFile(DEBUG_LOG_PATH, logEntry);
      } catch (error) {
        // console.error("Failed to write to debug log for task5:", error);
      }
    });
  });

  beforeEach(() => {
    vi.clearAllMocks(); // Clears all mocks, including spies
    webSocketStoreMock = useWebSocketStore();

    // Reset store states for mocks - directly manipulate the refs or mock implementations
    webSocketStoreMock.connectionStatus = WebSocketConnectionStatus.DISCONNECTED;
    webSocketStoreMock.backendStatus = BackendStatus.OFFLINE;

    // Ensure mock implementations are fresh if they rely on closure variables that change
    (webSocketStoreMock.setConnectionStatus as Mocked<typeof webSocketStoreMock.setConnectionStatus>).mockImplementation((status: WebSocketConnectionStatus) => {
        webSocketStoreMock.connectionStatus = status;
        if (status === WebSocketConnectionStatus.DISCONNECTED || status === WebSocketConnectionStatus.ERROR) {
          webSocketStoreMock.backendStatus = BackendStatus.OFFLINE;
        }
        WebSocketService.checkAndProcessSyncQueue();
    });
    (webSocketStoreMock.setBackendStatus as Mocked<typeof webSocketStoreMock.setBackendStatus>).mockImplementation((status: BackendStatus) => {
        webSocketStoreMock.backendStatus = status;
         WebSocketService.checkAndProcessSyncQueue();
    });


    // Mock TenantDbService methods
    vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValue(JSON.parse(JSON.stringify(mockPendingEntries))); // Deep copy
    vi.mocked(TenantDbService.prototype.updateSyncQueueEntryStatus).mockResolvedValue(true);

    // Mock the FR5 data fetch function
    // Ensure this is reset for each test if it's not done by clearAllMocks for assigned functions
    mockFetchLatestDataFromServer.mockReset(); // Reset an
    mockFetchLatestDataFromServer.mockResolvedValue({ success: true, data: { accounts: [], accountGroups: [] } });

    // Initialize WebSocketService to set up watchers.
    // In a real app, this happens once. For tests, ensure it's set up.
    // WebSocketService.initialize(); // This was causing issues with immediate calls. Rely on manual trigger via setConnectionStatus/setBackendStatus.
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restores original implementations if any were spied on and not fully mocked
  });

  it('should NOT process queue if it remains offline', async () => {
    // Initial state is offline, do nothing that would trigger a connection
    await WebSocketService.checkAndProcessSyncQueue(); // Explicitly call to check
    expect(TenantDbService.prototype.getPendingSyncEntries).not.toHaveBeenCalled();
    expect(mockFetchLatestDataFromServer).not.toHaveBeenCalled();
  });

  describe('when connection is restored (goes online)', () => {
    beforeEach(async () => {
      // Simulate going online
      // Order matters: first connect, then backend becomes online
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);
      // await new Promise(resolve => setTimeout(resolve, 0)); // Allow microtasks to settle if needed
    });

    it('should first attempt to fetch latest data from backend (FR5)', async () => {
      expect(mockFetchLatestDataFromServer).toHaveBeenCalledTimes(1);
    });

    it('should fetch pending entries from TenantDbService after successful data fetch', async () => {
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });
      // Reset and re-trigger
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);

      expect(mockFetchLatestDataFromServer).toHaveBeenCalledTimes(1+1); // previous call + this one
      expect(TenantDbService.prototype.getPendingSyncEntries).toHaveBeenCalledWith(TEST_TENANT_ID);
      expect(TenantDbService.prototype.getPendingSyncEntries).toHaveBeenCalledTimes(1);
    });

    it('should send each pending entry via WebSocketService if initial data fetch was successful', async () => {
      const nativeSocketSendMock = mockWebSocketInstance.send;
      nativeSocketSendMock.mockClear();

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce(JSON.parse(JSON.stringify(mockPendingEntries)));
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);
      // await new Promise(setImmediate);

      expect(nativeSocketSendMock).toHaveBeenCalledTimes(mockPendingEntries.length);
      for (const entry of mockPendingEntries) {
        expect(nativeSocketSendMock).toHaveBeenCalledWith(JSON.stringify({
          type: 'process_sync_entry',
          payload: entry,
        }));
      }
    });

    it('should update status of successfully sent entries to "processing"', async () => {
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce(JSON.parse(JSON.stringify(mockPendingEntries)));
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });
      const nativeSocketSendMock = mockWebSocketInstance.send;
      nativeSocketSendMock.mockClear();

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);
      // await new Promise(setImmediate);

      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledTimes(mockPendingEntries.length);
      for (const entry of mockPendingEntries) {
        expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledWith(entry.id, SyncStatus.PROCESSING);
      }
    });

    it('should update status of failed entries to "pending" and log an error if send fails', async () => {
       vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce([JSON.parse(JSON.stringify(mockPendingEntries[0]))]);
       mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });

      const nativeSocketSendMock = mockWebSocketInstance.send;
      nativeSocketSendMock.mockImplementationOnce(() => { // Make this specific send fail
        throw new Error('Simulated send error');
      });

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);
      // await new Promise(setImmediate);

      // Called once for PROCESSING, then once for PENDING due to failure
      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledWith(mockPendingEntries[0].id, SyncStatus.PROCESSING);
      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledWith(mockPendingEntries[0].id, SyncStatus.PENDING, 'Failed to send to WebSocket');
      expect(logger.errorLog).toHaveBeenCalledWith(
        '[WebSocketService]',
        `Failed to send sync entry ${mockPendingEntries[0].id}. Setting back to PENDING.`
      );
    });

    it('should handle an empty sync queue gracefully (no send attempts, no errors)', async () => {
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce(mockEmptyPendingEntries);
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });
      const nativeSocketSendMock = vi.mocked(global.WebSocket.mock.results[0].value.send);
      nativeSocketSendMock.mockClear();


      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);


      expect(mockFetchLatestDataFromServer).toHaveBeenCalledTimes(1); // Called for FR5
      expect(TenantDbService.prototype.getPendingSyncEntries).toHaveBeenCalledWith(TEST_TENANT_ID);
      expect(nativeSocketSendMock).not.toHaveBeenCalled();
      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).not.toHaveBeenCalled();
      expect(logger.errorLog).not.toHaveBeenCalled(); // No errors should be logged
      expect(logger.infoLog).toHaveBeenCalledWith('[WebSocketService]', 'No pending entries in sync queue.');
    });

    it('should process multiple entries in sequence', async () => {
      const multipleEntries: SyncQueueEntry[] = [
        { id: 'entry1', tenantId: TEST_TENANT_ID, entityType: EntityTypeEnum.ACCOUNT, entityId: 'acc1', operationType: SyncOperationType.CREATE, payload: {} as any, timestamp: 1, status: SyncStatus.PENDING },
        { id: 'entry2', tenantId: TEST_TENANT_ID, entityType: EntityTypeEnum.ACCOUNT, entityId: 'acc2', operationType: SyncOperationType.UPDATE, payload: {} as any, timestamp: 2, status: SyncStatus.PENDING },
      ];
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce(multipleEntries);
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });
      const nativeSocketSendMock = mockWebSocketInstance.send;
      nativeSocketSendMock.mockClear();

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);


      expect(nativeSocketSendMock).toHaveBeenCalledTimes(multipleEntries.length);
      // Check they were called with the correct payloads in order (simplified check)
      expect(nativeSocketSendMock.mock.calls[0][0]).toContain('entry1');
      expect(nativeSocketSendMock.mock.calls[1][0]).toContain('entry2');

      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledWith('entry1', SyncStatus.PROCESSING);
      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledWith('entry2', SyncStatus.PROCESSING);
    });

    const entryTestCases = [
      { entity: EntityTypeEnum.ACCOUNT, action: SyncOperationType.CREATE, payload: { id: 'acc-c', name: 'New Account' } },
      { entity: EntityTypeEnum.ACCOUNT_GROUP, action: SyncOperationType.UPDATE, payload: { id: 'ag-u', name: 'Updated Group' } },
      { entity: EntityTypeEnum.ACCOUNT, action: SyncOperationType.DELETE, payload: { id: 'acc-d' } }, // Delete payload only has id
    ];

    it.each(entryTestCases)('should correctly map SyncQueueEntry fields to the send function for entity $entity, action $action', async ({ entity, action, payload }) => {
      const testEntry: SyncQueueEntry = {
        id: 'test-entry-map',
        tenantId: TEST_TENANT_ID,
        entityType: entity,
        entityId: payload.id,
        operationType: action,
        payload: payload as any,
        timestamp: Date.now(),
        status: SyncStatus.PENDING,
      };
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce([testEntry]);
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });
      const nativeSocketSendMock = mockWebSocketInstance.send;
      nativeSocketSendMock.mockClear();

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);

      expect(nativeSocketSendMock).toHaveBeenCalledTimes(1);
      expect(nativeSocketSendMock).toHaveBeenCalledWith(JSON.stringify({
        type: 'process_sync_entry',
        payload: testEntry,
      }));
    });

    it('should NOT process queue if initial data fetch (FR5) fails', async () => {
      mockFetchLatestDataFromServer.mockRejectedValueOnce(new Error('Failed to fetch latest data'));
      // Reset and re-trigger
      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.OFFLINE);

      // Clear previous calls to getPendingSyncEntries from other tests or beforeEach
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockClear();

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);

      // Wait for promises to settle, especially the async checkAndProcessSyncQueue
      // await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFetchLatestDataFromServer).toHaveBeenCalledTimes(1);
      // It seems the current implementation of WebSocketService.processSyncQueue
      // does not explicitly stop if fetchLatestDataFromServer fails.
      // It would proceed to call getPendingSyncEntries.
      // This test highlights a potential area for improvement in WebSocketService.
      // For now, we test the current behavior.
      // If FR5 is critical, processSyncQueue should check the result of fetchLatestDataFromServer.

      // Based on current WebSocketService, it would still try to get pending entries.
      // Let's assume for the test that if FR5 fails, we *don't* want to proceed.
      // The mock for fetchLatestDataFromServer is part of WebSocketService itself.
      // The actual processSyncQueue doesn't have a call to it.
      // The test setup calls it *before* processSyncQueue.
      // The `checkAndProcessSyncQueue` in the mocked store calls `WebSocketService.processSyncQueue`
      // *after* the mocked `fetchLatestDataFromServer` is called by the test itself.

      // Let's refine the test: if `fetchLatestDataFromServer` (which we mocked into WebSocketService)
      // is supposed to gate `processSyncQueue`, then `processSyncQueue` shouldn't run.
      // The current `WebSocketService.checkAndProcessSyncQueue` calls `this.processSyncQueue()`
      // unconditionally if online.
      // The FR5 requirement implies `checkAndProcessSyncQueue` should look like:
      // async checkAndProcessSyncQueue() {
      //   if (online) {
      //     const success = await this.fetchLatestDataFromServer();
      //     if (success) this.processSyncQueue();
      //   }
      // }
      // Since this logic is not in the actual code, the test for "NOT process queue if initial data fetch (FR5) fails"
      // needs to be adapted or it will test an assumed behavior.

      // For now, let's assume the test means: if our *test-controlled* FR5 call fails,
      // then subsequent calls within the *same logical operation* (like getPendingSyncEntries)
      // should not happen *if the design intended FR5 to be a gate*.
      // Given the current code structure, `processSyncQueue` is independent of the FR5 mock.
      // The test as written will show `getPendingSyncEntries` IS called.
      // This is a valid test of the *current* code.
      // To make it "NOT process", `WebSocketService.checkAndProcessSyncQueue` would need modification.

      // Let's adjust the expectation to reflect current behavior:
      // It *will* call getPendingSyncEntries because processSyncQueue is not gated by the FR5 mock.
      // However, the spirit of FR5 is that the overall operation should halt.
      // The prompt implies the *orchestration* should stop.

      // Let's assume the test implies that if `mockFetchLatestDataFromServer` (which is called by the test logic *before* `processSyncQueue` effectively runs due to status changes) fails,
      // then `processSyncQueue` should ideally not proceed.
      // The current `WebSocketService.checkAndProcessSyncQueue` doesn't know about the FR5 call's success/failure.
      // So, `processSyncQueue` will run.

      // If the intention of the test "should NOT process queue if initial data fetch (FR5) fails"
      // is that `WebSocketService.processSyncQueue` itself should not be invoked or should bail out early,
      // then the `WebSocketService.checkAndProcessSyncQueue` needs to be more intelligent.
      // Given the current structure, `processSyncQueue` will be called.
      // The test will verify that `getPendingSyncEntries` is NOT called if we assume `processSyncQueue`
      // itself checks a flag set by the FR5 call, or if `checkAndProcessSyncQueue` handles it.
      // Since `processSyncQueue` doesn't have this check, it *will* call `getPendingSyncEntries`.

      // The most direct way to test "NOT process queue if FR5 fails" is to modify the mock of
      // `checkAndProcessSyncQueue` or `processSyncQueue` for this specific test case.
      // Or, assert that `getPendingSyncEntries` is not called if `mockFetchLatestDataFromServer` fails,
      // implying that `processSyncQueue` was either not called or exited early.

      // Let's assume the FR5 call is a prerequisite. If it throws, the sync process should halt.
      // The current `WebSocketService.checkAndProcessSyncQueue` doesn't await or check `fetchLatestDataFromServer`.
      // The test setup calls `mockFetchLatestDataFromServer` and then triggers `checkAndProcessSyncQueue`.
      // So, `processSyncQueue` will run regardless.
      // This test case as stated cannot pass with current code unless `processSyncQueue` is modified.
      // I will test that `getPendingSyncEntries` is NOT called, assuming an ideal implementation.
      // This will likely fail with current code, highlighting the gap.

      // To make this test meaningful for the current code:
      // The `mockFetchLatestDataFromServer` is called by the test suite's logic, not by `checkAndProcessSyncQueue`.
      // So, if `mockFetchLatestDataFromServer` throws, `checkAndProcessSyncQueue` will still run.
      // The test should reflect that `processSyncQueue` is still called.
      // The "NOT process queue" would mean `getPendingSyncEntries` inside `processSyncQueue` is not called.
      // This requires `processSyncQueue` to be aware of the FR5 failure.

      // Let's assume the FR5 failure should prevent `getPendingSyncEntries`.
      // The current `processSyncQueue` doesn't have this check.
      // So, `getPendingSyncEntries` *will* be called.
      // This test will fail as per the strict requirement "should NOT process queue".
      // This is fine, as it points out the missing FR5 gating.
      expect(TenantDbService.prototype.getPendingSyncEntries).not.toHaveBeenCalled();
      // If the above fails, it means processSyncQueue ran and called it.
      // To make it pass with current code, the expectation would be .toHaveBeenCalled().
      // But the requirement is "NOT process".
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle errors during fetching pending entries', async () => {
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockRejectedValueOnce(new Error('DB fetch error'));
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true }); // FR5 succeeds

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);

      // await new Promise(resolve => setTimeout(resolve, 0)); // Settle promises

      expect(mockFetchLatestDataFromServer).toHaveBeenCalledTimes(1);
      expect(TenantDbService.prototype.getPendingSyncEntries).toHaveBeenCalledWith(TEST_TENANT_ID);
      expect(logger.errorLog).toHaveBeenCalledWith(
        '[WebSocketService]',
        'Error processing sync queue:',
        expect.any(Error) // expect.objectContaining({ message: 'DB fetch error' })
      );
      // Ensure no entries were attempted to be sent or status updated
      const nativeSocketSendMock = vi.mocked(global.WebSocket.mock.results[0].value.send);
      expect(nativeSocketSendMock).not.toHaveBeenCalled();
      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).not.toHaveBeenCalled();
    });

    it('should handle errors during status update in TenantDbService (e.g. to PROCESSING)', async () => {
      const entryToFailUpdate = mockPendingEntries[0];
      vi.mocked(TenantDbService.prototype.getPendingSyncEntries).mockResolvedValueOnce([entryToFailUpdate]);
      // Simulate failure when updating the first entry to PROCESSING
      vi.mocked(TenantDbService.prototype.updateSyncQueueEntryStatus)
        .mockImplementationOnce(async (id, status) => {
          if (id === entryToFailUpdate.id && status === SyncStatus.PROCESSING) {
            return false; // Simulate update failure
          }
          return true;
        });
      mockFetchLatestDataFromServer.mockResolvedValueOnce({ success: true });
      const nativeSocketSendMock = vi.mocked(global.WebSocket.mock.results[0].value.send);

      webSocketStoreMock.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
      webSocketStoreMock.setBackendStatus(BackendStatus.ONLINE);

      // await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFetchLatestDataFromServer).toHaveBeenCalledTimes(1);
      expect(TenantDbService.prototype.getPendingSyncEntries).toHaveBeenCalledWith(TEST_TENANT_ID);
      // Update to PROCESSING is attempted for the first entry
      expect(TenantDbService.prototype.updateSyncQueueEntryStatus).toHaveBeenCalledWith(entryToFailUpdate.id, SyncStatus.PROCESSING);
      // Error should be logged for the failed update
      expect(logger.errorLog).toHaveBeenCalledWith(
        '[WebSocketService]',
        `Failed to update sync entry ${entryToFailUpdate.id} to PROCESSING. Skipping.`
      );
      // The entry whose status update failed should not be sent
      expect(nativeSocketSendMock).not.toHaveBeenCalledWith(expect.stringContaining(entryToFailUpdate.id));
      // If there were other entries, they should still be processed.
      // For this test, only one entry is processed, and its update fails.
    });
  });
});
