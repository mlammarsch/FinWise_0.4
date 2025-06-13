# Store Migration Plan - IndexedDB Integration

## Übersicht

Dieser Plan beschreibt die schrittweise Migration der vier verbleibenden Stores von localStorage zu IndexedDB basierend auf dem analysierten Account/AccountGroup-Pattern.

## Migrations-Reihenfolge

### Phase 1: Einfache Stores (Woche 1)
1. **RecipientStore** (Tag 1-2)
2. **TagStore** (Tag 3-5)

### Phase 2: Komplexe Stores (Woche 2)
3. **RuleStore** (Tag 6-8)
4. **PlanningStore** (Tag 9-10)

## Store 1: RecipientStore Migration

### Aktuelle Struktur
```typescript
// Aktuell in src/stores/recipientStore.ts
interface Recipient {
  id: string
  name: string
  defaultCategoryId?: string | null
  note?: string
}
```

### Erforderliche Änderungen

#### 1. Typ-Erweiterung
```typescript
interface Recipient {
  id: string
  name: string
  defaultCategoryId?: string | null
  note?: string
  updated_at?: string // NEU: ISO 8601 Format
}
```

#### 2. TenantDbService-Erweiterung
```typescript
// In src/services/TenantDbService.ts hinzufügen
async addRecipient(recipient: Recipient): Promise<void> {
  if (!this.db) {
    warnLog('TenantDbService', 'addRecipient: Keine aktive Mandanten-DB verfügbar.');
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }
  try {
    await this.db.recipients.put(recipient);
    debugLog('TenantDbService', `Empfänger "${recipient.name}" (ID: ${recipient.id}) hinzugefügt.`);
  } catch (err) {
    errorLog('TenantDbService', `Fehler beim Hinzufügen des Empfängers "${recipient.name}"`, { recipient, error: err });
    throw err;
  }
}

async updateRecipient(recipient: Recipient): Promise<void> {
  if (!this.db) {
    warnLog('TenantDbService', 'updateRecipient: Keine aktive Mandanten-DB verfügbar.');
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }
  try {
    await this.db.recipients.put(recipient);
    debugLog('TenantDbService', `Empfänger "${recipient.name}" (ID: ${recipient.id}) aktualisiert.`);
  } catch (err) {
    errorLog('TenantDbService', `Fehler beim Aktualisieren des Empfängers "${recipient.name}"`, { recipient, error: err });
    throw err;
  }
}

async deleteRecipient(recipientId: string): Promise<void> {
  if (!this.db) {
    warnLog('TenantDbService', 'deleteRecipient: Keine aktive Mandanten-DB verfügbar.');
    throw new Error('Keine aktive Mandanten-DB verfügbar.');
  }
  try {
    await this.db.recipients.delete(recipientId);
    debugLog('TenantDbService', `Empfänger mit ID "${recipientId}" gelöscht.`);
  } catch (err) {
    errorLog('TenantDbService', `Fehler beim Löschen des Empfängers mit ID "${recipientId}"`, { recipientId, error: err });
    throw err;
  }
}

async getRecipientById(recipientId: string): Promise<Recipient | undefined> {
  if (!this.db) {
    warnLog('TenantDbService', 'getRecipientById: Keine aktive Mandanten-DB verfügbar.');
    return undefined;
  }
  try {
    const recipient = await this.db.recipients.get(recipientId);
    debugLog('TenantDbService', `Empfänger mit ID "${recipientId}" abgerufen.`, { recipient });
    return recipient;
  } catch (err) {
    errorLog('TenantDbService', `Fehler beim Abrufen des Empfängers mit ID "${recipientId}"`, { recipientId, error: err });
    return undefined;
  }
}

async getAllRecipients(): Promise<Recipient[]> {
  if (!this.db) {
    warnLog('TenantDbService', 'getAllRecipients: Keine aktive Mandanten-DB verfügbar.');
    return [];
  }
  try {
    const recipients = await this.db.recipients.toArray();
    debugLog('TenantDbService', 'Alle Empfänger abgerufen.', { count: recipients.length });
    return recipients;
  } catch (err) {
    errorLog('TenantDbService', 'Fehler beim Abrufen aller Empfänger', { error: err });
    return [];
  }
}
```

