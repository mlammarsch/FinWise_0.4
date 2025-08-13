# CSV-Import-Prozess - Detaillierte Analyse

## Überblick

Der CSV-Import in FinWise ist ein mehrstufiger Prozess, der über drei Hauptkomponenten abläuft:
- **TransactionImportModal.vue**: UI-Steuerung und Benutzerinteraktion
- **CSVImportService.ts**: Kernlogik für Parsing, Matching und Import
- **csvUtils.ts**: Hilfsfunktionen für CSV-Verarbeitung

## Phase 1: CSV-Parsing und Konfiguration

### 1.1 Datei-Upload und Erkennung
**Priorität: Höchste**

1. **Datei-Einlesen** (`readCSVFile()`)
   - FileReader liest CSV-Datei als Text
   - Automatische Erkennung von Trennzeichen und Datumsformat

2. **Trennzeichen-Erkennung** (`detectDelimiterAndDateFormat()`)
   - Analyse der ersten 5 Zeilen
   - Zählung von Komma, Semikolon, Tabulator
   - Auswahl des häufigsten Trennzeichens

3. **Datumsformat-Erkennung**
   - Regex-basierte Mustererkennung
   - Unterstützte Formate: YYYY-MM-DD, DD-MM-YYYY, DD-MM-YY, etc.
   - Standard-Fallback: DD-MM-YYYY (deutsche Banken)

### 1.2 CSV-Parsing
**Priorität: Höchste**

1. **Zeilen-Aufspaltung** (`parseCSV()`)
   - Trennung nach Zeilenwechseln (\r?\n)
   - Überspringen leerer Zeilen
   - Header-Extraktion (optional)

2. **Spalten-Verarbeitung**
   - Aufspaltung nach Trennzeichen
   - Berücksichtigung von Anführungszeichen (csvUtils.ts)
   - Validierung der Spaltenanzahl

3. **Datenstruktur-Erstellung**
   - Jede Zeile wird zu ImportRow-Objekt
   - Zusätzliche Metadaten: `_originalIndex`, `_selected`, `_uniqueRowIdentifier`

## Phase 2: Automatisches Mapping

### 2.1 Spalten-Identifikation
**Priorität: Hoch**

1. **Mögliche Mappings identifizieren** (`identifyPossibleMappings()`)
   - **Datum**: Regex-Erkennung verschiedener Datumsformate
   - **Betrag**: Numerische Werte mit Komma/Punkt
   - **Empfänger**: Texte 0-60 Zeichen, keine Zahlen/Daten
   - **Kategorie**: Texte 0-30 Zeichen, keine Zahlen/Daten
   - **Notizen**: Längere Texte, keine Zahlen/Daten

2. **Automatisches Mapping** (`automaticMapping()`)
   - **Priorität 1**: Datum (Pflichtfeld)
   - **Priorität 2**: Betrag (Pflichtfeld)
   - **Priorität 3**: Empfänger
   - **Priorität 4**: Notizen
   - **Priorität 5**: Kategorie (niedrigste Priorität)

### 2.2 Intelligente Spalten-Zuordnung
**Heuristiken nach Priorität:**

1. **Datum-Spalten**: "datum", "date", "valuta", "wert"
2. **Betrag-Spalten**: "betrag", "summe", "amount", "geldeingang", "geldausgang"
3. **Empfänger-Spalten**: "empfänger", "recipient", "zahler", "kunde", "auftraggeber"
4. **Notiz-Spalten**: "notiz", "verwendungszweck", "buchungstext", "beschreibung"

## Phase 3: Auto-Matching und Entitäts-Erkennung

### 3.1 Account-Transfer-Erkennung
**Priorität: Höchste (vor Empfänger-Matching)**

1. **Konto-Namen-Abgleich** (`findMatchingRecipient()`)
   - Exakter Vergleich (case-insensitive) mit bestehenden Kontonamen
   - Bei Match: Markierung als `_potentialAccountTransfer`
   - Speicherung von `toAccountId` und `toAccountName`

### 3.2 Empfänger-Matching
**Priorität: Hoch**

**Reihenfolge der Empfänger-Erkennung:**

1. **Direkter Match** (Priorität 1)
   - Case-insensitive Vergleich mit bestehenden Empfängern
   - Bei Treffer: Sofortige `recipientId`-Zuordnung

2. **Fuzzy-Matching** (Priorität 2)
   - String-Ähnlichkeitsberechnung (Schwellenwert: 60%)
   - Bei Ähnlichkeit >80%: Automatische Zuordnung
   - Bei Ähnlichkeit 60-80%: Vorschlag für Benutzer

3. **Suchbereiche** (in dieser Reihenfolge):
   - Primär: Empfänger-Spalte (falls gemappt)
   - Sekundär: Notizen-Spalte (zusätzliche Suche)

### 3.3 Kategorie-Matching
**Priorität: Mittel**

1. **Direkter Match** (case-insensitive)
2. **Fuzzy-Matching** (Schwellenwert: 60%)
3. **Automatische Zuordnung** bei >80% Ähnlichkeit

### 3.4 Duplikat-Erkennung
**Priorität: Mittel**

**Kriterien für Duplikat-Erkennung** (`identifyPotentialMerges()`):
1. **Gleiches Datum** (Tag-genau)
2. **Gleicher Betrag** (Toleranz: ±0.01€)
3. **Ähnlicher Empfänger/Notiz** (Ähnlichkeit >30%)

## Phase 4: Regel-Anwendung

### 4.1 PRE-Stage Regeln
**Priorität: Hoch - VOR dem Speichern**

