# Taskliste: Konten- und Kontogruppen-Synchronisation

Basierend auf: [tasks/prd-konten-gruppen-synchronisation.md](tasks/prd-konten-gruppen-synchronisation.md)

## 1. Introduction/Overview

**Problem:** Aktuell erfolgt die Synchronisation von Konten (`account`) und Kontogruppen (`accountGroup`) nur über die `syncQueue`, wenn das Backend offline ist. Bei einer Online-Verbindung wird die direkte Synchronisation über die API zwar geloggt ("noch nicht implementiert"), aber nicht durchgeführt.

**Goal:** Implementierung der direkten Online-Synchronisation für neu angelegte oder geänderte Konten (`account`) und Kontogruppen (`accountGroup`) zwischen Frontend und Backend. Die Synchronisation soll asynchron erfolgen, um die Frontend-Performance nicht zu beeinträchtigen. Die `syncQueue` soll nur noch im Offline-Betrieb genutzt werden.

## 2. Goals

*   Ermöglichen der sofortigen Synchronisation von Konten und Kontogruppen bei bestehender Online-Verbindung zum Backend.
*   Sicherstellen, dass die Synchronisation asynchron verläuft, um das Frontend nicht zu blockieren.
*   Reduzierung der Abhängigkeit von der `syncQueue` auf reine Offline-Szenarien.
*   Bereitstellung der notwendigen Backend-Endpunkte für `account` und `accountGroup`.
*   Anpassung des Frontends zur Nutzung der neuen Online-Synchronisationslogik.

## 3. User Stories

*   "Als Benutzer möchte ich, dass meine neu angelegten oder geänderten Konten sofort mit dem Backend synchronisiert werden, sofern eine Online-Verbindung (z.B. über WebSocket) besteht, damit ich von allen Geräten auf die aktuellen Daten zugreifen kann."
*   "Als Benutzer möchte ich, dass meine neu angelegten oder geänderten Kontogruppen sofort mit dem Backend synchronisiert werden, sofern eine Online-Verbindung besteht, damit die Struktur meiner Finanzen auf allen Geräten konsistent ist."
*   "Als Benutzer möchte ich, dass die Synchronisation im Hintergrund geschieht, ohne die Bedienbarkeit der Anwendung zu verlangsamen."
*   "Als Benutzer möchte ich, dass im Offline-Zustand weiterhin die `syncQueue` verwendet wird, um Datenverlust zu vermeiden."

## 4. Functional Requirements & Implementation Tasks

### 4.1. Backend-Entwicklung (FastAPI)
Pfad-Präfix für Backend-Dateien: `../FinWise_0.4_BE/`

1.  **API-Endpunkte für `account` erstellen**
    1.1. [ ] Endpunkt für `POST /api/v1/accounts` (Erstellen eines Kontos) (K: 8)
        1.1.1. [ ] Pydantic-Modell für Request-Body definieren/verwenden (in `app/models/schemas.py` oder `app/models/account.py`) (K: 3)
        1.1.2. [ ] Authentifizierung und Autorisierung implementieren (in `app/api/deps.py` und Endpunkt-Dekorator) (K: 5)
        1.1.3. [ ] CRUD-Operation in `app/crud/crud_account.py` implementieren/anpassen (K: 5)
        1.1.4. [ ] Interaktion mit `tenant_databases` sicherstellen (via `app/db/tenant_db.py`) (K: 3)
        1.1.5. [ ] Router in `app/routers/accounts.py` (neu) oder bestehendem Router registrieren (K: 2)
    1.2. [ ] Endpunkt für `PUT /api/v1/accounts/{account_id}` (Aktualisieren eines Kontos) (K: 7)
        1.2.1. [ ] Pydantic-Modell für Request-Body definieren/verwenden (K: 3)
        1.2.2. [ ] Authentifizierung und Autorisierung implementieren (K: 4)
        1.2.3. [ ] CRUD-Operation in `app/crud/crud_account.py` implementieren/anpassen (K: 4)
        1.2.4. [ ] Interaktion mit `tenant_databases` sicherstellen (K: 3)
    1.3. [ ] Endpunkt für `DELETE /api/v1/accounts/{account_id}` (Löschen eines Kontos) (K: 6)
        1.3.1. [ ] Authentifizierung und Autorisierung implementieren (K: 4)
        1.3.2. [ ] CRUD-Operation in `app/crud/crud_account.py` implementieren/anpassen (K: 3)
        1.3.3. [ ] Interaktion mit `tenant_databases` sicherstellen (K: 3)
