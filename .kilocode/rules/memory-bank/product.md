# FinWise: Dein smarter Finanzassistent

## Warum existiert dieses Projekt?

FinWise löst das Problem der ineffizienten und unübersichtlichen Haushaltsfinanzplanung für Privatpersonen. Viele Menschen haben Schwierigkeiten dabei:

- Ihre Finanzen detailliert zu verwalten und zu kategorisieren
- Budgets zu erstellen und einzuhalten
- Ausgaben zu prognostizieren und zu planen
- Ihre Finanzen auch ohne Internetverbindung zu verwalten
- Automatisierte Regeln für wiederkehrende Transaktionen zu nutzen

## Welche Probleme löst es?

### Hauptprobleme:
1. **Fehlende Offline-Funktionalität**: Bestehende Finanzapps erfordern meist eine ständige Internetverbindung
2. **Unzureichende Kategorisierung**: Schwierige oder unflexible Kategorisierung von Ausgaben
3. **Keine Automatisierung**: Manuelle Eingabe wiederkehrender Transaktionen
4. **Fehlende Prognosen**: Keine Vorhersage zukünftiger Kontostände
5. **Komplexe Mandantenverwaltung**: Schwierige Trennung verschiedener Haushalte oder Geschäftsbereiche

### Lösungsansätze:
- **Offline-First-Architektur** mit bidirektionaler Synchronisation
- **Flexible Kategorien und Tags** für detaillierte Ausgabenanalyse
- **Automatische Regeln** für wiederkehrende Transaktionen
- **Kontoprognosen** basierend auf historischen Daten und geplanten Buchungen
- **Multi-Tenant-Architektur** für saubere Datentrennung

## Wie soll es funktionieren?

### Kernfunktionalitäten:

#### 1. Kontoverwaltung
- Hinzufügen, Bearbeiten und Anzeigen von Konten verschiedener Typen (Giro, Spar, Kredit, Bargeld)
- Gruppierung von Konten für bessere Organisation
- Saldo-Tracking mit Kreditlimits und Offsets

#### 2. Budget- und Kategorieverwaltung
- Flexible Kategorienstruktur mit Gruppen
- Budgetplanung pro Kategorie
- Überwachung von geplanten vs. tatsächlichen Ausgaben
- Kategorieübertragungen zwischen Budgets

#### 3. Transaktionsmanagement
- Erfassung aller Ein- und Ausgaben
- Automatische Kategorisierung durch Regeln
- Import von CSV-Dateien
- Verschiedene Transaktionstypen (Ausgaben, Einnahmen, Kontoübertragungen, Kategorieübertragungen)

#### 4. Planungs- und Prognosefunktionen (✅ Vollständig implementiert)
- **Regelbuchungen für wiederkehrende Transaktionen** mit komplexer Recurrence-Engine
- **Kontoprognosen** basierend auf historischen Daten und Planungstransaktionen
- **Verschiedene Wiederholungsmuster** (täglich, wöchentlich, monatlich, quartalsweise, jährlich)
- **Weekend-Handling** mit intelligenter Datumsverschiebung
- **Transfer-Planungen** mit automatischen Gegenbuchungen
- **Auto-Execution** für fällige Planungstransaktionen
- **Approximative Beträge und Bereiche** für flexible Planung
- **Forecast-System** für automatische Prognoseberechnung

#### 5. Automatisierung durch Regeln
- Bedingungsbasierte Regeln für automatische Kategorisierung
- Verschiedene Bedingungstypen (Konto, Empfänger, Betrag, Datum, Beschreibung)
- Aktionen wie Kategorie setzen, Tags hinzufügen, Notizen setzen

#### 6. Offline-Funktionalität
- Vollständige App-Funktionalität ohne Internetverbindung
- Lokale Datenspeicherung in IndexedDB mit Dexie.js
- Sync-Queue für Offline-Änderungen
- Automatische Synchronisation bei Verbindung

## User Experience Ziele

