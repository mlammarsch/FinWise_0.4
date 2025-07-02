## Relevant Files

- `src/views/AccountsView.vue` - Hauptansicht, in der die `Muuri`-Instanz initialisiert und die Drag&Drop-Logik implementiert wird.
- `src/components/account/AccountGroupCard.vue` - Die Komponente, die per Drag & Drop verschoben wird. Eventuell sind hier kleine Anpassungen für das Styling nötig.
- `src/stores/accountStore.ts` - Der Pinia-Store, der die neue Action für das Batch-Update der `sortOrder` enthalten wird.
- `tests/unit/stores/accountStore.test.ts` - (Optional) Unit-Tests für die neue Store-Action.
- `package.json` - Wird durch das Hinzufügen der `Muuri`-Abhängigkeit modifiziert.

### Notes

- Unit-Tests sollten typischerweise neben den Codedateien liegen, die sie testen.
- Verwende `npm run test:unit` um Tests auszuführen.

## Tasks

- [x] 1.0 Setup und Integration von Muuri
  - [x] 1.1 `Muuri` als Projektabhängigkeit hinzufügen (`npm install muuri` oder `yarn add muuri`).
  - [x] 1.2 `Muuri` in `src/views/AccountsView.vue` importieren.
  - [x] 1.3 Eine `Muuri`-Instanz in der `onMounted`-Hook von `AccountsView.vue` initialisieren und an das Grid-Element binden.
- [x] 2.0 Implementierung der Drag & Drop-Funktionalität
  - [x] 2.1 Sicherstellen, dass die `v-for`-Schleife für `AccountGroupCard` die notwendigen Attribute für `Muuri`-Items hat.
  - [x] 2.2 Die gesamte `AccountGroupCard`-Komponente als Drag-Handle konfigurieren. Dabei beachten, dass die 3-Pinkt-Button Menüstruktur weiterhin bedienbar bleibt.
  - [x] 2.3 Visuelles Feedback für den Drag-Vorgang mithilfe der `muuri-item-dragging`-Klasse stylen (z.B. Schatten, Opazität).
- [x] 3.0 Implementierung der Sortierlogik und Persistenz
  - [x] 3.1 Einen Event-Listener für das `move`- oder `dragEnd`-Ereignis von `Muuri` in `AccountsView.vue` hinzufügen.
  - [x] 3.2 Im Event-Handler die neue Reihenfolge der Elemente aus der `Muuri`-Instanz auslesen.
  - [x] 3.3 Eine Methode erstellen, die die `sortOrder` aller Kontogruppen basierend auf ihrer neuen Position im Grid neu indiziert (von 0 an).
- [ ] 4.0 Store-Anpassung für Batch-Updates
  - [x] 4.1 Eine neue Action `updateAccountGroupOrder` im `accountStore` (`src/stores/accountStore.ts`) erstellen.
  - [x] 4.2 Die Action soll ein Array von Objekten `{ id: string, sortOrder: number }` als Argument akzeptieren.
  - [x] 4.3 Innerhalb der Action über das Array iterieren und für jede Kontogruppe die `updateAccountGroup`-Methode aufrufen, um die Änderungen in die `SyncQueue` einzutragen.
  - [x] 4.4 Die neue Action aus `AccountsView.vue` nach der Neuindizierung aufrufen.
- [ ] 5.0 Testing und Validierung
  - [ ] 5.1 Manuell testen, ob das Drag & Drop wie erwartet funktioniert.
  - [ ] 5.2 Überprüfen, ob die `sortOrder` in der IndexedDB nach der Aktion korrekt aktualisiert wird.
  - [ ] 5.3 Überprüfen, ob die Änderungen korrekt in die `SyncQueue` eingetragen werden.
  - [ ] 5.4 (Optional) Einen Unit-Test für die `updateAccountGroupOrder`-Action im `accountStore` schreiben.
