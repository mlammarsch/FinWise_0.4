/**
 * Log-Level Definitionen
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare const LogLevelToString: Record<LogLevel, string>;
export declare const StringToLogLevel: Record<string, LogLevel>;
/**
 * Globale Log-Konfiguration (nur für Defaultwerte notwendig)
 */
export declare const LogConfig: {
    level: LogLevel;
    enabledCategories: Set<string> & Omit<Set<string>, keyof Set<any>>;
    historyRetentionDays: number;
};
/**
 * Haupt-Logging-Funktion
 */
export declare function log(level: LogLevel, category: string, message?: any, ...args: any[]): void;
/**
 * Shortcuts für verschiedene Log-Typen
 */
export declare const debugLog: (category: string, message?: any, ...args: any[]) => void;
export declare const infoLog: (category: string, message?: any, ...args: any[]) => void;
export declare const warnLog: (category: string, message?: any, ...args: any[]) => void;
export declare const errorLog: (category: string, message?: any, ...args: any[]) => void;
/**
 * History-Entry Struktur
 */
interface HistoryEntry {
    timestamp: number;
    category: string;
    message: string;
    details: {
        id?: string;
        name?: string;
        transactionType?: string;
        amount?: number;
        date?: string;
        categoryId?: string;
        accountId?: string;
        oldValue?: any;
        newValue?: any;
        changes?: Record<string, any>;
        [key: string]: any;
    };
}
/**
 * Fügt einen neuen Eintrag zur History hinzu
 */
export declare function addToHistory(level: LogLevel, category: string, message: any, args: any[]): void;
/**
 * Formatiert Details für die Anzeige in der History
 */
export declare function formatHistoryDetails(details: any): string;
/**
 * Öffentliche Verwaltung der History
 */
export declare const historyManager: {
    getEntries: () => HistoryEntry[];
    clear: () => void;
    cleanupOldEntries: () => void;
};
/**
 * Initialisiert die Logger-History nach Pinia-Start
 */
export declare function initializeLogger(): void;
export {};
