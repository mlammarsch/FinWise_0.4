# Coding Rules

Dieses Dokument beschreibt die Coding Rules für unser Projekt. Die Einhaltung dieser Regeln soll die Codequalität, Wartbarkeit und Zusammenarbeit verbessern.

## 1. Encoding & Dateistruktur

*   **UTF-8**: Alle Dateien strikt in UTF-8 speichern, um deutsche Umlaute und Kommentare korrekt darzustellen.
*   **Vue-Dateien**: Die Reihenfolge in Vue-Dateien ist wie folgt:
    1.  `<script setup lang="ts">`
    2.  `<template>`
    3.  `<style lang="postcss" scoped>`

## 2. Namenskonvention

*   **camelCase**: Verwende `camelCase` für Variablen und Funktionen.
*   **PascalCase**: Verwende `PascalCase` für Klassen und Komponenten.
*   **Sprechende Namen**: Wähle sprechende Namen, so dass der Code selbsterklärend ist.

## 3. Methoden & Single Responsibility

*   **Kurz & fokussiert**: Jede Funktion soll maximal eine Aufgabe erfüllen.
*   **Modular**: Zerlege komplexe Abläufe in kleine, übersichtliche Einheiten.

## 4. Self-Documenting Code statt überflüssiger Kommentare

*   **Klare Bezeichner**:  Verwende klare Bezeichner, um das "Was" des Codes zu erklären.
*   **Typen/Interfaces**: Nutze Typen und Interfaces anstelle von Param-Kommentaren.
*   **Why-Kommentare**: Kommentiere nur bei echter Komplexität, um das "Warum" zu erklären.

    ```typescript
    // Berechnet Zins basierend auf Annuitätenformel
    function calculateAnnuityInterest(...) { ... }
    ```

## 5. Kommentar-Regeln

*   **Nur Hauptmethoden und zentrale Elemente** kommentieren.
*   **Keine** langen Erklärungen, Change-Logs oder Versionsvermerke.
*   **Props/Emits** in Vue durch TypeScript-Signaturen dokumentieren:

    ```typescript
    const props = defineProps<{ title: string; isOpen: boolean }>();
    const emit = defineEmits<{
      (e: 'close'): void;
      (e: 'submit', data: FormData): void;
    }>();
    ```

## 6. Logging-Regeln

Die Logging-Regeln unterscheiden sich zwischen Frontend (TypeScript) und Backend (Python).

### Frontend (TypeScript)

Für das Frontend gelten folgende Logging-Konventionen, die typischerweise über eine Wrapper-Funktion oder direkt über `console`-Methoden implementiert werden:

#### `debugLog` (Beispielhafte Implementierung)

*   **Wann?** In komplexen Algorithmen oder Unterprozessen im Frontend zur detaillierten Fehlersuche.
*   **Format:** Flache Objekte per `JSON.stringify()` oder prägnante Strings.
*   **Beispiel:**

    ```typescript
    // Angenommen, es gibt eine Hilfsfunktion console.debug oder einen Wrapper
    console.debug(
      '[TransactionService]', // Modul/Kontext
      `Berechne Saldo für Konto ${accountId} (${accountName})`,
      { total } // Details als Objekt
    );
    ```

#### `infoLog` (Beispielhafte Implementierung)

*   **Wann?** Für End-to-End-Prozesse, nennenswerte Gesamtaktionen im Frontend.
*   **Beispiel:**

    ```typescript
    console.info(
      '[BudgetService]',
      `Budget ${budgetName} (${budgetId}) mit Betrag ${amount} € erstellt`
    );
    ```

#### `warnLog` (Beispielhafte Implementierung)

*   **Wann?** Für beachtenswerte Zustände ohne Fehler im Frontend, die aber auf mögliche Probleme hinweisen könnten.
*   **Beispiel:**

    ```typescript
    console.warn(
      '[SyncService]',
      `Offline-Daten älter als 7 Tage für Nutzer ${userId} (${userName})`
    );
    ```

#### `errorLog` (Beispielhafte Implementierung)

*   **Wann?** Bei echten Laufzeitfehlern im Frontend, die den Benutzerfluss stören.
*   **Beispiel:**

    ```typescript
    console.error(
      '[ApiService]',
      `Fehler beim Laden der Konten für Konto-ID ${accountId}:`,
      error // Das Fehlerobjekt selbst
    );
    ```

### Backend (Python)

Für das Backend werden die zentralisierten Logger-Funktionen aus [`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py) verwendet. Diese Funktionen nehmen standardmäßig `module_name: str`, `message: str` und optional `details: object` entgegen. Die `details` werden als JSON-String formatiert, falls möglich.

#### `debugLog(module_name: str, message: str, details: object = None)` ([`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py))

*   **Wann?** Für detaillierte Informationen während der Entwicklung und Fehlersuche in Backend-Modulen. Nützlich, um den Kontrollfluss und Variablenzustände in komplexen Algorithmen oder spezifischen Unterprozessen nachzuvollziehen.
*   **`module_name`**: Name des Backend-Moduls (z.B. `crud_user`, `sync_service`).
*   **`message`**: Aussagekräftige Beschreibung des geloggten Ereignisses.
*   **`details`**: Optionale strukturierte Daten (z.B. Dictionary, Liste, Exception-Objekt), die zusätzlichen Kontext liefern.
*   **Beispiel:**

    ```python
    # In app/services/authentication_service.py
    from app.utils.logger import debugLog

    user_data = {"id": 123, "username": "testuser", "status": "active"}
    debugLog(
        "AuthService",
        f"Benutzerauthentifizierung gestartet für Benutzer: {user_data['username']}",
        details=user_data
    )
    ```

#### `infoLog(module_name: str, message: str, details: object = None)` ([`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py))

