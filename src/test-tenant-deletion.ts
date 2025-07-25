/**
 * Test-Skript für die Mandanten-Löschfunktionalität
 *
 * Dieses Skript testet die vollständige Mandanten-Löschung:
 * 1. Frontend-Signal an Backend
 * 2. Backend-Datenbankfreigabe
 * 3. Vollständige Löschung von Frontend und Backend
 */

import { useTenantStore } from '@/stores/tenantStore';
import { useSessionStore } from '@/stores/sessionStore';
import { WebSocketService } from '@/services/WebSocketService';
import { infoLog, errorLog, debugLog } from '@/utils/logger';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  error?: any;
}

class TenantDeletionTester {
  private results: TestResult[] = [];

  private addResult(step: string, success: boolean, message: string, error?: any) {
    this.results.push({ step, success, message, error });
    if (success) {
      infoLog('TenantDeletionTester', `✅ ${step}: ${message}`);
    } else {
      errorLog('TenantDeletionTester', `❌ ${step}: ${message}`, error);
    }
  }

  async testTenantDisconnectSignal(tenantId: string): Promise<boolean> {
    try {
      debugLog('TenantDeletionTester', 'Testing tenant disconnect signal', { tenantId });

      const success = WebSocketService.sendTenantDisconnect(tenantId, 'test_deletion');

      if (success) {
        this.addResult(
          'Tenant Disconnect Signal',
          true,
          `Signal erfolgreich an Backend gesendet für Tenant ${tenantId}`
        );
        return true;
      } else {
        this.addResult(
          'Tenant Disconnect Signal',
          false,
          'WebSocket nicht verbunden oder Signal konnte nicht gesendet werden'
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'Tenant Disconnect Signal',
        false,
        'Fehler beim Senden des Disconnect-Signals',
        error
      );
      return false;
    }
  }

  async testLocalTenantDeletion(tenantId: string): Promise<boolean> {
    try {
      debugLog('TenantDeletionTester', 'Testing local tenant deletion', { tenantId });

      const tenantStore = useTenantStore();
      const success = await tenantStore.deleteTenant(tenantId);

      if (success) {
        this.addResult(
          'Local Tenant Deletion',
          true,
          `Lokale Löschung erfolgreich für Tenant ${tenantId}`
        );
        return true;
      } else {
        this.addResult(
          'Local Tenant Deletion',
          false,
          'Lokale Löschung fehlgeschlagen'
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'Local Tenant Deletion',
        false,
        'Fehler bei lokaler Löschung',
        error
      );
      return false;
    }
  }

  async testCompleteTenantDeletion(tenantId: string, userId: string): Promise<boolean> {
    try {
      debugLog('TenantDeletionTester', 'Testing complete tenant deletion', { tenantId, userId });

      const tenantStore = useTenantStore();
      const success = await (tenantStore as any).deleteTenantCompletely(tenantId, userId);

      if (success) {
        this.addResult(
          'Complete Tenant Deletion',
          true,
          `Vollständige Löschung erfolgreich für Tenant ${tenantId}`
        );
        return true;
      } else {
        this.addResult(
          'Complete Tenant Deletion',
          false,
          'Vollständige Löschung fehlgeschlagen'
        );
        return false;
      }
    } catch (error) {
      this.addResult(
        'Complete Tenant Deletion',
        false,
        'Fehler bei vollständiger Löschung',
        error
      );
      return false;
    }
  }

  async testSessionLogout(): Promise<boolean> {
    try {
      debugLog('TenantDeletionTester', 'Testing session tenant logout');

      const sessionStore = useSessionStore();
      await sessionStore.logoutTenant();

      this.addResult(
        'Session Tenant Logout',
        true,
        'Tenant-Logout erfolgreich durchgeführt'
      );
      return true;
    } catch (error) {
      this.addResult(
        'Session Tenant Logout',
        false,
        'Fehler beim Tenant-Logout',
        error
      );
      return false;
    }
  }

  async runAllTests(tenantId: string, userId: string): Promise<void> {
    infoLog('TenantDeletionTester', '🧪 Starte Mandanten-Löschung Tests', { tenantId, userId });

    this.results = [];

    // Test 1: Tenant Disconnect Signal
    await this.testTenantDisconnectSignal(tenantId);

    // Test 2: Session Logout
    await this.testSessionLogout();

    // Test 3: Complete Tenant Deletion (beinhaltet Backend-Signal)
    await this.testCompleteTenantDeletion(tenantId, userId);

    // Ergebnisse zusammenfassen
    this.printResults();
  }

  async runIndividualTests(tenantId: string, userId: string): Promise<void> {
    infoLog('TenantDeletionTester', '🧪 Starte individuelle Mandanten-Tests', { tenantId, userId });

    this.results = [];

    // Test 1: Nur Disconnect Signal
    await this.testTenantDisconnectSignal(tenantId);

    // Pause für Backend-Verarbeitung
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Nur lokale Löschung
    await this.testLocalTenantDeletion(tenantId);

    this.printResults();
  }

  private printResults(): void {
    const successCount = this.results.filter(r => r.success).length;
    const totalCount = this.results.length;

    infoLog('TenantDeletionTester', '📊 Test-Ergebnisse:', {
      successful: successCount,
      total: totalCount,
      success_rate: `${Math.round((successCount / totalCount) * 100)}%`
    });

    console.group('🧪 Detaillierte Test-Ergebnisse:');
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.step}: ${result.message}`);
      if (result.error) {
        console.error('   Fehler:', result.error);
      }
    });
    console.groupEnd();

    if (successCount === totalCount) {
      infoLog('TenantDeletionTester', '🎉 Alle Tests erfolgreich!');
    } else {
      errorLog('TenantDeletionTester', `⚠️ ${totalCount - successCount} von ${totalCount} Tests fehlgeschlagen`);
    }
  }

  getResults(): TestResult[] {
    return [...this.results];
  }
}

// Export für Verwendung in der Konsole oder anderen Tests
export { TenantDeletionTester };

// Hilfsfunktionen für manuelle Tests
export async function testTenantDeletion(tenantId: string, userId: string) {
  const tester = new TenantDeletionTester();
  await tester.runAllTests(tenantId, userId);
  return tester.getResults();
}

export async function testTenantDisconnectOnly(tenantId: string) {
  const tester = new TenantDeletionTester();
  await tester.testTenantDisconnectSignal(tenantId);
  return tester.getResults();
}

export async function testIndividualSteps(tenantId: string, userId: string) {
  const tester = new TenantDeletionTester();
  await tester.runIndividualTests(tenantId, userId);
  return tester.getResults();
}

// Für Konsolen-Verwendung
if (typeof window !== 'undefined') {
  (window as any).testTenantDeletion = testTenantDeletion;
  (window as any).testTenantDisconnectOnly = testTenantDisconnectOnly;
  (window as any).testIndividualSteps = testIndividualSteps;

  console.log('🧪 Tenant Deletion Tests verfügbar:');
  console.log('- testTenantDeletion(tenantId, userId)');
  console.log('- testTenantDisconnectOnly(tenantId)');
  console.log('- testIndividualSteps(tenantId, userId)');
}
