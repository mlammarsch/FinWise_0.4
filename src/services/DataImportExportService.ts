import { useRuleStore } from '@/stores/ruleStore';
import { useCategoryStore } from '@/stores/categoryStore';
import { useRecipientStore } from '@/stores/recipientStore';
import { useTagStore } from '@/stores/tagStore';
import { usePlanningStore } from '@/stores/planningStore';
import { TenantDbService } from '@/services/TenantDbService';
import { debugLog, infoLog, errorLog } from '@/utils/logger';
import { apiService } from '@/services/apiService';

/**
 * Verfügbare Datentypen für Export/Import-Operationen
 */
export type ExportDataType = 'rules' | 'categories' | 'recipients' | 'tags' | 'planning';

/**
 * Import-Modi für die Datenverarbeitung
 * - 'replace': Ersetzt alle bestehenden Daten durch importierte Daten
 * - 'merge': Fügt neue Daten hinzu, behält bestehende bei
 */
export type ImportMode = 'replace' | 'merge';

/**
 * Metadaten-Interface für Export-Dateien
 */
interface ExportMetadata {
  type: ExportDataType;
  version: string;
  exported_at: string;
  tenant_id: string;
}

/**
 * Vollständige Export-Datenstruktur
 */
interface ExportData {
  type: ExportDataType;
  version: string;
  exported_at: string;
  tenant_id: string;
  data: any[];
}

/**
 * Service für Import- und Export-Funktionalitäten von FinWise-Daten
 * Unterstützt JSON-Export/Import sowie SQLite-Datenbank-Backup/Restore
 */
export class DataImportExportService {

  /**
   * Exportiert Daten als JSON-Datei basierend auf dem angegebenen Datentyp
   * @param dataType - Der Typ der zu exportierenden Daten
   * @throws Error wenn der Export fehlschlägt
   */
  static async exportDataAsJSON(dataType: ExportDataType): Promise<void> {
    try {
      debugLog('DataImportExportService', `Starte JSON-Export für Typ: ${dataType}`);

      const data = await this.getDataByType(dataType);
      const exportData = this.formatExportData(dataType, data);

      this.downloadJSONFile(exportData, dataType);

      infoLog('DataImportExportService', `JSON-Export für ${dataType} erfolgreich abgeschlossen`);
    } catch (error) {
      errorLog('DataImportExportService', `Fehler beim JSON-Export für ${dataType}`, error);
      throw error;
    }
  }

  /**
   * Ruft die Daten basierend auf dem Typ aus den entsprechenden Stores ab
   * Stellt sicher, dass die Daten aus der IndexedDB geladen sind
   * @param dataType - Der Typ der abzurufenden Daten
   * @returns Promise mit den Daten als Array
   * @throws Error bei unbekanntem Datentyp
   */
  private static async getDataByType(dataType: ExportDataType): Promise<any[]> {
    switch (dataType) {
      case 'rules':
        const ruleStore = useRuleStore();
        await ruleStore.loadRules();
        return ruleStore.rules;

      case 'categories':
        const categoryStore = useCategoryStore();
        await categoryStore.loadCategories();
        return [
          ...categoryStore.categories,
          ...categoryStore.categoryGroups
        ];

      case 'recipients':
        const recipientStore = useRecipientStore();
        await recipientStore.loadRecipients();
        return recipientStore.recipients;

      case 'tags':
        const tagStore = useTagStore();
        await tagStore.loadTags();
        return tagStore.tags;

      case 'planning':
        const planningStore = usePlanningStore();
        await planningStore.loadPlanningTransactions();
        return planningStore.planningTransactions;

      default:
        throw new Error(`Unbekannter Datentyp: ${dataType}`);
    }
  }

  /**
   * Formatiert die Daten in die definierte JSON-Export-Struktur
   * @param dataType - Der Typ der zu formatierenden Daten
   * @param data - Die zu formatierenden Rohdaten
   * @returns Formatierte Export-Datenstruktur mit Metadaten
   */
  private static formatExportData(dataType: ExportDataType, data: any): ExportData {
    // TODO: tenant_id sollte aus dem aktuellen Kontext geholt werden
    const tenantId = 'current-tenant';

    return {
      type: dataType,
      version: '1.0',
      exported_at: new Date().toISOString(),
      tenant_id: tenantId,
      data: Array.isArray(data) ? data : [data]
    };
  }

