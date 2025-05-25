import { reactive } from 'vue';
import { formatCurrency } from './formatters';
import { useAccountStore } from './../stores/accountStore';
import { useCategoryStore } from './../stores/categoryStore';
import { useRecipientStore } from './../stores/recipientStore';
import { useSettingsStore } from './../stores/settingsStore'; // Settings-Store

/**
 * Log-Level Definitionen
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Globales Cache-Objekt
 */
let cachedSettingsStore: ReturnType<typeof useSettingsStore> | null = null;

function getSettingsStore() {
  if (!cachedSettingsStore) {
    cachedSettingsStore = useSettingsStore();
  }
  return cachedSettingsStore;
}

/**
 * Globale Log-Konfiguration (nur für Defaultwerte notwendig)
 */
export const LogConfig = reactive({
    level: LogLevel.INFO,
    enabledCategories: new Set<string>(['store', 'ui', 'service']),
    historyRetentionDays: 60
});

/**
 * Haupt-Logging-Funktion
 */
export function log(level: LogLevel, category: string, message: string, ...args: any[]) {
    const settingsStore = useSettingsStore();
    const cleanCategory = category.replace(/\[|\]/g, '');

    if (level >= settingsStore.logLevel ) { //settingsStore.enabledLogCategories.has(cleanCategory)
        const levelPrefix = LogLevel[level].toString().padEnd(5);
        console.log(`[${levelPrefix}][${cleanCategory}] ${message}`, ...args);
    }

    // History-Log immer unabhängig vom Level
    if (shouldAddToHistory(message, args)) {
        addToHistory(level, cleanCategory, message, args);
    }
}

/**
 * Shortcuts für verschiedene Log-Typen
 */
export const debugLog = (category: string, message: string, ...args: any[]) =>
    log(LogLevel.DEBUG, category, message, ...args);

export const infoLog = (category: string, message: string, ...args: any[]) =>
    log(LogLevel.INFO, category, message, ...args);

export const warnLog = (category: string, message: string, ...args: any[]) =>
    log(LogLevel.WARN, category, message, ...args);

export const errorLog = (category: string, message: string, ...args: any[]) =>
    log(LogLevel.ERROR, category, message, ...args);

/**
 * Bestimmt, ob ein Log in die History aufgenommen werden soll
 */
function shouldAddToHistory(message: string, args: any[]) {
    return (
        typeof message === 'string' &&
        (message.includes("addTransaction") ||
            message.includes("updateTransaction") ||
            message.includes("deleteTransaction") ||
            message.includes("addCategoryTransfer") ||
            message.includes("updateCategoryTransfer") ||
            message.includes("deleteCategoryTransfer"))
    );
}

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
 * In-Memory Liste der History-Entries
 */
const historyEntries: HistoryEntry[] = []; // Start leer, wird später gefüllt

/**
 * Extrahiert relevante Details aus den übergebenen Daten
 */
function extractDetails(data: any): any {
    const accountStore = useAccountStore();
    const categoryStore = useCategoryStore();
    const recipientStore = useRecipientStore();

    if (!data) return {};

    const details: any = {};

    if (data.id) details.id = data.id;
    if (data.name) details.name = data.name;
    if (data.amount !== undefined) details.amount = data.amount;
    if (data.date) details.date = data.date;
    if (data.categoryId) {
        const category = categoryStore.getCategoryById(data.categoryId);
        details.categoryName = category ? category.name : 'Unbekannte Kategorie';
    }
    if (data.accountId) {
        const account = accountStore.getAccountById(data.accountId);
        details.accountName = account ? account.name : 'Unbekanntes Konto';
    }
    if (data.updates) {
        details.changes = {};
        Object.entries(data.updates).forEach(([key, value]) => {
            if (key === 'accountId') {
                const account = accountStore.getAccountById(value);
                details.changes["accountName"] = account ? account.name : 'Unbekanntes Konto';
            } else if (key === 'categoryId') {
                const cat = categoryStore.getCategoryById(value);
                details.changes["categoryName"] = cat ? cat.name : 'Unbekannte Kategorie';
            } else if (key === 'amount') {
                details.changes[key] = formatCurrency(Number(value));
            } else {
                details.changes[key] = value;
            }
        });
    }

    return details;
}

/**
 * Fügt einen neuen Eintrag zur History hinzu
 */
export function addToHistory(level: LogLevel, category: string, message: string, args: any[]) {
    const entry: HistoryEntry = {
        timestamp: Date.now(),
        category,
        message,
        details: args.length > 0 ? extractDetails(args[0]) : {}
    };

    historyEntries.push(entry);
    saveHistory();
}

/**
 * Speichert die aktuelle History in LocalStorage
 */
function saveHistory() {
    localStorage.setItem('finwise_history', JSON.stringify(historyEntries));
}

/**
 * Lädt die History aus dem LocalStorage
 */
function loadHistory(): HistoryEntry[] {
    try {
        const saved = localStorage.getItem('finwise_history');
        if (saved) {
            const parsed = JSON.parse(saved) as HistoryEntry[];
            return cleanupHistory(parsed);
        }
    } catch (err) {
        console.error('Fehler beim Laden der History:', err);
    }
    return [];
}

/**
 * Entfernt alte History-Einträge basierend auf Aufbewahrungsdauer
 */
function cleanupHistory(entries: HistoryEntry[]): HistoryEntry[] {
    const settingsStore = useSettingsStore();
    const cutoffTime = Date.now() - (settingsStore.historyRetentionDays * 24 * 60 * 60 * 1000);
    return entries.filter(entry => entry.timestamp >= cutoffTime);
}

/**
 * Formatiert Details für die Anzeige in der History
 */
export function formatHistoryDetails(details: any): string {
    if (!details) return '';

    const parts = [];

    if (details.id) parts.push(`ID: ${details.id}`);
    if (details.name) parts.push(`Name: ${details.name}`);
    if (details.accountName) parts.push(`Konto: ${details.accountName}`);
    if (details.categoryName) parts.push(`Kategorie: ${details.categoryName}`);
    if (details.transactionType) parts.push(`Typ: ${details.transactionType}`);
    if (details.amount !== undefined) parts.push(`Betrag: ${formatCurrency(details.amount)}`);
    if (details.date) parts.push(`Datum: ${details.date}`);
    if (details.changes) {
        Object.entries(details.changes).forEach(([key, value]) => {
            if (key === 'amount') {
                parts.push(`${key}: ${formatCurrency(Number(value))}`);
            } else if (key === 'accountName') {
                parts.push(`Konto: ${value}`);
            } else if (key === 'categoryName') {
                parts.push(`Kategorie: ${value}`);
            } else {
                parts.push(`${key}: ${value}`);
            }
        });
    }

    return parts.join(' | ');
}

/**
 * Öffentliche Verwaltung der History
 */
export const historyManager = {
    getEntries: () => [...historyEntries],
    clear: () => {
        historyEntries.length = 0;
        saveHistory();
    },
    cleanupOldEntries: () => {
        const newEntries = cleanupHistory(historyEntries);
        historyEntries.length = 0;
        historyEntries.push(...newEntries);
        saveHistory();
    }
};

/**
 * Initialisiert die Logger-History nach Pinia-Start
 */
export function initializeLogger() {
    const entries = loadHistory();
    historyEntries.length = 0;
    historyEntries.push(...entries);
}
