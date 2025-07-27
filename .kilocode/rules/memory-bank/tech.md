# FinWise - Technologien

## Frontend-Technologien

### Core Framework
- **Vue.js 3.5.10**: Progressive JavaScript Framework mit Composition API
- **TypeScript 5.5.3**: Statische Typisierung für bessere Entwicklererfahrung
- **Vite 5.4.14**: Schneller Build-Tool und Dev-Server

### State Management & Routing
- **Pinia 2.1.7**: Modernes State Management für Vue 3
- **Vue Router 4.5.0**: Offizieller Router für Vue.js
- **Dexie 4.0.11**: IndexedDB-Wrapper für lokale Datenpersistierung

### UI & Styling
- **Tailwind CSS 4.0.14**: Utility-First CSS Framework
- **DaisyUI 5.0.4**: Komponenten-Bibliothek für Tailwind CSS
- **@iconify/vue 4.1.1**: Icon-System mit umfangreicher Icon-Sammlung
- **@iconify/tailwind 1.0.0**: Tailwind-Integration für Icons

### Charts & Visualisierung
- **ApexCharts 4.5.0**: Moderne Chart-Bibliothek
- **Chart.js 4.4.1**: Flexible Chart-Bibliothek
- **Vue-ChartJS 5.3.0**: Vue.js-Wrapper für Chart.js

### Utilities & Hilfsbibliotheken
- **dayjs 1.11.10**: Leichtgewichtige Datums-Bibliothek
- **lodash 4.17.21**: JavaScript-Utility-Bibliothek
- **uuid 11.1.0**: UUID-Generierung
- **bcryptjs 3.0.2**: Client-seitige Passwort-Hashing
- **muuri 0.9.5**: Drag-and-Drop Grid-Layout

### Development & Testing
- **Vitest 3.2.1**: Schnelles Unit-Testing Framework
- **Vue TSC 2.1.6**: TypeScript-Compiler für Vue
- **fake-indexeddb 6.0.0**: IndexedDB-Mock für Tests
- **jsdom 25.0.1**: DOM-Implementation für Node.js

## Backend-Technologien

### Core Framework
- **FastAPI 0.115.12**: Modernes Python Web-Framework
- **Python 3.8+**: Programmiersprache
- **Uvicorn 0.34.2**: ASGI-Server für FastAPI

### Datenbank & ORM
- **SQLAlchemy 2.0.41**: Python SQL Toolkit und ORM
- **SQLite**: Eingebettete Datenbank
- **Alembic**: Datenbank-Migrations-Tool

### Authentifizierung & Sicherheit
- **bcrypt 4.3.0**: Passwort-Hashing
- **passlib 1.7.4**: Passwort-Hashing-Bibliothek
- **python-jose**: JWT-Token-Verarbeitung

### HTTP & WebSockets
- **httpx 0.28.1**: Async HTTP-Client
- **websockets 15.0.1**: WebSocket-Implementierung
- **python-multipart 0.0.20**: Multipart-Form-Datenverarbeitung

### Utilities
- **Pydantic 2.11.5**: Datenvalidierung und -serialisierung
- **python-dotenv 1.1.0**: Umgebungsvariablen-Management
- **Pillow 10.4.0**: Bildverarbeitung

### Development & Testing
- **pytest 8.3.5**: Testing-Framework
- **pytest-asyncio**: Async-Testing-Support

## Entwicklungsumgebung

### Frontend-Setup
```bash
# Node.js Version
node --version  # 18+

# Package Manager
npm --version

# Development Server
npm run dev     # Vite Dev Server auf http://localhost:5173

# Build
npm run build   # Production Build

# Testing
npm run test    # Vitest Unit Tests
```

