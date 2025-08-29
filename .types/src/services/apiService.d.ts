interface ApiServiceOptions extends Omit<RequestInit, 'body'> {
    body?: any;
}
/**
 *  Zentraler Service für alle API-Anfragen. Bündelt GET, POST, PUT, DELETE und spezifische User- und Tenant-Methoden.
 */
export declare const apiService: {
    get: <T>(endpoint: string, options?: Omit<ApiServiceOptions, "body" | "method">) => Promise<T>;
    post: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, "body" | "method">) => Promise<T>;
    put: <T, B>(endpoint: string, body: B, options?: Omit<ApiServiceOptions, "body" | "method">) => Promise<T>;
    delete: <T>(endpoint: string, options?: Omit<ApiServiceOptions, "body" | "method">) => Promise<T>;
    downloadFile: (endpoint: string, options?: Omit<ApiServiceOptions, "body" | "method">) => Promise<ArrayBuffer>;
    getUsers: () => Promise<UserFromApi[]>;
    createUser: (userData: {
        uuid: string;
        name: string;
        email: string;
        hashed_password?: string;
    }) => Promise<UserFromApi>;
    registerUserWithPassword: (userData: RegisterUserPayload) => Promise<UserFromApi>;
    login: (credentials: LoginPayload) => Promise<UserFromApi>;
    updateUser: (uuid: string, userData: Omit<UserFromApi, "uuid" | "createdAt" | "updatedAt">) => Promise<UserFromApi>;
    getTenantsForUser: (userId: string) => Promise<TenantFromApi[]>;
    createTenant: (tenantData: Omit<TenantFromApi, "uuid" | "createdAt" | "updatedAt">) => Promise<TenantFromApi>;
    updateTenant: (tenantId: string, tenantData: {
        name: string;
    }, userId: string) => Promise<TenantFromApi>;
    deleteTenantCompletely: (tenantId: string, userId: string) => Promise<void>;
    resetTenantDatabase: (tenantId: string, userId: string) => Promise<void>;
    resetTenantToInitialState: (tenantId: string, userId: string) => Promise<void>;
    clearTenantSyncQueue: (tenantId: string, userId: string) => Promise<void>;
    ping: () => Promise<{
        status: string;
        message: string;
    }>;
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
    createdAt: string;
    updatedAt: string;
    accessToken?: string;
    refreshToken?: string;
}
export interface TenantFromApi {
    uuid: string;
    name: string;
    user_id: string;
    createdAt: string;
    updatedAt: string;
}
export {};
