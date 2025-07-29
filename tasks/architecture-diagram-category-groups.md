# Architektur-Diagramm: Kategoriegruppen-Struktur für BudgetsView2

## Datenmodell-Architektur

### Bestehende Datenstruktur (unverändert)

```mermaid
erDiagram
    CategoryGroup {
        string id PK
        string name
        number sortOrder
        boolean isIncomeGroup
        string updated_at
    }

    Category {
        string id PK
        string name
        string categoryGroupId FK
        string parentCategoryId FK
        number sortOrder
        boolean isActive
        boolean isIncomeCategory
        boolean isSavingsGoal
        boolean isHidden
        number budgeted
        number activity
        number available
        string icon
        string updated_at
    }

    CategoryGroup ||--o{ Category : "gruppiert"
    Category ||--o{ Category : "parent-child"
```

### Neue Logische Struktur (BudgetsView2)

```mermaid
graph TD
    A[BudgetsView2] --> B[Ausgaben-Bereich]
    A --> C[Einnahmen-Bereich]

    B --> D[Lebensbereich: Haushalt]
    B --> E[Lebensbereich: Fuhrpark]
    B --> F[Lebensbereich: Hobby]
    B --> G[Weitere Ausgaben-Lebensbereiche...]

    C --> H[Lebensbereich: Gehalt]
    C --> I[Lebensbereich: Sonstige Einnahmen]
    C --> J[Weitere Einnahmen-Lebensbereiche...]

    D --> K[Kategorie: Lebensmittel]
    D --> L[Kategorie: Reinigung]
    D --> M[Kategorie: Küche]

    E --> N[Kategorie: Benzin]
    E --> O[Kategorie: Wartung]
    E --> P[Kategorie: Versicherung]

    H --> Q[Kategorie: Grundgehalt]
    H --> R[Kategorie: Bonus]

    style B fill:#ffebee
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fff3e0
    style F fill:#fff3e0
    style H fill:#f3e5f5
    style I fill:#f3e5f5
```

## Komponenten-Architektur

### Hierarchische Struktur

```mermaid
graph TD
    A[BudgetsView2.vue] --> B[BudgetHeader2.vue]
    A --> C[BudgetGrid2.vue]
    A --> D[BudgetMonthColumns2.vue]

    B --> E[PagingYearComponent]
    B --> F[ToggleAllButton]

    C --> G[ExpenseSection]
    C --> H[IncomeSection]

    G --> I[BudgetCategoryGroup2.vue - Haushalt]
    G --> J[BudgetCategoryGroup2.vue - Fuhrpark]
    G --> K[BudgetCategoryGroup2.vue - Hobby]

    H --> L[BudgetCategoryGroup2.vue - Gehalt]
    H --> M[BudgetCategoryGroup2.vue - Sonstige]

    I --> N[CategoryGroupHeader2.vue]
    I --> O[BudgetCategoryRow2.vue - Lebensmittel]
    I --> P[BudgetCategoryRow2.vue - Reinigung]

    J --> Q[CategoryGroupHeader2.vue]
    J --> R[BudgetCategoryRow2.vue - Benzin]
    J --> S[BudgetCategoryRow2.vue - Wartung]

    D --> T[MonthColumn - Jan]
    D --> U[MonthColumn - Feb]
    D --> V[MonthColumn - Mar]

    style A fill:#e3f2fd
    style C fill:#f3e5f5
    style G fill:#ffebee
    style H fill:#e8f5e8
```

### Datenfluss-Architektur

```mermaid
graph LR
    A[CategoryStore] --> B[BudgetsView2]
    C[BudgetService] --> B

    B --> D[expenseGroups computed]
    B --> E[incomeGroups computed]
    B --> F[categoriesByGroup computed]

    D --> G[ExpenseSection]
    E --> H[IncomeSection]
    F --> I[BudgetCategoryGroup2]

    I --> J[CategoryGroupHeader2]
    I --> K[BudgetCategoryRow2]

    K --> L[MonthlyBudgetData]
    L --> M[BudgetService.getAggregatedMonthlyBudgetData]

    N[Muuri Grid] --> O[Drag Events]
    O --> P[Sort Updates]
    P --> Q[CategoryService.updateCategory]
    Q --> A

    style A fill:#e8f5e8
    style C fill:#fff3e0
    style N fill:#f3e5f5
```

