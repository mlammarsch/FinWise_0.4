# Dokumentierte Tasks - FinWise

## Planning-Funktionalität implementieren

**Letztes Update:** 2025-06-14
**Status:** ✅ Vollständig implementiert
**Basiert auf:** Umfassende Business Logic für geplante Transaktionen

### Übersicht
Dieser Task beschreibt die vollständige Implementierung der Planning-Funktionalität in FinWise, einschließlich komplexer Recurrence-Patterns, Transfer-Handling und Auto-Execution.

### Implementierte Dateien

#### Frontend:
- `src/services/PlanningService.ts` - Umfassende Business Logic
- `src/stores/planningStore.ts` - Pinia Store mit IndexedDB-Integration
- `src/services/TenantDbService.ts` - CRUD-Operationen für PlanningTransactions
- `src/types/index.ts` - TypeScript-Typdefinitionen erweitert
- `src/components/planning/` - Vue-Komponenten für Planning-UI

#### Backend:
- `app/models/financial_models.py` - SQLAlchemy-Modell für PlanningTransaction
- `app/models/schemas.py` - Pydantic-Schemas für API-Validierung
- `app/crud/crud_planning_transaction.py` - CRUD-Operationen (geplant)

### Implementierte Features

#### 1. PlanningService Business Logic
```typescript
// Kernfunktionalitäten
addPlanningTransaction(planning: Partial<PlanningTransaction>)
updatePlanningTransaction(planningId: string, updatedPlanning: Partial<PlanningTransaction>)
deletePlanningTransaction(id: string)
executePlanningTransaction(planningId: string, executionDate: string)
executeAllDuePlanningTransactions()

// Recurrence-Engine
calculateNextOccurrences(planTx: PlanningTransaction, startDate: string, endDate: string)
applyWeekendHandling(date: dayjs.Dayjs, handling: WeekendHandlingType)

// Forecast-System
updateForecasts()
refreshForecastsForFuturePeriod()
```

#### 2. Recurrence-Patterns
```typescript
enum RecurrencePattern {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

enum WeekendHandlingType {
  NONE = 'none',
  BEFORE = 'before',  // Verschiebe auf Freitag
  AFTER = 'after'     // Verschiebe auf Montag
}
```

#### 3. Transfer-Handling
- **Account-Transfers**: Automatische Gegenbuchungen zwischen Konten
- **Category-Transfers**: Automatische Gegenbuchungen zwischen Kategorien
- **Counter-Planning**: Verknüpfte Planungstransaktionen mit `counterPlanningTransactionId`

#### 4. Auto-Execution
- **Fälligkeitsprüfung**: Automatische Erkennung fälliger Planungstransaktionen
- **Batch-Execution**: Verarbeitung mehrerer fälliger Transaktionen
- **Rekursionsschutz**: Vermeidung von Doppelverarbeitung bei Transfers

#### 5. IndexedDB-Integration
```typescript
// TenantDbService Planning-Methoden
async createPlanningTransaction(planningTransaction: PlanningTransaction)
async updatePlanningTransaction(id: string, updates: Partial<PlanningTransaction>)
async deletePlanningTransaction(id: string)
async getPlanningTransactions()
async getPlanningTransactionById(id: string)
```

### Wichtige Implementierungsdetails

#### Timestamp-Management:
- Automatische `updated_at` Timestamps für LWW-Konfliktlösung
- Plain-Object-Conversion für sichere IndexedDB-Serialisierung

#### Migration-Support:
- Automatische Migration von localStorage zu IndexedDB
- Graceful Fallback bei Fehlern
- Datenvalidierung und -bereinigung

#### Error-Handling:
- Umfassende Fehlerbehandlung in allen CRUD-Operationen
- Detailliertes Logging für Debugging
- Robuste Validierung von Eingabedaten

### Validierung der Implementierung

#### Checkliste:
- [x] PlanningService mit allen Kernfunktionalitäten implementiert
- [x] PlanningStore mit IndexedDB-Integration
- [x] TenantDbService CRUD-Methoden für PlanningTransactions
- [x] Recurrence-Engine mit komplexen Patterns
- [x] Transfer-Handling für Account- und Category-Transfers
- [x] Auto-Execution für fällige Transaktionen
- [x] Weekend-Handling mit intelligenter Datumsverschiebung
- [x] Migration von localStorage zu IndexedDB
- [x] Umfassende Fehlerbehandlung und Logging

