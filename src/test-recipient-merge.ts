// Test-Datei für die Recipient-Merge-Funktionalität
// Pfad: src/test-recipient-merge.ts

import { useRecipientStore } from '@/stores/recipientStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { usePlanningStore } from '@/stores/planningStore';
import { TransactionService } from '@/services/TransactionService';
import { PlanningService } from '@/services/PlanningService';
import type { Recipient, Transaction, TransactionType, PlanningTransaction } from '@/types';
import { RecurrencePattern, AmountType, RecurrenceEndType, WeekendHandlingType } from '@/types';
import { debugLog, infoLog, errorLog } from '@/utils/logger';

/**
 * Test-Funktion für die mergeRecipients-Methode
 */
export async function testRecipientMerge(): Promise<void> {
  try {
    infoLog('testRecipientMerge', 'Starte Test der Recipient-Merge-Funktionalität');

    const recipientStore = useRecipientStore();

    // 1. Test-Recipients erstellen
    const testRecipient1: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Test Empfänger 1',
      defaultCategoryId: null,
      note: 'Test-Empfänger für Merge-Test'
    };

    const testRecipient2: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Test Empfänger 2',
      defaultCategoryId: null,
      note: 'Zweiter Test-Empfänger für Merge-Test'
    };

    const recipient1 = await recipientStore.addRecipient(testRecipient1);
    const recipient2 = await recipientStore.addRecipient(testRecipient2);

    infoLog('testRecipientMerge', `Test-Recipients erstellt: ${recipient1.id}, ${recipient2.id}`);

    // 2. Test: Merge zu neuem Recipient
    const targetRecipientName = 'Zusammengeführter Empfänger';

    await recipientStore.mergeRecipients(
      [recipient1.id, recipient2.id],
      { name: targetRecipientName }
    );

    infoLog('testRecipientMerge', 'Merge zu neuem Recipient erfolgreich');

    // 3. Validierung: Prüfen ob Quell-Recipients gelöscht wurden
    const remainingRecipients = recipientStore.recipients;
    const deletedRecipient1 = remainingRecipients.find(r => r.id === recipient1.id);
    const deletedRecipient2 = remainingRecipients.find(r => r.id === recipient2.id);

    if (deletedRecipient1 || deletedRecipient2) {
      throw new Error('Quell-Recipients wurden nicht korrekt gelöscht');
    }

    // 4. Prüfen ob neuer Ziel-Recipient existiert
    const targetRecipient = remainingRecipients.find(r => r.name === targetRecipientName);
    if (!targetRecipient) {
      throw new Error('Ziel-Recipient wurde nicht erstellt');
    }

    infoLog('testRecipientMerge', `Ziel-Recipient erstellt: ${targetRecipient.id} - ${targetRecipient.name}`);

    // 5. Test: Merge zu bestehendem Recipient
    const testRecipient3: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Test Empfänger 3',
      defaultCategoryId: null,
      note: 'Dritter Test-Empfänger für Merge-Test'
    };

    const recipient3 = await recipientStore.addRecipient(testRecipient3);

    await recipientStore.mergeRecipients(
      [recipient3.id],
      targetRecipient
    );

    infoLog('testRecipientMerge', 'Merge zu bestehendem Recipient erfolgreich');

    // 6. Cleanup: Test-Recipients löschen
    await recipientStore.deleteRecipient(targetRecipient.id);

    infoLog('testRecipientMerge', 'Test erfolgreich abgeschlossen');

  } catch (error) {
    errorLog('testRecipientMerge', 'Fehler beim Testen der Recipient-Merge-Funktionalität', error);
    throw error;
  }
}

/**
 * Hilfsfunktion zum manuellen Testen der Merge-Funktionalität
 */
export async function manualTestRecipientMerge(
  sourceRecipientIds: string[],
  targetRecipient: Recipient | { name: string }
): Promise<void> {
  try {
    const recipientStore = useRecipientStore();

    infoLog('manualTestRecipientMerge', `Starte manuellen Merge-Test`, {
      sourceIds: sourceRecipientIds,
      target: targetRecipient
    });

    await recipientStore.mergeRecipients(sourceRecipientIds, targetRecipient);

    infoLog('manualTestRecipientMerge', 'Manueller Merge-Test erfolgreich abgeschlossen');

  } catch (error) {
    errorLog('manualTestRecipientMerge', 'Fehler beim manuellen Merge-Test', error);
    throw error;
  }
}

