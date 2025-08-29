import { type Ref, type ComputedRef } from 'vue';
import Dexie, { type Table } from 'dexie';
import type { DbTenant } from './userStore';
import type { Account, AccountGroup, Category, CategoryGroup, Recipient, Tag, AutomationRule, SyncQueueEntry, PlanningTransaction } from '../types';
import type { ExtendedTransaction } from './transactionStore';
import type { MonthlyBalance } from './monthlyBalanceStore';
export declare class FinwiseTenantSpecificDB extends Dexie {
    accounts: Table<Account, string>;
    accountGroups: Table<AccountGroup, string>;
    categories: Table<Category, string>;
    categoryGroups: Table<CategoryGroup, string>;
    transactions: Table<ExtendedTransaction, string>;
    planningTransactions: Table<PlanningTransaction, string>;
    recipients: Table<Recipient, string>;
    tags: Table<Tag, string>;
    rules: Table<AutomationRule, string>;
    monthlyBalances: Table<MonthlyBalance, [number, number]>;
    syncQueue: Table<SyncQueueEntry, string>;
    logoCache: Table<{
        path: string;
        data: string | Blob;
    }, string>;
    constructor(databaseName: string);
}
interface TenantStoreState {
    tenants: Ref<DbTenant[]>;
    activeTenantId: Ref<string | null>;
    activeTenantDB: Ref<FinwiseTenantSpecificDB | null>;
    getTenantsByUser: ComputedRef<(userId: string) => DbTenant[]>;
    activeTenant: ComputedRef<DbTenant | null>;
    loadTenants: () => Promise<void>;
    addTenant: (tenantName: string, userId: string) => Promise<DbTenant | null>;
    updateTenant: (id: string, tenantName: string) => Promise<boolean>;
    deleteTenant: (id: string, sendBackendSignal?: boolean) => Promise<boolean>;
    deleteTenantCompletely: (id: string, userId: string) => Promise<boolean>;
    setActiveTenant: (id: string | null) => Promise<boolean>;
    reset: () => Promise<void>;
    syncCurrentTenantData: () => Promise<void>;
    initializeTenantStore: () => Promise<void>;
}
export declare const useTenantStore: import("pinia").StoreDefinition<"tenant", Pick<TenantStoreState, "tenants" | "activeTenantId" | "activeTenantDB">, Pick<TenantStoreState, "getTenantsByUser" | "activeTenant">, Pick<TenantStoreState, "reset" | "loadTenants" | "addTenant" | "updateTenant" | "deleteTenant" | "deleteTenantCompletely" | "setActiveTenant" | "syncCurrentTenantData" | "initializeTenantStore">>;
export {};
