// src/services/WebSocketService.ts
import { useSessionStore } from '@/stores/sessionStore';
import { useWebSocketStore, WebSocketConnectionStatus } from '@/stores/webSocketStore';
import { infoLog, errorLog, debugLog, warnLog } from '@/utils/logger'; // warnLog hinzugefügt
import { BackendStatus, type ServerWebSocketMessage, type StatusMessage, SyncStatus, type SyncQueueEntry, EntityTypeEnum, SyncOperationType, type DataUpdateNotificationMessage, type Account, type AccountGroup, type DeletePayload, type RequestInitialDataMessage, type InitialDataLoadMessage } from '@/types'; // Erweiterte Importe für Initial Load
import { watch } from 'vue'; // watch importiert
import { TenantDbService } from './TenantDbService'; // TenantDbService importiert
import { useTenantStore, type FinwiseTenantSpecificDB } from '@/stores/tenantStore'; // useTenantStore importiert und DB-Typ
import { useAccountStore } from '@/stores/accountStore'; // accountStore importiert

const RECONNECT_INTERVAL = 5000; // 5 Sekunden
const MAX_RECONNECT_ATTEMPTS = 5;

let socket: WebSocket | null = null;
let reconnectAttempts = 0;
let explicitClose = false;
let isSyncProcessRunning = false; // Verhindert mehrfache Ausführung

const tenantDbService = new TenantDbService(); // Instanziiere den Service hier

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
    // Die Basis-URL für WebSockets muss ggf. konfigurierbar sein oder aus Umgebungsvariablen stammen.
    // Für lokale Entwicklung nehmen wir an, dass Backend und Frontend auf demselben Host laufen.
    // Das Backend läuft auf Port 8000 (Standard für FastAPI).
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname; // oder eine konfigurierte Backend-URL
    const wsPort = import.meta.env.VITE_BACKEND_PORT || '8000'; // Port des Backends
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
        // Der Backend-Status wird durch eine explizite Nachricht vom Backend gesetzt.
        // Hier könnte man einen initialen "optimistischen" Status setzen oder auf die erste Statusnachricht warten.
        // webSocketStore.setBackendStatus(BackendStatus.ONLINE); // Vorerst nicht, warten auf Nachricht
        webSocketStore.setError(null);
        reconnectAttempts = 0;
        debugLog('[WebSocketService]', 'onopen: Set connectionStatus to CONNECTED, reset error and reconnectAttempts.');
        // Nach erfolgreicher Verbindung prüfen, ob Sync gestartet werden soll
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
          } else if (message.type === 'data_update' && message.event_type === 'data_update') { // event_type zusätzlich prüfen
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
                    await accountStore.deleteAccountGroup(accountGroupData.id, true); // true für 'fromSync'
                    infoLog('[WebSocketService]', `AccountGroup ${accountGroupData.id} deleted via WebSocket.`);
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
          } else if (message.event_type === 'initial_data_load') { // Änderung hier: message.type zu message.event_type
            const initialDataMessage = message as InitialDataLoadMessage; // Type assertion ist hier immer noch wichtig
            infoLog('[WebSocketService]', 'InitialDataLoadMessage received (matched on event_type):', initialDataMessage);

            if (initialDataMessage.tenant_id !== tenantStore.activeTenantId) {
              warnLog('[WebSocketService]', `Received InitialDataLoadMessage for tenant ${initialDataMessage.tenant_id}, but active tenant is ${tenantStore.activeTenantId}. Ignoring.`);
              return;
            }

            const { accounts, account_groups } = initialDataMessage.payload;
            debugLog('[WebSocketService]', 'Initial data payload content:', { accounts, account_groups });


            if (accounts && accounts.length > 0) {
              infoLog('[WebSocketService]', `Processing ${accounts.length} initial accounts.`);
              for (const acc of accounts) {
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
                debugLog('[WebSocketService]', 'Attempting to add account group from initial load:', group);
                await accountStore.addAccountGroup(group, true); // fromSync = true
                infoLog('[WebSocketService]', `AccountGroup ${group.id} added/updated from initial load.`);
              }
            } else {
              infoLog('[WebSocketService]', 'No initial account groups received or accountGroups array is empty.');
            }
            infoLog('[WebSocketService]', 'Finished processing InitialDataLoadMessage.');
          }

        } catch (e) {
          errorLog('[WebSocketService]', 'Error parsing message from server:', e, event.data);
          webSocketStore.setError('Error parsing message from server.');
          // Bei einem Parsing-Fehler könnte man den Backend-Status auf ERROR setzen
          webSocketStore.setBackendStatus(BackendStatus.ERROR);
        }
      };

      socket.onerror = (errorEvent) => { // errorEvent statt error für mehr Klarheit
        errorLog('[WebSocketService]', 'WebSocket onerror event triggered:', errorEvent);
        webSocketStore.setError('WebSocket connection error.');
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.ERROR);
        // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
      };

      socket.onclose = (closeEvent) => { // closeEvent statt event
        infoLog('[WebSocketService]', `WebSocket onclose event triggered. Code: ${closeEvent.code}, Reason: ${closeEvent.reason}, Clean: ${closeEvent.wasClean}`, { eventDetails: closeEvent });
        webSocketStore.setConnectionStatus(WebSocketConnectionStatus.DISCONNECTED);
        // Der Backend-Status wird durch setConnectionStatus auf OFFLINE gesetzt.
        socket = null;

        if (!explicitClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          infoLog('[WebSocketService]', `Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
          setTimeout(() => {
            this.connect();
          }, RECONNECT_INTERVAL);
        } else if (!explicitClose) {
          errorLog('[WebSocketService]', 'Max reconnect attempts reached. Will not try again automatically.');
          webSocketStore.setError('Max reconnect attempts reached.');
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
    // Der Store-Status wird durch onclose aktualisiert.
    // webSocketStore.reset(); // Optional, um den Store sofort zurückzusetzen
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

  initialize(): void {
    const webSocketStore = useWebSocketStore();
    // Beobachte Änderungen im connectionStatus und backendStatus
    watch(
      [webSocketStore.connectionStatus, webSocketStore.backendStatus],
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

    // Optionale automatische Verbindung, falls gewünscht und Tenant vorhanden
    // const session = useSessionStore();
    // if (session.currentTenantId) {
    //   this.connect();
    // }
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
