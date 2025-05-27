# Synchronisierungsstrategie für FinWise Frontend (IndexedDB) und Backend (FastAPI)

## 1. Einleitung

Dieses Dokument beschreibt die geplante bidirektionale Synchronisierungsstrategie für die FinWise-Anwendung. Ziel ist es, eine Offline-fähige Anwendung zu realisieren, bei der Daten lokal in IndexedDB gespeichert und asynchron mit einem FastAPI-Backend synchronisiert werden.

## 2. Empfohlene Synchronisierungsstrategie: Delta-Synchronisierung mit Zeitstempeln

Wir implementieren eine Delta-Synchronisierung basierend auf `created_at` und `updated_at` Zeitstempeln. Jede synchronisierte Entität (z.B. `Account`, `AccountGroup`) im Frontend (IndexedDB) und Backend erhält diese Felder.

*   **Frontend zu Backend:** Lokale Änderungen werden mit einem aktuellen `updated_at` versehen und in einer lokalen "Sync-Queue" (IndexedDB-Tabelle) gespeichert. Ein Hintergrundprozess sendet diese Änderungen bei verfügbarer Verbindung an das Backend. Bei Erfolg werden sie aus der Queue entfernt.
*   **Backend zu Frontend:** Das Frontend speichert den Zeitstempel der letzten erfolgreichen Synchronisierung pro Entitätstyp (`last_synced_at`). Regelmäßig oder nach Verbindungsaufbau fragt das Frontend das Backend nach Änderungen seit diesem Zeitstempel ab. Das Backend liefert geänderte Entitäten, die das Frontend zur Aktualisierung der lokalen IndexedDB nutzt und den `last_synced_at` aktualisiert.

## 3. Konfliktlösungsmechanismus: Last Write Wins (LWW)

Wir verwenden die "Last Write Wins" (LWW) Strategie basierend auf dem `updated_at` Zeitstempel.

*   Bei gleichzeitiger Änderung desselben Datensatzes im Frontend und Backend gewinnt die Version mit dem jüngeren `updated_at`.
*   **Backend zu Frontend Sync:** Wenn eine Backend-Entität empfangen wird, wird ihr `updated_at` mit der lokalen Version verglichen. Ist die Backend-Version neuer, wird die lokale überschrieben. Ist die lokale Version neuer (noch nicht synchronisiert), wird die Backend-Änderung ignoriert, um die lokale nicht zu verlieren. Die lokale Änderung wird erneut gesendet.
*   **Frontend zu Backend Sync:** Das Backend kann ebenfalls einen Zeitstempel-Vergleich durchführen und die eingehende Änderung übernehmen, wenn der `updated_at` der eingehenden Änderung neuer ist.

## 4. Datenfluss

```mermaid
graph TD
    A[Frontend UI] --> B(Pinia Store Action);
    B --> C{Datenänderung?};
    C -- Ja --> D[IndexedDB (TenantDbService)];
    D --> E[Setze updated_at];
    E --> F[Füge Änderung zu syncQueue hinzu];
    F --> G(Hintergrund Sync Prozess);
    G -- Online --> H[Sende Änderung an Backend API];
    H -- Erfolg --> I[Entferne aus syncQueue];
    H -- Offline/Fehler --> J[Bleibt in syncQueue];
    J --> G;

    K[Backend] --> L{Datenänderung?};
    L -- Ja --> M[Setze updated_at];
    M --> N[Backend Datenbank];

    O[Frontend Sync Prozess] --> P[Frage Backend nach Änderungen seit last_synced_at];
    P --> Q[Backend API: /sync/changes];
    Q --> R[Liefere Änderungen];
    R --> S[Frontend Sync Prozess];
    S --> T{Konflikt (LWW)?};
    T -- Backend neuer --> U[Überschreibe lokale IndexedDB];
    T -- Lokal neuer --> V[Ignoriere Backend Änderung (lokale Änderung in syncQueue)];
    U --> W[Aktualisiere last_synced_at];
    V --> W;

    X[Login/Tenant Auswahl] --> Y{IndexedDB leer?};
    Y -- Ja --> Z[Frage Backend nach Initialdaten];
    Z --> AA[Backend API: /sync/initial];
    AA --> BB[Liefere alle Daten];
    BB --> CC[Speichere in IndexedDB];
    CC --> W;

    G --> H;
    S --> T;
    Y --> Z;
```

## 5. Änderungen im Frontend

*   **`TenantDbService.ts`:** Erweiterung um Zeitstempel-Logik bei Schreiboperationen, Methoden für `syncQueue`-Interaktion (Hinzufügen, Abrufen, Entfernen) und Speicherung/Abruf von `last_synced_at`.
*   **`src/stores/tenantStore.ts`:** Erweiterung der `FinwiseTenantSpecificDB` um Tabellen `syncQueue` und `syncMetadata`. Modelle (`Account`, `AccountGroup`) erhalten `created_at` und `updated_at`. Implementierung eines Hintergrund-Synchronisierungsprozesses (ggf. in neuem `syncStore`) und Logik für Erstinitialisierung und Backend-zu-Frontend-Synchronisierung.
*   **Zusätzliche IndexedDB Tabellen:** `syncQueue` (ausstehende Änderungen), `syncMetadata` (Synchronisierungs-Zeitstempel).

## 6. Anforderungen an das Backend

*   **Neue API-Endpunkte:**
    *   `POST /sync/changes`: Empfängt Batch-Änderungen vom Frontend.
    *   `GET /sync/changes/{tenantId}?since={timestamp}`: Liefert Änderungen für einen Mandanten seit Zeitstempel.
    *   `GET /sync/initial/{tenantId}`: Liefert alle Initialdaten für einen Mandanten.
*   **Backend-Modelle:** Synchronisierte Modelle erhalten `created_at` und `updated_at` Felder. Optional `deleted_at` für Soft Deletes.

## 7. Erweiterbarkeit

Die Strategie ist erweiterbar, indem neue Entitäten zur `FinwiseTenantSpecificDB` und den Backend-Sync-Endpunkten hinzugefügt und die CRUD-Logik in den Stores/Services angepasst wird, um Zeitstempel und die `syncQueue` zu nutzen.
