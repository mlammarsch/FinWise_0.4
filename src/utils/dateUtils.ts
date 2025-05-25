import dayjs from 'dayjs';
import { RecurrencePattern, WeekendHandlingType } from '@/types';
import { formatDate } from './formatters';

/**
 * Gibt den Wochentagsnamen zurück (kurze Form)
 */
export function getDayOfWeekName(day: number): string {
  const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  return days[day];
}

/**
 * Gibt den Monatsnamen zurück
 */
export function getMonthName(month: number): string {
  return [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ][month];
}

/**
 * Konvertiert ein Datum in verschiedenen Formaten in das ISO-Format YYYY-MM-DD
 * Unterstützt verschiedene Trennzeichen (-, /, .) und Formatierungen
 */
export function convertDateToIso(dateString: string, format: string = "YYYY-MM-DD"): string | null {
  if (!dateString) return null;

  try {
    const dateStr = dateString.trim();
    let year: string | number, month: string | number, day: string | number;

    // Extrahiere Trennzeichen (-, /, .)
    const separator = dateStr.match(/[-/.]/)?.[0] || "-";

    switch (format) {
      case "YYYY-MM-DD":
        [year, month, day] = dateStr.split(separator);
        break;
      case "YY-MM-DD":
        [year, month, day] = dateStr.split(separator);
        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
        break;
      case "MM-DD-YYYY":
        [month, day, year] = dateStr.split(separator);
        break;
      case "MM-DD-YY":
        [month, day, year] = dateStr.split(separator);
        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
        break;
      case "DD-MM-YYYY":
        [day, month, year] = dateStr.split(separator);
        break;
      case "DD-MM-YY":
        [day, month, year] = dateStr.split(separator);
        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
        break;
      default:
        return null;
    }

    // Formatiere das Datum im ISO-Format (YYYY-MM-DD)
    month = month.padStart(2, "0");
    day = day.padStart(2, "0");

    return `${year}-${month}-${day}`;

  } catch (error) {
    console.error("Error converting date:", error);
    return null;
  }
}

/**
 * Versucht das Datumsformat automatisch zu erkennen
 * Gibt null zurück, wenn das Format nicht erkannt werden kann
 */
export function detectDateFormat(dateString: string): string | null {
  if (!dateString) return null;

  const dateRegexes = [
    { format: "YYYY-MM-DD", regex: /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/ },
    { format: "YY-MM-DD", regex: /^\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/ },
    { format: "DD-MM-YYYY", regex: /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/ },
    { format: "DD-MM-YY", regex: /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2}$/ },
    { format: "MM-DD-YYYY", regex: /^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/ },
    { format: "MM-DD-YY", regex: /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2}$/ },
  ];

  for (const { format, regex } of dateRegexes) {
    if (regex.test(dateString)) {
      // Zusätzliche Prüfung für MM-DD vs DD-MM Formatie
      if (format === "DD-MM-YYYY" || format === "DD-MM-YY") {
        // Hier könnten wir versuchen zu prüfen, ob die erste Zahl > 12 ist,
        // dann ist es sicherlich ein DD-MM Format
        const parts = dateString.split(/[-/.]/);
        if (parseInt(parts[0]) > 12) {
          return format;
        } else if (parseInt(parts[1]) > 12) {
          // Wenn der zweite Teil > 12 ist, ist es wahrscheinlicher MM-DD
          return format === "DD-MM-YYYY" ? "MM-DD-YYYY" : "MM-DD-YY";
        }
        // Ansonsten ist es nicht eindeutig, aber wir nehmen DD-MM an (in Europa üblicher)
        return format;
      }
      return format;
    }
  }

  return null;
}

/**
 * Erzeugt eine menschenlesbare Beschreibung eines Wiederholungsmusters
 */
