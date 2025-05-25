# Planung: FinWise 0.4 - User- und Mandanten-Architektur

Dieses Dokument beschreibt die Planung für die User- und Mandanten-Architektur im FinWise 0.4 Backend.

## 1. Übersicht der API-Endpunkte

Die folgenden API-Endpunkte werden für die Verwaltung von Benutzern und Mandanten implementiert:

*   **Benutzerverwaltung:**
    *   `POST /users`: Erstellt einen neuen Benutzer.
    *   `GET /users`: Ruft eine Liste aller Benutzer ab (ggf. später mit Paginierung und Filterung).
*   **Mandantenverwaltung:**
    *   `POST /tenants`: Erstellt einen neuen Mandanten für den authentifizierten Benutzer.
    *   `GET /tenants`: Ruft eine Liste der Mandanten ab, auf die der authentifizierte Benutzer Zugriff hat.
    *   `DELETE /tenants/{id}`: Löscht einen Mandanten anhand seiner UUID.

**Hinweis:** Alle UUIDs (für Benutzer und Mandanten) werden serverseitig bei der Erstellung generiert und als String zurückgegeben.

## 2. Beschreibung der Datenbankarchitektur

Die Datenbankarchitektur ist zweigeteilt, um eine klare Trennung zwischen Benutzerinformationen und mandantenspezifischen Daten zu gewährleisten.

### Zentrale User-Datenbank (`users.db`)

Diese SQLite-Datenbank speichert alle globalen Benutzer- und Mandanteninformationen.

*   **Tabelle `users`:**
    *   `uuid` (TEXT, PRIMARY KEY): Eindeutige ID des Benutzers (serverseitig generierte UUID v4).
    *   `name` (TEXT, NOT NULL): Name des Benutzers.
    *   `email` (TEXT, UNIQUE, NOT NULL): E-Mail-Adresse des Benutzers (dient auch als Login-Name).
    *   `hashed_password` (TEXT, OPTIONAL): Gehashtes Passwort des Benutzers. Optional, falls z.B. externe OAuth-Provider genutzt werden oder für initialen Setup ohne Passwort.

*   **Tabelle `tenants`:**
    *   `uuid` (TEXT, PRIMARY KEY): Eindeutige ID des Mandanten (serverseitig generierte UUID v4).
    *   `name` (TEXT, NOT NULL): Name des Mandanten (frei wählbar durch den Benutzer).
    *   `user_id` (TEXT, NOT NULL, FOREIGN KEY REFERENCES `users`(`uuid`)): UUID des Benutzers, dem dieser Mandant gehört.

### Mandantendatenbanken

Für jeden erstellten Mandanten wird dynamisch eine separate SQLite-Datenbankdatei angelegt.

*   **Dateiname:** `tenant_<tenant_uuid>.db` (z.B. `tenant_a1b2c3d4-e5f6-7890-1234-567890abcdef.db`).
*   **Speicherort:** In einem dedizierten Verzeichnis auf dem Server (z.B. `data/tenant_databases/`).
*   **Schema:** Bei der Erstellung einer neuen Mandantendatenbank wird **kein** automatischer Initialimport eines vordefinierten Schemas durchgeführt. Das Schema (Tabellen, Spalten etc.) wird erst durch die Anwendung selbst oder durch spätere Migrationsschritte (z.B. via Alembic, falls für Mandantendatenbanken vorgesehen) definiert und erstellt, wenn Datenoperationen für diesen Mandanten stattfinden.

## 3. Konzept für Datenbanktrennung und dynamisches Routing

FastAPI wird Anfragen so verarbeiten, dass sie basierend auf dem Mandanten-Kontext an die korrekte Mandantendatenbank (`tenant_<uuid>.db`) weitergeleitet werden.

*   **Mandanten-Identifikation:** Der aktive Mandant wird typischerweise über einen JWT (JSON Web Token) oder einen HTTP-Header (z.B. `X-Tenant-ID`) in der Anfrage identifiziert. Nach der Benutzerauthentifizierung und Mandantenauswahl (falls ein Benutzer mehrere Mandanten hat) wird die `tenant_uuid` für nachfolgende Anfragen im Token oder Header mitgesendet.
*   **Dynamische Datenbankverbindung:**
    1.  Eine Middleware oder ein Dependency-Injector in FastAPI extrahiert die `tenant_uuid` aus der Anfrage.
    2.  Basierend auf dieser `tenant_uuid` wird der Pfad zur entsprechenden `tenant_<tenant_uuid>.db` Datei konstruiert.
    3.  SQLAlchemy (oder ein anderer ORM/DB-Connector) wird so konfiguriert, dass es dynamisch eine Verbindung zu dieser spezifischen Datenbankdatei herstellt. Dies kann über eine Funktion geschehen, die eine Engine oder Session für die angeforderte Mandantendatenbank zurückgibt.
    4.  Wenn eine `tenant_<uuid>.db` Datei für einen gültigen Mandanten (gemäß `users.db`) noch nicht existiert, wird sie bei der ersten schreibenden Operation oder explizit bei der Mandantenerstellung (als leere Datei) angelegt.
