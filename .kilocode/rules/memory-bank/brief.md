## Briefing: Entwicklung einer Haushaltsfinanzplanungs-App

**1. Projektname:** FinWise: Dein smarter Finanzassistent

**2. Projektbeschreibung:**

Entwicklung einer umfassenden Haushaltsfinanzplanungs- und Haushaltskassenführungs-App mit Offline-Funktionalität und Synchronisation mit einem Backend-Server. Die App ermöglicht es Benutzern, ihre Finanzen detailliert zu verwalten, Budgets zu erstellen und ihre Ausgaben zu kategorisieren. Sie bietet auch Prognosefunktionen und Automatisierungsmöglichkeiten für wiederkehrende Transaktionen.

**3. Zielgruppe:**

*   Privatpersonen, die ihre Finanzen effizient planen und verwalten möchten.
*   Benutzer, die Wert auf eine detaillierte Kategorisierung und Analyse ihrer Ausgaben legen.
*   Benutzer, die eine Offline-Funktionalität wünschen, um ihre Finanzen auch ohne Internetverbindung zu verwalten.

**4. Hauptfunktionen:**

*   **Kontoverwaltung:** Hinzufügen, Bearbeiten und Anzeigen von Konten.
*   **Budgetverwaltung:** Erstellung und Verwaltung von Budgets für verschiedene Kategorien.
*   **Kategorien- und Tagsverwaltung:** Definieren und Zuweisen von Kategorien und Tags zu Transaktionen.
*   **Regelverwaltung:** Automatisches Kategorisieren von Transaktionen basierend auf definierten Regeln.
*   **Regelbuchungen:** Erstellung automatischer Buchungen (z.B. monatliche Miete) in definierten Zeitintervallen.
*   **Kontoprognose:** Vorhersage der Kontostände basierend auf vergangenen Transaktionen und geplanten Buchungen.
*   **User- und Mandantenverwaltung:**
    *   Benutzer-Authentifizierung und -Registrierung.
    *   Erstellung und Verwaltung von Mandanten (getrennte Datenbanken pro Mandant).
*   **Offline-Bearbeitung:** Vollständige Funktionalität der App auch ohne Internetverbindung.
*   **Bidirektionale Synchronisation:**
    *   Synchronisation von Daten zwischen Frontend und Backend bei bestehender Internetverbindung.
    *   Erstellung einer Task-Queue für Offline-Änderungen, die automatisch bei Verbindung synchronisiert werden.

**5. Technische Spezifikationen:**

*   **Frontend:**
    *   Technologie: Vite, Vue.js mit TypeScript
    *   Lokale Datenspeicherung: IndexedDB mit Dexie.js
*   **Backend:**
    *   Technologie: FastAPI (Python)
    *   Datenbank: SQLite (getrennte Datenbanken für User-Mandanten-Informationen und pro Mandant).
    *   Authentifizierung: Bcrypt für Passwortverschlüsselung
    *   Kommunikation Frontend/Backend: Websockets und direkte API Endpunkte.
*   **Authentifizierung:** Verwendung von Token-basierter Authentifizierung zwischen Frontend und Backend.

**6. Non-functional Requirements:**

*   **Performance:** Die App soll flüssig und reaktionsschnell sein, sowohl online als auch offline.
*   **Sicherheit:** Hohe Sicherheitsstandards bei der Speicherung von sensiblen Finanzdaten.
*   **Benutzerfreundlichkeit:** Intuitive Bedienung und ansprechendes Design.
*   **Skalierbarkeit:** Das System soll in der Lage sein, eine wachsende Anzahl von Benutzern und Mandanten zu unterstützen.
*   **Plattformen:** Web-App (responsive Design für Desktop und mobile Geräte).

**7. Aktueller Implementierungsstand:**

*   ✅ **Vollständige bidirektionale Synchronisation für Accounts und AccountGroups**
*   ✅ **WebSocket-basierte Echtzeit-Updates zwischen Frontend und Backend**
*   ✅ **IndexedDB-Migration abgeschlossen** (von localStorage zu IndexedDB mit Dexie.js)
*   ✅ **Multi-Tenant-System mit strikter Datentrennung**
*   ✅ **Offline-First-Architektur mit Sync-Queue-System**
*   ✅ **Last-Write-Wins Konfliktlösung implementiert**
*   ✅ **Umfassende Testing-Infrastruktur** (Integration Tests für Sync-Funktionalität)
*   ✅ **Token-basierte Authentifizierung zwischen Frontend und Backend**
*   ✅ **Planning-Funktionalität vollständig implementiert** (PlanningService, PlanningStore, IndexedDB-Integration)
*   ✅ **Komplexe Recurrence-Engine** mit Weekend-Handling und Transfer-Logic
*   ✅ **Auto-Execution für fällige Planungstransaktionen**
*   ✅ **Vitest-Testing-Setup** mit 26 Integration Tests für Sync-Pipeline

**8. Zu erledigende Aufgaben (High-Level):**

*   **Planning-Synchronisation**: Integration von PlanningTransactions in Sync-System
*   **Sync-Acknowledgment-System**: Implementierung von Sync-Bestätigungen (ACK/NACK)
*   **Erweitern der Synchronisation auf weitere Entitäten**: Categories, Transactions, Tags, Recipients
*   **Verbesserung der Sync-Robustheit**: Retry-Mechanismen, bessere Fehlerbehandlung
*   **Performance-Optimierungen**: Paginierung, Lazy Loading, WebSocket-Optimierung
*   **Produktionsreife**: Umfassende End-to-End-Tests, Deployment-Pipeline

**8.  Besondere Anforderungen:**

*   Die Offline-Funktionalität und die bidirektionale Synchronisation sind kritische Erfolgsfaktoren für dieses Projekt.
*   Die Sicherheit der Finanzdaten hat höchste Priorität.
*   Eine klare Trennung der Daten zwischen den Mandanten ist essenziell.

**9. Nächste Schritte:**

*   Planning-Synchronisation implementieren und testen
*   Sync-Acknowledgment-System finalisieren
*   Transaction-Synchronisation als nächste kritische Entität
*   Performance-Optimierungen für große Datenmengen
*   Erweiterte Error-Handling und Recovery-Mechanismen
