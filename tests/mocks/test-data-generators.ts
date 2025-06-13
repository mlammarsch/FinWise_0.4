/**
 * Test Data Generators für Integration Tests
 * Generiert konsistente Test-Daten für alle Test-Szenarien
 */

import { v4 as uuidv4 } from 'uuid';
import type { Account, AccountGroup, SyncQueueEntry } from '../../src/types';
import { AccountType, SyncOperationType, EntityTypeEnum, SyncStatus } from '../../src/types';

export class TestDataGenerator {
  private accountCounter = 0;
  private accountGroupCounter = 0;

  /**
   * Generiert ein Test-Account mit eindeutigen Daten
   */
  generateAccount(overrides: Partial<Account> = {}): Account {
    this.accountCounter++;

    const baseAccount: Account = {
      id: uuidv4(),
      name: `Test Account ${this.accountCounter}`,
      description: `Test description for account ${this.accountCounter}`,
      note: `Test note ${this.accountCounter}`,
      accountType: AccountType.CHECKING,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: this.generateAccountGroupId(),
      sortOrder: this.accountCounter,
      iban: this.generateIban(),
      balance: this.generateRandomBalance(),
      creditLimit: 0,
      offset: 0,
      image: undefined,
      updated_at: new Date().toISOString()
    };

    return { ...baseAccount, ...overrides };
  }

  /**
   * Generiert eine Test-AccountGroup mit eindeutigen Daten
   */
  generateAccountGroup(overrides: Partial<AccountGroup> = {}): AccountGroup {
    this.accountGroupCounter++;

    const baseAccountGroup: AccountGroup = {
      id: uuidv4(),
      name: `Test Account Group ${this.accountGroupCounter}`,
      sortOrder: this.accountGroupCounter,
      image: undefined,
      updated_at: new Date().toISOString()
    };

    return { ...baseAccountGroup, ...overrides };
  }

  /**
   * Generiert einen Test-SyncQueueEntry
   */
  generateSyncQueueEntry(overrides: Partial<SyncQueueEntry> = {}): SyncQueueEntry {
    const baseEntry: SyncQueueEntry = {
      id: uuidv4(),
      tenantId: 'test-tenant-id',
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: uuidv4(),
      operationType: SyncOperationType.CREATE,
      payload: this.generateAccount(),
      timestamp: Date.now(),
      status: SyncStatus.PENDING,
      attempts: 0
    };

    return { ...baseEntry, ...overrides };
  }

  /**
   * Generiert mehrere Test-Accounts
   */
  generateAccounts(count: number, overrides: Partial<Account> = {}): Account[] {
    return Array.from({ length: count }, () => this.generateAccount(overrides));
  }

  /**
   * Generiert mehrere Test-AccountGroups
   */
  generateAccountGroups(count: number, overrides: Partial<AccountGroup> = {}): AccountGroup[] {
    return Array.from({ length: count }, () => this.generateAccountGroup(overrides));
  }

  /**
   * Generiert mehrere Test-SyncQueueEntries
   */
  generateSyncQueueEntries(count: number, overrides: Partial<SyncQueueEntry> = {}): SyncQueueEntry[] {
    return Array.from({ length: count }, () => this.generateSyncQueueEntry(overrides));
  }

  /**
   * Generiert Account mit spezifischem AccountType
   */
  generateAccountByType(accountType: AccountType, overrides: Partial<Account> = {}): Account {
    return this.generateAccount({ accountType, ...overrides });
  }

  /**
   * Generiert Account mit spezifischer AccountGroup
   */
  generateAccountWithGroup(accountGroup: AccountGroup, overrides: Partial<Account> = {}): Account {
    return this.generateAccount({ accountGroupId: accountGroup.id, ...overrides });
  }

  /**
   * Generiert Account-Paar für Transfer-Tests
   */
  generateAccountPair(): { fromAccount: Account; toAccount: Account; accountGroup: AccountGroup } {
    const accountGroup = this.generateAccountGroup();
    const fromAccount = this.generateAccount({
      accountGroupId: accountGroup.id,
      balance: 1000,
      name: 'From Account'
    });
    const toAccount = this.generateAccount({
      accountGroupId: accountGroup.id,
      balance: 500,
      name: 'To Account'
    });

    return { fromAccount, toAccount, accountGroup };
  }

  /**
   * Generiert Account mit Timestamp-Konflikt-Szenarien
   */
  generateConflictingAccounts(baseAccount: Account): {
    olderAccount: Account;
    newerAccount: Account;
  } {
    const baseTime = new Date('2024-01-01T12:00:00Z');
    const olderTime = new Date(baseTime.getTime() - 60000); // 1 Minute früher
    const newerTime = new Date(baseTime.getTime() + 60000); // 1 Minute später

    const olderAccount = {
      ...baseAccount,
      name: `${baseAccount.name} (Older)`,
      updated_at: olderTime.toISOString()
    };

    const newerAccount = {
      ...baseAccount,
      name: `${baseAccount.name} (Newer)`,
      updated_at: newerTime.toISOString()
    };

    return { olderAccount, newerAccount };
  }

