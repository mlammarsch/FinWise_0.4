// src/types/index.ts

// Account-Modelle
export interface Account {
  id: string
  name: string
  description?: string
  note?: string
  accountType: AccountType
  isActive: boolean
  isOfflineBudget: boolean
  accountGroupId: string
  sortOrder: number
  iban?: string
  balance: number
  creditLimit?: number
  offset: number
  image?: string
  updated_at?: string // ISO 8601 Format
}

export interface AccountGroup {
  id: string
  name: string
  sortOrder: number
  image?: string
  updated_at?: string // ISO 8601 Format
}

// Kategorie-Modelle
export interface Category {
  id: string
  name: string
  icon?: string
  budgeted: number
  activity: number
  available: number
  isIncomeCategory: boolean
  isHidden: boolean
  isActive: boolean
  sortOrder: number
  categoryGroupId?: string
  parentCategoryId?: string
  isSavingsGoal?: boolean
  updated_at?: string // ISO 8601 Format
}

export interface CategoryGroup {
  id: string
  name: string
  sortOrder: number
  isIncomeGroup: boolean
  updated_at?: string // ISO 8601 Format
}

// Tag- und Empfänger-Modelle
export interface Tag {
  id: string
  name: string
  parentTagId?: string | null
  color?: string
  icon?: string
  updated_at?: string // ISO 8601 Format
}

export interface Recipient {
  id: string
  name: string
  defaultCategoryId?: string | null
  note?: string
  updated_at?: string // ISO 8601 Format
}

// Transaktionen
export interface Transaction {
  id: string
  accountId: string
  categoryId?: string
  date: string
  valueDate: string
  amount: number
  description: string
  note?: string
  tagIds: string[]
  type: TransactionType
  runningBalance: number
  counterTransactionId?: string | null
  planningTransactionId?: string | null
  isReconciliation?: boolean
  isCategoryTransfer?: boolean
  transferToAccountId?: string | null
  reconciled?: boolean
  toCategoryId?: string
  payee?: string
}

// Planungstransaktionen
export interface PlanningTransaction {
  id: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  tagIds: string[];
  recipientId?: string | null;
  amount: number;
  amountType: AmountType;
  approximateAmount?: number;
  minAmount?: number;
  maxAmount?: number;
  note?: string;
  startDate: string;
  valueDate?: string | null;
  endDate?: string | null;
  recurrencePattern: RecurrencePattern;
  recurrenceCount?: number | null;
  recurrenceEndType: RecurrenceEndType;
  executionDay?: number | null;
  weekendHandling: WeekendHandlingType;
  transactionType?: TransactionType;
  counterPlanningTransactionId?: string | null;
  transferToAccountId?: string | null;
  transferToCategoryId?: string | null;
  isActive: boolean;
  forecastOnly: boolean;
  autoExecute?: boolean;
  updated_at?: string; // ISO 8601 Format
}

// Regeln / Automatisierungen
export enum RuleConditionType {
  ACCOUNT_IS = 'ACCOUNT_IS',
  PAYEE_EQUALS = 'PAYEE_EQUALS',
  PAYEE_CONTAINS = 'PAYEE_CONTAINS',
  AMOUNT_EQUALS = 'AMOUNT_EQUALS',
  AMOUNT_GREATER = 'AMOUNT_GREATER',
  AMOUNT_LESS = 'AMOUNT_LESS',
  DATE_IS = 'DATE_IS',
  DATE_APPROX = 'DATE_APPROX',
  DESCRIPTION_CONTAINS = 'DESCRIPTION_CONTAINS'
}

export enum RuleActionType {
  SET_CATEGORY = 'SET_CATEGORY',
  ADD_TAG = 'ADD_TAG',
  SET_NOTE = 'SET_NOTE',
  LINK_SCHEDULE = 'LINK_SCHEDULE'
}

export interface RuleCondition {
  type: RuleConditionType
  operator: string
  value: string | number
}

export interface RuleAction {
  type: RuleActionType
  field?: string
  value: string | string[] | number
}

export interface AutomationRule {
  id: string
  name: string
  description?: string
  stage: 'PRE' | 'DEFAULT' | 'POST'
  conditions: RuleCondition[]
  actions: RuleAction[]
  priority: number
  isActive: boolean
  updated_at?: string // ISO 8601 Format
}

