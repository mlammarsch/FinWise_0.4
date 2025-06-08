# Erweiterung der bidirektionalen Synchronisation

## 1. Einleitung

Dieser Leitfaden beschreibt, wie die bestehende bidirektionale Synchronisationsfunktion in FinWise erweitert werden kann, um zusätzliche Datenmodelle (z.B. Transaktionen, Budgets, Kategorien) zu unterstützen. Der aktuelle Mechanismus basiert auf einer Offline-First-Strategie, bei der Änderungen lokal in einer IndexedDB gespeichert und über eine Sync Queue via WebSockets mit dem Backend synchronisiert werden. Konflikte werden mittels "Last Write Wins" (LWW) basierend auf einem `updated_at` Zeitstempel gelöst.

Ziel dieser Dokumentation ist es, Entwicklern eine klare Anleitung an die Hand zu geben, um neue Entitäten nahtlos in diesen Synchronisationsprozess zu integrieren.

## 2. Voraussetzungen für ein neues Datenmodell

Bevor mit der Erweiterung der Synchronisation für ein neues Datenmodell (z.B. `Transaction`) begonnen wird, sollten idealerweise folgende Komponenten bereits existieren:

*   **Frontend:**
    *   Eine grundlegende Pinia-Store-Struktur (z.B. `transactionStore.ts`) mit State, Getters und grundlegenden Actions für lokale CRUD-Operationen.
    *   Grundlegende Methoden im `TenantDbService.ts` für die lokale Speicherung und den Abruf der Daten des neuen Modells in der mandantenspezifischen IndexedDB.
    *   TypeScript-Interfaces für das Datenmodell in `src/types/index.ts`.
*   **Backend:**
    *   Ein SQLAlchemy-Modell für die Entität (z.B. in `app/models/financial_models.py`).
    *   Pydantic-Schemas für Create, Update und Read Operationen (z.B. in `app/models/schemas.py`).
    *   Grundlegende CRUD-Endpunkte und -Logik für die Entität (z.B. in `app/crud/crud_transaction.py` und `app/routers/transactions.py`).

## 3. Frontend-Anpassungen (TypeScript/Vue.js)

### a. Pinia Store (z.B. `transactionStore.ts`)

*   **State:** Stellen Sie sicher, dass der Store-State das neue Datenmodell als Array enthält (z.B. `transactions: Transaction[]`).
*   **Getters:** Implementieren Sie Getter zum Abrufen der Daten (z.B. `getAllTransactions`, `getTransactionById`).
*   **Actions:**
    *   Erstellen Sie Actions für lokale CRUD-Operationen (z.B. `addTransaction`, `updateTransaction`, `deleteTransaction`).
    *   **Wichtig:** Jede lokale Create- oder Update-Operation **muss** ein `updated_at` Feld (ISO-String) im Datensatz setzen oder aktualisieren. Dies ist entscheidend für die LWW-Konfliktlösung.
    ```typescript
    // Beispiel für eine Update-Action
    async updateTransaction(transaction: Partial<Transaction> & { id: string }) {
      const fullTransaction = { ...this.transactions.find(t => t.id === transaction.id), ...transaction, updated_at: new Date().toISOString() };
      // ... Logik zum Aktualisieren im State und in IndexedDB (via TenantDbService)
      // ... Eintrag zur Sync Queue hinzufügen (via TenantDbService)
    }
    ```
*   **Sync-Nachrichtenverarbeitung:**
    *   Implementieren Sie eine Methode (z.B. `handleSyncMessage(operation: SyncOperationType, data: Transaction)`) zur Verarbeitung von eingehenden Synchronisationsnachrichten vom Backend.
    *   Diese Methode sollte Create-, Update- und Delete-Operationen basierend auf der `operation` verarbeiten.
    *   Bei Update-Operationen muss die LWW-Logik beachtet werden: Vergleichen Sie das `updated_at` des eingehenden Datensatzes mit dem lokalen Datensatz. Aktualisieren Sie den lokalen Datensatz nur, wenn der eingehende Datensatz neuer ist oder der lokale Datensatz nicht existiert.
    ```typescript
    // Beispiel für handleSyncMessage
    handleSyncMessage(operation: 'create' | 'update' | 'delete', transaction: Transaction) {
      const existingTransaction = this.transactions.find(t => t.id === transaction.id);
      switch (operation) {
        case 'create':
          if (!existingTransaction) {
            this.transactions.push(transaction);
            // Optional: In TenantDbService hinzufügen, falls nicht schon durch Initial Load abgedeckt
          } else if (new Date(transaction.updated_at) > new Date(existingTransaction.updated_at)) {
            // Als Update behandeln, falls neuer
            Object.assign(existingTransaction, transaction);
          }
          break;
        case 'update':
          if (existingTransaction) {
            if (new Date(transaction.updated_at) > new Date(existingTransaction.updated_at)) {
              Object.assign(existingTransaction, transaction);
            }
          } else {
            // Ggf. als Create behandeln, wenn es lokal nicht existiert
            this.transactions.push(transaction);
          }
          break;
        case 'delete':
          this.transactions = this.transactions.filter(t => t.id !== transaction.id);
          break;
      }
      // Ggf. TenantDbService informieren, um IndexedDB zu aktualisieren (Upsert-Logik)
    }
    ```

