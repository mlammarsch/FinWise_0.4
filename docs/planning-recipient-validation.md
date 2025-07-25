# PlanningService Recipient-Validierung

## Übersicht

Diese Dokumentation beschreibt die neu implementierten Validierungsmethoden im `PlanningService` für die sichere Löschung von Recipients. Die Methoden prüfen auf aktive Referenzen in PlanningTransactions und verhindern Dateninkonsistenzen.

## Implementierte Methoden

### 1. `getPlanningTransactionsWithRecipient(recipientId: string)`

**Zweck:** Findet alle PlanningTransactions die einen bestimmten Recipient referenzieren.

**Parameter:**
- `recipientId: string` - Die zu suchende Recipient-ID

**Rückgabe:** `Promise<PlanningTransaction[]>` - Array der gefundenen PlanningTransactions

**Suchlogik:**
- Direkte Referenz über `planningTransaction.recipientId === recipientId`
- Keine String-Matching-Logik (im Gegensatz zu TransactionService), da PlanningTransactions kein payee-Feld haben

**Beispiel:**
```typescript
const planningTransactions = await PlanningService.getPlanningTransactionsWithRecipient('recipient-123');
console.log(`Gefunden: ${planningTransactions.length} PlanningTransactions`);
```

### 2. `countPlanningTransactionsWithRecipient(recipientId: string)`

**Zweck:** Zählt die Anzahl der PlanningTransactions die einen bestimmten Recipient referenzieren.

**Parameter:**
- `recipientId: string` - Die zu suchende Recipient-ID

**Rückgabe:** `Promise<number>` - Anzahl der gefundenen PlanningTransactions

**Performance:** Optimierte Version von `getPlanningTransactionsWithRecipient` für reine Zählung ohne Array-Erstellung.

**Beispiel:**
```typescript
const count = await PlanningService.countPlanningTransactionsWithRecipient('recipient-123');
console.log(`Anzahl: ${count} PlanningTransactions`);
```

### 3. `validateRecipientDeletion(recipientIds: string[])`

**Zweck:** Validiert die Löschung von Recipients durch Prüfung auf aktive Referenzen in PlanningTransactions.

**Parameter:**
- `recipientIds: string[]` - Array der zu validierenden Recipient-IDs

**Rückgabe:** `Promise<RecipientValidationResult[]>` - Validierungsergebnisse pro Recipient

**Validierungslogik:**
- Zählt PlanningTransactions pro Recipient
- Setzt `hasActiveReferences = true` wenn Referenzen vorhanden
- Setzt `canDelete = false` wenn aktive Referenzen vorhanden
- Erstellt Warnungen für gefundene Referenzen

**Beispiel:**
```typescript
const results = await PlanningService.validateRecipientDeletion(['recipient-1', 'recipient-2']);
results.forEach(result => {
  console.log(`${result.recipientName}: ${result.planningTransactionCount} PlanningTransactions, canDelete: ${result.canDelete}`);
});
```

## RecipientValidationResult Interface

```typescript
interface RecipientValidationResult {
  recipientId: string;
  recipientName: string;
  hasActiveReferences: boolean;
  transactionCount: number;           // Gesetzt vom TransactionService
  planningTransactionCount: number;   // Gesetzt vom PlanningService (NEU)
  automationRuleCount: number;        // Wird in Subtask 4.5 implementiert
  canDelete: boolean;
  warnings: string[];
}
```

## Integration mit Recipient-Merge-Funktionalität

### Workflow-Integration

Die PlanningService-Validierungsmethoden sind Teil des größeren Recipient-Merge-Workflows:

1. **TransactionService.validateRecipientDeletion()** - Prüft Transaction-Referenzen
2. **PlanningService.validateRecipientDeletion()** - Prüft PlanningTransaction-Referenzen (NEU)
3. **RuleService.validateRecipientDeletion()** - Prüft AutomationRule-Referenzen (geplant)
4. **Kombinierte Validierung** - Alle Ergebnisse werden zusammengeführt

### Verwendung im recipientStore

```typescript
// Beispiel-Integration (geplant)
async validateRecipientDeletion(recipientIds: string[]): Promise<RecipientValidationResult[]> {
  // Sammle Validierungsergebnisse von allen Services
  const transactionResults = await TransactionService.validateRecipientDeletion(recipientIds);
  const planningResults = await PlanningService.validateRecipientDeletion(recipientIds);

  // Kombiniere Ergebnisse
  const combinedResults = recipientIds.map(recipientId => {
    const txResult = transactionResults.find(r => r.recipientId === recipientId);
    const planningResult = planningResults.find(r => r.recipientId === recipientId);

    return {
      recipientId,
      recipientName: txResult?.recipientName || planningResult?.recipientName || 'Unbekannt',
      hasActiveReferences: (txResult?.hasActiveReferences || false) || (planningResult?.hasActiveReferences || false),
      transactionCount: txResult?.transactionCount || 0,
      planningTransactionCount: planningResult?.planningTransactionCount || 0,
      automationRuleCount: 0, // Später implementiert
      canDelete: !(txResult?.hasActiveReferences || planningResult?.hasActiveReferences),
      warnings: [...(txResult?.warnings || []), ...(planningResult?.warnings || [])]
    };
  });

  return combinedResults;
}
```

