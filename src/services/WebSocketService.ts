import { useSessionStore } from '@/stores/sessionStore';
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { infoLog, errorLog, debugLog, warnLog } from '@/utils/logger';
import { BackendStatus, type ServerWebSocketMessage, type StatusMessage, SyncStatus, type SyncQueueEntry, EntityTypeEnum, SyncOperationType, type DataUpdateNotificationMessage, type Account, type AccountGroup, type Category, type CategoryGroup, type Recipient, type Tag, type AutomationRule, type PlanningTransaction, type DeletePayload, type RequestInitialDataMessage, type InitialDataLoadMessage, type SyncAckMessage, type SyncNackMessage, type DataStatusResponseMessage, type PongMessage, type ConnectionStatusResponseMessage, type SystemNotificationMessage, type MaintenanceNotificationMessage, type TenantDisconnectMessage, type TenantDisconnectAckMessage } from '@/types';
import { watch } from 'vue';
import { TenantDbService } from './TenantDbService';
import { useTenantStore, type FinwiseTenantSpecificDB } from '@/stores/tenantStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { useTagStore } from '@/stores/tagStore';
import { useRuleStore } from '@/stores/ruleStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { mapToFrontendFormat, mapNotificationDataToFrontendFormat } from '@/utils/fieldMapping';

const RECONNECT_INTERVAL = 5000; // 5 Sekunden
const MAX_RECONNECT_ATTEMPTS = 10; // Erhöht von 5 auf 10
const LONG_TERM_RECONNECT_INTERVAL = 30000; // 30 Sekunden für langfristige Reconnects
const BACKEND_HEALTH_CHECK_INTERVAL = 15000; // 15 Sekunden für Backend-Health-Checks
const RECONNECT_INITIAL_INTERVAL = 1000; // ms
const RECONNECT_MAX_INTERVAL = 30000; // ms

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let explicitClose = false;
let isSyncProcessRunning = false; // Verhindert mehrfache Ausführung
let longTermReconnectTimer: NodeJS.Timeout | null = null;
let backendHealthCheckTimer: NodeJS.Timeout | null = null;
let isReconnecting = false;

let autoSyncInterval: NodeJS.Timeout | null = null;
let queueWatcher: (() => void) | null = null;
let isAutoSyncEnabled = true;
let pingIntervalId: NodeJS.Timeout | null = null;

const tenantDbService = new TenantDbService();

