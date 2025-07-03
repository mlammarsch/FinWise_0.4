# Product Requirements Document: Inter-Group Drag-and-Drop für Konten

**Dokument-Version:** 1.0
**Erstellt am:** 7. Januar 2025
**Autor:** FinWise Development Team
**Status:** Draft

## 1. Übersicht

### 1.1 Zweck
Dieses Dokument definiert die Anforderungen für die Implementierung einer Drag-and-Drop-Funktionalität, die es Benutzern ermöglicht, Konten zwischen verschiedenen Kontogruppen zu verschieben.

### 1.2 Hintergrund
Aktuell können Benutzer Konten nur innerhalb derselben Kontogruppe per Drag-and-Drop neu anordnen. Es fehlt die Möglichkeit, Konten zwischen verschiedenen Gruppen zu verschieben, was die Flexibilität bei der Kontoverwaltung einschränkt.

### 1.3 Ziele
- Verbesserte Benutzerfreundlichkeit bei der Kontoverwaltung
- Intuitive Reorganisation von Konten zwischen Gruppen
- Konsistente Drag-and-Drop-Erfahrung in der gesamten Anwendung
- Erhaltung der Datenintegrität bei Gruppenwechseln

## 2. User Stories und Akzeptanzkriterien

### 2.1 Hauptfunktionalität

**User Story:**
> Als Benutzer möchte ich ein Konto per Drag-and-Drop von einer Gruppe in eine andere verschieben, damit ich meine Konten schnell und intuitiv neu organisieren kann.

**Akzeptanzkriterien:**

#### AC1: Drag-Initiierung
- **GIVEN** ich befinde mich in der Kontenansicht
- **WHEN** ich auf das Drag-Handle eines Kontos klicke und ziehe
- **THEN** wird das Konto visuell als "gezogen" markiert

#### AC2: Visuelles Feedback während des Ziehens
- **GIVEN** ich ziehe ein Konto über eine andere Kontogruppe
- **OR** ich ziehe ein Konto innerhalb der gleichen Kontogruppe (AC5)
- **WHEN** sich der Mauszeiger über einer gültigen Drop-Zone befindet
- **THEN** erscheint ein visueller Platzhalter an der Einfügeposition

#### AC3: Drop-Verhalten
- **GIVEN** ich ziehe ein Konto über eine andere Kontogruppe
- **OR** ich ziehe ein Konto innerhalb der gleichen Kontogruppe (AC5)
- **WHEN** ich das Konto loslasse
- **THEN** wird das Konto in die Zielgruppe (kann auch gleich der Quellgruppe sein) an der indizierten Position eingefügt
- **AND** die `accountGroupId` des Kontos wird aktualisiert (wenn Quelle und Ziel ungleich sind)
- **AND** die `sortOrder` wird in allen involvierten Gruppen neu berechnet
- **AND** die Änderungen werden in IndexedDB und der Sync-Queue gespeichert

#### AC4: Ungültiger Drop
- **GIVEN** ich ziehe ein Konto über einen ungültigen Bereich
- **WHEN** ich das Konto loslasse
- **THEN** kehrt das Konto zu seiner ursprünglichen Position zurück
- **AND** es wird eine kurze Animation gezeigt
- **AND** keine Datenänderungen werden vorgenommen

#### AC5: Intra-Group Sorting bleibt erhalten
- **GIVEN** ich ziehe ein Konto innerhalb derselben Gruppe
- **WHEN** ich das Konto an einer neuen Position loslasse
- **THEN** funktioniert das bestehende Intra-Group-Sorting weiterhin
- **AND** nur die `sortOrder` wird aktualisiert, nicht die `accountGroupId`

## 3. Funktionale Anforderungen

### 3.1 Drag-and-Drop-Mechanismus

#### 3.1.1 Multi-Grid-Konfiguration
- Konfiguration der Muuri `dragSort`-Option als Funktion
- Rückgabe aller verfügbaren Kontogruppen-Grids für Inter-Grid-Dragging
- Dynamische Aktualisierung bei Hinzufügung/Entfernung von Kontogruppen

#### 3.1.2 Event-Handling
- Erweiterung des bestehenden `handleDragEnd`-Events
- Erkennung von Gruppenwechseln durch Vergleich von Quell- und Ziel-Grid
- Aufruf entsprechender Service-Methoden für Datenaktualisierung

#### 3.1.3 Datenaktualisierung
- Aktualisierung der `accountGroupId` bei Gruppenwechsel
- Neuberechnung der `sortOrder` in Quell- und Zielgruppe
- Persistierung in IndexedDB über `TenantDbService`
- Hinzufügung zur Sync-Queue für Backend-Synchronisation (ist bereits Bestandteil der Applikation)

### 3.2 Service-Layer-Erweiterungen

#### 3.2.1 AccountService-Methoden
```typescript
// Neue Methode für Inter-Group-Movement
async moveAccountBetweenGroups(
  accountId: string,
  targetGroupId: string,
  targetIndex: number
): Promise<void>

// Erweiterte Methode für Order-Updates
async updateAccountOrderInGroup(
  groupId: string,
  accountIds: string[]
): Promise<void>
```

