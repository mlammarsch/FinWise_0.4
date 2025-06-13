# Product Requirements Document: Konten- und Kontogruppen-Synchronisation

## 1. Introduction/Overview

**Problem:** Aktuell erfolgt die Synchronisation von Konten (`account`) und Kontogruppen (`accountGroup`) nur über die `syncQueue`, wenn das Backend offline ist. Bei einer Online-Verbindung wird die direkte Synchronisation über die API zwar geloggt ("noch nicht implementiert"), aber nicht durchgeführt.

**Goal:** Implementierung der direkten Online-Synchronisation für neu angelegte oder geänderte Konten (`account`) und Kontogruppen (`accountGroup`) zwischen Frontend und Backend. Die Synchronisation soll asynchron erfolgen, um die Frontend-Performance nicht zu beeinträchtigen. Die `syncQueue` soll nur noch im Offline-Betrieb genutzt werden.

## 2. Goals

*   Ermöglichen der sofortigen Synchronisation von Konten und Kontogruppen bei bestehender Online-Verbindung zum Backend.
*   Sicherstellen, dass die Synchronisation asynchron verläuft, um das Frontend nicht zu blockieren.
*   Reduzierung der Abhängigkeit von der `syncQueue` auf reine Offline-Szenarien.
*   Bereitstellung der notwendigen Backend-Endpunkte für `account` und `accountGroup`.
*   Anpassung des Frontends zur Nutzung der neuen Online-Synchronisationslogik.

## 3. User Stories

*   "Als Benutzer möchte ich, dass meine neu angelegten oder geänderten Konten sofort mit dem Backend synchronisiert werden, sofern eine Online-Verbindung (z.B. über WebSocket) besteht, damit ich von allen Geräten auf die aktuellen Daten zugreifen kann."
*   "Als Benutzer möchte ich, dass meine neu angelegten oder geänderten Kontogruppen sofort mit dem Backend synchronisiert werden, sofern eine Online-Verbindung besteht, damit die Struktur meiner Finanzen auf allen Geräten konsistent ist."
*   "Als Benutzer möchte ich, dass die Synchronisation im Hintergrund geschieht, ohne die Bedienbarkeit der Anwendung zu verlangsamen."
*   "Als Benutzer möchte ich, dass im Offline-Zustand weiterhin die `syncQueue` verwendet wird, um Datenverlust zu vermeiden."

## 4. Functional Requirements

1.  Das Backend muss neue API-Endpunkte für das Erstellen, Aktualisieren und Löschen von `account`-Entitäten bereitstellen.
2.  Das Backend muss neue API-Endpunkte für das Erstellen, Aktualisieren und Löschen von `accountGroup`-Entitäten bereitstellen.
3.  Das Frontend muss erkennen, ob eine Online-Verbindung zum Backend besteht.
4.  Wenn eine Online-Verbindung besteht, muss das Frontend beim Erstellen/Ändern/Löschen eines Kontos die entsprechenden Daten direkt und asynchron an den neuen Backend-Endpunkt senden.
5.  Wenn eine Online-Verbindung besteht, muss das Frontend beim Erstellen/Ändern/Löschen einer Kontogruppe die entsprechenden Daten direkt und asynchron an den neuen Backend-Endpunkt senden.
6.  Wenn keine Online-Verbindung besteht, muss das Frontend die Änderungen an Konten und Kontogruppen weiterhin in der `syncQueue` speichern.
7.  Die bestehende Logik für die `syncQueue` im Offline-Fall muss unberührt bleiben oder entsprechend angepasst werden, um Konflikte zu vermeiden.
8.  Fehler bei der direkten Online-Synchronisation (z.B. Netzwerkprobleme, Serverfehler) müssen abgefangen und dem Benutzer ggf. signalisiert werden. In solchen Fällen könnte ein Fallback zur `syncQueue` erwogen werden.

## 5. Non-Goals (Out of Scope)

*   Änderungen an der Synchronisation anderer Datenentitäten (z.B. Transaktionen, Budgets), es sei denn, sie sind direkte Abhängigkeiten.
*   Umfassende Neugestaltung des bestehenden Offline-Synchronisationsmechanismus über die `syncQueue`.
*   Implementierung von Konfliktlösungsstrategien, die über das bisherige Maß hinausgehen.

## 6. Design Considerations (Optional)

*   Das Design ist laut Benutzer bereits implementiert und erfordert keine Änderungen.

## 7. Technical Considerations (Optional)

*   **Backend:**
    *   Erstellung von FastAPI-Endpunkten für CRUD-Operationen auf `account` und `accountGroup`.
    *   Sicherstellung der korrekten Authentifizierung und Autorisierung für diese Endpunkte.
    *   Validierung der eingehenden Daten (Pydantic-Modelle).
    *   Interaktion mit der Datenbank (SQLAlchemy/SQLModel) zur Persistierung der Änderungen in der jeweiligen `tenant_databases`.
*   **Frontend:**
    *   Anpassung der Vue-Stores (Pinia) für Konten und Kontogruppen, um die neue Online-Synchronisationslogik zu integrieren.
    *   Nutzung von `fetch` oder `axios` für die asynchronen API-Aufrufe.
    *   Implementierung einer Logik zur Prüfung des Online-Status (ggf. über WebSocket-Status oder regelmäßige Pings).
    *   Die Implementierung muss den Regeln unter `C:\00_mldata\programming\FinWise\FinWise_0.4\.kilocode\rules\code-rules.md` (insbesondere Punkt 10 "Code Changes") folgen, d.h. keine Umbenennung bestehender Methoden in Stores, Änderungen primär auf Store-Ebene.

## 8. Success Metrics

*   Neu angelegte oder geänderte Konten sind bei bestehender Online-Verbindung unmittelbar in der Backend-TenantDB sichtbar.
*   Neu angelegte oder geänderte Kontogruppen sind bei bestehender Online-Verbindung unmittelbar in der Backend-TenantDB sichtbar.
*   Die Frontend-Anwendung bleibt während des Synchronisationsvorgangs responsiv.
*   Im Offline-Modus funktioniert die Synchronisation weiterhin zuverlässig über die `syncQueue`.

## 9. Open Questions

*   (Vorerst keine)
