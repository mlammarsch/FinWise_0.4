## Relevant Files

- **WebSocket-Stabilisierung**
  - `src/services/WebSocketService.ts` - Hauptdatei für die Implementierung des Heartbeats und der Exponential-Backoff-Logik.
  - `src/services/WebSocketService.test.ts` - (Annahme) Testdatei zur Validierung der neuen Verbindungsstabilität.
  - `app/websocket/connection_manager.py` - Backend-Gegenstück, liefert Kontext für Intervalle (keine Änderungen erforderlich).

- **Bildverarbeitung (Backend)**
  - `app/api/v1/endpoints/logos.py` - (Neu) Endpunkte für Bild-Upload (`POST`) und -Löschung (`DELETE`).
  - `app/services/image_service.py` - (Neu) Service für die Bildlogik (Validierung, Skalierung mit Pillow, Speicherung).
  - `app/services/file_service.py` - Service für die Logo-Speicherung und -Löschung.
  - `app/models/financial_models.py` - Anpassung der SQLAlchemy-Modelle (z.B. `Account`, `AccountGroup`), um `logo_path` zu verwenden.
  - `app/api/deps.py` - Zum Extrahieren der Mandanten-ID aus dem Benutzer-Token.

- **Bildverarbeitung (Frontend)**
  - `src/types/index.ts` - Anpassung der TypeScript-Interfaces, um `logoPath` zu verwenden.
  - `src/components/account/AccountForm.vue` - (Annahme) Implementierung der Upload/Delete-Logik.
  - `src/components/account/AccountGroupForm.vue` - (Annahme) Implementierung der Upload/Delete-Logik.
  - `src/components/account/AccountCard.vue` - Anpassung der Bildanzeige, um `logoPath` zu nutzen.
  - `src/components/account/AccountGroupCard.vue` - (Annahme) Anpassung der Bildanzeige.
  - `src/services/apiService.ts` - (Annahme) Erweiterung um API-Aufrufe für Upload/Delete.

- **Frontend-Caching**
  - `src/services/TenantDbService.ts` - Implementierung der Caching-Logik für Bilder in IndexedDB.
  - `src/services/SessionService.ts` - (Annahme) Logik zum Befüllen des Caches beim Login/Mandantenwechsel.

### Notes

- Gemäß PRD sollen für Anforderung 1 **ausschließlich** Änderungen in `src/services/WebSocketService.ts` vorgenommen werden.
- Die Bildverarbeitung erfordert neue Backend-Endpunkte und -Services sowie Anpassungen an bestehenden Modellen.
- Das Frontend-Caching ist ein entscheidender Schritt, um die Performance zu verbessern und unnötige Netzwerk-Anfragen zu vermeiden.

## Tasks

- [x] 1.0 Anforderung 1: WebSocket-Verbindung stabilisieren
  - [x] 1.1 In `WebSocketService.ts` Konstanten für `RECONNECT_INITIAL_INTERVAL` (1000ms) und `RECONNECT_MAX_INTERVAL` (30000ms) definieren.
  - [x] 1.2 `handleReconnection()`-Logik durch eine Exponential-Backoff-Strategie ersetzen, die das Intervall bei jedem Versuch verdoppelt.
  - [x] 1.3 Zähler für `reconnectAttempts` bei erfolgreicher Verbindung (`onopen`) zurücksetzen.
  - [x] 1.4 Eine `pingIntervalId`-Variable für den Heartbeat-Timer hinzufügen.
  - [x] 1.5 Methoden `startPingInterval()` und `stopPingInterval()` implementieren, um `sendPing()` alle 20 Sekunden aufzurufen.
  - [x] 1.6 Den Heartbeat-Mechanismus in den Verbindungs-Lebenszyklus integrieren (`onopen`, `onclose`, `disconnect`).
  - [x] 1.7 Detailliertes Logging für Verbindungsstatus, Fehler, Reconnect-Versuche und Ping/Pong-Events hinzufügen.

- [x] 2.0 Anforderung 2: Backend für Bildverarbeitung implementieren
  - [x] 2.1 Neuen API-Router unter `app/api/v1/` für Bild-Endpunkte erstellen.
  - [x] 2.2 `POST /api/v1/images/upload`-Endpunkt implementieren, der die Mandanten-ID aus dem Token extrahiert.
  - [x] 2.3 Im Upload-Endpunkt eine Validierung für den Content-Type (`image/jpeg`, `image/png`) hinzufügen.
  - [x] 2.4 Im Upload-Endpunkt (`logos.py`) das Bild mit Pillow auf 128x128px skalieren und als PNG im Verzeichnis `static/images/{tenantId}/` speichern (Skalierung mit Pillow noch nicht implementiert).
  - [x] 2.5 `DELETE /api/v1/logos/delete`-Endpunkt implementieren, der ein Bild anhand seines Pfades sicher löscht (Löschlogik "nur wenn keine Entität mehr darauf verweist" noch nicht implementiert).
  - [x] 2.6 In den SQLAlchemy-Modellen (`financial_models.py`) das Feld `image` entfernen (beide Felder `image` und `logo_path` existieren derzeit).
  - [x] 2.7 Pydantic-Schemas anpassen, um `logo_path` statt `image` in den Base-Schemas zu verwenden.

- [ ] 3.0 Anforderung 2: Frontend für Bild-Upload und -Anzeige anpassen
  - [ ] 3.1 TypeScript-Interfaces (z.B. `Account`, `AccountGroup`) um das Feld `logoPath: string | null` erweitern.
  - [ ] 3.2 In den Formular-Komponenten (`AccountForm`, `AccountGroupForm`) eine UI für den Bild-Upload und die -Löschung erstellen.
  - [ ] 3.3 Die Upload/Delete-Logik implementieren, die die neuen Backend-Endpunkte aufruft und den `logoPath` im entsprechenden Store aktualisiert.
  - [ ] 3.4 Anzeige-Komponenten (`AccountCard`, `AccountGroupCard`) anpassen, um das Bild über den `logoPath` zu laden und anzuzeigen.

- [ ] 4.0 Anforderung 2: Frontend-Caching für Bilder implementieren
  - [ ] 4.1 In `TenantDbService.ts` das IndexedDB-Schema um eine `logoCache`-Tabelle (`{path: string, data: string | Blob}`) erweitern.
  - [ ] 4.2 In `TenantDbService.ts` die Methoden `cacheLogo(path, data)` und `getLogoFromCache(path)` implementieren.
  - [ ] 4.3 Die Login/Mandantenwechsel-Logik (`SessionService.ts`) erweitern, um alle `logoPath`-Pfade zu sammeln, die Bilder vom Backend zu laden und im `logoCache` zu speichern.
  - [ ] 4.4 Die Logik der Anzeige-Komponenten anpassen, sodass sie zuerst den `logoCache` abfragen, bevor sie eine Netzwerkanfrage an das Backend sendet.

- [ ] 5.0 Aufräumen und Schema-Bereinigung
  - [ ] 5.1 Im gesamten Backend alle alten, nicht mehr verwendeten Bildfelder (z.B. `image`, `logoUrl`) aus Modellen und Schemas entfernen.
  - [ ] 5.2 Im gesamten Frontend alle alten, nicht mehr verwendeten Bild-Props und Variablen aus Interfaces und Komponenten entfernen.
  - [ ] 5.3 Code-Review durchführen, um sicherzustellen, dass alle Teile der Anwendung die neue `logoPath`-Logik konsistent verwenden.