2.  **API-Endpunkte für `accountGroup` erstellen**
    2.1. [ ] Endpunkt für `POST /api/v1/accountgroups` (Erstellen einer Kontogruppe) (K: 8)
        2.1.1. [ ] Pydantic-Modell für Request-Body definieren/verwenden (in `app/models/schemas.py` oder `app/models/account_group.py`) (K: 3)
        2.1.2. [ ] Authentifizierung und Autorisierung implementieren (K: 5)
        2.1.3. [ ] CRUD-Operation in `app/crud/crud_account_group.py` implementieren/anpassen (K: 5)
        2.1.4. [ ] Interaktion mit `tenant_databases` sicherstellen (K: 3)
        2.1.5. [ ] Router in `app/routers/account_groups.py` (neu) oder bestehendem Router registrieren (K: 2)
    2.2. [ ] Endpunkt für `PUT /api/v1/accountgroups/{group_id}` (Aktualisieren einer Kontogruppe) (K: 7)
        2.2.1. [ ] Pydantic-Modell für Request-Body definieren/verwenden (K: 3)
        2.2.2. [ ] Authentifizierung und Autorisierung implementieren (K: 4)
        2.2.3. [ ] CRUD-Operation in `app/crud/crud_account_group.py` implementieren/anpassen (K: 4)
        2.2.4. [ ] Interaktion mit `tenant_databases` sicherstellen (K: 3)
    2.3. [ ] Endpunkt für `DELETE /api/v1/accountgroups/{group_id}` (Löschen einer Kontogruppe) (K: 6)
        2.3.1. [ ] Authentifizierung und Autorisierung implementieren (K: 4)
        2.3.2. [ ] CRUD-Operation in `app/crud/crud_account_group.py` implementieren/anpassen (K: 3)
        2.3.3. [ ] Interaktion mit `tenant_databases` sicherstellen (K: 3)
