# FinWise: Dokumentation des Planungssystems

## Benutzerhandbuch: Finanzplanung mit FinWise

FinWise ermöglicht es Ihnen, Ihre zukünftigen Finanzen durch "Planungstransaktionen" zu verwalten und zu prognostizieren. Diese Planungen sind keine echten Buchungen, sondern Vorhersagen, die Ihnen helfen, Ihre zukünftigen Kontostände und Budgets zu überblicken.

### Was sind Planungstransaktionen?

Planungstransaktionen sind Einträge, die zukünftige Einnahmen, Ausgaben oder Transfers simulieren. Sie können einmalig oder wiederkehrend sein und beeinflussen die Prognosen Ihrer Konten und Kategorien.

### Erstellen und Bearbeiten von Planungstransaktionen

1.  **Typ der Planung**: Wählen Sie, ob es sich um eine Einnahme, Ausgabe, einen Kontotransfer oder einen Kategorietransfer handelt.
2.  **Betrag**: Geben Sie den Betrag ein. Bei Transfers wird der Betrag automatisch für die Gegenbuchung angepasst.
3.  **Konto/Kategorie**: Wählen Sie das betroffene Konto oder die Kategorie. Bei Transfers geben Sie Quell- und Zielkonto/Kategorie an.
4.  **Name/Beschreibung**: Geben Sie einen aussagekräftigen Namen und optional eine Notiz ein.
5.  **Startdatum**: Dies ist das erste Datum, an dem die Planung wirksam wird.
6.  **Wiederholung (optional)**:
    *   **Einmalig**: Die Planung findet nur einmal statt.
    *   **Täglich, Wöchentlich, Zweiwöchentlich, Monatlich, Quartalsweise, Jährlich**: Wählen Sie das gewünschte Wiederholungsmuster.
    *   **Ausführungstag (Monatlich)**: Bei monatlichen Planungen können Sie einen spezifischen Tag im Monat festlegen (z.B. den 15. jedes Monats).
    *   **Ende der Wiederholung**:
        *   **Niemals**: Die Planung läuft unbegrenzt.
        *   **Nach Datum**: Die Planung endet an einem bestimmten Datum.
        *   **Nach Anzahl**: Die Planung endet nach einer bestimmten Anzahl von Wiederholungen.
7.  **Wochenendbehandlung**: Legen Sie fest, wie das System mit Terminen umgehen soll, die auf ein Wochenende fallen (z.B. auf den Freitag davor oder den Montag danach verschieben).
8.  **Nur Prognose**: Markieren Sie diese Option, wenn die Planung nur für die Prognose verwendet werden soll und niemals automatisch in eine echte Transaktion umgewandelt werden soll.
9.  **Automatische Ausführung**: Wenn diese Option aktiviert ist, wird die Planungstransaktion bei Fälligkeit automatisch in eine echte Transaktion umgewandelt.

### Auswirkungen auf die Prognose

Alle aktiven Planungstransaktionen fließen in die Prognose Ihrer Kontostände und Kategoriebudgets ein. Sie sehen, wie sich Ihre Finanzen entwickeln würden, wenn alle geplanten Buchungen wie erwartet eintreten.

### Ausführen und Überspringen von Planungstransaktionen

*   **Ausführen**: Wenn eine Planungstransaktion fällig ist und Sie sie in eine echte Transaktion umwandeln möchten, können Sie sie "ausführen". Das System erstellt dann eine tatsächliche Buchung in Ihrem Konto/Ihrer Kategorie und aktualisiert die Planung (entweder wird sie gelöscht, wenn einmalig, oder das Startdatum wird auf das nächste Fälligkeitsdatum verschoben).
*   **Überspringen**: Wenn eine Planungstransaktion fällig ist, aber Sie keine echte Buchung erstellen möchten (z.B. weil sie manuell erfasst wurde oder nicht mehr relevant ist), können Sie sie "überspringen". Die Planung wird dann ebenfalls aktualisiert (gelöscht oder auf das nächste Fälligkeitsdatum verschoben), aber es wird keine echte Transaktion erstellt.

---

## Technisches Handbuch: Das Planungssystem im Detail

Das Planungssystem in FinWise ist eng mit den Transaktions- und Saldenberechnungen verknüpft, um eine umfassende Finanzprognose zu ermöglichen. Es basiert auf einer klaren Trennung von Datenhaltung (Stores) und Geschäftslogik (Services).