#### 3. Store-Migration
```typescript
// Neue src/stores/recipientStore.ts Implementierung
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { Recipient, SyncQueueEntry } from '@/types';
import { SyncOperationType, EntityTypeEnum } from '@/types';
import { debugLog, errorLog, infoLog, warnLog } from '@/utils/logger';
import { TenantDbService } from '@/services/TenantDbService';

export const useRecipientStore = defineStore('recipient', () => {
  const tenantDbService = new TenantDbService();
  const recipients = ref<Recipient[]>([]);

  const getRecipientById = computed(() => (id: string) =>
    recipients.value.find(r => r.id === id)
  );

  async function addRecipient(recipientData: Omit<Recipient, 'id' | 'updated_at'> | Recipient, fromSync = false): Promise<Recipient> {
    const recipientWithTimestamp: Recipient = {
      id: 'id' in recipientData ? recipientData.id : uuidv4(),
      ...recipientData,
      updated_at: recipientData.updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      const localRecipient = await tenantDbService.getRecipientById(recipientWithTimestamp.id);
      if (localRecipient && localRecipient.updated_at && recipientWithTimestamp.updated_at &&
          new Date(localRecipient.updated_at) >= new Date(recipientWithTimestamp.updated_at)) {
        infoLog('recipientStore', `addRecipient (fromSync): Lokaler Empfänger ${localRecipient.id} ist neuer. Eingehende Änderung verworfen.`);
        return localRecipient;
      }
      await tenantDbService.addRecipient(recipientWithTimestamp);
      infoLog('recipientStore', `addRecipient (fromSync): Eingehender Empfänger ${recipientWithTimestamp.id} angewendet.`);
    } else {
      await tenantDbService.addRecipient(recipientWithTimestamp);
    }

    const existingIndex = recipients.value.findIndex(r => r.id === recipientWithTimestamp.id);
    if (existingIndex === -1) {
      recipients.value.push(recipientWithTimestamp);
    } else {
      if (!fromSync || (recipientWithTimestamp.updated_at && (!recipients.value[existingIndex].updated_at || new Date(recipientWithTimestamp.updated_at) > new Date(recipients.value[existingIndex].updated_at!)))) {
        recipients.value[existingIndex] = recipientWithTimestamp;
      } else if (fromSync) {
        warnLog('recipientStore', `addRecipient (fromSync): Store-Empfänger ${recipients.value[existingIndex].id} war neuer. Store nicht geändert.`);
      }
    }

    if (!fromSync) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: recipientWithTimestamp.id,
          operationType: SyncOperationType.CREATE,
          payload: recipientWithTimestamp,
        });
        infoLog('recipientStore', `Empfänger "${recipientWithTimestamp.name}" zur Sync Queue hinzugefügt (CREATE).`);
      } catch (e) {
        errorLog('recipientStore', `Fehler beim Hinzufügen von Empfänger "${recipientWithTimestamp.name}" zur Sync Queue.`, e);
      }
    }

    return recipientWithTimestamp;
  }

  async function updateRecipient(id: string, updates: Partial<Recipient>, fromSync = false): Promise<boolean> {
    const recipientUpdatesWithTimestamp: Partial<Recipient> = {
      ...updates,
      updated_at: updates.updated_at || new Date().toISOString(),
    };

    if (fromSync) {
      const localRecipient = await tenantDbService.getRecipientById(id);
      if (!localRecipient) {
        infoLog('recipientStore', `updateRecipient (fromSync): Lokaler Empfänger ${id} nicht gefunden. Behandle als addRecipient.`);
        await addRecipient({ id, ...recipientUpdatesWithTimestamp } as Recipient, true);
        return true;
      }

      if (localRecipient.updated_at && recipientUpdatesWithTimestamp.updated_at &&
          new Date(localRecipient.updated_at) >= new Date(recipientUpdatesWithTimestamp.updated_at)) {
        infoLog('recipientStore', `updateRecipient (fromSync): Lokaler Empfänger ${localRecipient.id} ist neuer. Eingehende Änderung verworfen.`);
        return true;
      }
    }

    const localRecipient = await tenantDbService.getRecipientById(id);
    if (!localRecipient) return false;

    const updatedRecipient = { ...localRecipient, ...recipientUpdatesWithTimestamp };
    await tenantDbService.updateRecipient(updatedRecipient);

    const idx = recipients.value.findIndex(r => r.id === id);
    if (idx !== -1) {
      if (!fromSync || (recipientUpdatesWithTimestamp.updated_at && (!recipients.value[idx].updated_at || new Date(recipientUpdatesWithTimestamp.updated_at) > new Date(recipients.value[idx].updated_at!)))) {
        recipients.value[idx] = { ...recipients.value[idx], ...recipientUpdatesWithTimestamp };
      } else if (fromSync) {
        warnLog('recipientStore', `updateRecipient (fromSync): Store-Empfänger ${recipients.value[idx].id} war neuer. Store nicht geändert.`);
      }

      if (!fromSync) {
        try {
          await tenantDbService.addSyncQueueEntry({
            entityType: EntityTypeEnum.RECIPIENT,
            entityId: id,
            operationType: SyncOperationType.UPDATE,
            payload: recipients.value[idx],
          });
          infoLog('recipientStore', `Empfänger mit ID "${id}" zur Sync Queue hinzugefügt (UPDATE).`);
        } catch (e) {
          errorLog('recipientStore', `Fehler beim Hinzufügen von Empfänger Update (ID: "${id}") zur Sync Queue.`, e);
        }
      }
      return true;
    }

    if (fromSync) {
      warnLog('recipientStore', `updateRecipient: Empfänger ${id} not found in store during sync. Adding it.`);
      await addRecipient({ id, ...recipientUpdatesWithTimestamp } as Recipient, true);
      return true;
    }
    return false;
  }

  async function deleteRecipient(id: string, fromSync = false): Promise<void> {
    const recipientToDelete = recipients.value.find(r => r.id === id);

    await tenantDbService.deleteRecipient(id);
    recipients.value = recipients.value.filter(r => r.id !== id);
    infoLog('recipientStore', `Empfänger mit ID "${id}" aus Store und lokaler DB entfernt.`);

    if (!fromSync && recipientToDelete) {
      try {
        await tenantDbService.addSyncQueueEntry({
          entityType: EntityTypeEnum.RECIPIENT,
          entityId: id,
          operationType: SyncOperationType.DELETE,
          payload: { id: id },
        });
        infoLog('recipientStore', `Empfänger mit ID "${id}" zur Sync Queue hinzugefügt (DELETE).`);
      } catch (e) {
        errorLog('recipientStore', `Fehler beim Hinzufügen von Empfänger Delete (ID: "${id}") zur Sync Queue.`, e);
      }
    }
  }

  async function loadRecipients(): Promise<void> {
    try {
      const loadedRecipients = await tenantDbService.getAllRecipients();
      recipients.value = loadedRecipients || [];
      debugLog('recipientStore', 'loadRecipients completed', { count: recipients.value.length });
    } catch (error) {
      errorLog('recipientStore', 'Fehler beim Laden der Empfänger', error);
      recipients.value = [];
    }
  }

  async function reset(): Promise<void> {
    recipients.value = [];
    await loadRecipients();
    debugLog('recipientStore', 'reset completed');
  }

  async function initializeStore(): Promise<void> {
    await loadRecipients();
    debugLog('recipientStore', 'initializeStore completed');
  }

  return {
    recipients,
    getRecipientById,
    addRecipient,
    updateRecipient,
    deleteRecipient,
    loadRecipients,
    reset,
    initializeStore,
  };
});
```