// Zusatzmodelle
export interface PlanningItem {
  id: string
  categoryId: string
  year: number
  month: number
  plannedAmount: number
}

export interface StatisticItem {
  year: number
  month: number
  categoryId: string
  amount: number
}

export interface BalanceInfo {
  balance: number
  date: Date
}

export interface Reconciliation {
  id: string
  accountId: string
  date: string
  balance: number
  note: string
  transactionIds: string[]
}

// Enums
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT = 'CREDIT',
  CASH = 'CASH'
}

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  ACCOUNTTRANSFER = 'ACCOUNTTRANSFER',
  CATEGORYTRANSFER = 'CATEGORYTRANSFER',
  RECONCILE = 'RECONCILE'
}

export enum AmountType {
  EXACT = 'EXACT',
  APPROXIMATE = 'APPROXIMATE',
  RANGE = 'RANGE'
}

export enum RecurrencePattern {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

export enum RecurrenceEndType {
  NEVER = 'NEVER',
  COUNT = 'COUNT',
  DATE = 'DATE'
}

export enum WeekendHandlingType {
  NONE = 'NONE',
  BEFORE = 'BEFORE',
  AFTER = 'AFTER'
}

// Entität-Interface
export interface Entity {
  id: string
  isActive: boolean
}

// WebSocket-bezogene Typen
export enum BackendStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  MAINTENANCE = 'maintenance',
  ERROR = 'error',
}

export interface WebSocketMessageBase {
  type: string;
}

export interface StatusMessage extends WebSocketMessageBase {
  type: 'status';
  status: BackendStatus;
  message?: string;
}

// Enums für DataUpdateNotificationMessage, basierend auf Backend-Definitionen
export enum EntityTypeEnum { // Umbenannt, um Konflikt mit dem Interface 'Entity' zu vermeiden
  ACCOUNT = 'Account',
  ACCOUNT_GROUP = 'AccountGroup',
  CATEGORY = 'Category',
  CATEGORY_GROUP = 'CategoryGroup',
  TRANSACTION = 'Transaction',
  PLANNING_TRANSACTION = 'PlanningTransaction',
  RECIPIENT = 'Recipient',
  TAG = 'Tag',
  RULE = 'Rule',
  // Weitere Entitätstypen hier bei Bedarf
}

// SyncOperationType ist bereits unten definiert und wird hier wiederverwendet.

// Payload-Typen für DataUpdateNotificationMessage
export interface DeletePayload {
  id: string;
}

// NotificationDataPayload ist eine Union der möglichen Datenstrukturen.
// Wir verwenden die bestehenden Interfaces Account, AccountGroup, Category, CategoryGroup und Recipient.
export type NotificationDataPayload = Account | AccountGroup | Category | CategoryGroup | Recipient | DeletePayload;

export interface DataUpdateNotificationMessage extends WebSocketMessageBase {
  type: 'data_update'; // type wurde im Backend als event_type bezeichnet, hier konsistent mit anderen Messages 'type'
  event_type: 'data_update'; // Behalten wir event_type für Kompatibilität mit Backend-Benennung
  tenant_id: string;
  entity_type: EntityTypeEnum;
  operation_type: SyncOperationType; // Wiederverwendung des bestehenden Enums
  data: NotificationDataPayload;
}

// Nachricht vom Client zum Server, um initiale Daten anzufordern
export interface RequestInitialDataMessage extends WebSocketMessageBase {
  type: 'request_initial_data';
  tenant_id: string;
}

// Payload für die Antwort des Servers mit den initialen Daten
export interface InitialDataPayload {
  accounts: Account[];
  account_groups: AccountGroup[];
  categories: Category[];
  category_groups: CategoryGroup[];
  recipients?: Recipient[];
  tags?: Tag[];
  automation_rules?: AutomationRule[];
  planning_transactions?: PlanningTransaction[];
  transactions?: Transaction[];
}

// Nachricht vom Server zum Client mit den initialen Daten
export interface InitialDataLoadMessage extends WebSocketMessageBase {
  type: 'initial_data_load'; // Unterscheidung von 'data_update'
  event_type: 'initial_data_load'; // Konsistent mit Backend-Schema
  tenant_id: string;
  payload: InitialDataPayload;
}

