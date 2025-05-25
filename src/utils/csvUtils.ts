/**
 * Hilfsfunktionen für den CSV-Import
 */

/**
 * Parst einen CSV-String in ein Array von Objekten
 */
export function parseCSV(csvString: string, delimiter: string = ',', hasHeader: boolean = true): { headers: string[], data: any[] } {
  if (!csvString) {
    return { headers: [], data: [] };
  }

  // Zeilen aufteilen und leere Zeilen am Ende entfernen
  const rows = csvString.split(/\r?\n/).filter(row => row.trim() !== '');

  if (rows.length === 0) {
    return { headers: [], data: [] };
  }

  let headers: string[];
  let startRow = 0;

  // Header verarbeiten
  if (hasHeader) {
    headers = rows[0].split(delimiter).map(header => header.trim());
    startRow = 1;
  } else {
    // Wenn kein Header vorhanden ist, erstellen wir generische Spaltenbezeichnungen
    const firstRow = rows[0].split(delimiter);
    headers = Array.from({ length: firstRow.length }, (_, i) => `Spalte ${i + 1}`);
  }

  // Daten verarbeiten
  const data = [];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i].trim();
    if (!row) continue;

    // CSV-Parsing mit Berücksichtigung von Anführungszeichen für Felder mit Kommas
    const values = parseCSVRow(row, delimiter);

    // Prüfen, ob die Anzahl der Werte mit der Anzahl der Header übereinstimmt
    if (values.length !== headers.length) {
      console.warn(`Zeile ${i+1} hat ${values.length} Felder, erwartet wurden ${headers.length}. Diese Zeile wird übersprungen.`);
      continue;
    }

    // Objekt erstellen
    const rowObject: any = {};
    headers.forEach((header, index) => {
      rowObject[header] = values[index];
    });

    data.push(rowObject);
  }

  return { headers, data };
}

/**
 * Parst eine CSV-Zeile mit Berücksichtigung von gequoteten Feldern
 * Z.B. "Feld mit, Komma",normales Feld,"anderes Feld"
 */
function parseCSVRow(row: string, delimiter: string): string[] {
  const result = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      // Wenn wir ein Anführungszeichen innerhalb von Anführungszeichen haben (""), dann ist es ein Escape
      if (inQuotes && row[i+1] === '"') {
        currentValue += '"';
        i++; // Überspringe das nächste Anführungszeichen
      } else {
        // Ansonsten wechseln wir den Quoting-Status
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Wir haben ein Trennzeichen außerhalb von Anführungszeichen gefunden
      result.push(currentValue.trim());
      currentValue = '';
    } else {
      // Normales Zeichen, zum aktuellen Wert hinzufügen
      currentValue += char;
    }
  }

  // Den letzten Wert hinzufügen
  result.push(currentValue.trim());

  return result;
}

/**
 * Parst einen Betrag aus dem CSV
 */
export function parseAmount(amountString: string): number | null {
  if (!amountString) return null;

  try {
    // Bereinigen und normalisieren
    let cleanedAmount = amountString.trim()
      .replace(/\s/g, "")       // Leerzeichen entfernen
      .replace(/[^\d,.+-]/g, "") // Nur Zahlen, Komma, Punkt, Plus, Minus behalten
      .replace(/\.(?=.*\.)/g, ""); // Nur den letzten Punkt behalten

    // Umwandlung von deutschem in englisches Zahlenformat
    cleanedAmount = cleanedAmount.replace(/,/g, ".");

    return parseFloat(cleanedAmount);
  } catch (error) {
    console.error("Error parsing amount:", error);
    return null;
  }
}

/**
 * Berechnet die Ähnlichkeit zwischen zwei Strings (einfacher Algorithmus)
 * Gibt einen Wert zwischen 0 und 1 zurück (0 = keine Ähnlichkeit, 1 = identisch)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;

  const a = str1.toLowerCase();
  const b = str2.toLowerCase();

  // Exakte Übereinstimmung
  if (a === b) return 1;

  // Enthält die Zeichenkette
  if (a.includes(b) || b.includes(a)) {
    // Längeres enthält kürzeres
    const longerStr = a.length > b.length ? a : b;
    const shorterStr = a.length > b.length ? b : a;
    return shorterStr.length / longerStr.length * 0.9; // Maximal 0.9 für teilweise Übereinstimmung
  }

  // Wortweise Ähnlichkeit
  const words1 = a.split(/\s+/);
  const words2 = b.split(/\s+/);

  let matchCount = 0;
  for (const word1 of words1) {
    if (word1.length <= 2) continue; // Zu kurze Wörter ignorieren

    for (const word2 of words2) {
      if (word2.length <= 2) continue;

      if (word1 === word2 ||
          (word1.length > 3 && word2.length > 3 &&
           (word1.includes(word2) || word2.includes(word1)))) {
        matchCount++;
        break;
      }
    }
  }

  if (matchCount > 0) {
    return Math.min(0.8, matchCount / Math.max(words1.length, words2.length));
  }

  // Keine signifikante Ähnlichkeit gefunden
  return 0;
}