#### 4. EntityType Enum-Erweiterung
```typescript
// In src/types/index.ts hinzufügen
export enum EntityTypeEnum {
  ACCOUNT = 'ACCOUNT',
  ACCOUNT_GROUP = 'ACCOUNT_GROUP',
  TRANSACTION = 'TRANSACTION',
  CATEGORY = 'CATEGORY',
  CATEGORY_GROUP = 'CATEGORY_GROUP',
  RECIPIENT = 'RECIPIENT', // NEU
  // Weitere werden in späteren Phasen hinzugefügt
}
```

## Store 2: TagStore Migration

### Besonderheiten
- Hierarchische Parent-Child-Struktur
- Separate ColorHistory-Persistierung
- Lösch-Validierung für Parent-Tags

### Erforderliche Änderungen

#### 1. Typ-Erweiterung
```typescript
interface Tag {
  id: string
  name: string
  parentTagId?: string | null
  color: string
  icon?: string
  updated_at?: string // NEU: ISO 8601 Format
}
```

#### 2. Store-spezifische Logik
```typescript
// Hierarchie-Validierung bei Löschung
async function deleteTag(id: string, fromSync = false): Promise<boolean> {
  if (!fromSync) {
    const hasChildren = tags.value.some(tag => tag.parentTagId === id);
    if (hasChildren) {
      warnLog('tagStore', `Tag ${id} kann nicht gelöscht werden - hat Kinder-Tags.`);
      return false;
    }
  }

  await tenantDbService.deleteTag(id);
  tags.value = tags.value.filter(tag => tag.id !== id);

  if (!fromSync) {
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.TAG,
      entityId: id,
      operationType: SyncOperationType.DELETE,
      payload: { id: id },
    });
  }

  return true;
}
```

