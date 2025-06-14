# Technische Spezifikationen - FinWise

## Frontend-Technologien

### Core Framework
- **Vue.js 3.5.10**: Progressive JavaScript Framework mit Composition API
- **TypeScript 5.5.3**: Statische Typisierung für bessere Entwicklererfahrung
- **Vite 5.4.14**: Moderner Build-Tool für schnelle Entwicklung

### State Management & Persistierung
- **Pinia 2.1.7**: Modernes State Management für Vue 3
- **Dexie.js 4.0.11**: TypeScript-freundlicher IndexedDB-Wrapper
- **IndexedDB**: Browser-native Datenbank für Offline-Persistierung

### UI & Styling
- **TailwindCSS 4.0.14**: Utility-First CSS Framework
- **DaisyUI 5.0.4**: Komponenten-Bibliothek für TailwindCSS
- **PostCSS 8.5.3**: CSS-Postprocessor
- **Sass-Embedded 1.85.1**: CSS-Präprozessor für erweiterte Styling-Features

### Charts & Visualisierung
- **ApexCharts 4.5.0**: Moderne, interaktive Charts
- **Chart.js 4.4.1**: Flexible Chart-Bibliothek
- **Vue-ChartJS 5.3.0**: Vue.js-Integration für Chart.js

### Icons & Assets
- **Iconify Vue 4.1.1**: Umfangreiche Icon-Bibliothek
- **Iconify Tailwind 1.0.0**: TailwindCSS-Integration für Icons
- **MDI Icons**: Material Design Icons Sammlung

### Utilities
- **Day.js 1.11.10**: Leichtgewichtige Datums-Bibliothek
- **Lodash 4.17.21**: Utility-Funktionen für JavaScript
- **UUID 11.1.0**: UUID-Generierung
- **bcryptjs 3.0.2**: Client-seitige Passwort-Hashing (falls benötigt)

### Development Tools
- **Vue TSC 2.1.6**: TypeScript-Compiler für Vue
- **Vitest 3.2.1**: Unit-Testing-Framework (NEU - aktualisiert)
- **Autoprefixer 10.4.21**: CSS-Vendor-Präfixe automatisch hinzufügen

### Testing Dependencies (NEU - Vollständig implementiert)
- **fake-indexeddb 6.0.0**: IndexedDB-Mock für Tests
- **jsdom 25.0.1**: DOM-Simulation für Tests
- **@types/node 22.15.29**: Node.js-Typen für Test-Umgebung

## Backend-Technologien

### Core Framework
- **FastAPI 0.115.12**: Modernes, schnelles Web-Framework für Python
- **Python 3.x**: Programmiersprache (Version aus requirements.txt nicht klar lesbar)
- **Uvicorn 0.34.2**: ASGI-Server für FastAPI

### Datenbank & ORM
- **SQLAlchemy 2.0.41**: Python SQL Toolkit und ORM
- **SQLite**: Leichtgewichtige, dateibasierte Datenbank
- **Multi-Tenant-Architektur**: Separate SQLite-Dateien pro Mandant

### Validierung & Serialisierung
- **Pydantic 2.11.5**: Datenvalidierung mit Python-Typen
- **Pydantic Core 2.33.2**: Performante Core-Bibliothek für Pydantic

### Authentifizierung & Sicherheit
- **Bcrypt 4.3.0**: Passwort-Hashing
- **Passlib 1.7.4**: Passwort-Hashing-Bibliothek
- **Python-Multipart 0.0.20**: Multipart-Form-Datenverarbeitung

### WebSocket & Kommunikation
- **WebSockets 15.0.1**: WebSocket-Implementierung
- **Starlette 0.46.2**: ASGI-Framework (FastAPI-Basis)

### Development & Testing
- **Pytest 8.3.5**: Testing-Framework
- **Python-dotenv 1.1.0**: Umgebungsvariablen aus .env-Dateien
- **Watchfiles 1.0.5**: Datei-Überwachung für Auto-Reload

### Utilities
- **PyYAML 6.0.2**: YAML-Parser
- **Click 8.2.1**: Command-Line-Interface-Erstellung
- **Colorama 0.4.6**: Farbige Terminal-Ausgabe

## Entwicklungsumgebung

