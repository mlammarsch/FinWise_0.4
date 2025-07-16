# PRD: Inter-Group Account Drag & Drop

## 1. Übersicht

### 1.1 Zweck
Dieses Dokument definiert die Anforderungen für die Implementierung einer erweiterten Drag-and-Drop-Funktionalität, die es Benutzern ermöglicht, Konten zwischen verschiedenen Kontogruppen zu verschieben. Die Funktionalität erweitert das bestehende Intra-Group-Sorting um Inter-Group-Movement.

### 1.2 Hintergrund
**Aktueller Stand:**
- Konten können bereits innerhalb derselben Kontogruppe per Drag-and-Drop neu angeordnet werden
- AccountsView.vue implementiert bereits Muuri für AccountGroup-Sortierung
- AccountGroupCard.vue hat bereits ein globales `muuriRegistry` und `dragSort`-Funktion
- AccountService.ts enthält bereits `moveAccountToGroup` und `updateAccountOrder` Methoden

**Fehlende Funktionalität:**
- Inter-Group Drag & Drop zwischen verschiedenen AccountGroupCard-Instanzen ist noch nicht vollständig aktiviert
- `handleDragEnd` in AccountGroupCard.vue ist nur als Placeholder implementiert

### 1.3 Ziele
- Verbesserte Benutzerfreundlichkeit bei der Kontoverwaltung
- Intuitive Reorganisation von Konten zwischen Gruppen
- Konsistente Drag-and-Drop-Erfahrung in der gesamten Anwendung
- Erhaltung der Datenintegrität bei Gruppenwechseln
- Beibehaltung der bestehenden Intra-Group-Sorting-Funktionalität

## 2. Ziele

1. **Erweiterte Drag-and-Drop-Funktionalität**: Ermöglichung des Verschiebens von Konten zwischen verschiedenen Kontogruppen
2. **Nahtlose Integration**: Erweiterung der bestehenden Muuri-Implementation ohne Breaking Changes
3. **Datenintegrität**: Korrekte Aktualisierung von `accountGroupId` und `sortOrder` bei Inter-Group-Bewegungen
4. **Performance**: Effiziente Synchronisation mit IndexedDB und Backend
5. **Benutzerfreundlichkeit**: Intuitive visuelle Rückmeldungen während des Drag-Vorgangs

## 3. User Stories

### 3.1 Hauptfunktionalität

**User Story 1: Inter-Group Account Movement**
> Als Benutzer möchte ich ein Konto per Drag-and-Drop von einer Gruppe in eine andere verschieben, damit ich meine Konten schnell und intuitiv neu organisieren kann.

**User Story 2: Visuelles Feedback**
> Als Benutzer möchte ich während des Ziehens eines Kontos visuelles Feedback erhalten, damit ich weiß, wo das Konto eingefügt wird.

**User Story 3: Fehlerbehandlung**
> Als Benutzer möchte ich, dass das Konto zu seiner ursprünglichen Position zurückkehrt, wenn ich es an einer ungültigen Stelle loslasse.

## 4. Funktionale Anforderungen

### 4.1 Multi-Grid-Konfiguration
1. Die Muuri `dragSort`-Option muss als Funktion konfiguriert werden
2. Die Funktion muss alle verfügbaren Kontogruppen-Grids für Inter-Grid-Dragging zurückgeben
3. Dynamische Aktualisierung bei Hinzufügung/Entfernung von Kontogruppen

### 4.2 Drag-Initiierung
4. Drag-Handle eines Kontos muss klickbar und ziehbar sein
5. Visueller Indikator für "gezogenes" Konto während des Drag-Vorgangs
6. Verwendung der bestehenden Muuri-CSS-Klassen (`muuri-item-dragging`)

### 4.3 Visuelles Feedback
7. Platzhalter-Anzeige an der Einfügeposition während des Ziehens
8. Verwendung der bestehenden Muuri-Placeholder-Funktionalität
9. Konsistente Animationen sowohl für Intra- als auch Inter-Group-Movement

### 4.4 Drop-Verhalten
10. Erfolgreiche Einfügung des Kontos in die Zielgruppe an der indizierten Position
11. Aktualisierung der `accountGroupId` bei Gruppenwechsel
12. Neuberechnung der `sortOrder` in allen involvierten Gruppen
13. Persistierung der Änderungen in IndexedDB
14. Hinzufügung zur Sync-Queue für Backend-Synchronisation

### 4.5 Ungültiger Drop
15. Rückkehr des Kontos zur ursprünglichen Position bei ungültigem Drop
16. Kurze Animation zur Verdeutlichung der Rückkehr
17. Keine Datenänderungen bei ungültigen Drops

### 4.6 Intra-Group-Sorting Kompatibilität
18. Erhaltung der bestehenden Intra-Group-Sorting-Funktionalität
19. Nur `sortOrder`-Aktualisierung bei Bewegungen innerhalb derselben Gruppe
20. Keine `accountGroupId`-Änderung bei Intra-Group-Movement

### 4.7 Event-Handling
21. Erweiterung des bestehenden `handleDragEnd`-Events
22. Erkennung von Gruppenwechseln durch Vergleich von Quell- und Ziel-Grid
23. Aufruf entsprechender Service-Methoden für Datenaktualisierung

