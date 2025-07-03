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
import { AccountService } from "../../services/AccountService"; // neu
import { useTenantStore } from "../../stores/tenantStore";
import { ImageService } from "../../services/ImageService"; // Import ImageService
import { Icon } from "@iconify/vue"; // Icon importieren
import Muuri from "muuri"; // Muuri importieren

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
  const dataUrl = await ImageService.fetchAndCacheLogo(logoPath);
  if (dataUrl) {
    displayLogoSrc.value = dataUrl;
  } else {
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
    await accountStore.deleteAccountGroup(props.group.id);
  }
};

// Modal Handler
const onGroupSaved = async (groupData: Partial<AccountGroup>) => {
  showEditModal.value = false;
  // Delegate update to AccountService
  await AccountService.updateAccountGroup(props.group.id, groupData);
};

// Account Selection Handler
const onAccountSelect = (account: Account) => emit("selectAccount", account);

// Muuri-Initialisierung
const initializeMuuri = () => {
  if (!gridContainer.value) return;

  try {
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

    // Event-Listener für Drag-End
    muuriGrid.value.on("dragEnd", handleDragEnd);

    // Event-Listener für Layout-End - signalisiert Größenänderung an Parent
    muuriGrid.value.on("layoutEnd", () => {
      emit("request-layout-update");
    });
  } catch (error) {
    console.error("Fehler bei Muuri-Initialisierung:", error);
  }
};

// Muuri-Cleanup
const destroyMuuri = () => {
  if (muuriGrid.value) {
    // Aus Registry entfernen
    muuriRegistry.delete(muuriGrid.value);
    muuriGrid.value.destroy();
    muuriGrid.value = null;
  }
};

// Drag-End Handler (Placeholder für Task 3.0)
const handleDragEnd = (item: any, event: any) => {
  console.log("Drag ended:", item, event);

  // Aufgabe 2.2: Neue Reihenfolge der DOM-Elemente aus der Muuri-Instanz abrufen
  const sortedItems = muuriGrid.value?.getItems();
  console.log("Sortierte Elemente nach Drag-End:", sortedItems);

  // Aufgabe 2.3: sortOrder aller Konten in der betroffenen Gruppe neu berechnen
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

    console.log("Neue Account-Reihenfolge (IDs):", sortedAccountIds);

    // Business Logic aus AccountService nutzen für sortOrder-Neuberechnung
    // Diese Funktion berechnet automatisch die sortOrder basierend auf Array-Index
    AccountService.updateAccountOrder(props.group.id, sortedAccountIds)
      .then(() => {
        console.log(
          "Account-Sortierung erfolgreich über AccountService aktualisiert"
        );
      })
      .catch((error) => {
        console.error(
          "Fehler beim Aktualisieren der Account-Sortierung:",
          error
        );
      });
  }

  // TODO: Implementierung in Task 3.0
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
