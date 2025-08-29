export interface UserSettingsPayload {
    log_level: string;
    log_categories: string[];
    history_retention_days: number;
    updated_at?: string;
}
export interface UserSettingsResponse {
    id: string;
    user_id: string;
    log_level: string;
    log_categories: string[];
    history_retention_days: number;
    created_at: string;
    updated_at: string;
}
export declare class SettingsApiService {
    /**
     * Lädt Settings für einen Benutzer vom Backend
     */
    static getUserSettings(userId: string): Promise<UserSettingsResponse>;
    /**
     * Aktualisiert Settings im Backend
     */
    static updateUserSettings(userId: string, settingsPayload: UserSettingsPayload): Promise<UserSettingsResponse>;
    /**
     * Setzt Settings auf Standardwerte zurück
     */
    static resetUserSettings(userId: string): Promise<UserSettingsResponse>;
    /**
     * Prüft ob das Backend erreichbar ist
     */
    static isBackendAvailable(): Promise<boolean>;
}
