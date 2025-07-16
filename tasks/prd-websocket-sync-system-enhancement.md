# PRD: WebSocket Sync-System Enhancement

## Introduction/Overview

Das aktuelle WebSocket-Synchronisationssystem in FinWise zeigt kritische Schwächen bei der Verarbeitung großer Datenmengen (>30 Datensätze), insbesondere bei CSV-Importen. Die Synchronisation stoppt teilweise und erfordert manuelle App-Restarts. Diese PRD definiert eine umfassende Verbesserung des Sync-Systems mit Fokus auf nahtlose End-User-Experience.

**Problem:** Benutzer erleben Sync-Unterbrechungen bei großen Datenimporten, die zu Datenverlust und Frustration führen.

**Ziel:** Ein robustes, selbstheilendes Sync-System, das auch bei großen Datenmengen und Verbindungsabbrüchen nahtlos funktioniert.

## Goals

1. **Zuverlässigkeit:** Sync-Erfolgsrate von >99% auch bei großen Datenmengen (50-200 Datensätze)
2. **Performance:** Maximale Sync-Zeit von 30 Sekunden für CSV-Imports mit >100 Datensätzen
3. **Benutzerfreundlichkeit:** Keine sichtbaren Sync-Unterbrechungen oder manuelle Restarts erforderlich
4. **Transparenz:** Intuitive Sync-Status-Anzeige mit Progress-Feedback
5. **Robustheit:** Automatische Sync-Wiederaufnahme nach Verbindungsabbrüchen
6. **Support-Reduktion:** Reduzierung von Support-Tickets zu Sync-Problemen um 80%

## User Stories

### US1: Nahtloser CSV-Import
**Als** FinWise-Benutzer
**möchte ich** große CSV-Dateien (>100 Transaktionen) importieren
**damit** alle Daten zuverlässig synchronisiert werden ohne manuelle Eingriffe

**Akzeptanzkriterien:**
- Import läuft ohne Unterbrechung durch
- Progress-Anzeige zeigt aktuellen Status
- Bei Verbindungsabbruch wird automatisch fortgesetzt

### US2: Automatische Sync-Wiederherstellung
**Als** FinWise-Benutzer
**möchte ich** dass die App automatisch synchronisiert wenn die Internetverbindung zurückkehrt
**damit** ich keine Daten verliere und nicht manuell eingreifen muss

**Akzeptanzkriterien:**
- Offline-Änderungen werden in Queue gespeichert
- Automatische Sync-Wiederaufnahme bei Reconnection
- Keine Duplikate oder Datenverlust

### US3: Transparenter Sync-Status
**Als** FinWise-Benutzer
**möchte ich** jederzeit den aktuellen Sync-Status sehen
**damit** ich weiß ob meine Daten sicher synchronisiert sind

**Akzeptanzkriterien:**
- Sync-Status-Indikator in der UI
- Progress-Bar bei großen Sync-Operationen
- Fehlermeldungen mit klaren Handlungsanweisungen

## Functional Requirements

### FR1: Kontinuierlicher Auto-Sync-Monitor
1.1. Das System muss alle 10 Sekunden die Sync-Queue auf pending Einträge prüfen
1.2. Bei vorhandenen Einträgen muss automatisch die Sync-Verarbeitung gestartet werden
1.3. Stuck PROCESSING-Einträge müssen nach 30 Sekunden automatisch auf PENDING zurückgesetzt werden
1.4. Der Monitor muss nur bei aktiver Online-Verbindung laufen

### FR2: Batch-Processing für große Datenmengen
2.1. Sync-Operationen müssen in Batches von maximal 15 Einträgen verarbeitet werden
2.2. Zwischen Batches muss eine Pause von 1 Sekunde eingehalten werden
2.3. Progress-Tracking muss für Batch-Verarbeitung implementiert werden
2.4. Bei Batch-Fehlern muss nur der betroffene Batch wiederholt werden

### FR3: Enhanced WebSocket-Reconnection
3.1. Bei Verbindungsabbruch muss automatisch Reconnection mit exponential backoff erfolgen
3.2. Nach erfolgreicher Reconnection muss sofort die Sync-Queue verarbeitet werden
3.3. Connection-Health-Monitoring muss kontinuierlich laufen
3.4. Heartbeat-Mechanismus muss Verbindungsqualität überwachen

### FR4: Robuste Error-Recovery
4.1. Fehlgeschlagene Sync-Operationen müssen mit exponential backoff wiederholt werden
4.2. Nach 5 Fehlversuchen müssen Einträge in Dead-Letter-Queue verschoben werden
4.3. Verschiedene Fehlertypen müssen unterschiedlich behandelt werden (validation, network, timeout)
4.4. Error-Logs müssen detaillierte Informationen für Debugging enthalten

### FR5: User-Interface-Integration
5.1. Sync-Status-Indikator muss in der Hauptnavigation sichtbar sein
5.2. Progress-Bar muss bei Batch-Operationen angezeigt werden
5.3. Fehlermeldungen müssen benutzerfreundlich und actionable sein
5.4. Offline-Modus muss klar gekennzeichnet werden

### FR6: Performance-Optimierungen
6.1. Sync-Queue-Statistiken müssen effizient berechnet werden
6.2. IndexedDB-Operationen müssen in Transaktionen gebündelt werden
6.3. Memory-Leaks müssen durch proper cleanup verhindert werden
6.4. WebSocket-Message-Größe muss bei großen Payloads optimiert werden

