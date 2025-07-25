# AutomationRule Recipient-Validierung

## Übersicht

Diese Dokumentation beschreibt die neu implementierten Validierungsmethoden im `ruleStore` für die sichere Löschung von Recipients. Die Methoden prüfen auf aktive Referenzen in AutomationRules und verhindern Dateninkonsistenzen.

## Implementierte Methoden

### 1. `getAutomationRulesWithRecipient(recipientId: string)`

**Zweck:** Findet alle AutomationRules die einen bestimmten Recipient referenzieren.

**Parameter:**
- `recipientId: string` - Die zu suchende Recipient-ID

**Rückgabe:** `Promise<AutomationRule[]>` - Array der gefundenen AutomationRules

**Suchlogik:**
- **Conditions:** Prüft `RuleConditionType.RECIPIENT_EQUALS` und `RuleConditionType.RECIPIENT_CONTAINS`
- **Actions:** Prüft `RuleActionType.SET_RECIPIENT`
- **Referenz-Matching:** Direkte ID-Vergleiche mit `String(condition.value)` und `String(action.value)`

**Beispiel:**
```typescript
const automationRules = await ruleStore.getAutomationRulesWithRecipient('recipient-123');
console.log(`Gefunden: ${automationRules.length} AutomationRules`);
```

### 2. `countAutomationRulesWithRecipient(recipientId: string)`

**Zweck:** Zählt die Anzahl der AutomationRules die einen bestimmten Recipient referenzieren.

**Parameter:**
- `recipientId: string` - Die zu suchende Recipient-ID

**Rückgabe:** `Promise<number>` - Anzahl der gefundenen AutomationRules

**Performance:** Optimierte Version von `getAutomationRulesWithRecipient` für reine Zählung ohne Array-Erstellung.

**Beispiel:**
```typescript
const count = await ruleStore.countAutomationRulesWithRecipient('recipient-123');
console.log(`Anzahl: ${count} AutomationRules`);
```

### 3. `validateRecipientDeletion(recipientIds: string[])`

**Zweck:** Validiert die Löschung von Recipients durch Prüfung auf aktive Referenzen in AutomationRules.

**Parameter:**
- `recipientIds: string[]` - Array der zu validierenden Recipient-IDs

**Rückgabe:** `Promise<RecipientValidationResult[]>` - Validierungsergebnisse pro Recipient

**Validierungslogik:**
- Zählt AutomationRules pro Recipient
- Setzt `hasActiveReferences = true` wenn Referenzen vorhanden
- Setzt `canDelete = false` wenn aktive Referenzen vorhanden
- Erstellt Warnungen für gefundene Referenzen

**Beispiel:**
```typescript
const results = await ruleStore.validateRecipientDeletion(['recipient-1', 'recipient-2']);
results.forEach(result => {
  console.log(`${result.recipientName}: ${result.automationRuleCount} AutomationRules, canDelete: ${result.canDelete}`);
});
```

### 4. `cleanupRecipientReferences(recipientId: string)`

**Zweck:** Bereinigt Recipient-Referenzen aus AutomationRules bei Recipient-Löschung.

**Parameter:**
- `recipientId: string` - Die ID des zu löschenden Recipients

**Rückgabe:** `Promise<void>`

**Bereinigungslogik:**
- **Condition-Bereinigung:** Entfernt Conditions mit `RECIPIENT_EQUALS` oder `RECIPIENT_CONTAINS`
- **Action-Bereinigung:** Entfernt Actions mit `SET_RECIPIENT`
- **Rule-Deaktivierung:** Deaktiviert Rules die keine gültigen Conditions oder Actions mehr haben
- **Logging:** Detaillierte Logs aller Bereinigungsaktionen

**Beispiel:**
```typescript
await ruleStore.cleanupRecipientReferences('recipient-123');
console.log('Recipient-Referenzen bereinigt');
```

## RecipientValidationResult Interface

```typescript
interface RecipientValidationResult {
  recipientId: string;
  recipientName: string;
  hasActiveReferences: boolean;
  transactionCount: number;           // Gesetzt vom TransactionService
  planningTransactionCount: number;   // Gesetzt vom PlanningService
  automationRuleCount: number;        // Gesetzt vom RuleStore (NEU)
  canDelete: boolean;
  warnings: string[];
}
```

