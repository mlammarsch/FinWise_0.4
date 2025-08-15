// BudgetWorkerService - Verwaltet Web Worker für asynchrone Budget-Berechnungen
import { debugLog, errorLog } from '@/utils/logger';

interface WorkerRequest {
  type: string;
  data: any;
  requestId: string;
}

interface WorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'READY';
  requestId?: string;
  result?: any;
  error?: string;
}

class BudgetWorkerService {
  private worker: Worker | null = null;
  private isReady = false;
  private requestCounter = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  private readonly REQUEST_TIMEOUT = 10000; // 10 Sekunden Timeout

  constructor() {
    // Verzögere Initialisierung bis Pinia verfügbar ist
    // this.initializeWorker(); // Entfernt - wird manuell aufgerufen
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker('/budget-worker.js');
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      debugLog('[BudgetWorkerService]', 'Worker initialized');
    } catch (error) {
      errorLog('[BudgetWorkerService]', 'Failed to initialize worker', error);
      this.worker = null;
    }
  }

  private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const { type, requestId, result, error } = event.data;

    if (type === 'READY') {
      this.isReady = true;
      console.debug('[BudgetWorkerService] Worker is ready');
      return;
    }

    if (!requestId) return;

    const request = this.pendingRequests.get(requestId);
    if (!request) return;

    clearTimeout(request.timeout);
    this.pendingRequests.delete(requestId);

    if (type === 'SUCCESS') {
      request.resolve(result);
    } else if (type === 'ERROR') {
      request.reject(new Error(error || 'Unknown worker error'));
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    console.error('[BudgetWorkerService] Worker error', error);

    // Alle pending requests mit Fehler beenden
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker error'));
    });
    this.pendingRequests.clear();
  }

  private sendMessage(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.isReady) {
        reject(new Error('Worker not available'));
        return;
      }

      const requestId = `req_${++this.requestCounter}`;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Worker request timeout'));
      }, this.REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      this.worker.postMessage({ type, data, requestId });
    });
  }

  // Öffentliche API-Methoden

  async buildTransactionIndex(transactions: any[]): Promise<void> {
    try {
      await this.sendMessage('BUILD_TRANSACTION_INDEX', { transactions });
      console.debug('[BudgetWorkerService]', `Transaction index built with ${transactions.length} transactions`);
    } catch (error) {
      console.error('[BudgetWorkerService] Failed to build transaction index', error);
      throw error;
    }
  }

  async buildPlanningIndex(planningTransactions: any[]): Promise<void> {
    try {
      await this.sendMessage('BUILD_PLANNING_INDEX', { planningTransactions });
      console.debug('[BudgetWorkerService]', `Planning index built with ${planningTransactions.length} planning transactions`);
    } catch (error) {
      console.error('[BudgetWorkerService] Failed to build planning index', error);
      throw error;
    }
  }

  async calculateCategoryBudget(
    categoryId: string,
    monthStart: Date,
    monthEnd: Date,
    isIncomeCategory: boolean = false
  ): Promise<{
    budgeted: number;
    forecast: number;
    spent: number;
    saldo: number;
  }> {
    try {
      const result = await this.sendMessage('CALCULATE_CATEGORY_BUDGET', {
        categoryId,
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
        isIncomeCategory
      });

      return result;
    } catch (error) {
      console.error('[BudgetWorkerService]', `Failed to calculate budget for category ${categoryId}`, error);
      throw error;
    }
  }

  async calculateTypeSummary(
    categoryIds: string[],
    monthStart: Date,
    monthEnd: Date,
    type: 'expense' | 'income'
  ): Promise<{
    categories: Record<string, any>;
    summary: {
      budgeted: number;
      forecast: number;
      spentMiddle: number;
      saldoFull: number;
    };
  }> {
    try {
      const result = await this.sendMessage('CALCULATE_TYPE_SUMMARY', {
        categoryIds,
        monthStart: monthStart.toISOString(),
        monthEnd: monthEnd.toISOString(),
        type
      });

      return result;
    } catch (error) {
      console.error('[BudgetWorkerService]', `Failed to calculate ${type} summary`, error);
      throw error;
    }
  }

  // Fallback-Methoden für den Fall, dass Worker nicht verfügbar ist
  isWorkerAvailable(): boolean {
    return this.worker !== null && this.isReady;
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }

    // Alle pending requests abbrechen
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Worker terminated'));
    });
    this.pendingRequests.clear();
  }
}

// Singleton-Instanz
export const budgetWorkerService = new BudgetWorkerService();

// Cleanup beim Beenden der App
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    budgetWorkerService.terminate();
  });
}
