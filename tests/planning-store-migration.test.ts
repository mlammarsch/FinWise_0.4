// Test für PlanningStore IndexedDB Migration
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePlanningStore } from '@/stores/planningStore';
import { useTenantStore } from '@/stores/tenantStore';
import { PlanningTransaction, AmountType, RecurrencePattern, RecurrenceEndType, WeekendHandlingType, TransactionType } from '@/types';

describe('PlanningStore IndexedDB Migration', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('sollte eine Planungstransaktion erstellen können', async () => {
    const planningStore = usePlanningStore();

    const testTransaction: Partial<PlanningTransaction> = {
      name: 'Test Planungstransaktion',
      accountId: 'test-account-id',
      categoryId: 'test-category-id',
      amount: 100,
      amountType: AmountType.EXACT,
      startDate: new Date().toISOString(),
      recurrencePattern: RecurrencePattern.MONTHLY,
      recurrenceEndType: RecurrenceEndType.NEVER,
      weekendHandling: WeekendHandlingType.NONE,
      transactionType: TransactionType.EXPENSE,
      isActive: true,
      forecastOnly: false,
      tagIds: [],
    };

    const result = await planningStore.addPlanningTransaction(testTransaction);

    expect(result).toBeDefined();
    expect(result.name).toBe('Test Planungstransaktion');
    expect(result.amount).toBe(100);
    expect(result.updated_at).toBeDefined();
  });

  it('sollte Planungstransaktionen laden können', async () => {
    const planningStore = usePlanningStore();

    await planningStore.loadPlanningTransactions();

    expect(planningStore.planningTransactions).toBeDefined();
    expect(Array.isArray(planningStore.planningTransactions)).toBe(true);
  });

  it('sollte eine Planungstransaktion aktualisieren können', async () => {
    const planningStore = usePlanningStore();

    const testTransaction: Partial<PlanningTransaction> = {
      name: 'Original Name',
      accountId: 'test-account-id',
      amount: 100,
      transactionType: TransactionType.EXPENSE,
      tagIds: [],
    };

    const created = await planningStore.addPlanningTransaction(testTransaction);
    const success = await planningStore.updatePlanningTransaction(created.id, { name: 'Updated Name' });

    expect(success).toBe(true);

    const updated = planningStore.getPlanningTransactionById.value(created.id);
    expect(updated?.name).toBe('Updated Name');
  });

  it('sollte eine Planungstransaktion löschen können', async () => {
    const planningStore = usePlanningStore();

    const testTransaction: Partial<PlanningTransaction> = {
      name: 'To Delete',
      accountId: 'test-account-id',
      amount: 100,
      transactionType: TransactionType.EXPENSE,
      tagIds: [],
    };

    const created = await planningStore.addPlanningTransaction(testTransaction);
    const success = await planningStore.deletePlanningTransaction(created.id);

    expect(success).toBe(true);

    const deleted = planningStore.getPlanningTransactionById.value(created.id);
    expect(deleted).toBeUndefined();
  });
});
