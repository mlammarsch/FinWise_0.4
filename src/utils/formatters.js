import dayjs from 'dayjs';
/**
 * Formatiert einen Betrag als Währung
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}
/**
 * Formatiert einen Betrag als Währung ohne Kommastellen
 */
export function formatCurrencyWhole(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}
/**
 * Formatiert ein Datum im deutschen Format
 */
export function formatDate(dateString) {
    return dayjs(dateString).format('DD.MM.YYYY');
}
/**
 * Formatiert ein Datum mit Uhrzeit im deutschen Format
 */
export function formatDateTime(dateString) {
    return dayjs(dateString).format('DD.MM.YYYY HH:mm');
}
/**
 * Gibt den reinen Datumsteil im Format yyyy-mm-dd zurück.
 * Verhindert Zeitzonen- oder Zeitfehler bei Datumsvergleichen.
 */
export function toDateOnlyString(input) {
    const date = typeof input === "string" ? new Date(input) : input;
    // Prüfung auf ungültiges Datum
    if (isNaN(date.getTime())) {
        console.warn('[toDateOnlyString] Invalid date input:', input);
        // Fallback auf aktuelles Datum
        const fallbackDate = new Date();
        const year = fallbackDate.getFullYear();
        const month = `${fallbackDate.getMonth() + 1}`.padStart(2, "0");
        const day = `${fallbackDate.getDate()}`.padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
/**
 * Gibt die CSS-Klasse für einen Betrag zurück (positiv, negativ, neutral)
 */
export function getAmountClass(amount) {
    if (amount > 0)
        return 'text-success';
    if (amount < 0)
        return 'text-error';
    return 'text-neutral';
}
/**
 * Rundet einen Betrag für statistische Zwecke (2 Nachkommastellen)
 */
export function roundForStats(amount) {
    return Math.round(amount * 100) / 100;
}
/**
 * Formatiert eine Zahl mit Tausendertrennzeichen und zwei Nachkommastellen
 */
export function formatNumber(amount) {
    return new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}
/**
 * Formatiert einen Prozentsatz
 */
export function formatPercent(value) {
    return new Intl.NumberFormat('de-DE', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(value / 100);
}
/**
 * HEX to RGBA Converter
 */
export function hexToRgba(hex, alpha = 1) {
    const cleanHex = hex.replace('#', '');
    const bigint = parseInt(cleanHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
