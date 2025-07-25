# PRD: Überarbeitung des Einstellungsdialogs

**Version:** 1.0
**Datum:** 25. Juli 2025
**Autor:** KiloCode AI
**Status:** Draft

## 1. Einführung/Überblick

### Feature
Überarbeitung des Einstellungsdialogs in FinWise zur Vereinfachung der Benutzeroberfläche und Implementierung robuster Import/Export-Funktionen.

### Problem
Der aktuelle Einstellungsdialog (`src/views/SettingsView.vue`) ist überladen mit nicht implementierten Funktionen und es fehlt eine robuste Möglichkeit zum Daten-Backup und zur Wiederherstellung. Benutzer haben keine Möglichkeit, ihre Stammdaten (Kategorien, Regeln, etc.) zwischen Mandanten zu übertragen oder vollständige Backups ihrer Mandantendaten zu erstellen.

### Ziel
Den Dialog an die aktuelle Funktionalität anpassen, ihn vereinfachen und leistungsstarke Import/Export-Funktionen für JSON-Daten und die gesamte Mandanten-Datenbank (SQLite) hinzufügen. Dies verbessert sowohl die Benutzerfreundlichkeit als auch den Entwickler-Workflow durch schnelles Aufsetzen von Test-Mandanten.

## 2. Ziele

### Primäre Ziele
- **UI-Vereinfachung:** Entfernung nicht implementierter Funktionen aus dem Einstellungsdialog
- **JSON Import/Export:** Implementierung einer flexiblen Import/Export-Funktion für Stammdaten
- **SQLite Backup/Restore:** Vollständige Mandanten-Backup- und Wiederherstellungsfunktion
- **Entwickler-Produktivität:** Verbesserung des Workflows durch schnelles Test-Mandanten-Setup

### Sekundäre Ziele
- Verbesserung der Datenportabilität zwischen Mandanten
- Erhöhung der Datensicherheit durch Backup-Möglichkeiten
- Vereinfachung der Benutzeroberfläche für bessere UX

## 3. User Stories

### Als Benutzer
- **US-001:** Als Benutzer möchte ich meine Kategorien und Regeln exportieren, um sie in einem neuen Mandanten schnell wieder importieren zu können.
- **US-002:** Als Benutzer möchte ich eine vollständige Sicherung meiner Mandantendaten (SQLite-Datei) erstellen können, um mich vor Datenverlust zu schützen.
- **US-003:** Als Benutzer möchte ich eine zuvor gesicherte SQLite-Datenbank als neuen, separaten Mandanten wiederherstellen können.
- **US-004:** Als Benutzer möchte ich eine aufgeräumte Einstellungsseite, die nur die tatsächlich verfügbaren Optionen anzeigt.
- **US-005:** Als Benutzer möchte ich beim Import wählen können, ob bestehende Daten ersetzt oder zusammengeführt werden sollen.

### Als Entwickler
- **US-006:** Als Entwickler möchte ich einen neuen Mandanten schnell mit vordefinierten Datensätzen (z.B. aus einer JSON-Datei) für Testzwecke einrichten.

## 4. Funktionale Anforderungen

### 4.1 UI-Anpassungen im Settings-Dialog

#### FR-001: Bereinigung bestehender Einstellungen
- **Beschreibung:** Entfernung aller vorhandenen Einstellungsoptionen **mit Ausnahme** der Log-Level-Auswahl
- **Datei:** `src/views/SettingsView.vue`
- **Details:**
  - Alle nicht implementierten oder veralteten Einstellungsoptionen entfernen
  - Log-Level-Dropdown beibehalten (bereits funktional)

#### FR-002: Entfernung des Logs-Tabs
- **Beschreibung:** Vollständige Entfernung des "Logs"-Tabs und der zugehörigen Änderungshistorie
- **Rationale:** Diese Funktionalität ist nicht implementiert und verwirrt Benutzer

#### FR-003: Neuer Import/Export-Bereich
- **Beschreibung:** Hinzufügung eines neuen Bereichs (Tab oder Sektion) mit dem Titel "Daten Import/Export"
- **Layout:** Klare Trennung zwischen JSON-Import/Export und SQLite-Backup/Restore

### 4.2 JSON Import/Export-Funktionalität

#### FR-004: JSON-Export-Interface
- **Beschreibung:** Dropdown-Menü zur Auswahl der zu exportierenden Datenart mit "Exportieren"-Button
- **Unterstützte Datentypen:**
  - Regeln (AutomationRules)
  - Kategorien (Categories + CategoryGroups)
  - Empfänger (Recipients)
  - Tags
  - Planungen (PlanningTransactions)
- **Ausgabe:** JSON-Datei mit strukturierten Daten zum Download

#### FR-005: JSON-Import-Interface
- **Beschreibung:** Dateiauswahl-Widget für Upload von JSON-Dateien
- **Validierung:**
  - Dateiformat-Validierung (nur .json)
  - Schema-Validierung der JSON-Struktur
  - Fehlerbehandlung bei ungültigen Dateien

