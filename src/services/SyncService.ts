// src/services/SyncService.ts
import { useTenantStore, type FinwiseTenantSpecificDB, type SyncQueueItem as LocalSyncQueueItem } from '@/stores/tenantStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useUserStore, type LocalUser } from '@/stores/userStore'; // Importiere useUserStore und LocalUser
import type { Account, AccountGroup, SyncableEntity } from '@/types';
import { TenantDbService } from './TenantDbService';
import { errorLog, warnLog, debugLog, infoLog } from '@/utils/logger';
import { syncApi, type PushResponse, type PullResponse, type EntityType as ApiEntityType, type SyncQueueItem as ApiSyncQueueItem } from '@/api/syncApi';
import { v4 as uuidv4 } from 'uuid';
import { ref, readonly, watch, type Ref } from 'vue'; // Hinzugefügt für Reaktivität und Watcher

const MAX_SYNC_ATTEMPTS = 5;
const WEBSOCKET_URL_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/api/v1/ws/sync-status'; // Konfigurierbar machen
const WEBSOCKET_RECONNECT_DELAY_BASE = 1000; // 1 Sekunde
const WEBSOCKET_RECONNECT_MAX_DELAY = 30000; // 30 Sekunden
const WEBSOCKET_PING_INTERVAL = 30000; // 30 Sekunden
const MAX_RECONNECT_ATTEMPTS = 10;


const SERVICE_ENTITY_TYPES: ApiEntityType[] = ['accounts', 'account_groups'];

// Mapping von lokalen Operationstypen zu API-Aktionstypen
const operationToAction = (operation: LocalSyncQueueItem['operation']): ApiSyncQueueItem['action'] => {
  switch (operation) {
    case 'CREATE': return 'created';
    case 'UPDATE': return 'updated';
    case 'DELETE': return 'deleted';
    default: throw new Error(`Unknown operation type: ${operation}`);
  }
};

// Mapping von lokalen Entitätstypen zu API-Entitätstypen
const localEntityTypeToApiEntityType = (localType: LocalSyncQueueItem['entity_type']): ApiEntityType => {
  if (localType === 'Account') return 'accounts';
  if (localType === 'AccountGroup') return 'account_groups';
  // Hier weitere Mappings hinzufügen, falls nötig
  throw new Error(`Unknown local entity type for API mapping: ${localType}`);
};


export class SyncService {
  private tenantStore = useTenantStore();
  private sessionStore = useSessionStore();
  private userStore = useUserStore(); // UserStore Instanz
  private tenantDbService = new TenantDbService();

  // Reaktive Zustände
  private readonly _isQueueEmpty = ref(true);
  public readonly isQueueEmpty: Readonly<Ref<boolean>> = readonly(this._isQueueEmpty);

  private readonly _isCurrentlySyncing = ref(false);
  public readonly isCurrentlySyncing: Readonly<Ref<boolean>> = readonly(this._isCurrentlySyncing);

  // WebSocket-bezogene Zustände
  private readonly _isBackendReallyOnline = ref(false);
  public readonly isBackendReallyOnline: Readonly<Ref<boolean>> = readonly(this._isBackendReallyOnline);
  private readonly _webSocketStatus = ref<'connecting' | 'open' | 'closed' | 'error'>('closed');
  public readonly webSocketStatus: Readonly<Ref<'connecting' | 'open' | 'closed' | 'error'>> = readonly(this._webSocketStatus);

  private webSocketInstance: WebSocket | null = null;
  private reconnectAttempts = 0;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;


  private get db(): FinwiseTenantSpecificDB | null {
    return this.tenantStore.activeTenantDB;
  }

  private get tenantId(): string | null {
    return this.tenantStore.activeTenantId;
  }

  constructor() {
    debugLog('SyncService', 'SyncService initialisiert.');
    this.updateQueueStatus(); // Initialen Status der Queue setzen
    // Überwache Änderungen am aktiven Mandanten, um den Queue-Status neu zu bewerten
    this.tenantStore.$subscribe((mutation, state) => {
        debugLog('SyncService', 'TenantStore subscription triggered in SyncService constructor', { activeTenantId: state.activeTenantId });
        this.updateQueueStatus();
    });
    this.initializeWebSocketLogic();
  }

