# Store Migration Analysis - IndexedDB Pattern

## Übersicht

Diese Analyse dokumentiert das bestehende IndexedDB-Migrationsmuster basierend auf der Account/AccountGroup-Store-Implementierung und erstellt einen detaillierten Plan für die Migration der vier verbleibenden Stores.

## Bestehende IndexedDB-Implementierung

### Architektur-Pattern

Das bestehende Muster folgt einer klaren 3-Schicht-Architektur:

```
┌─────────────────────────────────────────────────────────────┐
│                    Pinia Stores                             │
│  • Geschäftslogik  • State Management  • Sync-Logik        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 TenantDbService                             │
│  • CRUD Operations  • DB-Zugriff  • Error Handling         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   IndexedDB                                 │
│  • Tenant-spezifische DBs  • Dexie.js  • Transaktionen     │
└─────────────────────────────────────────────────────────────┘
```

### TenantDbService Pattern

Der [`TenantDbService`](../src/services/TenantDbService.ts) implementiert das Repository-Pattern mit folgenden Charakteristika:

#### 1. DB-Zugriff über Tenant Store
```typescript
private get db(): FinwiseTenantSpecificDB | null {
  const tenantStore = useTenantStore();
  return tenantStore.activeTenantDB;
}
```

#### 2. Standardisierte CRUD-Operationen
- **Create**: `add{Entity}(entity: Entity): Promise<void>`
- **Read**: `get{Entity}ById(id: string): Promise<Entity | undefined>`
- **Read All**: `getAll{Entities}(): Promise<Entity[]>`
- **Update**: `update{Entity}(entity: Entity): Promise<void>`
- **Delete**: `delete{Entity}(id: string): Promise<void>`

#### 3. Konsistente Fehlerbehandlung
```typescript
try {
  await this.db.entities.put(entity);
  debugLog('TenantDbService', `Entity "${entity.name}" hinzugefügt.`);
} catch (err) {
  errorLog('TenantDbService', `Fehler beim Hinzufügen der Entity`, { entity, error: err });
  throw err;
}
```

### Store Pattern (Account Store Analyse)

Der [`accountStore`](../src/stores/accountStore.ts) implementiert folgende Kernmuster:

#### 1. Service-Integration
```typescript
export const useAccountStore = defineStore('account', () => {
  const tenantDbService = new TenantDbService();
  // ...
});
```

#### 2. Sync-Integration mit Last-Write-Wins
```typescript
async function addAccount(accountData: Account, fromSync = false): Promise<Account> {
  const accountWithTimestamp: Account = {
    ...accountData,
    updated_at: accountData.updated_at || new Date().toISOString(),
  };

  if (fromSync) {
    // LWW-Konfliktauflösung
    const localAccount = await tenantDbService.getAccountById(accountWithTimestamp.id);
    if (localAccount && localAccount.updated_at && accountWithTimestamp.updated_at &&
        new Date(localAccount.updated_at) >= new Date(accountWithTimestamp.updated_at)) {
      return localAccount; // Lokale Version gewinnt
    }
  }

  // DB-Operation
  await tenantDbService.addAccount(accountWithTimestamp);

  // Store-State Update
  const existingIndex = accounts.value.findIndex(a => a.id === accountWithTimestamp.id);
  if (existingIndex === -1) {
    accounts.value.push(accountWithTimestamp);
  } else {
    accounts.value[existingIndex] = accountWithTimestamp;
  }

  // Sync-Queue Entry (nur bei lokalen Änderungen)
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

#### 3. Initialisierung und Reset
```typescript
async function loadAccounts(): Promise<void> {
  try {
    const [loadedAccounts, loadedAccountGroups] = await Promise.all([
      tenantDbService.getAllAccounts(),
      tenantDbService.getAllAccountGroups(),
    ]);
    accounts.value = loadedAccounts || [];
    accountGroups.value = loadedAccountGroups || [];
  } catch (error) {
    errorLog('accountStore', 'Fehler beim Laden der Konten', error);
    accounts.value = [];
    accountGroups.value = [];
  }
}

async function reset(): Promise<void> {
  accounts.value = [];
  accountGroups.value = [];
  await loadAccounts();
}
```

## Zu migrierende Stores - Analyse

### 1. RecipientStore

**Aktuelle Implementierung**: [`src/stores/recipientStore.ts`](../src/stores/recipientStore.ts)

#### Datenstruktur
```typescript
interface Recipient {
  id: string
  name: string
  defaultCategoryId?: string | null
  note?: string
}
```

#### Aktuelle Methoden
- `addRecipient(recipient: Omit<Recipient, 'id'>): Recipient`
- `updateRecipient(id: string, updates: Partial<Recipient>): boolean`
- `deleteRecipient(id: string): boolean`
- `loadRecipients(): void`
- `saveRecipients(): void`
- `reset(): void`

#### Migrationsbedarf
- **Niedrig**: Einfache CRUD-Operationen ohne komplexe Geschäftslogik
- **Sync-Integration**: Benötigt `updated_at` Timestamp und Sync-Queue Integration
- **TenantDbService**: Neue Methoden für Recipient-CRUD erforderlich

### 2. PlanningStore

**Aktuelle Implementierung**: [`src/stores/planningStore.ts`](../src/stores/planningStore.ts)

#### Datenstruktur
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
  // ... weitere 15+ Felder
}
```

