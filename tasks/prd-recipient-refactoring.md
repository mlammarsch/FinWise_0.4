# Product Requirements Document (PRD)
# Empfänger-Handling Refactoring in FinWise

**Version:** 1.1
**Datum:** 15. Juli 2025
**Autor:** KiloCode AI
**Status:** Draft

## 1. Zusammenfassung

### Problem
Das FinWise-System weist eine kritische Inkonsistenz bei der Empfänger-Handhabung zwischen Frontend und Backend auf. Während das Frontend `recipientId` verwendet, nutzt das Backend das `payee`-Textfeld. Diese Diskrepanz führt zu:

- Synchronisationsfehlern zwischen Frontend und Backend
- Defekter Regel-Engine-Funktionalität (Automation Rules)
- Problemen beim CSV-Import von Transaktionen
- Inkonsistenter Datenintegrität

### Lösung
Vollständige Refactoring des Empfänger-Handlings zur einheitlichen Verwendung von `recipientId` in beiden Systemen, mit Beibehaltung des `payee`-Feldes als abgeleiteter Wert für Anzeigezwecke.

### Geschäftswert
- Verbesserte Datenintegrität und -konsistenz
- Stabilere bidirektionale Synchronisation
- Funktionsfähige Automatisierungsregeln
- Zuverlässiger CSV-Import
- Reduzierte Wartungskosten

## 2. Ziele

### Primäre Ziele
1. **Datenkonsistenz**: Einheitliche Verwendung von `recipientId` in Frontend und Backend
2. **Sync-Stabilität**: Fehlerfreie bidirektionale Synchronisation von Transaktionen
3. **Regel-Engine-Funktionalität**: Vollständig funktionsfähige Automation Rules mit Empfänger-Bedingungen
4. **CSV-Import-Kompatibilität**: Korrekte Empfänger-Zuordnung beim Transaktionsimport

### Sekundäre Ziele
5. **Backward Compatibility**: Erhaltung bestehender API-Kompatibilität wo möglich

## 3. User Stories

### Als Entwickler
- **US-1**: Als Entwickler möchte ich eine konsistente Empfänger-Referenzierung, damit die Synchronisation zwischen Frontend und Backend fehlerfrei funktioniert
- **US-2**: Als Entwickler möchte ich einheitliche Datenstrukturen, damit die Regel-Engine korrekt auf Empfänger-Informationen zugreifen kann
- **US-3**: Als Entwickler möchte ich eine klare API-Struktur, damit CSV-Import und manuelle Transaktionserstellung identisch funktionieren

### Als Endbenutzer
- **US-4**: Als Benutzer möchte ich, dass meine Automatisierungsregeln zuverlässig funktionieren, damit wiederkehrende Transaktionen korrekt kategorisiert werden
- **US-5**: Als Benutzer möchte ich, dass CSV-Importe korrekte Empfänger zuordnen, damit meine Transaktionsdaten vollständig und konsistent sind
- **US-6**: Als Benutzer möchte ich, dass alle meine Transaktionen korrekt synchronisiert werden, damit ich auf allen Geräten dieselben Daten sehe

## 4. Funktionale Anforderungen

### 4.1 Backend-Anforderungen

#### 4.1.1 Datenmodell-Erweiterung
- **REQ-BE-1**: Transaction-Modell um `recipientId`-Feld erweitern (Optional, Foreign Key zu Recipients)
- **REQ-BE-2**: `payee`-Feld als abgeleiteter Wert beibehalten für Backward Compatibility
- **REQ-BE-3**: Datenbankschema entsprechend anpassen

#### 4.1.2 API-Schema-Updates
- **REQ-BE-4**: Pydantic-Schemas für Transaction-Payloads um `recipientId` erweitern
- **REQ-BE-5**: WebSocket-Schemas für bidirektionale Synchronisation anpassen
- **REQ-BE-6**: REST-API-Endpunkte für Transaction-CRUD erweitern

#### 4.1.3 CRUD-Logik-Anpassung
- **REQ-BE-7**: Transaction-CRUD-Operationen für `recipientId`-Handling erweitern
- **REQ-BE-8**: Automatische `payee`-Ableitung aus `recipientId` implementieren (Recipient.name lookup)

### 4.2 Frontend-Anforderungen

#### 4.2.1 Store-Refactoring
- **REQ-FE-1**: RuleStore-Logik von `payee` auf `recipientId` umstellen
- **REQ-FE-2**: TransactionStore für konsistente `recipientId`-Verwendung anpassen
- **REQ-FE-3**: Alle Transaction-Services für `recipientId`-First-Ansatz refactoren

#### 4.2.2 Service-Layer-Updates
- **REQ-FE-4**: CSVImportService für korrekte `recipientId`-Zuordnung erweitern
- **REQ-FE-5**: PlanningService-Pattern als Referenz für andere Services verwenden
- **REQ-FE-6**: TransactionService für einheitliche Empfänger-Handhabung anpassen

#### 4.2.3 UI-Komponenten-Anpassung
- **REQ-FE-7**: Transaction-Formulare für `recipientId`-basierte Eingabe anpassen
- **REQ-FE-8**: Regel-Editor für `recipientId`-basierte Bedingungen erweitern

### 4.3 Synchronisations-Anforderungen

#### 4.3.1 WebSocket-Integration
- **REQ-SYNC-1**: WebSocket-Nachrichten für Transaction-Updates erweitern
- **REQ-SYNC-2**: Bidirektionale Synchronisation für `recipientId`-Feld implementieren
- **REQ-SYNC-3**: Last-Write-Wins-Konfliktlösung für Empfänger-Referenzen

## 5. Technische Überlegungen