1. **Zeitpunkt**: Während der Transaktions-Vorbereitung
2. **Anwendung**: Auf vorbereitete TransactionData-Objekte
3. **Zweck**: Kategorien, Empfänger, Tags automatisch setzen
4. **Service**: `TransactionService.applyPreStageRulesToTransactionData()`

### 4.2 POST-Stage Regeln
**Priorität: Niedrig - NACH dem Speichern**

1. **Zeitpunkt**: Nach Running Balance Berechnung
2. **Anwendung**: Auf gespeicherte Transaktionen
3. **Zweck**: Erweiterte Regellogik, die gespeicherte Daten benötigt
4. **Service**: `TransactionService.applyPostStageRulesToTransactions()`

## Phase 5: Import-Ausführung

### 5.1 Transaktions-Vorbereitung
**Priorität: Höchste**

**Reihenfolge der Datenverarbeitung:**

1. **Empfänger-Erstellung** (falls nötig)
   - Neue Empfänger werden sofort erstellt
   - `recipientId` wird gesetzt

2. **Account-Transfer-Behandlung**
   - Erkennung über `_potentialAccountTransfer`
   - Erstellung als `TransactionType.ACCOUNTTRANSFER`
   - Spezielle Behandlung mit `fromAccountId` und `toAccountId`

3. **Normale Transaktions-Erstellung**
   - Alle anderen Zeilen werden zu normalen Transaktionen
   - `payee`-Feld wird gesetzt, wenn keine `recipientId` vorhanden

4. **PRE-Stage Regel-Anwendung**
   - Anwendung auf vorbereitete Daten vor dem Speichern

### 5.2 Batch-Import
**Priorität: Performance-kritisch**

1. **Bulk-Import-Modus aktivieren**
   - `__FINWISE_BULK_IMPORT_MODE__ = true`
   - `_skipRunningBalanceRecalc = true`

2. **Batch-Speicherung**
   - Primär: `tenantDbService.addTransactionsBatch()`
   - Fallback: Einzelne Transaktionen bei Batch-Fehlern

3. **Account-Transfer-Erstellung**
   - Separate Behandlung von Account-Transfers
   - Direkte Erstellung über `TransactionService.addTransaction()`

### 5.3 Running Balance Berechnung
**Priorität: Kritisch für Datenintegrität**

**Optimierte Neuberechnung:**

1. **TransactionStore laden** (vor Balance-Berechnung)
2. **Betroffene Konten sammeln**
   - Normale Transaktionen: `accountId`
   - Account-Transfers: `fromAccountId` + `toAccountId`
3. **Ältestes Datum ermitteln** (für optimierte Berechnung)
4. **Queue-basierte Berechnung** (`BalanceService.enqueueRunningBalanceRecalculation()`)
5. **Sofortige Verarbeitung** (`BalanceService.forceProcessRunningBalanceQueue()`)

### 5.4 POST-Stage Regel-Anwendung
**Priorität: Niedrig**

- Anwendung nach Running Balance Berechnung
- Auf gespeicherte Transaktionen mit korrekten IDs

## Phase 6: Synchronisation

### 6.1 Sync-Queue-Erstellung
**Priorität: Hoch für Online-Sync**

1. **Aktualisierte Transaktionen laden**
   - Mit korrekten Running Balance Werten
   - Einzelabruf per `tenantDbService.getTransactionById()`

2. **Batch-Sync-Queue-Erstellung**
   - `tenantDbService.addTransactionsBatchToSyncQueue()`
   - Übertragung an Backend bei Internetverbindung

### 6.2 UI-Refresh
**Priorität: Benutzerfreundlichkeit**

1. **Stores aktualisieren**
   - `recipientStore.loadRecipients()`
   - `categoryStore.loadCategories()`

2. **Asynchrone Monatsbilanzen**
   - `BalanceService.calculateMonthlyBalances()`
   - Läuft im Hintergrund, blockiert nicht

## Kritische Reihenfolge-Abhängigkeiten

### Must-Have Sequenz:
1. **Account-Transfer-Erkennung** → **Empfänger-Matching**
2. **PRE-Stage Regeln** → **Speicherung** → **POST-Stage Regeln**
3. **Bulk-Import** → **TransactionStore laden** → **Running Balance**
4. **Running Balance** → **Sync-Queue-Erstellung**

### Performance-Optimierungen:
- **Batch-Operationen** für große Datenmengen
- **Queue-basierte Balance-Berechnung**
- **Asynchrone UI-Updates** wo möglich
- **Bulk-Import-Modus** deaktiviert normale Einzeltransaktions-Logik

## Fehlerbehandlung

### Robustheit-Mechanismen:
1. **Batch-Fallback**: Bei Batch-Fehlern → Einzelimport
2. **Sync-Toleranz**: Sync-Fehler brechen Import nicht ab
3. **Balance-Recovery**: Fehlerhafte Balance-Berechnung wird geloggt, aber toleriert
4. **State-Reset**: Service wird nach Import/Fehler zurückgesetzt

## Bekannte Probleme

### Aktuelle Herausforderungen:
1. **Massenimport-Sync**: Bei >30 Einträgen können Sync-Probleme auftreten
2. **WebSocket-Timeouts**: Große Datenmengen können Verbindungsabbrüche verursachen
3. **IndexedDB-Limits**: Gleichzeitige Writes können bei großen Importen problematisch sein

### Lösungsansätze:
- **Chunking**: Aufteilen großer Imports in kleinere Batches
- **Retry-Mechanismen**: Automatische Wiederholung bei Sync-Fehlern
- **Progressive Sync**: Schrittweise Synchronisation statt Bulk-Übertragung
