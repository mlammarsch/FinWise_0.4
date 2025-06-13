# Dokumentierte Tasks - FinWise

## Erweitern der bidirektionalen Synchronisation

**Letztes Update:** 2025-01-13
**Status:** Template für neue Entitäten
**Basiert auf:** Account/AccountGroup Synchronisation (vollständig implementiert)

### Übersicht
Dieser Task beschreibt den standardisierten Workflow zum Hinzufügen einer neuen Entität zur bidirektionalen Synchronisation zwischen Frontend und Backend.

### Zu modifizierende Dateien

#### Frontend:
- `src/stores/[entity]Store.ts` - Pinia Store für die Entität
- `src/services/TenantDbService.ts` - IndexedDB-Operationen
- `src/services/WebSocketService.ts` - WebSocket-Nachrichtenverarbeitung
- `src/types/index.ts` - TypeScript-Typdefinitionen
- `src/stores/webSocketStore.ts` - (falls erforderlich)

#### Backend:
- `app/models/financial_models.py` - SQLAlchemy-Modell
- `app/models/schemas.py` - Pydantic-Schemas
- `app/crud/crud_[entity].py` - CRUD-Operationen
- `app/services/sync_service.py` - Sync-Service-Erweiterung
- `app/websocket/schemas.py` - WebSocket-Nachrichtentypen
- `app/websocket/endpoints.py` - WebSocket-Endpunkt-Erweiterung

### Schritt-für-Schritt Workflow

#### Phase 1: Backend-Vorbereitung

1. **SQLAlchemy-Modell erstellen/erweitern**
   ```python
   # In app/models/financial_models.py
   class NewEntity(TenantBase):
       __tablename__ = "new_entities"

       id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
       name = Column(String, nullable=False, index=True)
       # ... weitere Felder
       createdAt = Column(DateTime, default=datetime.utcnow)
       updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
   ```

2. **Pydantic-Schemas definieren**
   ```python
   # In app/models/schemas.py
   class NewEntityBase(BaseModel):
       name: str
       # ... weitere Felder

   class NewEntityCreate(NewEntityBase):
       id: str

   class NewEntityUpdate(NewEntityBase):
       updated_at: datetime

   class NewEntity(NewEntityBase):
       id: str
       created_at: datetime
       updated_at: datetime

       class Config:
           orm_mode = True
   ```

3. **CRUD-Operationen implementieren**
   ```python
   # Neue Datei: app/crud/crud_new_entity.py
   class CRUDNewEntity(CRUDBase[NewEntity, NewEntityCreate, NewEntityUpdate]):
       def create_with_tenant(self, db: Session, *, obj_in: NewEntityCreate, tenant_id: str) -> NewEntity:
           # Implementierung mit Sync-Service-Benachrichtigung

       def update(self, db: Session, *, db_obj: NewEntity, obj_in: NewEntityUpdate) -> NewEntity:
           # LWW-Logik implementieren
   ```

#### Phase 2: Frontend-Vorbereitung

4. **TypeScript-Interface definieren**
   ```typescript
   // In src/types/index.ts
   export interface NewEntity {
     id: string;
     name: string;
     // ... weitere Felder
     created_at?: string;
     updated_at?: string;
   }

   // EntityTypeEnum erweitern
   export enum EntityTypeEnum {
     // ... bestehende
     NEW_ENTITY = 'NewEntity',
   }
   ```

5. **Pinia Store erstellen**
   ```typescript
   // Neue Datei: src/stores/newEntityStore.ts
   export const useNewEntityStore = defineStore('newEntity', () => {
     const entities = ref<NewEntity[]>([]);

     // CRUD-Actions mit updated_at-Handling
     async function addEntity(entity: Omit<NewEntity, 'id' | 'created_at' | 'updated_at'>) {
       const newEntity = {
         ...entity,
         id: uuidv4(),
         updated_at: new Date().toISOString()
       };
       // Lokale Aktualisierung + Sync-Queue
     }

     // handleSyncMessage für WebSocket-Updates
     function handleSyncMessage(operation: SyncOperationType, entity: NewEntity) {
       // LWW-Logik implementieren
     }
   });
   ```

#### Phase 3: Synchronisation implementieren

6. **TenantDbService erweitern**
   ```typescript
   // In src/services/TenantDbService.ts
   async addNewEntity(entity: NewEntity): Promise<void> {
     await this.db.newEntities.add(entity);
   }

   async updateNewEntity(entity: NewEntity): Promise<void> {
     await this.db.newEntities.put(entity);
   }

   // addToSyncQueue erweitern für 'newEntities' tableName
   ```

7. **WebSocket-Service erweitern**
   ```typescript
   // In src/services/WebSocketService.ts
   // InitialDataLoadMessage-Handler erweitern
   if (message.payload.newEntities) {
     newEntityStore.setEntities(message.payload.newEntities);
   }

   // onmessage-Handler erweitern
   case 'new_entity_update':
     newEntityStore.handleSyncMessage('update', parsedMessage.payload);
     break;
   ```