  /**
   * Generiert SyncQueueEntry für verschiedene Operationstypen
   */
  generateSyncQueueEntriesForAllOperations(entityId: string, entityType: EntityTypeEnum): SyncQueueEntry[] {
    const basePayload = entityType === EntityTypeEnum.ACCOUNT
      ? this.generateAccount({ id: entityId })
      : this.generateAccountGroup({ id: entityId });

    return [
      this.generateSyncQueueEntry({
        entityId,
        entityType,
        operationType: SyncOperationType.CREATE,
        payload: basePayload
      }),
      this.generateSyncQueueEntry({
        entityId,
        entityType,
        operationType: SyncOperationType.UPDATE,
        payload: basePayload
      }),
      this.generateSyncQueueEntry({
        entityId,
        entityType,
        operationType: SyncOperationType.DELETE,
        payload: { id: entityId }
      })
    ];
  }

  /**
   * Generiert SyncQueueEntry mit verschiedenen Status
   */
  generateSyncQueueEntriesWithStatus(): {
    pending: SyncQueueEntry;
    processing: SyncQueueEntry;
    synced: SyncQueueEntry;
    failed: SyncQueueEntry;
  } {
    const baseEntry = this.generateSyncQueueEntry();

    return {
      pending: { ...baseEntry, id: uuidv4(), status: SyncStatus.PENDING },
      processing: {
        ...baseEntry,
        id: uuidv4(),
        status: SyncStatus.PROCESSING,
        attempts: 1,
        lastAttempt: Date.now()
      },
      synced: { ...baseEntry, id: uuidv4(), status: SyncStatus.SYNCED },
      failed: {
        ...baseEntry,
        id: uuidv4(),
        status: SyncStatus.FAILED,
        attempts: 3,
        error: 'Test failure reason'
      }
    };
  }

  /**
   * Generiert hängende PROCESSING-Einträge für Reset-Tests
   */
  generateStuckProcessingEntries(count: number = 3): SyncQueueEntry[] {
    const oldTimestamp = Date.now() - 60000; // 60 Sekunden alt

    return Array.from({ length: count }, (_, index) =>
      this.generateSyncQueueEntry({
        status: SyncStatus.PROCESSING,
        attempts: 1,
        lastAttempt: oldTimestamp - (index * 1000), // Verschiedene alte Timestamps
        error: undefined
      })
    );
  }

  /**
   * Generiert Batch von Einträgen für Sequenz-Tests
   */
  generateSequentialSyncEntries(count: number): SyncQueueEntry[] {
    const baseTime = Date.now() - (count * 1000);

    return Array.from({ length: count }, (_, index) =>
      this.generateSyncQueueEntry({
        timestamp: baseTime + (index * 1000), // Sequenzielle Timestamps
        entityId: `entity-${index + 1}`,
        payload: this.generateAccount({ name: `Sequential Account ${index + 1}` })
      })
    );
  }

  // Hilfsmethoden für realistische Test-Daten

  private generateAccountGroupId(): string {
    return uuidv4();
  }

  private generateIban(): string {
    const countryCode = 'DE';
    const checkDigits = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const bankCode = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    const accountNumber = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');

    return `${countryCode}${checkDigits}${bankCode}${accountNumber}`;
  }

  private generateRandomBalance(): number {
    // Generiert Beträge zwischen -1000 und 10000 Euro
    return Math.floor((Math.random() - 0.1) * 11000);
  }

  /**
   * Generiert Test-Daten für spezifische Szenarien
   */
  generateScenarioData(scenario: 'offline-sync' | 'conflict-resolution' | 'retry-mechanism' | 'batch-processing'): any {
    switch (scenario) {
      case 'offline-sync':
        return {
          accounts: this.generateAccounts(3),
          accountGroups: this.generateAccountGroups(2),
          syncEntries: this.generateSyncQueueEntries(5)
        };

      case 'conflict-resolution':
        const baseAccount = this.generateAccount();
        const { olderAccount, newerAccount } = this.generateConflictingAccounts(baseAccount);
        return { baseAccount, olderAccount, newerAccount };

      case 'retry-mechanism':
        return {
          account: this.generateAccount(),
          failingEntry: this.generateSyncQueueEntry({
            attempts: 2,
            error: 'Previous failure',
            status: SyncStatus.PENDING
          })
        };

      case 'batch-processing':
        return {
          sequentialEntries: this.generateSequentialSyncEntries(5),
          mixedEntries: [
            ...this.generateSyncQueueEntries(2, { entityType: EntityTypeEnum.ACCOUNT }),
            ...this.generateSyncQueueEntries(2, { entityType: EntityTypeEnum.ACCOUNT_GROUP })
          ]
        };

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Reset der internen Zähler für saubere Tests
   */
  reset(): void {
    this.accountCounter = 0;
    this.accountGroupCounter = 0;
  }
}