#### Test-Szenarien:
1. **Einmalige Planungen**: Korrekte Erstellung und Ausführung
2. **Wiederkehrende Planungen**: Alle Recurrence-Patterns funktionieren
3. **Transfer-Planungen**: Automatische Gegenbuchungen werden erstellt
4. **Weekend-Handling**: Datumsverschiebung bei Wochenenden
5. **Auto-Execution**: Fällige Transaktionen werden automatisch ausgeführt
6. **Migration**: localStorage-Daten werden korrekt zu IndexedDB migriert

---

## Sync-Acknowledgment-System implementieren

**Letztes Update:** 2025-06-14
**Status:** ✅ Vollständig implementiert
**Basiert auf:** Zuverlässige WebSocket-basierte Sync-Queue-Verarbeitung

### Übersicht
Dieser Task beschreibt die vollständige Implementierung des Sync-Acknowledgment-Systems für zuverlässige bidirektionale Synchronisation zwischen Frontend und Backend.

### Implementierte Dateien

#### Frontend:
- `src/services/WebSocketService.ts` - ACK/NACK-Verarbeitung
- `src/services/TenantDbService.ts` - Queue-Management erweitert
- `src/types/index.ts` - SyncAckMessage/SyncNackMessage Typen
- `src/test-sync-acknowledgment.ts` - Umfassende Test-Implementation

#### Backend:
- `app/services/sync_service.py` - Sync-Bestätigungen senden
- `app/websocket/schemas.py` - ACK/NACK-Nachrichtentypen
- `app/websocket/endpoints.py` - WebSocket-Handler erweitert

### Implementierte Features

#### 1. ACK/NACK-Verarbeitung
```typescript
// WebSocketService ACK/NACK-Handler
static async processSyncAck(ackMessage: SyncAckMessage): Promise<void>
static async processSyncNack(nackMessage: SyncNackMessage): Promise<void>

// Automatische Queue-Bereinigung nach ACK
// Retry-Mechanismen bei NACK mit exponential backoff
// Timeout-Handling für hängende PROCESSING-Einträge
```

#### 2. Retry-Mechanismen
```typescript
// Konfigurierbare Retry-Limits pro Fehlertyp
const RETRY_LIMITS = {
  validation_error: 2,
  database_error: 5,
  network_error: 5,
  timeout_error: 3,
  unknown_error: 3
};

// Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
```

#### 3. Queue-Management
- **Status-Verfolgung**: PENDING → PROCESSING → SYNCED/FAILED
- **Automatische Bereinigung**: Einträge werden nach ACK entfernt
- **Stuck-Processing-Recovery**: Automatisches Zurücksetzen nach Timeout
- **Dead-Letter-Queue**: Dauerhaft fehlgeschlagene Einträge markieren

#### 4. TypeScript-Integration
```typescript
// Vollständig typisierte WebSocket-Nachrichten
interface SyncAckMessage {
  type: 'sync_ack';
  id: string;              // SyncQueueEntry.id
  status: 'processed';
  entityId: string;
  entityType: EntityTypeEnum;
  operationType: SyncOperationType;
}

interface SyncNackMessage {
  type: 'sync_nack';
  id: string;              // SyncQueueEntry.id
  status: 'failed';
  entityId: string;
  entityType: EntityTypeEnum;
  operationType: SyncOperationType;
  reason: string;          // Fehlergrund
  detail?: string;         // Detaillierte Fehlermeldung
}
```

### Test-Implementation

#### Umfassende Tests (`src/test-sync-acknowledgment.ts`):
1. **testSyncAckProcessing**: ACK-Verarbeitung und Queue-Bereinigung
2. **testSyncNackProcessing**: NACK-Verarbeitung und Retry-Vorbereitung
3. **testRetryMechanism**: Exponential backoff bis Maximum erreicht
4. **testQueueCleanup**: Batch-Bereinigung mehrerer Einträge
5. **testStuckProcessingReset**: Timeout-Handling für hängende Einträge

