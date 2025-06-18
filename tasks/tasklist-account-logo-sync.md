# Taskliste: Account & Account Group Logo Synchronisation

## 1. [x] Datenmodell-Anpassungen

1.1. [x] Backend: Datenbanktabelle `accounts` um ein Feld für den Logo-Pfad erweitern (z.B. `logo_path`) (FR2.3, TechConsideration 7.8.2)
1.2. [x] Backend: Datenbanktabelle `account_groups` um ein Feld für den Logo-Pfad erweitern (z.B. `logo_path`) (FR2.3, TechConsideration 7.8.2)
1.3. [x] Frontend: Interface `Account` in [`src/types/index.ts`](src/types/index.ts:1) um ein Feld für den Logo-Pfad erweitern (z.B. `logoUrl` oder `logoPath`) (TechConsideration 7.8.2)
1.4. [x] Frontend: Interface `AccountGroup` in [`src/types/index.ts`](src/types/index.ts:1) um ein Feld für den Logo-Pfad erweitern (z.B. `logoUrl` oder `logoPath`) (TechConsideration 7.8.2)

## 2. Backend-Anpassungen

2.1. [ ] Backend: Umgebungsvariable (z.B. `LOGO_STORAGE_PATH`) für den Basispfad der Logo-Speicherung implementieren und auslesbar machen (FR2.2, TechConsideration 7.7.7)
2.2. [ ] Backend: Service für die Verarbeitung von Bild-Uploads erstellen (Speichern, Löschen, Bereitstellen) (TechConsideration 7.7.4)
2.3. [ ] Backend: API-Endpunkt zum Hochladen von Logos implementieren (akzeptiert Konto-ID/Kontengruppen-ID) (FR2.4)
    2.3.1. [ ] Backend: Sicherstellen, dass Dateinamen eindeutig sind oder in einer Struktur gespeichert werden, die Kollisionen vermeidet (z.B. Unterordner pro Mandant oder UUIDs als Dateinamen) (TechConsideration 7.7.6)
    2.3.2. [ ] Backend: Unterstützung für Dateiformate PNG und JPG implementieren (FR2.7)
    2.3.3. [ ] Backend: Mime-Typ des Bildes implizit (Dateiendung) oder explizit speichern (FR2.8)
    2.3.4. [ ] Backend: Validierung des Dateiformats (nur PNG/JPG) beim Upload (OpenQuestion 2.1)
2.4. [ ] Backend: API-Endpunkt zum Löschen von Logos implementieren (FR2.5)
    2.4.1. [ ] Backend: Physisches Löschen der Logo-Datei vom Speicher beim Löschen des Logos (OpenQuestion 3.1)
    2.4.2. [ ] Backend: Physisches Löschen der Logo-Datei vom Speicher beim Löschen des zugehörigen Kontos/Kontengruppe (OpenQuestion 3.1)
2.5. [ ] Backend: API-Endpunkt zum Abrufen von Logos implementieren (z.B. `/api/v1/logos/{logo_filename_or_id}`) (FR2.6)
    2.5.1. [ ] Backend: Mime-Typ beim Abruf des Logos korrekt übermitteln (FR2.8)
2.6. [ ] Backend: API-Endpunkte für Logos gegen unbefugten Zugriff sichern (TechConsideration 7.7.5)
2.7. [ ] Backend: Relativen Pfad oder eindeutigen Bezeichner zum Logo in `accounts` Tabelle speichern/aktualisieren (FR2.3)
2.8. [ ] Backend: Relativen Pfad oder eindeutigen Bezeichner zum Logo in `account_groups` Tabelle speichern/aktualisieren (FR2.3)

## 3. Frontend-Anpassungen