#### Phase 4: Backend-Synchronisation

8. **Sync-Service erweitern**
   ```python
   # In app/services/sync_service.py
   async def process_sync_item(item: SyncQueueItem):
       if item.model_name == 'newEntities':
           # CRUD-Operationen aufrufen
           # WebSocket-Benachrichtigungen senden

   async def get_initial_data_for_tenant(tenant_id: str):
       # Neue Entitäten zu InitialDataPayload hinzufügen
   ```

9. **WebSocket-Schemas erweitern**
   ```python
   # In app/websocket/schemas.py
   class InitialDataPayload(BaseModel):
       # ... bestehende
       new_entities: Optional[List[NewEntity]] = None
   ```

### Wichtige Überlegungen

#### LWW-Konfliktlösung:
- Immer `updated_at` bei Änderungen setzen
- Vergleich sowohl im Frontend als auch Backend
- Bei Konflikten neueren Timestamp bevorzugen

#### Performance:
- Bei großen Datenmengen Paginierung implementieren
- Indizierung für häufige Abfragen
- Batch-Operationen für Initial Load

#### Fehlerbehandlung:
- Robuste Fehlerbehandlung in allen Sync-Operationen
- Retry-Mechanismen für fehlgeschlagene Sync-Versuche
- Logging aller Sync-Aktivitäten

#### Testing:
- Unit-Tests für Store-Operationen
- Integration-Tests für Sync-Funktionalität
- End-to-End-Tests für Offline/Online-Szenarien

### Validierung der Implementierung

#### Checkliste:
- [ ] Entität kann offline erstellt/bearbeitet/gelöscht werden
- [ ] Änderungen werden in Sync-Queue eingereiht
- [ ] Online-Synchronisation funktioniert bidirektional
- [ ] Konflikte werden korrekt durch LWW gelöst
- [ ] Initial Data Load enthält neue Entität
- [ ] WebSocket-Updates erreichen alle Clients
- [ ] Offline-Queue wird bei Reconnect abgearbeitet

#### Test-Szenarien:
1. **Online-Szenario**: Änderung wird sofort an alle Clients gesendet
2. **Offline-Szenario**: Änderung wird in Queue gespeichert und später synchronisiert
3. **Konflikt-Szenario**: Gleichzeitige Änderungen werden durch LWW gelöst
4. **Reconnect-Szenario**: Nach Verbindungsabbruch wird Queue abgearbeitet

---

## IndexedDB Store Migration

**Letztes Update:** 2025-01-13
**Status:** Template für Store-Migrationen
**Anwendungsfall:** Migration von localStorage zu IndexedDB

### Übersicht
Standardisierter Workflow für die Migration eines Pinia Stores von localStorage-basierter Persistierung zu IndexedDB mit Dexie.js.

### Zu modifizierende Dateien
- `src/stores/[entity]Store.ts` - Store-Implementierung
- `src/services/TenantDbService.ts` - IndexedDB-Schema und -Operationen
- `src/services/DataService.ts` - Legacy-Methoden entfernen (optional)

### Schritt-für-Schritt Workflow

#### Phase 1: IndexedDB-Schema erweitern

1. **TenantDbService Schema erweitern**
   ```typescript
   // In src/services/TenantDbService.ts
   private createDatabase(tenantId: string): Dexie {
     const db = new Dexie(`FinWise_${tenantId}`);
     db.version(1).stores({
       // ... bestehende Tabellen
       newEntities: '&id, name, updated_at', // Indizes definieren
     });
     return db;
   }
   ```

2. **CRUD-Methoden implementieren**
   ```typescript
   // Getter
   async getAllNewEntities(): Promise<NewEntity[]> {
     return await this.db.newEntities.orderBy('name').toArray();
   }

   // Create/Update (Upsert)
   async saveNewEntity(entity: NewEntity): Promise<void> {
     await this.db.newEntities.put(entity);
   }

   // Delete
   async deleteNewEntity(id: string): Promise<void> {
     await this.db.newEntities.delete(id);
   }
   ```

#### Phase 2: Store-Migration

3. **Store-State anpassen**
   ```typescript
   // Alte localStorage-basierte Implementierung entfernen
   // Neue async-basierte Implementierung

   const entities = ref<NewEntity[]>([]);
   const isLoaded = ref(false);

   async function loadEntities(): Promise<void> {
     if (!tenantDbService) return;

     try {
       const loadedEntities = await tenantDbService.getAllNewEntities();
       entities.value = loadedEntities;
       isLoaded.value = true;
     } catch (error) {
       errorLog('newEntityStore', 'Fehler beim Laden der Entitäten', error);
     }
   }
   ```

