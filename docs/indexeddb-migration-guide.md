# IndexedDB Migration Guide

## Übersicht

Dieser Guide beschreibt die Migration von localStorage zu IndexedDB für die FinWise Frontend-Anwendung. Die Migration wurde zunächst für den Transaction Store implementiert und dient als Vorlage für weitere Store-Migrationen.

## Warum IndexedDB?

### Vorteile gegenüber localStorage

| Aspekt | localStorage | IndexedDB |
|--------|-------------|-----------|
| **Speicherkapazität** | ~5-10MB | Praktisch unbegrenzt |
| **Performance** | Synchron (blockierend) | Asynchron (non-blocking) |
| **Datentypen** | Nur Strings | Native JavaScript-Objekte |
| **Abfragen** | Keine | Indexierte Abfragen |
| **Transaktionen** | Keine | ACID-Transaktionen |
| **Offline-Sync** | Begrenzt | Vollständig unterstützt |

### Anwendungsfälle

- **Große Datenmengen**: Tausende von Transaktionen, Konten, etc.
- **Offline-First**: Vollständige App-Funktionalität ohne Internetverbindung
- **Sync-Integration**: Bidirektionale Synchronisation mit Backend
- **Performance**: Schnelle Abfragen und Updates bei großen Datasets

## Architektur-Überblick

### Neue Schichtarchitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Vue Components                           │
│                   (Presentation Layer)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Pinia Stores                              │
│                 (State Management)                          │
│  • transactionStore.ts  • accountStore.ts  • etc.          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 TenantDbService                             │
│                (Data Access Layer)                          │
│  • CRUD Operations  • Sync Queue  • Schema Management      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   IndexedDB                                 │
│                 (Browser Storage)                           │
│  • tenant_123_db  • tenant_456_db  • etc.                  │
└─────────────────────────────────────────────────────────────┘
```

## TenantDbService Integration

### Service-Initialisierung

```typescript
// In jedem Store
import { TenantDbService } from '@/services/TenantDbService';

export const useTransactionStore = defineStore('transaction', () => {
  const tenantDbService = new TenantDbService();

  // Store-Logik...
});
```

### CRUD-Operationen

#### Erstellen (Create)

```typescript
async function addTransaction(tx: ExtendedTransaction, fromSync = false): Promise<ExtendedTransaction> {
  // 1. Timestamp hinzufügen
  const transactionWithTimestamp: ExtendedTransaction = {
    ...tx,
    updated_at: tx.updated_at || new Date().toISOString(),
  };

  // 2. In IndexedDB speichern
  await tenantDbService.addTransaction(transactionWithTimestamp);

  // 3. Store-State aktualisieren
  transactions.value.push(transactionWithTimestamp);

  // 4. Sync-Queue Entry erstellen (nur bei lokalen Änderungen)
  if (!fromSync) {
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.TRANSACTION,
      entityId: transactionWithTimestamp.id,
      operationType: SyncOperationType.CREATE,
      payload: transactionWithTimestamp,
    });
  }

  return transactionWithTimestamp;
}
```

#### Lesen (Read)

```typescript
async function loadTransactions(): Promise<void> {
  try {
    // Alle Transaktionen aus IndexedDB laden
    const loadedTransactions = await tenantDbService.getAllTransactions();
    transactions.value = loadedTransactions || [];

    // Daten normalisieren
    transactions.value = transactions.value.map(tx => ({
      ...tx,
      date: toDateOnlyString(tx.date),
      valueDate: toDateOnlyString(tx.valueDate || tx.date),
    }));

    debugLog('transactionStore', 'loadTransactions completed', {
      count: transactions.value.length,
    });
  } catch (error) {
    errorLog('transactionStore', 'Fehler beim Laden der Transaktionen', error);
    transactions.value = [];
  }
}
```

#### Aktualisieren (Update)

```typescript
async function updateTransaction(id: string, updates: Partial<ExtendedTransaction>, fromSync = false): Promise<boolean> {
  // 1. Timestamp hinzufügen
  const transactionUpdatesWithTimestamp: Partial<ExtendedTransaction> = {
    ...updates,
    updated_at: updates.updated_at || new Date().toISOString(),
  };

  // 2. Konfliktauflösung bei Sync
  if (fromSync) {
    const localTransaction = await tenantDbService.getTransactionById(id);
    if (localTransaction?.updated_at && transactionUpdatesWithTimestamp.updated_at &&
        new Date(localTransaction.updated_at) >= new Date(transactionUpdatesWithTimestamp.updated_at)) {
      // Lokale Version ist neuer - Änderung verwerfen
      return true;
    }
  }

  // 3. In IndexedDB aktualisieren
  const localTransaction = await tenantDbService.getTransactionById(id);
  if (!localTransaction) return false;

  const updatedTransaction = { ...localTransaction, ...transactionUpdatesWithTimestamp };
  await tenantDbService.updateTransaction(updatedTransaction);

  // 4. Store-State aktualisieren
  const idx = transactions.value.findIndex(t => t.id === id);
  if (idx !== -1) {
    transactions.value[idx] = { ...transactions.value[idx], ...transactionUpdatesWithTimestamp };
  }

  // 5. Sync-Queue Entry erstellen
  if (!fromSync) {
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.TRANSACTION,
      entityId: id,
      operationType: SyncOperationType.UPDATE,
      payload: transactions.value[idx],
    });
  }

  return true;
}
```

#### Löschen (Delete)

```typescript
async function deleteTransaction(id: string, fromSync = false): Promise<boolean> {
  // 1. Aus IndexedDB löschen
  await tenantDbService.deleteTransaction(id);

  // 2. Aus Store-State entfernen
  transactions.value = transactions.value.filter(t => t.id !== id);

  // 3. Sync-Queue Entry erstellen
  if (!fromSync) {
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.TRANSACTION,
      entityId: id,
      operationType: SyncOperationType.DELETE,
      payload: { id: id },
    });
  }

  return true;
}
```

## Sync-Integration

### Last-Write-Wins Konfliktauflösung

```typescript
// Beispiel für eingehende Sync-Daten
async function handleIncomingSync(incomingTransaction: ExtendedTransaction): Promise<void> {
  const localTransaction = await tenantDbService.getTransactionById(incomingTransaction.id);

  if (localTransaction) {
    // Konfliktauflösung basierend auf Timestamps
    if (localTransaction.updated_at && incomingTransaction.updated_at &&
        new Date(localTransaction.updated_at) >= new Date(incomingTransaction.updated_at)) {
      // Lokale Version ist neuer - eingehende Änderung verwerfen
      infoLog('syncService', `Lokale Transaktion ${localTransaction.id} ist neuer. Eingehende Änderung verworfen.`);
      return;
    }
  }

  // Eingehende Änderung anwenden
  await addTransaction(incomingTransaction, true); // fromSync = true
}
```

### Sync-Queue Management

```typescript
// Ausstehende Sync-Operationen abrufen
async function getPendingSyncOperations(): Promise<SyncQueueEntry[]> {
  return await tenantDbService.getAllSyncQueueEntries();
}