// Sync-Acknowledgment-Nachrichten vom Server
export interface SyncAckMessage extends WebSocketMessageBase {
  type: 'sync_ack';
  id: string; // SyncQueueEntry.id
  status: 'processed';
  entityId: string;
  entityType: EntityTypeEnum;
  operationType: SyncOperationType;
}

export interface SyncNackMessage extends WebSocketMessageBase {
  type: 'sync_nack';
  id: string; // SyncQueueEntry.id
  status: 'failed';
  entityId: string;
  entityType: EntityTypeEnum;
  operationType: SyncOperationType;
  reason: string; // Kurzer Grund für den Fehler
  detail?: string; // Detaillierte Fehlermeldung
}

// Neue Nachrichtentypen für erweiterte WebSocket-Funktionalität
export interface PongMessage extends WebSocketMessageBase {
  type: 'pong';
  timestamp?: number;
}

export interface ConnectionStatusResponseMessage extends WebSocketMessageBase {
  type: 'connection_status_response';
  tenant_id: string;
  backend_status: string;
  connection_healthy: boolean;
  stats: Record<string, any>;
}

export interface SystemNotificationMessage extends WebSocketMessageBase {
  type: 'system_notification';
  notification_type: string;
  message: string;
  timestamp: number;
}

export interface MaintenanceNotificationMessage extends WebSocketMessageBase {
  type: 'maintenance_notification';
  maintenance_enabled: boolean;
  message: string;
  timestamp: number;
}

// Union-Typ für alle möglichen WebSocket-Nachrichten vom Server
export type ServerWebSocketMessage = StatusMessage | DataUpdateNotificationMessage | InitialDataLoadMessage | SyncAckMessage | SyncNackMessage | DataStatusResponseMessage | PongMessage | ConnectionStatusResponseMessage | SystemNotificationMessage | MaintenanceNotificationMessage;

// Sync Queue Typen
export enum SyncOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  INITIAL_LOAD = 'initial_load', // Hinzugefügt für den initialen Ladevorgang
}

export enum SyncStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SYNCED = 'synced',
  FAILED = 'failed',
}

export interface SyncQueueEntry {
  id: string; // Eindeutige ID für den Queue-Eintrag (z.B. UUID)
  tenantId: string; // Mandanten-ID
  entityType: EntityTypeEnum; // Typ der Entität, Verwendung des neuen Enums
  entityId: string; // ID der betroffenen Entität
  operationType: SyncOperationType; // Art der Operation
  payload: Account | AccountGroup | Category | CategoryGroup | Transaction | Recipient | Tag | { id: string } | null; // Die Daten bei create/update, nur ID bei delete
  timestamp: number; // Zeitstempel der Änderung (Unix-Timestamp)
  status: SyncStatus; // Status des Sync-Eintrags
  attempts?: number; // Anzahl der Synchronisierungsversuche
  lastAttempt?: number; // Zeitstempel des letzten Versuchs
  error?: string; // Fehlermeldung bei Fehlschlag
}

// Erweiterte Sync-System Types für SyncButton und WebSocketService
export interface QueueStatistics {
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  lastSyncTime: number | null;
  oldestPendingTime: number | null;
  totalSyncedToday: number;
  averageSyncDuration: number;
  lastErrorMessage: string | null;
}

export interface SyncState {
  isAutoSyncEnabled: boolean;
  lastAutoSyncTime: number | null;
  nextAutoSyncTime: number | null;
  queueStatistics: QueueStatistics | null;
  syncInProgress: boolean;
  syncAnimationEndTime: number | null;
  periodicSyncInterval: number;
}

export interface ConflictReport {
  conflicts: Array<{
    entityType: string;
    entityId: string;
    localChecksum: string;
    serverChecksum: string;
    lastModified: {
      local: number;
      server: number;
    };
  }>;
  localOnly: Array<{
    entityType: string;
    entityId: string;
  }>;
  serverOnly: Array<{
    entityType: string;
    entityId: string;
  }>;
}

export interface DataStatusResponseMessage extends WebSocketMessageBase {
  type: 'data_status_response';
  tenant_id: string;
  entity_checksums: Record<string, Record<string, any>>;
  last_sync_time: number;
}

export interface SyncMetrics {
  id: string;
  tenantId: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  entitiesProcessed: number;
}
