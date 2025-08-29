/**
 * TenantService – zentrale API für Mandanten-Management.
 */
export declare const TenantService: {
    /**
     * Erstellt einen neuen Tenant mit Standardkategorien und -konten.
     */
    createTenant(tenantName: string): Promise<import("../stores/userStore").DbTenant>;
    renameTenant(tenantId: string, newName: string): Promise<boolean>;
    deleteTenant(tenantId: string): Promise<boolean>;
    switchTenant(tenantId: string): Promise<boolean>;
    getOwnTenants(): import("../stores/userStore").DbTenant[];
    ensureTenantSelected(): boolean;
    /**
     * Löscht einen Mandanten vollständig (Backend + Frontend)
     * Bei aktivem Mandanten: Logout + IndexedDB löschen + Redirect
     * Bei inaktivem Mandanten: Nur Backend-Löschung
     */
    deleteTenantCompletely(tenantId: string, router?: any): Promise<boolean>;
    /**
     * Setzt die Datenbank eines Mandanten zurück
     * Löscht lokale IndexedDB und führt Firstload durch
     */
    resetTenantDatabase(tenantId: string, router?: any): Promise<boolean>;
    /**
     * Löscht die Sync-Queue eines Mandanten
     */
    clearSyncQueue(tenantId: string): Promise<boolean>;
    /**
     * Setzt einen Mandanten in den Urzustand zurück (löschen + neu anlegen)
     * Bei aktivem Mandanten: Logout + Redirect zu TenantSelectView
     */
    resetTenantToInitialState(tenantId: string, router?: any): Promise<boolean>;
};
