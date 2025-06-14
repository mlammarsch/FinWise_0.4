# FinWise Systemarchitektur

## Überblick

FinWise folgt einer **Offline-First, Multi-Tenant Architektur** mit bidirektionaler Synchronisation zwischen Frontend und Backend. Das System ist darauf ausgelegt, vollständig offline zu funktionieren und Daten bei verfügbarer Internetverbindung zu synchronisieren.

## Architekturprinzipien

### 1. Offline-First
- Alle Daten werden primär lokal gespeichert (IndexedDB)
- App funktioniert vollständig ohne Internetverbindung
- Synchronisation erfolgt opportunistisch bei verfügbarer Verbindung

### 2. Multi-Tenant
- Strikte Datentrennung zwischen Mandanten
- Separate SQLite-Datenbanken pro Mandant im Backend
- Mandantenspezifische IndexedDB-Stores im Frontend

### 3. Event-Driven Synchronisation
- WebSocket-basierte Echtzeit-Updates
- Queue-basierte Offline-Synchronisation
- Last-Write-Wins Konfliktlösung

## Frontend-Architektur

### Technologie-Stack
- **Framework**: Vue 3 mit Composition API
- **Build Tool**: Vite
- **Sprache**: TypeScript
- **State Management**: Pinia
- **Lokale Persistierung**: IndexedDB mit Dexie.js
- **UI Framework**: DaisyUI + TailwindCSS
- **Charts**: ApexCharts, Chart.js
- **Icons**: Iconify

### Verzeichnisstruktur
```
src/
├── components/          # Vue-Komponenten
│   ├── account/        # Konto-spezifische Komponenten
│   ├── budget/         # Budget-Komponenten
│   ├── transaction/    # Transaktions-Komponenten
│   ├── planning/       # Planungs-Komponenten (NEU)
│   ├── rules/          # Regel-Komponenten
│   └── ui/             # Wiederverwendbare UI-Komponenten
├── stores/             # Pinia Stores
├── services/           # Business Logic Services
├── views/              # Seiten-Komponenten
│   ├── admin/          # Admin-Ansichten
│   └── auth/           # Authentifizierungs-Ansichten
├── types/              # TypeScript-Typdefinitionen
├── utils/              # Hilfsfunktionen
├── router/             # Vue Router Konfiguration
└── layouts/            # Layout-Komponenten
```

### Pinia Store-Architektur

#### Core Stores:
- **[`sessionStore.ts`](src/stores/sessionStore.ts)**: Aktuelle Benutzer- und Mandanten-Session
- **[`userStore.ts`](src/stores/userStore.ts)**: Benutzerverwaltung und IndexedDB-Konfiguration
- **[`tenantStore.ts`](src/stores/tenantStore.ts)**: Mandantenverwaltung
- **[`webSocketStore.ts`](src/stores/webSocketStore.ts)**: WebSocket-Verbindungsstatus

#### Daten-Stores:
- **[`accountStore.ts`](src/stores/accountStore.ts)**: Kontenverwaltung (vollständig synchronisiert)
- **[`transactionStore.ts`](src/stores/transactionStore.ts)**: Transaktionsverwaltung
- **[`categoryStore.ts`](src/stores/categoryStore.ts)**: Kategorienverwaltung (vollständig synchronisiert)
- **[`planningStore.ts`](src/stores/planningStore.ts)**: Planungstransaktionen (NEU - vollständig implementiert)
- **[`tagStore.ts`](src/stores/tagStore.ts)**: Tag-Verwaltung (vollständig synchronisiert)
- **[`recipientStore.ts`](src/stores/recipientStore.ts)**: Empfänger-Verwaltung (vollständig synchronisiert)
- **[`ruleStore.ts`](src/stores/ruleStore.ts)**: Automatisierungsregeln (vollständig synchronisiert)

