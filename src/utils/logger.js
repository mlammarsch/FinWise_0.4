import { reactive } from 'vue';
import { formatCurrency } from './formatters';
import { useAccountStore } from './../stores/accountStore';
import { useCategoryStore } from './../stores/categoryStore';
import { useRecipientStore } from './../stores/recipientStore';
import { useSettingsStore } from './../stores/settingsStore'; // Settings-Store
/**
 * Log-Level Definitionen
 */
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
export const LogLevelToString = {
    [LogLevel.DEBUG]: "DEBUG",
    [LogLevel.INFO]: "INFO",
    [LogLevel.WARN]: "WARN",
    [LogLevel.ERROR]: "ERROR",
};
export const StringToLogLevel = {
    "DEBUG": LogLevel.DEBUG,
    "INFO": LogLevel.INFO,
    "WARN": LogLevel.WARN,
    "ERROR": LogLevel.ERROR,
};
/**
 * Globales Cache-Objekt
 */
let cachedSettingsStore = null;
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
    enabledCategories: new Set(['store', 'ui', 'service']),
    historyRetentionDays: 60
});
/**
 * Haupt-Logging-Funktion
 */
export function log(level, category, message, ...args) {
    const settingsStore = useSettingsStore();
    const cleanCategory = category.replace(/\[|\]/g, '');
    const msgStr = typeof message === 'string'
        ? message
        : message == null
            ? ''
            : safeToString(message);
    if (level >= settingsStore.logLevel) {
        const levelPrefix = LogLevel[level].toString().padEnd(5);
        console.log(`[${levelPrefix}][${cleanCategory}] ${msgStr}`, ...args);
    }
    // History-Log immer unabhängig vom Level
    if (shouldAddToHistory(msgStr, args)) {
        addToHistory(level, cleanCategory, msgStr, args);
    }
}
/**
 * Shortcuts für verschiedene Log-Typen
 */
export const debugLog = (category, message, ...args) => log(LogLevel.DEBUG, category, message, ...args);
export const infoLog = (category, message, ...args) => log(LogLevel.INFO, category, message, ...args);
export const warnLog = (category, message, ...args) => log(LogLevel.WARN, category, message, ...args);
export const errorLog = (category, message, ...args) => log(LogLevel.ERROR, category, message, ...args);
/**
 * Bestimmt, ob ein Log in die History aufgenommen werden soll
 */
function shouldAddToHistory(message, args) {
    return (typeof message === 'string' &&
        (message.includes("addTransaction") ||
            message.includes("updateTransaction") ||
            message.includes("deleteTransaction") ||
            message.includes("addCategoryTransfer") ||
            message.includes("updateCategoryTransfer") ||
            message.includes("deleteCategoryTransfer")));
}
/**
 * In-Memory Liste der History-Entries
 */
const historyEntries = []; // Start leer, wird später gefüllt
/**
 * Extrahiert relevante Details aus den übergebenen Daten
 */
function extractDetails(data) {
    const accountStore = useAccountStore();
    const categoryStore = useCategoryStore();
    const recipientStore = useRecipientStore();
    if (!data)
        return {};
    const details = {};
    if (data.id)
        details.id = data.id;
    if (data.name)
        details.name = data.name;
    if (data.amount !== undefined)
        details.amount = data.amount;
    if (data.date)
        details.date = data.date;
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
                if (typeof value === 'string') {
                    const account = accountStore.getAccountById(value);
                    details.changes["accountName"] = account ? account.name : 'Unbekanntes Konto';
                }
                else {
                    details.changes["accountName"] = 'Ungültige Konto-ID';
                }
            }
            else if (key === 'categoryId') {
                if (typeof value === 'string') {
                    const cat = categoryStore.getCategoryById(value);
                    details.changes["categoryName"] = cat ? cat.name : 'Unbekannte Kategorie';
                }
                else {
                    details.changes["categoryName"] = 'Ungültige Kategorie-ID';
                }
            }
            else if (key === 'amount') {
                details.changes[key] = formatCurrency(Number(value));
            }
            else {
                details.changes[key] = value;
            }
        });
    }
    return details;
}
/**
 * Fügt einen neuen Eintrag zur History hinzu
 */
export function addToHistory(level, category, message, args) {
    const msgStr = typeof message === 'string'
        ? message
        : message == null
            ? ''
            : safeToString(message);
    const entry = {
        timestamp: Date.now(),
        category,
        message: msgStr,
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
function loadHistory() {
    try {
        const saved = localStorage.getItem('finwise_history');
        if (saved) {
            const parsed = JSON.parse(saved);
            return cleanupHistory(parsed);
        }
    }
    catch (err) {
        console.error('Fehler beim Laden der History:', err);
    }
    return [];
}
/**
 * Entfernt alte History-Einträge basierend auf Aufbewahrungsdauer
 */
function cleanupHistory(entries) {
    const settingsStore = useSettingsStore();
    const cutoffTime = Date.now() - (settingsStore.historyRetentionDays * 24 * 60 * 60 * 1000);
    return entries.filter(entry => entry.timestamp >= cutoffTime);
}
/**
 * Formatiert Details für die Anzeige in der History
 */
export function formatHistoryDetails(details) {
    if (!details)
        return '';
    const parts = [];
    if (details.id)
        parts.push(`ID: ${details.id}`);
    if (details.name)
        parts.push(`Name: ${details.name}`);
    if (details.accountName)
        parts.push(`Konto: ${details.accountName}`);
    if (details.categoryName)
        parts.push(`Kategorie: ${details.categoryName}`);
    if (details.transactionType)
        parts.push(`Typ: ${details.transactionType}`);
    if (details.amount !== undefined)
        parts.push(`Betrag: ${formatCurrency(details.amount)}`);
    if (details.date)
        parts.push(`Datum: ${details.date}`);
    if (details.changes) {
        Object.entries(details.changes).forEach(([key, value]) => {
            if (key === 'amount') {
                parts.push(`${key}: ${formatCurrency(Number(value))}`);
            }
            else if (key === 'accountName') {
                parts.push(`Konto: ${value}`);
            }
            else if (key === 'categoryName') {
                parts.push(`Kategorie: ${value}`);
            }
            else {
                parts.push(`${key}: ${value}`);
            }
        });
    }
    return parts.join(' | ');
}
/**
 * Sichere String-Konvertierung für beliebige Objekte
 */
function safeToString(val) {
    try {
        if (typeof val === 'string')
            return val;
        if (val instanceof Error)
            return val.stack || val.message || String(val);
        return JSON.stringify(val);
    }
    catch {
        try {
            return String(val);
        }
        catch {
            return '[Unserializable]';
        }
    }
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
