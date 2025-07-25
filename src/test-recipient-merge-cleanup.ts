/**
 * Test-Datei für die automatische Post-Merge-Bereinigung im recipientStore
 * Implementiert Task 5.4: Automatische Bereinigung nach erfolgreichem Merge
 */

import { useRecipientStore } from '@/stores/recipientStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { usePlanningStore } from '@/stores/planningStore';
import { useRuleStore } from '@/stores/ruleStore';
import { useTenantStore } from '@/stores/tenantStore';
import { TenantDbService } from '@/services/TenantDbService';
import type { Recipient, Transaction, PlanningTransaction, AutomationRule } from '@/types';
import { TransactionType, RecurrencePattern } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { debugLog, infoLog, errorLog } from '@/utils/logger';

/**
 * Test-Daten-Generator für Cleanup-Tests
 */
class CleanupTestDataGenerator {
  static generateRecipient(overrides: Partial<Recipient> = {}): Recipient {
    return {
      id: uuidv4(),
      name: `Test Recipient ${Math.random().toString(36).substr(2, 9)}`,
      defaultCategoryId: null,
      note: 'Test recipient for cleanup testing',
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generateTransaction(recipientId: string, overrides: Partial<Transaction> = {}): Transaction {
    return {
      id: uuidv4(),
      accountId: 'test-account-id',
      categoryId: 'test-category-id',
      recipientId,
      date: new Date().toISOString().split('T')[0],
      valueDate: new Date().toISOString().split('T')[0],
      amount: -50.00,
      description: 'Test transaction for cleanup',
      note: 'Test transaction',
      tagIds: [],
      type: TransactionType.EXPENSE,
      runningBalance: 1000.00,
      counterTransactionId: undefined,
      planningTransactionId: undefined,
      isReconciliation: false,
      isCategoryTransfer: false,
      transferToAccountId: undefined,
      reconciled: false,
      toCategoryId: undefined,
      payee: 'Test Payee',
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generatePlanningTransaction(recipientId: string, overrides: Partial<PlanningTransaction> = {}): PlanningTransaction {
    return {
      id: uuidv4(),
      name: 'Test Planning Transaction',
      accountId: 'test-account-id',
      categoryId: 'test-category-id',
      recipientId,
      tagIds: [],
      amount: -100.00,
      amountType: 'fixed',
      approximateAmount: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      note: 'Test planning transaction for cleanup',
      startDate: new Date().toISOString().split('T')[0],
      valueDate: new Date().toISOString().split('T')[0],
      endDate: undefined,
      recurrencePattern: RecurrencePattern.MONTHLY,
      recurrenceEndType: 'never',
      recurrenceCount: undefined,
      executionDay: 1,
      weekendHandling: 'none',
      isActive: true,
      forecastOnly: false,
      transactionType: TransactionType.EXPENSE,
      transferToAccountId: undefined,
      transferToCategoryId: undefined,
      counterPlanningTransactionId: undefined,
      autoExecute: true,
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generateAutomationRule(recipientId: string, overrides: Partial<AutomationRule> = {}): AutomationRule {
    return {
      id: uuidv4(),
      name: 'Test Automation Rule',
      description: 'Test rule for cleanup testing',
      stage: 'pre_categorization',
      conditions: [
        {
          type: 'RECIPIENT_EQUALS',
          field: 'recipientId',
          operator: 'equals',
          value: recipientId
        }
      ],
      actions: [
        {
          type: 'SET_CATEGORY',
          field: 'categoryId',
          value: 'test-category-id'
        }
      ],
      priority: 1,
      isActive: true,
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }
}

/**
 * Mock-Services für isolierte Tests
 */
class MockCleanupServices {
  private static originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  static enableTestLogging(): void {
    console.log = (...args) => this.originalConsole.log('[TEST]', ...args);
    console.warn = (...args) => this.originalConsole.warn('[TEST WARN]', ...args);
    console.error = (...args) => this.originalConsole.error('[TEST ERROR]', ...args);
  }

  static disableTestLogging(): void {
    console.log = this.originalConsole.log;
    console.warn = this.originalConsole.warn;
    console.error = this.originalConsole.error;
  }

  static async setupTestEnvironment(): Promise<void> {
    // Initialisiere Test-Umgebung
    const tenantStore = useTenantStore();
    await tenantStore.setCurrentTenant('test-tenant-cleanup');

    // Lade alle Stores
    const recipientStore = useRecipientStore();
    const transactionStore = useTransactionStore();
    const planningStore = usePlanningStore();
    const ruleStore = useRuleStore();

    await Promise.all([
      recipientStore.loadRecipients(),
      transactionStore.loadTransactions(),
      planningStore.loadPlanningTransactions(),
      ruleStore.loadRules()
    ]);

    infoLog('CleanupTest', 'Test-Umgebung erfolgreich initialisiert');
  }

  static async cleanupTestEnvironment(): Promise<void> {
    // Bereinige Test-Daten
    const recipientStore = useRecipientStore();
    const transactionStore = useTransactionStore();
    const planningStore = usePlanningStore();
    const ruleStore = useRuleStore();

    await Promise.all([
      recipientStore.reset(),
      transactionStore.reset(),
      planningStore.reset(),
      ruleStore.reset()
    ]);

    infoLog('CleanupTest', 'Test-Umgebung bereinigt');
  }
}

/**
 * Haupttest-Klasse für Post-Merge-Cleanup
 */
export class RecipientMergeCleanupTester {
  private recipientStore = useRecipientStore();
  private transactionStore = useTransactionStore();
  private planningStore = usePlanningStore();
  private ruleStore = useRuleStore();

  /**
   * Test 1: Orphaned Data Detection und Bereinigung
   */
  async testOrphanedDataCleanup(): Promise<{
    success: boolean;
    results: {
      orphanedTransactionsFound: number;
      orphanedPlanningsFound: number;
      orphanedRulesFound: number;
      cleanedTransactions: number;
      cleanedPlannings: number;
      cleanedRules: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let results = {
      orphanedTransactionsFound: 0,
      orphanedPlanningsFound: 0,
      orphanedRulesFound: 0,
      cleanedTransactions: 0,
      cleanedPlannings: 0,
      cleanedRules: 0
    };

    try {
      infoLog('CleanupTest', 'Starte Test: Orphaned Data Detection');

      // 1. Erstelle Test-Recipients
      const sourceRecipient1 = CleanupTestDataGenerator.generateRecipient({ name: 'Source Recipient 1' });
      const sourceRecipient2 = CleanupTestDataGenerator.generateRecipient({ name: 'Source Recipient 2' });
      const targetRecipient = CleanupTestDataGenerator.generateRecipient({ name: 'Target Recipient' });

      await Promise.all([
        this.recipientStore.addRecipient(sourceRecipient1),
        this.recipientStore.addRecipient(sourceRecipient2),
        this.recipientStore.addRecipient(targetRecipient)
      ]);

      // 2. Erstelle Test-Daten mit Referenzen auf Source-Recipients
      const testTransaction1 = CleanupTestDataGenerator.generateTransaction(sourceRecipient1.id);
      const testTransaction2 = CleanupTestDataGenerator.generateTransaction(sourceRecipient2.id);
      const testPlanning1 = CleanupTestDataGenerator.generatePlanningTransaction(sourceRecipient1.id);
      const testPlanning2 = CleanupTestDataGenerator.generatePlanningTransaction(sourceRecipient2.id);
      const testRule1 = CleanupTestDataGenerator.generateAutomationRule(sourceRecipient1.id);
      const testRule2 = CleanupTestDataGenerator.generateAutomationRule(sourceRecipient2.id);

      await Promise.all([
        this.transactionStore.addTransaction(testTransaction1),
        this.transactionStore.addTransaction(testTransaction2),
        this.planningStore.addPlanningTransaction(testPlanning1),
        this.planningStore.addPlanningTransaction(testPlanning2),
        this.ruleStore.addRule(testRule1),
        this.ruleStore.addRule(testRule2)
      ]);

      // 3. Zähle orphaned data vor Merge
      results.orphanedTransactionsFound = this.transactionStore.transactions.filter(t =>
        t.recipientId && [sourceRecipient1.id, sourceRecipient2.id].includes(t.recipientId)
      ).length;

      results.orphanedPlanningsFound = this.planningStore.planningTransactions.filter(pt =>
        pt.recipientId && [sourceRecipient1.id, sourceRecipient2.id].includes(pt.recipientId)
      ).length;

      results.orphanedRulesFound = this.ruleStore.rules.filter(rule => {
        const hasOrphanedCondition = rule.conditions.some(condition =>
          (condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
          typeof condition.value === 'string' && [sourceRecipient1.id, sourceRecipient2.id].includes(condition.value)
        );
        const hasOrphanedAction = rule.actions.some(action =>
          action.type === 'SET_RECIPIENT' &&
          typeof action.value === 'string' && [sourceRecipient1.id, sourceRecipient2.id].includes(action.value)
        );
        return hasOrphanedCondition || hasOrphanedAction;
      }).length;

      debugLog('CleanupTest', 'Orphaned data vor Merge gefunden', results);

      // 4. Führe Merge durch (sollte automatisch Cleanup auslösen)
      const mergeResult = await this.recipientStore.mergeRecipients(
        [sourceRecipient1.id, sourceRecipient2.id],
        targetRecipient
      );

      if (!mergeResult.success) {
        errors.push(`Merge fehlgeschlagen: ${mergeResult.errors.join(', ')}`);
        return { success: false, results, errors };
      }

      // 5. Validiere Cleanup-Ergebnisse
      if (mergeResult.cleanup) {
        results.cleanedTransactions = mergeResult.cleanup.cleanedTransactions;
        results.cleanedPlannings = mergeResult.cleanup.cleanedPlanningTransactions;
        results.cleanedRules = mergeResult.cleanup.cleanedRules;
      }

      // 6. Validiere dass keine orphaned data mehr existiert
      const remainingOrphanedTransactions = this.transactionStore.transactions.filter(t =>
        t.recipientId && [sourceRecipient1.id, sourceRecipient2.id].includes(t.recipientId)
      ).length;

      const remainingOrphanedPlannings = this.planningStore.planningTransactions.filter(pt =>
        pt.recipientId && [sourceRecipient1.id, sourceRecipient2.id].includes(pt.recipientId)
      ).length;

      const remainingOrphanedRules = this.ruleStore.rules.filter(rule => {
        const hasOrphanedCondition = rule.conditions.some(condition =>
          (condition.type === 'RECIPIENT_EQUALS' || condition.type === 'RECIPIENT_CONTAINS') &&
          typeof condition.value === 'string' && [sourceRecipient1.id, sourceRecipient2.id].includes(condition.value)
        );
        const hasOrphanedAction = rule.actions.some(action =>
          action.type === 'SET_RECIPIENT' &&
          typeof action.value === 'string' && [sourceRecipient1.id, sourceRecipient2.id].includes(action.value)
        );
        return hasOrphanedCondition || hasOrphanedAction;
      }).length;

      if (remainingOrphanedTransactions > 0) {
        errors.push(`${remainingOrphanedTransactions} orphaned Transactions nach Cleanup gefunden`);
      }

      if (remainingOrphanedPlannings > 0) {
        errors.push(`${remainingOrphanedPlannings} orphaned PlanningTransactions nach Cleanup gefunden`);
      }

      if (remainingOrphanedRules > 0) {
        errors.push(`${remainingOrphanedRules} orphaned AutomationRules nach Cleanup gefunden`);
      }

      const success = errors.length === 0;
      infoLog('CleanupTest', `Orphaned Data Cleanup Test ${success ? 'erfolgreich' : 'mit Fehlern'}`, {
        results,
        errors
      });

      return { success, results, errors };

    } catch (error) {
      const errorMsg = `Kritischer Fehler im Orphaned Data Cleanup Test: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      errorLog('CleanupTest', errorMsg, error);
      return { success: false, results, errors };
    }
  }

  /**
   * Test 2: Duplicate Detection nach Merge
   */
  async testDuplicateDetection(): Promise<{
    success: boolean;
    results: {
      duplicateTransactionsCreated: number;
      duplicatePlanningsCreated: number;
      duplicatesRemoved: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let results = {
      duplicateTransactionsCreated: 0,
      duplicatePlanningsCreated: 0,
      duplicatesRemoved: 0
    };

    try {
      infoLog('CleanupTest', 'Starte Test: Duplicate Detection');

      // 1. Erstelle Test-Recipients
      const sourceRecipient = CleanupTestDataGenerator.generateRecipient({ name: 'Duplicate Source' });
      const targetRecipient = CleanupTestDataGenerator.generateRecipient({ name: 'Duplicate Target' });

      await Promise.all([
        this.recipientStore.addRecipient(sourceRecipient),
        this.recipientStore.addRecipient(targetRecipient)
      ]);

      // 2. Erstelle identische Transaktionen für beide Recipients (werden zu Duplikaten nach Merge)
      const baseTransactionData = {
        accountId: 'test-account-duplicate',
        date: '2024-01-15',
        amount: -75.50,
        description: 'Duplicate Test Transaction'
      };

      const baseTransactionData2 = {
        accountId: 'test-account-duplicate',
        date: '2024-01-16',
        amount: -25.25,
        description: 'Another Duplicate Test Transaction'
      };

      // Erstelle mehrere identische Transaktionen
      const duplicateTransactions = [
        CleanupTestDataGenerator.generateTransaction(sourceRecipient.id, baseTransactionData),
        CleanupTestDataGenerator.generateTransaction(targetRecipient.id, baseTransactionData),
        CleanupTestDataGenerator.generateTransaction(sourceRecipient.id, baseTransactionData2),
        CleanupTestDataGenerator.generateTransaction(targetRecipient.id, baseTransactionData2)
      ];

      await Promise.all(duplicateTransactions.map(t => this.transactionStore.addTransaction(t)));
      results.duplicateTransactionsCreated = duplicateTransactions.length;

      // 3. Erstelle identische PlanningTransactions
      const basePlanningData = {
        accountId: 'test-account-duplicate',
        categoryId: 'test-category-duplicate',
        amount: -100.00,
        name: 'Duplicate Planning Test',
        recurrencePattern: RecurrencePattern.MONTHLY
      };

      const duplicatePlannings = [
        CleanupTestDataGenerator.generatePlanningTransaction(sourceRecipient.id, basePlanningData),
        CleanupTestDataGenerator.generatePlanningTransaction(targetRecipient.id, basePlanningData)
      ];

      await Promise.all(duplicatePlannings.map(p => this.planningStore.addPlanningTransaction(p)));
      results.duplicatePlanningsCreated = duplicatePlannings.length;

      debugLog('CleanupTest', 'Duplicate Test-Daten erstellt', results);

      // 4. Zähle Transaktionen vor Merge
      const transactionsBeforeMerge = this.transactionStore.transactions.length;
      const planningsBeforeMerge = this.planningStore.planningTransactions.length;

      // 5. Führe Merge durch
      const mergeResult = await this.recipientStore.mergeRecipients(
        [sourceRecipient.id],
        targetRecipient
      );

      if (!mergeResult.success) {
        errors.push(`Merge fehlgeschlagen: ${mergeResult.errors.join(', ')}`);
        return { success: false, results, errors };
      }

      // 6. Zähle Transaktionen nach Merge
      const transactionsAfterMerge = this.transactionStore.transactions.length;
      const planningsAfterMerge = this.planningStore.planningTransactions.length;

      // 7. Berechne entfernte Duplikate
      const removedTransactions = transactionsBeforeMerge - transactionsAfterMerge;
      const removedPlannings = planningsBeforeMerge - planningsAfterMerge;
      results.duplicatesRemoved = removedTransactions + removedPlannings;

      // 8. Validiere dass Duplikate entfernt wurden
      if (mergeResult.cleanup && mergeResult.cleanup.orphanedDataRemoved > 0) {
        debugLog('CleanupTest', `${mergeResult.cleanup.orphanedDataRemoved} Duplikate durch Cleanup entfernt`);
      }

      // 9. Prüfe auf verbleibende Duplikate
      const remainingTransactionsWithTarget = this.transactionStore.transactions.filter(t =>
        t.recipientId === targetRecipient.id
      );

      const duplicateGroups = new Map<string, Transaction[]>();
      remainingTransactionsWithTarget.forEach(transaction => {
        const key = `${transaction.accountId}-${transaction.date}-${transaction.amount}-${transaction.description}`;
        if (!duplicateGroups.has(key)) {
          duplicateGroups.set(key, []);
        }
        duplicateGroups.get(key)!.push(transaction);
      });

      const remainingDuplicates = Array.from(duplicateGroups.values()).filter(group => group.length > 1).length;
      if (remainingDuplicates > 0) {
        errors.push(`${remainingDuplicates} Duplicate-Gruppen nach Cleanup gefunden`);
      }

      const success = errors.length === 0;
      infoLog('CleanupTest', `Duplicate Detection Test ${success ? 'erfolgreich' : 'mit Fehlern'}`, {
        results,
        errors,
        transactionsBeforeMerge,
        transactionsAfterMerge,
        planningsBeforeMerge,
        planningsAfterMerge
      });

      return { success, results, errors };

    } catch (error) {
      const errorMsg = `Kritischer Fehler im Duplicate Detection Test: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      errorLog('CleanupTest', errorMsg, error);
      return { success: false, results, errors };
    }
  }

  /**
   * Test 3: Performance und Memory-Management
   */
  async testPerformanceAndMemory(): Promise<{
    success: boolean;
    results: {
      executionTime: number;
      memoryUsageBefore: number;
      memoryUsageAfter: number;
      memoryDelta: number;
      processedEntities: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    let results = {
      executionTime: 0,
      memoryUsageBefore: 0,
      memoryUsageAfter: 0,
      memoryDelta: 0,
      processedEntities: 0
    };

    try {
      infoLog('CleanupTest', 'Starte Test: Performance und Memory-Management');

      // 1. Memory-Baseline messen
      if (performance.memory) {
        results.memoryUsageBefore = performance.memory.usedJSHeapSize;
      }

      const startTime = performance.now();

      // 2. Erstelle viele Test-Entitäten für Performance-Test
      const sourceRecipients: Recipient[] = [];
      const targetRecipient = CleanupTestDataGenerator.generateRecipient({ name: 'Performance Target' });

      // Erstelle 10 Source-Recipients
      for (let i = 0; i < 10; i++) {
        const recipient = CleanupTestDataGenerator.generateRecipient({ name: `Performance Source ${i}` });
        sourceRecipients.push(recipient);
        await this.recipientStore.addRecipient(recipient);
      }

      await this.recipientStore.addRecipient(targetRecipient);

      // 3. Erstelle viele referenzierende Entitäten
      let entityCount = 0;
      for (const sourceRecipient of sourceRecipients) {
        // 5 Transactions pro Source-Recipient
        for (let j = 0; j < 5; j++) {
          const transaction = CleanupTestDataGenerator.generateTransaction(sourceRecipient.id, {
            description: `Performance Transaction ${j} for ${sourceRecipient.name}`
          });
          await this.transactionStore.addTransaction(transaction);
          entityCount++;
        }

        // 2 PlanningTransactions pro Source-Recipient
        for (let j = 0; j < 2; j++) {
          const planning = CleanupTestDataGenerator.generatePlanningTransaction(sourceRecipient.id, {
            name: `Performance Planning ${j} for ${sourceRecipient.name}`
          });
          await this.planningStore.addPlanningTransaction(planning);
          entityCount++;
        }

        // 1 AutomationRule pro Source-Recipient
        const rule = CleanupTestDataGenerator.generateAutomationRule(sourceRecipient.id);
        await this.ruleStore.addRule(rule);
        entityCount++;
      }

      results.processedEntities = entityCount;

      debugLog('CleanupTest', `Performance Test-Daten erstellt: ${entityCount} Entitäten für ${sourceRecipients.length} Recipients`);

      // 4. Führe Merge mit Performance-Messung durch
      const mergeStartTime = performance.now();

      const mergeResult = await this.recipientStore.mergeRecipients(
        sourceRecipients.map(r => r.id),
        targetRecipient
      );

      const mergeEndTime = performance.now();
      results.executionTime = Math.round(mergeEndTime - mergeStartTime);

      if (!mergeResult.success) {
        errors.push(`Performance Merge fehlgeschlagen: ${mergeResult.errors.join(', ')}`);
        return { success: false, results, errors };
      }

      // 5. Memory-Usage nach Cleanup messen
      if (performance.memory) {
        results.memoryUsageAfter = performance.memory.usedJSHeapSize;
        results.memoryDelta = results.memoryUsageAfter - results.memoryUsageBefore;
      }

      // 6. Performance-Validierung
      const maxAcceptableTime = 5000; // 5 Sekunden
      if (results.executionTime > maxAcceptableTime) {
        errors.push(`Cleanup zu langsam: ${results.executionTime}ms (max: ${maxAcceptableTime}ms)`);
      }

      // 7. Memory-Leak-Validierung
      const maxAcceptableMemoryIncrease = 50 * 1024 * 1024; // 50MB
      if (results.memoryDelta > maxAcceptableMemoryIncrease) {
        errors.push(`Möglicher Memory-Leak: ${Math.round(results.memoryDelta / 1024 / 1024)}MB Anstieg`);
      }

      // 8. Cleanup-Effizienz validieren
      if (mergeResult.cleanup) {
        const totalCleaned = mergeResult.cleanup.cleanedTransactions +
                           mergeResult.cleanup.cleanedPlanningTransactions +
                           mergeResult.cleanup.cleanedRules +
                           mergeResult.cleanup.orphanedDataRemoved;

        if (totalCleaned < entityCount * 0.8) { // Mindestens 80% sollten bereinigt werden
          errors.push(`Cleanup-Effizienz zu niedrig: ${totalCleaned}/${entityCount} Entitäten bereinigt`);
        }
      }

      const success = errors.length === 0;
      infoLog('CleanupTest', `Performance Test ${success ? 'erfolgreich' : 'mit Fehlern'}`, {
        results,
        errors,
        cleanup: mergeResult.cleanup
      });

      return { success, results, errors };

    } catch (error) {
      const errorMsg = `Kritischer Fehler im Performance Test: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      errorLog('CleanupTest', errorMsg, error);
      return { success: false, results, errors };
    }
  }

  /**
   * Führt alle Cleanup-Tests aus
   */
  async runAllCleanupTests(): Promise<{
    success: boolean;
    results: {
      orphanedDataTest: any;
      duplicateDetectionTest: any;
      performanceTest: any;
    };
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      totalErrors: number;
    };
  }> {
    infoLog('CleanupTest', '🧹 Starte umfassende Post-Merge-Cleanup Tests');

    try {
      // Setup
      MockCleanupServices.enableTestLogging();
      await MockCleanupServices.setupTestEnvironment();

      // Führe alle Tests aus
      const [orphanedDataTest, duplicateDetectionTest, performanceTest] = await Promise.all([
        this.testOrphanedDataCleanup(),
        this.testDuplicateDetection(),
        this.testPerformanceAndMemory()
      ]);

      // Zusammenfassung
      const results = {
        orphanedDataTest,
        duplicateDetectionTest,
        performanceTest
      };

      const summary = {
        totalTests: 3,
        passedTests: [orphanedDataTest, duplicateDetectionTest, performanceTest].filter(t => t.success).length,
        failedTests: [orphanedDataTest, duplicateDetectionTest, performanceTest].filter(t => !t.success).length,
        totalErrors: orphanedDataTest.errors.length + duplicateDetectionTest.errors.length + performanceTest.errors.length
      };

      const overallSuccess = summary.failedTests === 0;

      // Cleanup
      await MockCleanupServices.cleanupTestEnvironment();
      MockCleanupServices.disableTestLogging();

      infoLog('CleanupTest', `🧹 Post-Merge-Cleanup Tests abgeschlossen: ${overallSuccess ? '✅ ERFOLGREICH' : '❌ MIT FEHLERN'}`, {
        summary,
        results: {
          orphanedDataTest: { success: orphanedDataTest.success, errors: orphanedDataTest.errors.length },
          duplicateDetectionTest: { success: duplicateDetectionTest.success, errors: duplicateDetectionTest.errors.length },
          performanceTest: { success: performanceTest.success, errors: performanceTest.errors.length }
        }
      });

      return {
        success: overallSuccess,
        results,
        summary
      };

    } catch (error) {
      errorLog('CleanupTest', 'Kritischer Fehler beim Ausführen der Cleanup-Tests', error);

      // Cleanup auch bei Fehlern
      try {
        await MockCleanupServices.cleanupTestEnvironment();
        MockCleanupServices.disableTestLogging();
      } catch (cleanupError) {
        errorLog('CleanupTest', 'Fehler beim Test-Cleanup', cleanupError);
      }

      return {
        success: false,
        results: {
          orphanedDataTest: { success: false, results: {}, errors: ['Test nicht ausgeführt'] },
          duplicateDetectionTest: { success: false, results: {}, errors: ['Test nicht ausgeführt'] },
          performanceTest: { success: false, results: {}, errors: ['Test nicht ausgeführt'] }
        },
        summary: {
          totalTests: 3,
          passedTests: 0,
          failedTests: 3,
          totalErrors: 1
        }
      };
    }
  }
}

// Export für manuelle Tests
export const cleanupTester = new RecipientMergeCleanupTester();

// Automatischer Test-Start (kann auskommentiert werden)
if (typeof window !== 'undefined') {
  // Nur im Browser ausführen
  console.log('🧹 Post-Merge-Cleanup Tester geladen. Verwende cleanupTester.runAllCleanupTests() zum Starten.');
}
