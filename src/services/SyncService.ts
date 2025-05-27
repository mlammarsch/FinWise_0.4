// src/services/SyncService.ts
import { useTenantStore, type FinwiseTenantSpecificDB, type SyncQueueItem as LocalSyncQueueItem } from '@/stores/tenantStore';
import type { Account, AccountGroup, SyncableEntity } from '@/types';
import { TenantDbService } from './TenantDbService';
import { errorLog, warnLog, debugLog, infoLog } from '@/utils/logger';
import { syncApi, type PushResponse, type PullResponse, type EntityType as ApiEntityType, type SyncQueueItem as ApiSyncQueueItem } from '@/api/syncApi';
import { v4 as uuidv4 } from 'uuid';
import { ref, readonly, type Ref } from 'vue'; // Hinzugefügt für Reaktivität

const MAX_SYNC_ATTEMPTS = 5;

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
  private tenantDbService = new TenantDbService();

  // Reaktive Zustände
  private readonly _isQueueEmpty = ref(true);
  public readonly isQueueEmpty: Readonly<Ref<boolean>> = readonly(this._isQueueEmpty);

  private readonly _isCurrentlySyncing = ref(false);
  public readonly isCurrentlySyncing: Readonly<Ref<boolean>> = readonly(this._isCurrentlySyncing);


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
    this.tenantStore.$subscribe(() => {
        this.updateQueueStatus();
    });
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
    return {
      id: uuidv4(),
      entityType: localEntityTypeToApiEntityType(localItem.entity_type),
      entityId: localItem.entity_id,
      action: operationToAction(localItem.operation),
      payload: localItem.payload as Partial<SyncableEntity>, // Annahme: Payload ist bereits korrekt strukturiert
      timestamp: localItem.timestamp || new Date().toISOString(),
      tenantId: tenantId, // tenantId wird jetzt übergeben
    };
  }

  private async syncLocalChangesToBackend(localChanges: LocalSyncQueueItem[]): Promise<PushResponse | { success: false; error: string }> {
    const currentTenantId = this.tenantId;
    if (!currentTenantId) {
      const errorMsg = 'Keine aktive Mandanten-ID für Backend-Sync.';
      warnLog('SyncService', `syncLocalChangesToBackend: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    debugLog('SyncService', 'syncLocalChangesToBackend aufgerufen', { count: localChanges.length });

    const apiChanges = localChanges.map(item => this.mapLocalQueueItemToApiQueueItem(item, currentTenantId));

    const response = await syncApi.pushChanges(apiChanges);
    if (!response.success) {
      errorLog('SyncService', 'Fehler beim Pushen von Änderungen zum Backend.', { error: (response as { error: string }).error });
    }
    return response;
  }

  private async fetchRemoteChangesFromBackend<T extends SyncableEntity>(
    entityType: ApiEntityType,
    lastSyncTimestamp?: string | null,
  ): Promise<PullResponse<T> | { success: false; error: string }> {
    const currentTenantId = this.tenantId;
    if (!currentTenantId) {
      const errorMsg = 'Keine aktive Mandanten-ID für Backend-Sync.';
      warnLog('SyncService', `fetchRemoteChangesFromBackend: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    debugLog('SyncService', `fetchRemoteChangesFromBackend für ${entityType} aufgerufen`, { lastSyncTimestamp });
    const response = await syncApi.pullChanges<T>(entityType, currentTenantId, lastSyncTimestamp || undefined);

    if (!response.success) {
      errorLog('SyncService', `Fehler beim Pullen von Änderungen für ${entityType} vom Backend.`, { error: (response as { error: string }).error });
    }
    return response;
  }

  private async fetchInitialDataFromBackend<T extends SyncableEntity>(
    entityType: ApiEntityType,
  ): Promise<PullResponse<T> | { success: false; error: string }> {
    debugLog('SyncService', `fetchInitialDataFromBackend für ${entityType} aufgerufen`);
    return this.fetchRemoteChangesFromBackend<T>(entityType, null);
  }

  public async processSyncQueue(): Promise<void> {
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

    if (itemsToSync.length === 0) {
      debugLog('SyncService', 'SyncQueue ist leer oder alle Items haben maximale Versuche erreicht für aktuellen Mandant.');
      this.updateQueueStatus(); // Status aktualisieren
      return;
    }

    const pushResult = await this.syncLocalChangesToBackend(itemsToSync);

    if (pushResult.success) {
      infoLog('SyncService', `Erfolgreich ${pushResult.results?.length || 'einige'} Änderungen zum Backend synchronisiert.`);
      const processedDexieIds = itemsToSync.map(item => item.id).filter(id => id !== undefined) as number[];
      await this.db.syncQueue.bulkDelete(processedDexieIds);
      debugLog('SyncService', 'Erfolgreich synchronisierte Items aus SyncQueue entfernt.');
      this.updateQueueStatus(); // Status aktualisieren

      if (pushResult.results) {
        for (const res of pushResult.results) {
          const processedItem = itemsToSync.find(i => i.entity_id === res.entityId);
          if (processedItem && res.new_updated_at) {
            const apiEntityType = localEntityTypeToApiEntityType(processedItem.entity_type);
            const updatePayload = { id: res.entityId, updated_at: res.new_updated_at };
            if (apiEntityType === 'accounts') {
              await this.tenantDbService.updateAccountInternal(updatePayload as Account, true);
            } else if (apiEntityType === 'account_groups') {
              await this.tenantDbService.updateAccountGroupInternal(updatePayload as AccountGroup, true);
            }
          }
        }
      }

    } else {
      const errorDetails = (pushResult as { success: false; error: string }).error;
      warnLog('SyncService', 'Synchronisation zum Backend fehlgeschlagen oder teilweise fehlgeschlagen.', { error: errorDetails });
      const now = new Date().toISOString();
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
    }
    debugLog('SyncService', 'Verarbeitung der SyncQueue abgeschlossen.');
    this.updateQueueStatus(); // Status aktualisieren
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

        const backendResponse = await this.fetchRemoteChangesFromBackend<SyncableEntity>(entityType, lastSyncTimestamp);

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
    if (this._isCurrentlySyncing.value) {
      warnLog('SyncService', 'Synchronisierung läuft bereits. Überspringe erneuten Aufruf von synchronize.');
      return;
    }
    if (!navigator.onLine) {
      infoLog('SyncService', 'Offline. Synchronisierung wird übersprungen.');
      return;
    }
    if (!this.tenantId) {
        warnLog('SyncService', 'Keine aktive Mandanten-ID. Synchronisierung wird übersprungen.');
        return;
    }

    this._isCurrentlySyncing.value = true;
    infoLog('SyncService', 'Starte vollständigen Synchronisierungsprozess.');
    try {
      await this.processSyncQueue();
      await this.syncDownstreamChanges();
      infoLog('SyncService', 'Vollständiger Synchronisierungsprozess abgeschlossen.');
    } catch (err) {
      errorLog('SyncService', 'Fehler während des Synchronisierungsprozesses.', { error: err });
    } finally {
      this._isCurrentlySyncing.value = false;
      this.updateQueueStatus(); // Queue-Status nach Sync aktualisieren
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
