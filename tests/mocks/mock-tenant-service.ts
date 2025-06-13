/**
 * Mock Tenant Service für Integration Tests
 * Simuliert Tenant-spezifische Datenbank-Operationen für Tests
 */

import { vi } from 'vitest';
import Dexie from 'dexie';
import type { Account, AccountGroup, SyncQueueEntry } from '../../src/types';
import { SyncStatus, EntityTypeEnum } from '../../src/types';

export interface MockTenantDB extends Dexie {
  accounts: Dexie.Table<Account, string>;
  accountGroups: Dexie.Table<AccountGroup, string>;
  syncQueue: Dexie.Table<SyncQueueEntry, string>;
}

export class MockTenantService {
  private mockDb: MockTenantDB | null = null;
  private testTenantId = 'test-tenant-id';

  constructor() {
    this.setupMockDatabase();
  }

  private setupMockDatabase(): void {
    // Erstelle Mock-Datenbank für Tests
    this.mockDb = new Dexie('TestFinwiseDB') as MockTenantDB;

    this.mockDb.version(1).stores({
      accounts: 'id, name, accountType, accountGroupId, isActive, updated_at',
      accountGroups: 'id, name, sortOrder, updated_at',
      syncQueue: 'id, tenantId, entityType, entityId, operationType, timestamp, status, attempts, lastAttempt'
    });
  }