### 5.1 Datenstruktur-Design
```typescript
// Frontend (TypeScript)
interface Transaction {
  id: string;
  recipientId?: string;  // Primary reference
  payee?: string;        // Derived/display value
  // ... andere Felder
}

// Backend (Python/Pydantic)
class Transaction(BaseModel):
    id: str
    recipient_id: Optional[str] = None  # Primary reference
    payee: Optional[str] = None         # Derived/display value
    # ... andere Felder
```

### 5.2 Empfänger-Auflösung
- **Frontend**: `recipientId` → Recipient.name für Anzeige
- **Backend**: `recipientId` → Recipient.name für `payee`-Feld-Population
- **CSV-Import**: Payee-Text → Recipient-Matching → `recipientId`-Zuordnung

### 5.3 Regel-Engine-Integration
```typescript
// Neue Regel-Bedingung
interface RecipientCondition {
  type: 'RECIPIENT_EQUALS' | 'RECIPIENT_CONTAINS';
  recipientId: string;  // Statt payee-Text
}
```

### 5.4 Performance-Überlegungen
- Recipient-Lookups cachen für bessere Performance
- Batch-Operationen für CSV-Import optimieren
- IndexedDB-Indizes für `recipientId`-Abfragen

## 6. Erfolgsmetriken

### 6.1 Technische Metriken
- **Sync-Erfolgsrate**: 100% erfolgreiche Transaction-Synchronisation
- **Regel-Engine-Funktionalität**: 100% korrekte Empfänger-basierte Regel-Ausführung
- **CSV-Import-Genauigkeit**: 100% korrekte Empfänger-Zuordnung bei Import
- **API-Konsistenz**: 0% Diskrepanzen zwischen Frontend- und Backend-Datenstrukturen

### 6.2 Qualitätsmetriken
- **Code-Qualität**: Einheitliche Empfänger-Handhabung in allen Komponenten
- **Wartbarkeit**: Reduzierte Code-Duplikation und verbesserte Konsistenz

## 7. Implementierungsplan

### Phase 1: Backend-Vorbereitung (1-2 Tage)
- Transaction-Modell um `recipientId` erweitern
- Pydantic-Schemas aktualisieren
- CRUD-Operationen anpassen
- WebSocket-Schemas erweitern

### Phase 2: Frontend-Refactoring (2-3 Tage)
- RuleStore von `payee` auf `recipientId` umstellen
- TransactionStore und Services anpassen
- CSVImportService für `recipientId`-Zuordnung erweitern
- UI-Komponenten aktualisieren

### Phase 3: Integration & Testing (1-2 Tage)
- Manuelle End-to-End-Tests
- CSV-Import-Funktionalität validieren
- Regel-Engine-Funktionalität testen
- Synchronisations-Stabilität prüfen

### Phase 4: Cleanup & Dokumentation (1 Tag)
- Code-Review und Optimierung
- Dokumentation aktualisieren
- Legacy-Code-Bereinigung

**Gesamtaufwand**: 5-8 Tage

## 8. Risiken und Mitigation

### 8.1 Technische Risiken
- **Risiko**: Synchronisationsfehler während Refactoring
  - **Mitigation**: Schrittweise Implementierung mit manueller Validierung
- **Risiko**: Performance-Degradation durch zusätzliche Lookups
  - **Mitigation**: Caching-Strategien implementieren

### 8.2 Daten-Risiken
- **Risiko**: Inkonsistente Datenstrukturen
  - **Mitigation**: Frische Datenbank-Installation eliminiert Legacy-Probleme

## 9. Offene Fragen

1. **Recipient-Matching**: Wie soll das automatische Matching von Payee-Text zu Recipients beim CSV-Import funktionieren?
2. **Duplicate Recipients**: Wie gehen wir mit potenziell duplizierten Recipients um?
3. **Legacy Support**: Sollen alte API-Endpunkte weiterhin `payee`-only unterstützen?
4. **Performance**: Welche Caching-Strategie ist für Recipient-Lookups optimal?
5. **UI/UX**: Sollen Benutzer Recipients direkt auswählen oder weiterhin Text eingeben können?
6. **Validation**: Welche Validierungsregeln gelten für `recipientId` vs. `payee`?

## 10. Acceptance Criteria

### 10.1 Backend
- [ ] Transaction-Modell enthält `recipientId`-Feld
- [ ] CRUD-Operationen verarbeiten `recipientId` korrekt
- [ ] `payee`-Feld wird automatisch aus `recipientId` abgeleitet
- [ ] WebSocket-Schemas unterstützen `recipientId`
- [ ] API-Endpunkte funktionieren mit neuer Datenstruktur

### 10.2 Frontend
- [ ] RuleStore verwendet `recipientId` statt `payee` für Bedingungen
- [ ] TransactionStore verwaltet `recipientId` konsistent
- [ ] CSVImportService ordnet Payees korrekt zu `recipientId` zu
- [ ] UI-Komponenten zeigen Empfänger-Namen korrekt an
- [ ] Alle Transaction-Services verwenden einheitliche Empfänger-Logik

### 10.3 Integration
- [ ] Bidirektionale Synchronisation funktioniert fehlerfrei
- [ ] Automation Rules mit Empfänger-Bedingungen funktionieren
- [ ] CSV-Import erstellt korrekte Transaction-Objekte
- [ ] Manuelle Transaction-Erstellung und Import verhalten sich identisch

### 10.4 Qualität
- [ ] Code folgt einheitlichen Patterns für Empfänger-Handhabung
- [ ] Keine Code-Duplikation zwischen verschiedenen Services
- [ ] Dokumentation ist aktuell und vollständig
- [ ] Performance ist mindestens gleichwertig zu vorheriger Implementation

---

**Nächste Schritte**: Review und Genehmigung dieses PRDs, dann Beginn der Implementierung gemäß dem definierten Phasenplan.
