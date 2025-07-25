## Dokumentation: Anwendung von Automatisierungsregeln in FinWise

Diese Dokumentation beschreibt, wann und wie Automatisierungsregeln in FinWise angewendet werden, unter Berücksichtigung ihrer Aktivität, Ausführungsphase und Priorität.

**WICHTIGER HINWEIS:** Automatisierungsregeln werden ausschließlich auf **EXPENSE** und **INCOME** Transaktionen angewendet. Bei **CATEGORYTRANSFER** und **ACCOUNTTRANSFER** Transaktionen greifen die Regeln nicht.

### 1. Grundlagen der Regel-Engine (`src/stores/ruleStore.ts`)

Die zentrale Logik für die Regelanwendung befindet sich im `ruleStore`.

*   **Regel-Felder:**
    *   **`isActive` (Boolean):** Eine Regel wird nur ausgeführt, wenn dieser Wert `true` ist. Dies ist der erste Filter.
    *   **`stage` (Enum: `PRE`, `DEFAULT`, `POST`):** Definiert den Zeitpunkt der Ausführung im Lebenszyklus einer Transaktion.
        *   `PRE`: Vor dem Speichern der Transaktion. Ideal für initiale Datenanreicherung oder Kategorisierung.
        *   `DEFAULT`: Nach dem Speichern der Transaktion. Für Standard-Automatisierungen.
        *   `POST`: Nach allen anderen Verarbeitungen (z.B. automatische Transfers, Running Balance Berechnung). Für finale Anpassungen.
    *   **`priority` (Number):** Bestimmt die Reihenfolge der Ausführung innerhalb derselben `stage`. Regeln mit niedrigeren Prioritätswerten werden zuerst ausgeführt. Dies ist entscheidend, wenn sich Regeln überschneiden oder voneinander abhängen.
*   **Kernmethoden:**
    *   **`applyRulesToTransaction(transaction, stage)`:** Diese Methode ist der Einstiegspunkt für die Regelanwendung. Sie filtert Regeln nach `isActive` und `stage`, sortiert sie nach `priority` und wendet sie sequenziell an. Änderungen werden über `TransactionService.updateTransaction()` gespeichert.
    *   **`checkConditions(rule, tx)`:** Prüft, ob die Bedingungen einer Regel auf eine Transaktion zutreffen. Berücksichtigt dabei den Transaktionstyp, wenn die Regel eine Kategorie setzen soll (nur für `INCOME`/`EXPENSE`).
    *   **`applyActions(rule, tx)`:** Wendet die Aktionen einer Regel auf eine Transaktion an. Beachtet dabei spezielle Bedingungen, z.B. dass Kategorien nicht auf Transferbuchungen angewendet werden.

---

### 2. Fallunterscheidungen und Ablaufbeschreibungen

#### Fall 1: Rules Test über Testbutton in der RuleForm (`src/components/rules/RuleForm.vue`)

**Zweck:** Virtuelle Vorschau, welche Transaktionen von einer Regel betroffen wären, ohne reale Änderungen.

**Ablauf:**

1.  Der Benutzer erstellt oder bearbeitet eine Regel in der `RuleForm.vue`.
2.  Der Benutzer klickt auf den "Regel testen"-Button.
3.  Die Methode `applyRuleToExistingTransactions()` in `RuleForm.vue` wird aufgerufen.
4.  Ein temporäres `AutomationRule`-Objekt wird aus den aktuellen Formularfeldern erstellt.
5.  Die **neuesten 250 Transaktionen** aus dem `transactionStore` werden geladen (Performance-Optimierung für die UI).
6.  Für jede dieser 250 Transaktionen wird die Methode `ruleStore.checkConditions(ruleData, transaction)` aufgerufen, um zu prüfen, ob die Transaktion die Bedingungen der Regel erfüllt.
7.  Transaktionen, die die Bedingungen erfüllen, werden gesammelt.
8.  Die Anzahl der übereinstimmenden Transaktionen und eine Vorschau der ersten 20 Transaktionen werden in einem Modal angezeigt.

**Beteiligte Dateien & Logik:**

*   [`src/components/rules/RuleForm.vue`](src/components/rules/RuleForm.vue): Enthält die UI für die Regelerstellung und die Methode `applyRuleToExistingTransactions()`.
*   [`src/stores/ruleStore.ts`](src/stores/ruleStore.ts): Die Methode `checkConditions()` wird aufgerufen, um die Regelbedingungen zu prüfen.
*   [`src/stores/transactionStore.ts`](src/stores/transactionStore.ts): Liefert die Transaktionen für den Test.