#### UI-Stores:
- **[`settingsStore.ts`](src/stores/settingsStore.ts)**: App-Einstellungen
- **[`themeStore.ts`](src/stores/themeStore.ts)**: Theme-Verwaltung
- **[`searchStore.ts`](src/stores/searchStore.ts)**: Suchfunktionalität
- **[`transactionFilterStore.ts`](src/stores/transactionFilterStore.ts)**: Transaktionsfilter

### Service-Layer

#### Core Services:
- **[`SessionService.ts`](src/services/SessionService.ts)**: Session-Management und Router Guards
- **[`TenantDbService.ts`](src/services/TenantDbService.ts)**: IndexedDB-Operationen pro Mandant
- **[`WebSocketService.ts`](src/services/WebSocketService.ts)**: WebSocket-Kommunikation
- **[`DataService.ts`](src/services/DataService.ts)**: Daten-Persistierung (Legacy localStorage)

#### Business Logic Services:
- **[`AccountService.ts`](src/services/AccountService.ts)**: Konto-Geschäftslogik
- **[`TransactionService.ts`](src/services/TransactionService.ts)**: Transaktions-Geschäftslogik
- **[`PlanningService.ts`](src/services/PlanningService.ts)**: Planning-Geschäftslogik (NEU - vollständig implementiert)
- **[`BudgetService.ts`](src/services/BudgetService.ts)**: Budget-Berechnungen
- **[`BalanceService.ts`](src/services/BalanceService.ts)**: Saldo-Berechnungen
- **[`ReconciliationService.ts`](src/services/ReconciliationService.ts)**: Kontoabstimmung

#### Utility Services:
- **[`apiService.ts`](src/services/apiService.ts)**: HTTP-API-Kommunikation
- **[`CSVImportService.ts`](src/services/CSVImportService.ts)**: CSV-Import-Funktionalität

### Datenmodell (Frontend)

Zentrale Typdefinitionen in [`src/types/index.ts`](src/types/index.ts):

#### Hauptentitäten:
- **Account**: Konten mit Typ, Saldo, Kreditlimit
- **AccountGroup**: Kontengruppen für Organisation
- **Transaction**: Transaktionen mit Kategorien, Tags, Empfängern
- **Category/CategoryGroup**: Kategorien für Budgetierung
- **PlanningTransaction**: Wiederkehrende/geplante Transaktionen (NEU - vollständig implementiert)
- **Tag**: Flexible Tagging-System
- **Recipient**: Empfänger/Zahlungsempfänger
- **AutomationRule**: Regeln für automatische Kategorisierung

#### Synchronisation:
- **SyncQueueEntry**: Queue-Einträge für Offline-Synchronisation
- **WebSocket-Messages**: Typisierte WebSocket-Nachrichten
- **SyncOperationType**: CREATE, UPDATE, DELETE, INITIAL_LOAD

## Backend-Architektur

### Technologie-Stack
- **Framework**: FastAPI
- **ORM**: SQLAlchemy
- **Datenbank**: SQLite (pro Mandant)
- **Validierung**: Pydantic
- **Authentifizierung**: Bcrypt + Token-basiert
- **WebSockets**: FastAPI WebSocket Support
- **Testing**: Pytest

### Verzeichnisstruktur
```
app/
├── api/
│   └── v1/endpoints/    # API-Endpunkte
├── crud/               # CRUD-Operationen
├── db/                 # Datenbank-Konfiguration
├── models/             # SQLAlchemy-Modelle und Pydantic-Schemas
├── routers/            # FastAPI-Router
├── services/           # Business Logic Services
├── utils/              # Hilfsfunktionen
└── websocket/          # WebSocket-Endpunkte und Schemas
```

### Datenbank-Architektur

#### Multi-Tenant-Setup:
- **Haupt-DB**: `main.db` für User- und Mandanten-Informationen
- **Mandanten-DBs**: Separate SQLite-Dateien pro Mandant in `tenant_databases/`

#### Haupt-DB Schema ([`app/models/user_tenant_models.py`](../FinWise_0.4_BE/app/models/user_tenant_models.py)):
- **User**: Benutzerinformationen
- **Tenant**: Mandanteninformationen
- **UserTenant**: Benutzer-Mandanten-Zuordnungen

