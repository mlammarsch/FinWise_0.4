# Erweiterung des SyncService für neue Entitäten

Dieses Dokument beschreibt, wie der `SyncService` in FinWise erweitert werden muss, um neue Entitätstypen (Datenbank-Tabellen) in den Synchronisierungsprozess zwischen IndexedDB (Frontend) und dem FastAPI-Backend einzubinden. Die Beschreibung berücksichtigt die strikte Mandantentrennung im Backend durch separate Datenbanken pro Mandant.

## Voraussetzungen

Bevor der `SyncService` eine neue Entität synchronisieren kann, müssen folgende Voraussetzungen im Frontend erfüllt sein:

1.  **Typdefinition in [`src/types/index.ts`](../src/types/index.ts:1):**
    *   Die neue Entität muss das `SyncableEntity`-Interface erweitern (oder zumindest `id: string`, `created_at: string`, `updated_at: string` besitzen). UUIDs für `id` werden dringend empfohlen.
    *   Das Feld `tenant_id: string` sollte in den Typen vorhanden sein. Obwohl die Backend-Datenbankauswahl über den Authentifizierungskontext (JWT) erfolgt, dient dieses Feld der Datenintegrität innerhalb der mandantenspezifischen Datenbank und kann für lokale Logik im Frontend nützlich sein.
    *   Beispiel:
        ```typescript
        export interface MyNewEntity extends SyncableEntity {
          // ... spezifische Felder für MyNewEntity
          name: string;
          value: number;
          tenant_id: string; // Wichtig für Datenintegrität und lokale Logik
        }
        ```

2.  **IndexedDB-Tabelle im `tenantStore.ts` (z.B. [`src/stores/tenantStore.ts`](../src/stores/tenantStore.ts:1)):**
    *   In der Klasse `FinwiseTenantSpecificDB` muss eine neue `Table<MyNewEntity, string>` deklariert werden.
    *   Das Schema der Datenbank (`this.version(X).stores({...})`) muss um die neue Tabelle erweitert werden, inklusive relevanter Indizes und der Felder `created_at` und `updated_at`.
        ```typescript
        // In FinwiseTenantSpecificDB
        myNewEntities!: Table<MyNewEntity, string>;

        // In this.version(X).stores({...})
        this.version(Y).stores({
          // ... andere Tabellen
          myNewEntities: '&id, name, created_at, updated_at', // tenant_id ist hier nicht als Index nötig, da die DB selbst mandantenspezifisch ist
        });
        ```
    *   Eine entsprechende Upgrade-Funktion in `.upgrade()` muss ggf. `created_at` und `updated_at` für bestehende Daten initialisieren (z.B. mit `new Date(0).toISOString()`).

3.  **CRUD-Methoden im `TenantDbService.ts` (z.B. [`src/services/TenantDbService.ts`](../src/services/TenantDbService.ts:1)):**
    *   Für die neue Entität müssen CRUD-Methoden (z.B. `addMyNewEntity`, `updateMyNewEntity`, `deleteMyNewEntity`, `getMyNewEntityById`, `getAllMyNewEntities`) implementiert werden.
    *   Diese Methoden müssen:
        *   Die Zeitstempel `created_at` und `updated_at` korrekt setzen/aktualisieren.
        *   Einen optionalen Parameter `skipSyncQueue: boolean` akzeptieren.
        *   Bei `skipSyncQueue = false` (Standard) einen Eintrag in die `syncQueue` über `this._addChangeToSyncQueue(...)` erstellen. Das `payload` für die SyncQueue sollte die vollständige Entität bei `CREATE`/`UPDATE` und `{id}` bei `DELETE` enthalten. Die `tenant_id` muss im Payload für die SyncQueue enthalten sein, da sie vom Backend zur Validierung der Datenintegrität innerhalb der Mandanten-DB verwendet werden kann.
    *   Es sollten auch interne Varianten (`addMyNewEntityInternal`, `updateMyNewEntityInternal`) und Bulk-Operationen (`bulkAddMyNewEntities`, `bulkDeleteMyNewEntities`) analog zu `Account` und `AccountGroup` implementiert werden. Diese werden vom `SyncService` genutzt und müssen `skipSyncQueue` berücksichtigen. `bulkPut` (für `add` und `update`) und `bulkDelete` sind hier nützlich.

## Anpassungen im Frontend

### 1. API-Client ([`src/api/syncApi.ts`](../src/api/syncApi.ts:1))

