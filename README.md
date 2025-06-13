# FinWise - Personal Finance Management

Eine moderne Vue.js-Anwendung für persönliches Finanzmanagement mit Offline-Funktionalität und Backend-Synchronisation.

## Features

- 💰 **Transaktionsverwaltung**: Vollständige CRUD-Operationen für Finanztransaktionen
- 🏦 **Kontoverwaltung**: Verwaltung verschiedener Bankkonten und Finanzinstrumente
- 📊 **Kategorisierung**: Flexible Kategorien und Tags für bessere Organisation
- 📱 **Offline-First**: Vollständige Funktionalität ohne Internetverbindung
- 🔄 **Synchronisation**: Bidirektionale Sync mit FastAPI-Backend
- 🎨 **Moderne UI**: Responsive Design mit DaisyUI und Tailwind CSS
- 🏢 **Multi-Tenant**: Unterstützung für mehrere Mandanten/Benutzer

## Technologie-Stack

### Frontend
- **Vue 3** mit Composition API und `<script setup>`
- **TypeScript** für Type Safety
- **Pinia** für State Management
- **Vue Router** für Navigation
- **DaisyUI + Tailwind CSS** für Styling
- **IndexedDB** für lokale Datenpersistierung
- **Vite** als Build-Tool

### Backend
- **FastAPI** (Python) für REST API
- **SQLAlchemy** als ORM
- **SQLite** für Datenpersistierung
- **WebSockets** für Echtzeit-Updates
- **JWT** für Authentifizierung

## Architektur

### Frontend-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue Components                           │
│                   (Presentation Layer)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Pinia Stores                              │
│                 (State Management)                          │
│  • transactionStore.ts  • accountStore.ts  • etc.          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 TenantDbService                             │
│                (Data Access Layer)                          │
│  • CRUD Operations  • Sync Queue  • Schema Management      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   IndexedDB                                 │
│                 (Browser Storage)                           │
│  • tenant_123_db  • tenant_456_db  • etc.                  │
└─────────────────────────────────────────────────────────────┘
```

### Datenpersistierung

Die Anwendung nutzt **IndexedDB** für lokale Datenpersistierung mit folgenden Vorteilen:

- **Offline-First**: Vollständige Funktionalität ohne Internetverbindung
- **Performance**: Asynchrone, non-blocking Operationen
- **Skalierbarkeit**: Praktisch unbegrenzte Speicherkapazität
- **Sync-Integration**: Nahtlose Synchronisation mit Backend
- **Tenant-Isolation**: Separate Datenbanken pro Mandant

## Installation und Setup

### Voraussetzungen

- Node.js (Version 18+)
- npm oder yarn
- Moderner Browser mit IndexedDB-Unterstützung

### Frontend-Setup

```bash
# Repository klonen
git clone <repository-url>
cd FinWise_0.4

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev

# Build für Produktion
npm run build

# Tests ausführen
npm run test
```

### Backend-Setup

```bash
# Backend-Verzeichnis
cd ../FinWise_0.4_BE

# Python Virtual Environment erstellen
python -m venv venv
source venv/bin/activate  # Linux/Mac
# oder
venv\Scripts\activate     # Windows

# Dependencies installieren
pip install -r requirements.txt

# Datenbank initialisieren
python -m app.db.init_db

# Server starten
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Entwicklung

### Projektstruktur

```
src/
├── components/          # Wiederverwendbare Vue-Komponenten
├── layouts/            # Layout-Komponenten
├── router/             # Vue Router Konfiguration
├── services/           # Business Logic und API-Services
│   └── TenantDbService.ts  # IndexedDB-Integration
├── stores/             # Pinia Stores
│   └── transactionStore.ts # Transaction State Management
├── types/              # TypeScript-Definitionen
├── utils/              # Hilfsfunktionen
└── views/              # Hauptansichten/Seiten
```

### Store-Entwicklung

Alle Stores nutzen die IndexedDB-Integration über den [`TenantDbService`](src/services/TenantDbService.ts):

```typescript
// Beispiel: Store-Implementierung
import { TenantDbService } from '@/services/TenantDbService';

export const useTransactionStore = defineStore('transaction', () => {
  const tenantDbService = new TenantDbService();

  // CRUD-Operationen
  async function addTransaction(tx: ExtendedTransaction): Promise<ExtendedTransaction> {
    await tenantDbService.addTransaction(tx);
    // Automatische Sync-Queue Integration
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.TRANSACTION,
      entityId: tx.id,
      operationType: SyncOperationType.CREATE,
      payload: tx,
    });
    return tx;
  }
});
```

### Sync-System

Das System implementiert eine **Last-Write-Wins** Konfliktauflösung:

