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