4. **CRUD-Actions zu async migrieren**
   ```typescript
   async function addEntity(entityData: Omit<NewEntity, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
     const newEntity: NewEntity = {
       ...entityData,
       id: uuidv4(),
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString()
     };

     // Lokaler State
     entities.value.push(newEntity);

     // IndexedDB
     await tenantDbService?.saveNewEntity(newEntity);

     // Sync-Queue (falls Synchronisation implementiert)
     await tenantDbService?.addToSyncQueue('newEntities', 'create', newEntity);
   }
   ```

#### Phase 3: Initialisierung anpassen

5. **Store-Reset-Methode**
   ```typescript
   async function reset(): Promise<void> {
     entities.value = [];
     isLoaded.value = false;
     await loadEntities();
   }
   ```

6. **DataService.reloadTenantData erweitern**
   ```typescript
   // In src/services/DataService.ts
   static async reloadTenantData(): Promise<void> {
     // ... bestehende Stores
     await newEntityStore.reset();
   }
   ```

### Migration-Strategien

#### Daten-Migration (falls erforderlich):
```typescript
// Einmalige Migration von localStorage zu IndexedDB
async function migrateFromLocalStorage(): Promise<void> {
  const legacyData = localStorage.getItem(storageKey('newEntities'));
  if (legacyData && !isLoaded.value) {
    const parsedData: NewEntity[] = JSON.parse(legacyData);

    // In IndexedDB speichern
    for (const entity of parsedData) {
      await tenantDbService?.saveNewEntity(entity);
    }

    // Legacy-Daten entfernen
    localStorage.removeItem(storageKey('newEntities'));

    // Store neu laden
    await loadEntities();
  }
}
```

#### Backward Compatibility:
- Graceful Fallback bei IndexedDB-Fehlern
- Warnung bei nicht unterstützten Browsern
- Optional: Hybrid-Ansatz mit localStorage als Fallback

### Validierung der Migration

#### Checkliste:
- [ ] Alle CRUD-Operationen funktionieren mit IndexedDB
- [ ] Store lädt Daten korrekt beim Initialisieren
- [ ] Tenant-Wechsel lädt korrekte Daten
- [ ] Performance ist besser als localStorage-Implementierung
- [ ] Fehlerbehandlung ist robust
- [ ] Legacy-Daten wurden migriert (falls erforderlich)

#### Test-Szenarien:
1. **Frische Installation**: Store funktioniert ohne Legacy-Daten
2. **Migration**: Legacy localStorage-Daten werden korrekt übernommen
3. **Tenant-Wechsel**: Daten werden korrekt pro Mandant getrennt
4. **Browser-Reload**: Daten persistieren korrekt
5. **Offline-Nutzung**: IndexedDB funktioniert ohne Internetverbindung

---

## WebSocket-Reconnection-Handling

**Letztes Update:** 2025-01-13
**Status:** Verbesserungsvorschlag
**Anwendungsfall:** Robuste WebSocket-Verbindungswiederherstellung

### Übersicht
Implementierung eines robusten Reconnection-Mechanismus für WebSocket-Verbindungen mit exponential backoff und automatischer Sync-Queue-Verarbeitung.

### Zu modifizierende Dateien
- `src/services/WebSocketService.ts` - Hauptlogik
- `src/stores/webSocketStore.ts` - Status-Management
- `src/main.ts` - Initialisierung (optional)

### Implementierungsdetails

#### Reconnection-Strategie:
- Exponential Backoff: 1s, 2s, 4s, 8s, 16s, max 30s
- Maximale Reconnection-Versuche: 10
- Automatische Sync-Queue-Verarbeitung nach Reconnect
- Heartbeat/Ping-Pong für Connection-Health-Check

#### Erweiterte Features:
- Network-Status-Detection (online/offline Events)
- Graceful Degradation bei dauerhaften Verbindungsproblemen
- User-Benachrichtigungen über Verbindungsstatus
- Metrics für Verbindungsqualität

### Wichtige Überlegungen
- Battery-Optimierung auf mobilen Geräten
- Vermeidung von Connection-Spam bei schlechter Verbindung
- User Experience während Reconnection-Phasen
- Logging für Debugging von Verbindungsproblemen

---

## Synchronisationsprobleme: Accounts und Account Groups

**Letztes Update:** 2025-01-13
**Status:** Kritische Bugs - Hohe Priorität
**Anwendungsfall:** Konsistente und zuverlässige Synchronisation

### Übersicht
Zwei kritische Probleme in der aktuellen Synchronisationsimplementierung von Accounts und Account Groups, die eine inkonsistente Datensynchronisation und fehlende Prozessabwicklung verursachen.

### Problem 1: Inkonsistente Synchronisation

#### Aktueller Zustand:
- Die Synchronisation von Accounts und Account Groups erfolgt aktuell anders als die Offline-Synchronisation über die Sync-Queue
- Derzeit wird anscheinend ein normaler API-Endpoint für die Synchronisation erwartet (Kommentar im Code)
- Dies ist bisher noch nicht implementiert

