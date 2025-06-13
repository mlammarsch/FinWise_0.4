/**
 * Test Setup und Assertions für Integration Tests
 * Stellt Hilfsfunktionen für Test-Umgebung und Validierungen bereit
 */

import { vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MockTenantService } from '../mocks/mock-tenant-service';
import { MockWebSocketServer } from '../mocks/mock-websocket-server';
import type { SyncQueueEntry } from '../../src/types';
import { SyncStatus, BackendStatus } from '../../src/types';

// WebSocketConnectionStatus wird separat definiert, da es nicht in types exportiert ist
enum WebSocketConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export class TestSetup {
  private mockTenantService: MockTenantService;
  private pinia: any;

  constructor() {
    this.mockTenantService = new MockTenantService();
  }

  async initializeTestEnvironment(): Promise<void> {
    // Pinia Store Setup
    this.pinia = createPinia();
    setActivePinia(this.pinia);

    // Mock alle Store-Dependencies
    await this.setupStoreMocks();

    // IndexedDB für Tests vorbereiten
    await this.setupIndexedDB();

    // Logger-Mocks für saubere Test-Ausgabe
    this.setupLoggerMocks();
  }

  private async setupStoreMocks(): Promise<void> {
    // Mock TenantStore
    vi.doMock('../../src/stores/tenantStore', () => ({
      useTenantStore: () => this.mockTenantService.mockTenantStore()
    }));

    // Mock SessionStore
    vi.doMock('../../src/stores/sessionStore', () => ({
      useSessionStore: () => this.mockTenantService.mockSessionStore()
    }));

    // Mock WebSocketStore
    vi.doMock('../../src/stores/webSocketStore', () => ({
      useWebSocketStore: () => this.mockTenantService.mockWebSocketStore(),
      WebSocketConnectionStatus: {
        DISCONNECTED: 'DISCONNECTED',
        CONNECTING: 'CONNECTING',
        CONNECTED: 'CONNECTED',
        ERROR: 'ERROR'
      }
    }));

    // Mock TenantDbService
    const mockTenantService = this.mockTenantService;
    vi.doMock('../../src/services/TenantDbService', () => ({
      TenantDbService: class {
        constructor() {
          return mockTenantService.mockTenantDbService();
        }
      }
    }));
  }

  private async setupIndexedDB(): Promise<void> {
    // IndexedDB ist bereits durch fake-indexeddb in setup.ts gemockt
    // Hier können zusätzliche IndexedDB-spezifische Setups erfolgen
    await this.mockTenantService.setupMockTenant();
  }

  private setupLoggerMocks(): void {
    // Mock Logger-Funktionen für saubere Test-Ausgabe
    vi.doMock('../../src/utils/logger', () => ({
      debugLog: vi.fn(),
      infoLog: vi.fn(),
      warnLog: vi.fn(),
      errorLog: vi.fn()
    }));
  }

  async cleanup(): Promise<void> {
    await this.mockTenantService.cleanup();
    vi.clearAllMocks();
    vi.resetAllMocks();
  }

  getMockTenantService(): MockTenantService {
    return this.mockTenantService;
  }
}

export class TestAssertions {
  private mockTenantService: MockTenantService;

  constructor() {
    this.mockTenantService = new MockTenantService();
  }

  setMockTenantService(service: MockTenantService): void {
    this.mockTenantService = service;
  }

  /**
   * Wartet auf WebSocket-Verbindung
   */
  async waitForWebSocketConnection(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, timeoutMs);

