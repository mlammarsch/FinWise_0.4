# Product Requirements Document: Drag-and-Drop-Sortierung für Konten

## 1. Einführung/Übersicht

Dieses Dokument beschreibt die Anforderungen für die Implementierung einer Drag-and-Drop-Sortierfunktion für einzelne Konten (`AccountCard.vue`) innerhalb ihrer jeweiligen Kontogruppen (`AccountGroupCard.vue`). Die Funktionalität basiert auf der bereits für die Kontogruppen in der `AccountsView.vue` verwendeten `Muuri.js`-Bibliothek. Ziel ist es, dem Benutzer eine intuitive Möglichkeit zu geben, die Reihenfolge seiner Konten per Drag-and-Drop zu ändern und diese Reihenfolge persistent zu speichern.

## 2. Ziele

*   **Benutzerfreundlichkeit:** Eine einfache und visuell ansprechende Methode zur Sortierung von Konten bereitstellen.
*   **Persistenz:** Die vom Benutzer festgelegte Sortierung muss gespeichert und bei erneutem Laden der Ansicht korrekt wiederhergestellt werden.
*   **Konsistenz:** Die Implementierung soll sich an der bestehenden Drag-and-Drop-Logik für Kontogruppen orientieren.
*   **Performance:** Die Sortierung und das Speichern sollen performant und ohne spürbare Verzögerungen für den Benutzer ablaufen.

## 3. User Stories

*   **Als Benutzer möchte ich** meine Konten innerhalb einer Gruppe per Drag-and-Drop verschieben können, **damit ich** sie in einer für mich logischen Reihenfolge anordnen kann (z.B. nach Wichtigkeit oder Nutzungshäufigkeit).
*   **Als Benutzer erwarte ich,** dass die von mir festgelegte Reihenfolge der Konten gespeichert wird, **sodass** ich sie nicht bei jedem Besuch der Seite neu sortieren muss.
*   **Als Benutzer möchte ich,** dass die Sortierung flüssig funktioniert, auch wenn ich ein Konto schnell an eine andere Position ziehe.

## 4. Funktionale Anforderungen

1.  **Drag-and-Drop-Aktivierung:** Die Drag-and-Drop-Funktionalität für `AccountCard.vue`-Komponenten muss innerhalb des `AccountGroupCard.vue`-Containers aktiviert werden. Hierfür ist bereits eine Muuri Instanz aktiv.
2.  **Sortierlogik:**
    *   Nach Abschluss einer Drag-and-Drop-Aktion (beim Loslassen der Maustaste, `dragEnd`-Event von Muuri) muss die neue Reihenfolge der Konten innerhalb der betroffenen Kontogruppe ermittelt werden.
    *   Die `sortOrder`-Eigenschaft aller Konten in dieser Gruppe muss neu zugewiesen werden. Das oberste Konto erhält `sortOrder: 0`, das zweite `sortOrder: 1` und so weiter.
3.  **Datenpersistierung:**
    *   Nachdem die neue `sortOrder` berechnet wurde, soll eine Verzögerung von 3 Sekunden abgewartet werden.
    *   Wenn innerhalb dieser 3 Sekunden eine weitere Sortierung erfolgt, wird der Timer zurückgesetzt (Debouncing). Nur die letzte stabile Sortierung wird gespeichert.
    *   Nach Ablauf der 3 Sekunden wird die neue Sortierreihenfolge aller betroffenen Konten über den `AccountService.ts` und den `accountStore.ts` an die Persistenzschicht (IndexedDB und Sync-Queue) übergeben.
4.  **Anzeige-Sortierung:** Die `AccountCard.vue`-Komponenten innerhalb einer `AccountGroupCard.vue` müssen initial und nach jeder Änderung aufsteigend nach ihrer `sortOrder`-Eigenschaft gerendert werden.
5.  **Datenintegrität bei Verschiebung:** Obwohl das Verschieben zwischen Gruppen (Inter-Sortierung) nicht Teil dieser Anforderung ist, soll die `accountGroupId` des Kontos korrekt aktualisiert werden, falls es technisch durch die Muuri-Konfiguration in eine andere Gruppe gezogen wird. Die Logik zur Neusortierung der Quell- und Zielgruppe muss dann korrekt greifen.
6.  **UI-Feedback:** Während der 3-sekündigen Speicherverzögerung wird **kein** visueller Indikator (z.B. "Speichern...") angezeigt. Der Prozess läuft für den Benutzer unsichtbar im Hintergrund ab.
7.  **Aktualisierung der Ansicht:** Nach erfolgreicher Persistierung der neuen Sortierung muss sichergestellt werden, dass die `AccountsView.vue` die Änderungen widerspiegelt, falls dies nicht bereits reaktiv geschieht.

## 5. Non-Goals (Außerhalb des Scopes)

*   **Inter-Container-Sortierung:** Die explizite Implementierung der UI/UX für das Verschieben von Konten zwischen verschiedenen Kontogruppen ist nicht Teil dieser Anforderung. Die bestehende Muuri-Konfiguration erlaubt dies zwar technisch, der Fokus liegt aber auf der korrekten Persistierung der *Intra*-Sortierung.
*   **Visuelles Feedback beim Speichern:** Es wird bewusst auf Ladeindikatoren oder andere visuelle Hinweise während der 3-Sekunden-Verzögerung verzichtet.
*   **Rückgängig-Funktion:** Eine Funktion zum Rückgängigmachen der Sortierung wird nicht implementiert.

## 6. Design-Anforderungen

*   Die `AccountCard.vue` soll einen sichtbaren "Drag-Handle" haben, der dem Benutzer signalisiert, dass das Element verschiebbar ist. Dies ist bereits durch das `drag-handle`-Icon in der Komponente vorgesehen. Aber auch das Bild und der Kontoname soll gegrabbt werden können und somit als weitere "Drag-Handles" erweitert werden
*   Das Erscheinungsbild während des Ziehens (z.B. Schatten, Opazität) soll sich an der bestehenden Implementierung für `AccountGroupCard.vue` orientieren.

## 7. Technische Anforderungen

*   **Bibliothek:** `Muuri.js` muss in der `AccountGroupCard.vue` initialisiert werden, um die `AccountCard.vue`-Elemente zu verwalten.
*   **Event-Handling:** Der `dragEnd`-Event von Muuri muss verwendet werden, um die Sortier- und Speicherlogik auszulösen.
*   **Debouncing:** Ein Debounce-Mechanismus (z.B. über `setTimeout`/`clearTimeout`) muss für die 3-sekündige Speicherverzögerung implementiert werden.
*   **Service-Layer:** Die Aktualisierung der `sortOrder` muss über den `AccountService.ts` erfolgen, der die Änderungen an den `accountStore.ts` weiterleitet.
*   **Datenmodell:** Die `sortOrder` (number) in der `Account`-Typdefinition ist das zu aktualisierende Feld.

## 8. Erfolgsmetriken

*   **Funktionalität:** Ein Benutzer kann die Reihenfolge der Konten innerhalb einer Gruppe erfolgreich und persistent ändern.
*   **Stabilität:** Die Anwendung stürzt nicht ab und es treten keine Dateninkonsistenzen nach wiederholtem, schnellem Sortieren auf.
*   **Korrektheit:** Nach dem Neuladen der Seite wird die zuletzt gespeicherte Sortierung der Konten korrekt angezeigt.

## 9. Offene Fragen

*   Keine. Die klärenden Fragen wurden beantwortet.
