<!-- Datei: src/components/account/AccountGroupCard.vue -->
<script setup lang="ts">
import {
  computed,
  ref,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { Account, AccountGroup } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import AccountCard from "./AccountCard.vue";
import AccountGroupForm from "./AccountGroupForm.vue";
import { AccountService } from "../../services/AccountService";
import { useTenantStore } from "../../stores/tenantStore";
import { ImageService } from "../../services/ImageService";
import { Icon } from "@iconify/vue";
import Muuri from "muuri";
import { debugLog, infoLog, errorLog } from "../../utils/logger";

// Globale Registry für alle Muuri-Instanzen (für Inter-Group-Drag)
const muuriRegistry = new Set<Muuri>();

const emit = defineEmits(["selectAccount", "request-layout-update"]);

const props = defineProps<{
  group: AccountGroup;
  activeAccountId?: string;
}>();

const accountStore = useAccountStore();

// State für Modal
const showEditModal = ref(false);

// Muuri-Instanz für diese Kontogruppe
const muuriGrid = ref<Muuri | null>(null);
const gridContainer = ref<HTMLElement | null>(null);

const displayLogoSrc = ref<string | null>(null);

// Logo laden
const loadDisplayLogo = async () => {
  const logoPath = props.group.logo_path;
  if (!logoPath) {
    displayLogoSrc.value = null;
    return;
  }

  // Zuerst Cache abfragen über TenantDbService für Konsistenz
  const activeTenantDB = useTenantStore().activeTenantDB;
  if (activeTenantDB) {
    const cachedLogo = await activeTenantDB.logoCache.get(logoPath);
    if (cachedLogo?.data) {
      displayLogoSrc.value = cachedLogo.data as string;
      return; // Logo im Cache gefunden, keine Netzwerkanfrage nötig
    }
  }

  // Nur wenn nicht im Cache: Netzwerkanfrage an Backend
  try {
    const dataUrl = await ImageService.fetchAndCacheLogo(logoPath);
    if (dataUrl) {
      displayLogoSrc.value = dataUrl;
      debugLog(
        "AccountGroupCard",
        `Logo erfolgreich geladen für Gruppe ${props.group.name}`,
        { logoPath }
      );
    } else {
      displayLogoSrc.value = null;
      debugLog(
        "AccountGroupCard",
        `Kein Logo verfügbar für Gruppe ${props.group.name}`,
        { logoPath }
      );
    }
  } catch (error) {
    errorLog(
      "AccountGroupCard",
      `Fehler beim Laden des Logos für Gruppe ${props.group.name}`,
      { logoPath, error }
    );
    displayLogoSrc.value = null;
  }
};

watch(
  () => props.group.logo_path,
  async (newLogoPath, oldLogoPath) => {
    if (newLogoPath !== oldLogoPath) {
      await loadDisplayLogo();
    }
  },
  { immediate: false }
);

onMounted(async () => {
  await loadDisplayLogo();
  await nextTick(); // Warten bis DOM gerendert ist
  initializeMuuri();
});

onBeforeUnmount(() => {
  destroyMuuri();
});

// Konten der Gruppe (gefiltert und nach sortOrder sortiert)
const accountsInGroup = computed(() =>
  accountStore.accounts
    .filter(
      (account) => account.accountGroupId === props.group.id && account.isActive
    )
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
);

// Saldo der Gruppe (Service)
const groupBalance = computed(() => {
  const balances = AccountService.getGroupBalances();
  return balances[props.group.id] ?? 0;
});

// Anzahl Konten
const accountCount = computed(() => accountsInGroup.value.length);

// Gruppe löschen
const deleteAccountGroup = async () => {
  if (
    confirm(`Möchtest Du die Gruppe "${props.group.name}" wirklich löschen?`)
  ) {
    try {
      debugLog("AccountGroupCard", `Lösche Kontogruppe ${props.group.name}`, {
        groupId: props.group.id,
      });
      await accountStore.deleteAccountGroup(props.group.id);
      infoLog(
        "AccountGroupCard",
        `Kontogruppe ${props.group.name} erfolgreich gelöscht`,
        { groupId: props.group.id }
      );
    } catch (error) {
      errorLog(
        "AccountGroupCard",
        `Fehler beim Löschen der Kontogruppe ${props.group.name}`,
        { groupId: props.group.id, error }
      );
    }
  }
};

// Modal Handler
const onGroupSaved = async (groupData: Partial<AccountGroup>) => {
  showEditModal.value = false;
  try {
    debugLog(
      "AccountGroupCard",
      `Aktualisiere Kontogruppe ${props.group.name}`,
      { groupId: props.group.id, groupData }
    );
    await AccountService.updateAccountGroup(props.group.id, groupData);
    infoLog(
      "AccountGroupCard",
      `Kontogruppe ${props.group.name} erfolgreich aktualisiert`,
      { groupId: props.group.id }
    );
  } catch (error) {
    errorLog(
      "AccountGroupCard",
      `Fehler beim Aktualisieren der Kontogruppe ${props.group.name}`,
      { groupId: props.group.id, error }
    );
  }
};

// Account Selection Handler
const onAccountSelect = (account: Account) => emit("selectAccount", account);

// Muuri-Initialisierung
const initializeMuuri = () => {
  if (!gridContainer.value) {
    debugLog(
      "AccountGroupCard",
      `Grid-Container nicht verfügbar für Gruppe ${props.group.name}`,
      { groupId: props.group.id }
    );
    return;
  }

  try {
    debugLog(
      "AccountGroupCard",
      `Initialisiere Muuri für Gruppe ${props.group.name}`,
      { groupId: props.group.id }
    );
    muuriGrid.value = new Muuri(gridContainer.value, {
      items: ".account-item",
      dragEnabled: true,
      dragHandle: ".drag-handle",
      dragAxis: "y", // Beschränke Drag auf vertikale Achse
      dragSort: function () {
        // Alle anderen Muuri-Instanzen für Inter-Group-Drag zurückgeben
        return Array.from(muuriRegistry).filter((grid) => grid !== this);
      },
      dragSortHeuristics: {
        sortInterval: 100,
        minDragDistance: 10,
        minBounceBackAngle: 1,
      },
      dragSortPredicate: {
        threshold: 50,
        action: "move",
      },
      layout: {
        fillGaps: false,
        horizontal: false, // Vertikales Layout
        alignRight: false,
        alignBottom: false,
        rounding: false,
      },
      layoutDuration: 300,
      layoutEasing: "ease",
    });

    // Instanz zur Registry hinzufügen
    muuriRegistry.add(muuriGrid.value);
    debugLog(
      "AccountGroupCard",
      `Muuri-Instanz zur Registry hinzugefügt für Gruppe ${props.group.name}`,
      { registrySize: muuriRegistry.size }
    );

    // Event-Listener für Drag-End
    muuriGrid.value.on("dragEnd", handleDragEnd);

    // Event-Listener für Layout-End - signalisiert Größenänderung an Parent
    muuriGrid.value.on("layoutEnd", () => {
      debugLog(
        "AccountGroupCard",
        `Layout-Update angefordert für Gruppe ${props.group.name}`
      );
      emit("request-layout-update");
    });

    infoLog(
      "AccountGroupCard",
      `Muuri erfolgreich initialisiert für Gruppe ${props.group.name}`,
      { groupId: props.group.id }
    );
  } catch (error) {
    errorLog("AccountGroupCard", "Fehler bei Muuri-Initialisierung", error);
  }
};

// Muuri-Cleanup
const destroyMuuri = () => {
  if (muuriGrid.value) {
    debugLog(
      "AccountGroupCard",
      `Zerstöre Muuri für Gruppe ${props.group.name}`,
      { groupId: props.group.id }
    );
    // Aus Registry entfernen
    muuriRegistry.delete(muuriGrid.value);
    muuriGrid.value.destroy();
    muuriGrid.value = null;
    debugLog(
      "AccountGroupCard",
      `Muuri erfolgreich zerstört für Gruppe ${props.group.name}`,
      { registrySize: muuriRegistry.size }
    );
  }
};

// Drag-End Handler - Subtasks 1.1 & 1.2: Inter-Group vs. Intra-Group Erkennung und Ziel-Grid-Extraktion
const handleDragEnd = async (item: any, event: any) => {
  debugLog("AccountGroupCard", "Drag ended", { item, event });

  // Subtask 1.1: Erkennung von Inter-Group vs. Intra-Group Bewegungen
  const draggedElement = item.getElement();
  const draggedAccountId = draggedElement?.getAttribute("data-account-id");

  if (!draggedAccountId) {
    errorLog(
      "AccountGroupCard",
      "Keine Account-ID im gedragten Element gefunden",
      { element: draggedElement }
    );
    return;
  }

  // Bestimme das Quell-Grid (diese Muuri-Instanz)
  const sourceGrid = muuriGrid.value;
  if (!sourceGrid) {
    errorLog("AccountGroupCard", "Quell-Grid nicht verfügbar");
    return;
  }

  // Subtask 1.2: Extraktion der Ziel-Grid-Information aus Muuri-Event
  let targetGrid = sourceGrid; // Default: Intra-Group
  let targetGroupId = props.group.id; // Default: aktuelle Gruppe
  let targetGridContainer: HTMLElement | null = null;

  // Prüfe verschiedene Quellen für Ziel-Grid-Information
  if (item._dragSort?.targetGrid) {
    // Primäre Quelle: Muuri's dragSort-Mechanismus
    targetGrid = item._dragSort.targetGrid;
    targetGridContainer = targetGrid.getElement();
  } else if (item._drag?.targetGrid) {
    // Alternative Quelle: Drag-Objekt
    targetGrid = item._drag.targetGrid;
    targetGridContainer = targetGrid.getElement();
  } else if (event?.targetGrid) {
    // Event-basierte Quelle
    targetGrid = event.targetGrid;
    targetGridContainer = targetGrid.getElement();
  }

  // Extrahiere Ziel-Gruppen-ID aus dem Grid-Container
  if (targetGridContainer && targetGrid !== sourceGrid) {
    // Suche nach dem übergeordneten AccountGroupCard-Element
    let groupElement = targetGridContainer.closest("[data-group-id]");
    if (!groupElement) {
      // Fallback: Suche in der DOM-Hierarchie nach Gruppe
      groupElement = targetGridContainer.closest(".card");
      if (groupElement) {
        // Versuche Gruppen-ID aus verschiedenen Attributen zu extrahieren
        const possibleGroupId =
          groupElement.getAttribute("data-group-id") ||
          groupElement
            .querySelector("[data-group-id]")
            ?.getAttribute("data-group-id");
        if (possibleGroupId) {
          targetGroupId = possibleGroupId;
        }
      }
    } else {
      targetGroupId =
        groupElement.getAttribute("data-group-id") || props.group.id;
    }

    // Zusätzliche Validierung: Suche in der Muuri-Registry
    Array.from(muuriRegistry).forEach((registeredGrid) => {
      if (registeredGrid === targetGrid) {
        const registeredContainer = registeredGrid.getElement();
        const registeredGroupElement =
          registeredContainer?.closest("[data-group-id]");
        if (registeredGroupElement) {
          const registeredGroupId =
            registeredGroupElement.getAttribute("data-group-id");
          if (registeredGroupId) {
            targetGroupId = registeredGroupId;
          }
        }
      }
    });
  }

  // Prüfe, ob es sich um eine Inter-Group oder Intra-Group Bewegung handelt
  const isInterGroupMove =
    targetGrid !== sourceGrid && targetGroupId !== props.group.id;

  debugLog("AccountGroupCard", "Drag-Operation Details", {
    draggedAccountId,
    sourceGroupId: props.group.id,
    targetGroupId,
    isInterGroupMove,
    sourceGrid: sourceGrid,
    targetGrid: targetGrid,
    targetGridContainer: targetGridContainer,
    dragSortInfo: item._dragSort,
    dragInfo: item._drag,
  });

  if (isInterGroupMove) {
    debugLog(
      "AccountGroupCard",
      `Inter-Group Bewegung erkannt: ${props.group.id} → ${targetGroupId}`
    );

    // Subtask 1.3: Bestimmung der neuen Position im Ziel-Grid
    let newIndex = 0; // Default: An den Anfang

    if (targetGrid && targetGrid !== sourceGrid) {
      // Hole alle Items aus dem Ziel-Grid in ihrer aktuellen Reihenfolge
      const targetItems = targetGrid.getItems();

      // Finde die Position des gedragten Elements im Ziel-Grid
      const draggedItemInTarget = targetItems.find(
        (targetItem) => targetItem.getElement() === draggedElement
      );

      if (draggedItemInTarget) {
        // Element wurde bereits in das Ziel-Grid eingefügt - finde seine Position
        newIndex = targetItems.indexOf(draggedItemInTarget);
      } else {
        // Fallback: Verwende die Anzahl der Items im Ziel-Grid (ans Ende)
        newIndex = targetItems.length;
      }

      debugLog("AccountGroupCard", "Ziel-Grid Position Details", {
        targetItems: targetItems.length,
        newIndex,
        draggedItemFound: !!draggedItemInTarget,
      });
    }

    debugLog(
      "AccountGroupCard",
      `Inter-Group Position bestimmt: Index ${newIndex} in Gruppe ${targetGroupId}`
    );

    // Subtask 1.4: Service-Methoden aufrufen
    try {
      await AccountService.moveAccountToGroup(
        draggedAccountId,
        targetGroupId,
        newIndex
      );
      infoLog(
        "AccountGroupCard",
        `Inter-Group Bewegung erfolgreich: Konto ${draggedAccountId} zu Gruppe ${targetGroupId} an Position ${newIndex}`
      );
    } catch (error) {
      errorLog("AccountGroupCard", "Fehler bei Inter-Group Bewegung", error);
      // Bei Fehler: Muuri-Layout zurücksetzen
      if (sourceGrid) {
        sourceGrid.refreshItems();
        sourceGrid.layout();
      }
      if (targetGrid && targetGrid !== sourceGrid) {
        targetGrid.refreshItems();
        targetGrid.layout();
      }
    }
  } else {
    // Intra-Group Bewegung - bestehende Logik beibehalten
    debugLog(
      "AccountGroupCard",
      "Intra-Group Bewegung erkannt - verwende bestehende Logik"
    );

    // Neue Reihenfolge der DOM-Elemente aus der Muuri-Instanz abrufen
    const sortedItems = sourceGrid.getItems();
    debugLog(
      "AccountGroupCard",
      "Sortierte Elemente nach Drag-End",
      sortedItems
    );

    if (sortedItems) {
      // Account-IDs in der neuen Reihenfolge extrahieren
      const sortedAccountIds: string[] = [];

      sortedItems.forEach((sortedItem) => {
        // data-account-id aus DOM-Element extrahieren
        const element = sortedItem.getElement();
        const accountId = element?.getAttribute("data-account-id");

        if (accountId) {
          sortedAccountIds.push(accountId);
        }
      });

      debugLog(
        "AccountGroupCard",
        "Neue Account-Reihenfolge (IDs)",
        sortedAccountIds
      );

      // Subtask 1.4: Service-Methoden aufrufen für Intra-Group Bewegungen
      try {
        await AccountService.updateAccountOrder(
          props.group.id,
          sortedAccountIds
        );
        infoLog(
          "AccountGroupCard",
          "Account-Sortierung erfolgreich über AccountService aktualisiert"
        );
      } catch (error) {
        errorLog(
          "AccountGroupCard",
          "Fehler beim Aktualisieren der Account-Sortierung",
          error
        );
        // Bei Fehler: Muuri-Layout zurücksetzen
        if (sourceGrid) {
          sourceGrid.refreshItems();
          sourceGrid.layout();
        }
      }
    }
  }
};

// Watch für Änderungen der Konten-Anzahl (für Layout-Update)
watch(accountCount, async () => {
  if (muuriGrid.value) {
    await nextTick();
    muuriGrid.value.refreshItems();
    muuriGrid.value.layout();
  }
});
</script>

<template>
  <div class="item-content">
    <div
      class="card glass-effect bg-none border border-base-300 shadow-md relative"
      :data-group-id="group.id"
    >
      <!-- Dropdown -->
      <div class="dropdown dropdown-end absolute top-1 right-1">
        <label
          tabindex="0"
          class="btn btn-ghost btn-sm btn-circle border-none"
        >
          <Icon icon="mdi:dots-vertical" />
        </label>
        <ul
          tabindex="0"
          class="dropdown-content menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-52"
        >
          <li><a @click="showEditModal = true">Bearbeiten</a></li>
          <li>
            <a
              @click="deleteAccountGroup"
              class="text-error"
              >Löschen</a
            >
          </li>
        </ul>
      </div>

      <!-- Kopf -->
      <div class="card-body flex flex-row p-3">
        <div class="drag-handle flex items-center cursor-move">
          <Icon
            icon="mdi:drag-vertical"
            class="w-12 h-12 text-base-content opacity-30 mr-0"
          />
          <div class="p-0 w-24">
            <div
              class="w-12 h-12 rounded-md overflow-hidden flex items-center justify-center bg-base-200 opacity-80"
            >
              <img
                v-if="displayLogoSrc"
                :src="displayLogoSrc"
                :alt="props.group.name + ' Logo'"
                class="w-full h-full object-cover"
              />
              <Icon
                v-else
                icon="mdi:folder-multiple-outline"
                class="w-8 h-8 text-base-content opacity-50"
              />
            </div>
          </div>

          <div class="flex flex-col md:flex-row w-full mr-1 ml-1">
            <div class="self-start flex-grow md:self-center">
              <h3 class="text-lg opacity-50 font-semibold">{{ group.name }}</h3>
            </div>
          </div>
        </div>
        <div class="flex flex-col md:flex-row w-full mr-1 ml-1 justify-end">
          <div
            class="self-start w-full md:self-center md:w-25 flex items-center md:justify-end"
          >
            <CurrencyDisplay
              class="text-base"
              :amount="groupBalance"
              :show-zero="true"
              :asInteger="true"
            />
            <Icon
              icon="mdi:scale-balance"
              class="text-secondary text-base opacity-50 ml-2"
            />
          </div>
        </div>
      </div>

      <!-- Kontenübersicht -->
      <div class="card-body py-0 px-3">
        <div
          ref="gridContainer"
          class="muuri-grid accounts-container"
        >
          <div
            v-for="account in accountsInGroup"
            :key="account.id"
            class="account-item"
            :data-account-id="account.id"
          >
            <div class="item-content">
              <AccountCard
                :account="account"
                :active="activeAccountId === account.id"
                @select="onAccountSelect"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Card Footer -->
      <div class="card-actions py-4 px-3">
        <div class="grid grid-cols-1 gap-1"></div>
      </div>

      <!-- Modal -->
      <Teleport to="body">
        <div
          v-if="showEditModal"
          class="modal modal-open"
        >
          <div class="modal-box max-w-2xl">
            <h3 class="font-bold text-lg mb-4">Kontogruppe bearbeiten</h3>
            <AccountGroupForm
              :group="group"
              :is-edit="true"
              @save="onGroupSaved"
              @cancel="showEditModal = false"
            />
          </div>
          <div
            class="modal-backdrop"
            @click="showEditModal = false"
          ></div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
/* Muuri Grid Container */
.muuri-grid.accounts-container {
  position: relative;
  width: 100%;
  min-height: 60px; /* Mindesthöhe für leere Gruppen */
}

/* Account Items für vertikale Anordnung */
.account-item {
  position: absolute;
  width: 100%; /* Volle Breite für einspaltige Darstellung */
  margin-bottom: 8px; /* Abstand zwischen Konten */
}

/* Item Content */
.account-item .item-content {
  width: 100%;
  padding: 0;
  margin: 0;
}

/* Sicherstellen, dass AccountCard die volle Breite nutzt */
.account-item .item-content > * {
  width: 100%;
}
</style>
