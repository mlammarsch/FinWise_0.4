import { RecurrencePattern } from '@/types';
/**
 * Gibt den Wochentagsnamen zurück (kurze Form)
 */
export declare function getDayOfWeekName(day: number): string;
/**
 * Gibt den Monatsnamen zurück
 */
export declare function getMonthName(month: number): string;
/**
 * Konvertiert ein Datum in verschiedenen Formaten in das ISO-Format YYYY-MM-DD
 * Unterstützt verschiedene Trennzeichen (-, /, .) und Formatierungen
 */
export declare function convertDateToIso(dateString: string, format?: string): string | null;
/**
 * Versucht das Datumsformat automatisch zu erkennen
 * Gibt null zurück, wenn das Format nicht erkannt werden kann
 */
export declare function detectDateFormat(dateString: string): string | null;
/**
 * Erzeugt eine menschenlesbare Beschreibung eines Wiederholungsmusters
 */
export declare function createRecurrenceDescription(params: {
    startDate: string;
    repeatsEnabled: boolean;
    recurrencePattern: RecurrencePattern;
    executionDay: number | null;
    moveScheduleEnabled: boolean;
    weekendHandlingDirection: "before" | "after";
}): string;
/**
 * Berechnet die nächsten Termine für ein Wiederholungsmuster
 */
export declare function calculateUpcomingDates(params: {
    startDate: string;
    repeatsEnabled: boolean;
    recurrencePattern: RecurrencePattern;
    recurrenceEndType: any;
    endDate: string | null;
    recurrenceCount: number;
    executionDay: number | null;
    moveScheduleEnabled: boolean;
    weekendHandlingDirection: "before" | "after";
}): Array<{
    date: string;
    day: string;
}>;
