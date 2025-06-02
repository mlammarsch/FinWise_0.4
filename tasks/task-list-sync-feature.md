# Taskliste: Bidirektionale Synchronisation mit Offline-Fähigkeit

Basierend auf den Anforderungen in [prd-sync-feature.md](tasks/prd-sync-feature.md).

- [x] 1. Backend: WebSocket-Server implementieren
- [x] 2. Frontend: WebSocket-Client implementieren
- [ ] 3. WebSocket: Online-/Offline-Status signalisieren
- [ ] 4. Frontend: Offline-Änderungen in IndexedDB Sync Queue speichern (Account, Account Group)
- [ ] 5. Frontend: Sync Queue automatisch an Backend senden bei Wiederherstellung der Verbindung
- [ ] 6. Backend: Empfangene Änderungen aus Sync Queue verarbeiten und in Tenant-Datenbank speichern
- [ ] 7. Backend: Änderungen erkennen und über WebSocket an Frontend senden (Account, Account Group)
- [ ] 8. Frontend: Vom Backend empfangene Änderungen verarbeiten und lokale IndexedDB aktualisieren
- [ ] 9. Synchronisation: Bidirektionalität sicherstellen
- [ ] 10. Synchronisation: Löschoperationen korrekt verarbeiten
- [ ] 11. Backend: Tenant-Zuordnung und Speicherung in korrekter Datenbank sicherstellen
- [ ] 12. Synchronisation: Konfliktlösung nach "last write wins" implementieren
- [ ] 13. Backend: Datenbankmodell für Account und Account Group implementieren
- [ ] 14. Backend: Erstellung von Tenant-Datenbanken nachholen bei Offline-Erstellung
- [ ] 15. WebSocket: Sichere Verbindung und Verschlüsselung (SOLLTE)
- [ ] 16. UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButton.vue): Anzeige des Synchronisationsstatus implementieren
- [ ] 17. UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButton.vue): Manuelle Auslösung der Synchronisation ermöglichen
- [ ] 18. Dokumentation: Schritte zur Erweiterung der Synchronisation auf weitere Datentabellen dokumentieren

## Relevante Dateien

- [ ] [`tasks/prd-sync-feature.md`](tasks/prd-sync-feature.md): Produktanforderungen für die Synchronisationsfunktion.
- [ ] [`tasks/task-list-sync-feature.md`](tasks/task-list-sync-feature.md): Diese Taskliste zur Verfolgung des Fortschritts.
- [ ] [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButton.vue): UI-Komponente zur Anzeige des Synchronisationsstatus.
- [ ] [`src/types/index.ts`](src/types/index.ts): TypeScript-Typen und -Interfaces, einschließlich der Modelle für Account und Account Group.
- [ ] [`src/services/DataService.ts`](src/services/DataService.ts): Möglicherweise Anpassungen für IndexedDB-Zugriff und Sync Queue.
- [ ] [`src/services/TenantService.ts`](src/services/TenantService.ts): Möglicherweise Anpassungen für Tenant-Erstellung und -Verwaltung.
- [ ] [`src/services/SessionService.ts`](src/services/SessionService.ts): Möglicherweise Anpassungen für Session- und Tenant-Handling.
- [ ] [`src/stores/webSocketStore.ts`](src/stores/webSocketStore.ts): Pinia-Store zur Verwaltung des WebSocket-Status und der Nachrichten.
- [ ] [`src/services/WebSocketService.ts`](src/services/WebSocketService.ts): Implementiert die WebSocket-Client-Logik (Verbindung, Senden/Empfangen, Wiederverbindung).
- [ ] [`src/main.ts`](src/main.ts): Initialisiert den WebSocketService und reagiert auf Tenant-Änderungen.
- [ ] [`src/vite-env.d.ts`](src/vite-env.d.ts): Globale Typdefinition für `window.ApexCharts` hinzugefügt.
- [x] `../FinWise_0.4_BE/app/websocket/connection_manager.py`: Verwaltet aktive WebSocket-Verbindungen.
- [x] `../FinWise_0.4_BE/app/websocket/endpoints.py`: Definiert die WebSocket-Endpunkte und die grundlegende Nachrichtenbehandlung.
- [x] `../FinWise_0.4_BE/main.py`: Hauptanwendung, in die der WebSocket-Router integriert wurde.
