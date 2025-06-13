# Synchronisationssystem - API-Spezifikation

## WebSocket-Nachrichten

### Client → Server Nachrichten

#### 1. process_sync_entry
Verarbeitung eines Sync-Queue-Eintrags

```typescript
interface ProcessSyncEntryMessage {
  type: 'process_sync_entry';
  payload: SyncQueueEntry;
}

interface SyncQueueEntry {
  id: string;                    // UUID des Queue-Eintrags
  tenantId: string;             // Mandanten-ID
  entityType: EntityTypeEnum;   // 'Account' | 'AccountGroup' | ...
  entityId: string;             // ID der betroffenen Entität
  operationType: SyncOperationType; // 'create' | 'update' | 'delete'
  payload: Account | AccountGroup | { id: string } | null;
  timestamp: number;            // Unix-Timestamp der Änderung
  status: SyncStatus;           // 'pending' | 'processing' | 'synced' | 'failed'
  attempts?: number;            // Anzahl Synchronisierungsversuche
  lastAttempt?: number;         // Zeitstempel des letzten Versuchs
  error?: string;               // Fehlermeldung bei Fehlschlag
}
```

#### 2. request_initial_data
Anfrage für initiale Daten nach Verbindungsaufbau

```typescript
interface RequestInitialDataMessage {
  type: 'request_initial_data';
  tenant_id: string;
}
```

#### 3. request_data_status
Anfrage für Server-Datenstand (periodische Synchronisation)

```typescript
interface RequestDataStatusMessage {
  type: 'request_data_status';
  tenant_id: string;
  last_sync_time?: number;      // Letzter bekannter Sync-Zeitpunkt
  entity_checksums?: {          // Lokale Checksummen für Vergleich
    [entityType: string]: {
      [entityId: string]: string;
    };
  };
}
```

### Server → Client Nachrichten

#### 1. sync_ack
Bestätigung einer erfolgreichen Synchronisation

```typescript
interface SyncAckMessage {
  type: 'sync_ack';
  id: string;                   // SyncQueueEntry.id
  status: 'processed';
  entityId: string;             // ID der synchronisierten Entität
  entityType: EntityTypeEnum;   // Typ der Entität
  operationType: SyncOperationType; // Art der Operation
  server_timestamp?: number;    // Server-Zeitstempel der Verarbeitung
  checksum?: string;            // Checksumme der finalen Daten
}
```

#### 2. sync_nack
Ablehnung einer Synchronisation mit Fehlerdetails

```typescript
interface SyncNackMessage {
  type: 'sync_nack';
  id: string;                   // SyncQueueEntry.id
  status: 'failed';
  entityId: string;
  entityType: EntityTypeEnum;
  operationType: SyncOperationType;
  reason: SyncNackReason;       // Kategorisierter Fehlergrund
  detail?: string;              // Detaillierte Fehlermeldung
  retry_after?: number;         // Empfohlene Wartezeit vor Retry (ms)
  is_permanent?: boolean;       // Ob der Fehler permanent ist
}

enum SyncNackReason {
  VALIDATION_ERROR = 'validation_error',     // Datenvalidierung fehlgeschlagen
  CONFLICT_ERROR = 'conflict_error',         // Concurrent modification
  PERMISSION_ERROR = 'permission_error',     // Keine Berechtigung
  NOT_FOUND_ERROR = 'not_found_error',      // Entität nicht gefunden
  CONSTRAINT_ERROR = 'constraint_error',     // DB-Constraint verletzt
  SYSTEM_ERROR = 'system_error',            // Interner Serverfehler
  RATE_LIMIT_ERROR = 'rate_limit_error'     // Rate Limiting
}
```

#### 3. data_update
Server-initiierte Datenänderung (von anderen Clients)

```typescript
interface DataUpdateNotificationMessage {
  type: 'data_update';
  event_type: 'data_update';
  tenant_id: string;
  entity_type: EntityTypeEnum;
  operation_type: SyncOperationType;
  data: Account | AccountGroup | DeletePayload;
  source_client_id?: string;    // ID des verursachenden Clients
  server_timestamp: number;     // Server-Zeitstempel der Änderung
  checksum: string;             // Checksumme der Daten
}

interface DeletePayload {
  id: string;
  deleted_at: number;           // Zeitstempel der Löschung
}
```

