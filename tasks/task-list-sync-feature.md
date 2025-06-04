# Taskliste: Bidirektionale Synchronisation mit Offline-Fähigkeit

Basierend auf den Anforderungen in [prd-sync-feature.md](tasks/prd-sync-feature.md).

- [x] 1. Backend: WebSocket-Server implementieren
- [x] 2. Frontend: WebSocket-Client implementieren
- [x] 3. WebSocket: Online-/Offline-Status signalisieren
- [x] 4. Frontend: Offline-Änderungen in IndexedDB Sync Queue speichern (Account, Account Group)
- [x] 5. Frontend: Sync Queue automatisch an Backend senden bei Wiederherstellung der Verbindung
- [x] 6. Backend: Empfangene Änderungen aus Sync Queue verarbeiten und in Tenant-Datenbank speichern
- [x] 7. Backend: Änderungen erkennen und über WebSocket an Frontend senden (Account, Account Group)
- [x] 8. Frontend: Vom Backend empfangene Änderungen verarbeiten und lokale IndexedDB aktualisieren
- [ ] 9. Synchronisation: Bidirektionalität sicherstellen (Backend-Anpassungen zur Vermeidung von Nachrichten-Loops implementiert; Frontend-Tests und Gesamtüberprüfung ausstehend)
- [x] 10. Synchronisation: Löschoperationen korrekt verarbeiten
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
- [x] [`src/types/index.ts`](src/types/index.ts:1): TypeScript-Typen erweitert um `DataUpdateNotificationMessage`, `EntityTypeEnum`, `DeletePayload`, `NotificationDataPayload` zur Verarbeitung von Backend-Benachrichtigungen. `ServerWebSocketMessage` angepasst.
- [ ] [`src/services/DataService.ts`](src/services/DataService.ts:1): (Keine Änderungen in diesem Schritt, da Accounts/AccountGroups über TenantDbService laufen)
- [x] [`src/stores/tenantStore.ts`](src/stores/tenantStore.ts:1): Dexie-Datenbankdefinition (`FinwiseTenantSpecificDB`) um `syncQueue`-Tabelle erweitert. (Keine Änderung in diesem Schritt)
- [x] [`src/services/TenantDbService.ts`](src/services/TenantDbService.ts:1): Erweitert um `getPendingSyncEntries` und `updateSyncQueueEntryStatus` für die Verarbeitung der Sync Queue.
- [x] [`src/stores/accountStore.ts`](src/stores/accountStore.ts:1): CRUD-Operationen (insb. `deleteAccount`, `deleteAccountGroup`) angepasst, um Löschungen korrekt in `syncQueue` einzutragen und bei Backend-initiierten Löschungen (`fromSync`) die lokale DB zu aktualisieren.
- [x] [`src/stores/webSocketStore.ts`](src/stores/webSocketStore.ts:1): Dient zur Überprüfung des Online-/Offline-Status. (Keine Änderung in diesem Schritt, wird aber vom WebSocketService genutzt)
- [x] [`src/services/WebSocketService.ts`](src/services/WebSocketService.ts:1): Erweitert um `onmessage`-Handler zur Verarbeitung von `data_update`-Nachrichten vom Backend; löst entsprechende Aktionen im `accountStore` aus, prüft `tenant_id`.
- [ ] [`src/main.ts`](src/main.ts:1): Initialisiert den WebSocketService und reagiert auf Tenant-Änderungen. (Hier sollte `WebSocketService.initialize()` aufgerufen werden)
- [ ] [`src/vite-env.d.ts`](src/vite-env.d.ts): Globale Typdefinition für `window.ApexCharts` hinzugefügt.
- [x] `../FinWise_0.4_BE/app/websocket/schemas.py`: Pydantic-Modelle für WebSocket-Nachrichten erweitert (`SyncQueueEntry`, `ProcessSyncEntryMessage`, `ServerEventType`, `NotificationDataPayload`, `DataUpdateNotificationMessage`).
- [x] `../FinWise_0.4_BE/app/websocket/connection_manager.py`: Erweitert um `exclude_websocket` Parameter in `broadcast_json_to_tenant` und `send_personal_json_message` zur Vermeidung von Nachrichten-Loops bei der Verarbeitung von Sync-Queue-Einträgen.
- [x] `../FinWise_0.4_BE/app/websocket/endpoints.py`: Übergibt nun das `websocket`-Objekt (für `exclude_websocket`) an `sync_service.process_sync_entry_for_tenant` beim Verarbeiten von `process_sync_entry`.
- [x] `../FinWise_0.4_BE/main.py`: Hauptanwendung, in die der WebSocket-Router integriert wurde. (Keine Änderung in diesem Schritt)
- [ ] `../FinWise_0.4_BE/app/models/financial_models.py`: Neue Datei mit SQLAlchemy-Modellen für `Account` und `AccountGroup`.
- [x] `../FinWise_0.4_BE/app/crud/crud_account.py`: `delete_account` sendet korrekte `DataUpdateNotificationMessage` mit `DeletePayload`.
- [x] `../FinWise_0.4_BE/app/crud/crud_account_group.py`: `delete_account_group` sendet korrekte `DataUpdateNotificationMessage` mit `DeletePayload`; kleiner Fehler (doppeltes `return None`) behoben.
- [x] `../FinWise_0.4_BE/app/services/sync_service.py`: Verarbeitet Lösch-Einträge aus der `syncQueue` korrekt.
- [ ] `../FinWise_0.4_BE/app/db/tenant_db.py`: (Gelesen, um die Erstellung von Mandanten-DB-Sitzungen zu verstehen; `TenantBase.metadata.create_all` wird nun im `sync_service` verwendet).
