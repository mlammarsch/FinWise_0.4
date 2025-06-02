# Product Requirements Document: Backend-Synchronisierung für Account und AccountGroup

## 1. Introduction/Overview

**Problem:**
Derzeit gehen beim Synchronisierungsprozess zwischen dem FinWise Frontend und Backend Daten für die Entitäten `Account` und `AccountGroup` verloren oder werden inkonsistent. Dies ist darauf zurückzuführen, dass diese Entitäten im Backend nicht korrekt und vollständig in der jeweiligen mandantenspezifischen Datenbank persistiert werden. Es fehlen adäquate Datenbankmodelle und die notwendige Logik zum Schreiben, Aktualisieren, Löschen und Abrufen dieser Daten für eine bidirektionale Synchronisation.

**Ziel:**
Das Ziel dieses Features ist die Etablierung einer robusten, bidirektionalen Synchronisierung für `Account`- und `AccountGroup`-Daten zwischen dem Frontend und dem Backend. Dies soll eine sichere und korrekte Persistierung der Daten in der mandantenspezifischen Datenbank im Backend gewährleisten, um Datenkonsistenz, -integrität und -verfügbarkeit über verschiedene Geräte und Sitzungen hinweg sicherzustellen.

## 2. Goals

*   **Datenkonsistenz:** Sicherstellung, dass `Account`- und `AccountGroup`-Daten zwischen Frontend und Backend konsistent sind.
*   **Datenverfügbarkeit:** Gewährleistung, dass die synchronisierten Daten im Backend korrekt gespeichert und für den Benutzer über verschiedene Geräte zugänglich sind.
*   **Bidirektionale Synchronisation:** Implementierung eines Mechanismus, der Änderungen sowohl vom Frontend zum Backend als auch vom Backend zum Frontend synchronisiert.
*   **Synchronisation von Löschvorgängen:** Korrekte Verarbeitung und Synchronisation von Löschvorgängen für `Account`- und `AccountGroup`-Entitäten.
*   **Zuverlässige Persistenz:** Implementierung der Logik zur dauerhaften Speicherung der Entitäten in den mandantenspezifischen SQLite-Datenbanken im Backend.
*   **Fehlerbehandlung:** Implementierung einer grundlegenden Fehlerbehandlung und Protokollierung für den Synchronisationsprozess.

## 3. User Stories

*   "Als Benutzer möchte ich bei einer Onlineverbindung eine sichere und automatische bidirektionale Synchronisation meiner `Account`- und `AccountGroup`-Daten zwischen Frontend und Backend sicherstellen, damit meine Finanzdaten auf allen meinen Geräten konsistent und aktuell sind."
*   "Als Benutzer möchte ich, dass Änderungen (Erstellung, Aktualisierung, Löschung) an meinen Konten (`Account`) und Kontogruppen (`AccountGroup`), die ich im Frontend vornehme, zuverlässig mit dem Backend synchronisiert werden."
*   "Als Benutzer möchte ich, dass Änderungen an meinen `Account`- und `AccountGroup`-Daten, die möglicherweise durch eine andere Instanz der Anwendung oder direkt im Backend (zukünftige Szenarien) erfolgen, zurück auf mein aktuell genutztes Frontend synchronisiert werden."
*   "Als Benutzer erwarte ich, dass gelöschte Konten oder Kontogruppen auch nach einer Synchronisation auf anderen Geräten nicht mehr erscheinen."

## 4. Functional Requirements

### 4.1. Backend Datenbankmodelle (SQLModel)

Die Backend-Datenbankmodelle für `Account` und `AccountGroup` müssen in `../FinWise_0.4_BE/app/models/schemas.py` definiert oder überarbeitet werden. Sie sollen SQLModel verwenden und die Felder aus `src/types/index.ts` widerspiegeln.

**Account Modell (Beispielhafte Struktur basierend auf `src/types/index.ts`):**
*   `id: str` (Primary Key, UUID vom Frontend)
*   `created_at: datetime`
*   `updated_at: datetime`
*   `name: str`
*   `description: Optional[str]`
*   `note: Optional[str]`
*   `account_type: str` (Enum-Mapping von `AccountType`)
*   `is_active: bool`
*   `is_offline_budget: bool`
*   `account_group_id: str` (Foreign Key zu `AccountGroup.id`)
*   `sort_order: int`
*   `iban: Optional[str]`
*   `balance: float` (oder `Decimal` für Genauigkeit)
*   `credit_limit: Optional[float]` (oder `Decimal`)
*   `offset_balance: float` (Mapping von `offset` aus Frontend, ggf. Umbenennung zur Klarheit)
*   `image: Optional[str]`
*   `deleted_at: Optional[datetime]` (Für Soft Deletes, um Löschvorgänge bidirektional zu synchronisieren)
*   `tenant_id: str` (Falls nicht implizit durch die mandantenspezifische DB abgedeckt, zur Sicherheit explizit führen)