#### Gewünschter Zustand:
- Die Synchronisation von Accounts und Account Groups soll analog zur Offline-Synchronisation über die Sync-Queue erfolgen
- Das bedeutet, dass die Synchronisationsanfragen in die Sync-Queue eingereiht werden sollen
- Ob off- oder online: Wenn Online, soll die Sync sofort durchgeführt werden

#### Begründung:
- Ziel ist eine konsistente Synchronisationsmethode unabhängig vom Online- oder Offline-Status
- Vereinheitlichung der Synchronisationslogik für alle Entitäten

#### Zu modifizierende Dateien:
- `src/stores/accountStore.ts` - Account-Synchronisation über Sync-Queue
- `src/stores/accountGroupStore.ts` - Account Group-Synchronisation über Sync-Queue
- `src/services/TenantDbService.ts` - Sync-Queue-Integration für Accounts/Groups
- `app/services/sync_service.py` - Backend-Sync-Service für Account-Entitäten
- `app/crud/crud_account.py` - CRUD-Operationen mit Sync-Benachrichtigung
- `app/crud/crud_account_group.py` - CRUD-Operationen mit Sync-Benachrichtigung

### Problem 2: Fehlende Rückmeldung des Synchronisationsstatus

#### Aktueller Zustand:
- Der Status eines Eintrags in der Sync-Queue wechselt auf "Processing", sobald eine Übertragung stattfindet
- Es erfolgt keine Rückmeldung/Quittierung vom Backend, ob die Synchronisation erfolgreich war
- Die Sync-Queue wird nicht geleert, auch wenn die Übertragung stattgefunden hat

#### Gewünschter Zustand:
- Nach erfolgreicher Synchronisation soll eine Quittierung (Bestätigung) vom Backend empfangen werden
- Die Sync-Queue soll nach Erhalt der Bestätigung geleert werden, wobei die ID des erfolgreich synchronisierten Datensatzes angegeben wird

#### Einordnung:
- Dies wird als Bug betrachtet, da die Sync-Queue nicht korrekt verwaltet wird
- Hier muss eine saubere Prozessabwicklung stattfinden

#### Zu modifizierende Dateien:
- `src/services/TenantDbService.ts` - Sync-Queue-Status-Management
- `src/services/WebSocketService.ts` - Sync-Bestätigungen verarbeiten
- `app/services/sync_service.py` - Sync-Bestätigungen senden
- `app/websocket/schemas.py` - Sync-Bestätigungs-Nachrichten
- `app/websocket/endpoints.py` - Sync-Bestätigungs-Handler

### Lösungsansatz

#### Phase 1: Sync-Queue-Integration für Accounts/Groups
1. **Account Store anpassen**
   ```typescript
   // In src/stores/accountStore.ts
   async function addAccount(accountData: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<void> {
     const newAccount: Account = {
       ...accountData,
       id: uuidv4(),
       updated_at: new Date().toISOString()
     };

     // Lokaler State
     accounts.value.push(newAccount);

     // IndexedDB
     await tenantDbService?.saveAccount(newAccount);

     // Sync-Queue (NEU - konsistent mit anderen Entitäten)
     await tenantDbService?.addToSyncQueue('accounts', 'create', newAccount);
   }
   ```

2. **Account Group Store anpassen**
   ```typescript
   // In src/stores/accountGroupStore.ts
   // Analog zu Account Store - alle CRUD-Operationen über Sync-Queue
   ```

#### Phase 2: Sync-Bestätigungssystem implementieren
1. **Backend-Bestätigungen**
   ```python
   # In app/services/sync_service.py
   async def process_sync_item(item: SyncQueueItem):
       # Nach erfolgreicher Verarbeitung
       await send_sync_ack(item.id, item.entity_id, item.entity_type, item.operation_type)

   async def send_sync_ack(sync_id: str, entity_id: str, entity_type: str, operation_type: str):
       ack_message = SyncAckMessage(
           type='sync_ack',
           id=sync_id,
           status='processed',
           entityId=entity_id,
           entityType=entity_type,
           operationType=operation_type
       )
       await connection_manager.broadcast_to_tenant(tenant_id, ack_message)
   ```

2. **Frontend-Bestätigungsverarbeitung**
  ```typescript
  // In src/services/WebSocketService.ts
  async processSyncAck(ackMessage: SyncAckMessage): Promise<void> {
    const tenantDbService = useTenantStore().tenantDbService;
    if (!tenantDbService) return;

    try {
      // Sync-Queue-Eintrag als erfolgreich markieren und entfernen
      await tenantDbService.removeSyncQueueEntry(ackMessage.id);
      infoLog('WebSocketService', `Sync erfolgreich bestätigt für ${ackMessage.entityType}:${ackMessage.entityId}`);
    } catch (error) {
      errorLog('WebSocketService', 'Fehler beim Verarbeiten der Sync-Bestätigung', error);
    }
  }
  ```