## Muuri-Integration Architektur

### Grid-Layout-Struktur

```mermaid
graph TD
    A[Muuri Grid Container] --> B[Expense Groups Container]
    A --> C[Income Groups Container]

    B --> D[Group Item: Haushalt]
    B --> E[Group Item: Fuhrpark]
    B --> F[Group Item: Hobby]

    C --> G[Group Item: Gehalt]
    C --> H[Group Item: Sonstige]

    D --> I[Category Item: Lebensmittel]
    D --> J[Category Item: Reinigung]

    E --> K[Category Item: Benzin]
    E --> L[Category Item: Wartung]

    G --> M[Category Item: Grundgehalt]
    G --> N[Category Item: Bonus]

    style A fill:#e3f2fd
    style B fill:#ffebee
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fff3e0
    style G fill:#f3e5f5
    style H fill:#f3e5f5
```

### Drag & Drop Constraints

```mermaid
graph TD
    A[Drag Start] --> B{Item Type?}

    B -->|Category| C[Category Drag]
    B -->|Group| D[Group Drag]

    C --> E{Same Group Type?}
    E -->|Yes| F[Allow Drop]
    E -->|No| G[Reject Drop]

    D --> H{Same Section?}
    H -->|Expense to Expense| I[Allow Drop]
    H -->|Income to Income| J[Allow Drop]
    H -->|Cross-Section| K[Reject Drop]

    F --> L[Update sortOrder]
    I --> M[Update Group sortOrder]
    J --> N[Update Group sortOrder]

    G --> O[Visual Feedback: Invalid]
    K --> O

    L --> P[Persist to Store]
    M --> P
    N --> P

    style F fill:#e8f5e8
    style I fill:#e8f5e8
    style J fill:#e8f5e8
    style G fill:#ffebee
    style K fill:#ffebee
    style O fill:#ffebee
```

## State Management Architektur

### Lokaler State (BudgetsView2)

```mermaid
graph TD
    A[BudgetsView2 State] --> B[numMonths: ref<number>]
    A --> C[monthOffset: ref<number>]
    A --> D[expandedGroups: ref<Set<string>>]
    A --> E[dragState: ref<DragState>]

    B --> F[localStorage: budget2_months]
    C --> G[localStorage: budget2_offset]
    D --> H[localStorage: budget2_expanded_groups]

    E --> I[isDragging: boolean]
    E --> J[draggedItem: string | null]
    E --> K[dropTarget: string | null]

    style A fill:#e3f2fd
    style F fill:#fff3e0
    style G fill:#fff3e0
    style H fill:#fff3e0
```

### Computed Properties Flow

```mermaid
graph LR
    A[CategoryStore.categoryGroups] --> B[expenseGroups]
    A --> C[incomeGroups]

    D[CategoryStore.categories] --> E[categoriesByGroup]

    B --> F[ExpenseSection Rendering]
    C --> G[IncomeSection Rendering]
    E --> H[Category Rows Rendering]

    I[numMonths + monthOffset] --> J[months computed]
    J --> K[Month Columns Rendering]

    L[expandedGroups] --> M[Group Visibility]
    M --> N[Conditional Category Rendering]

    style A fill:#e8f5e8
    style D fill:#e8f5e8
    style I fill:#fff3e0
    style L fill:#f3e5f5
```

## Layout-Architektur

### Grid-System

```mermaid
graph TD
    A[Main Container: 100vh - 189px] --> B[Header: flex-shrink-0]
    A --> C[Content: flex-grow overflow-y-scroll]

    B --> D[PagingYearComponent]
    B --> E[Toggle Controls]

    C --> F[Grid Container: display: grid]

    F --> G[Category Column: 25%]
    F --> H[Month Columns: 75% / numMonths]

    G --> I[Expense Groups]
    G --> J[Income Groups]

    H --> K[Month 1 Data]
    H --> L[Month 2 Data]
    H --> M[Month N Data]

    I --> N[Group Headers]
    I --> O[Category Rows]

    style A fill:#e3f2fd
    style F fill:#f3e5f5
    style G fill:#fff3e0
    style H fill:#e8f5e8
```