### Backend-Setup
```bash
# Python Version
python --version  # 3.8+

# Virtual Environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Dependencies
pip install -r requirements.txt

# Development Server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Datenpersistierung

### Frontend (IndexedDB)
- **Dexie.js**: Wrapper für IndexedDB mit Promise-basierter API
- **Multi-Tenant**: Separate Datenbanken pro Mandant (`tenant_{id}_db`)
- **Schema-Versioning**: Automatische Migrations bei Schema-Änderungen
- **Offline-First**: Vollständige Funktionalität ohne Backend-Verbindung

### Backend (SQLite)
- **Central Auth DB**: `users.db` für Benutzer und Mandanten
- **Tenant-specific DBs**: `data/tenant_{id}.db` für Mandantendaten
- **SQLAlchemy ORM**: Typisierte Modelle und Beziehungen
- **Alembic Migrations**: Versionierte Schema-Änderungen

## Kommunikation

### HTTP-APIs
- **REST-Endpunkte**: Standard CRUD-Operationen
- **JSON-Serialisierung**: Pydantic-basierte Datenvalidierung
- **CORS-Support**: Cross-Origin-Requests für Frontend-Backend-Kommunikation

### WebSocket-Kommunikation
- **Bidirektionale Sync**: Echtzeit-Datensynchronisation
- **ACK/NACK-Protokoll**: Bestätigung/Ablehnung von Sync-Operationen
- **Connection Management**: Automatische Reconnection bei Verbindungsabbruch

## Build & Deployment

### Frontend-Build
- **Vite**: Optimierte Production-Builds
- **Tree Shaking**: Entfernung ungenutzten Codes
- **Code Splitting**: Lazy Loading von Routen
- **Asset Optimization**: Minimierung von CSS/JS/Images

### Backend-Deployment
- **ASGI-Server**: Uvicorn für Production
- **Environment Variables**: Konfiguration über .env-Dateien
- **Logging**: Strukturiertes Logging mit Rotation
- **Health Checks**: API-Endpunkte für Monitoring

## Browser-Kompatibilität

### Unterstützte Browser
- **Chrome 58+**: Vollständige IndexedDB-Unterstützung
- **Firefox 55+**: Vollständige IndexedDB-Unterstützung
- **Safari 10+**: Vollständige IndexedDB-Unterstützung
- **Edge 79+**: Vollständige IndexedDB-Unterstützung

### Fallback-Strategien
- **localStorage**: Fallback bei fehlender IndexedDB-Unterstützung
- **Progressive Enhancement**: Graceful Degradation bei älteren Browsern
- **Feature Detection**: Automatische Erkennung verfügbarer APIs

## Performance-Optimierungen

### Frontend
- **Virtual Scrolling**: Effiziente Darstellung großer Listen
- **Lazy Loading**: Komponenten und Routen bei Bedarf laden
- **Debouncing**: Vermeidung redundanter API-Calls
- **Caching**: Intelligentes Caching häufig abgerufener Daten

### Backend
- **Connection Pooling**: Effiziente Datenbankverbindungen
- **Query Optimization**: Optimierte SQL-Abfragen
- **Async Processing**: Non-blocking I/O-Operationen
- **Response Compression**: Gzip-Komprimierung für HTTP-Responses

## Sicherheit

### Frontend
- **XSS-Schutz**: Vue.js-integrierte Template-Sanitization
- **CSRF-Schutz**: Token-basierte Authentifizierung
- **Input-Validation**: Client-seitige Validierung mit TypeScript

### Backend
- **SQL-Injection-Schutz**: SQLAlchemy ORM verhindert SQL-Injection
- **Password-Hashing**: bcrypt für sichere Passwort-Speicherung
- **JWT-Tokens**: Sichere Authentifizierung ohne Session-State
- **CORS-Konfiguration**: Kontrollierte Cross-Origin-Requests

## Monitoring & Debugging

### Frontend
- **Vue DevTools**: Browser-Extension für Vue.js-Debugging
- **IndexedDB Inspector**: Browser DevTools für Datenbank-Debugging
- **Console Logging**: Strukturierte Logs mit verschiedenen Log-Levels

### Backend
- **FastAPI Docs**: Automatische API-Dokumentation
- **Structured Logging**: JSON-basierte Logs mit Rotation
- **Health Endpoints**: Status-Monitoring für Deployment
- **Error Tracking**: Detaillierte Exception-Logs
