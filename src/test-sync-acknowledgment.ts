// src/test-sync-acknowledgment.ts
// Test-Datei für das Sync-Acknowledgment-System

import { WebSocketService } from '@/services/WebSocketService';
import { TenantDbService } from '@/services/TenantDbService';
import { useTenantStore } from '@/stores/tenantStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useWebSocketStore } from '@/stores/webSocketStore';
import { SyncStatus, EntityTypeEnum, SyncOperationType, type Account, type SyncAckMessage, type SyncNackMessage } from '@/types';
import { debugLog, infoLog, errorLog } from '@/utils/logger';

const MODULE_NAME = 'SyncAcknowledgmentTest';

export class SyncAcknowledgmentTester {
  private tenantDbService: TenantDbService;
  private testTenantId = 'test-tenant-123';

  constructor() {
    this.tenantDbService = new TenantDbService();
  }

  async runAllTests(): Promise<void> {
    infoLog(MODULE_NAME, 'Starte Sync-Acknowledgment-Tests...');

    try {
      await this.testSyncAckProcessing();
      await this.testSyncNackProcessing();
      await this.testRetryMechanism();
      await this.testQueueCleanup();
      await this.testStuckProcessingReset();

      infoLog(MODULE_NAME, 'Alle Sync-Acknowledgment-Tests erfolgreich abgeschlossen!');
    } catch (error) {
      errorLog(MODULE_NAME, 'Fehler beim Ausführen der Tests', { error });
      throw error;
    }
  }

