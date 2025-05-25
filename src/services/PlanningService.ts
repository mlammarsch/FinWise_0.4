import { usePlanningStore } from "@/stores/planningStore";
import {
  PlanningTransaction,
  RecurrencePattern,
  TransactionType,
  WeekendHandlingType,
  RecurrenceEndType,
} from "@/types";
import dayjs from "dayjs";
import { debugLog, infoLog } from "@/utils/logger";
import { TransactionService } from "@/services/TransactionService";
import { useRuleStore } from "@/stores/ruleStore";
import { toDateOnlyString } from "@/utils/formatters";
import { BalanceService } from "./BalanceService";
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";

/**
 * Erstellt eine Gegenbuchung für eine Transfer-Planungstransaktion
 */
function createCounterPlanning(
  planning: PlanningTransaction
): Partial<PlanningTransaction> {
  if (
    planning.transactionType !== TransactionType.ACCOUNTTRANSFER &&
    planning.transactionType !== TransactionType.CATEGORYTRANSFER
  ) {
    throw new Error("Nur für Transfers möglich");
  }

  const accountStore = useAccountStore();
  const categoryStore = useCategoryStore();

  const counterPlanning: Partial<PlanningTransaction> = {
    transactionType: planning.transactionType,
    name: `${planning.name} (Gegenbuchung)`,
    note: planning.note,
    startDate: planning.startDate,
    valueDate: planning.valueDate,
    endDate: planning.endDate,
    recurrencePattern: planning.recurrencePattern,
    recurrenceEndType: planning.recurrenceEndType,
    recurrenceCount: planning.recurrenceCount,
    executionDay: planning.executionDay,
    weekendHandling: planning.weekendHandling,
    repeatsEnabled: planning.repeatsEnabled,
    isActive: planning.isActive,
    forecastOnly: planning.forecastOnly,
    amountType: planning.amountType,
    approximateAmount: planning.approximateAmount,
    minAmount: planning.minAmount,
    maxAmount: planning.maxAmount,
    tagIds: planning.tagIds || [],
    counterPlanningTransactionId: planning.id,
    amount: -planning.amount,
  };

  if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
    counterPlanning.accountId = planning.transferToAccountId || "";
    counterPlanning.transferToAccountId = planning.accountId;
    counterPlanning.categoryId = null;
    counterPlanning.transferToCategoryId = null;
    counterPlanning.recipientId = null;
  } else if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
    counterPlanning.categoryId = planning.transferToCategoryId;
    counterPlanning.transferToCategoryId = planning.categoryId;
    counterPlanning.accountId = null;
    counterPlanning.transferToAccountId = null;
    counterPlanning.recipientId = null;
  }

  return counterPlanning;
}

