# PRD: UI-seitige Drag-&-Drop-Sortierung in der Account-View

## 1. Einführung/Übersicht

Dieses Dokument beschreibt die Produktanforderungen für die Implementierung einer UI-seitigen Drag-&-Drop-Sortierungsfunktion in der Account-View von FinWise. Die aktuelle manuelle Sortierung von Account-Gruppen und Konten ist umständlich und bietet Nutzern keine intuitive Möglichkeit, ihre Finanzübersicht nach persönlichen Präferenzen zu organisieren. Ziel ist es, eine nahtlose und visuell ansprechende Drag-&-Drop-Funktionalität zu ermöglichen, die die Benutzerfreundlichkeit erheblich verbessert.

Die Persistenz und Synchronisation der Änderungen erfolgt über den bereits bestehenden Sync-Service, sodass sich diese Spezifikation ausschließlich auf die UI-Implementierung konzentriert.

## 2. Ziele

*   **Gruppensortierung:** Die Reihenfolge der Account-Gruppen in der linken Spalte (`AccountView.vue`) soll per Drag-&-Drop änderbar sein.
*   **Kontensortierung:** Konten sollen innerhalb einer Gruppe (`AccountGroupCard.vue`) frei per Drag-&-Drop sortierbar sein.
*   **Container-übergreifende Verschiebung:** Ein Konto soll von einer Account-Gruppe in eine andere verschoben werden können.
*   **Visuelles Feedback:** Der Drag-&-Drop-Vorgang soll durch weiche Transitionen, leichte Rotation des gezogenen Elements und angepasste Cursor visuell unterstützt werden.
*   **Store-Interaktion:** Nach Abschluss eines Drag-&-Drop-Vorgangs sollen die entsprechenden Pinia Store-Methoden aufgerufen werden, um die neuen `sortOrder`-Werte und gegebenenfalls die `accountGroupId` zu aktualisieren.

## 3. User Stories

*   **User Story 1:** „Als Nutzer möchte ich die Account-Gruppen in der linken Übersicht per Drag-&-Drop sortieren.“
    *   **AK1.1:** Beim Ziehen rotiert die Gruppe leicht.
    *   **AK1.2:** Nach Loslassen ruft das UI `accountStore.batchUpdateGroupOrder(newOrder)` auf.
    *   **AK1.3:** Die neuen Positionen werden in der UI sofort angezeigt.
*   **User Story 2:** „Als Nutzer möchte ich Konten innerhalb einer Gruppe neu ordnen.“
    *   **AK2.1:** Innerhalb der Gruppe kann ich Konten verschieben.
    *   **AK2.2:** Nach Loslassen ruft das UI `accountStore.batchUpdateAccountOrder({ groupId, newOrder })` auf.
*   **User Story 3:** „Als Nutzer möchte ich ein Konto von einer Gruppe in eine andere ziehen.“
    *   **AK3.1:** Ziehen in eine andere Gruppe funktioniert.
    *   **AK3.2:** Das UI ruft `accountStore.moveAccountToGroup(accountId, newGroupId, newOrder)` auf.
    *   **AK3.3:** Alte und neue Gruppe zeigen sofort aktualisierte Reihenfolgen.

## 4. Funktionale Anforderungen

*   Das System muss die Reihenfolge der Account-Gruppen per Drag-&-Drop änderbar machen.
*   Jede Account-Gruppe muss intern ein `sortOrder: number` besitzen.
*   Das System muss die freie Sortierung von Konten innerhalb einer Gruppe per Drag-&-Drop ermöglichen.
*   Das System muss das Verschieben eines Kontos von einer Gruppe in eine andere per Drag-&-Drop ermöglichen.
*   Jedes Konto muss intern ein `sortOrder: number` und `accountGroupId` besitzen.
*   Das System muss eine weiche Transition (300 ms) beim Verschieben von Elementen anzeigen.
*   Das System muss eine leichte Rotation des gezogenen Elements (`ghost-class`) anzeigen.
*   Das System muss den Cursor auf `grab` ändern, wenn ein Element zum Ziehen bereit ist, und auf `grabbing`, wenn es gezogen wird.
*   Nach jedem Drag-End muss eine Store-Methode aufgerufen werden, die die neuen `sortOrder`-Werte und gegebenenfalls die neue `accountGroupId` über den bestehenden Sync-Service speichert.
    *   Für Gruppensortierung: `accountStore.batchUpdateGroupOrder(newOrder)`
    *   Für Kontensortierung innerhalb einer Gruppe: `accountStore.batchUpdateAccountOrder(updates)`
    *   Für Kontenverschiebung zwischen Gruppen: `accountStore.moveAccountToGroup(accountId, newGroupId, newOrder)`