## Logging und Debugging

### Debug-Logs

Alle Methoden verwenden umfassendes Logging:

```typescript
debugLog('[PlanningService]', 'getPlanningTransactionsWithRecipient gestartet', { recipientId });
debugLog('[PlanningService]', `Gefunden: ${matchingPlanningTransactions.length} PlanningTransactions`, {
  recipientId,
  recipientName,
  planningTransactionIds: matchingPlanningTransactions.map(pt => pt.id),
  directMatches: matchingPlanningTransactions.filter(pt => pt.recipientId === recipientId).length
});
```

### Error-Handling

Robuste Fehlerbehandlung mit detailliertem Logging:

```typescript
try {
  // Validierungslogik
} catch (error) {
  errorLog('[PlanningService]', 'Fehler bei validateRecipientDeletion', {
    recipientIds,
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
```

## Testing

### Test-Datei: `src/test-planning-recipient-validation.ts`

Umfassende Tests für alle implementierten Methoden:

```typescript
// Browser-Konsole
import('./test-planning-recipient-validation.ts');
window.testPlanningRecipientValidation.runAllTests();

// Einzelne Tests
window.testPlanningRecipientValidation.testGetPlanningTransactionsWithRecipient();
window.testPlanningRecipientValidation.testCountPlanningTransactionsWithRecipient();
window.testPlanningRecipientValidation.testValidateRecipientDeletion();

// Übersicht
window.testPlanningRecipientValidation.showPlanningTransactionRecipientOverview();
```

### Test-Szenarien

1. **Leere Datenbank** - Keine PlanningTransactions vorhanden
2. **Recipients ohne Referenzen** - canDelete = true
3. **Recipients mit Referenzen** - canDelete = false, entsprechende Warnungen
4. **Mehrere Recipients** - Batch-Validierung
5. **Performance-Test** - Große Anzahl PlanningTransactions

## Performance-Überlegungen

### Optimierungen

1. **Direkte ID-Suche** - Keine String-Matching-Logik erforderlich
2. **Count-Optimierung** - `countPlanningTransactionsWithRecipient` vermeidet Array-Erstellung
3. **Batch-Verarbeitung** - `validateRecipientDeletion` verarbeitet mehrere Recipients effizient

### Skalierung

- **Kleine Datenmengen** (< 1000 PlanningTransactions): Keine Performance-Probleme
- **Mittlere Datenmengen** (1000-10000): Akzeptable Performance
- **Große Datenmengen** (> 10000): Eventuell Indexierung oder Paginierung erforderlich

## Unterschiede zu TransactionService

### Suchlogik

| Aspekt | TransactionService | PlanningService |
|--------|-------------------|-----------------|
| **Direkte ID-Referenz** | ✅ `transaction.recipientId` | ✅ `planningTransaction.recipientId` |
| **String-Matching** | ✅ `transaction.payee` | ❌ Nicht verfügbar |
| **Komplexität** | Hoch (2 Suchkriterien) | Niedrig (1 Suchkriterium) |

### Performance

- **PlanningService**: Einfacher und schneller durch weniger Suchkriterien
- **TransactionService**: Komplexer durch zusätzliches String-Matching

## Nächste Schritte

### Subtask 4.4: Integration in recipientStore
- Kombinierte Validierung von Transaction- und PlanningTransaction-Referenzen
- Einheitliche RecipientValidationResult-Ergebnisse

### Subtask 4.5: AutomationRule-Validierung
- Erweitern um `automationRuleCount` in RecipientValidationResult
- Vollständige Validierung aller Recipient-Referenzen

### Performance-Optimierungen
- Indexierung für große Datenmengen
- Caching häufig abgefragter Ergebnisse
- Batch-Operationen für bessere Performance

## Fazit

Die PlanningService Recipient-Validierung bietet eine robuste und performante Lösung für die sichere Löschung von Recipients. Die Implementierung folgt den etablierten Patterns des TransactionService und integriert sich nahtlos in die bestehende Recipient-Merge-Funktionalität.

Die einfachere Suchlogik (nur direkte ID-Referenzen) macht die PlanningService-Validierung effizienter als die TransactionService-Validierung, während die umfassenden Tests und das detaillierte Logging eine zuverlässige Funktionalität gewährleisten.
