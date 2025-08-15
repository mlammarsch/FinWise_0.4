// Datei: src/services/TransactionService.ts
// Zentrale Drehscheibe für alle Transaktionen, Transfers & Reconcile‑Buchungen.

import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { usePlanningStore } from '@/stores/planningStore';
import { Transaction, TransactionType, Category, PlanningTransaction } from '@/types';
import { type ExtendedTransaction } from '@/stores/transactionStore';
import { v4 as uuidv4 } from 'uuid';
import { debugLog, infoLog, errorLog, warnLog } from '@/utils/logger';
import dayjs from 'dayjs'; // Import dayjs
import { toDateOnlyString } from '@/utils/formatters';
import { useRuleStore } from '@/stores/ruleStore';
import { BalanceService } from './BalanceService';
import { TenantDbService } from './TenantDbService';

export const TransactionService = {
  _skipRunningBalanceRecalc: false,
  _isBatchMode: false,
  _batchModeCache: new Map<string, any>(),

  startBatchMode(): void {
    this._isBatchMode = true;
    this._batchModeCache.clear();
    debugLog('[TransactionService]', 'Batch-Mode aktiviert');
  },

  endBatchMode(): void {
    this._isBatchMode = false;
    this._batchModeCache.clear();
    debugLog('[TransactionService]', 'Batch-Mode deaktiviert');
  },

  isInBatchMode(): boolean {
    return this._isBatchMode;
  },

  getAllTransactions(): Transaction[] {
    return useTransactionStore().transactions;
  },

  getTransactionById(id: string): Transaction | null {
    const tx = useTransactionStore().getTransactionById(id);
    if (!tx) {
      debugLog('[TransactionService] getTransactionById – not found', id);
      return null;
    }
    return tx;
  },

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

  assignDefaultCategoryIfNeeded(
    txData: any,
    isReconciliation: boolean = false,
    isIntentionalCategoryRemoval: boolean = false
  ): any {
    if (isReconciliation || isIntentionalCategoryRemoval || txData.categoryId || txData.type === TransactionType.CATEGORYTRANSFER || txData.type === TransactionType.ACCOUNTTRANSFER) {
      return txData;
    }

    const catStore = useCategoryStore();
    const availableFundsCategory = catStore.getAvailableFundsCategory();

    if (!availableFundsCategory) {
      warnLog('[TransactionService]', 'assignDefaultCategoryIfNeeded - "Verfügbare Mittel" Kategorie nicht gefunden');
      return txData;
    }

    return { ...txData, categoryId: availableFundsCategory.id };
  },

  async addTransaction(txData: Omit<Transaction, 'id' | 'runningBalance'>, applyRules: boolean = true): Promise<Transaction> {
    const txStore = useTransactionStore();
    const catStore = useCategoryStore();
    const ruleStore = useRuleStore();

    if (!txData.accountId && txData.type !== TransactionType.CATEGORYTRANSFER) {
      throw new Error('Account ID erforderlich.');
    }

    const resolvedPayee = this.resolvePayeeFromRecipient(txData.recipientId, txData.payee);
    const txDataWithDefaultCategory = this.assignDefaultCategoryIfNeeded(txData, txData.isReconciliation || false, false);

    let transactionDataForStore: ExtendedTransaction = {
      ...txDataWithDefaultCategory,
      id: uuidv4(),
      date: toDateOnlyString(txDataWithDefaultCategory.date),
      valueDate: txDataWithDefaultCategory.valueDate ? toDateOnlyString(txDataWithDefaultCategory.valueDate) : toDateOnlyString(txDataWithDefaultCategory.date),
      runningBalance: 0,
      payee: resolvedPayee,
      description: txDataWithDefaultCategory.description || '',
      tagIds: txDataWithDefaultCategory.tagIds || [],
      counterTransactionId: txDataWithDefaultCategory.counterTransactionId === undefined ? null : txDataWithDefaultCategory.counterTransactionId,
      planningTransactionId: txDataWithDefaultCategory.planningTransactionId === undefined ? null : txDataWithDefaultCategory.planningTransactionId,
      isReconciliation: txDataWithDefaultCategory.isReconciliation === undefined ? false : txDataWithDefaultCategory.isReconciliation,
    };

    if (applyRules) {
      const preRuleResult = await ruleStore.applyRulesToTransaction(transactionDataForStore, 'PRE');
      transactionDataForStore = { ...transactionDataForStore, ...preRuleResult };
    }

    const added = await txStore.addTransaction(transactionDataForStore);

    if (applyRules) {
      await ruleStore.applyRulesToTransaction(added, 'DEFAULT');
    }

    if (added.accountId) {
      BalanceService.enqueueRunningBalanceRecalculation(added.accountId, added.valueDate || added.date);
    }

    if (added.type === TransactionType.INCOME && added.amount > 0 && added.categoryId) {
      const available = catStore.getAvailableFundsCategory();
      const cat = catStore.getCategoryById(added.categoryId);
      if (available && cat?.isIncomeCategory) {
        await this.addCategoryTransfer(added.categoryId, available.id, added.amount, added.date, 'Automatischer Transfer von Einnahmen');
      }
    }

    if (applyRules) {
      await ruleStore.applyRulesToTransaction(added, 'POST');
    }

    BalanceService.triggerMonthlyBalanceUpdate({
      accountIds: added.accountId ? [added.accountId] : undefined,
      categoryIds: added.categoryId ? [added.categoryId] : undefined,
      fromDate: added.valueDate || added.date,
    });

    return added;
  },

  async addAccountTransfer(fromAccountId: string, toAccountId: string, amount: number, date: string, valueDate: string | null = null, note = '', planningTransactionId: string | null = null, recipientId?: string) {
    if (fromAccountId === toAccountId) throw new Error('Quell = Zielkonto');
    if (amount === 0) throw new Error('Betrag 0');

    const accStore = useAccountStore();
    const fromName = accStore.getAccountById(fromAccountId)?.name ?? '';
    const toName = accStore.getAccountById(toAccountId)?.name ?? '';
    const vdt = toDateOnlyString(valueDate || date);
    const abs = Math.abs(amount);

    const base: Omit<Transaction, 'id' | 'runningBalance'> = {
      type: TransactionType.ACCOUNTTRANSFER, date: vdt, valueDate: vdt, categoryId: undefined, tagIds: [], payee: '', note, counterTransactionId: null, planningTransactionId, isReconciliation: false, isCategoryTransfer: false, reconciled: false, transferToAccountId: undefined, accountId: '', amount: 0, description: '', recipientId,
    };

    // KORRIGIERT: Verwende das ursprüngliche Vorzeichen für die Richtungsbestimmung
    // Positiver amount = Transfer von fromAccount zu toAccount (fromAccount verliert Geld)
    // Negativer amount würde bedeuten, dass die Parameter vertauscht wurden
    const fromTx = await this.addTransaction({ ...base, accountId: fromAccountId, amount: -abs, payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Transfer zu ${toName}`, transferToAccountId: toAccountId }, false);
    const toTx = await this.addTransaction({ ...base, accountId: toAccountId, amount: abs, payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Transfer von ${fromName}`, transferToAccountId: fromAccountId }, false);

    await this.updateTransaction(fromTx.id, { counterTransactionId: toTx.id });
    await this.updateTransaction(toTx.id, { counterTransactionId: fromTx.id });

    BalanceService.triggerMonthlyBalanceUpdate({ accountIds: [fromAccountId, toAccountId], fromDate: vdt });

    if (!this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(fromAccountId, vdt);
      BalanceService.triggerRunningBalanceRecalculation(toAccountId, vdt);
    }
    return { fromTransaction: fromTx, toTransaction: toTx };
  },

  async updateAccountTransfer(id: string, updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>): Promise<boolean> {
    const txStore = useTransactionStore();
    const original = txStore.getTransactionById(id);
    if (!original || original.type !== TransactionType.ACCOUNTTRANSFER || !original.counterTransactionId) return false;
    const counterTransaction = txStore.getTransactionById(original.counterTransactionId);
    if (!counterTransaction) return false;

    const accStore = useAccountStore();
    const newAmount = updates.amount !== undefined ? updates.amount : original.amount;
    const absNewAmount = Math.abs(newAmount);
    let fromAccountId = newAmount < 0 ? original.accountId : counterTransaction.accountId, toAccountId = newAmount < 0 ? counterTransaction.accountId : original.accountId;
    const fromName = accStore.getAccountById(fromAccountId)?.name ?? '', toName = accStore.getAccountById(toAccountId)?.name ?? '';
    const dateUpdate = updates.date || original.date, valueDateUpdate = updates.valueDate || original.valueDate || dateUpdate;
    const noteUpdate = updates.note !== undefined ? updates.note : original.note;
    const recipientIdUpdate = updates.recipientId !== undefined ? updates.recipientId : original.recipientId;

    const originalUpdates: Partial<Transaction> = { amount: newAmount < 0 ? -absNewAmount : absNewAmount, accountId: toAccountId, date: dateUpdate, valueDate: valueDateUpdate, note: noteUpdate, recipientId: recipientIdUpdate, payee: recipientIdUpdate ? this.resolvePayeeFromRecipient(recipientIdUpdate) : `Transfer von ${fromName}`, transferToAccountId: fromAccountId };
    const counterUpdates: Partial<Transaction> = { amount: newAmount < 0 ? absNewAmount : -absNewAmount, accountId: fromAccountId, date: dateUpdate, valueDate: valueDateUpdate, note: noteUpdate, recipientId: recipientIdUpdate, payee: recipientIdUpdate ? this.resolvePayeeFromRecipient(recipientIdUpdate) : `Transfer zu ${toName}`, transferToAccountId: toAccountId };

    await txStore.updateTransaction(id, original.amount > 0 ? originalUpdates : counterUpdates);
    await txStore.updateTransaction(counterTransaction.id, original.amount > 0 ? counterUpdates : originalUpdates);

    BalanceService.triggerMonthlyBalanceUpdate({ accountIds: [fromAccountId, toAccountId], fromDate: valueDateUpdate });

    if (!this._skipRunningBalanceRecalc) {
      BalanceService.triggerRunningBalanceRecalculation(fromAccountId, valueDateUpdate);
      BalanceService.triggerRunningBalanceRecalculation(toAccountId, valueDateUpdate);
    }
    return true;
  },

  async addCategoryTransfer(fromCategoryId: string, toCategoryId: string, amount: number, date: string, note: string = '', recipientId?: string) {
    const categoryStore = useCategoryStore();
    const fromCategoryName = categoryStore.getCategoryById(fromCategoryId)?.name ?? '';
    const toCategoryName = categoryStore.getCategoryById(toCategoryId)?.name ?? '';
    const normalizedDate = toDateOnlyString(date);

    const fromTx: Omit<Transaction, 'id' | 'runningBalance'> = { type: TransactionType.CATEGORYTRANSFER, date: normalizedDate, valueDate: normalizedDate, accountId: '', categoryId: fromCategoryId, amount: -Math.abs(amount), tagIds: [], payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer zu ${toCategoryName}`, note, counterTransactionId: null, planningTransactionId: null, isReconciliation: false, isCategoryTransfer: true, toCategoryId: toCategoryId, reconciled: false, description: '', recipientId };
    const toTx: Omit<Transaction, 'id' | 'runningBalance'> = { ...fromTx, categoryId: toCategoryId, amount: Math.abs(amount), payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer von ${fromCategoryName}`, toCategoryId: fromCategoryId };

    const newFromTx = await this.addTransaction(fromTx, false);
    const newToTx = await this.addTransaction(toTx, false);

    await this.updateTransaction(newFromTx.id, { counterTransactionId: newToTx.id });
    await this.updateTransaction(newToTx.id, { counterTransactionId: newFromTx.id });

    BalanceService.triggerMonthlyBalanceUpdate({ categoryIds: [fromCategoryId, toCategoryId], fromDate: normalizedDate });
    return { fromTransaction: newFromTx, toTransaction: newToTx };
  },

  async addMultipleCategoryTransfers(transfers: Array<{
    fromCategoryId: string;
    toCategoryId: string;
    amount: number;
    date: string;
    note?: string;
    recipientId?: string;
  }>): Promise<Array<{ fromTransaction: Transaction; toTransaction: Transaction }>> {
    if (transfers.length === 0) return [];

    const categoryStore = useCategoryStore();
    const transactionStore = useTransactionStore();
    const results: Array<{ fromTransaction: Transaction; toTransaction: Transaction }> = [];

    // Sammle alle Transaktionen für Bulk-Insert
    const allTransactions: ExtendedTransaction[] = [];
    const transferPairs: Array<{ fromIndex: number; toIndex: number; transfer: typeof transfers[0] }> = [];

    transfers.forEach((transfer, i) => {
      const fromCategoryName = categoryStore.getCategoryById(transfer.fromCategoryId)?.name ?? '';
      const toCategoryName = categoryStore.getCategoryById(transfer.toCategoryId)?.name ?? '';
      const normalizedDate = toDateOnlyString(transfer.date);
      const note = transfer.note || '';

      const fromTx: ExtendedTransaction = {
        id: '', // Wird von addMultipleTransactions gesetzt
        runningBalance: 0, // Wird von addMultipleTransactions berechnet
        type: TransactionType.CATEGORYTRANSFER,
        date: normalizedDate,
        valueDate: normalizedDate,
        accountId: '',
        categoryId: transfer.fromCategoryId,
        amount: -Math.abs(transfer.amount),
        tagIds: [],
        payee: transfer.recipientId ? this.resolvePayeeFromRecipient(transfer.recipientId) : `Kategorientransfer zu ${toCategoryName}`,
        note,
        counterTransactionId: null,
        planningTransactionId: null,
        isReconciliation: false,
        isCategoryTransfer: true,
        toCategoryId: transfer.toCategoryId,
        reconciled: false,
        description: '',
        recipientId: transfer.recipientId
      };

      const toTx: ExtendedTransaction = {
        ...fromTx,
        id: '', // Wird von addMultipleTransactions gesetzt
        categoryId: transfer.toCategoryId,
        amount: Math.abs(transfer.amount),
        payee: transfer.recipientId ? this.resolvePayeeFromRecipient(transfer.recipientId) : `Kategorientransfer von ${fromCategoryName}`,
        toCategoryId: transfer.fromCategoryId
      };

      const fromIndex = allTransactions.length;
      const toIndex = allTransactions.length + 1;

      allTransactions.push(fromTx, toTx);
      transferPairs.push({ fromIndex, toIndex, transfer });
    });

    // Bulk-Insert aller Transaktionen
    const insertedTransactions = await transactionStore.addMultipleTransactions(allTransactions);

    // Sammle Updates für counterTransactionId - verwende einzelne Updates
    const affectedCategoryIds = new Set<string>();
    let earliestDate = transfers[0]?.date;

    for (const { fromIndex, toIndex, transfer } of transferPairs) {
      const fromTx = insertedTransactions[fromIndex];
      const toTx = insertedTransactions[toIndex];

      if (fromTx && toTx) {
        // Einzelne Updates für counterTransactionId
        await transactionStore.updateTransaction(fromTx.id, { counterTransactionId: toTx.id });
        await transactionStore.updateTransaction(toTx.id, { counterTransactionId: fromTx.id });

        results.push({ fromTransaction: fromTx, toTransaction: toTx });
        affectedCategoryIds.add(transfer.fromCategoryId);
        affectedCategoryIds.add(transfer.toCategoryId);

        if (transfer.date < earliestDate) {
          earliestDate = transfer.date;
        }
      }
    }

    // Trigger Balance Update für alle betroffenen Kategorien
    if (affectedCategoryIds.size > 0) {
      BalanceService.triggerMonthlyBalanceUpdate({
        categoryIds: Array.from(affectedCategoryIds),
        fromDate: toDateOnlyString(earliestDate)
      });
    }

    return results;
  },

  async updateCategoryTransfer(transactionId: string, gegentransactionId: string, fromCategoryId: string, toCategoryId: string, amount: number, date: string, note: string | undefined = undefined, recipientId?: string) {
    const catStore = useCategoryStore();
    const fromCategoryName = catStore.getCategoryById(fromCategoryId)?.name ?? '';
    const toCategoryName = catStore.getCategoryById(toCategoryId)?.name ?? '';

    await this.updateTransaction(transactionId, { categoryId: fromCategoryId, toCategoryId: toCategoryId, amount: -Math.abs(amount), date, valueDate: date, payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer zu ${toCategoryName}`, note, recipientId, });
    await this.updateTransaction(gegentransactionId, { categoryId: toCategoryId, toCategoryId: fromCategoryId, amount: Math.abs(amount), date, valueDate: date, payee: recipientId ? this.resolvePayeeFromRecipient(recipientId) : `Kategorientransfer von ${fromCategoryName}`, note, recipientId, });
    BalanceService.triggerMonthlyBalanceUpdate({ categoryIds: [fromCategoryId, toCategoryId], fromDate: date });
  },

  getCategoryTransferOptions(clickedCategoryId: string, isIncome: boolean): { label: string; value: string }[] {
    const categoryService = useCategoryStore();
    const allCategories = categoryService.categories;
    const getDescendants = (parentId: string): string[] => {
      const children = allCategories.filter(c => c.parentCategoryId === parentId);
      let descendants: string[] = children.map(c => c.id);
      children.forEach(child => {
        descendants = [...descendants, ...getDescendants(child.id)];
      });
      return descendants;
    };
    const excludedIds = new Set<string>([clickedCategoryId, ...getDescendants(clickedCategoryId)]);
    return allCategories.filter((cat: Category) => !excludedIds.has(cat.id) && cat.isIncomeCategory === isIncome).sort((a, b) => a.name.localeCompare(b.name)).map((cat: Category) => ({ label: cat.name, value: cat.id, }));
  },

  async updateCategoryTransferAmount(transactionId: string, newAmount: number): Promise<void> {
    const txStore = useTransactionStore();
    const original = txStore.getTransactionById(transactionId);
    if (!original || !original.isCategoryTransfer || !original.counterTransactionId) return;
    const counter = txStore.getTransactionById(original.counterTransactionId);
    if (!counter) return;

    await txStore.updateTransaction(original.id, { amount: original.amount < 0 ? -Math.abs(newAmount) : Math.abs(newAmount) });
    await txStore.updateTransaction(counter.id, { amount: original.amount < 0 ? Math.abs(newAmount) : -Math.abs(newAmount) });
    BalanceService.triggerMonthlyBalanceUpdate({ categoryIds: [original.categoryId, counter.categoryId].filter(Boolean) as string[], fromDate: original.date });
  },

  async addReconcileTransaction(accountId: string, amount: number, date: string, note?: string) {
    await this.addTransaction({ type: TransactionType.EXPENSE, accountId, amount, date, valueDate: date, payee: 'Kontoausgleich', note: note || '', isReconciliation: true, tagIds: [], description: '', }, false);
    BalanceService.triggerMonthlyBalanceUpdate({ accountIds: [accountId], fromDate: toDateOnlyString(new Date()) });
  },

  async deleteSingleTransaction(id: string): Promise<boolean> {
    const txStore = useTransactionStore();
    const tx = txStore.getTransactionById(id);
    if (!tx) return false;
    const result = await txStore.deleteTransaction(id);
    if (result) {
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: tx.accountId ? [tx.accountId] : undefined, categoryIds: tx.categoryId ? [tx.categoryId] : undefined, fromDate: tx.date });
    }
    return result;
  },

  async convertTransferToNormalTransaction(transactionId: string): Promise<Transaction | null> {
    const txStore = useTransactionStore();
    const original = txStore.getTransactionById(transactionId);
    if (!original || !(original.type === TransactionType.ACCOUNTTRANSFER || original.type === TransactionType.CATEGORYTRANSFER)) return null;

    if (original.counterTransactionId) {
      await txStore.deleteTransaction(original.counterTransactionId);
    }
    const updates: Partial<Transaction> = { type: original.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE, counterTransactionId: null, isCategoryTransfer: false, transferToAccountId: undefined, toCategoryId: undefined };
    const success = await txStore.updateTransaction(transactionId, updates);
    if (!success) return null;

    const newTransaction = txStore.getTransactionById(transactionId);
    if (newTransaction) {
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: [original.accountId, newTransaction.accountId].filter(Boolean) as string[], categoryIds: [original.categoryId, newTransaction.categoryId].filter(Boolean) as string[], fromDate: original.date });
    }
    return newTransaction || null;
  },

  async updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'runningBalance'>>): Promise<Transaction | null> {
    const txStore = useTransactionStore();
    const originalTx = txStore.getTransactionById(id);
    if (!originalTx) return null;
    if (updates.recipientId !== undefined) {
      updates.payee = this.resolvePayeeFromRecipient(updates.recipientId, updates.payee);
    }
    if (updates.date && !updates.valueDate) {
      updates.valueDate = updates.date;
    }
    const success = await txStore.updateTransaction(id, updates);
    if (!success) return null;

    const updatedTx = txStore.getTransactionById(id);
    if (updatedTx && (updates.amount !== undefined || updates.date !== undefined || updates.accountId !== undefined || updates.categoryId !== undefined)) {
      if (updatedTx.accountId) {
        BalanceService.enqueueRunningBalanceRecalculation(updatedTx.accountId, updatedTx.valueDate || updatedTx.date);
      }
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: originalTx.accountId ? [originalTx.accountId] : undefined, categoryIds: originalTx.categoryId ? [originalTx.categoryId] : undefined, fromDate: originalTx.date });
    }
    return updatedTx || null;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    const txStore = useTransactionStore();
    const tx = txStore.getTransactionById(id);
    if (!tx) return false;
    const counterId = tx.counterTransactionId;
    if (counterId) {
      await txStore.deleteTransaction(counterId);
    }
    const result = await txStore.deleteTransaction(id);
    if (result) {
      const counterTx = counterId ? txStore.getTransactionById(counterId) : null;
      const accountIds = [tx.accountId, counterTx?.accountId].filter(Boolean) as string[];
      const categoryIds = [tx.categoryId, counterTx?.categoryId].filter(Boolean) as string[];
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds, categoryIds, fromDate: tx.date });
    }
    return result;
  },

  async bulkDeleteTransactions(ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    if (ids.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    const txStore = useTransactionStore();
    const allIdsToDelete = new Set(ids);
    const deletedTransactions: Transaction[] = [];

    // Sammle alle zu löschenden Transaktionen (inklusive Counter-Transaktionen)
    ids.forEach(id => {
      const tx = txStore.getTransactionById(id);
      if (tx?.counterTransactionId) allIdsToDelete.add(tx.counterTransactionId);
      if (tx) deletedTransactions.push(tx);
    });

    // Verwende die optimierte Bulk-Delete-Funktion aus dem Store
    const success = await txStore.bulkDeleteTransactions(Array.from(allIdsToDelete));

    // Trigger Balance-Updates nur einmal am Ende
    if (success && deletedTransactions.length > 0) {
      const accountIds = new Set<string>();
      const categoryIds = new Set<string>();
      let fromDate = deletedTransactions[0].date;

      deletedTransactions.forEach(tx => {
        if (tx.accountId) accountIds.add(tx.accountId);
        if (tx.categoryId) categoryIds.add(tx.categoryId);
        if (tx.date < fromDate) fromDate = tx.date;
      });

      BalanceService.triggerMonthlyBalanceUpdate({
        accountIds: Array.from(accountIds),
        categoryIds: Array.from(categoryIds),
        fromDate
      });
    }

    return { success, deletedCount: allIdsToDelete.size };
  },

  async bulkAssignAccount(transactionIds: string[], newAccountId: string): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    let updatedCount = 0;
    const errors: string[] = [];
    const updatedTransactions: Transaction[] = [];

    for (const id of new Set(transactionIds)) {
      const tx = txStore.getTransactionById(id);
      if (tx && tx.accountId !== newAccountId) {
        const success = await txStore.updateTransaction(id, { accountId: newAccountId });
        if (success) {
          updatedCount++;
          const updatedTx = txStore.getTransactionById(id);
          if (updatedTx) updatedTransactions.push(updatedTx);
        } else errors.push(`Fehler bei ID ${id}`);
      }
    }
    if (updatedTransactions.length > 0) {
      const accountIds = new Set<string>(updatedTransactions.map(t => t.accountId).filter(Boolean) as string[]);
      const fromDate = updatedTransactions.sort((a, b) => a.date.localeCompare(b.date))[0].date;
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: Array.from(accountIds), fromDate });
    }
    return { success: errors.length === 0, updatedCount, errors };
  },

  async bulkAssignCategory(transactionIds: string[], newCategoryId: string | null): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    const txStore = useTransactionStore();
    let updatedCount = 0;
    const errors: string[] = [];
    const updatedTransactions: Transaction[] = [];
    for (const id of new Set(transactionIds)) {
      const tx = txStore.getTransactionById(id);
      if (tx && tx.categoryId !== newCategoryId) {
        const success = await txStore.updateTransaction(id, { categoryId: newCategoryId ?? undefined });
        if (success) {
          updatedCount++;
          const updatedTx = txStore.getTransactionById(id);
          if (updatedTx) updatedTransactions.push(updatedTx);
        } else errors.push(`Fehler bei ID ${id}`);
      }
    }
    if (updatedTransactions.length > 0) {
      const accountIds = new Set(updatedTransactions.map(t => t.accountId).filter(Boolean) as string[]);
      const categoryIds = new Set(updatedTransactions.map(t => t.categoryId).filter(Boolean) as string[]);
      const fromDate = updatedTransactions.sort((a, b) => a.date.localeCompare(b.date))[0].date;
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: Array.from(accountIds), categoryIds: Array.from(categoryIds), fromDate });
    }
    return { success: errors.length === 0, updatedCount, errors };
  },

  async bulkChangeRecipient(transactionIds: string[], newRecipientId: string | null, removeAll: boolean = false): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    let updatedCount = 0;
    const errors: string[] = [];
    const recipientName = newRecipientId ? useRecipientStore().getRecipientById(newRecipientId)?.name : '';
    const updatedTransactions: Transaction[] = [];

    for (const id of new Set(transactionIds)) {
      const tx = this.getTransactionById(id);
      if (tx) {
        const updateData: Partial<Transaction> = { recipientId: removeAll ? undefined : newRecipientId || undefined, payee: removeAll ? '' : recipientName, };
        const success = await this.updateTransaction(id, updateData);
        if (success) {
          updatedCount++;
          const updatedTx = this.getTransactionById(id);
          if (updatedTx) updatedTransactions.push(updatedTx);
        } else {
          errors.push(`Fehler bei ID ${id}`);
        }
      }
    }

    if (updatedTransactions.length > 0) {
      const accountIds = new Set(updatedTransactions.map(t => t.accountId).filter(Boolean) as string[]);
      const fromDate = updatedTransactions.sort((a, b) => a.date.localeCompare(b.date))[0].date;
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: Array.from(accountIds), fromDate });
    }
    return { success: errors.length === 0, updatedCount, errors };
  },

  async bulkAssignTags(transactionIds: string[], tagIds: string[] | null, removeAll: boolean = false): Promise<{ success: boolean; updatedCount: number; errors: string[] }> {
    let updatedCount = 0;
    const errors: string[] = [];
    const updatedTransactions: Transaction[] = [];
    for (const id of new Set(transactionIds)) {
      const tx = this.getTransactionById(id);
      if (tx) {
        const updateData: Partial<Transaction> = { tagIds: removeAll ? [] : tagIds || [] };
        const success = await this.updateTransaction(id, updateData);
        if (success) {
          updatedCount++;
          const updatedTx = this.getTransactionById(id);
          if (updatedTx) updatedTransactions.push(updatedTx);
        } else {
          errors.push(`Fehler bei ID ${id}`);
        }
      }
    }
    if (updatedTransactions.length > 0) {
      const accountIds = new Set<string>(updatedTransactions.map(t => t.accountId).filter(Boolean) as string[]);
      const categoryIds = new Set<string>(updatedTransactions.map(t => t.categoryId).filter(Boolean) as string[]);
      const fromDate = updatedTransactions.sort((a, b) => a.date.localeCompare(b.date))[0].date;
      BalanceService.triggerMonthlyBalanceUpdate({ accountIds: Array.from(accountIds), categoryIds: Array.from(categoryIds), fromDate });
    }
    return { success: errors.length === 0, updatedCount, errors };
  },

  getIncomeExpenseSummary(startDate: string, endDate: string): { income: number; expense: number; balance: number } {
    const txStore = useTransactionStore();
    const transactions = txStore.transactions.filter(tx => {
      const txDate = toDateOnlyString(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
    const summary = { income: 0, expense: 0, balance: 0 };
    transactions.forEach(tx => {
      if (tx.type === TransactionType.ACCOUNTTRANSFER || tx.isCategoryTransfer) return;
      if (tx.type === TransactionType.INCOME) summary.income += tx.amount;
      else if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.RECONCILE) summary.expense += tx.amount;
    });
    summary.balance = summary.income + summary.expense;
    return summary;
  },

  getMonthlyTrend(months: number = 6): { month: string; income: number; expense: number }[] {
    const txStore = useTransactionStore();
    const today = dayjs();
    const monthlyData: { [key: string]: { income: number; expense: number } } = {};

    // Initialisiere Daten für die letzten 'months' Monate
    for (let i = 0; i < months; i++) {
      const monthKey = today.subtract(i, 'month').format('YYYY-MM');
      monthlyData[monthKey] = { income: 0, expense: 0 };
    }

    txStore.transactions.forEach(tx => {
      const txMonth = dayjs(tx.date).format('YYYY-MM');
      if (monthlyData[txMonth]) {
        if (tx.type === TransactionType.INCOME) {
          monthlyData[txMonth].income += tx.amount;
        } else if (tx.type === TransactionType.EXPENSE || tx.type === TransactionType.RECONCILE) {
          monthlyData[txMonth].expense += tx.amount;
        }
      }
    });

    // Konvertiere zu Array und sortiere chronologisch
    const result = Object.keys(monthlyData)
      .sort()
      .map(monthKey => ({
        month: dayjs(monthKey).format('MMM YY'), // z.B. Jan 23
        income: monthlyData[monthKey].income,
        expense: monthlyData[monthKey].expense,
      }));

    return result;
  },

  /**
   * Intelligente Verarbeitung von eingehenden Transaktionen für Initial Data Load
   * Nutzt TenantDbService für optimierte Batch-Operationen
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

      // Behalte die lokale runningBalance, wenn sie bereits existiert
      const transactionsWithPreservedBalance = incomingTransactions.map(tx => {
        const localTx = transactionStore.getTransactionById(tx.id);
        if (localTx && localTx.runningBalance) {
          tx.runningBalance = localTx.runningBalance;
        }
        return tx;
      });

      // Verwende die neue intelligente Bulk-Operation für maximale Performance
      const result = await tenantDbService.addTransactionsBatchIntelligent(transactionsWithPreservedBalance);

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
};

interface RecipientValidationResult {
  recipientId: string;
  canBeDeleted: boolean;
  reason: string;
}
