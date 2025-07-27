# FinWise - Systemarchitektur

## Architektur-Überblick

### Gesamtsystem-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vue.js)                       │
│                   Browser Application                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/WebSocket
┌─────────────────────▼───────────────────────────────────────┐
│                  Backend (FastAPI)                         │
│                   Python Server                            │
└─────────────────────┬───────────────────────────────────────┘
                      │ SQLAlchemy
┌─────────────────────▼───────────────────────────────────────┐
│                   SQLite Database                          │
│              Multi-Tenant Storage                          │
└─────────────────────────────────────────────────────────────┘
```

## Frontend-Architektur

### Schichtarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue Components                           │
│                   (Presentation Layer)                      │
│  • Views/  • Components/  • Layouts/                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Pinia Stores                              │
│                 (State Management)                          │
│  • transactionStore  • accountStore  • userStore           │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Services                                 │
│                 (Business Logic)                            │
│  • TenantDbService  • WebSocketService  • ApiService       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   IndexedDB                                 │
│                 (Browser Storage)                           │
│  • tenant_123_db  • tenant_456_db  • etc.                  │
└─────────────────────────────────────────────────────────────┘
```

### Kernkomponenten

#### 1. Presentation Layer
- **Views**: Hauptseiten der Anwendung (`src/views/`)
  - `DashboardView.vue`, `AccountsView.vue`, `TransactionsView.vue`
  - `AdminAccountsView.vue`, `AdminCategoriesView.vue`, etc.
- **Components**: Wiederverwendbare UI-Komponenten (`src/components/`)
  - Account-, Transaction-, Budget-Komponenten
  - UI-Komponenten (Forms, Modals, Charts)
- **Layouts**: Layout-Templates (`src/layouts/`)
  - `AppLayout.vue` - Hauptlayout mit Navigation

#### 2. State Management (Pinia Stores)
- **Core Stores** (`src/stores/`):
  - `transactionStore.ts` - Transaktionsverwaltung
  - `accountStore.ts` - Kontoverwaltung
  - `categoryStore.ts` - Kategorienverwaltung
  - `recipientStore.ts` - Empfängerverwaltung
  - `tagStore.ts` - Tag-Verwaltung
  - `ruleStore.ts` - Regelverwaltung
  - `planningStore.ts` - Planungstransaktionen
- **System Stores**:
  - `userStore.ts` - Benutzerverwaltung
  - `tenantStore.ts` - Mandantenverwaltung
  - `sessionStore.ts` - Session-Management
  - `webSocketStore.ts` - WebSocket-Verbindung

#### 3. Service Layer
- **TenantDbService** (`src/services/TenantDbService.ts`)
  - Zentrale Datenzugriffsschicht für IndexedDB
  - CRUD-Operationen für alle Entitäten
  - Sync-Queue-Management
- **WebSocketService** (`src/services/WebSocketService.ts`)
  - WebSocket-Verbindungsmanagement
  - Bidirektionale Synchronisation
  - ACK/NACK-Protokoll
- **Weitere Services**:
  - `ApiService.ts` - HTTP-API-Kommunikation
  - `SessionService.ts` - Session-Management
  - `CSVImportService.ts` - CSV-Import-Funktionalität

## Backend-Architektur

### Pfad-Struktur
- **Basis**: `../FinWise_0.4_BE/`
- **Hauptmodul**: `main.py` - FastAPI-Anwendung
- **App-Struktur**: `app/` - Hauptanwendungslogik

### Kernkomponenten

#### 1. API Layer (`app/api/`)
- **REST Endpoints**: Standard HTTP-APIs
- **WebSocket Endpoints**: Echtzeit-Kommunikation
- **Sync Endpoints**: Synchronisationslogik

#### 2. Business Logic (`app/services/`)
- **Tenant Management**: Mandantenverwaltung
- **User Management**: Benutzerverwaltung
- **Sync Services**: Synchronisationslogik

#### 3. Data Layer (`app/db/`)
- **Models**: SQLAlchemy-Modelle
- **Database**: Datenbankverbindung und -konfiguration
- **Migrations**: Alembic-Migrationen

## Multi-Tenant-Architektur

### Datenisolation

