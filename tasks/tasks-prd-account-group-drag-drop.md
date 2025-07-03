# Task List: Inter-Group Drag-and-Drop für Konten

## Relevant Files

- `src/components/account/AccountsView.vue` - Hauptkomponente für Kontenansicht, enthält mehrere AccountGroupCard-Instanzen
- `src/components/account/AccountGroupCard.vue` - Kontogruppen-Komponente mit Muuri Grid Instance
- `src/components/account/AccountCard.vue` - Einzelne Konto-Komponente innerhalb der Grids
- `src/services/AccountService.ts` - Service-Layer für Konto-Operationen, benötigt Erweiterung für Inter-Group-Movement
- `src/stores/accountStore.ts` - Pinia Store für Account-Management, optimistische Updates
- `src/services/TenantDbService.ts` - IndexedDB-Operationen für Persistierung
- `src/utils/muuri-registry.ts` - Globale Muuri Grid Registry (neu zu erstellen)
- `src/types/index.ts` - TypeScript-Interfaces für Account und Drag-and-Drop-Operationen
- `src/assets/styles/drag-drop.css` - CSS für Drag-and-Drop-Feedback und Animationen

### Notes

- Der Product Owner wird selbst testen. Keine Tests erstellen.
- Die bestehende Muuri-Implementation in AccountGroupCard.vue muss erweitert, nicht ersetzt werden

## Tasks

- [ ] 1.0 Muuri Multi-Grid-Konfiguration implementieren
  - [ ] 1.1 Globale Muuri Grid Registry erstellen (`src/utils/muuri-registry.ts`)
  - [ ] 1.2 Registry-Methoden für Grid-Management implementieren (addGrid, removeGrid, getAllGrids)
  - [ ] 1.3 AccountGroupCard.vue für Registry-Integration erweitern
  - [ ] 1.4 DragSort-Konfiguration als Funktion implementieren für Multi-Grid-Support
  - [ ] 1.5 Lifecycle-Management für Grid-Registrierung/Deregistrierung
- [ ] 2.0 Service-Layer für Inter-Group-Movement erweitern
  - [ ] 2.1 AccountService um `moveAccountBetweenGroups` Methode erweitern
  - [ ] 2.2 AccountService um `updateAccountOrderInGroup` Methode erweitern
  - [ ] 2.3 AccountService um `validateGroupMove` Methode erweitern
  - [ ] 2.4 SortOrder-Neuberechnung für Quell- und Zielgruppe implementieren
  - [ ] 2.5 IndexedDB-Persistierung über TenantDbService integrieren
  - [ ] 2.6 Sync-Queue-Integration für Backend-Synchronisation
  - [ ] 2.7 Optimistische Updates im accountStore implementieren
  - [ ] 2.8 Rollback-Mechanismus bei Fehlern implementieren
- [ ] 3.0 Event-Handling für Inter-Group Drag-and-Drop implementieren
  - [ ] 3.1 Bestehenden `handleDragEnd` Event-Handler erweitern
  - [ ] 3.2 Inter-Grid vs. Intra-Grid Movement Detection implementieren
  - [ ] 3.3 `handleInterGroupMove` Funktion erstellen
  - [ ] 3.4 Grid-zu-AccountGroup-Mapping implementieren
  - [ ] 3.5 Target-Index-Berechnung für Drop-Position
  - [ ] 3.6 Error-Handling für ungültige Drops
  - [ ] 3.7 Animation und Feedback für erfolgreiche/fehlgeschlagene Moves
- [ ] 4.0 UI/UX-Verbesserungen und visuelles Feedback
  - [ ] 4.1 CSS-Klassen für Drag-Feedback erstellen (`.muuri-item-dragging`, `.drop-target`)
  - [ ] 4.2 Drop-Placeholder-Styling implementieren
  - [ ] 4.3 Responsive Verhalten für Mobile/Tablet optimieren
  - [ ] 4.4 Hover-States für Drop-Zonen implementieren
  - [ ] 4.5 Animationen für Drag-Start/End-States
  - [ ] 4.6 Visual Feedback für ungültige Drop-Bereiche
  - [ ] 4.7 Accessibility-Features (Fokus-Management, Keyboard-Navigation)
