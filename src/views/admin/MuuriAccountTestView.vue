<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import { AccountService } from "../../services/AccountService";
import { debugLog, infoLog, errorLog } from "../../utils/logger";
import { Icon } from "@iconify/vue";
import Muuri from "muuri";
import AccountGroupCard from "../../components/account/AccountGroupCard.vue";

// Stores
const accountStore = useAccountStore();

// Muuri-Instanzen für Kontogruppen-Sortierung
const groupsGrid = ref<Muuri | null>(null);
const groupsContainer = ref<HTMLElement | null>(null);

// Refs für AccountGroupCard-Komponenten
const accountGroupCardRefs = ref<InstanceType<typeof AccountGroupCard>[]>([]);

// Debouncing für sortOrder-Updates
const sortOrderUpdateTimer = ref<NodeJS.Timeout | null>(null);
const SORT_ORDER_DEBOUNCE_DELAY = 500;

// Computed properties
const accountGroups = computed(() => {
  return [...accountStore.accountGroups].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );
});

// Lifecycle Hooks
onMounted(async () => {
  await nextTick();
  // Warte bis AccountGroupCards geladen sind, dann initialisiere Gruppen-Grid
  setTimeout(() => {
    initializeGroupsGrid();
  }, 500);
  infoLog("MuuriAccountTestView", "Komponente geladen");
});

onBeforeUnmount(() => {
  destroyGroupsGrid();
  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }
  debugLog("MuuriAccountTestView", "Komponente wird zerstört");
});

// Muuri-Grid für Kontogruppen-Sortierung
const initializeGroupsGrid = () => {
  if (!groupsContainer.value) {
    debugLog("MuuriAccountTestView", "Groups container nicht verfügbar");
    return;
  }

  try {
    groupsGrid.value = new Muuri(groupsContainer.value, {
      items: ".account-group-wrapper",
      dragEnabled: true,
      dragHandle: ".group-drag-handle", // Spezifischer Handle für Gruppen
      layout: {
        fillGaps: false,
        horizontal: false,
        alignRight: false,
        alignBottom: false,
        rounding: false,
      },
      layoutDuration: 300,
      layoutEasing: "ease",
      dragStartPredicate: {
        distance: 10,
        delay: 0,
      },
    });

    groupsGrid.value.on("dragEnd", handleGroupDragEnd);

    infoLog(
      "MuuriAccountTestView",
      "Kontogruppen-Grid erfolgreich initialisiert"
    );
  } catch (error) {
    errorLog(
      "MuuriAccountTestView",
      "Fehler bei Kontogruppen-Grid-Initialisierung",
      error
    );
  }
};

const destroyGroupsGrid = () => {
  if (groupsGrid.value) {
    groupsGrid.value.destroy();
    groupsGrid.value = null;
  }
};

// Drag-Handler für Kontogruppen
const handleGroupDragEnd = async (item: any) => {
  if (!groupsGrid.value) return;

  if (sortOrderUpdateTimer.value) {
    clearTimeout(sortOrderUpdateTimer.value);
  }

  sortOrderUpdateTimer.value = setTimeout(async () => {
    try {
      const sortedItems = groupsGrid.value!.getItems();
      const sortedGroupIds: string[] = [];

      sortedItems.forEach((sortedItem: any) => {
        const element = sortedItem.getElement();
        const groupId = element?.getAttribute("data-group-id");
        if (groupId) {
          sortedGroupIds.push(groupId);
        }
      });

      debugLog(
        "MuuriAccountTestView",
        "Neue Kontogruppen-Reihenfolge",
        sortedGroupIds
      );

      // Erzeuge Sortier-Updates aus der neuen Reihenfolge und speichere sie
      const sortOrderUpdates = sortedGroupIds.map((id, index) => ({
        id,
        sortOrder: index,
      }));
      await AccountService.updateAccountGroupOrder(sortOrderUpdates);
      const success = true;

      if (success) {
        infoLog(
          "MuuriAccountTestView",
          "Kontogruppen-Sortierung erfolgreich aktualisiert"
        );
      } else {
        errorLog(
          "MuuriAccountTestView",
          "Fehler beim Aktualisieren der Kontogruppen-Sortierung"
        );
      }
    } catch (error) {
      errorLog(
        "MuuriAccountTestView",
        "Fehler beim Aktualisieren der Kontogruppen-Sortierung",
        error
      );
    }
  }, SORT_ORDER_DEBOUNCE_DELAY);
};

// Layout-Update-Funktion für AccountGroupCard-Events
const refreshGroupsLayout = () => {
  if (groupsGrid.value) {
    groupsGrid.value.refreshItems().layout();
  }
  debugLog("MuuriAccountTestView", "Layout-Update durchgeführt");
};

// Account Selection Handler
const onAccountSelect = (account: any) => {
  debugLog("MuuriAccountTestView", "Account selected", account);
};

// Reconcile Handler
const startReconcile = (account: any) => {
  debugLog("MuuriAccountTestView", "Start reconcile for account", account);
};
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex w-full justify-between items-center mb-6">
      <h2 class="text-xl font-bold flex-shrink-0">Account Muuri Test</h2>
      <div class="text-sm text-base-content/60">
        Test für Inter-Group Drag & Drop mit AccountCard/AccountGroupCard
      </div>
    </div>

    <!-- Muuri Grid Container für Kontogruppen-Sortierung -->
    <div
      ref="groupsContainer"
      class="space-y-4"
    >
      <div
        v-for="group in accountGroups"
        :key="group.id"
        :data-group-id="group.id"
        class="account-group-wrapper"
      >
        <!-- Drag Handle für Kontogruppen -->
        <div
          class="group-drag-handle flex items-center justify-center w-full h-6 cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 transition-colors mb-2"
        >
          <Icon
            icon="mdi:drag-horizontal"
            class="text-lg"
          />
          <span class="text-xs ml-2">Gruppe verschieben</span>
        </div>

        <AccountGroupCard
          :ref="(el: any) => { if (el) accountGroupCardRefs.push(el) }"
          :group="group"
          :activeAccountId="''"
          @selectAccount="onAccountSelect"
          @reconcileAccount="startReconcile"
          @request-layout-update="refreshGroupsLayout"
        />
      </div>
    </div>

    <!-- Debug Info -->
    <div class="mt-8 p-4 bg-base-200 rounded-lg">
      <h3 class="text-lg font-semibold mb-2">Debug Info</h3>
      <div class="text-sm space-y-1">
        <div>Anzahl Kontogruppen: {{ accountGroups.length }}</div>
        <div>Kontogruppen-Grid aktiv: {{ groupsGrid ? "Ja" : "Nein" }}</div>
        <div>AccountGroupCard Refs: {{ accountGroupCardRefs.length }}</div>
        <div class="text-xs text-base-content/60 mt-2">
          Kontogruppen haben eigenes Grid + AccountGroupCards verwalten
          Account-Drag
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Muuri-spezifische Styles für Kontogruppen */
.account-group-wrapper {
  position: relative;
  display: block;
  margin: 0 0 16px 0;
  z-index: 1;
}

.account-group-wrapper.muuri-item-dragging {
  z-index: 3;
}

.account-group-wrapper.muuri-item-releasing {
  z-index: 2;
}

.account-group-wrapper.muuri-item-hidden {
  z-index: 0;
}

.group-drag-handle {
  background: rgba(0, 0, 0, 0.05);
  border: 1px dashed rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 4px;
}

.group-drag-handle:hover {
  background: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.3);
}

/* Basis-Styles */
.space-y-4 > * + * {
  margin-top: 1rem;
}
</style>
