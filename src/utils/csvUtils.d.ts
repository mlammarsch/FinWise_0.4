/**
 * Hilfsfunktionen für den CSV-Import
 */
/**
 * Parst einen CSV-String in ein Array von Objekten
 */
export declare function parseCSV(csvString: string, delimiter?: string, hasHeader?: boolean): {
    headers: string[];
    data: any[];
};
/**
 * Parst einen Betrag aus dem CSV
 */
export declare function parseAmount(amountString: string): number | null;
/**
 * Berechnet die Ähnlichkeit zwischen zwei Strings (einfacher Algorithmus)
 * Gibt einen Wert zwischen 0 und 1 zurück (0 = keine Ähnlichkeit, 1 = identisch)
 */
export declare function calculateStringSimilarity(str1: string, str2: string): number;