### b. `TenantDbService.ts`

*   **Lokale Speichermethoden:**
    *   Fügen Sie Methoden für das neue Datenmodell hinzu (z.B. `addTransaction(transaction: Transaction)`, `updateTransaction(transaction: Transaction)`, `deleteTransaction(id: string)`, `getTransactionById(id: string): Promise<Transaction | undefined>`, `getAllTransactions(): Promise<Transaction[]>`).
    *   Diese Methoden interagieren mit der entsprechenden Tabelle in der mandantenspezifischen IndexedDB.
*   **`addToSyncQueue`:**
    *   Passen Sie die `addToSyncQueue`-Methode an, um das neue Datenmodell (`tableName`) und die entsprechenden Operationstypen (`operationType`: 'create', 'update', 'delete') zu unterstützen.
    ```typescript
    // Beispielhafter Aufruf in einer Store-Action
    // await tenantDbService.addToSyncQueue('transactions', 'create', newTransaction);
    ```
*   **Upsert-Logik:**
    *   Stellen Sie sicher, dass beim Verarbeiten von Daten vom Backend (insbesondere beim `InitialDataLoadMessage` oder bei einzelnen Sync-Nachrichten) eine Upsert-Logik verwendet wird (z.B. `db.table<Transaction>('transactions').put(transaction)`). Dies stellt sicher, dass neue Datensätze eingefügt und bestehende aktualisiert werden.

### c. `WebSocketService.ts`

*   **Verarbeitung von `InitialDataLoadMessage`:**
    *   Passen Sie die Methode an, die die `InitialDataLoadMessage` vom Backend verarbeitet.
    *   Extrahieren Sie die Daten des neuen Modells aus dem Payload (z.B. `initialData.transactions`).
    *   Leiten Sie diese Daten an den entsprechenden Pinia-Store (zur Aktualisierung des In-Memory-States) und/oder direkt an den `TenantDbService` (zur Speicherung/Aktualisierung in IndexedDB via Upsert) weiter.
    ```typescript
    // In der Methode, die InitialDataLoadMessage verarbeitet
    // if (message.payload.transactions) {
    //   transactionStore.setTransactions(message.payload.transactions); // Annahme: eine Action im Store
    //   await tenantDbService.bulkUpsertTransactions(message.payload.transactions); // Annahme: eine Methode im TenantDbService
    // }
    ```
*   **Verarbeitung der Sync-Queue (`requestProcessSyncQueue`):**
    *   Passen Sie die Methode an, die die Sync-Queue-Einträge verarbeitet und an das Backend sendet.
    *   Stellen Sie sicher, dass Einträge für das neue Datenmodell korrekt formatiert und mit dem richtigen `model_name` (oder Äquivalent) an den WebSocket-Endpunkt gesendet werden.
    ```typescript
    // In requestProcessSyncQueue, beim Senden eines Sync-Eintrags
    // const syncMessage = {
    //   type: 'sync_item', // oder ein spezifischerer Typ
    //   payload: {
    //     model_name: queueItem.tableName, // z.B. 'transactions'
    //     operation: queueItem.operationType,
    //     data: queueItem.payload
    //   }
    // };
    // webSocketStore.sendMessage(syncMessage);
    ```
