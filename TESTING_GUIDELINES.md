# FinWise Testing Guidelines für Vitest

## 1. Einleitung

Diese Richtlinien dienen dazu, Konsistenz, Effizienz und die Einhaltung von Best Practices bei der Erstellung von Unit-Tests mit Vitest für das FinWise-Projekt sicherzustellen. Ziel ist es, eine hohe Codequalität und Wartbarkeit zu gewährleisten.

## 2. Allgemeines Test-Setup

### Notwendige Entwicklungsabhängigkeiten

Stellen Sie sicher, dass die folgenden Entwicklungsabhängigkeiten in Ihrer `package.json` vorhanden sind:

```json
{
  "devDependencies": {
    "vitest": "^1.0.0", // oder die aktuellste Version
    "@types/node": "^20.0.0", // oder die aktuellste Version
    // Weitere testbezogene Abhängigkeiten wie @vue/test-utils, falls Vue-Komponenten getestet werden
  }
}
```

Führen Sie `npm install` oder `yarn install` aus, um sie zu installieren.

### Struktur des `package.json` Test-Skripts

Fügen Sie ein Skript zum Ausführen der Unit-Tests in Ihrer `package.json` hinzu:

```json
{
  "scripts": {
    "test:unit": "vitest"
    // Optional: "test:unit:watch": "vitest --watch"
    // Optional: "test:unit:coverage": "vitest run --coverage"
  }
}
```

### Speicherort und Namenskonvention für Testdateien

*   **Speicherort:** Testdateien sollten im Verzeichnis `/test` im Stammverzeichnis des Projekts abgelegt werden.
*   **Struktur:** Die Verzeichnisstruktur innerhalb von `/test` sollte die Modulstruktur von `/src` widerspiegeln. Wenn Sie beispielsweise eine Datei unter `src/services/MyService.ts` testen, sollte die Testdatei unter `test/services/MyService.spec.ts` liegen.
*   **Namenskonvention:** Testdateien sollten das Suffix `.spec.ts` oder `.test.ts` verwenden (z.B. `MyComponent.spec.ts`).

## 3. TypeScript-Konfiguration für Tests

Eine korrekte TypeScript-Konfiguration ist entscheidend für eine reibungslose Testentwicklung.

### `tsconfig.node.json` oder `tsconfig.test.json`

Vitest läuft in einer Node.js-Umgebung. Daher ist es wichtig, eine passende `tsconfig` für die Tests zu haben. Oft wird hierfür die `tsconfig.node.json` angepasst oder eine dedizierte `tsconfig.test.json` erstellt.

Beispielinhalt für `tsconfig.node.json` (oder `tsconfig.test.json`):

```json
{
  "extends": "@vue/tsconfig/tsconfig.node.json", // Oder eine passende Basis-Konfiguration
  "include": [
    "vite.config.*",
    "vitest.config.*",
    "cypress.config.*",
    "playwright.config.*",
    "src/**/*", // Wichtig, um Quellcode-Typen zu kennen
    "test/**/*.spec.ts", // Einbindung der Testdateien
    "test/**/*.test.ts"  // Alternative Einbindung der Testdateien
  ],
  "compilerOptions": {
    "composite": true,
    "noEmit": true, // Tests werden nicht kompiliert, nur Typ-geprüft
    "types": [
      "node",
      "vitest/globals" // Stellt globale Vitest-Typen wie describe, it, expect, vi zur Verfügung
    ],
    "module": "ESNext", // Oder je nach Projektkonfiguration
    "moduleResolution": "Bundler" // Oder NodeNext / Node16
  }
}
```
Stellen Sie sicher, dass Ihre Haupt-`tsconfig.json` auf diese Datei verweist, falls Sie `references` verwenden.

### Einbindung von Testdateien

Wie im obigen Beispiel gezeigt, verwenden Sie das `include`-Pattern in Ihrer `tsconfig.test.json` (oder `tsconfig.node.json`), um Ihre Testdateien einzuschließen:

```json
"include": [
  // ... andere Includes
  "test/**/*.spec.ts"
]
```

### Notwendige `"types"`

Fügen Sie die folgenden Typen zu den `compilerOptions.types` in Ihrer Test-`tsconfig` hinzu:

```json
"types": [
  "node",           // Für Node.js-spezifische Typen wie `fs`
  "vitest/globals"  // Für globale Vitest-Funktionen und -Objekte (`describe`, `it`, `vi`, etc.)
]
```

### Behandlung von "File ... is not listed within the file list of project ..." Fehlern