// Sync-Operation als verarbeitet markieren
async function markSyncOperationComplete(entryId: string): Promise<void> {
  await tenantDbService.deleteSyncQueueEntry(entryId);
}
```

## Migration bestehender Stores

### Schritt-für-Schritt Anleitung

#### 1. TenantDbService erweitern

```typescript
// In TenantDbService.ts neue Methoden hinzufügen
async addAccount(account: Account): Promise<void> {
  const db = await this.getDatabase();
  const tx = db.transaction(['accounts'], 'readwrite');
  const store = tx.objectStore('accounts');
  await store.put(account);
  await tx.complete;
}

async getAllAccounts(): Promise<Account[]> {
  const db = await this.getDatabase();
  const tx = db.transaction(['accounts'], 'readonly');
  const store = tx.objectStore('accounts');
  return await store.getAll();
}
```

#### 2. Store-Methoden anpassen

```typescript
// Bestehende Store-Methode
function addAccount(account: Account): void {
  accounts.value.push(account);
  localStorage.setItem('accounts', JSON.stringify(accounts.value));
}

// Neue IndexedDB-Version
async function addAccount(account: Account, fromSync = false): Promise<Account> {
  const accountWithTimestamp: Account = {
    ...account,
    updated_at: account.updated_at || new Date().toISOString(),
  };

  await tenantDbService.addAccount(accountWithTimestamp);
  accounts.value.push(accountWithTimestamp);

  if (!fromSync) {
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.ACCOUNT,
      entityId: accountWithTimestamp.id,
      operationType: SyncOperationType.CREATE,
      payload: accountWithTimestamp,
    });
  }

  return accountWithTimestamp;
}
```

#### 3. Initialisierung anpassen

```typescript
// Store-Initialisierung
async function loadAccounts(): Promise<void> {
  try {
    const loadedAccounts = await tenantDbService.getAllAccounts();
    accounts.value = loadedAccounts || [];
  } catch (error) {
    errorLog('accountStore', 'Fehler beim Laden der Konten', error);
    accounts.value = [];
  }
}

// Beim Store-Setup
loadAccounts();
```

## Best Practices

### 1. Error Handling

```typescript
async function safeOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    errorLog('store', 'Operation fehlgeschlagen', error);
    return fallback;
  }
}