*   **`EntityType` erweitern:** Der Typ `EntityType` muss um den neuen Entitätsnamen (Plural, snake_case, z.B. `my_new_entities`) erweitert werden.
    ```typescript
    export type EntityType = 'accounts' | 'account_groups' | 'my_new_entities';
    ```
*   **`SyncQueueItem` im API-Client:** Das `SyncQueueItem`-Interface im API-Client enthält das Feld `tenantId: string`. Dieses wird an die API-Endpunkte `/push` und `/pull` gesendet. Im Backend wird die `tenant_id` aus dem Authentifizierungstoken (JWT) primär für die Auswahl der korrekten mandantenspezifischen Datenbankverbindung genutzt. Die `tenantId` im Payload dient dann der Datenintegrität und Validierung innerhalb dieser Datenbank.

### 2. SyncService ([`src/services/SyncService.ts`](../src/services/SyncService.ts:1))

1.  **Konstante `SERVICE_ENTITY_TYPES` erweitern:**
    *   Füge den API-Entitätstyp (z.B. `'my_new_entities'`) zur Konstante `SERVICE_ENTITY_TYPES` hinzu.
        ```typescript
        const SERVICE_ENTITY_TYPES: ApiEntityType[] = ['accounts', 'account_groups', 'my_new_entities'];
        ```

2.  **Mapping-Funktion `localEntityTypeToApiEntityType` erweitern:**
    *   Füge ein Mapping vom lokalen Entitätsnamen (wie in `LocalSyncQueueItem.entity_type` verwendet, z.B. `'MyNewEntity'`) zum API-Entitätstyp hinzu.
        ```typescript
        const localEntityTypeToApiEntityType = (localType: LocalSyncQueueItem['entity_type']): ApiEntityType => {
          if (localType === 'Account') return 'accounts';
          if (localType === 'AccountGroup') return 'account_groups';
          if (localType === 'MyNewEntity') return 'my_new_entities'; // NEU
          throw new Error(`Unknown local entity type for API mapping: ${localType}`);
        };
        ```
    *   Die Funktion `mapLocalQueueItemToApiQueueItem` im `SyncService` muss die `tenantId` korrekt aus dem aktiven Mandanten beziehen und dem `ApiSyncQueueItem` zuweisen.

3.  **`processSyncQueue()` anpassen (nur bei Bedarf für `updated_at` Handling):**
    *   Wenn nach einem erfolgreichen Push das Backend `new_updated_at` zurückgibt und dies lokal aktualisiert werden soll (um Konflikte zu minimieren), muss der Block, der `pushResult.results` verarbeitet, um die neue Entität erweitert werden:
        ```typescript
        // Innerhalb des if (pushResult.results) Blocks
        if (apiEntityType === 'accounts') {
          await this.tenantDbService.updateAccountInternal(updatePayload as Account, true);
        } else if (apiEntityType === 'account_groups') {
          await this.tenantDbService.updateAccountGroupInternal(updatePayload as AccountGroup, true);
        } else if (apiEntityType === 'my_new_entities') { // NEU
          await this.tenantDbService.updateMyNewEntityInternal(updatePayload as MyNewEntity, true); // Methode muss existieren
        }
        ```

4.  **`performInitialSync()` anpassen:**
    *   Die Schleife über `SERVICE_ENTITY_TYPES` handhabt bereits neue Entitäten dynamisch.
    *   Sicherstellen, dass der `switch` oder die `if/else if`-Kette für das `bulkAdd` der jeweiligen Entität im `TenantDbService` korrekt ist:
        ```typescript
        // Innerhalb der Schleife in performInitialSync, nach dem fetchInitialDataFromBackend
        if (remoteData.length > 0) {
          if (entityType === 'accounts') {
            await this.tenantDbService.bulkAddAccounts(remoteData as Account[], true);
          } else if (entityType === 'account_groups') {
            await this.tenantDbService.bulkAddAccountGroups(remoteData as AccountGroup[], true);
          } else if (entityType === 'my_new_entities') { // NEU
            await this.tenantDbService.bulkAddMyNewEntities(remoteData as MyNewEntity[], true); // Methode muss existieren
          }
        }
        ```

