import { infoLog, errorLog } from '@/utils/logger';
import { useSessionStore } from '@/stores/sessionStore';
// This is a common workaround for Vite's import.meta.env typing issues in TS files.
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!BASE_URL) {
    errorLog('ApiService', 'VITE_API_BASE_URL ist nicht in den Umgebungsvariablen definiert. Bitte überprüfen Sie Ihre .env Datei.');
}
async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const { method = 'GET', headers = {}, body } = options;
    // Automatisch TenantId und UserId als Header hinzufügen, falls verfügbar
    const sessionStore = useSessionStore();
    const tenantId = sessionStore.currentTenantId;
    const userId = sessionStore.currentUserId;
    const config = {
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
            delete config.headers['Content-Type'];
        }
        else {
            // For other objects, assume JSON.
            config.body = JSON.stringify(body);
            // Set Content-Type to application/json if it's not already set.
            if (!config.headers['Content-Type']) {
                config.headers['Content-Type'] = 'application/json';
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
                const validationErrors = errorData.detail.map((err) => `${err.loc?.join('.')} - ${err.msg}`).join('; ');
                errorMessage = `Validation Error: ${validationErrors}`;
            }
            errorLog('ApiService', `API Error: ${response.status} ${response.statusText}`, {
                url,
                status: response.status,
                errorData,
                errorMessage
            });
            const err = new Error(errorMessage);
            err.status = response.status;
            err.errorData = errorData;
            throw err;
        }
        if (response.status === 204) {
            return undefined;
        }
        const data = await response.json();
        infoLog('ApiService', `Response: ${method} ${url}`, { status: response.status, data });
        return data;
    }
    catch (error) {
        errorLog('ApiService', `Network or other error: ${method} ${url}`, { error });
        throw error;
    }
}
/**
 * Spezielle Request-Funktion für Datei-Downloads (Binärdateien)
 */
async function downloadFile(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const { method = 'GET', headers = {}, body } = options;
    // Automatisch TenantId und UserId als Header hinzufügen, falls verfügbar
    const sessionStore = useSessionStore();
    const tenantId = sessionStore.currentTenantId;
    const userId = sessionStore.currentUserId;
    const config = {
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
            delete config.headers['Content-Type'];
        }
        else {
            config.body = JSON.stringify(body);
            if (!config.headers['Content-Type']) {
                config.headers['Content-Type'] = 'application/json';
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
                const validationErrors = errorData.detail.map((err) => `${err.loc?.join('.')} - ${err.msg}`).join('; ');
                errorMessage = `Validation Error: ${validationErrors}`;
            }
            errorLog('ApiService', `API Error: ${response.status} ${response.statusText}`, {
                url,
                status: response.status,
                errorData,
                errorMessage
            });
            const err = new Error(errorMessage);
            err.status = response.status;
            err.errorData = errorData;
            throw err;
        }
        const arrayBuffer = await response.arrayBuffer();
        infoLog('ApiService', `File Download Response: ${method} ${url}`, {
            status: response.status,
            contentType: response.headers.get('content-type'),
            size: arrayBuffer.byteLength
        });
        return arrayBuffer;
    }
    catch (error) {
        errorLog('ApiService', `Network or other error: ${method} ${url}`, { error });
        throw error;
    }
}
/**
 *  Zentraler Service für alle API-Anfragen. Bündelt GET, POST, PUT, DELETE und spezifische User- und Tenant-Methoden.
 */
export const apiService = {
    get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body }),
    put: (endpoint, body, options) => request(endpoint, { ...options, method: 'PUT', body }),
    delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
    // Spezielle Methode für Datei-Downloads
    downloadFile: (endpoint, options) => downloadFile(endpoint, { ...options, method: 'GET' }),
    getUsers: () => apiService.get('/users'),
    createUser: (userData) => apiService.post('/users', userData),
    registerUserWithPassword: (userData) => apiService.post('/register', userData),
    login: (credentials) => apiService.post('/login', credentials),
    updateUser: (uuid, userData) => apiService.put(`/users/${uuid}`, userData),
    getTenantsForUser: (userId) => apiService.get(`/tenants?user_id=${userId}`),
    createTenant: (tenantData) => apiService.post('/tenants', tenantData),
    // Mandanten-Verwaltungs-APIs
    updateTenant: (tenantId, tenantData, userId) => apiService.put(`/tenants/${tenantId}?user_id=${userId}`, tenantData),
    deleteTenantCompletely: (tenantId, userId) => apiService.delete(`/tenants/${tenantId}/complete?user_id=${userId}`),
    resetTenantDatabase: (tenantId, userId) => apiService.post(`/tenants/${tenantId}/reset-database?user_id=${userId}`, {}),
    resetTenantToInitialState: (tenantId, userId) => apiService.post(`/tenants/${tenantId}/reset-to-initial?user_id=${userId}`, {}),
    clearTenantSyncQueue: (tenantId, userId) => apiService.delete(`/tenants/${tenantId}/sync-queue?user_id=${userId}`),
    // Backend-Verfügbarkeits-Check
    ping: () => apiService.get('/ping'),
};
