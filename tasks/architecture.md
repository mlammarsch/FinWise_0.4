# Anwendungsarchitektur: FinWise

## Anwendungsbeschreibung

FinWise ist eine modulare Vue.js-Anwendung für Finanzmanagement. Sie ermöglicht Benutzern, ihre Finanzen zu verwalten, Budgets zu erstellen, Transaktionen zu verfolgen und Prognosen zu erstellen. Die Anwendung ist so konzipiert, dass sie auch offline funktioniert und Daten mit einem geplanten FastAPI-Backend synchronisieren kann.

## Frontend-Architektur

Die Frontend-Anwendung ist in drei Hauptschichten unterteilt:

*   **UI-Schicht (Vue-Komponenten):** Verantwortlich für die Darstellung der Benutzeroberfläche und die Interaktion mit dem Benutzer. Nutzt daisyui und tailwind.
*   **Business-Logic-Schicht (Services):** Enthält die Geschäftslogik der Anwendung und implementiert Funktionen wie Budgetierung, Transaktionsverwaltung und Prognoseberechnungen.
*   **Datenschicht (Stores):** Verwaltet den Zustand der Anwendung und stellt Daten für die UI-Schicht bereit. Stores nutzen Pinia mit IndexedDB-Persistierung für Offline-Funktionalität.

### Modulstruktur (Frontend)

Die Anwendung ist modular aufgebaut und umfasst folgende Bereiche:

* **Transactions:** Ermöglicht Benutzern, Transaktionen zu erstellen, zu bearbeiten und zu verfolgen.
* **Rules:** Ermöglicht Benutzern, Automatisierungsregeln für Transaktionen zu erstellen.
* **Administration:** Ermöglicht alle Arten der Stammdatenverwaltung (Kategorien, Tags, Konten, Mandanten, Regeln, Einstellungen, usw.)
* **Kontoverwaltung:** Ermöglicht die Verwaltung physischer Bankkonten, Karten, Depots oder Geldbeutel.
* **Kategorien:** Bildet die Lebensbereiche des Geldflusses ab und fungiert zusammen mit der Kontoverwaltung als doppelte Buchführung.
* **Tags/Labels:** Ermöglicht die Markierung von Finanzflüssen, um sie zu Projekten oder anderen gruppierten Bereichen zusammenzufassen - insbesondere für späteres Reporting.
* **Planung und Prognose:** Ermöglicht die Definition regelmäßiger Buchungen für Zukunftsprognosen von Kontoständen.
* **Budgeting:** Ermöglicht die detaillierte Vorplanung der Einnahmenverteilung auf Kategorien/Budgettöpfe, um Rücklagen für bestimmte Lebensbereiche zu erstellen oder Zielsparen zu ermöglichen.

### Module (Frontend):

*   `components`:  Wiederverwendbare UI-Komponenten (z.B. `AccountCard.vue`, `BudgetForm.vue`).
*   `layouts`: Definiert das Layout der Anwendung (z.B. `AppLayout.vue`).
*   `router`: Definiert die Routen der Anwendung.
*   `services`:  Implementiert die Geschäftslogik (z.B. `AccountService.ts`, `BudgetService.ts`) und Datenpersistierung (`TenantDbService.ts` für IndexedDB).
*   `stores`: Verwaltet den Anwendungszustand (z.B. `accountStore.ts`, `budgetStore.ts`) mit IndexedDB-Persistierung für Offline-Funktionalität.
*   `types`: Definiert TypeScript-Typen und -Interfaces.
*   `utils`: Enthält Hilfsfunktionen (z.B. Datumsformatierung, Währungsformatierung).
## IndexedDB-Integration und Datenpersistierung

### Übersicht

Die Frontend-Anwendung nutzt IndexedDB für lokale Datenpersistierung, um Offline-Funktionalität und verbesserte Performance zu gewährleisten. Die Integration erfolgt über den [`TenantDbService`](../src/services/TenantDbService.ts), der eine einheitliche API für alle Stores bereitstellt.

