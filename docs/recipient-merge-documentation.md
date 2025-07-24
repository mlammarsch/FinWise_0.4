# Recipient-Merge-Funktionalität - Dokumentation

## Übersicht

Die Recipient-Merge-Funktionalität ermöglicht es, mehrere Recipients (Empfänger) zu einem einzigen Ziel-Recipient zusammenzuführen. Diese Funktion ist besonders nützlich, um Duplikate zu bereinigen und die Datenqualität zu verbessern.

## Implementierung

### Hauptmethode: `mergeRecipients`

**Pfad:** `src/stores/recipientStore.ts`

**Signatur:**
```typescript
async function mergeRecipients(
  sourceRecipientIds: string[],
  targetRecipient: Recipient | { name: string }
): Promise<void>
```

### Parameter

- **`sourceRecipientIds`**: Array von IDs der Recipients, die zusammengeführt werden sollen
- **`targetRecipient`**: Entweder ein bestehender Recipient (mit ID) oder ein Objekt mit dem Namen für einen neuen Recipient

### Funktionsweise

#### 1. Validierung der Eingaben
- Prüfung, dass mindestens ein Quell-Recipient vorhanden ist
- Validierung des Ziel-Recipients (Name muss vorhanden sein)

#### 2. Ziel-Recipient-Handling
- **Bestehender Recipient**: Verwendet den übergebenen Recipient direkt
- **Neuer Recipient**: Erstellt einen neuen Recipient mit dem angegebenen Namen

#### 3. Referenz-Updates
Die Methode `updateRecipientReferences` koordiniert die Aktualisierung aller Referenzen:

##### Transactions
- Durchsucht alle Transaktionen nach `recipientId`-Referenzen
- Aktualisiert gefundene Referenzen auf die neue Ziel-Recipient-ID
- Verwendet `transactionStore.updateTransaction()` für konsistente Sync-Integration

##### PlanningTransactions
- Durchsucht alle Planungstransaktionen nach `recipientId`-Referenzen
- Aktualisiert gefundene Referenzen auf die neue Ziel-Recipient-ID
- Verwendet `planningStore.updatePlanningTransaction()` für konsistente Sync-Integration

##### AutomationRules
- Durchsucht Regel-Bedingungen nach Recipient-Referenzen:
  - `RECIPIENT_EQUALS`
  - `RECIPIENT_CONTAINS`
- Durchsucht Regel-Aktionen nach Recipient-Referenzen:
  - `SET_RECIPIENT`
- Aktualisiert gefundene Referenzen und speichert die Regel

#### 4. Quell-Recipients löschen
- Löscht alle Quell-Recipients (außer dem Ziel-Recipient, falls er in der Quell-Liste enthalten ist)
- Verwendet `deleteRecipient()` für konsistente Sync-Integration

### Sync-Integration

Die Merge-Funktionalität ist vollständig in das Sync-System integriert:

- **Neue Recipients**: Werden über `addRecipient()` erstellt und zur Sync-Queue hinzugefügt
- **Referenz-Updates**: Alle Updates verwenden die bestehenden Store-Methoden mit Sync-Integration
- **Löschungen**: Werden über `deleteRecipient()` durchgeführt und zur Sync-Queue hinzugefügt
- **Timestamps**: Alle Änderungen erhalten aktuelle `updatedAt`-Timestamps für LWW-Konfliktlösung

### Error-Handling

#### Validierungsfehler
- Fehlende oder leere Quell-Recipient-Liste
- Ungültiger Ziel-Recipient (fehlender Name)

#### Rollback-Mechanismus
- Bei Fehlern in der Referenz-Aktualisierung wird der gesamte Merge-Vorgang abgebrochen
- Bereits durchgeführte Änderungen bleiben bestehen (keine automatische Rollback-Implementierung)
- Detaillierte Fehler-Logs für Debugging

### Logging

Die Implementierung verwendet umfassendes Logging:

- **`infoLog`**: Wichtige Meilensteine des Merge-Prozesses
- **`debugLog`**: Detaillierte Informationen über Referenz-Updates
- **`warnLog`**: Warnungen bei unerwarteten Situationen
- **`errorLog`**: Fehler-Behandlung mit vollständigen Error-Details

