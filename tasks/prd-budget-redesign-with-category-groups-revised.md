# PRD: Budget-Überarbeitung mit Kategoriegruppen (Lebensbereichen) - Überarbeitet

## Einführung/Überblick

Die aktuelle BudgetsView in FinWise verwendet eine kaskadierte Kategorienstruktur (Parent-Child), die bei vielen Kategorien grafisch nicht mehr funktioniert und die Übersicht verliert. Diese PRD beschreibt die Überarbeitung zu einer neuen Struktur basierend auf Kategoriegruppen (im UI "Lebensbereiche" genannt), **unter Beibehaltung des bestehenden Layouts und der Navigation der aktuellen BudgetsView**.

**Ziel**: Erstellung einer neuen "Budgets 2" View als Vergleichsimplementierung zur bestehenden BudgetsView, mit flacher Kategorienstruktur, gruppierten Lebensbereichen und Drag & Drop-Funktionalität, aber **identischem Layout-Design**.

## Ziele

1. **Layout-Konsistenz**: Übernahme des bestehenden BudgetsView-Layouts (Nicht zwingend der heutigen Komponentenstruktur, da diese nicht richtig konsistent war. Auch wegen Muuri ein Problem möglicherweise.)
2. **Sticky-Bereiche**: Header und Kategoriespalte bleiben fixiert beim Scrollen (Monate über Paging Komponente scrollbar)
3. **Monatsnavigation**: Identische PagingYearComponent-Integration (1-6 Monate)
4. **Flache Kategorienstruktur**: Eliminierung der Parent-Child-Beziehungen zugunsten von Kategoriegruppen
5. **Drag & Drop-Funktionalität**: Intuitive Sortierung und Reorganisation von Kategorien und Gruppen

## User Stories

### US1: Als Benutzer möchte ich die gewohnte Budget-Navigation verwenden
**Akzeptanzkriterien:**
- PagingYearComponent funktioniert identisch zur bestehenden BudgetsView
- Monatsanzahl zwischen 1-6 einstellbar
- Horizontales Scrolling für Monate bei der Navigatbei mehr als verfügbarem Platz
- Sticky Header mit Monatsüberschriften bleibt beim vertikalen Scrollen fixiert

### US2: Als Benutzer möchte ich die gewohnte Kategoriespalte haben
**Akzeptanzkriterien:**
- Kategoriespalte bleibt beim horizontalen Scrollen sticky
- Toggle-Button "alle einklappen/ausklappen" funktioniert wie gewohnt
- Kategorien werden nach Lebensbereichen (Kategoriegruppen) gruppiert dargestellt
- Ausgaben und Einnahmen sind klar getrennt

### US3: Als Benutzer möchte ich die gewohnten Monatsspalten sehen
**Akzeptanzkriterien:**
- BudgetMonthHeaderCard wird wiederverwendet
- BudgetMonthCard-Funktionalität bleibt erhalten
- Spaltenbreite passt sich automatisch an verfügbare Breite an
- Icons für Budget-Aktionen (Umschlag, Ziel, etc.) bleiben erhalten

### US4: Als Benutzer möchte ich Kategorien per Drag & Drop sortieren können
**Akzeptanzkriterien:**
- Kategorien können innerhalb eines Lebensbereichs sortiert werden
- Kategorien können zwischen Lebensbereichen des gleichen Typs verschoben werden
- Lebensbereiche können innerhalb ihres Typs (Ausgaben/Einnahmen) sortiert werden
- Sortierung wird über das `sortOrder`-Feld persistiert

## Funktionale Anforderungen

### FR1: Layout-Kompatibilität
- Das System MUSS das exakte Layout der bestehenden BudgetsView verwenden
- Das System KANN die bestehenden Komponenten BudgetMonthHeaderCard und BudgetMonthCard wiederverwenden, sofern mit muuri realisierbar
- Das System MUSS die PagingYearComponent unverändert integrieren
- Das System MUSS die sticky-Bereiche (Header (je nach Paging Year Component Einstellung) + Kategoriespalte) beibehalten

### FR2: Kategoriegruppen-Darstellung
- Das System MUSS Kategorien nach Kategoriegruppen (Lebensbereichen) gruppiert anzeigen
- Das System MUSS Ausgaben- und Einnahmenkategorien getrennt darstellen
- Das System MUSS für jede Gruppe einen Expand/Collapse-Button bereitstellen
- Das System MUSS die bestehende Toggle-All-Funktionalität beibehalten

### FR3: Drag & Drop-Funktionalität
- Das System MUSS Muuri.js für Drag & Drop-Operationen verwenden
- Das System MUSS Kategorien innerhalb einer Gruppe sortierbar machen
- Das System MUSS Kategorien zwischen Gruppen des gleichen Typs verschiebbar machen
- Das System MUSS Gruppen innerhalb ihres Typs sortierbar machen
- Das System MUSS Sortierungen über das `sortOrder`-Feld persistieren

