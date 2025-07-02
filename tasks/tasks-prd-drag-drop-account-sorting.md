## Relevant Files

- `src/services/AccountService.ts` - Verlagerung der Sortierlogik hierher und Erstellung neuer Methoden für die Aktualisierung der Reihenfolge und das Verschieben von Konten.
- `src/stores/accountStore.ts` - Entfernen der alten Sortierlogik (`updateAccountGroupOrder`).
- `src/components/account/AccountGroupCard.vue` - Initialisierung der Muuri-Instanzen, Behandlung von Drag-and-Drop-Events und dynamische Layout-Anpassungen.
- `src/components/account/AccountCard.vue` - Das per Drag-and-Drop verschiebbare Element. Hinzufügen eines visuellen Drag-Handles.
- `src/views/AccountsView.vue` - Anpassung der Aufrufe, um die neuen Methoden im `AccountService` zu verwenden.
- `src/services/BalanceService.ts` - Wird aufgerufen, um die Salden der betroffenen Kontogruppen nach dem Verschieben eines Kontos neu zu berechnen.

### Notes

- Da laut PRD keine Tests geschrieben werden, sind keine Testdateien aufgeführt.
- Die Implementierung sollte sich eng an der Dokumentation der [Muuri-Bibliothek](docs/Muuri.md) orientieren.

## Tasks

- [ ] 1.0 Vorbereitung und Refactoring der Geschäftslogik
  - [x] 1.1 Verschiebe die Methode `updateAccountGroupOrder` von `accountStore.ts` nach `AccountService.ts`.
  - [x] 1.2 Erstelle eine neue Methode `updateAccountOrder(groupId: string, accountIds: string[])` im `AccountService`, die die `sortOrder` für alle Konten in einer Gruppe aktualisiert und die Änderungen an den `accountStore` weiterleitet.
  - [x] 1.3 Erstelle eine neue Methode `moveAccountToGroup(accountId: string, newGroupId: string, newIndex: number)` im `AccountService`, die die `accountGroupId` ändert und die `sortOrder` in der Quell- und Zielgruppe neu berechnet.
  - [x] 1.4 Passe die Komponente `AccountsView.vue` an, um die neuen Methoden aus dem `AccountService` aufzurufen.

- [x] 2.0 Initialisierung und Konfiguration von Muuri für Drag-and-Drop
  - [x] 2.1 Initialisiere in `AccountGroupCard.vue` für jede Kontogruppe eine separate Muuri-Instanz.
  - [x] 2.2 Konfiguriere die Muuri-Instanzen so, dass das Ziehen von Elementen zwischen den Gruppen erlaubt ist (Option `dragSort: { group: 'accounts' }`).
  - [x] 2.3 Füge in `AccountCard.vue` einen visuellen Indikator (Drag-Handle) hinzu, um die Greifbarkeit zu signalisieren.

- [ ] 3.0 Implementierung der Drag-and-Drop-Interaktionen (Sortieren und Verschieben)
  - [ ] 3.1 Implementiere die Event-Listener für Muuri, insbesondere `dragEnd`.
  - [ ] 3.2 Ermittle im `dragEnd`-Event, ob ein Konto innerhalb einer Gruppe sortiert oder zwischen Gruppen verschoben wurde.
  - [ ] 3.3 Rufe bei einer Sortierung innerhalb einer Gruppe die Methode `AccountService.updateAccountOrder` auf.
  - [ ] 3.4 Rufe beim Verschieben eines Kontos die Methode `AccountService.moveAccountToGroup` auf.
  - [ ] 3.5 Stelle sicher, dass nach dem Verschieben eines Kontos der Saldo der betroffenen Kontogruppen über den `BalanceService` neu berechnet wird.

- [ ] 4.0 Implementierung der Persistierung und Synchronisation
  - [ ] 4.1 Implementiere eine Debounce-Funktion mit einer Wartezeit von 5 Sekunden, die nach jeder `dragEnd`-Aktion ausgelöst wird.
  - [ ] 4.2 Sammle alle Änderungen (neue `sortOrder`, neue `accountGroupId`) während der Drag-and-Drop-Aktionen.
  - [ ] 4.3 Nach Ablauf der Debounce-Zeit, sende eine einzelne Batch-Aktualisierung mit allen geänderten Konten an den `AccountService`.
  - [ ] 4.4 Stelle sicher, dass der `AccountService` die Updates an den `accountStore` weitergibt, um die Persistenz über den `TenantDbService` und die Backend-Synchronisation auszulösen.

- [ ] 5.0 UI-Anpassungen und visuelles Feedback
  - [ ] 5.1 Implementiere eine `watch`-Funktion in `AccountGroupCard.vue`, die auf die Anzahl der Konten in der Gruppe reagiert und `muuri.layout()` aufruft, um das Layout neu zu berechnen.
  - [ ] 5.2 Sorge für visuelles Feedback während des Ziehens, z.B. durch einen Platzhalter und reduzierte Deckkraft der gezogenen Karte.
