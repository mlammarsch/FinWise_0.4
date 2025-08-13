# Dokumentation: `BudgetsView` und ihre Komponenten

## 1. Gesamtarchitektur

Die Budgetansicht in FinWise ist modular aufgebaut und besteht aus drei Kernkomponenten, die die Verantwortlichkeiten klar trennen:

1.  **`BudgetsView.vue` (Der Orchestrator)**: Die Haupt-View, die als Container und Daten-Orchestrator dient. Sie ist verantwortlich für die globalen Einstellungen wie den angezeigten Zeitraum und stellt die Grundstruktur der Seite bereit.
2.  **`BudgetMonthHeaderCard.vue` (Die Monats-Kopfzeile)**: Eine reine Anzeigekomponente, die aggregierte Summen für einen einzelnen Monat darstellt.
3.  **`BudgetCategoriesAndValues.vue` (Die Matrix)**: Die zentrale und komplexeste Komponente. Sie rendert die eigentliche Budget-Matrix (Kategorien vs. Monate) und beherbergt die gesamte Interaktionslogik.

Diese Struktur sorgt dafür, dass die Datenlogik von der reinen Darstellung getrennt ist und die Komponenten wiederverwendbar bleiben.

## 2. Datenfluss-Diagramm

Das folgende Diagramm zeigt den allgemeinen Datenfluss von den Datenquellen (Stores) über die Service-Schicht bis hin zu den UI-Komponenten.

```mermaid
flowchart TD
    subgraph Datenquellen (Stores)
        transactionStore["transactionStore<br>(Ist-Ausgaben)"]
        planningStore["planningStore<br>(Geplante Ausgaben)"]
        categoryStore["categoryStore<br>(Kategoriestruktur)"]
        monthlyBalanceStore["monthlyBalanceStore<br>(Performance-Cache)"]
    end

    subgraph Service-Schicht
        BalanceService
        BudgetService
    end

    subgraph UI-Komponenten
        subgraph BudgetsView.vue
            A[PagingYearComponent]
            B[BudgetMonthHeaderCard]
        end
        C[BudgetCategoriesAndValues.vue]
    end

    %% Datenflüsse
    transactionStore --> BudgetService
    planningStore --> BudgetService
    categoryStore --> C

    BudgetService --> transactionStore
    BudgetService --> planningStore

    BalanceService --> monthlyBalanceStore
    BalanceService --> transactionStore

    %% View zu Services
    BudgetsView.vue -- "ruft getTodayBalance für 'Verfügbare Mittel' auf" --> BalanceService
    C -- "ruft getAggregatedMonthlyBudgetData für jede Zelle auf" --> BudgetService

    %% View zu Komponenten
    BudgetsView.vue -- "übergibt Monate als Props" --> B
    BudgetsView.vue -- "übergibt Monate als Props" --> C
    BudgetsView.vue -- "rendert" --> A

    style BudgetsView.vue fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#ccf,stroke:#333,stroke-width:2px
```

## 3. Komponente: `BudgetsView.vue`

### Verantwortlichkeiten

-   **Zeitraum-Management**: Steuert über den `PagingYearComponent`, welche und wie viele Monate angezeigt werden (`numMonths`, `monthOffset`).
-   **Daten-Orchestrierung für Header**: Berechnet die anzuzeigenden Monate (`months`-computed) und holt die aggregierten Kopfzeilen-Werte (z.B. den Saldo der Kategorie "Verfügbare Mittel") über den `BalanceService`. Diese aggregierten Daten werden dann als Props an die `BudgetMonthHeaderCard`-Komponenten weitergegeben.
-   **Layout-Struktur**: Definiert das grundlegende Layout, inklusive der sticky Kopfzeile und dem scrollbaren Bereich für die Matrix.
-   **Globale UI-Aktionen**: Beherbergt die Buttons zum globalen Ein- und Ausklappen aller Kategoriegruppen.

### Woher kommen die Daten?

-   **Monats-Array (`months`)**: Wird direkt in der Komponente basierend auf dem `monthOffset` und `numMonths` berechnet.
-   **Verfügbare Mittel (`availableByMonth`)**: Werden durch den Aufruf von `BalanceService.getTodayBalance()` für die spezielle Kategorie "Verfügbare Mittel" für jeden angezeigten Monat ermittelt. Der `BalanceService` nutzt hierfür den schnellen `monthlyBalanceStore` als Cache.

## 4. Komponente: `BudgetMonthHeaderCard.vue`

### Zweck und Datenherkunft

