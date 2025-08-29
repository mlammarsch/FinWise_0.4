import { AutomationRule, RuleConditionType, RuleActionType, Transaction, SyncOperationType } from '../types';
interface RecipientValidationResult {
    recipientId: string;
    recipientName: string;
    hasActiveReferences: boolean;
    transactionCount: number;
    planningTransactionCount: number;
    automationRuleCount: number;
    canDelete: boolean;
    warnings: string[];
}
export declare const useRuleStore: import("pinia").StoreDefinition<"rule", Pick<{
    rules: import("vue").Ref<{
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    }[], AutomationRule[] | {
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    }[]>;
    addRule: (ruleData: (Omit<AutomationRule, "updated_at" | "id"> & Partial<Pick<AutomationRule, "id">>) | AutomationRule, fromSync?: boolean) => Promise<AutomationRule>;
    getRuleById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    updateRule: (id: string, ruleUpdatesData: Omit<AutomationRule, "id">, fromSync?: boolean) => Promise<boolean>;
    deleteRule: (id: string, fromSync?: boolean) => Promise<boolean>;
    loadRules: (fromSync?: boolean) => Promise<void>;
    applyRulesToTransaction: (transaction: Transaction, stage?: "PRE" | "DEFAULT" | "POST") => Transaction;
    checkConditions: (conditions: any[], tx: Transaction, rule?: AutomationRule) => boolean;
    applyActions: (rule: AutomationRule, tx: Transaction) => Transaction;
    handleSyncMessage: (operation: SyncOperationType, rule: AutomationRule) => void;
    updateRecipientReferences: (oldRecipientIds: string[], newRecipientId: string) => Promise<void>;
    getAutomationRulesWithRecipient: (recipientId: string) => Promise<AutomationRule[]>;
    countAutomationRulesWithRecipient: (recipientId: string) => Promise<number>;
    validateRecipientDeletion: (recipientIds: string[]) => Promise<RecipientValidationResult[]>;
    cleanupRecipientReferences: (recipientId: string) => Promise<void>;
    reset: () => Promise<void>;
}, "rules">, Pick<{
    rules: import("vue").Ref<{
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    }[], AutomationRule[] | {
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    }[]>;
    addRule: (ruleData: (Omit<AutomationRule, "updated_at" | "id"> & Partial<Pick<AutomationRule, "id">>) | AutomationRule, fromSync?: boolean) => Promise<AutomationRule>;
    getRuleById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    updateRule: (id: string, ruleUpdatesData: Omit<AutomationRule, "id">, fromSync?: boolean) => Promise<boolean>;
    deleteRule: (id: string, fromSync?: boolean) => Promise<boolean>;
    loadRules: (fromSync?: boolean) => Promise<void>;
    applyRulesToTransaction: (transaction: Transaction, stage?: "PRE" | "DEFAULT" | "POST") => Transaction;
    checkConditions: (conditions: any[], tx: Transaction, rule?: AutomationRule) => boolean;
    applyActions: (rule: AutomationRule, tx: Transaction) => Transaction;
    handleSyncMessage: (operation: SyncOperationType, rule: AutomationRule) => void;
    updateRecipientReferences: (oldRecipientIds: string[], newRecipientId: string) => Promise<void>;
    getAutomationRulesWithRecipient: (recipientId: string) => Promise<AutomationRule[]>;
    countAutomationRulesWithRecipient: (recipientId: string) => Promise<number>;
    validateRecipientDeletion: (recipientIds: string[]) => Promise<RecipientValidationResult[]>;
    cleanupRecipientReferences: (recipientId: string) => Promise<void>;
    reset: () => Promise<void>;
}, "getRuleById">, Pick<{
    rules: import("vue").Ref<{
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    }[], AutomationRule[] | {
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    }[]>;
    addRule: (ruleData: (Omit<AutomationRule, "updated_at" | "id"> & Partial<Pick<AutomationRule, "id">>) | AutomationRule, fromSync?: boolean) => Promise<AutomationRule>;
    getRuleById: import("vue").ComputedRef<(id: string) => {
        id: string;
        name: string;
        description?: string | undefined;
        stage: "PRE" | "DEFAULT" | "POST";
        conditions: {
            type: RuleConditionType;
            operator: string;
            value: string | number | string[];
        }[];
        actions: {
            type: RuleActionType;
            field?: string | undefined;
            value: string | string[] | number;
        }[];
        priority: number;
        isActive: boolean;
        conditionLogic?: "all" | "any" | undefined;
        updatedAt?: string | undefined;
    } | undefined>;
    updateRule: (id: string, ruleUpdatesData: Omit<AutomationRule, "id">, fromSync?: boolean) => Promise<boolean>;
    deleteRule: (id: string, fromSync?: boolean) => Promise<boolean>;
    loadRules: (fromSync?: boolean) => Promise<void>;
    applyRulesToTransaction: (transaction: Transaction, stage?: "PRE" | "DEFAULT" | "POST") => Transaction;
    checkConditions: (conditions: any[], tx: Transaction, rule?: AutomationRule) => boolean;
    applyActions: (rule: AutomationRule, tx: Transaction) => Transaction;
    handleSyncMessage: (operation: SyncOperationType, rule: AutomationRule) => void;
    updateRecipientReferences: (oldRecipientIds: string[], newRecipientId: string) => Promise<void>;
    getAutomationRulesWithRecipient: (recipientId: string) => Promise<AutomationRule[]>;
    countAutomationRulesWithRecipient: (recipientId: string) => Promise<number>;
    validateRecipientDeletion: (recipientIds: string[]) => Promise<RecipientValidationResult[]>;
    cleanupRecipientReferences: (recipientId: string) => Promise<void>;
    reset: () => Promise<void>;
}, "reset" | "updateRecipientReferences" | "handleSyncMessage" | "addRule" | "updateRule" | "deleteRule" | "loadRules" | "applyRulesToTransaction" | "checkConditions" | "applyActions" | "getAutomationRulesWithRecipient" | "countAutomationRulesWithRecipient" | "validateRecipientDeletion" | "cleanupRecipientReferences">>;
export {};
