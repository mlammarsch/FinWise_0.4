# Muuri Dashboard Implementation Plan

## Übersicht

Dieses Dokument beschreibt die detaillierte Implementierung des Muuri Grid-basierten Dashboards für FinWise. Der Plan umfasst die Erstellung von 4 Prototyp-Gadgets und die notwendige Infrastruktur.

## Komponenten-Architektur

### 1. BaseGadget.vue
**Pfad**: `src/components/dashboard/BaseGadget.vue`

```vue
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';

export interface GadgetProps {
  id: string;
  title: string;
  size?: 'small' | 'medium' | 'large' | 'wide' | 'tall';
  resizable?: boolean;
  scrollable?: boolean;
  stickyHeader?: boolean;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<GadgetProps>(), {
  size: 'medium',
  resizable: true,
  scrollable: false,
  stickyHeader: false,
  showHeader: true
});

const emit = defineEmits<{
  resize: [size: { width: number; height: number }];
  remove: [];
  configure: [];
}>();

// Größen-Mapping für CSS-Klassen
const sizeClasses = computed(() => {
  const sizeMap = {
    small: 'gadget-size-small',    // 280x200px
    medium: 'gadget-size-medium',  // 580x200px
    large: 'gadget-size-large',    // 580x420px
    wide: 'gadget-size-wide',      // 880x200px
    tall: 'gadget-size-tall'       // 280x420px
  };
  return sizeMap[props.size];
});

// Resize-Funktionalität
const isResizing = ref(false);
const gadgetRef = ref<HTMLElement>();

const startResize = (event: MouseEvent) => {
  if (!props.resizable) return;
  isResizing.value = true;
  // Resize-Logik wird hier implementiert
};
</script>

<template>
  <div
    ref="gadgetRef"
    :class="[
      'gadget-base',
      sizeClasses,
      { 'gadget-resizing': isResizing }
    ]"
    :data-gadget-id="id"
  >
    <!-- Gadget Header -->
    <div
      v-if="showHeader"
      :class="[
        'gadget-header',
        { 'sticky': stickyHeader }
      ]"
    >
      <h3 class="gadget-title">{{ title }}</h3>
      <div class="gadget-actions">
        <button
          class="btn btn-ghost btn-xs"
          @click="emit('configure')"
          title="Konfigurieren"
        >
          <Icon icon="mdi:cog" />
        </button>
        <button
          class="btn btn-ghost btn-xs"
          @click="emit('remove')"
          title="Entfernen"
        >
          <Icon icon="mdi:close" />
        </button>
      </div>
    </div>

    <!-- Gadget Content -->
    <div
      :class="[
        'gadget-content',
        { 'scrollable': scrollable }
      ]"
    >
      <slot />
    </div>

    <!-- Resize Handle -->
    <div
      v-if="resizable"
      class="resize-handle"
      @mousedown="startResize"
    >
      <Icon icon="mdi:resize-bottom-right" />
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.gadget-base {
  @apply bg-base-100 border border-base-300 rounded-lg shadow-md;
  @apply relative overflow-hidden;
  position: relative;
}

/* Größen-Definitionen */
.gadget-size-small {
  width: 280px;
  height: 200px;
}

.gadget-size-medium {
  width: 580px;
  height: 200px;
}

.gadget-size-large {
  width: 580px;
  height: 420px;
}

.gadget-size-wide {
  width: 880px;
  height: 200px;
}

.gadget-size-tall {
  width: 280px;
  height: 420px;
}

.gadget-header {
  @apply flex justify-between items-center p-3 border-b border-base-300;
  @apply bg-base-100;
  height: 48px;
  min-height: 48px;
}

.gadget-header.sticky {
  position: sticky;
  top: 0;
  z-index: 10;
}

.gadget-title {
  @apply text-lg font-semibold text-base-content;
  margin: 0;
}

.gadget-actions {
  @apply flex gap-1;
}

.gadget-content {
  height: calc(100% - 48px);
  padding: 1rem;
}

.gadget-content.scrollable {
  overflow-y: auto;
  overflow-x: hidden;
}

.resize-handle {
  @apply absolute bottom-0 right-0 w-4 h-4;
  @apply cursor-se-resize text-base-content opacity-50;
  @apply flex items-center justify-center;
}

.resize-handle:hover {
  @apply opacity-100;
}

.gadget-resizing {
  @apply ring-2 ring-primary;
}
</style>
```