/**
 * Test-Funktion für die updateRecipientReferences-Methode im TransactionService
 */
export async function testUpdateRecipientReferences(): Promise<void> {
  try {
    infoLog('testUpdateRecipientReferences', 'Starte Test der updateRecipientReferences-Methode');

    const recipientStore = useRecipientStore();
    const transactionStore = useTransactionStore();

    // 1. Test-Recipients erstellen
    const testRecipient1: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Test Empfänger Alt 1',
      defaultCategoryId: null,
      note: 'Alter Empfänger für Reference-Update-Test'
    };

    const testRecipient2: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Test Empfänger Alt 2',
      defaultCategoryId: null,
      note: 'Zweiter alter Empfänger für Reference-Update-Test'
    };

    const newRecipient: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Test Empfänger Neu',
      defaultCategoryId: null,
      note: 'Neuer Empfänger für Reference-Update-Test'
    };

    const recipient1 = await recipientStore.addRecipient(testRecipient1);
    const recipient2 = await recipientStore.addRecipient(testRecipient2);
    const targetRecipient = await recipientStore.addRecipient(newRecipient);

    infoLog('testUpdateRecipientReferences', `Test-Recipients erstellt`, {
      recipient1: recipient1.id,
      recipient2: recipient2.id,
      targetRecipient: targetRecipient.id
    });

    // 2. Test-Transactions mit den alten Recipients erstellen
    const testTransactions = [
      {
        accountId: 'test-account-1',
        categoryId: 'test-category-1',
        recipientId: recipient1.id,
        date: '2024-01-15',
        valueDate: '2024-01-15',
        amount: -50.00,
        description: 'Test Transaction 1 mit Recipient 1',
        note: 'Test-Transaktion für Reference-Update',
        tagIds: [],
        type: 'EXPENSE' as TransactionType,
        runningBalance: 0
      },
      {
        accountId: 'test-account-2',
        categoryId: 'test-category-2',
        recipientId: recipient2.id,
        date: '2024-01-16',
        valueDate: '2024-01-16',
        amount: -75.00,
        description: 'Test Transaction 2 mit Recipient 2',
        note: 'Zweite Test-Transaktion für Reference-Update',
        tagIds: [],
        type: 'EXPENSE' as TransactionType,
        runningBalance: 0
      },
      {
        accountId: 'test-account-3',
        categoryId: 'test-category-3',
        recipientId: recipient1.id,
        date: '2024-01-17',
        valueDate: '2024-01-17',
        amount: -25.00,
        description: 'Test Transaction 3 mit Recipient 1',
        note: 'Dritte Test-Transaktion für Reference-Update',
        tagIds: [],
        type: 'EXPENSE' as TransactionType,
        runningBalance: 0
      }
    ];

    const createdTransactions = [];
    for (const txData of testTransactions) {
      const transaction = await TransactionService.addTransaction(txData);
      createdTransactions.push(transaction);
    }

    infoLog('testUpdateRecipientReferences', `${createdTransactions.length} Test-Transactions erstellt`);

    // 3. Prüfen der initialen Recipient-Referenzen
    const initialTransactionsWithRecipient1 = transactionStore.transactions.filter(
      t => t.recipientId === recipient1.id
    );
    const initialTransactionsWithRecipient2 = transactionStore.transactions.filter(
      t => t.recipientId === recipient2.id
    );

    infoLog('testUpdateRecipientReferences', 'Initiale Recipient-Referenzen', {
      recipient1Transactions: initialTransactionsWithRecipient1.length,
      recipient2Transactions: initialTransactionsWithRecipient2.length
    });

    // 4. updateRecipientReferences-Methode testen
    await TransactionService.updateRecipientReferences(
      [recipient1.id, recipient2.id],
      targetRecipient.id
    );

    infoLog('testUpdateRecipientReferences', 'updateRecipientReferences-Methode ausgeführt');

    // 5. Validierung: Prüfen ob alle Referenzen aktualisiert wurden
    const updatedTransactionsWithOldRecipients = transactionStore.transactions.filter(
      t => t.recipientId === recipient1.id || t.recipientId === recipient2.id
    );
    const updatedTransactionsWithNewRecipient = transactionStore.transactions.filter(
      t => t.recipientId === targetRecipient.id
    );

    if (updatedTransactionsWithOldRecipients.length > 0) {
      throw new Error(`${updatedTransactionsWithOldRecipients.length} Transactions haben noch alte Recipient-Referenzen`);
    }

    if (updatedTransactionsWithNewRecipient.length !== createdTransactions.length) {
      throw new Error(`Erwartete ${createdTransactions.length} Transactions mit neuer Recipient-Referenz, gefunden: ${updatedTransactionsWithNewRecipient.length}`);
    }

    infoLog('testUpdateRecipientReferences', 'Validierung erfolgreich', {
      transactionsWithNewRecipient: updatedTransactionsWithNewRecipient.length,
      transactionsWithOldRecipients: updatedTransactionsWithOldRecipients.length
    });

    // 6. Cleanup: Test-Daten löschen
    for (const transaction of createdTransactions) {
      await transactionStore.deleteTransaction(transaction.id);
    }
    await recipientStore.deleteRecipient(recipient1.id);
    await recipientStore.deleteRecipient(recipient2.id);
    await recipientStore.deleteRecipient(targetRecipient.id);

    infoLog('testUpdateRecipientReferences', 'Test erfolgreich abgeschlossen - Cleanup durchgeführt');

  } catch (error) {
    errorLog('testUpdateRecipientReferences', 'Fehler beim Testen der updateRecipientReferences-Methode', error);
    throw error;
  }
}