## AutomationRule Recipient-Referenz-Analyse

### Condition-Typen mit Recipient-Referenzen

| Condition-Typ | Beschreibung | Referenz-Feld |
|---------------|--------------|---------------|
| `RECIPIENT_EQUALS` | Exakte Übereinstimmung mit Recipient | `condition.value` |
| `RECIPIENT_CONTAINS` | Teilstring-Übereinstimmung mit Recipient | `condition.value` |

### Action-Typen mit Recipient-Referenzen

| Action-Typ | Beschreibung | Referenz-Feld |
|------------|--------------|---------------|
| `SET_RECIPIENT` | Setzt Recipient für Transaction | `action.value` |

### Referenz-Matching-Logik

```typescript
// Condition-Prüfung
const hasRecipientCondition = rule.conditions.some(condition => {
  if (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
      condition.type === RuleConditionType.RECIPIENT_CONTAINS) {
    const conditionValue = String(condition.value);
    return conditionValue === recipientId;
  }
  return false;
});

// Action-Prüfung
const hasRecipientAction = rule.actions.some(action => {
  if (action.type === RuleActionType.SET_RECIPIENT) {
    const actionValue = String(action.value);
    return actionValue === recipientId;
  }
  return false;
});
```

## Integration mit Recipient-Merge-Funktionalität

### Workflow-Integration

Die AutomationRule-Validierungsmethoden sind Teil des größeren Recipient-Merge-Workflows:

1. **TransactionService.validateRecipientDeletion()** - Prüft Transaction-Referenzen
2. **PlanningService.validateRecipientDeletion()** - Prüft PlanningTransaction-Referenzen
3. **RuleStore.validateRecipientDeletion()** - Prüft AutomationRule-Referenzen (NEU)
4. **Kombinierte Validierung** - Alle Ergebnisse werden zusammengeführt

### Verwendung im recipientStore

```typescript
// Beispiel-Integration (geplant für Subtask 4.6)
async validateRecipientDeletion(recipientIds: string[]): Promise<RecipientValidationResult[]> {
  // Sammle Validierungsergebnisse von allen Services
  const transactionResults = await TransactionService.validateRecipientDeletion(recipientIds);
  const planningResults = await PlanningService.validateRecipientDeletion(recipientIds);
  const ruleResults = await ruleStore.validateRecipientDeletion(recipientIds);

  // Kombiniere Ergebnisse
  const combinedResults = recipientIds.map(recipientId => {
    const txResult = transactionResults.find(r => r.recipientId === recipientId);
    const planningResult = planningResults.find(r => r.recipientId === recipientId);
    const ruleResult = ruleResults.find(r => r.recipientId === recipientId);

    return {
      recipientId,
      recipientName: txResult?.recipientName || planningResult?.recipientName || ruleResult?.recipientName || 'Unbekannt',
      hasActiveReferences: (txResult?.hasActiveReferences || false) ||
                          (planningResult?.hasActiveReferences || false) ||
                          (ruleResult?.hasActiveReferences || false),
      transactionCount: txResult?.transactionCount || 0,
      planningTransactionCount: planningResult?.planningTransactionCount || 0,
      automationRuleCount: ruleResult?.automationRuleCount || 0,
      canDelete: !(txResult?.hasActiveReferences || planningResult?.hasActiveReferences || ruleResult?.hasActiveReferences),
      warnings: [...(txResult?.warnings || []), ...(planningResult?.warnings || []), ...(ruleResult?.warnings || [])]
    };
  });

  return combinedResults;
}
```

## Bereinigungslogik Details

### Condition-Bereinigung

```typescript
const cleanedConditions = rule.conditions.filter(condition => {
  if (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
      condition.type === RuleConditionType.RECIPIENT_CONTAINS) {
    const conditionValue = String(condition.value);
    if (conditionValue === recipientId) {
      debugLog('RuleStore', `Entferne Recipient-Condition aus Rule "${rule.name}"`);
      return false; // Condition entfernen
    }
  }
  return true; // Condition beibehalten
});
```

### Action-Bereinigung