5.  **`syncDownstreamChanges()` anpassen:**
    *   Die Schleife über `SERVICE_ENTITY_TYPES` handhabt bereits neue Entitäten dynamisch.
    *   **Gelöschte Entitäten:** Die aktuelle Implementierung geht davon aus, dass der Pull-Endpunkt keine expliziten `deleted_ids` liefert. Löschungen vom Server zum Client müssen über einen anderen Mechanismus (z.B. "soft deletes" mit `is_deleted: true` im Payload oder ein separater Endpunkt für gelöschte IDs) erfolgen. Falls der Pull-Endpunkt gelöschte Entitäten (z.B. mit einem Flag) liefert, muss die Logik hier angepasst werden, um diese zu verarbeiten und lokal via `tenantDbService.bulkDeleteMyNewEntities` zu löschen.
    *   **Neue/Aktualisierte Entitäten:** Die `if/else if`-Ketten für das Abrufen der lokalen Entität und das Aufrufen von `update...Internal` oder `add...Internal` müssen erweitert werden:
        ```typescript
        // Lokale Entität abrufen
        const localEntity = await (entityType === 'accounts'
          ? this.db.accounts.get(remoteEntity.id)
          : entityType === 'account_groups'
            ? this.db.accountGroups.get(remoteEntity.id)
            : entityType === 'my_new_entities' // NEU
              ? this.db.myNewEntities.get(remoteEntity.id) // Annahme: Tabelle heißt myNewEntities
              : null);

        // Update-Fall (LWW)
        if (entityType === 'accounts') { /* ... */ }
        else if (entityType === 'account_groups') { /* ... */ }
        else if (entityType === 'my_new_entities') { // NEU
          await this.tenantDbService.updateMyNewEntityInternal(remoteEntity as MyNewEntity, true);
        }

        // Create-Fall
        if (entityType === 'accounts') { /* ... */ }
        else if (entityType === 'account_groups') { /* ... */ }
        else if (entityType === 'my_new_entities') { // NEU
          await this.tenantDbService.addMyNewEntityInternal(remoteEntity as MyNewEntity, true);
        }
        ```

## Backend-Anforderungen (FastAPI)

Das Backend (Codebasis: `C:\00_mldata\programming\FinWise\FinWise_0.4_BE`) muss ebenfalls für die neue Entität `MyNewEntity` (z.B. Tabelle `my_new_entities` innerhalb der jeweiligen mandantenspezifischen Datenbank) vorbereitet werden:

1.  **Authentifizierung und Mandanten-ID (`tenant_id`):**
    *   Die `tenant_id` des aktuellen Benutzers wird serverseitig über eine FastAPI-Dependency wie `get_current_tenant_id` (aus [`app/api/deps.py`](../FinWise_0.4_BE/app/api/deps.py:1)) ermittelt. Diese Funktion extrahiert die `tenant_id` typischerweise aus einem JWT-Token, das bei der Authentifizierung des Benutzers ausgestellt wurde.

2.  **Mandantenspezifische Datenbank-Session:**
    *   Eine weitere zentrale Dependency ist `get_tenant_db_session` (ebenfalls aus [`app/api/deps.py`](../FinWise_0.4_BE/app/api/deps.py:1)).
    *   Diese Dependency erhält die `tenant_id` von `get_current_tenant_id`.
    *   Sie verwendet diese `tenant_id`, um dynamisch eine SQLAlchemy-Session zur korrekten, mandantenspezifischen Datenbank herzustellen. Die Logik hierfür befindet sich in [`app/db/tenant_db.py`](../FinWise_0.4_BE/app/db/tenant_db.py:1).
    *   **Dies ist der Schlüssel zur strikten Mandantentrennung auf Datenbankebene.** Alle Datenbankoperationen für einen Request laufen somit automatisch im Kontext der richtigen Mandantendatenbank.

3.  **Pydantic-Modelle (z.B. `app/models/my_new_entity.py`):**
    *   Erstelle Pydantic-Modelle für die neue Entität:
        *   `MyNewEntityBase`: Gemeinsame Felder.
        *   `MyNewEntityCreate`: Felder für die Erstellung. Die `tenant_id` **muss hier nicht vom Client gesendet werden**, da sie serverseitig aus dem Authentifizierungskontext abgeleitet und von den CRUD-Operationen gesetzt wird, falls das SQLModel-Tabellenmodell sie enthält.
        *   `MyNewEntityUpdate`: Felder für die Aktualisierung (alle optional).
        *   `MyNewEntityInDBBase`: Basismodell für Daten aus der DB (inkl. `id`, `created_at`, `updated_at`).
        *   `MyNewEntity` (Schema für API-Antworten): Erbt von `MyNewEntityInDBBase`.
    *   Alle Modelle, die mit der DB interagieren, müssen `id: str` (oder `uuid.UUID`), `created_at: datetime`, `updated_at: datetime` enthalten.

