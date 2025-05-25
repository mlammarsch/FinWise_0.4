# Code Changes im Frontend
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
