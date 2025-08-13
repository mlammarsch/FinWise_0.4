// src/utils/fieldMapping.ts

/**
 * Utility functions for mapping field names between Frontend (camelCase) and Backend (snake_case)
 *
 * This solves the Last-Write-Wins problem where updatedAt/updated_at field mismatches
 * cause timestamp information to be lost during synchronization.
 */

import type {
  Recipient, Category, Transaction, Tag, AutomationRule, PlanningTransaction,
  Account, AccountGroup, CategoryGroup
} from '@/types';

// Type for entities that can be mapped
type MappableEntity = Recipient | Category | Transaction | Tag | AutomationRule | PlanningTransaction | Account | AccountGroup | CategoryGroup;

// Type for backend payload format (snake_case)
type BackendPayload = MappableEntity & {
  updated_at?: string;
  updatedAt?: never; // Ensure we don't have both
};

// Type for frontend format (camelCase)
type FrontendPayload = MappableEntity & {
  updatedAt?: string;
  updated_at?: never; // Ensure we don't have both
};

/**
 * Maps frontend entity (camelCase) to backend format (snake_case)
 * Converts: updatedAt → updated_at
 */
export function mapToBackendFormat<T extends MappableEntity>(entity: T): BackendPayload {
  if (!entity) return entity as BackendPayload;

  const mapped = { ...entity } as any;

  // Map updatedAt to updated_at
  if (mapped.updatedAt !== undefined) {
    mapped.updated_at = mapped.updatedAt;
    delete mapped.updatedAt;
  }

  return mapped as BackendPayload;
}

/**
 * Maps backend entity (snake_case) to frontend format (camelCase)
 * Converts: updated_at → updatedAt
 */
export function mapToFrontendFormat<T extends MappableEntity>(entity: T): FrontendPayload {
  if (!entity) return entity as FrontendPayload;

  const mapped = { ...entity } as any;

  // Map updated_at to updatedAt
  if (mapped.updated_at !== undefined) {
    mapped.updatedAt = mapped.updated_at;
    delete mapped.updated_at;
  }

  return mapped as FrontendPayload;
}

/**
 * Maps an array of entities from frontend to backend format
 */
export function mapArrayToBackendFormat<T extends MappableEntity>(entities: T[]): BackendPayload[] {
  return entities.map(entity => mapToBackendFormat(entity));
}

/**
 * Maps an array of entities from backend to frontend format
 */
export function mapArrayToFrontendFormat<T extends MappableEntity>(entities: T[]): FrontendPayload[] {
  return entities.map(entity => mapToFrontendFormat(entity));
}

/**
 * Maps sync queue payload to backend format
 * Handles nested payload objects in SyncQueueEntry
 */
export function mapSyncPayloadToBackendFormat(payload: any): any {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  // Handle arrays
  if (Array.isArray(payload)) {
    return payload.map(item => mapSyncPayloadToBackendFormat(item));
  }

  // Handle objects - apply field mapping
  return mapToBackendFormat(payload);
}

/**
 * Maps WebSocket notification data to frontend format
 * Handles the complex NotificationDataPayload structure
 */
export function mapNotificationDataToFrontendFormat(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const mapped = { ...data };

  // Handle single_entity
  if (mapped.single_entity) {
    mapped.single_entity = mapToFrontendFormat(mapped.single_entity);
  }

  // Handle arrays of entities
  const arrayFields = [
    'accounts', 'account_groups', 'categories', 'category_groups',
    'recipients', 'tags', 'automation_rules', 'planning_transactions', 'transactions'
  ];

  for (const field of arrayFields) {
    if (mapped[field] && Array.isArray(mapped[field])) {
      mapped[field] = mapArrayToFrontendFormat(mapped[field]);
    }
  }

  return mapped;
}