### 1. Datenhaltung: `src/stores/planningStore.ts`

*   **Zweck**: Der `planningStore` ist der zentrale Ort für die Speicherung und Verwaltung aller `PlanningTransaction`-Objekte im Frontend. Er ist ein Pinia-Store, der den reaktiven Zustand der geplanten Transaktionen hält.
*   **Persistenz**: Die Daten werden tenant-spezifisch in IndexedDB über den `TenantDbService` persistiert. Dies gewährleistet, dass Planungen auch offline verfügbar sind und bei einem Tenant-Wechsel korrekt geladen werden.
*   **Synchronisation (LWW)**: Der Store implementiert die Last-Write-Wins (LWW)-Logik. Bei eingehenden Synchronisationsnachrichten (`handleSyncMessage`) wird geprüft, ob die lokale Version einer Planungstransaktion neuer oder gleich alt ist wie die eingehende. Ist dies der Fall, wird die eingehende Änderung verworfen, um Datenverluste bei Konflikten zu vermeiden.
*   **Trigger**: Nach jeder Hinzufüge-, Aktualisierungs- oder Löschoperation (außer bei Synchronisation von außen) ruft der Store `BalanceService.calculateMonthlyBalances()` auf, um sicherzustellen, dass die Salden und Prognosen stets aktuell sind.

### 2. Geschäftslogik: `src/services/PlanningService.ts`

*   **Zweck**: Der `PlanningService` enthält die Kernlogik für die Erstellung, Verwaltung und Ausführung von Planungstransaktionen. Er agiert als Orchestrator, der mit anderen Stores und Services interagiert.
*   **`addPlanningTransaction(planning)`**:
    *   Setzt den korrekten `transactionType` basierend auf den übergebenen Daten (z.B. `ACCOUNTTRANSFER`, `CATEGORYTRANSFER`, `EXPENSE`, `INCOME`).
    *   Passt den Betrag bei Transfers an (negativ für die Quellbuchung).
    *   Setzt automatische Namen für Transferbuchungen, falls nicht angegeben.
    *   Speichert die Hauptbuchung über den `planningStore`.
    *   **Wichtig**: Bei `ACCOUNTTRANSFER` oder `CATEGORYTRANSFER` wird eine **Gegenbuchung** (`counterPlanningTransactionId`) erstellt und ebenfalls im `planningStore` gespeichert. Diese Gegenbuchung ist essenziell für die korrekte Saldenberechnung bei Transfers.
    *   Triggert `BalanceService.calculateMonthlyBalances()`.
*   **`calculateNextOccurrences(planTx, startDate, endDate)`**:
    *   Berechnet alle zukünftigen Ausführungstermine einer Planungstransaktion innerhalb eines bestimmten Zeitraums, basierend auf dem `recurrencePattern`, `recurrenceEndType`, `recurrenceCount` und `endDate`.
    *   Berücksichtigt die `WeekendHandlingType`-Regeln, um Termine, die auf Wochenenden fallen, entsprechend zu verschieben.
*   **`executePlanningTransaction(planningId, executionDate)`**:
    *   Dies ist der zentrale Punkt, an dem eine geplante Transaktion zu einer echten Transaktion wird.
    *   Ruft den `planningStore` auf, um die Planung zu laden.
    *   **Validierung**: Prüft auf gültige Beträge, Konten und Kategorien.
    *   **Transaktionserstellung**: Je nach `transactionType` (Kategorietransfer, Kontotransfer, Standard Einnahme/Ausgabe) wird die entsprechende Methode im `TransactionService` aufgerufen (`TransactionService.addCategoryTransfer`, `TransactionService.addAccountTransfer`, `TransactionService.addTransaction`).
    *   **Regelanwendung**: Nach der Erstellung der echten Transaktion wird der `ruleStore` aufgerufen, um `POST`-Stage-Regeln auf die neu erstellte Transaktion anzuwenden.
    *   **Planungsaktualisierung**: Wenn die Planung einmalig ist oder ihre Wiederholungen erschöpft sind, wird sie über `deletePlanningTransaction` gelöscht. Andernfalls wird das `startDate` der Planung auf das nächste berechnete Fälligkeitsdatum verschoben, um zukünftige Ausführungen zu ermöglichen.
    *   Triggert `BalanceService.calculateMonthlyBalances()`.
