import Dexie, { Table } from 'dexie';

export interface SyncQueueItem {
  id?: number; // Primärschlüssel, auto-inkrementierend
  tenantId: string; // ID des Mandanten, zu dem die Änderung gehört
  operation: 'create' | 'update' | 'delete';
  entity: 'Account' | 'AccountGroup';
  entityId: string | number; // ID der Entität, die synchronisiert werden soll
  payload: any; // Die Daten der Entität
  timestamp: Date;
  attempted?: boolean; // Flag, ob ein Sync-Versuch bereits stattgefunden hat
  error?: string; // Fehlermeldung, falls der Sync-Versuch fehlschlägt
}

export class FinWiseSyncDB extends Dexie {
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('finwiseSyncDB');
    this.version(1).stores({
      syncQueue: '++id, tenantId, operation, entity, entityId, timestamp, attempted', // Indizes
    });
  }
}

export const db = new FinWiseSyncDB();

/**
 * Fügt ein Element zur Synchronisationswarteschlange hinzu.
 * @param item Das Element, das zur Warteschlange hinzugefügt werden soll.
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'attempted' | 'error'>): Promise<number | undefined> {
  try {
    const newItem: SyncQueueItem = {
      ...item, // tenantId wird hier vom Aufrufer erwartet
      timestamp: new Date(),
      attempted: false,
    };
    const id = await db.syncQueue.add(newItem);
    console.info('[SyncQueueService]', `Element zur Sync Queue hinzugefügt (ID: ${id})`, newItem);
    return id;
  } catch (error) {
    console.error('[SyncQueueService]', 'Fehler beim Hinzufügen zur Sync Queue:', error, item);
    return undefined;
  }
}

/**
 * Ruft alle Elemente aus der Synchronisationswarteschlange ab.
 * @returns Ein Array von SyncQueueItem-Objekten.
 */
export async function getSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    return await db.syncQueue.toArray();
  } catch (error) {
    console.error('[SyncQueueService]', 'Fehler beim Abrufen der Sync Queue Items:', error);
    return [];
  }
}

/**
 * Aktualisiert ein Element in der Synchronisationswarteschlange.
 * @param id Die ID des zu aktualisierenden Elements.
 * @param changes Die Änderungen, die auf das Element angewendet werden sollen.
 */
export async function updateSyncQueueItem(id: number, changes: Partial<SyncQueueItem>): Promise<number> {
    try {
        const count = await db.syncQueue.update(id, changes);
        if (count > 0) {
            console.info('[SyncQueueService]', `Sync Queue Element (ID: ${id}) aktualisiert.`, changes);
        } else {
            console.warn('[SyncQueueService]', `Kein Sync Queue Element mit ID ${id} zum Aktualisieren gefunden.`);
        }
        return count;
    } catch (error) {
        console.error('[SyncQueueService]', `Fehler beim Aktualisieren des Sync Queue Elements (ID: ${id}):`, error, changes);
        throw error; // Fehler weiterleiten, damit der Aufrufer darauf reagieren kann
    }
}

/**
 * Entfernt ein Element aus der Synchronisationswarteschlange.
 * @param id Die ID des zu entfernenden Elements.
 */
export async function removeFromSyncQueue(id: number): Promise<void> {
  try {
    await db.syncQueue.delete(id);
    console.info('[SyncQueueService]', `Element (ID: ${id}) aus Sync Queue entfernt.`);
  } catch (error) {
    console.error('[SyncQueueService]', `Fehler beim Entfernen des Elements (ID: ${id}) aus der Sync Queue:`, error);
  }
}

/**
 * Markiert Elemente als Synchronisationsversuch unternommen.
 * @param ids Array von IDs der Elemente, die markiert werden sollen.
 */
export async function markItemsAsAttempted(ids: number[]): Promise<void> {
    try {
        await db.syncQueue.where('id').anyOf(ids).modify({ attempted: true });
        console.info('[SyncQueueService]', `Elemente ${ids.join(', ')} als 'attempted' markiert.`);
    } catch (error) {
        console.error('[SyncQueueService]', `Fehler beim Markieren der Elemente ${ids.join(', ')} als 'attempted':`, error);
    }
}

/**
 * Ruft alle noch nicht erfolgreich synchronisierten Elemente ab,
 * die entweder noch nicht versucht wurden oder bei denen ein Fehler aufgetreten ist.
 * Sortiert nach Zeitstempel (älteste zuerst).
 * @returns Ein Array von SyncQueueItem-Objekten.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
    try {
        return await db.syncQueue
            .where('attempted').equals(0) // Entweder noch nicht versucht (0 für false)
            .or('error').notEqual('')     // oder mit Fehler
            .sortBy('timestamp');
    } catch (error) {
        console.error('[SyncQueueService]', 'Fehler beim Abrufen der ausstehenden Sync Queue Items:', error);
        return [];
    }
}