#### 3. ColorHistory-Migration
```typescript
// Separate Persistierung für ColorHistory
const colorHistory = ref<string[]>([]);

async function loadColorHistory(): Promise<void> {
  try {
    // ColorHistory bleibt in localStorage (nicht sync-relevant)
    const savedColors = localStorage.getItem(storageKey('tag_colors'));
    colorHistory.value = savedColors ? JSON.parse(savedColors) : [];
  } catch (error) {
    colorHistory.value = [];
  }
}

function saveColorHistory(): void {
  localStorage.setItem(storageKey('tag_colors'), JSON.stringify(colorHistory.value));
}
```

## Store 3: RuleStore Migration

### Besonderheiten
- Regel-Engine mit komplexer Condition/Action-Logik
- TransactionService-Integration
- Nicht-tenant-spezifische Daten (aktuell)

### Erforderliche Änderungen

#### 1. Typ-Erweiterung
```typescript
interface AutomationRule {
  id: string
  name: string
  description?: string
  stage: 'PRE' | 'DEFAULT' | 'POST'
  conditions: RuleCondition[]
  actions: RuleAction[]
  priority: number
  isActive: boolean
  updated_at?: string // NEU: ISO 8601 Format
}
```

#### 2. Regel-Engine-Integration
```typescript
// Regel-Engine-Logik bleibt unverändert
function applyRulesToTransaction(
  transaction: Transaction,
  stage: 'PRE' | 'DEFAULT' | 'POST' = 'DEFAULT'
): Transaction {
  const sorted = [...rules.value]
    .filter((r) => r.isActive && r.stage === stage)
    .sort((a, b) => a.priority - b.priority);

  let modified: Transaction = { ...transaction };
  let applied = 0;

  for (const rule of sorted) {
    if (checkConditions(rule, modified)) {
      modified = applyActions(rule, modified);
      applied++;
    }
  }

  // TransactionService-Integration bleibt bestehen
  if (applied) {
    const updates: Partial<Transaction> = {};
    Object.keys(modified).forEach((k) => {
      if (k !== 'id' && k !== 'runningBalance' && modified[k] !== transaction[k]) {
        updates[k] = modified[k];
      }
    });
    if (Object.keys(updates).length) {
      TransactionService.updateTransaction(transaction.id, updates);
    }
  }

  return modified;
}
```

#### 3. Tenant-spezifische Persistierung
```typescript
// Migration von globalem localStorage zu tenant-spezifischem IndexedDB
async function loadRules(): Promise<void> {
  try {
    const loadedRules = await tenantDbService.getAllAutomationRules();
    rules.value = loadedRules || [];
    debugLog('ruleStore', 'loadRules completed', { count: rules.value.length });
  } catch (error) {
    errorLog('ruleStore', 'Fehler beim Laden der Regeln', error);
    rules.value = [];
  }
}
```

