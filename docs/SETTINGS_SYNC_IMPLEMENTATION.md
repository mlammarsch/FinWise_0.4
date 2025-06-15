# Settings-Synchronisation Implementation

## Überblick

Die Settings-Synchronisation ermöglicht es, Benutzereinstellungen geräteübergreifend zu synchronisieren. Im Gegensatz zu anderen Entitäten sind Settings **user-spezifisch** (nicht tenant-spezifisch) und verwenden eine vereinfachte Sync-Strategie.

## Architektur

### Backend-Komponenten

#### 1. SQLAlchemy-Modell (`app/models/user_tenant_models.py`)
```python
class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.uuid"), nullable=False, unique=True)
    log_level = Column(String, nullable=False, default="INFO")
    enabled_log_categories = Column(Text, nullable=False, default='["store", "ui", "service"]')
    history_retention_days = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

#### 2. Pydantic-Schemas (`app/models/schemas.py`)
- `UserSettingsBase`: Basis-Schema mit allen Settings-Feldern
- `UserSettingsCreate`: Für neue Settings-Erstellung
- `UserSettingsUpdate`: Für Settings-Updates mit LWW-Unterstützung
- `UserSettingsSyncPayload`: Für Frontend-Backend-Synchronisation

#### 3. CRUD-Operationen (`app/crud/crud_user_settings.py`)
- `get_user_settings()`: Lädt Settings für einen Benutzer
- `create_user_settings()`: Erstellt neue Settings
- `update_user_settings()`: Aktualisiert Settings mit LWW-Konfliktlösung
- `sync_user_settings()`: Sync-Wrapper (Create oder Update)
- `create_default_user_settings()`: Erstellt Default-Settings

#### 4. API-Endpunkte (`app/api/v1/endpoints/user_settings.py`)
- `GET /api/v1/user/settings/{user_id}`: Lädt Settings
- `POST /api/v1/user/settings/{user_id}/sync`: Synchronisiert Settings
- `PUT /api/v1/user/settings/{user_id}`: Aktualisiert Settings
- `POST /api/v1/user/settings/{user_id}/reset`: Setzt auf Defaults zurück

### Frontend-Komponenten

#### 1. Erweiterte SettingsStore (`src/stores/settingsStore.ts`)
```typescript
interface SettingsState {
  logLevel: LogLevel;
  enabledLogCategories: Set<string>;
  historyRetentionDays: number;
  lastSyncTimestamp?: string;
  isSyncing: boolean;
  syncError?: string;
}
```

**Neue Methoden:**
- `syncWithBackend()`: Synchronisiert mit Backend
- `loadFromBackend()`: Lädt Settings vom Backend
- `mergeWithBackendSettings()`: Last-Write-Wins Merge-Logik
- `initializeForUser()`: Initialisierung beim Login
- `resetToDefaults()`: Reset mit Backend-Sync

#### 2. API-Service (`src/services/SettingsApiService.ts`)
- Typisierte API-Calls zum Backend
- Retry-Mechanismen mit exponential backoff
- Backend-Verfügbarkeitsprüfung
- Graceful Error-Handling

#### 3. SessionService-Integration (`src/services/SessionService.ts`)
- Automatische Settings-Initialisierung beim Login
- Integration in Router Guards

## Sync-Strategie

### Besonderheiten der Settings-Synchronisation

1. **User-spezifisch**: Settings gehören zum User, nicht zum Tenant
2. **Kleine Datenmenge**: Wenige KB, optimiert für schnelle Übertragung
3. **Seltene Änderungen**: Nicht so häufig wie Transaktionen
4. **App-Start-kritisch**: Müssen beim App-Start verfügbar sein

### Last-Write-Wins (LWW) Konfliktlösung

```typescript
// Frontend Merge-Logik
const backendTimestamp = new Date(backendSettings.updated_at);
const localTimestamp = new Date(this.lastSyncTimestamp);

if (backendTimestamp > localTimestamp) {
  // Backend-Settings sind neuer - übernehme sie
  this.logLevel = backendSettings.log_level;
  this.enabledLogCategories = new Set(backendSettings.enabled_log_categories);
  this.historyRetentionDays = backendSettings.history_retention_days;
}
```

### Offline-First mit Graceful Degradation

1. **Lokale Settings**: Immer in localStorage verfügbar
2. **Backend-Sync**: Opportunistisch bei verfügbarer Verbindung
3. **Fallback**: App funktioniert vollständig offline
4. **Auto-Retry**: Exponential backoff bei Fehlern

## Datenfluss

### App-Start
1. Lade Settings aus localStorage
2. Aktualisiere LogConfig
3. Prüfe Backend-Verfügbarkeit
4. Synchronisiere mit Backend (falls verfügbar)
5. Merge mit LWW-Strategie

### Settings-Änderung
1. Aktualisiere lokalen State
2. Speichere in localStorage
3. Aktualisiere LogConfig
4. Synchronisiere mit Backend (async)

### Login
1. SessionService initialisiert Settings
2. Lade Backend-Settings für User
3. Merge mit lokalen Settings
4. Aktualisiere UI

## API-Endpunkte

### GET /api/v1/user/settings/{user_id}
Lädt Settings für einen Benutzer. Erstellt automatisch Default-Settings wenn keine vorhanden.

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "log_level": "INFO",
  "enabled_log_categories": ["store", "ui", "service"],
  "history_retention_days": 60,
  "created_at": "2025-06-15T15:30:00Z",
  "updated_at": "2025-06-15T15:30:00Z"
}
```

