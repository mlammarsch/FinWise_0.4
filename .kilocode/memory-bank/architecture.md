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
│   ├── planning/       # Planungs-Komponenten
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
- **[`categoryStore.ts`](src/stores/categoryStore.ts)**: Kategorienverwaltung
- **[`planningStore.ts`](src/stores/planningStore.ts)**: Planungstransaktionen
- **[`tagStore.ts`](src/stores/tagStore.ts)**: Tag-Verwaltung
- **[`recipientStore.ts`](src/stores/recipientStore.ts)**: Empfänger-Verwaltung
- **[`ruleStore.ts`](src/stores/ruleStore.ts)**: Automatisierungsregeln

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
- **[`BudgetService.ts`](src/services/BudgetService.ts)**: Budget-Berechnungen
- **[`BalanceService.ts`](src/services/BalanceService.ts)**: Saldo-Berechnungen
- **[`PlanningService.ts`](src/services/PlanningService.ts)**: Planungs- und Prognosefunktionen
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
- **PlanningTransaction**: Wiederkehrende/geplante Transaktionen
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

### Synchronisation-Service

#### [`app/services/sync_service.py`](../FinWise_0.4_BE/app/services/sync_service.py):
- **Sync-Queue-Verarbeitung**: Verarbeitet Offline-Änderungen vom Frontend
- **Konfliktlösung**: Last-Write-Wins basierend auf `updated_at`
- **Broadcast-Funktionalität**: Sendet Änderungen an alle Clients eines Mandanten
- **Initial Data Load**: Stellt initiale Daten für neue Verbindungen bereit

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

### 2. Transaction Synchronisation (🔄 In Entwicklung)
- **Priorität**: Höchste, da Transaktionen das Herzstück der App sind
- **Komplexität**: Hoch wegen Volumen und Beziehungen zu anderen Entitäten
- **Herausforderung**: Performance bei großen Datenmengen

### 3. Session Management
- **[`SessionService.ts`](src/services/SessionService.ts)**: Router Guards und Authentifizierung
- **[`sessionStore.ts`](src/stores/sessionStore.ts)**: Persistente Session-Daten in IndexedDB
- **Backend**: Token-basierte Authentifizierung

### 4. IndexedDB-Integration
- **[`TenantDbService.ts`](src/services/TenantDbService.ts)**: Zentrale Datenbank-Operationen
- **Dexie.js**: Typisierte IndexedDB-Wrapper
- **Mandantenspezifische DBs**: Separate Datenbanken pro Mandant

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
- **Compression**: WebSocket-Nachrichten komprimieren
- **Batching**: Mehrere Änderungen in einer Nachricht

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