  private initializeWebSocketLogic(): void {
    debugLog('SyncService', 'WebSocket logic initialization');

    watch([() => this.tenantId, () => this.sessionStore.currentUserId, () => this.getAuthToken()],
      ([tenantId, userId, token], [oldTenantId, oldUserId, oldToken]) => {
        const isLoggedIn = !!userId;
        const oldIsLoggedIn = !!oldUserId;
        debugLog('SyncService', 'Watcher for tenantId/userId/token triggered', { tenantId, userId, tokenPresent: !!token, oldTenantId, oldUserId, oldTokenPresent: !!oldToken }); // Log userId directly

        if (!isLoggedIn || !tenantId || !token) {
          if (this.webSocketInstance) {
            infoLog('SyncService', 'User logged out, tenant changed without login, or token missing. Closing WebSocket.');
            this.disconnectWebSocket();
          }
        } else if (tenantId && isLoggedIn && token) { // Token ist hier nun explizit geprüft
          if (this.webSocketInstance && (tenantId !== oldTenantId || token !== oldToken)) { // Token-Änderung auch prüfen
            infoLog('SyncService', 'Tenant or token changed. Reconnecting WebSocket.');
            this.disconnectWebSocket();
            this.connectWebSocket();
          } else if (!this.webSocketInstance) {
            infoLog('SyncService', 'User logged in and tenant active. Attempting to connect WebSocket.');
            this.connectWebSocket();
          }
        }
      },
      { immediate: true }
    );
  }

  private connectWebSocket(): void {
    infoLog('SyncService', 'Attempting to connect WebSocket.'); // Added log
    if (this.webSocketInstance && this.webSocketInstance.readyState === WebSocket.OPEN) {
      debugLog('SyncService', 'WebSocket already open.');
      return;
    }
    if (this._webSocketStatus.value === 'connecting') {
      debugLog('SyncService', 'WebSocket connection already in progress.');
      return;
    }

    const currentTenantId = this.tenantId;
    const token = this.getAuthToken();

    if (!currentTenantId) {
      warnLog('SyncService', 'Cannot connect WebSocket: No active tenant ID.');
      return;
    }
    if (!token) {
      warnLog('SyncService', 'Cannot connect WebSocket: No auth token available. User might not be logged in or token is missing.');
      // Hier könnte man den Benutzer zum Login leiten oder eine Fehlermeldung anzeigen
      return;
    }

    const url = `${WEBSOCKET_URL_BASE}/${currentTenantId}?token=${token}`;
    infoLog('SyncService', `Connecting to WebSocket: ${url.replace(token, 'REDACTED_TOKEN')}`); // Token im Log redigieren
    this._webSocketStatus.value = 'connecting';

    try {
      this.webSocketInstance = new WebSocket(url);

      this.webSocketInstance.onopen = () => this.handleWsOpen();
      this.webSocketInstance.onmessage = (event) => this.handleWsMessage(event);
      this.webSocketInstance.onerror = (event) => this.handleWsError(event);
      this.webSocketInstance.onclose = (event) => this.handleWsClose(event);

    } catch (error) {
        errorLog('SyncService', 'Error creating WebSocket instance', { error });
        this._webSocketStatus.value = 'error';
        this._isBackendReallyOnline.value = false;
        this.scheduleReconnect();
    }
  }

