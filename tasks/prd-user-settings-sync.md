# Product Requirements Document (PRD): Zuverlässige Synchronisation der Benutzereinstellungen

## 1. Introduction/Overview

Aktuell werden die Benutzereinstellungen (z.B. Loglevel-Tiefe, Theme) nicht korrekt zwischen dem Frontend und dem Backend synchronisiert. Wenn ein Benutzer eine neue Browser-Session startet, werden die im Backend (`users.db`) gespeicherten Einstellungen nicht zuverlässig ins Frontend übernommen. Umgekehrt werden im Frontend getätigte Änderungen nicht konsistent ins Backend zurückgeschrieben. Dies führt zu einer inkonsistenten User Experience. Ziel dieses Features ist es, eine robuste, bidirektionale Synchronisation für alle Benutzereinstellungen zu etablieren, wobei das Backend die maßgebliche Quelle ("Source of Truth") ist.

## 2. Goals

*   Sicherstellung, dass beim Login eines Benutzers alle seine Einstellungen aus der `users.db` im Backend geladen und im Frontend (`userStore`/`settingsStore`) angewendet werden.
*   Implementierung eines Mechanismus, der Änderungen an den Benutzereinstellungen im Frontend sofort und zuverlässig in die `users.db` im Backend synchronisiert.
*   Gewährleistung einer konsistenten User Experience über verschiedene Sessions und Geräte hinweg.

## 3. User Stories

*   "Als Benutzer möchte ich, dass meine Einstellungen (wie die Loglevel-Tiefe oder das Theme) beim Login korrekt aus meinem Profil geladen werden, damit die App sich sofort wie von mir konfiguriert verhält."
*   "Als Benutzer möchte ich, dass Änderungen an meinen Einstellungen sofort gespeichert und synchronisiert werden, damit sie auf allen meinen Geräten konsistent sind."

## 4. Functional Requirements

1.  Unmittelbar nach einem erfolgreichen Login MUSS das Frontend eine Anfrage an das Backend senden, um die vollständigen Benutzereinstellungen für den angemeldeten Benutzer abzurufen.
2.  Die abgerufenen Einstellungen MÜSSEN alle relevanten Daten aus der `users.db` umfassen (insbesondere Loglevel-Tiefe, Theme und andere im `userStore`/`settingsStore` verwaltete Werte).
3.  Das Frontend MUSS die empfangenen Einstellungen in den entsprechenden Pinia-Stores (`userStore`, `settingsStore`) speichern und die UI entsprechend aktualisieren.
4.  Jede Änderung einer Benutzereinstellung im Frontend (z.B. durch ein Einstellungsformular) MUSS eine sofortige API-Anfrage an das Backend auslösen, um die `users.db` zu aktualisieren.
5.  Das Backend MUSS einen Endpunkt (z.B. `PUT /api/v1/users/me/settings`) bereitstellen, der die übermittelten Einstellungswerte validiert und für den authentifizierten Benutzer in der `users.db` speichert.
6.  Die Synchronisation MUSS für alle in den Stores `userStore` und `settingsStore` definierten und für den Benutzer relevanten Einstellungen implementiert werden.

## 5. Non-Goals (Out of Scope)

*   Es werden keine neuen Benutzereinstellungen hinzugefügt. Der Fokus liegt ausschließlich auf der Synchronisation der bestehenden.
*   Die Benutzeroberfläche der Einstellungsseiten wird nicht verändert.

## 6. Technical Considerations

*   Das Backend (`User.db`) wird als "Source of Truth" definiert. Bei Konflikten haben die Daten aus dem Backend Vorrang.
*   Die bestehende WebSocket-Verbindung könnte für die Synchronisation genutzt werden, um die Latenz zu verringern, alternativ sind dedizierte REST-Endpunkte zu verwenden.
*   Die Logik zum Laden der Einstellungen sollte im `sessionStore` oder einem dedizierten `AuthService` nach erfolgreicher Authentifizierung ausgelöst werden.
*   Die zu synchronisierenden Felder müssen klar definiert werden, um zu vermeiden, dass sensible oder interne Daten unnötig zwischen Client und Server ausgetauscht werden.

## 7. Success Metrics

*   **Akzeptanzkriterium 1:** Nach dem Login eines Benutzers entspricht der Zustand der `userStore`- und `settingsStore`-Variablen im Frontend exakt den Werten in der `users.db` des Backends.
*   **Akzeptanzkriterium 2:** Eine im Frontend geänderte und gespeicherte Einstellung (z.B. Theme von hell auf dunkel) wird nachweislich in der `users.db` aktualisiert und bleibt nach einem Neuladen der Seite oder einem neuen Login erhalten.
*   **Benutzer-Feedback:** Reduzierung von Meldungen über inkonsistente oder nicht gespeicherte Einstellungen.
