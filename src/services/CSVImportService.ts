// src/services/CSVImportService.ts

/**
 * CSV Import Service
 * Verantwortlich für die gesamte Import-Logik, Datenverarbeitung, Mapping und Erzeugung neuer Entitäten
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAccountStore } from "@/stores/accountStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useRecipientStore } from "@/stores/recipientStore";
import { useTransactionStore } from "@/stores/transactionStore";
import { useTagStore } from "@/stores/tagStore";
import { TransactionService } from "@/services/TransactionService";
import { BalanceService } from "@/services/BalanceService";
import { TransactionType, EntityTypeEnum, SyncOperationType, CSVTransactionData } from "@/types";
import { debugLog, infoLog, errorLog, warnLog } from "@/utils/logger";
import { TenantDbService } from "@/services/TenantDbService";
import { parseCSV as parseCSVUtil, parseAmount, calculateStringSimilarity } from "@/utils/csvUtils";

// Ähnlichkeitsschwellenwert für Fuzzy-Matching
const SIMILARITY_THRESHOLD = 0.6;

// Typen für CSV-Konfiguration und Datenstrukturen
export interface CSVConfiguration {
  delimiter: string;
  customDelimiter: string;
  hasTitleRow: boolean;
  dateFormat: string;
}

export interface MappedColumns {
  date: string;
  amount: string;
  notes: string;
  recipient: string;
  category: string;
}

export interface ImportRow {
  [key: string]: any;
  _originalIndex: number;
  _selected: boolean;
  _potentialMerge: any;
  _recipientMatches: { id: string; name: string; similarity: number }[];
  _categoryMatches: { id: string; name: string; similarity: number }[];
  _uniqueRowIdentifier: string; // Neuer eindeutiger Identifikator
  _duplicateType?: 'standard' | 'account_transfer'; // Neuer Duplikat-Typ
  _duplicateConfidence?: number; // Konfidenz-Level für Duplikate
  _extractedTags?: string[]; // Extrahierte Tag-Namen aus Notizen
  recipientId?: string;
  categoryId?: string;
  tagIds?: string[];
}

export interface PotentialMatch {
  id: string;
  date: string;
  amount: number;
  recipientId?: string;
  categoryId?: string;
  note?: string;
}

export const useCSVImportService = defineStore('csvImportService', () => {
  // Stores
  const categoryStore = useCategoryStore();
  const recipientStore = useRecipientStore();
  const accountStore = useAccountStore();
  const transactionStore = useTransactionStore();
  const tagStore = useTagStore();

  // Services
  const tenantDbService = new TenantDbService();

  // CSV Konfiguration
  const csvFile = ref<File | null>(null);
  const csvData = ref<string>("");
  const configuration = ref<CSVConfiguration>({
    delimiter: ",",
    customDelimiter: "",
    hasTitleRow: true,
    dateFormat: "DD-MM-YYYY"
  });

  // Verarbeitungs-Status
  const csvParseStatus = ref<"idle" | "parsing" | "error" | "success">("idle");
  const error = ref<string>("");
  const importStatus = ref<"idle" | "importing" | "error" | "success">("idle");

  // CSV-Daten
  const csvHeaders = ref<string[]>([]);
  const allParsedData = ref<ImportRow[]>([]);

  // Mappings
  const mappedColumns = ref<MappedColumns>({
    date: "",
    amount: "",
    notes: "",
    recipient: "",
    category: ""
  });

  // Mögliche Mappings
  const possibleMappings = ref<{ [key: string]: string[] }>({
    date: [],
    amount: [],
    notes: [],
    recipient: [],
    category: [],
  });

  // Import-Ergebnis
  const importedTransactions = ref<any[]>([]);
  const selectedTags = ref<string[]>([]);

  /**
   * Liest CSV-Datei und bereitet Daten vor
   */
  function readCSVFile(file: File): Promise<void> {
    csvFile.value = file;
    csvData.value = "";

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        if (e.target?.result) {
          csvData.value = e.target.result as string;
          detectDelimiterAndDateFormat();
          parseCSV();
          resolve();
        }
      };

      reader.onerror = (e) => {
        reject(new Error("Fehler beim Lesen der Datei"));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Erkennt automatisch das Trennzeichen und Datumsformat
   */
  function detectDelimiterAndDateFormat() {
    if (!csvData.value) return;

    // Trennzeichen erkennen
    const firstFewLines = csvData.value
      .split("<br />")
      .slice(0, 5)
      .join("<br />");

    // Zähle Vorkommen von gängigen Trennzeichen
    const delimiterCounts = {
      ",": (firstFewLines.match(/,/g) || []).length,
      ";": (firstFewLines.match(/;/g) || []).length,
      "\t": (firstFewLines.match(/\t/g) || []).length,
    };

    // Wähle das am häufigsten vorkommende Trennzeichen
    let detectedDelimiter = ",";
    let maxCount = 0;

    for (const [delim, count] of Object.entries(delimiterCounts)) {
      if (count > maxCount) {
        maxCount = count;
        detectedDelimiter = delim;
      }
    }

    configuration.value.delimiter = detectedDelimiter;

    // Datumsformat erkennen
    // Parse zuerst einige Zeilen, um Daten zu extrahieren
    const effectiveDelimiter =
      configuration.value.delimiter === "custom" ? configuration.value.customDelimiter : configuration.value.delimiter;
    const rows = csvData.value.split(/\r?\n/).filter((row) => row.trim());

    if (rows.length < 2) return; // Brauchen mindestens Header + eine Datenzeile

    // Nehme erste Datenzeile (oder zweite Zeile, wenn Header vorhanden)
    const dataRowIndex = configuration.value.hasTitleRow ? 1 : 0;
    if (rows.length <= dataRowIndex) return;

    const dataRow = rows[dataRowIndex].split(effectiveDelimiter);

    // Suche nach Mustern, die auf Datumsformate hinweisen
    for (const value of dataRow) {
      // Überprüfe verschiedene Datumsformate
      if (/^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}$/.test(value)) {
        // YYYY-MM-DD Format
        configuration.value.dateFormat = "YYYY-MM-DD";
        return;
      } else if (/^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{4}$/.test(value)) {
        // DD-MM-YYYY oder MM-DD-YYYY Format
        // Für deutsche Banken ist DD-MM-YYYY wahrscheinlicher
        configuration.value.dateFormat = "DD-MM-YYYY";
        return;
      } else if (/^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2}$/.test(value)) {
        // DD-MM-YY Format
        configuration.value.dateFormat = "DD-MM-YY";
        return;
      }
    }

    // Standardwert, wenn nichts erkannt wurde
    configuration.value.dateFormat = "DD-MM-YYYY";
  }

  /**
   * Parst CSV-Daten
   */
  function parseCSV(): boolean {
    if (!csvData.value) {
      error.value = "Keine CSV-Daten vorhanden.";
      return false;
    }

    csvParseStatus.value = "parsing";
    error.value = "";

    try {
      const effectiveDelimiter =
        configuration.value.delimiter === "custom" ? configuration.value.customDelimiter : configuration.value.delimiter;
      const rows = csvData.value.split(/\r?\n/);

      if (rows.length === 0) {
        throw new Error("Die CSV-Datei enthält keine Zeilen.");
      }

      // Header extrahieren
      let startRow = 0;
      let headers: string[] = [];

      if (configuration.value.hasTitleRow) {
        headers = rows[0].split(effectiveDelimiter).map((h) => h.trim());
        startRow = 1;
      } else {
        // Generiere Spaltenbezeichnungen
        const firstRow = rows[0].split(effectiveDelimiter);
        headers = firstRow.map((_, idx) => `Spalte ${idx + 1}`);
      }

      csvHeaders.value = headers;

      // Daten verarbeiten
      const data: ImportRow[] = [];

      for (let i = startRow; i < rows.length; i++) {
        const rowStr = rows[i].trim();
        if (!rowStr) continue; // Leere Zeilen überspringen

        const rowValues = rowStr
          .split(effectiveDelimiter)
          .map((val) => val.trim());

        // Überspringe Zeilen mit falscher Spaltenanzahl
        if (rowValues.length !== headers.length) {
          continue;
        }

        const rowObject: ImportRow = {
          _originalIndex: i,
          _selected: true,
          _potentialMerge: null,
          _recipientMatches: [],
          _categoryMatches: [],
          // Generiere einen eindeutigen Identifikator basierend auf Zeileninhalt
          _uniqueRowIdentifier: headers
            .map((header) => rowValues[headers.indexOf(header)] || '')
            .join('|')
            .trim()
        };

        headers.forEach((header, idx) => {
          rowObject[header] = rowValues[idx];
        });

        data.push(rowObject);
      }

      allParsedData.value = data;

      // Automatisches Mapping versuchen
      identifyPossibleMappings();
      automaticMapping();

      csvParseStatus.value = "success";
      return true;
    } catch (err) {
      debugLog("CSVImportService", "CSV Parse Error", JSON.stringify(err));
      csvParseStatus.value = "error";
      error.value = `Fehler beim Parsen der CSV-Datei: ${err instanceof Error ? err.message : "Unbekannter Fehler"
        }`;
      return false;
    }
  }

  /**
   * Identifiziert mögliche Spalten für das Mapping
   */
  function identifyPossibleMappings() {
    if (allParsedData.value.length === 0 || csvHeaders.value.length === 0) return;

    // Zurücksetzen der möglichen Mappings
    possibleMappings.value = {
      date: [],
      amount: [],
      notes: [],
      recipient: [],
      category: [],
    };

    // VERBESSERUNG: Header-basierte Erkennung zuerst durchführen
    csvHeaders.value.forEach((header) => {
      const headerLower = header.toLowerCase();

      // Direkte Header-Erkennung für Category
      if (headerLower.includes("category") || headerLower.includes("kategorie") ||
        headerLower.includes("cat") || headerLower.includes("kat")) {
        possibleMappings.value.category.push(header);
      }

      // Direkte Header-Erkennung für andere Felder
      if (headerLower.includes("date") || headerLower.includes("datum") ||
        headerLower.includes("valuta") || headerLower.includes("wert")) {
        possibleMappings.value.date.push(header);
      }

      if (headerLower.includes("amount") || headerLower.includes("betrag") ||
        headerLower.includes("summe")) {
        possibleMappings.value.amount.push(header);
      }

      if (headerLower.includes("payee") || headerLower.includes("empfänger") ||
        headerLower.includes("recipient") || headerLower.includes("zahler")) {
        possibleMappings.value.recipient.push(header);
      }

      if (headerLower.includes("notes") || headerLower.includes("notiz") ||
        headerLower.includes("verwendungszweck") || headerLower.includes("beschreibung")) {
        possibleMappings.value.notes.push(header);
      }
    });

    // VERBESSERUNG: Mehrere Zeilen für Inhaltsanalyse verwenden (bis zu 5 Zeilen)
    const sampleSize = Math.min(5, allParsedData.value.length);
    const sampleRows = allParsedData.value.slice(0, sampleSize);

    csvHeaders.value.forEach((header) => {
      // Sammle Werte aus mehreren Zeilen für bessere Analyse
      const sampleValues = sampleRows
        .map(row => row[header]?.toString().trim() || '')
        .filter(value => value.length > 0); // Nur nicht-leere Werte

      if (sampleValues.length === 0) return; // Keine Werte zum Analysieren

      // Analysiere die gesammelten Werte
      const hasDatePattern = sampleValues.some(value =>
        /^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}$/.test(value) || // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
        /^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{4}$/.test(value) || // DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
        /^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2}$/.test(value) // DD-MM-YY, DD/MM/YY, DD.MM.YY
      );

      const hasAmountPattern = sampleValues.some(value =>
        /^-?\d+([,\.]\d+)?$/.test(value)
      );

      const hasTextPattern = sampleValues.some(value =>
        value.length > 0 &&
        !/^\d+([,\.]\d+)?$/.test(value) &&
        !/^\d{1,2}[-/\.]\d{1,2}/.test(value)
      );

      // Füge zu entsprechenden Mappings hinzu (nur wenn nicht bereits durch Header-Erkennung hinzugefügt)
      if (hasDatePattern && !possibleMappings.value.date.includes(header)) {
        possibleMappings.value.date.push(header);
      }

      if (hasAmountPattern && !possibleMappings.value.amount.includes(header)) {
        possibleMappings.value.amount.push(header);
      }

      if (hasTextPattern) {
        // Empfänger erkennen (Heuristik: mittlere Textlänge, normalerweise unter 60 Zeichen)
        const avgLength = sampleValues.reduce((sum, val) => sum + val.length, 0) / sampleValues.length;
        if (avgLength > 0 && avgLength < 60 && !possibleMappings.value.recipient.includes(header)) {
          possibleMappings.value.recipient.push(header);
        }

        // Kategorie erkennen (ähnlich wie Empfänger, erweiterte Länge für längere Kategorienamen)
        if (avgLength > 0 && avgLength < 80 && !possibleMappings.value.category.includes(header)) {
          possibleMappings.value.category.push(header);
        }

        // Notizen erkennen (tendenziell längere Texte oder alle Textfelder)
        if (!possibleMappings.value.notes.includes(header)) {
          possibleMappings.value.notes.push(header);
        }
      }
    });

    debugLog(
      "CSVImportService",
      "Erkannte mögliche Mappings",
      JSON.stringify(possibleMappings.value)
    );
  }

  /**
   * Automatisches Mapping basierend auf Heuristiken
   */
  function automaticMapping() {
    // Zurücksetzen des Mappings
    mappedColumns.value = {
      date: "",
      amount: "",
      notes: "",
      recipient: "",
      category: ""
    };

    // Automatisches Mapping für Datum (höchste Priorität)
    if (possibleMappings.value.date.length > 0) {
      // Wenn ein Header "Datum" oder ähnliches enthält, diesen bevorzugen
      const dateHeader =
        possibleMappings.value.date.find(
          (h) =>
            h.toLowerCase().includes("datum") ||
            h.toLowerCase().includes("date") ||
            h.toLowerCase().includes("valuta") ||
            h.toLowerCase().includes("wert")
        ) || possibleMappings.value.date[0];

      mappedColumns.value.date = dateHeader;
    }

    // Automatisches Mapping für Betrag
    if (possibleMappings.value.amount.length > 0) {
      // Wenn ein Header "Betrag" oder ähnliches enthält, diesen bevorzugen
      const amountHeader =
        possibleMappings.value.amount.find(
          (h) =>
            h.toLowerCase().includes("betrag") ||
            h.toLowerCase().includes("summe") ||
            h.toLowerCase().includes("amount") ||
            h.toLowerCase().includes("geldeingang") ||
            h.toLowerCase().includes("geldausgang")
        ) || possibleMappings.value.amount[0];

      mappedColumns.value.amount = amountHeader;
    }

    // Automatisches Mapping für Empfänger
    if (possibleMappings.value.recipient.length > 0) {
      const recipientHeader =
        possibleMappings.value.recipient.find(
          (h) =>
            h.toLowerCase().includes("empfänger") ||
            h.toLowerCase().includes("recipient") ||
            h.toLowerCase().includes("payee") ||
            h.toLowerCase().includes("zahler") ||
            h.toLowerCase().includes("kunde") ||
            h.toLowerCase().includes("auftraggeber") ||
            h.toLowerCase().includes("begünstigter") ||
            h.toLowerCase().includes("partner")
        ) || possibleMappings.value.recipient[0];

      mappedColumns.value.recipient = recipientHeader;
    }

    // Automatisches Mapping für Notizen
    if (possibleMappings.value.notes.length > 0) {
      const notesHeader =
        possibleMappings.value.notes.find(
          (h) =>
            h.toLowerCase().includes("notiz") ||
            h.toLowerCase().includes("note") ||
            h.toLowerCase().includes("notes") ||
            h.toLowerCase().includes("verwendungszweck") ||
            h.toLowerCase().includes("buchungstext") ||
            h.toLowerCase().includes("beschreibung") ||
            h.toLowerCase().includes("description") ||
            h.toLowerCase().includes("bemerkung")
        ) || possibleMappings.value.notes[0];

      mappedColumns.value.notes = notesHeader;
    }

    // Automatisches Mapping für Kategorie (niedrigste Priorität)
    if (possibleMappings.value.category.length > 0 && !mappedColumns.value.category) {
      const categoryHeader =
        possibleMappings.value.category.find(
          (h) =>
            h.toLowerCase().includes("kat") ||
            h.toLowerCase().includes("kategorie") ||
            h.toLowerCase().includes("cat") ||
            h.toLowerCase().includes("category")
        ) || possibleMappings.value.category[0];

      mappedColumns.value.category = categoryHeader;
    }
  }

  /**
   * Parse ein Datum gemäß dem gewählten Format
   */
  function parseDate(dateString: string): string | null {
    if (!dateString) return null;

    try {
      const dateStr = dateString.trim();
      let year: string | number, month: string | number, day: string | number;

      // Extrahiere Trennzeichen (-, /, .)
      const separator = dateStr.match(/[-/.]/)?.[0] || "-";

      switch (configuration.value.dateFormat) {
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
      debugLog(
        "CSVImportService",
        "Error parsing date",
        JSON.stringify(error)
      );
      return null;
    }
  }

  /**
   * Wendet automatisches Mapping auf alle Daten an
   */
  function applyAutoMappingToAllData() {
    if (!allParsedData.value.length) return;

    // Für jede Zeile Empfänger und Kategorien automatisch zuordnen
    allParsedData.value.forEach((row) => {
      // 1. Empfängererkennung (nur wenn kein Kontotransfer)
      if (mappedColumns.value.recipient && !row._potentialAccountTransfer) {
        const recipientText = row[mappedColumns.value.recipient];
        if (recipientText) {
          findMatchingRecipient(row, recipientText);
        }
      }

      // 2. Kategorieerkennung (immer durchführen)
      if (mappedColumns.value.category) {
        const categoryText = row[mappedColumns.value.category];
        if (categoryText) {
          findMatchingCategory(row, categoryText);
        }
      }

      // 3. Tag-Erkennung aus Notizen
      const extractedTags = _extractTagsFromNotes(row);
      if (extractedTags.length > 0) {
        row._extractedTags = extractedTags;
        debugLog('CSVImportService', `Tags aus Notizen extrahiert für Zeile ${row._originalIndex}:`, extractedTags);
      }
    });

    // Identifiziere potenzielle Duplikate
    identifyPotentialMerges();
  }

  /**
   * Extrahiert Tags aus dem Notizfeld einer ImportRow
   */
  function _extractTagsFromNotes(row: ImportRow): string[] {
    if (!mappedColumns.value.notes || !row[mappedColumns.value.notes]) {
      return [];
    }

    const notesText = row[mappedColumns.value.notes].toString().trim();
    if (!notesText) {
      return [];
    }

    // Regex zum Finden von Tags (# gefolgt von Zeichen bis zum nächsten Leerzeichen oder Ende)
    const tagRegex = /#([^\s#]+)/g;
    const extractedTags: string[] = [];
    let match;

    while ((match = tagRegex.exec(notesText)) !== null) {
      const tagName = match[1].trim();
      if (tagName && !extractedTags.includes(tagName)) {
        extractedTags.push(tagName);
      }
    }

    return extractedTags;
  }

  /**
   * Findet passende Empfänger für einen Text und speichert die Übereinstimmungen
   * Erweiterte Logik für korrekte recipientId-Zuordnung gemäß Task 4.1
   * NEUE FUNKTION: Erkennt auch Account-Namen für Account-Transfers
   */
  function findMatchingRecipient(row: ImportRow, searchText: string) {
    if (!searchText) return;

    // NEUE LOGIK: Prüfe zuerst ob searchText einem Kontonamen entspricht
    const matchingAccount = accountStore.accounts.find(
      account => account.name && account.name.toLowerCase() === searchText.toLowerCase().trim()
    );

    if (matchingAccount) {
      // Hole den Betrag aus der Zeile für die Richtungsbestimmung
      const amountStr = mappedColumns.value.amount ? row[mappedColumns.value.amount] : null;
      const parsedAmount = amountStr ? parseAmount(amountStr) : null;

      if (parsedAmount !== null) {
        // Markiere als potentieller Account-Transfer mit Richtungsinformation
        (row as any)._potentialAccountTransfer = {
          targetAccountId: matchingAccount.id,
          targetAccountName: matchingAccount.name,
          amount: parsedAmount,
          // Bestimme die Richtung basierend auf dem Vorzeichen
          direction: parsedAmount < 0 ? 'outgoing' : 'incoming'
        };
        debugLog('CSVImportService', `Potentieller Account-Transfer erkannt: "${searchText}" -> Konto ${matchingAccount.name} (${matchingAccount.id}), Betrag: ${parsedAmount}, Richtung: ${parsedAmount < 0 ? 'ausgehend' : 'eingehend'}`);
      } else {
        // Fallback ohne Betragsinfo
        (row as any)._potentialAccountTransfer = {
          targetAccountId: matchingAccount.id,
          targetAccountName: matchingAccount.name
        };
        debugLog('CSVImportService', `Potentieller Account-Transfer erkannt: "${searchText}" -> Konto ${matchingAccount.name} (${matchingAccount.id}) - Betrag nicht verfügbar`);
      }
      return;
    }

    // Task 4.1: Einfacher Namensvergleich (case-insensitive) für recipientId-Zuordnung
    const directMatch = recipientStore.recipients.find(
      (r) => r.name && r.name.toLowerCase() === (searchText || '').toLowerCase().trim()
    );

    if (directMatch) {
      row.recipientId = directMatch.id;
      debugLog('CSVImportService', `Direkter Empfänger-Match gefunden: "${searchText}" -> ${directMatch.name} (${directMatch.id})`);
      return;
    }

    // Erweiterte Fuzzy-Suche für bessere Matches
    const recipientMatches = recipientStore.recipients
      .map((recipient) => {
        const similarity = calculateStringSimilarity(recipient.name, searchText);
        return {
          id: recipient.id,
          name: recipient.name,
          similarity,
        };
      })
      .filter((match) => match.similarity > SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    // Die besten Treffer speichern für UI-Anzeige
    row._recipientMatches = recipientMatches;

    // Den besten Treffer automatisch zuweisen, wenn er über einem höheren Schwellwert liegt
    if (recipientMatches.length > 0 && recipientMatches[0].similarity > 0.8) {
      row.recipientId = recipientMatches[0].id;
      debugLog('CSVImportService', `Fuzzy-Match Empfänger gefunden: "${searchText}" -> ${recipientMatches[0].name} (${recipientMatches[0].id}) mit Ähnlichkeit ${recipientMatches[0].similarity}`);
    } else {
      // Kein passender Empfänger gefunden - recipientId bleibt undefined, payee wird später gesetzt
      debugLog('CSVImportService', `Kein passender Empfänger für "${searchText}" gefunden. recipientId bleibt undefined.`);
    }
  }

  /**
   * Findet passende Kategorien für einen Text und speichert die Übereinstimmungen
   */
  function findMatchingCategory(row: ImportRow, searchText: string) {
    if (!searchText) return;

    // Direktsuche nach exaktem Namen
    const directMatch = categoryStore.categories.find(
      (c) => c.name && c.name.toLowerCase() === (searchText || '').toLowerCase()
    );

    if (directMatch) {
      row.categoryId = directMatch.id;
      debugLog('CSVImportService', `Direkter Kategorie-Match gefunden: "${searchText}" -> ${directMatch.name} (${directMatch.id})`);
      return;
    }

    // Fuzzy-Matching für Kategorien
    const categoryMatches = categoryStore.categories
      .map((category) => {
        const similarity = calculateStringSimilarity(category.name, searchText);
        return {
          id: category.id,
          name: category.name,
          similarity,
        };
      })
      .filter((match) => match.similarity > SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    // Die besten Treffer speichern
    row._categoryMatches = categoryMatches;

    // Den besten Treffer automatisch zuweisen, wenn er über einem höheren Schwellwert liegt
    if (categoryMatches.length > 0 && categoryMatches[0].similarity > 0.8) {
      row.categoryId = categoryMatches[0].id;
    }
  }

  /**
   * Identifiziere potentiell doppelte Transaktionen
   */
  function identifyPotentialMerges() {
    if (!mappedColumns.value.date || !mappedColumns.value.amount) return;

    allParsedData.value.forEach((row) => {
      const dateStr = row[mappedColumns.value.date];
      const amountStr = row[mappedColumns.value.amount];

      const parsedDate = parseDate(dateStr);
      const parsedAmount = parseAmount(amountStr);

      if (!parsedDate || parsedAmount === null) return;

      // Prüfe zuerst auf AccountTransfer-Duplikate
      if (row._potentialAccountTransfer) {
        const accountTransferDuplicate = transactionStore.transactions.find((tx) => {
          // Muss ein AccountTransfer sein
          if (tx.type !== TransactionType.ACCOUNTTRANSFER) return false;

          // Gleicher Tag (mit 1-Tag Toleranz für AccountTransfers)
          const txDate = new Date(tx.date);
          const importDate = new Date(parsedDate);
          const dayDiff = Math.abs(txDate.getTime() - importDate.getTime()) / (1000 * 60 * 60 * 24);
          const similarDate = dayDiff <= 1;

          // Gleicher Betrag (aber entgegengesetzte Richtung für Account-Transfers)
          const sameAmount = Math.abs(Math.abs(tx.amount) - Math.abs(parsedAmount)) < 0.01;

          // Entgegengesetzte Richtung prüfen:
          // - Die bestehende Transaktion ist ein AccountTransfer von tx.accountId zu tx.transferToAccountId
          // - Die Import-Zeile würde zu row._potentialAccountTransfer.targetAccountId gehen
          // - Für ein Duplikat muss tx.accountId === row._potentialAccountTransfer.targetAccountId sein
          //   (die bestehende Transaktion geht VON dem Konto, zu dem die Import-Zeile gehen würde)
          const oppositeDirection = tx.accountId === (row._potentialAccountTransfer as any).targetAccountId;

          return similarDate && sameAmount && oppositeDirection;
        });

        if (accountTransferDuplicate) {
          row._potentialMerge = accountTransferDuplicate;
          row._duplicateType = 'account_transfer';
          row._duplicateConfidence = 0.95;
          debugLog('CSVImportService', `AccountTransfer-Duplikat erkannt mit hoher Sicherheit (${row._duplicateConfidence})`, {
            importRow: row._uniqueRowIdentifier,
            existingTransaction: accountTransferDuplicate.id,
            amount: parsedAmount,
            date: parsedDate
          });
          return; // Früher Ausstieg, da AccountTransfer-Duplikat gefunden
        }
      }

      // Standard-Duplikaterkennung für normale Transaktionen
      // Empfänger und Notizen aus der Zeile extrahieren (falls gemappt)
      let recipientName = "";
      let notes = "";
      if (mappedColumns.value.recipient) {
        recipientName = row[mappedColumns.value.recipient];
      }
      if (mappedColumns.value.notes) {
        notes = row[mappedColumns.value.notes];
      }

      // Suche nach ähnlichen Transaktionen
      const potentialMatches = transactionStore.transactions.filter((tx) => {
        // Gleicher Tag
        const sameDate = tx.date.substring(0, 10) === parsedDate.substring(0, 10);

        // KORRIGIERT: Exakte Betragsübereinstimmung inkl. Vorzeichen (Toleranz von 0.01)
        const sameAmount = Math.abs(tx.amount - parsedAmount) < 0.01;

        // Ähnlicher Empfänger oder Notiz, falls verfügbar
        let similarRecipientOrNote = true;
        if ((recipientName || notes) && 'recipientId' in tx && tx.recipientId) {
          const txRecipient = recipientStore.getRecipientById(tx.recipientId as string);
          if (txRecipient) {
            // Prüfen ob Empfängername ähnlich ist
            const recipientSimilarity = recipientName
              ? calculateStringSimilarity(txRecipient.name, recipientName)
              : 0;

            // Oder wenn Notiz ähnlich ist mit dem Empfängernamen
            const noteSimilarity = notes
              ? calculateStringSimilarity(txRecipient.name, notes)
              : 0;

            similarRecipientOrNote =
              recipientSimilarity > 0.3 || noteSimilarity > 0.3;
          }
        }

        return sameDate && sameAmount && similarRecipientOrNote;
      });

      if (potentialMatches.length > 0) {
        row._potentialMerge = potentialMatches[0];
        row._duplicateType = 'standard';
        row._duplicateConfidence = 0.8; // Standard-Konfidenz für normale Duplikate
      }
    });
  }

  /**
 * Wendet eine manuelle Empfänger-Auswahl auf Zeilen mit exakt übereinstimmendem Wert an
 */
  function applyRecipientToSimilarRows(row: ImportRow, recipientId: string) {
    if (!mappedColumns.value.recipient || !row) {
      debugLog(
        "CSVImportService",
        "Abbruch: Keine Empfängerspalte oder ungültige Zeile",
        JSON.stringify({ recipientId })
      );
      return;
    }

    // Den ursprünglichen Wert in dieser Zeile ermitteln
    const originalValue = row[mappedColumns.value.recipient];
    if (!originalValue) {
      debugLog(
        "CSVImportService",
        "Abbruch: Kein Wert in der Empfängerspalte gefunden"
      );
      return;
    }

    // Empfängernamen aus dem Store abrufen
    const recipientName = recipientId
      ? (recipientStore.getRecipientById(recipientId)?.name || 'Unbekannter Empfänger')
      : 'Kein Empfänger';

    debugLog(
      "CSVImportService",
      `Wende Empfänger an: ${recipientId} (${recipientName}) auf CSV-Namen: "${originalValue}"`,
      JSON.stringify({ originalValue, recipientId, recipientName })
    );

    // Zähler für tatsächlich geänderte Zeilen
    let changedRowsCount = 0;
    let debugChangedRows: { index: number, csvValue: string }[] = [];

    // Alle Zeilen mit exakt dem gleichen Empfängerwert finden und aktualisieren
    allParsedData.value.forEach((otherRow, index) => {
      const otherValue = otherRow[mappedColumns.value.recipient];

      // Strikte Prüfung auf exakte Übereinstimmung des Empfängernamens
      if (otherValue === originalValue &&
        typeof otherValue === typeof originalValue &&
        String(otherValue).trim() === String(originalValue).trim()) {

        debugLog(
          "CSVImportService",
          `Setze Empfänger ${recipientId} (${recipientName}) für Zeile mit CSV-Wert "${otherValue}"`,
          JSON.stringify({
            originalIndex: otherRow._originalIndex,
            csvValue: otherValue
          })
        );

        otherRow.recipientId = recipientId;
        changedRowsCount++;
        debugChangedRows.push({
          index: otherRow._originalIndex,
          csvValue: otherValue
        });
      }
    });

    infoLog(
      "CSVImportService",
      `Empfänger-Zuordnung abgeschlossen: ${changedRowsCount} Zeilen aktualisiert`,
      JSON.stringify({
        recipientId,
        recipientName,
        originalValue,
        changedRowsCount,
        changedRows: debugChangedRows
      })
    );
  }
  /**
 * Wendet eine manuelle Kategorie-Auswahl auf Zeilen mit exakt übereinstimmendem Wert an
 */
  function applyCategoryToSimilarRows(row: ImportRow, categoryId: string) {
    if (!mappedColumns.value.category || !row) {
      debugLog(
        "CSVImportService",
        "Abbruch: Keine Kategoriespalte oder ungültige Zeile",
        JSON.stringify({ categoryId })
      );
      return;
    }

    // Den ursprünglichen Wert in dieser Zeile ermitteln
    const originalValue = row[mappedColumns.value.category];
    if (!originalValue) {
      debugLog(
        "CSVImportService",
        "Abbruch: Kein Wert in der Kategoriespalte gefunden"
      );
      return;
    }

    // Kategorienamen aus dem Store abrufen
    const categoryName = categoryId
      ? (categoryStore.getCategoryById(categoryId)?.name || 'Unbekannte Kategorie')
      : 'Keine Kategorie';

    debugLog(
      "CSVImportService",
      `Wende Kategorie an: ${categoryId} (${categoryName}) auf CSV-Namen: "${originalValue}"`,
      JSON.stringify({ originalValue, categoryId, categoryName })
    );

    // Zähler für tatsächlich geänderte Zeilen
    let changedRowsCount = 0;
    let debugChangedRows: { index: number, csvValue: string }[] = [];

    // Alle Zeilen mit exakt dem gleichen Kategoriewert finden und aktualisieren
    allParsedData.value.forEach((otherRow, index) => {
      const otherValue = otherRow[mappedColumns.value.category];

      // Strikte Prüfung auf exakte Übereinstimmung des Kategorienamens
      if (otherValue === originalValue &&
        typeof otherValue === typeof originalValue &&
        String(otherValue).trim() === String(originalValue).trim()) {

        debugLog(
          "CSVImportService",
          `Setze Kategorie ${categoryId} (${categoryName}) für Zeile mit CSV-Wert "${otherValue}"`,
          JSON.stringify({
            originalIndex: otherRow._originalIndex,
            csvValue: otherValue
          })
        );

        allParsedData.value[index].categoryId = categoryId;
        changedRowsCount++;
        debugChangedRows.push({
          index: otherRow._originalIndex,
          csvValue: otherValue
        });
      }
    });

    infoLog(
      "CSVImportService",
      `Kategorie-Zuordnung abgeschlossen: ${changedRowsCount} Zeilen aktualisiert`,
      JSON.stringify({
        categoryId,
        categoryName,
        originalValue,
        changedRowsCount,
        changedRows: debugChangedRows
      })
    );
  }

  /**
   * Bereite Daten für den Import vor
   */
  function prepareDataForImport(accountId: string) {
    const preparedData = [];

    for (const row of allParsedData.value) {
      // Überspringe nicht ausgewählte Zeilen
      if (!row._selected) continue;

      const dateValue = mappedColumns.value.date
        ? parseDate(row[mappedColumns.value.date])
        : null;
      const amountValue = mappedColumns.value.amount
        ? parseAmount(row[mappedColumns.value.amount])
        : null;

      // Pflichtfelder prüfen
      if (!dateValue || amountValue === null) {
        continue;
      }

      const rowData = {
        date: dateValue,
        valueDate: dateValue,
        amount: amountValue,
        note: mappedColumns.value.notes ? row[mappedColumns.value.notes] : "",
        recipientId: row.recipientId || null,
        categoryId: row.categoryId || undefined,
        accountId: accountId,
        tagIds: row.tagIds || selectedTags.value || [],
        potentialMerge: row._potentialMerge,
        // REGEL-FIRST-ARCHITEKTUR: Setze payee-Feld IMMER aus CSV-Daten
        payee: mappedColumns.value.recipient ? row[mappedColumns.value.recipient] : '',
        // Speichere den Original-Empfängernamen für weitere Verarbeitung
        originalRecipientName: mappedColumns.value.recipient ? row[mappedColumns.value.recipient] : null,
        // Speichere den Original-Kategorienamen für Kategorie-Matching
        originalCategory: mappedColumns.value.category ? row[mappedColumns.value.category] : null,
        // Eindeutiger Identifikator für Account-Transfer-Erkennung
        _uniqueRowIdentifier: row._uniqueRowIdentifier
      };

      preparedData.push(rowData);
    }

    return preparedData;
  }

  /**
   * Überprüft, ob eine Zeile alle erforderlichen Felder hat und bereit für den Import ist
   */
  function isRowReadyForImport(row: ImportRow): boolean {
    if (!row._selected) return false;

    const dateValue = mappedColumns.value.date
      ? parseDate(row[mappedColumns.value.date])
      : null;
    const amountValue = mappedColumns.value.amount
      ? parseAmount(row[mappedColumns.value.amount])
      : null;

    return !!dateValue && amountValue !== null;
  }

  /**
   * Löst einen Empfänger basierend auf der vorhandenen Zuordnung oder dem Originalnamen auf.
   * Wenn null zurückgegeben wird, soll kein Empfänger angelegt werden (manuell entfernt)
   * Wenn der Empfänger zurückgegeben wird, soll dieser verwendet werden
   * Wenn ein String zurückgegeben wird, soll ein neuer Empfänger mit diesem Namen erstellt werden
   */
  function resolveRecipient(row: any): string | null | { id: string, name: string } {
    // Fall 1: Wenn eine recipientId explizit zugewiesen wurde (über Dropdown ausgewählt)
    if (row.recipientId) {
      const recipient = recipientStore.getRecipientById(row.recipientId);
      if (recipient) return recipient;
    }

    // Fall 2: Wenn kein Empfängername in der CSV vorhanden ist
    if (!row.originalRecipientName) return null;

    // Fall 3: Automatische Anlage - Prüfe, ob der Name bereits existiert
    const existingRecipient = recipientStore.recipients.find(
      r => r.name && r.name.toLowerCase() === (row.originalRecipientName || '').toLowerCase()
    );

    if (existingRecipient) {
      return existingRecipient;
    }

    // Fall 4: Neuen Empfänger mit dem Namen anlegen
    return row.originalRecipientName;
  }

  /**
   * Prüft, ob ein Account-Transfer bereits als Gegenbuchung existiert
   * Verhindert doppelte Erfassung bei separaten Importen beider Konten
   */
  function isDuplicateAccountTransfer(transfer: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
  }, alreadyCreatedTransfers: Array<{
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string;
  }> = []): boolean {
    const transferDate = transfer.date;
    const transferAmount = Math.abs(transfer.amount);

    // Prüfe zuerst gegen bereits in diesem Import erstellte Transfers
    for (const createdTransfer of alreadyCreatedTransfers) {
      if (createdTransfer.date === transferDate &&
        Math.abs(createdTransfer.amount) === transferAmount) {
        // Prüfe auf umgekehrte Richtung (Duplikat)
        if ((createdTransfer.fromAccountId === transfer.toAccountId &&
          createdTransfer.toAccountId === transfer.fromAccountId) ||
          (createdTransfer.fromAccountId === transfer.fromAccountId &&
            createdTransfer.toAccountId === transfer.toAccountId)) {
          debugLog('CSVImportService', `CSV-internes Duplikat erkannt`, {
            existing: createdTransfer,
            new: transfer
          });
          return true;
        }
      }
    }

    // Suche nach existierenden Account-Transfers am gleichen Datum
    const existingTransfers = transactionStore.transactions.filter(tx =>
      tx.type === TransactionType.ACCOUNTTRANSFER &&
      tx.date === transferDate &&
      Math.abs(tx.amount) === transferAmount
    );

    for (const existingTx of existingTransfers) {
      // Prüfe ob es sich um die Gegenbuchung handelt
      // Fall 1: Existierende Transaktion ist FROM-Seite (negativ), neue wäre TO-Seite
      if (existingTx.amount < 0 &&
        existingTx.accountId === transfer.fromAccountId &&
        existingTx.transferToAccountId === transfer.toAccountId) {
        debugLog('CSVImportService', `Duplikat erkannt: FROM-Seite bereits vorhanden`, {
          existing: { accountId: existingTx.accountId, amount: existingTx.amount, transferTo: existingTx.transferToAccountId },
          new: { fromAccountId: transfer.fromAccountId, toAccountId: transfer.toAccountId, amount: transfer.amount }
        });
        return true;
      }

      // Fall 2: Existierende Transaktion ist TO-Seite (positiv), neue wäre FROM-Seite
      if (existingTx.amount > 0 &&
        existingTx.accountId === transfer.toAccountId &&
        existingTx.transferToAccountId === transfer.fromAccountId) {
        debugLog('CSVImportService', `Duplikat erkannt: TO-Seite bereits vorhanden`, {
          existing: { accountId: existingTx.accountId, amount: existingTx.amount, transferTo: existingTx.transferToAccountId },
          new: { fromAccountId: transfer.fromAccountId, toAccountId: transfer.toAccountId, amount: transfer.amount }
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Findet potentielle Duplikate in den zu importierenden Daten
   */
  function findPotentialDuplicates(targetAccountId: string) {
    const duplicates: Array<{
      csvRow: any;
      existingTransaction: any;
      duplicateType: 'exact' | 'similar' | 'account_transfer';
      confidence: number;
    }> = [];

    for (let i = 0; i < allParsedData.value.length; i++) {
      const row = allParsedData.value[i];

      if (!row._selected) continue;

      const date = parseDate(row[mappedColumns.value.date]);
      const amount = parseAmount(row[mappedColumns.value.amount]);

      if (!date || amount === null) continue;

      // Suche nach existierenden Transaktionen
      const existingTransactions = transactionStore.transactions.filter(tx => {
        const sameDate = tx.date === date;
        // KORRIGIERT: Vorzeichen muss bei Duplikatsprüfung berücksichtigt werden
        const sameAmount = tx.amount === amount; // Exakte Übereinstimmung inkl. Vorzeichen

        if (!sameDate || !sameAmount) return false;

        // Prüfe auf Account-Transfer-Duplikat
        if (tx.type === TransactionType.ACCOUNTTRANSFER) {
          const payee = mappedColumns.value.recipient ? row[mappedColumns.value.recipient] : '';
          const matchingAccount = accountStore.accounts.find(
            account => account.name && account.name.toLowerCase() === payee.toLowerCase().trim()
          );

          if (matchingAccount) {
            return (tx.accountId === targetAccountId && tx.transferToAccountId === matchingAccount.id) ||
              (tx.accountId === matchingAccount.id && tx.transferToAccountId === targetAccountId);
          }
        }

        // Prüfe auf normale Transaktions-Duplikate
        if (tx.accountId === targetAccountId) {
          const recipientMatch = mappedColumns.value.recipient ?
            row[mappedColumns.value.recipient]?.toLowerCase().includes(tx.payee?.toLowerCase() || '') ||
            tx.payee?.toLowerCase().includes(row[mappedColumns.value.recipient]?.toLowerCase() || '') : false;

          const noteMatch = mappedColumns.value.notes ?
            row[mappedColumns.value.notes]?.toLowerCase().includes(tx.note?.toLowerCase() || '') ||
            tx.note?.toLowerCase().includes(row[mappedColumns.value.notes]?.toLowerCase() || '') : false;

          return recipientMatch || noteMatch;
        }

        return false;
      });

      // Füge gefundene Duplikate hinzu
      for (const existingTx of existingTransactions) {
        const duplicateType = existingTx.type === TransactionType.ACCOUNTTRANSFER ? 'account_transfer' : 'exact';
        duplicates.push({
          csvRow: { ...row, _originalIndex: i },
          existingTransaction: existingTx,
          duplicateType,
          confidence: duplicateType === 'account_transfer' ? 0.95 : 0.85
        });
      }
    }

    return duplicates;
  }

  /**
   * Startet den Import-Prozess
   */
  async function startImport(accountId: string) {
    importStatus.value = "importing";
    error.value = "";
    importedTransactions.value = [];

    // CSV-Import-spezifische Performance-Optimierungen aktivieren
    const originalSkipRunningBalanceRecalc = (TransactionService as any)._skipRunningBalanceRecalc;
    (TransactionService as any)._skipRunningBalanceRecalc = true;

    // Bulk-Import-Modus für weitere Optimierungen
    const originalBulkImportMode = (globalThis as any).__FINWISE_BULK_IMPORT_MODE__;
    (globalThis as any).__FINWISE_BULK_IMPORT_MODE__ = true;

    try {
      const preparedData = prepareDataForImport(accountId);

      debugLog(
        "CSVImportService",
        "Starte Import von " + preparedData.length + " Transaktionen"
      );

      // Map für bereits erstellte Empfänger, um Duplikate zu vermeiden
      const createdRecipients = new Map<string, string>();  // recipientName -> recipientId

      // Tag-Verarbeitung: Sammle alle einzigartigen Tags und erstelle sie im Batch
      const allExtractedTags = new Set<string>();
      const rowTagMapping = new Map<string, string[]>(); // _uniqueRowIdentifier -> tagNames

      // Sammle alle extrahierten Tags aus den zu importierenden Zeilen
      for (const item of preparedData) {
        const originalRowData = allParsedData.value.find(row =>
          row._uniqueRowIdentifier && (item as any)._uniqueRowIdentifier === row._uniqueRowIdentifier
        );

        if (originalRowData && originalRowData._extractedTags && originalRowData._extractedTags.length > 0) {
          rowTagMapping.set(originalRowData._uniqueRowIdentifier, originalRowData._extractedTags);
          originalRowData._extractedTags.forEach(tagName => allExtractedTags.add(tagName));
        }
      }

      // Erstelle neue Tags (case-insensitive Prüfung)
      const tagNameToIdMap = new Map<string, string>(); // tagName (lowercase) -> tagId

      if (allExtractedTags.size > 0) {
        debugLog('CSVImportService', `Verarbeite ${allExtractedTags.size} einzigartige Tags aus CSV-Import`);

        for (const tagName of allExtractedTags) {
          const lowerTagName = tagName.toLowerCase();

          // Prüfe ob Tag bereits existiert (case-insensitive)
          const existingTag = tagStore.tags.find(tag =>
            tag.name.toLowerCase() === lowerTagName
          );

          if (existingTag) {
            tagNameToIdMap.set(lowerTagName, existingTag.id);
            debugLog('CSVImportService', `Verwende existierendes Tag: "${tagName}" -> ${existingTag.id}`);
          } else {
            // Erstelle neues Tag
            try {
              const newTag = await tagStore.addTag({
                name: tagName,
                parentTagId: null
              });
              tagNameToIdMap.set(lowerTagName, newTag.id);
              infoLog('CSVImportService', `Neues Tag erstellt: "${tagName}" -> ${newTag.id}`);
            } catch (error) {
              errorLog('CSVImportService', `Fehler beim Erstellen von Tag "${tagName}"`, error);
            }
          }
        }
      }

      // REGEL-FIRST-ARCHITEKTUR: Zwei-Phasen-Verarbeitung
      const transactionsToImport = [];

      // Phase 1: Datenaufbereitung - payee aus CSV setzen, keine IDs zuweisen
      for (const item of preparedData) {
        // Hole extrahierte Tags für diese Zeile
        const itemRowIdentifier = (item as any)._uniqueRowIdentifier;
        const extractedTagNames = rowTagMapping.get(itemRowIdentifier) || [];
        const extractedTagIds = extractedTagNames.map(tagName =>
          tagNameToIdMap.get(tagName.toLowerCase())
        ).filter(Boolean) as string[];

        // WICHTIG: Setze payee IMMER aus CSV-Daten, auch wenn potentieller Match existiert
        const transactionData: CSVTransactionData = {
          id: crypto.randomUUID(),
          date: item.date,
          valueDate: item.valueDate,
          accountId: item.accountId,
          amount: item.amount,
          note: item.note,
          description: item.note,

          // REGEL-RELEVANTE FELDER - immer aus CSV setzen
          payee: item.originalRecipientName || '', // Aus CSV-Empfänger-Spalte
          originalCategory: item.originalCategory, // Aus prepareDataForImport
          originalRecipientName: item.originalRecipientName, // Für Regel-Kompatibilität

          // IDs bleiben zunächst undefined - werden durch Regeln oder Matching gesetzt
          recipientId: undefined,
          categoryId: undefined,
          tagIds: [...(item.tagIds || []), ...extractedTagIds], // Kombiniere bestehende und extrahierte Tags

          // Weitere Felder
          type: item.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
          counterTransactionId: null,
          planningTransactionId: null,
          isReconciliation: false,
          runningBalance: 0,

          reconciled: false,
          isCategoryTransfer: false,
          transferToAccountId: null,
          toCategoryId: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Verknüpfung zur ursprünglichen CSV-Zeile für Account-Transfer-Erkennung (als any um TypeScript-Fehler zu vermeiden)
        (transactionData as any)._originalRowIdentifier = (item as any)._uniqueRowIdentifier;

        transactionsToImport.push(transactionData);
      }

      // Phase 2: Regel-Verarbeitung (PRE + DEFAULT)
      if (transactionsToImport.length > 0) {
        infoLog('CSVImportService', `Applying PRE and DEFAULT stage rules to ${transactionsToImport.length} transactions`);

        // Wende Regeln auf Transaktionen mit payee/originalCategory an
        const processedTransactions = await TransactionService.applyPreAndDefaultRulesToTransactions(transactionsToImport);

        // Ersetze ursprüngliche Transaktionen
        transactionsToImport.length = 0;
        transactionsToImport.push(...processedTransactions);
      }

      // Phase 3: Account-Transfer-Erkennung und automatisches Matching
      const accountTransfersToCreate: Array<{
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        date: string;
        valueDate: string;
        note: string;
        originalTxIndex: number;
      }> = [];

      // Sammle Account-Transfers und markiere entsprechende Transaktionen
      for (let i = 0; i < transactionsToImport.length; i++) {
        const tx = transactionsToImport[i];

        // Prüfe ob Empfänger einem Kontonamen entspricht (nur wenn keine Regel recipientId gesetzt hat)
        if (!tx.recipientId && !tx._skipAutoRecipientMatching && tx.payee) {
          const matchingAccount = accountStore.accounts.find(
            account => account.name && account.name.toLowerCase() === tx.payee.toLowerCase().trim()
          );

          if (matchingAccount && matchingAccount.id !== tx.accountId) {
            // Account-Transfer erkannt - KORRIGIERT: Vorzeichen beachten
            debugLog('CSVImportService', `Account-Transfer erkannt: ${tx.payee} -> Konto ${matchingAccount.name} (${matchingAccount.id}), Betrag: ${tx.amount}`);

            // WICHTIG: Vorzeichen bestimmt die Richtung des Transfers
            if (tx.amount < 0) {
              // Negativer Betrag = Geld geht VOM aktuellen Konto ZUM Zielkonto
              accountTransfersToCreate.push({
                fromAccountId: tx.accountId,
                toAccountId: matchingAccount.id,
                amount: Math.abs(tx.amount), // Positiver Betrag für Transfer-Logik
                date: tx.date,
                valueDate: tx.valueDate,
                note: tx.note || `Transfer zu ${matchingAccount.name}`,
                originalTxIndex: i
              });
            } else {
              // Positiver Betrag = Geld kommt VOM Zielkonto ZUM aktuellen Konto
              accountTransfersToCreate.push({
                fromAccountId: matchingAccount.id,
                toAccountId: tx.accountId,
                amount: Math.abs(tx.amount), // Positiver Betrag für Transfer-Logik
                date: tx.date,
                valueDate: tx.valueDate,
                note: tx.note || `Transfer von ${matchingAccount.name}`,
                originalTxIndex: i
              });
            }

            // Markiere diese Transaktion als Account-Transfer (wird später übersprungen)
            (tx as any)._isAccountTransfer = true;
            continue;
          }
        }

        // Zusätzlich: Prüfe auf potentielle Account-Transfers aus findMatchingRecipient
        const originalRowData = allParsedData.value.find(row =>
          row._uniqueRowIdentifier && (tx as any)._originalRowIdentifier === row._uniqueRowIdentifier
        );

        if (originalRowData && (originalRowData as any)._potentialAccountTransfer) {
          const potentialTransfer = (originalRowData as any)._potentialAccountTransfer;

          if (potentialTransfer.targetAccountId !== tx.accountId) {
            // Account-Transfer aus findMatchingRecipient erkannt - KORRIGIERT: Richtung aus findMatchingRecipient verwenden
            debugLog('CSVImportService', `Account-Transfer aus Matching erkannt: ${tx.payee} -> Konto ${potentialTransfer.targetAccountName} (${potentialTransfer.targetAccountId}), Betrag: ${tx.amount}, Richtung: ${potentialTransfer.direction || 'unbekannt'}`);

            // Verwende die bereits in findMatchingRecipient bestimmte Richtung
            if (potentialTransfer.direction === 'outgoing' || (!potentialTransfer.direction && tx.amount < 0)) {
              // Ausgehender Transfer: VOM aktuellen Konto ZUM Zielkonto
              accountTransfersToCreate.push({
                fromAccountId: tx.accountId,
                toAccountId: potentialTransfer.targetAccountId,
                amount: Math.abs(tx.amount),
                date: tx.date,
                valueDate: tx.valueDate,
                note: tx.note || `Transfer zu ${potentialTransfer.targetAccountName}`,
                originalTxIndex: i
              });
            } else {
              // Eingehender Transfer: VOM Zielkonto ZUM aktuellen Konto
              accountTransfersToCreate.push({
                fromAccountId: potentialTransfer.targetAccountId,
                toAccountId: tx.accountId,
                amount: Math.abs(tx.amount),
                date: tx.date,
                valueDate: tx.valueDate,
                note: tx.note || `Transfer von ${potentialTransfer.targetAccountName}`,
                originalTxIndex: i
              });
            }

            // Markiere diese Transaktion als Account-Transfer
            (tx as any)._isAccountTransfer = true;
            continue;
          }
        }

        // Empfänger-Matching nur wenn keine Regel recipientId gesetzt hat und kein Account-Transfer
        if (!tx.recipientId && !tx._skipAutoRecipientMatching && tx.payee && !(tx as any)._isAccountTransfer) {
          const matchResult = await performRecipientMatching(tx.payee);
          if (matchResult) {
            if (typeof matchResult === 'string') {
              // Neuen Empfänger erstellen
              const recipientName = matchResult;
              const lowerName = (recipientName || '').toLowerCase();

              if (createdRecipients.has(lowerName)) {
                const recipientId = createdRecipients.get(lowerName);
                if (recipientId) {
                  tx.recipientId = recipientId;
                  debugLog("CSVImportService", `Verwende bereits erstellten Empfänger: ${recipientName}`, JSON.stringify({ id: tx.recipientId }));
                }
              } else {
                // Neuen Empfänger erstellen
                const newRecipient = await recipientStore.addRecipient({ name: recipientName });
                tx.recipientId = newRecipient.id;
                createdRecipients.set(lowerName, newRecipient.id);
                infoLog("CSVImportService", `Neuer Empfänger erstellt: ${recipientName} (${newRecipient.id})`);
              }
            } else {
              // Existierenden Empfänger verwenden
              tx.recipientId = matchResult.id;
            }
          }
        }

        // Kategorie-Matching nur wenn keine Regel categoryId gesetzt hat
        if (!tx.categoryId && !tx._skipAutoCategoryMatching && tx.originalCategory) {
          const categoryMatch = await performCategoryMatching(tx.originalCategory);
          if (categoryMatch) {
            tx.categoryId = categoryMatch.id;
          }
        }

        // Für UI-Anzeige vorbereiten
        importedTransactions.value.push({
          ...tx,
          recipientName: tx.recipientId
            ? recipientStore.getRecipientById(tx.recipientId)?.name
            : "",
          categoryName: tx.categoryId
            ? categoryStore.getCategoryById(tx.categoryId)?.name
            : "",
          accountName: accountStore.getAccountById(tx.accountId)?.name || "",
        });
      }

      // Phase 3.5: Account-Transfers erstellen (im Bulk-Prozess)
      if (accountTransfersToCreate.length > 0) {
        infoLog('CSVImportService', `Prüfe ${accountTransfersToCreate.length} Account-Transfers auf Duplikate`);

        // Filtere Duplikate heraus und markiere entsprechende ursprüngliche Transaktionen
        const validTransfers = [];
        const duplicateTransferIndexes = new Set<number>();

        for (const transfer of accountTransfersToCreate) {
          if (!isDuplicateAccountTransfer(transfer)) {
            validTransfers.push(transfer);
          } else {
            // Markiere die ursprüngliche Transaktion als Duplikat, damit sie nicht als normale Transaktion importiert wird
            duplicateTransferIndexes.add(transfer.originalTxIndex);
            debugLog('CSVImportService', `Account-Transfer übersprungen (Duplikat): ${transfer.amount}€ von ${accountStore.getAccountById(transfer.fromAccountId)?.name} zu ${accountStore.getAccountById(transfer.toAccountId)?.name} am ${transfer.date}`);
          }
        }

        // Markiere die entsprechenden ursprünglichen Transaktionen als Duplikate
        for (let i = 0; i < transactionsToImport.length; i++) {
          if (duplicateTransferIndexes.has(i)) {
            (transactionsToImport[i] as any)._isDuplicateAccountTransfer = true;
            debugLog('CSVImportService', `Ursprüngliche Transaktion als Account-Transfer-Duplikat markiert (Index ${i})`);
          }
        }

        infoLog('CSVImportService', `Erstelle ${validTransfers.length} Account-Transfers im Bulk-Prozess (${accountTransfersToCreate.length - validTransfers.length} Duplikate übersprungen)`);

        for (const transfer of validTransfers) {
          try {
            // Erstelle Account-Transfer mit Gegenbuchung
            // WICHTIG: addAccountTransfer erwartet immer einen positiven Betrag und FROM->TO Richtung
            // Die Richtung wurde bereits in der Account-Transfer-Erkennung korrekt bestimmt
            const { fromTransaction, toTransaction } = await TransactionService.addAccountTransfer(
              transfer.fromAccountId,
              transfer.toAccountId,
              transfer.amount, // Bereits als positiver Betrag übergeben
              transfer.date,
              transfer.valueDate,
              transfer.note,
              null, // planningTransactionId
              undefined // recipientId - wird automatisch aus Kontonamen abgeleitet
            );

            // Füge beide Transaktionen zur UI-Anzeige hinzu
            importedTransactions.value.push({
              ...fromTransaction,
              recipientName: accountStore.getAccountById(transfer.toAccountId)?.name || "",
              categoryName: "",
              accountName: accountStore.getAccountById(transfer.fromAccountId)?.name || "",
            });

            importedTransactions.value.push({
              ...toTransaction,
              recipientName: accountStore.getAccountById(transfer.fromAccountId)?.name || "",
              categoryName: "",
              accountName: accountStore.getAccountById(transfer.toAccountId)?.name || "",
            });

            debugLog('CSVImportService', `Account-Transfer erstellt: ${transfer.amount}€ von ${accountStore.getAccountById(transfer.fromAccountId)?.name} zu ${accountStore.getAccountById(transfer.toAccountId)?.name}`);

          } catch (error) {
            errorLog('CSVImportService', `Fehler beim Erstellen des Account-Transfers`, {
              transfer,
              error
            });
          }
        }
      }

      // Entferne Account-Transfer-Transaktionen und Duplikate aus der normalen Import-Liste
      const filteredTransactionsToImport = transactionsToImport.filter(tx =>
        !(tx as any)._isAccountTransfer && !(tx as any)._isDuplicateAccountTransfer
      );

      const removedCount = transactionsToImport.length - filteredTransactionsToImport.length;
      if (removedCount > 0) {
        debugLog('CSVImportService', `${removedCount} Transaktionen aus normalem Import entfernt (Account-Transfers und Duplikate)`);
      }

      transactionsToImport.length = 0;
      transactionsToImport.push(...filteredTransactionsToImport);

      // Phase 4: BATCH-IMPORT aller verbleibenden Transaktionen
      if (transactionsToImport.length > 0) {
        try {
          // Batch-Import über TenantDbService für bessere Performance
          await tenantDbService.addTransactionsBatch(transactionsToImport);

          // Sync-Queue-Einträge werden NACH der Running Balance Neuberechnung erstellt
          // (siehe addTransactionsBatchToSyncQueue nach der Neuberechnung)

          infoLog('CSVImportService', `Batch-Import erfolgreich: ${transactionsToImport.length} normale Transaktionen importiert`, {
            accountId,
            batchSize: transactionsToImport.length,
            accountTransfers: accountTransfersToCreate.length
          });

        } catch (batchError) {
          errorLog('CSVImportService', `Fehler beim Batch-Import der Transaktionen`, {
            batchSize: transactionsToImport.length,
            accountId,
            error: batchError
          });

          // Fallback: Versuche einzelne Transaktionen zu importieren
          warnLog('CSVImportService', 'Fallback auf einzelne Transaktions-Imports');

          // Lösche die bereits vorbereiteten UI-Daten (Account-Transfers bleiben erhalten)
          const existingAccountTransfers = importedTransactions.value.filter(tx => tx.type === TransactionType.ACCOUNTTRANSFER);
          importedTransactions.value = [...existingAccountTransfers];

          for (const transactionData of transactionsToImport) {
            try {
              // Erstelle die Transaktion über den TransactionService (einzeln)
              // Regeln werden nicht angewendet, da sie bereits in Phase 1.5 angewendet wurden
              const newTransaction = await TransactionService.addTransaction(transactionData, false);

              // Erfolgreich importierte Transaktion für UI speichern
              importedTransactions.value.push({
                ...newTransaction,
                recipientName: transactionData.recipientId
                  ? recipientStore.getRecipientById(transactionData.recipientId)?.name
                  : "",
                categoryName: transactionData.categoryId
                  ? categoryStore.getCategoryById(transactionData.categoryId)?.name
                  : "",
                accountName: accountStore.getAccountById(transactionData.accountId)?.name || "",
              });

            } catch (individualError) {
              errorLog('CSVImportService', `Fehler beim Importieren der einzelnen Transaktion`, {
                transaction: transactionData,
                error: individualError
              });
            }
          }
        }
      }

      // Phase 2.5: TRANSACTIONSTORE LADEN vor Running Balance Berechnung
      // CSV-Import-spezifische Optimierungen zurücksetzen
      (TransactionService as any)._skipRunningBalanceRecalc = originalSkipRunningBalanceRecalc;
      (globalThis as any).__FINWISE_BULK_IMPORT_MODE__ = originalBulkImportMode;

      // KRITISCH: TransactionStore muss ZUERST geladen werden, damit BalanceService die neuen Transaktionen sieht
      infoLog('CSVImportService', 'Lade TransactionStore vor Running Balance Berechnung...');
      await transactionStore.loadTransactions();

      // Berechne Running Balance für alle betroffenen Konten einmal am Ende (Performance-Optimierung)
      infoLog('CSVImportService', 'Starte Running Balance Neuberechnung für betroffene Konten...');

      // Sammle alle betroffenen Konten (normale Transaktionen + Account-Transfers)
      const normalAccountIds = importedTransactions.value.map((tx: any) => tx.accountId).filter(Boolean);

      // Sammle Account-IDs aus Account-Transfer-Transaktionen (sowohl FROM als auch TO Seiten)
      const transferAccountIds = importedTransactions.value
        .filter((tx: any) => tx.type === TransactionType.ACCOUNTTRANSFER)
        .flatMap((tx: any) => [tx.accountId, tx.transferToAccountId])
        .filter(Boolean);

      const affectedAccountIds = [...new Set([...normalAccountIds, ...transferAccountIds])];

      // Ermittle das älteste Datum aller importierten Transaktionen für optimierte Neuberechnung
      let oldestImportDate: Date | undefined = undefined;
      if (importedTransactions.value.length > 0) {
        const dates = importedTransactions.value
          .map((tx: any) => new Date(tx.date))
          .filter(date => !isNaN(date.getTime()));

        if (dates.length > 0) {
          oldestImportDate = new Date(Math.min(...dates.map(d => d.getTime())));
          debugLog('CSVImportService', `Ältestes Importdatum ermittelt: ${oldestImportDate.toISOString().split('T')[0]}`, {
            totalTransactions: importedTransactions.value.length,
            validDates: dates.length
          });
        }
      }

      // KORRIGIERT: Vollständige Neuberechnung aller betroffenen Konten ohne fromDate
      // Das stellt sicher, dass alle Running Balances korrekt von Grund auf berechnet werden
      for (const accountId of affectedAccountIds) {
        try {
          // WICHTIG: Keine fromDate übergeben - vollständige Neuberechnung des gesamten Kontos
          await BalanceService.recalculateRunningBalancesForAccount(accountId);
          debugLog('CSVImportService', `Running Balance für Konto ${accountId} vollständig neu berechnet`);
        } catch (error) {
          warnLog('CSVImportService', `Fehler bei Running Balance Berechnung für Konto ${accountId}`, error);
        }
      }

      infoLog('CSVImportService', 'Running Balance Neuberechnung abgeschlossen', {
        affectedAccounts: affectedAccountIds.length,
        accountIds: affectedAccountIds
      });

      // Phase 2.7: POST-STAGE REGELN ANWENDEN nach Running Balance Berechnung
      if (transactionsToImport.length > 0) {
        infoLog('CSVImportService', `Applying POST-stage rules to ${transactionsToImport.length} saved transactions`);
        try {
          // Sammle alle Transaktions-IDs für POST-Stage Regelanwendung
          const transactionIds = transactionsToImport.map(tx => tx.id);

          // Wende POST-Stage Regeln auf gespeicherte Transaktionen an
          await TransactionService.applyPostStageRulesToTransactions(transactionIds);

          infoLog('CSVImportService', `POST-stage rules applied successfully to ${transactionIds.length} transactions`);
        } catch (ruleError) {
          warnLog('CSVImportService', 'Error applying POST-stage rules, continuing with import', ruleError);
        }
      }

      // Phase 3: WARTEN AUF VOLLSTÄNDIGE EMPFÄNGER/KATEGORIEN-SYNCHRONISATION
      infoLog('CSVImportService', 'Warte auf vollständige Synchronisation aller neuen Empfänger...');

      // Kurze Wartezeit, damit alle Empfänger-Erstellungen abgeschlossen sind
      await new Promise(resolve => setTimeout(resolve, 500));

      // Alle Stores neu laden, um sicherzustellen, dass neue Empfänger/Kategorien verfügbar sind
      await recipientStore.loadRecipients();
      await categoryStore.loadCategories();

      infoLog('CSVImportService', 'Empfänger- und Kategorien-Synchronisation abgeschlossen');

      // Phase 4: SYNC-QUEUE-ERSTELLUNG nach Running Balance Neuberechnung
      // Jetzt haben alle Transaktionen die korrekten Running Balance Werte
      if (transactionsToImport.length > 0) {
        try {
          infoLog('CSVImportService', 'Erstelle Sync-Queue-Einträge für Backend-Synchronisation...');

          // Lade die aktualisierten Transaktionen mit korrekten Running Balance Werten
          const updatedTransactions = [];
          for (const tx of transactionsToImport) {
            const updatedTx = await tenantDbService.getTransactionById(tx.id);
            if (updatedTx) {
              updatedTransactions.push(updatedTx);
            } else {
              warnLog('CSVImportService', `Transaktion ${tx.id} nicht in DB gefunden für Sync-Queue`);
              // Fallback: verwende die ursprüngliche Transaktion
              updatedTransactions.push(tx);
            }
          }

          // Batch-Erstellung der Sync-Queue-Einträge mit aktualisierten Daten
          await tenantDbService.addTransactionsBatchToSyncQueue(updatedTransactions);

          infoLog('CSVImportService', `${updatedTransactions.length} Sync-Queue-Einträge erfolgreich erstellt`);
        } catch (syncError) {
          errorLog('CSVImportService', 'Fehler beim Erstellen der Sync-Queue-Einträge', {
            error: syncError,
            transactionCount: transactionsToImport.length
          });
          // Sync-Fehler sind nicht kritisch für den Import-Erfolg
          warnLog('CSVImportService', 'Import erfolgreich, aber Sync-Queue-Erstellung fehlgeschlagen');
        }
      }

      // Phase 5: FINALER UI-REFRESH - Nur noch Monatsbilanzen aktualisieren
      infoLog('CSVImportService', 'Führe finalen UI-Refresh durch...');

      try {
        // TransactionStore wurde bereits in Phase 2.5 geladen - nicht nochmal laden
        // Nur noch Monatsbilanzen neu berechnen (kann asynchron erfolgen)
        infoLog('CSVImportService', 'Starte asynchrone Monatsbilanzen-Neuberechnung...');
        BalanceService.calculateAllMonthlyBalances().catch((error: any) => {
          warnLog('CSVImportService', 'Fehler bei asynchroner Monatsbilanzen-Berechnung', error);
        });

        infoLog('CSVImportService', 'Finaler UI-Refresh erfolgreich abgeschlossen');
      } catch (refreshError) {
        warnLog('CSVImportService', 'Fehler beim finalen UI-Refresh - Transaktionen wurden trotzdem erfolgreich importiert', {
          error: refreshError,
          importedCount: importedTransactions.value.length
        });
      }

      infoLog(
        "CSVImportService",
        `${importedTransactions.value.length} Transaktionen erfolgreich importiert.`
      );
      importStatus.value = "success";
      const importedCount = importedTransactions.value.length;

      // NEU: Den Service-Zustand für den nächsten Import zurücksetzen
      reset();

      return importedCount;
    } catch (err) {
      // Stelle sicher, dass die CSV-Import-Optimierungen auch bei Fehlern zurückgesetzt werden
      (TransactionService as any)._skipRunningBalanceRecalc = originalSkipRunningBalanceRecalc;
      (globalThis as any).__FINWISE_BULK_IMPORT_MODE__ = originalBulkImportMode;

      // Verbessertes Error-Logging
      const errorDetails = {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
        cause: err instanceof Error ? (err as any).cause : undefined,
        importedCount: importedTransactions.value.length,
        accountId,
        errorType: typeof err,
        errorConstructor: err?.constructor?.name
      };

      errorLog("CSVImportService", "Import Error", errorDetails);
      importStatus.value = "error";
      error.value = `Fehler beim Import: ${err instanceof Error ? err.message : "Unbekannter Fehler"
        }`;
      throw err;
    }
  }

  /**
   * Berechnet die Zusammenfassung der Importdaten
   */
  const importSummary = computed(() => {
    const total = allParsedData.value.length;
    const selected = allParsedData.value.filter((row) => row._selected).length;
    const ready = allParsedData.value.filter(isRowReadyForImport).length;
    const withRecipient = allParsedData.value.filter(
      (row) => row._selected && row.recipientId
    ).length;
    const withCategory = allParsedData.value.filter(
      (row) => row._selected && row.categoryId
    ).length;
    const potentialDuplicates = allParsedData.value.filter(
      (row) => row._selected && row._potentialMerge
    ).length;

    return {
      total,
      selected,
      ready,
      withRecipient,
      withCategory,
      potentialDuplicates,
    };
  });

  /**
   * Gesamtbetrag der importierten Transaktionen
   */
  const totalAmount = computed(() => {
    return allParsedData.value.filter(isRowReadyForImport).reduce((sum, row) => {
      const amount = parseAmount(row[mappedColumns.value.amount]) || 0;
      return sum + amount;
    }, 0);
  });

  /**
   * Alle Zeilen auswählen oder abwählen
   */
  function toggleAllRows(checked: boolean) {
    allParsedData.value.forEach((row) => {
      row._selected = checked;
    });
  }

  /**
   * Setzt alle Werte zurück für einen neuen Import
   */
  function reset() {
    csvFile.value = null;
    csvData.value = "";
    csvHeaders.value = [];
    allParsedData.value = [];
    mappedColumns.value = {
      date: "",
      amount: "",
      notes: "",
      recipient: "",
      category: ""
    };
    possibleMappings.value = {
      date: [],
      amount: [],
      notes: [],
      recipient: [],
      category: []
    };
    csvParseStatus.value = "idle";
    importStatus.value = "idle";
    error.value = "";
    importedTransactions.value = [];
    selectedTags.value = [];
  }

  /**
   * Aktualisiert eine Notiz in einer bestimmten Zeile
   */
  function updateRowNote(rowIndex: number, newNote: string) {
    if (rowIndex >= 0 && rowIndex < allParsedData.value.length && mappedColumns.value.notes) {
      allParsedData.value[rowIndex][mappedColumns.value.notes] = newNote;
    }
  }

  // Hilfsfunktionen für Matching (Regel-First-Architektur)
  async function performRecipientMatching(recipientName: string): Promise<string | { id: string, name: string } | null> {
    if (!recipientName) return null;

    // Direkter Match (case-insensitive)
    const directMatch = recipientStore.recipients.find(
      r => r.name && r.name.toLowerCase() === recipientName.toLowerCase().trim()
    );

    if (directMatch) {
      debugLog('CSVImportService', `Direkter Empfänger-Match: "${recipientName}" -> ${directMatch.name}`);
      return directMatch;
    }

    // Fuzzy Match (ähnliche Namen)
    const fuzzyMatches = recipientStore.recipients.filter(r => {
      if (!r.name) return false;
      const similarity = calculateStringSimilarity(r.name.toLowerCase(), recipientName.toLowerCase());
      return similarity > 0.8; // 80% Ähnlichkeit
    });

    if (fuzzyMatches.length === 1) {
      debugLog('CSVImportService', `Fuzzy Empfänger-Match: "${recipientName}" -> ${fuzzyMatches[0].name} (${Math.round(calculateStringSimilarity(fuzzyMatches[0].name!.toLowerCase(), recipientName.toLowerCase()) * 100)}%)`);
      return fuzzyMatches[0];
    }

    // Kein Match gefunden - Empfänger muss erstellt werden
    debugLog('CSVImportService', `Kein Empfänger-Match für "${recipientName}" - wird erstellt`);
    return recipientName; // String zurückgeben bedeutet "erstellen"
  }

  async function performCategoryMatching(categoryName: string): Promise<{ id: string, name: string } | null> {
    if (!categoryName) return null;

    // Direkter Match (case-insensitive)
    const directMatch = categoryStore.categories.find(
      c => c.name && c.name.toLowerCase() === categoryName.toLowerCase().trim()
    );

    if (directMatch) {
      debugLog('CSVImportService', `Direkter Kategorie-Match: "${categoryName}" -> ${directMatch.name}`);
      return directMatch;
    }

    // Fuzzy Match (ähnliche Namen)
    const fuzzyMatches = categoryStore.categories.filter(c => {
      if (!c.name) return false;
      const similarity = calculateStringSimilarity(c.name.toLowerCase(), categoryName.toLowerCase());
      return similarity > 0.8; // 80% Ähnlichkeit
    });

    if (fuzzyMatches.length === 1) {
      debugLog('CSVImportService', `Fuzzy Kategorie-Match: "${categoryName}" -> ${fuzzyMatches[0].name} (${Math.round(calculateStringSimilarity(fuzzyMatches[0].name!.toLowerCase(), categoryName.toLowerCase()) * 100)}%)`);
      return fuzzyMatches[0];
    }

    // Kein Match gefunden
    debugLog('CSVImportService', `Kein Kategorie-Match für "${categoryName}"`);
    return null;
  }

  return {
    // State
    csvFile,
    csvData,
    configuration,
    csvParseStatus,
    error,
    importStatus,
    csvHeaders,
    allParsedData,
    mappedColumns,
    possibleMappings,
    importedTransactions,
    selectedTags,

    // Computed
    importSummary,
    totalAmount,

    // Methods
    readCSVFile,
    parseCSV,
    parseDate,
    applyAutoMappingToAllData,
    isRowReadyForImport,
    startImport,
    toggleAllRows,
    reset,
    applyRecipientToSimilarRows,
    applyCategoryToSimilarRows,
    updateRowNote,
    resolveRecipient,
    performRecipientMatching,
    performCategoryMatching,
    findPotentialDuplicates
  };

});