**AccountGroup Modell (Beispielhafte Struktur basierend auf `src/types/index.ts`):**
*   `id: str` (Primary Key, UUID vom Frontend)
*   `created_at: datetime`
*   `updated_at: datetime`
*   `name: str`
*   `sort_order: int`
*   `image: Optional[str]`
*   `deleted_at: Optional[datetime]` (Für Soft Deletes)
*   `tenant_id: str` (Falls nicht implizit durch die mandantenspezifische DB abgedeckt)

### 4.2. Backend API Endpunkte

Es müssen API-Endpunkte (FastAPI) für die Synchronisation von `Account` und `AccountGroup` implementiert werden.

*   **`POST /sync/accounts`**:
    *   Nimmt eine Liste von `Account`-Objekten vom Frontend entgegen.
    *   Verarbeitet jede Entität:
        *   Wenn die Entität im Backend nicht existiert (basierend auf `id`), wird sie erstellt.
        *   Wenn die Entität existiert, wird sie aktualisiert, falls `updated_at` im Frontend neuer ist als im Backend.
        *   Löschmarkierungen (`deleted_at`) werden ebenfalls synchronisiert.
    *   Gibt eine Liste der verarbeiteten Entitäten mit ihrem aktuellen Backend-Status zurück.
*   **`POST /sync/accountgroups`**:
    *   Nimmt eine Liste von `AccountGroup`-Objekten vom Frontend entgegen.
    *   Verarbeitung analog zu `/sync/accounts`.
    *   Gibt eine Liste der verarbeiteten Entitäten mit ihrem aktuellen Backend-Status zurück.
*   **`GET /sync/accounts?since=<timestamp>`**:
    *   Gibt alle `Account`-Objekte zurück, die seit dem angegebenen `timestamp` (ISO 8601) im Backend erstellt, aktualisiert oder gelöscht wurden.
    *   Dies ermöglicht dem Frontend, Änderungen vom Backend abzurufen.
*   **`GET /sync/accountgroups?since=<timestamp>`**:
    *   Gibt alle `AccountGroup`-Objekte zurück, die seit dem angegebenen `timestamp` im Backend erstellt, aktualisiert oder gelöscht wurden.

### 4.3. Persistenzlogik

*   Die Logik muss sicherstellen, dass alle CRUD-Operationen (Create, Read, Update, Delete/Soft Delete) für `Account` und `AccountGroup` in der korrekten mandantenspezifischen SQLite-Datenbank unter `./tenant_databases/` ausgeführt werden.
*   Die Auswahl der korrekten Datenbank erfolgt basierend auf dem authentifizierten Mandanten des Benutzers.

### 4.4. Datenvalidierung

*   Eingehende Daten vom Frontend müssen serverseitig validiert werden (z.B. Typen, erforderliche Felder, Längenbeschränkungen), bevor sie in die Datenbank geschrieben werden. Pydantic-Modelle können hierfür verwendet werden.

### 4.5. Konfliktauflösung

*   Für die bidirektionale Synchronisation wird eine "Last Write Wins"-Strategie basierend auf dem `updated_at`-Zeitstempel verwendet. Die Entität mit dem neueren `updated_at`-Zeitstempel überschreibt die ältere Version.
*   Zeitstempel (`created_at`, `updated_at`, `deleted_at`) müssen im UTC-Format gespeichert und verglichen werden.

### 4.6. Synchronisation von Löschvorgängen

*   Löschvorgänge vom Frontend werden als Soft Delete im Backend implementiert (z.B. durch Setzen von `deleted_at`).
*   Gelöschte Entitäten (`deleted_at` ist gesetzt) werden bei `GET`-Anfragen vom Frontend berücksichtigt, damit das Frontend diese ebenfalls als gelöscht markieren kann.
*   Entitäten, die im Backend als gelöscht markiert sind, werden nicht mehr als aktive Entitäten an das Frontend gesendet, es sei denn, es wird explizit nach dem Löschstatus gefragt.

## 5. Non-Goals (Out of Scope)

