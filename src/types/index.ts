// src/types/index.ts

// Account-Modelle
export interface Account {
  id: string
  name: string
  description?: string
  note?: string
  accountType: AccountType
  isActive: boolean
  isOfflineBudget: boolean
  accountGroupId: string
  sortOrder: number
  iban?: string
  balance: number
  creditLimit?: number
  offset: number
  image?: string
}

export interface AccountGroup {
  id: string
  name: string
  sortOrder: number
  image?: string
}

// Kategorie-Modelle
export interface Category {
  id: string
  name: string
  icon?: string
  budgeted: number
  activity: number
  available: number
  isIncomeCategory: boolean
  isHidden: boolean
  isActive: boolean
  sortOrder: number
  categoryGroupId?: string
}

export interface CategoryGroup {
  id: string
  name: string
  sortOrder: number
  isIncomeGroup: boolean
}

// Tag- und Empfänger-Modelle
export interface Tag {
  id: string
  name: string
  parentTagId?: string | null
  color: string
  icon?: string
}

export interface Recipient {
  id: string
  name: string
  defaultCategoryId?: string | null
  note?: string
}

// Transaktionen
export interface Transaction {
  id: string
  accountId: string
  categoryId?: string
  date: string
  valueDate: string
  amount: number
  description: string
  note?: string
  tagIds: string[]
  type: TransactionType
  runningBalance: number
  counterTransactionId?: string | null
  planningTransactionId?: string | null
  isReconciliation?: boolean
  isCategoryTransfer?: boolean
  transferToAccountId?: string | null
  reconciled?: boolean
  toCategoryId?: string
  payee?: string
}

// Planungstransaktionen
export interface PlanningTransaction {
  id: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  tagIds: string[];
  recipientId?: string | null;
  amount: number;
  amountType: AmountType;
  approximateAmount?: number;
  minAmount?: number;
  maxAmount?: number;
  note?: string;
  startDate: string;
  valueDate?: string | null;
  endDate?: string | null;
  recurrencePattern: RecurrencePattern;
  recurrenceCount?: number | null;
  recurrenceEndType: RecurrenceEndType;
  executionDay?: number | null;
  weekendHandling: WeekendHandlingType;
  transactionType?: TransactionType;
  counterPlanningTransactionId?: string | null;
  transferToAccountId?: string | null;
  transferToCategoryId?: string | null;
  isActive: boolean;
  forecastOnly: boolean;
  autoExecute?: boolean;
}

// Regeln / Automatisierungen
export enum RuleConditionType {
  ACCOUNT_IS = 'ACCOUNT_IS',
  PAYEE_EQUALS = 'PAYEE_EQUALS',
  PAYEE_CONTAINS = 'PAYEE_CONTAINS',
  AMOUNT_EQUALS = 'AMOUNT_EQUALS',
  AMOUNT_GREATER = 'AMOUNT_GREATER',
  AMOUNT_LESS = 'AMOUNT_LESS',
  DATE_IS = 'DATE_IS',
  DATE_APPROX = 'DATE_APPROX',
  DESCRIPTION_CONTAINS = 'DESCRIPTION_CONTAINS'
}

export enum RuleActionType {
  SET_CATEGORY = 'SET_CATEGORY',
  ADD_TAG = 'ADD_TAG',
  SET_NOTE = 'SET_NOTE',
  LINK_SCHEDULE = 'LINK_SCHEDULE'
}

export interface RuleCondition {
  type: RuleConditionType
  operator: string
  value: string | number
}

export interface RuleAction {
  type: RuleActionType
  field?: string
  value: string | string[] | number
}

export interface AutomationRule {
  id: string
  name: string
  description?: string
  stage: 'PRE' | 'DEFAULT' | 'POST'
  conditions: RuleCondition[]
  actions: RuleAction[]
  priority: number
  isActive: boolean
}

// Zusatzmodelle
export interface PlanningItem {
  id: string
  categoryId: string
  year: number
  month: number
  plannedAmount: number
}

export interface StatisticItem {
  year: number
  month: number
  categoryId: string
  amount: number
}

export interface BalanceInfo {
  balance: number
  date: Date
}

export interface Reconciliation {
  id: string
  accountId: string
  date: string
  balance: number
  note: string
  transactionIds: string[]
}

// Enums
export enum AccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  CREDIT = 'CREDIT',
  CASH = 'CASH'
}

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  ACCOUNTTRANSFER = 'ACCOUNTTRANSFER',
  CATEGORYTRANSFER = 'CATEGORYTRANSFER',
  RECONCILE = 'RECONCILE'
}

export enum AmountType {
  EXACT = 'EXACT',
  APPROXIMATE = 'APPROXIMATE',
  RANGE = 'RANGE'
}

export enum RecurrencePattern {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

export enum RecurrenceEndType {
  NEVER = 'NEVER',
  COUNT = 'COUNT',
  DATE = 'DATE'
}

export enum WeekendHandlingType {
  NONE = 'NONE',
  BEFORE = 'BEFORE',
  AFTER = 'AFTER'
}

// Entität-Interface
export interface Entity {
  id: string
  isActive: boolean
}
