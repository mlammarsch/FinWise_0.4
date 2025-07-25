/**
 * Test-Datei für PlanningService Recipient-Validierungsmethoden
 *
 * Diese Datei testet die neu implementierten Validierungsmethoden:
 * - getPlanningTransactionsWithRecipient()
 * - countPlanningTransactionsWithRecipient()
 * - validateRecipientDeletion()
 *
 * Verwendung:
 * 1. In der Browser-Konsole: import('./test-planning-recipient-validation.ts')
 * 2. Dann: window.testPlanningRecipientValidation.runAllTests()
 */

import { PlanningService } from '@/services/PlanningService';
import { usePlanningStore } from '@/stores/planningStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { debugLog, infoLog, errorLog } from '@/utils/logger';

class PlanningRecipientValidationTester {

  /**
   * Führt alle Tests für die PlanningService Recipient-Validierung aus
   */
  async runAllTests(): Promise<void> {
    try {
      infoLog('[PlanningRecipientValidationTester]', 'Starte alle PlanningService Recipient-Validierungstests');

      await this.testGetPlanningTransactionsWithRecipient();
      await this.testCountPlanningTransactionsWithRecipient();
      await this.testValidateRecipientDeletion();

      infoLog('[PlanningRecipientValidationTester]', 'Alle Tests erfolgreich abgeschlossen');

    } catch (error) {
      errorLog('[PlanningRecipientValidationTester]', 'Fehler beim Ausführen der Tests', error);
      throw error;
    }
  }

  /**
   * Test für getPlanningTransactionsWithRecipient Methode
   */
  async testGetPlanningTransactionsWithRecipient(): Promise<void> {
    infoLog('[PlanningRecipientValidationTester]', 'Test: getPlanningTransactionsWithRecipient');

    const planningStore = usePlanningStore();
    const recipientStore = useRecipientStore();

    // Lade aktuelle Daten
    await planningStore.loadPlanningTransactions();
    await recipientStore.loadRecipients();

    const recipients = recipientStore.recipients;
    const planningTransactions = planningStore.planningTransactions;

    infoLog('[PlanningRecipientValidationTester]', 'Testdaten geladen', {
      recipientCount: recipients.length,
      planningTransactionCount: planningTransactions.length,
      planningTransactionsWithRecipient: planningTransactions.filter(pt => pt.recipientId).length
    });

    // Teste mit den ersten 3 Recipients (falls vorhanden)
    const testRecipientIds = recipients.slice(0, Math.min(3, recipients.length)).map(r => r.id);

    for (const recipientId of testRecipientIds) {
      const recipient = recipientStore.getRecipientById(recipientId);
      const foundPlanningTransactions = await PlanningService.getPlanningTransactionsWithRecipient(recipientId);

      // Manuelle Verifikation
      const expectedPlanningTransactions = planningTransactions.filter(pt => pt.recipientId === recipientId);

      debugLog('[PlanningRecipientValidationTester]', `Recipient ${recipient?.name} (${recipientId})`, {
        foundCount: foundPlanningTransactions.length,
        expectedCount: expectedPlanningTransactions.length,
        foundIds: foundPlanningTransactions.map(pt => pt.id),
        expectedIds: expectedPlanningTransactions.map(pt => pt.id)
      });

      // Validierung
      if (foundPlanningTransactions.length !== expectedPlanningTransactions.length) {
        throw new Error(`Mismatch für Recipient ${recipientId}: gefunden ${foundPlanningTransactions.length}, erwartet ${expectedPlanningTransactions.length}`);
      }
    }

    debugLog('[PlanningRecipientValidationTester]', 'getPlanningTransactionsWithRecipient Test abgeschlossen');
  }

  /**
   * Test für countPlanningTransactionsWithRecipient Methode
   */
  async testCountPlanningTransactionsWithRecipient(): Promise<void> {
    infoLog('[PlanningRecipientValidationTester]', 'Test: countPlanningTransactionsWithRecipient');

    const planningStore = usePlanningStore();
    const recipientStore = useRecipientStore();

    const recipients = recipientStore.recipients;
    const planningTransactions = planningStore.planningTransactions;

    // Teste mit den ersten 3 Recipients (falls vorhanden)
    const testRecipientIds = recipients.slice(0, Math.min(3, recipients.length)).map(r => r.id);

    for (const recipientId of testRecipientIds) {
      const recipient = recipientStore.getRecipientById(recipientId);
      const count = await PlanningService.countPlanningTransactionsWithRecipient(recipientId);

      // Manuelle Verifikation
      const expectedCount = planningTransactions.filter(pt => pt.recipientId === recipientId).length;

      debugLog('[PlanningRecipientValidationTester]', `Recipient ${recipient?.name} (${recipientId})`, {
        foundCount: count,
        expectedCount: expectedCount
      });

      // Validierung
      if (count !== expectedCount) {
        throw new Error(`Count-Mismatch für Recipient ${recipientId}: gefunden ${count}, erwartet ${expectedCount}`);
      }
    }

    debugLog('[PlanningRecipientValidationTester]', 'countPlanningTransactionsWithRecipient Test abgeschlossen');
  }