```typescript
// Konfliktauflösung basierend auf Timestamps
if (localTransaction.updated_at && incomingTransaction.updated_at &&
    new Date(localTransaction.updated_at) >= new Date(incomingTransaction.updated_at)) {
  // Lokale Version ist neuer - eingehende Änderung verwerfen
  return localTransaction;
}
```

## API-Dokumentation

### REST-Endpunkte

- `GET /api/v1/transactions` - Alle Transaktionen abrufen
- `POST /api/v1/transactions` - Neue Transaktion erstellen
- `PUT /api/v1/transactions/{id}` - Transaktion aktualisieren
- `DELETE /api/v1/transactions/{id}` - Transaktion löschen
- `POST /api/v1/sync` - Synchronisation durchführen

### WebSocket-Endpunkte

- `/ws/sync` - Echtzeit-Synchronisation
- `/ws/notifications` - System-Benachrichtigungen

## Testing

### Unit Tests

```bash
# Alle Tests ausführen
npm run test

# Tests mit Coverage
npm run test:coverage

# Tests im Watch-Mode
npm run test:watch
```

### Integration Tests

```bash
# E2E-Tests mit Playwright
npm run test:e2e

# Komponenten-Tests
npm run test:component
```

## Deployment

### Frontend-Deployment

```bash
# Build erstellen
npm run build

# Build-Artefakte in dist/ Verzeichnis
# Kann auf jedem statischen Webserver deployed werden
```

### Backend-Deployment

```bash
# Docker-Container erstellen
docker build -t finwise-backend .

# Container starten
docker run -p 8000:8000 finwise-backend
```

## Browser-Kompatibilität

### Unterstützte Browser

- ✅ Chrome 58+
- ✅ Firefox 55+
- ✅ Safari 10+
- ✅ Edge 79+

### IndexedDB-Anforderungen

Die Anwendung benötigt IndexedDB-Unterstützung. Bei nicht unterstützten Browsern erfolgt automatisch ein Fallback auf localStorage (mit eingeschränkter Funktionalität).

## Debugging

### IndexedDB-Debugging

1. **Browser DevTools**: Application Tab → Storage → IndexedDB
2. **Debug-API**: In der Entwicklungsumgebung verfügbar über `window.finwiseDebug`
3. **Logging**: Detaillierte Logs in der Browser-Konsole

```javascript
// Debug-API verwenden
window.finwiseDebug.indexedDB.state();        // Datenbank-Status
window.finwiseDebug.indexedDB.performance();  // Performance-Metriken
```

## Performance

### Optimierungen

- **Lazy Loading**: Daten werden nur bei Bedarf geladen
- **Paginierung**: Große Datasets werden seitenweise geladen
- **Indexierung**: Effiziente Abfragen durch IndexedDB-Indizes
- **Caching**: Intelligentes Caching häufig abgerufener Daten
- **Batch-Operationen**: Mehrere Änderungen in einer Transaktion

### Metriken

- **Ladezeit**: < 2s für 1000 Transaktionen
- **Speicherverbrauch**: ~50% weniger als localStorage
- **Abfrage-Performance**: 80% schneller durch Indexierung

## Dokumentation

- 📖 [Migration Guide](docs/indexeddb-migration-guide.md) - Detaillierte Anleitung zur IndexedDB-Integration
- 🚀 [Performance Guide](docs/indexeddb-performance-guide.md) - Performance-Optimierungen und Best Practices
- 🏗️ [Architecture](tasks/architecture.md) - Detaillierte Architektur-Dokumentation
- ✅ [Migration Status](tasks/transaction-store-indexeddb-migration.md) - Status der IndexedDB-Umstellung

## Contributing

1. Fork das Repository
2. Feature-Branch erstellen (`git checkout -b feature/amazing-feature`)
3. Änderungen committen (`git commit -m 'Add amazing feature'`)
4. Branch pushen (`git push origin feature/amazing-feature`)
5. Pull Request erstellen

### Coding Standards

- **TypeScript**: Strikte Typisierung verwenden
- **Vue 3**: Composition API mit `<script setup>`
- **Pinia**: Für State Management
- **IndexedDB**: Für Datenpersistierung
- **Logging**: Strukturiertes Logging mit Logger-Utils

## Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

## Support

Bei Fragen oder Problemen:

1. **Issues**: GitHub Issues für Bug-Reports und Feature-Requests
2. **Dokumentation**: Siehe `docs/` Verzeichnis
3. **Debug-Tools**: Browser DevTools für IndexedDB-Debugging

---

**Hinweis**: Diese Anwendung befindet sich in aktiver Entwicklung. Die IndexedDB-Integration wurde für den Transaction Store abgeschlossen und wird schrittweise auf weitere Stores ausgeweitet.
