# Plan: Migration von Accounts und AccountGroups zur Mandanten-spezifischen IndexedDB

**Ziel:** Accounts und AccountGroups aus dem Pinia Store und LocalStorage in die Mandanten-spezifische IndexedDB (`finwiseTenantDB`) migrieren, unter Beibehaltung der bestehenden Methodennamen im `accountStore` und `AccountService`.

**Überarbeiteter Plan:**

1.  **Erweiterung der Mandanten-DB-Definition:**
    *   In [`src/stores/tenantStore.ts`](src/stores/tenantStore.ts) wird die Klasse `FinwiseTenantSpecificDB` erweitert.
    *   Es werden neue Tabellen für `accounts` und `accountGroups` in der `version(1).stores({})` Definition hinzugefügt. Die Struktur der Stores muss den `Account` und `AccountGroup` Typen entsprechen.

2.  **Erstellung eines neuen IndexedDB Service:**
    *   Ein neuer Service (z.B. `src/services/TenantDbService.ts`) wird erstellt.
    *   Dieser Service wird eine Instanz der `FinwiseTenantSpecificDB` über den `tenantStore` erhalten.
    *   Er wird asynchrone Methoden bereitstellen, um:
        *   Accounts und AccountGroups in die IndexedDB zu schreiben (hinzufügen, aktualisieren, löschen).
        *   Alle Accounts und AccountGroups aus der IndexedDB für den aktiven Mandanten zu laden.
    *   Dieser Service wird *nur* vom `accountStore` verwendet.

3.  **Anpassung des `accountStore`:**
    *   Die Abhängigkeit vom `LocalStorageAdapter` und die direkte Nutzung von `localStorage` werden entfernt.
    *   Die Methoden `saveAccounts()` und `saveAccountGroups()` werden entfernt.
    *   Die CRUD-Methoden (`addAccount`, `updateAccount`, `deleteAccount`, `addAccountGroup`, `updateAccountGroup`, `deleteAccountGroup`) **behalten ihre Namen und Signaturen bei**, werden aber asynchron (`async`). Ihre Implementierung wird angepasst, um die entsprechenden asynchronen Methoden des neuen `TenantDbService` aufzurufen und auf deren Abschluss zu warten (`await`).
    *   Die Methode `loadAccounts()` **behält ihren Namen bei**, wird aber asynchron (`async`) und lädt die Daten über den `TenantDbService` aus der IndexedDB.
    *   Die initiale Ladelogik im `accountStore` wird angepasst, um die asynchrone `loadAccounts()` Methode korrekt aufzurufen, möglicherweise in einem `onMounted` Hook, der auf die Verfügbarkeit der `activeTenantDB` wartet.
    *   Die `reset()` Methode im `accountStore` wird angepasst, um die asynchrone `loadAccounts()` Methode nach dem Zurücksetzen aufzurufen.

4.  **Anpassung des `DataService`:**
    *   Die Methoden `saveAccounts`, `loadAccounts`, `saveAccountGroups`, `loadAccountGroups` im `DataService` werden entfernt.
    *   Die statische Methode `reloadTenantData()` im `DataService` muss asynchron werden (`async`) und die nun asynchronen `reset()` Methoden der Stores (einschließlich des `accountStore`) korrekt mit `await` aufrufen.

5.  **Überprüfung und Anpassung abhängiger Services/Komponenten:**
    *   Alle Services oder Komponenten, die die CRUD-Methoden des `accountStore` aufrufen (insbesondere der `AccountService`), müssen überprüft werden.
    *   Da die Methoden im `accountStore` nun asynchron sind, müssen die Aufrufe in den abhängigen Services/Komponenten mit `await` versehen werden. Die Methodennamen selbst bleiben unverändert.

**Visualisierung des Datenflusses (vereinfacht):**

```mermaid
graph TD
    A[UI Komponenten] --> B(Account Store)
    B --> C(TenantDbService)
    C --> D(Tenant Store)
    D --> E(FinwiseTenantSpecificDB)
    F[Tenant Service] --> D
    F --> G(Data Service)
    G --> B
