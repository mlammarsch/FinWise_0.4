# Sync-System Debugging Guide

## Probleme identifiziert:

### 1. ✅ Performance-Warnungen (BEHOBEN)
**Problem**: IndexedDB-Abfragen ohne optimierte Indizes
```
The query {"tenantId":"...","status":"pending"} on syncQueue would benefit from a compound index [tenantId+status]
```

**Lösung**: Compound-Indizes hinzugefügt in [`tenantStore.ts`](../src/stores/tenantStore.ts):
```typescript
syncQueue: '&id, tenantId, entityType, entityId, operationType, timestamp, status, [tenantId+status], [tenantId+entityType], [tenantId+operationType]'
```

### 2. 🔍 Sync-Probleme (IN DIAGNOSE)
**Problem**: Gelöschte Konten werden nicht zwischen Clients synchronisiert, WebSocket-Verbindung geht auf "error"

**Mögliche Ursachen**:
1. WebSocket-Verbindungsprobleme zum Backend
2. DELETE-Nachrichten werden nicht korrekt verarbeitet
3. Sync-Queue-Verarbeitung funktioniert nicht
4. Backend sendet keine Benachrichtigungen an andere Clients

## Debugging-Tools implementiert:

### 1. Erweiterte Logging
- ✅ DELETE-Verarbeitung im WebSocketService
- ✅ WebSocket-Fehlerbehandlung mit detaillierten Logs
- ✅ Sync-Queue-Verarbeitung mit Status-Logging

### 2. SyncDebugger-Tool
**Verfügbare Browser-Konsolen-Befehle**:
```javascript
// Vollständige Sync-Diagnose
window.syncDebug.diagnose()

// Sync-Queue manuell verarbeiten
window.syncDebug.forceSync()

// Fehlgeschlagene Einträge löschen
window.syncDebug.clearFailed()

// Hängende Einträge zurücksetzen
window.syncDebug.resetStuck()
```

## Debugging-Schritte:

### Schritt 1: Grundlegende Diagnose
1. Browser-Konsole öffnen
2. `window.syncDebug.diagnose()` ausführen
3. Logs analysieren:
   - WebSocket-Status
   - Sync-Queue-Status
   - Backend-Verbindung
   - Tenant-Status

### Schritt 2: WebSocket-Verbindung prüfen
```javascript
// In Browser-Konsole
console.log('WebSocket Status:', {
  connectionStatus: useWebSocketStore().connectionStatus,
  backendStatus: useWebSocketStore().backendStatus,
  lastError: useWebSocketStore().lastError
});
```

### Schritt 3: Backend-Erreichbarkeit testen
1. Backend-URL prüfen: `http://localhost:8000`
2. WebSocket-URL prüfen: `ws://localhost:8000/ws_finwise/ws/{tenant_id}`
3. Browser-Netzwerk-Tab auf WebSocket-Verbindungen prüfen

### Schritt 4: Sync-Queue analysieren
```javascript
// Sync-Queue-Status prüfen
window.syncDebug.diagnose()

// Bei hängenden Einträgen
window.syncDebug.resetStuck()

// Bei fehlgeschlagenen Einträgen
window.syncDebug.clearFailed()
```

### Schritt 5: Manuelle Sync-Verarbeitung
```javascript
// Sync-Queue manuell verarbeiten
window.syncDebug.forceSync()
```

## Häufige Probleme und Lösungen:

### Problem: WebSocket-Verbindung schlägt fehl
**Symptome**:
- Backend-Status bleibt auf "offline"
- WebSocket-Fehler in der Konsole

**Lösungen**:
1. Backend-Server prüfen (läuft auf Port 8000?)
2. CORS-Einstellungen prüfen
3. Firewall/Proxy-Einstellungen prüfen

### Problem: DELETE-Operationen werden nicht synchronisiert
**Symptome**:
- Konto wird lokal gelöscht
- Andere Clients erhalten keine DELETE-Benachrichtigung
- Backend zeigt korrekte Löschung

**Debugging**:
1. Browser-Konsole auf DELETE-Logs prüfen
2. Backend-Logs auf DELETE-Verarbeitung prüfen
3. WebSocket-Nachrichten im Netzwerk-Tab prüfen

### Problem: Sync-Queue läuft voll
**Symptome**:
- Viele ausstehende Sync-Einträge
- Synchronisation funktioniert nicht

**Lösungen**:
```javascript
// Hängende Einträge zurücksetzen
window.syncDebug.resetStuck()

// Fehlgeschlagene Einträge löschen
window.syncDebug.clearFailed()

// Sync manuell starten
window.syncDebug.forceSync()
```

## Monitoring und Logs:

### Frontend-Logs überwachen:
```javascript
// Logger-Level auf DEBUG setzen
localStorage.setItem('finwise_log_level', 'DEBUG');

// Relevante Log-Kategorien:
// [WebSocketService] - WebSocket-Verbindung und Nachrichten
// [SyncButton] - Sync-Button-Aktionen
// [TenantDbService] - Datenbank-Operationen
// [accountStore] - Account-Store-Operationen
```

### Backend-Logs überwachen:
```bash
# Backend-Logs in Echtzeit verfolgen
tail -f ../FinWise_0.4_BE/backend.log

# Nach spezifischen Sync-Operationen suchen
grep "SyncService" ../FinWise_0.4_BE/backend.log
grep "DELETE" ../FinWise_0.4_BE/backend.log
```

## Nächste Schritte:

1. **Sofortige Maßnahmen**:
   - Browser-Cache leeren (neue DB-Indizes)
   - `window.syncDebug.diagnose()` ausführen
   - Backend-Erreichbarkeit prüfen

2. **Wenn Problem weiterhin besteht**:
   - Backend-Logs analysieren
   - WebSocket-Nachrichten im Browser-Netzwerk-Tab prüfen
   - Sync-Queue manuell zurücksetzen

3. **Langfristige Verbesserungen**:
   - Automatische Fehlerwiederherstellung
   - Bessere Offline-Unterstützung
   - Erweiterte Konfliktauflösung

## Kontakt bei weiteren Problemen:

Wenn die Debugging-Schritte das Problem nicht lösen, bitte folgende Informationen bereitstellen:

1. Ausgabe von `window.syncDebug.diagnose()`
2. Browser-Konsolen-Logs (besonders WebSocket-Fehler)
3. Backend-Logs (../FinWise_0.4_BE/backend.log)
4. Genaue Schritte zur Reproduktion des Problems
5. Welche Browser und Betriebssystem verwendet wird
