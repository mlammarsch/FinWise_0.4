```markdown
# Product Requirements Document (PRD): WebSocket-Stabilität & Bildverarbeitung

## 1. Einleitung

Dieses Dokument beschreibt Anforderungen, Spezifikationen und konkrete Aufgaben für zwei zentrale Bereiche der FinWise-Anwendung:

- **Stabilisierung der WebSocket-Verbindung**
- **Implementierung einer durchgängigen, robusten Bildverarbeitung**

Ziel: **Stabilität, Sicherheit und Performance** der Anwendung erhöhen, insbesondere bei Echtzeit-Synchronisation und der Verwaltung von Benutzerbildern (Logos).

---

## 2. Anforderung 1: Stabile WebSocket-Verbindung (Priorität 1)

### 2.1 Problembeschreibung

Die aktuelle WebSocket-Implementierung (siehe `@src/services/WebSocketService.ts` und Backend `@app/websocket/connection_manager.py`) leidet unter folgenden Schwächen:

- **Fehlender Heartbeat-Mechanismus:** Kein regelmäßiges Ping/Pong. Tote Verbindungen werden zu spät erkannt.
- **Ineffiziente Reconnect-Logik:** Statische, aggressive Reconnect-Schleife (fester 5-Sekunden-Intervall) ohne Rücksicht auf Backend-Überlast.
- **Serverseitige Timeouts:** Das Backend schließt Verbindungen nach 10 Sekunden ohne Pong.

Diese Mängel führen zu Verbindungsabbrüchen und schlechter Nutzererfahrung.

### 2.2 Technische Spezifikationen

- **Analyse:** Untersuchung der Kette Frontend ↔ Backend auf Ursachen für Abbrüche und Timeouts.
- **Heartbeat-Mechanismus:** Regelmäßiges Ping/Pong, 20 Sekunden-Intervall im Frontend (siehe Vorschlag Debug-Report).
- **Exponential Backoff:** Dynamisches Reconnect-Intervall mit steigender Wartezeit bei Fehlern (max. 30 Sekunden).
- **Logging:** Detailliertes Protokollieren aller Status- und Fehlerzustände (Frontend: `WebSocketService.ts`, Backend: `connection_manager.py`).
- **Synchronisierung der Timeout-/Heartbeat-Intervalle zwischen Frontend und Backend.**

### 2.3 Debug-Erkenntnisse & konkrete Code-Hinweise

#### Identifizierte Code-Stellen:

- **Frontend:**
  - `@src/services/WebSocketService.ts`
    - Zeile 16: RECONNECT_INTERVAL → ersetzen durch Initial/Max-Intervalle
    - Zeile 538: handleReconnection() → Logik ersetzen
    - Zeile 634: sendPing() → regelmäßig aufrufen

- **Backend:**
  - `@app/websocket/connection_manager.py`
    - Zeile 14: self.ping_interval (Frontend muss Wert kennen und synchronisieren)
    - Zeile 15: self.ping_timeout

#### Maßnahmen laut Debug-Bericht:

- **Heartbeat:**
  - Variable `private pingIntervalId: NodeJS.Timeout | null = null;` hinzufügen.
  - Methoden `startPingInterval()` und `stopPingInterval()` implementieren.
  - `startPingInterval()` in `socket.onopen`, `stopPingInterval()` in `disconnect()` und `socket.onclose`.
  - Heartbeat alle 20 Sekunden.

- **Exponential Backoff:**
  - Konstanten: `RECONNECT_INITIAL_INTERVAL = 1000;`, `RECONNECT_MAX_INTERVAL = 30000;`
  - Dynamisches Intervall in `handleReconnection()` mit Exponentialfaktor (Verdopplung pro Fehlversuch, max. 30s).
  - Rücksetzen von `reconnectAttempts` bei erfolgreicher Verbindung (`socket.onopen`).

#### Wichtige Anweisung zur Umsetzung

**Ändere ausschließlich** die Datei `@src/services/WebSocketService.ts` gemäß den obigen Punkten.
Beende die Aufgabe mit `attempt_completion` und dokumentiere die Änderungen.

---

## 3. Anforderung 2: Umfassende Bildverarbeitung (Priorität 2)

### 3.1 Problembeschreibung

Die Bildverarbeitung (Logo-Handling für Konten/Kontengruppen) ist:

- **Nicht mandantenfähig:** Keine saubere Tenant-Trennung (Verzeichnisstruktur).
- **Unsicher/Inkonsistent:** Feldnamen und Speicherorte unterschiedlich, Löschvorgänge unklar.
- **Kein durchgängiges Caching:** Performance-Probleme bei Anzeige und Sync.

### 3.2 Technische Spezifikationen

#### Speicherort & Mandantenfähigkeit

- **Verzeichnis:** Serverseitig `static/images/{tenantId}/`
- **Mandanten-ID:** Aus Benutzer-Token im Backend extrahieren (`@app/api/deps.py`)
- **API-Endpunkte:**
  - **Upload:** `POST /api/v1/logos/upload`
  - **Delete:** `DELETE /api/v1/logos/logos/{logo_path}`

#### Feldnamen-Konvention

- **Backend:** SQLAlchemy-Modelle: `logo_path`
- **Pydantic-Schema:** `logo_path`
- **Frontend-Interface:** TypeScript: `logoPath`
- **Frontend-Komponenten:** Props/Variablen: `logoPath` oder `logoUrl` (für Bildpfad)

#### Upload-Prozess

- **Validierung (Frontend):** Nur `image/jpeg`, `image/png` zulassen
- **Validierung (Backend):** Prüfung des Content-Types
- **Konvertierung:** Serverseitig mit Pillow auf 128x128px, als PNG speichern
- **Status:** Skalierung auf 128x128px ist noch nicht implementiert

#### Lösch-Prozess

- **API:** `DELETE /api/v1/logos/logos/{logo_path}`
- **Logik:** Bild wird über Pfadangabe gelöscht, nur wenn keine Entität mehr referenziert
- **Status:** Logik "nur wenn keine Entität mehr referenziert" ist noch nicht implementiert

#### Datenbank

- **Speicherung:** Relativer Pfad (`static/images/{tenantId}/xyz.png`)

#### Frontend-Caching & Anzeige

- **Cache-Befüllung:** Beim Login/Mandantenwechsel werden alle `logoPath`-Pfade abgerufen, Bilder geladen und als Base64 oder Blob in IndexedDB (`logoCache`-Tabelle, Schlüssel = Pfad) abgelegt.
- **Anzeige:** Komponenten prüfen erst den Cache, greifen nur bei Fehlen aufs Backend zu.
- **Komponenten-Anpassung:** `AccountCard`, `AccountForm`, `AccountGroupCard`, `AccountGroupForm` → nutzen neue Logik & Cache

#### Schema-Bereinigung

- **Entfernung alter Felder:** Überall alte Felder wie `image`, `logoUrl` entfernen

---

### 3.3 Subtask-Aufteilung

#### Subtask 2.1: Backend- und Frontend-Anpassungen

**Backend:**
- Modelle (`@app/models/financial_models.py`): Feld `image` o.ä. in `logo_path` umbenennen
- Router `logos` unter `@app/api/v1/` (bereits implementiert)
- Upload-API (bereits implementiert, aber Skalierung auf 128x128px fehlt noch)
- Delete-API (bereits implementiert, aber Referenzprüfung fehlt noch)

**Frontend:**
- TypeScript-Interfaces (`logoPath: string | null`)
- Upload-/Delete-Logik in `AccountForm`, `AccountGroupForm` (`logoPath` speichern/aktualisieren)
- Anzeige-Komponenten (`AccountCard`, `AccountGroupCard`) passen Bild-Rendering an

#### Subtask 2.2: Frontend-Caching

- **TenantDbService (`@src/services/TenantDbService.ts`):**
  - Methoden `cacheLogo`, `getLogoFromCache` ergänzen
- **Login-/Mandantenwechsel-Logik (z.B. `SessionService.ts`):**
  - Alle Pfade sammeln, Bilder laden, Cache befüllen
- **Komponenten-Logik:**
  - Erst Cache, dann Netzwerk

---

## 4. Abschlusskriterien / attempt_completion

- Umsetzung der **WebSocket-Stabilisierung** laut Debug-Report (nur in `@src/services/WebSocketService.ts`).
- Backend-/Frontend-Implementierung der **Bildverarbeitung** (Upload, Delete, Pfade, Mandantenfähigkeit, Cache).
- Alle Änderungen, Pfad-/Dateinamen und Logik im Code sowie in der Datenhaltung dokumentieren.
- **Dokumentation** aller finalen Endpunkte, Komponenten und geänderten Schnittstellen.
```
