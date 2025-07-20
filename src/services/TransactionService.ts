// Datei: src/services/TransactionService.ts
// Zentrale Drehscheibe für alle Transaktionen, Transfers & Reconcile‑Buchungen.

import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore }     from '@/stores/accountStore';
import { useCategoryStore }    from '@/stores/categoryStore';
import { useRecipientStore }   from '@/stores/recipientStore';
import { Transaction, TransactionType } from '@/types';
// ExtendedTransaction muss importiert werden, wenn es als Typ verwendet wird
import { type ExtendedTransaction } from '@/stores/transactionStore'; // Korrekter Importpfad und `type` Keyword
import { v4 as uuidv4 } from 'uuid';
import { debugLog } from '@/utils/logger';
import { toDateOnlyString } from '@/utils/formatters';
import { useRuleStore } from '@/stores/ruleStore';
import { BalanceService } from './BalanceService';

export const TransactionService = {
  // Flag zur Deaktivierung der automatischen Running Balance Neuberechnung (z.B. während CSV-Import)
  _skipRunningBalanceRecalc: false,

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

/* ------------------------------------------------------------------ */
/* --------------------------- Write APIs --------------------------- */
/* ------------------------------------------------------------------ */

  async addTransaction(txData: Omit<Transaction, 'id' | 'runningBalance'>): Promise<Transaction> {
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

    const transactionDataForStore: ExtendedTransaction = {
      // Übernehme alle Felder von txData (Omit<Transaction, 'id' | 'runningBalance'>)
      ...txData,
      // Setze die Pflichtfelder von ExtendedTransaction oder Felder mit strengeren Typen
      id: uuidv4(),
      date: toDateOnlyString(txData.date),
      valueDate: txData.valueDate ? toDateOnlyString(txData.valueDate) : toDateOnlyString(txData.date),
      runningBalance: 0, // Pflicht in ExtendedTransaction
      payee: resolvedPayee, // Verwende den aus recipientId abgeleiteten payee
      description: txData.description || '', // description ist in Transaction Pflicht
      tagIds: txData.tagIds || [], // tagIds ist in Transaction Pflicht
      // Stelle sicher, dass optionale Felder, die in ExtendedTransaction string | null sind, korrekt behandelt werden
      counterTransactionId: txData.counterTransactionId === undefined ? null : txData.counterTransactionId,
      planningTransactionId: txData.planningTransactionId === undefined ? null : txData.planningTransactionId,
      // Stelle sicher, dass optionale Felder, die in ExtendedTransaction boolean sind, korrekt behandelt werden
      isReconciliation: txData.isReconciliation === undefined ? false : txData.isReconciliation,
      // updated_at wird im Store gesetzt.
      // Andere Felder wie type, accountId, categoryId, amount, note, isCategoryTransfer, transferToAccountId, reconciled, toCategoryId
      // werden von ...txData übernommen und sollten mit Transaction und somit ExtendedTransaction kompatibel sein.
    };
    debugLog('[TransactionService]', 'addTransaction - transactionDataForStore prepared:', transactionDataForStore);

    const added = await txStore.addTransaction(transactionDataForStore);

    // → Regeln anwenden & speichern
    await ruleStore.applyRulesToTransaction(added);

    debugLog('[TransactionService]', 'addTransaction completed', added);

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

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern (außer wenn deaktiviert, z.B. während CSV-Import)
    if (added.accountId && !this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(added.accountId, added.valueDate || added.date);
    }

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
    const toName   = accStore.getAccountById(toAccountId)?.name ?? '';
    const dt       = toDateOnlyString(date);
    const vdt      = toDateOnlyString(valueDate ?? date);
    debugLog('[TransactionService]', 'addAccountTransfer - Calculated dates:', { date, valueDate, dt, vdt });
    const abs      = Math.abs(amount);

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
    });
    const toTx = await this.addTransaction({
      ...base,
      accountId: toAccountId,
      amount: abs,
      payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Transfer von ${fromName}`,
      transferToAccountId: fromAccountId,
    });

    // Verlinken
    this.updateTransaction(fromTx.id, { counterTransactionId: toTx.id });
    this.updateTransaction(toTx.id,   { counterTransactionId: fromTx.id });

    debugLog('[TransactionService]', 'addAccountTransfer completed', { fromTx, toTx });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung für beide Konten triggern (außer wenn deaktiviert, z.B. während CSV-Import)
    if (!this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(fromAccountId, vdt);
      BalanceService.triggerRunningBalanceRecalculation(toAccountId, vdt);
    }

    return { fromTransaction: fromTx, toTransaction: toTx };
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

    const newFromTx = await this.addTransaction(fromTx as Omit<Transaction, 'id' | 'runningBalance'>);
    const newToTx = await this.addTransaction(toTx as Omit<Transaction, 'id' | 'runningBalance'>);

    this.updateTransaction(newFromTx.id, { counterTransactionId: newToTx.id });
    this.updateTransaction(newToTx.id, { counterTransactionId: newFromTx.id });

    debugLog('[TransactionService]', 'addCategoryTransfer completed', { fromTransaction: newFromTx, toTransaction: newToTx });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern (Category Transfers haben keine accountId, daher nicht nötig)

    return { fromTransaction: newFromTx, toTransaction: newToTx };
  },

  updateCategoryTransfer(
    transactionId: string,
    gegentransactionId: string,
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

    this.updateTransaction(transactionId, updatedFromTx);
    this.updateTransaction(gegentransactionId, updatedToTx);

    debugLog('[TransactionService]', 'updateCategoryTransfer completed', { transactionId, gegentransactionId, updatedFromTx, updatedToTx });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern (Category Transfers haben keine accountId, daher nicht nötig)

    return true;
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
    });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern
    if (tx && tx.accountId && !this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(tx.accountId, tx.valueDate || tx.date);
    }

    return tx;
  },

/* ------------------------- Update / Delete ----------------------- */

updateTransaction(
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>
  ): boolean {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();

    if (updates.date) updates.date = toDateOnlyString(updates.date);
    if (updates.valueDate) updates.valueDate = toDateOnlyString(updates.valueDate);

    // Wenn recipientId in den Updates enthalten ist, leite payee ab
    if (updates.recipientId !== undefined) {
      updates.payee = this.resolvePayeeFromRecipient(updates.recipientId, updates.payee);
    }

    const original = txStore.getTransactionById(id);

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
        this.addCategoryTransfer(
          available.id,
          original.categoryId,
          original.amount,
          original.date,
          'Automatischer Rücktransfer wegen Datumsänderung'
        );

        // Neuer Transfer am neuen Datum
        this.addCategoryTransfer(
          original.categoryId,
          available.id,
          original.amount,
          newDateAfterUpdate,
          'Automatischer Transfer wegen Datumsänderung'
        );
      }
    }

    const ok = txStore.updateTransaction(id, updates);
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
          this.addCategoryTransfer(
            diff > 0 ? original.categoryId : available.id,
            diff > 0 ? available.id : original.categoryId,
            Math.abs(diff),
            updates.date ?? original.date,
            'Automatischer Transfer bei Betragsanpassung'
          );
        }
      }
    }

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern
    const updatedTx = txStore.getTransactionById(id);
    if (updatedTx && updatedTx.accountId && !this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(updatedTx.accountId, updatedTx.valueDate || updatedTx.date);
    }

    return true;
  },

  deleteTransaction(id: string): boolean {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();

    const tx = txStore.getTransactionById(id);
    if (!tx) return false;

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
        this.addCategoryTransfer(
          available.id,
          tx.categoryId,
          tx.amount,
          tx.date,
          'Automatischer Transfer bei Löschung der Einnahme'
        );
      }
    }

    const okPrimary = txStore.deleteTransaction(id);
    if (!okPrimary) return false;

    if (tx.counterTransactionId)
      txStore.deleteTransaction(tx.counterTransactionId);

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();

    // Running Balance Neuberechnung triggern
    if (tx.accountId && !this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(tx.accountId, tx.valueDate || tx.date);
    }

    return true;
  },

  deleteMultipleTransactions(ids: string[]) {
    const unique = [...new Set(ids)];
    let deleted = 0;
    unique.forEach(id => this.deleteTransaction(id) && deleted++);
    const success = deleted === unique.length;
    debugLog('[TransactionService]', 'deleteMultipleTransactions completed', { requested: unique.length, deleted });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();
    return { success, deletedCount: deleted };
  },

  /**
   * Berechnet Einnahmen und Ausgaben für einen bestimmten Zeitraum über alle Konten
   * Berücksichtigt ausschließlich INCOME und EXPENSE Transaktionen
   */
  getIncomeExpenseSummary(startDate: string, endDate: string): { income: number; expense: number; balance: number } {
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

    debugLog('[TransactionService]', 'getIncomeExpenseSummary', {
      startDate,
      endDate,
      transactionCount: transactions.length,
      filteredTransactions: transactions.filter(tx =>
        tx.type === TransactionType.INCOME || tx.type === TransactionType.EXPENSE
      ).length,
      income,
      expense,
      balance
    });

    return { income, expense, balance };
  },
};
