/**
 * Utility functions for mapping field names between Frontend (camelCase) and Backend (snake_case)
 *
 * This solves the Last-Write-Wins problem where updatedAt/updated_at field mismatches
 * cause timestamp information to be lost during synchronization.
 */
import type { Recipient, Category, Transaction, Tag, AutomationRule, PlanningTransaction, Account, AccountGroup, CategoryGroup } from '@/types';
type MappableEntity = Recipient | Category | Transaction | Tag | AutomationRule | PlanningTransaction | Account | AccountGroup | CategoryGroup;
type BackendPayload = MappableEntity & {
    updated_at?: string;
    updatedAt?: never;
};
type FrontendPayload = MappableEntity & {
    updatedAt?: string;
    updated_at?: never;
};
/**
 * Maps frontend entity (camelCase) to backend format (snake_case)
 * Converts: updatedAt → updated_at
 */
export declare function mapToBackendFormat<T extends MappableEntity>(entity: T): BackendPayload;
/**
 * Maps backend entity (snake_case) to frontend format (camelCase)
 * Converts: updated_at → updatedAt
 */
export declare function mapToFrontendFormat<T extends MappableEntity>(entity: T): FrontendPayload;
/**
 * Maps an array of entities from frontend to backend format
 */
export declare function mapArrayToBackendFormat<T extends MappableEntity>(entities: T[]): BackendPayload[];
/**
 * Maps an array of entities from backend to frontend format
 */
export declare function mapArrayToFrontendFormat<T extends MappableEntity>(entities: T[]): FrontendPayload[];
/**
 * Maps sync queue payload to backend format
 * Handles nested payload objects in SyncQueueEntry
 */
export declare function mapSyncPayloadToBackendFormat(payload: any): any;
/**
 * Maps WebSocket notification data to frontend format
 * Handles the complex NotificationDataPayload structure
 */
export declare function mapNotificationDataToFrontendFormat(data: any): any;
export {};
