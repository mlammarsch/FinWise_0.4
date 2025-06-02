# Coding Rules

## 1. Encoding & Dateistruktur

- **UTF-8**: Alle Dateien strikt in UTF-8 speichern (deutsche Umlaute/Kommentare bleiben intakt).
- **Vue-Dateien** in folgender Reihenfolge:
  1. `<script setup lang="ts">`
  2. `<template>`
  3. `<style lang="postcss" scoped>`

## 2. Namenskonvention

- **camelCase** für Variablen und Funktionen
- **PascalCase** für Klassen und Komponenten
- **Sprechende Namen** – Code erklärt sich selbst

## 3. Methoden & Single Responsibility

- **Kurz & fokussiert**: Max. eine Aufgabe pro Funktion
- **Modular**: Komplexe Abläufe in kleine Einheiten zerlegen

## 4. Self-Documenting Code statt überflüssiger Kommentare

- **Klare Bezeichner** – Code erklärt „Was“
- **Typen/Interfaces** statt Param-Kommentare
- **Why-Kommentare** nur bei echter Komplexität:

  ```ts
  // Berechnet Zins basierend auf Annuitätenformel
  function calculateAnnuityInterest(...) { ... }
```

## 5. Kommentar-Regeln
- **Nur Hauptmethoden und zentrale Elemente** kommentieren
- **Keine** langen Erklärungen, Change-Logs oder Versionsvermerke
- **Props/Emits** in Vue über TypeScript-Signaturen:
    ```ts
    const props = defineProps<{ title: string; isOpen: boolean }>();
    const emit = defineEmits<{
      (e: 'close'): void;
      (e: 'submit', data: FormData): void;
    }>();
    ```
## 6. Logging-Regeln

### `debugLog`
- **Wann?** In komplexen Algorithmen oder Unterprozessen
- **Format:** Flache Objekte per `JSON.stringify()`
- **Beispiel:**
    ```ts
    debugLog(
      'TransactionService',
      `Berechne Saldo für Konto ${accountId} (${accountName})`,
      JSON.stringify({ total })
    );
    ```
### `infoLog`
- **Wann?** Für End-to-End-Prozesse, nennenswerte Gesamtaktionen
- **Beispiel:**
    ```ts
    infoLog(
      'BudgetService',
      `Budget ${budgetName} (${budgetId}) mit Betrag ${amount} € erstellt`
    );
    ```
### `warnLog`
- **Wann?** Für beachtenswerte Zustände ohne Fehler
- **Beispiel:**
    ```ts
    warnLog(
      'Sync',
      `Offline-Daten älter als 7 Tage für Nutzer ${userId} (${userName})`
    );
    ```

### `errorLog`
- **Wann?** Bei echten Laufzeitfehlern
- **Beispiel:**

    ```ts
    errorLog(
      'API',
      `Fehler beim Laden der Konten (${accountId}, ${accountName}): ${error.message}`
    );
    ```

## 7. Fehlerbehandlung
- **Try/Catch** mit klaren, verständlichen Fehlermeldungen
- **Graceful Fallbacks** bei unerwarteten Fehlern

## 8. Performance & Sicherheit
- **Critical Paths** optimieren (z. B. Caching, Debouncing)
- **Input-Validation & Sanitization** (XSS, SQL-Injection vermeiden)

## 9. Abhängigkeiten & Wartbarkeit
- **Minimale externe Libraries**
- **Keine Duplikate** – Wiederverwendung durch klare Abstraktionen

## 10. Code Changes im Frontend
Ziel: Sicherstellung einer sauberen, kontrollierten Umstellung auf IndexedDB innerhalb der Vue.js-Frontendstruktur.

Verbindliche Vorgaben:

Keine Löschung oder Umbenennung bestehender Methoden
Alle existierenden Methoden in den Pinia-Stores müssen namentlich unverändert bleiben. Eine Anpassung darf ausschließlich innerhalb des Methodenrumpfs erfolgen.

Umstellung ausschließlich auf Store-Ebene
Änderungen zur Einführung von IndexedDB-Persistenz sind ausschließlich innerhalb der Store-Dateien (z. B. transactionStore.ts, userStore.ts) erlaubt.
Anpassungen in services/ oder components/ sind strikt untersagt, außer nach expliziter Rückfrage.

Modularisierung bei komplexer Logik
Wird der Code im Rahmen der Umstellung umfangreicher oder unübersichtlich, müssen Hilfsfunktionen (Untermethoden) erstellt werden. Ziel ist eine klare, wartbare Struktur.

Keine eigenmächtige Änderungen außerhalb der Stores
Jede Änderung an UI- oder Service-Dateien bedarf einer vorherigen Rückfrage beim Benutzer.
Eigenständige, nicht abgesprochene Änderungen durch den Code-Agenten sind nicht zulässig.
