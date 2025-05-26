# Plan: Mandantenregistrierung und Synchronisation in FinWise

## Ziel

Sicherstellen, dass Mandantenregistrierungen (online und offline) korrekt behandelt, Mandantendaten zwischen Frontend (IndexedDB) und Backend synchronisiert und die zugehörigen Mandanten-Datenbanken im Backend erstellt und verwaltet werden.

## Analyse der aktuellen Situation

Basierend auf der Analyse von [`src/views/auth/TenantSelectView.vue`](src/views/auth/TenantSelectView.vue), [`src/services/TenantService.ts`](src/services/TenantService.ts) und [`Plan_Benutzerregistrierung_Synchronisation.md`](Plan_Benutzerregistrierung_Synchronisation.md) wurden folgende Punkte identifiziert:

*   Die Frontend-Erstellung eines Mandanten erfolgt derzeit nur lokal in IndexedDB.
*   Es gibt keine Synchronisationslogik, um neue oder geänderte Mandanten an das Backend zu senden.
*   Die Erstellung der mandantenspezifischen Datenbank im Backend fehlt noch.
*   Der bestehende Plan für die Benutzersynchronisation bietet eine geeignete Struktur und Logik, die auf Mandanten übertragen werden kann.

## Detaillierter Plan

#### Frontend-Änderungen

1.  **`src/stores/tenantStore.ts`:**
    *   Erweitern Sie die `Tenant`-Schnittstelle und die Dexie-Store-Definition um ein Flag `needsBackendSync: boolean` (Standard: `false`).
    *   Passen Sie die `addTenant`-Funktion an: Wenn ein neuer Mandant erstellt wird, setzen Sie `needsBackendSync` auf `true`.
    *   Implementieren Sie eine `syncTenants`-Funktion (ähnlich `syncUsers` in `userStore`), die:
        *   Mandanten vom Backend abruft (`apiService.getTenants`).
        *   Lokale Mandantendaten mit Backend-Daten vergleicht (basierend auf UUID und einem `updatedAt`-Zeitstempel, der noch im Backend-Modell hinzugefügt werden muss).
        *   Lokale IndexedDB aktualisiert (bulkPut für neuere Backend-Daten).
        *   Lokale Mandanten mit `needsBackendSync: true` identifiziert und deren Daten per `apiService.createTenant` (neu zu erstellen) an das Backend sendet. Setzen Sie `needsBackendSync` auf `false` nach erfolgreichem Push.
        *   Lokale Mandanten identifiziert, die neuer sind als im Backend (ohne `needsBackendSync`), und diese per `apiService.updateTenant` (neu zu erstellen) an das Backend sendet.
        *   Eine Konfliktlösungsstrategie implementiert (z.B. Backend-Zeitstempel bevorzugen).

2.  **`src/services/TenantService.ts`:**
    *   Passen Sie die `createTenant`-Funktion an: Nach dem lokalen Hinzufügen des Mandanten im `tenantStore` (mit `needsBackendSync: true`) sollte die Synchronisation angestoßen werden, falls eine Online-Verbindung besteht. Dies kann durch Aufruf der neuen `syncTenants`-Funktion im `tenantStore` erfolgen.
    *   Stellen Sie sicher, dass `switchTenant` die Daten für den ausgewählten Mandanten korrekt lädt (dies scheint bereits über `DataService.reloadTenantData()` zu geschehen).

3.  **`src/services/apiService.ts`:**
    *   **Neue Methode `createTenant`:** `POST /tenants` (neu zu erstellen im Backend). Akzeptiert Mandantendaten (inkl. Frontend-generierter UUID, Name, User-ID).
    *   **Neue Methode `updateTenant`:** `PUT /tenants/{uuid}` (neu zu erstellen im Backend). Akzeptiert aktualisierte Mandantendaten.
    *   **Anpassung `getTenants`:** Stellt sicher, dass diese Methode eine Liste der Mandanten des eingeloggten Benutzers vom Backend abruft.

#### Backend-Änderungen

1.  **Mandanten-Modell/Schema:**
    *   Feld für Frontend-generierte UUID.
    *   Feld für `createdAt` und `updatedAt` Zeitstempel.
    *   Verknüpfung zum Benutzer-Modell (ein Benutzer kann mehrere Mandanten haben).

