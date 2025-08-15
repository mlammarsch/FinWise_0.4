// BudgetPerformanceTest - Validiert Performance-Verbesserungen
import { optimizedBudgetService } from '@/services/OptimizedBudgetService';
import { BudgetService } from '@/services/BudgetService';
import { budgetWorkerService } from '@/services/BudgetWorkerService';

interface PerformanceTestResult {
  testName: string;
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  improvementPercent: number;
}

class BudgetPerformanceTest {
  private results: PerformanceTestResult[] = [];

  // Generiere Test-Daten
  private generateTestData(transactionCount: number, categoryCount: number) {
    const transactions = [];
    const categories = [];
    const months = [];

    // Generiere Kategorien
    for (let i = 0; i < categoryCount; i++) {
      categories.push({
        id: `cat_${i}`,
        name: `Category ${i}`,
        isIncomeCategory: i % 10 === 0 // 10% Income-Kategorien
      });
    }

    // Generiere Transaktionen
    const startDate = new Date('2024-01-01');
    for (let i = 0; i < transactionCount; i++) {
      const randomDays = Math.floor(Math.random() * 365);
      const date = new Date(startDate);
      date.setDate(date.getDate() + randomDays);

      transactions.push({
        id: `tx_${i}`,
        categoryId: categories[Math.floor(Math.random() * categoryCount)].id,
        amount: Math.random() * 1000 - 500, // -500 bis +500
        valueDate: date.toISOString().split('T')[0],
        type: Math.random() > 0.8 ? 'CATEGORYTRANSFER' : 'EXPENSE'
      });
    }

    // Generiere Test-Monate
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(2024, month, 1);
      const monthEnd = new Date(2024, month + 1, 0);
      months.push({
        key: `2024-${month.toString().padStart(2, '0')}`,
        start: monthStart,
        end: monthEnd
      });
    }