#### FR-006: Import-Modus-Auswahl
- **Beschreibung:** Dialog vor Import mit zwei Optionen:
  - **Ersetzen:** Alle bestehenden Daten des Typs löschen und durch Import ersetzen
  - **Zusammenführen:** Neue Daten hinzufügen, bestehende mit gleicher ID ignorieren
- **UI:** Modal-Dialog mit klarer Erklärung der Auswirkungen

### 4.3 SQLite Import/Export-Funktionalität

#### FR-007: SQLite-Export
- **Beschreibung:** Button "Mandanten-Datenbank exportieren" löst Download der SQLite-Datenbank aus
- **Backend-Integration:** API-Endpunkt für Datenbank-Export
- **Dateiname:** `mandant_[mandantenname]_[datum].sqlite`

#### FR-008: SQLite-Import-Interface
- **Beschreibung:**
  - Dateiauswahl für SQLite-Datei (.sqlite, .db)
  - Texteingabefeld für "Neuen Mandantennamen"
  - Upload-Button mit Progress-Anzeige

#### FR-009: SQLite-Import-Verarbeitung
- **Backend-Funktionalität:**
  - Erstellung eines **neuen Mandanten** mit angegebenem Namen
  - Schema-Validierung der hochgeladenen Datenbank
  - Zuordnung des neuen Mandanten zum aktuellen Benutzer
- **Fehlerbehandlung:** Klare Fehlermeldungen bei Schema-Abweichungen

#### FR-010: Import-Warnung
- **Beschreibung:** Deutlicher Hinweis vor Upload, dass diese Aktion einen **neuen, separaten Mandanten** anlegt
- **UI:** Prominent platzierte Warnung mit Bestätigungsdialog

### 4.4 Technische Anforderungen

#### FR-011: Frontend-Implementierung
- **JSON-Funktionalität:** Nutzung bestehender Pinia-Stores und `TenantDbService`
- **Datei-Handling:** Browser-native File API für Up-/Download
- **Error-Handling:** Umfassende Fehlerbehandlung mit Benutzer-Feedback

#### FR-012: Backend-API-Endpunkte
- **Neue Endpunkte erforderlich:**
  - `GET /api/v1/tenant/export-database` - SQLite-Export
  - `POST /api/v1/tenant/import-database` - SQLite-Import
- **Validierung:** Schema-Validierung für importierte Datenbanken
- **Sicherheit:** Authentifizierung und Autorisierung für alle Endpunkte

## 5. Nicht-Ziele (Out of Scope)

### Was NICHT implementiert wird:
- **Änderungshistorie:** Keine Funktion zur Anzeige einer Änderungshistorie
- **Verschlüsselung:** Keine Verschlüsselung der exportierten Dateien
- **Teilweiser Import/Export:** Keine Auswahl spezifischer Datensätze (z.B. nur bestimmte Kategorien)
- **SQLite-Merge:** Kein Zusammenführen von Daten beim SQLite-Import (erzeugt immer neuen Mandanten)
- **Versionierung:** Keine Versionskontrolle für Import/Export-Dateien
- **Automatische Backups:** Keine automatisierten, zeitgesteuerten Backups

## 6. Technische Überlegungen

### 6.1 Frontend-Architektur
- **Hauptdatei:** `src/views/SettingsView.vue` - Zentrale Überarbeitung
- **Store-Integration:** Nutzung bestehender Pinia-Stores für Datenmanipulation
- **Service-Layer:** `TenantDbService` für IndexedDB-Operationen
- **File-Handling:** Browser File API für lokale Datei-Operationen

### 6.2 Backend-Erweiterungen
- **Neue API-Endpunkte:** SQLite Import/Export-Funktionalität
- **Schema-Validierung:** Sicherstellung der Datenbank-Kompatibilität
- **Mandanten-Management:** Erweiterung für Import-basierte Mandanten-Erstellung

### 6.3 Datenformat-Spezifikationen

#### JSON-Export-Format:
```json
{
  "type": "categories|rules|recipients|tags|planning",
  "version": "1.0",
  "exported_at": "2025-07-25T18:39:51.618Z",
  "tenant_id": "uuid",
  "data": [
    // Array der entsprechenden Entitäten
  ]
}
```

#### SQLite-Kompatibilität:
- Schema muss mit aktuellem FinWise-Schema kompatibel sein
- Validierung gegen `app/models/financial_models.py`
- Unterstützung für Schema-Migrations (falls erforderlich)

### 6.4 Performance-Überlegungen
- **Große Dateien:** Progress-Anzeige für Upload/Download
- **Timeout-Handling:** Angemessene Timeouts für große SQLite-Dateien
- **Memory-Management:** Streaming für große Datei-Operationen

## 7. Erfolgsmetriken

### Primäre Metriken:
- **Funktionalität:** 100% erfolgreiche Import/Export-Operationen für alle unterstützten Datentypen
- **Benutzerfreundlichkeit:** Reduzierung der UI-Komplexität um mindestens 70%
- **Datenintegrität:** 0% Datenverlust bei Import/Export-Operationen