```typescript
const cleanedActions = rule.actions.filter(action => {
  if (action.type === RuleActionType.SET_RECIPIENT) {
    const actionValue = String(action.value);
    if (actionValue === recipientId) {
      debugLog('RuleStore', `Entferne SET_RECIPIENT-Action aus Rule "${rule.name}"`);
      return false; // Action entfernen
    }
  }
  return true; // Action beibehalten
});
```

### Rule-Deaktivierung

```typescript
// Prüfe ob Rule noch funktionsfähig ist
const hasConditions = cleanedConditions.length > 0;
const hasActions = cleanedActions.length > 0;
const shouldDeactivate = !hasConditions || !hasActions;

if (shouldDeactivate && rule.isActive) {
  warnLog('RuleStore', `Rule "${rule.name}" wurde deaktiviert (keine gültigen Conditions/Actions mehr)`);
}
```

## Logging und Debugging

### Debug-Logs

Alle Methoden verwenden umfassendes Logging:

```typescript
debugLog('RuleStore', 'getAutomationRulesWithRecipient gestartet', { recipientId });
debugLog('RuleStore', `Gefunden: ${matchingRules.length} AutomationRules mit Recipient-Referenzen`, {
  recipientId,
  ruleIds: matchingRules.map(rule => rule.id),
  ruleNames: matchingRules.map(rule => rule.name)
});
```

### Error-Handling

Robuste Fehlerbehandlung mit detailliertem Logging:

```typescript
try {
  // Validierungslogik
} catch (error) {
  errorLog('RuleStore', 'Fehler bei validateRecipientDeletion', {
    recipientIds,
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
```

### Bereinigungsstatistiken

```typescript
debugLog('RuleStore', 'cleanupRecipientReferences abgeschlossen', {
  recipientId,
  totalRules: affectedRules.length,
  updatedCount,
  deactivatedCount,
  errorCount
});
```

## Testing

### Test-Datei: `src/test-automation-rule-recipient-validation.ts`

Umfassende Tests für alle implementierten Methoden:

```typescript
// Browser-Konsole
import('./test-automation-rule-recipient-validation.ts');
window.testAutomationRuleRecipientValidation.runAllTests();

// Einzelne Tests
window.testAutomationRuleRecipientValidation.testGetAutomationRulesWithRecipient();
window.testAutomationRuleRecipientValidation.testCountAutomationRulesWithRecipient();
window.testAutomationRuleRecipientValidation.testValidateRecipientDeletion();
window.testAutomationRuleRecipientValidation.testCleanupRecipientReferences();

// Übersicht
window.testAutomationRuleRecipientValidation.showAutomationRuleRecipientOverview();
```

### Test-Szenarien

1. **Leere Datenbank** - Keine AutomationRules vorhanden
2. **Recipients ohne Referenzen** - canDelete = true
3. **Recipients mit Condition-Referenzen** - canDelete = false, entsprechende Warnungen
4. **Recipients mit Action-Referenzen** - canDelete = false, entsprechende Warnungen
5. **Recipients mit beiden Referenz-Typen** - canDelete = false, kombinierte Warnungen
6. **Mehrere Recipients** - Batch-Validierung
7. **Bereinigungstest** - Vor/Nach-Vergleich der Referenzen
8. **Rule-Deaktivierung** - Rules ohne gültige Conditions/Actions werden deaktiviert
9. **Performance-Test** - Große Anzahl AutomationRules

### Test-Daten-Generierung

```typescript
const testRules = [
  {
    name: 'Test Rule - Recipient Condition',
    conditions: [{ type: RuleConditionType.RECIPIENT_EQUALS, value: recipientId }],
    actions: [{ type: RuleActionType.SET_CATEGORY, value: 'category-id' }]
  },
  {
    name: 'Test Rule - Recipient Action',
    conditions: [{ type: RuleConditionType.AMOUNT_GREATER, value: 100 }],
    actions: [{ type: RuleActionType.SET_RECIPIENT, value: recipientId }]
  },
  {
    name: 'Test Rule - Both References',
    conditions: [{ type: RuleConditionType.RECIPIENT_CONTAINS, value: recipientId }],
    actions: [{ type: RuleActionType.SET_RECIPIENT, value: recipientId }]
  }
];
```

