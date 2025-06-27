## Relevant Files

### Backend (`../FinWise_0.4_BE`)
- `app/api/v1/endpoints/users.py` - Wahrscheinlichster Ort für die neuen Endpunkte `GET /me/settings` und `PUT /me/settings`.
- `app/crud/crud_user.py` - Zum Implementieren der Lese- und Schreiblogik für Benutzereinstellungen in der Datenbank.
- `app/models/schemas.py` - Zum Definieren eines Pydantic-Schemas für die Validierung der Einstellungswerte.
- `app/models/user_tenant_models.py` - Das `User`-Modell muss möglicherweise angepasst werden, um die Einstellungen zu speichern (z.B. in einer JSON-Spalte).
- `tests/api/v1/test_users.py` - Zum Hinzufügen von Unit-Tests für die neuen API-Endpunkte.

### Frontend (`./`)
- `src/stores/sessionStore.ts` - Um den Prozess zum Laden der Benutzereinstellungen nach einem erfolgreichen Login anzustoßen.
- `src/stores/userStore.ts` - Zum Speichern und Verwalten der benutzerspezifischen Einstellungen.
- `src/stores/settingsStore.ts` - Zum Speichern und Verwalten der allgemeinen App-Einstellungen (z.B. Theme).
- `src/services/apiService.ts` - Zum Hinzufügen der neuen API-Aufrufe für das Abrufen und Aktualisieren der Einstellungen.
- `src/views/Settings.vue` - Oder die entsprechende Komponente, in der die UI für die Einstellungsänderungen liegt und die Synchronisation ausgelöst wird.
- `src/tests/stores/userStore.test.ts` - Unit-Tests für die neuen Actions im `userStore`.
- `src/tests/stores/settingsStore.test.ts` - Unit-Tests für die neuen Actions im `settingsStore`.

### Notes

- Die Backend-Pfade sind relativ zum Frontend-Workspace angegeben und müssen entsprechend angepasst werden.
- Unit-Tests sollten idealerweise parallel zu den zu testenden Dateien erstellt werden.
- Führe Tests mit `npm run test` oder spezifischer mit `vitest [pfad/zur/testdatei]` aus.

## Tasks

- [ ] 1.0 Backend-Anpassungen für Benutzereinstellungen
  - [ ] 1.1 Einen `GET /api/v1/users/me/settings` Endpunkt erstellen, der die Einstellungen des authentifizierten Benutzers aus der `users.db` zurückgibt.
  - [ ] 1.2 Einen `PUT /api/v1/users/me/settings` Endpunkt erstellen, der die übermittelten Einstellungen validiert und in der `users.db` speichert.
  - [ ] 1.3 Sicherstellen, dass beide Endpunkte eine gültige Benutzerauthentifizierung erfordern.
  - [ ] 1.4 Ein Pydantic-Schema für die Benutzereinstellungen definieren, um die eingehenden Daten zu validieren und zu strukturieren.
  - [ ] 1.5 Die CRUD-Logik in `crud_user.py` implementieren, um die Einstellungen aus der `User`-Tabelle zu lesen und zu aktualisieren.

- [ ] 2.0 Frontend-Logik zum Abrufen der Einstellungen beim Login
  - [ ] 2.1 Im `sessionStore` oder einem `SessionService` nach dem erfolgreichen Login eine Funktion aufrufen, die die Benutzereinstellungen vom Backend abruft.
  - [ ] 2.2 Den API-Aufruf an den `GET /api/v1/users/me/settings` Endpunkt im `apiService` implementieren.

- [ ] 3.0 Speicherung der Einstellungen im Frontend (Pinia Stores) und UI-Aktualisierung
  - [ ] 3.1 Eine Action im `userStore` erstellen, die die vom Backend empfangenen Einstellungen entgegennimmt und den Store-State aktualisiert.
  - [ ] 3.2 Eine Action im `settingsStore` erstellen, die die relevanten UI-Einstellungen (z.B. Theme, Loglevel) entgegennimmt und den Store-State aktualisiert.
  - [ ] 3.3 Sicherstellen, dass die UI (insbesondere das Theme) reaktiv auf die Änderungen in den Stores reagiert.

- [ ] 4.0 Frontend-Logik zur Synchronisation von Einstellungsänderungen zum Backend
  - [ ] 4.1 In der Einstellungs-Komponente (`Settings.vue`) einen Watcher oder eine Methode implementieren, die auf Änderungen der Einstellungswerte reagiert.
  - [ ] 4.2 Bei jeder Änderung eine Funktion aufrufen, die die geänderten Daten an das Backend sendet.
  - [ ] 4.3 Den API-Aufruf an den `PUT /api/v1/users/me/settings` Endpunkt im `apiService` implementieren.
  - [ ] 4.4 Eine grundlegende Fehlerbehandlung für den API-Aufruf hinzufügen (z.B. Konsolenausgabe bei Fehlern).

- [ ] 5.0 End-to-End-Validierung und Testing
  - [ ] 5.1 Manuell testen: Nach dem Login prüfen, ob die Einstellungen aus der Datenbank korrekt im Frontend (Stores und UI) angewendet werden.
  - [ ] 5.2 Manuell testen: Eine Einstellung im Frontend ändern und in der `users.db` des Backends verifizieren, dass die Änderung angekommen ist.
  - [ ] 5.3 Manuell testen: Nach einer Einstellungsänderung die Seite neu laden und prüfen, ob die neue Einstellung korrekt geladen wird.
  - [ ] 5.4 (Optional) Unit-Tests für die neuen Store-Actions und Service-Funktionen im Frontend schreiben.
  - [ ] 5.5 (Optional) Unit-Tests für die neuen API-Endpunkte im Backend schreiben.