### Validierung der Lösung

#### Checkliste:
- [ ] Accounts nutzen einheitlich die Sync-Queue (online und offline)
- [ ] Account Groups nutzen einheitlich die Sync-Queue (online und offline)
- [ ] Sync-Bestätigungen werden korrekt vom Backend gesendet
- [ ] Frontend verarbeitet ACK/NACK-Nachrichten korrekt
- [ ] Sync-Queue wird nach erfolgreicher Sync geleert
- [ ] Retry-Mechanismen funktionieren bei NACK-Nachrichten
- [ ] Stuck Processing Entries werden automatisch zurückgesetzt

#### Test-Szenarien:
1. **Online-Sync**: Änderung wird sofort synchronisiert und bestätigt
2. **Offline-Sync**: Änderung wird in Queue gespeichert und bei Reconnect verarbeitet
3. **Konflikt-Szenario**: LWW-Logik löst Konflikte korrekt auf
4. **Fehler-Szenario**: NACK-Nachrichten triggern Retry-Mechanismen
5. **Timeout-Szenario**: Stuck Processing Entries werden zurückgesetzt

---

## Sync-Acknowledgment-System (ACK/NACK)

**Letztes Update:** 2025-01-13
**Status:** In aktiver Entwicklung - Hohe Priorität
**Anwendungsfall:** Zuverlässige Sync-Queue-Verarbeitung mit Bestätigungen

### Übersicht
Implementierung eines robusten Acknowledgment-Systems für die Synchronisation zwischen Frontend und Backend. Das System stellt sicher, dass Sync-Queue-Einträge nur nach erfolgreicher Verarbeitung entfernt werden.

### Problemstellung
**Aktueller Zustand:**
- Sync-Queue-Einträge wechseln auf "processing", werden aber nie entfernt
- Keine Rückmeldung vom Backend über Erfolg/Fehler der Synchronisation
- Queue läuft über und enthält veraltete/doppelte Einträge
- Keine Retry-Mechanismen bei fehlgeschlagenen Sync-Operationen

**Gewünschter Zustand:**
- Backend sendet ACK bei erfolgreicher Verarbeitung
- Backend sendet NACK bei Fehlern mit Grund und Details
- Frontend entfernt Queue-Einträge nur nach ACK
- Automatische Retry-Mechanismen bei NACK mit exponential backoff
- Timeout-Handling für stuck processing entries

### Zu modifizierende Dateien

#### Frontend:
- [`src/services/WebSocketService.ts`](../src/services/WebSocketService.ts) - ACK/NACK-Verarbeitung
- [`src/services/TenantDbService.ts`](../src/services/TenantDbService.ts) - Queue-Management
- [`src/types/index.ts`](../src/types/index.ts) - ACK/NACK-Message-Typen (bereits definiert)
- [`src/test-sync-acknowledgment.ts`](../src/test-sync-acknowledgment.ts) - Test-Suite für ACK/NACK

#### Backend:
- `app/services/sync_service.py` - ACK/NACK-Versendung
- `app/websocket/schemas.py` - ACK/NACK-Message-Schemas
- `app/websocket/endpoints.py` - WebSocket-Handler-Erweiterung
- `app/crud/crud_account.py` - Sync-Benachrichtigungen
- `app/crud/crud_account_group.py` - Sync-Benachrichtigungen

### Implementierungsdetails

#### Phase 1: Backend ACK/NACK-Versendung
```python
# In app/services/sync_service.py
async def send_sync_ack(tenant_id: str, sync_id: str, entity_id: str, entity_type: str, operation_type: str):
   """Sendet Sync-Bestätigung an alle Clients des Mandanten"""
   ack_message = {
       "type": "sync_ack",
       "id": sync_id,
       "status": "processed",
       "entityId": entity_id,
       "entityType": entity_type,
       "operationType": operation_type
   }
   await connection_manager.broadcast_to_tenant(tenant_id, ack_message)

async def send_sync_nack(tenant_id: str, sync_id: str, entity_id: str, entity_type: str, operation_type: str, reason: str, detail: str = None):
   """Sendet Sync-Fehler an alle Clients des Mandanten"""
   nack_message = {
       "type": "sync_nack",
       "id": sync_id,
       "status": "failed",
       "entityId": entity_id,
       "entityType": entity_type,
       "operationType": operation_type,
       "reason": reason,
       "detail": detail
   }
   await connection_manager.broadcast_to_tenant(tenant_id, nack_message)
```