### Sekundäre Metriken:
- **Performance:** Upload/Download-Zeiten unter 30 Sekunden für typische Datenmengen
- **Fehlerrate:** Weniger als 5% Fehlerrate bei gültigen Import-Dateien
- **Benutzer-Adoption:** Messbare Nutzung der neuen Import/Export-Features

### Qualitätsmetriken:
- **Error-Handling:** Alle Fehlerzustände haben aussagekräftige Benutzer-Nachrichten
- **Documentation:** Vollständige Dokumentation aller neuen API-Endpunkte

## 8. Offene Fragen

### Technische Fragen:
1. **Timeout-Handling:** Wie soll das Frontend mit möglichen Timeouts beim Upload/Download großer SQLite-Dateien umgehen?
   - *Vorschlag:* Implementierung von Progress-Anzeigen und konfigurierbaren Timeouts

2. **Dateigröße-Limits:** Soll es eine maximale Dateigröße für den Import von SQLite-Dateien geben?
   - *Vorschlag:* 100MB Limit für SQLite-Dateien, 10MB für JSON-Dateien

3. **Schema-Migration:** Wie gehen wir mit älteren SQLite-Dateien um, die ein veraltetes Schema haben?
   - *Vorschlag:* Automatische Schema-Migration oder klare Fehlermeldung

### UX-Fragen:
4. **Bulk-Operations:** Sollen Benutzer mehrere JSON-Dateien gleichzeitig importieren können?
   - *Entscheidung ausstehend*

5. **Preview-Funktionalität:** Sollen Benutzer vor dem Import eine Vorschau der zu importierenden Daten sehen?
   - *Nice-to-have für zukünftige Versionen*

## 9. Implementierungsplan

### Phase 1: UI-Bereinigung (1-2 Tage)
- Entfernung nicht implementierter Einstellungen
- Entfernung des Logs-Tabs
- Grundgerüst für Import/Export-Bereich

### Phase 2: JSON Import/Export (3-4 Tage)
- Export-Funktionalität für alle Datentypen
- Import-Interface mit Modus-Auswahl
- Validierung und Fehlerbehandlung

### Phase 3: Backend SQLite-Endpunkte (2-3 Tage)
- API-Endpunkte für SQLite Export/Import
- Schema-Validierung
- Mandanten-Erstellung bei Import

### Phase 4: Frontend SQLite-Integration (2-3 Tage)
- Upload/Download-Interface
- Progress-Anzeigen
- Integration mit Backend-APIs

### Phase 5: Polishing (1-2 Tage)
- UI/UX-Verbesserungen
- Dokumentation

**Geschätzte Gesamtdauer:** 8-12 Arbeitstage

## 10. Risiken und Mitigation

### Hohe Risiken:
- **Datenverlust bei Import:** *Mitigation:* Umfassende Validierung und Backup-Empfehlungen
- **Performance bei großen Dateien:** *Mitigation:* Streaming und Progress-Anzeigen
- **Schema-Inkompatibilität:** *Mitigation:* Robuste Validierung und klare Fehlermeldungen

### Mittlere Risiken:
- **Browser-Kompatibilität:** *Mitigation:* Testing auf allen unterstützten Browsern
- **Backend-Überlastung:** *Mitigation:* Rate-Limiting und Timeout-Konfiguration

## 11. Abhängigkeiten

### Interne Abhängigkeiten:
- Bestehende Pinia-Stores müssen stabil sein
- `TenantDbService` muss alle CRUD-Operationen unterstützen
- Backend-Authentifizierung muss funktional sein

### Externe Abhängigkeiten:
- Browser File API-Unterstützung
- SQLite-Kompatibilität zwischen verschiedenen Versionen

## 12. Akzeptanzkriterien

### Must-Have:
- [ ] Einstellungsdialog ist auf wesentliche Funktionen reduziert
- [ ] JSON-Export funktioniert für alle 5 Datentypen
- [ ] JSON-Import mit Ersetzen/Zusammenführen-Option
- [ ] SQLite-Export lädt korrekte Mandanten-Datenbank herunter
- [ ] SQLite-Import erstellt neuen Mandanten mit importierten Daten
- [ ] Alle Fehlerzustände haben aussagekräftige Nachrichten

### Should-Have:
- [ ] Progress-Anzeigen für große Datei-Operationen
- [ ] Validierung aller Import-Dateien vor Verarbeitung
- [ ] Benutzer-Warnungen vor kritischen Operationen

### Could-Have:
- [ ] Batch-Import mehrerer JSON-Dateien
- [ ] Preview-Funktionalität für Import-Daten
- [ ] Export-History für nachvollziehbare Backups

---

**Abschließende Notiz:** Diese PRD dient als Grundlage für die Implementierung der Einstellungsdialog-Überarbeitung. Alle Anforderungen sind so formuliert, dass sie von einem Junior-Entwickler verstanden und umgesetzt werden können. Bei Unklarheiten oder Änderungswünschen sollte diese PRD entsprechend aktualisiert werden.
