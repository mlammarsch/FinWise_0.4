import {
  PlanningTransaction,
  RecurrencePattern,
  TransactionType,
  AmountType,
  RecurrenceEndType,
  WeekendHandlingType,
  RuleConditionType,
  RuleActionType
} from '@/types';
import { debugLog } from '@/utils/logger';

/**
 * Formatiert Formulardaten für die Speicherung als Planungstransaktion
 */
export function formatTransactionForSave(formData: any): Omit<PlanningTransaction, "id"> {
  // Effektiver Betrag basierend auf Transaktionstyp
  let effectiveAmount = formData.amount;
  const isAccountOrCategoryTransfer =
    formData.transactionType === TransactionType.ACCOUNTTRANSFER ||
    formData.transactionType === TransactionType.CATEGORYTRANSFER;

  // Betrag entsprechend anpassen
  if (isAccountOrCategoryTransfer) {
    effectiveAmount = Math.abs(effectiveAmount);
  } else {
    effectiveAmount = formData.transactionType === TransactionType.EXPENSE
      ? -Math.abs(effectiveAmount)
      : Math.abs(effectiveAmount);
  }

  // Effektive Wochenendbehandlung
  const effectiveWeekendHandling = formData.moveScheduleEnabled
    ? formData.weekendHandlingDirection === "before"
      ? WeekendHandlingType.BEFORE
      : WeekendHandlingType.AFTER
    : WeekendHandlingType.NONE;

  // Effektives Wiederholungsmuster
  const effectiveRecurrencePattern = formData.repeatsEnabled
    ? formData.recurrencePattern
    : RecurrencePattern.ONCE;

  // Effektiver Ende-Typ
  const effectiveRecurrenceEndType = formData.repeatsEnabled
    ? formData.recurrenceEndType
    : RecurrenceEndType.NEVER;

  // Effektive Kategorie-IDs je nach Transaktionstyp
  const dbCategoryId = formData.transactionType === TransactionType.CATEGORYTRANSFER
    ? formData.fromCategoryId
    : formData.categoryId;

  const dbTransferToCategoryId = formData.transactionType === TransactionType.CATEGORYTRANSFER
    ? formData.categoryId
    : undefined;

  // Zusammenstellen der Daten für die Datenbank
  const transactionData: Omit<PlanningTransaction, "id"> = {
    name: formData.name.trim(),
    accountId: formData.accountId,
    categoryId: dbCategoryId,
    tagIds: formData.tagIds,
    recipientId:
      isAccountOrCategoryTransfer
        ? null
        : formData.recipientId,
    amount: effectiveAmount,
    amountType: formData.amountType,
    approximateAmount:
      formData.amountType === AmountType.APPROXIMATE
        ? formData.approximateAmount
        : undefined,
    minAmount:
      formData.amountType === AmountType.RANGE ? formData.minAmount : undefined,
    maxAmount:
      formData.amountType === AmountType.RANGE ? formData.maxAmount : undefined,
    note: formData.note,
    startDate: formData.startDate,
    valueDate: formData.valueDate,
    endDate:
      effectiveRecurrenceEndType === RecurrenceEndType.DATE
        ? formData.endDate
        : null,
    recurrencePattern: effectiveRecurrencePattern,
    recurrenceEndType: effectiveRecurrenceEndType,
    recurrenceCount:
      effectiveRecurrenceEndType === RecurrenceEndType.COUNT
        ? formData.recurrenceCount
        : null,
    executionDay:
      effectiveRecurrencePattern === RecurrencePattern.MONTHLY &&
      formData.executionDay
        ? formData.executionDay
        : null,
    weekendHandling: effectiveWeekendHandling,
    transactionType: formData.transactionType,
    transferToAccountId: formData.transactionType === TransactionType.ACCOUNTTRANSFER
      ? formData.toAccountId
      : undefined,
    isActive: formData.isActive,
    forecastOnly: formData.forecastOnly,
    ...(formData.transactionType === TransactionType.CATEGORYTRANSFER && {
      transferToCategoryId: dbTransferToCategoryId,
    }),
  };

  debugLog("[planningTransactionUtils] Formatted transaction for save:", transactionData);
  return transactionData;
}

/**
 * Erstellt die Ausgangswerte für eine neue Regel basierend auf einer Transaktion
 */
export function getInitialRuleValues(params: {
  name: string,
  recipientName: string,
  accountId: string,
  amount: number,
  categoryId: string | null,
  fromCategoryId: string | null
}): any {
  const { name, recipientName, accountId, amount, categoryId, fromCategoryId } = params;

  return {
    name: `Regel für ${name || recipientName}`,
    description: `Automatisch erstellt für Planungstransaktion "${
      name || recipientName
    }"`,
    stage: "DEFAULT",
    isActive: true,
    conditions: [
      {
        type: RuleConditionType.ACCOUNT_IS,
        operator: "is",
        value: accountId,
      },
      {
        type: RuleConditionType.PAYEE_CONTAINS,
        operator: "contains",
        value: recipientName,
      },
      {
        type: RuleConditionType.AMOUNT_EQUALS,
        operator: "equals",
        value: Math.abs(amount),
      },
    ],
    actions: [
      {
        type: RuleActionType.SET_CATEGORY,
        field: "category",
        value: categoryId || fromCategoryId || "",
      },
    ],
  };
}
