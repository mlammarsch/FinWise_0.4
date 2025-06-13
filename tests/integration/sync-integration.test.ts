/**
 * Integration Tests für die vollständige Sync-Pipeline
 * Testet alle kritischen Sync-Szenarien vollautomatisiert ohne User-Interaktion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAccountStore } from '../../src/stores/accountStore';
import { useTenantStore } from '../../src/stores/tenantStore';
import { useWebSocketStore } from '../../src/stores/webSocketStore';
import { useSessionStore } from '../../src/stores/sessionStore';
import { WebSocketService } from '../../src/services/WebSocketService';
import { TenantDbService } from '../../src/services/TenantDbService';
import { MockWebSocketServer } from '../mocks/mock-websocket-server';
import { MockTenantService } from '../mocks/mock-tenant-service';
import { TestDataGenerator } from '../mocks/test-data-generators';
import { TestSetup, TestAssertions } from '../utils/test-setup';
import type { Account, AccountGroup, SyncQueueEntry } from '../../src/types';
import { SyncStatus, SyncOperationType, EntityTypeEnum, BackendStatus } from '../../src/types';

// WebSocketConnectionStatus wird separat definiert
enum WebSocketConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

describe('Sync Integration Tests', () => {
  let mockWebSocketServer: MockWebSocketServer;
  let mockTenantService: MockTenantService;
  let testDataGenerator: TestDataGenerator;
  let testSetup: TestSetup;
  let testAssertions: TestAssertions;
  let accountStore: ReturnType<typeof useAccountStore>;
  let tenantStore: ReturnType<typeof useTenantStore>;
  let webSocketStore: ReturnType<typeof useWebSocketStore>;
  let sessionStore: ReturnType<typeof useSessionStore>;

  beforeEach(async () => {
    // Pinia Store Setup
    const pinia = createPinia();
    setActivePinia(pinia);

    // Store-Instanzen erstellen
    accountStore = useAccountStore();
    tenantStore = useTenantStore();
    webSocketStore = useWebSocketStore();
    sessionStore = useSessionStore();

    // Test-Utilities initialisieren
    mockWebSocketServer = new MockWebSocketServer();
    mockTenantService = new MockTenantService();
    testDataGenerator = new TestDataGenerator();
    testSetup = new TestSetup();
    testAssertions = new TestAssertions();

    // Test-Umgebung vorbereiten
    await testSetup.initializeTestEnvironment();
    await mockTenantService.setupMockTenant();

    // Mock WebSocket Server starten
    await mockWebSocketServer.start();

    // WebSocket Service mit Mock-Server verbinden
    vi.spyOn(WebSocketService, 'connect').mockImplementation(() => {
      mockWebSocketServer.simulateConnection();
    });

    vi.spyOn(WebSocketService, 'sendMessage').mockImplementation((message) => {
      return mockWebSocketServer.receiveMessage(message as any);
    });
  });

  afterEach(async () => {
    // Cleanup nach jedem Test
    await mockWebSocketServer.stop();
    await testSetup.cleanup();
    vi.restoreAllMocks();
  });

  describe('Test 1: Online-Account-Erstellung mit sofortiger Sync und ACK', () => {
    it('sollte Account online erstellen und sofortige Synchronisation mit ACK durchführen', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // WebSocket-Verbindung simulieren
      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      const createdAccount = await accountStore.addAccount(testAccount);

      // Assert - Account wurde lokal erstellt
      expect(createdAccount).toEqual(expect.objectContaining({
        id: testAccount.id,
        name: testAccount.name,
        accountType: testAccount.accountType
      }));

      // Assert - Sync-Queue-Eintrag wurde erstellt
      const syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: testAccount.id,
        operationType: SyncOperationType.CREATE,
        status: SyncStatus.PENDING
      }));

      // Assert - WebSocket-Nachricht wurde gesendet
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(expect.objectContaining({
        type: 'process_sync_entry',
        payload: expect.objectContaining({
          entityType: EntityTypeEnum.ACCOUNT,
          operationType: SyncOperationType.CREATE
        })
      }));

      // Assert - ACK wurde empfangen und Sync-Queue-Eintrag entfernt
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });
  });

  describe('Test 2: Offline-Account-Erstellung mit Queue-Speicherung', () => {
    it('sollte Account offline erstellen und in Sync-Queue speichern', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOfflineMode();

      // Act
      const createdAccount = await accountStore.addAccount(testAccount);

      // Assert - Account wurde lokal erstellt
      expect(createdAccount).toEqual(expect.objectContaining({
        id: testAccount.id,
        name: testAccount.name
      }));

      // Assert - Sync-Queue-Eintrag wurde erstellt und bleibt PENDING
      const syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: testAccount.id,
        operationType: SyncOperationType.CREATE,
        status: SyncStatus.PENDING
      }));

      // Assert - Keine WebSocket-Nachrichten wurden gesendet
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(0);
    });

    it('sollte Queue-Einträge synchronisieren wenn Verbindung wiederhergestellt wird', async () => {
      // Arrange - Account offline erstellen
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOfflineMode();
      await accountStore.addAccount(testAccount);

      // Act - Verbindung wiederherstellen
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();
      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Sync-Queue-Verarbeitung triggern
      await WebSocketService.processSyncQueue();

      // Assert - Sync wurde verarbeitet
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);

      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(1);
    });
  });

  describe('Test 3: Sync-Fehler mit Retry-Mechanismus und exponential backoff', () => {
    it('sollte bei NACK mit validation_error Retry mit exponential backoff durchführen', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('validation_error', 'Invalid account data');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      await accountStore.addAccount(testAccount);
      await testAssertions.waitForSyncProcessing();

      // Assert - Erster Versuch fehlgeschlagen
      let syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        status: SyncStatus.PENDING,
        attempts: 1,
        error: expect.stringContaining('validation_error')
      }));

      // Act - Zweiter Retry-Versuch
      mockWebSocketServer.enableAutoAck(); // Beim zweiten Versuch erfolgreich
      await testAssertions.waitForRetryDelay(1); // Exponential backoff für ersten Retry
      await WebSocketService.processSyncQueue();

      // Assert - Zweiter Versuch erfolgreich
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });

    it('sollte nach maximalen Retry-Versuchen als FAILED markieren', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('database_error', 'Database connection failed');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act - Account erstellen und mehrere Retry-Versuche durchführen
      await accountStore.addAccount(testAccount);

      // Simuliere mehrere fehlgeschlagene Versuche
      for (let i = 0; i < 3; i++) {
        await testAssertions.waitForSyncProcessing();
        await testAssertions.waitForRetryDelay(i + 1);
        await WebSocketService.processSyncQueue();
      }

      // Assert - Nach maximalen Versuchen als FAILED markiert
      const syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        status: SyncStatus.FAILED,
        attempts: 3,
        error: expect.stringContaining('Max retries')
      }));
    });
  });

  describe('Test 4: Mehrere Queue-Items sequenziell abarbeiten', () => {
    it('sollte mehrere Sync-Queue-Einträge in korrekter Reihenfolge verarbeiten', async () => {
      // Arrange
      const accounts = [
        testDataGenerator.generateAccount(),
        testDataGenerator.generateAccount(),
        testDataGenerator.generateAccount()
      ];

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Accounts offline erstellen
      mockWebSocketServer.setOfflineMode();
      for (const account of accounts) {
        await accountStore.addAccount(account);
      }

      // Assert - Alle Einträge in Queue
      let syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(3);

      // Act - Online gehen und Queue verarbeiten
      mockWebSocketServer.setOnlineMode();
      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();
      await WebSocketService.processSyncQueue();

      // Assert - Alle Einträge wurden verarbeitet
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);

      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(3);

      // Assert - Reihenfolge wurde eingehalten (nach Timestamp sortiert)
      const timestamps = sentMessages.map(msg => msg.payload.timestamp);
      expect(timestamps).toEqual([...timestamps].sort());
    });
  });

  describe('Test 5: LWW-Konfliktauflösung bei gleichzeitigen Änderungen', () => {
    it('sollte bei Konflikt die neuere Version (Last-Writer-Wins) verwenden', async () => {
      // Arrange
      const baseAccount = testDataGenerator.generateAccount();
      const olderTimestamp = new Date('2024-01-01T10:00:00Z').toISOString();
      const newerTimestamp = new Date('2024-01-01T11:00:00Z').toISOString();

      // Lokale Version mit älterem Timestamp
      const localAccount = { ...baseAccount, name: 'Local Version', updated_at: olderTimestamp };
      await accountStore.addAccount(localAccount);

      // Act - Eingehende Sync-Daten mit neuerem Timestamp
      const incomingAccount = { ...baseAccount, name: 'Remote Version', updated_at: newerTimestamp };
      await accountStore.addAccount(incomingAccount, true); // fromSync = true

      // Assert - Neuere Version wurde übernommen
      const finalAccount = accountStore.getAccountById(baseAccount.id);
      expect(finalAccount).toEqual(expect.objectContaining({
        name: 'Remote Version',
        updated_at: newerTimestamp
      }));
    });

    it('sollte bei älteren eingehenden Daten lokale Version behalten', async () => {
      // Arrange
      const baseAccount = testDataGenerator.generateAccount();
      const olderTimestamp = new Date('2024-01-01T10:00:00Z').toISOString();
      const newerTimestamp = new Date('2024-01-01T11:00:00Z').toISOString();

      // Lokale Version mit neuerem Timestamp
      const localAccount = { ...baseAccount, name: 'Local Version', updated_at: newerTimestamp };
      await accountStore.addAccount(localAccount);

      // Act - Eingehende Sync-Daten mit älterem Timestamp
      const incomingAccount = { ...baseAccount, name: 'Remote Version', updated_at: olderTimestamp };
      await accountStore.addAccount(incomingAccount, true); // fromSync = true

      // Assert - Lokale Version wurde beibehalten
      const finalAccount = accountStore.getAccountById(baseAccount.id);
      expect(finalAccount).toEqual(expect.objectContaining({
        name: 'Local Version',
        updated_at: newerTimestamp
      }));
    });
  });

  describe('Test 6: AccountGroup-Synchronisation analog zu Accounts', () => {
    it('sollte AccountGroup-Synchronisation identisch zu Account-Sync durchführen', async () => {
      // Arrange
      const testAccountGroup = testDataGenerator.generateAccountGroup();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act
      const createdGroup = await accountStore.addAccountGroup(testAccountGroup);

      // Assert - AccountGroup wurde lokal erstellt
      expect(createdGroup).toEqual(expect.objectContaining({
        id: testAccountGroup.id,
        name: testAccountGroup.name
      }));

      // Assert - Sync-Queue-Eintrag für AccountGroup
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual(expect.objectContaining({
        type: 'process_sync_entry',
        payload: expect.objectContaining({
          entityType: EntityTypeEnum.ACCOUNT_GROUP,
          operationType: SyncOperationType.CREATE
        })
      }));

      // Assert - Sync erfolgreich abgeschlossen
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });
  });

  describe('Test 7: Hängende PROCESSING-Einträge Reset', () => {
    it('sollte hängende PROCESSING-Einträge beim Start zurücksetzen', async () => {
      // Arrange - Simuliere hängende PROCESSING-Einträge
      const testAccount = testDataGenerator.generateAccount();
      const tenantDbService = new TenantDbService();

      // Erstelle Sync-Queue-Eintrag direkt als PROCESSING mit altem Timestamp
      const stuckEntry = await tenantDbService.addSyncQueueEntry({
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: testAccount.id,
        operationType: SyncOperationType.CREATE,
        payload: testAccount
      });

      // Setze Status auf PROCESSING mit altem lastAttempt
      await tenantDbService.updateSyncQueueEntryStatus(
        stuckEntry!.id,
        SyncStatus.PROCESSING
      );

      // Simuliere alten Timestamp (älter als 30 Sekunden)
      const oldTimestamp = Date.now() - 60000; // 60 Sekunden alt
      await testAssertions.updateSyncEntryTimestamp(stuckEntry!.id, oldTimestamp);

      // Act - WebSocket Service initialisieren (triggert Reset)
      await WebSocketService.initializeSyncQueue();

      // Assert - Hängender Eintrag wurde zurückgesetzt
      const syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
        status: SyncStatus.PENDING,
        error: expect.stringContaining('Reset from stuck PROCESSING state')
      }));
    });
  });

  describe('Test 8: Dead Letter Queue für dauerhaft fehlgeschlagene Einträge', () => {
    it('sollte dauerhaft fehlgeschlagene Einträge als FAILED markieren', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('permanent_error', 'Entity validation failed permanently');

      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();

      // Act - Account erstellen und alle Retry-Versuche durchführen
      await accountStore.addAccount(testAccount);

      // Simuliere alle maximalen Retry-Versuche
      const maxRetries = 3;
      for (let i = 0; i < maxRetries; i++) {
        await testAssertions.waitForSyncProcessing();
        if (i < maxRetries - 1) {
          await testAssertions.waitForRetryDelay(i + 1);
          await WebSocketService.processSyncQueue();
        }
      }

      // Assert - Eintrag als dauerhaft fehlgeschlagen markiert
      const syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0]).toEqual(expect.objectContaining({
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
  });

  describe('Integration Test: Vollständiger Sync-Workflow', () => {
    it('sollte kompletten Sync-Workflow von offline zu online durchführen', async () => {
      // Arrange - Mehrere Operationen offline durchführen
      mockWebSocketServer.setOfflineMode();

      const account1 = testDataGenerator.generateAccount();
      const account2 = testDataGenerator.generateAccount();
      const accountGroup = testDataGenerator.generateAccountGroup();

      // Act - Offline-Operationen
      await accountStore.addAccount(account1);
      await accountStore.addAccountGroup(accountGroup);
      await accountStore.addAccount(account2);

      // Update Operation
      const updatedAccount1 = { ...account1, name: 'Updated Name' };
      await accountStore.updateAccount(updatedAccount1);

      // Assert - Alle Operationen in Queue
      let syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(4); // 2 CREATE Account, 1 CREATE AccountGroup, 1 UPDATE Account

      // Act - Online gehen und synchronisieren
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();
      WebSocketService.connect();
      await testAssertions.waitForWebSocketConnection();
      await WebSocketService.processSyncQueue();

      // Assert - Alle Operationen erfolgreich synchronisiert
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);

      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(4);

      // Assert - Korrekte Operationstypen
      const operationTypes = sentMessages.map(msg => ({
        entityType: msg.payload.entityType,
        operationType: msg.payload.operationType
      }));

      expect(operationTypes).toContainEqual({
        entityType: EntityTypeEnum.ACCOUNT,
        operationType: SyncOperationType.CREATE
      });
      expect(operationTypes).toContainEqual({
        entityType: EntityTypeEnum.ACCOUNT_GROUP,
        operationType: SyncOperationType.CREATE
      });
      expect(operationTypes).toContainEqual({
        entityType: EntityTypeEnum.ACCOUNT,
        operationType: SyncOperationType.UPDATE
      });
    });
  });
});
