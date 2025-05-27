# Erweiterung des SyncService für neue Entitäten

Dieses Dokument beschreibt, wie der `SyncService` in FinWise erweitert werden muss, um neue Entitätstypen (Datenbank-Tabellen) in den Synchronisierungsprozess zwischen IndexedDB (Frontend) und dem Backend einzubinden.

## Voraussetzungen

Bevor der `SyncService` eine neue Entität synchronisieren kann, müssen folgende Voraussetzungen erfüllt sein:

1.  **Typdefinition in `src/types/index.ts`:**
    *   Die neue Entität muss das `SyncableEntity`-Interface erweitern (oder zumindest `id`, `created_at`, `updated_at` besitzen).
    *   Beispiel:
        ```typescript
        export interface MyNewEntity extends SyncableEntity {
          // ... spezifische Felder für MyNewEntity
          name: string;
          value: number;
        }
        ```

2.  **IndexedDB-Tabelle im `tenantStore.ts`:**
    *   In der Klasse `FinwiseTenantSpecificDB` muss eine neue `Table<MyNewEntity, string>` deklariert werden.
    *   Das Schema der Datenbank (`this.version(X).stores({...})`) muss um die neue Tabelle erweitert werden, inklusive relevanter Indizes und der Felder `created_at` und `updated_at`.
        ```typescript
        // In FinwiseTenantSpecificDB
        myNewEntities!: Table<MyNewEntity, string>;

        // In this.version(X).stores({...})
        this.version(Y).stores({
          // ... andere Tabellen
          myNewEntities: '&id, name, created_at, updated_at', // &id für Primärschlüssel, ggf. weitere Indizes
          // ... ggf. syncQueue und syncMetadata anpassen, falls noch nicht geschehen
        });
        ```
    *   Eine entsprechende Upgrade-Funktion in `.upgrade()` muss ggf. `created_at` und `updated_at` für bestehende Daten initialisieren.

3.  **CRUD-Methoden im `TenantDbService.ts`:**
    *   Für die neue Entität müssen CRUD-Methoden (z.B. `addMyNewEntity`, `updateMyNewEntity`, `deleteMyNewEntity`, `getMyNewEntityById`, `getAllMyNewEntities`) implementiert werden.
    *   Diese Methoden müssen:
        *   Die Zeitstempel `created_at` und `updated_at` korrekt setzen.
        *   Einen optionalen Parameter `skipSyncQueue: boolean` akzeptieren.
        *   Bei `skipSyncQueue = false` (Standard) einen Eintrag in die `syncQueue` über `this._addChangeToSyncQueue(...)` erstellen.
    *   Es sollten auch interne Varianten (`addMyNewEntityInternal`, `updateMyNewEntityInternal`) und Bulk-Operationen (`bulkAddMyNewEntities`, `bulkDeleteMyNewEntities`) analog zu `Account` und `AccountGroup` implementiert werden, die vom `SyncService` genutzt werden können und `skipSyncQueue` berücksichtigen.

## Anpassungen im `SyncService.ts`

Um eine neue Entität (`MyNewEntity`) im `SyncService` zu unterstützen, sind folgende Schritte notwendig:

1.  **Typen erweitern:**
    *   In den `fetchRemoteChangesFromBackend` und `fetchInitialDataFromBackend` Methoden muss der `entityType`-Parameter und die generische Typisierung `T` um `'MyNewEntity'` erweitert werden.
        ```typescript
        // Beispiel für entityType
        entityType: 'Account' | 'AccountGroup' | 'MyNewEntity',

        // Beispiel für fetchRemoteChangesFromBackend
        private async fetchRemoteChangesFromBackend<T extends SyncableEntity>(
          entityType: 'Account' | 'AccountGroup' | 'MyNewEntity',
          // ...
        ): Promise<BackendChanges<T>> { /* ... */ }

        // Beispiel für fetchInitialDataFromBackend
        private async fetchInitialDataFromBackend<T extends SyncableEntity>(
          entityType: 'Account' | 'AccountGroup' | 'MyNewEntity',
        ): Promise<T[]> { /* ... */ }
        ```

2.  **`performInitialSync()` anpassen:**
    *   Die Konstante `entityTypesToSync` muss um `'MyNewEntity'` erweitert werden.
        ```typescript
        const entityTypesToSync: ('Account' | 'AccountGroup' | 'MyNewEntity')[] = ['Account', 'AccountGroup', 'MyNewEntity'];
        ```
    *   Im `try`-Block, der die `entityTypesToSync` durchläuft, muss ein neuer `else if`-Zweig für `MyNewEntity` hinzugefügt werden, um die Daten über die entsprechende `bulkAddMyNewEntities`-Methode des `TenantDbService` zu speichern.
        ```typescript
        // Innerhalb der Schleife in performInitialSync
        if (entityType === 'Account') {
          await this.tenantDbService.bulkAddAccounts(remoteData as Account[], true);
        } else if (entityType === 'AccountGroup') {
          await this.tenantDbService.bulkAddAccountGroups(remoteData as AccountGroup[], true);
        } else if (entityType === 'MyNewEntity') { // NEU
          await this.tenantDbService.bulkAddMyNewEntities(remoteData as MyNewEntity[], true);
        }
        ```

