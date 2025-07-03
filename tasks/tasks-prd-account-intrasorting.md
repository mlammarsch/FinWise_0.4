## Relevant Files

- `src/components/account/AccountGroupCard.vue` - Hauptkomponente, in der die Muuri.js-Instanz für die Konten-Sortierung initialisiert und der `dragEnd`-Event behandelt wird.
- `src/components/account/AccountCard.vue` - Komponente für die einzelne Kontokarte. Hier werden die zusätzlichen Drag-Handles (Bild, Name) definiert.
- `src/services/AccountService.ts` - Enthält die Geschäftslogik, einschließlich der neuen, gedebouncten Funktion zum Speichern der Sortierreihenfolge.
- `src/stores/accountStore.ts` - Pinia-Store, der die `sortOrder` der Konten im State aktualisiert und die Persistenz über den `TenantDbService` anstößt.
- `src/views/AccountsView.vue` - Stellt sicher, dass die Konten innerhalb der Gruppen korrekt nach `sortOrder` sortiert angezeigt werden.

### Notes

- Die Tests werden vom Product Owner manuell vorgenommen. Keine Testszenarien schreiben!

## Tasks

- [x] 1.0 Muuri.js-Integration in der AccountGroupCard-Komponente vorbereiten
  - [x] 1.1 Eine neue Muuri-Instanz oder eine Anpassung der bestehenden in `AccountGroupCard.vue` auf dem `onMounted`-Hook initialisieren, die auf die `AccountCard`-Elemente abzielt.
  - [x] 1.2 Sicherstellen, dass die Muuri-Optionen das Ziehen innerhalb des Containers (`dragContainer`) und die korrekte Drag-Handle-Klasse (`dragHandle: '.drag-handle'`) verwenden.
  - [x] 1.3 Die Kontenliste in der `AccountGroupCard.vue` so anpassen, dass sie reaktiv ist und immer nach `sortOrder` sortiert wird, bevor sie gerendert wird (z.B. über ein `computed` Property).

- [ ] 2.0 Drag-End-Event-Handler für die Sortierlogik implementieren
  - [ ] 2.1 Einen Event-Listener für das `dragEnd`-Ereignis der Muuri-Instanz in `AccountGroupCard.vue` hinzufügen.
  - [ ] 2.2 Im Handler die neue Reihenfolge der DOM-Elemente aus der Muuri-Instanz abrufen (`grid.getItems()`).
  - [ ] 2.3 Eine Logik implementieren, die die `sortOrder` aller Konten in der betroffenen Gruppe basierend auf ihrer neuen Position im Array neu berechnet (Index 0 -> `sortOrder: 0`, etc.).
  - [ ] 2.4 Prüfen, ob das Konto in eine neue Gruppe verschoben wurde. Falls ja, die `accountGroupId` des Kontos aktualisieren und die Sortierlogik für Quell- und Zielgruppe auslösen.
  - [ ] 2.5 Die aktualisierte Liste der Konten an die neue, gedebouncte Speicherfunktion im `AccountService` übergeben.

- [ ] 3.0 Debounced-Speicherfunktion im AccountService erstellen
  - [ ] 3.1 In `AccountService.ts` eine neue Methode `updateAccountSortOrder` erstellen, die eine Liste von Konten akzeptiert.
  - [ ] 3.2 Innerhalb dieser Methode einen Debounce-Mechanismus mit `setTimeout` und `clearTimeout` implementieren, der eine Verzögerung von 3 Sekunden hat.
  - [ ] 3.3 Nach Ablauf des Timers die Methode im `accountStore` aufrufen, um die Änderungen für alle betroffenen Konten zu persistieren.

- [ ] 4.0 Datenpersistierung im AccountStore und reaktive Anzeige sicherstellen
  - [ ] 4.1 Im `accountStore.ts` eine Methode `updateMultipleAccounts` erstellen, die eine Liste von aktualisierten Konten entgegennimmt.
  - [ ] 4.2 Diese Methode soll für jedes Konto in der Liste die `updateAccount`-Logik aufrufen, um die Änderungen im State zu speichern und sie in die Sync-Queue für die IndexedDB-Persistierung einzureihen.
  - [ ] 4.3 Sicherstellen, dass die `AccountsView.vue` und `AccountGroupCard.vue` reaktiv auf die Änderungen im Store reagieren und die neue Sortierung ohne manuelles Neuladen anzeigen.

- [ ] 5.0 UI-Anpassungen am Drag-Handle der AccountCard vornehmen
  - [ ] 5.1 In `AccountCard.vue` die Klasse `drag-handle` nicht nur dem Icon, sondern auch dem Container für das Bild und dem Kontonamen hinzufügen, damit diese ebenfalls als Greifpunkte dienen.
  - [ ] 5.2 Überprüfen, ob das Styling während des Ziehens (Schatten, Opazität) konsistent mit dem der `AccountGroupCard` ist.