#### Mandanten-DB Schema ([`app/models/financial_models.py`](../FinWise_0.4_BE/app/models/financial_models.py)):
- **AccountGroup**: Kontengruppen
- **Account**: Konten mit Beziehung zu AccountGroup
- **PlanningTransaction**: Geplante Transaktionen (NEU - vollständig implementiert)
- Weitere Entitäten (Transactions, Categories, etc.) folgen demselben Muster

### WebSocket-Architektur

#### Connection Management:
- **[`ConnectionManager`](../FinWise_0.4_BE/app/websocket/connection_manager.py)**: Verwaltet WebSocket-Verbindungen pro Mandant
- **Session-basierte Zuordnung**: Clients werden nach Mandant gruppiert

#### Message Types ([`app/websocket/schemas.py`](../FinWise_0.4_BE/app/websocket/schemas.py)):
- **StatusMessage**: Backend-Status (online/offline/maintenance)
- **DataUpdateNotificationMessage**: Datenänderungen
- **InitialDataLoadMessage**: Initiale Daten für neue Clients
- **RequestInitialDataMessage**: Anfrage für initiale Daten
- **SyncAckMessage**: Sync-Bestätigungen (NEU - vollständig implementiert)
- **SyncNackMessage**: Sync-Fehler-Nachrichten (NEU - vollständig implementiert)

### Synchronisation-Service

#### [`app/services/sync_service.py`](../FinWise_0.4_BE/app/services/sync_service.py):
- **Sync-Queue-Verarbeitung**: Verarbeitet Offline-Änderungen vom Frontend
- **Konfliktlösung**: Last-Write-Wins basierend auf `updated_at`
- **Broadcast-Funktionalität**: Sendet Änderungen an alle Clients eines Mandanten
- **Initial Data Load**: Stellt initiale Daten für neue Verbindungen bereit
- **ACK/NACK-System**: Sync-Bestätigungen (NEU - vollständig implementiert)

## Planning-Architektur (NEU - Vollständig implementiert)

### PlanningService ([`src/services/PlanningService.ts`](src/services/PlanningService.ts))

#### Kernfunktionalitäten:
- **CRUD-Operationen**: Vollständige Verwaltung von Planungstransaktionen
- **Recurrence-Engine**: Komplexe Wiederholungsmuster mit intelligenter Datumsberechnung
- **Transfer-Logic**: Automatische Gegenbuchungen für Account- und Category-Transfers
- **Auto-Execution**: Automatische Ausführung fälliger Planungstransaktionen
- **Forecast-Updates**: Intelligente Prognoseberechnung für zukünftige Perioden

#### Recurrence-Patterns:
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
```

#### Weekend-Handling:
```typescript
enum WeekendHandlingType {
  NONE = 'none',
  BEFORE = 'before',  // Verschiebe auf Freitag
  AFTER = 'after'     // Verschiebe auf Montag
}
```

#### Transfer-Handling:
- **Account-Transfers**: Automatische Gegenbuchung zwischen Konten
- **Category-Transfers**: Automatische Gegenbuchung zwischen Kategorien
- **Counter-Planning**: Verknüpfte Planungstransaktionen für Transfers

### PlanningStore ([`src/stores/planningStore.ts`](src/stores/planningStore.ts))

#### Architektur-Features:
- **IndexedDB-Integration**: Vollständige Persistierung über TenantDbService
- **Migration-Support**: Automatische Migration von localStorage zu IndexedDB
- **Reactive State**: Vue 3 Composition API mit computed getters
- **Error-Handling**: Robuste Fehlerbehandlung mit umfassendem Logging

#### Store-Methoden:
```typescript
// CRUD-Operationen
addPlanningTransaction(planning: Partial<PlanningTransaction>)
updatePlanningTransaction(id: string, updates: Partial<PlanningTransaction>)
deletePlanningTransaction(id: string)

// Getter
getPlanningTransactionById(id: string)
getUpcomingTransactions(days: number)