### Benutzerfreundlichkeit:
- **Intuitive Bedienung** mit modernem, responsivem Design
- **Schnelle Dateneingabe** durch intelligente Vorschläge und Automatisierung
- **Klare Visualisierung** von Finanzdaten durch Charts und Übersichten
- **Flexible Navigation** zwischen verschiedenen Ansichten

### Performance:
- **Flüssige Bedienung** sowohl online als auch offline
- **Schnelle Synchronisation** ohne Datenverlust
- **Effiziente Datenverarbeitung** auch bei großen Datenmengen

### Sicherheit:
- **Sichere Authentifizierung** mit Token-basiertem System
- **Datenschutz** durch Mandantentrennung
- **Verschlüsselte Kommunikation** zwischen Frontend und Backend

### Zuverlässigkeit:
- **Robuste Synchronisation** mit Konfliktlösung (Last Write Wins) ✅ Implementiert
- **Sync-Acknowledgment-System** mit ACK/NACK-Nachrichten ✅ Vollständig implementiert
- **Datenintegrität** durch konsistente Validierung ✅ Implementiert
- **Fehlerbehandlung** mit graceful Fallbacks und Retry-Mechanismen ✅ Implementiert

## Zielgruppen

### Primäre Zielgruppe:
- **Privatpersonen** die ihre Haushaltsfinanzen aktiv verwalten möchten
- **Technikaffine Nutzer** die Wert auf Offline-Funktionalität legen
- **Detailorientierte Planer** die umfassende Kategorisierung und Analyse wünschen

### Sekundäre Zielgruppe:
- **Kleine Haushalte/WGs** die gemeinsame Finanzen verwalten
- **Freiberufler** die private und geschäftliche Finanzen trennen möchten
- **Finanzberater** die ihren Kunden ein Tool zur Verfügung stellen möchten

## Erfolgsmetriken

### Technische Metriken:
- **Sync-Zuverlässigkeit**: Erfolgsrate der bidirektionalen Synchronisation
- **Offline-Performance**: App-Responsivität ohne Internetverbindung
- **Datenintegrität**: Konsistenz zwischen Frontend und Backend
- **Fehlerrate**: Anteil fehlgeschlagener Sync-Operationen

### Benutzer-Metriken:
- **Benutzerengagement**: Regelmäßige Nutzung der App (täglich/wöchentlich)
- **Datenqualität**: Vollständigkeit und Genauigkeit der erfassten Transaktionen
- **Offline-Nutzung**: Anteil der Nutzer, die die Offline-Funktionalität aktiv nutzen
- **Automatisierung**: Anteil automatisch kategorisierter Transaktionen
- **Budgeteinhaltung**: Verbesserung der Budgetdisziplin der Nutzer

## Aktueller Implementierungsstand

### ✅ Vollständig implementiert:
- **Account/AccountGroup-Management** mit bidirektionaler Synchronisation
- **Multi-Tenant-Architektur** mit strikter Datentrennung
- **Offline-First-Funktionalität** mit IndexedDB-Persistierung
- **WebSocket-basierte Echtzeit-Updates**
- **Last-Write-Wins Konfliktlösung**
- **Planning-Funktionalität** mit komplexer Recurrence-Engine, Transfer-Handling und Auto-Execution
- **Sync-Acknowledgment-System** mit ACK/NACK-Nachrichten für zuverlässige Queue-Verarbeitung
- **Erweiterte Entitäts-Synchronisation** für Categories, Tags, Recipients, AutomationRules

### 🔄 In aktiver Entwicklung:
- **Planning-Synchronisation** - Integration von PlanningTransactions in WebSocket-Service
- **Transaction-Synchronisation** - Erweitern der bidirektionalen Synchronisation auf Transactions
- **Performance-Optimierungen** - Batch-Operationen und Paginierung für große Datenmengen
- **WebSocket-Reconnection-Optimierung** - Robuste Verbindungswiederherstellung

