/**
 * Mock WebSocket Server für Integration Tests
 * Simuliert Backend-WebSocket-Verhalten für vollautomatisierte Tests
 */

import { vi } from 'vitest';
import type { SyncAckMessage, SyncNackMessage, SyncQueueEntry } from '@/types';
import { EntityTypeEnum, SyncOperationType } from '@/types';

export interface MockWebSocketMessage {
  type: string;
  payload?: any;
  [key: string]: any;
}

export class MockWebSocketServer {
  private isOnline = false;
  private autoAck = false;
  private autoNack = false;
  private nackReason = '';
  private nackDetail = '';
  private sentMessages: MockWebSocketMessage[] = [];
  private receivedMessages: MockWebSocketMessage[] = [];
  private connectionCallbacks: (() => void)[] = [];
  private messageCallbacks: ((message: any) => void)[] = [];

  constructor() {
    this.reset();
  }

  async start(): Promise<void> {
    this.reset();
  }

  async stop(): Promise<void> {
    this.reset();
  }

  reset(): void {
    this.isOnline = false;
    this.autoAck = false;
    this.autoNack = false;
    this.nackReason = '';
    this.nackDetail = '';
    this.sentMessages = [];
    this.receivedMessages = [];
    this.connectionCallbacks = [];
    this.messageCallbacks = [];
  }

  setOnlineMode(): void {
    this.isOnline = true;
  }

  setOfflineMode(): void {
    this.isOnline = false;
  }

  enableAutoAck(): void {
    this.autoAck = true;
    this.autoNack = false;
  }

  enableAutoNack(reason: string, detail?: string): void {
    this.autoNack = true;
    this.autoAck = false;
    this.nackReason = reason;
    this.nackDetail = detail || '';
  }

  simulateConnection(): void {
    if (this.isOnline) {
      // Simuliere erfolgreiche Verbindung
      setTimeout(() => {
        this.connectionCallbacks.forEach(callback => callback());

        // Simuliere Backend-Status-Nachricht
        const statusMessage = {
          type: 'status',
          status: 'online'
        };
        this.messageCallbacks.forEach(callback => callback(statusMessage));
      }, 10);
    }
  }

  receiveMessage(message: MockWebSocketMessage): boolean {
    if (!this.isOnline) {
      return false;
    }

    this.receivedMessages.push(message);

    // Verarbeite process_sync_entry Nachrichten
    if (message.type === 'process_sync_entry' && message.payload) {
      this.processSyncEntry(message.payload);
    }

    return true;
  }

  private processSyncEntry(syncEntry: SyncQueueEntry): void {
    setTimeout(() => {
      if (this.autoAck) {
        this.sendAckMessage(syncEntry);
      } else if (this.autoNack) {
        this.sendNackMessage(syncEntry);
      }
    }, 50); // Simuliere Verarbeitungszeit
  }

  private sendAckMessage(syncEntry: SyncQueueEntry): void {
    const ackMessage: SyncAckMessage = {
      type: 'sync_ack',
      id: syncEntry.id,
      status: 'processed',
      entityId: syncEntry.entityId,
      entityType: syncEntry.entityType,
      operationType: syncEntry.operationType
    };

    this.sentMessages.push(ackMessage);
    this.messageCallbacks.forEach(callback => callback(ackMessage));
  }

  private sendNackMessage(syncEntry: SyncQueueEntry): void {
    const nackMessage: SyncNackMessage = {
      type: 'sync_nack',
      id: syncEntry.id,
      status: 'failed',
      entityId: syncEntry.entityId,
      entityType: syncEntry.entityType,
      operationType: syncEntry.operationType,
      reason: this.nackReason,
      detail: this.nackDetail
    };

    this.sentMessages.push(nackMessage);
    this.messageCallbacks.forEach(callback => callback(nackMessage));
  }

  getSentMessages(): MockWebSocketMessage[] {
    return [...this.sentMessages];
  }

  getReceivedMessages(): MockWebSocketMessage[] {
    return [...this.receivedMessages];
  }

  onConnection(callback: () => void): void {
    this.connectionCallbacks.push(callback);
  }

  onMessage(callback: (message: any) => void): void {
    this.messageCallbacks.push(callback);
  }

  // Simuliere verschiedene Backend-Szenarien
  simulateBackendDelay(delayMs: number): void {
    // Implementierung für Delay-Simulation
    vi.useFakeTimers();
    setTimeout(() => {
      vi.useRealTimers();
    }, delayMs);
  }

  simulateConnectionError(): void {
    setTimeout(() => {
      const errorMessage = {
        type: 'status',
        status: 'error',
        message: 'Connection error simulated'
      };
      this.messageCallbacks.forEach(callback => callback(errorMessage));
    }, 10);
  }

  simulateDataUpdate(entityType: EntityTypeEnum, operationType: SyncOperationType, data: any): void {
    const updateMessage = {
      type: 'data_update',
      event_type: 'data_update',
      tenant_id: 'test-tenant',
      entity_type: entityType,
      operation_type: operationType,
      data: data
    };

    this.sentMessages.push(updateMessage);
    this.messageCallbacks.forEach(callback => callback(updateMessage));
  }

  simulateInitialDataLoad(accounts: any[], accountGroups: any[]): void {
    const initialDataMessage = {
      type: 'initial_data_load',
      event_type: 'initial_data_load',
      tenant_id: 'test-tenant',
      payload: {
        accounts: accounts,
        account_groups: accountGroups
      }
    };

    this.sentMessages.push(initialDataMessage);
    this.messageCallbacks.forEach(callback => callback(initialDataMessage));
  }

  // Hilfsmethoden für spezifische Test-Szenarien
  simulateValidationError(syncEntry: SyncQueueEntry): void {
    this.enableAutoNack('validation_error', 'Invalid entity data provided');
    this.processSyncEntry(syncEntry);
  }

  simulateDatabaseError(syncEntry: SyncQueueEntry): void {
    this.enableAutoNack('database_error', 'Database connection failed');
    this.processSyncEntry(syncEntry);
  }

  simulateNetworkError(): void {
    this.setOfflineMode();
    setTimeout(() => {
      const errorMessage = {
        type: 'status',
        status: 'offline',
        message: 'Network connection lost'
      };
      this.messageCallbacks.forEach(callback => callback(errorMessage));
    }, 10);
  }

  // Erweiterte Simulation für komplexe Szenarien
  simulatePartialFailure(successRate: number = 0.5): void {
    const originalProcessSyncEntry = this.processSyncEntry.bind(this);
    this.processSyncEntry = (syncEntry: SyncQueueEntry) => {
      if (Math.random() < successRate) {
        this.enableAutoAck();
      } else {
        this.enableAutoNack('random_failure', 'Simulated random failure');
      }
      originalProcessSyncEntry(syncEntry);
    };
  }

  simulateSlowBackend(delayMs: number = 1000): void {
    const originalProcessSyncEntry = this.processSyncEntry.bind(this);
    this.processSyncEntry = (syncEntry: SyncQueueEntry) => {
      setTimeout(() => {
        originalProcessSyncEntry(syncEntry);
      }, delayMs);
    };
  }
}
