**PRD: Bidirektionale Synchronisation mit Offline-Fähigkeit**

**1. Introduction/Overview:**
Diese PRD beschreibt die Anforderungen für die Implementierung einer bidirektionalen Synchronisationsfunktion in FinWise. Das Hauptziel ist es, Benutzern zu ermöglichen, ihre Finanzdaten nahtlos über mehrere Geräte hinweg zu synchronisieren und die Anwendung auch im Offline-Modus nutzen zu können. Ein zentraler Bestandteil ist die Erkennung des Online-/Offline-Status mittels WebSockets und die Verwaltung von Änderungen in einer lokalen Sync Queue, die bei Verfügbarkeit des Backends abgearbeitet wird.

**2. Goals:**
*   Implementierung eines bidirektionalen Synchronisationsmechanismus zwischen Frontend (IndexedDB) und Backend (Tenant-spezifische Datenbanken).
*   Erkennung des Online-/Offline-Status des Backends mittels WebSockets im Frontend und Backend.
*   Speicherung von Offline-Änderungen in einer lokalen IndexedDB Sync Queue im Frontend.
*   Automatisches Abarbeiten der Sync Queue, sobald eine Online-Verbindung zum Backend besteht, NACHDEM die neuesten Daten vom Backend abgerufen wurden.
*   Verarbeitung von Löschoperationen während der Synchronisation.
*   Sicherstellung, dass die Synchronisation in die korrekte, Tenant-zugeordnete Datenbank im Backend erfolgt.
*   Anpassung der UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButtonButton.vue) zur Anzeige des Synchronisationsstatus.
*   Dokumentation der Schritte zur Erweiterung der Synchronisation auf weitere Datentabellen.

**3. User Stories:**
*   Als Benutzer möchte ich, dass meine Finanzdaten automatisch zwischen meinem Smartphone und meinem Laptop synchronisiert werden, damit ich immer auf dem aktuellsten Stand bin, egal welches Gerät ich benutze.
*   Als Benutzer, der oft unterwegs ist und keine stabile Internetverbindung hat, möchte ich meine Daten offline eingeben können und sicher sein, dass diese automatisch synchronisiert werden, sobald ich wieder online bin.
*   Als Benutzer möchte ich sehen können, wann die letzte Synchronisation stattgefunden hat und ob die Synchronisations-Queue leer ist, um den Status meiner Daten zu überprüfen.
*   Als Benutzer möchte ich benachrichtigt werden, wenn es Synchronisationskonflikte gibt (z.B. wenn derselbe Datensatz auf zwei Geräten unterschiedlich geändert wurde) und eine einfache Möglichkeit haben, diese zu lösen.

**4. Functional Requirements:**
1.  Das System MUSS einen WebSocket-Server im Backend implementieren.
2.  Das System MUSS einen WebSocket-Client im Frontend implementieren, der eine Verbindung zum Backend aufbaut.
3.  Der WebSocket MUSS den Online-/Offline-Status des Backends an das Frontend signalisieren.
4.  Das Frontend MUSS Änderungen an den Daten (Account, Account Group) in einer lokalen IndexedDB Sync Queue speichern, wenn das Backend offline ist.
5.  Sobald die WebSocket-Verbindung zum Backend wiederhergestellt ist, MUSS das Frontend zuerst die neuesten Daten für den aktuellen Tenant vom Backend abrufen und die lokale IndexedDB aktualisieren.
6.  Nachdem das Frontend die neuesten Daten vom Backend abgerufen und verarbeitet hat, MUSS es die lokale Sync Queue automatisch an das Backend senden.
7.  Das Backend MUSS die empfangenen Änderungen aus der Sync Queue verarbeiten und in der entsprechenden Tenant-Datenbank speichern.
8.  Das Backend MUSS Änderungen an den Daten (Account, Account Group) erkennen und diese über den WebSocket an das Frontend senden.
9.  Das Frontend MUSS die vom Backend empfangenen Änderungen verarbeiten und die lokale IndexedDB aktualisieren.
10. Der Synchronisationsprozess MUSS bidirektional sein (Frontend -> Backend und Backend -> Frontend).
11. Der Synchronisationsprozess MUSS das Löschen von Datensätzen auf beiden Seiten korrekt verarbeiten.
12. Das Backend MUSS sicherstellen, dass Datenänderungen dem korrekten Tenant zugeordnet und in der richtigen Tenant-Datenbank gespeichert werden.
13. Die UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButtonButton.vue) MUSS den aktuellen Synchronisationsstatus (Online, Offline, Synchronisierung läuft, Queue nicht leer) anzeigen.
14. Die UI-Komponente [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButtonButton.vue) MUSS eine manuelle Auslösung der Synchronisation ermöglichen, falls die Queue nicht leer ist und das Backend online ist.
15. Das System MUSS Synchronisationskonflikte nach der "last write wins"-Strategie lösen. Es ist KEINE Benutzerabfrage zur Konfliktlösung erforderlich.
16. Das Backend MUSS das Datenbankmodell für Account und Account Group gemäß [`src/types/index.ts`](src/types/index.ts) in den Tenant-Datenbanken implementieren.
17. Das System MUSS die Erstellung einer Tenant-Datenbank im Backend nachholen, wenn ein Tenant offline erstellt wurde und das Backend wieder online geht.
18. Die WebSocket-Verbindung MUSS sicher sein und die übertragenen Daten SOLLTEN verschlüsselt werden.

**5. Non-Goals (Out of Scope):**
*   Implementierung der Synchronisation für Datentabellen, die sich derzeit noch im Local Storage befinden (z.B. Transactions, Categories, Tags, etc.). Dies wird in einem späteren Schritt erfolgen.

**6. Design Considerations (Optional):**
*   Platzierung des [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButtonButton.vue) in [`src/layouts/AppLayout.vue`](src/layouts/AppLayout.vue) wie vom Benutzer beschrieben, mittig zwischen TenantSwitch und ThemeToggle mit horizontalen margin von mx-2.
*   Anpassung der Logik in [`src/components/ui/SyncButton.vue`](src/components/ui/SyncButtonButton.vue) zur Nutzung des WebSocket-Status und der Sync Queue.

**7. Technical Considerations (Optional):**
*   Verwendung von WebSockets für die Online-/Offline-Erkennung und Echtzeit-Synchronisationssignale.
*   Nutzung von IndexedDB im Frontend für die lokale Datenspeicherung und Sync Queue.
*   Verwendung des Modells aus [`src/types/index.ts`](src/types/index.ts) für die Backend-Datenbankstruktur.
*   Berücksichtigung der Tenant-spezifischen Datenbankstruktur im Backend.
*   Prüfung der bestehenden Implementierung in [`src/services/DataService.ts`](src/services/DataService.ts), [`src/services/TenantService.ts`](src/services/TenantService.ts) und [`src/services/SessionService.ts`](src/services/SessionService.ts) bezüglich der aktuellen Datenspeicherung und Tenant-Behandlung.

**8. Success Metrics:**
*   Benutzer können Daten offline eingeben und sehen, wie diese nach dem Online-Gehen synchronisiert werden.
*   Datenänderungen (Erstellen, Bearbeiten, Löschen) werden korrekt zwischen mehreren Geräten synchronisiert.
*   Der `SyncButton` zeigt korrekt den Online-/Offline- und Synchronisationsstatus an.
*   Neue Tenants, die offline erstellt wurden, erhalten nach dem Online-Gehen eine entsprechende Datenbank im Backend.