#### 4. initial_data_load
Antwort auf request_initial_data mit vollständigen Daten

```typescript
interface InitialDataLoadMessage {
  type: 'initial_data_load';
  event_type: 'initial_data_load';
  tenant_id: string;
  payload: InitialDataPayload;
  server_timestamp: number;
  total_count: number;          // Gesamtanzahl übertragener Entitäten
}

interface InitialDataPayload {
  accounts: Account[];
  account_groups: AccountGroup[];
  // Weitere Entitätstypen bei Bedarf
}
```

#### 5. data_status_response
Antwort auf request_data_status mit Server-Datenstand

```typescript
interface DataStatusResponseMessage {
  type: 'data_status_response';
  tenant_id: string;
  server_timestamp: number;
  entity_checksums: {
    [entityType: string]: {
      [entityId: string]: {
        checksum: string;
        last_modified: number;
      };
    };
  };
  deleted_entities?: {          // Gelöschte Entitäten seit last_sync_time
    [entityType: string]: string[]; // Array von Entity-IDs
  };
}
```

#### 6. status
Allgemeine Backend-Status-Nachrichten

```typescript
interface StatusMessage {
  type: 'status';
  status: BackendStatus;        // 'online' | 'offline' | 'maintenance' | 'error'
  message?: string;             // Optionale Statusmeldung
  maintenance_until?: number;   // Ende der Wartung (Unix-Timestamp)
}

enum BackendStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  ERROR = 'error'
}
```

## Store-APIs

### WebSocketStore Erweiterungen

```typescript
interface SyncState {
  isAutoSyncEnabled: boolean;
  lastAutoSyncTime: number | null;
  nextAutoSyncTime: number | null;
  queueStatistics: QueueStatistics | null;
  syncInProgress: boolean;
  syncAnimationEndTime: number | null;
  periodicSyncInterval: number;  // Intervall in ms (default: 60000)
}

interface QueueStatistics {
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  lastSyncTime: number | null;
  oldestPendingTime: number | null;
  totalSyncedToday: number;
  averageSyncDuration: number;   // in ms
  lastErrorMessage: string | null;
}

// Neue Store-Actions
function setSyncInProgress(inProgress: boolean, minimumDuration: number = 3000): void;
function updateQueueStatistics(stats: QueueStatistics): void;
function setAutoSyncEnabled(enabled: boolean): void;
function setPeriodicSyncInterval(intervalMs: number): void;
function recordSyncMetrics(duration: number, success: boolean, error?: string): void;
```

### TenantDbService Erweiterungen

```typescript
// Queue-Management
async getQueueStatistics(tenantId: string): Promise<QueueStatistics>;
async batchUpdateQueueStatus(entryIds: string[], newStatus: SyncStatus, error?: string): Promise<number>;
async cleanupOldEntries(tenantId: string, maxAge: number): Promise<number>;
async getQueueEntriesByStatus(tenantId: string, status: SyncStatus, limit?: number): Promise<SyncQueueEntry[]>;

// Checksummen und Vergleiche
async calculateEntityChecksum(entityType: EntityTypeEnum, entityId: string): Promise<string | null>;
async getEntityChecksums(tenantId: string): Promise<Record<string, Record<string, string>>>;
async compareWithServerChecksums(serverChecksums: Record<string, Record<string, any>>): Promise<ConflictReport>;

interface ConflictReport {
  localOnly: Array<{ entityType: string; entityId: string }>;
  serverOnly: Array<{ entityType: string; entityId: string }>;
  conflicts: Array<{
    entityType: string;
    entityId: string;
    localChecksum: string;
    serverChecksum: string;
    lastModified: { local: number; server: number };
  }>;
}

// Metriken und Monitoring
async recordSyncAttempt(entryId: string, success: boolean, duration: number, error?: string): Promise<void>;
async getSyncMetrics(tenantId: string, timeRange: { from: number; to: number }): Promise<SyncMetrics>;

interface SyncMetrics {
  totalAttempts: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageDuration: number;
  errorBreakdown: Record<string, number>;
  peakSyncTimes: Array<{ timestamp: number; count: number }>;
}
```

## WebSocketService Erweiterungen