export function createRecurrenceDescription(params: {
  startDate: string,
  repeatsEnabled: boolean,
  recurrencePattern: RecurrencePattern,
  executionDay: number | null,
  moveScheduleEnabled: boolean,
  weekendHandlingDirection: "before" | "after"
}): string {
  const { startDate, repeatsEnabled, recurrencePattern, executionDay,
          moveScheduleEnabled, weekendHandlingDirection } = params;

  if (!repeatsEnabled) {
    return `Einmalig am ${formatDate(startDate)}`;
  }

  const date = dayjs(startDate);
  const day = date.date();
  const monthName = getMonthName(date.month());
  let desc = "";

  switch (recurrencePattern) {
    case RecurrencePattern.DAILY:
      desc = "Täglich";
      break;
    case RecurrencePattern.WEEKLY:
      desc = `Wöchentlich am ${getDayOfWeekName(date.day())}`;
      break;
    case RecurrencePattern.BIWEEKLY:
      desc = `Alle zwei Wochen am ${getDayOfWeekName(date.day())}`;
      break;
    case RecurrencePattern.MONTHLY:
      const d = executionDay && executionDay > 0 && executionDay < 32
        ? executionDay
        : day;
      desc = `Monatlich am ${d}.`;
      break;
    case RecurrencePattern.QUARTERLY:
      desc = `Vierteljährlich am ${day}. ${monthName}`;
      break;
    case RecurrencePattern.YEARLY:
      desc = `Jährlich am ${day}. ${monthName}`;
      break;
    default:
      desc = formatDate(startDate);
  }

  if (moveScheduleEnabled) {
    const dir = weekendHandlingDirection === "before" ? "davor" : "danach";
    desc += ` (Wochenende: ${dir})`;
  }

  return desc;
}

/**
 * Berechnet die nächsten Termine für ein Wiederholungsmuster
 */
export function calculateUpcomingDates(params: {
  startDate: string,
  repeatsEnabled: boolean,
  recurrencePattern: RecurrencePattern,
  recurrenceEndType: any,
  endDate: string | null,
  recurrenceCount: number,
  executionDay: number | null,
  moveScheduleEnabled: boolean,
  weekendHandlingDirection: "before" | "after"
}): Array<{ date: string; day: string }> {
  const { startDate, repeatsEnabled, recurrencePattern, recurrenceEndType, endDate,
          recurrenceCount, executionDay, moveScheduleEnabled, weekendHandlingDirection } = params;

  const upcomingDates: Array<{ date: string; day: string }> = [];

  if (!startDate) return upcomingDates;

  let current = dayjs(startDate);
  const endLimit = dayjs().add(3, "years");
  let cnt = 0;
  const maxShow = 6;

  if (!repeatsEnabled) {
    upcomingDates.push({
      date: current.format("DD.MM.YYYY"),
      day: getDayOfWeekName(current.day()),
    });
    return upcomingDates;
  }

  while (cnt < 50 && current.isBefore(endLimit)) {
    let dateToUse = current;

    if (
      recurrenceEndType === "DATE" &&
      endDate &&
      current.isAfter(dayjs(endDate))
    ) {
      break;
    }
    if (
      recurrenceEndType === "COUNT" &&
      recurrenceCount &&
      cnt >= recurrenceCount
    ) {
      break;
    }

    if (moveScheduleEnabled) {
      const w = dateToUse.day();
      if (w === 0 || w === 6) {
        if (weekendHandlingDirection === "before") {
          dateToUse = w === 0
            ? dateToUse.subtract(2, "day")
            : dateToUse.subtract(1, "day");
        } else {
          dateToUse = w === 0
            ? dateToUse.add(1, "day")
            : dateToUse.add(2, "day");
        }
      }
    }

    if (upcomingDates.length < maxShow) {
      upcomingDates.push({
        date: dateToUse.format("DD.MM.YYYY"),
        day: getDayOfWeekName(dateToUse.day()),
      });
    }

    cnt++;
    switch (recurrencePattern) {
      case RecurrencePattern.DAILY:
        current = current.add(1, "day");
        break;
      case RecurrencePattern.WEEKLY:
        current = current.add(1, "week");
        break;
      case RecurrencePattern.BIWEEKLY:
        current = current.add(2, "weeks");
        break;
      case RecurrencePattern.MONTHLY:
        const orig = executionDay ?? dayjs(startDate).date();
        const next = current.add(1, "month");
        const maxD = next.daysInMonth();
        const setDay = Math.min(orig, maxD);
        current = next.date(setDay);
        break;
      case RecurrencePattern.QUARTERLY:
        current = current.add(3, "months");
        break;
      case RecurrencePattern.YEARLY:
        current = current.add(1, "year");
        break;
      default:
        cnt = 50;
    }

    if (
      recurrenceEndType === "DATE" &&
      endDate &&
      current.isAfter(dayjs(endDate))
    ) {
      break;
    }
  }

  return upcomingDates.slice(0, maxShow);
}