### Build & Development
```json
{
  "scripts": {
    "dev": "vite",                           // Entwicklungsserver
    "build": "vue-tsc -b && vite build",     // Produktions-Build
    "preview": "vite preview",               // Build-Vorschau
    "test": "vitest",                        // Unit-Tests
    "test:unit": "vitest",                   // Unit-Tests (alias)
    "test:integration": "vitest run tests/integration", // Integration Tests (NEU)
    "test:watch": "vitest --watch",          // Tests im Watch-Modus (NEU)
    "test:coverage": "vitest --coverage"     // Test-Coverage (NEU)
  }
}
```

### Vite-Konfiguration
- **Base Path**: `/` für Root-Deployment
- **Plugins**: Vue, TailwindCSS
- **Alias**: `@` → `/src` für saubere Imports
- **Icons**: Virtual Icons-Modul

### TypeScript-Konfiguration
- **Target**: ES2020+ für moderne Browser
- **Module**: ESNext für Tree-Shaking
- **Strict Mode**: Aktiviert für bessere Typsicherheit
- **Path Mapping**: `@/*` → `src/*`

### Vitest-Konfiguration (NEU - Vollständig implementiert)
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

#### Test-Setup Features:
- **jsdom Environment**: DOM-Simulation für Vue-Komponenten
- **Global Test Functions**: `describe`, `it`, `expect` global verfügbar
- **Setup Files**: Automatische Initialisierung von Mocks und Test-Utilities
- **Path Aliases**: Konsistente `@/` Imports in Tests

## Datenbank-Schema

### Haupt-Datenbank (User/Tenant)
```sql
-- Benutzer-Tabelle
users (
  id: STRING PRIMARY KEY,
  username: STRING UNIQUE,
  email: STRING UNIQUE,
  password_hash: STRING,
  created_at: DATETIME,
  updated_at: DATETIME
)

-- Mandanten-Tabelle
tenants (
  id: STRING PRIMARY KEY,
  name: STRING,
  created_at: DATETIME,
  updated_at: DATETIME
)

-- Benutzer-Mandanten-Zuordnung
user_tenants (
  user_id: STRING FOREIGN KEY,
  tenant_id: STRING FOREIGN KEY,
  role: STRING,
  created_at: DATETIME
)
```

### Mandanten-Datenbank (Finanzdaten)
```sql
-- Kontengruppen
account_groups (
  id: STRING PRIMARY KEY,
  name: STRING,
  sortOrder: INTEGER,
  image: STRING,
  created_at: DATETIME,
  updated_at: DATETIME
)

-- Konten
accounts (
  id: STRING PRIMARY KEY,
  name: STRING,
  description: TEXT,
  accountType: STRING,
  isActive: BOOLEAN,
  isOfflineBudget: BOOLEAN,
  accountGroupId: STRING FOREIGN KEY,
  sortOrder: INTEGER,
  balance: DECIMAL(10,2),
  creditLimit: DECIMAL(10,2),
  created_at: DATETIME,
  updated_at: DATETIME
)

-- Planungstransaktionen (NEU - Vollständig implementiert)
planning_transactions (
  id: STRING PRIMARY KEY,
  name: STRING,
  accountId: STRING,
  categoryId: STRING,
  tagIds: JSON,
  recipientId: STRING,
  amount: DECIMAL(10,2),
  amountType: STRING,
  approximateAmount: DECIMAL(10,2),
  minAmount: DECIMAL(10,2),
  maxAmount: DECIMAL(10,2),
  note: TEXT,
  startDate: DATE,
  valueDate: DATE,
  endDate: DATE,
  recurrencePattern: STRING,
  recurrenceEndType: STRING,
  recurrenceCount: INTEGER,
  executionDay: INTEGER,
  weekendHandling: STRING,
  isActive: BOOLEAN,
  forecastOnly: BOOLEAN,
  transactionType: STRING,
  transferToAccountId: STRING,
  transferToCategoryId: STRING,
  counterPlanningTransactionId: STRING,
  autoExecute: BOOLEAN,
  created_at: DATETIME,
  updated_at: DATETIME
)
```

## API-Architektur

### REST-Endpunkte
- **Base URL**: `http://localhost:8000`
- **API Version**: `/api/v1` (geplant)
- **Authentication**: Token-basiert
- **CORS**: Konfiguriert für `http://localhost:5173`

### WebSocket-Endpunkte
- **Base URL**: `ws://localhost:8000/ws_finwise`
- **Protokoll**: JSON-basierte Nachrichten
- **Authentifizierung**: Token in WebSocket-Verbindung

