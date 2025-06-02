# Implementierungs-Tasks für Backend-Synchronisierung: Account & AccountGroup

Basierend auf PRD: [`prd-backend-sync-account-accountgroup.md`](tasks/prd-backend-sync-account-accountgroup.md:1)

## 1. Datenbankmodelle ([`../FinWise_0.4_BE/app/models/schemas.py`](../FinWise_0.4_BE/app/models/schemas.py:1))

- [x] **Task 1.1: `Account`-Modell definieren/aktualisieren**
    - Referenz: PRD Abschnitt 4.1 (Account Modell)
    - Verwende `SQLModel`.
    - Felder implementieren:
        - `id: str` (Primary Key, UUID vom Frontend)
        - `created_at: datetime` (UTC)
        - `updated_at: datetime` (UTC)
        - `name: str`
        - `description: Optional[str]`
        - `note: Optional[str]`
        - `account_type: str` (Enum-Mapping von `AccountType` aus `src/types/index.ts`)
        - `is_active: bool`
        - `is_offline_budget: bool`
        - `account_group_id: str` (Foreign Key zu `AccountGroup.id`)
        - `sort_order: int`
        - `iban: Optional[str]`
        - `balance: float` (Überlegung: `Decimal` für Genauigkeit, siehe PRD 4.1)
        - `credit_limit: Optional[float]` (Überlegung: `Decimal` für Genauigkeit, siehe PRD 4.1)
        - `offset_balance: float` (Mapping von `offset` aus Frontend, ggf. Umbenennung, siehe PRD 4.1)
        - `image: Optional[str]`
        - `deleted_at: Optional[datetime]` (UTC, für Soft Deletes)
        - `tenant_id: str` (Zur expliziten Mandantenzuordnung)
    - Stelle sicher, dass Zeitstempel (`created_at`, `updated_at`, `deleted_at`) UTC sind.

- [ ] **Task 1.2: `AccountGroup`-Modell definieren/aktualisieren**
    - Referenz: PRD Abschnitt 4.1 (AccountGroup Modell)
    - Verwende `SQLModel`.
    - Felder implementieren:
        - `id: str` (Primary Key, UUID vom Frontend)
        - `created_at: datetime` (UTC)
        - `updated_at: datetime` (UTC)
        - `name: str`
        - `sort_order: int`
        - `image: Optional[str]`
        - `deleted_at: Optional[datetime]` (UTC, für Soft Deletes)
        - `tenant_id: str` (Zur expliziten Mandantenzuordnung)
    - Stelle sicher, dass Zeitstempel (`created_at`, `updated_at`, `deleted_at`) UTC sind.

## 2. API Endpunkte & Synchronisierungslogik (FastAPI)

### 2.1 Account Synchronisation

- [ ] **Task 2.1.1: API-Endpunkt `POST /sync/accounts` erstellen**
    - Referenz: PRD Abschnitt 4.2
    - Request Body: Liste von `Account`-Objekten (Pydantic-Modell für Validierung).
    - Implementiere Upsert-Logik:
        - Erstellen, wenn `id` nicht im Backend existiert.
        - Aktualisieren, wenn `id` existiert UND `updated_at` (Frontend) > `updated_at` (Backend) (Last Write Wins, PRD 4.5).
    - Verarbeite `deleted_at` für Soft Deletes (PRD 4.6).
    - Stelle Mandantenspezifität sicher (basierend auf authentifiziertem Benutzer, PRD 4.3, 7).
    - Implementiere Datenvalidierung für eingehende Daten (Pydantic, PRD 4.4).
    - Rückgabe: Liste der verarbeiteten Entitäten mit aktuellem Backend-Status.
    - Fehlerbehandlung und Logging implementieren (PRD 2, 7).

- [ ] **Task 2.1.2: API-Endpunkt `GET /sync/accounts?since=<timestamp>` erstellen**
    - Referenz: PRD Abschnitt 4.2
    - Parameter `since`: ISO 8601 Timestamp.
    - Gebe alle `Account`-Objekte (inkl. Soft Deletes, d.h. `deleted_at` ist gesetzt) zurück, deren `updated_at` oder `created_at` neuer oder gleich `since` ist.
    - Stelle Mandantenspezifität sicher (PRD 4.3, 7).
    - Fehlerbehandlung und Logging implementieren (PRD 2, 7).

