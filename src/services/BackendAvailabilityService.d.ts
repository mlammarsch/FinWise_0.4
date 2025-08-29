/**
 * Backend-Verfügbarkeits-Service
 * Bietet eine zentrale HTTP-API-basierte Prüfung der Backend-Verfügbarkeit
 * Unabhängig von WebSocket-Verbindungen
 */
export declare const BackendAvailabilityService: {
    isOnline: import("vue").ComputedRef<boolean>;
    isChecking: import("vue").ComputedRef<boolean>;
    /**
     * Prüft die Backend-Verfügbarkeit über HTTP-API
     */
    checkAvailability(force?: boolean): Promise<boolean>;
    /**
     * Startet periodische Backend-Checks
     */
    startPeriodicChecks(intervalMs?: number): void;
    /**
     * Setzt den Backend-Status manuell (für Tests oder spezielle Fälle)
     */
    setStatus(online: boolean): void;
    /**
     * Computed für UI-Button-Status
     */
    readonly isButtonEnabled: import("vue").ComputedRef<boolean>;
    /**
     * Hilfsfunktion für Tooltip-Text
     */
    getTooltipText(enabledText: string, checkingText?: string, offlineText?: string): string;
};