#### Phase 2: Frontend ACK/NACK-Verarbeitung
```typescript
// In src/services/WebSocketService.ts
async processSyncAck(ackMessage: SyncAckMessage): Promise<void> {
 const tenantDbService = useTenantStore().tenantDbService;
 if (!tenantDbService) return;

 try {
   // Queue-Eintrag erfolgreich entfernen
   const removed = await tenantDbService.removeSyncQueueEntry(ackMessage.id);
   if (removed) {
     infoLog('WebSocketService', `Sync erfolgreich: ${ackMessage.entityType}:${ackMessage.entityId}`);
   } else {
     warnLog('WebSocketService', `Sync-Queue-Eintrag nicht gefunden: ${ackMessage.id}`);
   }
 } catch (error) {
   errorLog('WebSocketService', 'Fehler beim Verarbeiten der Sync-Bestätigung', error);
 }
}

async processSyncNack(nackMessage: SyncNackMessage): Promise<void> {
 const tenantDbService = useTenantStore().tenantDbService;
 if (!tenantDbService) return;

 try {
   // Retry-Logik basierend auf Fehlergrund
   const maxRetries = this.getMaxRetriesForReason(nackMessage.reason);
   const retryDelay = this.calculateRetryDelay(nackMessage.attempts || 0);

   await tenantDbService.updateSyncQueueEntryStatus(
     nackMessage.id,
     SyncStatus.FAILED,
     `${nackMessage.reason}: ${nackMessage.detail || ''}`
   );

   // Retry nach Delay, falls unter maxRetries
   if ((nackMessage.attempts || 0) < maxRetries) {
     setTimeout(async () => {
       await this.retrySyncEntry(nackMessage.id);
     }, retryDelay);
   }

   errorLog('WebSocketService', `Sync fehlgeschlagen: ${nackMessage.reason}`, nackMessage);
 } catch (error) {
   errorLog('WebSocketService', 'Fehler beim Verarbeiten der Sync-Ablehnung', error);
 }
}
```

#### Phase 3: Retry-Mechanismen
```typescript
// In src/services/WebSocketService.ts
getMaxRetriesForReason(reason: string): number {
 switch (reason) {
   case 'network_error':
   case 'timeout':
     return 5;
   case 'validation_error':
     return 2;
   case 'conflict':
     return 3;
   case 'server_error':
     return 3;
   default:
     return 1;
 }
}

calculateRetryDelay(attemptNumber: number): number {
 // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
 return Math.min(1000 * Math.pow(2, attemptNumber), 30000);
}

async retrySyncEntry(syncEntryId: string): Promise<void> {
 const tenantDbService = useTenantStore().tenantDbService;
 if (!tenantDbService) return;

 try {
   const entry = await tenantDbService.getSyncQueueEntry(syncEntryId);
   if (!entry) return;

   // Increment attempts und Status zurück auf PENDING
   await tenantDbService.updateSyncQueueEntryStatus(
     syncEntryId,
     SyncStatus.PENDING,
     undefined,
     (entry.attempts || 0) + 1
   );

   // Trigger neue Sync-Verarbeitung
   await this.processSyncQueue();
 } catch (error) {
   errorLog('WebSocketService', 'Fehler beim Retry der Sync-Operation', error);
 }
}
```

#### Phase 4: Stuck Processing Entries Handling
```typescript
// In src/services/TenantDbService.ts
async resetStuckProcessingEntries(tenantId: string, timeoutMs: number = 30000): Promise<number> {
 if (!this.db) return 0;

 try {
   const cutoffTime = Date.now() - timeoutMs;
   const stuckEntries = await this.db.syncQueue
     .where('status').equals(SyncStatus.PROCESSING)
     .and(entry => entry.lastAttempt && entry.lastAttempt < cutoffTime)
     .toArray();

   let resetCount = 0;
   for (const entry of stuckEntries) {
     await this.updateSyncQueueEntryStatus(
       entry.id,
       SyncStatus.PENDING,
       'Reset from stuck processing state'
     );
     resetCount++;
   }

   if (resetCount > 0) {
     warnLog('TenantDbService', `${resetCount} stuck processing entries zurückgesetzt`);
   }

   return resetCount;
 } catch (error) {
   errorLog('TenantDbService', 'Fehler beim Zurücksetzen stuck processing entries', error);
   return 0;
 }
}
```

### Testing-Strategie

#### Test-Klasse: [`SyncAcknowledgmentTester`](../src/test-sync-acknowledgment.ts)
```typescript
export class SyncAcknowledgmentTester {
 async testSyncAckProcessing(): Promise<void> {
   // Test: ACK-Nachricht entfernt Queue-Eintrag
 }

 async testSyncNackProcessing(): Promise<void> {
   // Test: NACK-Nachricht triggert Retry-Mechanismus
 }

 async testRetryMechanism(): Promise<void> {
   // Test: Exponential backoff und max retries
 }

 async testStuckProcessingReset(): Promise<void> {
   // Test: Automatisches Zurücksetzen von stuck entries
 }
}
```

### Validierung