  /**
   * Test für validateRecipientDeletion Methode
   */
  async testValidateRecipientDeletion(): Promise<void> {
    infoLog('[PlanningRecipientValidationTester]', 'Test: validateRecipientDeletion');

    const planningStore = usePlanningStore();
    const recipientStore = useRecipientStore();

    const recipients = recipientStore.recipients;
    const planningTransactions = planningStore.planningTransactions;

    // Teste mit den ersten 3 Recipients (falls vorhanden)
    const testRecipientIds = recipients.slice(0, Math.min(3, recipients.length)).map(r => r.id);
    const validationResults = await PlanningService.validateRecipientDeletion(testRecipientIds);

    infoLog('[PlanningRecipientValidationTester]', 'Validierungsergebnisse erhalten', {
      recipientCount: testRecipientIds.length,
      resultCount: validationResults.length
    });

    // Validiere jedes Ergebnis
    for (const result of validationResults) {
      const recipient = recipientStore.getRecipientById(result.recipientId);
      const expectedCount = planningTransactions.filter(pt => pt.recipientId === result.recipientId).length;

      debugLog('[PlanningRecipientValidationTester]', `Validierung für ${result.recipientName}`, {
        recipientId: result.recipientId,
        planningTransactionCount: result.planningTransactionCount,
        expectedCount: expectedCount,
        hasActiveReferences: result.hasActiveReferences,
        canDelete: result.canDelete,
        warnings: result.warnings
      });

      // Validierungen
      if (result.planningTransactionCount !== expectedCount) {
        throw new Error(`PlanningTransaction-Count-Mismatch für ${result.recipientId}: gefunden ${result.planningTransactionCount}, erwartet ${expectedCount}`);
      }

      if (result.hasActiveReferences !== (expectedCount > 0)) {
        throw new Error(`hasActiveReferences-Mismatch für ${result.recipientId}: ${result.hasActiveReferences}, erwartet ${expectedCount > 0}`);
      }

      if (result.canDelete !== (expectedCount === 0)) {
        throw new Error(`canDelete-Mismatch für ${result.recipientId}: ${result.canDelete}, erwartet ${expectedCount === 0}`);
      }

      // Prüfe Warnungen
      if (expectedCount > 0 && result.warnings.length === 0) {
        throw new Error(`Fehlende Warnungen für ${result.recipientId} mit ${expectedCount} PlanningTransactions`);
      }

      if (expectedCount === 0 && result.warnings.length > 0) {
        throw new Error(`Unerwartete Warnungen für ${result.recipientId} ohne PlanningTransactions`);
      }
    }

    debugLog('[PlanningRecipientValidationTester]', 'validateRecipientDeletion Test abgeschlossen');
  }

  /**
   * Zeigt eine Übersicht der aktuellen PlanningTransaction-Recipient-Referenzen
   */
  async showPlanningTransactionRecipientOverview(): Promise<void> {
    infoLog('[PlanningRecipientValidationTester]', 'PlanningTransaction-Recipient-Übersicht');

    const planningStore = usePlanningStore();
    const recipientStore = useRecipientStore();

    await planningStore.loadPlanningTransactions();
    await recipientStore.loadRecipients();

    const planningTransactions = planningStore.planningTransactions;
    const recipients = recipientStore.recipients;

    // Statistiken sammeln
    const planningTransactionsWithRecipient = planningTransactions.filter(pt => pt.recipientId);
    const planningTransactionsWithoutRecipient = planningTransactions.filter(pt => !pt.recipientId);

    const recipientUsageMap = new Map<string, number>();
    planningTransactionsWithRecipient.forEach(pt => {
      if (pt.recipientId) {
        recipientUsageMap.set(pt.recipientId, (recipientUsageMap.get(pt.recipientId) || 0) + 1);
      }
    });

    infoLog('[PlanningRecipientValidationTester]', 'PlanningTransaction-Recipient-Statistiken', {
      totalPlanningTransactions: planningTransactions.length,
      planningTransactionsWithRecipient: planningTransactionsWithRecipient.length,
      planningTransactionsWithoutRecipient: planningTransactionsWithoutRecipient.length,
      totalRecipients: recipients.length,
      recipientsInUse: recipientUsageMap.size,
      recipientsNotInUse: recipients.length - recipientUsageMap.size
    });

    // Top 5 meist verwendete Recipients
    const sortedRecipientUsage = Array.from(recipientUsageMap.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    debugLog('[PlanningRecipientValidationTester]', 'Top 5 meist verwendete Recipients in PlanningTransactions',
      sortedRecipientUsage.map(([recipientId, count]) => {
        const recipient = recipientStore.getRecipientById(recipientId);
        return {
          recipientId,
          recipientName: recipient?.name || 'Unbekannt',
          planningTransactionCount: count
        };
      })
    );
  }
}

// Globale Instanz für Browser-Konsole
const tester = new PlanningRecipientValidationTester();

// Export für Browser-Konsole
if (typeof window !== 'undefined') {
  (window as any).testPlanningRecipientValidation = tester;
}

export { PlanningRecipientValidationTester };
