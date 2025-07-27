import { infoLog, errorLog } from '@/utils/logger';
import { useSessionStore } from '@/stores/sessionStore';

// This is a common workaround for Vite's import.meta.env typing issues in TS files.
const BASE_URL = (import.meta as any).env.VITE_API_BASE_URL as string;

if (!BASE_URL) {
  errorLog('ApiService', 'VITE_API_BASE_URL ist nicht in den Umgebungsvariablen definiert. Bitte überprüfen Sie Ihre .env Datei.');
}

// We define a custom options type to allow any type for the body,
// as we will handle the serialization within the request function.
interface ApiServiceOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

async function request<T>(endpoint: string, options: ApiServiceOptions = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const { method = 'GET', headers = {}, body } = options;

  // Automatisch TenantId und UserId als Header hinzufügen, falls verfügbar
  const sessionStore = useSessionStore();
  const tenantId = sessionStore.currentTenantId;
  const userId = sessionStore.currentUserId;

  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      ...(tenantId && { 'X-Tenant-Id': tenantId }),
      ...(userId && { 'X-User-Id': userId })
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
      // Let the browser set the Content-Type header for FormData,
      // it will include the necessary boundary.
      delete (config.headers as Record<string, string>)['Content-Type'];
    } else {
      // For other objects, assume JSON.
      config.body = JSON.stringify(body);
      // Set Content-Type to application/json if it's not already set.
      if (!(config.headers as Record<string, string>)['Content-Type']) {
        (config.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }
  }

  infoLog('ApiService', `Request: ${method} ${url}`, { body: options.body instanceof FormData ? 'FormData' : options.body });

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));

      // Verbesserte Fehlermeldung für besseres Debugging
      let errorMessage = errorData.detail || `API request failed with status ${response.status}`;

      // Bei 422 Validation Error: Detaillierte Fehlermeldung extrahieren
      if (response.status === 422 && errorData.detail && Array.isArray(errorData.detail)) {
        const validationErrors = errorData.detail.map((err: any) =>
          `${err.loc?.join('.')} - ${err.msg}`
        ).join('; ');
        errorMessage = `Validation Error: ${validationErrors}`;
      }

      errorLog('ApiService', `API Error: ${response.status} ${response.statusText}`, {
        url,
        status: response.status,
        errorData,
        errorMessage
      });

      const err = new Error(errorMessage);
      (err as any).status = response.status;
      (err as any).errorData = errorData;
      throw err;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data: T = await response.json();
    infoLog('ApiService', `Response: ${method} ${url}`, { status: response.status, data });
    return data;
  } catch (error) {
    errorLog('ApiService', `Network or other error: ${method} ${url}`, { error });
    throw error;
  }
}

/**
 * Spezielle Request-Funktion für Datei-Downloads (Binärdateien)
 */
async function downloadFile(endpoint: string, options: ApiServiceOptions = {}): Promise<ArrayBuffer> {
  const url = `${BASE_URL}${endpoint}`;
  const { method = 'GET', headers = {}, body } = options;

  // Automatisch TenantId und UserId als Header hinzufügen, falls verfügbar
  const sessionStore = useSessionStore();
  const tenantId = sessionStore.currentTenantId;
  const userId = sessionStore.currentUserId;

  const config: RequestInit = {
    method,
    headers: {
      ...headers,
      ...(tenantId && { 'X-Tenant-Id': tenantId }),
      ...(userId && { 'X-User-Id': userId })
    },
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
      delete (config.headers as Record<string, string>)['Content-Type'];
    } else {
      config.body = JSON.stringify(body);
      if (!(config.headers as Record<string, string>)['Content-Type']) {
        (config.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }
  }

  infoLog('ApiService', `File Download Request: ${method} ${url}`, { body: options.body instanceof FormData ? 'FormData' : options.body });

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));

      // Verbesserte Fehlermeldung für besseres Debugging
      let errorMessage = errorData.detail || `API request failed with status ${response.status}`;

      // Bei 422 Validation Error: Detaillierte Fehlermeldung extrahieren
      if (response.status === 422 && errorData.detail && Array.isArray(errorData.detail)) {
        const validationErrors = errorData.detail.map((err: any) =>
          `${err.loc?.join('.')} - ${err.msg}`
        ).join('; ');
        errorMessage = `Validation Error: ${validationErrors}`;
      }

      errorLog('ApiService', `API Error: ${response.status} ${response.statusText}`, {
        url,
        status: response.status,
        errorData,
        errorMessage
      });

      const err = new Error(errorMessage);
      (err as any).status = response.status;
      (err as any).errorData = errorData;
      throw err;
    }

    const arrayBuffer = await response.arrayBuffer();
    infoLog('ApiService', `File Download Response: ${method} ${url}`, {
      status: response.status,
      contentType: response.headers.get('content-type'),
      size: arrayBuffer.byteLength
    });
    return arrayBuffer;
  } catch (error) {
    errorLog('ApiService', `Network or other error: ${method} ${url}`, { error });
    throw error;
  }
}

