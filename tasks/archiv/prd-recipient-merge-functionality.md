# PRD: Recipient-Merge-Funktionalität für AdminRecipientsView

## 1. Introduction/Overview

Diese PRD beschreibt die Implementierung einer Merge-Funktionalität für Empfänger (Recipients) in der AdminRecipientsView der FinWise Finanzverwaltung. Die Funktionalität ermöglicht es Benutzern, mehrere Empfänger zu einem einzigen zusammenzuführen und dabei alle zugehörigen Transaktionen, Planungstransaktionen und Automatisierungsregeln automatisch zu aktualisieren.

**Problem:** Benutzer haben oft doppelte oder ähnliche Empfänger-Einträge (z.B. "Amazon", "Amazon.de", "Amazon Deutschland"), die zu unübersichtlichen Listen und inkonsistenten Daten führen.

**Ziel:** Bereitstellung einer benutzerfreundlichen Merge-Funktionalität mit Checkbox-basierter Mehrfachauswahl und Batch-Operationen, ähnlich der bestehenden TransactionList-Implementierung.

## 2. Goals

1. **Datenkonsolidierung:** Zusammenführung mehrerer Recipients zu einem einzigen Ziel-Recipient
2. **Datenintegrität:** Automatische Aktualisierung aller referenzierenden Datensätze (Transactions, PlanningTransactions, AutomationRules)
3. **Benutzerfreundlichkeit:** Intuitive Bedienung mit Checkbox-Auswahl und Modal-basierter Bestätigung
4. **Sicherheit:** Schutz vor versehentlichem Löschen von Recipients mit aktiven Referenzen
5. **Synchronisation:** Vollständige Integration in das bestehende Sync-System

## 3. User Stories

### US1: Empfänger für Merge auswählen
**Als** Administrator **möchte ich** mehrere Empfänger über Checkboxen auswählen können, **damit** ich diese für einen Merge-Vorgang markieren kann.

### US2: Merge-Ziel bestimmen
**Als** Administrator **möchte ich** wählen können, ob ich die ausgewählten Empfänger zu einem neuen oder einem bestehenden Empfänger zusammenführe, **damit** ich flexibel entscheiden kann, wie die Konsolidierung erfolgt.

### US3: Merge-Vorgang durchführen
**Als** Administrator **möchte ich** eine einfache Bestätigung für den Merge-Vorgang erhalten, **damit** ich sicher sein kann, dass die Operation korrekt ausgeführt wird.

### US4: Sichere Löschung
**Als** Administrator **möchte ich** nur Empfänger löschen können, die keine aktiven Referenzen haben, **damit** keine Dateninkonsistenzen entstehen.

### US5: Batch-Operationen
**Als** Administrator **möchte ich** über ein Dropdown-Menü verschiedene Batch-Operationen ausführen können, **damit** ich effizient mit mehreren Empfängern arbeiten kann.

## 4. Functional Requirements

### FR1: Checkbox-basierte Mehrfachauswahl
1.1. Jede Zeile in der Recipients-Tabelle erhält eine Checkbox
1.2. Header-Checkbox für "Alle auswählen/abwählen" auf der aktuellen Seite
1.3. Shift-Click-Unterstützung für Bereichsauswahl
1.4. Visuelle Anzeige der Anzahl ausgewählter Items

### FR2: Batch-Actions Dropdown-Menü
2.1. Hamburger-Button (ähnlich TransactionsView) mit Badge für Anzahl ausgewählter Items
2.2. Dropdown-Menü mit folgenden Optionen:
   - "Empfänger zusammenführen" (Merge)
   - "Empfänger löschen" (Delete)
2.3. Deaktivierung des Buttons wenn keine Items ausgewählt sind

### FR3: Merge-Funktionalität
3.1. Modal-Dialog zur Auswahl des Ziel-Empfängers
3.2. Integration der SelectRecipient-Komponente für Ziel-Auswahl
3.3. Optionen: "Neuen Empfänger erstellen" oder "Bestehenden auswählen"
3.4. Einfache Bestätigungsmeldung: "X Empfänger zu Y zusammenführen"
3.5. Automatische Aktualisierung aller referenzierenden Datensätze:
   - Transactions (recipientId)
   - PlanningTransactions (recipientId)
   - AutomationRules (Bedingungen und Aktionen mit Recipient-Referenzen)

