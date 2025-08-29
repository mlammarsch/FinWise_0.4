// src/utils/fieldMapping.ts
/**
 * Maps frontend entity (camelCase) to backend format (snake_case)
 * Converts: updatedAt → updated_at
 */
export function mapToBackendFormat(entity) {
    if (!entity)
        return entity;
    const mapped = { ...entity };
    // Map updatedAt to updated_at
    if (mapped.updatedAt !== undefined) {
        mapped.updated_at = mapped.updatedAt;
        delete mapped.updatedAt;
    }
    return mapped;
}
/**
 * Maps backend entity (snake_case) to frontend format (camelCase)
 * Converts: updated_at → updatedAt
 */
export function mapToFrontendFormat(entity) {
    if (!entity)
        return entity;
    const mapped = { ...entity };
    // Map updated_at to updatedAt
    if (mapped.updated_at !== undefined) {
        mapped.updatedAt = mapped.updated_at;
        delete mapped.updated_at;
    }
    return mapped;
}
/**
 * Maps an array of entities from frontend to backend format
 */
export function mapArrayToBackendFormat(entities) {
    return entities.map(entity => mapToBackendFormat(entity));
}
/**
 * Maps an array of entities from backend to frontend format
 */
export function mapArrayToFrontendFormat(entities) {
    return entities.map(entity => mapToFrontendFormat(entity));
}
/**
 * Maps sync queue payload to backend format
 * Handles nested payload objects in SyncQueueEntry
 */
export function mapSyncPayloadToBackendFormat(payload) {
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
export function mapNotificationDataToFrontendFormat(data) {
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