### Nachrichtentypen
```typescript
// Status-Nachrichten
StatusMessage {
  type: 'status',
  status: 'online' | 'offline' | 'maintenance' | 'error',
  message?: string
}

// Daten-Updates
DataUpdateNotificationMessage {
  type: 'data_update',
  tenant_id: string,
  entity_type: 'Account' | 'AccountGroup' | 'PlanningTransaction',
  operation_type: 'create' | 'update' | 'delete',
  data: Account | AccountGroup | PlanningTransaction | DeletePayload
}

// Initiale Daten
InitialDataLoadMessage {
  type: 'initial_data_load',
  tenant_id: string,
  payload: {
    accounts: Account[],
    account_groups: AccountGroup[],
    planning_transactions: PlanningTransaction[] // NEU
  }
}

// Sync-Acknowledgment-Nachrichten (NEU - In Entwicklung)
SyncAckMessage {
  type: 'sync_ack',
  id: string,              // SyncQueueEntry.id
  status: 'processed',
  entityId: string,
  entityType: EntityType,
  operationType: SyncOperationType
}

SyncNackMessage {
  type: 'sync_nack',
  id: string,              // SyncQueueEntry.id
  status: 'failed',
  entityId: string,
  entityType: EntityType,
  operationType: SyncOperationType,
  reason: string,          // Fehlergrund
  detail?: string,         // Detaillierte Fehlermeldung
  attempts?: number        // Anzahl Versuche
}
```

## Synchronisations-Protokoll

### Offline-Queue-Format
```typescript
SyncQueueEntry {
  id: string,              // UUID für Queue-Eintrag
  tenantId: string,        // Mandanten-ID
  entityType: EntityType,  // Typ der Entität
  entityId: string,        // ID der Entität
  operationType: 'create' | 'update' | 'delete' | 'initial_load',
  payload: Entity | { id: string } | null,
  timestamp: number,       // Unix-Timestamp
  status: 'pending' | 'processing' | 'synced' | 'failed',
  attempts?: number,       // Anzahl Versuche
  lastAttempt?: number,    // Letzter Versuch
  error?: string          // Fehlermeldung
}
```

### Sync-Acknowledgment-System (NEU - In Entwicklung)
- **ACK-Nachrichten**: Backend bestätigt erfolgreiche Verarbeitung
- **NACK-Nachrichten**: Backend meldet Fehler mit Grund und Details
- **Queue-Management**: Einträge werden nur nach ACK entfernt
- **Retry-Mechanismen**: Automatische Wiederholung bei NACK mit exponential backoff
- **Timeout-Handling**: Stuck processing entries werden automatisch zurückgesetzt

### Konfliktlösung
- **Strategie**: Last-Write-Wins (LWW)
- **Basis**: `updated_at` Timestamp-Vergleich
- **Implementierung**: Frontend und Backend
- **Granularität**: Entitäts-Level (vollständige Entität wird überschrieben)

## Performance-Konfiguration

### Frontend-Optimierungen
- **Code Splitting**: Automatisch durch Vite
- **Tree Shaking**: Entfernung ungenutzten Codes
- **Asset Optimization**: Automatische Bild- und CSS-Optimierung
- **Lazy Loading**: Route-basiertes Lazy Loading

### Backend-Optimierungen
- **SQLAlchemy**: Lazy Loading für Relationships
- **Connection Pooling**: Automatisch durch SQLAlchemy
- **Query Optimization**: Indizierte Spalten für häufige Abfragen

### IndexedDB-Optimierungen
- **Indizierung**: Automatische Indizes für häufige Abfragen
- **Batch Operations**: Bulk-Operationen für bessere Performance
- **Compression**: Daten-Komprimierung bei Bedarf

## Sicherheitskonfiguration

### Frontend-Sicherheit
- **Content Security Policy**: Konfiguriert für sichere Asset-Ladung
- **XSS-Schutz**: Vue.js eingebauter Schutz
- **Input Sanitization**: Automatisch durch Vue.js

### Backend-Sicherheit
- **CORS**: Beschränkt auf erlaubte Origins
- **Input Validation**: Pydantic-Schema-Validierung
- **SQL Injection**: Schutz durch SQLAlchemy ORM
- **Password Hashing**: Bcrypt mit Salt

### Datenbank-Sicherheit
- **File Permissions**: Beschränkte Dateiberechtigungen für SQLite
- **Backup Strategy**: Regelmäßige Backups (geplant)
- **Encryption at Rest**: Geplant für Produktionsumgebung

## Deployment-Konfiguration