*   **`skipPlanningTransaction(planningId, executionDate)`**:
    *   Ähnlich wie `executePlanningTransaction`, aber es wird **keine echte Transaktion** erstellt.
    *   Die Planung wird lediglich aktualisiert (gelöscht oder auf das nächste Fälligkeitsdatum verschoben), um den Fortschritt zu markieren.
    *   Triggert `BalanceService.calculateMonthlyBalances()`.
*   **`executeAllDuePlanningTransactions()`**:
    *   Wird typischerweise beim Start der Anwendung oder in regelmäßigen Intervallen aufgerufen.
    *   Iteriert über alle Planungstransaktionen im `planningStore`.
    *   Berechnet fällige Termine bis zum heutigen Datum.
    *   Ruft `executePlanningTransaction` für jede fällige Planung auf, die nicht als Gegenbuchung markiert ist.
*   **`updateForecasts()` / `refreshForecastsForFuturePeriod()`**:
    *   Diese Methoden sind für die Aktualisierung der Prognosen zuständig.
    *   `updateForecasts()` ruft `BalanceService.calculateMonthlyBalances()` auf, um die Monatsbilanzen neu zu berechnen.
    *   `refreshForecastsForFuturePeriod()` prüft, ob die Startdaten von wiederkehrenden Planungen in der Vergangenheit liegen und aktualisiert sie auf das nächste zukünftige Vorkommen, um die Prognose für die nächsten 24 Monate aktuell zu halten.

### 3. Interaktion mit `src/services/TransactionService.ts`

*   **Zweck**: Der `TransactionService` ist für die Verwaltung der *echten* Transaktionen zuständig.
*   **Übergabe vom Planning Service**: Wenn `PlanningService.executePlanningTransaction` aufgerufen wird, übergibt er die Details der geplanten Buchung an `TransactionService.addTransaction`, `TransactionService.addAccountTransfer` oder `TransactionService.addCategoryTransfer`.
*   **Regelanwendung**: Der `TransactionService` ist der Ort, an dem Automatisierungsregeln (`useRuleStore().applyRulesToTransaction`) in verschiedenen Stufen (`PRE`, `DEFAULT`, `POST`) auf Transaktionen angewendet werden. Dies kann die Kategorie, den Empfänger, Tags oder andere Eigenschaften einer Transaktion beeinflussen.
*   **Recipient-Auflösung**: `TransactionService` löst den `payee` (Zahlungsempfänger) aus der `recipientId` auf, falls vorhanden, indem er den `useRecipientStore()` verwendet.
*   **Automatische Transfers**: Bei Einnahmen (`TransactionType.INCOME`) führt der `TransactionService` automatisch einen `CATEGORYTRANSFER` zur Kategorie "Verfügbare Mittel" durch, um das Budgetmanagement zu unterstützen.
*   **Running Balance**: Nach jeder Transaktionsänderung triggert der `TransactionService` den `BalanceService` zur Neuberechnung der laufenden Salden (`runningBalance`) für die betroffenen Konten.

### 4. Interaktion mit `src/services/BalanceService.ts`

*   **Zweck**: Der `BalanceService` ist für alle Saldenberechnungen zuständig, sowohl für tatsächliche als auch für prognostizierte Werte.
*   **`calculateMonthlyBalances()`**: Diese zentrale Methode wird von `PlanningStore`, `PlanningService` und `TransactionService` aufgerufen, wenn sich relevante Daten ändern. Sie berechnet die Monatsbilanzen (`MonthlyBalance`) für Konten und Kategorien, einschließlich der **projizierten Salden**, die auf den `PlanningTransaction`-Daten basieren. Die Ergebnisse werden im `monthlyBalanceStore` gespeichert.
*   **Prognose**: Methoden wie `getProjectedBalance` und `getRunningBalances` nutzen die im `monthlyBalanceStore` gespeicherten projizierten Salden und die `PlanningTransaction`-Daten, um zukünftige Finanzentwicklungen darzustellen.

### 5. Interaktion mit `src/stores/accountStore.ts` und `src/stores/categoryStore.ts`

*   Diese Stores stellen die Stammdaten für Konten und Kategorien bereit, die vom `PlanningService` und `TransactionService` benötigt werden, um Namen aufzulösen (z.B. für Transferbeschreibungen) und Validierungen durchzuführen.

### 6. Interaktion mit `src/stores/monthlyBalanceStore.ts`

