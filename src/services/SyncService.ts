// src/services/SyncService.ts
import { useTenantStore, type FinwiseTenantSpecificDB, type SyncQueueItem, type SyncMetadataItem } from '@/stores/tenantStore';
import type { Account, AccountGroup, SyncableEntity } from '@/types';
import { TenantDbService } from './TenantDbService';
import { errorLog, warnLog, debugLog, infoLog } from '@/utils/logger';

// Platzhalter-Typen für Backend-Antworten
export interface SyncResult {
  success: boolean;
  processed_ids: (number | string)[]; // IDs der erfolgreich verarbeiteten SyncQueueItems oder Entitäts-IDs
  errors?: { entity_id: string; message: string }[];
}

export interface BackendChanges<T extends SyncableEntity> {
  new_or_updated: T[];
  deleted_ids: string[];
  new_last_synced_timestamp: string;
}

const MAX_SYNC_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000 * 60; // 1 Minute

export class SyncService {
  private tenantStore = useTenantStore();
  private tenantDbService = new TenantDbService(); // Instanz für DB-Operationen

  private get db(): FinwiseTenantSpecificDB | null {
    return this.tenantStore.activeTenantDB;
  }

  constructor() {
    debugLog('SyncService', 'SyncService initialisiert.');
    // Hier könnten Listener für Online/Offline-Status oder periodische Syncs eingerichtet werden.
  }

  // PLATZHALTER für Backend-Kommunikation
  private async syncLocalChangesToBackend(changes: SyncQueueItem[]): Promise<SyncResult> {
    debugLog('SyncService', 'syncLocalChangesToBackend aufgerufen (PLATZHALTER)', { count: changes.length });
    // Hier würde der API-Aufruf an das Backend erfolgen, z.B. POST /sync/changes
    // Annahme: Backend verarbeitet Batch und gibt Ergebnis zurück
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simuliere Netzwerk-Latenz

    // Simuliertes Ergebnis: Alle erfolgreich
    return {
      success: true,
      processed_ids: changes.map(c => c.id).filter(id => id !== undefined) as number[],
    };
  }

  private async fetchRemoteChangesFromBackend<T extends SyncableEntity>(
    entityType: 'Account' | 'AccountGroup',
    lastSyncTimestamp?: string | null,
  ): Promise<BackendChanges<T>> {
    debugLog('SyncService', `fetchRemoteChangesFromBackend für ${entityType} aufgerufen (PLATZHALTER)`, { lastSyncTimestamp });
    // Hier würde der API-Aufruf an das Backend erfolgen, z.B. GET /sync/changes/{tenantId}?entityType=...&since=...
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simuliere Netzwerk-Latenz

    // Simuliertes Ergebnis: Keine Änderungen
    return {
      new_or_updated: [],
      deleted_ids: [],
      new_last_synced_timestamp: lastSyncTimestamp || new Date(0).toISOString(),
    };
  }

  private async fetchInitialDataFromBackend<T extends SyncableEntity>(
    entityType: 'Account' | 'AccountGroup',
  ): Promise<T[]> {
    debugLog('SyncService', `fetchInitialDataFromBackend für ${entityType} aufgerufen (PLATZHALTER)`);
    // Hier würde der API-Aufruf an das Backend erfolgen, z.B. GET /sync/initial/{tenantId}?entityType=...
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simuliere Netzwerk-Latenz
    // Simuliertes Ergebnis: Leeres Array
    return [];
  }

