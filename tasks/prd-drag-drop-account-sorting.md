# Product Requirements Document: Drag-and-Drop-Sortierung für Konten

## 1. Einführung/Überblick

Dieses Dokument beschreibt die Anforderungen für die Implementierung einer Drag-and-Drop-Funktionalität zur Sortierung von Konten ([`AccountCard.vue`](src/components/account/AccountCard.vue:1)) innerhalb und zwischen Kontogruppen ([`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1)). Benutzer sollen in der Lage sein, die Reihenfolge ihrer Konten intuitiv per Drag-and-Drop zu ändern und Konten zwischen verschiedenen Gruppen zu verschieben. Die Änderungen an der Sortierreihenfolge (`sortOrder`) und der Gruppenzugehörigkeit (`accountGroupId`) müssen persistent gespeichert und mit dem Backend synchronisiert werden.

Die Implementierung erfolgt unter Verwendung der [Muuri-Bibliothek](docs/Muuri.md), deren Dokumentation zu beachten ist.

Zusätzlich wird im Rahmen dieses Features ein Refactoring durchgeführt, bei dem die Geschäftslogik für die Sortierung aus dem Pinia-Store ([`accountStore.ts`](src/stores/accountStore.ts:1)) in den entsprechenden Service ([`AccountService.ts`](src/services/AccountService.ts:1)) verlagert wird.

## 2. Ziele

*   **Verbesserte Benutzerfreundlichkeit:** Benutzern eine intuitive Möglichkeit zur Organisation ihrer Konten bieten.
*   **Persistente Sortierung:** Sicherstellen, dass die vom Benutzer festgelegte Reihenfolge der Konten gespeichert und nach einem Neuladen der Anwendung wiederhergestellt wird.
*   **Flexible Kontenverwaltung:** Das Verschieben von Konten zwischen verschiedenen Gruppen ermöglichen.
*   **Code-Qualität:** Geschäftslogik zur Sortierung im `AccountService` zentralisieren und aus dem `accountStore` entfernen.

## 3. User Stories

*   **Als Benutzer möchte ich** die Reihenfolge meiner Konten innerhalb einer Gruppe per Drag-and-Drop ändern, **damit** ich meine wichtigsten Konten an erster Stelle sehen kann.
*   **Als Benutzer möchte ich** ein Konto von einer Gruppe in eine andere ziehen können, **damit** ich meine Finanzübersicht einfach neu strukturieren kann. Dabei sollen sich auch die Gruppensalden über die beinhalteten Konten erneut berechnen
*   **Als Benutzer möchte ich**, dass meine Sortierung gespeichert wird, **damit** ich sie nicht bei jedem Besuch neu einstellen muss.

## 4. Funktionale Anforderungen

1.  **Drag-and-Drop-Initialisierung:**
    *   In der Komponente [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) soll für jede Gruppe eine eigene Muuri-Instanz initialisiert werden, um die darin enthaltenen `AccountCard`-Elemente sortierbar zu machen.
    *   Die Muuri-Instanzen müssen so konfiguriert werden, dass sie das Ziehen von Elementen zwischen den verschiedenen Gruppen-Instanzen erlauben (siehe `dragSort` Option in [`docs/Muuri.md`](docs/Muuri.md:684)).
2.  **Sortierung innerhalb einer Gruppe:**
    *   Der Benutzer muss in der Lage sein, eine [`AccountCard.vue`](src/components/account/AccountCard.vue:1) innerhalb der Liste einer [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) vertikal zu verschieben.
    *   Nach dem Loslassen (`dragEnd`-Event) muss die neue Reihenfolge der Konten in dieser Gruppe ermittelt werden.
3.  **Verschieben zwischen Gruppen:**
    *   Der Benutzer muss eine [`AccountCard.vue`](src/components/account/AccountCard.vue:1) von einer [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) in eine andere ziehen können.
    *   Beim Loslassen in einer neuen Gruppe müssen die `accountGroupId` des verschobenen Kontos aktualisiert und die `sortOrder` für die Quell- und die Zielgruppe neu berechnet werden.
    *   Das verschobene Konto wird an der genauen Drop-Position in der Zielliste eingefügt.
    *   Datentechnisch muss im Konto die Gruppenzuordnungs ID gewechselt werden.
    *   Der Saldo der [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) muss sich bei allen betroffenen Gruppen neu berechnen (Gruppe des Verlassens und Gruppe der Integration des Kontos.). Siehe [`BalanceService.ts`](src/services/BalanceService.ts:1).
4.  **Visuelles Feedback:**
    *   Während des Ziehens wird ein Platzhalter an der potenziellen neuen Position des Kontos angezeigt.
    *   Es ist kein spezielles visuelles Feedback für die Ziel-Gruppe notwendig.
5.  **Persistierung und Synchronisation:**
    *   Nach einer Drag-and-Drop-Aktion (Sortierung oder Verschieben) soll eine Wartezeit von 5 Sekunden beginnen (Debouncing).
    *   Wenn innerhalb dieser 5 Sekunden keine weitere Aktion erfolgt, wird eine Batch-Aktualisierung an den `AccountService` gesendet.
    *   Diese Aktualisierung enthält alle betroffenen Konten mit ihrer neuen `sortOrder` und ggf. der neuen `accountGroupId`.
    *   Der `AccountService` ist für die Kommunikation mit dem `accountStore` und die anschließende Synchronisation mit dem Backend verantwortlich.
6.  **Dynamische Layout-Anpassung:**
    *   Wenn Konten hinzugefügt, entfernt oder zwischen Gruppen verschoben werden, ändert sich die Höhe der [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1).
    *   Eine `watch`-Funktion auf die Anzahl der Konten pro Gruppe soll bei Änderungen `muuri.layout()` aufrufen, um die Darstellung korrekt anzupassen.
7.  **Refactoring der Geschäftslogik:**
    *   Die Methode `updateAccountGroupOrder` aus [`accountStore.ts`](src/stores/accountStore.ts:391) muss in den [`AccountService.ts`](src/services/AccountService.ts:1) verschoben werden.
    *   Eine neue Methode im `AccountService` wird erstellt, z.B. `updateAccountOrder(groupId: string, accountIds: string[])`, die die `sortOrder` für alle Konten in einer Gruppe neu berechnet und die Updates an den Store weiterleitet.
    *   Eine weitere Methode, z.B. `moveAccountToGroup(accountId: string, newGroupId: string, newIndex: number)`, wird im `AccountService` erstellt, um die `accountGroupId` zu ändern und die `sortOrder` in beiden betroffenen Gruppen neu zu berechnen.
    *   Die Komponente [`AccountsView.vue`](src/views/AccountsView.vue:1) muss angepasst werden, um die neuen Methoden aus dem `AccountService` anstelle der alten Store-Action aufzurufen.

## 5. Non-Goals (Out of Scope)

*   Es werden keine expliziten Unit- oder Integrationstests geschrieben. Die Verifizierung erfolgt manuell.
*   Die Sortierung von Kontogruppen selbst ([`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1)) ist nicht Teil dieses Features (bereits vorhanden).
*   Es wird keine UI für das manuelle Ändern der `sortOrder` (z.B. über Pfeiltasten) implementiert.
*   Es wird kein "Rückgängig"-Button für Sortieraktionen implementiert.

