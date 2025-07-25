# Transaction-Recipient-Validierung

**Pfad:** `src/services/TransactionService.ts`
**Erstellt:** 2025-01-24
**Subtask:** 4.2 - Validierungslogik für Recipient-Referenzen in Transactions implementieren

## Übersicht

Diese Dokumentation beschreibt die neuen Validierungsmethoden im `TransactionService`, die für die sichere Löschung von Recipients implementiert wurden. Die Methoden prüfen auf aktive Referenzen in Transactions und stellen sicher, dass keine Datenintegrität verletzt wird.

## Implementierte Methoden

### 1. `validateRecipientDeletion(recipientIds: string[]): Promise<RecipientValidationResult[]>`

**Zweck:** Validiert die Löschung von Recipients durch Prüfung auf aktive Referenzen in Transactions.

**Parameter:**
- `recipientIds: string[]` - Array der zu validierenden Recipient-IDs

**Rückgabe:** `Promise<RecipientValidationResult[]>` - Validierungsergebnisse pro Recipient

**Funktionalität:**
- Iteriert über alle übergebenen Recipient-IDs
- Zählt Transactions mit Referenzen zu jedem Recipient
- Bestimmt ob Löschung möglich ist (aktuell: keine Löschung bei aktiven Referenzen)
- Erstellt Warnungen basierend auf gefundenen Referenzen
- Umfassendes Logging für Debugging und Monitoring

**Beispiel:**
```typescript
const recipientIds = ['recipient-1', 'recipient-2'];
const results = await TransactionService.validateRecipientDeletion(recipientIds);

results.forEach(result => {
  console.log(`${result.recipientName}: ${result.transactionCount} Transaktionen,
               Löschung möglich: ${result.canDelete}`);
});
```

### 2. `getTransactionsWithRecipient(recipientId: string): Promise<Transaction[]>`

**Zweck:** Findet alle Transactions die einen bestimmten Recipient referenzieren.

**Parameter:**
- `recipientId: string` - Die zu suchende Recipient-ID

**Rückgabe:** `Promise<Transaction[]>` - Array der gefundenen Transactions

**Suchlogik:**
1. **Direkte Referenz:** Sucht nach `transaction.recipientId === recipientId`
2. **Payee-String-Match:** Sucht im `payee`-Feld nach dem Recipient-Namen
   - Exakter Match (case-insensitive)
   - Enthält-Match für flexiblere Suche

**Beispiel:**
```typescript
const recipientId = 'recipient-123';
const transactions = await TransactionService.getTransactionsWithRecipient(recipientId);

console.log(`Gefunden: ${transactions.length} Transaktionen für Recipient ${recipientId}`);
transactions.forEach(tx => {
  console.log(`- ${tx.description} (${tx.amount}€)`);
});
```

### 3. `countTransactionsWithRecipient(recipientId: string): Promise<number>`

**Zweck:** Zählt die Anzahl der Transactions die einen bestimmten Recipient referenzieren.

**Parameter:**
- `recipientId: string` - Die zu suchende Recipient-ID

**Rückgabe:** `Promise<number>` - Anzahl der gefundenen Transactions

**Optimierung:**
- Performance-optimierte Version von `getTransactionsWithRecipient`
- Verwendet dieselbe Suchlogik, gibt aber nur die Anzahl zurück
- Detailliertes Logging mit Aufschlüsselung nach Match-Typen

**Beispiel:**
```typescript
const recipientId = 'recipient-123';
const count = await TransactionService.countTransactionsWithRecipient(recipientId);

console.log(`Recipient hat ${count} Transaktions-Referenzen`);
```

## RecipientValidationResult Interface

```typescript
interface RecipientValidationResult {
  recipientId: string;           // ID des validierten Recipients
  recipientName: string;         // Name des Recipients
  hasActiveReferences: boolean;  // Ob aktive Referenzen vorhanden sind
  transactionCount: number;      // Anzahl Transaction-Referenzen
  planningTransactionCount: number; // Anzahl PlanningTransaction-Referenzen (Subtask 4.3)
  automationRuleCount: number;   // Anzahl AutomationRule-Referenzen (später)
  canDelete: boolean;            // Ob Löschung möglich ist
  warnings: string[];            // Array von Warnmeldungen
}
```

## Suchlogik Details

### Direkte Referenzen
- Sucht nach `transaction.recipientId === recipientId`
- Exakte Übereinstimmung der UUID

### Payee-String-Matching
- **Exakter Match:** `transaction.payee.toLowerCase() === recipientName.toLowerCase()`
- **Enthält-Match:** `transaction.payee.toLowerCase().includes(recipientName.toLowerCase())`
- Berücksichtigt nur Transactions ohne direkte `recipientId`-Referenz