  /**
   * Löst den Download der JSON-Datei im Browser aus
   * @param exportData - Die zu downloadenden Export-Daten
   * @param dataType - Der Datentyp für die Dateinamen-Generierung
   */
  private static downloadJSONFile(exportData: ExportData, dataType: ExportDataType): void {
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD Format
    const filename = `finwise_export_${dataType}_${timestamp}.json`;

    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    debugLog('DataImportExportService', `JSON-Datei heruntergeladen: ${filename}`);
  }

  /**
   * Hilfsmethode zur Übersetzung der Datentypen für die UI
   * @param dataType - Der zu übersetzende Datentyp
   * @returns Deutsche Bezeichnung des Datentyps
   */
  static getDataTypeLabel(dataType: ExportDataType): string {
    const labels: Record<ExportDataType, string> = {
      'rules': 'Regeln',
      'categories': 'Kategorien',
      'recipients': 'Empfänger',
      'tags': 'Tags',
      'planning': 'Planungen'
    };

    return labels[dataType] || dataType;
  }

  /**
   * Gibt alle verfügbaren Datentypen für den Export zurück
   * @returns Array mit verfügbaren Datentypen und deren deutschen Labels
   */
  static getAvailableDataTypes(): { value: ExportDataType; label: string }[] {
    const dataTypes: ExportDataType[] = ['rules', 'categories', 'recipients', 'tags', 'planning'];

    return dataTypes.map(type => ({
      value: type,
      label: this.getDataTypeLabel(type)
    }));
  }

  /**
   * Importiert Daten aus einer JSON-Datei
   * @param file - Die zu importierende JSON-Datei
   * @param importMode - Der Import-Modus ('replace' oder 'merge')
   * @throws Error wenn der Import fehlschlägt
   */
  static async importDataFromJSON(file: File, importMode: ImportMode): Promise<void> {
    try {
      debugLog('DataImportExportService', `Starte JSON-Import im ${importMode}-Modus`);

      // Datei lesen
      const fileContent = await this.readFileContent(file);

      // JSON validieren
      const importData = this.validateImportData(fileContent);

      // Import durchführen
      await this.performImport(importData, importMode);

      infoLog('DataImportExportService', `JSON-Import für ${importData.type} erfolgreich abgeschlossen`);
    } catch (error) {
      errorLog('DataImportExportService', 'Fehler beim JSON-Import', error);
      throw error;
    }
  }