-   **Zweck**: Stellt die aggregierten Finanzdaten für **einen einzelnen Monat** in der Kopfzeile dar.
-   **Datenherkunft**: Diese Komponente ist eine "dumme" Anzeigekomponente. Sie erhält **alle** benötigten Daten (Label, Salden wie `available`, `budgeted`, etc.) als **Props** von der übergeordneten `BudgetsView.vue`. Sie führt selbst keine Berechnungen durch.
-   **Aktionen**: Sie enthält UI-Elemente (z.B. ein Dropdown-Menü) für **monatsweite Budget-Aktionen** (z.B. "Budget-Template anwenden", "Budget zurücksetzen"). Diese Aktionen werden aber nicht hier, sondern im `BudgetService` implementiert und von hier aus nur aufgerufen.

## 5. Komponente: `BudgetCategoriesAndValues.vue`

### Verantwortlichkeiten

-   **Matrix-Rendering**: Zeigt die Haupttabelle mit Kategorien (Zeilen) und Monaten (Spalten) an.
-   **Datenberechnung pro Zelle**: Ist dafür verantwortlich, die vier Kernwerte für jede Zelle zu ermitteln:
    1.  **Budgetiert**: Die Summe der geplanten Zuweisungen.
    2.  **Ausgegeben**: Die Summe der tatsächlichen Transaktionen.
    3.  **Prognose**: Die Summe aus geplanten und tatsächlichen Ausgaben.
    4.  **Saldo**: Die Differenz zwischen "Budgetiert" und "Ausgegeben".
-   **Interaktivität**: Implementiert die komplexe Benutzerinteraktion:
    *   **Direkte Budget-Bearbeitung**: Klickt der Benutzer auf ein Budgetfeld, wird ein `CalculatorInput` angezeigt. Eine Änderung des Wertes erstellt im Hintergrund eine `CATEGORYTRANSFER`-Transaktion über den `TransactionService`, um die Budget-Anpassung zu realisieren.
    *   **Drag-and-Drop**: Nutzt `Muuri.js`, um das Umsortieren von Kategorien per Drag-and-Drop zu ermöglichen.
    *   **Kontextmenüs und Modale**: Öffnet Modale zur Anzeige von Transaktionen oder zur Erstellung von Planungsbuchungen für eine spezifische Kategorie.

### Woher kommen die Daten?

-   **Kategoriestruktur**: Die Liste der Kategorien und deren Gruppierung stammt direkt aus dem `categoryStore`.
-   **Budget-Werte (pro Zelle)**: Im Gegensatz zum Header holt diese Komponente die Daten **selbst**. Für jede Zelle in der Matrix ruft sie `BudgetService.getAggregatedMonthlyBudgetData(categoryId, month.start, month.end)` auf. Der `BudgetService` wiederum holt die rohen Transaktions- und Planungsdaten aus dem `transactionStore` und `planningStore` und aggregiert sie. Dies ist notwendig, da hier detaillierte Werte pro Kategorie benötigt werden, die nicht im globalen `monthlyBalanceStore`-Cache vorgehalten werden.

## 6. Zusammenfassung: Wo werden Salden gehalten?

Dies ist ein entscheidender Punkt in der Architektur: **Die UI-Komponenten halten keine eigenen Saldo-Zustände.**

-   **Die "Source of Truth" (Wahrheitsquelle)** sind immer die rohen Daten in den zentralen Pinia-Stores:
    -   `transactionStore`: Enthält alle tatsächlichen Buchungen.
    -   `planningStore`: Enthält alle geplanten, wiederkehrenden Buchungen.
    -   `categoryStore`: Definiert die Struktur und die Beziehungen der Kategorien.

-   **Der `monthlyBalanceStore`** fungiert als **Performance-Cache** für bereits aggregierte Monats-Endsalden. Er ist eine abgeleitete, denormalisierte Sicht auf die Rohdaten, um schnelle Abfragen zu ermöglichen.

-   **Die `BalanceService` und `BudgetService`** sind die **Abstraktionsschichten**. UI-Komponenten fragen nie direkt die Stores ab, sondern stellen Anfragen an diese Services (z.B. "Gib mir den Saldo für Kategorie X im Monat Y"). Die Services entscheiden dann, ob sie die Antwort schnell aus dem Cache (`monthlyBalanceStore`) liefern können oder ob sie eine Neuberechnung aus den Rohdaten (`transactionStore`, `planningStore`) durchführen müssen.

-   **Die `BudgetsView` und ihre Kinder** sind reine **Konsumenten** dieser Services. Sie fordern Daten an und stellen sie dar, verändern aber nie direkt den Saldo-Zustand. Eine Benutzeraktion (wie eine Budget-Anpassung) führt zu einem Service-Aufruf, der eine neue Transaktion erstellt, was wiederum die Stores aktualisiert und eine reaktive Neudarstellung der UI auslöst.

Dieser Ansatz stellt sicher, dass die Daten konsistent bleiben und die Logik an einem zentralen Ort gekapselt ist, anstatt über viele Komponenten verteilt zu sein.
