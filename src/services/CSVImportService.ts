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
import { TransactionType, EntityTypeEnum, SyncOperationType } from "@/types";
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
      error.value = `Fehler beim Parsen der CSV-Datei: ${
        err instanceof Error ? err.message : "Unbekannter Fehler"
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

    // Erste Zeile für Analyse der Datentypen verwenden
    const firstRow = allParsedData.value[0];

    csvHeaders.value.forEach((header) => {
      const value = firstRow[header].toString().trim();

      // Datum erkennen (unterschiedliche Formate)
      if (
        /^\d{4}[-/\.]\d{1,2}[-/\.]\d{1,2}$/.test(value) || // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
        /^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{4}$/.test(value) || // DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
        /^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2}$/.test(value) // DD-MM-YY, DD/MM/YY, DD.MM.YY
      ) {
        possibleMappings.value.date.push(header);
      }

      // Betrag erkennen
      if (/^-?\d+([,\.]\d+)?$/.test(value)) {
        possibleMappings.value.amount.push(header);
      }

      // Empfänger erkennen (Heuristik: längere Texte, normalerweise unter 60 Zeichen)
      if (
        value.length > 0 &&
        value.length < 60 &&
        !/^\d+([,\.]\d+)?$/.test(value) &&
        !/^\d{1,2}[-/\.]\d{1,2}/.test(value)
      ) {
        possibleMappings.value.recipient.push(header);
      }

      // Kategorie erkennen (ähnlich wie Empfänger, aber tendenziell kürzer)
      if (
        value.length > 0 &&
        value.length < 30 &&
        !/^\d+([,\.]\d+)?$/.test(value) &&
        !/^\d{1,2}[-/\.]\d{1,2}/.test(value)
      ) {
        possibleMappings.value.category.push(header);
      }

      // Notizen erkennen (tendenziell längere Texte)
      if (
        value.length > 0 &&
        !/^\d+([,\.]\d+)?$/.test(value) &&
        !/^\d{1,2}[-/\.]\d{1,2}/.test(value)
      ) {
        possibleMappings.value.notes.push(header);
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
            h.toLowerCase().includes("verwendungszweck") ||
            h.toLowerCase().includes("buchungstext") ||
            h.toLowerCase().includes("beschreibung") ||
            h.toLowerCase().includes("description") ||
            h.toLowerCase().includes("bemerkung")
        ) || possibleMappings.value.notes[0];

      mappedColumns.value.notes = notesHeader;
    }

    // Automatisches Mapping für Kategorie (niedrigste Priorität, oft nicht in Bankdaten)
    if (possibleMappings.value.category.length > 0) {
      const categoryHeader =
        possibleMappings.value.category.find(
          (h) =>
            h.toLowerCase().includes("kategorie") ||
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
      // 1. Empfängererkennung
      if (mappedColumns.value.recipient) {
        const recipientText = row[mappedColumns.value.recipient];
        if (recipientText) {
          findMatchingRecipient(row, recipientText);
        }
      }

      // Zusätzlich in Notizen nach Empfängern suchen
      if (mappedColumns.value.notes) {
        const notesText = row[mappedColumns.value.notes];
        if (notesText) {
          findMatchingRecipient(row, notesText);
        }
      }

      // 2. Kategorieerkennung
      if (mappedColumns.value.category) {
        const categoryText = row[mappedColumns.value.category];
        if (categoryText) {
          findMatchingCategory(row, categoryText);
        }
      }
    });

    // Identifiziere potenzielle Duplikate
    identifyPotentialMerges();
  }

  /**
   * Findet passende Empfänger für einen Text und speichert die Übereinstimmungen
   * Erweiterte Logik für korrekte recipientId-Zuordnung gemäß Task 4.1
   */
  function findMatchingRecipient(row: ImportRow, searchText: string) {
    if (!searchText) return;

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

        // Ungefähr gleicher Betrag (Toleranz von 0.01)
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

      otherRow.categoryId = categoryId;
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
        // Task 4.1: Setze payee-Feld wenn keine recipientId gefunden wurde
        payee: !row.recipientId && mappedColumns.value.recipient ? row[mappedColumns.value.recipient] : undefined,
        // Speichere den Original-Empfängernamen für weitere Verarbeitung
        originalRecipientName: mappedColumns.value.recipient ? row[mappedColumns.value.recipient] : null
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

      // BATCH-VERARBEITUNG: Erst alle Empfänger erstellen, dann alle Transaktionen auf einmal
      const transactionsToImport = [];

      // Phase 1: Empfänger-Verarbeitung (sequenziell, da neue Empfänger erstellt werden können)
      for (const item of preparedData) {
        // Empfängerzuordnung auflösen
        const recipientResult = resolveRecipient(item);

        // Empfänger zuweisen oder erstellen
        if (recipientResult) {
          if (typeof recipientResult === 'string') {
            // Neuer Empfänger erstellen, falls noch nicht vorhanden
            const recipientName = recipientResult;
            const lowerName = (recipientName || '').toLowerCase();

            if (createdRecipients.has(lowerName)) {
              const recipientId = createdRecipients.get(lowerName);
              if (recipientId) {
                item.recipientId = recipientId;
                debugLog("CSVImportService", `Verwende bereits erstellten Empfänger: ${recipientName}`, JSON.stringify({ id: item.recipientId }));
              }
            } else {
              // Neuen Empfänger erstellen
              const newRecipient = await recipientStore.addRecipient({ name: recipientName });
              item.recipientId = newRecipient.id;
              createdRecipients.set(lowerName, newRecipient.id);
              infoLog("CSVImportService", `Neuer Empfänger erstellt: ${recipientName} (${newRecipient.id})`);
            }
          } else {
            // Verwende existierenden Empfänger (bereits als Objekt zurückgegeben)
            item.recipientId = recipientResult.id;
          }
        }

        // Bestimme Transaktionstyp basierend auf Betrag
        const txType: TransactionType = item.amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;

        // Transaktion für Batch-Import vorbereiten (manuell erstellen)
        const transactionData = {
          id: crypto.randomUUID(),
          date: item.date,
          valueDate: item.valueDate,
          accountId: item.accountId,
          categoryId: item.categoryId,
          tagIds: item.tagIds,
          amount: item.amount,
          note: item.note,
          description: item.note, // Using note as description
          recipientId: item.recipientId || undefined,
          type: txType,
          counterTransactionId: null,
          planningTransactionId: null,
          isReconciliation: false,
          runningBalance: 0, // Wird später berechnet
          reconciled: false,
          isCategoryTransfer: false,
          transferToAccountId: null,
          toCategoryId: undefined,
          payee: item.payee || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        transactionsToImport.push(transactionData);

        // Für UI-Anzeige vorbereiten
        importedTransactions.value.push({
          ...transactionData,
          recipientName: item.recipientId
            ? recipientStore.getRecipientById(item.recipientId)?.name
            : "",
          categoryName: item.categoryId
            ? categoryStore.getCategoryById(item.categoryId)?.name
            : "",
          accountName: accountStore.getAccountById(item.accountId)?.name || "",
        });
      }

      // Phase 1.5: PRE + DEFAULT STAGE REGELN ANWENDEN vor dem Batch-Import
      if (transactionsToImport.length > 0) {
        infoLog('CSVImportService', `Applying PRE and DEFAULT stage rules to ${transactionsToImport.length} transactions before import`);
        try {
          // Wende PRE und DEFAULT Stage Regeln auf alle Transaktionen an
          const processedTransactions = await TransactionService.applyPreAndDefaultRulesToTransactions(transactionsToImport);

          // Ersetze die ursprünglichen Transaktionen mit den verarbeiteten
          transactionsToImport.length = 0; // Array leeren
          transactionsToImport.push(...processedTransactions);

          infoLog('CSVImportService', `PRE and DEFAULT stage rules applied successfully to ${transactionsToImport.length} transactions`);
        } catch (ruleError) {
          warnLog('CSVImportService', 'Error applying PRE and DEFAULT stage rules, continuing with original transactions', ruleError);
        }
      }

      // Phase 2: BATCH-IMPORT aller Transaktionen
      if (transactionsToImport.length > 0) {
        try {
          // Batch-Import über TenantDbService für bessere Performance
          await tenantDbService.addTransactionsBatch(transactionsToImport);

          // Sync-Queue-Einträge werden NACH der Running Balance Neuberechnung erstellt
          // (siehe addTransactionsBatchToSyncQueue nach der Neuberechnung)

          infoLog('CSVImportService', `Batch-Import erfolgreich: ${transactionsToImport.length} Transaktionen importiert`, {
            accountId,
            batchSize: transactionsToImport.length
          });

        } catch (batchError) {
          errorLog('CSVImportService', `Fehler beim Batch-Import der Transaktionen`, {
            batchSize: transactionsToImport.length,
            accountId,
            error: batchError
          });

          // Fallback: Versuche einzelne Transaktionen zu importieren
          warnLog('CSVImportService', 'Fallback auf einzelne Transaktions-Imports');

          // Lösche die bereits vorbereiteten UI-Daten
          importedTransactions.value = [];

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
      const affectedAccountIds = [...new Set(
        importedTransactions.value.map((tx: any) => tx.accountId).filter(Boolean)
      )];

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

      // Sequenzielle Neuberechnung für alle betroffenen Konten
      for (const accountId of affectedAccountIds) {
        try {
          // Verwende das älteste Importdatum für optimierte Neuberechnung
          await BalanceService.recalculateRunningBalancesForAccount(accountId, oldestImportDate);
          debugLog('CSVImportService', `Running Balance für Konto ${accountId} neu berechnet`, {
            fromDate: oldestImportDate?.toISOString().split('T')[0] || 'alle Transaktionen'
          });
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
        BalanceService.calculateMonthlyBalances().catch(error => {
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
      return importedTransactions.value.length;
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
      error.value = `Fehler beim Import: ${
        err instanceof Error ? err.message : "Unbekannter Fehler"
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
    resolveRecipient
  };
});