## Verwendung

### Beispiel 1: Merge zu neuem Recipient
```typescript
const recipientStore = useRecipientStore();

await recipientStore.mergeRecipients(
  ['recipient-id-1', 'recipient-id-2', 'recipient-id-3'],
  { name: 'Zusammengeführter Empfänger' }
);
```

### Beispiel 2: Merge zu bestehendem Recipient
```typescript
const recipientStore = useRecipientStore();
const targetRecipient = recipientStore.getRecipientById('target-recipient-id');

await recipientStore.mergeRecipients(
  ['recipient-id-1', 'recipient-id-2'],
  targetRecipient
);
```

## Testing

### Automatisierte Tests
**Pfad:** `src/test-recipient-merge.ts`

Die Test-Suite umfasst:
- Erstellung von Test-Recipients
- Merge zu neuem Recipient
- Validierung der Löschung von Quell-Recipients
- Merge zu bestehendem Recipient
- Cleanup nach Tests

### Manuelle Tests
```typescript
// In Browser-Console verfügbar
await testRecipientMerge(); // Vollständiger automatisierter Test
await manualTestRecipientMerge(['id1', 'id2'], { name: 'Neuer Name' }); // Manueller Test
```

## Architektur-Überlegungen

### Performance
- **Batch-Operationen**: Alle Referenz-Updates werden sequenziell abgearbeitet
- **Sync-Effizienz**: Jede Änderung wird einzeln zur Sync-Queue hinzugefügt
- **Memory-Management**: Keine großen Datenstrukturen im Speicher gehalten

### Skalierbarkeit
- **Große Datenmengen**: Funktioniert auch bei vielen Transaktionen/Planungen/Regeln
- **Concurrent Access**: Verwendet bestehende Store-Methoden mit LWW-Konfliktlösung
- **Network Efficiency**: Sync-Queue-System verhindert Datenverlust bei Offline-Nutzung

### Erweiterbarkeit
- **Neue Entitäten**: Einfache Erweiterung um weitere Entitäten mit Recipient-Referenzen
- **Custom Logic**: Möglichkeit zur Erweiterung der Merge-Logik für spezielle Anforderungen
- **Hooks**: Potenzial für Pre/Post-Merge-Hooks in zukünftigen Versionen

## Bekannte Limitationen

1. **Keine automatische Rollback**: Bei Fehlern während des Merge-Prozesses gibt es keine automatische Rückgängig-Machung
2. **Sequenzielle Verarbeitung**: Referenz-Updates werden nicht parallel verarbeitet
3. **Memory Usage**: Bei sehr großen Datenmengen könnte der Speicherverbrauch steigen

## Zukünftige Verbesserungen

1. **Transaktionale Sicherheit**: Implementierung eines Rollback-Mechanismus
2. **Batch-Updates**: Optimierung für bessere Performance bei großen Datenmengen
3. **Progress Tracking**: UI-Feedback für langwierige Merge-Operationen
4. **Conflict Resolution**: Erweiterte Konfliktlösung bei gleichzeitigen Änderungen
5. **Audit Trail**: Protokollierung aller Merge-Operationen für Nachverfolgbarkeit

## Integration mit RecipientMergeModal

Die `mergeRecipients`-Methode ist darauf ausgelegt, nahtlos mit der `RecipientMergeModal`-Komponente zu funktionieren:

```typescript
// In der Modal-Komponente
const handleConfirmMerge = async (mergeData: RecipientMergeData) => {
  try {
    await recipientStore.mergeRecipients(
      mergeData.sourceRecipientIds,
      mergeData.targetRecipient
    );
    // Success handling
  } catch (error) {
    // Error handling
  }
};
```

## Fazit

Die Recipient-Merge-Funktionalität bietet eine robuste, sync-integrierte Lösung für die Zusammenführung von Recipients. Die Implementierung folgt den etablierten Patterns des FinWise-Projekts und integriert sich nahtlos in die bestehende Architektur.