3.  **`syncDownstreamChanges()` anpassen:**
    *   Die Konstante `entityTypesToSync` muss um `'MyNewEntity'` erweitert werden (identisch zu `performInitialSync`).
    *   **Gelöschte Entitäten:** Im `if (backendChanges.deleted_ids.length > 0)`-Block muss ein `else if`-Zweig für `MyNewEntity` hinzugefügt werden, um `this.tenantDbService.bulkDeleteMyNewEntities(...)` aufzurufen.
        ```typescript
        // Innerhalb der Verarbeitung von deleted_ids
        if (entityType === 'Account') {
          await this.tenantDbService.bulkDeleteAccounts(backendChanges.deleted_ids, true);
        } else if (entityType === 'AccountGroup') {
          await this.tenantDbService.bulkDeleteAccountGroups(backendChanges.deleted_ids, true);
        } else if (entityType === 'MyNewEntity') { // NEU
          await this.tenantDbService.bulkDeleteMyNewEntities(backendChanges.deleted_ids, true);
        }
        ```
    *   **Neue/Aktualisierte Entitäten:**
        *   Beim Abrufen der lokalen Entität (`localEntity`) muss ein `else if`-Zweig für `MyNewEntity` hinzugefügt werden.
            ```typescript
            const localEntity = await (entityType === 'Account'
              ? this.db.accounts.get(remoteEntity.id)
              : entityType === 'AccountGroup'
                ? this.db.accountGroups.get(remoteEntity.id)
                : entityType === 'MyNewEntity' // NEU
                  ? this.db.myNewEntities.get(remoteEntity.id) // Annahme: Tabelle heißt myNewEntities
                  : null); // Fallback oder Fehlerbehandlung
            ```
        *   Bei der Konfliktlösung (LWW) und dem anschließenden Speichern (`update...Internal` oder `add...Internal`) müssen ebenfalls `else if`-Zweige für `MyNewEntity` hinzugefügt werden, die die entsprechenden Methoden des `TenantDbService` aufrufen.
            ```typescript
            // Update-Fall
            if (entityType === 'Account') {
              await this.tenantDbService.updateAccountInternal(remoteEntity as Account, true);
            } else if (entityType === 'AccountGroup') {
              await this.tenantDbService.updateAccountGroupInternal(remoteEntity as AccountGroup, true);
            } else if (entityType === 'MyNewEntity') { // NEU
              await this.tenantDbService.updateMyNewEntityInternal(remoteEntity as MyNewEntity, true);
            }

            // Create-Fall
            if (entityType === 'Account') {
              await this.tenantDbService.addAccountInternal(remoteEntity as Account, true);
            } else if (entityType === 'AccountGroup') {
              await this.tenantDbService.addAccountGroupInternal(remoteEntity as AccountGroup, true);
            } else if (entityType === 'MyNewEntity') { // NEU
              await this.tenantDbService.addMyNewEntityInternal(remoteEntity as MyNewEntity, true);
            }
            ```

4.  **Backend-Kommunikation (`syncLocalChangesToBackend`, `fetchRemoteChangesFromBackend`, `fetchInitialDataFromBackend`):**
    *   Die Platzhalter-Funktionen (oder die echten Implementierungen) müssen so angepasst werden, dass sie Anfragen für `MyNewEntity` korrekt an das Backend senden und die Antworten verarbeiten können. Dies betrifft typischerweise Query-Parameter (`?entityType=MyNewEntity`) oder unterschiedliche Endpunkte pro Entität.
    *   Die `syncLocalChangesToBackend` Methode muss ggf. die `changes: SyncQueueItem[]` nach `entity_type` gruppieren, falls das Backend separate Endpunkte pro Entitätstyp für Batch-Updates erwartet. Aktuell sendet es alle Items gemischt.

## Backend-Anforderungen

Das Backend muss ebenfalls für die neue Entität `MyNewEntity` vorbereitet werden:

*   Entsprechendes Datenmodell im Backend (mit `id`, `created_at`, `updated_at`).
*   API-Endpunkte für:
    *   Batch-Verarbeitung von Änderungen (`POST /sync/changes` muss `MyNewEntity` verarbeiten können).
    *   Abruf von Delta-Änderungen (`GET /sync/changes/{tenantId}?entityType=MyNewEntity&since={timestamp}`).
    *   Abruf von Initialdaten (`GET /sync/initial/{tenantId}?entityType=MyNewEntity`).

## Zusammenfassung

Die Erweiterung des `SyncService` für neue Entitäten erfordert sorgfältige Anpassungen an mehreren Stellen im Frontend-Code (`types`, `tenantStore`, `TenantDbService`, `SyncService`) sowie korrespondierende Anpassungen im Backend. Durch Befolgen dieser Anleitung kann die Synchronisierungslogik konsistent erweitert werden.