## 6. Design Considerations

*   Die `AccountCard.vue` sollte einen dezenten visuellen Indikator (z.B. einen "Drag-Handle") erhalten, um dem Benutzer zu signalisieren, dass sie verschiebbar ist.
*   Während des Ziehens kann die Deckkraft der gezogenen Karte leicht reduziert werden, um sie vom Platzhalter zu unterscheiden.

## 7. Technical Considerations

*   **Bibliothek:** Muuri.js muss wie in [`docs/Muuri.md`](docs/Muuri.md:1) beschrieben konfiguriert werden.
*   **Performance:** Die Batch-Verarbeitung mit Debouncing ist entscheidend, um bei schnellen, wiederholten Sortiervorgängen eine Überlastung von Anfragen an das Backend zu vermeiden.
*   **Datenintegrität:** Die Neuberechnung der `sortOrder` muss atomar für die gesamte Gruppe erfolgen, um inkonsistente Zustände zu vermeiden. Gleiches gild für den AccountGroup Saldo.
*   **State Management:** Die Logik zur Berechnung der neuen Sortierreihenfolgen und Gruppenzugehörigkeiten muss vollständig im `AccountService` gekapselt sein. Der `accountStore` dient nur noch zur reaktiven Speicherung des Zustands und zur Kommunikation mit der Persistenzschicht (`TenantDbService`).

## 8. Success Metrics

*   Der Benutzer kann die Reihenfolge der Konten innerhalb einer Gruppe erfolgreich per Drag-and-Drop ändern.
*   Der Benutzer kann ein Konto erfolgreich von einer Gruppe in eine andere verschieben.
*   Die neue Reihenfolge und Gruppenzugehörigkeit wird korrekt gespeichert und ist nach einem Neuladen der Seite persistent.
*   Die Geschäftslogik für die Sortierung ist aus dem Store in den Service verlagert.

## 9. Open Questions

*   Keine offenen Fragen zum jetzigen Zeitpunkt.
