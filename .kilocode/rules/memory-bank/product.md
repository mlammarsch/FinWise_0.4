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
- **Sync-Acknowledgment-System** mit ACK/NACK-Nachrichten 🔄 In Entwicklung
- **Datenintegrität** durch konsistente Validierung ✅ Implementiert
- **Fehlerbehandlung** mit graceful Fallbacks und Retry-Mechanismen 🔄 In Entwicklung

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
- **Testing-Infrastruktur** mit umfassenden Integration Tests

### 🔄 In aktiver Entwicklung:
- **Sync-Acknowledgment-System** für zuverlässige Queue-Verarbeitung
- **Planning-Synchronisation** - Integration von PlanningTransactions in Sync-System
- **Erweiterte Fehlerbehandlung** mit Retry-Mechanismen
- **WebSocket-Reconnection-Optimierung**

### 📋 Geplant:
- **Transaction-Synchronisation** (höchste Priorität nach Planning-Sync)
- **Category/CategoryGroup-Synchronisation**
- **Automatisierungsregeln** mit Synchronisation
- **CSV-Import** mit Sync-Integration
- **Erweiterte Statistiken und Reporting**