  async setupMockTenant(): Promise<void> {
    if (!this.mockDb) {
      throw new Error('Mock database not initialized');
    }

    try {
      await this.mockDb.open();

      // Leere alle Tabellen für sauberen Test-Start
      await this.mockDb.accounts.clear();
      await this.mockDb.accountGroups.clear();
      await this.mockDb.syncQueue.clear();

      console.log('Mock tenant database setup completed');
    } catch (error) {
      console.error('Error setting up mock tenant:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    if (this.mockDb) {
      try {
        await this.mockDb.accounts.clear();
        await this.mockDb.accountGroups.clear();
        await this.mockDb.syncQueue.clear();
        await this.mockDb.close();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }
  }

  getMockDatabase(): MockTenantDB | null {
    return this.mockDb;
  }

  getTestTenantId(): string {
    return this.testTenantId;
  }

  // Mock-Methoden für Store-Integration
  mockTenantStore(): any {
    return {
      activeTenantId: this.testTenantId,
      activeTenantDB: this.mockDb,
      setActiveTenant: vi.fn(),
      initializeTenant: vi.fn().mockResolvedValue(true),
    };
  }

  mockSessionStore(): any {
    return {
      currentTenantId: this.testTenantId,
      isAuthenticated: true,
      setCurrentTenant: vi.fn(),
      login: vi.fn().mockResolvedValue(true),
      logout: vi.fn(),
    };
  }

  mockWebSocketStore(): any {
    return {
      connectionStatus: 'DISCONNECTED',
      backendStatus: 'offline',
      lastMessage: null,
      error: null,
      setConnectionStatus: vi.fn(),
      setBackendStatus: vi.fn(),
      setLastMessage: vi.fn(),
      setError: vi.fn(),
      reset: vi.fn(),
    };
  }

  // Hilfsmethoden für Test-Daten-Management
  async addTestAccount(account: Account): Promise<void> {
    if (!this.mockDb) throw new Error('Mock database not available');
    await this.mockDb.accounts.add(account);
  }

  async addTestAccountGroup(accountGroup: AccountGroup): Promise<void> {
    if (!this.mockDb) throw new Error('Mock database not available');
    await this.mockDb.accountGroups.add(accountGroup);
  }

  async addTestSyncQueueEntry(entry: SyncQueueEntry): Promise<void> {
    if (!this.mockDb) throw new Error('Mock database not available');
    await this.mockDb.syncQueue.add(entry);
  }

  async getTestAccounts(): Promise<Account[]> {
    if (!this.mockDb) throw new Error('Mock database not available');
    return await this.mockDb.accounts.toArray();
  }

  async getTestAccountGroups(): Promise<AccountGroup[]> {
    if (!this.mockDb) throw new Error('Mock database not available');
    return await this.mockDb.accountGroups.toArray();
  }

  async getTestSyncQueueEntries(): Promise<SyncQueueEntry[]> {
    if (!this.mockDb) throw new Error('Mock database not available');
    return await this.mockDb.syncQueue.toArray();
  }

  async clearTestData(): Promise<void> {
    if (!this.mockDb) return;

    await this.mockDb.accounts.clear();
    await this.mockDb.accountGroups.clear();
    await this.mockDb.syncQueue.clear();
  }

  // Spezielle Mock-Methoden für Sync-Queue-Tests
  async createStuckProcessingEntry(entry: Omit<SyncQueueEntry, 'status' | 'lastAttempt'>): Promise<SyncQueueEntry> {
    if (!this.mockDb) throw new Error('Mock database not available');

    const stuckEntry: SyncQueueEntry = {
      ...entry,
      status: SyncStatus.PROCESSING,
      lastAttempt: Date.now() - 60000, // 60 Sekunden alt
      attempts: 1
    };

    await this.mockDb.syncQueue.add(stuckEntry);
    return stuckEntry;
  }

  async updateSyncEntryTimestamp(entryId: string, timestamp: number): Promise<void> {
    if (!this.mockDb) throw new Error('Mock database not available');

    await this.mockDb.syncQueue.update(entryId, {
      lastAttempt: timestamp
    });
  }

  async getSyncEntriesByStatus(status: SyncStatus): Promise<SyncQueueEntry[]> {
    if (!this.mockDb) throw new Error('Mock database not available');

    return await this.mockDb.syncQueue
      .where('status')
      .equals(status)
      .toArray();
  }

  async getSyncEntriesByEntityType(entityType: EntityTypeEnum): Promise<SyncQueueEntry[]> {
    if (!this.mockDb) throw new Error('Mock database not available');

    return await this.mockDb.syncQueue
      .where('entityType')
      .equals(entityType)
      .toArray();
  }

  // Mock für TenantDbService-Integration
  mockTenantDbService(): any {
    const mockService = {
      addAccount: vi.fn().mockImplementation(async (account: Account) => {
        await this.addTestAccount(account);
      }),
      updateAccount: vi.fn().mockImplementation(async (account: Account) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        await this.mockDb.accounts.put(account);
      }),
      deleteAccount: vi.fn().mockImplementation(async (accountId: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        await this.mockDb.accounts.delete(accountId);
      }),
      getAccountById: vi.fn().mockImplementation(async (accountId: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        return await this.mockDb.accounts.get(accountId);
      }),
      getAllAccounts: vi.fn().mockImplementation(async () => {
        return await this.getTestAccounts();
      }),
      addAccountGroup: vi.fn().mockImplementation(async (accountGroup: AccountGroup) => {
        await this.addTestAccountGroup(accountGroup);
      }),
      updateAccountGroup: vi.fn().mockImplementation(async (accountGroup: AccountGroup) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        await this.mockDb.accountGroups.put(accountGroup);
      }),
      deleteAccountGroup: vi.fn().mockImplementation(async (accountGroupId: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        await this.mockDb.accountGroups.delete(accountGroupId);
      }),
      getAccountGroupById: vi.fn().mockImplementation(async (accountGroupId: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        return await this.mockDb.accountGroups.get(accountGroupId);
      }),
      getAllAccountGroups: vi.fn().mockImplementation(async () => {
        return await this.getTestAccountGroups();
      }),
      addSyncQueueEntry: vi.fn().mockImplementation(async (entryData: any) => {
        const entry: SyncQueueEntry = {
          ...entryData,
          id: `test-sync-${Date.now()}-${Math.random()}`,
          tenantId: this.testTenantId,
          timestamp: Date.now(),
          status: SyncStatus.PENDING,
          attempts: 0
        };
        await this.addTestSyncQueueEntry(entry);
        return entry;
      }),
      getPendingSyncEntries: vi.fn().mockImplementation(async () => {
        return await this.getSyncEntriesByStatus(SyncStatus.PENDING);
      }),
      updateSyncQueueEntryStatus: vi.fn().mockImplementation(async (entryId: string, status: SyncStatus, error?: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        const updateData: Partial<SyncQueueEntry> = { status };
        if (error) updateData.error = error;
        if (status === SyncStatus.PROCESSING) {
          updateData.lastAttempt = Date.now();
          const entry = await this.mockDb.syncQueue.get(entryId);
          updateData.attempts = (entry?.attempts || 0) + 1;
        }
        const updated = await this.mockDb.syncQueue.update(entryId, updateData);
        return updated > 0;
      }),
      removeSyncQueueEntry: vi.fn().mockImplementation(async (entryId: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        await this.mockDb.syncQueue.delete(entryId);
        return true;
      }),
      getSyncQueueEntry: vi.fn().mockImplementation(async (entryId: string) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        return await this.mockDb.syncQueue.get(entryId);
      }),
      getFailedSyncEntries: vi.fn().mockImplementation(async () => {
        return await this.getSyncEntriesByStatus(SyncStatus.FAILED);
      }),
      getProcessingSyncEntries: vi.fn().mockImplementation(async () => {
        return await this.getSyncEntriesByStatus(SyncStatus.PROCESSING);
      }),
      resetStuckProcessingEntries: vi.fn().mockImplementation(async (tenantId: string, timeoutMs: number = 30000) => {
        if (!this.mockDb) throw new Error('Mock database not available');
        const cutoffTime = Date.now() - timeoutMs;
        const stuckEntries = await this.mockDb.syncQueue
          .where('status')
          .equals(SyncStatus.PROCESSING)
          .filter(entry => (entry.lastAttempt || 0) < cutoffTime)
          .toArray();

        let resetCount = 0;
        for (const entry of stuckEntries) {
          const updated = await this.mockDb.syncQueue.update(entry.id, {
            status: SyncStatus.PENDING,
            error: 'Reset from stuck PROCESSING state'
          });
          if (updated > 0) resetCount++;
        }
        return resetCount;
      })
    };

    return mockService;
  }
}