### 2. MuuriGridContainer.vue
**Pfad**: `src/components/dashboard/MuuriGridContainer.vue`

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import Muuri from 'muuri';
import type { GridConfig, GadgetConfig } from './types/dashboard';

const props = defineProps<{
  gadgets: GadgetConfig[];
  editable?: boolean;
}>();

const emit = defineEmits<{
  layoutChange: [gadgets: GadgetConfig[]];
  gadgetAdd: [type: string];
  gadgetRemove: [id: string];
}>();

const gridContainer = ref<HTMLElement>();
let muuriGrid: Muuri | null = null;

// Muuri Grid initialisieren
const initializeGrid = async () => {
  if (!gridContainer.value) return;

  await nextTick();

  muuriGrid = new Muuri(gridContainer.value, {
    items: '.gadget-item',
    dragEnabled: props.editable,
    layout: {
      fillGaps: false,
      horizontal: false,
      alignRight: false,
      alignBottom: false,
      rounding: true
    },
    layoutOnResize: 150,
    layoutDuration: 300,
    layoutEasing: 'ease',
    dragSortPredicate: {
      threshold: 50,
      action: 'move'
    },
    dragRelease: {
      duration: 300,
      easing: 'ease'
    }
  });

  // Event-Listener für Layout-Änderungen
  muuriGrid.on('layoutEnd', handleLayoutChange);
  muuriGrid.on('move', handleItemMove);
};

// Layout-Änderungen verarbeiten
const handleLayoutChange = () => {
  if (!muuriGrid) return;

  const items = muuriGrid.getItems();
  const updatedGadgets = items.map((item, index) => {
    const element = item.getElement();
    const gadgetId = element.getAttribute('data-gadget-id');
    const position = item.getPosition();

    return {
      ...props.gadgets.find(g => g.id === gadgetId)!,
      position: { x: position.left, y: position.top },
      order: index
    };
  });

  emit('layoutChange', updatedGadgets);
};

const handleItemMove = (data: any) => {
  console.log('Item moved:', data);
};

// Gadget hinzufügen
const addGadget = (gadgetConfig: GadgetConfig) => {
  if (!muuriGrid) return;

  // Neues DOM-Element erstellen
  const element = document.createElement('div');
  element.className = 'gadget-item';
  element.setAttribute('data-gadget-id', gadgetConfig.id);

  // Element zum Grid hinzufügen
  muuriGrid.add([element]);
};