*   Der `monthlyBalanceStore` speichert die Ergebnisse der `BalanceService.calculateMonthlyBalances()`-Berechnungen. Er dient als Cache für die monatlichen Salden und Prognosen, um schnelle Abfragen zu ermöglichen.

### 7. Interaktion mit `Recipient` und `Rules`

*   **Recipients**: Der `recipientStore` (nicht direkt in den bereitgestellten Dateien, aber impliziert) verwaltet die Empfängerdaten. `PlanningService` und `TransactionService` nutzen ihn, um den `payee` einer Transaktion oder Planung aufzulösen und um Referenzen bei der Löschung oder dem Zusammenführen von Empfängern zu validieren (`updateRecipientReferences`, `validateRecipientDeletion`).
*   **Rules**: Der `ruleStore` (nicht direkt in den bereitgestellten Dateien, aber impliziert) enthält die Automatisierungsregeln. `TransactionService` wendet diese Regeln in verschiedenen Phasen des Transaktionslebenszyklus an (`PRE`, `DEFAULT`, `POST`), was die Eigenschaften einer Transaktion basierend auf vordefinierten Bedingungen ändern kann.

### Zusammenfassung des Datenflusses

1.  **Planungserstellung**: Benutzer erstellt/bearbeitet Planung im UI -> `PlanningService.addPlanningTransaction` -> `planningStore` speichert in IndexedDB.
2.  **Prognose**: `planningStore` und `transactionStore` Daten werden von `BalanceService.calculateMonthlyBalances` verwendet, um `monthlyBalanceStore` mit aktuellen und projizierten Salden zu füllen.
3.  **Ausführung**: `PlanningService.executePlanningTransaction` wird aufgerufen (manuell oder automatisch) -> `TransactionService.addTransaction` (oder Transfer-Methoden) erstellt echte Transaktion -> `transactionStore` speichert in IndexedDB.
4.  **Nachbearbeitung**: `TransactionService` wendet `ruleStore`-Regeln an und triggert `BalanceService` zur Neuberechnung der Salden.
5.  **Synchronisation**: Alle Änderungen in den Stores werden über den `TenantDbService` in eine Sync-Queue gestellt und mit dem Backend synchronisiert (LWW-Logik).

---

## Klärung der Datumsbehandlung

Die FinWise-Anwendung verwendet für alle datumsbezogenen Operationen (wie das Bestimmen des "heutigen" Datums, das Berechnen von Wiederholungen oder das Filtern von Transaktionen nach Datum) die **lokale Systemzeit des Geräts**, auf dem die Anwendung ausgeführt wird.

*   **`new Date().toISOString()`**: Diese JavaScript-Funktion gibt das aktuelle Datum und die Uhrzeit des Client-Systems im ISO 8601-Format zurück.
*   **`dayjs()`**: Die `dayjs`-Bibliothek, die für Datumsberechnungen und -manipulationen verwendet wird, basiert ebenfalls auf der lokalen Systemzeit des Clients.
*   **`toDateOnlyString(date)`**: Diese Hilfsfunktion konvertiert ein Datum in das Format `YYYY-MM-DD`, wodurch die Zeitkomponente entfernt wird. Dies ist wichtig für Vergleiche, die nur das Datum betreffen.

**Antwort auf Ihre Fragen:**

*   **Welches Datum wird herangezogen? Das Systemdatum, an dem ich mich gerade befinde, ein Serverdatum?**
    Es wird das **Systemdatum des Clients** herangezogen. Es gibt keine direkte Abhängigkeit von einem Serverdatum für die clientseitigen Berechnungen der Planungstransaktionen und Prognosen.

*   **Wenn ich Tests mache, möchte ich wissen, ob ich an meinem PC die Zeit umstellen kann, und ob ich so Tests machen kann für den Plan Service.**
    **Ja, absolut.** Da die Anwendung die lokale Systemzeit des PCs verwendet, können Sie die Systemzeit Ihres PCs ändern, um das Verhalten des Planning Service zu testen. Dies ist eine gängige Methode, um datumsabhängige Logik in Client-Anwendungen zu überprüfen. Beispielsweise können Sie die Zeit auf ein zukünftiges Datum einstellen, um zu sehen, ob `executeAllDuePlanningTransactions` fällige Planungen korrekt ausführt, oder auf ein Datum in der Vergangenheit, um die Prognoseberechnungen zu überprüfen.