### Responsive Breakpoints

```mermaid
graph TD
    A[Screen Width] --> B{> 1200px?}
    B -->|Yes| C[Desktop Layout]
    B -->|No| D{> 768px?}

    D -->|Yes| E[Tablet Layout]
    D -->|No| F[Mobile Layout]

    C --> G[6+ Months Visible]
    C --> H[Full Category Names]
    C --> I[All Columns Visible]

    E --> J[4-5 Months Visible]
    E --> K[Abbreviated Names]
    E --> L[Horizontal Scroll]

    F --> M[2-3 Months Visible]
    F --> N[Icons Only]
    F --> O[Vertical Stack]

    style C fill:#e8f5e8
    style E fill:#fff3e0
    style F fill:#ffebee
```

## Performance-Architektur

### Virtualisierung-Strategie

```mermaid
graph TD
    A[Large Dataset] --> B{> 50 Categories?}
    B -->|Yes| C[Enable Virtualization]
    B -->|No| D[Standard Rendering]

    C --> E[vue-virtual-scroller]
    E --> F[Visible Items Only]
    E --> G[Dynamic Height Calculation]

    D --> H[Full DOM Rendering]

    F --> I[Improved Performance]
    G --> I
    H --> J[Simple Implementation]

    K[Scroll Events] --> L[Update Visible Range]
    L --> M[Re-render Visible Items]

    style C fill:#e8f5e8
    style E fill:#e8f5e8
    style I fill:#e8f5e8
```

### Lazy Loading-Architektur

```mermaid
graph TD
    A[Month Data Request] --> B{Month in Cache?}
    B -->|Yes| C[Return Cached Data]
    B -->|No| D[Load from BudgetService]

    D --> E[Calculate Monthly Data]
    E --> F[Cache Result]
    F --> G[Return Data]

    C --> H[Render Month Column]
    G --> H

    I[Cache Invalidation] --> J{Data Changed?}
    J -->|Yes| K[Clear Affected Cache]
    J -->|No| L[Keep Cache]

    K --> M[Trigger Re-calculation]

    style C fill:#e8f5e8
    style F fill:#e8f5e8
    style K fill:#fff3e0
```

## Fehlerbehandlung-Architektur

### Error Boundaries

```mermaid
graph TD
    A[BudgetsView2] --> B[Error Boundary]
    B --> C[BudgetGrid2]

    C --> D{Muuri Error?}
    D -->|Yes| E[Fallback: Static Grid]
    D -->|No| F[Normal Operation]

    G[Drag Operation] --> H{Sort Update Failed?}
    H -->|Yes| I[Rollback UI State]
    H -->|No| J[Confirm Update]

    I --> K[Show Error Toast]
    I --> L[Restore Previous Order]

    M[Data Loading] --> N{Load Failed?}
    N -->|Yes| O[Show Error State]
    N -->|No| P[Render Data]

    O --> Q[Retry Button]
    Q --> R[Reload Data]

    style E fill:#ffebee
    style I fill:#ffebee
    style K fill:#ffebee
    style O fill:#ffebee
```

## Accessibility-Architektur

### Keyboard Navigation

```mermaid
graph TD
    A[Focus Management] --> B[Tab Order]
    B --> C[Group Headers]
    B --> D[Category Rows]
    B --> E[Month Columns]

    F[Keyboard Shortcuts] --> G[Space: Toggle Group]
    F --> H[Enter: Edit Mode]
    F --> I[Arrow Keys: Navigate]
    F --> J[Escape: Cancel]

    K[Screen Reader] --> L[ARIA Labels]
    K --> M[Role Attributes]
    K --> N[Live Regions]

    L --> O[Group: "Lebensbereich Haushalt"]
    M --> P[Grid: "Budget-Tabelle"]
    N --> Q[Status: "Kategorie verschoben"]

    style A fill:#e3f2fd
    style F fill:#f3e5f5
    style K fill:#fff3e0
```

Diese Architektur-Dokumentation bietet eine umfassende Übersicht über die strukturellen und technischen Aspekte der neuen BudgetsView2-Implementierung, einschließlich Datenmodell, Komponenten-Hierarchie, State Management und Performance-Optimierungen.
