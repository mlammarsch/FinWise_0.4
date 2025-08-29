// src/tests/categoryTransferTest.ts
/**
 * Test für automatische Kategorietransfers bei INCOME-Kategoriewechsel
 * von Ausgabenkategorie zu Einnahmenkategorie
 */
import { TransactionService } from '@/services/TransactionService';
import { useTransactionStore } from '@/stores/transactionStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useAccountStore } from '@/stores/accountStore';
import { TransactionType } from '@/types';
import { debugLog, infoLog, errorLog } from '@/utils/logger';
export async function testCategoryTransferOnIncomeChange() {
    try {
        infoLog('CategoryTransferTest', 'Starting test for automatic category transfer on income category change');
        const transactionStore = useTransactionStore();
        const categoryStore = useCategoryStore();
        const accountStore = useAccountStore();
        // Stelle sicher, dass die Stores initialisiert sind
        await transactionStore.initializeStore();
        await categoryStore.initializeStore();
        await accountStore.initializeStore();
        // Erstelle Testkategorien
        const expenseCategory = await categoryStore.addCategory({
            name: 'Test Ausgabenkategorie',
            isIncomeCategory: false,
            isActive: true,
            isHidden: false,
            sortOrder: 1,
            budgeted: 0,
            activity: 0,
            available: 0,
            isSavingsGoal: false
        });
        const incomeCategory = await categoryStore.addCategory({
            name: 'Test Einnahmenkategorie',
            isIncomeCategory: true,
            isActive: true,
            isHidden: false,
            sortOrder: 2,
            budgeted: 0,
            activity: 0,
            available: 0,
            isSavingsGoal: false
        });
        // Stelle sicher, dass "Verfügbare Mittel" Kategorie existiert
        let availableFundsCategory = categoryStore.getAvailableFundsCategory();
        if (!availableFundsCategory) {
            availableFundsCategory = await categoryStore.addCategory({
                name: 'Verfügbare Mittel',
                isIncomeCategory: false,
                isActive: true,
                isHidden: false,
                sortOrder: 9999,
                budgeted: 0,
                activity: 0,
                available: 0,
                isSavingsGoal: false
            });
        }
        // Erstelle ein Testkonto
        const testAccount = accountStore.accounts[0];
        if (!testAccount) {
            throw new Error('Kein Testkonto verfügbar');
        }
        debugLog('CategoryTransferTest', 'Test setup completed', {
            expenseCategory: expenseCategory.id,
            incomeCategory: incomeCategory.id,
            availableFunds: availableFundsCategory.id,
            testAccount: testAccount.id
        });
        // Erstelle eine INCOME-Transaktion mit Ausgabenkategorie
        const testTransaction = await TransactionService.addTransaction({
            accountId: testAccount.id,
            type: TransactionType.INCOME,
            amount: 500,
            description: 'Test Einnahme für Kategoriewechsel',
            date: '2024-01-15',
            valueDate: '2024-01-15',
            categoryId: expenseCategory.id,
            tagIds: [],
            note: 'Test für automatischen Kategorietransfer',
            reconciled: false,
            isCategoryTransfer: false
        });
        infoLog('CategoryTransferTest', 'Test transaction created', {
            id: testTransaction.id,
            amount: testTransaction.amount,
            categoryId: testTransaction.categoryId,
            categoryName: expenseCategory.name
        });
        // Zähle Transaktionen vor der Änderung
        const transactionsBeforeUpdate = transactionStore.transactions.length;
        const categoryTransfersBeforeUpdate = transactionStore.transactions.filter(tx => tx.type === TransactionType.CATEGORYTRANSFER).length;
        debugLog('CategoryTransferTest', 'State before category change', {
            totalTransactions: transactionsBeforeUpdate,
            categoryTransfers: categoryTransfersBeforeUpdate
        });
        // Ändere die Kategorie von Ausgabe zu Einnahme
        const updateSuccess = await TransactionService.updateTransaction(testTransaction.id, {
            categoryId: incomeCategory.id
        });
        if (!updateSuccess) {
            throw new Error('Transaction update failed');
        }
        infoLog('CategoryTransferTest', 'Transaction category updated successfully');
        // Warte kurz für asynchrone Verarbeitung
        await new Promise(resolve => setTimeout(resolve, 100));
        // Zähle Transaktionen nach der Änderung
        const transactionsAfterUpdate = transactionStore.transactions.length;
        const categoryTransfersAfterUpdate = transactionStore.transactions.filter(tx => tx.type === TransactionType.CATEGORYTRANSFER).length;
        debugLog('CategoryTransferTest', 'State after category change', {
            totalTransactions: transactionsAfterUpdate,
            categoryTransfers: categoryTransfersAfterUpdate
        });
        // Prüfe, ob ein neuer CATEGORYTRANSFER erstellt wurde
        const expectedNewTransfers = 2; // Ein Transfer von Einnahmenkategorie zu Verfügbare Mittel (2 Transaktionen)
        const actualNewTransfers = transactionsAfterUpdate - transactionsBeforeUpdate;
        if (actualNewTransfers !== expectedNewTransfers) {
            throw new Error(`Expected ${expectedNewTransfers} new transactions, but got ${actualNewTransfers}`);
        }
        // Finde die neuen CATEGORYTRANSFER-Transaktionen
        const newCategoryTransfers = transactionStore.transactions.filter(tx => tx.type === TransactionType.CATEGORYTRANSFER &&
            tx.description?.includes('Automatischer Transfer bei Kategoriewechsel'));
        if (newCategoryTransfers.length !== expectedNewTransfers) {
            throw new Error(`Expected ${expectedNewTransfers} category transfer transactions, but found ${newCategoryTransfers.length}`);
        }
        // Prüfe die Details der Kategorietransfers
        const fromTransfer = newCategoryTransfers.find(tx => tx.categoryId === incomeCategory.id);
        const toTransfer = newCategoryTransfers.find(tx => tx.categoryId === availableFundsCategory.id);
        if (!fromTransfer || !toTransfer) {
            throw new Error('Category transfer transactions not found with correct categories');
        }
        if (Math.abs(fromTransfer.amount) !== 500 || Math.abs(toTransfer.amount) !== 500) {
            throw new Error(`Expected transfer amount of 500, but got ${Math.abs(fromTransfer.amount)} and ${Math.abs(toTransfer.amount)}`);
        }
        // Prüfe, dass die Transaktionen verknüpft sind
        if (fromTransfer.counterTransactionId !== toTransfer.id || toTransfer.counterTransactionId !== fromTransfer.id) {
            throw new Error('Category transfer transactions are not properly linked');
        }
        infoLog('CategoryTransferTest', 'Test completed successfully!', {
            originalTransaction: testTransaction.id,
            categoryTransferFrom: fromTransfer.id,
            categoryTransferTo: toTransfer.id,
            transferAmount: Math.abs(fromTransfer.amount)
        });
        // Cleanup: Lösche die Testtransaktionen
        await TransactionService.deleteTransaction(testTransaction.id);
        await TransactionService.deleteTransaction(fromTransfer.id);
        await TransactionService.deleteTransaction(toTransfer.id);
        infoLog('CategoryTransferTest', 'Test cleanup completed');
    }
    catch (error) {
        errorLog('CategoryTransferTest', 'Test failed', error);
        throw error;
    }
}
// Exportiere die Testfunktion für manuelle Ausführung
if (typeof window !== 'undefined') {
    window.testCategoryTransferOnIncomeChange = testCategoryTransferOnIncomeChange;
}
