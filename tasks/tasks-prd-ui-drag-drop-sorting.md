## Relevant Files

- [`src/views/AccountView.vue`](src/components/account/AccountView.vue) - Enthält die Hauptansicht für Account-Gruppen und wird für die Gruppensortierung angepasst.
- [`src/components/account/AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue) - Enthält die Konten innerhalb einer Gruppe und wird für die Kontensortierung und das Verschieben zwischen Gruppen angepasst.
- [`src/components/account/AccountCard.vue`](src/components/account/AccountCard.vue) - Wird für das Styling des Drag-Handles und des Cursors angepasst.
- [`src/stores/accountStore.ts`](src/stores/accountStore.ts) - Enthält die Pinia Store-Methoden zur Aktualisierung der `sortOrder`-Werte und `accountGroupId`.
- [`src/stores/accountService.ts`](src/stores/accountService.ts) - Enthält die Businesslogik zwischen UI Ebene und Data Layer Store. Alle Logikfunktionen hier rein.
- [`package.json`](package.json) - Wird für die Installation der neuen Abhängigkeiten (`vuedraggable`, `sortablejs`) aktualisiert.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Setup und Installation der Drag-&-Drop-Bibliothek
  - [ ] 1.1 Installiere `vuedraggable@next` und `sortablejs` über npm.
  - [ ] 1.2 Importiere die `Draggable`-Komponente in den relevanten Vue-Komponenten (`AccountView.vue`, `AccountGroupCard.vue`).
- [ ] 2.0 Implementierung der Drag-&-Drop-Sortierung für Account-Gruppen in `AccountView.vue`
  - [ ] 2.1 Füge die `draggable`-Komponente in `AccountView.vue` ein, um die Sortierung der Account-Gruppen zu ermöglichen.
  - [ ] 2.2 Konfiguriere die `draggable`-Komponente für die Gruppensortierung.
  - [ ] 2.3 Implementiere den Event-Handler für das `end`-Ereignis, um `accountStore.batchUpdateGroupOrder(newOrder)` aufzurufen.
- [ ] 3.0 Implementierung der Drag-&-Drop-Sortierung für Konten innerhalb einer `AccountGroupCard.vue`
  - [ ] 3.1 Füge die `draggable`-Komponente in `AccountGroupCard.vue` ein, um die Sortierung der Konten innerhalb einer Gruppe zu ermöglichen.
  - [ ] 3.2 Konfiguriere die `draggable`-Komponente für die Kontensortierung innerhalb der Gruppe.
  - [ ] 3.3 Implementiere den Event-Handler für das `end`-Ereignis, um `accountStore.batchUpdateAccountOrder({ groupId, newOrder })` aufzurufen.
  - [ ] 3.4 Definiere das Drag-Handle (`handle=".card-body"`) in `AccountGroupCard.vue`.
- [ ] 4.0 Implementierung des kontoübergreifenden Verschiebens zwischen Account-Gruppen
  - [ ] 4.1 Konfiguriere die `draggable`-Komponente in `AccountGroupCard.vue` mit `group: { name: "accounts", pull: true, put: true }` für container-übergreifende Verschiebung.
  - [ ] 4.2 Implementiere den Event-Handler für das `end`-Ereignis, um `accountStore.moveAccountToGroup(accountId, newGroupId, newOrder)` aufzurufen, wenn ein Konto in eine andere Gruppe verschoben wird.
- [ ] 5.0 Implementierung des visuellen Feedbacks (Animationen, Cursor, Ghost-Class)
  - [ ] 5.1 Setze `animation="300"` für weiche Übergänge in den `draggable`-Komponenten.
  - [ ] 5.2 Definiere die `ghost-class="ghost"` in den `draggable`-Komponenten und füge das entsprechende CSS (`.ghost { transform: rotate(-2deg); }`) hinzu.
  - [ ] 5.3 Passe den Cursor in `AccountCard.vue` auf `cursor: grab` und `cursor: grabbing` an.
