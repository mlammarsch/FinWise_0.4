// Datei: src/services/TransactionService.ts
// Zentrale Drehscheibe für alle Transaktionen, Transfers & Reconcile‑Buchungen.

import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { useTagStore } from '@/stores/tagStore';
import { Transaction, TransactionType } from '@/types';
// ExtendedTransaction muss importiert werden, wenn es als Typ verwendet wird
import { type ExtendedTransaction } from '@/stores/transactionStore'; // Korrekter Importpfad und `type` Keyword
import { v4 as uuidv4 } from 'uuid';
import { debugLog, infoLog, errorLog, warnLog } from '@/utils/logger';
import { toDateOnlyString } from '@/utils/formatters';
import { useRuleStore } from '@/stores/ruleStore';
import { BalanceService } from './BalanceService';
import { TenantDbService } from './TenantDbService';

export const TransactionService = {
  // Flag zur Deaktivierung der automatischen Running Balance Neuberechnung (z.B. während CSV-Import)
  _skipRunningBalanceRecalc: false,

  // Batch-Mode für Performance-Optimierung bei Initial Data Load
  _isBatchMode: false,
  _batchModeCache: new Map<string, any>(),

  /**
   * Aktiviert Batch-Mode für Performance-Optimierung
   */
  startBatchMode(): void {
    this._isBatchMode = true;
    this._batchModeCache.clear();
    debugLog('[TransactionService]', 'Batch-Mode aktiviert');
  },

  /**
   * Deaktiviert Batch-Mode und leert Cache
   */
  endBatchMode(): void {
    this._isBatchMode = false;
    this._batchModeCache.clear();
    debugLog('[TransactionService]', 'Batch-Mode deaktiviert');
  },

  /**
   * Prüft ob aktuell im Batch-Mode
   */
  isInBatchMode(): boolean {
    return this._isBatchMode;
  },

  /* ------------------------------------------------------------------ */
  /* --------------------------- Read APIs ---------------------------- */
  /* ------------------------------------------------------------------ */
  getAllTransactions(): Transaction[] {
    return useTransactionStore().transactions;
  },

  getTransactionById(id: string): Transaction | null {
    const tx = useTransactionStore().getTransactionById(id);
    if (!tx) {
      debugLog('[TransactionService] getTransactionById – not found', id);
      return null; // Explizit null zurückgeben, wenn undefined
    }
    return tx;
  },

  /* ------------------------------------------------------------------ */
  /* --------------------------- Helper Functions -------------------- */
  /* ------------------------------------------------------------------ */

  /**
   * Leitet payee-Wert aus recipientId ab oder verwendet den übergebenen payee-Wert
   */
  resolvePayeeFromRecipient(recipientId?: string, fallbackPayee?: string): string {
    if (recipientId) {
      const recipientStore = useRecipientStore();
      const recipient = recipientStore.getRecipientById(recipientId);
      if (recipient) {
        return recipient.name;
      }
    }
    return fallbackPayee || '';
  },

  /**
   * Automatische Zuweisung der "Verfügbare Mittel" Kategorie für Transaktionen ohne Kategorisierung
   * Ausnahmen: Reconciliation-Buchungen und bewusste Kategorie-Entfernungen
   */
  assignDefaultCategoryIfNeeded(
    txData: any,
    isReconciliation: boolean = false,
    isIntentionalCategoryRemoval: boolean = false
  ): any {
    // Ausnahmen: Reconciliation-Buchungen oder bewusste Kategorie-Entfernungen
    if (isReconciliation || isIntentionalCategoryRemoval) {
      debugLog('[TransactionService]', 'assignDefaultCategoryIfNeeded - Skipped due to exception', {
        isReconciliation,
        isIntentionalCategoryRemoval,
        transactionType: txData.type
      });
      return txData;
    }

    // Prüfe ob Transaktion bereits eine Kategorie hat
    if (txData.categoryId) {
      debugLog('[TransactionService]', 'assignDefaultCategoryIfNeeded - Transaction already has category', {
        categoryId: txData.categoryId,
        transactionType: txData.type
      });
      return txData;
    }

    // Ausnahme für CATEGORYTRANSFER und ACCOUNTTRANSFER - diese brauchen keine automatische Kategorie
    if (txData.type === TransactionType.CATEGORYTRANSFER || txData.type === TransactionType.ACCOUNTTRANSFER) {
      debugLog('[TransactionService]', 'assignDefaultCategoryIfNeeded - Skipped for transfer type', {
        transactionType: txData.type
      });
      return txData;
    }

    const catStore = useCategoryStore();
    const availableFundsCategory = catStore.getAvailableFundsCategory();

    if (!availableFundsCategory) {
      warnLog('[TransactionService]', 'assignDefaultCategoryIfNeeded - "Verfügbare Mittel" Kategorie nicht gefunden');
      return txData;
    }

    // Weise "Verfügbare Mittel" Kategorie zu
    const updatedTxData = {
      ...txData,
      categoryId: availableFundsCategory.id
    };

    infoLog('[TransactionService]', 'assignDefaultCategoryIfNeeded - Automatische Kategorienzuweisung', {
      transactionType: txData.type,
      assignedCategoryId: availableFundsCategory.id,
      categoryName: availableFundsCategory.name
    });

    return updatedTxData;
  },

  /* ------------------------------------------------------------------ */
  /* --------------------------- Write APIs --------------------------- */
  /* ------------------------------------------------------------------ */

  async addTransaction(txData: Omit<Transaction, 'id' | 'runningBalance'>, applyRules: boolean = true): Promise<Transaction> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();
    const ruleStore = useRuleStore();

    // Basiskontrolle
    if (!txData.accountId && txData.type !== TransactionType.CATEGORYTRANSFER) {
      throw new Error('Account ID erforderlich.');
    }

    // Normalisieren & anlegen
    debugLog('[TransactionService]', 'addTransaction - txData input:', txData);

    // Leite payee aus recipientId ab, falls vorhanden
    const resolvedPayee = this.resolvePayeeFromRecipient(txData.recipientId, txData.payee);

    // Automatische Kategorienzuweisung für Transaktionen ohne Kategorisierung
    const txDataWithDefaultCategory = this.assignDefaultCategoryIfNeeded(
      txData,
      txData.isReconciliation || false,
      false // Bei neuen Transaktionen ist es nie eine bewusste Kategorie-Entfernung
    );

    let transactionDataForStore: ExtendedTransaction = {
      // Übernehme alle Felder von txDataWithDefaultCategory (mit potentieller automatischer Kategorie)
      ...txDataWithDefaultCategory,
      // Setze die Pflichtfelder von ExtendedTransaction oder Felder mit strengeren Typen
      id: uuidv4(),
      date: toDateOnlyString(txDataWithDefaultCategory.date),
      valueDate: txDataWithDefaultCategory.valueDate ? toDateOnlyString(txDataWithDefaultCategory.valueDate) : toDateOnlyString(txDataWithDefaultCategory.date),
      runningBalance: 0, // Pflicht in ExtendedTransaction
      payee: resolvedPayee, // Verwende den aus recipientId abgeleiteten payee
      description: txDataWithDefaultCategory.description || '', // description ist in Transaction Pflicht
      tagIds: txDataWithDefaultCategory.tagIds || [], // tagIds ist in Transaction Pflicht
      // Stelle sicher, dass optionale Felder, die in ExtendedTransaction string | null sind, korrekt behandelt werden
      counterTransactionId: txDataWithDefaultCategory.counterTransactionId === undefined ? null : txDataWithDefaultCategory.counterTransactionId,
      planningTransactionId: txDataWithDefaultCategory.planningTransactionId === undefined ? null : txDataWithDefaultCategory.planningTransactionId,
      // Stelle sicher, dass optionale Felder, die in ExtendedTransaction boolean sind, korrekt behandelt werden
      isReconciliation: txDataWithDefaultCategory.isReconciliation === undefined ? false : txDataWithDefaultCategory.isReconciliation,
      // updated_at wird im Store gesetzt.
      // Andere Felder wie type, accountId, categoryId, amount, note, isCategoryTransfer, transferToAccountId, reconciled, toCategoryId
      // werden von ...txDataWithDefaultCategory übernommen und sollten mit Transaction und somit ExtendedTransaction kompatibel sein.
    };
    debugLog('[TransactionService]', 'addTransaction - transactionDataForStore prepared:', transactionDataForStore);

    // PRE-Stage Regeln anwenden (vor dem Speichern)
    if (applyRules) {
      debugLog('[TransactionService]', 'Applying PRE-stage rules before saving transaction');
      const preRuleResult = await ruleStore.applyRulesToTransaction(transactionDataForStore, 'PRE');
      // Merge die Regel-Änderungen zurück in transactionDataForStore
      transactionDataForStore = {
        ...transactionDataForStore,
        ...preRuleResult,
        // Stelle sicher, dass ExtendedTransaction-spezifische Felder erhalten bleiben
        payee: preRuleResult.payee || transactionDataForStore.payee,
        runningBalance: transactionDataForStore.runningBalance,
        counterTransactionId: preRuleResult.counterTransactionId || transactionDataForStore.counterTransactionId,
        planningTransactionId: preRuleResult.planningTransactionId || transactionDataForStore.planningTransactionId,
        isReconciliation: preRuleResult.isReconciliation !== undefined ? preRuleResult.isReconciliation : transactionDataForStore.isReconciliation,
      };
    }

    const added = await txStore.addTransaction(transactionDataForStore);

    // DEFAULT-Stage Regeln anwenden (nach dem Speichern, wie bisher)
    if (applyRules) {
      debugLog('[TransactionService]', 'Applying DEFAULT-stage rules after saving transaction');
      await ruleStore.applyRulesToTransaction(added, 'DEFAULT');
    }

    debugLog('[TransactionService]', 'addTransaction completed', added);

    // WICHTIG: Running Balance für betroffenes Konto neu berechnen
    // Verwende optimierte Queue-basierte Berechnung
    if (added.accountId) {
      debugLog('[TransactionService]', `Füge Konto ${added.accountId} zur Running Balance Queue hinzu nach Transaktion ${added.id}`);

      const { BalanceService } = await import('@/services/BalanceService');
      BalanceService.enqueueRunningBalanceRecalculation(added.accountId, added.valueDate || added.date);

      debugLog('[TransactionService]', `Konto ${added.accountId} zur Running Balance Queue hinzugefügt`);
    }

    /* Automatischer Kategorie‑Transfer bei Einnahmen */
    debugLog('[TransactionService]', 'Category Transfer Check - Transaction', {
      type: added.type,
      amount: added.amount,
      categoryId: added.categoryId,
      isIncome: added.type === TransactionType.INCOME
    });

    if (
      added.type === TransactionType.INCOME &&
      added.amount > 0 &&
      added.categoryId
    ) {
      debugLog('[TransactionService]', 'Category Transfer - Conditions met, checking categories...');

      const available = catStore.getAvailableFundsCategory();
      debugLog('[TransactionService]', 'Available Funds Category found', available);

      if (!available) {
        debugLog('[TransactionService]', 'ERROR: Verfügbare Mittel Kategorie fehlt!');
        throw new Error("Kategorie 'Verfügbare Mittel' fehlt");
      }

      const cat = catStore.getCategoryById(added.categoryId);
      debugLog('[TransactionService]', 'Source Category details', {
        category: cat,
        isIncomeCategory: cat?.isIncomeCategory
      });

      if (cat?.isIncomeCategory) {
        debugLog('[TransactionService]', 'Executing Category Transfer', {
          from: added.categoryId,
          to: available.id,
          amount: added.amount,
          date: added.date
        });

        await this.addCategoryTransfer(
          added.categoryId,
          available.id,
          added.amount,
          added.date,
          'Automatischer Transfer von Einnahmen'
        );
      } else {
        debugLog('[TransactionService]', 'Category Transfer SKIPPED - Category is not income category');
      }
    } else {
      debugLog('[TransactionService]', 'Category Transfer SKIPPED - Conditions not met');
    }

    // POST-Stage Regeln anwenden (nach allen anderen Verarbeitungen)
    if (applyRules) {
      debugLog('[TransactionService]', 'Applying POST-stage rules after all processing');
      await ruleStore.applyRulesToTransaction(added, 'POST');
    }

    // Salden asynchron aktualisieren (non-blocking)
    setTimeout(() => {
      BalanceService.calculateMonthlyBalances().catch(error => {
        console.error('Background balance calculation failed:', error);
      });
    }, 0);

    // ENTFERNT: Redundanter Running Balance Aufruf
    // Die Berechnung erfolgt bereits oben über enqueueRunningBalanceRecalculation
    // Dieser doppelte Aufruf war die Ursache der Performance-Probleme
    // (Kommentar: Running Balance wird bereits oben in der optimierten Queue verarbeitet)

    return added;
  },

  /* -------------------- Konto‑zu‑Konto‑Transfer -------------------- */

  async addAccountTransfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    date: string,
    valueDate: string | null = null,
    note = '',
    planningTransactionId: string | null = null,
    recipientId?: string
  ) {
    if (fromAccountId === toAccountId) throw new Error('Quell = Zielkonto');
    if (amount === 0) throw new Error('Betrag 0');

    const accStore = useAccountStore();

    const fromName = accStore.getAccountById(fromAccountId)?.name ?? '';
    const toName = accStore.getAccountById(toAccountId)?.name ?? '';
    const dt = toDateOnlyString(date);
    // Validierung der valueDate - falls null/undefined oder ungültig, verwende date
    const validValueDate = valueDate && valueDate !== 'null' && valueDate !== 'undefined' ? valueDate : date;
    const vdt = toDateOnlyString(validValueDate);
    debugLog('[TransactionService]', 'addAccountTransfer - Calculated dates:', { date, valueDate, validValueDate, dt, vdt });
    const abs = Math.abs(amount);

    const base: Omit<Transaction, 'id' | 'runningBalance'> = {
      type: TransactionType.ACCOUNTTRANSFER,
      date: dt,
      valueDate: vdt,
      categoryId: undefined, // null zu undefined ändern
      tagIds: [],
      payee: '',
      note,
      counterTransactionId: null,
      planningTransactionId,
      isReconciliation: false,
      isCategoryTransfer: false,
      reconciled: false,
      transferToAccountId: undefined,
      accountId: '', // wird weiter unten gesetzt
      amount: 0,
      description: '', // Fehlende Eigenschaft hinzufügen
      recipientId, // recipientId hinzufügen
    };

    const fromTx = await this.addTransaction({
      ...base,
      accountId: fromAccountId,
      amount: -abs,
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Transfer zu ${toName}`,
      transferToAccountId: toAccountId,
    }, false); // Keine Regeln auf ACCOUNTTRANSFER anwenden
    const toTx = await this.addTransaction({
      ...base,
      accountId: toAccountId,
      amount: abs,
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Transfer von ${fromName}`,
      transferToAccountId: fromAccountId,
    }, false); // Keine Regeln auf ACCOUNTTRANSFER anwenden

    // Verlinken
    await this.updateTransaction(fromTx.id, { counterTransactionId: toTx.id });
    await this.updateTransaction(toTx.id, { counterTransactionId: fromTx.id });

    debugLog('[TransactionService]', 'addAccountTransfer completed', { fromTx, toTx });

    // Salden asynchron aktualisieren (non-blocking)
    setTimeout(() => {
      BalanceService.calculateMonthlyBalances().catch(error => {
        console.error('Background balance calculation failed:', error);
      });
    }, 0);

    // Running Balance Neuberechnung für beide Konten triggern (außer wenn deaktiviert, z.B. während CSV-Import)
    if (!this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(fromAccountId, vdt);
      BalanceService.triggerRunningBalanceRecalculation(toAccountId, vdt);
    }

    return { fromTransaction: fromTx, toTransaction: toTx };
  },

  /**
   * Aktualisiert einen Account Transfer und seine Gegenbuchung
   * Ermöglicht Betragsänderungen und Richtungsumkehr
   */
  async updateAccountTransfer(
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>
  ): Promise<boolean> {
    const txStore = useTransactionStore();
    const accStore = useAccountStore();

    const original = txStore.getTransactionById(id);
    if (!original || original.type !== TransactionType.ACCOUNTTRANSFER) {
      debugLog('[TransactionService]', 'updateAccountTransfer - Invalid transaction', { id, type: original?.type });
      return false;
    }

    // Finde die Gegenbuchung
    const counterTransaction = original.counterTransactionId
      ? txStore.getTransactionById(original.counterTransactionId)
      : null;

    if (!counterTransaction) {
      debugLog('[TransactionService]', 'updateAccountTransfer - Counter transaction not found', {
        id,
        counterTransactionId: original.counterTransactionId
      });
      return false;
    }

    debugLog('[TransactionService]', 'updateAccountTransfer - Processing', {
      originalId: id,
      counterId: counterTransaction.id,
      originalAmount: original.amount,
      newAmount: updates.amount,
      originalAccount: original.accountId,
      counterAccount: counterTransaction.accountId
    });

    // Berechne die neuen Beträge
    const newAmount = updates.amount !== undefined ? updates.amount : original.amount;
    const absNewAmount = Math.abs(newAmount);

    // Bestimme die Richtung basierend auf dem Vorzeichen des neuen Betrags
    const isReversed = (original.amount < 0 && newAmount > 0) || (original.amount > 0 && newAmount < 0);

    // Bestimme Quell- und Zielkonto basierend auf der neuen Richtung
    let fromAccountId: string, toAccountId: string;
    let fromAmount: number, toAmount: number;

    if (newAmount < 0) {
      // Negative Transaktion: aktuelles Konto ist Quellkonto
      fromAccountId = original.accountId;
      toAccountId = counterTransaction.accountId;
      fromAmount = -absNewAmount;
      toAmount = absNewAmount;
    } else {
      // Positive Transaktion: aktuelles Konto ist Zielkonto
      fromAccountId = counterTransaction.accountId;
      toAccountId = original.accountId;
      fromAmount = -absNewAmount;
      toAmount = absNewAmount;
    }

    const fromName = accStore.getAccountById(fromAccountId)?.name ?? '';
    const toName = accStore.getAccountById(toAccountId)?.name ?? '';

    // Bereite die Updates vor
    const dateUpdate = updates.date || original.date;
    const valueDateUpdate = updates.valueDate || original.valueDate || dateUpdate;
    const noteUpdate = updates.note !== undefined ? updates.note : original.note;
    const recipientIdUpdate = updates.recipientId !== undefined ? updates.recipientId : original.recipientId;

    // Update für die ursprüngliche Transaktion
    const originalUpdates: Partial<Transaction> = {
      amount: newAmount < 0 ? fromAmount : toAmount,
      accountId: newAmount < 0 ? fromAccountId : toAccountId,
      date: dateUpdate,
      valueDate: valueDateUpdate,
      note: noteUpdate,
      recipientId: recipientIdUpdate,
      payee: recipientIdUpdate
        ? this.resolvePayeeFromRecipient(recipientIdUpdate)
        : (newAmount < 0 ? `Transfer zu ${toName}` : `Transfer von ${fromName}`),
      transferToAccountId: newAmount < 0 ? toAccountId : fromAccountId,
    };

    // Update für die Gegenbuchung
    const counterUpdates: Partial<Transaction> = {
      amount: newAmount < 0 ? toAmount : fromAmount,
      accountId: newAmount < 0 ? toAccountId : fromAccountId,
      date: dateUpdate,
      valueDate: valueDateUpdate,
      note: noteUpdate,
      recipientId: recipientIdUpdate,
      payee: recipientIdUpdate
        ? this.resolvePayeeFromRecipient(recipientIdUpdate)
        : (newAmount < 0 ? `Transfer von ${fromName}` : `Transfer zu ${toName}`),
      transferToAccountId: newAmount < 0 ? fromAccountId : toAccountId,
    };

    debugLog('[TransactionService]', 'updateAccountTransfer - Applying updates', {
      originalUpdates,
      counterUpdates,
      isReversed
    });

    // Führe die Updates durch
    const originalSuccess = await txStore.updateTransaction(id, originalUpdates);
    const counterSuccess = await txStore.updateTransaction(counterTransaction.id, counterUpdates);

    if (!originalSuccess || !counterSuccess) {
      errorLog('[TransactionService]', 'updateAccountTransfer - Failed to update transactions', {
        originalSuccess,
        counterSuccess
      });
      return false;
    }

    // Salden asynchron aktualisieren (non-blocking)
    setTimeout(() => {
      BalanceService.calculateMonthlyBalances().catch(error => {
        console.error('Background balance calculation failed:', error);
      });
    }, 0);

    // Running Balance für beide betroffene Konten neu berechnen
    if (!this._skipRunningBalanceRecalc) {
      await BalanceService.recalculateRunningBalancesForAccount(fromAccountId);
      await BalanceService.recalculateRunningBalancesForAccount(toAccountId);

      BalanceService.triggerRunningBalanceRecalculation(fromAccountId, valueDateUpdate);
      BalanceService.triggerRunningBalanceRecalculation(toAccountId, valueDateUpdate);
    }

    infoLog('[TransactionService]', 'updateAccountTransfer completed', {
      originalId: id,
      counterId: counterTransaction.id,
      newAmount,
      fromAccount: fromAccountId,
      toAccount: toAccountId,
      isReversed
    });

    return true;
  },

  /* -------------------- Kategorie‑zu‑Kategorie‑Transfer -------------------- */

  async addCategoryTransfer(
    fromCategoryId: string,
    toCategoryId: string,
    amount: number,
    date: string,
    note: string = '',
    recipientId?: string
  ) {
    const categoryStore = useCategoryStore();
    const fromCategoryName = categoryStore.getCategoryById(fromCategoryId)?.name ?? '';
    const toCategoryName = categoryStore.getCategoryById(toCategoryId)?.name ?? '';
    const normalizedDate = toDateOnlyString(date);

    const fromTx = {
      type: TransactionType.CATEGORYTRANSFER,
      date: normalizedDate,
      valueDate: normalizedDate,
      accountId: '',
      categoryId: fromCategoryId,
      amount: -Math.abs(amount),
      tagIds: [],
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer zu ${toCategoryName}`,
      note,
      counterTransactionId: null,
      planningTransactionId: null,
      isReconciliation: false,
      isCategoryTransfer: true,
      toCategoryId: toCategoryId,
      reconciled: false,
      description: '', // Fehlende Eigenschaft hinzufügen
      recipientId, // recipientId hinzufügen
    };

    const toTx = {
      ...fromTx,
      categoryId: toCategoryId,
      amount: Math.abs(amount),
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer von ${fromCategoryName}`,
      toCategoryId: fromCategoryId,
    };

    const newFromTx = await this.addTransaction(fromTx as Omit<Transaction, 'id' | 'runningBalance'>, false); // Keine Regeln auf CATEGORYTRANSFER anwenden
    const newToTx = await this.addTransaction(toTx as Omit<Transaction, 'id' | 'runningBalance'>, false); // Keine Regeln auf CATEGORYTRANSFER anwenden

    await this.updateTransaction(newFromTx.id, { counterTransactionId: newToTx.id });
    await this.updateTransaction(newToTx.id, { counterTransactionId: newFromTx.id });

    debugLog('[TransactionService]', 'addCategoryTransfer completed', { fromTransaction: newFromTx, toTransaction: newToTx });

    // Salden asynchron aktualisieren (non-blocking)
    setTimeout(() => {
      BalanceService.calculateMonthlyBalances().catch(error => {
        console.error('Background balance calculation failed:', error);
      });
    }, 0);

    // Running Balance Neuberechnung triggern (Category Transfers haben keine accountId, daher nicht nötig)

    return { fromTransaction: newFromTx, toTransaction: newToTx };
  },

  async updateCategoryTransfer(
    transactionId: string,
    gegentransactionId: string,
    fromCategoryId: string,
    toCategoryId: string,
    amount: number,
    date: string,
    note: string = '',
    recipientId?: string
  ): Promise<boolean> {
    const txStore = useTransactionStore();
    const categoryStore = useCategoryStore();

    debugLog('[TransactionService]', 'updateCategoryTransfer started', {
      transactionId,
      gegentransactionId,
      fromCategoryId,
      toCategoryId,
      amount,
      date,
      note,
      recipientId
    });

    // Validierung der Eingabeparameter
    if (!transactionId || !gegentransactionId) {
      errorLog('[TransactionService]', 'updateCategoryTransfer - Missing transaction IDs', {
        transactionId,
        gegentransactionId
      });
      return false;
    }

    if (!fromCategoryId || !toCategoryId) {
      errorLog('[TransactionService]', 'updateCategoryTransfer - Missing category IDs', {
        fromCategoryId,
        toCategoryId
      });
      return false;
    }

    if (amount <= 0) {
      errorLog('[TransactionService]', 'updateCategoryTransfer - Invalid amount', { amount });
      return false;
    }

    // Prüfe ob beide Transaktionen existieren
    const fromTransaction = txStore.getTransactionById(transactionId);
    const toTransaction = txStore.getTransactionById(gegentransactionId);

    if (!fromTransaction || !toTransaction) {
      errorLog('[TransactionService]', 'updateCategoryTransfer - Transactions not found', {
        fromTransactionExists: !!fromTransaction,
        toTransactionExists: !!toTransaction
      });
      return false;
    }

    // Prüfe ob es sich um Category Transfers handelt
    if (fromTransaction.type !== TransactionType.CATEGORYTRANSFER ||
      toTransaction.type !== TransactionType.CATEGORYTRANSFER) {
      errorLog('[TransactionService]', 'updateCategoryTransfer - Invalid transaction types', {
        fromType: fromTransaction.type,
        toType: toTransaction.type
      });
      return false;
    }

    const fromCategoryName = categoryStore.getCategoryById(fromCategoryId)?.name ?? '';
    const toCategoryName = categoryStore.getCategoryById(toCategoryId)?.name ?? '';
    const normalizedDate = toDateOnlyString(date);

    const updatedFromTx: Partial<Transaction> = {
      categoryId: fromCategoryId,
      amount: -Math.abs(amount),
      toCategoryId: toCategoryId,
      date: normalizedDate,
      valueDate: normalizedDate,
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer zu ${toCategoryName}`,
      note,
      recipientId
    };

    const updatedToTx: Partial<Transaction> = {
      categoryId: toCategoryId,
      amount: Math.abs(amount),
      toCategoryId: fromCategoryId,
      date: normalizedDate,
      valueDate: normalizedDate,
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer von ${fromCategoryName}`,
      note,
      recipientId
    };

    try {
      // Führe beide Updates durch
      const fromUpdateSuccess = await this.updateTransaction(transactionId, updatedFromTx);
      const toUpdateSuccess = await this.updateTransaction(gegentransactionId, updatedToTx);

      if (!fromUpdateSuccess || !toUpdateSuccess) {
        errorLog('[TransactionService]', 'updateCategoryTransfer - Failed to update transactions', {
          fromUpdateSuccess,
          toUpdateSuccess
        });
        return false;
      }

      debugLog('[TransactionService]', 'updateCategoryTransfer completed successfully', {
        transactionId,
        gegentransactionId,
        updatedFromTx,
        updatedToTx
      });

      // Salden aktualisieren
      BalanceService.calculateMonthlyBalances();

      infoLog('[TransactionService]', 'Category transfer updated successfully', {
        fromCategory: fromCategoryName,
        toCategory: toCategoryName,
        amount,
        date: normalizedDate
      });

      return true;
    } catch (error) {
      errorLog('[TransactionService]', 'updateCategoryTransfer - Error during update', error);
      return false;
    }
  },

  getCategoryTransferOptions(
    monthStart: Date,
    monthEnd: Date
  ): Array<{ id: string; name: string; saldo: number }> {
    const categoryStore = useCategoryStore();

    return categoryStore.categories
      .filter(cat => cat.isActive)
      .map(cat => {
        // Saldo über BalanceService abfragen
        const saldo = BalanceService.getTodayBalance('category', cat.id, monthEnd);
        return {
          id: cat.id,
          name: cat.name,
          saldo: saldo
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Aktualisiert einen Category Transfer und seine Gegenbuchung
   * Ermöglicht Betragsänderungen und Richtungsumkehr
   */
  async updateCategoryTransferAmount(
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>
  ): Promise<boolean> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();

    const original = txStore.getTransactionById(id);
    if (!original || original.type !== TransactionType.CATEGORYTRANSFER) {
      debugLog('[TransactionService]', 'updateCategoryTransferAmount - Invalid transaction', { id, type: original?.type });
      return false;
    }

    // Finde die Gegenbuchung
    const counterTransaction = original.counterTransactionId
      ? txStore.getTransactionById(original.counterTransactionId)
      : null;

    if (!counterTransaction) {
      debugLog('[TransactionService]', 'updateCategoryTransferAmount - Counter transaction not found', {
        id,
        counterTransactionId: original.counterTransactionId
      });
      return false;
    }

    debugLog('[TransactionService]', 'updateCategoryTransferAmount - Processing', {
      originalId: id,
      counterId: counterTransaction.id,
      originalAmount: original.amount,
      newAmount: updates.amount,
      originalCategory: original.categoryId,
      counterCategory: counterTransaction.categoryId
    });

    // Berechne die neuen Beträge
    const newAmount = updates.amount !== undefined ? updates.amount : original.amount;
    const absNewAmount = Math.abs(newAmount);

    // Bestimme die Richtung basierend auf dem Vorzeichen des neuen Betrags
    const isReversed = (original.amount < 0 && newAmount > 0) || (original.amount > 0 && newAmount < 0);

    // Bestimme Quell- und Zielkategorie basierend auf der neuen Richtung
    let fromCategoryId: string, toCategoryId: string;
    let fromAmount: number, toAmount: number;

    if (newAmount < 0) {
      // Negative Transaktion: aktuelle Kategorie ist Quellkategorie
      fromCategoryId = original.categoryId!;
      toCategoryId = counterTransaction.categoryId!;
      fromAmount = -absNewAmount;
      toAmount = absNewAmount;
    } else {
      // Positive Transaktion: aktuelle Kategorie ist Zielkategorie
      fromCategoryId = counterTransaction.categoryId!;
      toCategoryId = original.categoryId!;
      fromAmount = -absNewAmount;
      toAmount = absNewAmount;
    }

    const fromName = catStore.getCategoryById(fromCategoryId)?.name ?? '';
    const toName = catStore.getCategoryById(toCategoryId)?.name ?? '';

    // Bereite die Updates vor
    const dateUpdate = updates.date || original.date;
    const valueDateUpdate = updates.valueDate || original.valueDate || dateUpdate;
    const noteUpdate = updates.note !== undefined ? updates.note : original.note;
    const recipientIdUpdate = updates.recipientId !== undefined ? updates.recipientId : original.recipientId;

    // Update für die ursprüngliche Transaktion
    const originalUpdates: Partial<Transaction> = {
      amount: newAmount < 0 ? fromAmount : toAmount,
      categoryId: newAmount < 0 ? fromCategoryId : toCategoryId,
      date: dateUpdate,
      valueDate: valueDateUpdate,
      note: noteUpdate,
      recipientId: recipientIdUpdate,
      payee: recipientIdUpdate
        ? this.resolvePayeeFromRecipient(recipientIdUpdate)
        : (newAmount < 0 ? `Kategorientransfer zu ${toName}` : `Kategorientransfer von ${fromName}`),
      toCategoryId: newAmount < 0 ? toCategoryId : fromCategoryId,
    };

    // Update für die Gegenbuchung
    const counterUpdates: Partial<Transaction> = {
      amount: newAmount < 0 ? toAmount : fromAmount,
      categoryId: newAmount < 0 ? toCategoryId : fromCategoryId,
      date: dateUpdate,
      valueDate: valueDateUpdate,
      note: noteUpdate,
      recipientId: recipientIdUpdate,
      payee: recipientIdUpdate
        ? this.resolvePayeeFromRecipient(recipientIdUpdate)
        : (newAmount < 0 ? `Kategorientransfer von ${fromName}` : `Kategorientransfer zu ${toName}`),
      toCategoryId: newAmount < 0 ? fromCategoryId : toCategoryId,
    };

    debugLog('[TransactionService]', 'updateCategoryTransferAmount - Applying updates', {
      originalUpdates,
      counterUpdates,
      isReversed
    });

    // Führe die Updates durch
    const originalSuccess = await txStore.updateTransaction(id, originalUpdates);
    const counterSuccess = await txStore.updateTransaction(counterTransaction.id, counterUpdates);

    if (!originalSuccess || !counterSuccess) {
      errorLog('[TransactionService]', 'updateCategoryTransferAmount - Failed to update transactions', {
        originalSuccess,
        counterSuccess
      });
      return false;
    }

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    infoLog('[TransactionService]', 'updateCategoryTransferAmount completed', {
      originalId: id,
      counterId: counterTransaction.id,
      newAmount,
      fromCategory: fromCategoryId,
      toCategory: toCategoryId,
      isReversed
    });

    return true;
  },

  /* --------------------- Ausgleichs‑Buchung ------------------------ */

  async addReconcileTransaction(
    accountId: string,
    amount: number,
    date: string,
    note = '',
    recipientId?: string
  ) {
    if (amount === 0) return null;
    const catStore = useCategoryStore();

    const catId =
      catStore.categories.find(c => c.name === 'Ausgleichskorrekturen')?.id ??
      null;

    const tx = await this.addTransaction({
      type: TransactionType.RECONCILE,
      date: toDateOnlyString(date),
      valueDate: toDateOnlyString(date),
      accountId,
      categoryId: catId || undefined,
      amount,
      tagIds: [],
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : 'Kontoabgleich',
      note: note || (amount > 0 ? 'Korrektur Gutschrift' : 'Korrektur Belastung'),
      counterTransactionId: null,
      planningTransactionId: null,
      isReconciliation: true,
      isCategoryTransfer: false,
      reconciled: true,
      description: '', // Fehlende Eigenschaft hinzufügen
      recipientId, // recipientId hinzufügen
    }, true); // Regeln anwenden

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern
    if (tx && tx.accountId && !this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(tx.accountId, tx.valueDate || tx.date);
    }

    return tx;
  },

  /* ------------------------- Update / Delete ----------------------- */

  /**
   * Löscht eine einzelne Transaktion ohne die Gegenbuchung zu beeinträchtigen
   * Wird für die Transfer-Konvertierung verwendet
   */
  async deleteSingleTransaction(id: string): Promise<boolean> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();

    const tx = txStore.getTransactionById(id);
    if (!tx) return false;

    debugLog('[TransactionService]', `Lösche einzelne Transaktion: ${tx.description} (${tx.amount}€) vom ${tx.date} für Konto ${tx.accountId}`);

    // Einnahme‑Löschung → Mittel zurück transferieren (nur wenn es keine Transfer-Konvertierung ist)
    if (
      tx.type === TransactionType.INCOME &&
      tx.amount > 0 &&
      tx.categoryId
    ) {
      const available = catStore.getAvailableFundsCategory();
      if (!available) throw new Error("Kategorie 'Verfügbare Mittel' fehlt");

      const cat = catStore.getCategoryById(tx.categoryId);
      if (cat?.isIncomeCategory) {
        await this.addCategoryTransfer(
          available.id,
          tx.categoryId,
          tx.amount,
          tx.date,
          'Automatischer Transfer bei Löschung der Einnahme'
        );
      }
    }

    // Lösche nur diese eine Transaktion, NICHT die Gegenbuchung
    const okPrimary = await txStore.deleteTransaction(id);
    if (!okPrimary) return false;

    // WICHTIG: MonthlyBalance-Cache invalidieren BEVOR Running Balance neu berechnet wird
    debugLog('[TransactionService]', `Invalidiere MonthlyBalance-Cache nach Löschung von Transaktion ${id}`);
    BalanceService.calculateMonthlyBalances();

    // WICHTIG: Running Balance für betroffenes Konto neu berechnen
    if (tx.accountId && !this._skipRunningBalanceRecalc) {
      debugLog('[TransactionService]', `Triggere Running Balance Neuberechnung für Konto ${tx.accountId} nach Löschung von Transaktion ${id}`);

      await BalanceService.recalculateRunningBalancesForAccount(tx.accountId);

      infoLog('[TransactionService]', `Running Balance für Konto ${tx.accountId} nach Löschung neu berechnet`);
    }

    return true;
  },

  /**
   * Konvertiert eine Transferbuchung zu einer normalen Expense/Income-Buchung
   * Löscht die Gegenbuchung und konvertiert die ursprüngliche Transaktion
   */
  async convertTransferToNormalTransaction(
    transactionId: string,
    counterTransactionId: string,
    newType: TransactionType.EXPENSE | TransactionType.INCOME,
    updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>
  ): Promise<boolean> {
    const txStore = useTransactionStore();

    debugLog('[TransactionService]', 'convertTransferToNormalTransaction started', {
      transactionId,
      counterTransactionId,
      newType,
      updates
    });

    try {
      // 1. Hole beide Transaktionen
      const originalTx = txStore.getTransactionById(transactionId);
      const counterTx = txStore.getTransactionById(counterTransactionId);

      if (!originalTx || !counterTx) {
        errorLog('[TransactionService]', 'convertTransferToNormalTransaction - Transactions not found', {
          originalTxExists: !!originalTx,
          counterTxExists: !!counterTx
        });
        return false;
      }

      // 2. Sammle betroffene Konten für Saldo-Neuberechnung
      const affectedAccountIds = new Set<string>();
      if (originalTx.accountId) affectedAccountIds.add(originalTx.accountId);
      if (counterTx.accountId) affectedAccountIds.add(counterTx.accountId);

      // 3. Konvertiere zuerst die ursprüngliche Transaktion (bevor wir die Gegenbuchung löschen)
      const conversionUpdates: Partial<Transaction> = {
        ...updates,
        type: newType,
        counterTransactionId: null,
        transferToAccountId: undefined,
        isCategoryTransfer: false,
        // Stelle sicher, dass categoryId und andere Felder für normale Buchungen gesetzt sind
        categoryId: updates.categoryId || undefined,
        tagIds: updates.tagIds || [],
        recipientId: updates.recipientId || undefined
      };

      debugLog('[TransactionService]', 'convertTransferToNormalTransaction - Converting original transaction', {
        transactionId,
        conversionUpdates
      });

      const updateSuccess = await txStore.updateTransaction(transactionId, conversionUpdates);
      if (!updateSuccess) {
        errorLog('[TransactionService]', 'convertTransferToNormalTransaction - Failed to update original transaction', {
          transactionId,
          conversionUpdates
        });
        return false;
      }

      // 4. Lösche nur die Gegenbuchung (mit der speziellen Methode, die keine Gegenbuchung löscht)
      debugLog('[TransactionService]', 'convertTransferToNormalTransaction - Deleting counter transaction only', {
        counterTransactionId
      });

      const counterDeleteSuccess = await this.deleteSingleTransaction(counterTransactionId);
      if (!counterDeleteSuccess) {
        errorLog('[TransactionService]', 'convertTransferToNormalTransaction - Failed to delete counter transaction', {
          counterTransactionId
        });
        return false;
      }

      // 5. Salden für alle betroffenen Konten neu berechnen
      BalanceService.calculateMonthlyBalances();

      if (!this._skipRunningBalanceRecalc) {
        for (const accountId of affectedAccountIds) {
          await BalanceService.recalculateRunningBalancesForAccount(accountId);
          BalanceService.triggerRunningBalanceRecalculation(accountId, updates.valueDate || updates.date || originalTx.date);
        }
      }

      infoLog('[TransactionService]', 'convertTransferToNormalTransaction completed successfully', {
        transactionId,
        counterTransactionId,
        newType,
        affectedAccounts: Array.from(affectedAccountIds)
      });

      return true;

    } catch (error) {
      errorLog('[TransactionService]', 'convertTransferToNormalTransaction - Error during conversion', {
        transactionId,
        counterTransactionId,
        newType,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  },

  async updateTransaction(
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>
  ): Promise<boolean> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();

    if (updates.date) updates.date = toDateOnlyString(updates.date);
    if (updates.valueDate) updates.valueDate = toDateOnlyString(updates.valueDate);

    // Wenn recipientId in den Updates enthalten ist, leite payee ab
    if (updates.recipientId !== undefined) {
      updates.payee = this.resolvePayeeFromRecipient(updates.recipientId, updates.payee);
    }

    const original = txStore.getTransactionById(id);
    if (!original) {
      debugLog('[TransactionService]', `updateTransaction - Transaction not found: ${id}`);
      return false;
    }

    // Prüfe auf bewusste Kategorie-Entfernung vs. automatische Zuweisung
    let isIntentionalCategoryRemoval = false;
    if (updates.categoryId === undefined && original.categoryId) {
      // Kategorie wird explizit auf undefined gesetzt - das ist eine bewusste Entfernung
      isIntentionalCategoryRemoval = true;
      debugLog('[TransactionService]', 'updateTransaction - Intentional category removal detected', {
        transactionId: id,
        originalCategoryId: original.categoryId
      });
    } else if (!updates.categoryId && !original.categoryId) {
      // Weder Update noch Original haben eine Kategorie - automatische Zuweisung prüfen
      const updatedTxData = { ...original, ...updates };
      const txDataWithDefaultCategory = this.assignDefaultCategoryIfNeeded(
        updatedTxData,
        updatedTxData.isReconciliation || false,
        false
      );

      // Wenn eine Kategorie automatisch zugewiesen wurde, füge sie zu den Updates hinzu
      if (txDataWithDefaultCategory.categoryId && !updates.categoryId) {
        updates.categoryId = txDataWithDefaultCategory.categoryId;
        debugLog('[TransactionService]', 'updateTransaction - Automatic category assignment applied', {
          transactionId: id,
          assignedCategoryId: txDataWithDefaultCategory.categoryId
        });
      }
    }

    // Prüfe auf Transfer-Konvertierung
    if ((updates as any).isTransferConversion &&
      (updates as any).originalCounterTransactionId &&
      original.type === TransactionType.ACCOUNTTRANSFER &&
      (updates.type === TransactionType.EXPENSE || updates.type === TransactionType.INCOME)) {

      debugLog('[TransactionService]', 'Transfer-Konvertierung erkannt', {
        transactionId: id,
        originalType: original.type,
        newType: updates.type,
        counterTransactionId: (updates as any).originalCounterTransactionId
      });

      // Entferne die speziellen Flags aus den Updates
      const cleanUpdates = { ...updates };
      delete (cleanUpdates as any).isTransferConversion;
      delete (cleanUpdates as any).originalCounterTransactionId;
      delete (cleanUpdates as any).originalTransferToAccountId;

      // Verwende die spezielle Konvertierungsmethode
      return await this.convertTransferToNormalTransaction(
        id,
        (updates as any).originalCounterTransactionId,
        updates.type as TransactionType.EXPENSE | TransactionType.INCOME,
        cleanUpdates
      );
    }

    debugLog('[TransactionService]', `Aktualisiere Transaktion: ${original.description} (${original.amount}€) für Konto ${original.accountId}`);

    // ACCOUNTTRANSFER-spezifische Logik für Betragsänderungen
    if (original.type === TransactionType.ACCOUNTTRANSFER && updates.amount !== undefined && updates.amount !== original.amount) {
      return await this.updateAccountTransfer(id, updates);
    }

    // CATEGORYTRANSFER-spezifische Logik für Betragsänderungen
    if (original.type === TransactionType.CATEGORYTRANSFER && updates.amount !== undefined && updates.amount !== original.amount) {
      return await this.updateCategoryTransferAmount(id, updates);
    }

    // Für andere Updates bei ACCOUNTTRANSFER (ohne Betragsänderung) - normale Verarbeitung
    if (original.type === TransactionType.ACCOUNTTRANSFER && original.counterTransactionId) {
      // Synchronisiere bestimmte Felder mit der Gegenbuchung
      const counterTransaction = txStore.getTransactionById(original.counterTransactionId);
      if (counterTransaction) {
        const counterUpdates: Partial<Transaction> = {};

        // Synchronisiere Datum, Wertstellungsdatum, Notiz und Reconciliation-Status
        if (updates.date !== undefined) counterUpdates.date = updates.date;
        if (updates.valueDate !== undefined) counterUpdates.valueDate = updates.valueDate;
        if (updates.note !== undefined) counterUpdates.note = updates.note;
        if (updates.reconciled !== undefined) counterUpdates.reconciled = updates.reconciled;
        if (updates.recipientId !== undefined) {
          counterUpdates.recipientId = updates.recipientId;
          counterUpdates.payee = this.resolvePayeeFromRecipient(updates.recipientId);
        }

        // Aktualisiere die Gegenbuchung, falls notwendig
        if (Object.keys(counterUpdates).length > 0) {
          await txStore.updateTransaction(original.counterTransactionId, counterUpdates);
        }
      }
    }

    // Für andere Updates bei CATEGORYTRANSFER (ohne Betragsänderung) - normale Verarbeitung
    if (original.type === TransactionType.CATEGORYTRANSFER && original.counterTransactionId) {
      // Synchronisiere bestimmte Felder mit der Gegenbuchung
      const counterTransaction = txStore.getTransactionById(original.counterTransactionId);
      if (counterTransaction) {
        const counterUpdates: Partial<Transaction> = {};

        // Synchronisiere Datum, Wertstellungsdatum, Notiz und Reconciliation-Status
        if (updates.date !== undefined) counterUpdates.date = updates.date;
        if (updates.valueDate !== undefined) counterUpdates.valueDate = updates.valueDate;
        if (updates.note !== undefined) counterUpdates.note = updates.note;
        if (updates.reconciled !== undefined) counterUpdates.reconciled = updates.reconciled;
        if (updates.recipientId !== undefined) {
          counterUpdates.recipientId = updates.recipientId;
          counterUpdates.payee = this.resolvePayeeFromRecipient(updates.recipientId);
        }

        // Aktualisiere die Gegenbuchung, falls notwendig
        if (Object.keys(counterUpdates).length > 0) {
          await txStore.updateTransaction(original.counterTransactionId, counterUpdates);
        }
      }
    }

    // Datums­wechsel bei Einnahmen → Category‑Transfer umbuchen
    const originalMonthKey = original?.date?.substring(0, 7);
    const newDateAfterUpdate = updates.date ?? original?.date ?? '';
    const newMonthKey = newDateAfterUpdate.substring(0, 7);

    if (
      original &&
      original.type === TransactionType.INCOME &&
      original.amount > 0 &&
      original.categoryId &&
      originalMonthKey !== newMonthKey
    ) {
      const available = catStore.getAvailableFundsCategory();
      if (!available) throw new Error("Kategorie 'Verfügbare Mittel' fehlt");

      const cat = catStore.getCategoryById(original.categoryId);
      if (cat?.isIncomeCategory) {
        // Rücktransfer (alte Buchung rückgängig machen)
        await this.addCategoryTransfer(
          available.id,
          original.categoryId,
          original.amount,
          original.date,
          'Automatischer Rücktransfer wegen Datumsänderung'
        );

        // Neuer Transfer am neuen Datum
        await this.addCategoryTransfer(
          original.categoryId,
          available.id,
          original.amount,
          newDateAfterUpdate,
          'Automatischer Transfer wegen Datumsänderung'
        );
      }
    }

    const ok = await txStore.updateTransaction(id, updates);
    if (!ok) return false;

    /* Auto‑Transfer bei INCOME‑Diff (bestehend) --------------------------- */
    if (
      original &&
      original.type === TransactionType.INCOME &&
      updates.amount !== undefined
    ) {
      const diff = updates.amount - original.amount;
      if (diff !== 0 && original.categoryId) {
        const available = catStore.getAvailableFundsCategory();
        if (!available) throw new Error("Kategorie 'Verfügbare Mittel' fehlt");

        const cat = catStore.getCategoryById(original.categoryId);
        if (cat?.isIncomeCategory) {
          await this.addCategoryTransfer(
            diff > 0 ? original.categoryId : available.id,
            diff > 0 ? available.id : original.categoryId,
            Math.abs(diff),
            updates.date ?? original.date,
            'Automatischer Transfer bei Betragsanpassung'
          );
        }
      }
    }

    /* Auto‑Transfer bei INCOME‑Kategoriewechsel von Ausgabe zu Einnahme --------------------------- */
    if (
      original &&
      original.type === TransactionType.INCOME &&
      original.amount > 0 &&
      updates.categoryId !== undefined &&
      updates.categoryId !== original.categoryId
    ) {
      const oldCategory = original.categoryId ? catStore.getCategoryById(original.categoryId) : null;
      const newCategory = catStore.getCategoryById(updates.categoryId);

      debugLog('[TransactionService]', 'Category change detected for INCOME transaction', {
        transactionId: id,
        oldCategoryId: original.categoryId,
        newCategoryId: updates.categoryId,
        oldCategoryIsIncome: oldCategory?.isIncomeCategory,
        newCategoryIsIncome: newCategory?.isIncomeCategory
      });

      // Prüfe: War alte Kategorie eine Ausgabenkategorie und neue ist Einnahmenkategorie?
      if (
        oldCategory && !oldCategory.isIncomeCategory &&
        newCategory && newCategory.isIncomeCategory
      ) {
        const available = catStore.getAvailableFundsCategory();
        if (!available) throw new Error("Kategorie 'Verfügbare Mittel' fehlt");

        debugLog('[TransactionService]', 'Executing Category Transfer for category change from expense to income', {
          from: updates.categoryId,
          to: available.id,
          amount: original.amount,
          date: updates.date ?? original.date
        });

        await this.addCategoryTransfer(
          updates.categoryId,
          available.id,
          original.amount,
          updates.date ?? original.date,
          'Automatischer Transfer bei Kategoriewechsel von Ausgabe zu Einnahme'
        );

        infoLog('[TransactionService]', `Automatischer Kategorietransfer erstellt: ${original.amount}€ von ${newCategory.name} zu Verfügbare Mittel`);
      }
    }

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // WICHTIG: Running Balance für betroffenes Konto neu berechnen
    const updatedTx = txStore.getTransactionById(id);
    if (updatedTx && updatedTx.accountId && !this._skipRunningBalanceRecalc) {
      debugLog('[TransactionService]', `Triggere Running Balance Neuberechnung für Konto ${updatedTx.accountId} nach Update von Transaktion ${id}`);

      await BalanceService.recalculateRunningBalancesForAccount(updatedTx.accountId);

      infoLog('[TransactionService]', `Running Balance für Konto ${updatedTx.accountId} nach Update neu berechnet`);
    }

    return true;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();

    const tx = txStore.getTransactionById(id);
    if (!tx) return false;

    debugLog('[TransactionService]', `Lösche Transaktion: ${tx.description} (${tx.amount}€) vom ${tx.date} für Konto ${tx.accountId}`);

    // Einnahme‑Löschung → Mittel zurück transferieren
    if (
      tx.type === TransactionType.INCOME &&
      tx.amount > 0 &&
      tx.categoryId
    ) {
      const available = catStore.getAvailableFundsCategory();
      if (!available) throw new Error("Kategorie 'Verfügbare Mittel' fehlt");

      const cat = catStore.getCategoryById(tx.categoryId);
      if (cat?.isIncomeCategory) {
        await this.addCategoryTransfer(
          available.id,
          tx.categoryId,
          tx.amount,
          tx.date,
          'Automatischer Transfer bei Löschung der Einnahme'
        );
      }
    }

    const okPrimary = await txStore.deleteTransaction(id);
    if (!okPrimary) return false;

    if (tx.counterTransactionId)
      await txStore.deleteTransaction(tx.counterTransactionId);

    // WICHTIG: MonthlyBalance-Cache invalidieren BEVOR Running Balance neu berechnet wird
    debugLog('[TransactionService]', `Invalidiere MonthlyBalance-Cache nach Löschung von Transaktion ${id}`);
    await BalanceService.calculateMonthlyBalances();

    // WICHTIG: Running Balance für betroffenes Konto neu berechnen
    if (tx.accountId && !this._skipRunningBalanceRecalc) {
      debugLog('[TransactionService]', `Triggere Running Balance Neuberechnung für Konto ${tx.accountId} nach Löschung von Transaktion ${id}`);

      await BalanceService.recalculateRunningBalancesForAccount(tx.accountId);

      infoLog('[TransactionService]', `Running Balance für Konto ${tx.accountId} nach Löschung neu berechnet`);
    }

    return true;
  },

  /**
   * Performante Bulk-Löschung von Transaktionen
   * Bündelt alle Löschungen und führt Balance-Neuberechnung nur einmal pro betroffenem Konto aus
   */
  async bulkDeleteTransactions(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();
    const unique = [...new Set(ids)];

    if (unique.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    debugLog('[TransactionService]', 'bulkDeleteTransactions started', { requestedCount: unique.length });

    // 1. Alle zu löschenden Transaktionen sammeln (inkl. Counter-Transaktionen)
    const transactionsToDelete = new Set<string>();
    const affectedAccountIds = new Set<string>();
    const incomeTransfersToCreate: Array<{
      fromCategoryId: string;
      toCategoryId: string;
      amount: number;
      date: string;
      note: string;
    }> = [];

    // 2. Für jede ID prüfen und Counter-Transaktionen hinzufügen
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        debugLog('[TransactionService]', 'bulkDeleteTransactions - Transaction not found', { id });
        continue;
      }

      transactionsToDelete.add(id);

      // Betroffene Konten sammeln
      if (tx.accountId) {
        affectedAccountIds.add(tx.accountId);
      }

      // Counter-Transaktion hinzufügen (für TRANSFER-Typen)
      if (tx.counterTransactionId) {
        const counterTx = txStore.getTransactionById(tx.counterTransactionId);
        if (counterTx) {
          transactionsToDelete.add(tx.counterTransactionId);
          if (counterTx.accountId) {
            affectedAccountIds.add(counterTx.accountId);
          }
        }
      }

      // Einnahme-Transfer vorbereiten (für INCOME-Transaktionen)
      if (
        tx.type === TransactionType.INCOME &&
        tx.amount > 0 &&
        tx.categoryId
      ) {
        const available = catStore.getAvailableFundsCategory();
        if (!available) {
          throw new Error("Kategorie 'Verfügbare Mittel' fehlt");
        }

        const cat = catStore.getCategoryById(tx.categoryId);
        if (cat?.isIncomeCategory) {
          incomeTransfersToCreate.push({
            fromCategoryId: available.id,
            toCategoryId: tx.categoryId,
            amount: tx.amount,
            date: tx.date,
            note: 'Automatischer Transfer bei Löschung der Einnahme'
          });
        }
      }
    }

    debugLog('[TransactionService]', 'bulkDeleteTransactions - Analysis completed', {
      transactionsToDelete: transactionsToDelete.size,
      affectedAccounts: affectedAccountIds.size,
      incomeTransfers: incomeTransfersToCreate.length
    });

    // 3. Batch-Löschung durchführen
    let deletedCount = 0;
    for (const id of transactionsToDelete) {
      if (await txStore.deleteTransaction(id)) {
        deletedCount++;
      }
    }

    // 4. Einnahme-Transfers erstellen
    for (const transfer of incomeTransfersToCreate) {
      try {
        await this.addCategoryTransfer(
          transfer.fromCategoryId,
          transfer.toCategoryId,
          transfer.amount,
          transfer.date,
          transfer.note
        );
      } catch (error) {
        debugLog('[TransactionService]', 'bulkDeleteTransactions - Error creating income transfer', {
          transfer,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const success = deletedCount === transactionsToDelete.size;

    debugLog('[TransactionService]', 'bulkDeleteTransactions completed', {
      requested: unique.length,
      transactionsToDelete: transactionsToDelete.size,
      deleted: deletedCount,
      success,
      affectedAccounts: Array.from(affectedAccountIds)
    });

    // 5. Balance-Neuberechnung nur einmal pro Konto
    await BalanceService.calculateMonthlyBalances();

    if (!this._skipRunningBalanceRecalc) {
      for (const accountId of affectedAccountIds) {
        BalanceService.triggerRunningBalanceRecalculation(accountId);
      }
    }

    return { success, deletedCount };
  },

  deleteMultipleTransactions(ids: string[]) {
    return this.bulkDeleteTransactions(ids);
  },

  /**
   * Performante Bulk-Kontozuweisung für Transaktionen
   * Ändert das Konto für alle übergebenen Transaktionen
   * Bei ACCOUNTTRANSFERS wird das Quellkonto geändert und die Gegenbuchung entsprechend angepasst
   */
  async bulkAssignAccount(transactionIds: string[], newAccountId: string): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const accountStore = useAccountStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Validiere das Zielkonto
    const targetAccount = accountStore.getAccountById(newAccountId);
    if (!targetAccount) {
      const error = `Zielkonto mit ID ${newAccountId} nicht gefunden`;
      errorLog('[TransactionService]', 'bulkAssignAccount - Invalid target account', { newAccountId });
      return { success: false, updatedCount: 0, errors: [error] };
    }

    debugLog('[TransactionService]', 'bulkAssignAccount started', {
      requestedCount: unique.length,
      newAccountId,
      targetAccountName: targetAccount.name
    });

    // Sammle alle zu ändernden Transaktionen (ohne CATEGORYTRANSFER und ACCOUNTTRANSFER)
    const transactionsToUpdate = new Map<string, {
      transaction: Transaction;
      newAccountId: string;
    }>();
    const affectedAccountIds = new Set<string>();

    // 1. Analysiere alle Transaktionen und filtere ungeeignete Typen aus
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkAssignAccount - Transaction not found', { id });
        continue;
      }

      // Schließe CATEGORYTRANSFER und ACCOUNTTRANSFER aus, da bei diesen nicht in der Gegenbuchung mitverankert werden soll
      if (tx.type === TransactionType.CATEGORYTRANSFER || tx.type === TransactionType.ACCOUNTTRANSFER) {
        debugLog('[TransactionService]', `Skipping transaction ${id} - Type ${tx.type} excluded from bulk account assignment`, {
          transactionId: id,
          type: tx.type
        });
        continue;
      }

      // Sammle betroffene Konten für Balance-Neuberechnung
      if (tx.accountId) {
        affectedAccountIds.add(tx.accountId);
      }
      affectedAccountIds.add(newAccountId);

      // Normale Transaktionen (INCOME, EXPENSE, RECONCILE)
      transactionsToUpdate.set(id, {
        transaction: tx,
        newAccountId: newAccountId
      });
    }

    debugLog('[TransactionService]', 'bulkAssignAccount - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      affectedAccounts: affectedAccountIds.size,
      skippedTransfers: unique.length - transactionsToUpdate.size,
      eligibleTypes: Array.from(transactionsToUpdate.values()).map(item => item.transaction.type)
    });

    // 2. Batch-Update durchführen
    let updatedCount = 0;
    for (const [transactionId, updateInfo] of transactionsToUpdate) {
      try {
        const { transaction, newAccountId: targetAccountId } = updateInfo;
        const updates: Partial<Transaction> = {
          accountId: targetAccountId
        };

        // Transaktion aktualisieren
        const success = await this.updateTransaction(transactionId, updates);
        if (success) {
          updatedCount++;
          debugLog('[TransactionService]', `Transaction ${transactionId} successfully updated`, {
            transactionId,
            oldAccountId: transaction.accountId,
            newAccountId: targetAccountId,
            type: transaction.type
          });
        } else {
          const error = `Fehler beim Aktualisieren der Transaktion ${transactionId}`;
          errors.push(error);
          warnLog('[TransactionService]', error, { transactionId, targetAccountId });
        }
      } catch (error) {
        const errorMsg = `Fehler beim Aktualisieren der Transaktion ${transactionId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorLog('[TransactionService]', errorMsg, {
          transactionId,
          error,
          updateInfo
        });
      }
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkAssignAccount completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      affectedAccounts: Array.from(affectedAccountIds),
      targetAccount: targetAccount.name
    });

    // 3. Balance-Neuberechnung für alle betroffenen Konten
    BalanceService.calculateMonthlyBalances();

    if (!this._skipRunningBalanceRecalc) {
      for (const accountId of affectedAccountIds) {
        BalanceService.triggerRunningBalanceRecalculation(accountId);
      }
    }

    if (success) {
      infoLog('[TransactionService]', `Bulk-Kontozuweisung erfolgreich abgeschlossen: ${updatedCount} Transaktionen zu Konto "${targetAccount.name}" zugewiesen`);
    } else {
      warnLog('[TransactionService]', `Bulk-Kontozuweisung mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  },

  /**
   * Performante Bulk-Kategorienzuweisung für Transaktionen
   * Ändert die Kategorie für alle übergebenen Transaktionen
   * Bei CATEGORYTRANSFERS wird sowohl die Quell- als auch die Zielkategorie in der Gegenbuchung korrigiert
   */
  async bulkAssignCategory(transactionIds: string[], newCategoryId: string | null): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const categoryStore = useCategoryStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Validiere die Zielkategorie (falls nicht null für "alle entfernen")
    let targetCategory = null;
    if (newCategoryId) {
      targetCategory = categoryStore.getCategoryById(newCategoryId);
      if (!targetCategory) {
        const error = `Zielkategorie mit ID ${newCategoryId} nicht gefunden`;
        errorLog('[TransactionService]', 'bulkAssignCategory - Invalid target category', { newCategoryId });
        return { success: false, updatedCount: 0, errors: [error] };
      }
    }

    debugLog('[TransactionService]', 'bulkAssignCategory started', {
      requestedCount: unique.length,
      newCategoryId,
      targetCategoryName: targetCategory?.name || 'Kategorie entfernen'
    });

    // Sammle alle zu ändernden Transaktionen und ihre Counter-Transaktionen
    const transactionsToUpdate = new Map<string, {
      transaction: Transaction;
      newCategoryId: string | null;
      isCounterTransaction?: boolean;
      originalTransactionId?: string;
    }>();
    const processedCounterTransactions = new Set<string>();

    // 1. Analysiere alle Transaktionen
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkAssignCategory - Transaction not found', { id });
        continue;
      }

      // Spezielle Behandlung für CATEGORYTRANSFER
      if (tx.type === TransactionType.CATEGORYTRANSFER) {
        // Haupttransaktion (Quellkategorie ändern)
        transactionsToUpdate.set(id, {
          transaction: tx,
          newCategoryId: newCategoryId
        });

        // Counter-Transaktion behandeln (Zielkategorie anpassen)
        if (tx.counterTransactionId && !processedCounterTransactions.has(tx.counterTransactionId)) {
          const counterTx = txStore.getTransactionById(tx.counterTransactionId);
          if (counterTx) {
            // Bei Counter-Transaktion: toCategoryId auf die neue Quellkategorie setzen
            transactionsToUpdate.set(tx.counterTransactionId, {
              transaction: counterTx,
              newCategoryId: counterTx.categoryId || null, // Kategorie der Counter-Transaktion bleibt gleich
              isCounterTransaction: true,
              originalTransactionId: id
            });

            processedCounterTransactions.add(tx.counterTransactionId);
          }
        }
      } else {
        // Normale Transaktionen (INCOME, EXPENSE, RECONCILE, ACCOUNTTRANSFER)
        transactionsToUpdate.set(id, {
          transaction: tx,
          newCategoryId: newCategoryId
        });
      }
    }

    debugLog('[TransactionService]', 'bulkAssignCategory - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      categoryTransfers: Array.from(transactionsToUpdate.values()).filter(item =>
        item.transaction.type === TransactionType.CATEGORYTRANSFER
      ).length
    });

    // 2. Batch-Update durchführen
    let updatedCount = 0;
    for (const [transactionId, updateInfo] of transactionsToUpdate) {
      try {
        const { transaction, newCategoryId: targetCategoryId, isCounterTransaction, originalTransactionId } = updateInfo;
        const updates: Partial<Transaction> = {
          categoryId: targetCategoryId || undefined
        };

        // Spezielle Behandlung für CATEGORYTRANSFER Counter-Transaktionen
        if (isCounterTransaction && transaction.type === TransactionType.CATEGORYTRANSFER && originalTransactionId) {
          // Für Counter-Transaktion: toCategoryId auf die neue Quellkategorie setzen
          updates.toCategoryId = targetCategoryId || undefined;

          // Payee aktualisieren
          if (targetCategoryId) {
            const newSourceCategory = categoryStore.getCategoryById(targetCategoryId);
            updates.payee = `Kategorientransfer von ${newSourceCategory?.name || 'Unbekannte Kategorie'}`;
          } else {
            updates.payee = 'Kategorientransfer von entfernter Kategorie';
          }
        } else if (transaction.type === TransactionType.CATEGORYTRANSFER && !isCounterTransaction) {
          // Für Haupt-CATEGORYTRANSFER: toCategoryId bleibt unverändert, aber Payee aktualisieren
          if (transaction.toCategoryId) {
            const targetCat = categoryStore.getCategoryById(transaction.toCategoryId);
            if (targetCategoryId) {
              // Neue Quellkategorie gesetzt
              updates.payee = `Kategorientransfer zu ${targetCat?.name || 'Unbekannte Kategorie'}`;
            } else {
              // Quellkategorie entfernt
              updates.payee = `Kategorientransfer zu ${targetCat?.name || 'Unbekannte Kategorie'}`;
            }
          }
        }

        // Transaktion aktualisieren
        const success = await this.updateTransaction(transactionId, updates);
        if (success) {
          updatedCount++;
          debugLog('[TransactionService]', `Transaction ${transactionId} successfully updated`, {
            transactionId,
            oldCategoryId: transaction.categoryId,
            newCategoryId: targetCategoryId,
            type: transaction.type,
            isCounterTransaction: isCounterTransaction || false
          });
        } else {
          const error = `Fehler beim Aktualisieren der Transaktion ${transactionId}`;
          errors.push(error);
          warnLog('[TransactionService]', error, { transactionId, targetCategoryId });
        }
      } catch (error) {
        const errorMsg = `Fehler beim Aktualisieren der Transaktion ${transactionId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorLog('[TransactionService]', errorMsg, {
          transactionId,
          error,
          updateInfo
        });
      }
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkAssignCategory completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      targetCategory: targetCategory?.name || 'Kategorie entfernen'
    });

    if (success) {
      infoLog('[TransactionService]', `Bulk-Kategorienzuweisung erfolgreich abgeschlossen: ${updatedCount} Transaktionen zu Kategorie "${targetCategory?.name || 'entfernt'}" zugewiesen`);
    } else {
      warnLog('[TransactionService]', `Bulk-Kategorienzuweisung mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  },

  /**
   * Performante Bulk-Empfänger-Änderung für Transaktionen
   * Ändert den Empfänger für alle übergebenen Transaktionen
   * CATEGORYTRANSFER und ACCOUNTTRANSFER werden ausgeschlossen, da sie keine Recipients haben
   */
  async bulkChangeRecipient(transactionIds: string[], newRecipientId: string | null, removeAll: boolean = false): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const recipientStore = useRecipientStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Validiere den Ziel-Empfänger (falls nicht null für "alle entfernen")
    let targetRecipient = null;
    if (newRecipientId && !removeAll) {
      targetRecipient = recipientStore.getRecipientById(newRecipientId);
      if (!targetRecipient) {
        const error = `Ziel-Empfänger mit ID ${newRecipientId} nicht gefunden`;
        errorLog('[TransactionService]', 'bulkChangeRecipient - Invalid target recipient', { newRecipientId });
        return { success: false, updatedCount: 0, errors: [error] };
      }
    }

    debugLog('[TransactionService]', 'bulkChangeRecipient started', {
      requestedCount: unique.length,
      newRecipientId,
      removeAll,
      targetRecipientName: targetRecipient?.name || (removeAll ? 'Alle Empfänger entfernen' : 'Empfänger entfernen')
    });

    // Sammle alle zu ändernden Transaktionen (ohne CATEGORYTRANSFER und ACCOUNTTRANSFER)
    const transactionsToUpdate = new Map<string, {
      transaction: Transaction;
      newRecipientId: string | null;
    }>();

    // 1. Analysiere alle Transaktionen und filtere ungeeignete Typen aus
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkChangeRecipient - Transaction not found', { id });
        continue;
      }

      // Schließe CATEGORYTRANSFER und ACCOUNTTRANSFER aus, da sie keine Recipients haben
      if (tx.type === TransactionType.CATEGORYTRANSFER || tx.type === TransactionType.ACCOUNTTRANSFER) {
        debugLog('[TransactionService]', `Skipping transaction ${id} - Type ${tx.type} does not support recipients`, {
          transactionId: id,
          type: tx.type
        });
        continue;
      }

      // Normale Transaktionen (INCOME, EXPENSE, RECONCILE)
      transactionsToUpdate.set(id, {
        transaction: tx,
        newRecipientId: removeAll ? null : newRecipientId
      });
    }

    debugLog('[TransactionService]', 'bulkChangeRecipient - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      skippedTransfers: unique.length - transactionsToUpdate.size,
      eligibleTypes: Array.from(transactionsToUpdate.values()).map(item => item.transaction.type)
    });

    // 2. Batch-Update durchführen
    let updatedCount = 0;
    for (const [transactionId, updateInfo] of transactionsToUpdate) {
      try {
        const { transaction, newRecipientId: targetRecipientId } = updateInfo;
        const updates: Partial<Transaction> = {
          recipientId: targetRecipientId || undefined
        };

        // Payee aktualisieren basierend auf dem neuen Empfänger
        if (targetRecipientId && targetRecipient) {
          updates.payee = targetRecipient.name;
        } else {
          // Empfänger entfernt - payee leeren oder auf Standardwert setzen
          updates.payee = '';
        }

        // Transaktion aktualisieren
        const success = await this.updateTransaction(transactionId, updates);
        if (success) {
          updatedCount++;
          debugLog('[TransactionService]', `Transaction ${transactionId} successfully updated`, {
            transactionId,
            oldRecipientId: transaction.recipientId,
            newRecipientId: targetRecipientId,
            type: transaction.type,
            newPayee: updates.payee
          });
        } else {
          const error = `Fehler beim Aktualisieren der Transaktion ${transactionId}`;
          errors.push(error);
          warnLog('[TransactionService]', error, { transactionId, targetRecipientId });
        }
      } catch (error) {
        const errorMsg = `Fehler beim Aktualisieren der Transaktion ${transactionId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorLog('[TransactionService]', errorMsg, {
          transactionId,
          error,
          updateInfo
        });
      }
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkChangeRecipient completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      targetRecipient: targetRecipient?.name || (removeAll ? 'Alle entfernt' : 'Empfänger entfernt')
    });

    // 3. Balance-Neuberechnung (nicht nötig für Empfänger-Änderungen, aber für Konsistenz)
    BalanceService.calculateMonthlyBalances();

    if (success) {
      const actionText = removeAll ? 'entfernt' : (targetRecipient ? `zu "${targetRecipient.name}" geändert` : 'entfernt');
      infoLog('[TransactionService]', `Bulk-Empfänger-Änderung erfolgreich abgeschlossen: ${updatedCount} Transaktionen ${actionText}`);
    } else {
      warnLog('[TransactionService]', `Bulk-Empfänger-Änderung mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  },

  /**
   * Performante Bulk-Tag-Zuweisung für Transaktionen
   * Fügt Tags zu allen übergebenen Transaktionen hinzu oder entfernt alle Tags
   * Bestehende Tags bleiben erhalten und werden erweitert
   * CATEGORYTRANSFER und ACCOUNTTRANSFER werden ausgeschlossen
   */
  async bulkAssignTags(transactionIds: string[], tagIds: string[] | null, removeAll: boolean = false): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const tagStore = useTagStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Validiere die Ziel-Tags (falls nicht null für "alle entfernen")
    let targetTags: string[] = [];
    if (tagIds && !removeAll) {
      for (const tagId of tagIds) {
        const tag = tagStore.getTagById(tagId);
        if (!tag) {
          const error = `Tag mit ID ${tagId} nicht gefunden`;
          errorLog('[TransactionService]', 'bulkAssignTags - Invalid target tag', { tagId });
          errors.push(error);
        } else {
          targetTags.push(tagId);
        }
      }

      if (errors.length > 0) {
        return { success: false, updatedCount: 0, errors };
      }
    }

    debugLog('[TransactionService]', 'bulkAssignTags started', {
      requestedCount: unique.length,
      tagIds,
      removeAll,
      targetTagsCount: targetTags.length
    });

    // Sammle alle zu ändernden Transaktionen (ohne CATEGORYTRANSFER und ACCOUNTTRANSFER)
    const transactionsToUpdate = new Map<string, {
      transaction: Transaction;
      newTagIds: string[];
    }>();

    // 1. Analysiere alle Transaktionen und filtere ungeeignete Typen aus
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkAssignTags - Transaction not found', { id });
        continue;
      }

      // Schließe CATEGORYTRANSFER und ACCOUNTTRANSFER aus
      if (tx.type === TransactionType.CATEGORYTRANSFER || tx.type === TransactionType.ACCOUNTTRANSFER) {
        debugLog('[TransactionService]', `Skipping transaction ${id} - Type ${tx.type} does not support tag assignment`, {
          transactionId: id,
          type: tx.type
        });
        continue;
      }

      // Bestimme neue Tag-IDs
      let newTagIds: string[];
      if (removeAll) {
        newTagIds = [];
      } else if (tagIds && tagIds.length > 0) {
        // Neue Tags zu bestehenden Tags hinzufügen (anhängen statt ersetzen)
        const existingTagIds = tx.tagIds || [];
        const combinedTagIds = [...existingTagIds, ...targetTags];
        // Duplikate entfernen
        newTagIds = [...new Set(combinedTagIds)];
      } else {
        // Keine Änderung
        newTagIds = tx.tagIds || [];
      }

      // Normale Transaktionen (INCOME, EXPENSE, RECONCILE)
      transactionsToUpdate.set(id, {
        transaction: tx,
        newTagIds: newTagIds
      });
    }

    debugLog('[TransactionService]', 'bulkAssignTags - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      skippedTransfers: unique.length - transactionsToUpdate.size,
      eligibleTypes: Array.from(transactionsToUpdate.values()).map(item => item.transaction.type)
    });

    // 2. Batch-Update durchführen
    let updatedCount = 0;
    for (const [transactionId, updateInfo] of transactionsToUpdate) {
      try {
        const { transaction, newTagIds } = updateInfo;
        const updates: Partial<Transaction> = {
          tagIds: newTagIds
        };

        // Transaktion aktualisieren
        const success = await this.updateTransaction(transactionId, updates);
        if (success) {
          updatedCount++;
          debugLog('[TransactionService]', `Transaction ${transactionId} successfully updated`, {
            transactionId,
            oldTagIds: transaction.tagIds,
            newTagIds: newTagIds,
            type: transaction.type
          });
        } else {
          const error = `Fehler beim Aktualisieren der Transaktion ${transactionId}`;
          errors.push(error);
          warnLog('[TransactionService]', error, { transactionId, newTagIds });
        }
      } catch (error) {
        const errorMsg = `Fehler beim Aktualisieren der Transaktion ${transactionId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorLog('[TransactionService]', errorMsg, {
          transactionId,
          error,
          updateInfo
        });
      }
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkAssignTags completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      actionType: removeAll ? 'remove_all' : (targetTags.length > 0 ? 'assign_tags' : 'no_change')
    });

    // 3. Balance-Neuberechnung (nicht nötig für Tag-Änderungen, aber für Konsistenz)
    BalanceService.calculateMonthlyBalances();

    if (success) {
      const actionText = removeAll ? 'entfernt' : (targetTags.length > 0 ? `${targetTags.length} Tags zugewiesen` : 'keine Änderung');
      infoLog('[TransactionService]', `Bulk-Tag-Zuweisung erfolgreich abgeschlossen: ${updatedCount} Transaktionen ${actionText}`);
    } else {
      warnLog('[TransactionService]', `Bulk-Tag-Zuweisung mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  },

  /**
   * Berechnet Einnahmen und Ausgaben für einen bestimmten Zeitraum über alle Konten
   * Berücksichtigt ausschließlich INCOME und EXPENSE Transaktionen
   */
  getIncomeExpenseSummary(startDate: string, endDate: string): { income: number; expense: number; balance: number } {
    // Batch-Mode-Caching: Verhindert redundante Berechnungen während Initial Data Load
    const cacheKey = `incomeExpenseSummary_${startDate}_${endDate}`;
    if (this._isBatchMode && this._batchModeCache.has(cacheKey)) {
      debugLog('[TransactionService]', 'getIncomeExpenseSummary (CACHED)', { startDate, endDate });
      return this._batchModeCache.get(cacheKey);
    }

    const txStore = useTransactionStore();
    const transactions = txStore.transactions;

    // Datumsgrenzen normalisieren
    const start = new Date(startDate);
    const end = new Date(endDate);

    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.date);

      // Prüfe ob Transaktion im Zeitraum liegt
      if (txDate < start || txDate > end) {
        return;
      }

      // Berücksichtige nur INCOME und EXPENSE Transaktionen
      switch (tx.type) {
        case TransactionType.INCOME:
          // Einnahmen sind immer positiv
          if (tx.amount > 0) {
            income += tx.amount;
          }
          break;

        case TransactionType.EXPENSE:
          // Ausgaben sind immer negativ, daher Absolutwert nehmen
          if (tx.amount < 0) {
            expense += Math.abs(tx.amount);
          }
          break;

        // Alle anderen Transaktionstypen werden ignoriert:
        // - ACCOUNTTRANSFER: Interne Verschiebungen zwischen Konten
        // - CATEGORYTRANSFER: Interne Verschiebungen zwischen Kategorien
        // - RECONCILE: Kontoabstimmungen
        default:
          // Ignoriere alle anderen Transaktionstypen
          break;
      }
    });

    const balance = income - expense;
    const result = { income, expense, balance };

    // Cache-Ergebnis im Batch-Mode
    if (this._isBatchMode) {
      this._batchModeCache.set(cacheKey, result);
    }

    debugLog('[TransactionService]', 'getIncomeExpenseSummary', {
      startDate,
      endDate,
      transactionCount: transactions.length,
      filteredTransactions: transactions.filter(tx =>
        tx.type === TransactionType.INCOME || tx.type === TransactionType.EXPENSE
      ).length,
      income,
      expense,
      balance,
      cached: this._isBatchMode ? 'CACHED' : 'CALCULATED'
    });

    return result;
  },

  /**
   * Berechnet monatliche Trends für Ein- und Ausgaben über mehrere Monate
   * Nutzt die robuste getIncomeExpenseSummary Methode für konsistente Berechnungen
   */
  getMonthlyTrend(months: number = 6): Array<{
    month: string;
    monthKey: string;
    income: number;
    expense: number;
    balance: number;
    trend: 'up' | 'down' | 'neutral';
  }> {
    // Batch-Mode-Caching: Verhindert redundante Berechnungen während Initial Data Load
    const cacheKey = `monthlyTrend_${months}`;
    if (this._isBatchMode && this._batchModeCache.has(cacheKey)) {
      debugLog('[TransactionService]', 'getMonthlyTrend (CACHED)', { months });
      return this._batchModeCache.get(cacheKey);
    }

    const result = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      // Berechne Start- und Enddatum für den Monat
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

      const startDateStr = startOfMonth.toISOString().split('T')[0];
      const endDateStr = endOfMonth.toISOString().split('T')[0];

      // Nutze die bestehende getIncomeExpenseSummary Methode
      const summary = this.getIncomeExpenseSummary(startDateStr, endDateStr);

      // Formatiere Monatsnamen
      const monthName = monthDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric'
      });

      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      result.push({
        month: monthName,
        monthKey,
        income: summary.income,
        expense: summary.expense,
        balance: summary.balance,
        trend: 'neutral' as 'up' | 'down' | 'neutral' // Wird später berechnet
      });
    }

    // Berechne Trends basierend auf der Bilanz des Vormonats
    // Verwende einen gleitenden Durchschnitt für robustere Trend-Erkennung
    for (let i = 0; i < result.length; i++) {
      if (i === 0) {
        // Für den ersten Monat: Vergleiche mit 0 oder setze neutral
        const currentBalance = result[i].balance;
        if (currentBalance > 50) { // Schwellwert für "deutlich positiv"
          result[i].trend = 'up';
        } else if (currentBalance < -50) { // Schwellwert für "deutlich negativ"
          result[i].trend = 'down';
        } else {
          result[i].trend = 'neutral';
        }
      } else {
        // Für alle anderen Monate: Vergleiche mit Vormonat
        const currentBalance = result[i].balance;
        const previousBalance = result[i - 1].balance;
        const difference = currentBalance - previousBalance;

        // Verwende einen Schwellwert um kleine Schwankungen zu ignorieren
        const threshold = 10; // 10€ Schwellwert

        if (difference > threshold) {
          result[i].trend = 'up';
        } else if (difference < -threshold) {
          result[i].trend = 'down';
        } else {
          result[i].trend = 'neutral';
        }
      }
    }

    // Cache-Ergebnis im Batch-Mode
    if (this._isBatchMode) {
      this._batchModeCache.set(cacheKey, result);
    }

    debugLog('[TransactionService]', 'getMonthlyTrend', {
      months,
      resultCount: result.length,
      totalIncome: result.reduce((sum, month) => sum + month.income, 0),
      totalExpense: result.reduce((sum, month) => sum + month.expense, 0),
      cached: this._isBatchMode ? 'CACHED' : 'CALCULATED',
      result
    });

    return result;
  },

  /**
   * Intelligente Verarbeitung von Transaktionen beim Initial Data Load
   * Business Logic: Verarbeitet nur neue oder geänderte Transaktionen basierend auf LWW-Prinzip
   * Optimiert mit Bulk-Operationen für maximale Performance
   */
  async processTransactionsIntelligently(
    incomingTransactions: any[]
  ): Promise<{ processed: number; skipped: number; updated: number }> {
    if (!incomingTransactions || incomingTransactions.length === 0) {
      debugLog('[TransactionService]', 'processTransactionsIntelligently: Keine Transaktionen zu verarbeiten');
      return { processed: 0, skipped: 0, updated: 0 };
    }

    const transactionStore = useTransactionStore();
    const tenantDbService = new TenantDbService();

    try {
      // Aktiviere Batch-Modus für bessere Performance
      this.startBatchMode();
      transactionStore.startBatchUpdate();

      // Verwende die neue intelligente Bulk-Operation für maximale Performance
      const result = await tenantDbService.addTransactionsBatchIntelligent(incomingTransactions);

      // Lade den Store neu, aber nur wenn tatsächlich Änderungen vorgenommen wurden
      if (result.updated > 0) {
        await transactionStore.loadTransactions();
      }

      infoLog('[TransactionService]', `Intelligente Bulk-Transaktionsverarbeitung abgeschlossen: ${result.updated} aktualisiert, ${result.skipped} übersprungen von ${incomingTransactions.length} Transaktionen`);

      return {
        processed: result.updated, // Neue Transaktionen sind in "updated" enthalten
        skipped: result.skipped,
        updated: result.updated
      };

    } catch (error) {
      errorLog('[TransactionService]', 'Fehler bei intelligenter Bulk-Transaktionsverarbeitung', {
        error: error instanceof Error ? error.message : String(error),
        transactionCount: incomingTransactions.length
      });
      throw error;
    } finally {
      // Deaktiviere Batch-Modi
      this.endBatchMode();
      transactionStore.endBatchUpdate();
    }
  },

  /**
   * Wendet PRE und DEFAULT Stage Regeln auf eine Liste von Transaktionen an
   * Speziell für CSV-Import optimiert - alle Regeln außer POST werden vor dem Speichern angewendet
   */
  async applyPreAndDefaultRulesToTransactions(transactions: any[]): Promise<any[]> {
    const ruleStore = useRuleStore();
    let processedTransactions = [...transactions];

    debugLog('[TransactionService]', `Applying PRE and DEFAULT stage rules to ${transactions.length} transactions`);

    // Erst PRE-Stage Regeln anwenden
    for (let i = 0; i < processedTransactions.length; i++) {
      try {
        processedTransactions[i] = await ruleStore.applyRulesToTransaction(processedTransactions[i], 'PRE');
        debugLog('[TransactionService]', `PRE-stage rules applied to transaction ${processedTransactions[i].id}`);
      } catch (error) {
        errorLog('[TransactionService]', `Error applying PRE-stage rules to transaction ${processedTransactions[i].id}`, error);
      }
    }

    // Dann DEFAULT-Stage Regeln anwenden
    for (let i = 0; i < processedTransactions.length; i++) {
      try {
        processedTransactions[i] = await ruleStore.applyRulesToTransaction(processedTransactions[i], 'DEFAULT');
        debugLog('[TransactionService]', `DEFAULT-stage rules applied to transaction ${processedTransactions[i].id}`);
      } catch (error) {
        errorLog('[TransactionService]', `Error applying DEFAULT-stage rules to transaction ${processedTransactions[i].id}`, error);
      }
    }

    debugLog('[TransactionService]', `PRE and DEFAULT stage rules applied to ${processedTransactions.length} transactions`);
    return processedTransactions;
  },

  /**
   * Wendet POST-Stage Regeln auf gespeicherte Transaktionen an
   * Wird nach dem Speichern und Running Balance Berechnung aufgerufen
   */
  async applyPostStageRulesToTransactions(transactionIds: string[]): Promise<void> {
    const ruleStore = useRuleStore();
    const txStore = useTransactionStore();

    debugLog('[TransactionService]', `Applying POST-stage rules to ${transactionIds.length} saved transactions`);

    for (const transactionId of transactionIds) {
      try {
        const transaction = txStore.getTransactionById(transactionId);
        if (transaction) {
          await ruleStore.applyRulesToTransaction(transaction, 'POST');
          debugLog('[TransactionService]', `POST-stage rules applied to transaction ${transactionId}`);
        } else {
          warnLog('[TransactionService]', `Transaction ${transactionId} not found for POST-stage rules`);
        }
      } catch (error) {
        errorLog('[TransactionService]', `Error applying POST-stage rules to transaction ${transactionId}`, error);
      }
    }

    debugLog('[TransactionService]', `POST-stage rules applied to ${transactionIds.length} transactions`);
  },

  /**
   * Aktualisiert Recipient-Referenzen in allen betroffenen Transactions
   * Wird vom recipientStore bei Merge-Operationen aufgerufen
   */
  async updateRecipientReferences(
    oldRecipientIds: string[],
    newRecipientId: string
  ) {
    try {
      debugLog('[TransactionService]', 'updateRecipientReferences gestartet', {
        oldRecipientIds,
        newRecipientId,
        count: oldRecipientIds.length
      });

      // Dynamischer Import des transactionStore
      const { useTransactionStore } = await import('@/stores/transactionStore');
      const transactionStore = useTransactionStore();

      // Finde alle Transactions mit den alten Recipient-IDs
      const affectedTransactions = transactionStore.transactions.filter(transaction =>
        transaction.recipientId && oldRecipientIds.includes(transaction.recipientId)
      );

      if (affectedTransactions.length === 0) {
        infoLog('[TransactionService]', 'updateRecipientReferences: Keine betroffenen Transactions gefunden', {
          oldRecipientIds
        });
        return;
      }

      infoLog('[TransactionService]', `updateRecipientReferences: ${affectedTransactions.length} Transactions gefunden für Update`, {
        transactionIds: affectedTransactions.map(t => t.id),
        oldRecipientIds,
        newRecipientId
      });

      // Batch-Verarbeitung für Performance
      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ transactionId: string; error: any }> = [];

      for (const transaction of affectedTransactions) {
        try {
          const oldRecipientId = transaction.recipientId;

          // Aktualisiere die Transaction über den Store für konsistente Sync-Integration
          const success = await transactionStore.updateTransaction(transaction.id, {
            recipientId: newRecipientId,
            updated_at: new Date().toISOString()
          });

          if (success) {
            successCount++;
            debugLog('[TransactionService]', `Transaction ${transaction.id} erfolgreich aktualisiert`, {
              transactionId: transaction.id,
              oldRecipientId,
              newRecipientId,
              description: transaction.description
            });
          } else {
            errorCount++;
            warnLog('[TransactionService]', `Transaction ${transaction.id} konnte nicht aktualisiert werden`, {
              transactionId: transaction.id,
              oldRecipientId,
              newRecipientId
            });
          }
        } catch (error) {
          errorCount++;
          errors.push({ transactionId: transaction.id, error });
          errorLog('[TransactionService]', `Fehler beim Aktualisieren von Transaction ${transaction.id}`, {
            transactionId: transaction.id,
            error,
            oldRecipientId: transaction.recipientId,
            newRecipientId
          });
        }
      }

      // Zusammenfassung der Batch-Operation
      if (successCount > 0) {
        infoLog('[TransactionService]', `updateRecipientReferences erfolgreich abgeschlossen`, {
          totalTransactions: affectedTransactions.length,
          successCount,
          errorCount,
          oldRecipientIds,
          newRecipientId
        });
      }

      if (errorCount > 0) {
        warnLog('[TransactionService]', `updateRecipientReferences mit Fehlern abgeschlossen`, {
          totalTransactions: affectedTransactions.length,
          successCount,
          errorCount,
          errors: errors.map(e => ({ transactionId: e.transactionId, error: e.error?.message || 'Unknown error' }))
        });
      }

      // Bei kritischen Fehlern (alle Transactions fehlgeschlagen) werfen wir einen Fehler
      if (errorCount === affectedTransactions.length && affectedTransactions.length > 0) {
        throw new Error(`Alle ${affectedTransactions.length} Transaction-Updates fehlgeschlagen`);
      }

    } catch (error) {
      errorLog('[TransactionService]', 'Kritischer Fehler in updateRecipientReferences', {
        oldRecipientIds,
        newRecipientId,
        error
      });
      throw error;
    }
  },

  /* ------------------------------------------------------------------ */
  /* ---------------------- Recipient Validation APIs ---------------- */
  /* ------------------------------------------------------------------ */

  /**
   * Validiert die Löschung von Recipients durch Prüfung auf aktive Referenzen in Transactions
   * @param recipientIds Array der zu validierenden Recipient-IDs
   * @returns Promise<RecipientValidationResult[]> Validierungsergebnisse pro Recipient
   */
  async validateRecipientDeletion(recipientIds: string[]): Promise<RecipientValidationResult[]> {
    try {
      debugLog('[TransactionService]', 'validateRecipientDeletion gestartet', {
        recipientIds,
        count: recipientIds.length
      });

      const recipientStore = useRecipientStore();
      const results: RecipientValidationResult[] = [];

      for (const recipientId of recipientIds) {
        const recipient = recipientStore.getRecipientById(recipientId);
        const recipientName = recipient?.name || `Unbekannter Empfänger (${recipientId})`;

        // Zähle Transactions mit diesem Recipient
        const transactionCount = await this.countTransactionsWithRecipient(recipientId);

        // Bestimme ob Löschung möglich ist
        const hasActiveReferences = transactionCount > 0;
        const canDelete = !hasActiveReferences; // Aktuell: Keine Löschung wenn Referenzen vorhanden

        // Erstelle Warnungen basierend auf gefundenen Referenzen
        const warnings: string[] = [];
        if (transactionCount > 0) {
          warnings.push(`${transactionCount} Transaktion${transactionCount === 1 ? '' : 'en'} verwenden diesen Empfänger`);
        }

        const validationResult: RecipientValidationResult = {
          recipientId,
          recipientName,
          hasActiveReferences,
          transactionCount,
          planningTransactionCount: 0, // Wird in Subtask 4.3 implementiert
          automationRuleCount: 0, // Wird in späteren Subtasks implementiert
          canDelete,
          warnings
        };

        results.push(validationResult);

        debugLog('[TransactionService]', `Recipient ${recipientId} validiert`, {
          recipientName,
          transactionCount,
          hasActiveReferences,
          canDelete,
          warnings
        });
      }

      infoLog('[TransactionService]', `validateRecipientDeletion abgeschlossen für ${recipientIds.length} Recipients`, {
        totalRecipients: results.length,
        canDeleteCount: results.filter(r => r.canDelete).length,
        hasReferencesCount: results.filter(r => r.hasActiveReferences).length,
        totalTransactionReferences: results.reduce((sum, r) => sum + r.transactionCount, 0)
      });

      return results;

    } catch (error) {
      errorLog('[TransactionService]', 'Fehler bei validateRecipientDeletion', {
        recipientIds,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  },

  /**
   * Findet alle Transactions die einen bestimmten Recipient referenzieren
   * Sucht sowohl in recipientId als auch im payee-Feld (String-Match)
   * @param recipientId Die zu suchende Recipient-ID
   * @returns Promise<Transaction[]> Array der gefundenen Transactions
   */
  async getTransactionsWithRecipient(recipientId: string): Promise<Transaction[]> {
    try {
      debugLog('[TransactionService]', 'getTransactionsWithRecipient gestartet', { recipientId });

      const txStore = useTransactionStore();
      const recipientStore = useRecipientStore();

      // Hole Recipient-Name für Payee-String-Matching
      const recipient = recipientStore.getRecipientById(recipientId);
      const recipientName = recipient?.name;

      const matchingTransactions = txStore.transactions.filter(transaction => {
        // Direkte Recipient-ID-Referenz
        if (transaction.recipientId === recipientId) {
          return true;
        }

        // Payee-String-Match (falls Recipient-Name verfügbar)
        if (recipientName && transaction.payee) {
          // Exakter Match (case-insensitive)
          if (transaction.payee.toLowerCase() === recipientName.toLowerCase()) {
            return true;
          }

          // Enthält-Match für flexiblere Suche
          if (transaction.payee.toLowerCase().includes(recipientName.toLowerCase())) {
            return true;
          }
        }

        return false;
      });

      debugLog('[TransactionService]', `getTransactionsWithRecipient gefunden: ${matchingTransactions.length} Transactions`, {
        recipientId,
        recipientName,
        transactionIds: matchingTransactions.map(t => t.id),
        directMatches: matchingTransactions.filter(t => t.recipientId === recipientId).length,
        payeeMatches: matchingTransactions.filter(t => t.recipientId !== recipientId).length
      });

      return matchingTransactions;

    } catch (error) {
      errorLog('[TransactionService]', 'Fehler bei getTransactionsWithRecipient', {
        recipientId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  },

  /**
   * Zählt die Anzahl der Transactions die einen bestimmten Recipient referenzieren
   * Optimierte Version von getTransactionsWithRecipient für reine Zählung
   * @param recipientId Die zu suchende Recipient-ID
   * @returns Promise<number> Anzahl der gefundenen Transactions
   */
  async countTransactionsWithRecipient(recipientId: string): Promise<number> {
    try {
      debugLog('[TransactionService]', 'countTransactionsWithRecipient gestartet', { recipientId });

      const txStore = useTransactionStore();
      const recipientStore = useRecipientStore();

      // Hole Recipient-Name für Payee-String-Matching
      const recipient = recipientStore.getRecipientById(recipientId);
      const recipientName = recipient?.name;

      let count = 0;
      let directMatches = 0;
      let payeeMatches = 0;

      for (const transaction of txStore.transactions) {
        let isMatch = false;

        // Direkte Recipient-ID-Referenz
        if (transaction.recipientId === recipientId) {
          directMatches++;
          isMatch = true;
        }
        // Payee-String-Match (falls Recipient-Name verfügbar und noch kein direkter Match)
        else if (recipientName && transaction.payee) {
          // Exakter Match (case-insensitive)
          if (transaction.payee.toLowerCase() === recipientName.toLowerCase()) {
            payeeMatches++;
            isMatch = true;
          }
          // Enthält-Match für flexiblere Suche
          else if (transaction.payee.toLowerCase().includes(recipientName.toLowerCase())) {
            payeeMatches++;
            isMatch = true;
          }
        }

        if (isMatch) {
          count++;
        }
      }

      debugLog('[TransactionService]', `countTransactionsWithRecipient Ergebnis: ${count} Transactions`, {
        recipientId,
        recipientName,
        totalCount: count,
        directMatches,
        payeeMatches,
        totalTransactions: txStore.transactions.length
      });

      return count;

    } catch (error) {
      errorLog('[TransactionService]', 'Fehler bei countTransactionsWithRecipient', {
        recipientId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  },

  /**
   * Performante Bulk-Datumsänderung für Transaktionen
   * Ändert das Datum und valueDate für alle übergebenen Transaktionen
   * Bei CATEGORYTRANSFERS und ACCOUNTTRANSFERS wird nicht in der Gegenbuchung mitverankert
   */
  async bulkChangeDate(transactionIds: string[], newDate: string): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    // Validiere das neue Datum
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) {
      const error = `Ungültiges Datumsformat: ${newDate}. Erwartet: YYYY-MM-DD`;
      errorLog('[TransactionService]', 'bulkChangeDate - Invalid date format', { newDate });
      return { success: false, updatedCount: 0, errors: [error] };
    }

    debugLog('[TransactionService]', 'bulkChangeDate started', {
      requestedCount: unique.length,
      newDate
    });

    // Sammle alle zu ändernden Transaktionen (ohne CATEGORYTRANSFER und ACCOUNTTRANSFER)
    const transactionsToUpdate = new Map<string, {
      transaction: Transaction;
      newDate: string;
    }>();
    const affectedAccountIds = new Set<string>();

    // 1. Analysiere alle Transaktionen und filtere ungeeignete Typen aus
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkChangeDate - Transaction not found', { id });
        continue;
      }

      // Schließe CATEGORYTRANSFER und ACCOUNTTRANSFER aus, da bei diesen nicht in der Gegenbuchung mitverankert werden soll
      if (tx.type === TransactionType.CATEGORYTRANSFER || tx.type === TransactionType.ACCOUNTTRANSFER) {
        debugLog('[TransactionService]', `Skipping transaction ${id} - Type ${tx.type} excluded from bulk date change`, {
          transactionId: id,
          type: tx.type
        });
        continue;
      }

      // Sammle betroffene Konten für Balance-Neuberechnung
      if (tx.accountId) {
        affectedAccountIds.add(tx.accountId);
      }

      // Normale Transaktionen (INCOME, EXPENSE, RECONCILE)
      transactionsToUpdate.set(id, {
        transaction: tx,
        newDate: newDate
      });
    }

    debugLog('[TransactionService]', 'bulkChangeDate - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      affectedAccounts: affectedAccountIds.size,
      skippedTransfers: unique.length - transactionsToUpdate.size,
      eligibleTypes: Array.from(transactionsToUpdate.values()).map(item => item.transaction.type)
    });

    // 2. Batch-Update durchführen
    let updatedCount = 0;
    for (const [transactionId, updateInfo] of transactionsToUpdate) {
      try {
        const { transaction, newDate: targetDate } = updateInfo;
        const updates: Partial<Transaction> = {
          date: targetDate,
          valueDate: targetDate // valueDate wird auf das ausgewählte Datum umgestellt
        };

        // Transaktion aktualisieren
        const success = await this.updateTransaction(transactionId, updates);
        if (success) {
          updatedCount++;
          debugLog('[TransactionService]', `Transaction ${transactionId} successfully updated`, {
            transactionId,
            oldDate: transaction.date,
            oldValueDate: transaction.valueDate,
            newDate: targetDate,
            type: transaction.type
          });
        } else {
          const error = `Fehler beim Aktualisieren der Transaktion ${transactionId}`;
          errors.push(error);
          warnLog('[TransactionService]', error, { transactionId, targetDate });
        }
      } catch (error) {
        const errorMsg = `Fehler beim Aktualisieren der Transaktion ${transactionId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        errorLog('[TransactionService]', errorMsg, {
          transactionId,
          error,
          updateInfo
        });
      }
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkChangeDate completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      affectedAccounts: Array.from(affectedAccountIds),
      newDate
    });

    // 3. Balance-Neuberechnung für alle betroffenen Konten
    BalanceService.calculateMonthlyBalances();

    if (!this._skipRunningBalanceRecalc) {
      for (const accountId of affectedAccountIds) {
        BalanceService.triggerRunningBalanceRecalculation(accountId, newDate);
      }
    }

    if (success) {
      infoLog('[TransactionService]', `Bulk-Datumsänderung erfolgreich abgeschlossen: ${updatedCount} Transaktionen auf ${newDate} geändert`);
    } else {
      warnLog('[TransactionService]', `Bulk-Datumsänderung mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  },

  /**
   * Bulk-Abgleich setzen für mehrere Transaktionen
   */
  async bulkSetReconciled(transactionIds: string[]): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    debugLog('[TransactionService]', 'bulkSetReconciled started', {
      requestedCount: unique.length
    });

    // Sammle alle zu ändernden Transaktionen
    const transactionsToUpdate = new Map<string, Transaction>();
    const affectedAccountIds = new Set<string>();

    // 1. Analysiere alle Transaktionen
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkSetReconciled - Transaction not found', { id });
        continue;
      }

      // Nur Transaktionen aktualisieren, die noch nicht abgeglichen sind
      if (!tx.reconciled) {
        transactionsToUpdate.set(id, tx);
        if (tx.accountId) {
          affectedAccountIds.add(tx.accountId);
        }
      }
    }

    debugLog('[TransactionService]', 'bulkSetReconciled - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      affectedAccounts: Array.from(affectedAccountIds)
    });

    // 2. Batch-Mode aktivieren für Performance
    this.startBatchMode();

    let updatedCount = 0;
    try {
      // Aktualisiere alle Transaktionen in einem Batch
      for (const [id, tx] of transactionsToUpdate) {
        try {
          await txStore.updateTransaction(id, { reconciled: true });
          updatedCount++;
        } catch (error) {
          const errorMsg = `Fehler beim Setzen des Abgleichs für Transaktion ${id}: ${error}`;
          errors.push(errorMsg);
          errorLog('[TransactionService]', 'bulkSetReconciled - Update failed', { id, error });
        }
      }
    } finally {
      this.endBatchMode();
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkSetReconciled completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      affectedAccounts: Array.from(affectedAccountIds)
    });

    if (success) {
      infoLog('[TransactionService]', `Bulk-Abgleich erfolgreich gesetzt: ${updatedCount} Transaktionen als abgeglichen markiert`);
    } else {
      warnLog('[TransactionService]', `Bulk-Abgleich mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  },

  /**
   * Bulk-Abgleich entfernen für mehrere Transaktionen
   */
  async bulkRemoveReconciled(transactionIds: string[]): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    const unique = [...new Set(transactionIds)];
    const errors: string[] = [];

    if (unique.length === 0) {
      return { success: true, updatedCount: 0, errors: [] };
    }

    debugLog('[TransactionService]', 'bulkRemoveReconciled started', {
      requestedCount: unique.length
    });

    // Sammle alle zu ändernden Transaktionen
    const transactionsToUpdate = new Map<string, Transaction>();
    const affectedAccountIds = new Set<string>();

    // 1. Analysiere alle Transaktionen
    for (const id of unique) {
      const tx = txStore.getTransactionById(id);
      if (!tx) {
        const error = `Transaktion mit ID ${id} nicht gefunden`;
        errors.push(error);
        debugLog('[TransactionService]', 'bulkRemoveReconciled - Transaction not found', { id });
        continue;
      }

      // Nur Transaktionen aktualisieren, die abgeglichen sind
      if (tx.reconciled) {
        transactionsToUpdate.set(id, tx);
        if (tx.accountId) {
          affectedAccountIds.add(tx.accountId);
        }
      }
    }

    debugLog('[TransactionService]', 'bulkRemoveReconciled - Analysis completed', {
      transactionsToUpdate: transactionsToUpdate.size,
      affectedAccounts: Array.from(affectedAccountIds)
    });

    // 2. Batch-Mode aktivieren für Performance
    this.startBatchMode();

    let updatedCount = 0;
    try {
      // Aktualisiere alle Transaktionen in einem Batch
      for (const [id, tx] of transactionsToUpdate) {
        try {
          await txStore.updateTransaction(id, { reconciled: false });
          updatedCount++;
        } catch (error) {
          const errorMsg = `Fehler beim Entfernen des Abgleichs für Transaktion ${id}: ${error}`;
          errors.push(errorMsg);
          errorLog('[TransactionService]', 'bulkRemoveReconciled - Update failed', { id, error });
        }
      }
    } finally {
      this.endBatchMode();
    }

    const success = errors.length === 0;

    debugLog('[TransactionService]', 'bulkRemoveReconciled completed', {
      requested: unique.length,
      transactionsToUpdate: transactionsToUpdate.size,
      updated: updatedCount,
      errors: errors.length,
      success,
      affectedAccounts: Array.from(affectedAccountIds)
    });

    if (success) {
      infoLog('[TransactionService]', `Bulk-Abgleich erfolgreich entfernt: ${updatedCount} Transaktionen als nicht abgeglichen markiert`);
    } else {
      warnLog('[TransactionService]', `Bulk-Abgleich-Entfernung mit Fehlern abgeschlossen: ${updatedCount} erfolgreich, ${errors.length} Fehler`, { errors });
    }

    return { success, updatedCount, errors };
  }

};

// RecipientValidationResult Interface für TypeScript-Typisierung
interface RecipientValidationResult {
  recipientId: string;
  recipientName: string;
  hasActiveReferences: boolean;
  transactionCount: number;
  planningTransactionCount: number;
  automationRuleCount: number;
  canDelete: boolean;
  warnings: string[];
}