  /**
   * Verarbeitet die Synchronisierungs-Queue und sendet lokale Änderungen an das Backend.
   */
  public async processSyncQueue(): Promise<void> {
    if (!this.db) {
      warnLog('SyncService', 'processSyncQueue: Keine aktive Mandanten-DB.');
      return;
    }
    debugLog('SyncService', 'Starte Verarbeitung der SyncQueue.');

    const itemsToSync = await this.db.syncQueue
      .where('attempts')
      .below(MAX_SYNC_ATTEMPTS)
      .toArray();

    if (itemsToSync.length === 0) {
      debugLog('SyncService', 'SyncQueue ist leer oder alle Items haben maximale Versuche erreicht.');
      return;
    }

    // TODO: Gruppieren nach Entitätstyp oder alle zusammen senden?
    // Fürs Erste senden wir alle zusammen, wenn das Backend Batch-Operationen über verschiedene Typen unterstützt.
    // Andernfalls müsste hier nach entity_type gruppiert und separat gesendet werden.

    try {
      const result = await this.syncLocalChangesToBackend(itemsToSync);

      if (result.success) {
        infoLog('SyncService', `Erfolgreich ${result.processed_ids.length} Änderungen zum Backend synchronisiert.`);
        await this.db.syncQueue.bulkDelete(result.processed_ids as number[]);
        debugLog('SyncService', 'Erfolgreich synchronisierte Items aus SyncQueue entfernt.');
      } else {
        warnLog('SyncService', 'Teilweise oder keine erfolgreiche Synchronisation zum Backend.', { result });
        // Fehlerbehandlung für nicht verarbeitete Items
        const failedItems = itemsToSync.filter(item => item.id && !result.processed_ids.includes(item.id));
        for (const item of failedItems) {
          if (item.id) {
            const newAttempts = item.attempts + 1;
            await this.db.syncQueue.update(item.id, {
              attempts: newAttempts,
              last_attempt_at: new Date().toISOString(),
            });
            warnLog('SyncService', `Sync-Versuch für Item ${item.id} (${item.entity_type} ${item.entity_id}) fehlgeschlagen. Versuch ${newAttempts}/${MAX_SYNC_ATTEMPTS}.`);
          }
        }
        if (result.errors) {
          for (const err of result.errors) {
            errorLog('SyncService', `Backend-Fehler für Entity ${err.entity_id}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      errorLog('SyncService', 'Schwerer Fehler beim Senden von Änderungen an das Backend.', { error: err });
      // Alle als fehlgeschlagen markieren für diesen Batch
      const now = new Date().toISOString();
      for (const item of itemsToSync) {
        if (item.id) {
          await this.db.syncQueue.update(item.id, {
            attempts: item.attempts + 1,
            last_attempt_at: now,
          });
        }
      }
    }
    debugLog('SyncService', 'Verarbeitung der SyncQueue abgeschlossen.');
  }

  /**
   * Führt eine Erstsynchronisierung für den aktuellen Mandanten durch, falls notwendig.
   * Ruft alle Daten vom Backend ab und speichert sie lokal.
   */
  public async performInitialSync(): Promise<void> {
    if (!this.db) {
      warnLog('SyncService', 'performInitialSync: Keine aktive Mandanten-DB.');
      return;
    }
    infoLog('SyncService', 'Starte Prüfung für Erstsynchronisierung.');

    const entityTypesToSync: ('Account' | 'AccountGroup')[] = ['Account', 'AccountGroup'];
    let initialSyncNeeded = false;

    for (const entityType of entityTypesToSync) {
      const metadata = await this.db.syncMetadata.get(entityType);
      if (!metadata || !metadata.last_synced_at) {
        initialSyncNeeded = true;
        debugLog('SyncService', `Erstsynchronisierung für ${entityType} erforderlich.`);
        break;
      }
    }

    if (!initialSyncNeeded) {
      infoLog('SyncService', 'Keine Erstsynchronisierung erforderlich. Metadaten vorhanden.');
      // Optional: Hier Delta-Sync anstoßen, falls gewünscht
      // await this.syncDownstreamChanges();
      return;
    }

    infoLog('SyncService', 'Führe Erstsynchronisierung durch...');
    try {
      for (const entityType of entityTypesToSync) {
        debugLog('SyncService', `Rufe initiale Daten für ${entityType} vom Backend ab.`);
        const remoteData = await this.fetchInitialDataFromBackend<Account | AccountGroup>(entityType); // Typisierung anpassen
        infoLog('SyncService', `${remoteData.length} ${entityType}-Einträge vom Backend erhalten.`);

        if (remoteData.length > 0) {
          if (entityType === 'Account') {
            await this.tenantDbService.bulkAddAccounts(remoteData as Account[], true); // skipSyncQueue = true
          } else if (entityType === 'AccountGroup') {
            await this.tenantDbService.bulkAddAccountGroups(remoteData as AccountGroup[], true); // skipSyncQueue = true
          }
        }
        const now = new Date().toISOString();
        await this.db.syncMetadata.put({ entity_type: entityType, last_synced_at: now });
        debugLog('SyncService', `Metadaten für ${entityType} nach Erstsynchronisierung aktualisiert auf ${now}.`);
      }
      infoLog('SyncService', 'Erstsynchronisierung erfolgreich abgeschlossen.');
    } catch (err) {
      errorLog('SyncService', 'Fehler während der Erstsynchronisierung.', { error: err });
      // Hier könnte man entscheiden, ob Metadaten teilweise aktualisiert werden oder nicht.
    }
  }

  /**
   * Ruft Änderungen vom Backend ab (Delta-Sync) und wendet sie lokal an.
   */
  public async syncDownstreamChanges(): Promise<void> {
    if (!this.db) {
      warnLog('SyncService', 'syncDownstreamChanges: Keine aktive Mandanten-DB.');
      return;
    }
    infoLog('SyncService', 'Starte Downstream-Synchronisierung (Backend -> Frontend).');

    const entityTypesToSync: ('Account' | 'AccountGroup')[] = ['Account', 'AccountGroup'];

    try {
      for (const entityType of entityTypesToSync) {
        const metadata = await this.db.syncMetadata.get(entityType);
        const lastSyncTimestamp = metadata?.last_synced_at;

        debugLog('SyncService', `Rufe Änderungen für ${entityType} seit ${lastSyncTimestamp || 'Anfang'} vom Backend ab.`);
        const backendChanges = await this.fetchRemoteChangesFromBackend<Account | AccountGroup>(entityType, lastSyncTimestamp);

        infoLog('SyncService', `${entityType}: ${backendChanges.new_or_updated.length} neue/aktualisierte, ${backendChanges.deleted_ids.length} gelöschte Einträge vom Backend erhalten.`);

        // Gelöschte Entitäten verarbeiten
        if (backendChanges.deleted_ids.length > 0) {
          if (entityType === 'Account') {
            await this.tenantDbService.bulkDeleteAccounts(backendChanges.deleted_ids, true); // skipSyncQueue = true
          } else if (entityType === 'AccountGroup') {
            await this.tenantDbService.bulkDeleteAccountGroups(backendChanges.deleted_ids, true); // skipSyncQueue = true
          }
          debugLog('SyncService', `${backendChanges.deleted_ids.length} ${entityType}-Einträge lokal gelöscht (via Backend-Sync).`);
        }

        // Neue oder aktualisierte Entitäten verarbeiten
        for (const remoteEntity of backendChanges.new_or_updated) {
          const localEntity = await (entityType === 'Account'
            ? this.db.accounts.get(remoteEntity.id)
            : this.db.accountGroups.get(remoteEntity.id));

          if (localEntity) {
            // Update - Konfliktlösung: Last Write Wins (LWW)
            if (new Date(remoteEntity.updated_at) > new Date(localEntity.updated_at)) {
              // Remote ist neuer, lokales Update
              debugLog('SyncService', `LWW: Remote ${entityType} ${remoteEntity.id} ist neuer. Update lokal.`);
              if (entityType === 'Account') {
                await this.tenantDbService.updateAccountInternal(remoteEntity as Account, true); // skipSyncQueue = true
              } else {
                await this.tenantDbService.updateAccountGroupInternal(remoteEntity as AccountGroup, true); // skipSyncQueue = true
              }
            } else {
              // Lokal ist neuer oder gleich alt, nichts tun (lokale Änderung wird ggf. via processSyncQueue gesendet)
              debugLog('SyncService', `LWW: Lokal ${entityType} ${localEntity.id} ist neuer oder gleich alt. Remote-Änderung ignoriert.`);
            }
          } else {
            // Create - Entität existiert lokal nicht, neu anlegen
            debugLog('SyncService', `Neue Entität ${entityType} ${remoteEntity.id} vom Backend. Lokal anlegen.`);
            if (entityType === 'Account') {
              await this.tenantDbService.addAccountInternal(remoteEntity as Account, true); // skipSyncQueue = true
            } else {
              await this.tenantDbService.addAccountGroupInternal(remoteEntity as AccountGroup, true); // skipSyncQueue = true
            }
          }
        }
        // Metadaten aktualisieren
        await this.db.syncMetadata.put({ entity_type: entityType, last_synced_at: backendChanges.new_last_synced_timestamp });
        debugLog('SyncService', `Metadaten für ${entityType} nach Downstream-Sync aktualisiert auf ${backendChanges.new_last_synced_timestamp}.`);
      }
      infoLog('SyncService', 'Downstream-Synchronisierung erfolgreich abgeschlossen.');
    } catch (err) {
      errorLog('SyncService', 'Fehler während der Downstream-Synchronisierung.', { error: err });
    }
  }

   /**
   * Triggert den gesamten Synchronisierungsprozess:
   * 1. Sende lokale Änderungen (Upstream).
   * 2. Hole Änderungen vom Server (Downstream).
   */
  public async synchronize(): Promise<void> {
    infoLog('SyncService', 'Starte vollständigen Synchronisierungsprozess.');
    // TODO: Online-Status prüfen, bevor API-Aufrufe gemacht werden.
    // navigator.onLine

    await this.processSyncQueue(); // Lokale Änderungen zuerst senden
    await this.syncDownstreamChanges(); // Dann Änderungen vom Server holen

    infoLog('SyncService', 'Vollständiger Synchronisierungsprozess abgeschlossen.');
  }

  /**
   * Wird aufgerufen, wenn eine lokale Änderung stattgefunden hat,
   * um die Verarbeitung der SyncQueue anzustoßen (falls online).
   */
  public triggerProcessSyncQueue(): void {
    // TODO: Online-Status prüfen
    // if (navigator.onLine) {
    debugLog('SyncService', 'triggerProcessSyncQueue aufgerufen.');
    this.processSyncQueue().catch(err => {
      errorLog('SyncService', 'Fehler in triggerProcessSyncQueue beim Aufruf von processSyncQueue', { error: err });
    });
    // } else {
    //   debugLog('SyncService', 'triggerProcessSyncQueue: Offline, Queue wird nicht sofort verarbeitet.');
    // }
  }
}

// Globale Instanz des SyncService, falls benötigt oder über Pinia Plugin/Injection bereitstellen
// export const syncService = new SyncService();