### FR4: Datenkompatibilität
- Das System MUSS die bestehende Datenstruktur unverändert verwenden
- Das System MUSS mit der bestehenden CategoryStore-Implementierung arbeiten
- Das System MUSS die bestehenden BudgetService-Methoden nutzen
- Das System MUSS JSON-Import/Export-Kompatibilität beibehalten

### FR5: Navigation und Routing
- Das System MUSS einen neuen Route "/budgets2" bereitstellen
- Das System MUSS einen "Budgets 2" Menüeintrag in der MainNavigation hinzufügen
- Das System MUSS beide Budget-Views parallel funktionsfähig halten

## Non-Goals (Out of Scope)

1. **Keine Layout-Änderungen**: Das bestehende BudgetsView-Layout bleibt sinngemäß unverändert, darf aber vom Design her angepasst werden (kleinere Schriften, Gruppierungsdesign, etc.)
3. **Keine Datenstruktur-Änderungen**: Bestehende CategoryStore und CategoryService bleiben unverändert
4. **Keine Löschung der alten View**: BudgetsView bleibt als Vergleich bestehen
5. **Keine neuen Budget-Features**: Fokus liegt auf Kategoriegruppen-Darstellung, Der Datenfelderansicht wie bisher und möglicherweise der Contextmenüoptionen (Umbuchungen innerhalb Kategorien)

## Design-Überlegungen

### Komponenten-Wiederverwendung
```
BudgetsView2.vue (neue Hauptview)
├── PagingYearComponent (wiederverwendet)
├── BudgetMonthHeaderCard (Kann wiederverwendet werden)
├── BudgetCategoriesAndValues2.vue (neue Kategoriespalte mit Gruppen und vielleicht auch mit der Budget Monthcard zusammenlegen?)
└── BudgetMonthCard (kann wiederverwendet werden, wenn es designlogisch zueinanderpasst. Ich schlage vor, den Datenteil als eine eigene Gesamteinheit zu betrachten. Achtung auf die Monats-Headerstruktur. Vielleicht alles zusammenlegen?)
```

### Layout-Struktur (identisch zu BudgetsView)
- **Header-Bereich**: Sticky, mit PagingYearComponent
- **Tabellenkopf**: Sticky, mit BudgetMonthHeaderCard
- **Datenbereich**: Scrollbar, mit BudgetCategoriesAndValues2 + BudgetMonthCard
- **Spaltenaufteilung**: `calc(100% / (numMonths + 1))`

## Technische Überlegungen

### Bestehende Komponenten-Integration
- **PagingYearComponent**: Unveränderte Übernahme
- **BudgetMonthHeaderCard**: siehe oben
- **BudgetMonthCard**: siehe oben
- **BudgetCategoriesAndValues**: Neue Version mit Kategoriegruppen-Logik, sonst siehe oben.

### Muuri-Integration
- **Grid-Container**: Nur in der neuen BudgetCategoriesAndValues2
- **Draggable Items**: Kategoriegruppen und einzelne Kategorien
- **Layout-Constraints**: Beibehaltung der sticky-Spalten-Struktur

## Erfolgsmetriken

1. **Layout-Konsistenz**: visuelle Übereinstimmung mit bestehender BudgetsView mit Designoptimierungen
2. **Funktionalität**: 100% Feature-Parität mit bestehender BudgetsView
3. **Performance**: Identische Ladezeiten wie bestehende BudgetsView
4. **Benutzerfreundlichkeit**: Keine Lernkurve durch Layout-Änderungen

## Implementierungsplan

### Phase 1: Layout-Übernahme
- Exakte Kopie der BudgetsView-Struktur
- Integration der bestehenden Komponenten
- Neue Route und Navigation

### Phase 2: Kategoriegruppen-Integration
- Neue BudgetCategoriesAndValues2 mit Gruppierung
- Anpassung der Datenlogik für Kategoriegruppen
- Beibehaltung aller bestehenden Features

### Phase 3: Muuri-Integration
- Drag & Drop für Kategorien und Gruppen (Immer mit an den Datenbereich denken!!!)
- Sortierung-Persistierung
- Test durch Produktmanager

## Technische Spezifikationen

### Neue Dateien
- `src/views/BudgetsView2.vue` (basiert auf BudgetsView.vue)
- `src/components/budget/BudgetCategoriesAndValues2.vue` (neue Kategoriespalte)

### Geänderte Dateien
- `src/components/ui/MainNavigation.vue` (neuer Menüeintrag)
- `src/router/index.ts` (neue Route)

### Wiederverwendete Komponenten
- `src/components/budget/BudgetMonthHeaderCard.vue`
- `src/components/budget/BudgetMonthCard.vue`
- `src/components/ui/PagingYearComponent.vue`
