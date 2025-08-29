import Dexie, { type Table } from 'dexie';
export interface LocalUser {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: string;
    updatedAt: string;
    accessToken?: string;
    refreshToken?: string;
}
export interface DbUser {
    uuid: string;
    username: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    needsBackendSync?: boolean;
    passwordHash?: string;
}
export interface DbTenant {
    uuid: string;
    tenantName: string;
    user_id: string;
    createdAt: string;
    updatedAt: string;
}
export interface DbSession {
    id: string;
    currentUserId: string | null;
    currentTenantId: string | null;
}
declare class FinwiseUserDB extends Dexie {
    dbUsers: Table<DbUser, string>;
    dbTenants: Table<DbTenant, string>;
    dbSession: Table<DbSession, string>;
    constructor();
}
export declare const db: FinwiseUserDB;
export declare const useUserStore: import("pinia").StoreDefinition<"user", Pick<{
    users: import("vue").Ref<{
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    }[], LocalUser[] | {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    }[]>;
    getUserById: import("vue").ComputedRef<(id: string) => {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    } | undefined>;
    getUserByUsername: import("vue").ComputedRef<(username: string) => {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    } | undefined>;
    registerUser: (username: string, email: string, plainPassword: string) => Promise<LocalUser | null>;
    validateLogin: (usernameOrEmail: string, plainPassword: string) => Promise<LocalUser | null>;
    changePassword: (userId: string, newPlainPassword: string) => Promise<boolean>;
    deleteUser: (userId: string) => Promise<boolean>;
    reset: () => Promise<void>;
    syncUsers: () => Promise<void>;
    syncUserTenants: (userId: string) => Promise<void>;
    _loadUsersFromDb: () => Promise<void>;
    initializeUserStore: () => Promise<void>;
}, "users">, Pick<{
    users: import("vue").Ref<{
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    }[], LocalUser[] | {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    }[]>;
    getUserById: import("vue").ComputedRef<(id: string) => {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    } | undefined>;
    getUserByUsername: import("vue").ComputedRef<(username: string) => {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    } | undefined>;
    registerUser: (username: string, email: string, plainPassword: string) => Promise<LocalUser | null>;
    validateLogin: (usernameOrEmail: string, plainPassword: string) => Promise<LocalUser | null>;
    changePassword: (userId: string, newPlainPassword: string) => Promise<boolean>;
    deleteUser: (userId: string) => Promise<boolean>;
    reset: () => Promise<void>;
    syncUsers: () => Promise<void>;
    syncUserTenants: (userId: string) => Promise<void>;
    _loadUsersFromDb: () => Promise<void>;
    initializeUserStore: () => Promise<void>;
}, "getUserById" | "getUserByUsername">, Pick<{
    users: import("vue").Ref<{
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    }[], LocalUser[] | {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    }[]>;
    getUserById: import("vue").ComputedRef<(id: string) => {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    } | undefined>;
    getUserByUsername: import("vue").ComputedRef<(username: string) => {
        id: string;
        username: string;
        email: string;
        passwordHash: string;
        createdAt: string;
        updatedAt: string;
        accessToken?: string | undefined;
        refreshToken?: string | undefined;
    } | undefined>;
    registerUser: (username: string, email: string, plainPassword: string) => Promise<LocalUser | null>;
    validateLogin: (usernameOrEmail: string, plainPassword: string) => Promise<LocalUser | null>;
    changePassword: (userId: string, newPlainPassword: string) => Promise<boolean>;
    deleteUser: (userId: string) => Promise<boolean>;
    reset: () => Promise<void>;
    syncUsers: () => Promise<void>;
    syncUserTenants: (userId: string) => Promise<void>;
    _loadUsersFromDb: () => Promise<void>;
    initializeUserStore: () => Promise<void>;
}, "reset" | "registerUser" | "validateLogin" | "changePassword" | "deleteUser" | "syncUsers" | "syncUserTenants" | "_loadUsersFromDb" | "initializeUserStore">>;
export {};