Dieser Fehler tritt häufig in IDEs auf, wenn die TypeScript-Language-Service die Testdatei nicht korrekt dem richtigen Projekt zuordnet.
*   **Prüfen Sie die `include`-Patterns** in Ihrer `tsconfig.test.json` (oder `tsconfig.node.json`).
*   **Stellen Sie sicher, dass die Testausführung funktioniert:** Oft ist dies nur ein IDE-Problem und die Tests laufen via `npm run test:unit` trotzdem korrekt.
*   Starten Sie den TypeScript-Server Ihrer IDE neu.

### Umgang mit `Cannot find module 'fs'` (oder ähnlichen Node.js-Modulen)

Dieser Fehler tritt auf, wenn die Node.js-Typen nicht korrekt eingebunden sind.
*   **Lösung:** Stellen Sie sicher, dass `@types/node` installiert ist und `"node"` im `types`-Array Ihrer `compilerOptions` in der relevanten `tsconfig` enthalten ist.

```typescript
// tsconfig.test.json (oder tsconfig.node.json)
{
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  }
}
```

### Umgang mit Vitest-Namespace-Fehlern

Fehler wie `Cannot find namespace 'vi'` oder `Cannot find name 'Mock'` deuten darauf hin, dass die globalen Vitest-Typen oder spezifische Vitest-Typen nicht korrekt erkannt werden.
*   **Globale Typen:** Stellen Sie sicher, dass `"vitest/globals"` in `compilerOptions.types` Ihrer Test-`tsconfig` enthalten ist.
*   **Spezifische Typen (z.B. `Mock`):** Importieren Sie diese explizit und verwenden Sie Typ-Assertions, falls notwendig.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest'; // Expliziter Import für den Typ Mock

// ...

// Beispiel für Typ-Assertion
const myMockedFunction = vi.fn() as Mock;
(useSomeStore as unknown as Mock).mockReturnValue(...);
```

## 4. Mocking-Strategien

Unit-Tests zielen darauf ab, Code-Einheiten isoliert zu testen. Daher müssen externe Abhängigkeiten gemockt werden.

### Grundprinzip

Mocken Sie alle Abhängigkeiten, die nicht Teil der zu testenden Einheit sind. Dies umfasst Services, Stores, externe Bibliotheken und globale Utilities.

### Globale Utilities (z.B. Logger)

Globale Utilities, wie die Logger-Funktionen aus [`src/utils/logger.ts`](src/utils/logger.ts:1), sollten gemockt werden, um Testläufe nicht durch Log-Ausgaben zu stören und um Abhängigkeiten (z.B. Pinia innerhalb des Loggers) zu vermeiden.

```typescript
// In Ihrer Testdatei (z.B. test/services/MyService.spec.ts)
import { vi } from 'vitest';

vi.mock('@/utils/logger', () => ({
  debugLog: vi.fn(),
  infoLog: vi.fn(),
  warnLog: vi.fn(),
  errorLog: vi.fn()
}));

// Jetzt können Sie in Ihren Tests überprüfen, ob die Logger-Funktionen aufgerufen wurden:
// expect(debugLog).toHaveBeenCalledWith(...);
```
**Hinweis:** Der Pfad im `vi.mock` muss relativ zur Testdatei oder ein Alias sein, der in Ihrer Vitest/Vite-Konfiguration aufgelöst wird (z.B. `@/utils/logger`).

### Pinia Stores

Pinia Store-Hooks (z.B. `useTenantStore` aus `src/stores/tenantStore.ts`) müssen gemockt werden, um den Store-Zustand und Aktionen im Test zu kontrollieren.

```typescript
// In Ihrer Testdatei
import { vi } from 'vitest';
import type { Mock } from 'vitest';
// Angenommen, der Store-Hook ist so exportiert: export const useTenantStore = () => { ... }
// Der Pfad muss relativ zur Testdatei sein oder ein Alias.
vi.mock('@/stores/tenantStore', () => ({
  useTenantStore: vi.fn()
}));

// In einem beforeEach-Block oder pro Testfall den Mock initialisieren:
beforeEach(() => {
  const mockDbInstance = { /* ... Mock-DB-Methoden ... */ };
  (useTenantStore as unknown as Mock).mockReturnValue({
    activeTenantId: 'mock-tenant-id-123',
    activeTenantDB: mockDbInstance,
    // Weitere gemockte Store-Properties oder Aktionen
    someAction: vi.fn().mockResolvedValue('action result')
  });
});

// Im Test:
// const tenantStore = useTenantStore();
// expect(tenantStore.activeTenantId).toBe('mock-tenant-id-123');
// await tenantStore.someAction();
// expect(tenantStore.someAction).toHaveBeenCalled();
```

### Externe Bibliotheken (z.B. `uuid`)

Externe Bibliotheken wie `uuid` sollten gemockt werden, um deterministische Testergebnisse zu gewährleisten.

```typescript
// In Ihrer Testdatei
import { vi } from 'vitest';
import type { Mock } from 'vitest';