**Rolle der Regel-Felder:**

*   **`isActive`, `stage`, `priority`:** Diese Felder werden in das temporäre `ruleData`-Objekt übernommen, aber die `ruleStore.checkConditions`-Methode selbst berücksichtigt nur die *Bedingungen* (`conditions`). Die `isActive`, `stage` und `priority` Felder sind für den *echten* Ausführungsprozess der Regeln relevant, nicht für diesen reinen Bedingungstest.

---

#### Fall 2: In der AdminRuleView der gelbe Playbutton (`src/views/admin/AdminRulesView.vue`)

**Zweck:** Manuelle Anwendung einer spezifischen Regel auf *alle* bestehenden Transaktionen.

**Ablauf:**

1.  Der Benutzer navigiert zur Admin-Ansicht für Regeln (`AdminRulesView.vue`).
2.  Der Benutzer klickt auf den gelben Playbutton neben einer spezifischen Regel.
3.  Die Methode `applyRuleToTransactions(rule)` in `AdminRulesView.vue` wird aufgerufen.
4.  **Alle Transaktionen** aus dem `transactionStore` werden geladen.
5.  Für jede Transaktion wird die lokale Funktion `checkSingleRuleConditions(rule, tx)` (eine Kopie der `ruleStore.checkConditions`-Logik) aufgerufen, um zu prüfen, ob die Bedingungen der Regel zutreffen.
6.  Die Anzahl der übereinstimmenden Transaktionen wird ermittelt und in einem Bestätigungsmodal angezeigt.
7.  Der Benutzer bestätigt die Anwendung der Regel im Modal.
8.  Die Methode `confirmApplyRule()` in `AdminRulesView.vue` wird aufgerufen.
9.  Erneut werden alle Transaktionen durchlaufen. Für jede Transaktion, die die Bedingungen der Regel erfüllt, werden die Aktionen der Regel direkt angewendet (manuelle Implementierung der Aktionen in `confirmApplyRule()`).
10. Die geänderten Transaktionen werden über `transactionStore.updateTransaction()` in der IndexedDB aktualisiert und zur Synchronisation mit dem Backend vorgemerkt.
11. Eine Erfolgsmeldung wird angezeigt.

**Beteiligte Dateien & Logik:**

*   [`src/views/admin/AdminRulesView.vue`](src/views/admin/AdminRulesView.vue): Enthält die UI für die Regelverwaltung, die Methoden `applyRuleToTransactions()` und `confirmApplyRule()`, sowie die lokale Funktion `checkSingleRuleConditions()`.
*   [`src/stores/transactionStore.ts`](src/stores/transactionStore.ts): Liefert alle Transaktionen und speichert die aktualisierten Transaktionen.
*   [`src/stores/recipientStore.ts`](src/stores/recipientStore.ts): Wird in `evaluateCondition` für Empfänger-Vergleiche verwendet.

**Rolle der Regel-Felder:**

*   **`isActive`, `stage`, `priority`:** Diese Felder werden bei dieser manuellen Anwendung **ignoriert**. Eine Regel wird angewendet, wenn ihre Bedingungen zutreffen, unabhängig von ihrem Aktiv-Status, ihrer Phase oder Priorität.

---

#### Fall 3: Manuelle Anlage einer Transaktion (`src/services/TransactionService.ts`)

**Zweck:** Automatische Anwendung von Regeln beim Erstellen einer einzelnen Transaktion (z.B. über ein Formular).

**Ablauf:**

1.  Der Benutzer legt manuell eine neue Transaktion an (z.B. über ein Formular in der UI).
2.  Die Methode `TransactionService.addTransaction()` wird aufgerufen, typischerweise mit `applyRules: true`.
3.  Die Transaktionsdaten werden vorbereitet.
4.  **PRE-Stage Regeln:** `ruleStore.applyRulesToTransaction()` wird mit der `PRE`-Phase aufgerufen.
    *   Nur **aktive** Regeln mit `stage: 'PRE'` werden nach **Priorität** sortiert und angewendet.
    *   Änderungen werden direkt in das Transaktionsobjekt übernommen, bevor es gespeichert wird.