#### 3.2.2 Store-Aktualisierungen
- Erweiterung des `accountStore` für Inter-Group-Operations
- Optimistische Updates für bessere UX
- Rollback-Mechanismus bei Fehlern

### 3.3 Synchronisation

#### 3.3.1 Offline-Unterstützung
- Vollständige Funktionalität ohne Internetverbindung
- Speicherung in lokaler Sync-Queue
- Automatische Synchronisation bei Verbindungswiederherstellung

#### 3.3.2 Konfliktlösung
- Last-Write-Wins-Strategie bei gleichzeitigen Änderungen
- Verwendung von `updated_at`-Timestamps
- Graceful Handling von Sync-Konflikten

## 4. Nicht-funktionale Anforderungen

### 4.1 Performance
- Drag-and-Drop-Operationen < 100ms Latenz
- Flüssige Animationen bei 60fps
- Keine spürbare Verzögerung bei bis zu 50 Konten pro Gruppe

### 4.2 Usability
- Intuitive Drag-and-Drop-Gesten
- Klares visuelles Feedback
- Konsistenz mit bestehenden UI-Patterns
- Accessibility-Unterstützung (Keyboard-Navigation)

### 4.3 Kompatibilität
- Funktionalität auf Desktop und Tablet
- Touch-Unterstützung für mobile Geräte
- Browser-Kompatibilität entsprechend bestehender Anforderungen

### 4.4 Zuverlässigkeit
- Robuste Fehlerbehandlung
- Datenintegrität bei allen Operationen
- Graceful Degradation bei Fehlern

## 5. Technische Spezifikationen

### 5.1 Architektur-Übersicht

#### 5.1.1 Komponenten-Hierarchie
```
AccountsView.vue
├── AccountGroupCard.vue (mehrere Instanzen)
│   ├── Muuri Grid Instance
│   └── AccountCard.vue (mehrere Instanzen)
└── Global Muuri Registry
```

#### 5.1.2 Datenfluss
1. User initiiert Drag-Operation
2. Muuri erkennt Inter-Grid-Movement
3. `handleDragEnd` wird mit Grid-Informationen aufgerufen
4. AccountService aktualisiert Datenmodell
5. Store wird aktualisiert (optimistisch)
6. IndexedDB wird persistiert
7. Sync-Queue wird erweitert
8. UI wird re-rendered

### 5.2 Implementierungsdetails

#### 5.2.1 Muuri-Konfiguration
```typescript
// In AccountGroupCard.vue
const dragSortConfig = () => {
  return accountGroupRegistry.getAllGrids().filter(grid =>
    grid !== currentGrid.value
  );
};

const muuriOptions = {
  dragEnabled: true,
  dragSort: dragSortConfig,
  dragSortHeuristics: {
    sortInterval: 100,
    minDragDistance: 10,
    minBounceBackAngle: 1
  }
};
```

#### 5.2.2 Event-Handler-Erweiterung
```typescript
const handleDragEnd = (item: MuuriItem, event: DragEvent) => {
  const sourceGrid = item.getGrid();
  const targetGrid = event.target?.closest('.muuri-grid')?._muuri;

  if (sourceGrid !== targetGrid) {
    // Inter-group movement
    await handleInterGroupMove(item, sourceGrid, targetGrid);
  } else {
    // Intra-group movement (existing logic)
    await handleIntraGroupMove(item, sourceGrid);
  }
};
```

#### 5.2.3 Datenmodell-Updates
```typescript
interface AccountUpdatePayload {
  accountId: string;
  accountGroupId: string;
  sortOrder: number;
  updated_at: string;
}

interface GroupOrderUpdate {
  groupId: string;
  accountOrders: Array<{
    accountId: string;
    sortOrder: number;
  }>;
}
```

### 5.3 CSS-Anpassungen

#### 5.3.1 Drag-Feedback
```css
.account-card.muuri-item-dragging {
  opacity: 0.8;
  transform: rotate(5deg);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.account-group.drop-target {
  border: 2px dashed var(--primary-color);
  background-color: var(--primary-color-light);
}

.drop-placeholder {
  height: 80px;
  border: 2px dashed var(--secondary-color);
  border-radius: 8px;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    var(--secondary-color-light) 10px,
    var(--secondary-color-light) 20px
  );
}
```

#### 5.3.2 Responsive Verhalten
```css
@media (max-width: 768px) {
  .account-group {
    min-height: 120px; /* Größere Drop-Zone auf Mobile */
  }

  .drop-placeholder {
    height: 100px; /* Größerer Platzhalter für Touch */
  }
}
```

## 6. Benutzeroberfläche

### 6.1 Visuelles Design

Behalte die bereits umgesetzten Darstellungen aus AccountsView und AccountGroupCard bei. Ergänze nur den Fall des Gruppen übergreifenden Falles, bei dem die Quellgruppe den Platzhalter löscht und Zielgruppe einen neuen Platzhalter schafft, in der das Konto einsortiert werden soll.

### 6.2 Accessibility

