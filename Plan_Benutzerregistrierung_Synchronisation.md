# Plan: Benutzerregistrierung und Synchronisation in FinWise

## Ziel

Sicherstellen, dass Benutzerregistrierungen (online und offline) korrekt behandelt, Benutzerdaten (ohne Passwort-Hash) zwischen Frontend (IndexedDB) und Backend synchronisiert und LocalStorage-Abhängigkeiten entfernt werden.

## Analyse der aktuellen Situation

Basierend auf der Analyse von [`src/stores/userStore.ts`](src/stores/userStore.ts), [`src/services/apiService.ts`](src/services/apiService.ts) und [`src/stores/sessionStore.ts`](src/stores/sessionStore.ts) wurden folgende Probleme identifiziert:

*   Die Frontend-Registrierung speichert Benutzer nur lokal in IndexedDB und synchronisiert Passwörter nicht mit dem Backend.
*   Passwort-Hashes werden nicht persistent in der IndexedDB gespeichert.
*   Die `syncUsers`-Logik im Frontend ist unvollständig für das Pushen neuer oder geänderter Benutzer zum Backend und behandelt Passwörter nicht.
*   `localStorage` wird immer noch für die Sitzungsverwaltung verwendet.

## Detaillierter Plan

### Frontend-Änderungen

1.  **`src/stores/userStore.ts`:**
    *   **`DbUser` Struktur:** Entfernen Sie `passwordHash` aus der `DbUser`-Schnittstelle und der Dexie-Store-Definition.
    *   **`registerUser` Funktion:**
        *   Fokus auf **Online-Registrierung** über eine neue `apiService.registerUserWithPassword` Methode.
        *   Bei Erfolg: Speichern Sie die vom Backend zurückgegebenen Benutzerdaten (ohne Passwort-Hash) in der IndexedDB (`db.dbUsers.put`).
        *   Bei Offline-Status/Fehler: Speichern Sie den Benutzer lokal mit einem Flag `needsBackendSync: true`. **Kein Klartext-Passwort speichern.**
    *   **`syncUsers` Funktion:**
        *   Behalten Sie den Pull-Mechanismus (`apiService.getUsers`) bei.
        *   Erweitern Sie die Logik, um geänderte lokale Benutzer (ohne `needsBackendSync`) per `apiService.updateUser` zum Backend zu pushen.
        *   Identifizieren Sie lokale Benutzer mit `needsBackendSync: true` und pushen Sie deren Daten (ohne Passwort) per `apiService.createUser`. Setzen Sie `needsBackendSync` auf `false` nach erfolgreichem Push.
        *   Implementieren Sie eine robuste Konfliktlösungsstrategie (derzeit: Backend-Zeitstempel bevorzugen).
    *   **`validateLogin` Funktion:**
        *   Primär **Online-Login** über eine neue `apiService.login` Methode.
        *   Bei Erfolg: Speichern Sie Benutzerdaten (inkl. Tokens) in IndexedDB und State.
        *   Offline-Login nur für zuvor online gewesene Benutzer, basierend auf IndexedDB-Daten (ohne Passwort-Validierung im Offline-Modus, Fokus auf Backend-Authentifizierung).
    *   **Entfernung von LocalStorage:** Löschen Sie alle Verweise auf `localStorage`.

2.  **`src/stores/sessionStore.ts`:**
    *   **Entfernung von LocalStorage:** Löschen Sie alle Verweise auf `localStorage`.
    *   **Persistenz in IndexedDB:** Speichern Sie `currentUserId` und `currentTenantId` in der IndexedDB (z.B. in einer separaten Tabelle).
    *   **`loadSession` Funktion:** Passen Sie diese an, um Session-Daten aus der IndexedDB zu lesen.

3.  **`src/services/apiService.ts`:**
    *   **Neue Methode `registerUserWithPassword`:** `POST` mit Username, E-Mail, Klartext-Passwort.
    *   **Neue Methode `login`:** `POST` mit Username/E-Mail, Klartext-Passwort.
    *   **Anpassung `createUser`:** Akzeptiert Benutzerdaten **ohne Passwort** (für Offline-Sync).
    *   **Neue Methode `updateUser`:** `PUT /users/{uuid}` mit aktualisierten Benutzerdaten (ohne Passwort).

