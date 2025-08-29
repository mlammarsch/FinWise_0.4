import { LogLevel } from '@/utils/logger';
interface SettingsState {
    logLevel: LogLevel;
    enabledLogCategories: Set<string>;
    historyRetentionDays: number;
}
export declare const useSettingsStore: import("pinia").StoreDefinition<"settings", SettingsState, {}, {
    /**
     * Lädt die Settings beim App-Start aus dem LocalStorage.
     * Falls API verfügbar: Lädt einmalig vom Backend und überschreibt lokale Settings.
     */
    loadFromStorage(): Promise<void>;
    /**
     * Setzt Default-Werte und aktualisiert LogConfig
     */
    setDefaults(): void;
    /**
     * Aktualisiert die LogConfig basierend auf aktuellen Settings
     */
    updateLogConfig(): void;
    /**
     * Speichert aktuelle Settings in den LocalStorage.
     * Falls API verfügbar: Sendet direkt an Backend.
     */
    saveToStorage(): Promise<void>;
    /**
     * Setzt Logger Settings gezielt und speichert sie sofort.
     */
    setLoggerSettings(level: LogLevel, categories: Set<string>, retentionDays: number): Promise<void>;
    /**
     * Prüft ob das Backend verfügbar ist
     */
    isBackendAvailable(): Promise<boolean>;
    /**
     * Setzt Settings auf Standardwerte zurück
     */
    resetToDefaults(): Promise<void>;
    /**
     * Initialisiert Settings beim Login
     */
    initializeForUser(): Promise<void>;
}>;
export {};
