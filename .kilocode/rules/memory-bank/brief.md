# FinWise - Projektgrundlagen

## Projektname
**FinWise: Dein smarter Finanzassistent**

## Projektbeschreibung
Umfassende Haushaltsfinanzplanungs- und Haushaltskassenführungs-App mit Offline-Funktionalität und Synchronisation mit einem Backend-Server. Die App ermöglicht es Benutzern, ihre Finanzen detailliert zu verwalten, Budgets zu erstellen und ihre Ausgaben zu kategorisieren.

## Hauptfunktionen

### Kernfunktionen
- **Kontoverwaltung**: Hinzufügen, Bearbeiten und Anzeigen von Konten
- **Transaktionsverwaltung**: Vollständige CRUD-Operationen für Finanztransaktionen
- **Budgetverwaltung**: Erstellung und Verwaltung von Budgets für verschiedene Kategorien
- **Kategorien- und Tagsverwaltung**: Definieren und Zuweisen von Kategorien und Tags zu Transaktionen
- **Regelverwaltung**: Automatisches Kategorisieren von Transaktionen basierend auf definierten Regeln
- **Regelbuchungen**: Erstellung automatischer Buchungen (z.B. monatliche Miete) in definierten Zeitintervallen
- **Kontoprognose**: Vorhersage der Kontostände basierend auf vergangenen Transaktionen und geplanten Buchungen

### Erweiterte Funktionen
- **User- und Mandantenverwaltung**: Benutzer-Authentifizierung und -Registrierung, Erstellung und Verwaltung von Mandanten (getrennte Datenbanken pro Mandant)
- **Offline-Bearbeitung**: Vollständige Funktionalität der App auch ohne Internetverbindung
- **Bidirektionale Synchronisation**: Synchronisation von Daten zwischen Frontend und Backend bei bestehender Internetverbindung
- **Im- und Exportfunktionalität**: CSV Import von Transaktionen, Stammdaten können gezielt ex- und importiert werden

## Technische Spezifikationen

### Frontend
- **Pfad**: `../FinWise_0.4` (aktuelles Arbeitsverzeichnis)
- **Technologie**: Vite, Vue.js 3 mit TypeScript und Composition API
- **Lokale Datenspeicherung**: IndexedDB mit Dexie.js
- **State Management**: Pinia
- **UI Framework**: DaisyUI + Tailwind CSS

### Backend
- **Pfad**: `../FinWise_0.4_BE`
- **Technologie**: FastAPI (Python)
- **Datenbank**: SQLite (getrennte Datenbanken für User-Mandanten-Informationen und pro Mandant)
- **Authentifizierung**: Bcrypt für Passwortverschlüsselung, JWT-Token
- **Kommunikation**: WebSockets und direkte API Endpunkte

## Projektstruktur

### Frontend-Struktur
```
src/
├── components/          # Wiederverwendbare Vue-Komponenten
├── layouts/            # Layout-Komponenten
├── router/             # Vue Router Konfiguration
├── services/           # Business Logic und API-Services
├── stores/             # Pinia Stores
├── types/              # TypeScript-Definitionen
├── utils/              # Hilfsfunktionen
└── views/              # Hauptansichten/Seiten
```

### Backend-Struktur
```
app/
├── api/                # API-Endpunkte
├── core/               # Kernkonfiguration
├── db/                 # Datenbankmodelle und -konfiguration
├── services/           # Business Logic Services
└── utils/              # Hilfsfunktionen
```

## Non-functional Requirements
- **Performance**: Flüssige und reaktionsschnelle App, sowohl online als auch offline
- **Sicherheit**: Hohe Sicherheitsstandards bei der Speicherung von sensiblen Finanzdaten
- **Benutzerfreundlichkeit**: Intuitive Bedienung und ansprechendes Design
- **Skalierbarkeit**: Unterstützung für wachsende Anzahl von Benutzern und Mandanten
- **Plattformen**: Web-App (responsive Design für Desktop und mobile Geräte)

## Entwicklungsrichtlinien
- **Offline-First**: Vollständige Funktionalität ohne Internetverbindung
- **Multi-Tenant**: Strikte Datenisolation zwischen Mandanten
- **IndexedDB-basiert**: Moderne Datenpersistierung für Performance und Skalierbarkeit
- **Sync-Integration**: Nahtlose bidirektionale Synchronisation mit Backend