4.  **SQLModel-Tabellenmodell (z.B. in `app/models/my_new_entity.py` oder einer zentralen `app/models/models.py`):**
    *   Definiere das SQLModel-Tabellenmodell für `my_new_entities` mit entsprechenden Spalten (`id`, `created_at`, `updated_at` und spezifische Felder).
    *   **Rolle des Feldes `tenant_id` in Tabellen:** Da separate Datenbanken pro Mandant verwendet werden, ist eine explizite `tenant_id`-Spalte in den Tabellen der mandantenspezifischen Datenbanken **technisch redundant** für die Datenisolierung. Sie kann jedoch aus folgenden Gründen beibehalten werden:
        *   **Zusätzliche Sicherheit/Referenz:** Als Double-Check, dass Daten korrekt zugeordnet sind.
        *   **Datenintegrität:** Sicherstellen, dass die `tenant_id` im Datensatz mit der `tenant_id` des Datenbankkontexts übereinstimmt.
        *   **Vereinfachung von übergreifenden Abfragen/Backups:** Falls Daten jemals außerhalb des mandantenspezifischen Kontextes aggregiert werden müssten (selten und mit Vorsicht zu genießen).
    *   Wenn `tenant_id` beibehalten wird, muss sie in den CRUD-Operationen serverseitig (basierend auf der `tenant_id` aus `get_current_tenant_id`) gesetzt werden und darf nicht blind vom Client übernommen werden.

5.  **CRUD-Operationen (z.B. `app/crud/crud_my_new_entity.py`):**
    *   Implementiere CRUD-Funktionen für die neue Entität.
    *   Diese Funktionen erhalten die **mandantenspezifische `db: Session`** als Parameter von den API-Endpunkten (injiziert durch `get_tenant_db_session`).
    *   `create(db: Session, *, obj_in: MyNewEntityCreate, tenant_id: str)`: Erstellt eine neue Entität. Setzt `tenant_id` im DB-Objekt, falls vorhanden.
    *   `get(db: Session, id: Any)`: Ruft eine Entität anhand ihrer ID ab.
    *   `get_multi(db: Session, *, skip: int = 0, limit: int = 100, updated_after: Optional[datetime] = None)`: Ruft mehrere Entitäten ab, optional mit Zeitstempel-Filter.
    *   `update(db: Session, *, db_obj: MyNewEntity, obj_in: MyNewEntityUpdate | Dict[str, Any])`: Aktualisiert eine Entität. Stellt sicher, dass `updated_at` gesetzt wird.
    *   `remove(db: Session, *, id: int)`: Löscht eine Entität (Hard oder Soft Delete).
    *   **Konfliktlösung:** Bei Updates (via Push) sollte das Backend eine "Last Write Wins"-Strategie basierend auf `updated_at` implementieren.

6.  **API-Endpunkte ([`app/api/v1/endpoints/sync.py`](../FinWise_0.4_BE/app/api/v1/endpoints/sync.py:1)):**
    *   Die Synchronisierungsendpunkte (`/push` und `/pull`) **müssen** die `get_tenant_db_session`-Dependency verwenden. Diese stellt sicher, dass alle Datenbankoperationen im Kontext der richtigen Mandantendatenbank ausgeführt werden, basierend auf der `tenant_id` aus dem Authentifizierungstoken des Benutzers.
    *   **Push-Endpunkt (`/api/v1/sync/push`):**
        *   Die `POST`-Methode verarbeitet `SyncQueueItem`-Daten. Die `tenant_id` aus dem `SyncQueueItem`-Payload wird **nicht** zur Auswahl der Datenbankverbindung verwendet (das geschieht über das Token), sondern dient der Datenintegrität innerhalb der bereits ausgewählten Mandanten-DB.
        *   Nutze eine Fallunterscheidung (z.B. `if item.entityType == 'my_new_entities':`) um die `crud_my_new_entity`-Funktionen mit der mandantenspezifischen `db: Session` aufzurufen.
        *   Verarbeite `created`, `updated`, `deleted` Aktionen.
        *   Gib im Erfolgsfall die `entityId` und den neuen `updated_at`-Zeitstempel zurück.
    *   **Pull-Endpunkt (`/api/v1/sync/pull/{entity_type}`):**
        *   Die `GET`-Methode erkennt den `entity_type`.
        *   Rufe `crud_my_new_entity.get_multi()` mit der mandantenspezifischen `db: Session` auf, optional filtere nach `last_sync_timestamp` (Query-Parameter).
        *   Gib die Liste der Entitäten und den aktuellen `server_last_sync_timestamp` (z.B. `datetime.utcnow().isoformat()`) zurück.
    *   **Wichtig:** Frühere Annahmen, dass die `tenant_id` aus dem `SyncQueueItem`-Payload oder als expliziter Query-Parameter für die *Auswahl* der Datenbankverbindung im `/push`- oder `/pull`-Endpunkt verwendet wird, sind **überholt**. Die `tenant_id` aus dem Authentifizierungskontext (JWT-Token) ist führend für die DB-Auswahl.

