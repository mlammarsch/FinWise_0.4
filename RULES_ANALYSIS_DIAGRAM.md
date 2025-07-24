# FinWise Automatisierungsregeln - Anwendungsfälle Diagramm

## Übersicht der vier Regel-Anwendungsfälle

```mermaid
graph TD
    %% Eingangspunkte
    A[RuleForm Test Button] --> A1{Regel aktiv?}
    B[AdminRulesView Play Button] --> B1{Regel aktiv?}
    C[Manuelle Transaktion] --> C1[TransactionService.addTransaction]
    D[CSV Import] --> D1[CSVImportService.startImport]

    %% RuleForm Test (Fall 1)
    A1 -->|Ja| A2[ruleStore.checkConditions]
    A1 -->|Nein| A3[Keine Anwendung]
    A2 --> A4[Virtuelle Prüfung]
    A4 --> A5[Ergebnis anzeigen]

    %% AdminRulesView Play (Fall 2)
    B1 -->|Ja| B2[ruleStore.checkConditions]
    B1 -->|Nein| B3[Keine Anwendung]
    B2 --> B4[Alle Transaktionen prüfen]
    B4 --> B5[Anzahl Treffer anzeigen]
    B5 --> B6{Bestätigung?}
    B6 -->|Ja| B7[ruleStore.applyActions auf Treffer]
    B6 -->|Nein| B8[Abbruch]

    %% Manuelle Transaktion (Fall 3)
    C1 --> C2[PRE Stage Regeln]
    C2 --> C3[DEFAULT Stage Regeln]
    C3 --> C4[POST Stage Regeln]
    C2 --> C5[ruleStore.applyRulesToTransaction]
    C3 --> C5
    C4 --> C5
    C5 --> C6{Regel aktiv & Stage match?}
    C6 -->|Ja| C7[ruleStore.checkConditions]
    C6 -->|Nein| C8[Nächste Regel]
    C7 -->|Match| C9[ruleStore.applyActions]
    C7 -->|Kein Match| C8
    C9 --> C10[Transaktion aktualisiert]

    %% CSV Import (Fall 4)
    D1 --> D2[PRE/DEFAULT Batch vor Speichern]
    D1 --> D3[POST Batch nach Speichern]
    D2 --> D4[ruleStore.applyRulesToTransaction]
    D3 --> D4
    D4 --> D5{Regel aktiv & Stage match?}
    D5 -->|Ja| D6[ruleStore.checkConditions]
    D5 -->|Nein| D7[Nächste Regel]
    D6 -->|Match| D8[ruleStore.applyActions]
    D6 -->|Kein Match| D7
    D8 --> D9[Batch aktualisiert]

    %% Gemeinsame Regel-Engine
    subgraph "Kanonische Regel-Engine (ruleStore)"
        E1[checkConditions]
        E2[applyActions]
        E3[NO_CATEGORY Spezialfall]
        E4[Bedingungsprüfung]
        E5[Aktionsausführung]

        E1 --> E3
        E1 --> E4
        E2 --> E5
    end

    %% Verbindungen zur gemeinsamen Engine
    A2 -.-> E1
    B2 -.-> E1
    C7 -.-> E1
    D6 -.-> E1

    B7 -.-> E2
    C9 -.-> E2
    D8 -.-> E2

    %% Styling
    classDef testCase fill:#e1f5fe
    classDef ruleEngine fill:#f3e5f5
    classDef decision fill:#fff3e0
    classDef action fill:#e8f5e8

    class A,B,C,D testCase
    class E1,E2,E3,E4,E5 ruleEngine
    class A1,B1,B6,C6,D5 decision
    class A5,B7,C10,D9 action
```

## Regel-Felder Berücksichtigung

```mermaid
graph LR
    subgraph "Regel-Eigenschaften"
        R1[isActive: boolean]
        R2[stage: PRE/DEFAULT/POST]
        R3[priority: number]
        R4[conditions: Array]
        R5[actions: Array]
    end

    subgraph "Fall 1: RuleForm Test"
        F1A[✅ isActive geprüft]
        F1B[❌ stage ignoriert]
        F1C[❌ priority ignoriert]
        F1D[✅ conditions geprüft]
        F1E[❌ actions nicht ausgeführt]
    end

    subgraph "Fall 2: AdminRulesView Play"
        F2A[✅ isActive geprüft]
        F2B[❌ stage ignoriert]
        F2C[❌ priority ignoriert]
        F2D[✅ conditions geprüft]
        F2E[✅ actions ausgeführt]
    end

    subgraph "Fall 3: Manuelle Transaktion"
        F3A[✅ isActive geprüft]
        F3B[✅ stage berücksichtigt]
        F3C[✅ priority sortiert]
        F3D[✅ conditions geprüft]
        F3E[✅ actions ausgeführt]
    end

    subgraph "Fall 4: CSV Import"
        F4A[✅ isActive geprüft]
        F4B[✅ stage berücksichtigt]
        F4C[✅ priority sortiert]
        F4D[✅ conditions geprüft]
        F4E[✅ actions ausgeführt]
    end

    R1 --> F1A
    R1 --> F2A
    R1 --> F3A
    R1 --> F4A

    R2 --> F3B
    R2 --> F4B

    R3 --> F3C
    R3 --> F4C

    R4 --> F1D
    R4 --> F2D
    R4 --> F3D
    R4 --> F4D

    R5 --> F2E
    R5 --> F3E
    R5 --> F4E
```

## Kritische Erkenntnisse

### ✅ Behobenes Problem
- **AdminRulesView** verwendete eigene `checkConditions`-Implementierung ohne `NO_CATEGORY` Spezialfall
- **Lösung**: Ersetzt durch kanonische `ruleStore.checkConditions()`

### 🔍 Unterschiede zwischen Fällen

| Aspekt | RuleForm Test | AdminRulesView Play | Manuelle Transaktion | CSV Import |
|--------|---------------|-------------------|---------------------|------------|
| **isActive** | ✅ Geprüft | ✅ Geprüft | ✅ Geprüft | ✅ Geprüft |
| **stage** | ❌ Ignoriert | ❌ Ignoriert | ✅ PRE/DEFAULT/POST | ✅ PRE/DEFAULT/POST |
| **priority** | ❌ Ignoriert | ❌ Ignoriert | ✅ Sortiert | ✅ Sortiert |
| **conditions** | ✅ Virtuell | ✅ Real | ✅ Real | ✅ Real |
| **actions** | ❌ Nur Test | ✅ Ausgeführt | ✅ Ausgeführt | ✅ Ausgeführt |

### 📋 Empfehlungen

1. **Konsistenz**: Alle Fälle verwenden jetzt dieselbe `checkConditions`-Implementierung
2. **NO_CATEGORY**: Funktioniert jetzt in allen Fällen korrekt
3. **Testing**: RuleForm Test sollte auch `stage` und `priority` berücksichtigen (optional)
4. **AdminRulesView**: Könnte optional auch `stage`-Filter anbieten