#### Aktuelle Methoden
- `addPlanningTransaction(p: Partial<PlanningTransaction>): PlanningTransaction`
- `updatePlanningTransaction(id: string, upd: Partial<PlanningTransaction>): boolean`
- `deletePlanningTransaction(id: string): void`
- `loadPlanningTransactions(): void`
- `savePlanningTransactions(): void`
- `reset(): void`

#### Besonderheiten
- **Komplexe Geschäftslogik**: Integration mit `BalanceService`, `TransactionService`, `RuleStore`
- **Datenvalidierung**: Umfangreiche Standardwerte und Transformationen
- **Service-Abhängigkeiten**: Mehrere externe Service-Aufrufe

#### Migrationsbedarf
- **Hoch**: Komplexe Datenstruktur und Geschäftslogik
- **Service-Integration**: Beibehaltung der bestehenden Service-Aufrufe
- **Sync-Integration**: Vollständige LWW-Implementierung erforderlich

### 3. RuleStore

**Aktuelle Implementierung**: [`src/stores/ruleStore.ts`](../src/stores/ruleStore.ts)

#### Datenstruktur
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
}
```

#### Aktuelle Methoden
- `addRule(rule: Omit<AutomationRule, 'id'>): AutomationRule`
- `updateRule(id: string, updates: Partial<AutomationRule>): boolean`
- `deleteRule(id: string): boolean`
- `applyRulesToTransaction(transaction: Transaction, stage: string): Transaction`
- `reset(): void`

#### Besonderheiten
- **Regel-Engine**: Komplexe Logik für Bedingungen und Aktionen
- **TransactionService-Integration**: Direkte Transaktions-Updates
- **Nicht-tenant-spezifisch**: Verwendet `finwise_rules` localStorage Key

#### Migrationsbedarf
- **Mittel**: Regel-Engine-Logik bleibt unverändert
- **Storage-Key**: Anpassung auf tenant-spezifische Persistierung
- **Sync-Integration**: Vollständige LWW-Implementierung

### 4. TagStore

**Aktuelle Implementierung**: [`src/stores/tagStore.ts`](../src/stores/tagStore.ts)

#### Datenstruktur
```typescript
interface Tag {
  id: string
  name: string
  parentTagId?: string | null
  color: string
  icon?: string
}
```

#### Aktuelle Methoden
- `addTag(tag: Omit<Tag, 'id'>): Tag`
- `updateTag(updatedTag: Tag): boolean`
- `deleteTag(id: string): boolean`
- `loadTags(): void`
- `saveTags(): void`
- `reset(): void`

#### Besonderheiten
- **Hierarchische Struktur**: Parent-Child-Beziehungen
- **Color-Management**: Separate `colorHistory` Persistierung
- **Lösch-Validierung**: Verhindert Löschen von Tags mit Kindern
- **Nicht-tenant-spezifisch**: Verwendet `finwise_tags` localStorage Key

#### Migrationsbedarf
- **Mittel**: Hierarchie-Logik und Color-Management
- **Storage-Keys**: Anpassung auf tenant-spezifische Persistierung
- **Sync-Integration**: Vollständige LWW-Implementierung

## Erforderliche TenantDbService-Erweiterungen

### Neue Methoden für RecipientStore
```typescript
// Recipients
async addRecipient(recipient: Recipient): Promise<void>
async updateRecipient(recipient: Recipient): Promise<void>
async deleteRecipient(recipientId: string): Promise<void>
async getRecipientById(recipientId: string): Promise<Recipient | undefined>
async getAllRecipients(): Promise<Recipient[]>
```

### Neue Methoden für PlanningStore
```typescript
// Planning Transactions
async addPlanningTransaction(planningTx: PlanningTransaction): Promise<void>
async updatePlanningTransaction(planningTx: PlanningTransaction): Promise<void>
async deletePlanningTransaction(planningTxId: string): Promise<void>
async getPlanningTransactionById(planningTxId: string): Promise<PlanningTransaction | undefined>
async getAllPlanningTransactions(): Promise<PlanningTransaction[]>
```

### Neue Methoden für RuleStore
```typescript
// Automation Rules
async addAutomationRule(rule: AutomationRule): Promise<void>
async updateAutomationRule(rule: AutomationRule): Promise<void>
async deleteAutomationRule(ruleId: string): Promise<void>
async getAutomationRuleById(ruleId: string): Promise<AutomationRule | undefined>
async getAllAutomationRules(): Promise<AutomationRule[]>
```

### Neue Methoden für TagStore
```typescript
// Tags
async addTag(tag: Tag): Promise<void>
async updateTag(tag: Tag): Promise<void>
async deleteTag(tagId: string): Promise<void>
async getTagById(tagId: string): Promise<Tag | undefined>
async getAllTags(): Promise<Tag[]>
```

## Migrations-Reihenfolge und Prioritäten

### Phase 1: Einfache Stores (Woche 1)
1. **RecipientStore** - Niedrigste Komplexität, gutes Lernbeispiel
2. **TagStore** - Mittlere Komplexität, hierarchische Strukturen

### Phase 2: Komplexe Stores (Woche 2)
3. **RuleStore** - Regel-Engine-Integration, Service-Abhängigkeiten
4. **PlanningStore** - Höchste Komplexität, multiple Service-Integrationen

## Gemeinsame Migrationsmuster

### 1. Typ-Erweiterungen
Alle Entitäten benötigen `updated_at` Timestamp:
```typescript
interface Recipient {
  id: string
  name: string
  defaultCategoryId?: string | null
  note?: string
  updated_at?: string // NEU: ISO 8601 Format
}
```

### 2. EntityType Enum-Erweiterungen
```typescript
export enum EntityTypeEnum {
  // Bestehend
  ACCOUNT = 'ACCOUNT',
  ACCOUNT_GROUP = 'ACCOUNT_GROUP',
  TRANSACTION = 'TRANSACTION',
  // NEU
  RECIPIENT = 'RECIPIENT',
  PLANNING_TRANSACTION = 'PLANNING_TRANSACTION',
  AUTOMATION_RULE = 'AUTOMATION_RULE',
  TAG = 'TAG',
}
```

### 3. Store-Methoden-Template
```typescript
async function add{Entity}(entityData: Entity, fromSync = false): Promise<Entity> {
  // 1. Timestamp hinzufügen
  const entityWithTimestamp: Entity = {
    ...entityData,
    updated_at: entityData.updated_at || new Date().toISOString(),
  };

  // 2. Sync-Konfliktauflösung
  if (fromSync) {
    const localEntity = await tenantDbService.get{Entity}ById(entityWithTimestamp.id);
    if (localEntity && localEntity.updated_at && entityWithTimestamp.updated_at &&
        new Date(localEntity.updated_at) >= new Date(entityWithTimestamp.updated_at)) {
      return localEntity; // Lokale Version gewinnt
    }
  }

  // 3. DB-Operation
  await tenantDbService.add{Entity}(entityWithTimestamp);

  // 4. Store-State Update
  const existingIndex = entities.value.findIndex(e => e.id === entityWithTimestamp.id);
  if (existingIndex === -1) {
    entities.value.push(entityWithTimestamp);
  } else {
    entities.value[existingIndex] = entityWithTimestamp;
  }

  // 5. Sync-Queue Entry
  if (!fromSync) {
    await tenantDbService.addSyncQueueEntry({
      entityType: EntityTypeEnum.{ENTITY},
      entityId: entityWithTimestamp.id,
      operationType: SyncOperationType.CREATE,
      payload: entityWithTimestamp,
    });
  }

  return entityWithTimestamp;
}
```

## Risiken und Mitigation

### 1. Datenintegrität
**Risiko**: Verlust von localStorage-Daten während Migration
**Mitigation**:
- Keine automatische Datenmigration (wie spezifiziert)
- Benutzer werden über Datenverlust informiert
- Backup-Empfehlungen in Release Notes

### 2. Service-Abhängigkeiten
**Risiko**: Breaking Changes in Service-Integrationen
**Mitigation**:
- Schrittweise Migration mit Rückwärtskompatibilität
- Umfangreiche Tests der Service-Integrationen
- Rollback-Strategie für kritische Fehler

### 3. Performance
**Risiko**: Langsamere Performance durch async Operations
**Mitigation**:
- Batch-Operationen für große Datenmengen
- Lazy Loading für UI-Performance
- Performance-Monitoring und -Optimierung

## Nächste Schritte

1. **TenantDbService erweitern** - Alle erforderlichen CRUD-Methoden implementieren
2. **Typ-Definitionen aktualisieren** - `updated_at` Felder und EntityType Enum
3. **RecipientStore migrieren** - Als Proof-of-Concept beginnen
4. **Tests implementieren** - Unit- und Integrationstests für jede Migration
5. **Dokumentation aktualisieren** - Migration Guide mit spezifischen Beispielen

## Fazit

Das bestehende IndexedDB-Pattern ist gut strukturiert und konsistent implementiert. Die Migration der vier verbleibenden Stores folgt klaren, wiederverwendbaren Mustern mit minimalen Anpassungen der bestehenden Geschäftslogik. Die größte Herausforderung liegt in der korrekten Integration der Service-Abhängigkeiten, insbesondere beim PlanningStore.