### Entwicklung
```bash
# Frontend
npm run dev          # Port 5173

# Backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Tests
npm run test:integration  # Integration Tests
npm run test:watch       # Tests im Watch-Modus
npm run test:coverage    # Test-Coverage
```

### Produktion (geplant)
```bash
# Frontend Build
npm run build        # Statische Dateien in dist/

# Backend Production
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Technische Constraints

### Browser-Unterstützung
- **Minimum**: ES2020-kompatible Browser
- **IndexedDB**: Erforderlich für Offline-Funktionalität
- **WebSockets**: Erforderlich für Echtzeit-Synchronisation

### Performance-Limits
- **IndexedDB**: ~50MB pro Origin (Browser-abhängig)
- **WebSocket**: Verbindungslimits pro Browser
- **SQLite**: Dateigrößenlimits (praktisch unbegrenzt)

### Skalierungsgrenzen
- **Concurrent Users**: Begrenzt durch WebSocket-Verbindungen
- **Data Volume**: SQLite-Performance bei sehr großen Datenmengen
- **Sync Performance**: Abhängig von Netzwerklatenz und Datenvolumen

## Testing-Infrastruktur (NEU - Vollständig implementiert)

### Frontend-Testing
- **Framework**: Vitest 3.2.1 für Unit-Tests
- **Environment**: jsdom 25.0.1 für DOM-Simulation
- **Integration Tests**: Umfassende Sync-Funktionalitäts-Tests
- **Test-Utilities**:
  - [`tests/mocks/mock-websocket-server.ts`](../tests/mocks/mock-websocket-server.ts) - WebSocket-Mock
  - [`tests/mocks/mock-tenant-service.ts`](../tests/mocks/mock-tenant-service.ts) - TenantDbService-Mock
  - [`tests/mocks/test-data-generators.ts`](../tests/mocks/test-data-generators.ts) - Test-Daten-Generierung

### Test-Kategorien
- **Unit Tests**: Isolierte Tests für einzelne Funktionen
- **Integration Tests**: End-to-End-Tests für Sync-Szenarien
  - [`tests/integration/sync-integration.test.ts`](../tests/integration/sync-integration.test.ts) - Hauptintegrationstests (8 Tests)
  - [`tests/integration/account-sync.test.ts`](../tests/integration/account-sync.test.ts) - Account-spezifische Tests (6 Tests)
  - [`tests/integration/account-group-sync.test.ts`](../tests/integration/account-group-sync.test.ts) - AccountGroup-Tests (6 Tests)
  - [`tests/integration/sync-error-handling.test.ts`](../tests/integration/sync-error-handling.test.ts) - Error-Handling-Tests (6 Tests)
  - [`tests/planning-store-migration.test.ts`](../tests/planning-store-migration.test.ts) - Planning-Migration-Tests (NEU)

### Mock-Architektur
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

// TestDataGenerator - Konsistente Test-Daten
class TestDataGenerator {
  generateAccount(overrides?: Partial<Account>): Account
  generateAccountGroup(overrides?: Partial<AccountGroup>): AccountGroup
  generatePlanningTransaction(overrides?: Partial<PlanningTransaction>): PlanningTransaction
  generateSyncQueueEntry(overrides?: Partial<SyncQueueEntry>): SyncQueueEntry
  generateBatchData(count: number): TestData[]
}
```

### Test-Strategien
- **AAA-Pattern**: Arrange, Act, Assert für strukturierte Tests
- **Mock-Driven**: Isolierte Tests ohne externe Abhängigkeiten
- **Data-Driven**: Parametrisierte Tests mit `it.each`
- **Performance-Tests**: Validierung von Sync-Latenz und Memory-Management

### Backend-Testing
- **Framework**: Pytest 8.3.5
- **Test-Coverage**: User/Tenant-Management, CRUD-Operationen
- **Sync-Tests**: Geplant für WebSocket und Sync-Service

### Test-Metriken
- **Performance**: Sync-Latenz < 200ms für Online-Operationen
- **Reliability**: Error-Recovery mit exponential backoff
- **Memory**: Cleanup nach jedem Test verhindert Memory-Akkumulation
- **Coverage**: 26 Integration Tests für kritische Sync-Szenarien

## Monitoring & Logging

### Frontend-Logging
- **Logger**: Custom Logger in [`src/utils/logger.ts`](../src/utils/logger.ts)
- **Levels**: debugLog, infoLog, warnLog, errorLog
- **Module-basiert**: Jeder Log-Eintrag enthält Modulnamen
- **Storage**: Browser Console + lokale Persistierung (geplant)
- **Sync-Logging**: Detaillierte Logs für alle Sync-Operationen