      // Simuliere erfolgreiche Verbindung
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 100);
    });
  }

  /**
   * Wartet auf Sync-Verarbeitung
   */
  async waitForSyncProcessing(timeoutMs: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sync processing timeout'));
      }, timeoutMs);

      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 200);
    });
  }

  /**
   * Wartet auf Sync-Abschluss
   */
  async waitForSyncCompletion(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sync completion timeout'));
      }, timeoutMs);

      // Prüfe periodisch, ob alle Sync-Einträge verarbeitet wurden
      const checkInterval = setInterval(async () => {
        try {
          const pendingEntries = await this.getSyncQueueEntries();
          const hasPendingOrProcessing = pendingEntries.some(entry =>
            entry.status === SyncStatus.PENDING || entry.status === SyncStatus.PROCESSING
          );

          if (!hasPendingOrProcessing) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        } catch (error) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          reject(error);
        }
      }, 100);
    });
  }

  /**
   * Wartet auf Retry-Delay (exponential backoff)
   */
  async waitForRetryDelay(attemptNumber: number): Promise<void> {
    const baseDelay = 1000; // 1 Sekunde
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), 30000);

    return new Promise(resolve => {
      setTimeout(resolve, Math.min(delay, 1000)); // Für Tests verkürzt
    });
  }

  /**
   * Holt alle Sync-Queue-Einträge
   */
  async getSyncQueueEntries(): Promise<SyncQueueEntry[]> {
    return await this.mockTenantService.getTestSyncQueueEntries();
  }

  /**
   * Holt Sync-Queue-Einträge nach Status
   */
  async getSyncQueueEntriesByStatus(status: SyncStatus): Promise<SyncQueueEntry[]> {
    const allEntries = await this.getSyncQueueEntries();
    return allEntries.filter(entry => entry.status === status);
  }

  /**
   * Aktualisiert Sync-Entry-Timestamp für Tests
   */
  async updateSyncEntryTimestamp(entryId: string, timestamp: number): Promise<void> {
    await this.mockTenantService.updateSyncEntryTimestamp(entryId, timestamp);
  }

  /**
   * Validiert Sync-Queue-Status-Übergänge
   */
  async validateSyncStatusTransition(
    entryId: string,
    expectedStatus: SyncStatus,
    timeoutMs: number = 3000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Status transition timeout for entry ${entryId}`));
      }, timeoutMs);

      const checkInterval = setInterval(async () => {
        try {
          const entries = await this.getSyncQueueEntries();
          const entry = entries.find(e => e.id === entryId);

          if (entry && entry.status === expectedStatus) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        } catch (error) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          reject(error);
        }
      }, 100);
    });
  }

  /**
   * Validiert WebSocket-Nachrichtenverarbeitung
   */
  validateWebSocketMessage(message: any, expectedType: string, expectedPayload?: any): void {
    if (message.type !== expectedType) {
      throw new Error(`Expected message type ${expectedType}, got ${message.type}`);
    }

    if (expectedPayload) {
      const payloadMatches = this.deepEqual(message.payload, expectedPayload);
      if (!payloadMatches) {
        throw new Error(`Message payload does not match expected payload`);
      }
    }
  }

  /**
   * Validiert IndexedDB-Persistierung
   */
  async validateIndexedDBPersistence(entityId: string, entityType: 'account' | 'accountGroup'): Promise<void> {
    const db = this.mockTenantService.getMockDatabase();
    if (!db) throw new Error('Mock database not available');

    let entity;
    if (entityType === 'account') {
      entity = await db.accounts.get(entityId);
    } else {
      entity = await db.accountGroups.get(entityId);
    }

    if (!entity) {
      throw new Error(`Entity ${entityId} not found in IndexedDB`);
    }
  }

  /**
   * Validiert Store-State-Management
   */
  validateStoreState(store: any, expectedState: any): void {
    for (const [key, expectedValue] of Object.entries(expectedState)) {
      const actualValue = store[key];
      if (!this.deepEqual(actualValue, expectedValue)) {
        throw new Error(`Store state mismatch for ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
      }
    }
  }

  /**
   * Validiert Logging-Output
   */
  validateLoggingOutput(logFunction: any, expectedCalls: number, expectedMessages?: string[]): void {
    if (logFunction.mock.calls.length !== expectedCalls) {
      throw new Error(`Expected ${expectedCalls} log calls, got ${logFunction.mock.calls.length}`);
    }

    if (expectedMessages) {
      expectedMessages.forEach((expectedMessage, index) => {
        const actualCall = logFunction.mock.calls[index];
        const actualMessage = actualCall ? actualCall[1] : '';

        if (!actualMessage.includes(expectedMessage)) {
          throw new Error(`Log call ${index} does not contain expected message: ${expectedMessage}`);
        }
      });
    }
  }

  /**
   * Erstellt Test-Timeout für Async-Operationen
   */
  createTimeout(timeoutMs: number, errorMessage: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    });
  }

  /**
   * Wartet auf Bedingung mit Timeout
   */
  async waitForCondition(
    condition: () => Promise<boolean> | boolean,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Deep equality check für Objekte
   */
  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;

    if (obj1 == null || obj2 == null) return false;

    if (typeof obj1 !== typeof obj2) return false;

    if (typeof obj1 !== 'object') return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
  }

  /**
   * Hilfsmethode für Test-Debugging
   */
  async debugSyncQueueState(): Promise<void> {
    const entries = await this.getSyncQueueEntries();
    console.log('Current Sync Queue State:', {
      total: entries.length,
      pending: entries.filter(e => e.status === SyncStatus.PENDING).length,
      processing: entries.filter(e => e.status === SyncStatus.PROCESSING).length,
      synced: entries.filter(e => e.status === SyncStatus.SYNCED).length,
      failed: entries.filter(e => e.status === SyncStatus.FAILED).length,
      entries: entries.map(e => ({
        id: e.id,
        status: e.status,
        entityType: e.entityType,
        operationType: e.operationType,
        attempts: e.attempts,
        error: e.error
      }))
    });
  }
}
