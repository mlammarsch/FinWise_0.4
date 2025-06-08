import { infoLog, errorLog } from '@/utils/logger';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!BASE_URL) {
  errorLog('ApiService', 'VITE_API_BASE_URL ist nicht in den Umgebungsvariablen definiert. Bitte überprüfen Sie Ihre .env Datei.');
}

interface ApiServiceOptions extends RequestInit {
}

async function request<T>(endpoint: string, options: ApiServiceOptions = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const { method = 'GET', headers = {}, body } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  };

  infoLog('ApiService', `Request: ${method} ${url}`, { body: options.body });

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      errorLog('ApiService', `API Error: ${response.status} ${response.statusText}`, {
        url,
        status: response.status,
        errorData,
      });
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
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
 *  Zentraler Service für alle API-Anfragen. Bündelt GET, POST, PUT, DELETE und spezifische User- und Tenant-Methoden.
 */
export const apiService = {
  get: <T>(endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

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