// Persistence
loadPlanningTransactions()
reset()
```

### TenantDbService Planning-Integration

#### CRUD-Methoden:
```typescript
// Planning-spezifische Methoden
createPlanningTransaction(planningTransaction: PlanningTransaction)
updatePlanningTransaction(id: string, updates: Partial<PlanningTransaction>)
deletePlanningTransaction(id: string)
getPlanningTransactions()
getPlanningTransactionById(id: string)
```

#### Timestamp-Management:
- Automatische `updated_at` Timestamps für LWW-Konfliktlösung
- Plain-Object-Conversion für sichere IndexedDB-Serialisierung

## Testing-Architektur (NEU - Vollständig implementiert)

### Testing-Guidelines ([`TESTING_GUIDELINES.md`](TESTING_GUIDELINES.md))

#### Vitest-Setup:
- **TypeScript-Konfiguration**: Vollständige Integration mit Vue 3 und Pinia
- **Mock-Strategien**: Patterns für Stores, Services und externe Libraries
- **AAA-Pattern**: Strukturierte Test-Organisation (Arrange, Act, Assert)
- **Debugging-Tools**: Temporäres Logging und Debug-Strategien

#### Mocking-Patterns:
```typescript
// Store-Mocking
vi.mock('@/stores/tenantStore', () => ({
  useTenantStore: vi.fn()
}));

// Service-Mocking
vi.mock('@/utils/logger', () => ({
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  errorLog: vi.fn()
}));

// External Library-Mocking
vi.mock('uuid', () => ({
  v4: vi.fn()
}));
```

### Integration Testing ([`TESTING_INTEGRATION.md`](TESTING_INTEGRATION.md))

#### Test-Kategorien:
- **sync-integration.test.ts**: Hauptintegrationstests für Sync-Pipeline (8 Tests)
- **account-sync.test.ts**: Account-spezifische Sync-Tests (6 Tests)
- **account-group-sync.test.ts**: AccountGroup-spezifische Sync-Tests (6 Tests)
- **sync-error-handling.test.ts**: Error-Handling und Recovery-Tests (6 Tests)
- **planning-store-migration.test.ts**: Planning-Store-Migration-Tests (NEU)

#### Mock-Architektur:
```typescript
// MockWebSocketServer
class MockWebSocketServer {
  simulateOnlineMode()
  simulateOfflineMode()
  simulateAutoACK()
  simulateAutoNACK()
  simulatePartialFailure()
}

// MockTenantService
class MockTenantService {
  mockIndexedDB()
  mockStores()
  generateTestData()
  manageSyncQueue()
}

// TestDataGenerator
class TestDataGenerator {
  generateAccount()
  generateAccountGroup()
  generatePlanningTransaction()
  generateSyncQueueEntry()
}
```

#### Performance-Metriken:
- **Sync-Latenz**: < 200ms für Online-Operationen
- **Error-Recovery**: Exponential backoff verhindert Server-Überlastung
- **Memory-Management**: Cleanup nach jedem Test verhindert Memory-Akkumulation

## Synchronisations-Architektur

### Datenfluss

#### Online-Synchronisation:
1. **Frontend-Änderung** → Lokale IndexedDB-Aktualisierung
2. **WebSocket-Nachricht** → Backend-Verarbeitung
3. **Backend-Validierung** → Datenbank-Update
4. **Broadcast** → Alle anderen Clients des Mandanten

#### Offline-Synchronisation:
1. **Frontend-Änderung** → Lokale IndexedDB + Sync-Queue
2. **Verbindung verfügbar** → Queue-Verarbeitung
3. **Batch-Sync** → Backend verarbeitet Queue-Einträge
4. **Konfliktlösung** → Last-Write-Wins bei Konflikten

### Sync-Acknowledgment-System (NEU - Vollständig implementiert)

#### ACK/NACK-Nachrichten:
```typescript
interface SyncAckMessage {
  type: 'sync_ack';
  id: string;              // SyncQueueEntry.id
  status: 'processed';
  entityId: string;
  entityType: EntityType;
  operationType: SyncOperationType;
}