7.  **Datenbankmanagement und Migration (Alembic):**
    *   Der Prozess zur Erstellung und Verwaltung von mandantenspezifischen Datenbanken muss etabliert sein (siehe [`app/db/tenant_db.py`](../FinWise_0.4_BE/app/db/tenant_db.py:1)).
    *   Alembic (oder ein ähnliches Tool) wird verwendet, um das Schema **jeder einzelnen mandantenspezifischen Datenbank** zu verwalten.
    *   **Wichtig:** Wenn eine neue Tabelle (z.B. `my_new_entities`) zum Hauptschema (SQLModel-Definitionen) hinzugefügt wird, muss eine Alembic-Migration erstellt und diese Migration dann **für jede bestehende und zukünftige Mandantendatenbank ausgeführt werden**. Dies erfordert oft ein Skript oder einen manuellen Prozess, um `alembic upgrade head` gegen jede Mandanten-DB laufen zu lassen.

## Frontend-Anforderungen (Überprüfung)

*   **Muss das Frontend die `tenant_id` noch explizit in API-Aufrufen senden?**
    *   Für die Synchronisierungsendpunkte (`/sync/push`, `/sync/pull`) ist die `tenant_id` im Request-Body oder als Query-Parameter **nicht mehr für die Auswahl der Backend-Datenbankverbindung erforderlich**. Diese Auswahl erfolgt serverseitig basierend auf dem Authentifizierungstoken (JWT) und den Dependencies `get_current_tenant_id` und `get_tenant_db_session`.
    *   Die `tenant_id` in den lokalen `SyncQueueItem`-Payloads im Frontend ist weiterhin nützlich für die lokale Logik und kann vom Backend zur zusätzlichen Validierung der Datenintegrität innerhalb der bereits ausgewählten Mandanten-DB verwendet werden.
    *   Für andere, nicht-synchronisierungsbezogene API-Endpunkte, die möglicherweise nicht die gleiche mandantenspezifische DB-Session-Logik verwenden (obwohl sie es sollten), könnte die explizite Übergabe der `tenant_id` noch relevant sein. Dies sollte jedoch zugunsten der serverseitigen Ableitung aus dem Auth-Kontext vereinheitlicht werden.

## Allgemeine Hinweise und Konsistenz

*   **Konsistente IDs und Zeitstempel:** Stelle sicher, dass `id` (UUIDs empfohlen), `created_at` und `updated_at` über Frontend (IndexedDB) und Backend (Datenbank) hinweg konsistent verwendet und formatiert werden (ISO 8601 für Strings).
*   **Mandantenfähigkeit:**
    *   **Frontend:** Ist durch separate IndexedDB-Instanzen pro Mandant gegeben (`FinwiseTenantSpecificDB`).
    *   **Backend:** Ist durch **separate Datenbankinstanzen pro Mandant** und die Verwendung der `get_tenant_db_session`-Dependency sichergestellt. Die API-Schicht leitet die `tenant_id` aus dem Authentifizierungskontext ab und stellt die korrekte Datenbankverbindung für alle Operationen bereit.
*   **Fehlerbehandlung:** Implementiere robuste Fehlerbehandlung sowohl im Frontend (`SyncService`, `syncApi`) als auch im Backend (API-Endpunkte, CRUD-Operationen). Logge Fehler detailliert.
*   Stelle sicher, dass die gesamte Dokumentation klar, präzise und in sich konsistent ist.
*   Verwende durchgehend korrekte Dateipfade und Bezeichner.
*   Entferne veraltete oder widersprüchliche Informationen.

Durch Befolgen dieser Schritte kann eine neue Entität nahtlos in den bestehenden Synchronisierungsmechanismus von FinWise integriert werden, unter Berücksichtigung der strikten, auf separaten Datenbanken basierenden Mandantentrennung im Backend.