// Mocken des gesamten 'uuid'-Moduls
vi.mock('uuid', () => ({
  v4: vi.fn() // Mocken der v4-Funktion
}));

// Im beforeEach oder pro Testfall eine Implementierung bereitstellen:
import { v4 as uuidv4 } from 'uuid'; // Importieren, um den Typ-Checker zufriedenzustellen

beforeEach(() => {
  (uuidv4 as Mock).mockImplementation(() => 'mock-generated-uuid-12345');
  // Oder für mehrere unterschiedliche UUIDs:
  // (uuidv4 as Mock).mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');
});

// Im Code, der uuid.v4() verwendet, wird nun 'mock-generated-uuid-12345' zurückgegeben.
```

### Datenbankinteraktionen (Dexie/IndexedDB)

Für Unit-Tests sollten Datenbankinteraktionen vollständig gemockt werden. Erstellen Sie ein Mock-Objekt für die Datenbankinstanz und weisen Sie es dem gemockten Store zu.

```typescript
// In Ihrer Testdatei
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import { useTenantStore } from '@/stores/tenantStore'; // Import für Typisierung

// Erstellen eines Mock-DB-Objekts
const mockDbInstance = {
  syncQueue: {
    add: vi.fn(),
    // weitere Tabellen und Methoden mocken
  },
  transactions: {
    get: vi.fn(),
    put: vi.fn(),
    // ...
  }
  // ... weitere Tabellen
};

beforeEach(() => {
  vi.clearAllMocks(); // Wichtig, um Mocks zwischen Tests zurückzusetzen

  // Mock für den Store initialisieren und die Mock-DB-Instanz zuweisen
  (useTenantStore as unknown as Mock).mockReturnValue({
    activeTenantId: 'test-tenant',
    activeTenantDB: mockDbInstance, // Hier wird die Mock-DB zugewiesen
    // ... andere Store-Properties
  });

  // Standard-Mock-Implementierungen für DB-Methoden (optional, aber oft nützlich)
  mockDbInstance.syncQueue.add.mockResolvedValue('mock-sync-queue-item-id');
  mockDbInstance.transactions.get.mockResolvedValue(undefined); // z.B. Transaktion nicht gefunden
});

// Im Testfall:
it('should add an item to the sync queue', async () => {
  // Arrange
  const myService = new MyService(); // Angenommen, MyService verwendet den TenantStore
  const dataToSync = { id: '1', data: 'test' };

  // Act
  await myService.addItemToSyncQueue(dataToSync);

  // Assert
  expect(mockDbInstance.syncQueue.add).toHaveBeenCalledWith(dataToSync);
});

