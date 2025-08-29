/**
 * Formatiert einen Betrag als Währung
 */
export declare function formatCurrency(amount: number): string;
/**
 * Formatiert einen Betrag als Währung ohne Kommastellen
 */
export declare function formatCurrencyWhole(amount: number): string;
/**
 * Formatiert ein Datum im deutschen Format
 */
export declare function formatDate(dateString: string): string;
/**
 * Formatiert ein Datum mit Uhrzeit im deutschen Format
 */
export declare function formatDateTime(dateString: string): string;
/**
 * Gibt den reinen Datumsteil im Format yyyy-mm-dd zurück.
 * Verhindert Zeitzonen- oder Zeitfehler bei Datumsvergleichen.
 */
export declare function toDateOnlyString(input: string | Date): string;
/**
 * Gibt die CSS-Klasse für einen Betrag zurück (positiv, negativ, neutral)
 */
export declare function getAmountClass(amount: number): string;
/**
 * Rundet einen Betrag für statistische Zwecke (2 Nachkommastellen)
 */
export declare function roundForStats(amount: number): number;
/**
 * Formatiert eine Zahl mit Tausendertrennzeichen und zwei Nachkommastellen
 */
export declare function formatNumber(amount: number): string;
/**
 * Formatiert einen Prozentsatz
 */
export declare function formatPercent(value: number): string;
/**
 * HEX to RGBA Converter
 */
export declare function hexToRgba(hex: string, alpha?: number): string;