#### 6.2.1 Fokus-Management
- Fokus bleibt auf bewegtem Element
- Klare Fokus-Indikatoren
- Logische Tab-Reihenfolge nach Reorganisation

## 7. Datenmodell

### 7.1 Account-Entität
```typescript
interface Account {
  id: string;
  name: string;
  accountGroupId: string;  // Wird bei Inter-Group-Move aktualisiert
  sortOrder: number;       // Wird in beiden Gruppen neu berechnet
  // ... andere Eigenschaften
  updated_at: string;      // Für LWW-Konfliktlösung
}
```

### 7.2 Sync-Queue-Einträge
```typescript
interface AccountMoveQueueEntry extends SyncQueueEntry {
  entityType: 'accounts';
  operationType: 'update';
  payload: {
    id: string;
    accountGroupId: string;
    sortOrder: number;
    updated_at: string;
  };
  metadata: {
    moveType: 'inter_group' | 'intra_group';
    sourceGroupId?: string;
    targetGroupId: string;
  };
}
```

### 7.3 Batch-Updates
```typescript
interface GroupReorderBatch {
  sourceGroup: {
    groupId: string;
    updates: AccountOrderUpdate[];
  };
  targetGroup: {
    groupId: string;
    updates: AccountOrderUpdate[];
  };
  timestamp: string;
}
```



## 10. Risiken und Mitigationen

### 10.1 Technische Risiken

#### 10.1.1 Muuri-Kompatibilität
**Risiko:** Komplexe Multi-Grid-Konfiguration könnte zu unerwarteten Verhalten führen
**Mitigation:** Umfassende Tests mit verschiedenen Grid-Konfigurationen, Fallback auf manuelle Implementation

#### 10.1.2 Performance bei vielen Konten
**Risiko:** Drag-and-Drop könnte bei vielen Konten langsam werden
**Mitigation:** Virtualisierung für große Listen, Lazy Loading, Performance-Monitoring

#### 10.1.3 Sync-Konflikte
**Risiko:** Gleichzeitige Änderungen könnten zu Datenverlust führen
**Mitigation:** Robuste LWW-Implementation, Conflict-Resolution-UI, Backup-Mechanismen

### 10.2 UX-Risiken

#### 10.2.1 Verwirrende Drag-Zonen
**Risiko:** Benutzer könnten nicht verstehen, wo sie droppen können
**Mitigation:** Klare visuelle Indikatoren, Onboarding-Tutorial, Konsistente UI-Patterns

#### 10.2.2 Versehentliche Moves
**Risiko:** Benutzer könnten versehentlich Konten verschieben
**Mitigation:** Undo-Funktionalität, Bestätigungsdialoge für kritische Moves, Drag-Threshold

### 10.3 Datenintegrität-Risiken

#### 10.3.1 Inkonsistente sortOrder
**Risiko:** Fehler bei sortOrder-Berechnung könnten zu inkonsistenter Anzeige führen
**Mitigation:** Validierung nach jeder Operation, Automatische Reparatur-Funktionen

#### 10.3.2 Sync-Queue-Overflow
**Risiko:** Viele Drag-Operationen könnten Sync-Queue überlasten
**Mitigation:** Batch-Processing, Queue-Limits, Prioritäts-basierte Verarbeitung

## 11. Erfolgsmetriken

### 11.1 Funktionale Metriken
- 100% erfolgreiche Inter-Group-Moves
- < 100ms Latenz für Drag-and-Drop-Operationen
- 0% Datenverlust bei Sync-Operationen
- 100% Kompatibilität mit bestehenden Intra-Group-Features

### 11.2 Benutzermetriken
- Reduzierte Zeit für Konto-Reorganisation um 50%
- Erhöhte Benutzer-Engagement mit Konto-Management-Features
- Positive Benutzer-Feedback zu Drag-and-Drop-UX
- Reduzierte Support-Anfragen zu Konto-Organisation

### 11.3 Technische Metriken
- 95%+ Test-Coverage für neue Funktionalität
- < 5% Performance-Regression in bestehenden Features
- 100% Offline-Funktionalität
- < 1s Sync-Zeit für Batch-Updates

## 12. Anhänge

### 12.1 Referenzen
- [Muuri Documentation](https://github.com/haltu/muuri)
- [FinWise Architecture Documentation](../docs/architecture.md)
- [Existing Drag-and-Drop Implementation](../docs/Muuri.md)

### 12.2 Mockups und Wireframes
*[Platzhalter für UI-Mockups - werden in separaten Design-Dokumenten bereitgestellt]*

### 12.3 API-Spezifikationen
```typescript
// AccountService API Extensions
interface AccountServiceExtensions {
  moveAccountBetweenGroups(
    accountId: string,
    targetGroupId: string,
    targetIndex: number
  ): Promise<void>;

  updateAccountOrderInGroup(
    groupId: string,
    accountIds: string[]
  ): Promise<void>;

  validateGroupMove(
    accountId: string,
    targetGroupId: string
  ): Promise<boolean>;
}
```

---

**Dokumenten-Ende**

*Dieses Dokument wird bei Änderungen an den Anforderungen oder während der Implementierung aktualisiert.*
