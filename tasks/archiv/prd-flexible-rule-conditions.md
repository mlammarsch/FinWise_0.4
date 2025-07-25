# PRD: Flexible Bedingungsverknüpfungen für Automatisierungsregeln

## Introduction/Overview

Die aktuelle Regel-Engine in FinWise unterstützt nur UND-Verknüpfungen zwischen Bedingungen. Dies führt dazu, dass Benutzer viele redundante Regeln erstellen müssen, wenn sie ähnliche Empfänger (z.B. verschiedene Lebensmitteldiscounter) mit derselben Aktion verknüpfen möchten.

**Problem:** Ein Benutzer möchte alle Transaktionen von verschiedenen Lebensmitteldiscountern (Aldi, Lidl, Rewe, etc.) automatisch der Kategorie "Lebensmittel" zuordnen. Aktuell muss er für jeden Discounter eine separate Regel erstellen.

**Ziel:** Implementierung flexibler Bedingungsverknüpfungen (UND/ODER) und Multi-Value-Operatoren ("one of"), um die Anzahl benötigter Regeln erheblich zu reduzieren und die Benutzerfreundlichkeit zu verbessern.

## Goals

1. **Reduzierung der Regelanzahl:** Benutzer können mit einer Regel mehrere ähnliche Bedingungen abdecken
2. **Verbesserte Benutzerfreundlichkeit:** Intuitive UI für komplexe Bedingungslogik
3. **Erhöhte Flexibilität:** Unterstützung für UND/ODER-Verknüpfungen auf Regel-Ebene
4. **Multi-Value-Support:** "one of"-Operator für Listen von Werten
5. **Rückwärtskompatibilität:** Bestehende Regeln funktionieren weiterhin ohne Änderungen

## User Stories

**US1:** Als Benutzer möchte ich eine Regel erstellen, die ENTWEDER bei Empfänger "Aldi" ODER bei Empfänger "Lidl" ODER bei Empfänger "Rewe" greift, damit ich nicht drei separate Regeln erstellen muss.

**US2:** Als Benutzer möchte ich eine Regel erstellen, die bei Empfänger "one of [Aldi, Lidl, Rewe]" UND Betrag größer 50€ greift, damit ich spezifische Bedingungskombinationen erstellen kann.

**US3:** Als Benutzer möchte ich zwischen "alle Bedingungen müssen erfüllt sein" (UND) und "mindestens eine Bedingung muss erfüllt sein" (ODER) wählen können, damit ich flexible Regellogik erstellen kann.

**US4:** Als Benutzer möchte ich bei String-Feldern (Empfänger, Beschreibung) mehrere Werte in einem "one of"-Operator eingeben können, damit ich Listen von ähnlichen Werten effizient verwalten kann.

## Functional Requirements

### FR1: Haupt-Verknüpfungsoperator
1.1. Das System muss eine Dropdown-Auswahl für die Haupt-Verknüpfungslogik bereitstellen
1.2. Verfügbare Optionen: "all" (alle Bedingungen müssen erfüllt sein) und "any" (mindestens eine Bedingung muss erfüllt sein)
1.3. Standard-Wert ist "all" für Rückwärtskompatibilität
1.4. Die Auswahl muss prominent im UI oberhalb der Bedingungsliste angezeigt werden

### FR2: Multi-Value-Operator "one of"
2.1. Das System muss einen "one of"-Operator für String-basierte Felder (Empfänger, Beschreibung) bereitstellen
2.2. Bei Auswahl von "one of" muss ein Multi-Select-Input-Feld angezeigt werden
2.3. Benutzer müssen mehrere Werte durch Komma getrennt oder als Tags eingeben können
2.4. Das System muss die Eingabe validieren und leere Werte ignorieren

### FR3: Erweiterte Operator-Optionen
3.1. Für String-Felder: "is", "contains", "one of", "starts with", "ends with"
3.2. Für Zahlen-Felder: "is", "greater", "greater equal", "less", "less equal", "approx"
3.3. Für Datum-Felder: "is", "greater", "greater equal", "less", "less equal"
3.4. Für Select-Felder (Konto, Kategorie): "is", "one of"

### FR4: UI-Anpassungen
4.1. Haupt-Verknüpfungsoperator muss als Dropdown oberhalb der Bedingungen angezeigt werden
4.2. Text muss sich dynamisch anpassen: "If all of these conditions match:" vs "If any of these conditions match:"
4.3. Multi-Value-Eingabefelder müssen bei "one of"-Operator angezeigt werden
4.4. Bestehende Single-Value-Eingaben müssen bei anderen Operatoren angezeigt werden

### FR5: Backend-Logik
5.1. Die `checkConditions()`-Funktion muss UND/ODER-Logik basierend auf `conditionLogic`-Eigenschaft implementieren
5.2. Multi-Value-Bedingungen müssen korrekt ausgewertet werden (Wert in Array enthalten)
5.3. Bestehende Single-Value-Logik muss unverändert funktionieren
5.4. Performance darf sich bei normalen Regelmengen nicht verschlechtern

