import { infoLog, errorLog } from '@/utils/logger';

// Lese die Basis-URL aus den Umgebungsvariablen von Vite.
// Stellen Sie sicher, dass eine .env-Datei im Projektstammverzeichnis existiert mit:
// VITE_API_BASE_URL=http://localhost:8000
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!BASE_URL) {
  errorLog('ApiService', 'VITE_API_BASE_URL ist nicht in den Umgebungsvariablen definiert. Bitte überprüfen Sie Ihre .env Datei.');
  // Optional: Einen Standardwert setzen oder einen Fehler werfen, um die Anwendung zu stoppen.
  // throw new Error('VITE_API_BASE_URL is not defined. Please check your .env file.');
}

interface ApiServiceOptions extends RequestInit {
  // Hier könnten zukünftig spezifische Optionen für den API-Service stehen
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

    if (response.status === 204) { // No Content
      return undefined as T;
    }

    const data: T = await response.json();
    infoLog('ApiService', `Response: ${method} ${url}`, { status: response.status, data });
    return data;
  } catch (error) {
    errorLog('ApiService', `Network or other error: ${method} ${url}`, { error });
    throw error; // Fehler weiterwerfen, damit er in der aufrufenden Funktion behandelt werden kann
  }
}

export const apiService = {
  get: <T>(endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string, options?: Omit<ApiServiceOptions, 'body' | 'method'>) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  // User-spezifische Methoden
  getUsers: () => apiService.get<UserFromApi[]>('/users'),
  // createUser wird für den Sync von OFFLINE erstellten Usern verwendet (ohne Passwort)
  createUser: (userData: Omit<UserFromApi, 'createdAt' | 'updatedAt'> & { uuid: string }) => // uuid wird vom Frontend gesendet
    apiService.post<UserFromApi, Omit<UserFromApi, 'createdAt' | 'updatedAt'> & { uuid: string }>('/users', userData),

  // Neue Methode für Online-Registrierung mit Passwort
  registerUserWithPassword: (userData: RegisterUserPayload) =>
    apiService.post<UserFromApi, RegisterUserPayload>('/register', userData),

  // Neue Methode für Online-Login
  login: (credentials: LoginPayload) =>
    apiService.post<UserFromApi, LoginPayload>('/login', credentials), // Annahme: Login gibt UserFromApi zurück

  // Neue Methode für User-Updates (ohne Passwort)
  updateUser: (uuid: string, userData: Omit<UserFromApi, 'uuid' | 'createdAt' | 'updatedAt'>) =>
    apiService.put<UserFromApi, Omit<UserFromApi, 'uuid' | 'createdAt' | 'updatedAt'>>(`/users/${uuid}`, userData),


  // Tenant-spezifische Methoden
  getTenantsForUser: (userId: string) =>
    apiService.get<TenantFromApi[]>(`/tenants?user_id=${userId}`),
  createTenant: (tenantData: Omit<TenantFromApi, 'uuid' | 'createdAt' | 'updatedAt'>) =>
    apiService.post<TenantFromApi, Omit<TenantFromApi, 'uuid' | 'createdAt' | 'updatedAt'>>('/tenants', tenantData),
};

// Beispiel für Typen, die vom Backend erwartet/zurückgegeben werden (ggf. in types/ Verzeichnis auslagern)

// Schnittstellen für API-Request-Bodies
export interface RegisterUserPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  username_or_email: string;
  password: string;
}

// Schnittstellen für API-Responses
export interface UserFromApi {
  uuid: string;
  name: string;
  email: string;
  createdAt: string; // ISO 8601 String
  updatedAt: string; // ISO 8601 String
  // Tokens könnten hier auch enthalten sein, je nach Login-Endpoint
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