5.  Die Transaktion wird im `transactionStore` hinzugefügt (was sie in der IndexedDB speichert und zur Synchronisation vormerkt).
6.  **DEFAULT-Stage Regeln:** `ruleStore.applyRulesToTransaction()` wird mit der `DEFAULT`-Phase aufgerufen.
    *   Nur **aktive** Regeln mit `stage: 'DEFAULT'` werden nach **Priorität** sortiert und angewendet.
    *   Änderungen werden über `TransactionService.updateTransaction()` gespeichert.
7.  Die fest codierte Logik für den automatischen Kategorie-Transfer bei Einnahmen wird ausgeführt.
8.  **POST-Stage Regeln:** `ruleStore.applyRulesToTransaction()` wird mit der `POST`-Phase aufgerufen.
    *   Nur **aktive** Regeln mit `stage: 'POST'` werden nach **Priorität** sortiert und angewendet.
    *   Änderungen werden über `TransactionService.updateTransaction()` gespeichert.
9.  Die Monatsbilanzen und die Running Balance des betroffenen Kontos werden neu berechnet.

**Beteiligte Dateien & Logik:**

*   [`src/services/TransactionService.ts`](src/services/TransactionService.ts): Enthält die Methode `addTransaction()`, die die Regelanwendung in den verschiedenen Phasen orchestriert.
*   [`src/stores/ruleStore.ts`](src/stores/ruleStore.ts): Die Methode `applyRulesToTransaction()` ist hier der Kern der Regelanwendung, die wiederum `checkConditions()` und `applyActions()` aufruft.
*   [`src/stores/transactionStore.ts`](src/stores/transactionStore.ts): Speichert die Transaktion und ihre Updates.
*   [`src/services/BalanceService.ts`](src/services/BalanceService.ts): Aktualisiert Salden und Running Balance.

**Rolle der Regel-Felder:**

*   **`isActive`:** Nur Regeln, die als `isActive: true` markiert sind, werden angewendet.
*   **`stage`:** Die `stage` ist entscheidend und steuert die Ausführung in den Phasen `PRE`, `DEFAULT` und `POST`.
*   **`priority`:** Regeln werden innerhalb jeder `stage` nach ihrer `priority` (aufsteigend) angewendet.

---

#### Fall 4: CSV Import (`src/services/CSVImportService.ts`)

**Zweck:** Automatische Anwendung von Regeln auf Transaktionen, die über den CSV-Import hinzugefügt werden. Optimiert für Batch-Verarbeitung.

**Ablauf:**

1.  Der Benutzer lädt eine CSV-Datei hoch und konfiguriert die Spaltenzuordnung.
2.  Der Benutzer startet den Importprozess, der `CSVImportService.startImport()` aufruft.
3.  Performance-Optimierungen werden aktiviert (`TransactionService._skipRunningBalanceRecalc = true`, `__FINWISE_BULK_IMPORT_MODE__ = true`).
4.  Empfänger werden verarbeitet (bestehende zugeordnet, neue erstellt).
5.  **PRE- und DEFAULT-Stage Regeln:** `TransactionService.applyPreAndDefaultRulesToTransactions(transactionsToImport)` wird aufgerufen.
    *   Für jede Transaktion im Import-Batch werden die **aktiven** `PRE`-Regeln (nach **Priorität**) und dann die **aktiven** `DEFAULT`-Regeln (nach **Priorität**) angewendet.
    *   Die Transaktionen werden *vor* dem Speichern in der Datenbank modifiziert.
6.  Die (durch Regeln modifizierten) Transaktionen werden in einem Batch-Vorgang über `tenantDbService.addTransactionsBatch()` in die IndexedDB importiert.
7.  Der `transactionStore` wird neu geladen, um die importierten Transaktionen zu aktualisieren.
8.  Die Running Balance wird für die betroffenen Konten neu berechnet.
9.  **POST-Stage Regeln:** `TransactionService.applyPostStageRulesToTransactions(transactionIds)` wird aufgerufen.
    *   Für jede importierte Transaktion werden die **aktiven** `POST`-Regeln (nach **Priorität**) angewendet.
    *   Änderungen werden über `TransactionService.updateTransaction()` gespeichert.
10. Empfänger- und Kategorien-Stores werden neu geladen.
11. Die importierten Transaktionen werden zur Synchronisations-Queue hinzugefügt.
12. Die Monatsbilanzen werden aktualisiert.
13. Performance-Optimierungen werden zurückgesetzt.