*   **Zentraler Nachrichten-Handler (`onmessage`):**
    *   Erweitern Sie die Logik im `onmessage`-Handler (oder wo immer eingehende WebSocket-Nachrichten verarbeitet werden).
    *   Fügen Sie `case`-Anweisungen oder `if`-Bedingungen hinzu, um neue WebSocket-Nachrichtentypen für das neue Datenmodell zu erkennen (z.B. `transaction_created`, `transaction_updated`, `transaction_deleted`).
    *   Leiten Sie die `data` und den `operationType` aus diesen Nachrichten an die `handleSyncMessage`-Methode des entsprechenden Pinia-Stores weiter.
    ```typescript
    // Im onmessage Handler
    // switch (parsedMessage.type) {
    //   // ... andere Fälle
    //   case 'transaction_update': // Annahme: Nachrichtentyp vom Backend
    //     transactionStore.handleSyncMessage('update', parsedMessage.payload as Transaction);
    //     break;
    //   case 'transaction_delete':
    //     transactionStore.handleSyncMessage('delete', parsedMessage.payload as Transaction);
    //     break;
    //   // ...
    // }
    ```

### d. `src/types/index.ts`

*   **TypeScript-Interfaces:**
    *   Definieren Sie das TypeScript-Interface für das neue Datenmodell (z.B. `Transaction`). Stellen Sie sicher, dass es ein `updated_at: string;` Feld enthält.
    ```typescript
    export interface Transaction {
      id: string;
      tenant_id: string;
      amount: number;
      description: string;
      date: string; // ISO Date String
      category_id?: string;
      account_id: string;
      created_at: string;
      updated_at: string;
      // Weitere Felder...
    }
    ```
*   **`SyncPayload` Union:**
    *   Erweitern Sie den `SyncPayload` Union-Typ (falls vorhanden, oft verwendet für die `addToSyncQueue`-Methode oder WebSocket-Nachrichten), um das neue Datenmodell aufzunehmen.
    ```typescript
    // export type SyncableEntity = Account | AccountGroup | Transaction; // Beispiel
    // export interface SyncQueueItem {
    //   // ...
    //   payload: SyncableEntity;
    //   tableName: TableName; // Wichtig für die Zuordnung
    // }
    ```
*   **WebSocket-Nachrichtentypen:**
    *   Definieren Sie neue spezifische WebSocket-Nachrichtentypen für das neue Datenmodell, falls das Backend diese sendet (z.B. `TransactionUpdateMessage`, `TransactionDeleteMessage`). Alternativ kann ein generischer Nachrichtentyp mit einem `model_name` Feld verwendet werden.
    ```typescript
    // export interface TransactionUpdateMessage {
    //   type: 'transaction_update'; // oder 'entity_update'
    //   payload: Transaction;
    //   // Ggf. model_name: 'Transaction'
    // }
    ```
*   **`TableName` Enum/Typ:**
    *   Erweitern Sie das `TableName` Enum oder den Union-Typ (falls für die Identifizierung der Tabelle in der Sync Queue oder in WebSocket-Nachrichten verwendet), um den Namen der Tabelle für das neue Datenmodell aufzunehmen.
    ```typescript
    // export type TableName = 'accounts' | 'account_groups' | 'transactions';
    ```

### e. `src/stores/webSocketStore.ts` (falls relevant)

*   Überprüfen Sie, ob Anpassungen bei der allgemeinen Behandlung von `InitialDataLoadMessage` oder anderen generischen Synchronisationsnachrichten notwendig sind, um das neue Modell zu berücksichtigen. Oft sind die spezifischen Anpassungen in `WebSocketService.ts` und den jeweiligen Daten-Stores ausreichend.

## 4. Backend-Anpassungen (Python/FastAPI)

### a. SQLAlchemy-Modell (z.B. in `app/models/financial_models.py`)

*   Definieren oder passen Sie das SQLAlchemy-Modell für die neue Entität an (z.B. `Transaction`).
*   Stellen Sie sicher, dass das Modell ein `updated_at` Feld enthält, das bei jeder Aktualisierung automatisch gesetzt wird.
    ```python
    from sqlalchemy import Column, String, Float, DateTime, ForeignKey
    from sqlalchemy.orm import relationship
    from datetime import datetime
    from app.db.base_class import Base

    class Transaction(Base):
        __tablename__ = "transactions" # Name der Tabelle

        id = Column(String, primary_key=True, index=True)
        tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True) # Annahme: tenants Tabelle existiert
        amount = Column(Float, nullable=False)
        description = Column(String)
        date = Column(DateTime, nullable=False)
        # ... weitere Felder
        created_at = Column(DateTime, default=datetime.utcnow)
        updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

        # tenant = relationship("Tenant") # Beispiel für eine Beziehung
    ```

### b. Pydantic-Schemas (z.B. in `app/models/schemas.py` oder einem neuen `transaction_schemas.py`)