## Store 4: PlanningStore Migration

### Besonderheiten
- Komplexeste Datenstruktur (20+ Felder)
- Multiple Service-Integrationen (BalanceService, TransactionService, RuleStore)
- Umfangreiche Datenvalidierung und Transformationen

### Erforderliche Änderungen

#### 1. Typ-Erweiterung
```typescript
interface PlanningTransaction {
  id: string;
  name: string;
  accountId: string;
  categoryId: string | null;
  tagIds: string[];
  recipientId?: string | null;
  amount: number;
  amountType: AmountType;
  approximateAmount?: number;
  minAmount?: number;
  maxAmount?: number;
  note?: string;
  startDate: string;
  valueDate?: string | null;
  endDate?: string | null;
  recurrencePattern: RecurrencePattern;
  recurrenceCount?: number | null;
  recurrenceEndType: RecurrenceEndType;
  executionDay?: number | null;
  weekendHandling: WeekendHandlingType;
  transactionType?: TransactionType;
  counterPlanningTransactionId?: string | null;
  transferToAccountId?: string | null;
  transferToCategoryId?: string | null;
  isActive: boolean;
  forecastOnly: boolean;
  autoExecute?: boolean;
  updated_at?: string; // NEU: ISO 8601 Format
}
```

#### 2. Service-Integration beibehalten
```typescript
async function addPlanningTransaction(p: Partial<PlanningTransaction>, fromSync = false): Promise<PlanningTransaction> {
  // Umfangreiche Datenvalidierung und Standardwerte (unverändert)
  const planningTxWithTimestamp: PlanningTransaction = {
    id: p.id || uuidv4(),
    name: p.name || '',
    accountId: p.accountId || '',
    categoryId: p.categoryId ?? null,
    tagIds: p.tagIds || [],
    recipientId: p.recipientId ?? null,
    amount: p.amount || 0,
    amountType: p.amountType || AmountType.EXACT,
    approximateAmount: p.approximateAmount,
    minAmount: p.minAmount,
    maxAmount: p.maxAmount,
    note: p.note || '',
    startDate: p.startDate || new Date().toISOString(),
    valueDate: p.valueDate || p.startDate || new Date().toISOString(),
    endDate: p.endDate ?? null,
    recurrencePattern: p.recurrencePattern || RecurrencePattern.ONCE,
    recurrenceEndType: p.recurrenceEndType || RecurrenceEndType.NEVER,
    recurrenceCount: p.recurrenceCount ?? null,
    executionDay: p.executionDay ?? null,
    weekendHandling: p.weekendHandling || WeekendHandlingType.NONE,
    isActive: p.isActive !== undefined ? p.isActive : true,
    forecastOnly: p.forecastOnly !== undefined ? p.forecastOnly : false,
    transactionType: p.transactionType!,
    transferToAccountId: p.transferToAccountId,
    transferToCategoryId: p.transferToCategoryId,
    counterPlanningTransactionId: p.counterPlanningTransactionId || null,
    autoExecute: p.autoExecute || false,
    updated_at: p.updated_at || new Date().toISOString(),
  };

  // Sync-Logik (wie bei anderen Stores)
  if (fromSync) {
    // LWW-Konfliktauflösung
  }

  // IndexedDB-Persistierung
  await tenantDbService.addPlanningTransaction(planningTxWithTimestamp);

  // Store-State Update
  const existingIndex = planningTransactions.value.findIndex(pt => pt.id === planningTxWithTimestamp.id);
  if (existingIndex === -1) {
    planningTransactions.value.push(planningTxWithTimestamp);
  } else {
    planningTransactions.value[existingIndex] = planningTxWithTimestamp;
  }

  // Service-Integrationen beibehalten (nur bei lokalen Änderungen)
  if (!fromSync) {
    BalanceService.calculateMonthlyBalances();
    TransactionService.schedule(planningTxWithTimestamp);
    ruleStore.evaluateRules();

    // Sync-Queue Entry
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.PLANNING_TRANSACTION,
      entityId: planningTxWithTimestamp.id,
      operationType: SyncOperationType.CREATE,
      payload: planningTxWithTimestamp,
    });
  }

  return planningTxWithTimestamp;
}
```

