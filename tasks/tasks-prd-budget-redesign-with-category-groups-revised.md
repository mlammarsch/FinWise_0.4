## Relevant Files

- `src/views/BudgetsView2.vue` - Neue Hauptview basierend auf BudgetsView.vue mit identischem Layout
- `src/components/budget/BudgetCategoryColumn2.vue` - Neue Kategoriespalte mit Kategoriegruppen und Muuri-Integration
- `src/components/budget/CategoryGroupRow2.vue` - Komponente für einzelne Kategoriegruppen mit Expand/Collapse
- `src/router/index.ts` - Router-Konfiguration für neue /budgets2 Route
- `src/components/ui/MainNavigation.vue` - Navigation mit neuem "Budgets 2" Menüeintrag
- `src/components/budget/BudgetMonthHeaderCard.vue` - Bestehende Komponente (wiederverwendet)
- `src/components/budget/BudgetMonthCard.vue` - Bestehende Komponente (wiederverwendet)
- `src/components/ui/PagingYearComponent.vue` - Bestehende Komponente (wiederverwendet)
- `src/stores/categoryStore.ts` - Bestehender Store (verwendet für Kategoriegruppen-Logik)
- `src/services/CategoryService.ts` - Bestehender Service (für Drag & Drop-Persistierung)

### Notes

- Die Implementierung fokussiert sich auf Layout-Konsistenz mit der bestehenden BudgetsView
- Alle bestehenden Komponenten (BudgetMonthHeaderCard, BudgetMonthCard, PagingYearComponent) werden unverändert wiederverwendet
- Muuri.js wird nur in der neuen BudgetCategoryColumn2 für Drag & Drop integriert
- Die bestehende BudgetsView bleibt als Vergleichsimplementierung bestehen

## Tasks

- [ ] 1.0 Navigation und Routing Setup
  - [ ] 1.1 Neue Route `/budgets2` in `src/router/index.ts` hinzufügen
  - [ ] 1.2 "Budgets 2" Menüeintrag in `src/components/ui/MainNavigation.vue` einfügen
  - [ ] 1.3 Route-Meta-Daten für Breadcrumb und Titel konfigurieren
  - [ ] 1.4 Navigation testen und sicherstellen, dass beide Budget-Views parallel funktionieren

- [ ] 2.0 BudgetsView2 Layout-Übernahme und Grundstruktur
  - [ ] 2.1 `src/views/BudgetsView2.vue` als exakte Kopie der `BudgetsView.vue` erstellen
  - [ ] 2.2 Template-Struktur identisch übernehmen (Header, Tabellenkopf, Datenbereich)
  - [ ] 2.3 Script-Logik komplett kopieren (months, totalColumns, Event-Handler)
  - [ ] 2.4 PagingYearComponent, BudgetMonthHeaderCard, BudgetMonthCard integrieren oder ähnliches Layout selbst erbauen
  - [ ] 2.5 Sticky-Bereiche (Header + Kategoriespalte) CSS-technisch implementieren
  - [ ] 2.6 Spaltenbreiten-Berechnung `calc(100% / (numMonths + 1))` übernehmen
  - [ ] 2.7 Toggle-All-Funktionalität für Expand/Collapse implementieren

- [ ] 3.0 BudgetCategoryColumn2 mit Kategoriegruppen-Integration
  - [ ] 3.1 `src/components/budget/BudgetCategoryColumn2.vue` erstellen
  - [ ] 3.2 Template-Struktur mit Muuri-Container und Sektionen (Ausgaben/Einnahmen) aufbauen
  - [ ] 3.3 `src/components/budget/CategoryGroupRow2.vue` für einzelne Kategoriegruppen erstellen
  - [ ] 3.4 Computed Properties für `expenseGroups`, `incomeGroups`, `categoriesByGroup` implementieren
  - [ ] 3.5 Expand/Collapse-Funktionalität für Kategoriegruppen implementieren
  - [ ] 3.6 Kategoriegruppen-Header mit Drag-Handles und Toggle-Buttons erstellen
  - [ ] 3.7 Kategorien-Rows mit Drag-Handles und korrekter Einrückung implementieren
  - [ ] 3.8 Datenkompatibilität mit bestehender CategoryStore sicherstellen

- [ ] 4.0 Muuri Drag & Drop-Funktionalität implementieren (Hinweis auf Doku in `docs/Muuri.md`)
  - [ ] 4.1 Muuri.js in BudgetCategoryColumn2 initialisieren
  - [ ] 4.2 Drag-Handles für Kategoriegruppen und Kategorien implementieren
  - [ ] 4.3 Muuri-Event-Handler für `dragEnd` implementieren
  - [ ] 4.4 `handleCategoryDrop()` für Kategorie-Verschiebungen zwischen Gruppen
  - [ ] 4.5 `handleGroupDrop()` für Kategoriegruppen-Sortierung implementieren
  - [ ] 4.6 SortOrder-Berechnung und Persistierung über CategoryService
  - [ ] 4.7 Drag-Constraints (nur innerhalb gleicher Typen: Ausgaben/Einnahmen)
  - [ ] 4.8 Rollback-Mechanismus bei Fehlern implementieren
  - [ ] 4.9 CSS-Styles für Drag-States (dragging, releasing) hinzufügen

- [ ] 5.0 Integration testen und finalisieren
  - [ ] 5.1 Layout-Konsistenz mit bestehender BudgetsView visuell vergleichen
  - [ ] 5.2 Alle bestehenden BudgetMonthCard-Features testen (Icons, Aktionen)
  - [ ] 5.3 PagingYearComponent-Integration testen (1-6 Monate, Navigation)
  - [ ] 5.4 Drag & Drop-Funktionalität in verschiedenen Szenarien testen
  - [ ] 5.5 Performance-Vergleich mit bestehender BudgetsView durchführen
  - [ ] 5.6 Responsive Verhalten und Sticky-Bereiche auf verschiedenen Bildschirmgrößen testen
  - [ ] 5.7 Kategoriegruppen-Expand/Collapse-Funktionalität vollständig testen
  - [ ] 5.8 Datenintegrität nach Drag & Drop-Operationen verifizieren
