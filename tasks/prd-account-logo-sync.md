# Product Requirements Document: Account & Account Group Logo Synchronisation

## 1. Introduction/Overview

Dieses Dokument beschreibt die Anforderungen für die Implementierung der serverseitigen Speicherung und Synchronisation von Logos für Konten (Accounts) und Kontengruppen (Account Groups) in der FinWise-Anwendung. Ziel ist es, dass Benutzer Logos für ihre Konten und Kontengruppen hochladen, ändern und löschen können und diese Logos geräteübergreifend verfügbar sind. Die Funktion soll die visuelle Organisation und Identifizierung von Konten verbessern.

## 2. Goals

*   Ermöglichen der Speicherung von Logos für Konten und Kontengruppen im Backend.
*   Sicherstellen der geräteübergreifenden Verfügbarkeit der Logos.
*   Ermöglichen des Hochladens, Änderns und Löschens von Logos durch den Benutzer.
*   Bereitstellen einer Caching-Strategie für Logos im Frontend, um die Anzeige auch bei temporärer Nichtverfügbarkeit des Backends zu ermöglichen (mit Neuladen beim Login und manuellem Sync).
*   Konfigurierbarer Speicherpfad für Logos im Backend über eine Umgebungsvariable.

## 3. User Stories

1.  **Als Benutzer möchte ich ein Logo für mein Bankkonto hochladen können, damit ich es in der Übersicht und auf all meinen Geräten schnell visuell erkenne.**
2.  **Als Benutzer möchte ich das bestehende Logo eines Kontos ändern können, falls sich das Logo der Bank ändert oder ich ein passenderes Bild finde.**
3.  **Als Benutzer möchte ich ein Logo von einem Konto entfernen können, woraufhin wieder das Standardbild angezeigt wird.**
4.  **Als Benutzer möchte ich, dass das von mir für ein Konto festgelegte Logo auch auf anderen Geräten angezeigt wird, nachdem ich mich dort angemeldet habe.**
5.  **Als Benutzer möchte ich, dass die Logos auch dann angezeigt werden (aus einem Cache), wenn ich kurzzeitig keine Internetverbindung habe, und dass sie beim nächsten Login oder manuellem Sync aktualisiert werden.**
6.  **Als Benutzer möchte ich die gleichen Logo-Funktionalitäten (Hochladen, Ändern, Löschen, geräteübergreifende Verfügbarkeit, Caching) auch für meine Kontengruppen haben.**

## 4. Functional Requirements

### 4.1. Logo-Management (Konten & Kontengruppen)
1.  FR1.1: Das System muss es dem Benutzer ermöglichen, ein Bild (Logo) für ein spezifisches Konto hochzuladen.
2.  FR1.2: Das System muss es dem Benutzer ermöglichen, ein vorhandenes Logo eines spezifischen Kontos durch ein neues Bild zu ersetzen.
3.  FR1.3: Das System muss es dem Benutzer ermöglichen, ein vorhandenes Logo von einem spezifischen Konto zu löschen.
4.  FR1.4: Wenn kein Logo für ein Konto hinterlegt ist oder ein Logo gelöscht wird, muss das System ein Standardbild anzeigen (bestehende Funktionalität).
5.  FR1.5: Die oben genannten Funktionalitäten (FR1.1 - FR1.4) müssen analog auch für Kontengruppen implementiert werden.