  private disconnectWebSocket(isIntentional = true): void { // Typ-Annotation entfernt (Biome)
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.webSocketInstance) {
      infoLog('SyncService', 'Disconnecting WebSocket.', { readyState: this.webSocketInstance.readyState });
      // Event-Handler entfernen, um Reconnect-Schleifen bei absichtlichem Schließen zu vermeiden
      this.webSocketInstance.onopen = null;
      this.webSocketInstance.onmessage = null;
      this.webSocketInstance.onerror = null;
      this.webSocketInstance.onclose = null;
      if (this.webSocketInstance.readyState === WebSocket.OPEN || this.webSocketInstance.readyState === WebSocket.CONNECTING) {
        this.webSocketInstance.close(1000, 'Client initiated disconnect');
      }
      this.webSocketInstance = null;
    }
    this._isBackendReallyOnline.value = false;
    this._webSocketStatus.value = 'closed';
    if (isIntentional) {
        this.reconnectAttempts = 0; // Bei absichtlichem Schließen Versuche zurücksetzen
    }
  }

  private handleWsOpen(): void {
    infoLog('SyncService', 'WebSocket connection established.');
    this._webSocketStatus.value = 'open';
    // isBackendReallyOnline wird erst nach 'connection_ack' gesetzt
    this.reconnectAttempts = 0; // Erfolgreiche Verbindung, Zähler zurücksetzen
    if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
    }
    this.startPing();
  }

  private handleWsMessage(event: MessageEvent): void {
    try {
      debugLog('SyncService', 'WebSocket raw message received:', { data: event.data }); // Added log
      // Parse the outer string, then parse the inner JSON string
      const rawMessageContent = JSON.parse(event.data as string);
      const message = JSON.parse(rawMessageContent); // Correct parsing
      debugLog('SyncService', 'WebSocket parsed message received:', { message }); // Added log

      switch (message.type) {
        case 'connection_ack':
          this._isBackendReallyOnline.value = true;
          infoLog('SyncService', 'WebSocket connection_ack received. Backend is really online.');
          debugLog('SyncService', 'connection_ack case processed.'); // Added log
          // Start the synchronization process after successful connection ack
          this.synchronize();
          break;
        case 'backend_status':
          infoLog('SyncService', 'Backend status update received:', { status: message.status, details: message.details });
          // Hier könnte man auf 'maintenance' oder 'degraded' reagieren
          break;
        case 'trigger_sync':
          infoLog('SyncService', 'trigger_sync_request received from backend.', { reason: message.reason });
          this.triggerManualSync(); // Bestehende Methode aufrufen
          break;
        case 'pong':
          debugLog('SyncService', 'Pong received from backend.');
          break;
        default:
          warnLog('SyncService', 'Unknown WebSocket message type received:', { message });
      }
    } catch (err) {
      errorLog('SyncService', 'Error processing WebSocket message.', { data: event.data, error: err });
    }
  }

  private handleWsError(event: Event): void {
    errorLog('SyncService', 'WebSocket error occurred.', { event });
    this._isBackendReallyOnline.value = false;
    this._webSocketStatus.value = 'error'; // Oder 'closed', je nach Semantik
    // onclose wird normalerweise nach onerror ausgelöst, dort wird der Reconnect gehandhabt
  }

  private handleWsClose(event: CloseEvent): void {
    infoLog('SyncService', 'WebSocket connection closed.', { code: event.code, reason: event.reason, wasClean: event.wasClean });
    this._isBackendReallyOnline.value = false;
    this._webSocketStatus.value = 'closed';

    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }

    // Nur wiederverbinden, wenn es nicht absichtlich geschlossen wurde (Code 1000 ist normal)
    // und wenn der Benutzer noch eingeloggt ist (currentUserId vorhanden) und ein Tenant aktiv ist.
    const isLoggedIn = !!this.sessionStore.currentUserId;
    if (event.code !== 1000 && isLoggedIn && this.tenantId) {
      warnLog('SyncService', 'WebSocket closed unexpectedly. Attempting to reconnect.', { code: event.code });
      this.scheduleReconnect();
    } else if (event.code === 1000) {
        debugLog('SyncService', 'WebSocket closed intentionally by client or server.');
        this.reconnectAttempts = 0; // Reset attempts on clean close
    } else {
        debugLog('SyncService', 'WebSocket closed, no reconnect conditions met (e.g. logged out).');
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      errorLog('SyncService', `Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Stopping reconnection.`);
      this.reconnectAttempts = 0; // Zurücksetzen für den Fall, dass manuell neu verbunden wird
      return;
    }
    if (this.reconnectTimeoutId) {
        clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      WEBSOCKET_RECONNECT_DELAY_BASE * (2 ** (this.reconnectAttempts - 1)), // Biome: Use the '**' operator
      WEBSOCKET_RECONNECT_MAX_DELAY
    );

    infoLog('SyncService', `Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay / 1000}s.`);
    this.reconnectTimeoutId = setTimeout(() => {
      const stillLoggedIn = !!this.sessionStore.currentUserId;
      if (stillLoggedIn && this.tenantId) { // Erneut prüfen vor dem Verbindungsversuch
        this.connectWebSocket();
      } else {
        warnLog('SyncService', 'Reconnect attempt aborted: User logged out or no active tenant.');
        this.reconnectAttempts = 0; // Reset, da keine Verbindung mehr benötigt wird
      }
    }, delay);
  }

  private startPing(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
    }
    this.pingIntervalId = setInterval(() => {
      if (this.webSocketInstance && this.webSocketInstance.readyState === WebSocket.OPEN) {
        try {
          debugLog('SyncService', 'Sending ping to backend.');
          this.webSocketInstance.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
          errorLog('SyncService', 'Error sending ping.', { error: err });
          // Fehler könnte auf eine geschlossene Verbindung hindeuten, onclose sollte das handhaben
        }
      }
    }, WEBSOCKET_PING_INTERVAL);
  }

  // Wird von außen aufgerufen, z.B. bei Logout oder App-Schließung
  public cleanup(): void {
    infoLog('SyncService', 'Performing cleanup for SyncService.');
    this.disconnectWebSocket(true); // true für absichtliches Schließen
  }


  private getAuthToken(): string | null {
    const currentUserId = this.sessionStore.currentUserId;
    debugLog('SyncService', 'getAuthToken: Looking up token for user ID:', { currentUserId }); // Added log
    if (!currentUserId) {
      debugLog('SyncService', 'getAuthToken: No current user ID found in sessionStore.');
      return null;
    }

    const currentUser = this.userStore.getUserById(currentUserId);
    debugLog('SyncService', 'getAuthToken: User object from userStore:', { currentUser }); // Added log
    if (!currentUser) {
      warnLog('SyncService', 'getAuthToken: Current user not found in userStore for ID:', { currentUserId });
      return null;
    }

    if (currentUser.accessToken) {
      debugLog('SyncService', 'getAuthToken: Access token found for current user.');
      return currentUser.accessToken;
    }
    warnLog('SyncService', 'getAuthToken: No access token found for current user:', { currentUserId });
    return null;
  }

  public async updateQueueStatus(): Promise<void> {
    if (!this.db) {
      this._isQueueEmpty.value = true;
      return;
    }
    try {
      const count = await this.db.syncQueue.count();
      this._isQueueEmpty.value = count === 0;
      debugLog('SyncService', `Queue status updated: isEmpty = ${this._isQueueEmpty.value} (count: ${count})`);
    } catch (err) {
      errorLog('SyncService', 'Fehler beim Aktualisieren des Queue-Status.', { error: err });
      this._isQueueEmpty.value = true; // Im Fehlerfall als leer annehmen
    }
  }

  private mapLocalQueueItemToApiQueueItem(localItem: LocalSyncQueueItem, tenantId: string): ApiSyncQueueItem {
    const timestamp = localItem.timestamp || new Date().toISOString();
    debugLog('SyncService', 'Mapping item timestamp:', { entityId: localItem.entity_id, timestamp: timestamp, timestampType: typeof timestamp }); // Log added to check timestamp value and type
    return {
      id: uuidv4(),
      entityType: localEntityTypeToApiEntityType(localItem.entity_type),
      entityId: localItem.entity_id, // Explizite Zuweisung des Werts
      action: operationToAction(localItem.operation),
      payload: localItem.payload as Partial<SyncableEntity>,
      timestamp: timestamp,
      tenantId: tenantId,
    };
  }

  private async syncLocalChangesToBackend(localChanges: LocalSyncQueueItem[]): Promise<PushResponse | { success: false; error: string }> {
    const currentTenantId = this.tenantId;
    if (!currentTenantId) {
      const errorMsg = 'Keine aktive Mandanten-ID für Backend-Sync.';
      warnLog('SyncService', `syncLocalChangesToBackend: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    debugLog('SyncService', 'syncLocalChangesToBackend() called.', { count: localChanges.length }); // Added log

    const apiChanges = localChanges.map(item => this.mapLocalQueueItemToApiQueueItem(item, currentTenantId));

    // Detailliertes Logging der zu sendenden apiChanges
    debugLog('SyncService', `Prepared ${apiChanges.length} changes for backend. Details:`, JSON.stringify(apiChanges.map(item => ({ entityType: item.entityType, entityId: item.entityId, action: item.action, tenantId: item.tenantId, payloadKeys: Object.keys(item.payload) }))));

    debugLog('SyncService', `Sending ${apiChanges.length} changes to backend via syncApi.pushChanges.`); // Added log
    const token = this.getAuthToken();
    const response = await syncApi.pushChanges(apiChanges, token);
    debugLog('SyncService', 'syncApi.pushChanges finished.', { success: response.success }); // Added log

    if (!response.success) {
      errorLog('SyncService', 'Fehler beim Pushen von Änderungen zum Backend.', { error: (response as { error: string }).error });
    }
    debugLog('SyncService', 'syncLocalChangesToBackend() finished.'); // Added log
    return response;
  }

  private async fetchRemoteChangesFromBackend<T extends SyncableEntity>(
    entityType: ApiEntityType,
    token: string | null, // Token als Parameter (string | null) definiert
    lastSyncTimestamp?: string | null, // Optionaler Parameter nach required Parameter
  ): Promise<PullResponse<T> | { success: false; error: string }> {
    const currentTenantId = this.tenantId;
    if (!currentTenantId) {
      const errorMsg = 'Keine aktive Mandanten-ID für Backend-Sync.';
      warnLog('SyncService', `fetchRemoteChangesFromBackend: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    debugLog('SyncService', `fetchRemoteChangesFromBackend() called for ${entityType}.`, { lastSyncTimestamp }); // Added log
    debugLog('SyncService', `Calling syncApi.pullChanges for ${entityType}.`); // Added log
    const response = await syncApi.pullChanges<T>(entityType, currentTenantId, token, lastSyncTimestamp || undefined);
    debugLog('SyncService', `syncApi.pullChanges for ${entityType} finished.`, { success: response.success }); // Added log

    if (!response.success) {
      errorLog('SyncService', `Fehler beim Pullen von Änderungen für ${entityType} vom Backend.`, { error: (response as { error: string }).error });
    }
    debugLog('SyncService', `fetchRemoteChangesFromBackend() finished for ${entityType}.`); // Added log
    return response;
  }

  private async fetchInitialDataFromBackend<T extends SyncableEntity>(
    entityType: ApiEntityType,
  ): Promise<PullResponse<T> | { success: false; error: string }> {
    debugLog('SyncService', `fetchInitialDataFromBackend für ${entityType} aufgerufen`);
    const token = this.getAuthToken();
    return this.fetchRemoteChangesFromBackend<T>(entityType, null, token);
  }

  public async processSyncQueue(): Promise<void> {
    debugLog('SyncService', 'processSyncQueue() called.'); // Added log
    const currentTenantId = this.tenantId;
    if (!this.db || !currentTenantId) {
      warnLog('SyncService', 'processSyncQueue: Keine aktive Mandanten-DB oder Mandanten-ID.');
      return;
    }
    debugLog('SyncService', 'Starte Verarbeitung der SyncQueue.');

    const itemsToSync = await this.db.syncQueue
      .where('attempts')
      .below(MAX_SYNC_ATTEMPTS)
      .toArray();

    debugLog('SyncService', `Found ${itemsToSync.length} items in sync queue.`); // Added log

    if (itemsToSync.length === 0) {
      debugLog('SyncService', 'SyncQueue ist leer oder alle Items haben maximale Versuche erreicht für aktuellen Mandant.');
      this.updateQueueStatus(); // Status aktualisieren
      debugLog('SyncService', 'processSyncQueue() finished (queue empty).'); // Added log
      return;
    }

    debugLog('SyncService', `Calling syncLocalChangesToBackend with ${itemsToSync.length} items.`); // Added log
    const pushResult = await this.syncLocalChangesToBackend(itemsToSync);
    debugLog('SyncService', 'syncLocalChangesToBackend finished.', { success: pushResult.success }); // Added log


    if (pushResult.success) {
      infoLog('SyncService', `Erfolgreich ${pushResult.results?.length || 'einige'} Änderungen zum Backend synchronisiert.`);
      const processedDexieIds = itemsToSync.map(item => item.id).filter(id => id !== undefined) as number[];
      debugLog('SyncService', `Deleting ${processedDexieIds.length} successfully synced items from queue.`); // Added log
      await this.db.syncQueue.bulkDelete(processedDexieIds);
      debugLog('SyncService', 'Erfolgreich synchronisierte Items aus SyncQueue entfernt.');
      this.updateQueueStatus(); // Status aktualisieren

      if (pushResult.results) {
        debugLog('SyncService', `Processing ${pushResult.results.length} push results.`); // Added log
        for (const res of pushResult.results) {
          const processedItem = itemsToSync.find(i => i.entity_id === res.entityId);
          if (processedItem && res.new_updated_at) {
            const apiEntityType = localEntityTypeToApiEntityType(processedItem.entity_type);
            const updatePayload = { id: res.entityId, updated_at: res.new_updated_at };
            debugLog('SyncService', `Updating local entity ${res.entityId} (${apiEntityType}) with new_updated_at.`); // Added log
            if (apiEntityType === 'accounts') {
              await this.tenantDbService.updateAccountInternal(updatePayload as Account, true);
            } else if (apiEntityType === 'account_groups') {
              await this.tenantDbService.updateAccountGroupInternal(updatePayload as AccountGroup, true);
            }
          }
        }
        debugLog('SyncService', 'Finished processing push results.'); // Added log
      }

    } else {
      const errorDetails = (pushResult as { success: false; error: string }).error;
      warnLog('SyncService', 'Synchronisation zum Backend fehlgeschlagen oder teilweise fehlgeschlagen.', { error: errorDetails });
      const now = new Date().toISOString();
      debugLog('SyncService', `Incrementing attempts for ${itemsToSync.length} failed sync items.`); // Added log
      for (const item of itemsToSync) {
        if (item.id) {
          const newAttempts = (item.attempts || 0) + 1;
          await this.db.syncQueue.update(item.id, {
            attempts: newAttempts,
            last_attempt_at: now,
          });
          warnLog('SyncService', `Sync-Versuch für Item ${item.id} (${item.entity_type} ${item.entity_id}) fehlgeschlagen. Versuch ${newAttempts}/${MAX_SYNC_ATTEMPTS}.`);
        }
      }
      debugLog('SyncService', 'Finished incrementing attempts.'); // Added log
    }
    debugLog('SyncService', 'Verarbeitung der SyncQueue abgeschlossen.');
    this.updateQueueStatus(); // Status aktualisieren
    debugLog('SyncService', 'processSyncQueue() finished.'); // Added log
  }

  public async performInitialSync(): Promise<void> {
    if (!this.db || !this.tenantId) {
      warnLog('SyncService', 'performInitialSync: Keine aktive Mandanten-DB oder Mandanten-ID.');
      return;
    }
    infoLog('SyncService', 'Starte Prüfung für Erstsynchronisierung.');

    let initialSyncNeeded = false;
    for (const entityType of SERVICE_ENTITY_TYPES) {
      const metadata = await this.db.syncMetadata.get(entityType);
      if (!metadata || !metadata.last_synced_at) {
        initialSyncNeeded = true;
        debugLog('SyncService', `Erstsynchronisierung für ${entityType} erforderlich.`);
        break;
      }
    }

    if (!initialSyncNeeded) {
      infoLog('SyncService', 'Keine Erstsynchronisierung erforderlich. Metadaten vorhanden.');
      await this.syncDownstreamChanges();
      return;
    }

    infoLog('SyncService', 'Führe Erstsynchronisierung durch...');
    try {
      for (const entityType of SERVICE_ENTITY_TYPES) {
        debugLog('SyncService', `Rufe initiale Daten für ${entityType} vom Backend ab.`);

        const pullResponse = await this.fetchInitialDataFromBackend<SyncableEntity>(entityType);
        let remoteData: SyncableEntity[] = [];
        let serverTimestamp: string | undefined;

        if (pullResponse.success) {
            remoteData = pullResponse.data;
            serverTimestamp = pullResponse.server_last_sync_timestamp;
        } else {
            // Expliziter Cast, um auf 'error' zugreifen zu können
            const errorResponse = pullResponse as { success: false; error: string };
            warnLog('SyncService', `Fehler beim Abrufen initialer Daten für ${entityType}`, { error: errorResponse.error });
        }

        infoLog('SyncService', `${remoteData.length} ${entityType}-Einträge vom Backend erhalten.`);

        if (remoteData.length > 0) {
          if (entityType === 'accounts') {
            await this.tenantDbService.bulkAddAccounts(remoteData as Account[], true);
          } else if (entityType === 'account_groups') {
            await this.tenantDbService.bulkAddAccountGroups(remoteData as AccountGroup[], true);
          }
        }

        const now = new Date().toISOString();
        await this.db.syncMetadata.put({
          entity_type: entityType,
          last_synced_at: pullResponse.success ? (serverTimestamp || now) : now,
        });
        debugLog('SyncService', `Metadaten für ${entityType} nach Erstsynchronisierung aktualisiert.`);
      }
      infoLog('SyncService', 'Erstsynchronisierung erfolgreich abgeschlossen.');
    } catch (err) {
      errorLog('SyncService', 'Fehler während der Erstsynchronisierung.', { error: err });
    }
  }

  public async syncDownstreamChanges(): Promise<void> {
    if (!this.db || !this.tenantId) {
      warnLog('SyncService', 'syncDownstreamChanges: Keine aktive Mandanten-DB oder Mandanten-ID.');
      return;
    }
    infoLog('SyncService', 'Starte Downstream-Synchronisierung (Backend -> Frontend).');

    try {
      for (const entityType of SERVICE_ENTITY_TYPES) {
        const metadata = await this.db.syncMetadata.get(entityType);
        const lastSyncTimestamp = metadata?.last_synced_at;

        debugLog('SyncService', `Rufe Änderungen für ${entityType} seit ${lastSyncTimestamp || 'Anfang'} vom Backend ab.`);

        const token = this.getAuthToken(); // Token abrufen
        const backendResponse = await this.fetchRemoteChangesFromBackend<SyncableEntity>(entityType, token, lastSyncTimestamp);

        if (!backendResponse.success) {
          const errorDetails = (backendResponse as { success: false; error: string }).error;
          warnLog('SyncService', `Fehler beim Abrufen von Änderungen für ${entityType}.`, { error: errorDetails });
          continue;
        }

        const backendChangesData = backendResponse.data;
        const serverLastSync = backendResponse.server_last_sync_timestamp;

        infoLog('SyncService', `${entityType}: ${backendChangesData.length} neue/aktualisierte Einträge vom Backend erhalten.`);

        for (const remoteEntity of backendChangesData) {
          const localEntity = await (entityType === 'accounts'
            ? this.db.accounts.get(remoteEntity.id)
            : this.db.accountGroups.get(remoteEntity.id));

          if (localEntity) {
            if (new Date(remoteEntity.updated_at) > new Date(localEntity.updated_at)) {
              debugLog('SyncService', `LWW: Remote ${entityType} ${remoteEntity.id} ist neuer. Update lokal.`);
              if (entityType === 'accounts') {
                await this.tenantDbService.updateAccountInternal(remoteEntity as Account, true);
              } else {
                await this.tenantDbService.updateAccountGroupInternal(remoteEntity as AccountGroup, true);
              }
            } else {
              debugLog('SyncService', `LWW: Lokal ${entityType} ${localEntity.id} ist neuer oder gleich alt. Remote-Änderung ignoriert.`);
            }
          } else {
            debugLog('SyncService', `Neue Entität ${entityType} ${remoteEntity.id} vom Backend. Lokal anlegen.`);
            if (entityType === 'accounts') {
              await this.tenantDbService.addAccountInternal(remoteEntity as Account, true);
            } else {
              await this.tenantDbService.addAccountGroupInternal(remoteEntity as AccountGroup, true);
            }
          }
        }
        if (serverLastSync) {
          await this.db.syncMetadata.put({ entity_type: entityType, last_synced_at: serverLastSync });
          debugLog('SyncService', `Metadaten für ${entityType} nach Downstream-Sync aktualisiert auf ${serverLastSync}.`);
        } else {
            warnLog('SyncService', `Kein server_last_sync_timestamp für ${entityType} erhalten.`);
        }
      }
      infoLog('SyncService', 'Downstream-Synchronisierung erfolgreich abgeschlossen.');
    } catch (err) {
      errorLog('SyncService', 'Fehler während der Downstream-Synchronisierung.', { error: err });
    }
  }

  public async synchronize(): Promise<void> {
    debugLog('SyncService', 'synchronize() called.'); // Added log
    if (this._isCurrentlySyncing.value) {
      warnLog('SyncService', 'Synchronisierung läuft bereits. Überspringe erneuten Aufruf von synchronize.');
      debugLog('SyncService', 'synchronize() finished (already syncing).'); // Added log
      return;
    }
    if (!navigator.onLine) {
      infoLog('SyncService', 'Offline. Synchronisierung wird übersprungen.');
      debugLog('SyncService', 'synchronize() finished (offline).'); // Added log
      return;
    }
    if (!this.tenantId) {
        warnLog('SyncService', 'Keine aktive Mandanten-ID. Synchronisierung wird übersprungen.');
        debugLog('SyncService', 'synchronize() finished (no tenant).'); // Added log
        return;
    }

    this._isCurrentlySyncing.value = true;
    infoLog('SyncService', 'Starte vollständigen Synchronisierungsprozess.');
    debugLog('SyncService', 'Starting full synchronization process.'); // Added log
    try {
      debugLog('SyncService', 'Calling processSyncQueue() to push local changes.'); // Added log
      await this.processSyncQueue();
      debugLog('SyncService', 'processSyncQueue() finished.'); // Added log

      debugLog('SyncService', 'Calling syncDownstreamChanges() to pull remote changes.'); // Added log
      await this.syncDownstreamChanges();
      debugLog('SyncService', 'syncDownstreamChanges() finished.'); // Added log

      infoLog('SyncService', 'Vollständiger Synchronisierungsprozess abgeschlossen.');
      debugLog('SyncService', 'Full synchronization process completed successfully.'); // Added log
    } catch (err) {
      errorLog('SyncService', 'Fehler während des Synchronisierungsprozesses.', { error: err });
      debugLog('SyncService', 'Full synchronization process finished with error.'); // Added log
    } finally {
      this._isCurrentlySyncing.value = false;
      this.updateQueueStatus(); // Queue-Status nach Sync aktualisieren
      debugLog('SyncService', 'synchronize() finished.'); // Added log
    }
  }

  public async triggerManualSync(): Promise<void> {
    if (this._isCurrentlySyncing.value) {
      warnLog('SyncService', 'Manuelle Synchronisierung angefordert, aber eine Synchronisierung läuft bereits.');
      return;
    }
    if (!navigator.onLine) {
      infoLog('SyncService', 'Manuelle Synchronisierung angefordert, aber offline.');
      // Hier könnte man dem Benutzer eine Meldung anzeigen
      return;
    }
     if (!this.tenantId) {
        warnLog('SyncService', 'Manuelle Synchronisierung angefordert, aber keine aktive Mandanten-ID.');
        return;
    }

    infoLog('SyncService', 'Manuelle Synchronisierung gestartet.');
    this._isCurrentlySyncing.value = true;
    try {
      await this.synchronize(); // Ruft die bestehende Methode auf, die nun isCurrentlySyncing intern verwaltet
      infoLog('SyncService', 'Manuelle Synchronisierung erfolgreich abgeschlossen.');
    } catch (error) {
      errorLog('SyncService', 'Fehler bei der manuellen Synchronisierung.', { error });
      // Ggf. spezifische Fehlerbehandlung für manuelle Synchronisation
    } finally {
      // synchronize() setzt isCurrentlySyncing bereits auf false, aber zur Sicherheit hier auch,
      // falls synchronize() vorzeitig abbricht, bevor es das Flag selbst zurücksetzt.
      // Dies ist doppelt gemoppelt, wenn synchronize() sauber durchläuft.
      // Besser ist es, wenn synchronize() das Flag zuverlässig selbst verwaltet.
      // Da synchronize jetzt das Flag selbst setzt und zurücksetzt, ist das hier nicht mehr nötig.
      // this._isCurrentlySyncing.value = false;
      infoLog('SyncService', 'Manuelle Synchronisierung beendet (finaler Block).');
      // Der Status von isCurrentlySyncing wird durch synchronize() selbst verwaltet.
      // Der Queue-Status wird ebenfalls in synchronize() oder processSyncQueue() aktualisiert.
    }
  }

  public triggerProcessSyncQueue(): void {
    if (!navigator.onLine) {
      debugLog('SyncService', 'triggerProcessSyncQueue: Offline, Queue wird nicht sofort verarbeitet.');
      return;
    }
    if (!this.tenantId) {
        warnLog('SyncService', 'triggerProcessSyncQueue: Keine aktive Mandanten-ID.');
        return;
    }
    debugLog('SyncService', 'triggerProcessSyncQueue aufgerufen.');
    // processSyncQueue sollte nicht direkt _isCurrentlySyncing setzen,
    // da es Teil von synchronize() ist, welches das Flag verwaltet.
    // Wenn processSyncQueue unabhängig aufgerufen wird, sollte es sein eigenes Sync-Flag haben
    // oder der Aufrufer sollte dafür verantwortlich sein.
    // Für den Moment belassen wir es so, dass synchronize() der Haupttreiber für isCurrentlySyncing ist.
    this.processSyncQueue().catch(err => {
      errorLog('SyncService', 'Fehler in triggerProcessSyncQueue beim Aufruf von processSyncQueue', { error: err });
    }).finally(() => {
        this.updateQueueStatus(); // Status nach Verarbeitung aktualisieren
    });
  }
}

// Globale Instanz des SyncService, um sicherzustellen, dass es ein Singleton ist.
// Dies ist eine einfache Form des Singleton-Musters für Vue Composables/Services.
// Besser wäre es, dies über Pinia zu verwalten, wenn der Service globalen Zustand hält.
// Für den Moment und die Aufgabenstellung belassen wir es bei dieser Struktur,
// aber der sync_button.vue sollte dieselbe Instanz verwenden.
// const syncServiceInstance = new SyncService();
// export const useSyncService = () => syncServiceInstance;
// Die obige Singleton-Logik ist hier nicht direkt anwendbar, da die Klasse exportiert wird.
// Der Aufrufer (z.B. in App.vue oder main.ts) sollte eine Instanz erstellen und bereitstellen,
// oder der sync_button.vue muss darauf zugreifen können.
// Da sync_button.vue `new SyncService()` macht, ist das problematisch.
// Für diese Aufgabe wird die Struktur nicht geändert, aber es ist ein wichtiger Punkt.