#### Checkliste:
- [ ] Backend sendet ACK bei erfolgreicher Sync-Verarbeitung
- [ ] Backend sendet NACK bei Fehlern mit aussagekräftigem Grund
- [ ] Frontend entfernt Queue-Einträge nur nach ACK
- [ ] Retry-Mechanismen funktionieren mit exponential backoff
- [ ] Stuck processing entries werden automatisch zurückgesetzt
- [ ] Maximale Retry-Anzahl wird respektiert
- [ ] Fehlerbehandlung ist robust und informativ

#### Test-Szenarien:
1. **Erfolgreiche Sync**: ACK wird empfangen, Queue-Eintrag entfernt
2. **Netzwerk-Fehler**: NACK mit Retry-Mechanismus
3. **Validierungs-Fehler**: NACK mit begrenzten Retries
4. **Konflikt**: NACK mit LWW-Auflösung
5. **Timeout**: Stuck entry wird automatisch zurückgesetzt
6. **Max Retries**: Entry wird als dauerhaft fehlgeschlagen markiert

---

## WebSocket-Reconnection-Verbesserungen

**Letztes Update:** 2025-01-13
**Status:** Verbesserungsvorschlag - Mittlere Priorität
**Anwendungsfall:** Robuste WebSocket-Verbindungswiederherstellung

### Übersicht
Verbesserung des bestehenden WebSocket-Reconnection-Mechanismus mit exponential backoff, besserer Fehlerbehandlung und automatischer Sync-Queue-Verarbeitung nach Reconnect.

### Aktuelle Implementierung
- Grundlegende Reconnection-Logik in [`WebSocketService.ts`](../src/services/WebSocketService.ts)
- Einfache Retry-Mechanismen ohne exponential backoff
- Keine optimierte Sync-Queue-Verarbeitung nach Reconnect

### Verbesserungsvorschläge

#### 1. Exponential Backoff
```typescript
// In src/services/WebSocketService.ts
class ReconnectionManager {
 private reconnectAttempts = 0;
 private maxReconnectAttempts = 10;
 private baseDelay = 1000; // 1 Sekunde
 private maxDelay = 30000; // 30 Sekunden

 calculateReconnectDelay(): number {
   const delay = Math.min(
     this.baseDelay * Math.pow(2, this.reconnectAttempts),
     this.maxDelay
   );
   return delay + Math.random() * 1000; // Jitter hinzufügen
 }

 async attemptReconnect(): Promise<void> {
   if (this.reconnectAttempts >= this.maxReconnectAttempts) {
     errorLog('WebSocketService', 'Maximale Reconnection-Versuche erreicht');
     return;
   }

   const delay = this.calculateReconnectDelay();
   this.reconnectAttempts++;

   setTimeout(() => {
     this.connect();
   }, delay);
 }

 resetReconnectAttempts(): void {
   this.reconnectAttempts = 0;
 }
}
```

#### 2. Network Status Detection
```typescript
// In src/services/WebSocketService.ts
class NetworkStatusManager {
 private isOnline = navigator.onLine;

 initialize(): void {
   window.addEventListener('online', this.handleOnline.bind(this));
   window.addEventListener('offline', this.handleOffline.bind(this));
 }

 private handleOnline(): void {
   this.isOnline = true;
   infoLog('WebSocketService', 'Netzwerk wieder verfügbar - Reconnection wird versucht');
   // Sofortige Reconnection bei Netzwerk-Wiederherstellung
   WebSocketService.connect();
 }

 private handleOffline(): void {
   this.isOnline = false;
   warnLog('WebSocketService', 'Netzwerk nicht verfügbar - Offline-Modus aktiviert');
 }

 getNetworkStatus(): boolean {
   return this.isOnline;
 }
}
```

#### 3. Heartbeat/Ping-Pong
```typescript
// In src/services/WebSocketService.ts
class HeartbeatManager {
 private heartbeatInterval: number | null = null;
 private heartbeatTimeout: number | null = null;
 private readonly HEARTBEAT_INTERVAL = 30000; // 30 Sekunden
 private readonly HEARTBEAT_TIMEOUT = 5000; // 5 Sekunden

 startHeartbeat(): void {
   this.heartbeatInterval = window.setInterval(() => {
     this.sendPing();
   }, this.HEARTBEAT_INTERVAL);
 }

 stopHeartbeat(): void {
   if (this.heartbeatInterval) {
     clearInterval(this.heartbeatInterval);
     this.heartbeatInterval = null;
   }
   if (this.heartbeatTimeout) {
     clearTimeout(this.heartbeatTimeout);
     this.heartbeatTimeout = null;
   }
 }

 private sendPing(): void {
   if (WebSocketService.socket?.readyState === WebSocket.OPEN) {
     WebSocketService.sendMessage({ type: 'ping' });

     // Timeout für Pong-Antwort
     this.heartbeatTimeout = window.setTimeout(() => {
       warnLog('WebSocketService', 'Heartbeat timeout - Verbindung möglicherweise unterbrochen');
       WebSocketService.disconnect();
       WebSocketService.connect();
     }, this.HEARTBEAT_TIMEOUT);
   }
 }

 handlePong(): void {
   if (this.heartbeatTimeout) {
     clearTimeout(this.heartbeatTimeout);
     this.heartbeatTimeout = null;
   }
 }
}
```