### 4.8 Datenaktualisierung
24. Service-Layer-Integration für Account-Operationen
25. Optimistische Updates im Pinia Store
26. Rollback-Mechanismus bei Fehlern
27. Konsistente Datenstruktur nach allen Operationen

## 5. Nicht-Ziele (Out of Scope)

1. **Validierungsregeln**: Keine spezifischen Einschränkungen für bestimmte Kontotypen
2. **Benutzerrechte**: Keine rollenbasierten Einschränkungen für Drag-and-Drop
3. **Bulk-Operations**: Kein gleichzeitiges Verschieben mehrerer Konten
4. **Undo/Redo-Funktionalität**: Keine Rückgängig-Funktion für Drag-and-Drop-Operationen
5. **Custom Animations**: Verwendung der Standard-Muuri-Animationen

## 6. Design Considerations

### 6.1 Bestehende UI-Komponenten
- Verwendung der bestehenden `AccountGroupCard.vue` Komponenten
- Integration in die vorhandene `src/views/AccountsView.vue` Struktur
- Beibehaltung der aktuellen `AccountCard.vue` Darstellung

### 6.2 Muuri-Integration
- Nutzung der bestehenden Muuri-Instanzen in jeder `AccountGroupCard`
- Konfiguration der `dragSort`-Option für Multi-Grid-Support
- Verwendung der Standard-Muuri-CSS-Klassen und -Animationen

## 7. Technische Überlegungen

### 7.1 Abhängigkeiten
- Bestehende Muuri-Library-Integration
- `AccountService.ts` Erweiterung für Inter-Group-Movement
- `TenantDbService.ts` für IndexedDB-Persistierung
- Pinia Store (`accountStore.ts`) für State Management

### 7.2 Performance-Überlegungen
- Effiziente Grid-Referenz-Verwaltung
- Minimale DOM-Manipulationen während Drag-Operationen
- Optimistische Updates für bessere UX

### 7.3 Datenintegrität
- Transaktionale Updates für `accountGroupId` und `sortOrder`
- Konsistente Sync-Queue-Einträge
- Fehlerbehandlung und Rollback-Mechanismen

## 8. Erfolgskriterien

### 8.1 Funktionale Kriterien
1. **Drag-Initiierung**: 100% der Konten können erfolgreich gezogen werden
2. **Inter-Group-Movement**: Konten können zwischen allen Kontogruppen verschoben werden
3. **Datenintegrität**: Alle Datenbankoperationen sind konsistent und korrekt
4. **Intra-Group-Kompatibilität**: Bestehende Funktionalität bleibt unverändert

### 8.2 Performance-Kriterien
5. **Drag-Responsiveness**: Drag-Operationen starten innerhalb von 100ms
6. **Drop-Performance**: Drop-Operationen werden innerhalb von 200ms abgeschlossen
7. **Sync-Effizienz**: Änderungen werden innerhalb von 500ms in IndexedDB persistiert

### 8.3 Benutzerfreundlichkeit
8. **Visuelles Feedback**: Platzhalter erscheinen innerhalb von 50ms nach Drag-Start
9. **Intuitive Bedienung**: Neue Benutzer können die Funktionalität ohne Anleitung verwenden
10. **Fehlerbehandlung**: Ungültige Drops werden klar kommuniziert


## 10. Betroffene Dateien

### 10.1 Zu modifizierende Dateien
- `src/components/account/AccountGroupCard.vue` - `handleDragEnd` Implementierung vervollständigen
- `src/views/AccountsView.vue` - Bereits implementiert, eventuell Optimierungen

### 10.2 Bereits implementierte Dateien (keine Änderungen erforderlich)
- `src/services/AccountService.ts` - `moveAccountToGroup` und `updateAccountOrder` bereits vollständig implementiert
- `src/stores/accountStore.ts` - Alle erforderlichen Store-Methoden bereits vorhanden
- `src/components/account/AccountCard.vue` - Drag-Handle bereits korrekt implementiert
- `src/services/TenantDbService.ts` - Persistierung bereits vollständig implementiert

## 11. Implementierungsreihenfolge

### **Aktueller Status-Check:**
✅ **Phase 1 (ABGESCHLOSSEN)**: Multi-Grid-Konfiguration in `AccountGroupCard.vue`
- Globales `muuriRegistry` bereits implementiert (Zeile 25)
- `dragSort` Funktion bereits vorhanden (Zeile 159-161)

✅ **Phase 2 (ABGESCHLOSSEN)**: Service-Layer bereits vollständig implementiert
- `AccountService.moveAccountToGroup()` bereits implementiert (Zeile 262-337)
- `AccountService.updateAccountOrder()` bereits implementiert (Zeile 220-260)

✅ **Phase 3 (ABGESCHLOSSEN)**: Store-Integration bereits vollständig implementiert
- Alle erforderlichen Store-Methoden in `accountStore.ts` vorhanden

### **Verbleibende Aufgaben:**
🔄 **Phase 4 (IN ARBEIT)**: Event-Handling-Vervollständigung
- `handleDragEnd` in `AccountGroupCard.vue` vervollständigen (aktuell nur Placeholder)

🔄 **Phase 5**: Testing und Optimierung
