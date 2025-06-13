# FinWise Integration Tests

Diese Test-Suite implementiert vollautomatisierte Integration Tests für die Sync-Pipeline von FinWise.

## Überblick

Die Tests validieren alle kritischen Sync-Szenarien ohne User-Interaktion:

- **Online-Account-Erstellung** mit sofortiger Sync und ACK
- **Offline-Account-Erstellung** mit Queue-Speicherung
- **Sync-Fehler** mit Retry-Mechanismus und exponential backoff
- **Mehrere Queue-Items** sequenziell abarbeiten
- **LWW-Konfliktauflösung** bei gleichzeitigen Änderungen
- **AccountGroup-Synchronisation** analog zu Accounts
- **Hängende PROCESSING-Einträge** Reset
- **Dead Letter Queue** für dauerhaft fehlgeschlagene Einträge

## Test-Struktur

```
tests/
├── integration/
│   ├── sync-integration.test.ts      # Hauptintegrationstests
│   ├── account-sync.test.ts          # Account-spezifische Tests
│   ├── account-group-sync.test.ts    # AccountGroup-spezifische Tests
│   └── sync-error-handling.test.ts   # Fehlerbehandlungs-Tests
├── mocks/
│   ├── mock-websocket-server.ts      # Mock WebSocket Server
│   ├── mock-tenant-service.ts        # Mock Tenant Service
│   └── test-data-generators.ts       # Test-Daten-Generatoren
├── utils/
│   └── test-setup.ts                 # Test-Setup und Assertions
├── setup.ts                          # Vitest Setup-Datei
└── README.md                         # Diese Datei
```

## Test-Ausführung

### Alle Tests ausführen
```bash
npm test
```

### Nur Integration Tests
```bash
npm run test:integration
```

### Tests im Watch-Modus
```bash
npm run test:watch
```

### Tests mit Coverage
```bash
npm run test:coverage
```

## Mock-Architektur

### MockWebSocketServer
Simuliert Backend-WebSocket-Verhalten:
- Online/Offline-Modi
- Auto-ACK/NACK-Responses
- Verschiedene Fehlertypen
- Delay-Simulation
- Partial-Failure-Szenarien

### MockTenantService
Stellt Mock-Datenbank und Store-Services bereit:
- IndexedDB-Simulation mit Dexie
- Mock-Store-Instanzen
- Test-Daten-Management
- Sync-Queue-Operationen

### TestDataGenerator
Generiert konsistente Test-Daten:
- Accounts mit verschiedenen Typen
- AccountGroups
- SyncQueueEntries
- Konflikt-Szenarien
- Sequenzielle Daten

## Test-Szenarien

### 1. Online-Sync-Tests
- Sofortige Synchronisation bei Online-Verbindung
- ACK/NACK-Verarbeitung
- Erfolgreiche Sync-Queue-Entfernung

### 2. Offline-Sync-Tests
- Queue-Speicherung bei Offline-Modus
- Batch-Synchronisation bei Reconnect
- Reihenfolgen-Erhaltung

### 3. Fehlerbehandlungs-Tests
- Validation-Errors mit begrenzten Retries
- Database-Errors mit exponential backoff
- Network-Errors mit Reconnect-Logic
- Timeout-Handling

### 4. Konfliktauflösung-Tests
- Last-Writer-Wins (LWW) bei Timestamp-Konflikten
- Lokale vs. Remote-Änderungen
- Gleichzeitige Operationen

### 5. Recovery-Tests
- Stuck-Processing-Entry-Reset
- Dead-Letter-Queue-Handling
- Batch-Recovery nach Fehlern

## Assertions und Validierungen

### Sync-Queue-Validierung
- Status-Übergänge (PENDING → PROCESSING → SYNCED/FAILED)
- Retry-Zähler und Timestamps
- Fehler-Nachrichten

### WebSocket-Nachrichtenvalidierung
- Korrekte Nachrichtenformate
- Payload-Integrität
- Sequenzielle Verarbeitung

### IndexedDB-Persistierung
- Daten-Konsistenz
- Timestamp-Management
- LWW-Konfliktauflösung

### Store-State-Management
- Reaktive Updates
- Konsistenz zwischen Store und DB
- Fehlerbehandlung

## Konfiguration

### Vitest-Konfiguration
- JSdom-Environment für Browser-APIs
- IndexedDB-Mocking mit fake-indexeddb
- TypeScript-Support mit Path-Aliasing
- Setup-Dateien für Mock-Initialisierung

### Test-Timeouts
- WebSocket-Verbindung: 5 Sekunden
- Sync-Verarbeitung: 3 Sekunden
- Sync-Abschluss: 5 Sekunden
- Retry-Delays: Verkürzt für Tests

## Debugging

### Test-Debugging
```typescript
// In Tests verfügbar:
await testAssertions.debugSyncQueueState();
```

### Console-Logs
Tests verwenden Mock-Console für saubere Ausgabe. Für Debugging:
```typescript
console.log = console.log; // Restore real console
```

### Fehleranalyse
- Detaillierte Assertions mit erwarteten vs. tatsächlichen Werten
- Sync-Queue-Status-Tracking
- WebSocket-Nachrichten-Logging

## Erweiterung

### Neue Test-Szenarien hinzufügen
1. Erstelle Test-Datei in `tests/integration/`
2. Verwende bestehende Mock-Services
3. Implementiere spezifische Assertions
4. Dokumentiere Test-Zweck

### Neue Mock-Funktionalität
1. Erweitere entsprechende Mock-Klasse
2. Füge Test-Utilities hinzu
3. Aktualisiere Test-Setup
4. Teste Mock-Verhalten isoliert

## Continuous Integration

Die Tests sind CI/CD-kompatibel und können in automatisierten Pipelines ausgeführt werden:

```yaml
# Beispiel GitHub Actions
- name: Run Integration Tests
  run: npm run test:integration
```

## Troubleshooting

### Häufige Probleme

1. **IndexedDB-Fehler**: Stelle sicher, dass fake-indexeddb korrekt installiert ist
2. **WebSocket-Mock-Fehler**: Prüfe Mock-Setup in setup.ts
3. **Timeout-Fehler**: Erhöhe Test-Timeouts bei langsamen Systemen
4. **Store-Mock-Fehler**: Verifiziere Pinia-Setup in beforeEach

### Performance-Optimierung

- Verwende `vi.useFakeTimers()` für zeitbasierte Tests
- Minimiere echte Async-Operationen
- Nutze Batch-Operationen für große Datenmengen
- Cleanup nach jedem Test für Isolation

## Validierte Probleme

Diese Test-Suite validiert die Lösung folgender Probleme:

1. **Problem 1 (Inkonsistente Synchronisation)**: ✅ Gelöst
   - LWW-Konfliktauflösung implementiert
   - Konsistente Timestamp-Verwaltung
   - Robuste Offline/Online-Synchronisation

2. **Problem 2 (Sync-Bestätigungen)**: ✅ Gelöst
   - ACK/NACK-Verarbeitung implementiert
   - Retry-Mechanismus mit exponential backoff
   - Dead-Letter-Queue für dauerhaft fehlgeschlagene Einträge
   - Stuck-Processing-Entry-Recovery

Die Tests bestätigen, dass beide Probleme vollständig gelöst sind und die Sync-Pipeline robust und zuverlässig funktioniert.