**Beteiligte Dateien & Logik:**

*   [`src/services/CSVImportService.ts`](src/services/CSVImportService.ts): Orchestriert den gesamten Importprozess und ruft `TransactionService`-Methoden auf.
*   [`src/services/TransactionService.ts`](src/services/TransactionService.ts): Enthält `applyPreAndDefaultRulesToTransactions()` und `applyPostStageRulesToTransactions()` für die Regelanwendung in Batches.
*   [`src/stores/ruleStore.ts`](src/stores/ruleStore.ts): Die Methode `applyRulesToTransaction()` wird von `TransactionService` aufgerufen.
*   [`src/stores/transactionStore.ts`](src/stores/transactionStore.ts): Speichert die Transaktionen und lädt sie neu.
*   [`src/services/TenantDbService.ts`](src/services/TenantDbService.ts): Führt den Batch-Import in die IndexedDB durch und verwaltet die Sync-Queue.
*   [`src/services/BalanceService.ts`](src/services/BalanceService.ts): Aktualisiert Salden und Running Balance.

**Rolle der Regel-Felder:**

*   **`isActive`:** Nur Regeln, die als `isActive: true` markiert sind, werden angewendet.
*   **`stage`:** Alle drei Phasen (`PRE`, `DEFAULT`, `POST`) werden sequenziell angewendet, aber in zwei separaten Schritten (`PRE`/`DEFAULT` vor dem Speichern, `POST` danach).
*   **`priority`:** Regeln werden innerhalb jeder `stage` nach ihrer `priority` (aufsteigend) angewendet.

---

### Zusammenfassung der Regelanwendung

**WICHTIG:** Alle Szenarien berücksichtigen jetzt automatisch nur **EXPENSE** und **INCOME** Transaktionen. **CATEGORYTRANSFER** und **ACCOUNTTRANSFER** werden in allen Fällen übersprungen.

| Szenario                  | `applyRulesToTransaction` Aufruf | `isActive` berücksichtigt? | `stage` berücksichtigt? | `priority` berücksichtigt? | Änderungen gespeichert? | **Transaktionstyp-Filter** |
| :------------------------ | :------------------------------- | :------------------------ | :---------------------- | :------------------------ | :---------------------- | :------------------------ |
| **RuleForm Testbutton**   | `ruleStore.checkConditions()`    | Nein                      | Nein                    | Nein                      | Nein (virtuell)         | **Ja (EXPENSE/INCOME)** |
| **AdminRulesView Playbutton** | `checkSingleRuleConditions()` (lokal) | Nein                      | Nein                    | Nein                      | Ja (direkt über `transactionStore.updateTransaction()`) | **Ja (EXPENSE/INCOME)** |
| **Manuelle Transaktion**  | `ruleStore.applyRulesToTransaction()` (3x) | Ja                        | Ja                      | Ja                        | Ja (über `TransactionService.updateTransaction()`) | **Ja (EXPENSE/INCOME)** |
| **CSV Import**            | `TransactionService.applyPreAndDefaultRulesToTransactions()` & `TransactionService.applyPostStageRulesToTransactions()` | Ja                        | Ja                      | Ja                        | Ja (Batch-Import & `TransactionService.updateTransaction()`) | **Ja (EXPENSE/INCOME)** |

### Implementierte Änderungen

#### 1. **ruleStore.ts** - Zentrale Filterung
- **`applyRulesToTransaction()`**: Prüft Transaktionstyp und bricht bei CATEGORYTRANSFER/ACCOUNTTRANSFER ab
- **`checkConditions()`**: Zusätzliche Sicherheitsprüfung für Transaktionstyp

#### 2. **TransactionService.ts** - Transfer-Methoden angepasst
- **`addAccountTransfer()`**: `applyRules` Parameter auf `false` gesetzt
- **`addCategoryTransfer()`**: `applyRules` Parameter auf `false` gesetzt

#### 3. **AdminRulesView.vue** - Manuelle Regelanwendung
- **`applyRuleToTransactions()`**: Filtert Transaktionen vor Regelprüfung
- **`confirmApplyRule()`**: Filtert Transaktionen vor Regelanwendung

#### 4. **RuleForm.vue** - Regel-Test
- **`applyRuleToExistingTransactions()`**: Filtert Transaktionen vor virtuellem Test

---
