# Test der Stage-Implementierung

## Implementierte Änderungen

### 1. TransactionService erweitert
- `addTransaction()` unterstützt jetzt einen `applyRules` Parameter (Standard: true)
- **PRE-Stage**: Regeln werden vor dem Speichern der Transaktion angewendet
- **DEFAULT-Stage**: Regeln werden nach dem Speichern angewendet (wie bisher)
- **POST-Stage**: Regeln werden nach allen anderen Verarbeitungen angewendet
- Neue Funktion `applyPreStageRulesToTransactions()` für Batch-Verarbeitung

### 2. CSV-Import erweitert
- **Phase 1.5**: PRE + DEFAULT Stage Regeln werden auf alle CSV-Transaktionen angewendet, bevor sie in die Datenbank geschrieben werden
- **Phase 2.7**: POST-Stage Regeln werden nach Running Balance Berechnung auf gespeicherte Transaktionen angewendet
- Fallback-Import verwendet `applyRules: false`, da Regeln bereits angewendet wurden

### 3. Andere TransactionService-Methoden
- `addAccountTransfer()`: Wendet Regeln auf beide Transaktionen an
- `addCategoryTransfer()`: Wendet Regeln auf beide Transaktionen an
- `addReconcileTransaction()`: Wendet Regeln an

## Test-Szenarien

### Szenario 1: Normale Transaktionserstellung
1. Erstelle eine neue Regel mit Stage "PRE" (z.B. automatische Kategorie-Zuordnung)
2. Erstelle eine neue Regel mit Stage "DEFAULT" (z.B. Tag hinzufügen)
3. Erstelle eine neue Regel mit Stage "POST" (z.B. Notiz erweitern)
4. Erstelle eine neue Transaktion über die UI
5. **Erwartung**: Alle drei Regeln werden in der richtigen Reihenfolge angewendet

### Szenario 2: CSV-Import
1. Erstelle Regeln mit Stage "PRE" (z.B. Empfänger-Normalisierung)
2. Erstelle Regeln mit Stage "DEFAULT" (z.B. Kategorie-Zuordnung)
3. Erstelle Regeln mit Stage "POST" (z.B. Benachrichtigungen)
4. Importiere CSV-Datei mit Transaktionen
5. **Erwartung**:
   - PRE + DEFAULT Regeln werden vor dem Speichern angewendet
   - POST Regeln werden nach Running Balance Berechnung angewendet

### Szenario 3: Konto-Transfer
1. Erstelle Regeln für verschiedene Stages
2. Erstelle einen Konto-zu-Konto Transfer
3. **Erwartung**: Regeln werden auf beide Transfer-Transaktionen angewendet

## Debugging

### Log-Ausgaben prüfen
- `[TransactionService] Applying PRE-stage rules before saving transaction`
- `[TransactionService] Applying DEFAULT-stage rules after saving transaction`
- `[TransactionService] Applying POST-stage rules after all processing`
- `[CSVImportService] Applying PRE and DEFAULT stage rules to X transactions before import`
- `[CSVImportService] Applying POST-stage rules to X saved transactions`

### Regel-Prioritäten
- Regeln werden innerhalb jeder Stage nach Priorität sortiert (niedrigere Zahl = höhere Priorität)
- PRE → DEFAULT → POST Reihenfolge wird eingehalten

## Mögliche Probleme

1. **TypeScript-Kompatibilität**: `applyRulesToTransaction` gibt `Transaction` zurück, aber wir brauchen `ExtendedTransaction`
   - **Lösung**: Manuelle Merge-Logik implementiert

2. **Performance**: Dreifache Regelanwendung könnte langsam sein
   - **Überwachung**: Log-Zeiten bei großen Regel-Sets

3. **Regel-Konflikte**: Regeln in verschiedenen Stages könnten sich überschreiben
   - **Empfehlung**: Klare Trennung der Regel-Verantwortlichkeiten

## Nächste Schritte

1. **UI-Test**: Regel mit verschiedenen Stages erstellen und testen
2. **CSV-Import-Test**: Import mit PRE-Stage Regeln testen
3. **Performance-Test**: Viele Regeln mit vielen Transaktionen testen
4. **Dokumentation**: Benutzer-Dokumentation für Stage-Konzept erstellen
