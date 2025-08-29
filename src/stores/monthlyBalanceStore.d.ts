/**
 * Monatsbilanz-Store – tenant-spezifisch persistiert.
 */
export interface MonthlyBalance {
    year: number;
    month: number;
    accountBalances: Record<string, number>;
    categoryBalances: Record<string, number>;
    projectedAccountBalances: Record<string, number>;
    projectedCategoryBalances: Record<string, number>;
    lastCalculated?: string;
}
export interface BalanceInfo {
    balance: number;
    date: Date;
}
export declare const useMonthlyBalanceStore: import("pinia").StoreDefinition<"monthlyBalance", Pick<{
    monthlyBalances: import("vue").Ref<{
        year: number;
        month: number;
        accountBalances: Record<string, number>;
        categoryBalances: Record<string, number>;
        projectedAccountBalances: Record<string, number>;
        projectedCategoryBalances: Record<string, number>;
        lastCalculated?: string | undefined;
    }[], MonthlyBalance[] | {
        year: number;
        month: number;
        accountBalances: Record<string, number>;
        categoryBalances: Record<string, number>;
        projectedAccountBalances: Record<string, number>;
        projectedCategoryBalances: Record<string, number>;
        lastCalculated?: string | undefined;
    }[]>;
    isLoaded: import("vue").Ref<boolean, boolean>;
    getAllMonthlyBalances: () => MonthlyBalance[];
    getMonthlyBalance: (year: number, month: number) => MonthlyBalance | null;
    setMonthlyBalance: (year: number, month: number, data: Omit<MonthlyBalance, "year" | "month">) => Promise<void>;
    saveMonthlyBalances: () => Promise<void>;
    bulkSaveMonthlyBalances: (balancesToSave: MonthlyBalance[]) => Promise<void>;
    loadMonthlyBalances: () => Promise<void>;
    reset: () => Promise<void>;
    getLatestPersistedCategoryBalance: import("vue").ComputedRef<(categoryId: string, date: Date) => BalanceInfo | null>;
    getAccountBalanceForDate: import("vue").ComputedRef<(accountId: string, date: Date) => number | null>;
    getProjectedAccountBalanceForDate: import("vue").ComputedRef<(accountId: string, date: Date) => number | null>;
    getCategoryBalanceForDate: import("vue").ComputedRef<(categoryId: string, date: Date) => number | null>;
    getProjectedCategoryBalanceForDate: import("vue").ComputedRef<(categoryId: string, date: Date) => number | null>;
}, "isLoaded" | "monthlyBalances">, Pick<{
    monthlyBalances: import("vue").Ref<{
        year: number;
        month: number;
        accountBalances: Record<string, number>;
        categoryBalances: Record<string, number>;
        projectedAccountBalances: Record<string, number>;
        projectedCategoryBalances: Record<string, number>;
        lastCalculated?: string | undefined;
    }[], MonthlyBalance[] | {
        year: number;
        month: number;
        accountBalances: Record<string, number>;
        categoryBalances: Record<string, number>;
        projectedAccountBalances: Record<string, number>;
        projectedCategoryBalances: Record<string, number>;
        lastCalculated?: string | undefined;
    }[]>;
    isLoaded: import("vue").Ref<boolean, boolean>;
    getAllMonthlyBalances: () => MonthlyBalance[];
    getMonthlyBalance: (year: number, month: number) => MonthlyBalance | null;
    setMonthlyBalance: (year: number, month: number, data: Omit<MonthlyBalance, "year" | "month">) => Promise<void>;
    saveMonthlyBalances: () => Promise<void>;
    bulkSaveMonthlyBalances: (balancesToSave: MonthlyBalance[]) => Promise<void>;
    loadMonthlyBalances: () => Promise<void>;
    reset: () => Promise<void>;
    getLatestPersistedCategoryBalance: import("vue").ComputedRef<(categoryId: string, date: Date) => BalanceInfo | null>;
    getAccountBalanceForDate: import("vue").ComputedRef<(accountId: string, date: Date) => number | null>;
    getProjectedAccountBalanceForDate: import("vue").ComputedRef<(accountId: string, date: Date) => number | null>;
    getCategoryBalanceForDate: import("vue").ComputedRef<(categoryId: string, date: Date) => number | null>;
    getProjectedCategoryBalanceForDate: import("vue").ComputedRef<(categoryId: string, date: Date) => number | null>;
}, "getLatestPersistedCategoryBalance" | "getAccountBalanceForDate" | "getProjectedAccountBalanceForDate" | "getCategoryBalanceForDate" | "getProjectedCategoryBalanceForDate">, Pick<{
    monthlyBalances: import("vue").Ref<{
        year: number;
        month: number;
        accountBalances: Record<string, number>;
        categoryBalances: Record<string, number>;
        projectedAccountBalances: Record<string, number>;
        projectedCategoryBalances: Record<string, number>;
        lastCalculated?: string | undefined;
    }[], MonthlyBalance[] | {
        year: number;
        month: number;
        accountBalances: Record<string, number>;
        categoryBalances: Record<string, number>;
        projectedAccountBalances: Record<string, number>;
        projectedCategoryBalances: Record<string, number>;
        lastCalculated?: string | undefined;
    }[]>;
    isLoaded: import("vue").Ref<boolean, boolean>;
    getAllMonthlyBalances: () => MonthlyBalance[];
    getMonthlyBalance: (year: number, month: number) => MonthlyBalance | null;
    setMonthlyBalance: (year: number, month: number, data: Omit<MonthlyBalance, "year" | "month">) => Promise<void>;
    saveMonthlyBalances: () => Promise<void>;
    bulkSaveMonthlyBalances: (balancesToSave: MonthlyBalance[]) => Promise<void>;
    loadMonthlyBalances: () => Promise<void>;
    reset: () => Promise<void>;
    getLatestPersistedCategoryBalance: import("vue").ComputedRef<(categoryId: string, date: Date) => BalanceInfo | null>;
    getAccountBalanceForDate: import("vue").ComputedRef<(accountId: string, date: Date) => number | null>;
    getProjectedAccountBalanceForDate: import("vue").ComputedRef<(accountId: string, date: Date) => number | null>;
    getCategoryBalanceForDate: import("vue").ComputedRef<(categoryId: string, date: Date) => number | null>;
    getProjectedCategoryBalanceForDate: import("vue").ComputedRef<(categoryId: string, date: Date) => number | null>;
}, "reset" | "getAllMonthlyBalances" | "getMonthlyBalance" | "setMonthlyBalance" | "saveMonthlyBalances" | "bulkSaveMonthlyBalances" | "loadMonthlyBalances">>;