### FR6: Datenmodell-Erweiterungen
6.1. `AutomationRule`-Interface muss um `conditionLogic: 'all' | 'any'`-Eigenschaft erweitert werden
6.2. `RuleCondition.value` muss `string | number | string[]` unterstützen
6.3. `RuleCondition.operator` muss erweiterte Operatoren unterstützen
6.4. Bestehende Regeln ohne `conditionLogic` müssen als "all" interpretiert werden

## Non-Goals (Out of Scope)

- **Verschachtelte Bedingungsgruppen:** Keine Unterstützung für komplexe Verschachtelungen wie "(A UND B) ODER (C UND D)"
- **Reguläre Ausdrücke:** Keine RegEx-Unterstützung in Bedingungen
- **Dynamische Bedingungen:** Keine Bedingungen basierend auf anderen Regeln oder zeitabhängigen Werten
- **Migration bestehender Regeln:** Da leere Datenbank, keine Migrations-Scripts erforderlich
- **Unit-Tests:** Explizit ausgeschlossen per Anforderung
- **Performance-Optimierung:** Keine speziellen Performance-Optimierungen für sehr große Regelmengen

## Design Considerations

### UI-Layout
```
┌─────────────────────────────────────────────────────────────┐
│ If [all ▼] of these conditions match:                       │
├─────────────────────────────────────────────────────────────┤
│ [recipient ▼] [one of ▼] [Aldi, Lidl, Rewe...] [×]         │
│ [account   ▼] [is    ▼] [Girokonto            ] [×]         │
│ [+ Add Condition]                                           │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Value-Input
- Tag-basierte Eingabe für "one of"-Werte
- Komma-getrennte Eingabe mit automatischer Tag-Erstellung
- Visueller Unterschied zu Single-Value-Inputs

### Bestehende Komponenten
- Wiederverwendung von `SelectAccount`, `SelectCategory`, `SelectRecipient`
- Erweiterung um Multi-Select-Varianten wo sinnvoll
- Konsistente Styling mit DaisyUI

## Technical Considerations

### Frontend-Änderungen
- **RuleForm.vue:** UI-Erweiterungen für Haupt-Operator und Multi-Value-Inputs
- **ruleStore.ts:** Komplette Überarbeitung der `checkConditions()`-Funktion
- **types/index.ts:** Erweiterung der TypeScript-Interfaces

### Backend-Änderungen
- **Minimal:** Nur Datenmodell-Anpassungen in SQLAlchemy-Modellen
- **Keine API-Änderungen:** Bestehende CRUD-Endpunkte funktionieren weiter
- **Sync-Kompatibilität:** Neue Felder müssen in WebSocket-Sync integriert werden

### Datenbank-Schema
```sql
-- Erweiterte automation_rules Tabelle
ALTER TABLE automation_rules ADD COLUMN condition_logic VARCHAR(10) DEFAULT 'all';

-- conditions JSON-Struktur erweitert um Multi-Value-Support
-- Beispiel: {"operator": "one_of", "value": ["Aldi", "Lidl", "Rewe"]}
```

### Kompatibilität
- Bestehende Regeln ohne `conditionLogic` werden als "all" behandelt
- Single-Value-Bedingungen funktionieren unverändert
- Multi-Value-Arrays werden nur bei "one_of"-Operator verwendet

## Success Metrics

1. **Regelreduktion:** Benutzer können mindestens 50% ihrer redundanten Regeln durch flexible Verknüpfungen ersetzen
2. **Benutzerakzeptanz:** Neue Regel-Erstellung nutzt zu 70% die neuen Verknüpfungsoptionen
3. **Funktionalität:** 100% der bestehenden Regeln funktionieren nach dem Update weiterhin
4. **Performance:** Regel-Ausführungszeit erhöht sich um maximal 10% bei normalen Regelmengen
5. **Usability:** Benutzer können ohne Dokumentation die neuen Features verstehen und nutzen

## Open Questions

1. **Multi-Select-UI:** Soll für Konto/Kategorie-Auswahl auch Multi-Select unterstützt werden oder nur für Freitext-Felder?
2. **Validierung:** Wie sollen leere oder doppelte Werte in Multi-Value-Listen behandelt werden?
3. **Import/Export:** Sollen Regeln mit neuer Logik in CSV-Export/Import unterstützt werden?
4. **Regel-Vorschau:** Soll die Test-Funktion erweitert werden, um die neue Logik zu visualisieren?
5. **Performance-Grenze:** Ab welcher Anzahl von Werten in "one_of"-Listen sollte eine Warnung angezeigt werden?

## Implementation Priority

**Phase 1 (Core):**
- Datenmodell-Erweiterungen
- Backend-Logik für UND/ODER-Verknüpfungen
- Basis-UI für Haupt-Verknüpfungsoperator

**Phase 2 (Multi-Value):**
- "one of"-Operator-Implementierung
- Multi-Value-UI-Komponenten
- Erweiterte Operator-Optionen

**Phase 3 (Polish):**
- UI-Verbesserungen und Validierung
- Regel-Test-Funktion-Erweiterung
- Dokumentation und Benutzer-Feedback
