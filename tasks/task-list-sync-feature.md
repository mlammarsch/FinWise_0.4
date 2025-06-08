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
- [x] 9. Synchronisation: Bidirektionalität sicherstellen (Initialer Datenabruf beim Mandantenwechsel implementiert, um sicherzustellen, dass neue Frontends alle Daten vom Backend erhalten)
- [x] 10. Synchronisation: Löschoperationen korrekt verarbeiten
- [x] 11. Backend: Tenant-Zuordnung und Speicherung in korrekter Datenbank sicherstellen (Überprüfung abgeschlossen, keine Änderungen notwendig)
- [x] 12. Synchronisation: Konfliktlösung nach "last write wins" implementieren
- [x] 13. Backend: Datenbankmodell für Account und Account Group implementieren/verifizieren (Modelle und Schemas für `balance` und `creditLimit` auf `Numeric`/`Decimal` umgestellt; Konsistenz mit Frontend-Typen sichergestellt)
- [x] 14. Backend: Erstellung von Tenant-Datenbanken nachholen bei Offline-Erstellung (Überprüfung der Kompatibilität abgeschlossen, bestehende Implementierung ist robust, keine Änderungen notwendig)
- [ ] 15. WebSocket: Sichere Verbindung und Verschlüsselung (SOLLTE)
- [x] 16. UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButton.vue): Anzeige des Synchronisationsstatus implementieren
- [x] 17. UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButton.vue): Manuelle Auslösung der Synchronisation ermöglichen
- [x] 18. Dokumentation: Schritte zur Erweiterung der Synchronisation auf weitere Datentabellen dokumentieren

## Relevante Dateien

- [ ] [`tasks/prd-sync-feature.md`](tasks/prd-sync-feature.md): Produktanforderungen für die Synchronisationsfunktion.
- [ ] [`tasks/task-list-sync-feature.md`](tasks/task-list-sync-feature.md): Diese Taskliste zur Verfolgung des Fortschritts.
- [x] [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButton.vue): UI-Komponente zur Anzeige des Synchronisationsstatus (Online/Offline) und zur manuellen Auslösung der Synchronisation. Zeigt nun den Online- und Offline-Status reaktiv an, basierend auf dem `webSocketStore`. Die Logik für das manuelle Auslösen der Synchronisation wurde auf den `WebSocketService` umgestellt.
- [x] [`src/types/index.ts`](src/types/index.ts:1): `Account` und `AccountGroup` Interfaces um `updated_at` (string) erweitert für LWW. Neue WebSocket-Nachrichtentypen (`RequestInitialDataMessage`, `InitialDataPayload`, `InitialDataLoadMessage`) und `SyncOperationType.INITIAL_LOAD` hinzugefügt.
- [ ] [`src/services/DataService.ts`](src/services/DataService.ts:1): (Keine Änderungen in diesem Schritt, da Accounts/AccountGroups über TenantDbService laufen)
- [x] [`src/stores/tenantStore.ts`](src/stores/tenantStore.ts:1): Ruft `WebSocketService.requestInitialData()` nach erfolgreicher Aktivierung eines Mandanten auf.
- [x] [`src/services/TenantDbService.ts`](src/services/TenantDbService.ts:1): Erweitert um `getPendingSyncEntries` und `updateSyncQueueEntryStatus` für die Verarbeitung der Sync Queue. (Keine Änderung in diesem Schritt)
- [x] [`src/stores/accountStore.ts`](src/stores/accountStore.ts:1): LWW-Logik implementiert: `updated_at` wird bei lokalen Änderungen gesetzt und bei Backend-Nachrichten (`fromSync`) für Konfliktlösung verglichen. Bestehende Logik ist ausreichend für initialen Daten-Load.
- [x] [`src/stores/webSocketStore.ts`](src/stores/webSocketStore.ts:1): Dient zur Überprüfung des Online-/Offline-Status. (Keine Änderung in diesem Schritt, wird aber vom WebSocketService genutzt)
- [x] [`src/services/WebSocketService.ts`](src/services/WebSocketService.ts:1): Erweitert um `requestInitialData`-Methode und Verarbeitung von `InitialDataLoadMessage` zur Aktualisierung der Stores mit initialen Daten.
- [ ] [`src/main.ts`](src/main.ts:1): Initialisiert den WebSocketService und reagiert auf Tenant-Änderungen. (Hier sollte `WebSocketService.initialize()` aufgerufen werden)
- [ ] [`src/vite-env.d.ts`](src/vite-env.d.ts): Globale Typdefinition für `window.ApexCharts` hinzugefügt.
- [x] `../FinWise_0.4_BE/app/websocket/schemas.py`: Neue WebSocket-Nachrichtentypen (`RequestInitialDataMessage`, `InitialDataPayload`, `InitialDataLoadMessage`) und `SyncOperationType.INITIAL_LOAD` hinzugefügt.
- [x] `../FinWise_0.4_BE/app/websocket/connection_manager.py`: Erweitert um `exclude_websocket` Parameter in `broadcast_json_to_tenant` und `send_personal_json_message` zur Vermeidung von Nachrichten-Loops bei der Verarbeitung von Sync-Queue-Einträgen. (Keine Änderung in diesem Schritt)
- [x] `../FinWise_0.4_BE/app/websocket/endpoints.py`: Verarbeitet `request_initial_data`-Nachrichten vom Frontend, ruft `sync_service.get_initial_data_for_tenant` auf und sendet `InitialDataLoadMessage` zurück.
- [x] `../FinWise_0.4_BE/main.py`: Hauptanwendung, in die der WebSocket-Router integriert wurde. (Keine Änderung in diesem Schritt)
- [x] `../FinWise_0.4_BE/app/models/financial_models.py`: SQLAlchemy-Modelle `Account` und `AccountGroup` angepasst (`balance`, `creditLimit` auf `Numeric`). (Keine Änderung in diesem Schritt)
- [x] `../FinWise_0.4_BE/app/crud/crud_account.py`: CRUD-Operationen angepasst, um `updated_at` aus Payloads zu übernehmen; WebSocket-Benachrichtigung an `SyncService` delegiert. (Keine Änderung in diesem Schritt)
- [x] `../FinWise_0.4_BE/app/crud/crud_account_group.py`: CRUD-Operationen angepasst, um `updated_at` aus Payloads zu übernehmen; WebSocket-Benachrichtigung an `SyncService` delegiert. (Keine Änderung in diesem Schritt)
- [x] `../FinWise_0.4_BE/app/services/sync_service.py`: LWW-Logik implementiert; neue Funktion `get_initial_data_for_tenant` hinzugefügt, um alle Accounts und AccountGroups für einen Mandanten abzurufen.
- [x] `../FinWise_0.4_BE/app/db/tenant_db.py`: `create_tenant_db_engine` und `TenantBase.metadata.create_all` sind für die dynamische Erstellung von Mandanten-DBs und Tabellen verantwortlich (verifiziert). (Keine Änderung in diesem Schritt)
- [x] [`docs/extending-synchronization.md`](docs/extending-synchronization.md:1): Dokumentation zur Erweiterung der Synchronisationsfunktion auf neue Datenmodelle.