### Wichtige Überlegungen
- **Battery-Optimierung**: Reduzierte Reconnection-Frequenz auf mobilen Geräten
- **User Experience**: Benutzerfreundliche Benachrichtigungen über Verbindungsstatus
- **Performance**: Vermeidung von Connection-Spam bei schlechter Verbindung
- **Logging**: Umfassendes Logging für Debugging von Verbindungsproblemen

---

## Transaction-Synchronisation (Nächste Priorität)

**Letztes Update:** 2025-01-13
**Status:** Geplant - Hohe Priorität nach ACK/NACK-System
**Anwendungsfall:** Bidirektionale Synchronisation für Transaktionen

### Übersicht
Erweiterung der bestehenden Synchronisations-Architektur auf Transaktionen. Dies ist kritisch, da Transaktionen das Herzstück der Finanzmanagement-App sind.

### Besondere Herausforderungen
- **Hohe Datenvolumen**: Tausende von Transaktionen pro Mandant
- **Komplexe Beziehungen**: Verknüpfungen zu Accounts, Categories, Tags, Recipients
- **Performance**: Effiziente Synchronisation großer Datenmengen
- **Integrität**: Konsistenz zwischen verknüpften Entitäten

### Implementierungsstrategie
1. **Batch-Synchronisation**: Mehrere Transaktionen in einer WebSocket-Nachricht
2. **Incremental Sync**: Nur geänderte Transaktionen übertragen
3. **Dependency Management**: Sicherstellen, dass verknüpfte Entitäten existieren
4. **Performance-Optimierung**: Indizierung und Paginierung

### Zu modifizierende Dateien
- [`src/stores/transactionStore.ts`](../src/stores/transactionStore.ts) - Sync-Integration
- [`src/services/TenantDbService.ts`](../src/services/TenantDbService.ts) - Transaction-CRUD
- Backend: `app/models/financial_models.py`, `app/crud/crud_transaction.py`
- Backend: `app/services/sync_service.py` - Transaction-Sync-Logik

### Implementierungsplan
1. **Phase 1**: Grundlegende Transaction-Sync (CREATE, UPDATE, DELETE)
2. **Phase 2**: Batch-Operationen und Performance-Optimierung
3. **Phase 3**: Dependency-Management und Integrität
4. **Phase 4**: Umfassende Tests und Edge-Case-Handling
   async def process_sync_item(item: SyncQueueItem):
       try:
           # Sync-Operation durchführen
           result = await perform_sync_operation(item)

           # Bestätigung an Frontend senden
           await send_sync_confirmation(item.tenant_id, item.id, 'success', result)
       except Exception as e:
           # Fehler-Bestätigung senden
           await send_sync_confirmation(item.tenant_id, item.id, 'error', str(e))
   ```

2. **Frontend-Bestätigungsverarbeitung**
   ```typescript
   // In src/services/WebSocketService.ts
   case 'sync_confirmation':
     await tenantDbService?.removeSyncQueueItem(message.payload.sync_id);
     break;
   ```

### Validierung der Lösung

#### Checkliste Problem 1:
- [ ] Account-CRUD-Operationen verwenden Sync-Queue
- [ ] Account Group-CRUD-Operationen verwenden Sync-Queue
- [ ] Online-Synchronisation erfolgt sofort über Sync-Queue
- [ ] Offline-Synchronisation wird in Queue gespeichert
- [ ] Konsistente Synchronisationslogik für alle Entitäten

#### Checkliste Problem 2:
- [ ] Backend sendet Sync-Bestätigungen
- [ ] Frontend verarbeitet Sync-Bestätigungen
- [ ] Sync-Queue wird nach erfolgreicher Sync geleert
- [ ] Fehlerhafte Sync-Versuche werden korrekt behandelt
- [ ] Sync-Queue-Status wird korrekt verwaltet

#### Test-Szenarien:
1. **Online-Account-Erstellung**: Account wird erstellt, sofort synchronisiert, Bestätigung empfangen, Queue geleert
2. **Offline-Account-Erstellung**: Account wird erstellt, in Queue gespeichert, bei Reconnect synchronisiert und bestätigt
3. **Sync-Fehler**: Fehlgeschlagene Synchronisation wird korrekt behandelt, Queue-Item bleibt für Retry
4. **Mehrere Queue-Items**: Alle Items werden sequenziell abgearbeitet und bestätigt

### Priorität
**Hoch** - Diese Probleme beeinträchtigen die Datenintegrität und Benutzererfahrung erheblich. Eine schnelle Lösung ist erforderlich, um eine zuverlässige Synchronisation zu gewährleisten.