*   Definieren Sie Pydantic-Schemas für Create, Update und Read Operationen (z.B. `TransactionCreate`, `TransactionUpdate`, `TransactionInDB`).
*   Stellen Sie sicher, dass `updated_at` (typischerweise `datetime`) in den Schemas für Read (`TransactionInDB`) und ggf. Update (`TransactionUpdate`, falls das Frontend es mitsenden soll/darf) berücksichtigt wird.
    ```python
    from pydantic import BaseModel
    from typing import Optional
    from datetime import datetime

    class TransactionBase(BaseModel):
        amount: float
        description: Optional[str] = None
        date: datetime
        # ... weitere Felder

    class TransactionCreate(TransactionBase):
        id: str # Frontend generiert die ID

    class TransactionUpdate(TransactionBase):
        updated_at: datetime # Wichtig für LWW, vom Frontend gesendet

    class TransactionInDBBase(TransactionBase):
        id: str
        tenant_id: str
        created_at: datetime
        updated_at: datetime

        class Config:
            orm_mode = True # Ab FastAPI 0.70.0: from_attributes = True

    class Transaction(TransactionInDBBase):
        pass # Alias für die API-Antwort

    class TransactionInDB(TransactionInDBBase):
        pass
    ```

### c. CRUD-Operationen (z.B. neues File `app/crud/crud_transaction.py`)

*   Implementieren Sie die CRUD-Funktionen (z.B. `create_transaction`, `get_transaction`, `get_transactions_by_tenant`, `update_transaction`, `remove_transaction`) für das neue Datenmodell.
*   **Update-Operationen:**
    *   Die `update_transaction`-Funktion muss das `updated_at`-Feld aus dem Payload des Frontends übernehmen.
    *   Bei der Konfliktlösung (LWW) muss der Datensatz in der Datenbank nur aktualisiert werden, wenn das `updated_at` des eingehenden Datensatzes neuer ist als das in der Datenbank.
*   **Benachrichtigung des `SyncService`:**
    *   Nach jeder erfolgreichen Create-, Update- oder Delete-Operation muss der `SyncService` (siehe unten) benachrichtigt werden. Dieser Service ist dafür verantwortlich, eine WebSocket-Nachricht an alle relevanten (verbundenen) Clients zu senden, um sie über die Änderung zu informieren.
    ```python
    from sqlalchemy.orm import Session
    from .base import CRUDBase # Annahme: eine Basis-CRUD-Klasse existiert
    from app.models.financial_models import Transaction
    from app.models.schemas import TransactionCreate, TransactionUpdate # Angepasste Schemanamen
    # from app.services.sync_service import sync_service # Importieren Sie Ihren SyncService

    class CRUDTransaction(CRUDBase[Transaction, TransactionCreate, TransactionUpdate]):
        def create_with_tenant(self, db: Session, *, obj_in: TransactionCreate, tenant_id: str) -> Transaction:
            db_obj = Transaction(**obj_in.model_dump(), tenant_id=tenant_id, updated_at=obj_in.updated_at if hasattr(obj_in, 'updated_at') else datetime.utcnow()) # updated_at vom Client oder neu
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            # sync_service.notify_transaction_created(db_obj, tenant_id) # Benachrichtigung
            return db_obj

        def update(self, db: Session, *, db_obj: Transaction, obj_in: TransactionUpdate) -> Transaction:
            # LWW-Logik: Nur aktualisieren, wenn die eingehenden Daten neuer sind
            if obj_in.updated_at > db_obj.updated_at:
                update_data = obj_in.model_dump(exclude_unset=True)
                for field in update_data:
                    setattr(db_obj, field, update_data[field])
                # db_obj.updated_at = obj_in.updated_at # Wird durch obj_in gesetzt
                db.add(db_obj)
                db.commit()
                db.refresh(db_obj)
                # sync_service.notify_transaction_updated(db_obj, db_obj.tenant_id) # Benachrichtigung
            return db_obj

        # ... weitere Methoden (get, get_multi_by_tenant, remove)

    crud_transaction = CRUDTransaction(Transaction)
    ```
    **Hinweis:** Die Benachrichtigung des `SyncService` kann auch im API-Router nach dem erfolgreichen CRUD-Aufruf erfolgen.

### d. `app/services/sync_service.py`

*   **Verarbeitung von Sync-Queue-Einträgen:**
    *   Passen Sie die Methode an, die Sync-Queue-Einträge vom Frontend verarbeitet (oft eine Methode, die von einem WebSocket-Endpunkt aufgerufen wird).
    *   Fügen Sie Logik hinzu, um das neue Datenmodell (`model_name` aus dem Payload) zu erkennen und die entsprechende CRUD-Methode aufzurufen (z.B. `crud_transaction.create_with_tenant`, `crud_transaction.update`, `crud_transaction.remove`).
    *   Achten Sie auf die LWW-Logik bei Update-Operationen.