### 4.2. Backend-Speicherung
6.  FR2.1: Hochgeladene Logos müssen im Backend gespeichert werden.
7.  FR2.2: Der Basispfad für die Speicherung der Logos im Backend muss über eine Umgebungsvariable (z.B. `LOGO_STORAGE_PATH`) konfigurierbar sein.
8.  FR2.3: Für jedes Konto/jede Kontengruppe, das/die ein Logo hat, muss der relative Pfad oder ein eindeutiger Bezeichner zum Logo in der jeweiligen Datenbanktabelle gespeichert werden (z.B. in den Tabellen `accounts` und `account_groups`).
9.  FR2.4: Das Backend muss einen API-Endpunkt bereitstellen, über den Logos hochgeladen werden können. Dieser Endpunkt sollte die Konto-ID oder Kontengruppen-ID als Parameter akzeptieren.
10. FR2.5: Das Backend muss einen API-Endpunkt bereitstellen, über den Logos gelöscht werden können.
11. FR2.6: Das Backend muss einen API-Endpunkt bereitstellen, über den Logos abgerufen werden können (z.B. `/api/v1/logos/{logo_filename_or_id}`).
12. FR2.7: Das System soll die Dateiformate PNG und JPG für Logos unterstützen.
13. FR2.8: Informationen zum Mime-Typ des Bildes sollten implizit (durch Dateiendung) oder explizit gespeichert und beim Abruf übermittelt werden.

### 4.3. Frontend-Integration & Synchronisation
14. FR3.1: Die [`AccountCard`](src/components/account/AccountCard.vue:1) und [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) müssen das jeweils zugeordnete Logo anzeigen.
15. FR3.2: Die UI-Elemente zum Hochladen, Ändern und Löschen von Logos müssen in die bestehende Oberfläche integriert werden (wahrscheinlich im Bearbeitungsmodus des Kontos/der Kontengruppe).
16. FR3.3: Nach einem erfolgreichen Upload/Änderung/Löschen eines Logos und dem Abruf der aktualisierten Kontodaten von Backend, muss das Logo auf einem zweiten Client-Gerät korrekt angezeigt werden. Ein expliziter Broadcast der Logo-Änderung ist nicht zwingend erforderlich; der Abruf der aktualisierten Entitätsdaten (Account/AccountGroup mit neuem Logo-Pfad) ist ausreichend.
17. FR3.4: Die Interaktion mit den Logo-Endpunkten (Upload, Löschen) soll über den Service Layer in den Store/DataLayer der Frontend-Anwendung abgewickelt werden.

### 4.4. Caching & Offline-Verhalten
18. FR4.1: Das Frontend muss eine Caching-Strategie für Logos implementieren (z.B. Speicherung als Base64-String oder Blob in localStorage oder IndexedDB).
19. FR4.2: Beim initialen Laden eines Kontos/einer Kontengruppe mit Logo soll das Logo vom Backend abgerufen und im lokalen Cache gespeichert werden.
20. FR4.3: Wenn das Backend nicht erreichbar ist, soll das Logo aus dem lokalen Cache geladen und angezeigt werden.
21. FR4.4: Wenn das Backend nicht erreichbar ist und kein Logo im Cache vorhanden ist, soll das Standardbild angezeigt werden.
22. FR4.5: Bei jedem App-Login des Benutzers sollen die Logos für die initial geladenen Konten/Kontengruppen vom Backend neu abgerufen und der Cache aktualisiert werden.
23. FR4.6: Beim Klick auf den globalen [`SyncButton.vue`](src/components/ui/SyncButton.vue:1) sollen die Logos für alle relevanten Entitäten ebenfalls vom Backend neu abgerufen und der Cache aktualisiert werden.

## 5. Non-Goals (Out of Scope)

*   Serverseitige Bildbearbeitungsfunktionen (z.B. Zuschneiden, Skalieren, Komprimieren über die initiale Verarbeitung hinaus).
*   Erweiterte Validierung von Bildinhalten (außer Dateiformat).
*   Versionierung von Logos.
*   Direkte Synchronisation der Bild-Binärdaten über die bestehende WebSocket-Sync-Queue. Der Upload erfolgt über separate HTTP-Endpunkte. Der Pfad zum Logo wird jedoch über die normale Entitäten-Synchronisation (Account/AccountGroup) verteilt.
*   Eine globale Medienbibliothek für Logos. Logos sind direkt den Konten/Kontengruppen zugeordnet.

## 6. Design Considerations

