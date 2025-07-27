# FinWise - Aktueller Kontext

## Aktueller Entwicklungsstand

### Projektphase
**Status**: Aktive Entwicklung - IndexedDB-Migration abgeschlossen, Sync-Optimierung im Fokus

### Letzte größere Änderungen
- **IndexedDB-Migration**: Vollständige Migration aller Pinia-Stores von localStorage zu IndexedDB abgeschlossen
- **CSV-Import Reparatur**: Empfängerzuordnung beim CSV-Import funktioniert wieder korrekt
- **Sync-System**: ACK/NACK-Protokoll über WebSockets implementiert

## Aktuelle Arbeitsgebiete

### 1. Synchronisationsprobleme bei großen Datenmengen
**Status**: 🔴 Kritisches Problem erkannt
- **Problem**: Bei CSV-Importen mit ~30-40 Buchungen und Empfängern wird die Offline-Synchronisation nicht vollständig durchgeführt
- **Hypothesen**:
  - IndexedDB-Transaktionen brechen bei zu vielen gleichzeitigen Writes ab
  - Sync-Queue-Prozess läuft nicht stabil durch
  - WebSocket-Service reagiert mit Abbrüchen oder Timeouts
- **Nächste Schritte**: Logs analysieren, Chunking des Imports testen, WebSocket-Verhalten beobachten

### 2. Regelanwendung nach CSV-Import
**Status**: ⚠️ Noch nicht geprüft
- **Risiko**: Importierte Daten könnten nicht automatisch mit bestehenden Regeln abgeglichen werden
- **To-do**: Regelprüfung aktivieren und korrekte Anwendung auf neue Buchungen testen

### 3. Feldverwendung Recipient vs. Payee
**Status**: 🟡 Anpassung umgesetzt, finale Prüfung ausstehend
- **Änderung**: Einheitliche Verwendung von `recipientId` statt gemischter Felder
- **To-do**: Backend- und Frontend-Felder systematisch auf konsistente Referenzierung prüfen

## Technischer Zustand

### Vollständig Implementiert ✅
- **IndexedDB-Integration**: Alle Stores (Transaction, Recipient, Tag, Rule, Planning) migriert
- **TenantDbService**: Zentrale Datenzugriffsschicht mit CRUD-Operationen
- **WebSocket-Synchronisation**: Bidirektionale Sync mit ACK/NACK-Protokoll
- **Multi-Tenant-Architektur**: Strikte Datenisolation zwischen Mandanten
- **Offline-First**: Vollständige App-Funktionalität ohne Internetverbindung

### In Entwicklung 🔶
- **Sync-Performance**: Optimierung für große Datenmengen
- **Error-Handling**: Robustere Fehlerbehandlung bei Sync-Problemen
- **Batch-Operations**: Effizientere Massenverarbeitung

### Geplant 📋
- **Mobile Optimierung**: Bessere Touch-Bedienung
- **Advanced Analytics**: Erweiterte Ausgabenanalysen
- **Bank-Integration**: Automatischer Transaktionsimport

## Datenbankschema

### Aktuelle Version: 10
- **Version 6**: Basis-Schema (Accounts, Categories, Transactions, SyncQueue)
- **Version 7**: + Recipients Tabelle
- **Version 8**: + Tags Tabelle
- **Version 9**: + Rules Tabelle
- **Version 10**: + PlanningTransactions Tabelle

### Nächste Schema-Änderungen
- Keine geplant - Schema ist stabil

## Performance-Status

### Aktuelle Metriken
- **Ladezeit**: < 2s für 1000 Transaktionen ✅
- **Offline-Verfügbarkeit**: 100% der Kernfunktionen ✅
- **Sync-Erfolgsrate**: ~95% (Ziel: >99%) ⚠️

### Bekannte Performance-Issues
- **Massenimport**: Sync-Probleme bei >30 Einträgen
- **WebSocket-Timeouts**: Gelegentliche Verbindungsabbrüche bei großen Datenmengen

## Nächste Prioritäten

### Kurzfristig (1-2 Wochen)
1. **Sync-Probleme bei Massenimport beheben**
2. **Regelanwendung nach Import testen und reparieren**
3. **Recipient/Payee-Feldverwendung final validieren**

### Mittelfristig (1-2 Monate)
1. **Performance-Optimierung für große Datasets**
2. **Erweiterte Error-Recovery-Mechanismen**
3. **UI/UX-Verbesserungen basierend auf Benutzerfeedback**

### Langfristig (3-6 Monate)
1. **Mobile App-Entwicklung**
2. **Bank-API-Integration**
3. **Advanced Analytics und Reporting**

## Entwicklungsumgebung

### Frontend-Setup
- **Node.js**: Version 18+
- **Package Manager**: npm
- **Dev Server**: `npm run dev` (Vite)
- **Build**: `npm run build`

### Backend-Setup
- **Python**: Version 3.8+
- **Framework**: FastAPI
- **Server**: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- **Database**: SQLite (lokale Entwicklung)

## Debugging-Tools

### Verfügbare Debug-APIs
- **IndexedDB-Debug**: `window.finwiseDebug.indexedDB.state()`
- **Sync-Debug**: Detaillierte Logs in Browser-Konsole
- **WebSocket-Debug**: Verbindungsstatus und Nachrichten-Tracking

### Logging-System
- **Frontend**: Console-basiert mit strukturierten Logs
- **Backend**: Datei-basiert mit Rotation (backend.log)