*   **Senden von WebSocket-Benachrichtigungen:**
    *   Implementieren Sie Methoden zum Senden von spezifischen WebSocket-Benachrichtigungen bei Änderungen am neuen Datenmodell (z.B. `notify_transaction_created`, `notify_transaction_updated`, `notify_transaction_deleted`). Diese Methoden erstellen die passende WebSocket-Nachricht (siehe `app/websocket/schemas.py`) und senden sie über den `ConnectionManager` an alle Clients des betroffenen Mandanten (außer dem sendenden Client).
    ```python
    # from app.websocket.connection_manager import manager # Annahme
    # from app.websocket.schemas import WebSocketMessage, TransactionSyncPayload # Annahme

    # async def notify_transaction_updated(transaction: Transaction, tenant_id: str, originator_sid: Optional[str] = None):
    #     message = WebSocketMessage(
    //         type="transaction_updated", # oder generischer Typ mit model_name
    //         payload=TransactionSyncPayload.from_orm(transaction) # Pydantic-Schema für die Nachricht
    //     )
    //     await manager.broadcast_to_tenant(tenant_id, message.model_dump_json(), exclude_sid=originator_sid)
    ```
*   **`get_initial_data_for_tenant`:**
    *   Erweitern Sie die Methode `get_initial_data_for_tenant` (oder wie auch immer die Methode heißt, die die initialen Daten für einen Mandanten zusammenstellt).
    *   Rufen Sie die entsprechende CRUD-Methode auf (z.B. `crud_transaction.get_multi_by_tenant`), um alle Datensätze des neuen Modells für den gegebenen Mandanten abzurufen.
    *   Fügen Sie diese Datensätze zur `InitialDataPayload` (oder dem entsprechenden Pydantic-Schema) hinzu, die an das Frontend gesendet wird.
    ```python
    # In get_initial_data_for_tenant
    # transactions = crud_transaction.get_multi_by_tenant(db, tenant_id=tenant_id, skip=0, limit=None) # Annahme: unbegrenzt für initial load
    # initial_payload.transactions = [TransactionSyncPayload.from_orm(t) for t in transactions]
    ```

### e. WebSocket-Nachrichtentypen (`app/websocket/schemas.py`)

*   Definieren Sie neue Pydantic-Modelle für die WebSocket-Nachrichten, die das neue Datenmodell betreffen (z.B. `TransactionSyncPayload` als Teil einer `WebSocketMessage`).
*   Erweitern Sie eine eventuell vorhandene `SyncPayload` Union oder ein generisches Payload-Schema, um das neue Datenmodell aufzunehmen.
    ```python
    from pydantic import BaseModel
    from typing import List, Union, Literal, Any
    from app.models.schemas import Transaction as TransactionSchema # Das normale Pydantic Schema

    class TransactionSyncPayload(TransactionSchema): # Kann identisch zum normalen Schema sein oder angepasst
        pass

    # Beispiel für eine generische Sync-Nachricht vom Client
    class ClientSyncItem(BaseModel):
        model_name: Literal["accounts", "account_groups", "transactions"] # Erweitern!
        operation: Literal["create", "update", "delete"]
        data: Any # Hier kommt das spezifische Pydantic-Schema (z.B. TransactionCreate/Update) rein

    # Beispiel für eine Server-Nachricht
    class ServerWebSocketMessage(BaseModel):
        type: str # z.B. "transaction_updated", "initial_data_load"
        payload: Any # z.B. TransactionSyncPayload oder InitialDataPayload

    class InitialDataPayload(BaseModel):
        accounts: List[AccountSchema] # Annahme: AccountSchema existiert
        account_groups: List[AccountGroupSchema] # Annahme: AccountGroupSchema existiert
        transactions: Optional[List[TransactionSyncPayload]] = None # Neues Modell hinzufügen
        # ... weitere Modelle
    ```

### f. WebSocket-Endpunkte (`app/websocket/endpoints.py`)

