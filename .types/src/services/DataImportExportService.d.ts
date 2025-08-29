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
 * Service für Import- und Export-Funktionalitäten von FinWise-Daten
 * Unterstützt JSON-Export/Import sowie SQLite-Datenbank-Backup/Restore
 */
export declare class DataImportExportService {
    /**
     * Exportiert Daten als JSON-Datei basierend auf dem angegebenen Datentyp
     * @param dataType - Der Typ der zu exportierenden Daten
     * @throws Error wenn der Export fehlschlägt
     */
    static exportDataAsJSON(dataType: ExportDataType): Promise<void>;
    /**
     * Ruft die Daten basierend auf dem Typ aus den entsprechenden Stores ab
     * Stellt sicher, dass die Daten aus der IndexedDB geladen sind
     * @param dataType - Der Typ der abzurufenden Daten
     * @returns Promise mit den Daten als Array
     * @throws Error bei unbekanntem Datentyp
     */
    private static getDataByType;
    /**
     * Formatiert die Daten in die definierte JSON-Export-Struktur
     * @param dataType - Der Typ der zu formatierenden Daten
     * @param data - Die zu formatierenden Rohdaten
     * @returns Formatierte Export-Datenstruktur mit Metadaten
     */
    private static formatExportData;
    /**
     * Löst den Download der JSON-Datei im Browser aus
     * @param exportData - Die zu downloadenden Export-Daten
     * @param dataType - Der Datentyp für die Dateinamen-Generierung
     */
    private static downloadJSONFile;
    /**
     * Hilfsmethode zur Übersetzung der Datentypen für die UI
     * @param dataType - Der zu übersetzende Datentyp
     * @returns Deutsche Bezeichnung des Datentyps
     */
    static getDataTypeLabel(dataType: ExportDataType): string;
    /**
     * Gibt alle verfügbaren Datentypen für den Export zurück
     * @returns Array mit verfügbaren Datentypen und deren deutschen Labels
     */
    static getAvailableDataTypes(): {
        value: ExportDataType;
        label: string;
    }[];
    /**
     * Importiert Daten aus einer JSON-Datei
     * @param file - Die zu importierende JSON-Datei
     * @param importMode - Der Import-Modus ('replace' oder 'merge')
     * @throws Error wenn der Import fehlschlägt
     */
    static importDataFromJSON(file: File, importMode: ImportMode): Promise<void>;
    /**
     * Liest den Inhalt einer Datei als Text
     * @param file - Die zu lesende Datei
     * @returns Promise mit dem Dateiinhalt als String
     * @throws Error wenn die Datei nicht gelesen werden kann
     */
    private static readFileContent;
    /**
     * Validiert die JSON-Struktur der Import-Daten
     * @param fileContent - Der JSON-String aus der importierten Datei
     * @returns Validierte und geparste Export-Daten
     * @throws Error bei ungültiger JSON-Struktur oder nicht unterstützten Datentypen
     */
    private static validateImportData;
    /**
     * Führt den Import basierend auf dem Modus durch
     * @param importData - Die validierten Import-Daten
     * @param importMode - Der Import-Modus ('replace' oder 'merge')
     * @throws Error wenn der Import für den Datentyp nicht implementiert ist
     */
    private static performImport;
    /**
     * Importiert Regeln in den RuleStore
     * @param data - Array mit Regel-Daten
     * @param importMode - Import-Modus ('replace' oder 'merge')
     */
    private static importRules;
    /**
     * Importiert Kategorien und Lebensbereiche in den CategoryStore
     * @param data - Array mit Kategorie- und Lebensbereiche-Daten
     * @param importMode - Import-Modus ('replace' oder 'merge')
     */
    private static importCategories;
    /**
     * Importiert Empfänger in den RecipientStore
     * @param data - Array mit Empfänger-Daten
     * @param importMode - Import-Modus ('replace' oder 'merge')
     */
    private static importRecipients;
    /**
     * Importiert Tags in den TagStore
     * @param data - Array mit Tag-Daten
     * @param importMode - Import-Modus ('replace' oder 'merge')
     */
    private static importTags;
    /**
     * Importiert Planungstransaktionen in den PlanningStore
     * @param data - Array mit Planungstransaktions-Daten
     * @param importMode - Import-Modus ('replace' oder 'merge')
     */
    private static importPlanning;
    /**
     * Exportiert die aktuelle Mandanten-Datenbank als SQLite-Datei
     * @throws Error wenn der Export fehlschlägt
     */
    static exportTenantDatabase(): Promise<void>;
    /**
     * Importiert eine SQLite-Datenbank als neuen Mandanten
     * @param file - Die zu importierende SQLite-Datei
     * @param tenantName - Name für den neuen Mandanten
     * @throws Error wenn der Import fehlschlägt
     */
    static importTenantDatabase(file: File, tenantName: string): Promise<void>;
}
