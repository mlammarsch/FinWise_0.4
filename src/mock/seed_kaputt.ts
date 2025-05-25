// src/mock/seed.ts
/**
 * Seed-Daten für Demo-Zwecke.
 * Alle Records werden mit userId + tenantId versehen.
 */

import { v4 as uuidv4 } from 'uuid';
import { useAccountStore } from '@/stores/accountStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useTransactionStore } from '@/stores/transactionStore';
import { usePlanningStore } from '@/stores/planningStore';
import { debugLog } from '@/utils/logger';

/* -------------------------------------------------- Basis-Daten */
export function seedData(userId: string, tenantId: string) {
  seedAccounts(userId, tenantId);
  seedCategories(userId, tenantId);
  seedTransactions(userId, tenantId);

  debugLog('[seed] demo data imported', { userId, tenantId });
}

export function clearData() {
  useAccountStore().reset();
  useCategoryStore().reset();
  useTransactionStore().reset();
  usePlanningStore().reset();
}

/* --------------------------- helpers --------------------------- */
function seedAccounts(userId: string, tenantId: string) {
  const accStore = useAccountStore();
  const accountId = uuidv4();
  accStore.addAccount({
    id: accountId,
    name: 'Girokonto Demo',
    description: '',
    note: '',
    accountType: 0,
    isActive: true,
    isOfflineBudget: false,
    accountGroupId: '',
    sortOrder: 0,
    iban: '',
    balance: 0,
    creditLimit: 0,
    offset: 0,
    image: '',
    /* multi-tenant */
    userId,
    tenantId,
  } as any);
}

function seedCategories(userId: string, tenantId: string) {
  const catStore = useCategoryStore();

  catStore.addCategory({
    name: 'Verfügbare Mittel',
    parentCategoryId: null,
    sortOrder: 0,
    isActive: true,
    isIncomeCategory: true,
    isSavingsGoal: false,
    categoryGroupId: null,
    /* multi-tenant */
    userId,
    tenantId,
  } as any);
}

function seedTransactions(userId: string, tenantId: string) {
  const txStore = useTransactionStore();

  txStore.addTransaction({
    id: uuidv4(),
    accountId: txStore.transactions[0]?.accountId ?? '',
    categoryId: null,
    date: new Date().toISOString().split('T')[0],
    valueDate: new Date().toISOString().split('T')[0],
    amount: -50,
    description: 'Demo-Ausgabe',
    note: '',
    tagIds: [],
    type: 0,
    runningBalance: 0,
    counterTransactionId: null,
    planningTransactionId: null,
    isReconciliation: false,
    isCategoryTransfer: false,
    transferToAccountId: null,
    reconciled: false,
    toCategoryId: null,
    payee: 'Supermarkt',
    /* multi-tenant */
    userId,
    tenantId,
  } as any);
}
