# PRD: Zuverlässige Bildentfernung im Backend

## 1. Introduction/Overview

Benutzer können in der Account- und AccountGroup-Form Bilder hochladen. Wenn diese Bilder im Frontend entfernt werden, wird zwar die Verknüpfung in der Datenbank gelöscht, die eigentliche Bilddatei verbleibt jedoch als verwaiste Datei auf dem Server. Zusätzlich schlägt der direkte API-Aufruf zum Löschen eines Bildes (`DELETE /api/v1/logos/{logo_path}`) mit einem Fehler bezüglich einer fehlenden `Tenant-ID` fehl. Dieses Feature soll den Fehler im Endpunkt beheben und einen zuverlässigen Prozess zur Löschung von Bildern etablieren, um die Datenkonsistenz zu wahren.

## 2. Goals

*   Behebung des Authentifizierungs-/Kontext-Fehlers im `DELETE /api/v1/logos/{logo_path}` Endpunkt.
*   Sicherstellung, dass das Entfernen eines Bildes im Frontend zur sofortigen Löschung der Datei im Backend führt.
*   Implementierung eines periodischen Aufräummechanismus im Backend, um eventuell verbliebene verwaiste Bilddateien zu entfernen.

## 3. User Stories

*   "Als Benutzer möchte ich, dass ein von mir entferntes Bild auch tatsächlich vom Server gelöscht wird, damit das System sauber bleibt."
*   "Als Entwickler möchte ich einen funktionierenden `DELETE`-Endpunkt für Bilder haben, um Wartungs- und Verwaltungsaufgaben durchführen zu können."

## 4. Functional Requirements

1.  Der Endpunkt `DELETE /api/v1/logos/{logo_path}` muss so korrigiert werden, dass er den Mandanten-Kontext korrekt aus der aktiven Benutzersession erkennt und keine explizite Übergabe der Tenant-ID erfordert.
2.  Bei erfolgreicher Authentifizierung und Autorisierung MUSS der Endpunkt die angegebene Bilddatei aus dem Dateisystem des Backends löschen.
3.  Das Frontend MUSS den Endpunkt `DELETE /api/v1/logos/{logo_path}` aufrufen, wenn ein Benutzer ein Bild aus einer Account- oder AccountGroup-Form entfernt.
4.  Im Backend MUSS ein periodischer Task (z.B. nächtlicher Cronjob) implementiert werden, der alle Bilddateien im Logo-Verzeichnis überprüft.
5.  Dieser Task MUSS alle Bilddateien löschen, die keiner aktiven Account- oder AccountGroup-Entität mehr zugeordnet sind.

## 5. Non-Goals (Out of Scope)

*   Es wird keine "Papierkorb"-Funktion für gelöschte Bilder implementiert. Eine Löschung ist endgültig.
*   Die Benutzeroberfläche für den Upload oder die Anzeige von Bildern wird nicht verändert.

## 6. Technical Considerations

*   Der Fehler `{"detail": "Tenant-ID nicht im Kontext gefunden..."}` deutet auf ein Problem in der FastAPI-Dependency-Injection für den Endpunkt hin. Der Mechanismus zur Ermittlung des aktuellen Mandanten aus dem Request-Kontext (vermutlich aus einem Authentifizierungs-Token) muss überprüft und korrigiert werden.
*   Der periodische Aufräum-Task sollte effizient implementiert werden, um die Serverlast zu minimieren. Er muss alle Mandanten-Datenbanken scannen, um die Zuordnungen zu prüfen.

## 7. Success Metrics

*   **Akzeptanzkriterium:** Das Entfernen eines Bildes in der Account- oder AccountGroup-Form im Frontend führt nachweislich und zuverlässig zur Löschung der entsprechenden Datei im Backend-Dateisystem.
*   **Monitoring:** Die Anzahl der verwaisten Bilddateien im Logo-Verzeichnis geht auf null zurück und bleibt dort.
*   **Fehlerrate:** Die Fehlerrate des `DELETE /api/v1/logos/{logo_path}` Endpunkts sinkt auf null für valide Anfragen.
