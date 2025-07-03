## Relevant Files

- `src/components/account/AccountGroupCard.vue` - Hauptkomponente für Kontogruppen mit Muuri-Integration; `handleDragEnd` muss vervollständigt werden
- `src/services/AccountService.ts` - Service-Layer mit bereits implementierten Methoden `moveAccountToGroup` und `updateAccountOrder`
- `src/stores/accountStore.ts` - Pinia Store mit allen erforderlichen Account-Management-Methoden
- `src/views/AccountsView.vue` - Übergeordnete View-Komponente für die Kontenübersicht

### Notes

- Die meiste Infrastruktur ist bereits implementiert - hauptsächlich muss die `handleDragEnd` Funktion vervollständigt werden
- Service-Layer-Methoden `moveAccountToGroup` und `updateAccountOrder` sind bereits vollständig implementiert
- Muuri-Registry und dragSort-Konfiguration sind bereits vorhanden

## Tasks

- [ ] 1.0 Inter-Group Drag-End Event-Handling implementieren
  - [x] 1.1 Erkennung von Inter-Group vs. Intra-Group Bewegungen in `handleDragEnd`
  - [ ] 1.2 Extraktion der Ziel-Grid-Information aus Muuri-Event
  - [ ] 1.3 Bestimmung der neuen Position im Ziel-Grid
  - [ ] 1.4 Aufruf der entsprechenden Service-Methoden (`moveAccountToGroup` vs. `updateAccountOrder`)
- [ ] 2.0 Drag-Feedback und visuelle Rückmeldungen optimieren
  - [ ] 2.1 Verbesserung der Placeholder-Anzeige während Inter-Group-Drag
  - [ ] 2.2 Konsistente Animationen für Drop-Operationen
  - [ ] 2.3 Visuelle Kennzeichnung gültiger Drop-Zonen
- [ ] 3.0 Datenintegrität und Fehlerbehandlung sicherstellen
  - [ ] 3.1 Validierung der Drop-Operation vor Datenänderung
  - [ ] 3.2 Rollback-Mechanismus bei fehlgeschlagenen Operationen
  - [ ] 3.3 Konsistente Error-Logging für Drag-Drop-Operationen
- [ ] 4.0 Performance-Optimierungen implementieren
  - [ ] 4.1 Optimierung der Grid-Registry-Verwaltung
  - [ ] 4.2 Minimierung von DOM-Manipulationen während Drag-Operationen
  - [ ] 4.3 Debouncing von Layout-Updates bei schnellen Drag-Operationen