export const WebSocketService = {
  connect(): void {
    const sessionStore = useSessionStore();
    const webSocketStore = useWebSocketStore();

    // Detailliertes Logging für Verbindungsversuch
    infoLog('[WebSocketService]', 'connect() called', {
      currentSocketState: socket?.readyState,
      currentSocketUrl: socket?.url,
      tenantIdFromSession: sessionStore.currentTenantId,
      reconnectAttempts: reconnectAttempts,
      explicitClose: explicitClose,
      isReconnecting: isReconnecting
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      infoLog('[WebSocketService]', 'Already connected - skipping connection attempt', {
        socketUrl: socket.url,
        connectionStatus: webSocketStore.connectionStatus,
        backendStatus: webSocketStore.backendStatus
      });
      return;
    }

    if (!sessionStore.currentTenantId) {
      errorLog('[WebSocketService]', 'Cannot connect: Tenant ID is missing', {
        sessionStoreState: {
          currentTenantId: sessionStore.currentTenantId,
          currentUserId: sessionStore.currentUserId
        }
      });
      webSocketStore.setError('Tenant ID is missing for WebSocket connection.');
      webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
      return;
    }

    const tenantId = sessionStore.currentTenantId;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = (import.meta as any).env?.VITE_BACKEND_PORT || '8000';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws_finwise/ws/${tenantId}`;

    // Detailliertes Logging der Verbindungsparameter
    debugLog('[WebSocketService]', 'WebSocket connection parameters', {
      wsUrl: wsUrl,
      protocol: wsProtocol,
      host: wsHost,
      port: wsPort,
      tenantId: tenantId,
      currentLocation: window.location.href
    });

    explicitClose = false;
    webSocketStore.setConnectionStatus(WebSocketConnectionStatus.CONNECTING);
    infoLog('[WebSocketService]', `Initiating WebSocket connection to ${wsUrl}`, {
      attempt: reconnectAttempts + 1,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      connectionStatus: WebSocketConnectionStatus.CONNECTING
    });

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        const connectionTime = new Date().toISOString();
        infoLog('[WebSocketService]', 'WebSocket connection established successfully', {
          connectionTime: connectionTime,
          socketUrl: socket?.url,
          socketReadyState: socket?.readyState,
          previousReconnectAttempts: reconnectAttempts,
          wasReconnecting: isReconnecting,
          connectionDuration: isReconnecting ? `after ${reconnectAttempts} attempts` : 'first attempt'
        });

        // Status-Updates
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
        webSocketStore.setError(null);
        const previousAttempts = reconnectAttempts;
        reconnectAttempts = 0;
        isReconnecting = false;

        debugLog('[WebSocketService]', 'Connection state updated', {
          newConnectionStatus: WebSocketConnectionStatus.CONNECTED,
          errorCleared: true,
          reconnectAttemptsReset: `${previousAttempts} -> 0`,
          isReconnectingReset: false
        });

        // Heartbeat-Mechanismus starten
        this.startPingInterval();
        infoLog('[WebSocketService]', 'Heartbeat mechanism started', {
          pingInterval: '20 seconds',
          pingIntervalActive: pingIntervalId !== null
        });

        // Sync-Queue-Verarbeitung starten
        this.checkAndProcessSyncQueue();
        debugLog('[WebSocketService]', 'Sync queue processing triggered after connection establishment');
      };

      socket.onmessage = async (event) => { // async hinzugefügt
        // Loggen der rohen Nachricht direkt beim Empfang
        debugLog('[WebSocketService]', 'Raw message received from server:', event.data);
        try {
          const message = JSON.parse(event.data as string) as ServerWebSocketMessage;
          // Loggen der geparsten Nachricht
          // debugLog('[WebSocketService]', 'Parsed message received:', message);
          webSocketStore.setLastMessage(message);
          const tenantStore = useTenantStore(); // tenantStore Instanz
          const accountStore = useAccountStore(); // accountStore Instanz
          const categoryStore = useCategoryStore(); // categoryStore Instanz
          const recipientStore = useRecipientStore(); // recipientStore Instanz
          const tagStore = useTagStore(); // tagStore Instanz
          const ruleStore = useRuleStore(); // ruleStore Instanz
          const planningStore = usePlanningStore(); // planningStore Instanz

          // Nachrichtenbehandlung für Backend-Status
          if (message.type === 'status') {
            const statusMessage = message as StatusMessage; // Type assertion
            infoLog('[WebSocketService]', `Backend status update: ${statusMessage.status}`, { messageDetails: statusMessage });
            webSocketStore.setBackendStatus(statusMessage.status);
            // Prüfen, ob die Nachricht eine 'message'-Eigenschaft hat, falls es ein Fehler ist
            if (statusMessage.status === BackendStatus.ERROR && statusMessage.message) {
              errorLog('[WebSocketService]', `Received backend error status: ${statusMessage.message}`);
              webSocketStore.setError(`Backend error: ${statusMessage.message}`);
            }
            // Nach Backend-Status-Update prüfen, ob Sync gestartet werden soll
            this.checkAndProcessSyncQueue();
          } else if ('event_type' in message && message.event_type === 'data_update') { // event_type als primäres Kriterium
            const updateMessage = message as DataUpdateNotificationMessage;
            infoLog('[WebSocketService]', 'DataUpdateNotificationMessage received:', updateMessage);

            // Prüfen, ob die tenant_id mit dem aktiven Mandanten übereinstimmt
            if (updateMessage.tenant_id !== tenantStore.activeTenantId) {
              warnLog('[WebSocketService]', `Received DataUpdateNotification for tenant ${updateMessage.tenant_id}, but active tenant is ${tenantStore.activeTenantId}. Ignoring.`);
              return;
            }

            // Verarbeitung basierend auf entity_type und operation_type
            try {
              // Mappe die Daten vom Backend-Format zum Frontend-Format
              const mappedData = mapNotificationDataToFrontendFormat(updateMessage.data);

              switch (updateMessage.entity_type) {
                case EntityTypeEnum.ACCOUNT:
                  const accountData = mappedData.single_entity as Account | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await accountStore.addAccount(accountData as Account, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Account ${(accountData as Account).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await accountStore.updateAccount(accountData as Account, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Account ${(accountData as Account).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for Account ${accountData.id}`, {
                      accountData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await accountStore.deleteAccount(accountData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Account ${accountData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.ACCOUNT_GROUP:
                  const accountGroupData = mappedData.single_entity as AccountGroup | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await accountStore.addAccountGroup(accountGroupData as AccountGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AccountGroup ${(accountGroupData as AccountGroup).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await accountStore.updateAccountGroup(accountGroupData as AccountGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AccountGroup ${(accountGroupData as AccountGroup).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for AccountGroup ${accountGroupData.id}`, {
                      accountGroupData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await accountStore.deleteAccountGroup(accountGroupData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AccountGroup ${accountGroupData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.CATEGORY:
                  const categoryData = mappedData.single_entity as Category | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await categoryStore.addCategory(categoryData as Category, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Category ${(categoryData as Category).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await categoryStore.updateCategory(categoryData as Category, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Category ${(categoryData as Category).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for Category ${categoryData.id}`, {
                      categoryData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await categoryStore.deleteCategory(categoryData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Category ${categoryData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.CATEGORY_GROUP:
                  const categoryGroupData = mappedData.single_entity as CategoryGroup | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await categoryStore.addCategoryGroup(categoryGroupData as CategoryGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `CategoryGroup ${(categoryGroupData as CategoryGroup).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await categoryStore.updateCategoryGroup(categoryGroupData as CategoryGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `CategoryGroup ${(categoryGroupData as CategoryGroup).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for CategoryGroup ${categoryGroupData.id}`, {
                      categoryGroupData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await categoryStore.deleteCategoryGroup(categoryGroupData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `CategoryGroup ${categoryGroupData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.RECIPIENT:
                  const recipientData = mappedData.single_entity as Recipient | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await recipientStore.addRecipient(recipientData as Recipient, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Recipient ${(recipientData as Recipient).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await recipientStore.updateRecipient(recipientData as Recipient, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Recipient ${(recipientData as Recipient).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for Recipient ${recipientData.id}`, {
                      recipientData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await recipientStore.deleteRecipient(recipientData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Recipient ${recipientData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.TAG:
                  const tagData = mappedData.single_entity as Tag | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await tagStore.addTag(tagData as Tag, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Tag ${(tagData as Tag).name} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await tagStore.updateTag(tagData as Tag, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Tag ${(tagData as Tag).name} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for Tag ${tagData.id}`, {
                      tagData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await tagStore.deleteTag(tagData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Tag ${tagData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.RULE:
                  const ruleData = mappedData.single_entity as AutomationRule | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await ruleStore.addRule(ruleData as AutomationRule, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AutomationRule ${(ruleData as AutomationRule).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await ruleStore.updateRule((ruleData as AutomationRule).id, ruleData as AutomationRule, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AutomationRule ${(ruleData as AutomationRule).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for AutomationRule ${ruleData.id}`, {
                      ruleData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await ruleStore.deleteRule(ruleData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AutomationRule ${ruleData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.PLANNING_TRANSACTION:
                  const planningTransactionData = mappedData.single_entity as PlanningTransaction | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await planningStore.addPlanningTransaction(planningTransactionData as PlanningTransaction, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `PlanningTransaction ${(planningTransactionData as PlanningTransaction).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await planningStore.updatePlanningTransaction((planningTransactionData as PlanningTransaction).id, planningTransactionData as PlanningTransaction, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `PlanningTransaction ${(planningTransactionData as PlanningTransaction).id} updated via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for PlanningTransaction ${planningTransactionData.id}`, {
                      planningTransactionData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await planningStore.deletePlanningTransaction(planningTransactionData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `PlanningTransaction ${planningTransactionData.id} deleted via WebSocket.`);
                  }
                  break;
                case EntityTypeEnum.TRANSACTION:
                  const transactionStore = useTransactionStore();
                  const transactionData = mappedData.single_entity as any | DeletePayload; // Using any for ExtendedTransaction compatibility
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await transactionStore.addTransaction(transactionData as any, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Transaction ${(transactionData as any).id} created via WebSocket with recipientId: ${(transactionData as any).recipientId || 'none'}.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await transactionStore.updateTransaction((transactionData as any).id, transactionData as any, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Transaction ${(transactionData as any).id} updated via WebSocket with recipientId: ${(transactionData as any).recipientId || 'none'}.`);
                  } else if (updateMessage.operation_type === SyncOperationType.DELETE) {
                    debugLog('[WebSocketService]', `Processing DELETE for Transaction ${transactionData.id}`, {
                      transactionData,
                      tenant_id: updateMessage.tenant_id,
                      operation_type: updateMessage.operation_type
                    });
                    await transactionStore.deleteTransaction(transactionData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Transaction ${transactionData.id} deleted via WebSocket.`);
                  }
                  break;
                default:
                  warnLog('[WebSocketService]', `Unknown entity_type: ${updateMessage.entity_type}`);
              }
            } catch (e) {
              errorLog('[WebSocketService]', 'Error processing DataUpdateNotificationMessage:', e, updateMessage);
              // Hier könnte eine spezifischere Fehlerbehandlung erfolgen
            }
            // Loggen der geparsten Nachricht
            // debugLog('[WebSocketService]', 'Parsed message received:', message); // Bereits oben geloggt

            // Prüfe auf event_type, da das Backend dies für initial_data_load sendet
          } else if ('event_type' in message && message.event_type === 'initial_data_load') { // Type guard hinzugefügt
            const initialDataMessage = message as InitialDataLoadMessage; // Type assertion ist hier immer noch wichtig
            infoLog('[WebSocketService]', 'InitialDataLoadMessage received (matched on event_type):', initialDataMessage);

            if (initialDataMessage.tenant_id !== tenantStore.activeTenantId) {
              warnLog('[WebSocketService]', `Received InitialDataLoadMessage for tenant ${initialDataMessage.tenant_id}, but active tenant is ${tenantStore.activeTenantId}. Ignoring.`);
              return;
            }

            // Mappe die Initial-Data vom Backend-Format zum Frontend-Format
            const mappedPayload = mapNotificationDataToFrontendFormat(initialDataMessage.payload);

            const { accounts, account_groups, categories, category_groups, recipients, tags, automation_rules, planning_transactions, transactions } = mappedPayload;
            debugLog('[WebSocketService]', 'Initial data payload content:', { accounts, account_groups, categories, category_groups, recipients, tags, automation_rules, planning_transactions, transactions });

            // Hole pending DELETE-Operationen um zu vermeiden, dass gelöschte Entitäten wieder hinzugefügt werden
            const pendingDeletes = await this.getPendingDeleteOperations(tenantStore.activeTenantId!);
            const pendingAccountDeletes = new Set(pendingDeletes.accounts);
            const pendingGroupDeletes = new Set(pendingDeletes.accountGroups);
            const pendingCategoryDeletes = new Set(pendingDeletes.categories);
            const pendingCategoryGroupDeletes = new Set(pendingDeletes.categoryGroups);
            const pendingRecipientDeletes = new Set(pendingDeletes.recipients || []);
            const pendingTagDeletes = new Set(pendingDeletes.tags || []);

            if (accounts && accounts.length > 0) {
              infoLog('[WebSocketService]', `Processing ${accounts.length} initial accounts.`);
              for (const acc of accounts) {
                // Prüfe ob dieses Konto eine pending DELETE-Operation hat
                if (pendingAccountDeletes.has(acc.id)) {
                  warnLog('[WebSocketService]', `Skipping account ${acc.id} from initial load - pending DELETE operation exists`);
                  continue;
                }
                debugLog('[WebSocketService]', 'Attempting to add account from initial load:', acc);
                await accountStore.addAccount(acc, true); // fromSync = true
                infoLog('[WebSocketService]', `Account ${acc.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial accounts received or accounts array is empty.');
            }

            if (account_groups && account_groups.length > 0) {
              infoLog('[WebSocketService]', `Processing ${account_groups.length} initial account groups.`);
              for (const group of account_groups) {
                // Prüfe ob diese Gruppe eine pending DELETE-Operation hat
                if (pendingGroupDeletes.has(group.id)) {
                  warnLog('[WebSocketService]', `Skipping account group ${group.id} from initial load - pending DELETE operation exists`);
                  continue;
                }
                debugLog('[WebSocketService]', 'Attempting to add account group from initial load:', group);
                await accountStore.addAccountGroup(group, true); // fromSync = true
                infoLog('[WebSocketService]', `AccountGroup ${group.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial account groups received or accountGroups array is empty.');
            }

            if (categories && categories.length > 0) {
              infoLog('[WebSocketService]', `Processing ${categories.length} initial categories.`);
              for (const category of categories) {
                // Prüfe ob diese Kategorie eine pending DELETE-Operation hat
                if (pendingCategoryDeletes.has(category.id)) {
                  warnLog('[WebSocketService]', `Skipping category ${category.id} from initial load - pending DELETE operation exists`);
                  continue;
                }
                debugLog('[WebSocketService]', 'Attempting to add category from initial load:', category);
                await categoryStore.addCategory(category, true); // fromSync = true
                infoLog('[WebSocketService]', `Category ${category.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial categories received or categories array is empty.');
            }

            if (category_groups && category_groups.length > 0) {
              infoLog('[WebSocketService]', `Processing ${category_groups.length} initial category groups.`);
              for (const categoryGroup of category_groups) {
                // Prüfe ob diese Kategoriegruppe eine pending DELETE-Operation hat
                if (pendingCategoryGroupDeletes.has(categoryGroup.id)) {
                  warnLog('[WebSocketService]', `Skipping category group ${categoryGroup.id} from initial load - pending DELETE operation exists`);
                  continue;
                }
                debugLog('[WebSocketService]', 'Attempting to add category group from initial load:', categoryGroup);
                await categoryStore.addCategoryGroup(categoryGroup, true); // fromSync = true
                infoLog('[WebSocketService]', `CategoryGroup ${categoryGroup.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial category groups received or categoryGroups array is empty.');
            }

            if (recipients && recipients.length > 0) {
              infoLog('[WebSocketService]', `Processing ${recipients.length} initial recipients.`);
              for (const recipient of recipients) {
                // Prüfe ob dieser Empfänger eine pending DELETE-Operation hat
                if (pendingRecipientDeletes.has(recipient.id)) {
                  warnLog('[WebSocketService]', `Skipping recipient ${recipient.id} from initial load - pending DELETE operation exists`);
                  continue;
                }
                debugLog('[WebSocketService]', 'Attempting to add recipient from initial load:', recipient);
                await recipientStore.addRecipient(recipient, true); // fromSync = true
                infoLog('[WebSocketService]', `Recipient ${recipient.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial recipients received or recipients array is empty.');
            }

            if (tags && tags.length > 0) {
              infoLog('[WebSocketService]', `Processing ${tags.length} initial tags.`);
              for (const tag of tags) {
                // Prüfe ob dieser Tag eine pending DELETE-Operation hat
                if (pendingTagDeletes.has(tag.id)) {
                  warnLog('[WebSocketService]', `Skipping tag ${tag.id} from initial load - pending DELETE operation exists`);
                  continue;
                }
                debugLog('[WebSocketService]', 'Attempting to add tag from initial load:', tag);
                await tagStore.addTag(tag, true); // fromSync = true
                infoLog('[WebSocketService]', `Tag ${tag.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial tags received or tags array is empty.');
            }

            if (automation_rules && automation_rules.length > 0) {
              infoLog('[WebSocketService]', `Processing ${automation_rules.length} initial automation rules.`);
              for (const rule of automation_rules) {
                debugLog('[WebSocketService]', 'Attempting to add automation rule from initial load:', rule);
                await ruleStore.addRule(rule, true); // fromSync = true
                infoLog('[WebSocketService]', `AutomationRule ${rule.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial automation rules received or automation_rules array is empty.');
            }

            if (planning_transactions && planning_transactions.length > 0) {
              infoLog('[WebSocketService]', `Processing ${planning_transactions.length} initial planning transactions.`);
              for (const planningTransaction of planning_transactions) {
                debugLog('[WebSocketService]', 'Attempting to add planning transaction from initial load:', planningTransaction);
                await planningStore.addPlanningTransaction(planningTransaction, true); // fromSync = true
                infoLog('[WebSocketService]', `PlanningTransaction ${planningTransaction.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial planning transactions received or planning_transactions array is empty.');
            }

            if (transactions && transactions.length > 0) {
              const transactionStore = useTransactionStore();
              infoLog('[WebSocketService]', `Processing ${transactions.length} initial transactions with intelligent sync.`);

              // Aktiviere Batch-Modus im TransactionService für Performance-Optimierung
              const { TransactionService } = await import('../services/TransactionService');
              TransactionService.startBatchMode();

              try {
                // Intelligente Sync-Logik: Nur geänderte/neue Transaktionen verarbeiten
                const syncResult = await this.processTransactionsIntelligently(transactions, transactionStore);

                infoLog('[WebSocketService]', `Intelligent sync completed: ${syncResult.processed} processed, ${syncResult.skipped} skipped, ${syncResult.updated} updated from ${transactions.length} total transactions.`);
              } finally {
                // Beende Batch-Modus und löse finale UI-Updates aus
                TransactionService.endBatchMode();
                infoLog('[WebSocketService]', `Batch processing completed - reactive calculations triggered once.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial transactions received or transactions array is empty.');
            }
            infoLog('[WebSocketService]', 'Finished processing InitialDataLoadMessage.');
          } else if (message.type === 'sync_ack') {
            const ackMessage = message as SyncAckMessage;
            infoLog('[WebSocketService]', `Received sync_ack for entry ${ackMessage.id}`, ackMessage);
            await this.processSyncAck(ackMessage);
          } else if (message.type === 'sync_nack') {
            const nackMessage = message as SyncNackMessage;
            warnLog('[WebSocketService]', `Received sync_nack for entry ${nackMessage.id}`, nackMessage);
            await this.processSyncNack(nackMessage);
          } else if (message.type === 'data_status_response') {
            const statusResponse = message as DataStatusResponseMessage;
            infoLog('[WebSocketService]', 'Received data_status_response', statusResponse);
            await this.handleDataStatusResponse(statusResponse);
          } else if (message.type === 'pong') {
            const pongMessage = message as PongMessage;
            const pongReceiveTime = Date.now();
            const roundTripTime = pongMessage.timestamp ? pongReceiveTime - pongMessage.timestamp : null;

            debugLog('[WebSocketService]', 'Received pong response from server', {
              pongReceiveTime: pongReceiveTime,
              pongReceiveTimeISO: new Date(pongReceiveTime).toISOString(),
              serverTimestamp: pongMessage.timestamp,
              roundTripTimeMs: roundTripTime,
              connectionHealth: roundTripTime ? (roundTripTime < 1000 ? 'good' : roundTripTime < 3000 ? 'moderate' : 'poor') : 'unknown',
              message: pongMessage
            });

            // Pong-Antworten für Connection-Health-Tracking verwenden
            if (roundTripTime !== null) {
              if (roundTripTime > 5000) {
                warnLog('[WebSocketService]', 'High ping latency detected', {
                  roundTripTimeMs: roundTripTime,
                  connectionQuality: 'poor',
                  threshold: '5000ms'
                });
              }
            }
          } else if (message.type === 'connection_status_response') {
            infoLog('[WebSocketService]', 'Received connection_status_response', message);
            // Verbindungsstatus-Antworten verarbeiten
          } else if (message.type === 'system_notification') {
            infoLog('[WebSocketService]', 'Received system notification', message);
            // System-Benachrichtigungen verarbeiten
          } else if (message.type === 'maintenance_notification') {
            warnLog('[WebSocketService]', 'Received maintenance notification', message);
            // Wartungsbenachrichtigungen verarbeiten
          } else if (message.type === 'tenant_disconnect_ack') {
            const ackMessage = message as TenantDisconnectAckMessage;
            infoLog('[WebSocketService]', 'Received tenant_disconnect_ack', ackMessage);
            await this.processTenantDisconnectAck(ackMessage);
          }

        } catch (e) {
          errorLog('[WebSocketService]', 'Error parsing message from server:', e, event.data);
          // Prüfen, ob es sich um eine Textnachricht handelt (z.B. Fehlermeldung)
          if (typeof event.data === 'string' && !event.data.startsWith('{')) {
            warnLog('[WebSocketService]', 'Received non-JSON message from server:', event.data);
            // Textnachrichten nicht als kritische Fehler behandeln
            return;
          }
          webSocketStore.setError('Error parsing message from server.');
          // Bei einem echten JSON-Parse-Fehler den Backend-Status auf ERROR setzen
          webSocketStore.setBackendStatus(BackendStatus.ERROR);
        }
      };

      socket.onerror = (errorEvent) => {
        const errorTime = new Date().toISOString();
        errorLog('[WebSocketService]', 'WebSocket error occurred', {
          errorTime: errorTime,
          errorEvent: {
            type: errorEvent.type,
            target: errorEvent.target ? {
              readyState: (errorEvent.target as WebSocket).readyState,
              url: (errorEvent.target as WebSocket).url
            } : null
          },
          socketState: {
            readyState: socket?.readyState,
            url: socket?.url
          },
          connectionContext: {
            wsUrl: wsUrl,
            tenantId: tenantId,
            reconnectAttempts: reconnectAttempts,
            isReconnecting: isReconnecting,
            explicitClose: explicitClose
          },
          previousConnectionStatus: webSocketStore.connectionStatus,
          previousBackendStatus: webSocketStore.backendStatus
        });

        webSocketStore.setError('WebSocket connection error.');
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);

        debugLog('[WebSocketService]', 'Error state updated', {
          newConnectionStatus: WebSocketConnectionStatus.ERROR,
          errorMessage: 'WebSocket connection error.',
          backendStatusWillBeSetToOffline: true
        });
      };

      socket.onclose = (closeEvent) => {
        const closeTime = new Date().toISOString();
        const closeDetails = {
          closeTime: closeTime,
          closeCode: closeEvent.code,
          closeReason: closeEvent.reason || 'No reason provided',
          wasClean: closeEvent.wasClean,
          explicitClose: explicitClose,
          socketUrl: socket?.url
        };

        // Detailliertes Logging basierend auf Close-Code
        if (closeEvent.code === 1000) {
          infoLog('[WebSocketService]', 'WebSocket closed normally', closeDetails);
        } else if (closeEvent.code === 1001) {
          warnLog('[WebSocketService]', 'WebSocket closed - endpoint going away', closeDetails);
        } else if (closeEvent.code === 1006) {
          errorLog('[WebSocketService]', 'WebSocket closed abnormally - connection lost', closeDetails);
        } else if (closeEvent.code >= 4000) {
          errorLog('[WebSocketService]', 'WebSocket closed with custom error code', closeDetails);
        } else {
          warnLog('[WebSocketService]', 'WebSocket closed with standard code', closeDetails);
        }

        // Status-Updates
        const previousConnectionStatus = webSocketStore.connectionStatus;
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);

        debugLog('[WebSocketService]', 'Connection status updated after close', {
          previousStatus: previousConnectionStatus,
          newStatus: WebSocketConnectionStatus.DISCONNECTED,
          backendStatusWillBeSetToOffline: true
        });

        // Heartbeat-Mechanismus stoppen
        this.stopPingInterval();
        infoLog('[WebSocketService]', 'Heartbeat mechanism stopped after connection close', {
          pingIntervalWasActive: pingIntervalId !== null
        });

        socket = null;
        debugLog('[WebSocketService]', 'Socket reference cleared');

        // Reconnection-Logik
        if (!explicitClose) {
          infoLog('[WebSocketService]', 'Connection closed unexpectedly - initiating reconnection', {
            willReconnect: true,
            currentReconnectAttempts: reconnectAttempts,
            maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
          });
          this.handleReconnection();
        } else {
          infoLog('[WebSocketService]', 'Connection closed explicitly - no reconnection', {
            willReconnect: false,
            explicitClose: true
          });
        }
      };
    } catch (error) {
      errorLog('[WebSocketService]', 'Failed to create WebSocket:', error);
      webSocketStore.setError('Failed to create WebSocket connection.');
      webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
      // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
    }
  },

  disconnect(): void {
    const disconnectTime = new Date().toISOString();

    infoLog('[WebSocketService]', 'Initiating explicit WebSocket disconnection', {
      disconnectTime: disconnectTime,
      socketExists: socket !== null,
      socketState: socket?.readyState || 'null',
      socketUrl: socket?.url,
      explicitClose: explicitClose
    });

    if (socket) {
      infoLog('[WebSocketService]', 'Closing WebSocket connection explicitly', {
        socketReadyState: socket.readyState,
        socketUrl: socket.url,
        willSetExplicitClose: true
      });
      explicitClose = true;
      socket.close();
      debugLog('[WebSocketService]', 'WebSocket close() method called', {
        explicitClose: true,
        closeInitiatedAt: disconnectTime
      });
    } else {
      debugLog('[WebSocketService]', 'No active socket to disconnect', {
        socketExists: false,
        explicitClose: explicitClose
      });
    }

    // Heartbeat-Mechanismus stoppen
    this.stopPingInterval();
    infoLog('[WebSocketService]', 'Heartbeat mechanism stopped during disconnect', {
      pingIntervalStopped: true
    });

    // Stoppe alle Reconnection-Timer
    this.stopReconnectionTimers();
    infoLog('[WebSocketService]', 'All reconnection timers stopped during disconnect', {
      reconnectionTimersStopped: true,
      disconnectComplete: true
    });

    debugLog('[WebSocketService]', 'Explicit disconnect completed', {
      disconnectTime: disconnectTime,
      explicitClose: explicitClose,
      socketClosed: socket !== null,
      timersCleared: true
    });
  },

  stopReconnectionTimers(): void {
    const stopTime = new Date().toISOString();

    debugLog('[WebSocketService]', 'Stopping all reconnection timers', {
      stopTime: stopTime,
      longTermTimerActive: longTermReconnectTimer !== null,
      healthCheckTimerActive: backendHealthCheckTimer !== null,
      isCurrentlyReconnecting: isReconnecting
    });

    if (longTermReconnectTimer) {
      infoLog('[WebSocketService]', 'Clearing long-term reconnection timer', {
        timerWasActive: true,
        stopTime: stopTime
      });
      clearTimeout(longTermReconnectTimer);
      longTermReconnectTimer = null;
    } else {
      debugLog('[WebSocketService]', 'No long-term reconnection timer to clear', {
        timerWasActive: false
      });
    }

    if (backendHealthCheckTimer) {
      infoLog('[WebSocketService]', 'Clearing backend health check timer', {
        timerWasActive: true,
        stopTime: stopTime
      });
      clearInterval(backendHealthCheckTimer);
      backendHealthCheckTimer = null;
    } else {
      debugLog('[WebSocketService]', 'No backend health check timer to clear', {
        timerWasActive: false
      });
    }

    const wasReconnecting = isReconnecting;
    isReconnecting = false;

    debugLog('[WebSocketService]', 'Reconnection timers cleanup completed', {
      stopTime: stopTime,
      longTermReconnectTimer: null,
      backendHealthCheckTimer: null,
      isReconnecting: `${wasReconnecting} -> false`,
      allTimersCleared: true
    });
  },

  handleReconnection(): void {
    const reconnectionStartTime = new Date().toISOString();

    if (isReconnecting) {
      debugLog('[WebSocketService]', 'Reconnection already in progress - skipping duplicate attempt', {
        currentReconnectAttempts: reconnectAttempts,
        isReconnecting: true,
        skipReason: 'Duplicate reconnection attempt'
      });
      return;
    }

    debugLog('[WebSocketService]', 'Starting reconnection process', {
      reconnectionStartTime: reconnectionStartTime,
      currentAttempts: reconnectAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
      previousSocketState: socket?.readyState || 'null'
    });

    isReconnecting = true;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;

      // Exponential-Backoff-Strategie: Intervall bei jedem Versuch verdoppeln
      const currentInterval = Math.min(
        RECONNECT_INITIAL_INTERVAL * Math.pow(2, reconnectAttempts - 1),
        RECONNECT_MAX_INTERVAL
      );

      infoLog('[WebSocketService]', `Scheduling reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`, {
        attemptNumber: reconnectAttempts,
        totalAttempts: MAX_RECONNECT_ATTEMPTS,
        delayMs: currentInterval,
        delaySeconds: Math.round(currentInterval / 1000),
        exponentialBackoffFormula: `${RECONNECT_INITIAL_INTERVAL} * 2^${reconnectAttempts - 1}`,
        maxInterval: RECONNECT_MAX_INTERVAL,
        scheduledTime: new Date(Date.now() + currentInterval).toISOString()
      });

      setTimeout(() => {
        debugLog('[WebSocketService]', `Executing reconnection attempt ${reconnectAttempts}`, {
          executionTime: new Date().toISOString(),
          attemptNumber: reconnectAttempts,
          wasScheduledFor: currentInterval + 'ms ago'
        });
        isReconnecting = false;
        this.connect();
      }, currentInterval);
    } else {
      // Nach MAX_RECONNECT_ATTEMPTS wechseln zu langfristiger Reconnection-Strategie
      warnLog('[WebSocketService]', 'Maximum short-term reconnection attempts reached', {
        totalAttempts: reconnectAttempts,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
        nextStrategy: 'long-term reconnection',
        longTermInterval: LONG_TERM_RECONNECT_INTERVAL,
        willStartHealthChecks: true
      });
      this.startLongTermReconnection();
    }
  },

  startLongTermReconnection(): void {
    const longTermStartTime = new Date().toISOString();

    infoLog('[WebSocketService]', 'Initiating long-term reconnection strategy', {
      startTime: longTermStartTime,
      strategy: 'long-term',
      interval: LONG_TERM_RECONNECT_INTERVAL,
      intervalSeconds: LONG_TERM_RECONNECT_INTERVAL / 1000,
      willStartHealthChecks: true,
      previousShortTermAttempts: reconnectAttempts
    });

    // Starte Backend-Health-Checks
    this.startBackendHealthChecks();

    // Langfristige Reconnection-Versuche alle 30 Sekunden
    longTermReconnectTimer = setInterval(() => {
      const attemptTime = new Date().toISOString();

      if (!explicitClose && (!socket || socket.readyState !== WebSocket.OPEN)) {
        infoLog('[WebSocketService]', 'Executing long-term reconnection attempt', {
          attemptTime: attemptTime,
          socketState: socket?.readyState || 'null',
          explicitClose: explicitClose,
          willResetCounters: true,
          strategy: 'long-term periodic'
        });

        isReconnecting = false; // Reset für neuen Versuch
        const previousAttempts = reconnectAttempts;
        reconnectAttempts = 0; // Reset der Versuche für neue Runde

        debugLog('[WebSocketService]', 'Long-term reconnection state reset', {
          isReconnecting: false,
          reconnectAttempts: `${previousAttempts} -> 0`,
          reason: 'Starting fresh reconnection cycle'
        });

        this.connect();
      } else {
        debugLog('[WebSocketService]', 'Long-term reconnection check - no action needed', {
          checkTime: attemptTime,
          explicitClose: explicitClose,
          socketState: socket?.readyState || 'null',
          reason: explicitClose ? 'Explicit close' : 'Socket already connected'
        });
      }
    }, LONG_TERM_RECONNECT_INTERVAL);

    debugLog('[WebSocketService]', 'Long-term reconnection timer started', {
      timerId: longTermReconnectTimer ? 'active' : 'failed',
      intervalMs: LONG_TERM_RECONNECT_INTERVAL
    });
  },

  startBackendHealthChecks(): void {
    const healthCheckStartTime = new Date().toISOString();

    if (backendHealthCheckTimer) {
      debugLog('[WebSocketService]', 'Clearing existing backend health check timer before starting new one');
      clearInterval(backendHealthCheckTimer);
    }

    infoLog('[WebSocketService]', 'Starting backend health checks', {
      startTime: healthCheckStartTime,
      interval: BACKEND_HEALTH_CHECK_INTERVAL,
      intervalSeconds: BACKEND_HEALTH_CHECK_INTERVAL / 1000,
      purpose: 'Monitor backend availability during long-term reconnection'
    });

    backendHealthCheckTimer = setInterval(async () => {
      const healthCheckTime = new Date().toISOString();

      if (explicitClose) {
        debugLog('[WebSocketService]', 'Skipping health check - explicit close requested', {
          healthCheckTime: healthCheckTime,
          explicitClose: true
        });
        return;
      }

      try {
        // Prüfe Backend-Verfügbarkeit über HTTP
        const wsHost = window.location.hostname;
        const wsPort = (import.meta as any).env?.VITE_BACKEND_PORT || '8000';
        const healthUrl = `${window.location.protocol}//${wsHost}:${wsPort}/api/v1/websocket/health`;

        debugLog('[WebSocketService]', 'Executing backend health check', {
          healthCheckTime: healthCheckTime,
          healthUrl: healthUrl,
          timeout: 5000,
          currentSocketState: socket?.readyState || 'null'
        });

        const healthCheckStart = Date.now();
        const response = await fetch(healthUrl, {
          method: 'GET',
          timeout: 5000
        } as RequestInit);
        const healthCheckDuration = Date.now() - healthCheckStart;

        if (response.ok) {
          const healthData = await response.json();
          infoLog('[WebSocketService]', 'Backend health check successful', {
            healthCheckTime: healthCheckTime,
            responseTime: healthCheckDuration,
            status: response.status,
            statusText: response.statusText,
            healthData: healthData,
            backendAvailable: true
          });

          // Wenn Backend verfügbar ist, aber WebSocket nicht verbunden, versuche Reconnection
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            infoLog('[WebSocketService]', 'Backend healthy but WebSocket disconnected - triggering reconnection', {
              backendHealthy: true,
              socketState: socket?.readyState || 'null',
              willReconnect: true,
              reconnectionReason: 'Backend available but WebSocket disconnected'
            });

            isReconnecting = false;
            const previousAttempts = reconnectAttempts;
            reconnectAttempts = 0;

            debugLog('[WebSocketService]', 'Resetting reconnection state for health-check-triggered reconnection', {
              isReconnecting: false,
              reconnectAttempts: `${previousAttempts} -> 0`,
              reason: 'Backend health check successful'
            });

            this.connect();
          } else {
            debugLog('[WebSocketService]', 'Backend healthy and WebSocket connected - no action needed', {
              backendHealthy: true,
              socketState: socket.readyState,
              socketConnected: true
            });
          }
        } else {
          warnLog('[WebSocketService]', 'Backend health check returned non-OK status', {
            healthCheckTime: healthCheckTime,
            responseTime: healthCheckDuration,
            status: response.status,
            statusText: response.statusText,
            backendAvailable: false,
            url: healthUrl
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnLog('[WebSocketService]', 'Backend health check failed', {
          healthCheckTime: healthCheckTime,
          error: errorMessage,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          backendAvailable: false,
          healthUrl: `${window.location.protocol}//${window.location.hostname}:${(import.meta as any).env?.VITE_BACKEND_PORT || '8000'}/api/v1/websocket/health`,
          willRetryIn: `${BACKEND_HEALTH_CHECK_INTERVAL / 1000} seconds`
        });
      }
    }, BACKEND_HEALTH_CHECK_INTERVAL);

    debugLog('[WebSocketService]', 'Backend health check timer created', {
      timerId: backendHealthCheckTimer ? 'active' : 'failed',
      intervalMs: BACKEND_HEALTH_CHECK_INTERVAL
    });
  },

  sendMessage(message: unknown): boolean {
    const sendTime = new Date().toISOString();
    const webSocketStore = useWebSocketStore();

    // Detailliertes Logging für Nachrichtenversand
    debugLog('[WebSocketService]', 'Attempting to send message', {
      sendTime: sendTime,
      messageType: (message as any)?.type || 'unknown',
      socketExists: socket !== null,
      socketState: socket?.readyState || 'null',
      socketUrl: socket?.url,
      connectionStatus: webSocketStore.connectionStatus,
      backendStatus: webSocketStore.backendStatus
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const jsonMessage = JSON.stringify(message);
        const messageSize = new Blob([jsonMessage]).size;

        socket.send(jsonMessage);

        debugLog('[WebSocketService]', 'Message sent successfully', {
          sendTime: sendTime,
          messageType: (message as any)?.type || 'unknown',
          messageSize: messageSize,
          messageSizeKB: Math.round(messageSize / 1024 * 100) / 100,
          socketState: socket.readyState,
          success: true
        });

        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errorLog('[WebSocketService]', 'Error sending message', {
          sendTime: sendTime,
          error: errorMessage,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          messageType: (message as any)?.type || 'unknown',
          socketState: socket?.readyState || 'null',
          message: message
        });
        webSocketStore.setError('Error sending message.');
        return false;
      }
    } else {
      const socketStateText = socket ?
        (socket.readyState === WebSocket.CONNECTING ? 'CONNECTING' :
          socket.readyState === WebSocket.CLOSING ? 'CLOSING' :
            socket.readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN') : 'NULL';

      errorLog('[WebSocketService]', 'Cannot send message - WebSocket not ready', {
        sendTime: sendTime,
        messageType: (message as any)?.type || 'unknown',
        socketExists: socket !== null,
        socketState: socket?.readyState || 'null',
        socketStateText: socketStateText,
        connectionStatus: webSocketStore.connectionStatus,
        backendStatus: webSocketStore.backendStatus,
        reason: 'WebSocket not in OPEN state'
      });
      webSocketStore.setError('Cannot send message: WebSocket is not connected.');
      return false;
    }
  },

  sendPing(): boolean {
    const pingTimestamp = Date.now();
    const pingMessage = {
      type: 'ping',
      timestamp: pingTimestamp
    };

    debugLog('[WebSocketService]', 'Sending ping to server', {
      pingTimestamp: pingTimestamp,
      pingTime: new Date(pingTimestamp).toISOString(),
      socketState: socket?.readyState,
      socketUrl: socket?.url,
      messageType: 'ping'
    });

    const success = this.sendMessage(pingMessage);

    if (success) {
      debugLog('[WebSocketService]', 'Ping sent successfully', {
        pingTimestamp: pingTimestamp,
        sentAt: new Date().toISOString()
      });
    } else {
      warnLog('[WebSocketService]', 'Failed to send ping', {
        pingTimestamp: pingTimestamp,
        failedAt: new Date().toISOString(),
        socketState: socket?.readyState,
        reason: 'WebSocket not ready or send failed'
      });
    }

    return success;
  },

  startPingInterval(): void {
    const startTime = new Date().toISOString();
    const pingIntervalMs = 20000; // 20 Sekunden

    infoLog('[WebSocketService]', 'Starting heartbeat ping interval', {
      startTime: startTime,
      intervalMs: pingIntervalMs,
      intervalSeconds: pingIntervalMs / 1000,
      previousIntervalActive: pingIntervalId !== null
    });

    this.stopPingInterval(); // Stoppe vorhandenes Intervall falls vorhanden

    pingIntervalId = setInterval(() => {
      const pingAttemptTime = new Date().toISOString();

      debugLog('[WebSocketService]', 'Heartbeat ping interval triggered', {
        pingAttemptTime: pingAttemptTime,
        socketState: socket?.readyState,
        connectionStatus: useWebSocketStore().connectionStatus
      });

      const pingSuccess = this.sendPing();

      if (pingSuccess) {
        debugLog('[WebSocketService]', 'Heartbeat ping completed successfully', {
          pingTime: pingAttemptTime,
          success: true
        });
      } else {
        warnLog('[WebSocketService]', 'Heartbeat ping failed', {
          pingTime: pingAttemptTime,
          success: false,
          socketState: socket?.readyState,
          reason: 'WebSocket not ready or send operation failed'
        });
      }
    }, pingIntervalMs);

    debugLog('[WebSocketService]', 'Ping interval timer created', {
      timerId: pingIntervalId ? 'active' : 'failed',
      intervalMs: pingIntervalMs
    });
  },

  stopPingInterval(): void {
    const stopTime = new Date().toISOString();

    if (pingIntervalId) {
      infoLog('[WebSocketService]', 'Stopping heartbeat ping interval', {
        stopTime: stopTime,
        intervalWasActive: true,
        timerId: 'cleared'
      });
      clearInterval(pingIntervalId);
      pingIntervalId = null;

      debugLog('[WebSocketService]', 'Ping interval cleared successfully', {
        pingIntervalId: null,
        stopTime: stopTime
      });
    } else {
      debugLog('[WebSocketService]', 'Ping interval stop requested but no active interval', {
        stopTime: stopTime,
        intervalWasActive: false,
        pingIntervalId: null
      });
    }
  },

  requestConnectionStatus(): boolean {
    const statusRequest = {
      type: 'connection_status_request'
    };
    return this.sendMessage(statusRequest);
  },

  // Hilfsfunktion, um den aktuellen Verbindungsstatus zu bekommen (optional)
  getConnectionStatus(): WebSocketConnectionStatus {
    return useWebSocketStore().connectionStatus;
  },
  // Hilfsfunktion, um den aktuellen Backend-Status zu bekommen (optional)
  getBackendStatus(): BackendStatus {
    return useWebSocketStore().backendStatus;
  },

  requestInitialData(tenantId: string): void {
    const webSocketStore = useWebSocketStore();
    if (socket && socket.readyState === WebSocket.OPEN && webSocketStore.backendStatus === BackendStatus.ONLINE) {
      infoLog('[WebSocketService]', `Requesting initial data for tenant ${tenantId}`);
      const message: RequestInitialDataMessage = {
        type: 'request_initial_data',
        tenant_id: tenantId,
      };
      this.sendMessage(message);
    } else {
      warnLog('[WebSocketService]', 'Cannot request initial data immediately - WebSocket not ready. Will retry when connection is established.', {
        connected: socket?.readyState === WebSocket.OPEN,
        backendStatus: webSocketStore.backendStatus,
        tenantId: tenantId
      });

      // Retry-Mechanismus: Versuche es in 1 Sekunde erneut
      setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN && webSocketStore.backendStatus === BackendStatus.ONLINE) {
          infoLog('[WebSocketService]', `Retrying initial data request for tenant ${tenantId}`);
          const retryMessage: RequestInitialDataMessage = {
            type: 'request_initial_data',
            tenant_id: tenantId,
          };
          this.sendMessage(retryMessage);
        } else {
          errorLog('[WebSocketService]', `Failed to request initial data for tenant ${tenantId} after retry`, {
            connected: socket?.readyState === WebSocket.OPEN,
            backendStatus: webSocketStore.backendStatus,
          });
        }
      }, 1000);
    }
  },

  async processSyncQueue(): Promise<void> {
    if (isSyncProcessRunning) {
      debugLog('[WebSocketService]', 'Sync process already running.');
      return;
    }
    isSyncProcessRunning = true;
    infoLog('[WebSocketService]', 'Starting to process sync queue...');

    const webSocketStore = useWebSocketStore();
    debugLog('[WebSocketService]', 'Sync queue processing started', {
      connectionStatus: webSocketStore.connectionStatus,
      backendStatus: webSocketStore.backendStatus,
      socketReadyState: socket?.readyState,
      socketUrl: socket?.url
    });
    const tenantStore = useTenantStore();
    const currentTenantId = tenantStore.activeTenantId;

    if (!currentTenantId) {
      warnLog('[WebSocketService]', 'Cannot process sync queue: No active tenant ID.');
      isSyncProcessRunning = false;
      return;
    }

    const activeDB = tenantStore.activeTenantDB as FinwiseTenantSpecificDB | null;
    if (!activeDB) {
      warnLog('[WebSocketService]', 'Cannot process sync queue: No active tenant DB.');
      isSyncProcessRunning = false;
      return;
    }

    if (webSocketStore.connectionStatus !== WebSocketConnectionStatus.CONNECTED || webSocketStore.backendStatus !== BackendStatus.ONLINE) {
      infoLog('[WebSocketService]', 'Cannot process sync queue: Not connected or backend not online.');
      isSyncProcessRunning = false;
      return;
    }

    try {
      // Schritt 1: Alle pending Einträge abrufen
      const allPendingEntries = await activeDB.transaction('r', activeDB.syncQueue, async (tx) => {
        const syncQueueTable = tx.table<SyncQueueEntry, string>('syncQueue');
        return await syncQueueTable
          .where({ tenantId: currentTenantId, status: SyncStatus.PENDING })
          .sortBy('timestamp');
      });

      if (allPendingEntries.length === 0) {
        infoLog('[WebSocketService]', 'No pending entries in sync queue.');
        isSyncProcessRunning = false;
        return;
      }

      infoLog('[WebSocketService]', `Found ${allPendingEntries.length} pending entries. Starting chunked processing.`);

      // Schritt 2: Paketbasierte Verarbeitung (30 Einträge pro Paket)
      const CHUNK_SIZE = 30;
      const chunks = this.chunkArray(allPendingEntries, CHUNK_SIZE);

      infoLog('[WebSocketService]', `Processing ${chunks.length} chunks of max ${CHUNK_SIZE} entries each.`);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        infoLog('[WebSocketService]', `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} entries.`);

        // Schritt 2a: Chunk-Einträge als PROCESSING markieren
        const entriesToProcess = await activeDB.transaction('rw', activeDB.syncQueue, async (tx) => {
          const syncQueueTable = tx.table<SyncQueueEntry, string>('syncQueue');
          const processingPromises = chunk.map(async (entry) => {
            await syncQueueTable.update(entry.id, {
              status: SyncStatus.PROCESSING,
              attempts: (entry.attempts ?? 0) + 1,
              lastAttempt: Date.now(),
            });
            return {
              ...entry,
              status: SyncStatus.PROCESSING,
              attempts: (entry.attempts ?? 0) + 1,
              lastAttempt: Date.now(),
            };
          });
          return await Promise.all(processingPromises);
        });

        // Schritt 2b: Chunk senden
        await this.processSyncChunk(entriesToProcess);

        // Schritt 2c: Auf ACK/NACK für alle Einträge des Chunks warten
        const success = await this.waitForChunkAcknowledgment(entriesToProcess);

        if (!success) {
          warnLog('[WebSocketService]', `Chunk ${chunkIndex + 1} processing failed or timed out. Stopping further processing.`);
          break;
        }

        infoLog('[WebSocketService]', `Chunk ${chunkIndex + 1}/${chunks.length} processed successfully.`);

        // Kurze Pause zwischen Chunks
        if (chunkIndex < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

    } catch (error) {
      errorLog('[WebSocketService]', 'Error processing sync queue with chunked approach:', error);
    } finally {
      isSyncProcessRunning = false;
      infoLog('[WebSocketService]', 'Finished processing sync queue attempt.');
    }
  },

  /**
   * Teilt ein Array in Chunks der angegebenen Größe auf
   */
  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  },

  /**
   * Verarbeitet einen einzelnen Chunk von Sync-Einträgen
   */
  async processSyncChunk(entries: SyncQueueEntry[]): Promise<void> {
    const transactionEntries = entries.filter(entry => entry.entityType === EntityTypeEnum.TRANSACTION);
    const otherEntries = entries.filter(entry => entry.entityType !== EntityTypeEnum.TRANSACTION);

    // Verarbeite Transaction-Einträge im Batch-Modus
    if (transactionEntries.length > 0) {
      debugLog('[WebSocketService]', `Processing ${transactionEntries.length} transaction entries in chunk.`);
      const transactionStore = useTransactionStore();
      transactionStore.startBatchUpdate();

      try {
        for (const entry of transactionEntries) {
          const messageToSend = { type: 'process_sync_entry', payload: entry };
          debugLog('[WebSocketService]', `Sending transaction sync entry ${entry.id} to backend.`);
          const sent = this.sendMessage(messageToSend);
          if (!sent) {
            errorLog('[WebSocketService]', `Failed to send sync entry ${entry.id}. It will be retried later.`);
            await tenantDbService.updateSyncQueueEntryStatus(entry.id, SyncStatus.PENDING, 'Failed to send to WebSocket');
          }
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } finally {
        transactionStore.endBatchUpdate();
      }
    }

    // Verarbeite andere Einträge normal
    for (const entry of otherEntries) {
      const messageToSend = { type: 'process_sync_entry', payload: entry };
      debugLog('[WebSocketService]', `Sending sync entry ${entry.id} (${entry.entityType} ${entry.operationType}) to backend.`);
      const sent = this.sendMessage(messageToSend);
      if (!sent) {
        errorLog('[WebSocketService]', `Failed to send sync entry ${entry.id}. It will be retried later.`);
        await tenantDbService.updateSyncQueueEntryStatus(entry.id, SyncStatus.PENDING, 'Failed to send to WebSocket');
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  },

  /**
   * Wartet auf ACK/NACK für alle Einträge eines Chunks
   */
  async waitForChunkAcknowledgment(entries: SyncQueueEntry[]): Promise<boolean> {
    const TIMEOUT_MS = 30000; // 30 Sekunden Timeout pro Chunk
    const CHECK_INTERVAL_MS = 500; // Alle 500ms prüfen

    const entryIds = new Set(entries.map(entry => entry.id));
    const startTime = Date.now();

    infoLog('[WebSocketService]', `Waiting for acknowledgment of ${entryIds.size} entries...`);

    while (entryIds.size > 0 && (Date.now() - startTime) < TIMEOUT_MS) {
      // Prüfe welche Einträge noch in der Queue sind (nicht ACK'd)
      const tenantStore = useTenantStore();
      const activeDB = tenantStore.activeTenantDB as FinwiseTenantSpecificDB | null;

      if (!activeDB) {
        errorLog('[WebSocketService]', 'No active DB during acknowledgment wait.');
        return false;
      }

      try {
        const remainingEntries = await activeDB.syncQueue
          .where('id')
          .anyOf([...entryIds])
          .toArray();

        // Entferne ACK'd Einträge aus der Warteliste
        const remainingIds = new Set(remainingEntries.map(entry => entry.id));
        const acknowledgedCount = entryIds.size - remainingIds.size;

        if (acknowledgedCount > 0) {
          debugLog('[WebSocketService]', `${acknowledgedCount} entries acknowledged, ${remainingIds.size} still waiting.`);
        }

        // Aktualisiere die Warteliste
        entryIds.clear();
        remainingIds.forEach(id => entryIds.add(id));

        if (entryIds.size === 0) {
          infoLog('[WebSocketService]', 'All entries in chunk acknowledged successfully.');
          return true;
        }

        // Warte vor nächster Prüfung
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));

      } catch (error) {
        errorLog('[WebSocketService]', 'Error checking acknowledgment status:', error);
        return false;
      }
    }

    if (entryIds.size > 0) {
      warnLog('[WebSocketService]', `Timeout waiting for acknowledgment. ${entryIds.size} entries not acknowledged.`, {
        timeoutMs: TIMEOUT_MS,
        remainingEntryIds: [...entryIds]
      });

      // Setze nicht-ACK'd Einträge zurück auf PENDING für Retry
      const tenantStore = useTenantStore();
      const activeDB = tenantStore.activeTenantDB as FinwiseTenantSpecificDB | null;
      if (activeDB) {
        try {
          await activeDB.transaction('rw', activeDB.syncQueue, async (tx) => {
            const syncQueueTable = tx.table<SyncQueueEntry, string>('syncQueue');
            for (const entryId of entryIds) {
              await syncQueueTable.update(entryId, {
                status: SyncStatus.PENDING
              });
            }
          });
        } catch (error) {
          errorLog('[WebSocketService]', 'Error resetting timed-out entries to PENDING:', error);
        }
      }

      return false;
    }

    return true;
  },

  checkAndProcessSyncQueue(): void {
    const webSocketStore = useWebSocketStore();
    if (
      webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED &&
      webSocketStore.backendStatus === BackendStatus.ONLINE
    ) {
      infoLog('[WebSocketService]', 'Connection re-established and backend online. Triggering sync queue processing.');
      this.processSyncQueue();
    } else {
      debugLog('[WebSocketService]', 'Conditions not met for sync queue processing.', {
        conn: webSocketStore.connectionStatus,
        backend: webSocketStore.backendStatus,
      });
    }
  },

  async initializeSyncQueue(): Promise<void> {
    const tenantStore = useTenantStore();
    const currentTenantId = tenantStore.activeTenantId;

    if (!currentTenantId) {
      debugLog('[WebSocketService]', 'No active tenant for sync queue initialization.');
      return;
    }

    try {
      // Hängende PROCESSING-Einträge zurücksetzen (älter als 30 Sekunden)
      const resetCount = await tenantDbService.resetStuckProcessingEntries(currentTenantId, 30000);
      if (resetCount > 0) {
        infoLog('[WebSocketService]', `${resetCount} hängende PROCESSING-Einträge beim Start zurückgesetzt.`);
      }

      // Prüfen, ob es ausstehende Einträge gibt
      const pendingEntries = await tenantDbService.getPendingSyncEntries(currentTenantId);
      const failedEntries = await tenantDbService.getFailedSyncEntries(currentTenantId);

      if (pendingEntries.length > 0 || failedEntries.length > 0) {
        infoLog('[WebSocketService]', `Sync-Queue initialisiert: ${pendingEntries.length} ausstehende, ${failedEntries.length} fehlgeschlagene Einträge.`);
      }
    } catch (error) {
      errorLog('[WebSocketService]', 'Fehler bei der Sync-Queue-Initialisierung', { error });
    }
  },

  initialize(): void {
    const webSocketStore = useWebSocketStore();
    // Beobachte Änderungen im connectionStatus und backendStatus
    watch(
      [() => webSocketStore.connectionStatus, () => webSocketStore.backendStatus],
      ([newConnectionStatus, newBackendStatus]: [WebSocketConnectionStatus, BackendStatus], [oldConnectionStatus, oldBackendStatus]: [WebSocketConnectionStatus, BackendStatus]) => {
        debugLog('[WebSocketService]', 'Status changed:', {
          connNew: newConnectionStatus, backendNew: newBackendStatus,
          connOld: oldConnectionStatus, backendOld: oldBackendStatus,
        });
        this.checkAndProcessSyncQueue();
      },
      { immediate: false } // Nicht sofort ausführen, sondern nur bei Änderung nach Initialisierung
    );
    infoLog('[WebSocketService]', 'Initialized and watching for connection/backend status changes to trigger sync.');

    // Sync-Queue beim Start initialisieren
    this.initializeSyncQueue();

    // Automatische Synchronisation initialisieren
    this.initializeAutoSync();

    // Optionale automatische Verbindung, falls gewünscht und Tenant vorhanden
    // const session = useSessionStore();
    // if (session.currentTenantId) {
    //   this.connect();
    // }
  },

  async processSyncAck(ackMessage: SyncAckMessage): Promise<void> {
    try {
      const success = await tenantDbService.removeSyncQueueEntry(ackMessage.id);
      if (success) {
        infoLog('[WebSocketService]', `Sync-Queue-Eintrag ${ackMessage.id} erfolgreich nach ACK entfernt.`, {
          entityType: ackMessage.entityType,
          entityId: ackMessage.entityId,
          operationType: ackMessage.operationType
        });
      } else {
        warnLog('[WebSocketService]', `Konnte Sync-Queue-Eintrag ${ackMessage.id} nach ACK nicht entfernen (möglicherweise bereits entfernt).`);
      }
    } catch (error) {
      errorLog('[WebSocketService]', `Fehler beim Verarbeiten der Sync-ACK für Eintrag ${ackMessage.id}`, { error, ackMessage });
    }
  },

  async processSyncNack(nackMessage: SyncNackMessage): Promise<void> {
    try {
      const entry = await tenantDbService.getSyncQueueEntry(nackMessage.id);
      if (!entry) {
        warnLog('[WebSocketService]', `Sync-Queue-Eintrag ${nackMessage.id} für NACK-Verarbeitung nicht gefunden.`);
        return;
      }

      // Verwende retryCount (entspricht attempts) für Retry-Logik
      const retryCount = entry.attempts ?? 0;
      const maxRetries = 3; // Fest auf 3 Retries gesetzt wie gefordert

      if (retryCount >= maxRetries) {
        // Maximale Anzahl an Retries erreicht - markiere als FAILED
        const success = await tenantDbService.updateSyncQueueEntryStatus(
          nackMessage.id,
          SyncStatus.FAILED,
          `Failed after ${retryCount} retry attempts: ${nackMessage.reason} - ${nackMessage.detail || ''}`
        );

        if (success) {
          errorLog('[WebSocketService]', `Sync-Queue-Eintrag ${nackMessage.id} nach ${retryCount} Retry-Versuchen als FAILED markiert.`, {
            reason: nackMessage.reason,
            detail: nackMessage.detail,
            maxRetries,
            entityId: nackMessage.entityId,
            entityType: nackMessage.entityType,
            operationType: nackMessage.operationType
          });
        } else {
          errorLog('[WebSocketService]', `Konnte fehlgeschlagenen Sync-Queue-Eintrag ${nackMessage.id} nicht als FAILED markieren.`, {
            reason: nackMessage.reason,
            detail: nackMessage.detail
          });
        }
      } else {
        // Berechne Verzögerung mit exponentieller Backoff-Formel: (2 ** (attempt - 1)) * 1000
        const nextAttempt = retryCount + 1;
        const retryDelay = Math.pow(2, nextAttempt - 1) * 1000; // 1s, 2s, 4s

        // Setze Status zurück auf PENDING für erneute Verarbeitung
        const success = await tenantDbService.updateSyncQueueEntryStatus(
          nackMessage.id,
          SyncStatus.PENDING,
          `Retry ${nextAttempt}/${maxRetries} scheduled after NACK: ${nackMessage.reason} - ${nackMessage.detail || ''}`
        );

        if (success) {
          warnLog('[WebSocketService]', `Sync-Queue-Eintrag ${nackMessage.id} für Retry ${nextAttempt}/${maxRetries} geplant in ${retryDelay}ms.`, {
            reason: nackMessage.reason,
            detail: nackMessage.detail,
            retryDelay,
            currentRetryCount: retryCount,
            nextAttempt
          });

          // Warte die berechnete Zeit und setze dann den Sync-Prozess fort
          setTimeout(() => {
            this.checkAndProcessSyncQueue();
          }, retryDelay);
        } else {
          errorLog('[WebSocketService]', `Konnte Sync-Queue-Eintrag ${nackMessage.id} nicht für Retry zurücksetzen.`, {
            reason: nackMessage.reason,
            detail: nackMessage.detail
          });
        }
      }
    } catch (error) {
      errorLog('[WebSocketService]', `Fehler beim Verarbeiten der Sync-NACK für Eintrag ${nackMessage.id}`, { error, nackMessage });
    }
  },

  getMaxRetriesForReason(reason: string): number {
    // Verschiedene Retry-Strategien basierend auf dem Fehlergrund
    switch (reason) {
      case 'validation_error':
      case 'table_not_found':
        return 1; // Strukturelle Fehler - nur ein Retry
      case 'database_operational_error':
        return 5; // Datenbankfehler - mehr Retries
      case 'processing_error':
      case 'generic_processing_error':
        return 3; // Allgemeine Verarbeitungsfehler - moderate Retries
      default:
        return 3; // Standard-Retry-Anzahl
    }
  },

  calculateRetryDelay(attemptNumber: number): number {
    // Exponential backoff: 2^attemptNumber * 1000ms, max 30 Sekunden
    const baseDelay = 1000; // 1 Sekunde
    const maxDelay = 30000; // 30 Sekunden
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);

    // Jitter hinzufügen (±25% Variation)
    const jitter = delay * 0.25 * (Math.random() - 0.5);
    return Math.round(delay + jitter);
  },

  // Automatische Synchronisation
  async initializeAutoSync(): Promise<void> {
    infoLog('[WebSocketService]', 'Initializing automatic synchronization...');

    // 1. Queue-Watcher einrichten
    this.setupQueueWatcher();

    // 2. Periodische Synchronisation starten
    this.startPeriodicSync();

    // 3. Verbindungs-Watcher einrichten
    this.setupConnectionWatcher();

    infoLog('[WebSocketService]', 'Automatic synchronization initialized');
  },

  setupQueueWatcher(): void {
    const tenantStore = useTenantStore();

    // Überwacht Änderungen in der Sync-Queue
    queueWatcher = watch(
      () => tenantStore.activeTenantId,
      async (tenantId) => {
        if (!tenantId) return;

        // Prüfe auf neue Queue-Einträge alle 5 Sekunden
        const checkInterval = setInterval(async () => {
          if (!this.isOnlineAndReady()) {
            return;
          }

          const pendingEntries = await tenantDbService.getPendingSyncEntries(tenantId);
          if (pendingEntries.length > 0) {
            debugLog('[WebSocketService]', `Found ${pendingEntries.length} pending entries, triggering sync`);
            this.processSyncQueue();
          }
        }, 5000);

        // Cleanup bei Tenant-Wechsel
        return () => clearInterval(checkInterval);
      },
      { immediate: true }
    );
  },

  async startPeriodicSync(intervalMs: number = 60000): Promise<void> {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
    }

    autoSyncInterval = setInterval(async () => {
      if (!isAutoSyncEnabled || !this.isOnlineAndReady()) {
        return;
      }

      const tenantStore = useTenantStore();
      if (tenantStore.activeTenantId) {
        debugLog('[WebSocketService]', 'Periodic sync check triggered');
        // TODO: Temporär deaktiviert bis Backend vollständig implementiert
        // await this.requestServerDataStatus(tenantStore.activeTenantId);

        // Stattdessen normale Sync-Queue-Verarbeitung
        await this.processSyncQueue();
      }
    }, intervalMs);

    infoLog('[WebSocketService]', `Periodic sync started with ${intervalMs}ms interval`);
  },

  setupConnectionWatcher(): void {
    const webSocketStore = useWebSocketStore();

    watch(
      [() => webSocketStore.connectionStatus, () => webSocketStore.backendStatus],
      ([newConnStatus, newBackendStatus], [oldConnStatus, oldBackendStatus]) => {
        const wasOffline = oldConnStatus !== WebSocketConnectionStatus.CONNECTED ||
          oldBackendStatus !== BackendStatus.ONLINE;
        const isNowOnline = newConnStatus === WebSocketConnectionStatus.CONNECTED &&
          newBackendStatus === BackendStatus.ONLINE;

        if (wasOffline && isNowOnline) {
          infoLog('[WebSocketService]', 'Connection re-established, triggering immediate sync');
          this.processSyncQueue();
        }
      }
    );
  },

  isOnlineAndReady(): boolean {
    const webSocketStore = useWebSocketStore();
    return webSocketStore.connectionStatus === WebSocketConnectionStatus.CONNECTED &&
      webSocketStore.backendStatus === BackendStatus.ONLINE;
  },

  async requestServerDataStatus(tenantId: string): Promise<void> {
    if (!this.isOnlineAndReady()) {
      debugLog('[WebSocketService]', 'Cannot request server data status: not online and ready');
      return;
    }

    try {
      const webSocketStore = useWebSocketStore();

      const message = {
        type: 'data_status_request',
        tenant_id: tenantId,
        entity_types: null, // Alle Entitätstypen
      };

      const sent = this.sendMessage(message);
      if (sent) {
        debugLog('[WebSocketService]', 'Server data status requested', { tenantId });
      }
    } catch (error) {
      errorLog('[WebSocketService]', 'Error requesting server data status', { error, tenantId });
    }
  },

  async handleDataStatusResponse(message: DataStatusResponseMessage): Promise<void> {
    const tenantStore = useTenantStore();
    const webSocketStore = useWebSocketStore();

    if (message.tenant_id !== tenantStore.activeTenantId) {
      warnLog('[WebSocketService]', 'Received data status for wrong tenant', {
        received: message.tenant_id,
        expected: tenantStore.activeTenantId
      });
      return;
    }

    try {
      // Update last sync time
      webSocketStore.updateLastAutoSyncTime(message.last_sync_time);

      infoLog('[WebSocketService]', 'Data status response processed', {
        tenantId: message.tenant_id,
        lastSyncTime: message.last_sync_time
      });

    } catch (error) {
      errorLog('[WebSocketService]', 'Error handling data status response', { error, message });
    }
  },

  async getPendingDeleteOperations(tenantId: string): Promise<{ accounts: string[], accountGroups: string[], categories: string[], categoryGroups: string[], recipients: string[], tags: string[] }> {
    /**
     * Holt alle pending DELETE-Operationen aus der Sync-Queue um zu vermeiden,
     * dass gelöschte Entitäten durch initial data load wieder hinzugefügt werden.
     */
    try {
      const pendingDeletes = await tenantDbService.getPendingDeleteOperations(tenantId);
      debugLog('[WebSocketService]', 'Retrieved pending DELETE operations', {
        tenantId,
        accountDeletes: pendingDeletes.accounts.length,
        groupDeletes: pendingDeletes.accountGroups.length,
        categoryDeletes: pendingDeletes.categories?.length || 0,
        categoryGroupDeletes: pendingDeletes.categoryGroups?.length || 0,
        recipientDeletes: pendingDeletes.recipients?.length || 0,
        tagDeletes: pendingDeletes.tags?.length || 0
      });
      return {
        accounts: pendingDeletes.accounts,
        accountGroups: pendingDeletes.accountGroups,
        categories: pendingDeletes.categories || [],
        categoryGroups: pendingDeletes.categoryGroups || [],
        recipients: pendingDeletes.recipients || [],
        tags: pendingDeletes.tags || []
      };
    } catch (error) {
      errorLog('[WebSocketService]', 'Error retrieving pending DELETE operations', {
        error: error instanceof Error ? error.message : String(error),
        tenantId
      });
      return { accounts: [], accountGroups: [], categories: [], categoryGroups: [], recipients: [], tags: [] };
    }
  },

  /**
   * Intelligente Verarbeitung von Transaktionen beim Initial Data Load
   * Delegiert an TransactionService für korrekte Architektur-Trennung
   */
  async processTransactionsIntelligently(
    incomingTransactions: any[],
    transactionStore: any
  ): Promise<{ processed: number; skipped: number; updated: number }> {
    // Business Logic ist jetzt im TransactionService
    const { TransactionService } = await import('./TransactionService');
    return await TransactionService.processTransactionsIntelligently(incomingTransactions);
  },

  /**
   * Sendet ein Tenant-Disconnect-Signal ans Backend, um Datenbankressourcen freizugeben
   */
  sendTenantDisconnect(tenantId: string, reason: string = 'user_logout'): boolean {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      warnLog('[WebSocketService]', 'Cannot send tenant disconnect - WebSocket not connected', {
        tenantId,
        reason,
        socketState: socket?.readyState || 'null'
      });
      return false;
    }

    const disconnectMessage: TenantDisconnectMessage = {
      type: 'tenant_disconnect',
      tenant_id: tenantId,
      reason: reason
    };

    infoLog('[WebSocketService]', `Sending tenant disconnect signal for tenant ${tenantId}`, {
      tenantId,
      reason,
      messageType: 'tenant_disconnect'
    });

    return this.sendMessage(disconnectMessage);
  },

  /**
   * Verarbeitet Tenant-Disconnect-Acknowledgment-Nachrichten vom Backend
   */
  async processTenantDisconnectAck(ackMessage: TenantDisconnectAckMessage): Promise<void> {
    infoLog('[WebSocketService]', `Received tenant disconnect acknowledgment for tenant ${ackMessage.tenant_id}`, {
      tenantId: ackMessage.tenant_id,
      status: ackMessage.status,
      message: ackMessage.message
    });

    if (ackMessage.status === 'success') {
      infoLog('[WebSocketService]', `Backend successfully released database resources for tenant ${ackMessage.tenant_id}`, {
        tenantId: ackMessage.tenant_id,
        message: ackMessage.message
      });
    } else {
      errorLog('[WebSocketService]', `Backend failed to release database resources for tenant ${ackMessage.tenant_id}`, {
        tenantId: ackMessage.tenant_id,
        message: ackMessage.message,
        status: ackMessage.status
      });
    }
  }
};

// WebSocketService.initialize(); // Initialisierung aufrufen, damit das Watching startet
// Die Initialisierung sollte einmalig beim App-Start erfolgen, z.B. in main.ts oder App.vue
// Für dieses Beispiel wird es hier aufgerufen, aber in einer echten App wäre ein zentralerer Ort besser.

// Automatische Verbindung beim Laden des Services, wenn ein Tenant ausgewählt ist.
// Dies kann auch an anderer Stelle in der Anwendung initiiert werden, z.B. nach dem Login oder Tenant-Wechsel.
// const session = useSessionStore();
// if (session.currentTenantId) {
//   WebSocketService.connect();
// }
