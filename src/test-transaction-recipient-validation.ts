// Test-Datei für Transaction-Recipient-Validierung
// Pfad: src/test-transaction-recipient-validation.ts

import { TransactionService } from '@/services/TransactionService';
import { useTransactionStore } from '@/stores/transactionStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { debugLog, infoLog, errorLog } from '@/utils/logger';
import type { Transaction, Recipient } from '@/types';

/**
 * Test-Suite für die neuen Recipient-Validierungsmethoden im TransactionService
 *
 * Testet:
 * - validateRecipientDeletion()
 * - getTransactionsWithRecipient()
 * - countTransactionsWithRecipient()
 */

export class TransactionRecipientValidationTester {
  private transactionStore = useTransactionStore();
  private recipientStore = useRecipientStore();

  /**
   * Führt alle Tests aus
   */
  async runAllTests(): Promise<void> {
    try {
      infoLog('[TransactionRecipientValidationTester]', 'Starte alle Tests für Transaction-Recipient-Validierung');

      await this.testCountTransactionsWithRecipient();
      await this.testGetTransactionsWithRecipient();
      await this.testValidateRecipientDeletion();

      infoLog('[TransactionRecipientValidationTester]', 'Alle Tests erfolgreich abgeschlossen');

    } catch (error) {
      errorLog('[TransactionRecipientValidationTester]', 'Fehler beim Ausführen der Tests', error);
      throw error;
    }
  }

  /**
   * Test für countTransactionsWithRecipient Methode
   */
  async testCountTransactionsWithRecipient(): Promise<void> {
    infoLog('[TransactionRecipientValidationTester]', 'Test: countTransactionsWithRecipient');

    // Test mit existierendem Recipient
    const recipients = this.recipientStore.recipients;
    if (recipients.length > 0) {
      const testRecipient = recipients[0];
      const count = await TransactionService.countTransactionsWithRecipient(testRecipient.id);

      infoLog('[TransactionRecipientValidationTester]', `Recipient "${testRecipient.name}" hat ${count} Transaktionen`, {
        recipientId: testRecipient.id,
        recipientName: testRecipient.name,
        transactionCount: count
      });
    }

    // Test mit nicht-existierendem Recipient
    const nonExistentId = 'non-existent-recipient-id';
    const countNonExistent = await TransactionService.countTransactionsWithRecipient(nonExistentId);

    infoLog('[TransactionRecipientValidationTester]', `Nicht-existierender Recipient hat ${countNonExistent} Transaktionen`, {
      recipientId: nonExistentId,
      transactionCount: countNonExistent
    });

    debugLog('[TransactionRecipientValidationTester]', 'countTransactionsWithRecipient Test abgeschlossen');
  }

  /**
   * Test für getTransactionsWithRecipient Methode
   */
  async testGetTransactionsWithRecipient(): Promise<void> {
    infoLog('[TransactionRecipientValidationTester]', 'Test: getTransactionsWithRecipient');

    const recipients = this.recipientStore.recipients;
    if (recipients.length > 0) {
      const testRecipient = recipients[0];
      const transactions = await TransactionService.getTransactionsWithRecipient(testRecipient.id);

      infoLog('[TransactionRecipientValidationTester]', `Recipient "${testRecipient.name}" - gefundene Transaktionen:`, {
        recipientId: testRecipient.id,
        recipientName: testRecipient.name,
        transactionCount: transactions.length,
        transactionIds: transactions.map(t => t.id),
        transactionDescriptions: transactions.map(t => t.description).slice(0, 5) // Erste 5 Beschreibungen
      });

      // Analysiere Match-Typen
      const directMatches = transactions.filter(t => t.recipientId === testRecipient.id);
      const payeeMatches = transactions.filter(t => t.recipientId !== testRecipient.id);

      debugLog('[TransactionRecipientValidationTester]', 'Match-Analyse:', {
        totalMatches: transactions.length,
        directMatches: directMatches.length,
        payeeMatches: payeeMatches.length
      });
    }

    debugLog('[TransactionRecipientValidationTester]', 'getTransactionsWithRecipient Test abgeschlossen');
  }

  /**
   * Test für validateRecipientDeletion Methode
   */
  async testValidateRecipientDeletion(): Promise<void> {
    infoLog('[TransactionRecipientValidationTester]', 'Test: validateRecipientDeletion');

    const recipients = this.recipientStore.recipients;
    if (recipients.length === 0) {
      infoLog('[TransactionRecipientValidationTester]', 'Keine Recipients zum Testen vorhanden');
      return;
    }

    // Test mit mehreren Recipients
    const testRecipientIds = recipients.slice(0, Math.min(3, recipients.length)).map(r => r.id);
    const validationResults = await TransactionService.validateRecipientDeletion(testRecipientIds);

    infoLog('[TransactionRecipientValidationTester]', `Validierung von ${testRecipientIds.length} Recipients:`, {
      recipientIds: testRecipientIds,
      results: validationResults.map(result => ({
        recipientName: result.recipientName,
        transactionCount: result.transactionCount,
        hasActiveReferences: result.hasActiveReferences,
        canDelete: result.canDelete,
        warnings: result.warnings
      }))
    });

    // Zusammenfassung
    const canDeleteCount = validationResults.filter(r => r.canDelete).length;
    const hasReferencesCount = validationResults.filter(r => r.hasActiveReferences).length;
    const totalTransactionReferences = validationResults.reduce((sum, r) => sum + r.transactionCount, 0);

    infoLog('[TransactionRecipientValidationTester]', 'Validierungs-Zusammenfassung:', {
      totalRecipients: validationResults.length,
      canDeleteCount,
      hasReferencesCount,
      totalTransactionReferences
    });

    debugLog('[TransactionRecipientValidationTester]', 'validateRecipientDeletion Test abgeschlossen');
  }

  /**
   * Zeigt aktuelle Store-Statistiken an
   */
  showStoreStatistics(): void {
    const transactionCount = this.transactionStore.transactions.length;
    const recipientCount = this.recipientStore.recipients.length;

    infoLog('[TransactionRecipientValidationTester]', 'Store-Statistiken:', {
      transactionCount,
      recipientCount,
      transactionsWithRecipientId: this.transactionStore.transactions.filter(t => t.recipientId).length,
      transactionsWithPayee: this.transactionStore.transactions.filter(t => t.payee).length
    });
  }
}

/**
 * Hilfsfunktion zum Ausführen der Tests
 */
export async function runTransactionRecipientValidationTests(): Promise<void> {
  const tester = new TransactionRecipientValidationTester();

  // Zeige Store-Statistiken
  tester.showStoreStatistics();

  // Führe Tests aus
  await tester.runAllTests();
}

// Für manuelle Ausführung in der Browser-Konsole
if (typeof window !== 'undefined') {
  (window as any).runTransactionRecipientValidationTests = runTransactionRecipientValidationTests;
  (window as any).TransactionRecipientValidationTester = TransactionRecipientValidationTester;
}