*   Die UI muss die neuen Positionen sofort nach dem Loslassen anzeigen.
*   Die `draggable` Komponente muss in `AccountView.vue` für die Gruppensortierung verwendet werden.
*   Die `draggable` Komponente muss in `AccountGroupCard.vue` für die Kontensortierung verwendet werden.
*   Die `AccountCard.vue` muss das Drag-Handle und Styling für den Cursor bereitstellen.

## 5. Non-Goals (Nicht im Scope)

*   Die Implementierung der Persistenz- und Synchronisationslogik im Backend oder im Sync-Service ist nicht Teil dieser Anforderung. Diese Funktionalität wird vom bestehenden System bereitgestellt.
*   Die Unterstützung von Touch-Bedienung für Drag-&-Drop ist explizit *nicht* Teil dieser Anforderung und wird in einem separaten Task behandelt. Der Fokus liegt ausschließlich auf der Maus-Interaktion.

## 6. Design Considerations

*   **Visuelles Feedback:**
    *   `animation="300"` für weiche Übergänge.
    *   `ghost-class="ghost"` mit CSS `.ghost { transform: rotate(-2deg); }` für leichte Rotation.
    *   Cursor-Anpassung: `cursor: grab` und `cursor: grabbing` in `AccountCard.vue`.
*   **Drag-&-Drop-Gruppierung:**
    *   `group: { name: "accounts", pull: true, put: true }` in `AccountGroupCard.vue` für container-übergreifende Verschiebung von Konten.
*   **Drag-Handle:**
    *   `handle=".card-body"` in `AccountGroupCard.vue` definiert den Klick-Bereich zum Greifen der Konten.

## 7. Technische Überlegungen

*   **Frontend-Technologien:** Vue 3 + TypeScript, Pinia (insbesondere `accountStore`).
*   **Drag-&-Drop-Bibliothek:** `vuedraggable@next` (ein Wrapper für SortableJS).
*   **Installation:** Die Bibliotheken müssen über npm installiert werden:
    ```bash
    npm install vuedraggable@next sortablejs
    ```
*   **Import:** Die `Draggable`-Komponente muss in den relevanten Vue-Komponenten importiert werden:
    ```typescript
    import Draggable from "vuedraggable";
    ```
*   **Komponenten-Integration:**
    *   `AccountView.vue` wird die `draggable`-Komponente für die Sortierung der Account-Gruppen verwenden.
    *   `AccountGroupCard.vue` wird die `draggable`-Komponente für die Sortierung der Konten innerhalb und zwischen Gruppen verwenden.
    *   `AccountCard.vue` wird für das Styling des Drag-Handles und des Cursors angepasst.

## 8. Erfolgsmetriken

Der Erfolg dieser Funktion wird anhand folgender Kriterien gemessen:

*   Alle in Abschnitt 3 ("User Stories & Akzeptanzkriterien") definierten Akzeptanzkriterien sind erfüllt.
*   Die technische Umsetzung entspricht den Vorgaben der Spezifikation und den Best Practices für Vue.js und Drag-&-Drop-Implementierungen.
*   Positives, qualitatives Feedback von Testern bezüglich der Intuition und Flüssigkeit der Drag-&-Drop-Funktion.

## 9. Offene Fragen

*   Keine offenen Fragen. Alle notwendigen Informationen für die Implementierung sind vorhanden.