*   **Sicherheit:** Es muss sichergestellt werden, dass Benutzer nur auf die Mandantendatenbanken zugreifen können, für die sie autorisiert sind (Abgleich `user_id` aus dem Token mit `user_id` in der `tenants`-Tabelle der `users.db`).

## 4. Synchronisierungsstrategie (Frontend → API → SQLite)

Die Synchronisierung der Daten zwischen dem Frontend (IndexedDB) und dem Backend (FastAPI/SQLite) erfolgt asynchron.

*   **Frontend-Caching:** Das Frontend (Vue.js-Anwendung) nutzt IndexedDB (z.B. über eine Bibliothek wie Dexie.js) als lokalen Cache. Alle Datenänderungen werden primär in IndexedDB geschrieben, um eine Offline-Fähigkeit und eine schnelle UI-Reaktion zu gewährleisten.
*   **Expliziter Push/Pull:** Die Synchronisation mit der API wird nicht kontinuierlich im Hintergrund, sondern durch explizite Benutzeraktionen (z.B. einen "Synchronisieren"-Button) oder periodisch (z.B. alle X Minuten, wenn online) ausgelöst.
    *   **Push:** Das Frontend sendet lokale Änderungen (neue, geänderte, gelöschte Datensätze) an die API.
    *   **Pull:** Das Frontend fordert aktuelle Daten von der API an, um den lokalen Cache zu aktualisieren.
*   **Zeitstempelbasierter Vergleich (Konzept für spätere Implementierung):**
    *   Jeder Datensatz (sowohl in IndexedDB als auch in den SQLite-Datenbanken) erhält Zeitstempel für Erstellung (`created_at`) und letzte Änderung (`updated_at`).
    *   Beim Synchronisieren werden diese Zeitstempel verglichen, um festzustellen, welche Datensätze übertragen oder aktualisiert werden müssen.
    *   Das Frontend sendet nur Daten, die neuer sind als der letzte bekannte Synchronisationszeitpunkt des Servers für diesen Client/Mandanten.
    *   Der Server sendet nur Daten an das Frontend, die neuer sind als der letzte bekannte Synchronisationszeitpunkt des Frontends.
*   **Konfliktauflösung:** In dieser ersten Ausbaustufe (FinWise 0.4) ist **keine** automatische Konfliktauflösung vorgesehen. Es gilt das "Last Write Wins"-Prinzip oder die Synchronisation wird bei Konflikten mit einer Fehlermeldung abgebrochen, die den Benutzer zur manuellen Klärung auffordert. Eine detaillierte Konfliktauflösungsstrategie (z.B. CRDTs oder manuelle Merge-Interfaces) ist für spätere Versionen geplant.

## 5. Testkonzept mit Coverage-Zielen

Ein umfassendes Testkonzept ist entscheidend für die Stabilität und Zuverlässigkeit des Backends.

*   **Unit-Tests:**
    *   **API-Endpunkte:** Testen der Logik jedes Endpunkts (`/users`, `/tenants`, etc.) mit verschiedenen Eingaben (gültig, ungültig, Grenzfälle). Mocking von Abhängigkeiten (z.B. Datenbankinteraktionen, Authentifizierung).
    *   **Datenbankerzeugung:** Tests, die sicherstellen, dass die `users.db` korrekt initialisiert wird und dass `tenant_<uuid>.db` Dateien bei Bedarf korrekt erstellt werden.
    *   **Mandantentrennung:** Tests, die verifizieren, dass Anfragen für einen Mandanten A keine Daten von Mandant B lesen oder schreiben können. Überprüfung der dynamischen Datenbankverbindungslogik.
    *   **Authentifizierung und Autorisierung:** Tests für Login, Token-Generierung und Zugriffsberechtigungen auf Mandanten.
*   **Integrationstests:**
    *   Testen des Zusammenspiels mehrerer Komponenten, z.B. API-Aufruf → Authentifizierung → Datenbankzugriff → Antwort.
*   **Testumgebung:**
    *   Verwendung von SQLite In-Memory-Datenbanken (`sqlite:///:memory:`) für schnelle und isolierte Testläufe. Dies beschleunigt die Ausführung der Tests erheblich, da keine Datei-I/O stattfindet.
    *   Für Tests, die die tatsächliche Dateierstellung von `tenant_<uuid>.db` prüfen, können temporäre Dateien verwendet werden, die nach dem Testlauf wieder gelöscht werden.
*   **Test-Framework:** Pytest wird als primäres Test-Framework verwendet, ggf. mit Erweiterungen wie `pytest-asyncio` für asynchronen Code und `httpx.AsyncClient` für API-Tests.
*   **Coverage-Ziel (angestrebt):** Ein Code-Coverage-Ziel von **mindestens 80%** wird angestrebt. Dies soll sicherstellen, dass ein Großteil des Codes durch Tests abgedeckt ist. Die Coverage wird regelmäßig überprüft (z.B. mit `coverage.py`).
