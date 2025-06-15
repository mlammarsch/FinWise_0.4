import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMonthlyBalanceStore, type MonthlyBalance } from '@/stores/monthlyBalanceStore';
import { TenantDbService } from '@/services/TenantDbService';
import { storageKey } from '@/utils/storageKey';

// Mock TenantDbService
vi.mock('@/services/TenantDbService');
const MockedTenantDbService = vi.mocked(TenantDbService);

// Mock logger
vi.mock('@/utils/logger', () => ({
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  errorLog: vi.fn(),
}));

// Mock storageKey
vi.mock('@/utils/storageKey', () => ({
  storageKey: vi.fn((key: string) => `test_${key}`),
}));

describe('MonthlyBalanceStore Migration', () => {
  let mockTenantDbService: any;
  let store: ReturnType<typeof useMonthlyBalanceStore>;

  beforeEach(() => {
    setActivePinia(createPinia());

    // Mock TenantDbService instance
    mockTenantDbService = {
      getAllMonthlyBalances: vi.fn(),
      saveMonthlyBalance: vi.fn(),
      getMonthlyBalancesByYear: vi.fn(),
      getMonthlyBalance: vi.fn(),
      deleteMonthlyBalance: vi.fn(),
    };

    MockedTenantDbService.mockImplementation(() => mockTenantDbService);

    // Clear localStorage
    localStorage.clear();

    store = useMonthlyBalanceStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('IndexedDB Integration', () => {
    it('should load monthly balances from IndexedDB', async () => {
      const testBalances: MonthlyBalance[] = [
        {
          year: 2024,
          month: 0,
          accountBalances: { 'acc1': 1000 },
          categoryBalances: { 'cat1': 500 },
          projectedAccountBalances: { 'acc1': 1100 },
          projectedCategoryBalances: { 'cat1': 550 },
        },
        {
          year: 2024,
          month: 1,
          accountBalances: { 'acc1': 1200 },
          categoryBalances: { 'cat1': 600 },
          projectedAccountBalances: { 'acc1': 1300 },
          projectedCategoryBalances: { 'cat1': 650 },
        },
      ];

      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue(testBalances);

      await store.loadMonthlyBalances();

      expect(mockTenantDbService.getAllMonthlyBalances).toHaveBeenCalledOnce();
      expect(store.monthlyBalances).toEqual(testBalances);
      expect(store.isLoaded).toBe(true);
    });

    it('should save monthly balance to IndexedDB', async () => {
      const testBalance: MonthlyBalance = {
        year: 2024,
        month: 2,
        accountBalances: { 'acc1': 1500 },
        categoryBalances: { 'cat1': 750 },
        projectedAccountBalances: { 'acc1': 1600 },
        projectedCategoryBalances: { 'cat1': 800 },
      };

      mockTenantDbService.saveMonthlyBalance.mockResolvedValue(undefined);

      await store.setMonthlyBalance(2024, 2, {
        accountBalances: testBalance.accountBalances,
        categoryBalances: testBalance.categoryBalances,
        projectedAccountBalances: testBalance.projectedAccountBalances,
        projectedCategoryBalances: testBalance.projectedCategoryBalances,
      });

      expect(mockTenantDbService.saveMonthlyBalance).toHaveBeenCalledWith(testBalance);
      expect(store.getMonthlyBalance(2024, 2)).toEqual(testBalance);
    });

    it('should handle IndexedDB errors gracefully', async () => {
      const error = new Error('IndexedDB error');
      mockTenantDbService.getAllMonthlyBalances.mockRejectedValue(error);

      await store.loadMonthlyBalances();

      expect(store.monthlyBalances).toEqual([]);
      expect(store.isLoaded).toBe(true);
    });
  });

  describe('localStorage Migration', () => {
    it('should migrate data from localStorage to IndexedDB', async () => {
      const legacyData: MonthlyBalance[] = [
        {
          year: 2023,
          month: 11,
          accountBalances: { 'acc1': 800 },
          categoryBalances: { 'cat1': 400 },
          projectedAccountBalances: { 'acc1': 850 },
          projectedCategoryBalances: { 'cat1': 450 },
        },
      ];

      // Setup localStorage with legacy data
      localStorage.setItem('test_monthly_balances', JSON.stringify(legacyData));

      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue([]);
      mockTenantDbService.saveMonthlyBalance.mockResolvedValue(undefined);

      await store.loadMonthlyBalances();

      // Should have migrated data to IndexedDB
      expect(mockTenantDbService.saveMonthlyBalance).toHaveBeenCalledWith(legacyData[0]);

      // Should have removed legacy data
      expect(localStorage.getItem('test_monthly_balances')).toBeNull();
    });

    it('should not migrate if no legacy data exists', async () => {
      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue([]);

      await store.loadMonthlyBalances();

      expect(mockTenantDbService.saveMonthlyBalance).not.toHaveBeenCalled();
    });

    it('should handle migration errors gracefully', async () => {
      const legacyData = [{ invalid: 'data' }];
      localStorage.setItem('test_monthly_balances', JSON.stringify(legacyData));

      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue([]);
      mockTenantDbService.saveMonthlyBalance.mockRejectedValue(new Error('Migration error'));

      // Should not throw
      await expect(store.loadMonthlyBalances()).resolves.not.toThrow();
    });
  });

  describe('Store Operations', () => {
    beforeEach(async () => {
      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue([]);
      await store.loadMonthlyBalances();
    });

    it('should get monthly balance by year and month', () => {
      const testBalance: MonthlyBalance = {
        year: 2024,
        month: 3,
        accountBalances: { 'acc1': 2000 },
        categoryBalances: { 'cat1': 1000 },
        projectedAccountBalances: { 'acc1': 2100 },
        projectedCategoryBalances: { 'cat1': 1050 },
      };

      store.monthlyBalances.push(testBalance);

      const result = store.getMonthlyBalance(2024, 3);
      expect(result).toEqual(testBalance);

      const notFound = store.getMonthlyBalance(2024, 4);
      expect(notFound).toBeNull();
    });

    it('should return all monthly balances', () => {
      const testBalances: MonthlyBalance[] = [
        {
          year: 2024,
          month: 0,
          accountBalances: {},
          categoryBalances: {},
          projectedAccountBalances: {},
          projectedCategoryBalances: {},
        },
        {
          year: 2024,
          month: 1,
          accountBalances: {},
          categoryBalances: {},
          projectedAccountBalances: {},
          projectedCategoryBalances: {},
        },
      ];

      store.monthlyBalances.push(...testBalances);

      const result = store.getAllMonthlyBalances();
      expect(result).toEqual(testBalances);
    });

    it('should reset store and reload data', async () => {
      const testBalances: MonthlyBalance[] = [
        {
          year: 2024,
          month: 5,
          accountBalances: { 'acc1': 3000 },
          categoryBalances: { 'cat1': 1500 },
          projectedAccountBalances: { 'acc1': 3100 },
          projectedCategoryBalances: { 'cat1': 1550 },
        },
      ];

      // Add some data to store
      store.monthlyBalances.push({
        year: 2023,
        month: 11,
        accountBalances: {},
        categoryBalances: {},
        projectedAccountBalances: {},
        projectedCategoryBalances: {},
      });

      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue(testBalances);

      await store.reset();

      expect(store.monthlyBalances).toEqual(testBalances);
      expect(store.isLoaded).toBe(true);
    });

    it('should save all monthly balances to IndexedDB', async () => {
      const testBalances: MonthlyBalance[] = [
        {
          year: 2024,
          month: 6,
          accountBalances: { 'acc1': 4000 },
          categoryBalances: { 'cat1': 2000 },
          projectedAccountBalances: { 'acc1': 4100 },
          projectedCategoryBalances: { 'cat1': 2050 },
        },
        {
          year: 2024,
          month: 7,
          accountBalances: { 'acc1': 4500 },
          categoryBalances: { 'cat1': 2250 },
          projectedAccountBalances: { 'acc1': 4600 },
          projectedCategoryBalances: { 'cat1': 2300 },
        },
      ];

      store.monthlyBalances.push(...testBalances);
      mockTenantDbService.saveMonthlyBalance.mockResolvedValue(undefined);

      await store.saveMonthlyBalances();

      expect(mockTenantDbService.saveMonthlyBalance).toHaveBeenCalledTimes(2);
      expect(mockTenantDbService.saveMonthlyBalance).toHaveBeenCalledWith(testBalances[0]);
      expect(mockTenantDbService.saveMonthlyBalance).toHaveBeenCalledWith(testBalances[1]);
    });
  });

  describe('Legacy Computed Methods', () => {
    beforeEach(async () => {
      const testBalances: MonthlyBalance[] = [
        {
          year: 2024,
          month: 0,
          accountBalances: { 'acc1': 1000, 'acc2': 2000 },
          categoryBalances: { 'cat1': 500, 'cat2': 750 },
          projectedAccountBalances: { 'acc1': 1100, 'acc2': 2100 },
          projectedCategoryBalances: { 'cat1': 550, 'cat2': 800 },
        },
        {
          year: 2024,
          month: 1,
          accountBalances: { 'acc1': 1200, 'acc2': 2200 },
          categoryBalances: { 'cat1': 600, 'cat2': 850 },
          projectedAccountBalances: { 'acc1': 1300, 'acc2': 2300 },
          projectedCategoryBalances: { 'cat1': 650, 'cat2': 900 },
        },
      ];

      mockTenantDbService.getAllMonthlyBalances.mockResolvedValue(testBalances);
      await store.loadMonthlyBalances();
    });

    it('should get account balance for specific date', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      const balance = store.getAccountBalanceForDate.value('acc1', date);
      expect(balance).toBe(1000);

      const notFound = store.getAccountBalanceForDate.value('acc3', date);
      expect(notFound).toBeNull();
    });

    it('should get category balance for specific date', () => {
      const date = new Date(2024, 1, 10); // February 10, 2024
      const balance = store.getCategoryBalanceForDate.value('cat2', date);
      expect(balance).toBe(850);

      const notFound = store.getCategoryBalanceForDate.value('cat3', date);
      expect(notFound).toBeNull();
    });

    it('should get projected account balance for specific date', () => {
      const date = new Date(2024, 0, 20); // January 20, 2024
      const balance = store.getProjectedAccountBalanceForDate.value('acc2', date);
      expect(balance).toBe(2100);
    });

    it('should get projected category balance for specific date', () => {
      const date = new Date(2024, 1, 5); // February 5, 2024
      const balance = store.getProjectedCategoryBalanceForDate.value('cat1', date);
      expect(balance).toBe(650);
    });

    it('should get latest persisted category balance before date', () => {
      const date = new Date(2024, 2, 1); // March 1, 2024 (should find February data)
      const balanceInfo = store.getLatestPersistedCategoryBalance.value('cat1', date);

      expect(balanceInfo).toEqual({
        balance: 600,
        date: new Date(2024, 1, 1), // February 1, 2024
      });

      const notFound = store.getLatestPersistedCategoryBalance.value('cat3', date);
      expect(notFound).toBeNull();
    });
  });
});