*   **Verarbeitung eingehender Sync-Nachrichten:**
    *   Passen Sie die Logik im WebSocket-Endpunkt (z.B. `websocket_endpoint` in einer `on_receive`-ähnlichen Funktion) an, die eingehende Sync-Nachrichten vom Frontend verarbeitet.
    *   Wenn eine Nachricht für das neue Datenmodell eintrifft (identifiziert durch `model_name` im Payload der Nachricht), leiten Sie diese an die entsprechende Methode im `SyncService` (oder direkt an die CRUD-Funktion) weiter. Übergeben Sie auch die `originator_sid` (Session ID des Senders), damit dieser Client keine redundante Benachrichtigung erhält.
*   **`InitialDataLoadMessage`:**
    *   Stellen Sie sicher, dass die `InitialDataLoadMessage`, die an einen neu verbundenen Client gesendet wird, die Daten des neuen Modells enthält (dies wird durch die Anpassungen in `SyncService.get_initial_data_for_tenant` und `app/websocket/schemas.py` erreicht).

## 5. Zusammenfassung der Schritte / Checkliste

**Frontend:**

*   [ ] Pinia Store: State, Getter, CRUD-Actions (mit `updated_at`), `handleSyncMessage` (LWW).
*   [ ] `TenantDbService.ts`: Lokale CRUD-Methoden, `addToSyncQueue` erweitert, Upsert-Logik.
*   [ ] `WebSocketService.ts`: `InitialDataLoadMessage` erweitert, `requestProcessSyncQueue` erweitert, `onmessage` erweitert.
*   [ ] `src/types/index.ts`: Interface für neues Modell (mit `updated_at`), `SyncPayload` erweitert, neue WebSocket-Nachrichtentypen, `TableName` erweitert.
*   [ ] `src/stores/webSocketStore.ts` (falls relevant): Überprüfen.

**Backend:**

*   [ ] SQLAlchemy-Modell: Definieren/anpassen (mit `updated_at`).
*   [ ] Pydantic-Schemas: Create, Update, Read (mit `updated_at`).
*   [ ] CRUD-Operationen: Implementieren, LWW bei Update, `SyncService`-Benachrichtigung.
*   [ ] `app/services/sync_service.py`: Sync-Queue-Verarbeitung erweitert, Methoden für WebSocket-Benachrichtigungen, `get_initial_data_for_tenant` erweitert.
*   [ ] `app/websocket/schemas.py`: Neue Pydantic-Modelle für WebSocket-Nachrichten, `SyncPayload` erweitert, `InitialDataPayload` erweitert.
*   [ ] `app/websocket/endpoints.py`: Eingehende Sync-Nachrichten verarbeiten, `InitialDataLoadMessage` enthält neues Modell.

## 6. Wichtige Hinweise

*   **`updated_at` Konsistenz:** Die korrekte und konsistente Verwendung und Aktualisierung des `updated_at` Zeitstempels sowohl im Frontend als auch im Backend ist absolut entscheidend für die "Last Write Wins"-Konfliktlösungsstrategie. Stellen Sie sicher, dass es bei jeder relevanten Änderung aktualisiert wird.
*   **Löschoperationen:**
    *   Überlegen Sie, ob Hard Deletes oder Soft Deletes (z.B. durch ein `is_deleted` Flag und ein `deleted_at` Feld) verwendet werden sollen.
    *   Hard Deletes sind einfacher in der Synchronisation, da der Datensatz einfach auf beiden Seiten entfernt wird.
    *   Soft Deletes erfordern, dass der "gelöschte" Zustand ebenfalls synchronisiert wird. Der `updated_at` Zeitstempel muss auch bei einem Soft Delete aktualisiert werden.
*   **Testen:** Testen Sie die Synchronisation für das neue Datenmodell gründlich unter verschiedenen Bedingungen:
    *   Online-Szenarien (Änderungen werden sofort synchronisiert).
    *   Offline-Szenarien (Änderungen werden in die Queue gestellt und später synchronisiert).
    *   Konfliktszenarien (derselbe Datensatz wird auf mehreren Clients oder offline/online unterschiedlich geändert).
    *   Initialer Daten-Load für neue Clients oder nach einem Reset.
    *   Verhalten bei Verbindungsabbrüchen und Wiederverbindungen.
*   **Atomarität und Fehlerbehandlung:** Achten Sie auf eine robuste Fehlerbehandlung, insbesondere bei Backend-Operationen, die mehrere Schritte umfassen (z.B. DB-Schreibvorgang und anschließende WebSocket-Benachrichtigung).
*   **Performance:** Bei sehr großen Datenmengen für ein neues Modell sollten Performance-Aspekte (z.B. Paginierung beim Initial Load, effiziente DB-Abfragen) berücksichtigt werden.
