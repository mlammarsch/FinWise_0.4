## Relevant Files

- `../FinWise_0.4_BE/app/api/v1/endpoints/logos.py` - Enthält den zu korrigierenden `DELETE /api/v1/logos/{logo_path}` Endpunkt.
- `../FinWise_0.4_BE/app/api/v1/dependencies.py` - Enthält wahrscheinlich die fehlerhafte Dependency zur Ermittlung der `Tenant-ID`.
- `../FinWise_0.4_BE/app/services/cleanup_service.py` - Neue Datei für die Implementierung des periodischen Aufräum-Tasks.
- `../FinWise_0.4_BE/app/main.py` - Hier könnte der Scheduler für den periodischen Task initialisiert werden.
- `../FinWise_0.4_BE/tests/api/v1/test_logos.py` - Testdatei zur Validierung des korrigierten Endpunkts und des Löschvorgangs.
- `src/stores/accountStore.ts` - Enthält die Frontend-Logik zur Verwaltung von Konten und muss den API-Aufruf zum Löschen auslösen.
- `src/components/account/AccountForm.vue` - Die UI-Komponente, in der der Benutzer die Bildentfernung initiiert.
- `src/services/apiService.ts` - Der Service, der die eigentliche HTTP-Anfrage an das Backend sendet.

### Notes

- Die Backend-Dateien befinden sich im Schwesterverzeichnis `../FinWise_0.4_BE`.
- Der Fehler `Tenant-ID nicht im Kontext gefunden` deutet stark auf ein Problem in der FastAPI-Dependency-Injection hin. Die Korrektur muss sicherstellen, dass der Mandant korrekt aus dem Authentifizierungs-Token extrahiert wird.
- Unit-Tests sind entscheidend, um die korrekte Funktion des Endpunkts und des Aufräum-Tasks sicherzustellen.

## Tasks

- [ ] 1.0 Fehler im `DELETE /api/v1/logos/{logo_path}` Endpunkt beheben
  - [ ] 1.1 Analysiere die Dependency Injection für den Endpunkt, um das Problem mit der fehlenden `Tenant-ID` zu identifizieren.
  - [ ] 1.2 Korrigiere den Endpunkt, sodass der Mandanten-Kontext korrekt aus dem Authentifizierungs-Token des Benutzers geladen wird.
  - [ ] 1.3 Implementiere die Logik zum physischen Löschen der Bilddatei aus dem Verzeichnis `tenant_databases/{tenant_id}/logos/`.
  - [ ] 1.4 Stelle sicher, dass bei einem Fehler (z.B. Datei nicht gefunden oder keine Berechtigung) ein passender HTTP-Statuscode (z.B. 404 oder 403) zurückgegeben wird.
  - [ ] 1.5 Erstelle Unit-Tests für den Endpunkt, die das erfolgreiche Löschen und die Fehlerfälle (z.B. Zugriff auf Logo eines fremden Mandanten) validieren.
- [ ] 2.0 Frontend-Integration für sofortiges Löschen implementieren
  - [ ] 2.1 Erweitere den `accountStore.ts`, um eine Methode zum Löschen eines Logos bereitzustellen, die den `apiService` aufruft.
  - [ ] 2.2 Binde die neue Store-Methode in der `AccountForm.vue` (und analog in der `AccountGroupForm`) an die entsprechende UI-Aktion (z.B. Klick auf "Entfernen"-Button).
  - [ ] 2.3 Stelle sicher, dass die UI nach erfolgreicher Löschung korrekt aktualisiert wird (z.B. durch Anzeigen eines Standard-Platzhalters).
  - [ ] 2.4 Implementiere eine Fehlerbehandlung im Frontend, falls der API-Aufruf fehlschlägt (z.B. Anzeige einer Toast-Nachricht).
- [ ] 3.0 Periodischen Aufräum-Task im Backend für verwaiste Bilder erstellen
  - [ ] 3.1 Erstelle das neue Service-Modul `app/services/cleanup_service.py`.
  - [ ] 3.2 Implementiere eine Funktion, die alle `logo`-Pfade aus den `Account`- und `AccountGroup`-Tabellen aller Mandanten-Datenbanken ausliest.
  - [ ] 3.3 Implementiere eine Funktion, die alle existierenden Bilddateien in den Logo-Verzeichnissen aller Mandanten auflistet.
  - [ ] 3.4 Schreibe die Kernlogik, die die beiden Listen vergleicht und alle nicht mehr referenzierten Bilddateien löscht.
  - [ ] 3.5 Richte einen Scheduler (z.B. mit `APScheduler` in `main.py`) ein, der den Cleanup-Task periodisch (z.B. täglich um 03:00 Uhr) ausführt.
- [ ] 4.0 Logging und Monitoring für den Löschprozess verbessern
  - [ ] 4.1 Füge `infoLog`-Einträge für erfolgreiche Löschvorgänge im `logos.py`-Endpunkt hinzu.
  - [ ] 4.2 Füge `errorLog`-Einträge für fehlgeschlagene Löschversuche im Endpunkt hinzu.
  - [ ] 4.3 Der `cleanup_service` soll am Ende seiner Ausführung einen `infoLog` mit einer Zusammenfassung ausgeben (z.B. "Cleanup-Task beendet. 3 verwaiste Bilder gelöscht.").
- [ ] 5.0 Technische Dokumentation aktualisieren
  - [ ] 5.1 Aktualisiere die OpenAPI-/Swagger-Dokumentation für den korrigierten `DELETE`-Endpunkt.
  - [ ] 5.2 Erstelle einen neuen Abschnitt in der `README.md` oder einer relevanten Architektur-Dokumentation, der den neuen periodischen Aufräum-Task beschreibt.
