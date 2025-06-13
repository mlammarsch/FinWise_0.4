# FinWise Integration Tests - Ausführungsanleitung

## Vollautomatisierte Integration Test Suite für Sync-Pipeline

Diese Dokumentation beschreibt die Ausführung der vollständigen Integration Test Suite für die FinWise Sync-Pipeline.

## Schnellstart

### 1. Dependencies installieren
```bash
npm install
```

### 2. Alle Integration Tests ausführen
```bash
npm run test:integration
```

### 3. Tests im Watch-Modus (für Entwicklung)
```bash
npm run test:watch
```

## Test-Kategorien

### Hauptintegrationstests (`sync-integration.test.ts`)
Testet die vollständige Sync-Pipeline mit allen kritischen Szenarien:

```bash
# Spezifische Test-Datei ausführen
npx vitest tests/integration/sync-integration.test.ts
```

**Validierte Szenarien:**
- ✅ Online-Account-Erstellung mit sofortiger Sync und ACK
- ✅ Offline-Account-Erstellung mit Queue-Speicherung
- ✅ Sync-Fehler mit Retry-Mechanismus und exponential backoff
- ✅ Mehrere Queue-Items sequenziell abarbeiten
- ✅ LWW-Konfliktauflösung bei gleichzeitigen Änderungen
- ✅ AccountGroup-Synchronisation analog zu Accounts
- ✅ Hängende PROCESSING-Einträge Reset
- ✅ Dead Letter Queue für dauerhaft fehlgeschlagene Einträge

### Account-spezifische Tests (`account-sync.test.ts`)
```bash
npx vitest tests/integration/account-sync.test.ts
```

**Validierte Funktionen:**
- Account CRUD-Operationen (CREATE, UPDATE, DELETE)
- Verschiedene Account-Typen (CHECKING, SAVINGS, CREDIT, CASH)
- Balance und Financial Data Sync
- Validation und Error Handling
- Offline/Online Sync-Szenarien
- Data Integrity und Timestamp-Management

### AccountGroup-spezifische Tests (`account-group-sync.test.ts`)
```bash
npx vitest tests/integration/account-group-sync.test.ts
```

**Validierte Funktionen:**
- AccountGroup CRUD-Operationen
- Business Logic (sortOrder, Löschungsverhinderung)
- Validation und Error Handling
- Offline/Online Sync
- LWW Conflict Resolution

### Error Handling Tests (`sync-error-handling.test.ts`)
```bash
npx vitest tests/integration/sync-error-handling.test.ts
```

**Validierte Fehlerszenarien:**
- Validation Errors mit Retry-Mechanismus
- Database Errors mit exponential backoff
- Network Errors und Timeout-Handling
- Stuck Processing Entry Recovery
- Dead Letter Queue Handling
- Concurrent Error Scenarios

## Test-Ergebnisse interpretieren

### Erfolgreiche Ausführung
```
✓ tests/integration/sync-integration.test.ts (8)
✓ tests/integration/account-sync.test.ts (6)
✓ tests/integration/account-group-sync.test.ts (6)
✓ tests/integration/sync-error-handling.test.ts (6)

Test Files  4 passed (4)
Tests       26 passed (26)
```

### Fehleranalyse
Bei Fehlern werden detaillierte Informationen angezeigt:

```
FAIL tests/integration/sync-integration.test.ts > Test 1: Online-Account-Erstellung
AssertionError: expected 0 to be 1
 ❯ sync-integration.test.ts:95:32
```

**Debugging-Schritte:**
1. Prüfe Mock-Setup in `beforeEach`
2. Validiere Test-Daten-Generierung
3. Überprüfe Async-Timing mit `waitFor*`-Methoden
4. Nutze `debugSyncQueueState()` für Queue-Analyse

## Mock-Architektur

### MockWebSocketServer
Simuliert vollständiges Backend-Verhalten:
- **Online/Offline-Modi**: Testet Verbindungsszenarien
- **Auto-ACK/NACK**: Simuliert Backend-Responses
- **Fehlertypen**: validation_error, database_error, network_error
- **Delay-Simulation**: Testet Timeout-Verhalten
- **Partial-Failure**: Simuliert gemischte Erfolg/Fehler-Szenarien

### MockTenantService
Stellt isolierte Test-Umgebung bereit:
- **IndexedDB-Simulation**: Vollständige Datenbank-Operationen
- **Store-Mocking**: Pinia-Store-Instanzen für Tests
- **Test-Daten-Management**: CRUD-Operationen für Test-Daten
- **Sync-Queue-Operationen**: Vollständige Queue-Verwaltung