### Performance-Überlegungen
- `countTransactionsWithRecipient` ist optimiert für reine Zählung
- Beide Methoden verwenden dieselbe Suchlogik für Konsistenz
- Batch-Verarbeitung in `validateRecipientDeletion` für mehrere Recipients

## Logging und Debugging

Alle Methoden implementieren umfassendes Logging:

- **debugLog:** Detaillierte Informationen für Entwicklung
- **infoLog:** Wichtige Operationen und Ergebnisse
- **errorLog:** Fehlerbehandlung mit vollständigem Kontext

**Logging-Beispiele:**
```typescript
// Erfolgreiche Validierung
infoLog('[TransactionService]', 'validateRecipientDeletion abgeschlossen für 3 Recipients', {
  totalRecipients: 3,
  canDeleteCount: 1,
  hasReferencesCount: 2,
  totalTransactionReferences: 15
});

// Detaillierte Suche
debugLog('[TransactionService]', 'countTransactionsWithRecipient Ergebnis: 5 Transactions', {
  recipientId: 'recipient-123',
  recipientName: 'Max Mustermann',
  totalCount: 5,
  directMatches: 3,
  payeeMatches: 2
});
```

## Integration mit Recipient-Merge-Funktionalität

### Verwendung im recipientStore
Die Validierungsmethoden werden vom `recipientStore` bei Löschoperationen aufgerufen:

```typescript
// Im recipientStore
const validationResults = await TransactionService.validateRecipientDeletion(recipientIds);
const canDelete = validationResults.every(result => result.canDelete);

if (!canDelete) {
  // Zeige Bestätigungsdialog mit Warnungen
  showDeleteConfirmModal(selectedRecipients, validationResults);
}
```

### RecipientDeleteConfirmModal Integration
Das Modal verwendet die `RecipientValidationResult` Daten:

```typescript
// Zeige Warnungen für Recipients mit aktiven Referenzen
const recipientsWithWarnings = validationResults.filter(result => result.hasActiveReferences);

recipientsWithWarnings.forEach(result => {
  console.log(`⚠️ ${result.recipientName}: ${result.warnings.join(', ')}`);
});
```

## Fehlerbehandlung

Alle Methoden implementieren robuste Fehlerbehandlung:

```typescript
try {
  const results = await TransactionService.validateRecipientDeletion(recipientIds);
  // Verarbeitung...
} catch (error) {
  errorLog('[TransactionService]', 'Fehler bei validateRecipientDeletion', {
    recipientIds,
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
```

## Testing

Eine umfassende Test-Suite ist verfügbar unter `src/test-transaction-recipient-validation.ts`:

```typescript
// Manuelle Ausführung in Browser-Konsole
await runTransactionRecipientValidationTests();

// Oder einzelne Tests
const tester = new TransactionRecipientValidationTester();
await tester.testValidateRecipientDeletion();
```

## Zukünftige Erweiterungen

### Subtask 4.3: PlanningTransaction-Validierung
- Erweitern der Validierungsmethoden um PlanningTransaction-Referenzen
- Integration in `planningTransactionCount` Feld

### Subtask 4.4: AutomationRule-Validierung
- Prüfung auf Recipient-Referenzen in AutomationRules
- Integration in `automationRuleCount` Feld

### Erweiterte Löschstrategien
- Optionale Cascade-Löschung mit Benutzerbestätigung
- Recipient-Ersetzung in referenzierenden Transactions
- Archivierung statt Löschung bei aktiven Referenzen

## Technische Details

### TypeScript-Typisierung
- Vollständige Typisierung aller Parameter und Rückgabewerte
- Interface-Definition für `RecipientValidationResult`
- Konsistente Verwendung von `async/await`

### Store-Integration
- Verwendet `useTransactionStore()` für Transaction-Zugriff
- Verwendet `useRecipientStore()` für Recipient-Namen-Auflösung
- Keine direkten Datenbankzugriffe - alles über Stores

### Performance-Optimierung
- Effiziente Iteration über Transaction-Arrays
- Minimale Speichernutzung durch Zählung statt Array-Erstellung
- Batch-Verarbeitung für mehrere Recipients

## Fazit

Die implementierten Validierungsmethoden bieten eine solide Grundlage für die sichere Löschung von Recipients. Sie gewährleisten Datenintegrität durch umfassende Referenzprüfung und bieten flexible Suchlogik für verschiedene Referenztypen.

Die Methoden sind performance-optimiert, vollständig typisiert und umfassend getestet. Sie integrieren sich nahtlos in die bestehende FinWise-Architektur und folgen den etablierten Patterns für Logging und Fehlerbehandlung.