// Gadget entfernen
const removeGadget = (gadgetId: string) => {
  if (!muuriGrid) return;

  const items = muuriGrid.getItems();
  const item = items.find(item =>
    item.getElement().getAttribute('data-gadget-id') === gadgetId
  );

  if (item) {
    muuriGrid.remove([item], { removeElements: true });

if (item) {
    muuriGrid.remove([item], { removeElements: true });
    emit('gadgetRemove', gadgetId);
  }
};

// Grid aktualisieren
const refreshGrid = () => {
  if (!muuriGrid) return;
  muuriGrid.refreshItems();
  muuriGrid.layout();
};

onMounted(() => {
  initializeGrid();
});

onUnmounted(() => {
  if (muuriGrid) {
    muuriGrid.destroy();
  }
});

// Externe API für Parent-Komponente
defineExpose({
  addGadget,
  removeGadget,
  refreshGrid
});
</script>

<template>
  <div class="muuri-grid-wrapper">
    <!-- Add Gadget Button -->
    <div v-if="editable" class="add-gadget-fab">
      <button
        class="btn btn-primary btn-circle"
        @click="emit('gadgetAdd', 'selector')"
        title="Gadget hinzufügen"
      >
        <Icon icon="mdi:plus" class="text-xl" />
      </button>
    </div>

    <!-- Muuri Grid Container -->
    <div
      ref="gridContainer"
      class="muuri-grid"
    >
      <div
        v-for="gadget in gadgets"
        :key="gadget.id"
        class="gadget-item"
        :data-gadget-id="gadget.id"
      >
        <component
          :is="getGadgetComponent(gadget.type)"
          v-bind="gadget.props"
          :id="gadget.id"
          :size="gadget.size"
          @remove="removeGadget(gadget.id)"
          @resize="handleGadgetResize(gadget.id, $event)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="postcss" scoped>
.muuri-grid-wrapper {
  @apply relative w-full min-h-screen;
  @apply p-4;
}

.muuri-grid {
  @apply relative;
  /* Muuri übernimmt die Positionierung */
}

.gadget-item {
  @apply absolute;
  /* Muuri setzt position und transform */
}

.add-gadget-fab {
  @apply fixed bottom-6 right-6 z-50;
}

/* Responsive Anpassungen */
@media (max-width: 768px) {
  .muuri-grid-wrapper {
    @apply p-2;
  }

  .gadget-item {
    /* Mobile: Gadgets nehmen volle Breite */
    width: 100% !important;
  }
}
</style>
```

### 3. Gadget-Typen und Konfiguration
**Pfad**: `src/components/dashboard/types/dashboard.ts`

```typescript
export interface GadgetConfig {
  id: string;
  type: GadgetType;
  title: string;
  size: GadgetSize;
  position: { x: number; y: number };
  order: number;
  isVisible: boolean;
  props: Record<string, any>;
  settings: GadgetSettings;
}

export type GadgetType =
  | 'kontostand'
  | 'einnahmen-ausgaben'
  | 'letzte-transaktionen'
  | 'finanz-trend'
  | 'geplante-zahlungen'
  | 'top-budgets'
  | 'sparziele'
  | 'monats-trend'
  | 'schnellaktionen';

export type GadgetSize = 'small' | 'medium' | 'large' | 'wide' | 'tall';

export interface GadgetSettings {
  refreshInterval?: number;
  showHeader?: boolean;
  customTitle?: string;
  limit?: number; // Für Listen-Gadgets
  dateRange?: { start: string; end: string }; // Für Zeit-basierte Gadgets
}

export interface GridConfig {
  version: number;
  tenantId: string;
  userId: string;
  gadgets: GadgetConfig[];
  gridSettings: {
    columns: number;
    gap: number;
    editable: boolean;
  };
  lastModified: string;
}

// Standard-Gadget-Konfigurationen
export const DEFAULT_GADGET_CONFIGS: Record<GadgetType, Partial<GadgetConfig>> = {
  'kontostand': {
    title: 'Kontostand',
    size: 'large',
    settings: { showHeader: true }
  },
  'einnahmen-ausgaben': {
    title: 'Letzte 30 Tage',
    size: 'medium',
    settings: { showHeader: true, dateRange: { start: '', end: '' } }
  },
  'letzte-transaktionen': {
    title: 'Letzte Transaktionen',
    size: 'large',
    settings: { showHeader: true, limit: 5 }
  },
  'finanz-trend': {
    title: 'Finanztrend',
    size: 'wide',
    settings: { showHeader: true }
  },
  'geplante-zahlungen': {
    title: 'Geplante Zahlungen',
    size: 'medium',
    settings: { showHeader: true, limit: 3 }
  },
  'top-budgets': {
    title: 'Top Budgets',
    size: 'medium',
    settings: { showHeader: true, limit: 5 }
  },
  'sparziele': {
    title: 'Sparziele',
    size: 'medium',
    settings: { showHeader: true, limit: 5 }
  },
  'monats-trend': {
    title: 'Monatstrend',
    size: 'medium',
    settings: { showHeader: true }
  },
  'schnellaktionen': {
    title: 'Schnellaktionen',
    size: 'small',
    settings: { showHeader: true }
  }
};
```

## 4. Prototyp-Gadgets

### 4.1 KontostandGadget.vue
**Pfad**: `src/components/dashboard/gadgets/KontostandGadget.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useAccountStore } from '../../../stores/accountStore';
import { BalanceService } from '../../../services/BalanceService';
import BaseGadget from '../BaseGadget.vue';
import CurrencyDisplay from '../../ui/CurrencyDisplay.vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  id: string;
  size?: 'small' | 'medium' | 'large' | 'wide' | 'tall';
}>();

const emit = defineEmits<{
  remove: [];
  resize: [size: { width: number; height: number }];
  configure: [];
}>();

const accountStore = useAccountStore();