### 📋 Geplant:
- **Initial Data Load Optimierung** - Effizienter Bulk-Transfer für neue Clients
- **CSV-Import** mit Sync-Integration
- **Erweiterte Statistiken und Reporting**
- **Performance-Monitoring** und Metriken-Dashboard
- **Multi-User-Support** pro Mandant (langfristig)

## Technische Erfolge

### ✅ Problem 1: Inkonsistente Synchronisation (Vollständig gelöst)
- **LWW-Konfliktlösung**: Last-Write-Wins basierend auf updated_at Timestamps
- **Einheitliche Sync-Queue**: Alle Entitäten nutzen konsistente Sync-Patterns
- **Robuste Offline/Online-Synchronisation**: Zuverlässige Datenübertragung

### ✅ Problem 2: Fehlende Sync-Bestätigungen (Vollständig gelöst)
- **ACK/NACK-System**: Vollständige WebSocket-basierte Bestätigungen
- **Automatische Queue-Bereinigung**: Einträge werden nach ACK entfernt
- **Retry-Mechanismen**: Exponential backoff bei NACK-Nachrichten
- **Stuck-Processing-Recovery**: Automatisches Zurücksetzen hängender Einträge

### ✅ Problem 3: Testing-Infrastruktur (Vollständig implementiert)
- **26 Integration Tests**: Vollständige Validierung der Sync-Pipeline
- **Mock-Architektur**: Isolierte Tests ohne Backend-Abhängigkeiten
- **Performance-Validierung**: Latenz, Error-Recovery, Memory-Management

## Nächste Meilensteine

### Kurzfristig (1-2 Wochen):
1. **Planning-WebSocket-Integration finalisieren** - Vollständige Integration in WebSocket-Service
2. **Transaction-Synchronisation implementieren** - Kritisch für Kernfunktionalität
3. **Performance-Optimierungen** - Paginierung und Batch-Operationen

### Mittelfristig (1-2 Monate):
1. **Initial Data Load optimieren** - Effizienter Bulk-Transfer
2. **Monitoring implementieren** - Metriken für Sync-Performance
3. **CSV-Import mit Sync-Integration** - Erweiterte Datenimport-Funktionalität

### Langfristig (3-6 Monate):
1. **Multi-User-Support** - Mehrere Benutzer pro Mandant
2. **Produktionsreife** - Deployment-Pipeline und Monitoring
3. **Erweiterte Features** - Advanced Analytics und Reporting

## Architektonische Stärken

### Offline-First Design:
- **IndexedDB-Integration**: Vollständige lokale Persistierung mit Dexie.js
- **Sync-Queue-System**: Zuverlässige Offline-Änderungsverfolgung
- **Graceful Degradation**: App funktioniert vollständig ohne Internetverbindung

### Skalierbare Architektur:
- **Multi-Tenant-System**: Strikte Datentrennung zwischen Mandanten
- **Event-Driven Sync**: WebSocket-basierte Echtzeit-Updates
- **Modular aufgebaut**: Klare Trennung zwischen UI, Business Logic und Persistierung

### Robuste Synchronisation:
- **Last-Write-Wins**: Einfache aber effektive Konfliktlösung
- **ACK/NACK-System**: Zuverlässige Bestätigung aller Sync-Operationen
- **Retry-Mechanismen**: Exponential backoff verhindert Server-Überlastung

## Qualitätssicherung

### Testing-Strategie:
- **Unit Tests**: Isolierte Tests für einzelne Komponenten
- **Integration Tests**: End-to-End-Tests für kritische Sync-Szenarien
- **Mock-Driven Development**: Vollständige Isolation für zuverlässige Tests
- **Performance-Tests**: Validierung von Latenz und Memory-Management

### Code-Qualität:
- **TypeScript**: Strikte Typisierung für bessere Entwicklererfahrung
- **Self-documenting Code**: Sprechende Methodennamen und klare Strukturen
- **Konsistente Patterns**: Einheitliche Implementierung in allen Stores
- **Umfassende Logging**: Detaillierte Logs für Debugging und Monitoring