*   Synchronisation anderer Entitäten als `Account` und `AccountGroup` (z.B. `Transaction`, `Category` etc. – diese folgen ggf. in separaten PRDs).
*   Komplexe Konfliktauflösungsstrategien, die über "Last Write Wins" hinausgehen (z.B. Three-Way-Merge).
*   Echtzeit-Synchronisation über WebSockets (aktuelle Implementierung basiert auf periodischen HTTP-Polls oder manuell ausgelöster Synchronisation).
*   Offline-First-spezifische Optimierungen im Backend, die über die reine Datenannahme und -bereitstellung hinausgehen.
*   Automatische Datenmigration für bereits existierende, inkonsistente Daten. Ein manueller Eingriff oder ein separates Skript könnte dafür notwendig sein.

## 6. Design Considerations (Optional)

*   Die API-Endpunkte sollten den REST-Prinzipien folgen.
*   Die Antwortzeiten der Synchronisations-Endpunkte sollten optimiert werden, um die Benutzererfahrung nicht negativ zu beeinflussen.
*   Die Struktur der JSON-Payloads für die Synchronisation sollte eng an den TypeScript-Interfaces (`src/types/index.ts`) ausgerichtet sein, um die Integration zu vereinfachen.

## 7. Technical Considerations (Optional)

*   **Datenbank:** Mandantenspezifische SQLite-Datenbanken.
*   **Backend-Framework:** FastAPI.
*   **ORM:** SQLModel (oder SQLAlchemy als Basis für SQLModel).
*   **Primärschlüssel:** Die vom Frontend generierten UUIDs (`id: string`) sollten als Primärschlüssel in den Backend-Datenbanktabellen verwendet werden, um eine eindeutige Identifizierung über Systemgrenzen hinweg zu ermöglichen.
*   **Zeitstempel:** Alle Zeitstempel (`created_at`, `updated_at`, `deleted_at`) müssen konsistent im UTC-Format behandelt und gespeichert werden.
*   **Abhängigkeiten:** Die Implementierung wird Änderungen in `../FinWise_0.4_BE/app/models/schemas.py` und wahrscheinlich neue Dateien für die Synchronisierungslogik und API-Routen erfordern.
*   **Fehlerprotokollierung:** Verwendung des bestehenden Logging-Mechanismus im Backend, um Synchronisationsfehler und wichtige Ereignisse zu protokollieren.
*   **Mandantenkontext:** Die Backend-Logik muss jederzeit den aktuellen Mandantenkontext kennen, um Operationen auf der korrekten Datenbank auszuführen. Dies wird typischerweise über das Authentifizierungstoken des Benutzers und die damit verbundene Mandantenauswahl gehandhabt.

## 8. Success Metrics

*   **Datenintegrität:** Keine gemeldeten Fälle von Datenverlust oder Inkonsistenzen für `Account` und `AccountGroup` nach der Implementierung.
*   **Synchronisationserfolgsrate:** >99.9% erfolgreiche Synchronisationszyklen (Frontend ↔ Backend).
*   **Performance:** Die durchschnittliche Antwortzeit der Synchronisations-Endpunkte liegt unter 500ms für typische Datenmengen.
*   **Benutzerfeedback:** Positive Rückmeldungen von Benutzern bezüglich der Zuverlässigkeit der Datensynchronisation.
*   **Reduktion von Supportanfragen:** Verringerung der Supportanfragen im Zusammenhang mit Datenverlust oder -inkonsistenzen bei Konten und Kontogruppen.

## 9. Open Questions

*   Gibt es eine spezifische Präferenz für den Umgang mit dem Fall, dass `updated_at`-Zeitstempel bei einer Konfliktsituation exakt identisch sind (obwohl dies unwahrscheinlich sein sollte, wenn Zeitstempel mit ausreichender Präzision generiert werden)? (Standard: Backend gewinnt oder zufällige Auswahl mit Log).
*   Welche spezifischen Fehlercodes oder -nachrichten sollen die API-Endpunkte im Fehlerfall zurückgeben?
*   Sind detaillierte Retry-Mechanismen auf Client- oder Serverseite für fehlgeschlagene Synchronisationsversuche erforderlich, oder reicht eine einfache Fehleranzeige im Frontend vorerst aus?
*   Wie soll mit potenziellen Schema-Änderungen in der Zukunft umgegangen werden, um die Abwärtskompatibilität der Synchronisation sicherzustellen? (Vorerst nicht im Scope, aber für die Zukunft relevant).