/**
 * Test-Funktion für die PlanningService.updateRecipientReferences-Methode
 */
export async function testUpdatePlanningRecipientReferences(): Promise<void> {
  try {
    infoLog('testUpdatePlanningRecipientReferences', 'Starte Test der PlanningService.updateRecipientReferences-Methode');

    const recipientStore = useRecipientStore();
    const planningStore = usePlanningStore();

    // 1. Test-Recipients erstellen
    const testRecipient1: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Planning Test Empfänger 1',
      defaultCategoryId: null,
      note: 'Test-Empfänger für Planning-Referenz-Update-Test'
    };

    const testRecipient2: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Planning Test Empfänger 2',
      defaultCategoryId: null,
      note: 'Zweiter Test-Empfänger für Planning-Referenz-Update-Test'
    };

    const targetRecipientData: Omit<Recipient, 'id' | 'updatedAt'> = {
      name: 'Planning Ziel-Empfänger',
      defaultCategoryId: null,
      note: 'Ziel-Empfänger für Planning-Referenz-Update-Test'
    };

    const recipient1 = await recipientStore.addRecipient(testRecipient1);
    const recipient2 = await recipientStore.addRecipient(testRecipient2);
    const targetRecipient = await recipientStore.addRecipient(targetRecipientData);

    infoLog('testUpdatePlanningRecipientReferences', `Test-Recipients erstellt: ${recipient1.id}, ${recipient2.id}, ${targetRecipient.id}`);

    // 2. Test-PlanningTransactions erstellen
    const createdPlanningTransactions: PlanningTransaction[] = [];
    const testPlanningData = [
      {
        name: 'Planning Test 1',
        accountId: 'test-account-1',
        categoryId: 'test-category-1',
        recipientId: recipient1.id,
        amount: -100,
        amountType: AmountType.EXACT,
        startDate: new Date().toISOString(),
        recurrencePattern: RecurrencePattern.MONTHLY,
        recurrenceEndType: RecurrenceEndType.NEVER,
        weekendHandling: WeekendHandlingType.NONE,
        isActive: true,
        forecastOnly: false,
        transactionType: 'EXPENSE' as TransactionType
      },
      {
        name: 'Planning Test 2',
        accountId: 'test-account-2',
        categoryId: 'test-category-2',
        recipientId: recipient2.id,
        amount: -200,
        amountType: AmountType.EXACT,
        startDate: new Date().toISOString(),
        recurrencePattern: RecurrencePattern.WEEKLY,
        recurrenceEndType: RecurrenceEndType.NEVER,
        weekendHandling: WeekendHandlingType.NONE,
        isActive: true,
        forecastOnly: false,
        transactionType: 'EXPENSE' as TransactionType
      },
      {
        name: 'Planning Test 3',
        accountId: 'test-account-3',
        categoryId: 'test-category-3',
        recipientId: recipient1.id,
        amount: -300,
        amountType: AmountType.EXACT,
        startDate: new Date().toISOString(),
        recurrencePattern: RecurrencePattern.ONCE,
        recurrenceEndType: RecurrenceEndType.NEVER,
        weekendHandling: WeekendHandlingType.NONE,
        isActive: true,
        forecastOnly: false,
        transactionType: 'EXPENSE' as TransactionType
      }
    ];

    for (const ptData of testPlanningData) {
      const planningTransaction = await planningStore.addPlanningTransaction(ptData);
      createdPlanningTransactions.push(planningTransaction);
    }

    infoLog('testUpdatePlanningRecipientReferences', `${createdPlanningTransactions.length} Test-PlanningTransactions erstellt`);

    // 3. Prüfen der initialen Recipient-Referenzen
    const initialPlanningWithRecipient1 = planningStore.planningTransactions.filter(
      pt => pt.recipientId === recipient1.id
    );
    const initialPlanningWithRecipient2 = planningStore.planningTransactions.filter(
      pt => pt.recipientId === recipient2.id
    );

    infoLog('testUpdatePlanningRecipientReferences', 'Initiale Recipient-Referenzen', {
      recipient1PlanningTransactions: initialPlanningWithRecipient1.length,
      recipient2PlanningTransactions: initialPlanningWithRecipient2.length
    });

    // 4. PlanningService.updateRecipientReferences-Methode testen
    await PlanningService.updateRecipientReferences(
      [recipient1.id, recipient2.id],
      targetRecipient.id
    );

    infoLog('testUpdatePlanningRecipientReferences', 'PlanningService.updateRecipientReferences-Methode ausgeführt');

    // 5. Validierung: Prüfen ob alle Referenzen aktualisiert wurden
    const updatedPlanningWithOldRecipients = planningStore.planningTransactions.filter(
      pt => pt.recipientId === recipient1.id || pt.recipientId === recipient2.id
    );
    const updatedPlanningWithNewRecipient = planningStore.planningTransactions.filter(
      pt => pt.recipientId === targetRecipient.id
    );

    if (updatedPlanningWithOldRecipients.length > 0) {
      throw new Error(`${updatedPlanningWithOldRecipients.length} PlanningTransactions haben noch alte Recipient-Referenzen`);
    }

    if (updatedPlanningWithNewRecipient.length !== createdPlanningTransactions.length) {
      throw new Error(`Erwartete ${createdPlanningTransactions.length} PlanningTransactions mit neuer Recipient-Referenz, gefunden: ${updatedPlanningWithNewRecipient.length}`);
    }

    infoLog('testUpdatePlanningRecipientReferences', 'Validierung erfolgreich', {
      planningTransactionsWithNewRecipient: updatedPlanningWithNewRecipient.length,
      planningTransactionsWithOldRecipients: updatedPlanningWithOldRecipients.length
    });

    // 6. Cleanup: Test-Daten löschen
    for (const planningTransaction of createdPlanningTransactions) {
      await planningStore.deletePlanningTransaction(planningTransaction.id);
    }
    await recipientStore.deleteRecipient(recipient1.id);
    await recipientStore.deleteRecipient(recipient2.id);
    await recipientStore.deleteRecipient(targetRecipient.id);

    infoLog('testUpdatePlanningRecipientReferences', 'Test erfolgreich abgeschlossen - Cleanup durchgeführt');

  } catch (error) {
    errorLog('testUpdatePlanningRecipientReferences', 'Fehler beim Testen der PlanningService.updateRecipientReferences-Methode', error);
    throw error;
  }
}

// Export für Browser-Console-Tests
if (typeof window !== 'undefined') {
  (window as any).testRecipientMerge = testRecipientMerge;
  (window as any).manualTestRecipientMerge = manualTestRecipientMerge;
  (window as any).testUpdateRecipientReferences = testUpdateRecipientReferences;
  (window as any).testUpdatePlanningRecipientReferences = testUpdatePlanningRecipientReferences;
}