2.  **API-Endpunkte:**
    *   **Neuer Endpoint `POST /tenants`:**
        *   Akzeptiert Mandantendaten (UUID, Name, User-ID).
        *   Erstellt den Mandanten in der zentralen Benutzerdatenbank (`auth.db`).
        *   **WICHTIG:** Erstellt die zugehörige mandantenspezifische SQLite-Datenbank (`data/{tenant_uuid}.db`).
        *   Gibt die erstellten Mandantendaten (inkl. Backend-Zeitstempel) zurück.
    *   **Neuer Endpoint `PUT /tenants/{uuid}`:**
        *   Akzeptiert aktualisierte Mandantendaten.
        *   Findet den Mandanten anhand der UUID in der zentralen Datenbank.
        *   Aktualisiert die Mandantendaten.
        *   Gibt die aktualisierten Mandantendaten zurück.
    *   **Anpassung `GET /tenants`:** Gibt eine Liste der Mandanten zurück, die dem eingeloggten Benutzer gehören.

3.  **Synchronisationslogik (Backend-Seite):**
    *   Implementieren Sie Logik in den Endpunkten `POST /tenants` und `PUT /tenants/{uuid}` zur Handhabung eingehender Daten, Konflikterkennung und Zusammenführung basierend auf UUID und Zeitstempeln.
    *   Stellen Sie sicher, dass bei der Erstellung eines Mandanten über `POST /tenants` die physische SQLite-Datei für die Mandanten-Datenbank angelegt wird.

4.  **Datenbank-Prüfung:**
    *   Implementieren Sie im Backend eine Logik, die bei jedem Zugriff auf mandantenspezifische Daten prüft, ob die zugehörige Datenbankdatei existiert. Falls nicht, sollte sie erstellt werden. Dies kann z.B. beim ersten Laden der Daten für einen Mandanten oder beim Wechsel zu einem Mandanten geschehen.

### Synchronisationsfluss für Mandanten

```mermaid
sequenceDiagram
    participant User as Benutzer
    participant Frontend as Frontend (Vue/IndexedDB)
    participant Backend as Backend (FastAPI/DB)

    User->>Frontend: Neuen Mandanten anlegen (Name)
    Frontend-->>Frontend: UUID generieren
    Frontend-->>Frontend: Mandant lokal in IndexedDB speichern (needsBackendSync: true)
    Frontend-->>Frontend: Zum neuen Mandanten wechseln (Session Store)
    Frontend-->>Frontend: Daten für neuen Mandanten laden (IndexedDB)
    alt Online
        Frontend->>Backend: POST /tenants (UUID, Name, User-ID)
        Backend-->>Backend: Mandant in zentraler DB erstellen
        Backend-->>Backend: Mandanten-Datenbank (data/{uuid}.db) erstellen
        Backend-->>Frontend: 201 Created (Tenant Data: UUID, Name, User-ID, TS)
        Frontend-->>Frontend: Lokalen Mandanten in IndexedDB aktualisieren (TS), needsBackendSync = false
    else Offline
        Frontend-->>User: Mandant lokal angelegt (Backend-Sync ausstehend)
    end

    User->>Frontend: App online / Sync triggern
    Frontend->>Backend: GET /tenants (für eingeloggten User)
    Backend-->>Backend: Mandanten des Users aus zentraler DB abrufen
    Backend-->>Frontend: 200 OK (Liste der Backend Tenant Data)
    Frontend-->>Frontend: Backend Tenant Data mit IndexedDB vergleichen (UUID, updatedAt)
    Frontend-->>Frontend: Lokale IndexedDB aktualisieren (bulkPut für neuere Backend-Daten)

    Frontend-->>Frontend: Lokale Tenants mit "needsBackendSync" identifizieren
    loop Für jeden "needsBackendSync" Tenant
        Frontend->>Backend: POST /tenants (Tenant Data: UUID, Name, User-ID)
        Backend-->>Backend: Tenant anhand UUID finden/erstellen (in zentraler DB)
        Backend-->>Backend: Mandanten-Datenbank (data/{uuid}.db) erstellen (falls nicht existiert)
        Backend-->>Frontend: 200 OK / 201 Created (Aktualisierte Tenant Data vom Backend)
        Frontend-->>Frontend: Lokalen Tenant in IndexedDB aktualisieren (UUID, TS), needsBackendSync = false
    end

    Frontend-->>Frontend: Lokale Tenants identifizieren, die neuer sind als Backend (ohne needsBackendSync)
    loop Für jeden neueren lokalen Tenant
        Frontend->>Backend: PUT /tenants/{uuid} (Aktualisierte Tenant Data: Name, TS)
        Backend-->>Backend: Tenant anhand UUID finden & aktualisieren (in zentraler DB)
        Backend-->>Frontend: 200 OK (Aktualisierte Tenant Data vom Backend)
        Frontend-->>Frontend: Lokalen Tenant in IndexedDB aktualisieren (TS)
    end

    Frontend-->>Frontend: UI State neu laden / Daten des aktiven Tenants laden