```typescript
// Automatische Synchronisation
async initializeAutoSync(): Promise<void>;
async startPeriodicSync(intervalMs: number = 60000): Promise<void>;
async stopPeriodicSync(): Promise<void>;

// Queue-Überwachung
private setupQueueWatcher(): void;
private setupConnectionWatcher(): void;
private onQueueChanged(changes: QueueChange[]): Promise<void>;

interface QueueChange {
  type: 'added' | 'updated' | 'removed';
  entry: SyncQueueEntry;
  oldEntry?: SyncQueueEntry;
}

// Server-Status-Abfrage
async requestServerDataStatus(tenantId: string): Promise<void>;
private async handleDataStatusResponse(message: DataStatusResponseMessage): Promise<void>;
private async resolveDataConflicts(conflicts: ConflictReport): Promise<void>;

// Retry-Management
private getMaxRetriesForReason(reason: SyncNackReason): number;
private calculateRetryDelay(attemptNumber: number, reason?: SyncNackReason): number;
private shouldRetryError(reason: SyncNackReason): boolean;

// Metriken und Monitoring
async getSyncHealth(): Promise<SyncHealthReport>;

interface SyncHealthReport {
  connectionStatus: WebSocketConnectionStatus;
  backendStatus: BackendStatus;
  queueHealth: {
    pendingCount: number;
    oldestPendingAge: number;    // in ms
    failedCount: number;
    avgProcessingTime: number;
  };
  syncPerformance: {
    successRate: number;         // 0-1
    avgSyncDuration: number;     // in ms
    syncsLast24h: number;
    errorsLast24h: number;
  };
  recommendations: string[];     // Empfehlungen zur Optimierung
}
```

## Fehler-Codes und -Behandlung

### Client-seitige Fehlerbehandlung

```typescript
enum SyncErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface SyncError extends Error {
  code: SyncErrorCode;
  entityType?: EntityTypeEnum;
  entityId?: string;
  retryable: boolean;
  retryAfter?: number;
  details?: Record<string, any>;
}

// Fehlerbehandlungs-Strategien
class SyncErrorHandler {
  static handleSyncNack(nackMessage: SyncNackMessage): SyncError;
  static shouldRetry(error: SyncError, attemptCount: number): boolean;
  static getRetryDelay(error: SyncError, attemptCount: number): number;
  static createUserFriendlyMessage(error: SyncError): string;
}
```

### Logging und Debugging

```typescript
// Erweiterte Logging-Interfaces
interface SyncLogEntry {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  operation: string;
  entityType?: EntityTypeEnum;
  entityId?: string;
  duration?: number;
  details?: Record<string, any>;
  error?: SyncError;
}

// Debug-Hilfsfunktionen
class SyncDebugger {
  static exportQueueState(tenantId: string): Promise<QueueDebugInfo>;
  static exportSyncLogs(timeRange: { from: number; to: number }): Promise<SyncLogEntry[]>;
  static validateQueueIntegrity(tenantId: string): Promise<IntegrityReport>;
  static simulateSyncScenario(scenario: SyncTestScenario): Promise<void>;
}

interface QueueDebugInfo {
  queueEntries: SyncQueueEntry[];
  statistics: QueueStatistics;
  recentErrors: SyncError[];
  performanceMetrics: SyncMetrics;
}
```

## Konfiguration

### Sync-Konfiguration

```typescript
interface SyncConfiguration {
  autoSync: {
    enabled: boolean;
    periodicInterval: number;     // ms, default: 60000
    immediateOnConnection: boolean;
    immediateOnQueueChange: boolean;
  };
  retry: {
    maxAttempts: Record<SyncNackReason, number>;
    baseDelay: number;           // ms, default: 1000
    maxDelay: number;            // ms, default: 30000
    backoffMultiplier: number;   // default: 2
  };
  queue: {
    maxSize: number;             // default: 1000
    cleanupInterval: number;     // ms, default: 3600000 (1h)
    maxAge: number;              // ms, default: 604800000 (7d)
  };
  ui: {
    minSyncAnimationDuration: number; // ms, default: 3000
    showDetailedErrors: boolean;
    enableSyncNotifications: boolean;
  };
  performance: {
    batchSize: number;           // default: 10
    concurrentSyncs: number;     // default: 3
    checksumAlgorithm: 'md5' | 'sha256'; // default: 'md5'
  };
}
```

---

*Diese API-Spezifikation definiert die vollständige Schnittstelle für das Synchronisationssystem. Für Implementierungsdetails siehe: [Implementierungsdetails](sync-implementation-details.md)*