export const PlanningService = {
  /**
   * Fügt eine Planungstransaktion hinzu (CRUD).
   */
  addPlanningTransaction(planning: Partial<PlanningTransaction>) {
    const planningStore = usePlanningStore();
    const accountStore = useAccountStore();
    const categoryStore = useCategoryStore();

    // Sicherstellen, dass Transaktionstyp korrekt gesetzt wird
    if (planning.transferToCategoryId && !planning.transactionType) {
      planning.transactionType = TransactionType.CATEGORYTRANSFER;
    } else if (planning.transferToAccountId && !planning.transactionType) {
      planning.transactionType = TransactionType.ACCOUNTTRANSFER;
    } else if (planning.amount !== undefined && !planning.transactionType) {
      planning.transactionType =
        planning.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    // Bei Transfers den Betrag ggf. anpassen
    if (
      (planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
        planning.transactionType === TransactionType.CATEGORYTRANSFER) &&
      planning.amount !== undefined
    ) {
      planning.amount = -Math.abs(planning.amount);
    }

    // Flag repeatsEnabled nachpflegen, wenn nicht gesetzt
    if (planning.repeatsEnabled === undefined) {
      planning.repeatsEnabled =
        planning.recurrencePattern !== RecurrencePattern.ONCE;
    }

    // Namen für Transfers automatisch setzen, falls nicht angegeben
    if (
      planning.transactionType === TransactionType.ACCOUNTTRANSFER &&
      planning.transferToAccountId &&
      !planning.name
    ) {
      const toName =
        accountStore.getAccountById(planning.transferToAccountId)?.name || "";
      planning.name = `Transfer zu ${toName}`;
    } else if (
      planning.transactionType === TransactionType.CATEGORYTRANSFER &&
      planning.transferToCategoryId &&
      !planning.name
    ) {
      const toName =
        categoryStore.getCategoryById(planning.transferToCategoryId)?.name || "";
      planning.name = `Transfer zu ${toName}`;
    }

    // Debug-Log vor dem Speichern
    debugLog("[PlanningService] addPlanningTransaction - Übergebene Daten:", {
      name: planning.name,
      transactionType: planning.transactionType,
      repeatsEnabled: planning.repeatsEnabled,
      transferToAccountId: planning.transferToAccountId,
      transferToCategoryId: planning.transferToCategoryId,
    });

    // Hauptbuchung speichern
    const newPlanning = planningStore.addPlanningTransaction(planning);
    debugLog(
      "[PlanningService] addPlanningTransaction - Hauptbuchung erstellt:",
      newPlanning
    );

    // Bei Transfers: Gegenbuchung
    if (
      (planning.transactionType === TransactionType.ACCOUNTTRANSFER &&
        planning.transferToAccountId) ||
      (planning.transactionType === TransactionType.CATEGORYTRANSFER &&
        planning.transferToCategoryId)
    ) {
      const counterPlanning = createCounterPlanning(newPlanning);
      const counterTransaction =
        planningStore.addPlanningTransaction(counterPlanning);

      planningStore.updatePlanningTransaction(newPlanning.id, {
        counterPlanningTransactionId: counterTransaction.id,
      });

      debugLog("[PlanningService] addPlanningTransaction - Gegenbuchung erstellt:", {
        id: counterTransaction.id,
        name: counterTransaction.name,
        amount: counterTransaction.amount,
      });
    }

    BalanceService.calculateMonthlyBalances();
    return newPlanning;
  },

    /**
   * Berechnet zukünftige Ausführungstermine einer Planungstransaktion.
   */
    calculateNextOccurrences(
      planTx: PlanningTransaction,
      startDate: string,
      endDate: string
    ): string[] {
      if (!planTx.isActive) return [];

      const repeatsEnabled =
        planTx.repeatsEnabled ??
        (planTx.recurrencePattern !== RecurrencePattern.ONCE);

      const occurrences: string[] = [];
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const txStart = dayjs(toDateOnlyString(planTx.startDate));

      if (txStart.isAfter(end)) return [];
      if (planTx.endDate && dayjs(toDateOnlyString(planTx.endDate)).isBefore(start))
        return [];

      let currentDate = txStart;
      // Zähler beginnt bei 1, damit die erste Instanz bereits mitgezählt wird
      let count = 1;
      const maxIterations = 1000;

      // Einmalige Buchung
      if (!repeatsEnabled || planTx.recurrencePattern === RecurrencePattern.ONCE) {
        let adjustedDate = PlanningService.applyWeekendHandling(
          currentDate,
          planTx.weekendHandling
        );
        if (
          adjustedDate.isSameOrAfter(start) &&
          adjustedDate.isSameOrBefore(end)
        ) {
          occurrences.push(toDateOnlyString(adjustedDate.toDate()));
        }
        return occurrences;
      }

      debugLog("[PlanningService] calculateNextOccurrences - Parameter", {
        planId: planTx.id,
        name: planTx.name,
        recurrenceEndType: planTx.recurrenceEndType,
        recurrenceCount: planTx.recurrenceCount,
        startDate,
        endDate
      });

      while (currentDate.isSameOrBefore(end) && count < maxIterations) {
        let adjustedDate = PlanningService.applyWeekendHandling(
          currentDate,
          planTx.weekendHandling
        );

        if (
          adjustedDate.isSameOrAfter(start) &&
          adjustedDate.isSameOrBefore(end)
        ) {
          occurrences.push(toDateOnlyString(adjustedDate.toDate()));

          debugLog("[PlanningService] calculateNextOccurrences - Occurrence added", {
            date: toDateOnlyString(adjustedDate.toDate()),
            currentCount: count,
            recurrenceEndType: planTx.recurrenceEndType,
            recurrenceCount: planTx.recurrenceCount
          });
        }

        if (planTx.recurrenceEndType === RecurrenceEndType.NEVER) {
          const maxEndDate = dayjs(start).add(24, "months");
          if (adjustedDate.isAfter(maxEndDate)) break;
        }

        // Geänderte Break-Bedingung: Wir brechen ab, wenn wir die gewünschte Anzahl erreicht haben
        if (
          planTx.recurrenceEndType === RecurrenceEndType.COUNT &&
          planTx.recurrenceCount !== null &&
          count >= planTx.recurrenceCount
        ) {
          debugLog("[PlanningService] calculateNextOccurrences - Breaking after count limit", {
            currentCount: count,
            maxCount: planTx.recurrenceCount
          });
          break;
        }

        count++;

        switch (planTx.recurrencePattern) {
          case RecurrencePattern.DAILY:
            currentDate = currentDate.add(1, "day");
            break;
          case RecurrencePattern.WEEKLY:
            currentDate = currentDate.add(1, "week");
            break;
          case RecurrencePattern.BIWEEKLY:
            currentDate = currentDate.add(2, "weeks");
            break;
          case RecurrencePattern.MONTHLY:
            if (
              planTx.executionDay &&
              planTx.executionDay > 0 &&
              planTx.executionDay <= 31
            ) {
              const nextMonth = currentDate.add(1, "month");
              const year = nextMonth.year();
              const month = nextMonth.month() + 1;
              const maxDay = new Date(year, month, 0).getDate();
              const day = Math.min(planTx.executionDay, maxDay);
              currentDate = dayjs(new Date(year, month - 1, day));
            } else {
              currentDate = currentDate.add(1, "month");
            }
            break;
          case RecurrencePattern.QUARTERLY:
            currentDate = currentDate.add(3, "months");
            break;
          case RecurrencePattern.YEARLY:
            currentDate = currentDate.add(1, "year");
            break;
          default:
            return occurrences;
        }

        if (
          planTx.recurrenceEndType === RecurrenceEndType.DATE &&
          planTx.endDate &&
          currentDate.isAfter(dayjs(toDateOnlyString(planTx.endDate)))
        )
          break;
      }

      debugLog("[PlanningService] calculateNextOccurrences - Result", {
        planId: planTx.id,
        name: planTx.name,
        totalOccurrences: occurrences.length,
        dates: occurrences
      });

      return occurrences;
    },

  /**
   * Verschiebt das Datum, falls es auf ein Wochenende fällt.
   */
  applyWeekendHandling(date: dayjs.Dayjs, handling: WeekendHandlingType): dayjs.Dayjs {
    const day = date.day();
    if ((day !== 0 && day !== 6) || handling === WeekendHandlingType.NONE)
      return date;
    const isSaturday = day === 6;
    switch (handling) {
      case WeekendHandlingType.BEFORE:
        return isSaturday ? date.subtract(1, 'day') : date.subtract(2, 'day');
      case WeekendHandlingType.AFTER:
        return isSaturday ? date.add(2, 'day') : date.add(1, 'day');
      default:
        return date;
    }
  },

  /**
   * Führt eine geplante Transaktion aus.
   * Verarbeitet Haupttransaktionen und deren Gegenbuchungen zusammen.
   * Löscht ONCE‑Planungen bzw. die letzte Wiederholung automatisch aus dem Store.
   */
  executePlanningTransaction(planningId: string, executionDate: string) {
    const planningStore = usePlanningStore();
    const planning = planningStore.getPlanningTransactionById(planningId);

    if (!planning) {
      debugLog('[PlanningService] executePlanningTransaction - Planning not found', { planningId });
      return false;
    }

    // Prüfen, ob es sich um eine Transferbuchung handelt und ob die Gegenbuchung existiert
    const isTransfer = planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
                       planning.transactionType === TransactionType.CATEGORYTRANSFER;

    const counterPlanningId = planning.counterPlanningTransactionId;
    const counterPlanning = counterPlanningId
      ? planningStore.getPlanningTransactionById(counterPlanningId)
      : null;

    let transactionsCreated = false;

    // Wenn kein Forecast-Only, dann echte Transaktion erstellen
    if (!planning.forecastOnly) {
      // --- Validierung ---
      if (planning.amount === 0) throw new Error("Betrag 0 ist nicht zulässig.");

      if (planning.transactionType !== TransactionType.CATEGORYTRANSFER &&
          !planning.accountId) {
        throw new Error("Quellkonto fehlt.");
      }

      if (planning.transactionType !== TransactionType.ACCOUNTTRANSFER &&
          planning.transactionType !== TransactionType.CATEGORYTRANSFER &&
          !planning.categoryId) {
        throw new Error("Kategorie muss gesetzt sein.");
      }

      // Je nach Transaktionstyp unterschiedliche Logik
      if (planning.transactionType === TransactionType.CATEGORYTRANSFER) {
        // Kategorietransfer ausführen
        const fromCategoryId = planning.categoryId;
        const toCategoryId = planning.transferToCategoryId;

        if (!fromCategoryId || !toCategoryId) {
          throw new Error("Für Kategorietransfer werden Quell- und Zielkategorie benötigt");
        }

        debugLog('[PlanningService] executePlanningTransaction - Führe Kategorietransfer aus', {
          fromCategoryId,
          toCategoryId,
          amount: Math.abs(planning.amount),
          date: executionDate
        });

        // Kategorietransfer über TransactionService ausführen
        TransactionService.addCategoryTransfer(
          fromCategoryId,
          toCategoryId,
          Math.abs(planning.amount),
          executionDate,
          planning.note || ''
        );

        transactionsCreated = true;
      }
      else if (planning.transactionType === TransactionType.ACCOUNTTRANSFER) {
        // Kontotransfer ausführen
        const fromAccountId = planning.accountId;
        const toAccountId = planning.transferToAccountId;

        if (!fromAccountId || !toAccountId) {
          throw new Error("Für Kontotransfer werden Quell- und Zielkonto benötigt");
        }

        debugLog('[PlanningService] executePlanningTransaction - Führe Kontotransfer aus', {
          fromAccountId,
          toAccountId,
          amount: Math.abs(planning.amount),
          date: executionDate
        });

        TransactionService.addAccountTransfer(
          fromAccountId,
          toAccountId,
          Math.abs(planning.amount),
          executionDate,
          planning.valueDate || executionDate,
          planning.note || '',
          planning.id
        );

        transactionsCreated = true;
      }
      else {
        // Standard Einnahme/Ausgabe
        const txType =
          planning.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;

        debugLog('[PlanningService] executePlanningTransaction - Führe normale Transaktion aus', {
          type: txType,
          accountId: planning.accountId,
          categoryId: planning.categoryId,
          amount: planning.amount,
          date: executionDate
        });

        TransactionService.addTransaction({
          date: executionDate,
          valueDate: planning.valueDate || executionDate,
          amount: planning.amount,
          type: txType,
          description: planning.name || '',
          note: planning.note || '',
          accountId: planning.accountId,
          categoryId: planning.categoryId,
          tagIds: planning.tagIds || [],
          recipientId: planning.recipientId || '',
          planningTransactionId: planning.id,
        });

        transactionsCreated = true;
      }

      // Regeln anwenden
      if (transactionsCreated) {
        const ruleStore = useRuleStore();
        const latestTx = TransactionService.getAllTransactions().slice(-1)[0];
        if (latestTx) ruleStore.applyRulesToTransaction(latestTx);
      }
    }

    // Prüfen, ob die Planung gelöscht oder aktualisiert werden soll
    const shouldDelete =
      planning.recurrencePattern === RecurrencePattern.ONCE ||
      (planning.recurrenceEndType === RecurrenceEndType.DATE &&
       planning.endDate &&
       dayjs(executionDate).isSame(dayjs(planning.endDate))) ||
      (planning.recurrenceEndType === RecurrenceEndType.COUNT &&
       planning.recurrenceCount !== null &&
       PlanningService.calculateNextOccurrences(
         planning,
         dayjs(executionDate).add(1, 'day').format('YYYY-MM-DD'),
         dayjs(executionDate).add(10, 'year').format('YYYY-MM-DD')
       ).length === 0);

    // Update der Planung und eventuell Gegenbuchung durchführen
    if (shouldDelete) {
      // Planung und eventuell Gegenbuchung löschen
      this.deletePlanningTransaction(planning.id);
      debugLog('[PlanningService] executePlanningTransaction - Planung gelöscht (einmalig oder letzte Wiederholung)', {
        planningId: planning.id,
        isTransfer
      });
    } else {
      // Nächstes Datum berechnen
      const nextOcc = PlanningService.calculateNextOccurrences(
        planning,
        dayjs(executionDate).add(1, 'day').format('YYYY-MM-DD'),
        dayjs(executionDate).add(3, 'years').format('YYYY-MM-DD')
      );

      if (nextOcc.length > 0) {
        // Nächstes Datum setzen
        const nextDate = nextOcc[0];
        planningStore.updatePlanningTransaction(planning.id, { startDate: nextDate });

        // Auch bei Gegenbuchung Datum aktualisieren
        if (counterPlanning && counterPlanningId) {
          planningStore.updatePlanningTransaction(counterPlanningId, { startDate: nextDate });
          debugLog('[PlanningService] executePlanningTransaction - Gegenbuchungsdatum aktualisiert', {
            counterPlanningId,
            nextDate
          });
        }
      }
    }

    // Bilanzen aktualisieren
    BalanceService.calculateMonthlyBalances();

    debugLog('[PlanningService] executePlanningTransaction - Abgeschlossen', {
      planningId: planning.id,
      executionDate,
      deleted: shouldDelete,
      transactionsCreated
    });

    return true;
  },

  /**
   * Löscht eine Planungstransaktion (CRUD).
   */
  deletePlanningTransaction(id: string) {
    const planningStore = usePlanningStore();
    const planning = planningStore.getPlanningTransactionById(id);

    if (!planning) {
      debugLog("[PlanningService] deletePlanningTransaction - Planung nicht gefunden", id);
      return false;
    }

    // Gegenbuchung finden und löschen, wenn vorhanden und noch nicht bearbeitet
    if (planning.counterPlanningTransactionId) {
      const counterPlanning = planningStore.getPlanningTransactionById(planning.counterPlanningTransactionId);

      // Prüfen, ob wir nicht schon in der Gegenbuchungslöschung sind (Rekursionsschutz)
      if (counterPlanning && counterPlanning.counterPlanningTransactionId === id) {
        planningStore.deletePlanningTransaction(planning.counterPlanningTransactionId);
        debugLog("[PlanningService] deletePlanningTransaction - Gegenbuchung gelöscht", planning.counterPlanningTransactionId);
      }
    }

    // Hauptbuchung löschen
    planningStore.deletePlanningTransaction(id);
    debugLog("[PlanningService] deletePlanningTransaction - Hauptbuchung gelöscht", id);

    BalanceService.calculateMonthlyBalances();
    return true;
  },

  /**
   * Führt alle fälligen Planungstransaktionen aus.
   */
  executeAllDuePlanningTransactions() {
    const planningStore = usePlanningStore();
    const today = dayjs().startOf('day');
    let executedCount = 0;

    // Set für bereits verarbeitete Planungspaare
    const processedPlanningIds = new Set<string>();

    // Kopie erstellen, da Original-Array beim Löschen verändert wird
    const planningsToProcess = [...planningStore.planningTransactions];

    debugLog('[PlanningService] executeAllDuePlanningTransactions - Starte Prüfung fälliger Buchungen', {
      today: today.format('YYYY-MM-DD'),
      totalPlannings: planningsToProcess.length
    });

    // Alle Planungen durchgehen
    planningsToProcess.forEach((planning) => {
      // Bereits verarbeitete Planungen überspringen
      if (processedPlanningIds.has(planning.id)) {
        return;
      }

      // Nur aktive Planungen berücksichtigen
      if (!planning.isActive) {
        return;
      }

      // Bei Transfers: Überprüfen, ob wir eine Gegenbuchung sind
      const isCounterBooking =
        planning.counterPlanningTransactionId &&
        (planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
         planning.transactionType === TransactionType.CATEGORYTRANSFER);

      // Gegenbuchungen überspringen - werden mit Hauptbuchung verarbeitet
      if (isCounterBooking) {
        debugLog('[PlanningService] executeAllDuePlanningTransactions - Überspringe Gegenbuchung', {
          planningId: planning.id,
          counterPlanningId: planning.counterPlanningTransactionId
        });
        return;
      }

      // Fällige Termine ermitteln
      const overdueOccurrences = PlanningService.calculateNextOccurrences(
        planning,
        planning.startDate,
        today.format('YYYY-MM-DD')
      );

      // Wenn fällige Termine vorhanden, diese ausführen
      if (overdueOccurrences.length > 0) {
        debugLog('[PlanningService] executeAllDuePlanningTransactions - Fällige Termine gefunden', {
          planningId: planning.id,
          name: planning.name,
          type: planning.transactionType,
          occurrences: overdueOccurrences,
          isTransfer: planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
                      planning.transactionType === TransactionType.CATEGORYTRANSFER
        });

        // Für jeden fälligen Termin ausführen
        for (const dateStr of overdueOccurrences) {
          if (dayjs(dateStr).isSameOrBefore(today)) {
            const success = PlanningService.executePlanningTransaction(planning.id, dateStr);

            if (success) {
              executedCount++;

              // Bei Transfers: Gegenbuchung als verarbeitet markieren
              if ((planning.transactionType === TransactionType.ACCOUNTTRANSFER ||
                  planning.transactionType === TransactionType.CATEGORYTRANSFER) &&
                  planning.counterPlanningTransactionId) {
                processedPlanningIds.add(planning.counterPlanningTransactionId);
              }
            }

            // Diese Planung als verarbeitet markieren
            processedPlanningIds.add(planning.id);
          }
        }
      }
    });

    debugLog('[PlanningService] executeAllDuePlanningTransactions - Abgeschlossen', {
      executedCount,
      processedCount: processedPlanningIds.size
    });

    return executedCount;
  },

  /**
   * Aktualisiert die Prognosen, indem die Monatsbilanzen neu berechnet werden.
   */
  updateForecasts() {
    BalanceService.calculateMonthlyBalances();
    localStorage.setItem('finwise_last_forecast_update', Date.now().toString());
    debugLog("[PlanningService] updateForecasts - Monatsbilanzen aktualisiert");
    return true;
  },

  /**
   * Überprüft und ergänzt Prognosebuchungen für aktive Planungstransaktionen bis 24 Monate in die Zukunft
   */
  refreshForecastsForFuturePeriod() {
    const planningStore = usePlanningStore();
    const today = dayjs();
    const endDate = today.add(24, 'months').format('YYYY-MM-DD');
    let updatedForecastsCount = 0;

    infoLog("[PlanningService]", "Überprüfe Prognosebuchungen für die nächsten 24 Monate");

    planningStore.planningTransactions.forEach(plan => {
      if (!plan.isActive || plan.recurrencePattern === RecurrencePattern.ONCE) return;

      // Bei Gegenbuchungen: Überprüfung überspringen, wird mit Hauptbuchung behandelt
      if (plan.counterPlanningTransactionId &&
          (plan.transactionType === TransactionType.ACCOUNTTRANSFER ||
           plan.transactionType === TransactionType.CATEGORYTRANSFER)) {
        return;
      }

      // Nur Planungen prüfen, die nicht enden oder deren Enddatum in der Zukunft liegt
      if (plan.recurrenceEndType === RecurrenceEndType.DATE &&
          plan.endDate &&
          dayjs(plan.endDate).isBefore(today)) {
        return;
      }

      // Alle zukünftigen Ausführungsdaten berechnen
      const occurrences = this.calculateNextOccurrences(
        plan,
        today.format('YYYY-MM-DD'),
        endDate
      );

      // Wenn Termine vorhanden: Startdatum aktualisieren falls nötig
      if (occurrences.length > 0) {
        const firstOccurrence = occurrences[0];

        // Wenn das nächste berechnete Datum nach dem aktuellen Startdatum liegt
        if (dayjs(firstOccurrence).isAfter(dayjs(plan.startDate))) {
          debugLog("[PlanningService] refreshForecastsForFuturePeriod - Aktualisiere Startdatum", {
            planId: plan.id,
            name: plan.name,
            oldStartDate: plan.startDate,
            newStartDate: firstOccurrence,
            occurrencesCount: occurrences.length
          });

          // Startdatum aktualisieren
          planningStore.updatePlanningTransaction(plan.id, { startDate: firstOccurrence });
          updatedForecastsCount++;

          // Auch Gegenbuchung aktualisieren, wenn vorhanden
          if (plan.counterPlanningTransactionId) {
            planningStore.updatePlanningTransaction(plan.counterPlanningTransactionId, {
              startDate: firstOccurrence
            });
          }
        }
      }
    });

    // Monatsbilanzen neu berechnen, wenn Änderungen vorgenommen wurden
    if (updatedForecastsCount > 0) {
      BalanceService.calculateMonthlyBalances();
      infoLog("[PlanningService]", `${updatedForecastsCount} Prognosebuchungen für zukünftige Perioden aktualisiert`);
    } else {
      infoLog("[PlanningService]", "Keine Aktualisierung der Prognosebuchungen erforderlich");
    }

    return updatedForecastsCount;
  }
};