### Backend-Logging
- **Logger**: Custom Logger in [`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py)
- **Levels**: debugLog, infoLog, warnLog, errorLog
- **Format**: Strukturierte JSON-Logs mit Modulnamen und Details
- **Sync-Logging**: Umfassende Logs für WebSocket und Sync-Service

### Test-Logging (NEU)
- **Debug-Modus**: Temporäres Logging in Tests für Debugging
- **Test-Output**: Strukturierte Test-Ergebnisse mit Performance-Metriken
- **Mock-Logging**: Verfolgung von Mock-Aufrufen und -Responses

### Metriken (geplant)
- **Performance**: Response Times, Query Performance, Sync-Latenz
- **Usage**: Feature Usage, User Engagement, Sync-Häufigkeit
- **Errors**: Error Rates, Sync Failures, Retry-Statistiken
- **WebSocket**: Verbindungsqualität, Reconnection-Häufigkeit

## Aktuelle technische Entwicklungen

### Abgeschlossene Migrationen
- ✅ **localStorage → IndexedDB**: Vollständige Migration mit Dexie.js
- ✅ **Sync-Architektur**: Bidirektionale Synchronisation für Accounts/AccountGroups
- ✅ **WebSocket-Integration**: Echtzeit-Updates zwischen Frontend und Backend
- ✅ **Testing-Setup**: Umfassende Integration-Tests für Sync-Funktionalität
- ✅ **Planning-Funktionalität**: Vollständige Planning-Business-Logic implementiert

### In Entwicklung
- 🔄 **Sync-Acknowledgment-System**: ACK/NACK-Nachrichten für zuverlässige Queue-Verarbeitung
- 🔄 **WebSocket-Reconnection**: Verbessertes Reconnection-Handling mit exponential backoff
- 🔄 **Performance-Optimierung**: Batch-Operationen und Paginierung
- 🔄 **Planning-Synchronisation**: Integration von PlanningTransactions in Sync-System

### Geplante Entwicklungen
- 📋 **Transaction-Synchronisation**: Erweitern der Sync auf Transaktionen
- 📋 **Category-Synchronisation**: Erweitern der Sync auf Categories/CategoryGroups
- 📋 **Performance-Monitoring**: Metriken und Monitoring-Dashboard
- 📋 **PWA-Features**: Service Worker und Offline-Capabilities

## Technische Schulden

### Hohe Priorität
- **Sync-Konsistenz**: Einheitliche Sync-Queue-Nutzung für alle Entitäten
- **Queue-Management**: Automatische Bereinigung nach erfolgreicher Sync
- **Error-Handling**: Einheitliche Patterns für alle Services
- **Planning-Sync**: Integration von PlanningTransactions in Sync-System

### Mittlere Priorität
- **Legacy-Code**: Vollständige Entfernung von localStorage-Resten
- **API-Dokumentation**: Vollständige WebSocket-API-Dokumentation
- **Performance**: Optimierung für große Datenmengen
- **Test-Coverage**: Erweiterte Unit-Tests für alle Stores und Services

### Niedrige Priorität
- **Code-Duplikation**: Refactoring ähnlicher Patterns in Stores
- **Type-Safety**: Erweiterte TypeScript-Typisierung
- **Bundle-Size**: Weitere Optimierung der Bundle-Größe
- **Documentation**: Umfassende Code-Dokumentation

## Neue Technologien und Updates

### Kürzlich hinzugefügte Dependencies
- **Vitest 3.2.1**: Upgrade von vorheriger Version für bessere Performance
- **fake-indexeddb 6.0.0**: Für realistische IndexedDB-Tests
- **jsdom 25.0.1**: Aktuelle Version für DOM-Simulation
- **@types/node 22.15.29**: Aktuelle Node.js-Typen

### Geplante Technology-Updates
- **Vue 3.6**: Upgrade bei Verfügbarkeit
- **TypeScript 5.6**: Upgrade für neue Features
- **Vite 6.0**: Upgrade für Performance-Verbesserungen
- **Dexie 5.0**: Upgrade für erweiterte IndexedDB-Features

### Experimentelle Features
- **WebAssembly**: Für Performance-kritische Berechnungen (Evaluierung)
- **Web Workers**: Für Background-Sync-Verarbeitung (Planung)
- **Service Workers**: Für PWA-Funktionalität (Vorbereitung)