### Architektur der Datenpersistierung

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vue Components│    │   Pinia Stores   │    │  TenantDbService│
│                 │───▶│                  │───▶│                 │
│  (UI Layer)     │    │ (State Management│    │ (Data Layer)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   IndexedDB     │
                                                │                 │
                                                │ (Browser Storage│
                                                └─────────────────┘
```

### TenantDbService

Der [`TenantDbService`](../src/services/TenantDbService.ts) fungiert als zentrale Abstraktionsschicht für IndexedDB-Operationen:

**Hauptfunktionalitäten:**
- **Tenant-spezifische Datenbankisolation**: Jeder Mandant erhält eine separate IndexedDB-Datenbank
- **CRUD-Operationen**: Einheitliche API für Create, Read, Update, Delete
- **Sync-Queue Management**: Verwaltung ausstehender Synchronisationsoperationen
- **Schema-Management**: Automatische Datenbank-Initialisierung und Migrations
- **Error Handling**: Robuste Fehlerbehandlung mit Logging-Integration

**Unterstützte Entitäten:**
- Transactions (vollständig implementiert)
- Accounts (geplant)
- Categories (geplant)
- Budgets (geplant)
- Rules (geplant)

### Store-Integration

#### Transaction Store Beispiel

```typescript
// Verwendung in transactionStore.ts
const tenantDbService = new TenantDbService();

// CRUD-Operationen
async function addTransaction(tx: ExtendedTransaction): Promise<ExtendedTransaction> {
  await tenantDbService.addTransaction(tx);
  // Sync-Queue Entry automatisch erstellt
  await tenantDbService.addSyncQueueEntry({
    entityType: EntityTypeEnum.TRANSACTION,
    entityId: tx.id,
    operationType: SyncOperationType.CREATE,
    payload: tx,
  });
  return tx;
}
```

### Sync-System Integration

#### Last-Write-Wins Konfliktauflösung

Das System implementiert eine Last-Write-Wins Strategie basierend auf `updated_at` Timestamps:

```typescript
// Konfliktauflösung bei eingehenden Sync-Daten
if (localTransaction.updated_at && incomingTransaction.updated_at &&
    new Date(localTransaction.updated_at) >= new Date(incomingTransaction.updated_at)) {
  // Lokale Version ist neuer - eingehende Änderung verwerfen
  return localTransaction;
}
```

#### Sync-Queue Management

- **Automatische Queue-Erstellung**: Lokale Änderungen werden automatisch zur Synchronisation vorgemerkt
- **Batch-Processing**: Effiziente Übertragung mehrerer Änderungen
- **Retry-Mechanismus**: Fehlgeschlagene Sync-Operationen werden wiederholt
- **Conflict Resolution**: Intelligente Behandlung von Sync-Konflikten

### Performance-Optimierungen

#### IndexedDB Vorteile

- **Asynchrone Operationen**: Non-blocking UI durch Promise-basierte API
- **Große Speicherkapazität**: Praktisch unbegrenzt im Vergleich zu localStorage
- **Indexierung**: Effiziente Abfragen durch automatische Indizes
- **Transaktionale Konsistenz**: ACID-Eigenschaften für Datenintegrität

#### Implementierte Optimierungen

- **Lazy Loading**: Daten werden nur bei Bedarf geladen
- **Batch Operations**: Mehrere Operationen in einer Transaktion
- **Selective Updates**: Nur geänderte Felder werden aktualisiert
- **Caching**: Store-State als Cache für häufig abgerufene Daten

### Migration und Kompatibilität

#### Automatische Migration

```typescript
// Nahtlose Umstellung von localStorage zu IndexedDB
async function migrateFromLocalStorage(): Promise<void> {
  const oldData = localStorage.getItem('transactions');
  if (oldData) {
    const transactions = JSON.parse(oldData);
    await tenantDbService.bulkAddTransactions(transactions);
    localStorage.removeItem('transactions');
  }
}
```

#### API-Kompatibilität

- **Keine Breaking Changes**: Alle bestehenden Store-Methoden bleiben unverändert
- **Rückwärtskompatibilität**: Unterstützung für Legacy-Datenformate
- **Graceful Degradation**: Fallback auf localStorage bei IndexedDB-Problemen
*   `views`: Enthält die Hauptansichten, jede View liegt in der Regel in einer eigenen *.vue-Datei.

## Backend-Architektur

Das Backend von FinWise basiert auf **FastAPI** mit Python und dient als zentrale Anlaufstelle für Datenmanagement und -synchronisation.

### Schichten der Backend-Anwendung

Die Backend-Anwendung folgt einer typischen Schichtarchitektur:

*   **API-Layer (`app/api`, `app/routers`):** Definiert die HTTP-Endpunkte für die Kommunikation mit dem Frontend und anderen Clients. Nimmt Anfragen entgegen, validiert Eingaben (mittels Pydantic-Schemas) und leitet sie an die Business-Logic-Schicht weiter. Beinhaltet auch WebSocket-Endpunkte für Echtzeitkommunikation (`app/websocket`).
*   **Business-Logic/CRUD-Layer (`app/crud`):** Enthält die Geschäftslogik und die Operationen zum Erstellen, Lesen, Aktualisieren und Löschen (CRUD) von Daten. Interagiert mit dem Data-Access-Layer, um Datenbankoperationen durchzuführen.
*   **Data-Access-Layer (`app/db`, `app/models`):** Verantwortlich für die Interaktion mit der Datenbank. Definiert die Datenbankschemata (`app/models`) mittels SQLAlchemy und verwaltet Datenbankverbindungen sowie -sitzungen (`app/db`).

### Wichtige Module/Verzeichnisse und deren Zweck

*   **`main.py`**: Der Haupteinstiegspunkt der FastAPI-Anwendung. Initialisiert die App, Middleware (z.B. CORS) und bindet die Router ein.
*   **`app/api`**: Enthält API-spezifische Logik, wie Abhängigkeiten (`deps.py`) und versionierte Endpunkte (z.B. `v1/endpoints/sync.py` für die Synchronisation).
*   **`app/routers`**: Definiert die API-Router für verschiedene Ressourcen (z.B. `users.py`, `tenants.py`). Diese Router gruppieren thematisch zusammengehörige Endpunkte.
*   **`app/crud`**: Implementiert die CRUD-Operationen für die verschiedenen Datenmodelle (z.B. `crud_account.py`, `crud_account_group.py`).
*   **`app/models`**: Definiert die SQLAlchemy-Modelle, die die Struktur der Datenbanktabellen abbilden (z.B. `account.py`, `user_tenant_models.py`). Enthält auch Pydantic-Schemas (`schemas.py`) für die Datenvalidierung und Serialisierung in den API-Endpunkten.
*   **`app/db`**: Beinhaltet die Datenbankkonfiguration (`database.py`), die Einrichtung der Datenbankverbindung (SQLAlchemy Engine, SessionLocal) und spezifische Datenbanklogik wie die Verwaltung von Mandanten-Datenbanken (`tenant_db.py`).
*   **`app/schemas`**: (Obwohl Pydantic-Schemas in `app/models/schemas.py` liegen, ist dies ein typischer Ort für Pydantic-Modelle, die die Struktur von API-Anfragen und -Antworten definieren).
*   **`app/config.py`**: Enthält Konfigurationseinstellungen der Anwendung, wie Datenbank-URLs, Secret Keys für JWTs und andere Umgebungsvariablen.
*   **`app/utils`**: Beinhaltet Hilfsfunktionen, wie z.B. Logging-Funktionen (`logger.py`).
*   **`app/websocket`**: Verwaltet WebSocket-Verbindungen (`connection_manager.py`), definiert WebSocket-Endpunkte (`endpoints.py`) und zugehörige Schemas (`schemas.py`).
*   **`tenant_databases/`**: Verzeichnis, in dem die SQLite-Dateien für die einzelnen Mandanten gespeichert werden.

### Datenbanken

Das Backend verwendet **SQLite** als Datenbankmanagementsystem. Es gibt eine zentrale Datenbank (`users.db`) für Benutzer- und Mandanteninformationen. Zusätzlich wird für jeden Mandanten eine eigene SQLite-Datenbank im Verzeichnis `tenant_databases/` angelegt, um die Finanzdaten des jeweiligen Mandanten isoliert zu speichern. SQLAlchemy dient als ORM für die Datenbankinteraktion.

### Authentifizierung und Autorisierung

Die Authentifizierung erfolgt über **JSON Web Tokens (JWTs)**. Nach erfolgreichem Login erhält der Benutzer einen Access Token, der bei nachfolgenden Anfragen zur Authentifizierung mitgesendet wird. Die Konfiguration hierfür (`SECRET_KEY`, `ALGORITHM`) befindet sich in `app/config.py`. Autorisierungsmechanismen (z.B. Prüfung, ob ein Benutzer Zugriff auf einen bestimmten Mandanten hat) sind in den entsprechenden API-Endpunkten und Service-Funktionen implementiert.

### Hauptfunktionalitäten des Backends

*   **Benutzerverwaltung:** Registrierung, Login und Verwaltung von Benutzerkonten.
*   **Mandantenverwaltung:** Erstellung und Verwaltung von Mandanten (isolierte Datenbereiche für verschiedene Benutzer oder Entitäten).
*   **Datensynchronisation:** Bereitstellung von Endpunkten (`app/api/v1/endpoints/sync.py`) für das Frontend, um Daten zwischen der lokalen Offline-Datenbank des Frontends und dem Backend zu synchronisieren. Dies umfasst das Senden und Empfangen von Änderungen an Transaktionen, Budgets, Konten etc.
*   **API für Frontend-Datenabfragen:** Stellt eine RESTful API bereit, über die das Frontend alle notwendigen Daten abrufen und modifizieren kann.
*   **Echtzeit-Benachrichtigungen (via WebSockets):** Ermöglicht potenziell Echtzeit-Updates oder Benachrichtigungen an verbundene Clients.
