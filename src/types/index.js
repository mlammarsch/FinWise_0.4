// src/types/index.ts
// Regeln / Automatisierungen
export var RuleConditionType;
(function (RuleConditionType) {
    RuleConditionType["ACCOUNT_IS"] = "ACCOUNT_IS";
    RuleConditionType["RECIPIENT_EQUALS"] = "RECIPIENT_EQUALS";
    RuleConditionType["RECIPIENT_CONTAINS"] = "RECIPIENT_CONTAINS";
    RuleConditionType["AMOUNT_EQUALS"] = "AMOUNT_EQUALS";
    RuleConditionType["AMOUNT_GREATER"] = "AMOUNT_GREATER";
    RuleConditionType["AMOUNT_LESS"] = "AMOUNT_LESS";
    RuleConditionType["DATE_IS"] = "DATE_IS";
    RuleConditionType["DATE_APPROX"] = "DATE_APPROX";
    RuleConditionType["DESCRIPTION_CONTAINS"] = "DESCRIPTION_CONTAINS";
})(RuleConditionType || (RuleConditionType = {}));
export var RuleActionType;
(function (RuleActionType) {
    RuleActionType["SET_CATEGORY"] = "SET_CATEGORY";
    RuleActionType["ADD_TAG"] = "ADD_TAG";
    RuleActionType["SET_NOTE"] = "SET_NOTE";
    RuleActionType["LINK_SCHEDULE"] = "LINK_SCHEDULE";
    RuleActionType["SET_ACCOUNT"] = "SET_ACCOUNT";
    RuleActionType["SET_RECIPIENT"] = "SET_RECIPIENT";
})(RuleActionType || (RuleActionType = {}));
// Enums
export var AccountType;
(function (AccountType) {
    AccountType["Girokonto"] = "giro";
    AccountType["Tagesgeldkonto"] = "tagesgeld";
    AccountType["Festgeldkonto"] = "festgeld";
    AccountType["Sparkonto"] = "spar";
    AccountType["Kreditkarte"] = "kreditkarte";
    AccountType["Depot"] = "depot";
    AccountType["Bausparvertrag"] = "bauspar";
    AccountType["Darlehenskonto"] = "darlehen";
    AccountType["Gesch\u00E4ftskonto"] = "geschaeft";
    AccountType["Gemeinschaftskonto"] = "gemeinschaft";
    AccountType["Fremdw\u00E4hrungskonto"] = "fremdwaehrung";
    AccountType["Virtuell"] = "virtuell";
    AccountType["Bargeld"] = "bar";
    AccountType["Sonstiges"] = "sonstiges";
})(AccountType || (AccountType = {}));
export var TransactionType;
(function (TransactionType) {
    TransactionType["EXPENSE"] = "EXPENSE";
    TransactionType["INCOME"] = "INCOME";
    TransactionType["ACCOUNTTRANSFER"] = "ACCOUNTTRANSFER";
    TransactionType["CATEGORYTRANSFER"] = "CATEGORYTRANSFER";
    TransactionType["RECONCILE"] = "RECONCILE";
})(TransactionType || (TransactionType = {}));
export var AmountType;
(function (AmountType) {
    AmountType["EXACT"] = "EXACT";
    AmountType["APPROXIMATE"] = "APPROXIMATE";
    AmountType["RANGE"] = "RANGE";
})(AmountType || (AmountType = {}));
export var RecurrencePattern;
(function (RecurrencePattern) {
    RecurrencePattern["ONCE"] = "ONCE";
    RecurrencePattern["DAILY"] = "DAILY";
    RecurrencePattern["WEEKLY"] = "WEEKLY";
    RecurrencePattern["BIWEEKLY"] = "BIWEEKLY";
    RecurrencePattern["MONTHLY"] = "MONTHLY";
    RecurrencePattern["QUARTERLY"] = "QUARTERLY";
    RecurrencePattern["YEARLY"] = "YEARLY";
})(RecurrencePattern || (RecurrencePattern = {}));
export var RecurrenceEndType;
(function (RecurrenceEndType) {
    RecurrenceEndType["NEVER"] = "NEVER";
    RecurrenceEndType["COUNT"] = "COUNT";
    RecurrenceEndType["DATE"] = "DATE";
})(RecurrenceEndType || (RecurrenceEndType = {}));
export var WeekendHandlingType;
(function (WeekendHandlingType) {
    WeekendHandlingType["NONE"] = "NONE";
    WeekendHandlingType["BEFORE"] = "BEFORE";
    WeekendHandlingType["AFTER"] = "AFTER";
})(WeekendHandlingType || (WeekendHandlingType = {}));
// WebSocket-bezogene Typen
export var BackendStatus;
(function (BackendStatus) {
    BackendStatus["ONLINE"] = "online";
    BackendStatus["OFFLINE"] = "offline";
    BackendStatus["MAINTENANCE"] = "maintenance";
    BackendStatus["ERROR"] = "error";
})(BackendStatus || (BackendStatus = {}));
// Enums für DataUpdateNotificationMessage, basierend auf Backend-Definitionen
export var EntityTypeEnum;
(function (EntityTypeEnum) {
    EntityTypeEnum["ACCOUNT"] = "Account";
    EntityTypeEnum["ACCOUNT_GROUP"] = "AccountGroup";
    EntityTypeEnum["CATEGORY"] = "Category";
    EntityTypeEnum["CATEGORY_GROUP"] = "CategoryGroup";
    EntityTypeEnum["TRANSACTION"] = "Transaction";
    EntityTypeEnum["PLANNING_TRANSACTION"] = "PlanningTransaction";
    EntityTypeEnum["RECIPIENT"] = "Recipient";
    EntityTypeEnum["TAG"] = "Tag";
    EntityTypeEnum["RULE"] = "AutomationRule";
    // Weitere Entitätstypen hier bei Bedarf
})(EntityTypeEnum || (EntityTypeEnum = {}));
// Sync Queue Typen
export var SyncOperationType;
(function (SyncOperationType) {
    SyncOperationType["CREATE"] = "create";
    SyncOperationType["UPDATE"] = "update";
    SyncOperationType["DELETE"] = "delete";
    SyncOperationType["INITIAL_LOAD"] = "initial_load";
})(SyncOperationType || (SyncOperationType = {}));
export var SyncStatus;
(function (SyncStatus) {
    SyncStatus["PENDING"] = "pending";
    SyncStatus["PROCESSING"] = "processing";
    SyncStatus["SYNCED"] = "synced";
    SyncStatus["FAILED"] = "failed";
})(SyncStatus || (SyncStatus = {}));
// ===== UTILITY FUNCTIONS =====
// Type Guard für Multi-Value-Bedingungen
export function isMultiValueCondition(condition) {
    return condition.operator === 'one_of' && Array.isArray(condition.value);
}