```
┌─────────────────────────────────────────────────────────────┐
│                   Central Auth DB                          │
│                    (users.db)                              │
│  • Users  • Tenants  • User-Tenant-Relations               │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐ ┌────▼────┐ ┌──────▼──────┐
│ tenant_1.db  │ │tenant_2.│ │ tenant_n.db │
│              │ │   db    │ │             │
│ • Accounts   │ │         │ │ • Accounts  │
│ • Transactions│ │• Acc... │ │ • Trans...  │
│ • Categories │ │• Tra... │ │ • Categ...  │
│ • Recipients │ │• Cat... │ │ • Recip...  │
└──────────────┘ └─────────┘ └─────────────┘
```

### Frontend-Tenant-Isolation
- **IndexedDB**: Separate Datenbanken pro Tenant (`tenant_{id}_db`)
- **Store-Isolation**: Automatische Datentrennung über TenantDbService
- **Session-Management**: Aktiver Tenant in SessionStore

## Synchronisations-Architektur

### Offline-First-Prinzip

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Action   │───►│   Local Store    │───►│   IndexedDB     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Sync Queue     │───►│  WebSocket Sync │
                       └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  Backend API    │
                                               └─────────────────┘
```

### Sync-Mechanismen
1. **Queue-basiert**: Alle Änderungen werden in Sync-Queue eingereiht
2. **ACK/NACK-Protokoll**: Server bestätigt oder lehnt Änderungen ab
3. **Retry-Logic**: Exponential backoff bei Fehlern
4. **Conflict Resolution**: Last-Write-Wins-Strategie

## Datenfluss-Patterns

### CRUD-Operationen

```
Component ──► Store ──► TenantDbService ──► IndexedDB
    │           │              │               │
    │           ▼              ▼               ▼
    │      Sync Queue ──► WebSocket ──► Backend API
    │           │              │               │
    └───────────┴──────────────┴───────────────┘
                    Reactive Updates
```

### Datenfluss-Schritte
1. **User Interaction**: Benutzer führt Aktion aus
2. **Store Update**: Pinia Store wird aktualisiert
3. **Local Persistence**: Daten werden in IndexedDB gespeichert
4. **Sync Queue**: Änderung wird zur Synchronisation vorgemerkt
5. **Background Sync**: WebSocket sendet Änderung an Backend
6. **Confirmation**: Backend bestätigt oder lehnt Änderung ab
7. **UI Update**: Reaktive Updates in der Benutzeroberfläche

## Kritische Implementierungspfade

### 1. Transaction Management
- **Store**: `transactionStore.ts`
- **Service**: `TenantDbService.addTransaction()`
- **Sync**: Automatische Queue-Erstellung
- **UI**: `TransactionForm.vue`, `TransactionList.vue`

### 2. Multi-Tenant Switching
- **Session**: `sessionStore.currentTenantId`
- **Database**: `tenantStore.switchTenant()`
- **Sync**: WebSocket-Reconnection
- **UI**: `TenantSwitch.vue`

### 3. Offline-Online Transitions
- **Detection**: `BackendAvailabilityService`
- **Queue Processing**: `WebSocketService.processQueue()`
- **UI Feedback**: `SyncButton.vue`
- **Error Handling**: Retry-Mechanismen

## Design Patterns

### 1. Repository Pattern
- **TenantDbService**: Zentrale Datenzugriffsschicht
- **Abstraktion**: Einheitliche CRUD-Operationen
- **Testbarkeit**: Mockbare Service-Schicht

### 2. Observer Pattern
- **Pinia Reactivity**: Automatische UI-Updates
- **WebSocket Events**: Event-basierte Synchronisation
- **Store Watchers**: Reaktive Seiteneffekte

### 3. Command Pattern
- **Sync Queue**: Kommandos für Backend-Operationen
- **Undo/Redo**: Potentielle Erweiterung
- **Batch Operations**: Gruppierte Operationen

## Performance-Optimierungen

### 1. IndexedDB-Optimierungen
- **Indizierung**: Effiziente Abfragen über Indizes
- **Batch-Operations**: Mehrere Operationen in einer Transaktion
- **Lazy Loading**: Daten nur bei Bedarf laden

### 2. Sync-Optimierungen
- **Debouncing**: Vermeidung redundanter Sync-Requests
- **Chunking**: Große Datenmengen in kleineren Paketen
- **Priority Queue**: Wichtige Änderungen zuerst

### 3. UI-Optimierungen
- **Virtual Scrolling**: Große Listen effizient darstellen
- **Component Caching**: Wiederverwendung von Komponenten
- **Reactive Batching**: Gruppierte UI-Updates