## Non-Goals (Out of Scope)

- **Keine Änderungen am Backend-Sync-Service** (außer ACK/NACK-Verbesserungen)
- **Keine neuen Sync-Protokolle** (bestehende WebSocket-Architektur beibehalten)
- **Keine UI-Redesigns** (nur funktionale Sync-Status-Anzeigen)
- **Keine Offline-First-Architektur-Änderungen** (bestehende IndexedDB-Struktur beibehalten)
- **Keine Multi-Device-Sync-Features** (bleibt bei bestehender Mandanten-Architektur)

## Technical Considerations

### Bestehende Architektur
- **WebSocketService.ts:** Erweitern um kontinuierlichen Monitor und Batch-Processing
- **TenantDbService.ts:** Optimieren für Batch-Operationen und Queue-Management
- **webSocketStore.ts:** Erweitern um detaillierte Status-Tracking

### Dependencies
- Bestehende Dexie.js IndexedDB-Integration beibehalten
- Vue 3 Composition API für reactive Status-Updates
- Pinia Store-Pattern für State-Management

### Performance-Constraints
- Batch-Size limitiert auf 15 Einträge um WebSocket nicht zu überlasten
- Monitor-Interval von 10 Sekunden als Balance zwischen Responsiveness und Performance
- Exponential backoff mit Maximum von 30 Sekunden

### Integration Points
- **CSV-Import-Service:** Muss Batch-Processing unterstützen
- **Sync-Button-Component:** Muss neuen Status-Indikator integrieren
- **Error-Handling:** Muss mit bestehenden Logger-Utilities kompatibel sein

## Success Metrics

### Quantitative Metriken
- **Sync-Erfolgsrate:** >99% für alle Operationen
- **Performance:** Max. 30s für CSV-Imports mit >100 Datensätzen
- **Reconnection-Zeit:** <5s für automatische Wiederverbindung
- **Error-Recovery:** <3 Retry-Versuche für 95% der Fehler

### Qualitative Metriken
- **Support-Tickets:** 80% Reduktion von Sync-bezogenen Tickets
- **User-Feedback:** Keine Beschwerden über Sync-Unterbrechungen
- **Manual Interventions:** 0 manuelle App-Restarts erforderlich
- **Data Integrity:** 100% Datenintegrität bei allen Sync-Operationen

### Monitoring-Metriken
- Sync-Queue-Länge über Zeit
- Batch-Processing-Performance
- WebSocket-Reconnection-Häufigkeit
- Error-Rate nach Fehlertyp

## Mock Data Requirements

### Unit Test Mock Data

#### Sync-Queue-Szenarien
```typescript
// Verschiedene Queue-Status für Tests
const mockSyncQueueEntries = [
  { id: '1', status: 'pending', entityType: 'Account', attempts: 0 },
  { id: '2', status: 'processing', entityType: 'Transaction', attempts: 1 },
  { id: '3', status: 'failed', entityType: 'Category', attempts: 3 },
  { id: '4', status: 'synced', entityType: 'Account', attempts: 1 }
];
```

#### WebSocket-Verbindungsstatus
```typescript
// Connection-Status-Mocks
const mockConnectionStates = [
  { status: 'connected', latency: 50, lastHeartbeat: Date.now() },
  { status: 'disconnected', reason: 'network_error', retryCount: 2 },
  { status: 'reconnecting', backoffDelay: 4000, attempt: 3 }
];
```

#### Große Datensätze (50-200 Einträge)
```typescript
// CSV-Import-Simulation
const mockLargeDataset = generateMockTransactions(150, {
  accountIds: ['acc1', 'acc2', 'acc3'],
  categoryIds: ['cat1', 'cat2', 'cat3'],
  dateRange: { start: '2024-01-01', end: '2024-12-31' }
});
```

#### Batch-Processing-Szenarien
```typescript
// Batch-Verarbeitung-Tests
const mockBatchScenarios = [
  { batchSize: 15, totalItems: 45, expectedBatches: 3 },
  { batchSize: 15, totalItems: 100, expectedBatches: 7 },
  { batchSize: 15, totalItems: 200, expectedBatches: 14 }
];
```

#### Error-Szenarien
```typescript
// Verschiedene Fehlertypen
const mockErrorScenarios = [
  { type: 'validation_error', retryLimit: 2, backoffMultiplier: 1 },
  { type: 'network_error', retryLimit: 5, backoffMultiplier: 2 },
  { type: 'timeout_error', retryLimit: 3, backoffMultiplier: 1.5 }
];
```

## Open Questions

1. **Batch-Size-Konfiguration:** Soll die Batch-Größe konfigurierbar sein oder fest bei 15 bleiben?

2. **Error-Notification:** Sollen kritische Sync-Fehler als Toast-Notifications angezeigt werden?

3. **Offline-Queue-Limits:** Gibt es eine maximale Anzahl von Offline-Einträgen in der Queue?

4. **Performance-Monitoring:** Sollen Sync-Performance-Metriken an ein Analytics-System gesendet werden?

5. **Backward-Compatibility:** Müssen bestehende Sync-Queue-Einträge migriert werden?

6. **Testing-Strategy:** Sollen automatisierte Integration-Tests für kritische Sync-Pfade erstellt werden?

---

**Erstellt:** 2025-07-16
**Version:** 1.0
**Zielgruppe:** Junior Developer
**Geschätzte Implementierungszeit:** 2-3 Wochen