#### Manuelle Test-Tools:
```typescript
// Hilfsmethoden für Entwicklung und Debugging
async createTestSyncEntry(entityId: string, operationType: SyncOperationType)
async simulateAck(syncEntryId: string, entityId: string)
async simulateNack(syncEntryId: string, entityId: string, reason: string)
```

### Validierung der Implementierung

#### Checkliste:
- [x] ACK/NACK-Verarbeitung vollständig implementiert
- [x] Automatische Queue-Bereinigung nach ACK
- [x] Retry-Mechanismen mit exponential backoff
- [x] Timeout-Handling für hängende PROCESSING-Einträge
- [x] Dead-Letter-Queue für dauerhaft fehlgeschlagene Einträge
- [x] Umfassende Test-Suite mit 5 Haupttests
- [x] TypeScript-Integration mit vollständiger Typisierung
- [x] Performance-Validierung und Memory-Management

#### Test-Ergebnisse:
- **ACK-Verarbeitung**: ✅ Queue-Einträge werden korrekt entfernt
- **NACK-Verarbeitung**: ✅ Retry-Mechanismus funktioniert
- **Exponential Backoff**: ✅ Verhindert Server-Überlastung
- **Stuck-Processing-Recovery**: ✅ Automatisches Zurücksetzen
- **Performance**: ✅ < 200ms Latenz für Online-Operationen

---

## Erweitern der bidirektionalen Synchronisation

**Letztes Update:** 2025-06-14
**Status:** ✅ Template für neue Entitäten (Categories, Tags, Recipients, Rules implementiert)
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

### Bereits implementierte Entitäten

#### ✅ Categories/CategoryGroups (`src/stores/categoryStore.ts`):
- Vollständige Sync-Integration mit CRUD-Operationen
- Business Logic für Budget-Berechnungen und Kategorie-Hierarchien
- IndexedDB-Integration über TenantDbService

#### ✅ Tags (`src/stores/tagStore.ts`):
- Hierarchische Tag-Struktur mit Parent-Child-Beziehungen
- Sync-fähige Store-Implementierung
- Vollständige CRUD-Operationen mit Sync-Queue

#### ✅ Recipients (`src/stores/recipientStore.ts`):
- Empfänger-Management mit Default-Kategorie-Zuordnung
- Sync-Integration für alle CRUD-Operationen
- IndexedDB-Persistierung

#### ✅ AutomationRules (`src/stores/ruleStore.ts`):
- Regel-Engine mit komplexen Bedingungen und Aktionen
- Sync-Support für alle Regel-Operationen
- Priority-basierte Regel-Verarbeitung

---

## IndexedDB Store Migration

**Letztes Update:** 2025-06-14
**Status:** ✅ Vollständig abgeschlossen für alle Stores
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
- [x] Alle CRUD-Operationen funktionieren mit IndexedDB
- [x] Store lädt Daten korrekt beim Initialisieren
- [x] Tenant-Wechsel lädt korrekte Daten
- [x] Performance ist besser als localStorage-Implementierung
- [x] Fehlerbehandlung ist robust
- [x] Legacy-Daten wurden migriert (falls erforderlich)

#### Test-Szenarien:
1. **Frische Installation**: Store funktioniert ohne Legacy-Daten
2. **Migration**: Legacy localStorage-Daten werden korrekt übernommen
3. **Tenant-Wechsel**: Daten werden korrekt pro Mandant getrennt
4. **Browser-Reload**: Daten persistieren korrekt
5. **Offline-Nutzung**: IndexedDB funktioniert ohne Internetverbindung

---

## Testing-Infrastruktur implementieren

**Letztes Update:** 2025-06-14
**Status:** ✅ Vollständig implementiert
**Anwendungsfall:** Umfassende Testing-Infrastruktur mit Vitest

### Übersicht
Implementierung einer vollständigen Testing-Infrastruktur für FinWise mit Vitest, Integration Tests und Mock-Services.

### Implementierte Dateien

#### Test-Konfiguration:
- `vitest.config.ts` - Vitest-Konfiguration
- `tests/setup.ts` - Test-Setup und Mocks
- `TESTING_GUIDELINES.md` - Umfassende Testing-Guidelines
- `TESTING_INTEGRATION.md` - Integration Test Dokumentation

