/**
 * Session-Store – hält aktiven User und Tenant.
 */
import { type LocalUser } from './userStore';
export declare const useSessionStore: import("pinia").StoreDefinition<"session", Pick<{
    currentUserId: import("vue").Ref<string | null, string | null>;
    currentTenantId: import("vue").Ref<string | null, string | null>;
    currentUser: import("vue").ComputedRef<LocalUser | undefined>;
    currentTenant: import("vue").ComputedRef<import("./userStore").DbTenant | null>;
    login: (userId: string) => Promise<void>;
    logout: () => Promise<void>;
    logoutTenant: () => Promise<void>;
    switchTenant: (tenantId: string) => Promise<boolean>;
    loadSession: () => Promise<void>;
    ensureDefaultUser: () => Promise<void>;
}, "currentUserId" | "currentTenantId">, Pick<{
    currentUserId: import("vue").Ref<string | null, string | null>;
    currentTenantId: import("vue").Ref<string | null, string | null>;
    currentUser: import("vue").ComputedRef<LocalUser | undefined>;
    currentTenant: import("vue").ComputedRef<import("./userStore").DbTenant | null>;
    login: (userId: string) => Promise<void>;
    logout: () => Promise<void>;
    logoutTenant: () => Promise<void>;
    switchTenant: (tenantId: string) => Promise<boolean>;
    loadSession: () => Promise<void>;
    ensureDefaultUser: () => Promise<void>;
}, "currentUser" | "currentTenant">, Pick<{
    currentUserId: import("vue").Ref<string | null, string | null>;
    currentTenantId: import("vue").Ref<string | null, string | null>;
    currentUser: import("vue").ComputedRef<LocalUser | undefined>;
    currentTenant: import("vue").ComputedRef<import("./userStore").DbTenant | null>;
    login: (userId: string) => Promise<void>;
    logout: () => Promise<void>;
    logoutTenant: () => Promise<void>;
    switchTenant: (tenantId: string) => Promise<boolean>;
    loadSession: () => Promise<void>;
    ensureDefaultUser: () => Promise<void>;
}, "login" | "logout" | "logoutTenant" | "switchTenant" | "loadSession" | "ensureDefaultUser">>;