/**
 *  Zentraler Service für alle API-Anfragen. Bündelt GET, POST, PUT, DELETE und spezifische User- und Tenant-Methoden.
 */
export const apiService = {
  get: <T>(endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  // Spezielle Methode für Datei-Downloads
  downloadFile: (endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    downloadFile(endpoint, { ...options, method: 'GET' }),

  getUsers: () => apiService.get<UserFromApi[]>('/users'),
  createUser: (userData: { uuid: string; name: string; email: string; hashed_password?: string }) =>
    apiService.post<UserFromApi, { uuid: string; name: string; email: string; hashed_password?: string }>('/users', userData),

  registerUserWithPassword: (userData: RegisterUserPayload) =>
    apiService.post<UserFromApi, RegisterUserPayload>('/register', userData),

  login: (credentials: LoginPayload) =>
    apiService.post<UserFromApi, LoginPayload>('/login', credentials),

  updateUser: (uuid: string, userData: Omit<UserFromApi, 'uuid' | 'createdAt' | 'updatedAt'>) =>
    apiService.put<UserFromApi, Omit<UserFromApi, 'uuid' | 'createdAt' | 'updatedAt'>>(`/users/${uuid}`, userData),


  getTenantsForUser: (userId: string) =>
    apiService.get<TenantFromApi[]>(`/tenants?user_id=${userId}`),
  createTenant: (tenantData: Omit<TenantFromApi, 'uuid' | 'createdAt' | 'updatedAt'>) =>
    apiService.post<TenantFromApi, Omit<TenantFromApi, 'uuid' | 'createdAt' | 'updatedAt'>>('/tenants', tenantData),

  // Mandanten-Verwaltungs-APIs
  updateTenant: (tenantId: string, tenantData: { name: string }, userId: string) =>
    apiService.put<TenantFromApi, { name: string }>(`/tenants/${tenantId}?user_id=${userId}`, tenantData),
  deleteTenantCompletely: (tenantId: string, userId: string) =>
    apiService.delete<void>(`/tenants/${tenantId}/complete?user_id=${userId}`),
  resetTenantDatabase: (tenantId: string, userId: string) =>
    apiService.post<void, {}>(`/tenants/${tenantId}/reset-database?user_id=${userId}`, {}),
  resetTenantToInitialState: (tenantId: string, userId: string) =>
    apiService.post<void, {}>(`/tenants/${tenantId}/reset-to-initial?user_id=${userId}`, {}),
  clearTenantSyncQueue: (tenantId: string, userId: string) =>
    apiService.delete<void>(`/tenants/${tenantId}/sync-queue?user_id=${userId}`),

  // Backend-Verfügbarkeits-Check
  ping: () => apiService.get<{ status: string; message: string }>('/ping'),
};

export interface RegisterUserPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  username_or_email: string;
  password: string;
}

export interface UserFromApi {
  uuid: string;
  name: string;
  email: string;
  createdAt: string; // ISO 8601 String
  updatedAt: string; // ISO 8601 String
  accessToken?: string;
  refreshToken?: string;
}

export interface TenantFromApi {
  uuid: string;
  name: string;
  user_id: string;
  createdAt: string; // ISO 8601 String
  updatedAt: string; // ISO 8601 String
}
