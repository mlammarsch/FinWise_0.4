# Anleitung: Nicht-blockierende UI für langlaufende Aktionen

Dieses Dokument beschreibt, wie eine Benutzeroberflächen-Interaktion, die eine langlaufende Hintergrundaufgabe auslöst (z.B. das Löschen vieler Datenbankeinträge), umgestaltet werden kann, um die UI nicht zu blockieren.

## Problem: Blockierende UI bei `async/await` in Event-Handlern

Das ursprüngliche Problem trat in der Komponente `BudgetMonthHeaderCard.vue` auf. Beim Klick auf "Ja, Budget zurücksetzen" in einem Bestätigungsmodal blieb die gesamte Anwendungsoberfläche "eingefroren", bis der Löschvorgang für alle Budget-Transaktionen abgeschlossen war.

### Ursprünglicher Code (`src/components/budget/BudgetMonthHeaderCard.vue`)

Der `confirmResetBudget`-Event-Handler war als `async`-Funktion deklariert und nutzte `await`, um auf den Abschluss des `BudgetService.resetMonthBudget`-Aufrufs zu warten.

```typescript
// VORHER: UI blockiert, bis der Service fertig ist

async function confirmResetBudget() {
  console.log('[BudgetMonthHeaderCard] confirmResetBudget aufgerufen');

  if (!props.month) {
    return;
  }

  try {
    // Das 'await' hier blockiert die weitere Ausführung und damit die UI.
    const deletedCount = await BudgetService.resetMonthBudget(props.month.start, props.month.end);
    console.log(`Budget zurückgesetzt: ${deletedCount} Kategorieumbuchungen gelöscht`);

    // Das Modal wird erst geschlossen, NACHDEM der langlaufende Prozess beendet ist.
    showConfirmationModal.value = false;
  } catch (error) {
    console.error('Fehler beim Zurücksetzen des Budgets:', error);
    showConfirmationModal.value = false;
  }
}
```

**Nachteil**: Während `await BudgetService.resetMonthBudget(...)` ausgeführt wird, kann der Benutzer nicht mit der Anwendung interagieren. Bei vielen zu löschenden Einträgen führt dies zu einer schlechten User Experience (UX).

## Lösung: Entkopplung der UI-Aktion von der Hintergrundaufgabe

Die Lösung besteht darin, die UI-relevante Aktion (das Schließen des Modals) sofort auszuführen und die langlaufende Aufgabe im Hintergrund (asynchron) ablaufen zu lassen, ohne auf ihr Ergebnis zu warten.

### Angepasster Code (`src/components/budget/BudgetMonthHeaderCard.vue`)

Die `async/await`-Struktur wird durch eine `.then().catch()`-Promise-Kette ersetzt.

```typescript
// NACHHER: UI bleibt reaktionsfähig

function confirmResetBudget() {
  console.log('[BudgetMonthHeaderCard] confirmResetBudget aufgerufen');

  if (!props.month) {
    return;
  }

  // 1. UI-Aktion sofort ausführen: Das Modal wird direkt geschlossen.
  showConfirmationModal.value = false;

  // 2. Langlaufende Aufgabe im Hintergrund starten, ohne 'await'.
  BudgetService.resetMonthBudget(props.month.start, props.month.end)
    .then(deletedCount => {
      // 3. Ergebnis verarbeiten, wenn es verfügbar ist (z.B. Logging).
      //    Dies geschieht, ohne die UI erneut zu beeinflussen.
      console.log(`Budget zurückgesetzt: ${deletedCount} Kategorieumbuchungen gelöscht`);
    })
    .catch(error => {
      // 4. Fehler behandeln, falls die Hintergrundaufgabe fehlschlägt.
      console.error('Fehler beim Zurücksetzen des Budgets:', error);
      // Hier könnte man z.B. eine dezente Fehlermeldung (Toast) anzeigen.
    });
}
```

### Zusammenfassung der Vorteile

1.  **Sofortiges Feedback**: Der Benutzer sieht, dass seine Aktion (Klick) eine sofortige Reaktion (Schließen des Modals) bewirkt.
2.  **Kein "Einfrieren"**: Die Anwendung bleibt vollständig nutzbar, während die Daten im Hintergrund verarbeitet werden.
3.  **Verbesserte User Experience**: Besonders wichtig bei Aktionen, deren Dauer von der Datenmenge abhängt.
4.  **Entkopplung**: Die Logik der Benutzeroberfläche ist von der Logik der Datenverarbeitung getrennt.

Dieses Muster ist ideal für alle Operationen, bei denen das Ergebnis der Aktion nicht sofort in der UI dargestellt werden muss und die potenziell länger als einige hundert Millisekunden dauern können.
