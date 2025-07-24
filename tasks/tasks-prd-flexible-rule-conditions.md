# Tasks: Flexible Bedingungsverknüpfungen für Automatisierungsregeln

## Relevant Files

- `src/types/index.ts` - Erweiterung der AutomationRule und RuleCondition TypeScript-Interfaces für conditionLogic und Multi-Value-Support
- `src/stores/ruleStore.ts` - Komplette Überarbeitung der checkConditions()-Funktion für UND/ODER-Logik und Multi-Value-Operatoren
- `src/components/rules/RuleForm.vue` - UI-Erweiterungen für Haupt-Verknüpfungsoperator und Multi-Value-Inputs
- `src/components/rules/RuleConditionRow.vue` - Erweiterte Operator-Auswahl und Multi-Value-Input-Komponenten
- `src/components/ui/MultiValueInput.vue` - Neue Komponente für Tag-basierte Multi-Value-Eingabe
- `app/models/financial_models.py` - SQLAlchemy-Modell-Erweiterung um condition_logic Spalte
- `app/models/schemas.py` - Pydantic-Schema-Anpassungen für neue Felder

### Notes

- Die Regel-Engine läuft komplett im Frontend über ruleStore.ts
- Backend-Änderungen sind minimal - nur Datenmodell und Sync-Kompatibilität
- Multi-Value-Inputs verwenden Tag-basierte Eingabe für bessere UX
- Rückwärtskompatibilität muss für bestehende Regeln gewährleistet sein

## Tasks

- [ ] 1.0 Datenmodell und TypeScript-Interface-Erweiterungen
  - [ ] 1.1 AutomationRule Interface um conditionLogic: 'all' | 'any' erweitern
  - [ ] 1.2 RuleCondition.value um string[] Support erweitern (string | number | string[])
  - [ ] 1.3 RuleCondition.operator um neue Operatoren erweitern (one_of, starts_with, ends_with)
  - [ ] 1.4 Rückwärtskompatibilität sicherstellen - fehlende conditionLogic als 'all' interpretieren
  - [ ] 1.5 Type Guards für Multi-Value-Bedingungen implementieren

- [ ] 2.0 Minimale Backend-Anpassungen für Sync-Kompatibilität
  - [ ] 2.1 SQLAlchemy AutomationRule Modell um condition_logic Spalte erweitern
  - [ ] 2.2 Pydantic Schemas für neue Felder anpassen
  - [ ] 2.3 Default-Wert 'all' für condition_logic in Datenbank setzen
  - [ ] 2.4 WebSocket-Sync-Kompatibilität für neue Felder sicherstellen

- [ ] 3.0 UI-Komponenten für Multi-Value-Inputs und Haupt-Operator entwickeln
  - [ ] 3.1 Dropdown für Haupt-Verknüpfungsoperator (all/any) in RuleForm.vue implementieren
  - [ ] 3.2 Dynamischen Text "If all/any of these conditions match:" implementieren
  - [ ] 3.3 MultiValueInput.vue Komponente für Tag-basierte Eingabe erstellen
  - [ ] 3.4 RuleConditionRow.vue um Multi-Value-Input-Support erweitern
  - [ ] 3.5 Operator-Dropdown um neue Optionen erweitern (one_of, starts_with, ends_with)
  - [ ] 3.6 Conditional Rendering für Single-Value vs Multi-Value-Inputs implementieren

- [ ] 4.0 Frontend Regel-Engine-Überarbeitung (ruleStore checkConditions-Funktion)
  - [ ] 4.1 checkConditions() Funktion um UND/ODER-Logik basierend auf conditionLogic erweitern
  - [ ] 4.2 Multi-Value-Bedingungsauswertung für "one_of"-Operator implementieren
  - [ ] 4.3 Neue String-Operatoren implementieren (starts_with, ends_with)
  - [ ] 4.4 Bestehende Single-Value-Logik unverändert beibehalten
  - [ ] 4.5 Performance-Optimierung für Multi-Value-Arrays sicherstellen
  - [ ] 4.6 Fehlerbehandlung für ungültige Multi-Value-Eingaben implementieren

- [ ] 5.0 Integration, Testing und Validierung
  - [ ] 5.1 RuleForm.vue UI-Integration für alle neuen Komponenten
  - [ ] 5.2 Regel-Test-Funktion um neue Logik erweitern
  - [ ] 5.3 Validierung für Multi-Value-Eingaben implementieren (leere Werte ignorieren)
  - [ ] 5.4 Rückwärtskompatibilität mit bestehenden Regeln testen
  - [ ] 5.5 End-to-End-Tests für neue Regel-Erstellung und -Ausführung
  - [ ] 5.6 Performance-Tests für große Multi-Value-Listen durchführen
