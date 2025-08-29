export declare class ImageService {
    /**
     * Lädt ein Logo für eine Entität (Konto oder Kontengruppe) hoch.
     * @param entityId - Die ID der Entität.
     * @param entityType - Der Typ der Entität ('account' oder 'account_group').
     * @param file - Die hochzuladende Datei.
     * @returns Ein Promise, das bei Erfolg ein Objekt mit dem logo_path zurückgibt, sonst null.
     */
    static uploadLogo(entityId: string, entityType: 'account' | 'account_group', file: File, tenantId: string): Promise<{
        logo_path: string;
    } | null>;
    /**
     * Löscht ein Logo anhand seines Pfades.
     * @param logoPath - Der relative Pfad zum Logo (z.B. tenant_id/uuid.ext).
     * @returns Ein Promise, das true bei Erfolg zurückgibt, sonst false.
     */
    static deleteLogo(logoPath: string): Promise<boolean>;
    /**
     * Konstruiert die vollständige URL zum Abrufen eines Logos.
     * @param logoPath - Der relative Pfad zum Logo oder null/undefined.
     * @returns Die vollständige URL als String oder null, wenn kein logoPath vorhanden ist.
     */
    static getLogoUrl(logoPath: string | null | undefined): string | null;
    /**
     * Ruft ein Logo vom Backend ab, konvertiert es in eine Base64 Data URL und speichert es im Cache.
     * @param logoPath - Der relative Pfad zum Logo.
     * @returns Die Base64 Data URL des Logos oder null bei einem Fehler.
     */
    static fetchAndCacheLogo(logoPath: string): Promise<string | null>;
}