// Verwendung
const transactions = await safeOperation(
  () => tenantDbService.getAllTransactions(),
  []
);
```

### 2. Performance-Optimierung

```typescript
// Batch-Operationen für große Datenmengen
async function bulkAddTransactions(transactions: ExtendedTransaction[]): Promise<void> {
  const db = await tenantDbService.getDatabase();
  const tx = db.transaction(['transactions'], 'readwrite');
  const store = tx.objectStore('transactions');

  for (const transaction of transactions) {
    store.put(transaction);
  }

  await tx.complete;
}
```

### 3. Debugging

```typescript
// IndexedDB-Debugging in Browser DevTools
// Application Tab > Storage > IndexedDB > tenant_xxx_db

// Programmatisches Debugging
async function debugIndexedDB(): Promise<void> {
  const db = await tenantDbService.getDatabase();
  const tx = db.transaction(['transactions'], 'readonly');
  const store = tx.objectStore('transactions');
  const count = await store.count();

  debugLog('debug', 'IndexedDB Status', {
    database: db.name,
    version: db.version,
    transactionCount: count,
  });
}
```

## Testing

### Unit Tests

```typescript
// Beispiel für Store-Tests
describe('TransactionStore with IndexedDB', () => {
  beforeEach(async () => {
    // Test-Datenbank initialisieren
    await setupTestDatabase();
  });

  afterEach(async () => {
    // Test-Datenbank bereinigen
    await cleanupTestDatabase();
  });

  it('should persist transactions to IndexedDB', async () => {
    const store = useTransactionStore();
    const transaction = createTestTransaction();

    await store.addTransaction(transaction);

    // Store neu laden
    await store.loadTransactions();

    expect(store.transactions).toContainEqual(transaction);
  });
});
```

### Integration Tests

```typescript
// Sync-Integration testen
it('should handle sync conflicts correctly', async () => {
  const store = useTransactionStore();

  // Lokale Transaktion erstellen
  const localTx = { ...testTransaction, updated_at: '2025-06-13T10:00:00Z' };
  await store.addTransaction(localTx);

  // Ältere eingehende Transaktion simulieren
  const incomingTx = { ...testTransaction, updated_at: '2025-06-13T09:00:00Z' };
  await store.addTransaction(incomingTx, true); // fromSync = true

  // Lokale Version sollte erhalten bleiben
  const result = store.getTransactionById(testTransaction.id);
  expect(result?.updated_at).toBe('2025-06-13T10:00:00Z');
});
```

## Troubleshooting

### Häufige Probleme

#### 1. IndexedDB nicht verfügbar

```typescript
// Fallback auf localStorage
async function initializeStorage(): Promise<void> {
  try {
    await tenantDbService.getDatabase();
    debugLog('storage', 'IndexedDB verfügbar');
  } catch (error) {
    warnLog('storage', 'IndexedDB nicht verfügbar, verwende localStorage', error);
    // Fallback-Implementierung
  }
}
```

#### 2. Sync-Konflikte

```typescript
// Detailliertes Logging für Sync-Konflikte
if (localTransaction.updated_at && incomingTransaction.updated_at) {
  const localTime = new Date(localTransaction.updated_at);
  const incomingTime = new Date(incomingTransaction.updated_at);

  debugLog('sync', 'Konfliktauflösung', {
    transactionId: localTransaction.id,
    localTimestamp: localTime.toISOString(),
    incomingTimestamp: incomingTime.toISOString(),
    resolution: localTime >= incomingTime ? 'local-wins' : 'incoming-wins'
  });
}
```

#### 3. Performance-Probleme

```typescript
// Lazy Loading für große Datasets
const recentTransactions = computed(() =>
  transactions.value
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100) // Nur die neuesten 100 anzeigen
);

// Paginierung implementieren
async function loadTransactionPage(offset: number, limit: number): Promise<ExtendedTransaction[]> {
  const db = await tenantDbService.getDatabase();
  const tx = db.transaction(['transactions'], 'readonly');
  const store = tx.objectStore('transactions');
  const index = store.index('date');

  const results: ExtendedTransaction[] = [];
  let cursor = await index.openCursor(null, 'prev'); // Neueste zuerst
  let skipped = 0;
  let collected = 0;

  while (cursor && collected < limit) {
    if (skipped >= offset) {
      results.push(cursor.value);
      collected++;
    } else {
      skipped++;
    }
    cursor = await cursor.continue();
  }

  return results;
}
```

## Nächste Schritte

1. **Account Store Migration**: Implementierung der IndexedDB-Integration für Konten
2. **Category Store Migration**: Migration der Kategorien-Verwaltung
3. **Budget Store Migration**: Budgetierung mit IndexedDB
4. **Performance-Monitoring**: Überwachung der IndexedDB-Performance
5. **Backup/Restore**: Implementierung von Datenexport/-import-Funktionen

---

**Hinweis**: Dieser Guide wird kontinuierlich aktualisiert, wenn weitere Stores migriert werden. Bei Fragen oder Problemen siehe die entsprechenden Store-Implementierungen oder die TenantDbService-Dokumentation.