### 2.2 AccountGroup Synchronisation

- [ ] **Task 2.2.1: API-Endpunkt `POST /sync/accountgroups` erstellen**
    - Referenz: PRD Abschnitt 4.2
    - Request Body: Liste von `AccountGroup`-Objekten (Pydantic-Modell für Validierung).
    - Implementiere Upsert-Logik (analog zu Task 2.1.1, Last Write Wins, PRD 4.5).
    - Verarbeite `deleted_at` für Soft Deletes (PRD 4.6).
    - Stelle Mandantenspezifität sicher (PRD 4.3, 7).
    - Implementiere Datenvalidierung für eingehende Daten (Pydantic, PRD 4.4).
    - Rückgabe: Liste der verarbeiteten Entitäten mit aktuellem Backend-Status.
    - Fehlerbehandlung und Logging implementieren (PRD 2, 7).

- [ ] **Task 2.2.2: API-Endpunkt `GET /sync/accountgroups?since=<timestamp>` erstellen**
    - Referenz: PRD Abschnitt 4.2
    - Parameter `since`: ISO 8601 Timestamp.
    - Gebe alle `AccountGroup`-Objekte (inkl. Soft Deletes) zurück, deren `updated_at` oder `created_at` neuer oder gleich `since` ist.
    - Stelle Mandantenspezifität sicher (PRD 4.3, 7).
    - Fehlerbehandlung und Logging implementieren (PRD 2, 7).

## 3. Allgemeine Backend-Logik & Persistenz

- [ ] **Task 3.1: Implementiere "Last Write Wins"-Konfliktauflösung**
    - Referenz: PRD Abschnitt 4.5
    - Basis: `updated_at`-Zeitstempel.
    - Stelle sicher, dass alle Zeitstempelvergleiche korrekt in UTC erfolgen.

- [ ] **Task 3.2: Stelle UTC für alle Zeitstempel sicher**
    - Referenz: PRD Abschnitt 4.5, 7
    - Gilt für `created_at`, `updated_at`, `deleted_at` in Datenbankmodellen und bei der Verarbeitung.

- [ ] **Task 3.3: Implementiere Fehlerbehandlung und Logging**
    - Referenz: PRD Abschnitt 2, 7
    - Nutze den bestehenden Logging-Mechanismus im Backend.
    - Protokolliere wichtige Synchronisationsereignisse und Fehler.
    - Definiere ggf. spezifische Fehlercodes/-nachrichten für API-Antworten (siehe PRD 9 - Open Questions).

- [ ] **Task 3.4: Mandantenspezifische Datenbankinteraktion**
    - Referenz: PRD Abschnitt 4.3, 7
    - Stelle sicher, dass alle DB-Operationen (CRUD) in der korrekten mandantenspezifischen SQLite-Datenbank unter `./tenant_databases/` ausgeführt werden.
    - Die Auswahl der DB basiert auf dem authentifizierten Mandanten.

- [ ] **Task 3.5: Primärschlüssel-Handhabung**
    - Referenz: PRD Abschnitt 7
    - Verwende die vom Frontend generierten UUIDs (`id: string`) als Primärschlüssel in den Backend-Tabellen.

## 4. Tests (Optional, aber empfohlen)

- [ ] **Task 4.1: Unit-Tests für Datenbankmodelle und Validierung erstellen.**
- [ ] **Task 4.2: Integrationstests für API-Endpunkte erstellen.**
    - Teste Erstellung, Aktualisierung, Soft Delete.
    - Teste `GET ...?since=` Funktionalität.
    - Teste Mandantentrennung.
    - Teste Konfliktauflösung ("Last Write Wins").
    - Teste Fehlerfälle und Validierung.

## 5. Dokumentation

- [ ] **Task 5.1: API-Endpunkte dokumentieren (z.B. in OpenAPI/Swagger).**
- [ ] **Task 5.2: Interne Code-Kommentare für komplexe Logikabschnitte hinzufügen.**
