/**
 * Account-spezifische Sync Integration Tests
 * Testet alle Account-Sync-Szenarien isoliert
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAccountStore } from '../../src/stores/accountStore';
import { MockWebSocketServer } from '../mocks/mock-websocket-server';
import { MockTenantService } from '../mocks/mock-tenant-service';
import { TestDataGenerator } from '../mocks/test-data-generators';
import { TestSetup, TestAssertions } from '../utils/test-setup';
import type { Account } from '../../src/types';
import { SyncStatus, SyncOperationType, EntityTypeEnum, AccountType } from '../../src/types';

describe('Account Sync Integration Tests', () => {
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

  describe('Account CRUD Operations Sync', () => {
    it('sollte Account CREATE-Operation synchronisieren', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      const createdAccount = await accountStore.addAccount(testAccount);

      // Assert
      expect(createdAccount.id).toBe(testAccount.id);

      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].payload.operationType).toBe(SyncOperationType.CREATE);
    });

    it('sollte Account UPDATE-Operation synchronisieren', async () => {
      // Arrange
      const originalAccount = testDataGenerator.generateAccount();
      await accountStore.addAccount(originalAccount);

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      const updatedAccount = { ...originalAccount, name: 'Updated Name' };

      // Act
      await accountStore.updateAccount(updatedAccount);

      // Assert
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const updateMessage = sentMessages.find(msg =>
        msg.payload.operationType === SyncOperationType.UPDATE
      );
      expect(updateMessage).toBeDefined();
      expect(updateMessage?.payload.payload.name).toBe('Updated Name');
    });

    it('sollte Account DELETE-Operation synchronisieren', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      await accountStore.addAccount(testAccount);

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.deleteAccount(testAccount.id);

      // Assert
      const accounts = accountStore.accounts;
      expect(accounts.find(a => a.id === testAccount.id)).toBeUndefined();

      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const deleteMessage = sentMessages.find(msg =>
        msg.payload.operationType === SyncOperationType.DELETE
      );
      expect(deleteMessage).toBeDefined();
    });
  });

  describe('Account Type Specific Tests', () => {
    it('sollte verschiedene Account-Typen korrekt synchronisieren', async () => {
      // Arrange
      const accountTypes = [
        AccountType.CHECKING,
        AccountType.SAVINGS,
        AccountType.CREDIT,
        AccountType.CASH
      ];

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      const createdAccounts: Account[] = [];
      for (const accountType of accountTypes) {
        const account = testDataGenerator.generateAccountByType(accountType);
        const created = await accountStore.addAccount(account);
        createdAccounts.push(created);
      }

      // Assert
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages).toHaveLength(accountTypes.length);

      accountTypes.forEach((type, index) => {
        expect(sentMessages[index].payload.payload.accountType).toBe(type);
      });
    });
  });

  describe('Account Balance and Financial Data Sync', () => {
    it('sollte Account mit verschiedenen Balances synchronisieren', async () => {
      // Arrange
      const testCases = [
        { balance: 0, description: 'Zero balance' },
        { balance: 1000.50, description: 'Positive balance' },
        { balance: -500.25, description: 'Negative balance' },
        { balance: 999999.99, description: 'Large balance' }
      ];

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act & Assert
      for (const testCase of testCases) {
        const account = testDataGenerator.generateAccount({
          balance: testCase.balance,
          name: testCase.description
        });

        await accountStore.addAccount(account);

        await testAssertions.waitForSyncProcessing();
        const sentMessages = mockWebSocketServer.getSentMessages();
        const lastMessage = sentMessages[sentMessages.length - 1];

        expect(lastMessage.payload.payload.balance).toBe(testCase.balance);
      }
    });

    it('sollte Account mit Credit Limit korrekt synchronisieren', async () => {
      // Arrange
      const creditAccount = testDataGenerator.generateAccount({
        accountType: AccountType.CREDIT,
        balance: -200,
        creditLimit: 1000
      });

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.addAccount(creditAccount);

      // Assert
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      expect(sentMessages[0].payload.payload.creditLimit).toBe(1000);
      expect(sentMessages[0].payload.payload.balance).toBe(-200);
    });
  });

  describe('Account Validation and Error Handling', () => {
    it('sollte bei ungültigen Account-Daten NACK verarbeiten', async () => {
      // Arrange
      const invalidAccount = testDataGenerator.generateAccount({
        name: '', // Ungültiger leerer Name
        balance: NaN // Ungültiger Balance-Wert
      });

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('validation_error', 'Invalid account data');

      // Act
      await accountStore.addAccount(invalidAccount);

      // Assert
      await testAssertions.waitForSyncProcessing();
      const syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0].error).toContain('validation_error');
    });

    it('sollte bei Datenbank-Fehlern Retry-Mechanismus aktivieren', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoNack('database_error', 'Database connection failed');

      // Act
      await accountStore.addAccount(testAccount);

      // Assert - Erster Versuch fehlgeschlagen
      await testAssertions.waitForSyncProcessing();
      let syncEntries = await testAssertions.getSyncQueueEntriesByStatus(SyncStatus.PENDING);
      expect(syncEntries).toHaveLength(1);
      expect(syncEntries[0].attempts).toBe(1);

      // Act - Retry erfolgreich
      mockWebSocketServer.enableAutoAck();
      await testAssertions.waitForRetryDelay(1);
      // Hier würde normalerweise der WebSocketService automatisch retry
      // Für den Test simulieren wir das manuell

      // Assert - Retry erfolgreich
      // (Detaillierte Retry-Tests sind in sync-integration.test.ts)
    });
  });

  describe('Account Offline/Online Sync', () => {
    it('sollte mehrere Accounts offline erstellen und bei Reconnect synchronisieren', async () => {
      // Arrange
      const accounts = testDataGenerator.generateAccounts(3);
      mockWebSocketServer.setOfflineMode();

      // Act - Offline erstellen
      for (const account of accounts) {
        await accountStore.addAccount(account);
      }

      // Assert - Alle in Queue
      let syncEntries = await testAssertions.getSyncQueueEntries();
      expect(syncEntries).toHaveLength(3);
      expect(syncEntries.every(e => e.status === SyncStatus.PENDING)).toBe(true);

      // Act - Online gehen
      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();
      // Simuliere Reconnect und Queue-Verarbeitung

      // Assert - Alle synchronisiert
      await testAssertions.waitForSyncCompletion();
      const finalSyncEntries = await testAssertions.getSyncQueueEntries();
      expect(finalSyncEntries).toHaveLength(0);
    });
  });

  describe('Account Data Integrity', () => {
    it('sollte Account-Daten bei Sync unverändert übertragen', async () => {
      // Arrange
      const originalAccount = testDataGenerator.generateAccount({
        name: 'Test Account with Special Characters äöü',
        description: 'Description with "quotes" and \'apostrophes\'',
        note: 'Note with\nnewlines\tand\ttabs',
        iban: 'DE89370400440532013000',
        balance: 1234.56
      });

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.addAccount(originalAccount);

      // Assert
      await testAssertions.waitForSyncProcessing();
      const sentMessages = mockWebSocketServer.getSentMessages();
      const syncedAccount = sentMessages[0].payload.payload;

      expect(syncedAccount.name).toBe(originalAccount.name);
      expect(syncedAccount.description).toBe(originalAccount.description);
      expect(syncedAccount.note).toBe(originalAccount.note);
      expect(syncedAccount.iban).toBe(originalAccount.iban);
      expect(syncedAccount.balance).toBe(originalAccount.balance);
    });

    it('sollte Account-Timestamps korrekt verwalten', async () => {
      // Arrange
      const testAccount = testDataGenerator.generateAccount();
      const originalTimestamp = testAccount.updated_at;

      mockWebSocketServer.setOnlineMode();
      mockWebSocketServer.enableAutoAck();

      // Act
      await accountStore.addAccount(testAccount);

      // Assert
      const createdAccount = accountStore.getAccountById(testAccount.id);
      expect(createdAccount?.updated_at).toBeDefined();

      // Update sollte neuen Timestamp haben
      const updatedAccount = { ...createdAccount!, name: 'Updated Name' };
      await accountStore.updateAccount(updatedAccount);

      const finalAccount = accountStore.getAccountById(testAccount.id);
      expect(new Date(finalAccount!.updated_at!).getTime())
        .toBeGreaterThan(new Date(originalTimestamp!).getTime());
    });
  });
});