### TestDataGenerator
Generiert konsistente, realistische Test-Daten:
- **Accounts**: Verschiedene Typen und Konfigurationen
- **AccountGroups**: Mit korrekten Beziehungen
- **SyncQueueEntries**: Alle Operationstypen und Status
- **Konflikt-Szenarien**: Timestamp-basierte Konflikte
- **Batch-Daten**: Für Performance-Tests

## Erweiterte Test-Konfiguration

### Custom Test-Timeouts
```typescript
// In Test-Dateien anpassen:
await testAssertions.waitForSyncCompletion(10000); // 10 Sekunden
```

### Debug-Modus aktivieren
```typescript
// In beforeEach hinzufügen:
console.log = console.log; // Restore real console
await testAssertions.debugSyncQueueState();
```

### Spezifische Test-Szenarien
```bash
# Nur LWW-Konflikt-Tests
npx vitest -t "LWW"

# Nur Error-Handling-Tests
npx vitest -t "error"

# Nur Offline-Sync-Tests
npx vitest -t "offline"
```

## CI/CD Integration

### GitHub Actions Beispiel
```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:integration
```

### Test-Coverage
```bash
npm run test:coverage
```

Generiert Coverage-Report in `coverage/` Verzeichnis.

## Validierte Probleme

### ✅ Problem 1: Inkonsistente Synchronisation
**Gelöst durch:**
- LWW (Last-Writer-Wins) Konfliktauflösung
- Konsistente Timestamp-Verwaltung
- Robuste Offline/Online-Synchronisation
- Sequenzielle Queue-Verarbeitung

**Validiert in Tests:**
- `Test 5: LWW-Konfliktauflösung bei gleichzeitigen Änderungen`
- `Test 4: Mehrere Queue-Items sequenziell abarbeiten`
- Alle Offline/Online-Sync-Szenarien

### ✅ Problem 2: Sync-Bestätigungen
**Gelöst durch:**
- ACK/NACK-Verarbeitung mit WebSocket-Nachrichten
- Retry-Mechanismus mit exponential backoff
- Dead-Letter-Queue für dauerhaft fehlgeschlagene Einträge
- Stuck-Processing-Entry-Recovery

**Validiert in Tests:**
- `Test 1: Online-Account-Erstellung mit sofortiger Sync und ACK`
- `Test 3: Sync-Fehler mit Retry-Mechanismus und exponential backoff`
- `Test 7: Hängende PROCESSING-Einträge Reset`
- `Test 8: Dead Letter Queue für dauerhaft fehlgeschlagene Einträge`

## Performance-Metriken

Die Tests validieren folgende Performance-Aspekte:
- **Sync-Latenz**: < 200ms für Online-Operationen
- **Batch-Verarbeitung**: Sequenzielle Abarbeitung ohne Race Conditions
- **Error-Recovery**: Exponential backoff verhindert Server-Überlastung
- **Memory-Leaks**: Cleanup nach jedem Test verhindert Memory-Akkumulation

## Troubleshooting

### Häufige Probleme

1. **"WebSocket connection timeout"**
   - Lösung: Erhöhe Timeout in `waitForWebSocketConnection()`

2. **"Sync processing timeout"**
   - Lösung: Prüfe Mock-Server-Setup und Auto-ACK-Konfiguration

3. **"IndexedDB not available"**
   - Lösung: Stelle sicher, dass `fake-indexeddb` installiert ist

4. **"Store not initialized"**
   - Lösung: Prüfe Pinia-Setup in `beforeEach`

### Debug-Kommandos
```bash
# Verbose Test-Ausgabe
npx vitest --reporter=verbose

# Einzelnen Test debuggen
npx vitest --reporter=verbose -t "Online-Account-Erstellung"

# Test-Setup debuggen
DEBUG=true npx vitest tests/integration/sync-integration.test.ts
```

## Fazit

Diese vollautomatisierte Integration Test Suite bestätigt, dass:

1. **Alle kritischen Sync-Szenarien** funktionieren korrekt
2. **Beide identifizierten Probleme** vollständig gelöst sind
3. **Die Sync-Pipeline** robust und zuverlässig arbeitet
4. **Error-Handling** umfassend implementiert ist
5. **Performance-Anforderungen** erfüllt werden

Die Tests können jederzeit ausgeführt werden, um Regressionen zu verhindern und die Qualität der Sync-Funktionalität sicherzustellen.
