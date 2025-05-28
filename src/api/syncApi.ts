// src/api/syncApi.ts
import { BACKEND_BASE_URL } from '@/config';
import { infoLog, errorLog, debugLog } from '@/utils/logger';
import type { Account, AccountGroup, SyncableEntity } from '@/types';

export type EntityType = 'accounts' | 'account_groups'; // Erweiterbar für andere Entitäten

export interface SyncQueueItem {
  id: string; // Eindeutige ID für das Queue-Item selbst
  entityType: EntityType;
  entityId: string;
  action: 'created' | 'updated' | 'deleted';
  payload: Partial<SyncableEntity>; // Die zu sendenden Daten
  timestamp: string; // ISO 8601
  tenantId: string; // Mandanten-ID
}

export interface PushResponse {
  success: boolean;
  message?: string;
  results?: { entityId: string; new_updated_at?: string }[];
}

export interface PullResponse<T extends SyncableEntity> {
  success: boolean;
  data: T[];
  server_last_sync_timestamp?: string;
}

const getAuthHeader = (token: string | null): Record<string, string> => {
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

const handleApiError = (error: unknown, context: string): { success: false; error: string } => {
  // Fall 1: Fehlerobjekt mit 'response'-Eigenschaft (typisch für HTTP-Fehler von fetch, wenn response.ok false ist und man .json() aufruft)
  // Dieser Fall wird eigentlich schon VOR dem Aufruf von handleApiError in den syncApi Methoden behandelt.
  // Hier fangen wir eher Netzwerkfehler oder Fehler beim Erstellen des Requests ab.

  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    // Typischer Netzwerkfehler, wenn der Server nicht erreichbar ist
    errorLog('syncApi', `${context} - Network Error (Failed to fetch)`, { message: error.message });
    return { success: false, error: 'Network Error: Failed to fetch. The server may be down or unreachable.' };
  }

  if (error instanceof Error) {
    // Prüfen, ob es sich um einen Fehler handelt, der eine 'response'-Eigenschaft haben könnte (z.B. von einer Bibliothek, die Axios-ähnliche Fehler wirft)
    if ('response' in error && error.response && typeof error.response === 'object' && error.response !== null) {
      const errResponse = error.response as { status?: number; data?: { detail?: string }; statusText?: string };
      const status = errResponse.status || 'N/A';
      const detail = errResponse.data?.detail || errResponse.statusText || 'Unknown API error';
      errorLog('syncApi', `${context} - API Error: ${status}`, errResponse.data);
      return { success: false, error: `API Error: ${status} - ${detail}` };
    }
    // Allgemeiner JavaScript-Fehler
    errorLog('syncApi', `${context} - Request Setup Error or other client-side error`, { message: error.message, stack: error.stack });
    return { success: false, error: `Client-side Error: ${error.message}` };
  }

  // Fallback für nicht-Error-Objekte, die geworfen wurden
  errorLog('syncApi', `${context} - Unknown Error type`, { errorDetails: String(error) });
  return { success: false, error: `An unknown error occurred: ${String(error)}` };
};

export const syncApi = {
  pushChanges: async (items: SyncQueueItem[], token: string | null): Promise<PushResponse | { success: false; error: string }> => {
    infoLog('syncApi', 'Pushing changes to backend', { count: items.length });
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...getAuthHeader(token),
      };

      debugLog('syncApi', 'Sending push request with headers:', headers); // Debug-Log hinzugefügt

      // tenantId aus dem ersten Item extrahieren, da alle Items im Batch zum selben Tenant gehören sollten.
      // Sicherstellen, dass items nicht leer ist, um Fehler zu vermeiden.
      if (!items || items.length === 0) {
        errorLog('syncApi', 'pushChanges: items array is empty, cannot determine tenantId.');
        return { success: false, error: 'Cannot push changes: items array is empty.' };
      }
      const tenantId = items[0].tenantId;
      if (!tenantId) {
        errorLog('syncApi', 'pushChanges: tenantId is missing in the first sync item.');
        return { success: false, error: 'Cannot push changes: tenantId is missing in sync item.' };
      }

      // Stelle sicher, dass beide Query-Parameter (tenantId und requested_tenant_id) gesendet werden.
      // Beide sollten denselben Wert haben.
      const url = `${BACKEND_BASE_URL}/api/v1/sync/push?tenantId=${tenantId}&requested_tenant_id=${tenantId}`;
      debugLog('syncApi', 'Constructed push URL:', { url }); // Hinzugefügter Log für die URL

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(items),
      });

      if (!response.ok) {
        // Versuche, JSON-Fehlerdetails zu parsen, ansonsten Fallback auf StatusText
        let errorDetail = response.statusText;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorData.message || response.statusText;
        } catch (e) {
          // JSON-Parsing fehlgeschlagen, statusText beibehalten
        }
        errorLog('syncApi', `Push API Error: ${response.status}`, { detail: errorDetail });
        return { success: false, error: `API Error: ${response.status} - ${errorDetail}` };
      }
      const data: PushResponse = await response.json();
      infoLog('syncApi', 'Push successful', data);
      return data;
    } catch (error) {
      // Hier landen Netzwerkfehler (z.B. Server nicht erreichbar) oder andere Fehler beim fetch
      return handleApiError(error, 'pushChanges');
    }
  },

  pullChanges: async <T extends SyncableEntity>(
    entityType: EntityType,
    tenantId: string,
    token: string | null, // Token als Parameter hinzugefügt
    lastSyncTimestamp?: string,
  ): Promise<PullResponse<T> | { success: false; error: string }> => {
    infoLog('syncApi', `Pulling changes for ${entityType}`, { tenantId, lastSyncTimestamp });
    let url = `${BACKEND_BASE_URL}/api/v1/sync/pull/${entityType}?requested_tenant_id=${tenantId}`;
    if (lastSyncTimestamp) {
      url += `&last_sync_timestamp=${encodeURIComponent(lastSyncTimestamp)}`;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...getAuthHeader(token), // Token an getAuthHeader übergeben
      };

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errorData = await response.json();
          errorDetail = errorData.detail || errorData.message || response.statusText;
        } catch (e) {
          // JSON-Parsing fehlgeschlagen
        }
        errorLog('syncApi', `Pull API Error for ${entityType}: ${response.status}`, { detail: errorDetail });
        return { success: false, error: `API Error: ${response.status} - ${errorDetail}` };
      }
      const data: PullResponse<T> = await response.json();
      infoLog('syncApi', `Pull for ${entityType} successful`, { count: data.data.length });
      return data;
    } catch (error) {
      return handleApiError(error, `pullChanges (${entityType})`);
    }
  },
};

// Beispiel für die Verwendung im authStore (muss dort implementiert werden, falls noch nicht vorhanden)
// import { defineStore } from 'pinia';
// export const useAuthStore = defineStore('auth', {
//   state: () => ({
//     token: localStorage.getItem('authToken') || null as string | null,
//   }),
//   actions: {
//     setToken(newToken: string) {
//       this.token = newToken;
//       localStorage.setItem('authToken', newToken);
//     },
//     clearToken() {
//       this.token = null;
//       localStorage.removeItem('authToken');
//     },
//   },
//   getters: {
//     isAuthenticated: (state) => !!state.token,
//   }
// });