it('should return a transaction if found', async () => {
  // Arrange
  const myService = new MyService();
  const mockTransaction = { id: 'tx1', amount: 100 };
  mockDbInstance.transactions.get.mockResolvedValueOnce(mockTransaction); // Spezifischer Mock für diesen Test

  // Act
  const result = await myService.getTransactionById('tx1');

  // Assert
  expect(mockDbInstance.transactions.get).toHaveBeenCalledWith('tx1');
  expect(result).toEqual(mockTransaction);
});
```

## 5. Struktur von Testfällen (Vitest & Best Practices)

Eine klare und konsistente Struktur erleichtert das Lesen und Warten von Tests.

*   **`describe(name, fn)`:** Gruppiert zusammengehörige Tests. Der `name` sollte die getestete Einheit (Modul, Klasse, Funktion) beschreiben.
*   **`it(name, fn)` oder `test(name, fn)`:** Definiert einen einzelnen Testfall. Der `name` sollte das erwartete Verhalten oder den getesteten Zustand präzise beschreiben (z.B. `it('should return true when X is Y')`).
*   **`beforeEach(fn)`:** Wird vor jedem Testfall innerhalb eines `describe`-Blocks ausgeführt. Ideal für wiederkehrendes Setup wie das Zurücksetzen von Mocks (`vi.clearAllMocks()`), die Initialisierung von Mock-Rückgabewerten oder die Erstellung von Service-Instanzen.
*   **`afterEach(fn)`:** Wird nach jedem Testfall ausgeführt. Nützlich für Aufräumarbeiten, falls `beforeEach` Ressourcen erstellt hat, die manuell freigegeben werden müssen (selten bei Unit-Tests mit gutem Mocking).
*   **`beforeAll(fn)` / `afterAll(fn)`:** Werden einmal vor bzw. nach allen Tests in einem `describe`-Block ausgeführt.

### AAA-Pattern (Arrange, Act, Assert)

Strukturieren Sie Ihre Testfälle klar nach dem AAA-Pattern:

```typescript
it('should correctly calculate the sum of two numbers', () => {
  // Arrange: Testdaten und Mocks vorbereiten
  const number1 = 5;
  const number2 = 10;
  const expectedSum = 15;
  // Ggf. Mocks hier spezifisch für diesen Test anpassen

  // Act: Die zu testende Funktion/Methode ausführen
  const result = MyCalculator.add(number1, number2);

  // Assert: Überprüfen, ob das Ergebnis den Erwartungen entspricht
  expect(result).toBe(expectedSum);
});
```

### Parametrisierte Tests mit `it.each`

Für Testfälle, die dieselbe Logik mit unterschiedlichen Eingabe- und Ausgabewerten testen, verwenden Sie `it.each`:

```typescript
describe('MyStringUtils.isEmpty', () => {
  it.each([
    { input: '', expected: true, description: 'empty string' },
    { input: null, expected: true, description: 'null value' },
    { input: undefined, expected: true, description: 'undefined value' },
    { input: '  ', expected: false, description: 'string with spaces (trimmed behavior might differ)' },
    { input: 'hello', expected: false, description: 'non-empty string' },
  ])('should return $expected for $description ($input)', ({ input, expected }) => {
    // Act
    const result = MyStringUtils.isEmpty(input as string | null | undefined); // Ggf. Typanpassung
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Aussagekräftige Testfallbeschreibungen

Schreiben Sie klare und präzise Beschreibungen für `describe`-Blöcke und `it`-Testfälle. Sie sollten das "Was" und oft auch das "Warum" des Tests widerspiegeln.

## 6. Debugging von Tests

Manchmal ist es notwendig, während der Testausführung Werte zu inspizieren.

### Temporäres Logging mit `fs.appendFileSync`

Für schnelles, temporäres Debugging direkt in der Testdatei kann eine einfache Logging-Funktion, die in eine Datei schreibt, hilfreich sein. **Verwenden Sie dies sparsam und entfernen Sie es nach dem Debugging.**

```typescript
// Am Anfang Ihrer .spec.ts Datei (nur für temporäres Debugging!)
import fs from 'node:fs'; // Stellen Sie sicher, dass @types/node installiert ist
import path from 'node:path';

const debugLogFile = path.resolve(__dirname, '../../test-output/debug.log'); // Erstellt test-output Ordner, falls nicht vorhanden

// Stellen Sie sicher, dass das Verzeichnis existiert
const logDir = path.dirname(debugLogFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
// Optional: Datei bei jedem Testlauf leeren (oder manuell löschen)
// fs.writeFileSync(debugLogFile, `DEBUG LOG (${new Date().toISOString()})\n----------------------------------\n`);

function testDebugLog(message: string, ...optionalParams: any[]): void {
  const timestamp = new Date().toISOString();
  let logMessage = `${timestamp} - ${message}`;
  if (optionalParams.length > 0) {
    logMessage += `\n${optionalParams.map(p => JSON.stringify(p, null, 2)).join('\n')}`;
  }
  fs.appendFileSync(debugLogFile, logMessage + '\n');
}

// Beispielverwendung im Test:
it('should do something complex', () => {
  const data = { a: 1, b: { c: 'test' } };
  testDebugLog('Starting complex calculation with data:', data);
  // ... restlicher Test
  const result = performComplexCalculation(data);
  testDebugLog('Calculation result:', result);
  expect(result).toBeDefined();
});
```

### `.gitignore` für Log-Dateien

Fügen Sie das Verzeichnis für Debug-Log-Dateien zu Ihrer `.gitignore`-Datei hinzu:

```gitignore
# Test output
/test-output/
```
Erstellen Sie ggf. eine `.gitkeep`-Datei im Verzeichnis `test-output`, falls es leer ist und versioniert werden soll.

## 7. Wichtige Hinweise

*   **Fokus auf eigene Logik:** Unit-Tests sollen die Logik der *eigenen* Code-Einheit testen, nicht die Logik der gemockten Abhängigkeiten. Die Mocks dienen dazu, kontrollierte Eingaben und Verhaltensweisen für die zu testende Einheit bereitzustellen.
*   **Korrekte Simulation durch Mocks:** Stellen Sie sicher, dass Ihre Mocks das Verhalten der realen Abhängigkeiten korrekt simulieren. Wenn eine reale Funktion ein Promise zurückgibt, sollte der Mock ebenfalls ein Promise zurückgeben (z.B. `mockResolvedValueOnce`, `mockRejectedValueOnce`).
*   **Lesbarkeit und Wartbarkeit:** Schreiben Sie Tests so, dass sie leicht verständlich und wartbar sind. Klare Namen, das AAA-Pattern und `it.each` tragen dazu bei.
*   **Testabdeckung:** Streben Sie eine sinnvolle Testabdeckung an, insbesondere für kritische Pfade und komplexe Logik. Reine Getter/Setter oder triviale Funktionen benötigen oft keine dedizierten Tests, wenn sie durch Tests komplexerer Funktionen abgedeckt werden.