3.1. [ ] Frontend: UI-Elemente für Upload, Änderung und Löschen von Logos in den Bearbeitungsmodus von Konten integrieren (FR3.2, DesignConsideration 6.6.7)
3.2. [ ] Frontend: UI-Elemente für Upload, Änderung und Löschen von Logos in den Bearbeitungsmodus von Kontengruppen integrieren (FR1.5, FR3.2, DesignConsideration 6.6.7)
3.3. [ ] Frontend: [`AccountCard.vue`](src/components/account/AccountCard.vue:1) anpassen, um das zugeordnete Logo anzuzeigen (FR3.1)
    3.3.1. [ ] Frontend: Standardbild anzeigen, wenn kein Logo vorhanden oder gelöscht (FR1.4)
3.4. [ ] Frontend: [`AccountGroupCard.vue`](src/components/account/AccountGroupCard.vue:1) anpassen, um das zugeordnete Logo anzuzeigen (FR1.5, FR3.1)
    3.4.1. [ ] Frontend: Standardbild anzeigen, wenn kein Logo vorhanden oder gelöscht (FR1.5, FR1.4)
3.5. [ ] Frontend: Service-Layer Logik (z.B. in `AccountService`, `AccountGroupService` oder neuem `ImageService`) implementieren für:
    3.5.1. [ ] Hochladen von Logos (Interaktion mit Backend-Endpunkt) (FR3.4, TechConsideration 7.8.0)
    3.5.2. [ ] Löschen von Logos (Interaktion mit Backend-Endpunkt) (FR3.4, TechConsideration 7.8.0)
    3.5.3. [ ] Abrufen von Logos vom Backend (TechConsideration 7.8.0)
    3.5.4. [ ] Korrekte Interpretation des Logo-Pfads vom Backend zur Konstruktion der vollständigen URL (TechConsideration 7.8.1)
3.6. [ ] Frontend: Feedback-Mechanismus für den Benutzer während des Logo-Uploads implementieren (Fortschritt, Erfolg/Misserfolg) (DesignConsideration 6.6.8)
3.7. [ ] Frontend: Benutzerfreundliche Fehlermeldungen bei fehlgeschlagenen Uploads oder nicht darstellbaren Bildern (DesignConsideration 6.6.9)
    3.7.1. [ ] Frontend: Mehrfachen Upload-Versuch implementieren, falls Endpunkt nicht erreichbar (max. 3 Versuche) (OpenQuestion 2.2)
3.8. [ ] Frontend: Sicherstellen, dass nach erfolgreichem Upload/Änderung/Löschen und Datenabruf das Logo auf anderen Client-Geräten korrekt angezeigt wird (FR3.3)

## 4. Caching & Offline-Verhalten

4.1. [ ] Frontend: Caching-Strategie für Logos in IndexedDB implementieren (Speicherung als Base64-String oder Blob) (FR4.1, TechConsideration 7.7.9)
4.2. [ ] Frontend: Beim initialen Laden eines Kontos/einer Kontengruppe mit Logo, dieses vom Backend abrufen und im lokalen Cache speichern (FR4.2)
4.3. [ ] Frontend: Logik implementieren, um Logos aus dem lokalen Cache zu laden und anzuzeigen, wenn das Backend nicht erreichbar ist (FR4.3)
4.4. [ ] Frontend: Standardbild anzeigen, wenn Backend nicht erreichbar und kein Logo im Cache vorhanden ist (FR4.4)
4.5. [ ] Frontend: Bei jedem App-Login des Benutzers Logos für initial geladene Konten/Kontengruppen neu vom Backend abrufen und Cache aktualisieren (FR4.5)
4.6. [ ] Frontend: Beim Klick auf den globalen [`SyncButton.vue`](src/components/ui/SyncButton.vue:1) Logos für alle relevanten Entitäten neu vom Backend abrufen und Cache aktualisieren (FR4.6)
4.7. [ ] Frontend: Cache-Eviction-Strategie implementieren: Nur aktuell vom Backend geladene Logos im Cache halten. Bei Löschung auch Cache-Eintrag löschen. Cache nur weiterbehalten, wenn Reload vom Backend fehlschlägt. (OpenQuestion 4.1)