*   **Wann?** Für wichtige Ereignisse und abgeschlossene Operationen im normalen Betriebsablauf des Backends. Markiert den erfolgreichen Abschluss von End-to-End-Prozessen oder signifikanten Aktionen.
*   **Beispiel:**

    ```python
    # In app/crud/crud_tenant.py
    from app.utils.logger import infoLog

    # new_tenant_id und tenant_name sind hier definiert
    infoLog(
        "TenantCRUD", # Modulname angepasst für Klarheit
        f"Neuer Mandant '{tenant_name}' erfolgreich erstellt.",
        details={"tenant_id": new_tenant_id, "admin_user_id": current_user.id}
    )
    ```

#### `warnLog(module_name: str, message: str, details: object = None)` ([`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py))

*   **Wann?** Für unerwartete, aber nicht kritische Situationen im Backend, die möglicherweise Aufmerksamkeit erfordern oder auf zukünftige Probleme hindeuten könnten. Der Prozess läuft weiter, aber es gab eine Abweichung vom erwarteten Verhalten.
*   **Beispiel:**

    ```python
    # In app/services/data_importer.py
    from app.utils.logger import warnLog

    # skipped_count und file_name sind hier definiert
    warnLog(
        "DataImportService",
        f"Einige Datensätze in '{file_name}' konnten nicht importiert werden.",
        details={"skipped_records": skipped_count, "reason": "Formatierungsprobleme in einigen Zeilen"}
    )
    ```

#### `errorLog(module_name: str, message: str, details: object = None)` ([`app/utils/logger.py`](../FinWise_0.4_BE/app/utils/logger.py))

*   **Wann?** Bei Laufzeitfehlern oder Ausnahmen im Backend, die den normalen Ablauf einer Operation verhindern. Dient zur Erfassung kritischer Fehler, die eine Untersuchung erfordern.
*   **`details`**: Kann ein Exception-Objekt, ein Dictionary mit Fehlerinformationen oder andere relevante Daten enthalten. Die `logger.py`-Implementierung versucht, `details` als JSON zu serialisieren und fügt `default=str` hinzu, um nicht-serialisierbare Objekte (wie Exceptions) als String darzustellen.
*   **Beispiel:**

    ```python
    # In app/api/v1/endpoints/accounts.py
    from app.utils.logger import errorLog
    from fastapi import HTTPException

    account_id = 123 # Beispiel
    try:
        # Eine Operation, die fehlschlagen könnte, z.B. Datenbankzugriff
        # db_get_account(db, account_id=account_id)
        raise ValueError(f"Spezifischer Fehler für Konto {account_id}")
    except ValueError as e:
        errorLog(
            "AccountAPI",
            f"Wertfehler beim Abrufen von Konto {account_id}.",
            details=e # Das Exception-Objekt wird übergeben
        )
        # raise HTTPException(status_code=404, detail="Account not found")
    except Exception as e:
        # Fängt andere unerwartete Fehler ab
        errorLog(
            "AccountAPI",
            f"Ein unerwarteter Fehler ist beim Zugriff auf Konto {account_id} aufgetreten.",
            details=e # Übergibt das allgemeine Exception-Objekt
        )
        # raise HTTPException(status_code=500, detail="Internal server error")
    ```

## 7. Fehlerbehandlung

*   **Try/Catch**: Verwende `try/catch`-Blöcke mit klaren, verständlichen Fehlermeldungen.
*   **Graceful Fallbacks**: Implementiere angemessene Fallbacks bei unerwarteten Fehlern.
*   **Backend**: Verwende `errorLog` zur Dokumentation von Ausnahmen.

## 8. Performance & Sicherheit

*   **Critical Paths**: Optimiere kritische Pfade (z.B. Caching, Debouncing).
*   **Input-Validation & Sanitization**: Validiere und bereinige Eingaben, um XSS- und SQL-Injection-Angriffe zu vermeiden, insbesondere in API-Endpunkten und Service-Layern.

## 9. Abhängigkeiten & Wartbarkeit

*   **Minimale externe Libraries**: Prüfe jede Abhängigkeit sorgfältig.
*   **Keine Duplikate**: Vermeide Code-Duplikate durch klare Abstraktionen und Hilfsfunktionen/Services.

## 10. Code Changes

Ziel: Sicherstellung einer sauberen, kontrollierten Umstellung auf IndexedDB innerhalb der Vue.js-Frontendstruktur.

Verbindliche Vorgaben:

*   **Keine Löschung oder Umbenennung bestehender Methoden**: Alle existierenden Methoden in den Pinia-Stores müssen namentlich unverändert bleiben. Eine Anpassung darf ausschließlich innerhalb des Methodenrumpfs erfolgen. Das einzige, was verändert werden darf, ist die Anpassungen der Kommentarstruktur auf Basis der commentrules.md.
*   **Umstellung ausschließlich auf Store-Ebene**: Änderungen zur Einführung von IndexedDB-Persistenz sind ausschließlich innerhalb der Store-Dateien (z.B. `transactionStore.ts`, `userStore.ts`) erlaubt. Anpassungen in `services/` oder `components/` sind strikt untersagt, außer nach expliziter Rückfrage.
*   **Modularisierung bei komplexer Logik**: Wird der Code im Rahmen der Umstellung umfangreicher oder unübersichtlich, müssen Hilfsfunktionen (Untermethoden) erstellt werden. Ziel ist eine klare, wartbare Struktur.
*   **Keine eigenmächtige Änderungen außerhalb der Stores**: Jede Änderung an UI- oder Service-Dateien bedarf einer vorherigen Rückfrage beim Benutzer. Eigenständige, nicht abgesprochene Änderungen durch den Code-Agenten sind nicht zulässig.