#### 3. Datenvalidierung und Transformationen
```typescript
async function loadPlanningTransactions(): Promise<void> {
  try {
    const loadedPlanningTransactions = await tenantDbService.getAllPlanningTransactions();

    // Datenvalidierung und Transformationen (bestehende Logik)
    planningTransactions.value = (loadedPlanningTransactions || []).map((tx: any) => ({
      ...tx,
      name: tx.name || tx.payee || '',
      date: toDateOnlyString(tx.startDate),
      valueDate: toDateOnlyString(tx.valueDate || tx.startDate),
      amountType: tx.amountType || AmountType.EXACT,
      weekendHandling: tx.weekendHandling || WeekendHandlingType.NONE,
      recurrenceEndType: tx.recurrenceEndType || RecurrenceEndType.NEVER,
      isActive: tx.isActive !== undefined ? tx.isActive : true,
      forecastOnly: tx.forecastOnly !== undefined ? tx.forecastOnly : false,
    }));

    debugLog('planningStore', 'loadPlanningTransactions completed', { count: planningTransactions.value.length });
  } catch (error) {
    errorLog('planningStore', 'Fehler beim Laden der Planungstransaktionen', error);
    planningTransactions.value = [];
  }
}
```

## Gemeinsame Implementierungsschritte

### 1. TenantDbService erweitern
Für jeden Store die entsprechenden CRUD-Methoden hinzufügen.

### 2. EntityType Enum erweitern
```typescript
export enum EntityTypeEnum {
  ACCOUNT = 'ACCOUNT',
  ACCOUNT_GROUP = 'ACCOUNT_GROUP',
  TRANSACTION = 'TRANSACTION',
  CATEGORY = 'CATEGORY',
  CATEGORY_GROUP = 'CATEGORY_GROUP',
  RECIPIENT = 'RECIPIENT',
  PLANNING_TRANSACTION = 'PLANNING_TRANSACTION',
  AUTOMATION_RULE = 'AUTOMATION_RULE',
  TAG = 'TAG',
}
```

### 3. Typ-Definitionen erweitern
Alle Entitäten um `updated_at?: string` erweitern.

### 4. Store-Methoden migrieren
- `fromSync` Parameter zu allen CRUD-Methoden hinzufügen
- LWW-Konfliktauflösung implementieren
- Sync-Queue-Integration hinzufügen
- Async/await für alle DB-Operationen

### 5. Initialisierung anpassen
- `loadEntities()` Methoden für IndexedDB-Zugriff
- `initializeStore()` Methoden hinzufügen
- Fehlerbehandlung für DB-Operationen

## Testing-Strategie

### Unit Tests
- CRUD-Operationen für jeden Store
- Sync-Konfliktauflösung (LWW)
- Fehlerbehandlung bei DB-Fehlern

### Integration Tests
- Service-Integrationen (besonders PlanningStore)
- Tenant-Wechsel-Szenarien
- Performance bei großen Datenmengen

### E2E Tests
- Vollständige User-Workflows
- Offline/Online-Szenarien
- Datenintegrität über App-Neustarts

## Rollout-Strategie

### 1. Feature-Flags
Jede Store-Migration hinter Feature-Flag implementieren für schrittweisen Rollout.

### 2. Monitoring
Performance- und Fehler-Monitoring für jede Migration.

### 3. Rollback-Plan
Möglichkeit zur Rückkehr zu localStorage bei kritischen Problemen.

### 4. Benutzer-Kommunikation
Klare Kommunikation über Datenverlust bei Migration (keine automatische Datenmigration).

## Zeitplan

### Woche 1
- **Tag 1-2**: RecipientStore Migration + Tests
- **Tag 3-5**: TagStore Migration + Tests

### Woche 2
- **Tag 6-8**: RuleStore Migration + Tests
- **Tag 9-10**: PlanningStore Migration + Tests

### Woche 3
- Integration Tests
- Performance-Optimierung
- Dokumentation finalisieren

Jede Migration folgt dem bewährten Account/AccountGroup-Pattern und minimiert Änderungen an der bestehenden Geschäftslogik.
