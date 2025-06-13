/**
 * AccountGroup-spezifische Sync Integration Tests
 * Testet alle AccountGroup-Sync-Szenarien analog zu Account-Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAccountStore } from '../../src/stores/accountStore';
import { MockWebSocketServer } from '../mocks/mock-websocket-server';
import { MockTenantService } from '../mocks/mock-tenant-service';
import { TestDataGenerator } from '../mocks/test-data-generators';
import { TestSetup, TestAssertions } from '../utils/test-setup';
import type { AccountGroup } from '../../src/types';
import { SyncStatus, SyncOperationType, EntityTypeEnum } from '../../src/types';

describe('AccountGroup Sync Integration Tests', () => {
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
  });

  afterEach(async () => {
    await mockWebSocketServer.stop();
    await testSetup.cleanup();
    testDataGenerator.reset();
    vi.restoreAllMocks();
  });

  describe('AccountGroup CRUD Operations Sync', () => {
    it('sollte AccountGroup CREATE-Operation synchronisieren', async () => {
      // Arrange
      const testAccountGroup = testDataGenerator.generateAccountGroup();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      const createdGroup = await accountStore.addAccountGroup(testAccountGroup);

      // Assert
      expect(createdGroup.id).toBe(testAccountGroup.id);
      expect(createdGroup.name).toBe(testAccountGroup.name);

      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].payload.entityType).toBe(EntityTypeEnum.ACCOUNT_GROUP);
      expect(sentMessages[0].payload.operationType).toBe(SyncOperationType.CREATE);
    });

    it('sollte AccountGroup UPDATE-Operation synchronisieren', async () => {
      // Arrange
      const originalGroup = testDataGenerator.generateAccountGroup();
      await accountStore.addAccountGroup(originalGroup);

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      const updatedGroup = { ...originalGroup, name: 'Updated Group Name' };

      // Act
      await accountStore.updateAccountGroup(updatedGroup);

      // Assert
      const finalGroup = accountStore.getAccountGroupById(originalGroup.id);
      expect(finalGroup?.name).toBe('Updated Group Name');

      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const updateMessage = sentMessages.find(msg =>
        msg.payload.operationType === SyncOperationType.UPDATE
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage?.payload.payload.name).toBe('Updated Group Name');
    });

    it('sollte AccountGroup DELETE-Operation synchronisieren', async () => {
      // Arrange
      const testGroup = testDataGenerator.generateAccountGroup();
      await accountStore.addAccountGroup(testGroup);

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.deleteAccountGroup(testGroup.id);

      // Assert
      const groups = accountStore.accountGroups;
      expect(groups.find(g => g.id === testGroup.id)).toBeUndefined();

      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const deleteMessage = sentMessages.find(msg =>
        msg.payload.operationType === SyncOperationType.DELETE
      );
      expect(deleteMessage).toBeDefined();
      expect(deleteMessage?.payload.entityType).toBe(EntityTypeEnum.ACCOUNT_GROUP);
    });
  });

  describe('AccountGroup Business Logic Tests', () => {
    it('sollte AccountGroup mit verschiedenen sortOrder-Werten synchronisieren', async () => {
      // Arrange
      const groups = [
        testDataGenerator.generateAccountGroup({ sortOrder: 1, name: 'First Group' }),
        testDataGenerator.generateAccountGroup({ sortOrder: 2, name: 'Second Group' }),
        testDataGenerator.generateAccountGroup({ sortOrder: 3, name: 'Third Group' })
      ];

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      for (const group of groups) {
        await accountStore.addAccountGroup(group);
      }

      // Assert
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(3);

      // Prüfe sortOrder in den gesendeten Nachrichten
      sentMessages.forEach((message, index) => {
        expect(message.payload.payload.sortOrder).toBe(index + 1);
      });
    });

    it('sollte AccountGroup-Löschung verhindern wenn Accounts zugeordnet sind', async () => {
      // Arrange
      const testGroup = testDataGenerator.generateAccountGroup();
      await accountStore.addAccountGroup(testGroup);

      const testAccount = testDataGenerator.generateAccountWithGroup(testGroup);
      await accountStore.addAccount(testAccount);

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      const deleteResult = await accountStore.deleteAccountGroup(testGroup.id);

      // Assert
      expect(deleteResult).toBe(false); // Löschung sollte verhindert werden

      const groups = accountStore.accountGroups;
      expect(groups.find(g => g.id === testGroup.id)).toBeDefined(); // Gruppe sollte noch existieren

      // Keine DELETE-Sync-Nachricht sollte gesendet werden
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const deleteMessage = sentMessages.find(msg =>
        msg.payload.operationType === SyncOperationType.DELETE &&
        msg.payload.entityType === EntityTypeEnum.ACCOUNT_GROUP
      );
      expect(deleteMessage).toBeUndefined();
    });
  });

  describe('AccountGroup Validation and Error Handling', () => {
    it('sollte bei ungültigen AccountGroup-Daten NACK verarbeiten', async () => {
      // Arrange
      const invalidGroup = testDataGenerator.generateAccountGroup({
        name: '', // Ungültiger leerer Name
        sortOrder: -1 // Ungültiger sortOrder
      });

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('validation_error', 'Invalid account group data');

      // Act
      await accountStore.addAccountGroup(invalidGroup);

      // Assert
      await testAssertions.waitForSyncProcessing();
      const syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0].error).toContain('validation_error');
      expect(syncEntries[0].entityType).toBe(EntityTypeEnum.ACCOUNT_GROUP);
    });

    it('sollte bei Server-Fehlern Retry-Mechanismus für AccountGroups aktivieren', async () => {
      // Arrange
      const testGroup = testDataGenerator.generateAccountGroup();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('server_error', 'Internal server error');

      // Act
      await accountStore.addAccountGroup(testGroup);

      // Assert - Erster Versuch fehlgeschlagen
      await testAssertions.waitForSyncProcessing();
      let syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0].attempts).toBe(1);
      expect(syncEntries[0].entityType).toBe(EntityTypeEnum.ACCOUNT_GROUP);
    });
  });

  describe('AccountGroup Offline/Online Sync', () => {
    it('sollte mehrere AccountGroups offline erstellen und bei Reconnect synchronisieren', async () => {
      // Arrange
      const groups = testDataGenerator.generateAccountGroups(4);
      mockWebSocketServer.setOfflineMode();

      // Act - Offline erstellen
      for (const group of groups) {
        await accountStore.addAccountGroup(group);
      }

      // Assert - Alle in Queue
      let syncEntries = await testAssertions.getSyncQueueEntries();
      const groupEntries = syncEntries.filter(e => e.entityType === EntityTypeEnum.ACCOUNT_GROUP);
      expect(groupEntries).toHaveLength(4);
      expect(groupEntries.every(e => e.status === SyncStatus.PENDING)).toBe(true);

      // Act - Online gehen
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();
      // Simuliere Reconnect und Queue-Verarbeitung

      // Assert - Alle synchronisiert
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });

    it('sollte gemischte Account und AccountGroup Operationen korrekt synchronisieren', async () => {
      // Arrange
      const group1 = testDataGenerator.generateAccountGroup({ name: 'Group 1' });
      const group2 = testDataGenerator.generateAccountGroup({ name: 'Group 2' });
      const account1 = testDataGenerator.generateAccountWithGroup(group1);
      const account2 = testDataGenerator.generateAccountWithGroup(group2);

      mockWebSocketServer.setOfflineMode();

      // Act - Offline erstellen in gemischter Reihenfolge
      await accountStore.addAccountGroup(group1);
      await accountStore.addAccount(account1);
      await accountStore.addAccountGroup(group2);
      await accountStore.addAccount(account2);

      // Assert - Alle in Queue
      let syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(4);

      const groupEntries = syncEntries.filter(e => e.entityType === EntityTypeEnum.ACCOUNT_GROUP);
      const accountEntries = syncEntries.filter(e => e.entityType === EntityTypeEnum.ACCOUNT);
      expect(groupEntries).toHaveLength(2);
      expect(accountEntries).toHaveLength(2);

      // Act - Online gehen
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Assert - Alle synchronisiert
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);

      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(4);
    });
  });

  describe('AccountGroup Data Integrity', () => {
    it('sollte AccountGroup-Daten bei Sync unverändert übertragen', async () => {
      // Arrange
      const originalGroup = testDataGenerator.generateAccountGroup({
        name: 'Test Group with Special Characters äöü',
        sortOrder: 42
      });

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.addAccountGroup(originalGroup);

      // Assert
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const syncedGroup = sentMessages[0].payload.payload;

      expect(syncedGroup.name).toBe(originalGroup.name);
      expect(syncedGroup.sortOrder).toBe(originalGroup.sortOrder);
      expect(syncedGroup.id).toBe(originalGroup.id);
    });

    it('sollte AccountGroup-Timestamps korrekt verwalten', async () => {
      // Arrange
      const testGroup = testDataGenerator.generateAccountGroup();
      const originalTimestamp = testGroup.updated_at;

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.addAccountGroup(testGroup);

      // Assert
      const createdGroup = accountStore.getAccountGroupById(testGroup.id);
      expect(createdGroup?.updated_at).toBeDefined();

      // Update sollte neuen Timestamp haben
      const updatedGroup = { ...createdGroup!, name: 'Updated Group Name' };
      await accountStore.updateAccountGroup(updatedGroup);

      const finalGroup = accountStore.getAccountGroupById(testGroup.id);
      expect(new Date(finalGroup!.updated_at!).getTime())
        .toBeGreaterThan(new Date(originalTimestamp!).getTime());
    });
  });

  describe('AccountGroup LWW Conflict Resolution', () => {
    it('sollte bei AccountGroup-Konflikten Last-Writer-Wins anwenden', async () => {
      // Arrange
      const baseGroup = testDataGenerator.generateAccountGroup();
      const baseTime = new Date('2024-01-01T12:00:00Z');
      const olderTime = new Date(baseTime.getTime() - 60000); // 1 Minute früher
      const newerTime = new Date(baseTime.getTime() + 60000); // 1 Minute später

      const olderGroup = {
        ...baseGroup,
        name: `${baseGroup.name} (Older)`,
        updated_at: olderTime.toISOString()
      };

      const newerGroup = {
        ...baseGroup,
        name: `${baseGroup.name} (Newer)`,
        updated_at: newerTime.toISOString()
      };

      // Lokale Version mit älterem Timestamp
      await accountStore.addAccountGroup(olderGroup);

      // Act - Eingehende Sync-Daten mit neuerem Timestamp
      await accountStore.addAccountGroup(newerGroup, true); // fromSync = true

      // Assert - Neuere Version wurde übernommen
      const finalGroup = accountStore.getAccountGroupById(baseGroup.id);
      expect(finalGroup?.name).toBe(newerGroup.name);
      expect(finalGroup?.updated_at).toBe(newerGroup.updated_at);
    });

    it('sollte bei älteren eingehenden AccountGroup-Daten lokale Version behalten', async () => {
      // Arrange
      const baseGroup = testDataGenerator.generateAccountGroup();
      const baseTime = new Date('2024-01-01T12:00:00Z');
      const olderTime = new Date(baseTime.getTime() - 60000); // 1 Minute früher
      const newerTime = new Date(baseTime.getTime() + 60000); // 1 Minute später

      const olderGroup = {
        ...baseGroup,
        name: `${baseGroup.name} (Older)`,
        updated_at: olderTime.toISOString()
      };

      const newerGroup = {
        ...baseGroup,
        name: `${baseGroup.name} (Newer)`,
        updated_at: newerTime.toISOString()
      };

      // Lokale Version mit neuerem Timestamp
      await accountStore.addAccountGroup(newerGroup);

      // Act - Eingehende Sync-Daten mit älterem Timestamp
      await accountStore.addAccountGroup(olderGroup, true); // fromSync = true

      // Assert - Lokale Version wurde beibehalten
      const finalGroup = accountStore.getAccountGroupById(baseGroup.id);
      expect(finalGroup?.name).toBe(newerGroup.name);
      expect(finalGroup?.updated_at).toBe(newerGroup.updated_at);
    });
  });
});