### POST /api/v1/user/settings/{user_id}/sync
Synchronisiert Settings (Create oder Update basierend auf Existenz).

**Request:**
```json
{
  "log_level": "DEBUG",
  "enabled_log_categories": ["store", "ui", "service", "sync"],
  "history_retention_days": 90,
  "updated_at": "2025-06-15T15:35:00Z"
}
```

### POST /api/v1/user/settings/{user_id}/reset
Setzt Settings auf Standardwerte zurück.

## Testing

### Manuelle Tests (`src/test-settings-sync.ts`)
```javascript
// Browser-Konsole
testSettingsSync()        // Testet vollständige Synchronisation
testSettingsLoad()        // Testet Backend-Load
testSettingsReset()       // Testet Reset-Funktionalität
testBackendAvailability() // Testet Backend-Verbindung
showCurrentSettings()     // Zeigt aktuelle Settings
```

### Test-Szenarien
1. **Online-Sync**: Settings werden sofort synchronisiert
2. **Offline-Fallback**: App funktioniert ohne Backend
3. **Konflikt-Resolution**: LWW bei gleichzeitigen Änderungen
4. **Backend-Reconnect**: Sync nach Verbindungswiederherstellung
5. **Error-Recovery**: Graceful handling bei API-Fehlern

## Fehlerbehandlung

### Backend-Fehler
- **Network Error**: Retry mit exponential backoff
- **Validation Error**: Logging und lokale Settings beibehalten
- **Server Error**: Graceful degradation

### Frontend-Fehler
- **Parse Error**: Fallback auf Default-Settings
- **Storage Error**: Warnung und Memory-only Betrieb
- **Sync Error**: Lokale Settings bleiben funktional

## Performance-Überlegungen

### Optimierungen
- **Kleine Payload**: Nur wenige KB pro Sync
- **Debouncing**: Verhindert excessive API-Calls
- **Caching**: localStorage als lokaler Cache
- **Lazy Loading**: Settings nur bei Bedarf laden

### Monitoring
- Sync-Latenz tracking
- Error-Rate monitoring
- Backend-Verfügbarkeit tracking

## Sicherheit

### Validierung
- **Frontend**: TypeScript-Typen + Pydantic-Schemas
- **Backend**: Pydantic-Validierung + SQLAlchemy-Constraints
- **API**: User-ID-Validierung in allen Endpunkten

### Datenschutz
- Settings enthalten keine sensiblen Daten
- User-spezifische Isolation
- Keine Cross-User-Zugriffe möglich

## Migration und Deployment

### Datenbank-Migration
Die UserSettings-Tabelle wird automatisch bei App-Start erstellt durch:
```python
# app/db/database.py
def create_db_and_tables():
    from app.models.user_tenant_models import Base as UserTenantBase
    UserTenantBase.metadata.create_all(bind=engine)
```

### Backward Compatibility
- Bestehende localStorage-Settings bleiben funktional
- Graceful Upgrade ohne Datenverlust
- Fallback auf lokale Settings bei Backend-Problemen

## Zukünftige Erweiterungen

### Geplante Features
1. **Erweiterte Settings**: Theme, Sprache, UI-Präferenzen
2. **Settings-Gruppen**: Kategorisierung verschiedener Setting-Typen
3. **Versionierung**: Settings-History und Rollback
4. **Bulk-Operations**: Mehrere Settings gleichzeitig ändern

### WebSocket-Integration (Optional)
Für Echtzeit-Updates bei Settings-Änderungen auf anderen Geräten:
```typescript
// Mögliche Erweiterung
interface SettingsUpdateMessage {
  type: 'settings_update';
  user_id: string;
  settings: UserSettings;
}
```

## Fazit

Die Settings-Synchronisation bietet eine robuste, offline-first Lösung für Benutzereinstellungen mit:

- ✅ **Zuverlässige Synchronisation** mit LWW-Konfliktlösung
- ✅ **Graceful Degradation** bei Backend-Problemen
- ✅ **Performance-optimiert** für kleine Datenmengen
- ✅ **Benutzerfreundlich** mit automatischer Initialisierung
- ✅ **Erweiterbar** für zukünftige Setting-Typen

Die Implementierung folgt den etablierten Patterns der FinWise-Architektur und bietet eine solide Basis für geräteübergreifende Benutzereinstellungen.