## Performance-Überlegungen

### Optimierungen

1. **Direkte ID-Suche** - Keine komplexe String-Matching-Logik erforderlich
2. **Count-Optimierung** - `countAutomationRulesWithRecipient` vermeidet Array-Erstellung
3. **Batch-Verarbeitung** - `validateRecipientDeletion` verarbeitet mehrere Recipients effizient
4. **Frühe Rückgabe** - Leere Parameter werden sofort behandelt

### Skalierung

- **Kleine Datenmengen** (< 100 AutomationRules): Keine Performance-Probleme
- **Mittlere Datenmengen** (100-1000): Akzeptable Performance
- **Große Datenmengen** (> 1000): Eventuell Indexierung oder Caching erforderlich

### Performance-Metriken

```typescript
// Beispiel aus Tests
const startTime = performance.now();
for (let i = 0; i < 10; i++) {
  await ruleStore.countAutomationRulesWithRecipient(recipientId);
}
const endTime = performance.now();
console.log(`Performance: 10 Count-Operationen in ${(endTime - startTime).toFixed(2)}ms`);
```

## Unterschiede zu anderen Services

### Vergleich mit TransactionService und PlanningService

| Aspekt | TransactionService | PlanningService | RuleStore |
|--------|-------------------|-----------------|-----------|
| **Direkte ID-Referenz** | ✅ `transaction.recipientId` | ✅ `planningTransaction.recipientId` | ✅ `condition.value`, `action.value` |
| **String-Matching** | ✅ `transaction.payee` | ❌ Nicht verfügbar | ❌ Nicht erforderlich |
| **Referenz-Typen** | 2 (ID + payee) | 1 (ID) | 2 (Conditions + Actions) |
| **Komplexität** | Hoch | Niedrig | Mittel |
| **Bereinigung** | Nicht implementiert | Nicht implementiert | ✅ Vollständig implementiert |

### Besonderheiten der AutomationRule-Validierung

1. **Doppelte Referenz-Prüfung** - Sowohl Conditions als auch Actions können Recipients referenzieren
2. **Rule-Deaktivierung** - Rules ohne gültige Conditions/Actions werden automatisch deaktiviert
3. **Bereinigungslogik** - Vollständige Implementierung der Referenz-Bereinigung
4. **Strukturelle Integrität** - Prüfung ob Rules nach Bereinigung noch funktionsfähig sind

## Nächste Schritte

### Subtask 4.6: Integration in recipientStore
- Kombinierte Validierung von Transaction-, PlanningTransaction- und AutomationRule-Referenzen
- Einheitliche RecipientValidationResult-Ergebnisse
- Integration der `cleanupRecipientReferences` in den Löschprozess

### Performance-Optimierungen
- Indexierung für große AutomationRule-Mengen
- Caching häufig abgefragter Ergebnisse
- Batch-Operationen für bessere Performance

### Erweiterte Features
- **Rule-Reparatur** - Automatische Korrektur von Rules mit ungültigen Referenzen
- **Dependency-Tracking** - Verfolgung aller Abhängigkeiten zwischen Entitäten
- **Bulk-Bereinigung** - Bereinigung mehrerer Recipients gleichzeitig

## Fazit

Die AutomationRule Recipient-Validierung bietet eine robuste und umfassende Lösung für die sichere Löschung von Recipients. Die Implementierung erweitert die bestehende Validierungsarchitektur um eine kritische Komponente und gewährleistet die Integrität der AutomationRule-Engine.

**Besondere Stärken:**
- **Vollständige Bereinigung** - Einziger Service mit implementierter Referenz-Bereinigung
- **Rule-Integrität** - Automatische Deaktivierung nicht-funktionsfähiger Rules
- **Umfassende Tests** - Detaillierte Test-Suite mit Performance-Validierung
- **Detailliertes Logging** - Vollständige Nachverfolgbarkeit aller Operationen

Die Implementierung folgt den etablierten Patterns der anderen Services und integriert sich nahtlos in die bestehende Recipient-Merge-Funktionalität, während sie zusätzliche Funktionalität für die Bereinigung und Wartung der AutomationRule-Integrität bietet.
