import { useSessionStore } from '@/stores/sessionStore';
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { infoLog, errorLog, debugLog, warnLog } from '@/utils/logger';
import { BackendStatus, type ServerWebSocketMessage, type StatusMessage, SyncStatus, type SyncQueueEntry, EntityTypeEnum, SyncOperationType, type DataUpdateNotificationMessage, type Account, type AccountGroup, type Category, type CategoryGroup, type Recipient, type Tag, type AutomationRule, type PlanningTransaction, type DeletePayload, type RequestInitialDataMessage, type InitialDataLoadMessage, type SyncAckMessage, type SyncNackMessage, type DataStatusResponseMessage, type PongMessage, type ConnectionStatusResponseMessage, type SystemNotificationMessage, type MaintenanceNotificationMessage } from '@/types';
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

const RECONNECT_INTERVAL = 5000; // 5 Sekunden
const MAX_RECONNECT_ATTEMPTS = 10; // Erhöht von 5 auf 10
const LONG_TERM_RECONNECT_INTERVAL = 30000; // 30 Sekunden für langfristige Reconnects
const BACKEND_HEALTH_CHECK_INTERVAL = 15000; // 15 Sekunden für Backend-Health-Checks

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

const tenantDbService = new TenantDbService();

export const WebSocketService = {
  connect(): void {
    const sessionStore = useSessionStore();
    const webSocketStore = useWebSocketStore();
    debugLog('[WebSocketService]', 'connect() called. Current socket state:', socket?.readyState, 'Tenant ID from session:', sessionStore.currentTenantId);

    if (socket && socket.readyState === WebSocket.OPEN) {
      infoLog('[WebSocketService]', 'Already connected.');
      return;
    }

    if (!sessionStore.currentTenantId) {
      errorLog('[WebSocketService]', 'Cannot connect: Tenant ID is missing.');
      webSocketStore.setError('Tenant ID is missing for WebSocket connection.');
      webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
      return;
    }

    const tenantId = sessionStore.currentTenantId;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = import.meta.env.VITE_BACKEND_PORT || '8000';
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws_finwise/ws/${tenantId}`;
    debugLog('[WebSocketService]', `Constructed WebSocket URL: ${wsUrl}`);

    explicitClose = false;
    webSocketStore.setConnectionStatus(WebSocketConnectionStatus.CONNECTING);
    infoLog('[WebSocketService]', `Connecting to ${wsUrl}`);

    try {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        infoLog('[WebSocketService]', 'WebSocket onopen event triggered.');
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.CONNECTED);
        webSocketStore.setError(null);
        reconnectAttempts = 0;
        debugLog('[WebSocketService]', 'onopen: Set connectionStatus to CONNECTED, reset error and reconnectAttempts.');
        this.checkAndProcessSyncQueue();
      };

      socket.onmessage = async (event) => { // async hinzugefügt
        // Loggen der rohen Nachricht direkt beim Empfang
        debugLog('[WebSocketService]', 'Raw message received from server:', event.data);
        try {
          const message = JSON.parse(event.data as string) as ServerWebSocketMessage;
          // Loggen der geparsten Nachricht
          debugLog('[WebSocketService]', 'Parsed message received:', message);
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
              switch (updateMessage.entity_type) {
                case EntityTypeEnum.ACCOUNT:
                  const accountData = updateMessage.data as Account | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await accountStore.addAccount(accountData as Account, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Account ${ (accountData as Account).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await accountStore.updateAccount(accountData as Account, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Account ${ (accountData as Account).id } updated via WebSocket.`);
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
                  const accountGroupData = updateMessage.data as AccountGroup | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await accountStore.addAccountGroup(accountGroupData as AccountGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AccountGroup ${ (accountGroupData as AccountGroup).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await accountStore.updateAccountGroup(accountGroupData as AccountGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AccountGroup ${ (accountGroupData as AccountGroup).id } updated via WebSocket.`);
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
                  const categoryData = updateMessage.data as Category | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await categoryStore.addCategory(categoryData as Category, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Category ${ (categoryData as Category).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await categoryStore.updateCategory(categoryData as Category, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Category ${ (categoryData as Category).id } updated via WebSocket.`);
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
                  const categoryGroupData = updateMessage.data as CategoryGroup | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await categoryStore.addCategoryGroup(categoryGroupData as CategoryGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `CategoryGroup ${ (categoryGroupData as CategoryGroup).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await categoryStore.updateCategoryGroup(categoryGroupData as CategoryGroup, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `CategoryGroup ${ (categoryGroupData as CategoryGroup).id } updated via WebSocket.`);
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
                  const recipientData = updateMessage.data as Recipient | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await recipientStore.addRecipient(recipientData as Recipient, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Recipient ${ (recipientData as Recipient).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await recipientStore.updateRecipient(recipientData as Recipient, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Recipient ${ (recipientData as Recipient).id } updated via WebSocket.`);
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
                  const tagData = updateMessage.data as Tag | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await tagStore.addTag(tagData as Tag, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Tag ${ (tagData as Tag).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await tagStore.updateTag(tagData as Tag, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Tag ${ (tagData as Tag).id } updated via WebSocket.`);
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
                  const ruleData = updateMessage.data as AutomationRule | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await ruleStore.addRule(ruleData as AutomationRule, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AutomationRule ${ (ruleData as AutomationRule).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await ruleStore.updateRule(ruleData as AutomationRule, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AutomationRule ${ (ruleData as AutomationRule).id } updated via WebSocket.`);
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
                  const planningTransactionData = updateMessage.data as PlanningTransaction | DeletePayload;
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await planningStore.addPlanningTransaction(planningTransactionData as PlanningTransaction, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `PlanningTransaction ${ (planningTransactionData as PlanningTransaction).id } created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await planningStore.updatePlanningTransaction((planningTransactionData as PlanningTransaction).id, planningTransactionData as PlanningTransaction, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `PlanningTransaction ${ (planningTransactionData as PlanningTransaction).id } updated via WebSocket.`);
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
                  const transactionData = updateMessage.data as any | DeletePayload; // Using any for ExtendedTransaction compatibility
                  if (updateMessage.operation_type === SyncOperationType.CREATE) {
                    await transactionStore.addTransaction(transactionData as any, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Transaction ${(transactionData as any).id} created via WebSocket.`);
                  } else if (updateMessage.operation_type === SyncOperationType.UPDATE) {
                    await transactionStore.updateTransaction((transactionData as any).id, transactionData as any, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `Transaction ${(transactionData as any).id} updated via WebSocket.`);
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

            const { accounts, account_groups, categories, category_groups, recipients, tags, automation_rules, planning_transactions, transactions } = initialDataMessage.payload;
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
              infoLog('[WebSocketService]', `Processing ${transactions.length} initial transactions.`);
              for (const transaction of transactions) {
                debugLog('[WebSocketService]', 'Attempting to add transaction from initial load:', transaction);
                await transactionStore.addTransaction(transaction as any, true); // fromSync = true, using any for ExtendedTransaction compatibility
                infoLog('[WebSocketService]', `Transaction ${transaction.id} added/updated from initial load.`);
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
            debugLog('[WebSocketService]', 'Received pong from server', message);
            // Pong-Antworten können für Connection-Health-Tracking verwendet werden
          } else if (message.type === 'connection_status_response') {
            infoLog('[WebSocketService]', 'Received connection_status_response', message);
            // Verbindungsstatus-Antworten verarbeiten
          } else if (message.type === 'system_notification') {
            infoLog('[WebSocketService]', 'Received system notification', message);
            // System-Benachrichtigungen verarbeiten
          } else if (message.type === 'maintenance_notification') {
            warnLog('[WebSocketService]', 'Received maintenance notification', message);
            // Wartungsbenachrichtigungen verarbeiten
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

      socket.onerror = (errorEvent) => { // errorEvent statt error für mehr Klarheit
        errorLog('[WebSocketService]', 'WebSocket onerror event triggered:', {
          error: errorEvent,
          readyState: socket?.readyState,
          url: wsUrl,
          tenantId: tenantId
        });
        webSocketStore.setError('WebSocket connection error.');
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
        // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
      };

      socket.onclose = (closeEvent) => { // closeEvent statt event
        infoLog('[WebSocketService]', `WebSocket onclose event triggered. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}, Clean: ${closeEvent.wasClean}`, { eventDetails: closeEvent });
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
        // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
        socket = null;

        if (!explicitClose) {
          this.handleReconnection();
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
    if (socket) {
      infoLog('[WebSocketService]', 'Disconnecting WebSocket explicitly.');
      explicitClose = true;
      socket.close();
    }

    // Stoppe alle Reconnection-Timer
    this.stopReconnectionTimers();

    // Der Store-Status wird durch onclose aktualisiert.
    // webSocketStore.reset(); // Optional, um den Store sofort zurückzusetzen
  },

  stopReconnectionTimers(): void {
    if (longTermReconnectTimer) {
      clearTimeout(longTermReconnectTimer);
      longTermReconnectTimer = null;
    }
    if (backendHealthCheckTimer) {
      clearInterval(backendHealthCheckTimer);
      backendHealthCheckTimer = null;
    }
    isReconnecting = false;
  },

  handleReconnection(): void {
    if (isReconnecting) {
      debugLog('[WebSocketService]', 'Reconnection already in progress, skipping');
      return;
    }

    isReconnecting = true;

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      infoLog('[WebSocketService]', `Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
      setTimeout(() => {
        isReconnecting = false;
        this.connect();
      }, RECONNECT_INTERVAL);
    } else {
      // Nach MAX_RECONNECT_ATTEMPTS wechseln zu langfristiger Reconnection-Strategie
      infoLog('[WebSocketService]', 'Max short-term reconnect attempts reached. Switching to long-term reconnection strategy.');
      this.startLongTermReconnection();
    }
  },

  startLongTermReconnection(): void {
    infoLog('[WebSocketService]', 'Starting long-term reconnection strategy...');

    // Starte Backend-Health-Checks
    this.startBackendHealthChecks();

    // Langfristige Reconnection-Versuche alle 30 Sekunden
    longTermReconnectTimer = setInterval(() => {
      if (!explicitClose && (!socket || socket.readyState !== WebSocket.OPEN)) {
        infoLog('[WebSocketService]', 'Long-term reconnection attempt...');
        isReconnecting = false; // Reset für neuen Versuch
        reconnectAttempts = 0; // Reset der Versuche für neue Runde
        this.connect();
      }
    }, LONG_TERM_RECONNECT_INTERVAL);
  },

  startBackendHealthChecks(): void {
    if (backendHealthCheckTimer) {
      clearInterval(backendHealthCheckTimer);
    }

    backendHealthCheckTimer = setInterval(async () => {
      if (explicitClose) return;

      try {
        // Prüfe Backend-Verfügbarkeit über HTTP
        const wsHost = window.location.hostname;
        const wsPort = import.meta.env.VITE_BACKEND_PORT || '8000';
        const healthUrl = `${window.location.protocol}//${wsHost}:${wsPort}/api/v1/websocket/health`;

        const response = await fetch(healthUrl, {
          method: 'GET',
          timeout: 5000
        } as RequestInit);

        if (response.ok) {
          const healthData = await response.json();
          debugLog('[WebSocketService]', 'Backend health check successful', healthData);

          // Wenn Backend verfügbar ist, aber WebSocket nicht verbunden, versuche Reconnection
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            infoLog('[WebSocketService]', 'Backend is healthy but WebSocket disconnected. Attempting reconnection...');
            isReconnecting = false;
            reconnectAttempts = 0;
            this.connect();
          }
        }
      } catch (error) {
        debugLog('[WebSocketService]', 'Backend health check failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }, BACKEND_HEALTH_CHECK_INTERVAL);
  },

  sendMessage(message: unknown): boolean {
    const webSocketStore = useWebSocketStore();
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        const jsonMessage = JSON.stringify(message);
        socket.send(jsonMessage);
        debugLog('[WebSocketService]', 'Message sent:', message);
        return true;
      } catch (error) {
        errorLog('[WebSocketService]', 'Error sending message:', error, message);
        webSocketStore.setError('Error sending message.');
        return false;
      }
    } else {
      errorLog('[WebSocketService]', 'Cannot send message: WebSocket is not connected.');
      webSocketStore.setError('Cannot send message: WebSocket is not connected.');
      return false;
    }
  },

  sendPing(): boolean {
    const pingMessage = {
      type: 'ping',
      timestamp: Date.now()
    };
    return this.sendMessage(pingMessage);
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
      errorLog('[WebSocketService]', 'Cannot request initial data: WebSocket not connected or backend not online.', {
        connected: socket?.readyState === WebSocket.OPEN,
        backendStatus: webSocketStore.backendStatus,
      });
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
    const currentTenantId = tenantStore.activeTenantId; // Globale Variable wird hier korrekt verwendet

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
      // Dexie-Transaktion starten
      await activeDB.transaction('rw', activeDB.syncQueue, async (tx) => {
        const syncQueueTable = tx.table<SyncQueueEntry, string>('syncQueue');

        // 1. Ausstehende Einträge innerhalb der Transaktion abrufen
        const pendingEntries = await syncQueueTable
          .where({ tenantId: currentTenantId, status: SyncStatus.PENDING })
          .sortBy('timestamp');

        if (pendingEntries.length === 0) {
          infoLog('[WebSocketService]', 'No pending entries in sync queue (within transaction).');
          return; // Beendet die Transaktions-Callback-Funktion
        }

        infoLog('[WebSocketService]', `Found ${pendingEntries.length} pending entries to sync (within transaction).`);

        for (const entry of pendingEntries) {
          // 2. Status auf PROCESSING setzen (innerhalb der Transaktion)
          const updateDataProcessing: Partial<SyncQueueEntry> = {
            status: SyncStatus.PROCESSING,
            attempts: (entry.attempts ?? 0) + 1,
            lastAttempt: Date.now(),
          };
          const updatedToProcessingCount = await syncQueueTable.update(entry.id, updateDataProcessing);

          if (updatedToProcessingCount === 0) {
            errorLog('[WebSocketService]', `Failed to update sync entry ${entry.id} to PROCESSING (not found in transaction?). Skipping.`);
            continue; // Nächsten Eintrag in der Schleife bearbeiten
          }
          // Wichtig: Das 'entry'-Objekt, das gesendet wird, mit den neuen Werten aktualisieren
          Object.assign(entry, updateDataProcessing);


          // 3. Nachricht vorbereiten und senden
          const messageToSend = {
            type: 'process_sync_entry',
            payload: entry, // Sendet den aktualisierten Eintrag
          };

          infoLog('[WebSocketService]', `Sending sync entry ${entry.id} (${entry.entityType} ${entry.operationType}) to backend.`);
          const sent = this.sendMessage(messageToSend); // sendMessage ist außerhalb der DB-Transaktion

          if (!sent) {
            errorLog('[WebSocketService]', `Failed to send sync entry ${entry.id}. Setting back to PENDING (within transaction).`);
            // Bei direktem Sendefehler zurück auf PENDING (innerhalb der Transaktion)
            const updateDataPending: Partial<SyncQueueEntry> = {
              status: SyncStatus.PENDING,
              error: 'Failed to send to WebSocket',
              // lastAttempt und attempts bleiben vom PROCESSING-Versuch erhalten
            };
            await syncQueueTable.update(entry.id, updateDataPending);
          } else {
            debugLog('[WebSocketService]', `Sync entry ${entry.id} sent to backend, status is PROCESSING (DB updated in transaction).`);
          }
        }
      }); // Ende der Dexie-Transaktion
      debugLog('[WebSocketService]', 'Dexie transaction for sync queue processing completed.');
    } catch (error) {
      errorLog('[WebSocketService]', 'Error processing sync queue with transaction:', error);
      // Bei einem Fehler in der Transaktion selbst werden die Änderungen zurückgerollt.
      // isSyncProcessRunning wird im finally Block gesetzt.
    } finally {
      isSyncProcessRunning = false;
      infoLog('[WebSocketService]', 'Finished processing sync queue attempt.');
    }
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

      const currentAttempts = entry.attempts ?? 0;
      const maxRetries = this.getMaxRetriesForReason(nackMessage.reason);

      if (currentAttempts >= maxRetries) {
        // Maximale Anzahl von Versuchen erreicht - als dauerhaft fehlgeschlagen markieren
        const success = await tenantDbService.updateSyncQueueEntryStatus(
          nackMessage.id,
          SyncStatus.FAILED,
          `Max retries (${maxRetries}) exceeded: ${nackMessage.reason} - ${nackMessage.detail || ''}`
        );
        if (success) {
          errorLog('[WebSocketService]', `Sync-Queue-Eintrag ${nackMessage.id} als dauerhaft fehlgeschlagen markiert nach ${currentAttempts} Versuchen.`, {
            reason: nackMessage.reason,
            detail: nackMessage.detail,
            maxRetries
          });
        }
      } else {
        // Retry mit exponential backoff
        const retryDelay = this.calculateRetryDelay(currentAttempts);

        const success = await tenantDbService.updateSyncQueueEntryStatus(
          nackMessage.id,
          SyncStatus.PENDING,
          `Retry scheduled after NACK: ${nackMessage.reason} - ${nackMessage.detail || ''}`
        );

        if (success) {
          warnLog('[WebSocketService]', `Sync-Queue-Eintrag ${nackMessage.id} für Retry geplant in ${retryDelay}ms (Versuch ${currentAttempts + 1}/${maxRetries}).`, {
            reason: nackMessage.reason,
            detail: nackMessage.detail,
            retryDelay
          });

          // Retry nach Delay planen
          setTimeout(() => {
            this.checkAndProcessSyncQueue();
          }, retryDelay);
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

  async getPendingDeleteOperations(tenantId: string): Promise<{accounts: string[], accountGroups: string[], categories: string[], categoryGroups: string[], recipients: string[], tags: string[]}> {
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