  async testSyncAckProcessing(): Promise<void> {
    infoLog(MODULE_NAME, 'Test: Sync-ACK-Verarbeitung');

    // Test-Account erstellen
    const testAccount: Account = {
      id: 'test-account-ack',
      name: 'Test Account ACK',
      accountType: 'CHECKING' as any,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: 'test-group-1',
      sortOrder: 1,
      balance: 1000,
      offset: 0,
      updated_at: new Date().toISOString()
    };

    // Sync-Queue-Eintrag erstellen
    const syncEntry = await this.tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: testAccount.id,
      operationType: SyncOperationType.CREATE,
      payload: testAccount
    });

    if (!syncEntry) {
      throw new Error('Konnte Sync-Queue-Eintrag nicht erstellen');
    }

    // Status auf PROCESSING setzen (simuliert Verarbeitung)
    await this.tenantDbService.updateSyncQueueEntryStatus(syncEntry.id, SyncStatus.PROCESSING);

    // Sync-ACK-Nachricht simulieren
    const ackMessage: SyncAckMessage = {
      type: 'sync_ack',
      id: syncEntry.id,
      status: 'processed',
      entityId: testAccount.id,
      entityType: EntityTypeEnum.ACCOUNT,
      operationType: SyncOperationType.CREATE
    };

    // ACK verarbeiten
    await WebSocketService.processSyncAck(ackMessage);

    // Prüfen, ob Eintrag entfernt wurde
    const remainingEntry = await this.tenantDbService.getSyncQueueEntry(syncEntry.id);
    if (remainingEntry) {
      throw new Error('Sync-Queue-Eintrag wurde nach ACK nicht entfernt');
    }

    infoLog(MODULE_NAME, 'Sync-ACK-Verarbeitung erfolgreich getestet ✓');
  }

  async testSyncNackProcessing(): Promise<void> {
    infoLog(MODULE_NAME, 'Test: Sync-NACK-Verarbeitung');

    // Test-Account erstellen
    const testAccount: Account = {
      id: 'test-account-nack',
      name: 'Test Account NACK',
      accountType: 'CHECKING' as any,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: 'test-group-1',
      sortOrder: 1,
      balance: 1000,
      offset: 0,
      updated_at: new Date().toISOString()
    };

    // Sync-Queue-Eintrag erstellen
    const syncEntry = await this.tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: testAccount.id,
      operationType: SyncOperationType.CREATE,
      payload: testAccount
    });

    if (!syncEntry) {
      throw new Error('Konnte Sync-Queue-Eintrag nicht erstellen');
    }

    // Status auf PROCESSING setzen
    await this.tenantDbService.updateSyncQueueEntryStatus(syncEntry.id, SyncStatus.PROCESSING);

    // Sync-NACK-Nachricht simulieren
    const nackMessage: SyncNackMessage = {
      type: 'sync_nack',
      id: syncEntry.id,
      status: 'failed',
      entityId: testAccount.id,
      entityType: EntityTypeEnum.ACCOUNT,
      operationType: SyncOperationType.CREATE,
      reason: 'validation_error',
      detail: 'Test validation error'
    };

    // NACK verarbeiten
    await WebSocketService.processSyncNack(nackMessage);

    // Prüfen, ob Eintrag auf PENDING zurückgesetzt wurde (für Retry)
    const updatedEntry = await this.tenantDbService.getSyncQueueEntry(syncEntry.id);
    if (!updatedEntry || updatedEntry.status !== SyncStatus.PENDING) {
      throw new Error('Sync-Queue-Eintrag wurde nach NACK nicht korrekt für Retry vorbereitet');
    }

    // Cleanup
    await this.tenantDbService.removeSyncQueueEntry(syncEntry.id);

    infoLog(MODULE_NAME, 'Sync-NACK-Verarbeitung erfolgreich getestet ✓');
  }

  async testRetryMechanism(): Promise<void> {
    infoLog(MODULE_NAME, 'Test: Retry-Mechanismus');

    // Test-Account erstellen
    const testAccount: Account = {
      id: 'test-account-retry',
      name: 'Test Account Retry',
      accountType: 'CHECKING' as any,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: 'test-group-1',
      sortOrder: 1,
      balance: 1000,
      offset: 0,
      updated_at: new Date().toISOString()
    };

    // Sync-Queue-Eintrag erstellen
    const syncEntry = await this.tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: testAccount.id,
      operationType: SyncOperationType.CREATE,
      payload: testAccount
    });

    if (!syncEntry) {
      throw new Error('Konnte Sync-Queue-Eintrag nicht erstellen');
    }

    // Mehrere NACK-Nachrichten simulieren bis Maximum erreicht
    const maxRetries = WebSocketService.getMaxRetriesForReason('validation_error');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await this.tenantDbService.updateSyncQueueEntryStatus(syncEntry.id, SyncStatus.PROCESSING);

      const nackMessage: SyncNackMessage = {
        type: 'sync_nack',
        id: syncEntry.id,
        status: 'failed',
        entityId: testAccount.id,
        entityType: EntityTypeEnum.ACCOUNT,
        operationType: SyncOperationType.CREATE,
        reason: 'validation_error',
        detail: `Test retry attempt ${attempt + 1}`
      };

      await WebSocketService.processSyncNack(nackMessage);
    }

    // Nach Maximum sollte Eintrag als FAILED markiert sein
    const finalEntry = await this.tenantDbService.getSyncQueueEntry(syncEntry.id);
    if (!finalEntry || finalEntry.status !== SyncStatus.FAILED) {
      throw new Error('Sync-Queue-Eintrag wurde nach maximalen Retries nicht als FAILED markiert');
    }

    // Cleanup
    await this.tenantDbService.removeSyncQueueEntry(syncEntry.id);

    infoLog(MODULE_NAME, 'Retry-Mechanismus erfolgreich getestet ✓');
  }

  async testQueueCleanup(): Promise<void> {
    infoLog(MODULE_NAME, 'Test: Queue-Bereinigung');

    // Mehrere Test-Einträge erstellen
    const testEntries = [];
    for (let i = 0; i < 3; i++) {
      const testAccount: Account = {
        id: `test-account-cleanup-${i}`,
        name: `Test Account Cleanup ${i}`,
        accountType: 'CHECKING' as any,
        isActive: true,
        isOfflineBudget: false,
        accountGroupId: 'test-group-1',
        sortOrder: i,
        balance: 1000 + i,
        offset: 0,
        updated_at: new Date().toISOString()
      };

      const syncEntry = await this.tenantDbService.addSyncQueueEntry({
        entityType: EntityTypeEnum.ACCOUNT,
        entityId: testAccount.id,
        operationType: SyncOperationType.CREATE,
        payload: testAccount
      });

      if (syncEntry) {
        testEntries.push(syncEntry);
      }
    }

    // Alle Einträge sollten existieren
    if (testEntries.length !== 3) {
      throw new Error('Nicht alle Test-Einträge wurden erstellt');
    }

    // Einträge einzeln mit ACK entfernen
    for (const entry of testEntries) {
      const ackMessage: SyncAckMessage = {
        type: 'sync_ack',
        id: entry.id,
        status: 'processed',
        entityId: entry.entityId,
        entityType: entry.entityType,
        operationType: entry.operationType
      };

      await WebSocketService.processSyncAck(ackMessage);
    }

    // Prüfen, ob alle Einträge entfernt wurden
    for (const entry of testEntries) {
      const remainingEntry = await this.tenantDbService.getSyncQueueEntry(entry.id);
      if (remainingEntry) {
        throw new Error(`Sync-Queue-Eintrag ${entry.id} wurde nicht bereinigt`);
      }
    }

    infoLog(MODULE_NAME, 'Queue-Bereinigung erfolgreich getestet ✓');
  }

  async testStuckProcessingReset(): Promise<void> {
    infoLog(MODULE_NAME, 'Test: Hängende PROCESSING-Einträge zurücksetzen');

    // Test-Account erstellen
    const testAccount: Account = {
      id: 'test-account-stuck',
      name: 'Test Account Stuck',
      accountType: 'CHECKING' as any,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: 'test-group-1',
      sortOrder: 1,
      balance: 1000,
      offset: 0,
      updated_at: new Date().toISOString()
    };

    // Sync-Queue-Eintrag erstellen
    const syncEntry = await this.tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: testAccount.id,
      operationType: SyncOperationType.CREATE,
      payload: testAccount
    });

    if (!syncEntry) {
      throw new Error('Konnte Sync-Queue-Eintrag nicht erstellen');
    }

    // Status auf PROCESSING setzen mit altem Zeitstempel
    await this.tenantDbService.updateSyncQueueEntryStatus(syncEntry.id, SyncStatus.PROCESSING);

    // Manuell lastAttempt auf alten Wert setzen (simuliert hängenden Eintrag)
    const tenantStore = useTenantStore();
    if (tenantStore.activeTenantDB) {
      await tenantStore.activeTenantDB.syncQueue.update(syncEntry.id, {
        lastAttempt: Date.now() - 60000 // 1 Minute alt
      });
    }

    // Reset-Funktion aufrufen
    const resetCount = await this.tenantDbService.resetStuckProcessingEntries(this.testTenantId, 30000);

    if (resetCount !== 1) {
      throw new Error(`Erwartete 1 zurückgesetzten Eintrag, aber ${resetCount} erhalten`);
    }

    // Prüfen, ob Eintrag auf PENDING zurückgesetzt wurde
    const resetEntry = await this.tenantDbService.getSyncQueueEntry(syncEntry.id);
    if (!resetEntry || resetEntry.status !== SyncStatus.PENDING) {
      throw new Error('Hängender PROCESSING-Eintrag wurde nicht auf PENDING zurückgesetzt');
    }

    // Cleanup
    await this.tenantDbService.removeSyncQueueEntry(syncEntry.id);

    infoLog(MODULE_NAME, 'Hängende PROCESSING-Einträge-Reset erfolgreich getestet ✓');
  }

  // Hilfsmethoden für manuelle Tests
  async createTestSyncEntry(entityId: string, operationType: SyncOperationType): Promise<string | null> {
    const testAccount: Account = {
      id: entityId,
      name: `Test Account ${entityId}`,
      accountType: 'CHECKING' as any,
      isActive: true,
      isOfflineBudget: false,
      accountGroupId: 'test-group-1',
      sortOrder: 1,
      balance: 1000,
      offset: 0,
      updated_at: new Date().toISOString()
    };

    const syncEntry = await this.tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: entityId,
      operationType: operationType,
      payload: testAccount
    });

    return syncEntry?.id || null;
  }

  async simulateAck(syncEntryId: string, entityId: string): Promise<void> {
    const ackMessage: SyncAckMessage = {
      type: 'sync_ack',
      id: syncEntryId,
      status: 'processed',
      entityId: entityId,
      entityType: EntityTypeEnum.ACCOUNT,
      operationType: SyncOperationType.CREATE
    };

    await WebSocketService.processSyncAck(ackMessage);
  }

  async simulateNack(syncEntryId: string, entityId: string, reason: string = 'test_error'): Promise<void> {
    const nackMessage: SyncNackMessage = {
      type: 'sync_nack',
      id: syncEntryId,
      status: 'failed',
      entityId: entityId,
      entityType: EntityTypeEnum.ACCOUNT,
      operationType: SyncOperationType.CREATE,
      reason: reason,
      detail: `Test NACK: ${reason}`
    };

    await WebSocketService.processSyncNack(nackMessage);
  }
}

// Export für manuelle Tests
export const syncAckTester = new SyncAcknowledgmentTester();

// Automatische Tests beim Import (nur in Development)
if (import.meta.env.DEV) {
  // Tests können manuell über die Konsole ausgeführt werden:
  // import { syncAckTester } from '@/test-sync-acknowledgment';
  // await syncAckTester.runAllTests();
  debugLog(MODULE_NAME, 'Sync-Acknowledgment-Tester geladen. Verwende syncAckTester.runAllTests() zum Testen.');
}
