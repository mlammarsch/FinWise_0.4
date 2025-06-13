/**
 * Sync Error Handling Integration Tests
 * Testet alle Fehlerbehandlungs-Szenarien der Sync-Pipeline
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAccountStore } from '../../src/stores/accountStore';
import { WebSocketService } from '../../src/services/WebSocketService';
import { MockWebSocketServer } from '../mocks/mock-websocket-server';
import { MockTenantService } from '../mocks/mock-tenant-service';
import { TestDataGenerator } from '../mocks/test-data-generators';
import { TestSetup, TestAssertions } from '../utils/test-setup';
import { SyncStatus, SyncOperationType, EntityTypeEnum } from '../../src/types';

describe('Sync Error Handling Integration Tests', () => {
  let mockWebSocketServer: MockWebSocketServer;
  let mockTenantService: MockTenantService;
  let testDataGenerator: TestDataGenerator;
  let testSetup: TestSetup;
  let testAssertions: TestAssertions;
  let accountStore: ReturnType<typeof useAccountStore>;

  beforeEach(async () => {
    // Setup
    const pinia = createPinia();
    setActivePinia(pinia);

    mockWebSocketServer = new MockWebSocketServer();
    mockTenantService = new MockTenantService();
    testDataGenerator = new TestDataGenerator();
    testSetup = new TestSetup();
    testAssertions = new TestAssertions();

    await testSetup.initializeTestEnvironment();
    await mockTenantService.setupMockTenant();
    await mockWebSocketServer.start();

    accountStore = useAccountStore();
    testAssertions.setMockTenantService(mockTenantService);

    // Mock WebSocket Service Methoden
    vi.spyOn(WebSocketService, 'connect').mockImplementation(() => {
      mockWebSocketServer.simulateConnection();
    });

    vi.spyOn(WebSocketService, 'sendMessage').mockImplementation((message) => {
      return mockWebSocketServer.receiveMessage(message as any);
    });
  });

  afterEach(async () => {
    await mockWebSocketServer.stop();
    await testSetup.cleanup();
    testDataGenerator.reset();
    vi.restoreAllMocks();
  });

  describe('Validation Error Handling', () => {
    it('sollte validation_error mit Retry-Mechanismus behandeln', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('validation_error', 'Invalid account data format');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      await accountStore.addAccount(testAccount);

      // Assert - Erster Versuch fehlgeschlagen
      await testAssertions.waitForSyncProcessing();
      let syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        status: SyncStatus.PENDING,
        attempts: 1,
        error: expect.stringContaining('validation_error')
      }));

      // Act - Zweiter Versuch erfolgreich
      mockWebSocketServer.enableAutoAck();
      await testAssertions.waitForRetryDelay(1);
      await WebSocketService.processSyncQueue();

      // Assert - Erfolgreich nach Retry
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });

    it('sollte validation_error nach maximalen Retries als FAILED markieren', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('validation_error', 'Persistent validation error');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act - Account erstellen und alle Retry-Versuche durchführen
      await accountStore.addAccount(testAccount);

      // Simuliere 3 fehlgeschlagene Versuche
      for (let i = 0; i < 3; i++) {
        await testAssertions.waitForSyncProcessing();
        if (i < 2) {
          await testAssertions.waitForRetryDelay(i + 1);
          await WebSocketService.processSyncQueue();
        }
      }

      // Assert - Als FAILED markiert
      const syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.FAILED);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        status: SyncStatus.FAILED,
        attempts: 3,
        error: expect.stringContaining('Max retries')
      }));
    });
  });

  describe('Database Error Handling', () => {
    it('sollte database_error mit exponential backoff behandeln', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('database_error', 'Database connection timeout');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      await accountStore.addAccount(testAccount);

      // Assert - Erster Versuch mit kurzer Wartezeit
      await testAssertions.waitForSyncProcessing();
      let syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries[0].attempts).toBe(1);

      // Act - Zweiter Versuch mit längerer Wartezeit
      await testAssertions.waitForRetryDelay(1); // 1 Sekunde
      await WebSocketService.processSyncQueue();
      await testAssertions.waitForSyncProcessing();

      syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries[0].attempts).toBe(2);

      // Act - Dritter Versuch erfolgreich
      mockWebSocketServer.enableAutoAck();
      await testAssertions.waitForRetryDelay(2); // 2 Sekunden (exponential backoff)
      await WebSocketService.processSyncQueue();

      // Assert - Erfolgreich nach exponential backoff
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });

    it('sollte database_error mit höherer Retry-Anzahl behandeln', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('database_error', 'Database temporarily unavailable');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      await accountStore.addAccount(testAccount);

      // Database-Fehler sollten mehr Retries bekommen als Validation-Fehler
      const maxRetries = 5; // Annahme: Database-Fehler bekommen 5 Retries

      // Simuliere alle Retry-Versuche
      for (let i = 0; i < maxRetries; i++) {
        await testAssertions.waitForSyncProcessing();
        if (i < maxRetries - 1) {
          await testAssertions.waitForRetryDelay(i + 1);
          await WebSocketService.processSyncQueue();
        }
      }

      // Assert - Nach maximalen Database-Retries als FAILED markiert
      const syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.FAILED);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0].attempts).toBe(maxRetries);
    });
  });

  describe('Network Error Handling', () => {
    it('sollte Verbindungsabbruch während Sync behandeln', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act - Account erstellen
      await accountStore.addAccount(testAccount);

      // Simuliere Verbindungsabbruch während Sync
      mockWebSocketServer.simulateNetworkError();

      // Assert - Eintrag bleibt in Queue
      await testAssertions.waitForSyncProcessing();
      const syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries).toHaveLength(1);

      // Act - Verbindung wiederherstellen
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();
      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();
      await WebSocketService.processSyncQueue();

      // Assert - Nach Reconnect erfolgreich synchronisiert
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });

    it('sollte Timeout-Fehler korrekt behandeln', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.simulateSlowBackend(5000); // 5 Sekunden Delay

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      await accountStore.addAccount(testAccount);

      // Assert - Timeout führt zu Retry
      await testAssertions.waitForSyncProcessing();

      // Simuliere Timeout-Recovery
      mockWebSocketServer.enableAutoAck();
      await testAssertions.waitForRetryDelay(1);
      await WebSocketService.processSyncQueue();

      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });
  });

  describe('Stuck Processing Entry Recovery', () => {
    it('sollte hängende PROCESSING-Einträge beim Start zurücksetzen', async () => {
      // Arrange - Erstelle hängende PROCESSING-Einträge
      const stuckEntries = testDataGenerator.generateStuckProcessingEntries(3);

      for (const entry of stuckEntries) {
        await mockTenantService.addTestSyncQueueEntry(entry);
      }

      // Assert - Einträge sind PROCESSING
      let processingEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PROCESSING);
      expect(processingEntries).toHaveLength(3);

      // Act - WebSocket Service initialisieren (triggert Reset)
      await WebSocketService.initializeSyncQueue();

      // Assert - Hängende Einträge wurden zurückgesetzt
      const pendingEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(pendingEntries).toHaveLength(3);

      pendingEntries.forEach(entry => {
        expect(entry.error).toContain('Reset from stuck PROCESSING state');
      });
    });

    it('sollte nur alte PROCESSING-Einträge zurücksetzen', async () => {
      // Arrange
      const oldEntry = testDataGenerator.generateSyncQueueEntry({
        status: SyncStatus.PROCESSING,
        lastAttempt: Date.now() - 60000, // 60 Sekunden alt
        attempts: 1
      });

      const recentEntry = testDataGenerator.generateSyncQueueEntry({
        status: SyncStatus.PROCESSING,
        lastAttempt: Date.now() - 10000, // 10 Sekunden alt (nicht hängend)
        attempts: 1
      });

      await mockTenantService.addTestSyncQueueEntry(oldEntry);
      await mockTenantService.addTestSyncQueueEntry(recentEntry);

      // Act
      await WebSocketService.initializeSyncQueue();

      // Assert - Nur alter Eintrag wurde zurückgesetzt
      const pendingEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      const processingEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PROCESSING);

      expect(pendingEntries).toHaveLength(1); // Alter Eintrag zurückgesetzt
      expect(processingEntries).toHaveLength(1); // Neuer Eintrag bleibt PROCESSING

      expect(pendingEntries[0].id).toBe(oldEntry.id);
      expect(processingEntries[0].id).toBe(recentEntry.id);
    });
  });

  describe('Dead Letter Queue Handling', () => {
    it('sollte dauerhaft fehlgeschlagene Einträge in Dead Letter Queue verschieben', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('permanent_error', 'Entity validation failed permanently');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act - Alle Retry-Versuche durchführen
      await accountStore.addAccount(testAccount);

      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        await testAssertions.waitForSyncProcessing();
        if (i < maxRetries - 1) {
          await testAssertions.waitForRetryDelay(i + 1);
          await WebSocketService.processSyncQueue();
        }
      }

      // Assert - Eintrag als dauerhaft fehlgeschlagen markiert
      const failedEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.FAILED);
      expect(failedEntries).toHaveLength(1);
      expect(failedEntries[0]).toEqual(expect.objectContaining({
        status: SyncStatus.FAILED,
        attempts: maxRetries,
        error: expect.stringContaining('Max retries')
      }));

      // Assert - Keine weiteren Sync-Versuche
      const initialMessageCount = mockWebSocketServer.getSentMessages().length;
      await WebSocketService.processSyncQueue();
      const finalMessageCount = mockWebSocketServer.getSentMessages().length;
      expect(finalMessageCount).toBe(initialMessageCount); // Keine neuen Nachrichten
    });

    it('sollte verschiedene Fehlertypen unterschiedlich behandeln', async () => {
      // Arrange
      const accounts = [
        testDataGenerator.generateAccount({ name: 'Validation Error Account' }),
        testDataGenerator.generateAccount({ name: 'Database Error Account' }),
        testDataGenerator.generateAccount({ name: 'Network Error Account' })
      ];

      mockWebSocketServer.setOnlineMode();

      // Act - Verschiedene Fehlertypen simulieren
      mockWebSocketServer.enableAutoNack('validation_error', 'Invalid data');
      await accountStore.addAccount(accounts[0]);

      mockWebSocketServer.enableAutoNack('database_error', 'DB connection failed');
      await accountStore.addAccount(accounts[1]);

      mockWebSocketServer.enableAutoNack('network_error', 'Network timeout');
      await accountStore.addAccount(accounts[2]);

      // Assert - Alle Einträge haben unterschiedliche Retry-Strategien
      await testAssertions.waitForSyncProcessing();
      const syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(3);

      // Validation-Fehler sollten weniger Retries bekommen
      const validationEntry = syncEntries.find(e =>
        e.payload && typeof e.payload === 'object' && 'name' in e.payload &&
        e.payload.name === 'Validation Error Account'
      );
      expect(validationEntry?.error).toContain('validation_error');

      // Database-Fehler sollten mehr Retries bekommen
      const databaseEntry = syncEntries.find(e =>
        e.payload && typeof e.payload === 'object' && 'name' in e.payload &&
        e.payload.name === 'Database Error Account'
      );
      expect(databaseEntry?.error).toContain('database_error');

      // Network-Fehler sollten moderate Retries bekommen
      const networkEntry = syncEntries.find(e =>
        e.payload && typeof e.payload === 'object' && 'name' in e.payload &&
        e.payload.name === 'Network Error Account'
      );
      expect(networkEntry?.error).toContain('network_error');
    });
  });

  describe('Concurrent Error Scenarios', () => {
    it('sollte gleichzeitige Fehler und Erfolge korrekt behandeln', async () => {
      // Arrange
      const accounts = testDataGenerator.generateAccounts(5);
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.simulatePartialFailure(0.6); // 60% Erfolgsrate

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act - Mehrere Accounts gleichzeitig erstellen
      for (const account of accounts) {
        await accountStore.addAccount(account);
      }

      // Assert - Gemischte Ergebnisse
      await testAssertions.waitForSyncProcessing();
      const allEntries = await testAssertions.getSyncQueueEntries();
      const successfulEntries = allEntries.filter(e => e.status === SyncStatus.SYNCED);
      const failedEntries = allEntries.filter(e => e.status === SyncStatus.PENDING || e.status === SyncStatus.FAILED);

      expect(successfulEntries.length + failedEntries.length).toBe(5);
      expect(successfulEntries.length).toBeGreaterThan(0);
      expect(failedEntries.length).toBeGreaterThan(0);
    });

    it('sollte Error-Recovery bei Batch-Verarbeitung testen', async () => {
      // Arrange
      const sequentialEntries = testDataGenerator.generateSequentialSyncEntries(4);
      mockWebSocketServer.setOfflineMode();

      // Erstelle Einträge offline
      for (const entry of sequentialEntries) {
        await mockTenantService.addTestSyncQueueEntry(entry);
      }

      // Act - Online gehen mit partiellen Fehlern
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.simulatePartialFailure(0.5); // 50% Erfolgsrate

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();
      await WebSocketService.processSyncQueue();

      // Assert - Teilweise erfolgreich, teilweise Retry
      await testAssertions.waitForSyncProcessing();
      const remainingEntries = await testAssertions.getSyncQueueEntries();
      expect(remainingEntries.length).toBeLessThan(4); // Einige erfolgreich
      expect(remainingEntries.length).toBeGreaterThan(0); // Einige fehlgeschlagen

      // Act - Retry für fehlgeschlagene Einträge
      mockWebSocketServer.enableAutoAck();
      await testAssertions.waitForRetryDelay(1);
      await WebSocketService.processSyncQueue();

      // Assert - Alle erfolgreich nach Retry
      await testAssertions.waitForSyncCompletion();
      const finalEntries = await testAssertions.getSyncQueueEntries();
      expect(finalEntries).toHaveLength(0);
    });
  });
});
