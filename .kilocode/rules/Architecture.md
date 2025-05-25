# Anwendungsarchitektur: FinWise

## Anwendungsbeschreibung

FinWise ist eine modulare Vue.js-Anwendung für Finanzmanagement. Sie ermöglicht Benutzern, ihre Finanzen zu verwalten, Budgets zu erstellen, Transaktionen zu verfolgen und Prognosen zu erstellen. Die Anwendung ist so konzipiert, dass sie auch offline funktioniert und Daten mit einem geplanten FastAPI-Backend synchronisieren kann.

## Architektur

Die Anwendung ist in drei Hauptschichten unterteilt:

*   **UI-Schicht (Vue-Komponenten):** Verantwortlich für die Darstellung der Benutzeroberfläche und die Interaktion mit dem Benutzer. Nutzt daisyui und tailwind.
*   **Business-Logic-Schicht (Services):** Enthält die Geschäftslogik der Anwendung und implementiert Funktionen wie Budgetierung, Transaktionsverwaltung und Prognoseberechnungen.
*   **Datenschicht (Stores):** Verwaltet den Zustand der Anwendung und stellt Daten für die UI-Schicht bereit. Stores nutzen Pinia.

## Modulstruktur

Die Anwendung ist modular aufgebaut und umfasst folgende Bereiche:

* **Transactions:** Ermöglicht Benutzern, Transaktionen zu erstellen, zu bearbeiten und zu verfolgen.
* **Rules:** Ermöglicht Benutzern, Automatisierungsregeln für Transaktionen zu erstellen.
* **Administration:** Ermöglicht alle Arten der Stammdatenverwaltung (Kategorien, Tags, Konten, Mandanten, Regeln, Einstellungen, usw.)
* **Kontoverwaltung:** Ermöglicht die Verwaltung physischer Bankkonten, Karten, Depots oder Geldbeutel.
* **Kategorien:** Bildet die Lebensbereiche des Geldflusses ab und fungiert zusammen mit der Kontoverwaltung als doppelte Buchführung.
* **Tags/Labels:** Ermöglicht die Markierung von Finanzflüssen, um sie zu Projekten oder anderen gruppierten Bereichen zusammenzufassen - insbesondere für späteres Reporting.
* **Planung und Prognose:** Ermöglicht die Definition regelmäßiger Buchungen für Zukunftsprognosen von Kontoständen.
* **Budgeting:** Ermöglicht die detaillierte Vorplanung der Einnahmenverteilung auf Kategorien/Budgettöpfe, um Rücklagen für bestimmte Lebensbereiche zu erstellen oder Zielsparen zu ermöglichen.

## Module:

*   `components`:  Wiederverwendbare UI-Komponenten (z.B. `AccountCard.vue`, `BudgetForm.vue`).
*   `layouts`: Definiert das Layout der Anwendung (z.B. `AppLayout.vue`).
*   `router`: Definiert die Routen der Anwendung.
*   `services`:  Implementiert die Geschäftslogik (z.B. `AccountService.ts`, `BudgetService.ts`).
*   `stores`: Verwaltet den Anwendungszustand (z.B. `accountStore.ts`, `budgetStore.ts`).
*   `types`: Definiert TypeScript-Typen und -Interfaces.
*   `utils`: Enthält Hilfsfunktionen (z.B. Datumsformatierung, Währungsformatierung).
* `views`: Enthält die Hauptansichten, jede View liegt in der Regel in einer eigenen *.vue-Datei.