*   Die UI-Elemente für den Logo-Upload und die Anzeige sind bereits im Account Component Bereich konzeptionell vorhanden und sollen entsprechend erweitert werden.
*   Der Upload-Prozess sollte dem Benutzer Feedback über den Fortschritt und Erfolg/Misserfolg geben.
*   Fehlermeldungen bei fehlgeschlagenen Uploads oder nicht darstellbaren Bildern sollten benutzerfreundlich sein.

## 7. Technical Considerations

*   **Backend:**
    *   Ein neuer Service im Backend wird für die Verarbeitung von Bild-Uploads (Speichern, Löschen, Bereitstellen) benötigt.
    *   Die API-Endpunkte für Logos müssen gegen unbefugten Zugriff gesichert werden.
    *   Es muss sichergestellt werden, dass Dateinamen eindeutig sind oder in einer Struktur gespeichert werden, die Kollisionen vermeidet (z.B. Unterordner pro Mandant oder Verwendung von UUIDs als Dateinamen).
    *   Die Umgebungsvariable für den Speicherpfad muss im Backend korrekt ausgelesen und verwendet werden.
*   **Frontend:**
    *   Die Implementierung des Caching-Mechanismus (localStorage oder IndexedDB) muss sorgfältig erfolgen, um Speicherplatz und Performance zu berücksichtigen. IndexedDB ist aufgrund potenziell größerer Datenmengen und besserer Query-Möglichkeiten zu bevorzugen.
    *   Die Logik zum Abrufen von Logos vom Backend bzw. aus dem Cache muss im entsprechenden Service (z.B. `AccountService`, `AccountGroupService` oder ein neuer `ImageService`) implementiert werden.
    *   Der Pfad zum Logo, der vom Backend kommt, muss im Frontend korrekt interpretiert werden, um die vollständige URL zum Backend-Endpunkt zu konstruieren.
*   **Datenmodell:**
    *   Die Entitäten `Account` und `AccountGroup` im Frontend ([`src/types/index.ts`](src/types/index.ts:1)) und Backend ([`app/models/financial_models.py`](../FinWise_0.4_BE/app/models/financial_models.py:1)) müssen um ein Feld für den Logo-Pfad (z.B. `logoUrl` oder `logoPath`) erweitert werden.

## 8. Success Metrics

*   Benutzer können erfolgreich Logos für Konten und Kontengruppen hochladen, ändern und löschen.
*   Hochgeladene Logos werden korrekt auf allen Geräten des Benutzers nach einem Datenabruf angezeigt.
*   Logos werden aus dem Cache geladen, wenn das Backend temporär nicht verfügbar ist.
*   Die Konfiguration des Speicherpfads im Backend über die ENV-Variable funktioniert wie erwartet.

## 9. Open Questions

1.  Soll eine maximale Dateigröße für den Upload serverseitig und/oder clientseitig erzwungen werden, auch wenn initial "Größe egal" angegeben wurde? (Empfehlung: Ja, um Performance und Speicherplatz zu schonen).
    1.  Nein, keine Begrenzung
2.  Wie genau soll die Fehlerbehandlung aussehen, wenn ein Logo-Upload fehlschlägt (z.B. falsches Format, zu groß, Netzwerkfehler)?
    1.  Format über Validator prüfen (nur png oder jpg erlaubt)
    2.  Mehrfacher Upload, falls endpoint nicht erreichbar. Nach 3. Mal "Upload schlug fehl; später nochmal probieren"
3.  Soll beim Löschen eines Kontos/einer Kontengruppe das zugehörige Logo-Bild auch physisch vom Backend-Speicher entfernt werden? (Empfehlung: Ja, um Datenmüll zu vermeiden).
    1.  Ja
4.  Welche maximale Anzahl oder Gesamtgröße von zwischengespeicherten Logos soll im Frontend-Cache erlaubt sein, bevor ältere Einträge ggf. entfernt werden (Cache-Eviction-Strategie)?
    1.  Nur die aktuell geladenen aus dem Backend im Cachehalten. Bei Löschung auch cache löschen. Nur wenn der Reload aus dem Backend nicht funktioniert, den Cache weiterbehalten.