    return { transactions, categories, months };
  }

  // Test: Einzelne Budget-Berechnung
  async testSingleCategoryCalculation(): Promise<void> {
    console.log('🧪 Testing single category calculation...');

    const { transactions, categories, months } = this.generateTestData(1000, 85);
    const testCategory = categories[0];
    const testMonth = months[0];

    // Original-Implementierung
    const originalStart = performance.now();
    for (let i = 0; i < 100; i++) {
      BudgetService.getAggregatedMonthlyBudgetData(
        testCategory.id,
        testMonth.start,
        testMonth.end
      );
    }
    const originalTime = performance.now() - originalStart;

    // Optimierte Implementierung
    await optimizedBudgetService.initializeWorker();
    const optimizedStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await optimizedBudgetService.getOptimizedBudgetData(
        testCategory.id,
        testMonth.start,
        testMonth.end
      );
    }
    const optimizedTime = performance.now() - optimizedStart;

    this.addResult('Single Category Calculation (100x)', originalTime, optimizedTime);
  }

  // Test: Batch-Verarbeitung
  async testBatchProcessing(): Promise<void> {
    console.log('🧪 Testing batch processing...');

    const { transactions, categories, months } = this.generateTestData(1000, 85);

    // Erstelle Batch-Requests
    const requests = categories.slice(0, 50).flatMap(cat =>
      months.slice(0, 3).map(month => ({
        categoryId: cat.id,
        monthStart: month.start,
        monthEnd: month.end
      }))
    ); // 50 Kategorien × 3 Monate = 150 Requests

    // Original: Sequenzielle Verarbeitung
    const originalStart = performance.now();
    for (const req of requests) {
      BudgetService.getAggregatedMonthlyBudgetData(
        req.categoryId,
        req.monthStart,
        req.monthEnd
      );
    }
    const originalTime = performance.now() - originalStart;

    // Optimiert: Batch-Verarbeitung
    const optimizedStart = performance.now();
    await optimizedBudgetService.getBatchBudgetData(requests);
    const optimizedTime = performance.now() - optimizedStart;

    this.addResult('Batch Processing (150 requests)', originalTime, optimizedTime);
  }

  // Test: Cache-Effizienz
  async testCacheEfficiency(): Promise<void> {
    console.log('🧪 Testing cache efficiency...');

    const { categories, months } = this.generateTestData(1000, 85);
    const testCategory = categories[0];
    const testMonth = months[0];

    // Erste Berechnung (Cache-Miss)
    const firstCallStart = performance.now();
    await optimizedBudgetService.getOptimizedBudgetData(
      testCategory.id,
      testMonth.start,
      testMonth.end
    );
    const firstCallTime = performance.now() - firstCallStart;

    // Zweite Berechnung (Cache-Hit)
    const secondCallStart = performance.now();
    await optimizedBudgetService.getOptimizedBudgetData(
      testCategory.id,
      testMonth.start,
      testMonth.end
    );
    const secondCallTime = performance.now() - secondCallStart;

    this.addResult('Cache Efficiency (2nd call)', firstCallTime, secondCallTime);
  }

  // Test: Worker vs. Sync Performance
  async testWorkerPerformance(): Promise<void> {
    console.log('🧪 Testing worker performance...');

    const { transactions, categories, months } = this.generateTestData(2000, 85);
    const testRequests = categories.slice(0, 20).map(cat => ({
      categoryId: cat.id,
      monthStart: months[0].start,
      monthEnd: months[0].end
    }));

    // Sync-Verarbeitung (Worker deaktiviert)
    budgetWorkerService.terminate();
    const syncStart = performance.now();
    await optimizedBudgetService.getBatchBudgetData(testRequests);
    const syncTime = performance.now() - syncStart;

    // Worker-Verarbeitung
    await optimizedBudgetService.initializeWorker();
    optimizedBudgetService.invalidateCache(); // Cache leeren für fairen Vergleich
    const workerStart = performance.now();
    await optimizedBudgetService.getBatchBudgetData(testRequests);
    const workerTime = performance.now() - workerStart;

    this.addResult('Worker vs Sync (20 categories)', syncTime, workerTime);
  }

  // Test: Memory Usage
  testMemoryUsage(): void {
    console.log('🧪 Testing memory usage...');

    if ('memory' in performance) {
      const memBefore = (performance as any).memory.usedJSHeapSize;

      // Generiere große Datenmengen
      this.generateTestData(5000, 200);

      const memAfter = (performance as any).memory.usedJSHeapSize;
      const memoryIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

      console.log(`📊 Memory increase: ${memoryIncrease.toFixed(2)} MB`);
    } else {
      console.log('⚠️ Memory measurement not available in this environment');
    }
  }

  private addResult(testName: string, originalTime: number, optimizedTime: number): void {
    const improvement = originalTime - optimizedTime;
    const improvementPercent = ((improvement / originalTime) * 100);

    this.results.push({
      testName,
      originalTime,
      optimizedTime,
      improvement,
      improvementPercent
    });

    console.log(`✅ ${testName}:`);
    console.log(`   Original: ${originalTime.toFixed(2)}ms`);
    console.log(`   Optimized: ${optimizedTime.toFixed(2)}ms`);
    console.log(`   Improvement: ${improvement.toFixed(2)}ms (${improvementPercent.toFixed(1)}%)`);
  }

  // Führe alle Tests aus
  async runAllTests(): Promise<PerformanceTestResult[]> {
    console.log('🚀 Starting Budget Performance Tests...\n');

    try {
      await this.testSingleCategoryCalculation();
      await this.testBatchProcessing();
      await this.testCacheEfficiency();
      await this.testWorkerPerformance();
      this.testMemoryUsage();

      this.printSummary();
      return this.results;
    } catch (error) {
      console.error('❌ Performance test failed:', error);
      throw error;
    }
  }

  private printSummary(): void {
    console.log('\n📊 Performance Test Summary:');
    console.log('='.repeat(60));

    let totalOriginalTime = 0;
    let totalOptimizedTime = 0;

    this.results.forEach(result => {
      totalOriginalTime += result.originalTime;
      totalOptimizedTime += result.optimizedTime;

      const status = result.improvementPercent > 0 ? '✅' : '❌';
      console.log(`${status} ${result.testName}: ${result.improvementPercent.toFixed(1)}% improvement`);
    });

    const overallImprovement = ((totalOriginalTime - totalOptimizedTime) / totalOriginalTime) * 100;
    console.log('='.repeat(60));
    console.log(`🎯 Overall Performance Improvement: ${overallImprovement.toFixed(1)}%`);
    console.log(`   Total Original Time: ${totalOriginalTime.toFixed(2)}ms`);
    console.log(`   Total Optimized Time: ${totalOptimizedTime.toFixed(2)}ms`);
    console.log(`   Time Saved: ${(totalOriginalTime - totalOptimizedTime).toFixed(2)}ms`);
  }
}

// Export für Verwendung in Tests oder Development
export const budgetPerformanceTest = new BudgetPerformanceTest();

// Automatischer Test in Development-Umgebung
if (typeof window !== 'undefined') {
  // Füge globale Test-Funktion hinzu
  (window as any).runBudgetPerformanceTest = () => {
    return budgetPerformanceTest.runAllTests();
  };

  console.log('🧪 Budget Performance Test available: window.runBudgetPerformanceTest()');
}