  /**
   * Liest den Inhalt einer Datei als Text
   * @param file - Die zu lesende Datei
   * @returns Promise mit dem Dateiinhalt als String
   * @throws Error wenn die Datei nicht gelesen werden kann
   */
  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('Datei konnte nicht gelesen werden'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Fehler beim Lesen der Datei'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Validiert die JSON-Struktur der Import-Daten
   * @param fileContent - Der JSON-String aus der importierten Datei
   * @returns Validierte und geparste Export-Daten
   * @throws Error bei ungültiger JSON-Struktur oder nicht unterstützten Datentypen
   */
  private static validateImportData(fileContent: string): ExportData {
    let parsedData: any;

    try {
      parsedData = JSON.parse(fileContent);
    } catch (error) {
      throw new Error('Ungültige JSON-Datei: Die Datei enthält kein gültiges JSON-Format');
    }

    // Prüfe erforderliche Felder
    if (!parsedData.type) {
      throw new Error('Ungültige JSON-Struktur: Feld "type" fehlt');
    }

    if (!parsedData.version) {
      throw new Error('Ungültige JSON-Struktur: Feld "version" fehlt');
    }

    if (!parsedData.data || !Array.isArray(parsedData.data)) {
      throw new Error('Ungültige JSON-Struktur: Feld "data" fehlt oder ist kein Array');
    }

    // Prüfe ob der Datentyp unterstützt wird
    const supportedTypes: ExportDataType[] = ['rules', 'categories', 'recipients', 'tags', 'planning'];
    if (!supportedTypes.includes(parsedData.type)) {
      throw new Error(`Nicht unterstützter Datentyp: ${parsedData.type}`);
    }

    return parsedData as ExportData;
  }

  /**
   * Führt den Import basierend auf dem Modus durch
   * @param importData - Die validierten Import-Daten
   * @param importMode - Der Import-Modus ('replace' oder 'merge')
   * @throws Error wenn der Import für den Datentyp nicht implementiert ist
   */
  private static async performImport(importData: ExportData, importMode: ImportMode): Promise<void> {
    switch (importData.type) {
      case 'rules':
        await this.importRules(importData.data, importMode);
        break;
      case 'categories':
        await this.importCategories(importData.data, importMode);
        break;
      case 'recipients':
        await this.importRecipients(importData.data, importMode);
        break;
      case 'tags':
        await this.importTags(importData.data, importMode);
        break;
      case 'planning':
        await this.importPlanning(importData.data, importMode);
        break;
      default:
        throw new Error(`Import für Datentyp ${importData.type} nicht implementiert`);
    }
  }

  /**
   * Importiert Regeln in den RuleStore
   * @param data - Array mit Regel-Daten
   * @param importMode - Import-Modus ('replace' oder 'merge')
   */
  private static async importRules(data: any[], importMode: ImportMode): Promise<void> {
    const ruleStore = useRuleStore();

    if (importMode === 'replace') {
      // Alle bestehenden Regeln löschen und neue hinzufügen
      await ruleStore.reset();
      for (const rule of data) {
        await ruleStore.addRule(rule);
      }
    } else {
      // Merge-Modus: Nur neue Einträge hinzufügen (Duplikate anhand ID vermeiden)
      const existingIds = new Set(ruleStore.rules.map(r => r.id));
      for (const rule of data) {
        if (!existingIds.has(rule.id)) {
          await ruleStore.addRule(rule);
        }
      }
    }
  }

  /**
   * Importiert Kategorien und Lebensbereiche in den CategoryStore
   * @param data - Array mit Kategorie- und Lebensbereiche-Daten
   * @param importMode - Import-Modus ('replace' oder 'merge')
   */
  private static async importCategories(data: any[], importMode: ImportMode): Promise<void> {
    const categoryStore = useCategoryStore();

    if (importMode === 'replace') {
      // Reset und neue hinzufügen
      await categoryStore.reset();
      for (const item of data) {
        if (item.categoryGroupId !== undefined) {
          // Es ist eine Kategorie (hat categoryGroupId)
          await categoryStore.addCategory(item);
        } else {
          // Es ist eine Kategoriengruppe (hat keine categoryGroupId)
          await categoryStore.addCategoryGroup(item);
        }
      }
    } else {
      // Merge-Modus: Duplikate anhand ID vermeiden
      const existingCategoryIds = new Set(categoryStore.categories.map(c => c.id));
      const existingGroupIds = new Set(categoryStore.categoryGroups.map(g => g.id));

      for (const item of data) {
        if (item.categoryGroupId !== undefined) {
          // Es ist eine Kategorie
          if (!existingCategoryIds.has(item.id)) {
            await categoryStore.addCategory(item);
          }
        } else {
          // Es ist eine Kategoriengruppe
          if (!existingGroupIds.has(item.id)) {
            await categoryStore.addCategoryGroup(item);
          }
        }
      }
    }
  }

  /**
   * Importiert Empfänger in den RecipientStore
   * @param data - Array mit Empfänger-Daten
   * @param importMode - Import-Modus ('replace' oder 'merge')
   */
  private static async importRecipients(data: any[], importMode: ImportMode): Promise<void> {
    const recipientStore = useRecipientStore();

    if (importMode === 'replace') {
      await recipientStore.reset();
      for (const recipient of data) {
        await recipientStore.addRecipient(recipient);
      }
    } else {
      // Merge-Modus: Duplikate anhand ID vermeiden
      const existingIds = new Set(recipientStore.recipients.map(r => r.id));
      for (const recipient of data) {
        if (!existingIds.has(recipient.id)) {
          await recipientStore.addRecipient(recipient);
        }
      }
    }
  }

  /**
   * Importiert Tags in den TagStore
   * @param data - Array mit Tag-Daten
   * @param importMode - Import-Modus ('replace' oder 'merge')
   */
  private static async importTags(data: any[], importMode: ImportMode): Promise<void> {
    const tagStore = useTagStore();

    if (importMode === 'replace') {
      await tagStore.reset();
      for (const tag of data) {
        await tagStore.addTag(tag);
      }
    } else {
      // Merge-Modus: Duplikate anhand ID vermeiden
      const existingIds = new Set(tagStore.tags.map(t => t.id));
      for (const tag of data) {
        if (!existingIds.has(tag.id)) {
          await tagStore.addTag(tag);
        }
      }
    }
  }

  /**
   * Importiert Planungstransaktionen in den PlanningStore
   * @param data - Array mit Planungstransaktions-Daten
   * @param importMode - Import-Modus ('replace' oder 'merge')
   */
  private static async importPlanning(data: any[], importMode: ImportMode): Promise<void> {
    const planningStore = usePlanningStore();

    if (importMode === 'replace') {
      await planningStore.reset();
      for (const planning of data) {
        await planningStore.addPlanningTransaction(planning);
      }
    } else {
      // Merge-Modus: Duplikate anhand ID vermeiden
      const existingIds = new Set(planningStore.planningTransactions.map(p => p.id));
      for (const planning of data) {
        if (!existingIds.has(planning.id)) {
          await planningStore.addPlanningTransaction(planning);
        }
      }
    }
  }

  /**
   * Exportiert die aktuelle Mandanten-Datenbank als SQLite-Datei
   * @throws Error wenn der Export fehlschlägt
   */
  static async exportTenantDatabase(): Promise<void> {
    try {
      debugLog('DataImportExportService', 'Starte SQLite-Datenbank-Export');

      // TenantId aus sessionStore holen
      const { useSessionStore } = await import('@/stores/sessionStore');
      const sessionStore = useSessionStore();
      const tenantId = sessionStore.currentTenantId;

      if (!tenantId) {
        throw new Error('Keine aktive Tenant-Session gefunden');
      }

      debugLog('DataImportExportService', `Export für Tenant: ${tenantId}`);

      // API-Aufruf zum Backend für Datenbank-Export mit TenantId als Parameter
      const arrayBuffer = await apiService.downloadFile(`/api/v1/tenant/export-database?tenant_id=${tenantId}`);

      // Blob als Datei herunterladen
      const blob = new Blob([arrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD Format
      const filename = `finwise_tenant_backup_${timestamp}.sqlite`;

      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      infoLog('DataImportExportService', `SQLite-Datenbank erfolgreich exportiert: ${filename}`);
    } catch (error) {
      errorLog('DataImportExportService', 'Fehler beim SQLite-Datenbank-Export', error);
      throw error;
    }
  }

  /**
   * Importiert eine SQLite-Datenbank als neuen Mandanten
   * @param file - Die zu importierende SQLite-Datei
   * @param tenantName - Name für den neuen Mandanten
   * @throws Error wenn der Import fehlschlägt
   */
  static async importTenantDatabase(file: File, tenantName: string): Promise<void> {
    try {
      debugLog('DataImportExportService', `Starte SQLite-Import für Mandant: ${tenantName}`);

      // FormData für Datei-Upload erstellen
      const formData = new FormData();
      formData.append('database_file', file);
      formData.append('new_tenant_name', tenantName);

      // API-Aufruf zum Backend für Datenbank-Import
      await apiService.post('/api/v1/tenant/import-database', formData);

      infoLog('DataImportExportService', `SQLite-Import erfolgreich abgeschlossen für Mandant: ${tenantName}`);
    } catch (error) {
      errorLog('DataImportExportService', 'Fehler beim SQLite-Import', error);
      throw error;
    }
  }
}
