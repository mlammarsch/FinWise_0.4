## Relevant Files

- `src/services/WebSocketService.ts` - Muss um den kontinuierlichen Monitor, Batch-Verarbeitung und verbesserte Wiederverbindung erweitert werden.
- `src/services/TenantDbService.ts` - Muss für Batch-Operationen und optimiertes Queue-Management angepasst werden.
- `src/stores/webSocketStore.ts` - Muss erweitert werden, um detaillierte Status und Fortschritt zu verfolgen.
- `src/components/ui/SyncStatusIndicator.vue` - Neue Komponente zur Anzeige des Sync-Status.
- `src/composables/useSyncMonitor.ts` - Neuer Composable für die Auto-Sync-Monitor-Logik.
- `tests/integration/sync-enhancement.test.ts` - Integrationstests für die neuen Sync-Verbesserungen.

### Notes

- Unit-Tests sollten typischerweise neben den Codedateien platziert werden, die sie testen.
- Verwenden Sie `npm run test:integration`, um die Integrationstests auszuführen.

## Tasks

- [x] 1.0 Implementierung des kontinuierlichen Auto-Sync-Monitors (FR1)
  - [x] 1.1 Erstellen der Composable-Datei `src/composables/useSyncMonitor.ts`.
  - [x] 1.2 Implementieren einer `setInterval`-Logik, die alle 10 Sekunden ausgeführt wird, um die Sync-Queue zu prüfen.
  - [x] 1.3 Der Monitor darf nur laufen, wenn der `webSocketStore` einen Online-Status anzeigt.
  - [x] 1.4 Bei `pending` Einträgen in der Queue, die Funktion `WebSocketService.processSyncQueue()` aufrufen.
  - [x] 1.5 In `TenantDbService` eine Methode implementieren, die `PROCESSING`-Einträge, die älter als 30 Sekunden sind, auf `PENDING` zurücksetzt.
- [ ] 2.0 Implementierung der Batch-Verarbeitung für große Datenmengen (FR2)
  - [ ] 2.1 `WebSocketService.processSyncQueue()` anpassen, um Einträge in Batches von maximal 15 zu verarbeiten.
  - [ ] 2.2 Eine Pause von 1 Sekunde zwischen dem Senden der einzelnen Batches implementieren.
  - [ ] 2.3 Den `webSocketStore` erweitern, um den Fortschritt der Batch-Verarbeitung zu verfolgen (z.B. `processedBatches`, `totalBatches`).
  - [ ] 2.4 Eine Fehlerbehandlung implementieren, die bei einem Fehler nur den betroffenen Batch wiederholt.
- [ ] 3.0 Verbesserung der WebSocket-Wiederverbindung (FR3)
  - [ ] 3.1 In `WebSocketService` die Reconnection-Logik mit einem "exponential backoff"-Mechanismus erweitern.
  - [ ] 3.2 Sicherstellen, dass nach einer erfolgreichen Wiederverbindung die Sync-Queue sofort verarbeitet wird.
  - [ ] 3.3 Einen Heartbeat-Mechanismus implementieren, der die Verbindungsqualität prüft.
  - [ ] 3.4 Den `webSocketStore` um detaillierte Verbindungsstatus (`reconnecting`, `healthy`, `unhealthy`) erweitern.
- [ ] 4.0 Implementierung einer robusten Fehlerbehandlung (FR4)
  - [ ] 4.1 Die `processSyncNack`-Methode in `WebSocketService` mit "exponential backoff" für Wiederholungsversuche erweitern.
  - [ ] 4.2 Die Anzahl der Versuche pro Queue-Eintrag in `TenantDbService` speichern.
  - [ ] 4.3 Einträge nach 5 erfolglosen Versuchen in eine "Dead-Letter-Queue" verschieben (Status `FAILED_PERMANENTLY`).
  - [ ] 4.4 Sicherstellen, dass detaillierte Fehlerinformationen für das Debugging geloggt werden.
- [ ] 5.0 Integration der Sync-Statusanzeige in die Benutzeroberfläche (FR5)
  - [ ] 5.1 Erstellen der Vue-Komponente `src/components/ui/SyncStatusIndicator.vue`.
  - [ ] 5.2 Die Komponente soll den Sync-Status (`SYNCED`, `SYNCING`, `OFFLINE`, `ERROR`) aus dem `webSocketStore` anzeigen.
  - [ ] 5.3 Eine Progress-Bar anzeigen, wenn eine Batch-Verarbeitung läuft.
  - [ ] 5.4 Benutzerfreundliche Fehlermeldungen und einen klaren Offline-Indikator implementieren.
  - [ ] 5.5 Die Komponente in die Hauptnavigation der Anwendung integrieren.
- [ ] 6.0 Durchführung von Performance-Optimierungen (FR6)
  - [ ] 6.1 In `TenantDbService` mehrere IndexedDB-Schreibvorgänge in einer einzigen Transaktion bündeln.
  - [ ] 6.2 Sicherstellen, dass alle `setInterval`-Instanzen korrekt bereinigt werden, um Memory-Leaks zu vermeiden.
  - [ ] 6.3 Die Berechnung von Sync-Queue-Statistiken im `webSocketStore` mithilfe von `computed` properties optimieren.
