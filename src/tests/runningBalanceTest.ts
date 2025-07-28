// Test für Running Balance Problem
// Reproduziert das Problem: Nach Löschen aller Transaktionen und Hinzufügen einer neuen
// wird die Running Balance falsch berechnet

import { useTransactionStore } from '@/stores/transactionStore';
import { useAccountStore } from '@/stores/accountStore';
import { TransactionService } from '@/services/TransactionService';
import { TransactionType } from '@/types';
import { debugLog, infoLog, errorLog } from '@/utils/logger';

export async function testRunningBalanceProblem() {
  debugLog('RunningBalanceTest', 'Starte Running Balance Problem Test');

  const transactionStore = useTransactionStore();
  const accountStore = useAccountStore();

  // 1. Erstelle ein Test-Konto
  const testAccount = {
    id: 'test-account-1',
    name: 'Test Konto',
    description: 'Test Konto für Running Balance Test',
    accountType: 'CHECKING' as any,
    isActive: true,
    isOfflineBudget: false,
    accountGroupId: 'default-group',
    sortOrder: 1,
    balance: 0,
    offset: 0,
    logo_path: null
  };

  await accountStore.addAccount(testAccount);
  infoLog('RunningBalanceTest', 'Test-Konto erstellt', testAccount);

  // 2. Füge mehrere Transaktionen hinzu
  const transactions = [
    {
      accountId: testAccount.id,
      type: TransactionType.EXPENSE,
      amount: -100,
      date: '2024-01-01',
      valueDate: '2024-01-01',
      description: 'Erste Ausgabe',
      categoryId: 'test-category',
      payee: 'Test Empfänger 1',
      tagIds: [],
      note: '',
      reconciled: false,
      isCategoryTransfer: false
    },
    {
      accountId: testAccount.id,
      type: TransactionType.INCOME,
      amount: 500,
      date: '2024-01-02',
      valueDate: '2024-01-02',
      description: 'Einnahme',
      categoryId: 'test-category',
      payee: 'Test Empfänger 2',
      tagIds: [],
      note: '',
      reconciled: false,
      isCategoryTransfer: false
    },
    {
      accountId: testAccount.id,
      type: TransactionType.EXPENSE,
      amount: -50,
      date: '2024-01-03',
      valueDate: '2024-01-03',
      description: 'Zweite Ausgabe',
      categoryId: 'test-category',
      payee: 'Test Empfänger 3',
      tagIds: [],
      note: '',
      reconciled: false,
      isCategoryTransfer: false
    }
  ];

  const addedTransactions = [];
  for (const txData of transactions) {
    const tx = await TransactionService.addTransaction(txData, false);
    addedTransactions.push(tx);
    infoLog('RunningBalanceTest', `Transaktion hinzugefügt: ${tx.description} (Running Balance: ${tx.runningBalance})`);
  }

  // 3. Zeige aktuelle Running Balances
  debugLog('RunningBalanceTest', 'Aktuelle Running Balances nach Hinzufügen:');
  const currentTransactions = transactionStore.getTransactionsByAccount(testAccount.id);
  currentTransactions.forEach(tx => {
    debugLog('RunningBalanceTest', `${tx.date}: ${tx.description} (${tx.amount}€) -> Running Balance: ${tx.runningBalance}€`);
  });

  // 4. Lösche alle Transaktionen
  infoLog('RunningBalanceTest', 'Lösche alle Transaktionen...');
  for (const tx of addedTransactions) {
    await TransactionService.deleteTransaction(tx.id);
    debugLog('RunningBalanceTest', `Transaktion gelöscht: ${tx.description}`);
  }

  // 5. Prüfe, ob Konto leer ist
  const remainingTransactions = transactionStore.getTransactionsByAccount(testAccount.id);
  infoLog('RunningBalanceTest', `Verbleibende Transaktionen: ${remainingTransactions.length}`);

  // 6. Füge eine neue Transaktion hinzu
  const newTransaction = {
    accountId: testAccount.id,
    type: TransactionType.INCOME,
    amount: 200,
    date: '2024-01-04',
    valueDate: '2024-01-04',
    description: 'Neue Transaktion nach Löschung',
    categoryId: 'test-category',
    payee: 'Neuer Empfänger',
    tagIds: [],
    note: '',
    reconciled: false,
    isCategoryTransfer: false
  };

  const newTx = await TransactionService.addTransaction(newTransaction, false);
  infoLog('RunningBalanceTest', `Neue Transaktion hinzugefügt: ${newTx.description} (Running Balance: ${newTx.runningBalance}€)`);

  // 7. Erwartung vs. Realität
  const expectedRunningBalance = 200; // Da das Konto leer war, sollte die Running Balance 200€ sein
  const actualRunningBalance = newTx.runningBalance;

  if (actualRunningBalance === expectedRunningBalance) {
    infoLog('RunningBalanceTest', '✅ TEST BESTANDEN: Running Balance ist korrekt');
  } else {
    errorLog('RunningBalanceTest', `❌ TEST FEHLGESCHLAGEN: Erwartete Running Balance: ${expectedRunningBalance}€, Tatsächliche: ${actualRunningBalance}€`);
  }

  // 8. Cleanup
  await accountStore.deleteAccount(testAccount.id);
  debugLog('RunningBalanceTest', 'Test-Konto gelöscht');

  return {
    success: actualRunningBalance === expectedRunningBalance,
    expected: expectedRunningBalance,
    actual: actualRunningBalance,
    difference: actualRunningBalance - expectedRunningBalance
  };
}

// Exportiere für manuelle Ausführung in der Browser-Konsole
(window as any).testRunningBalance = testRunningBalanceProblem;