// Gesamtsaldo berechnen
const totalBalance = computed(() => BalanceService.getTotalBalance());

// Kontogruppen mit Salden
const accountGroupsWithBalances = computed(() => {
  return accountStore.accountGroups
    .filter((group) => {
      const groupAccounts = accountStore.accounts.filter(
        (account) =>
          account.accountGroupId === group.id &&
          account.isActive &&
          !account.isOfflineBudget
      );
      return groupAccounts.length > 0;
    })
    .map((group) => {
      const groupBalance = BalanceService.getAccountGroupBalance(group.id);
      const groupAccounts = accountStore.accounts
        .filter(
          (account) =>
            account.accountGroupId === group.id &&
            account.isActive &&
            !account.isOfflineBudget
        )
        .map((account) => ({
          ...account,
          balance: BalanceService.getTodayBalance("account", account.id),
        }));

      return {
        ...group,
        balance: groupBalance,
        accounts: groupAccounts,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
});

const navigateToAccounts = () => {
  window.location.href = '/accounts';
};
</script>

<template>
  <BaseGadget
    :id="id"
    title="Kontostand"
    :size="size"
    scrollable
    sticky-header
    @remove="emit('remove')"
    @resize="emit('resize', $event)"
    @configure="emit('configure')"
  >
    <!-- Gesamtsaldo -->
    <div class="mb-4">
      <p class="text-2xl font-bold">
        <CurrencyDisplay
          :amount="totalBalance"
          :as-integer="true"
        />
      </p>
      <p class="text-sm opacity-60">Gesamtsaldo aller Konten</p>
    </div>

    <!-- Kontogruppen als Collapse-Komponenten -->
    <div class="space-y-2">
      <div
        v-for="group in accountGroupsWithBalances"
        :key="group.id"
        tabindex="0"
        class="collapse collapse-arrow bg-base-200 border-base-300 border"
      >
        <div class="collapse-title text-sm font-medium py-2 px-3">
          <div class="flex justify-between items-center">
            <span>{{ group.name }}</span>
            <span class="font-semibold">
              <CurrencyDisplay
                :amount="group.balance"
                :as-integer="true"
              />
            </span>
          </div>
        </div>
        <div class="collapse-content px-3 pb-2">
          <div class="space-y-1">
            <div
              v-for="account in group.accounts"
              :key="account.id"
              class="flex justify-between items-center py-1 px-2 rounded bg-base-100"
            >
              <span class="text-xs">{{ account.name }}</span>
              <span class="text-xs font-medium">
                <CurrencyDisplay
                  :amount="account.balance"
                  :as-integer="true"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Details Button -->
    <div class="mt-4 pt-4 border-t border-base-300">
      <button
        class="btn btn-sm btn-ghost w-full"
        @click="navigateToAccounts"
      >
        Details anzeigen
        <Icon icon="mdi:chevron-right" class="ml-1" />
      </button>
    </div>
  </BaseGadget>
</template>
```

### 4.2 EinnahmenAusgabenGadget.vue
**Pfad**: `src/components/dashboard/gadgets/EinnahmenAusgabenGadget.vue`

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStatisticsStore } from '../../../stores/statisticsStore';
import BaseGadget from '../BaseGadget.vue';
import CurrencyDisplay from '../../ui/CurrencyDisplay.vue';
import { Icon } from '@iconify/vue';
import dayjs from 'dayjs';

const props = defineProps<{
  id: string;
  size?: 'small' | 'medium' | 'large' | 'wide' | 'tall';
  dateRange?: { start: string; end: string };
}>();

const emit = defineEmits<{
  remove: [];
  resize: [size: { width: number; height: number }];
  configure: [];
}>();

const statisticsStore = useStatisticsStore();

// Standardmäßig letzte 30 Tage
const currentDate = dayjs();
const startDate = ref(props.dateRange?.start || currentDate.subtract(30, "day").format("YYYY-MM-DD"));
const endDate = ref(props.dateRange?.end || currentDate.format("YYYY-MM-DD"));

// Einnahmen/Ausgaben-Zusammenfassung
const incomeSummary = computed(() => {
  return statisticsStore.getIncomeExpenseSummary(
    startDate.value,
    endDate.value
  );
});

const navigateToTransactions = () => {
  window.location.href = '/transactions';
};
</script>

<template>
  <BaseGadget
    :id="id"
    title="Letzte 30 Tage"
    :size="size"
    @remove="emit('remove')"
    @resize="emit('resize', $event)"
    @configure="emit('configure')"
  >
    <div class="grid grid-cols-3 gap-4">
      <div class="text-center">
        <p class="text-sm text-base-content/70">Einnahmen</p>
        <p class="text-lg font-semibold text-success">
          <CurrencyDisplay
            :amount="incomeSummary.income"
            :as-integer="true"
          />
        </p>
      </div>
      <div class="text-center">
        <p class="text-sm text-base-content/70">Ausgaben</p>
        <p class="text-lg font-semibold text-error">
          <CurrencyDisplay
            :amount="incomeSummary.expense * -1"
            :as-integer="true"
          />
        </p>
      </div>
      <div class="text-center">
        <p class="text-sm text-base-content/70">Bilanz</p>
        <p class="text-lg font-semibold" :class="{
          'text-success': incomeSummary.balance >= 0,
          'text-error': incomeSummary.balance < 0
        }">
          <CurrencyDisplay
            :amount="incomeSummary.balance"
            :as-integer="true"
          />
        </p>
      </div>
    </div>

    <!-- Details Button -->
    <div class="mt-4 pt-4 border-t border-base-300">
      <button
        class="btn btn-sm btn-ghost w-full"
        @click="navigateToTransactions"
      >
        Details anzeigen
        <Icon icon="mdi:chevron-right" class="ml-1" />
      </button>
    </div>
  </BaseGadget>
</template>
```

### 4.3 LetzteTransaktionenGadget.vue
**Pfad**: `src/components/dashboard/gadgets/LetzteTransaktionenGadget.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useTransactionStore } from '../../../stores/transactionStore';
import { useAccountStore } from '../../../stores/accountStore';
import { useCategoryStore } from '../../../stores/categoryStore';
import { useRecipientStore } from '../../../stores/recipientStore';
import { TransactionType } from '../../../types';
import { formatDate } from '../../../utils/formatters';
import BaseGadget from '../BaseGadget.vue';
import CurrencyDisplay from '../../ui/CurrencyDisplay.vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  id: string;
  size?: 'small' | 'medium' | 'large' | 'wide' | 'tall';
  limit?: number;
}>();

const emit = defineEmits<{
  remove: [];
  resize: [size: { width: number; height: number }];
  configure: [];
}>();

const transactionStore = useTransactionStore();
const accountStore = useAccountStore();
const categoryStore = useCategoryStore();
const recipientStore = useRecipientStore();

const transactionLimit = props.limit || 5;

// Gefilterte Transaktionen: nur INCOME und EXPENSE
const recentTransactions = computed(() => {
  return transactionStore.transactions
    .filter(
      (tx) =>
        tx.type === TransactionType.INCOME ||
        tx.type === TransactionType.EXPENSE
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, transactionLimit);
});

const getAccountName = (accountId: string) => {
  return accountStore.getAccountById(accountId)?.name || '-';
};

const getCategoryName = (categoryId: string) => {
  return categoryStore.getCategoryById(categoryId)?.name || '-';
};

const getRecipientName = (recipientId: string) => {
  return recipientStore.getRecipientById(recipientId)?.name || '-';
};

const navigateToTransactions = () => {
  window.location.href = '/transactions';
};
</script>

<template>
  <BaseGadget
    :id="id"
    title="Letzte Transaktionen"
    :size="size"
    scrollable
    sticky-header
    @remove="emit('remove')"
    @resize="emit('resize', $event)"
    @configure="emit('configure')"
  >
    <div class="overflow-x-auto">
      <table class="table table-sm w-full">
        <!-- Sticky Table Header -->
        <thead class="sticky top-0 bg-base-100 z-10">
          <tr>
            <th class="text-xs">Datum</th>
            <th class="text-xs">Empfänger</th>
            <th class="text-xs">Kategorie</th>
            <th class="text-xs text-right">Betrag</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="transaction in recentTransactions"
            :key="transaction.id"
            class="hover:bg-base-200"
          >
            <td class="text-xs">
              {{ formatDate(transaction.date) }}
            </td>
            <td class="text-xs">
              {{ getRecipientName(transaction.recipientId || '') }}
            </td>
            <td class="text-xs">
              {{ getCategoryName(transaction.categoryId || '') }}
            </td>
            <td class="text-xs text-right">
              <CurrencyDisplay
                :amount="transaction.amount"
                :as-integer="true"
                :class="{
                  'text-success': transaction.type === TransactionType.INCOME,
                  'text-error': transaction.type === TransactionType.EXPENSE
                }"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Details Button -->
    <div class="mt-4 pt-4 border-t border-base-300">
      <button
        class="btn btn-sm btn-ghost w-full"
        @click="navigateToTransactions"
      >
        Alle Transaktionen
        <Icon icon="mdi:chevron-right" class="ml-1" />
      </button>
    </div>
  </BaseGadget>
</template>
```

### 4.4 FinanzTrendGadget.vue
**Pfad**: `src/components/dashboard/gadgets/FinanzTrendGadget.vue`

```vue
<script setup lang="ts">
import BaseGadget from '../BaseGadget.vue';
import FinancialTrendChart from '../../ui/charts/FinancialTrendChart.vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  id: string;
  size?: 'small' | 'medium' | 'large' | 'wide' | 'tall';
}>();

const emit = defineEmits<{
  remove: [];
  resize: [size: { width: number; height: number }];
  configure: [];
}>();

const navigateToStatistics = () => {
  window.location.href = '/statistics';
};
</script>

<template>
  <BaseGadget
    :id="id"
    title="Finanztrend"
    :size="size"
    @remove="emit('remove')"
    @resize="emit('resize', $event)"
    @configure="emit('configure')"
  >
    <div class="h-full flex flex-col">
      <!-- Chart Container -->
      <div class="flex-1 min-h-0">
        <FinancialTrendChart />
      </div>

      <!-- Details Button -->
      <div class="mt-4 pt-4 border-t border-base-300">
        <button
          class="btn btn-sm btn-ghost w-full"
          @click="navigateToStatistics"
        >
          Detaillierte Statistiken
          <Icon icon="mdi:chevron-right" class="ml-1" />
        </button>
      </div>
    </div>
  </BaseGadget>
</template>
```

## 5. Dashboard-Integration

### 5.1 Aktualisierte DashboardView.vue
**Pfad**: `src/views/DashboardView.vue` (Ersetzt bestehende Implementierung)

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MuuriGridContainer from '../components/dashboard/MuuriGridContainer.vue';
import type { GadgetConfig } from '../components/dashboard/types/dashboard';

// Standard-Gadgets für Prototyp
const defaultGadgets: GadgetConfig[] = [
  {
    id: 'kontostand-1',
    type: 'kontostand',
    title: 'Kontostand',
    size: 'large',
    position: { x: 0, y: 0 },
    order: 0,
    isVisible: true,
    props: {},
    settings: { showHeader: true }
  },
  {
    id: 'einnahmen-ausgaben-1',
    type: 'einnahmen-ausgaben',
    title: 'Letzte 30 Tage',
    size: 'medium',
    position: { x: 600, y: 0 },
    order: 1,
    isVisible: true,
    props: {},
    settings: { showHeader: true }
  },
  {
    id: 'letzte-transaktionen-1',
    type: 'letzte-transaktionen',
    title: 'Letzte Transaktionen',
    size: 'large',
    position: { x: 0, y: 440 },
    order: 2,
    isVisible: true,
    props: { limit: 5 },
    settings: { showHeader: true, limit: 5 }
  },
  {
    id: 'finanz-trend-1',
    type: 'finanz-trend',
    title: 'Finanztrend',
    size: 'wide',
    position: { x: 600, y: 220 },
    order: 3,
    isVisible: true,
    props: {},
    settings: { showHeader: true }
  }
];

const gadgets = ref<GadgetConfig[]>(defaultGadgets);
const isEditable = ref(true);

// Event-Handler
const handleLayoutChange = (updatedGadgets: GadgetConfig[]) => {
  gadgets.value = updatedGadgets;
  // TODO: Persistierung implementieren
  console.log('Layout changed:', updatedGadgets);
};

const handleGadgetAdd = (type: string) => {
  console.log('Add gadget:', type);
  // TODO: Gadget-Selector implementieren
};

const handleGadgetRemove = (id: string) => {
  gadgets.value = gadgets.value.filter(g => g.id !== id);
  console.log('Remove gadget:', id);
};

onMounted(() => {
  // TODO: Gespeicherte Konfiguration laden
});
</script>

<template>
  <div class="dashboard-view">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <div class="flex gap-2">
        <button
          class="btn btn-sm"
          :class="isEditable ? 'btn-primary' : 'btn-outline'"
          @click="isEditable = !isEditable"
        >
          {{ isEditable ? 'Bearbeitung beenden' : 'Bearbeiten' }}
        </button>
      </div>
    </div>

    <MuuriGridContainer
      :gadgets="gadgets"
      :editable="isEditable"
      @layout-change="handleLayoutChange"
      @gadget-add="handleGadgetAdd"
      @gadget-remove="handleGadgetRemove"
    />
  </div>
</template>

<style lang="postcss" scoped>
.dashboard-view {
  @apply min-h-screen bg-base-200;
  @apply p-4;
}
</style>
```

## 6. Nächste Schritte

Nach der Implementierung dieser Basis-Komponenten:

1. **Testing**: Muuri Grid-Funktionalität testen
2. **Resize-Implementierung**: Detaillierte Resize-Logik
3. **Persistierung**: IndexedDB-Integration
4. **Weitere Gadgets**: Restliche 5 Gadgets implementieren
5. **Gadget-Selector**: UI für Gadget-Auswahl
6. **Mobile Optimierung**: Responsive Verhalten

## 7. Technische Hinweise

### Muuri-spezifische Überlegungen:
- **Item-Dimensionen**: Müssen vor Grid-Initialisierung bekannt sein
- **Layout-Updates**: Nach DOM-Änderungen `refreshItems()` + `layout()` aufrufen
- **Performance**: Bei vielen Items Layout-Updates debouncing verwenden
- **Responsive**: Mobile Ansicht erfordert spezielle Behandlung

### CSS-Grid vs. Muuri:
- Muuri für Drag & Drop und dynamische Anordnung
- CSS-Grid als Fallback für statische Layouts
- Hybrid-Ansatz für beste Performance

### Persistierung-Strategie:
- Lokale Speicherung in IndexedDB
- Sync-Queue für Backend-Synchronisation
- Conflict Resolution über Timestamps

## 8. Implementierungsreihenfolge

### Phase 1: Basis-Infrastruktur
1. `BaseGadget.vue` - Grundlegende Gadget-Funktionalität
2. `dashboard/types/dashboard.ts` - TypeScript-Definitionen
3. `MuuriGridContainer.vue` - Grid-Container mit Muuri-Integration

### Phase 2: Prototyp-Gadgets
1. `KontostandGadget.vue` - Kontostand-Anzeige
2. `EinnahmenAusgabenGadget.vue` - 30-Tage-Übersicht
3. `LetzteTransaktionenGadget.vue` - Transaktionsliste mit Sticky Header
4. `FinanzTrendGadget.vue` - Chart-Integration

### Phase 3: Dashboard-Integration
1. Aktualisierte `DashboardView.vue`
2. Muuri-Bibliothek Integration
3. Grundlegende Drag & Drop Tests

### Phase 4: Erweiterte Features
1. Resize-Funktionalität
2. Persistierung-System
3. Gadget-Selector
4. Mobile Optimierung

## 9. Testing-Strategie

### Unit Tests:
- BaseGadget-Komponente
- Gadget-spezifische Logik
- Grid-Konfiguration-Management

### Integration Tests:
- Muuri Grid-Funktionalität
- Drag & Drop-Verhalten
- Persistierung-Workflows

### E2E Tests:
- Dashboard-Benutzerfluss
- Responsive Verhalten
- Performance-Tests

## 10. Performance-Überlegungen

### Optimierungen:
- Lazy Loading für Gadgets
- Virtual Scrolling in Listen-Gadgets
- Debounced Layout-Updates
- Memoization für berechnete Werte

### Monitoring:
- Layout-Update-Zeiten
- Memory Usage bei vielen Gadgets
- Render-Performance auf mobilen Geräten
