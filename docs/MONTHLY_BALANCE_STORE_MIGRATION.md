# MonthlyBalanceStore IndexedDB Migration

## Übersicht

Die MonthlyBalanceStore-Migration implementiert die vollständige Umstellung von localStorage zu IndexedDB nach den etablierten Patterns der anderen Stores in FinWise.

## Implementierte Änderungen

### 1. TenantDbService Erweiterung

#### Schema-Update (Version 11)
```typescript
// Neue Tabelle hinzugefügt
monthlyBalances: '&[year+month], year, month'
```

#### CRUD-Methoden
- `getAllMonthlyBalances()`: Lädt alle MonthlyBalances sortiert nach Jahr/Monat
- `saveMonthlyBalance(monthlyBalance)`: Speichert/aktualisiert eine MonthlyBalance
- `getMonthlyBalancesByYear(year)`: Lädt alle MonthlyBalances für ein Jahr
- `getMonthlyBalance(year, month)`: Lädt spezifische MonthlyBalance
- `deleteMonthlyBalance(year, month)`: Löscht eine MonthlyBalance

### 2. MonthlyBalanceStore Migration

#### Neue Eigenschaften
- `isLoaded`: Tracking des Ladestatus
- `tenantDbService`: TenantDbService-Instanz für IndexedDB-Operationen

#### Async-Migration
- `loadMonthlyBalances()`: Async-Laden aus IndexedDB mit Migration
- `setMonthlyBalance()`: Async-Speichern in IndexedDB
- `saveMonthlyBalances()`: Batch-Speichern aller Balances
- `reset()`: Async-Reset mit Neuladen

#### Migration-Logik
```typescript
async function migrateFromLocalStorage(): Promise<void> {
  const legacyKey = storageKey('monthly_balances');
  const legacyData = localStorage.getItem(legacyKey);

  if (legacyData && !isLoaded.value) {
    const parsedData: MonthlyBalance[] = JSON.parse(legacyData);

    // Daten in IndexedDB speichern
    for (const balance of parsedData) {
      await tenantDbService.saveMonthlyBalance(balance);
    }

    // Legacy-Daten entfernen
    localStorage.removeItem(legacyKey);
  }
}
```

### 3. BalanceService Anpassung

#### Async-Unterstützung
- `calculateMonthlyBalances()`: Zu async migriert
- Verwendet `await mbStore.setMonthlyBalance()` für IndexedDB-Persistierung
- Robuste Fehlerbehandlung für IndexedDB-Operationen

### 4. DataService Integration

#### Tenant-Reload
- `reloadTenantData()`: Verwendet `await BalanceService.calculateMonthlyBalances()`
- Vollständige Integration in Tenant-Wechsel-Logik

## Performance-Optimierungen

### Indizierung
- **Primärschlüssel**: `[year+month]` für effiziente Jahr/Monat-Abfragen
- **Sekundärindizes**: `year`, `month` für flexible Abfragen
- **Sortierung**: Automatische Sortierung nach Jahr/Monat

### Batch-Operationen
- `saveMonthlyBalances()`: Effiziente Batch-Speicherung
- `getMonthlyBalancesByYear()`: Optimierte Jahres-Abfragen

### Memory-Management
- Lazy Loading: Daten werden nur bei Bedarf geladen
- `isLoaded`-Flag verhindert redundante Ladevorgänge

## Fehlerbehandlung

### Graceful Fallbacks
- IndexedDB-Fehler führen zu leeren Arrays statt Crashes
- Migration-Fehler werden geloggt aber nicht propagiert
- Robuste Validierung von Legacy-Daten

### Logging-Integration
```typescript
// Erfolgreiche Operationen
debugLog('monthlyBalanceStore', `${loadedBalances.length} MonthlyBalances geladen`);

// Fehlerbehandlung
errorLog('monthlyBalanceStore', 'Fehler beim Laden der MonthlyBalances', error);

// Migration-Info
infoLog('monthlyBalanceStore', `Migriere ${parsedData.length} MonthlyBalances von localStorage zu IndexedDB`);
```

## Testing

### Test-Coverage
- **IndexedDB-Integration**: CRUD-Operationen, Fehlerbehandlung
- **Migration-Logik**: localStorage zu IndexedDB, Datenvalidierung
- **Store-Operationen**: Getter, Setter, Reset-Funktionalität
- **Legacy-Kompatibilität**: Computed-Methoden für bestehende API

### Mock-Architektur
- `TenantDbService`-Mocking für isolierte Tests
- localStorage-Simulation für Migration-Tests
- Fehler-Simulation für Robustheit-Tests

## Kompatibilität

### Backward Compatibility
- Alle bestehenden computed-Methoden bleiben funktional
- API-Kompatibilität für abhängige Services
- Graceful Migration ohne Datenverlust

### Legacy-Methoden
- `getAccountBalanceForDate`
- `getCategoryBalanceForDate`
- `getProjectedAccountBalanceForDate`
- `getProjectedCategoryBalanceForDate`
- `getLatestPersistedCategoryBalance`

## Vorteile der Migration

### Performance
- **Schnellere Abfragen**: IndexedDB-Indizes vs. Array-Iteration
- **Bessere Memory-Nutzung**: Lazy Loading vs. komplette Daten im Memory
- **Optimierte Speicherung**: Strukturierte DB vs. JSON-Serialisierung

### Skalierbarkeit
- **Große Datenmengen**: IndexedDB kann größere Datasets handhaben
- **Mandantentrennung**: Separate DBs pro Mandant
- **Zukunftssicherheit**: Vorbereitung auf erweiterte Features

### Zuverlässigkeit
- **Transaktionale Sicherheit**: IndexedDB-Transaktionen
- **Bessere Fehlerbehandlung**: Strukturierte Error-Handling
- **Konsistenz**: Einheitliche Patterns mit anderen Stores

## Migration-Checkliste

### Vor der Migration
- [x] TenantDbService Schema erweitert (Version 11)
- [x] CRUD-Methoden implementiert
- [x] MonthlyBalance-Interface importiert

### Store-Migration
- [x] Async-Methoden implementiert
- [x] Migration-Logik für localStorage
- [x] Fehlerbehandlung und Logging
- [x] isLoaded-Flag für Ladestatus

### Service-Integration
- [x] BalanceService zu async migriert
- [x] DataService-Integration aktualisiert
- [x] Abhängige Services angepasst

### Testing
- [x] Umfassende Test-Suite erstellt
- [x] Migration-Tests implementiert
- [x] Fehlerbehandlung-Tests
- [x] Legacy-Kompatibilität validiert

### Validierung
- [ ] Manuelle Tests in Entwicklungsumgebung
- [ ] Performance-Benchmarks
- [ ] Produktions-Deployment-Test

## Bekannte Limitationen

### Aktuelle Einschränkungen
- Keine Backend-Synchronisation (berechnete Daten)
- Legacy-Computed-Methoden könnten optimiert werden
- Batch-Updates könnten weiter optimiert werden

### Zukünftige Verbesserungen
- Streaming-Updates für große Datasets
- Erweiterte Caching-Strategien
- Potenzielle WebWorker-Integration für Background-Berechnungen

## Rollback-Strategie

### Bei Problemen
1. **Sofortiger Rollback**: Zurück zu localStorage-Version
2. **Daten-Recovery**: Migration-Logs für Datenwiederherstellung
3. **Graduelle Migration**: Schrittweise Aktivierung für Benutzergruppen

### Monitoring
- IndexedDB-Fehlerrate überwachen
- Performance-Metriken vergleichen
- Benutzer-Feedback sammeln
