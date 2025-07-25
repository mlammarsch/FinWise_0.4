// Datei: src/test-automation-rule-recipient-validation.ts
// Test-Suite für AutomationRule Recipient-Validierung

import { useRuleStore } from '@/stores/ruleStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { useTenantStore } from '@/stores/tenantStore';
import { AutomationRule, RuleConditionType, RuleActionType } from '@/types';
import { debugLog, infoLog, errorLog } from '@/utils/logger';

interface TestAutomationRuleRecipientValidation {
  runAllTests(): Promise<void>;
  testGetAutomationRulesWithRecipient(): Promise<void>;
  testCountAutomationRulesWithRecipient(): Promise<void>;
  testValidateRecipientDeletion(): Promise<void>;
  testCleanupRecipientReferences(): Promise<void>;
  showAutomationRuleRecipientOverview(): Promise<void>;
  createTestData(): Promise<{ recipientIds: string[], ruleIds: string[] }>;
  cleanupTestData(recipientIds: string[], ruleIds: string[]): Promise<void>;
}

const testAutomationRuleRecipientValidation: TestAutomationRuleRecipientValidation = {
  async runAllTests(): Promise<void> {
    console.log('🧪 Starte AutomationRule Recipient-Validierung Tests...');

    try {
      await this.testGetAutomationRulesWithRecipient();
      await this.testCountAutomationRulesWithRecipient();
      await this.testValidateRecipientDeletion();
      await this.testCleanupRecipientReferences();
      await this.showAutomationRuleRecipientOverview();

      console.log('✅ Alle AutomationRule Recipient-Validierung Tests erfolgreich!');
    } catch (error) {
      console.error('❌ Fehler bei AutomationRule Recipient-Validierung Tests:', error);
      throw error;
    }
  },

  async testGetAutomationRulesWithRecipient(): Promise<void> {
    console.log('\n📋 Test: getAutomationRulesWithRecipient');

    const ruleStore = useRuleStore();
    const { recipientIds, ruleIds } = await this.createTestData();

    try {
      // Test 1: Recipient mit Referenzen
      const rulesWithRecipient = await ruleStore.getAutomationRulesWithRecipient(recipientIds[0]);
      console.log(`✅ Gefunden: ${rulesWithRecipient.length} Rules mit Recipient ${recipientIds[0]}`);

      if (rulesWithRecipient.length > 0) {
        console.log('   Rules:', rulesWithRecipient.map(r => `"${r.name}" (${r.id})`).join(', '));
      }

      // Test 2: Recipient ohne Referenzen
      const rulesWithoutRecipient = await ruleStore.getAutomationRulesWithRecipient(recipientIds[2]);
      console.log(`✅ Gefunden: ${rulesWithoutRecipient.length} Rules mit Recipient ${recipientIds[2]} (erwartet: 0)`);

      // Test 3: Ungültige Recipient-ID
      const rulesInvalid = await ruleStore.getAutomationRulesWithRecipient('invalid-id');
      console.log(`✅ Gefunden: ${rulesInvalid.length} Rules mit ungültiger ID (erwartet: 0)`);

    } finally {
      await this.cleanupTestData(recipientIds, ruleIds);
    }
  },

  async testCountAutomationRulesWithRecipient(): Promise<void> {
    console.log('\n🔢 Test: countAutomationRulesWithRecipient');

    const ruleStore = useRuleStore();
    const { recipientIds, ruleIds } = await this.createTestData();

    try {
      // Test 1: Recipient mit Referenzen
      const countWithRecipient = await ruleStore.countAutomationRulesWithRecipient(recipientIds[0]);
      console.log(`✅ Anzahl Rules mit Recipient ${recipientIds[0]}: ${countWithRecipient}`);

      // Test 2: Recipient ohne Referenzen
      const countWithoutRecipient = await ruleStore.countAutomationRulesWithRecipient(recipientIds[2]);
      console.log(`✅ Anzahl Rules mit Recipient ${recipientIds[2]}: ${countWithoutRecipient} (erwartet: 0)`);

      // Test 3: Performance-Vergleich
      const startTime = performance.now();
      for (let i = 0; i < 10; i++) {
        await ruleStore.countAutomationRulesWithRecipient(recipientIds[0]);
      }
      const endTime = performance.now();
      console.log(`✅ Performance: 10 Count-Operationen in ${(endTime - startTime).toFixed(2)}ms`);

    } finally {
      await this.cleanupTestData(recipientIds, ruleIds);
    }
  },

  async testValidateRecipientDeletion(): Promise<void> {
    console.log('\n🔍 Test: validateRecipientDeletion');

    const ruleStore = useRuleStore();
    const { recipientIds, ruleIds } = await this.createTestData();

    try {
      // Test 1: Einzelner Recipient mit Referenzen
      const singleResult = await ruleStore.validateRecipientDeletion([recipientIds[0]]);
      console.log(`✅ Validierung für 1 Recipient:`, {
        recipientId: singleResult[0].recipientId,
        recipientName: singleResult[0].recipientName,
        automationRuleCount: singleResult[0].automationRuleCount,
        hasActiveReferences: singleResult[0].hasActiveReferences,
        canDelete: singleResult[0].canDelete,
        warnings: singleResult[0].warnings
      });

      // Test 2: Mehrere Recipients (Batch-Validierung)
      const batchResults = await ruleStore.validateRecipientDeletion(recipientIds);
      console.log(`✅ Batch-Validierung für ${recipientIds.length} Recipients:`);

      batchResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.recipientName}:`, {
          automationRuleCount: result.automationRuleCount,
          canDelete: result.canDelete,
          warnings: result.warnings.length
        });
      });

      // Test 3: Leeres Array
      const emptyResults = await ruleStore.validateRecipientDeletion([]);
      console.log(`✅ Validierung für leeres Array: ${emptyResults.length} Ergebnisse (erwartet: 0)`);

      // Test 4: Ungültige IDs
      const invalidResults = await ruleStore.validateRecipientDeletion(['invalid-1', 'invalid-2']);
      console.log(`✅ Validierung für ungültige IDs: ${invalidResults.length} Ergebnisse`);

    } finally {
      await this.cleanupTestData(recipientIds, ruleIds);
    }
  },

  async testCleanupRecipientReferences(): Promise<void> {
    console.log('\n🧹 Test: cleanupRecipientReferences');

    const ruleStore = useRuleStore();
    const { recipientIds, ruleIds } = await this.createTestData();

    try {
      // Test 1: Vor der Bereinigung - Zähle Referenzen
      const beforeCount = await ruleStore.countAutomationRulesWithRecipient(recipientIds[0]);
      console.log(`✅ Vor Bereinigung: ${beforeCount} Rules mit Recipient ${recipientIds[0]}`);

      // Test 2: Bereinigung durchführen
      await ruleStore.cleanupRecipientReferences(recipientIds[0]);
      console.log(`✅ Bereinigung für Recipient ${recipientIds[0]} durchgeführt`);

      // Test 3: Nach der Bereinigung - Zähle Referenzen
      const afterCount = await ruleStore.countAutomationRulesWithRecipient(recipientIds[0]);
      console.log(`✅ Nach Bereinigung: ${afterCount} Rules mit Recipient ${recipientIds[0]} (erwartet: 0)`);

      // Test 4: Prüfe ob Rules noch existieren (aber bereinigt)
      const allRules = ruleStore.rules;
      const originalRuleCount = ruleIds.length;
      const currentRuleCount = allRules.filter(rule => ruleIds.includes(rule.id)).length;
      console.log(`✅ Rules nach Bereinigung: ${currentRuleCount}/${originalRuleCount} noch vorhanden`);

      // Test 5: Prüfe deaktivierte Rules
      const deactivatedRules = allRules.filter(rule =>
        ruleIds.includes(rule.id) && !rule.isActive
      );
      console.log(`✅ Deaktivierte Rules: ${deactivatedRules.length}`);

      if (deactivatedRules.length > 0) {
        console.log('   Deaktivierte Rules:', deactivatedRules.map(r => `"${r.name}"`).join(', '));
      }

      // Test 6: Bereinigung für Recipient ohne Referenzen
      await ruleStore.cleanupRecipientReferences(recipientIds[2]);
      console.log(`✅ Bereinigung für Recipient ohne Referenzen durchgeführt (sollte keine Änderungen machen)`);

    } finally {
      await this.cleanupTestData(recipientIds, ruleIds);
    }
  },

  async showAutomationRuleRecipientOverview(): Promise<void> {
    console.log('\n📊 AutomationRule-Recipient-Referenz Übersicht');

    const ruleStore = useRuleStore();
    const recipientStore = useRecipientStore();

    const allRules = ruleStore.rules;
    const allRecipients = recipientStore.recipients;

    console.log(`📋 Gesamt: ${allRules.length} AutomationRules, ${allRecipients.length} Recipients`);

    // Analysiere Recipient-Referenzen in Rules
    let rulesWithRecipientConditions = 0;
    let rulesWithRecipientActions = 0;
    let totalRecipientReferences = 0;

    const recipientUsage = new Map<string, { name: string, conditionCount: number, actionCount: number, ruleNames: string[] }>();

    for (const rule of allRules) {
      let hasRecipientCondition = false;
      let hasRecipientAction = false;

      // Analysiere Conditions
      for (const condition of rule.conditions) {
        if (condition.type === RuleConditionType.RECIPIENT_EQUALS ||
            condition.type === RuleConditionType.RECIPIENT_CONTAINS) {
          hasRecipientCondition = true;
          totalRecipientReferences++;

          const recipientId = String(condition.value);
          const recipient = allRecipients.find(r => r.id === recipientId);
          const recipientName = recipient?.name || `Unbekannt (${recipientId})`;

          if (!recipientUsage.has(recipientId)) {
            recipientUsage.set(recipientId, {
              name: recipientName,
              conditionCount: 0,
              actionCount: 0,
              ruleNames: []
            });
          }

          const usage = recipientUsage.get(recipientId)!;
          usage.conditionCount++;
          if (!usage.ruleNames.includes(rule.name)) {
            usage.ruleNames.push(rule.name);
          }
        }
      }

      // Analysiere Actions
      for (const action of rule.actions) {
        if (action.type === RuleActionType.SET_RECIPIENT) {
          hasRecipientAction = true;
          totalRecipientReferences++;

          const recipientId = String(action.value);
          const recipient = allRecipients.find(r => r.id === recipientId);
          const recipientName = recipient?.name || `Unbekannt (${recipientId})`;

          if (!recipientUsage.has(recipientId)) {
            recipientUsage.set(recipientId, {
              name: recipientName,
              conditionCount: 0,
              actionCount: 0,
              ruleNames: []
            });
          }

          const usage = recipientUsage.get(recipientId)!;
          usage.actionCount++;
          if (!usage.ruleNames.includes(rule.name)) {
            usage.ruleNames.push(rule.name);
          }
        }
      }

      if (hasRecipientCondition) rulesWithRecipientConditions++;
      if (hasRecipientAction) rulesWithRecipientActions++;
    }

    console.log(`📊 Rules mit Recipient-Conditions: ${rulesWithRecipientConditions}`);
    console.log(`📊 Rules mit Recipient-Actions: ${rulesWithRecipientActions}`);
    console.log(`📊 Gesamt Recipient-Referenzen: ${totalRecipientReferences}`);
    console.log(`📊 Recipients mit Referenzen: ${recipientUsage.size}`);

    if (recipientUsage.size > 0) {
      console.log('\n📋 Recipient-Verwendung Details:');
      Array.from(recipientUsage.entries())
        .sort(([,a], [,b]) => (b.conditionCount + b.actionCount) - (a.conditionCount + a.actionCount))
        .forEach(([recipientId, usage]) => {
          console.log(`   ${usage.name} (${recipientId}):`);
          console.log(`     - ${usage.conditionCount} Condition(s), ${usage.actionCount} Action(s)`);
          console.log(`     - Verwendet in: ${usage.ruleNames.join(', ')}`);
        });
    }
  },

  async createTestData(): Promise<{ recipientIds: string[], ruleIds: string[] }> {
    debugLog('TestAutomationRuleRecipientValidation', 'Erstelle Test-Daten...');

    const recipientStore = useRecipientStore();
    const ruleStore = useRuleStore();

    // Erstelle Test-Recipients
    const testRecipients = [
      { name: 'Test Recipient 1', note: 'Für Condition-Tests' },
      { name: 'Test Recipient 2', note: 'Für Action-Tests' },
      { name: 'Test Recipient 3', note: 'Ohne Referenzen' }
    ];

    const recipientIds: string[] = [];
    for (const recipientData of testRecipients) {
      const recipient = await recipientStore.addRecipient(recipientData);
      recipientIds.push(recipient.id);
    }

    // Erstelle Test-AutomationRules
    const testRules: Omit<AutomationRule, 'id' | 'updatedAt'>[] = [
      {
        name: 'Test Rule - Recipient Condition',
        description: 'Rule mit Recipient-Condition',
        stage: 'DEFAULT',
        conditions: [
          {
            type: RuleConditionType.RECIPIENT_EQUALS,
            operator: 'is',
            value: recipientIds[0]
          }
        ],
        actions: [
          {
            type: RuleActionType.SET_CATEGORY,
            value: 'test-category-id'
          }
        ],
        priority: 1,
        isActive: true
      },
      {
        name: 'Test Rule - Recipient Action',
        description: 'Rule mit Recipient-Action',
        stage: 'DEFAULT',
        conditions: [
          {
            type: RuleConditionType.AMOUNT_GREATER,
            operator: 'greater',
            value: 100
          }
        ],
        actions: [
          {
            type: RuleActionType.SET_RECIPIENT,
            value: recipientIds[1]
          }
        ],
        priority: 2,
        isActive: true
      },
      {
        name: 'Test Rule - Both Recipient References',
        description: 'Rule mit Recipient-Condition und -Action',
        stage: 'DEFAULT',
        conditions: [
          {
            type: RuleConditionType.RECIPIENT_CONTAINS,
            operator: 'contains',
            value: recipientIds[0]
          }
        ],
        actions: [
          {
            type: RuleActionType.SET_RECIPIENT,
            value: recipientIds[1]
          },
          {
            type: RuleActionType.SET_NOTE,
            value: 'Auto-processed'
          }
        ],
        priority: 3,
        isActive: true
      },
      {
        name: 'Test Rule - No Recipient References',
        description: 'Rule ohne Recipient-Referenzen',
        stage: 'DEFAULT',
        conditions: [
          {
            type: RuleConditionType.AMOUNT_LESS,
            operator: 'less',
            value: 50
          }
        ],
        actions: [
          {
            type: RuleActionType.SET_NOTE,
            value: 'Small amount'
          }
        ],
        priority: 4,
        isActive: true
      }
    ];

    const ruleIds: string[] = [];
    for (const ruleData of testRules) {
      const rule = await ruleStore.addRule(ruleData);
      ruleIds.push(rule.id);
    }

    debugLog('TestAutomationRuleRecipientValidation', 'Test-Daten erstellt', {
      recipientCount: recipientIds.length,
      ruleCount: ruleIds.length,
      recipientIds,
      ruleIds
    });

    return { recipientIds, ruleIds };
  },

  async cleanupTestData(recipientIds: string[], ruleIds: string[]): Promise<void> {
    debugLog('TestAutomationRuleRecipientValidation', 'Bereinige Test-Daten...', {
      recipientIds,
      ruleIds
    });

    const recipientStore = useRecipientStore();
    const ruleStore = useRuleStore();

    // Lösche Test-Rules
    for (const ruleId of ruleIds) {
      try {
        await ruleStore.deleteRule(ruleId);
      } catch (error) {
        console.warn(`Fehler beim Löschen von Rule ${ruleId}:`, error);
      }
    }

    // Lösche Test-Recipients
    for (const recipientId of recipientIds) {
      try {
        await recipientStore.deleteRecipient(recipientId);
      } catch (error) {
        console.warn(`Fehler beim Löschen von Recipient ${recipientId}:`, error);
      }
    }

    debugLog('TestAutomationRuleRecipientValidation', 'Test-Daten bereinigt');
  }
};

// Globale Verfügbarkeit für Browser-Konsole
(window as any).testAutomationRuleRecipientValidation = testAutomationRuleRecipientValidation;

export { testAutomationRuleRecipientValidation };
export type { TestAutomationRuleRecipientValidation };
