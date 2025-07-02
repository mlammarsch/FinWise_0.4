# PRD: Drag & Drop Sortierung für Kontogruppen

## 1. Einführung/Übersicht

Dieses Dokument beschreibt die Anforderungen für die Implementierung einer Drag-and-Drop-Funktionalität zur Sortierung von Kontogruppen (`AccountGroupCard`) in der `AccountsView`.

**Problem:** Benutzer können die Reihenfolge ihrer Kontogruppen derzeit nicht anpassen. Die Anordnung ist fix, was nicht immer die persönliche Priorität oder Nutzungshäufigkeit der Konten widerspiegelt.
**Ziel:** Eine intuitive Drag-and-Drop-Oberfläche bereitstellen, mit der Benutzer die Kontogruppen nach ihren Wünschen anordnen können. Die neue Reihenfolge muss persistent gespeichert und mit dem Backend synchronisiert werden.

## 2. Ziele

*   **Benutzerfreundlichkeit:** Ermöglichen einer einfachen und intuitiven Neuanordnung der Kontogruppen per Drag & Drop.
*   **Persistenz:** Sicherstellen, dass die vom Benutzer festgelegte Reihenfolge gespeichert und bei jedem App-Start wiederhergestellt wird.
*   **Synchronisation:** Die neue `sortOrder` muss zuverlässig mit dem Backend synchronisiert werden, um Konsistenz über verschiedene Geräte hinweg zu gewährleisten.

## 3. User Stories

*   **Als Benutzer möchte ich** meine Kontogruppen per Drag & Drop verschieben können, **damit** ich die für mich wichtigsten Gruppen ganz oben sehe.
*   **Als Benutzer möchte ich**, dass meine benutzerdefinierte Sortierung gespeichert wird, **damit** ich sie nicht bei jedem Öffnen der App neu einstellen muss.
*   **Als Benutzer erwarte ich**, dass die Sortierung auf allen meinen Geräten gleich ist, **damit** ich eine konsistente Ansicht meiner Finanzen habe.

## 4. Funktionale Anforderungen

1.  **Drag & Drop Aktivierung:**
    *   Die Drag-and-Drop-Funktionalität soll in der [`src/views/AccountsView.vue`](src/views/AccountsView.vue:1) für die Liste der `AccountGroupCard`-Komponenten implementiert werden.
    *   Die Bibliothek `Muuri` soll für die Umsetzung verwendet werden.
2.  **Drag Handle:**
    *   Die gesamte Fläche der [`src/components/account/AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) soll als "Handle" für die Drag-Aktion dienen. Ein separates Icon ist nicht erforderlich.
3.  **Visuelles Feedback:**
    *   Während des Ziehens soll die gezogene Karte visuell hervorgehoben werden (z.B. durch einen leichten Schatten oder eine angepasste Deckkraft).
    *   `Muuri` bietet hierfür Standard-CSS-Klassen (`muuri-item-dragging`), die genutzt werden können.
4.  **Sortierungslogik:**
    *   Wenn eine Kontogruppe an eine neue Position gezogen wird, wird die `dragEnd`- oder `move`-Veranstaltung von `Muuri` ausgelöst.
    *   Nach Abschluss der Drag-Aktion wird die neue Reihenfolge der Kontogruppen im Frontend ermittelt.
5.  **Persistierung und Synchronisation:**
    *   Nachdem die neue Reihenfolge ermittelt wurde, wird für **alle** Kontogruppen das `sortOrder`-Feld neu indiziert (beginnend bei 0 für das erste Element, 1 für das zweite usw.).
    *   Ein **Batch-Update** soll an den `accountStore` gesendet werden, um die `sortOrder` aller betroffenen Kontogruppen zu aktualisieren.
    *   Der `accountStore` ist dafür verantwortlich, die Änderungen in die `SyncQueue` einzutragen, um die Daten mit dem Backend zu synchronisieren.

## 5. Nicht-Ziele (Out of Scope)

*   Die Sortierung einzelner Konten (`AccountCard`) innerhalb einer Kontogruppe ist **nicht** Teil dieses Features.
*   Eine Sortierung über mehrere Spalten hinweg ist nicht vorgesehen. Die Ansicht bleibt einspaltig.
*   Komplexe Animationen über das von `Muuri` bereitgestellte Standardverhalten hinaus sind nicht erforderlich.

## 6. Design-Überlegungen

*   Die Implementierung sollte sich nahtlos in das bestehende Design von FinWise einfügen.
*   Die von `Muuri` hinzugefügten CSS-Klassen (`.muuri-item-dragging`, `.muuri-item-releasing`) sollten genutzt werden, um das visuelle Feedback konsistent zu gestalten.

## 7. Technische Überlegungen

*   **Bibliothek:** `Muuri` (Version 0.9.5 oder höher) muss dem Projekt als Abhängigkeit hinzugefügt werden.
*   **Initialisierung:** `Muuri` muss in der `onMounted`-Lebenszyklus-Hook der `AccountsView.vue` initialisiert werden.
*   **Datenbindung:** Die `v-for`-Schleife, die die `AccountGroupCard`-Komponenten rendert, dient als Basis für die `Muuri`-Items.
*   **Event-Handling:** Der `move`- oder `dragEnd`-Event von `Muuri` muss abgefangen werden, um die Logik zur Neuindizierung und Speicherung der `sortOrder` auszulösen.
*   **Store-Update:** Eine neue Action im `accountStore` (z.B. `updateAccountGroupOrder`) sollte erstellt werden, die ein Array von `{id: string, sortOrder: number}` Objekten entgegennimmt und die Batch-Aktualisierung durchführt.

## 8. Erfolgsmetriken

*   **Funktionalität:** Benutzer können die Reihenfolge der Kontogruppen erfolgreich per Drag & Drop ändern.
*   **Persistenz:** Die geänderte Reihenfolge bleibt nach einem Neuladen der Seite oder einem Neustart der App erhalten.
*   **Datenkonsistenz:** Die `sortOrder` im Frontend (IndexedDB) und Backend (SQLite) ist nach der Synchronisation identisch.

## 9. Offene Fragen

*   Keine offenen Fragen zum jetzigen Zeitpunkt. Die Anforderungen sind durch die Benutzerauswahl klar definiert.