interface SyncNackMessage {
  type: 'sync_nack';
  id: string;              // SyncQueueEntry.id
  status: 'failed';
  entityId: string;
  entityType: EntityType;
  operationType: SyncOperationType;
  reason: string;          // Fehlergrund
  detail?: string;         // Detaillierte Fehlermeldung
  attempts?: number;       // Anzahl Versuche
}
```

#### Retry-Mechanismen:
- **Exponential Backoff**: 1s, 2s, 4s, 8s, 16s, max 30s
- **Max Retries**: Abhängig vom Fehlertyp (validation_error: 2, network_error: 5)
- **Stuck Processing Recovery**: Automatisches Zurücksetzen nach Timeout

### Konfliktlösung

#### Last-Write-Wins (LWW):
- Jede Entität hat ein `updated_at` Timestamp-Feld
- Bei Konflikten gewinnt der Datensatz mit dem neueren Timestamp
- Implementiert sowohl im Frontend als auch Backend

#### Implementierung:
```typescript
// Frontend (Store)
if (new Date(incomingData.updated_at) > new Date(localData.updated_at)) {
  // Update lokale Daten
}

// Backend (CRUD)
if (incoming_data.updated_at > db_obj.updated_at:
  # Update Datenbank
```

## Kritische Implementierungspfade

### 1. Account/AccountGroup Synchronisation (✅ Vollständig implementiert)
- **Frontend**: [`accountStore.ts`](src/stores/accountStore.ts) mit vollständiger Sync-Integration
- **Backend**: [`crud_account.py`](../FinWise_0.4_BE/app/crud/crud_account.py) und [`crud_account_group.py`](../FinWise_0.4_BE/app/crud/crud_account_group.py)
- **WebSocket**: Bidirektionale Updates zwischen allen Clients
- **Testing**: Umfassende Integration Tests implementiert

### 2. Planning-Funktionalität (✅ Vollständig implementiert)
- **Frontend**: [`PlanningService.ts`](src/services/PlanningService.ts) und [`planningStore.ts`](src/stores/planningStore.ts)
- **IndexedDB**: Vollständige Integration in [`TenantDbService.ts`](src/services/TenantDbService.ts)
- **Business Logic**: Komplexe Recurrence-Engine und Transfer-Handling
- **Migration**: Automatische localStorage zu IndexedDB Migration

### 3. Sync-Acknowledgment-System (✅ Vollständig implementiert)
- **Priorität**: Kritisch für zuverlässige Synchronisation
- **Frontend**: [`WebSocketService.ts`](src/services/WebSocketService.ts) - ACK/NACK-Verarbeitung
- **Backend**: Sync-Service erweitert um Bestätigungsnachrichten
- **Features**: Retry-Mechanismen, Queue-Bereinigung, Timeout-Handling
- **Testing**: [`src/test-sync-acknowledgment.ts`](src/test-sync-acknowledgment.ts) für umfassende Tests

### 4. Erweiterte Entitäts-Synchronisation (✅ Vollständig implementiert)
- **Categories/CategoryGroups**: [`categoryStore.ts`](src/stores/categoryStore.ts) mit vollständiger Sync-Integration
- **Tags**: [`tagStore.ts`](src/stores/tagStore.ts) - Hierarchische Tag-Struktur mit Sync
- **Recipients**: [`recipientStore.ts`](src/stores/recipientStore.ts) - Empfänger-Management mit Sync
- **AutomationRules**: [`ruleStore.ts`](src/stores/ruleStore.ts) - Regel-Engine mit Sync-Support

### 5. Planning-Synchronisation (📋 Nächste Priorität)
- **Status**: Planning-Funktionalität implementiert, Sync-Integration ausstehend
- **Herausforderung**: Komplexe Recurrence-Patterns und Counter-Bookings
- **Strategie**: Erweitern der bestehenden Sync-Architektur auf PlanningTransactions

### 6. Transaction Synchronisation (📋 Hohe Priorität nach Planning-Sync)
- **Priorität**: Höchste nach Planning-Sync-System
- **Komplexität**: Hoch wegen Volumen und Beziehungen zu anderen Entitäten
- **Herausforderung**: Performance bei großen Datenmengen
- **Strategie**: Batch-Synchronisation und Incremental Sync

### 7. Session Management (✅ Implementiert)
- **[`SessionService.ts`](src/services/SessionService.ts)**: Router Guards und Authentifizierung
- **[`sessionStore.ts`](src/stores/sessionStore.ts)**: Persistente Session-Daten in IndexedDB
- **Backend**: Token-basierte Authentifizierung

### 8. IndexedDB-Integration (✅ Vollständig migriert)
- **[`TenantDbService.ts`](src/services/TenantDbService.ts)**: Zentrale Datenbank-Operationen
- **Dexie.js**: Typisierte IndexedDB-Wrapper
- **Mandantenspezifische DBs**: Separate Datenbanken pro Mandant
- **Migration**: Vollständig von localStorage zu IndexedDB migriert

## Design Patterns

### Frontend Patterns:
- **Composition API**: Vue 3 Composition API für bessere TypeScript-Integration
- **Store Pattern**: Pinia für zentrales State Management
- **Service Layer**: Trennung von UI und Business Logic
- **Observer Pattern**: Reactive Updates zwischen Stores

### Backend Patterns:
- **Repository Pattern**: CRUD-Layer für Datenzugriff
- **Service Layer**: Business Logic in Services
- **Observer Pattern**: WebSocket-Broadcasts bei Datenänderungen
- **Strategy Pattern**: Verschiedene Sync-Strategien

## Sicherheitsarchitektur

### Authentifizierung:
- **Token-basiert**: JWT-ähnliche Token für API-Zugriff
- **Session-Persistierung**: Sichere Speicherung in IndexedDB
- **Bcrypt**: Password-Hashing im Backend

### Datenschutz:
- **Mandantentrennung**: Strikte Isolation zwischen Mandanten
- **Lokale Verschlüsselung**: Sensitive Daten in IndexedDB
- **CORS-Konfiguration**: Beschränkung auf erlaubte Origins

### Validierung:
- **Frontend**: TypeScript-Typen + Pydantic-Schema-Validierung
- **Backend**: Pydantic-Schemas für alle API-Endpunkte
- **Datenbank**: SQLAlchemy-Constraints

## Performance-Überlegungen

### Frontend:
- **Lazy Loading**: Komponenten und Daten bei Bedarf laden
- **Virtual Scrolling**: Für große Transaktionslisten
- **Debouncing**: Bei Sucheingaben und Filtern
- **Caching**: Berechnete Werte in Stores cachen

### Backend:
- **Indexierung**: Optimierte DB-Indizes für häufige Abfragen
- **Paginierung**: Für große Datenmengen
- **Connection Pooling**: Effiziente DB-Verbindungen
- **Batch Operations**: Für Bulk-Sync-Operationen

### Synchronisation:
- **Incremental Sync**: Nur geänderte Daten übertragen
- **Compression**: WebSocket-Nachrichten komprimieren (geplant)
- **Batching**: Mehrere Änderungen in einer Nachricht (geplant)
- **ACK/NACK-System**: Zuverlässige Queue-Verarbeitung (implementiert)
- **Retry-Mechanismen**: Exponential backoff bei Fehlern (implementiert)

## Deployment-Architektur

### Entwicklung:
- **Frontend**: Vite Dev Server (Port 5173)
- **Backend**: Uvicorn (Port 8000)
- **Datenbanken**: Lokale SQLite-Dateien

### Produktion (geplant):
- **Frontend**: Statische Dateien (Nginx/CDN)
- **Backend**: FastAPI mit Gunicorn/Uvicorn
- **Datenbanken**: SQLite oder PostgreSQL
- **WebSockets**: Load Balancer mit Sticky Sessions

## Aktuelle Architektur-Herausforderungen

### Kritische Issues (Hohe Priorität):
1. **Planning-Sync-Integration**: PlanningTransactions in Sync-System integrieren
2. **Transaction-Sync-Komplexität**: Hohe Datenvolumen und Beziehungen zu anderen Entitäten
3. **Performance bei großen Datenmengen**: Optimierung für Tausende von Transaktionen
4. **Initial Data Load**: Effizienter Bulk-Transfer für neue Clients

### Performance-Optimierungen (Mittlere Priorität):
1. **WebSocket-Reconnection**: Verbessertes Handling mit exponential backoff
2. **Batch-Operations**: Effiziente Verarbeitung großer Datenmengen
3. **Paginierung**: Für große Transaktionslisten
4. **Memory-Management**: Optimierung für große Datenmengen in IndexedDB

### Skalierungs-Vorbereitung (Niedrige Priorität):
1. **Multi-User-Support**: Vorbereitung auf mehrere Benutzer pro Mandant
2. **Database-Migration**: Vorbereitung auf PostgreSQL für Produktion
3. **Microservices**: Aufteilen in kleinere Services bei Bedarf

## Testing-Architektur

### Frontend-Testing:
- **Unit-Tests**: Vitest für isolierte Store- und Service-Tests
- **Integration-Tests**: Umfassende Sync-Funktionalitäts-Tests
- **Mock-Services**: Isolierte Tests ohne Backend-Abhängigkeiten
- **Test-Daten**: Realistische Test-Daten-Generatoren

### Backend-Testing:
- **Unit-Tests**: Pytest für CRUD-Operationen und Services
- **Integration-Tests**: WebSocket und Sync-Service-Tests (geplant)
- **API-Tests**: FastAPI Test-Client für Endpunkt-Tests

### End-to-End-Testing (geplant):
- **Sync-Szenarien**: Online/Offline/Konflikt-Tests
- **Performance-Tests**: Große Datenmengen und Concurrent Users
- **Browser-Tests**: Cross-Browser-Kompatibilität

## Erfolgreiche Architektur-Entscheidungen

### ✅ IndexedDB-Migration:
- **Offline-Performance**: Deutlich bessere Performance als localStorage
- **Mandantentrennung**: Saubere Datenisolation pro Mandant
- **Typisierung**: Vollständige TypeScript-Integration mit Dexie.js

### ✅ Sync-Acknowledgment-System:
- **Zuverlässigkeit**: ACK/NACK-System verhindert Datenverlust
- **Error-Recovery**: Exponential backoff verhindert Server-Überlastung
- **Queue-Management**: Automatische Bereinigung nach erfolgreicher Sync

### ✅ Planning-Service-Architektur:
- **Business Logic**: Komplexe Recurrence-Engine mit Transfer-Handling
- **Auto-Execution**: Automatische Ausführung fälliger Transaktionen
- **Forecast-System**: Intelligente Prognoseberechnung

### ✅ Testing-Infrastruktur:
- **Mock-Architektur**: Vollständige Isolation für zuverlässige Tests
- **Integration Tests**: 26 Tests validieren kritische Sync-Szenarien
- **Performance-Validierung**: Latenz, Error-Recovery, Memory-Management

## Architektur-Roadmap

### Kurzfristig (1-2 Wochen):
1. **Planning-WebSocket-Integration**: Vollständige Integration in Sync-System
2. **Transaction-Synchronisation**: Erweitern der Sync auf Transaktionen
3. **Performance-Optimierungen**: Batch-Operationen und Paginierung

### Mittelfristig (1-2 Monate):
1. **Initial Data Load Optimierung**: Effizienter Bulk-Transfer
2. **WebSocket-Reconnection**: Robuste Verbindungswiederherstellung
3. **Monitoring-Integration**: Metriken und Performance-Überwachung

### Langfristig (3-6 Monate):
1. **Multi-User-Support**: Mehrere Benutzer pro Mandant
2. **Database-Migration**: PostgreSQL für Produktionsumgebung
3. **Microservices-Vorbereitung**: Aufteilen bei Skalierungsanforderungen
