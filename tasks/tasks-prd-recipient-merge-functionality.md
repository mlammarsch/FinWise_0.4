# Tasks: Recipient-Merge-Funktionalität für AdminRecipientsView

## Relevant Files

- `src/views/admin/AdminRecipientsView.vue` - Hauptkomponente für Recipients-Verwaltung, wird um Checkbox-Auswahl und Batch-Actions erweitert
- `src/stores/recipientStore.ts` - Store für Recipients, wird um Merge- und Batch-Delete-Methoden erweitert
- `src/stores/ruleStore.ts` - Rule Store, wird für AutomationRule-Updates bei Merge benötigt
- `src/services/TransactionService.ts` - Bestehender Service, wird um Methoden für Recipient-Referenz-Updates erweitert
- `src/services/PlanningService.ts` - Bestehender Service, wird um Methoden für Recipient-Referenz-Updates erweitert
- `src/components/ui/BulkActionDropdown.vue` - Bestehende Komponente, wird für Recipients-spezifische Actions angepasst
- `src/components/ui/RecipientMergeModal.vue` - Neue Modal-Komponente für Merge-Bestätigung und Ziel-Auswahl
- `src/components/ui/RecipientDeleteConfirmModal.vue` - Neue Modal-Komponente für sichere Löschung mit Validierung
- `tests/unit/TransactionService.test.ts` - Erweiterte Unit Tests für TransactionService Recipient-Updates
- `tests/unit/PlanningService.test.ts` - Erweiterte Unit Tests für PlanningService Recipient-Updates
- `tests/integration/recipient-merge.test.ts` - Integration Tests für Merge-Funktionalität

### Notes

- Business Logic wird in bestehende Services (TransactionService, PlanningService) integriert
- Recipients und Rules haben keine eigenen Services aufgrund geringen Logikvolumens
- Unit Tests sollten neben den Code-Dateien platziert werden
- Integration Tests testen die vollständige Merge-Pipeline inklusive Store-Updates
- Verwendung von `npm run test` für alle Tests oder `npm run test:unit` für spezifische Tests

## Tasks

- [x] 1.0 UI-Erweiterung für Checkbox-basierte Mehrfachauswahl implementieren
  - [x] 1.1 Checkbox-Spalte zur Recipients-Tabelle hinzufügen
  - [x] 1.2 Header-Checkbox für "Alle auswählen/abwählen" implementieren
  - [x] 1.3 Shift-Click-Unterstützung für Bereichsauswahl hinzufügen
  - [x] 1.4 Auswahlzustand-Management (selectedIds, lastSelectedIndex) implementieren
  - [x] 1.5 Visuelle Anzeige der Anzahl ausgewählter Items hinzufügen
    - [x] Alert-Komponente mit Auswahlzähler zwischen Header und Tabelle platziert
    - [x] Conditional Rendering mit `v-if="hasSelectedRecipients"`
    - [x] DaisyUI Alert-Komponente mit Info-Styling und Check-Circle-Icon
    - [x] Klickbarer "Auswahl aufheben" Button mit Close-Icon
    - [x] Responsive Design mit ml-auto für Button-Positionierung
    - [x] Tooltip mit Keyboard-Shortcut-Hinweis (ESC)
    - [x] Verwendung der bestehenden `selectedRecipientsCount` und `hasSelectedRecipients` computed properties
    - [x] Integration der bestehenden `clearSelection()` Funktion

- [x] 2.0 Batch-Actions Dropdown-Menü integrieren
  - [x] 2.1 BulkActionDropdown-Komponente für Recipients anpassen
  - [x] 2.2 Hamburger-Button mit Badge für ausgewählte Items hinzufügen
  - [x] 2.3 Dropdown-Menü mit "Empfänger zusammenführen" und "Empfänger löschen" Optionen
  - [x] 2.4 Button-Deaktivierung bei leerer Auswahl implementieren
  - [x] 2.5 Event-Handler für Batch-Actions in AdminRecipientsView hinzufügen

- [x] 3.0 Merge-Funktionalität mit Modal-Dialog entwickeln
  - [x] 3.1 RecipientMergeModal-Komponente erstellen
  - [x] 3.2 SelectRecipient-Komponente für Ziel-Auswahl integrieren
  - [x] 3.3 Optionen für "Neuen Empfänger erstellen" oder "Bestehenden auswählen" implementieren
  - [x] 3.4 Bestätigungsdialog mit "X Empfänger zu Y zusammenführen" Meldung
  - [x] 3.5 Merge-Logik in recipientStore implementieren
  - [x] 3.6 TransactionService um updateRecipientReferences-Methode erweitern
  - [x] 3.7 PlanningService um updateRecipientReferences-Methode erweitern
  - [x] 3.8 AutomationRule-Updates in ruleStore für Recipient-Referenzen implementieren

- [ ] 4.0 Sichere Löschung mit Validierung implementieren
  - [ ] 4.1 RecipientDeleteConfirmModal-Komponente erstellen
  - [ ] 4.2 Validierungslogik für Recipient-Referenzen in Transactions implementieren
  - [ ] 4.3 Validierungslogik für Recipient-Referenzen in PlanningTransactions implementieren
  - [ ] 4.4 Warnmodal bei Recipients mit aktiven Referenzen anzeigen
  - [ ] 4.5 AutomationRules-Bereinigung bei Recipient-Löschung implementieren
  - [ ] 4.6 Batch-Delete-Logik mit Validierung in recipientStore implementieren

- [ ] 5.0 Store-Erweiterungen für Merge- und Batch-Operationen entwickeln
  - [ ] 5.1 mergeRecipients-Methode in recipientStore implementieren
  - [ ] 5.2 batchDeleteRecipients-Methode in recipientStore implementieren
  - [ ] 5.3 validateRecipientDeletion-Methode in recipientStore implementieren
  - [ ] 5.4 Automatische Bereinigung nach erfolgreichem Merge implementieren
  - [ ] 5.5 Sync-Integration für alle Merge- und Delete-Operationen sicherstellen
  - [ ] 5.6 Error-Handling und Rollback-Mechanismen implementieren