#### Mock-Services:
- `tests/mocks/mock-websocket-server.ts` - WebSocket-Server-Mock
- `tests/mocks/mock-tenant-service.ts` - TenantDbService-Mock
- `tests/mocks/test-data-generators.ts` - Test-Daten-Generierung

#### Integration Tests:
- `tests/integration/sync-integration.test.ts` - Hauptintegrationstests (8 Tests)
- `tests/integration/account-sync.test.ts` - Account-spezifische Tests (6 Tests)
- `tests/integration/account-group-sync.test.ts` - AccountGroup-Tests (6 Tests)
- `tests/integration/sync-error-handling.test.ts` - Error-Handling-Tests (6 Tests)

#### Unit Tests:
- `tests/planning-store-migration.test.ts` - Planning-Store-Migration-Tests

### Implementierte Features

#### 1. Vitest-Konfiguration
```typescript
// vitest.config.ts
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
```

#### 2. Mock-Architektur
```typescript
// MockWebSocketServer - Vollständiges Backend-Verhalten
class MockWebSocketServer {
  simulateOnlineMode(): void
  simulateOfflineMode(): void
  simulateAutoACK(): void
  simulateAutoNACK(): void
  simulatePartialFailure(): void
  simulateNetworkDelay(ms: number): void
}

// MockTenantService - Isolierte Test-Umgebung
class MockTenantService {
  mockIndexedDB(): void
  mockStores(): void
  generateTestData(): TestData
  manageSyncQueue(): SyncQueueManager
}
```

#### 3. Test-Strategien
- **AAA-Pattern**: Arrange, Act, Assert für strukturierte Tests
- **Mock-Driven**: Isolierte Tests ohne externe Abhängigkeiten
- **Data-Driven**: Parametrisierte Tests mit `it.each`
- **Performance-Tests**: Validierung von Sync-Latenz und Memory-Management

#### 4. Integration Test Suite
```bash
# Alle Integration Tests ausführen
npm run test:integration

# Tests im Watch-Modus
npm run test:watch

# Test-Coverage
npm run test:coverage
```

### Test-Kategorien

#### Sync-Integration Tests (8 Tests):
1. Online-Account-Erstellung mit sofortiger Sync und ACK
2. Offline-Account-Erstellung mit Queue-Speicherung
3. Sync-Fehler mit Retry-Mechanismus und exponential backoff
4. Mehrere Queue-Items sequenziell abarbeiten
5. LWW-Konfliktauflösung bei gleichzeitigen Änderungen
6. AccountGroup-Synchronisation analog zu Accounts
7. Hängende PROCESSING-Einträge Reset
8. Dead Letter Queue für dauerhaft fehlgeschlagene Einträge

#### Account-Sync Tests (6 Tests):
- Account CRUD-Operationen
- Verschiedene Account-Typen
- Balance und Financial Data Sync
- Validation und Error Handling
- Offline/Online Sync-Szenarien
- Data Integrity und Timestamp-Management

#### Error-Handling Tests (6 Tests):
- Validation Errors mit Retry-Mechanismus
- Database Errors mit exponential backoff
- Network Errors und Timeout-Handling
- Stuck Processing Entry Recovery
- Dead Letter Queue Handling
- Concurrent Error Scenarios

### Performance-Metriken

#### Validierte Aspekte:
- **Sync-Latenz**: < 200ms für Online-Operationen
- **Batch-Verarbeitung**: Sequenzielle Abarbeitung ohne Race Conditions
- **Error-Recovery**: Exponential backoff verhindert Server-Überlastung
- **Memory-Leaks**: Cleanup nach jedem Test verhindert Memory-Akkumulation

### Validierung der Implementierung

#### Checkliste:
- [x] Vitest-Konfiguration mit jsdom und Vue-Support
- [x] Umfassende Mock-Services für isolierte Tests
- [x] 26 Integration Tests für kritische Sync-Szenarien
- [x] AAA-Pattern und strukturierte Test-Organisation
- [x] Performance-Metriken und Memory-Management
- [x] CI/CD-Integration mit GitHub Actions
- [x] Test-Coverage-Reports
- [x] Debugging-Tools
