# Taskliste: Settings-Dialog Rework

**Basiert auf:** `tasks/prd-settings-dialog-rework.md`
**Erstellt am:** 25. Juli 2025
**Status:** Phase 2 - Vollständige Taskliste

## Tasks

- [ ] 1.0 UI-Bereinigung und Grundstruktur
  - [ ] 1.1 Entfernung aller nicht implementierten Einstellungsoptionen aus SettingsView.vue (außer Log-Level)
  - [ ] 1.2 Vollständige Entfernung des "Logs"-Tabs und zugehöriger Komponenten
  - [ ] 1.3 Erstellung der neuen Import/Export-Sektion als separaten Tab/Bereich
  - [ ] 1.4 Grundgerüst für ImportExportSection.vue-Komponente erstellen
  - [ ] 1.5 Layout-Struktur für klare Trennung zwischen JSON- und SQLite-Funktionen

- [ ] 2.0 JSON Import/Export-Funktionalität
  - [ ] 2.1 JsonImportExport.vue-Komponente mit Export-Dropdown erstellen
  - [ ] 2.2 Export-Funktionalität für alle 5 Datentypen implementieren (Rules, Categories, Recipients, Tags, Planning)
  - [ ] 2.3 JSON-Import-Interface mit Dateiauswahl-Widget erstellen
  - [ ] 2.4 Import-Modus-Dialog (Ersetzen/Zusammenführen) implementieren
  - [ ] 2.5 JSON-Schema-Validierung für Import-Dateien implementieren
  - [ ] 2.6 ImportExportService.ts für Geschäftslogik erstellen
  - [ ] 2.7 Integration mit bestehenden Pinia-Stores für Datenmanipulation
  - [ ] 2.8 Fehlerbehandlung und Benutzer-Feedback für JSON-Operationen

- [ ] 3.0 Backend SQLite-Endpunkte
  - [ ] 3.1 API-Endpunkt GET /api/v1/tenant/export-database implementieren
  - [ ] 3.2 API-Endpunkt POST /api/v1/tenant/import-database implementieren
  - [ ] 3.3 DatabaseExportService.py für SQLite-Export-Logik erstellen
  - [ ] 3.4 DatabaseImportService.py für SQLite-Import und Schema-Validierung erstellen
  - [ ] 3.5 Pydantic-Schemas für Import/Export-Requests/Responses definieren
  - [ ] 3.6 Mandanten-Erstellung bei SQLite-Import implementieren
  - [ ] 3.7 Authentifizierung und Autorisierung für neue Endpunkte sicherstellen
  - [ ] 3.8 Fehlerbehandlung und Logging für Backend-Operationen

- [ ] 4.0 Frontend SQLite-Integration
  - [ ] 4.1 SqliteImportExport.vue-Komponente erstellen
  - [ ] 4.2 SQLite-Export-Button mit Download-Funktionalität implementieren
  - [ ] 4.3 SQLite-Import-Interface mit Dateiauswahl und Mandantenname-Eingabe
  - [ ] 4.4 FileHandlingService.ts für Upload/Download-Operationen erstellen
  - [ ] 4.5 Progress-Anzeigen für große Datei-Operationen implementieren
  - [ ] 4.6 Integration mit Backend-APIs für SQLite-Operationen
  - [ ] 4.7 Import-Warnung und Bestätigungsdialog vor SQLite-Upload
  - [ ] 4.8 Timeout-Handling für große Datei-Operationen