3.  **Logging und Fehlerbehandlung für neue Endpunkte implementieren**
    3.1. [ ] Gemäß [`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py:1) und den Logging-Regeln in [`.kilocode/rules/code-rules.md`](.kilocode/rules/code-rules.md:1) (K: 5)

### 4.2. Frontend-Entwicklung (Vue.js / Pinia)
Pfad-Präfix für Frontend-Dateien: `./` (aktuelles Arbeitsverzeichnis)

4.  **Online-Status-Erkennung implementieren**
    4.1. [ ] Logik zur Prüfung des Online-Status entwickeln (z.B. über WebSocket-Status aus `src/services/websocketService.ts` oder einen Ping-Service) (K: 6)
    4.2. [ ] Status global verfügbar machen (z.B. in einem neuen Pinia-Store `src/stores/networkStore.ts` oder als Composable `src/composables/useNetworkStatus.ts`) (K: 4)
5.  **Anpassung des `accountStore.ts` (z.B. [`src/stores/accountStore.ts`](src/stores/accountStore.ts:1))**
    5.1. [ ] Methode zum Erstellen eines Kontos anpassen (K: 7)
        5.1.1. [ ] Bei Online-Status: Direkter asynchroner API-Aufruf an `POST /api/v1/accounts` (K: 4)
        5.1.2. [ ] Bei Offline-Status: Bestehende `syncQueue`-Logik verwenden (K: 2 - Überprüfung)
        5.1.3. [ ] Fehlerbehandlung für API-Aufruf (Fallback zur `syncQueue` bei Fehler) (K: 3)
    5.2. [ ] Methode zum Aktualisieren eines Kontos anpassen (K: 7)
        5.2.1. [ ] Bei Online-Status: Direkter asynchroner API-Aufruf an `PUT /api/v1/accounts/{account_id}` (K: 4)
        5.2.2. [ ] Bei Offline-Status: Bestehende `syncQueue`-Logik verwenden (K: 2 - Überprüfung)
        5.2.3. [ ] Fehlerbehandlung für API-Aufruf (Fallback zur `syncQueue` bei Fehler) (K: 3)
    5.3. [ ] Methode zum Löschen eines Kontos anpassen (K: 7)
        5.3.1. [ ] Bei Online-Status: Direkter asynchroner API-Aufruf an `DELETE /api/v1/accounts/{account_id}` (K: 4)
        5.3.2. [ ] Bei Offline-Status: Bestehende `syncQueue`-Logik verwenden (K: 2 - Überprüfung)
        5.3.3. [ ] Fehlerbehandlung für API-Aufruf (Fallback zur `syncQueue` bei Fehler) (K: 3)
6.  **Anpassung des `accountGroupStore.ts` (oder äquivalenter Store, z.B. [`src/stores/accountGroupStore.ts`](src/stores/accountGroupStore.ts:1))**
    6.1. [ ] Methode zum Erstellen einer Kontogruppe anpassen (K: 7)
        6.1.1. [ ] Bei Online-Status: Direkter asynchroner API-Aufruf an `POST /api/v1/accountgroups` (K: 4)
        6.1.2. [ ] Bei Offline-Status: Bestehende `syncQueue`-Logik verwenden (K: 2 - Überprüfung)
        6.1.3. [ ] Fehlerbehandlung für API-Aufruf (Fallback zur `syncQueue` bei Fehler) (K: 3)
    6.2. [ ] Methode zum Aktualisieren einer Kontogruppe anpassen (K: 7)
        6.2.1. [ ] Bei Online-Status: Direkter asynchroner API-Aufruf an `PUT /api/v1/accountgroups/{group_id}` (K: 4)
        6.2.2. [ ] Bei Offline-Status: Bestehende `syncQueue`-Logik verwenden (K: 2 - Überprüfung)
        6.2.3. [ ] Fehlerbehandlung für API-Aufruf (Fallback zur `syncQueue` bei Fehler) (K: 3)
    6.3. [ ] Methode zum Löschen einer Kontogruppe anpassen (K: 7)
        6.3.1. [ ] Bei Online-Status: Direkter asynchroner API-Aufruf an `DELETE /api/v1/accountgroups/{group_id}` (K: 4)
        6.3.2. [ ] Bei Offline-Status: Bestehende `syncQueue`-Logik verwenden (K: 2 - Überprüfung)
        6.3.3. [ ] Fehlerbehandlung für API-Aufruf (Fallback zur `syncQueue` bei Fehler) (K: 3)
7.  **Sicherstellen der Asynchronität und Performance**
    7.1. [ ] API-Aufrufe (z.B. mit `fetch` oder `axios`) blockieren nicht die UI (K: 3 - Überprüfung und ggf. Anpassung)
8.  **Benachrichtigung bei Synchronisationsfehlern (optional, gemäß PRD Punkt 8)**
    8.1. [ ] Implementierung einer dezenten Fehlermeldung für den Benutzer (z.B. via Toast-Notification) (K: 4)
9.  **Einhaltung der [`code-rules.md`](.kilocode/rules/code-rules.md:1) (Punkt 10 "Code Changes")**
    9.1. [ ] Keine Umbenennung bestehender Store-Methoden (K: 1 - Überprüfung)
    9.2. [ ] Änderungen primär auf Store-Ebene (K: 1 - Überprüfung)

### 4.3. Tests

10. **Backend-Tests** (Pfad-Präfix: `../FinWise_0.4_BE/`)
    10.1. [ ] Unit-Tests für neue CRUD-Funktionen (z.B. in `tests/crud/test_crud_account.py` und `tests/crud/test_crud_account_group.py`) (K: 8)
    10.2. [ ] Integrationstests für die neuen API-Endpunkte (z.B. in `tests/api/v1/test_accounts.py` und `tests/api/v1/test_account_groups.py`) (K: 10)
11. **Frontend-Tests** (Pfad-Präfix: `./`)
    11.1. [ ] Unit-Tests für die angepasste Logik in den Pinia-Stores (z.B. in [`test/stores/accountStore.spec.ts`](test/stores/accountStore.spec.ts:1) und `test/stores/accountGroupStore.spec.ts`) (K: 9)
    11.2. [ ] Tests für die Online-Status-Erkennung (K: 5)
    11.3. [ ] Tests für das Fallback-Verhalten zur `syncQueue` (K: 6)

### 4.4. Dokumentation

12. [ ] **TASK.md aktualisieren**: Alle Tasks als erledigt markieren (gemäß [`.kilocode/rules/process-task-list.md`](.kilocode/rules/process-task-list.md:1)) (K: 2)
13. [ ] **README.md aktualisieren** (falls neue Abhängigkeiten oder Setup-Schritte hinzugekommen sind) (K: 3)
14. [ ] **Code-Kommentare** gemäß [`.kilocode/rules/commentrules.md`](.kilocode/rules/commentrules.md:1) hinzufügen/anpassen (K: 4)

## 5. Non-Goals (Out of Scope)

*   Änderungen an der Synchronisation anderer Datenentitäten (z.B. Transaktionen, Budgets), es sei denn, sie sind direkte Abhängigkeiten.
*   Umfassende Neugestaltung des bestehenden Offline-Synchronisationsmechanismus über die `syncQueue`.
*   Implementierung von Konfliktlösungsstrategien, die über das bisherige Maß hinausgehen.

## 6. Design Considerations (Optional)

*   Das Design ist laut Benutzer bereits implementiert und erfordert keine Änderungen.

## 7. Technical Considerations (Optional)

*   **Backend:**
    *   Erstellung von FastAPI-Endpunkten für CRUD-Operationen auf `account` und `accountGroup`.
    *   Sicherstellung der korrekten Authentifizierung und Autorisierung für diese Endpunkte.
    *   Validierung der eingehenden Daten (Pydantic-Modelle).
    *   Interaktion mit der Datenbank (SQLAlchemy/SQLModel) zur Persistierung der Änderungen in der jeweiligen `tenant_databases`.
*   **Frontend:**
    *   Anpassung der Vue-Stores (Pinia) für Konten und Kontogruppen, um die neue Online-Synchronisationslogik zu integrieren.
    *   Nutzung von `fetch` oder `axios` für die asynchronen API-Aufrufe.
    *   Implementierung einer Logik zur Prüfung des Online-Status (ggf. über WebSocket-Status oder regelmäßige Pings).
    *   Die Implementierung muss den Regeln unter [`C:\00_mldata\programming\FinWise\FinWise_0.4\.kilocode\rules\code-rules.md`](C:\00_mldata\programming\FinWise\FinWise_0.4\.kilocode\rules\code-rules.md:1) (insbesondere Punkt 10 "Code Changes") folgen, d.h. keine Umbenennung bestehender Methoden in Stores, Änderungen primär auf Store-Ebene.

## 8. Success Metrics

*   Neu angelegte oder geänderte Konten sind bei bestehender Online-Verbindung unmittelbar in der Backend-TenantDB sichtbar.
*   Neu angelegte oder geänderte Kontogruppen sind bei bestehender Online-Verbindung unmittelbar in der Backend-TenantDB sichtbar.
*   Die Frontend-Anwendung bleibt während des Synchronisationsvorgangs responsiv.
*   Im Offline-Modus funktioniert die Synchronisation weiterhin zuverlässig über die `syncQueue`.

## 9. Open Questions

*   (Vorerst keine)

## 10. Relevante Dateien (während der Implementierung zu füllen und Pfade zu überprüfen)

*   **Backend** (relativ zu `../FinWise_0.4_BE/`):
    *   `app/api/v1/endpoints/accounts.py` (neu oder angepasst)
    *   `app/api/v1/endpoints/account_groups.py` (neu oder angepasst)
    *   `app/crud/crud_account.py` (angepasst)
    *   `app/crud/crud_account_group.py` (angepasst)
    *   `app/models/account.py` (ggf. Pydantic-Schemas angepasst/erstellt)
    *   `app/models/account_group.py` (ggf. Pydantic-Schemas angepasst/erstellt)
    *   `app/models/schemas.py` (ggf. Pydantic-Schemas angepasst/erstellt)
    *   `app/routers/accounts.py` (neu oder Router-Einbindung in `main.py` angepasst)
    *   `app/routers/account_groups.py` (neu oder Router-Einbindung in `main.py` angepasst)
    *   `app/db/tenant_db.py` (ggf. angepasst)
    *   `app/api/deps.py` (ggf. angepasst)
    *   `tests/crud/test_crud_account.py` (neu oder angepasst)
    *   `tests/api/v1/test_accounts.py` (neu oder angepasst)
    *   `tests/crud/test_crud_account_group.py` (neu oder angepasst)
    *   `tests/api/v1/test_account_groups.py` (neu oder angepasst)
*   **Frontend** (relativ zu `.`):
    *   [`src/stores/accountStore.ts`](src/stores/accountStore.ts:1) (angepasst)
    *   [`src/stores/accountGroupStore.ts`](src/stores/accountGroupStore.ts:1) (oder äquivalent, angepasst)
    *   `src/stores/networkStore.ts` (neu, oder äquivalente Implementierung für Online-Status)
    *   `src/composables/useNetworkStatus.ts` (alternativ zu networkStore)
    *   `src/services/apiService.ts` (oder wo API-Aufrufe zentralisiert sind, ggf. neue Funktionen)
    *   [`test/stores/accountStore.spec.ts`](test/stores/accountStore.spec.ts:1) (angepasst)
    *   [`test/stores/accountGroupStore.spec.ts`](test/stores/accountGroupStore.spec.ts:1) (angepasst)
    *   [`test/stores/networkStore.spec.ts`](test/stores/networkStore.spec.ts:1) (neu)
*   **Dokumentation**:
    *   [`tasks/tasklist-konten-gruppen-synchronisation.md`](tasks/tasklist-konten-gruppen-synchronisation.md:1) (diese Datei)
    *   [`TASK.md`](TASK.md:1)
    *   `README.md`
