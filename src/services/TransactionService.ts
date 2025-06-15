// Datei: src/services/TransactionService.ts
// Zentrale Drehscheibe für alle Transaktionen, Transfers & Reconcile‑Buchungen.

import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore }     from '@/stores/accountStore';
import { useCategoryStore }    from '@/stores/categoryStore';
import { Transaction, TransactionType } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { debugLog } from '@/utils/logger';
import { toDateOnlyString } from '@/utils/formatters';
import { useRuleStore } from '@/stores/ruleStore';
import { BalanceService } from './BalanceService';

export const TransactionService = {
/* ------------------------------------------------------------------ */
/* --------------------------- Read APIs ---------------------------- */
/* ------------------------------------------------------------------ */
  getAllTransactions(): Transaction[] {
    return useTransactionStore().transactions;
  },

  getTransactionById(id: string): Transaction | null {
    const tx = useTransactionStore().getTransactionById(id);
    if (!tx) debugLog('[TransactionService] getTransactionById – not found', id);
    return tx;
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
    const newTx: Transaction = {
      ...txData,
      id: uuidv4(),
      date:      toDateOnlyString(txData.date),
      valueDate: txData.valueDate
        ? toDateOnlyString(txData.valueDate)
        : toDateOnlyString(txData.date),
      runningBalance: 0,
      payee: txData.payee || '', // Sicherstellen dass payee nie undefined ist
      description: txData.description || '', // Fehlende Eigenschaft hinzufügen
    };

    const added = await txStore.addTransaction(newTx);

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
    planningTransactionId: string | null = null
  ) {
    if (fromAccountId === toAccountId) throw new Error('Quell = Zielkonto');
    if (amount === 0) throw new Error('Betrag 0');

    const accStore = useAccountStore();

    const fromName = accStore.getAccountById(fromAccountId)?.name ?? '';
    const toName   = accStore.getAccountById(toAccountId)?.name ?? '';
    const dt       = toDateOnlyString(date);
    const vdt      = toDateOnlyString(valueDate ?? date);
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
    };

    const fromTx = await this.addTransaction({
      ...base,
      accountId: fromAccountId,
      amount: -abs,
      payee: `Transfer zu ${toName}`,
      transferToAccountId: toAccountId,
    });
    const toTx = await this.addTransaction({
      ...base,
      accountId: toAccountId,
      amount: abs,
      payee: `Transfer von ${fromName}`,
      transferToAccountId: fromAccountId,
    });

    // Verlinken
    this.updateTransaction(fromTx.id, { counterTransactionId: toTx.id });
    this.updateTransaction(toTx.id,   { counterTransactionId: fromTx.id });

    debugLog('[TransactionService]', 'addAccountTransfer completed', { fromTx, toTx });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();
    return { fromTransaction: fromTx, toTransaction: toTx };
  },

/* -------------------- Kategorie‑zu‑Kategorie‑Transfer -------------------- */

  async addCategoryTransfer(
    fromCategoryId: string,
    toCategoryId: string,
    amount: number,
    date: string,
    note: string = ''
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
      payee: `Kategorientransfer zu ${toCategoryName}`,
      note,
      counterTransactionId: null,
      planningTransactionId: null,
      isReconciliation: false,
      isCategoryTransfer: true,
      toCategoryId: toCategoryId,
      reconciled: false,
      description: '', // Fehlende Eigenschaft hinzufügen
    };

    const toTx = {
      ...fromTx,
      categoryId: toCategoryId,
      amount: Math.abs(amount),
      payee: `Kategorientransfer von ${fromCategoryName}`,
      toCategoryId: fromCategoryId,
    };

    const newFromTx = await this.addTransaction(fromTx as Omit<Transaction, 'id' | 'runningBalance'>);
    const newToTx = await this.addTransaction(toTx as Omit<Transaction, 'id' | 'runningBalance'>);

    this.updateTransaction(newFromTx.id, { counterTransactionId: newToTx.id });
    this.updateTransaction(newToTx.id, { counterTransactionId: newFromTx.id });

    debugLog('[TransactionService]', 'addCategoryTransfer completed', { fromTransaction: newFromTx, toTransaction: newToTx });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();
    return { fromTransaction: newFromTx, toTransaction: newToTx };
  },

  updateCategoryTransfer(
    transactionId: string,
    gegentransactionId: string,
    fromCategoryId: string,
    toCategoryId: string,
    amount: number,
    date: string,
    note: string = ''
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
      payee: `Kategorientransfer zu ${toCategoryName}`,
      note
    };

    const updatedToTx: Partial<Transaction> = {
      categoryId: toCategoryId,
      amount: Math.abs(amount),
      toCategoryId: fromCategoryId,
      date: normalizedDate,
      valueDate: normalizedDate,
      payee: `Kategorientransfer von ${fromCategoryName}`,
      note
    };

    this.updateTransaction(transactionId, updatedFromTx);
    this.updateTransaction(gegentransactionId, updatedToTx);

    debugLog('[TransactionService]', 'updateCategoryTransfer completed', { transactionId, gegentransactionId, updatedFromTx, updatedToTx });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();
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

  addReconcileTransaction(
    accountId: string,
    amount: number,
    date: string,
    note = ''
  ) {
    if (amount === 0) return null;
    const catStore = useCategoryStore();

    const catId =
      catStore.categories.find(c => c.name === 'Ausgleichskorrekturen')?.id ??
      null;

    const tx = this.addTransaction({
      type: TransactionType.RECONCILE,
      date: toDateOnlyString(date),
      valueDate: toDateOnlyString(date),
      accountId,
      categoryId: catId || undefined,
      amount,
      tagIds: [],
      payee: 'Kontoabgleich',
      note: note || (amount > 0 ? 'Korrektur Gutschrift' : 'Korrektur Belastung'),
      counterTransactionId: null,
      planningTransactionId: null,
      isReconciliation: true,
      isCategoryTransfer: false,
      reconciled: true,
      description: '', // Fehlende Eigenschaft hinzufügen
    });

    // Salden aktualisieren
    BalanceService.calculateMonthlyBalances();
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
};