### Backend-Änderungen

1.  **Benutzer-Modell/Schema:**
    *   Feld für gehashten Passwort-Hash.
    *   Feld für Frontend-generierte UUID.
    *   `createdAt` und `updatedAt` Felder.
2.  **API-Endpunkte:**
    *   **Neuer Endpoint `POST /register`:** Akzeptiert Username, E-Mail, Klartext-Passwort. Hasht Passwort, erstellt Benutzer, gibt Benutzerdaten (ohne Hash) zurück.
    *   **Neuer Endpoint `POST /login`:** Akzeptiert Username/E-Mail, Klartext-Passwort. Validiert, gibt Benutzerdaten und Tokens zurück.
    *   **Anpassung `POST /users`:** Akzeptiert Benutzerdaten (inkl. Frontend-UUID) **ohne Passwort**. Findet/erstellt/aktualisiert Benutzer.
    *   **Neuer Endpoint `PUT /users/{uuid}`:** Akzeptiert Benutzerdaten (ohne Passwort), aktualisiert Benutzer.
    *   **Anpassung `GET /users`:** Gibt **keine Passwort-Hashes** zurück.
3.  **Synchronisationslogik (Backend-Seite):**
    *   Implementieren Sie Logik in den Endpunkten `POST /users` und `PUT /users/{uuid}` zur Handhabung eingehender Daten, Konflikterkennung und Zusammenführung basierend auf UUID und Zeitstempeln.

### Synchronisationsfluss

```mermaid
sequenceDiagram
    participant User as Benutzer
    participant Frontend as Frontend (Vue/IndexedDB)
    participant Backend as Backend (FastAPI/DB)

    User->>Frontend: Registrieren (Username, Email, Passwort)
    alt Online
        Frontend->>Backend: POST /register (Username, Email, Passwort)
        Backend-->>Backend: Passwort hashen & speichern
        Backend-->>Backend: Benutzer in DB erstellen
        Backend-->>Frontend: 201 Created (User Data: UUID, Username, Email, TS)
        Frontend-->>Frontend: User Data in IndexedDB speichern
        Frontend-->>Frontend: User State aktualisieren
    else Offline
        Frontend-->>Frontend: Passwort hashen
        Frontend-->>Frontend: User Data (inkl. Hash) in IndexedDB speichern
        Frontend-->>Frontend: User als "needsBackendSync" markieren
        Frontend-->>User: Registrierung lokal erfolgreich (Backend-Sync ausstehend)
    end

    User->>Frontend: App online / Sync triggern
    Frontend->>Backend: GET /users
    Backend-->>Backend: Benutzer aus DB abrufen (ohne Passwörter)
    Backend-->>Frontend: 200 OK (Liste der Backend User Data)
    Frontend-->>Frontend: Backend User Data mit IndexedDB vergleichen (UUID, updatedAt)
    Frontend-->>Frontend: Lokale IndexedDB aktualisieren (bulkPut für neuere Backend-Daten)

    Frontend-->>Frontend: Lokale User mit "needsBackendSync" identifizieren
    loop Für jeden "needsBackendSync" User
        Frontend->>Backend: POST /users (User Data: UUID, Username, Email, TS)
        Backend-->>Backend: User anhand UUID finden/erstellen/aktualisieren (ohne Passwort)
        Backend-->>Frontend: 200 OK / 201 Created (Aktualisierte User Data vom Backend)
        Frontend-->>Frontend: Lokalen User in IndexedDB aktualisieren (UUID, TS), "needsBackendSync" = false
    end

    Frontend-->>Frontend: Lokale User identifizieren, die neuer sind als Backend
    loop Für jeden neueren lokalen User
        Frontend->>Backend: PUT /users/{uuid} (Aktualisierte User Data: Username, Email, TS)
        Backend-->>Backend: User anhand UUID finden & aktualisieren
        Backend-->>Frontend: 200 OK (Aktualisierte User Data vom Backend)
        Frontend-->>Frontend: Lokalen User in IndexedDB aktualisieren (TS)
    end

    Frontend-->>Frontend: UI State neu laden