### FR4: Sichere Löschung mit Validierung
4.1. Prüfung gegen Transactions und PlanningTransactions vor Löschung
4.2. Modal mit Warnmeldung bei Empfängern mit aktiven Referenzen
4.3. Automatische Löschung von AutomationRules, die ausschließlich auf zu löschende Recipients verweisen
4.4. Erfolgreiche Löschung nur bei Recipients ohne Referenzen

### FR5: Automatische Bereinigung
5.1. Nach erfolgreichem Merge: Automatische Löschung der Quell-Recipients
5.2. Aktualisierung der Recipients-Liste im Store
5.3. Refresh der UI-Anzeige

### FR6: Synchronisation
6.1. Jede Einzeloperation (Update/Delete) wird über das bestehende Sync-System abgewickelt
6.2. Verwendung der bestehenden SyncQueue-Mechanismen
6.3. Korrekte Behandlung von updated_at Timestamps für LWW-Konfliktlösung

## 5. Non-Goals (Out of Scope)

- Undo-Funktionalität für Merge-Operationen
- Batch-Import/Export von Recipients
- Erweiterte Merge-Regeln oder -Algorithmen
- Merge-Historie oder Audit-Log
- Automatische Duplikat-Erkennung
- Merge von anderen Entitätstypen (Accounts, Categories, etc.)

## 6. Design Considerations

### UI-Komponenten
- **Basis:** Bestehende AdminRecipientsView als Ausgangspunkt
- **Checkboxes:** Implementierung analog zu TransactionList.vue
- **Dropdown:** Wiederverwendung der BulkActionDropdown.vue Komponente
- **Modal:** Standard DaisyUI Modal für Merge-Bestätigung
- **SelectRecipient:** Integration der bestehenden SelectRecipient.vue Komponente

### Styling
- Konsistente Verwendung der bestehenden DaisyUI/TailwindCSS Klassen
- Hamburger-Button mit Badge-Anzeige für ausgewählte Items
- Error/Warning-Modals für Lösch-Validierung

## 7. Technical Considerations

### Store-Integration
- Erweiterung des `recipientStore.ts` um Merge- und Batch-Delete-Methoden
- Integration mit `transactionStore.ts` und `planningStore.ts` für Referenz-Updates
- Verwendung der `ruleStore.ts` für AutomationRule-Updates

### Datenbank-Operationen
- Verwendung der bestehenden TenantDbService-Methoden
- Transaktionale Verarbeitung für Konsistenz
- Korrekte Behandlung von IndexedDB-Updates

### Sync-Integration
- Verwendung der bestehenden SyncQueue-Mechanismen
- Korrekte EntityTypeEnum und SyncOperationType Zuordnung
- LWW-Konfliktlösung über updated_at Timestamps

### Performance
- Batch-Verarbeitung für große Datenmengen
- Optimierte Datenbankabfragen für Referenz-Prüfungen
- Effiziente UI-Updates nach Batch-Operationen

## 8. Success Metrics

- **Funktionalität:** Erfolgreiche Merge-Operationen ohne Datenverlust
- **Benutzerfreundlichkeit:** Intuitive Bedienung ohne zusätzliche Schulung
- **Performance:** Merge-Operationen < 2 Sekunden für bis zu 100 Referenzen
- **Datenintegrität:** 100% korrekte Aktualisierung aller Referenzen
- **Sync-Zuverlässigkeit:** Erfolgreiche Synchronisation aller Änderungen

## 9. Open Questions

### Technische Fragen
- Soll die Merge-Operation in einer Transaktion abgewickelt werden?
- Wie sollen sehr große Datenmengen (>1000 Referenzen) behandelt werden?
- Sollen Merge-Operationen im Hintergrund ausgeführt werden?

### UX-Fragen
- Soll eine Fortschrittsanzeige bei längeren Merge-Operationen angezeigt werden?
- Wie sollen Fehler während des Merge-Prozesses kommuniziert werden?
- Soll eine Bestätigung nach erfolgreichem Merge angezeigt werden?

### Business-Logik
- Wie sollen Merge-Konflikte bei unterschiedlichen defaultCategoryId behandelt werden?
- Sollen inaktive Recipients auch für Merge verfügbar sein?
- Wie soll mit Recipients umgegangen werden, die nur in AutomationRules referenziert sind?

---

**Erstellt:** 2025-01-24
**Version:** 1.0
**Autor:** System Architect
**Review:** Pending
