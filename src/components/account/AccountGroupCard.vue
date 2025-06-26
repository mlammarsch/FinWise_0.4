<!-- Datei: src/components/account/AccountGroupCard.vue -->
<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { AccountGroup } from "../../types";
import { useAccountStore } from "../../stores/accountStore";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import AccountCard from "./AccountCard.vue";
import AccountGroupForm from "./AccountGroupForm.vue";
import { AccountService } from "../../services/AccountService"; // neu
import { TenantDbService } from "../../services/TenantDbService"; // Import TenantDbService
import { ImageService } from "../../services/ImageService"; // Import ImageService
import { Icon } from "@iconify/vue"; // Icon importieren

const emit = defineEmits(["selectAccount"]);

const props = defineProps<{
  group: AccountGroup;
  activeAccountId?: string;
}>();

const accountStore = useAccountStore();
const tenantDbService = new TenantDbService();

// State für Modal
const showEditModal = ref(false);

const displayLogoSrc = ref<string | null>(null);

// Logo laden
const loadDisplayLogo = async () => {
  const logoPath = props.group.logoPath;
  if (!logoPath) {
    displayLogoSrc.value = null;
    return;
  }

  // Zuerst Cache abfragen
  if (tenantDbService) {
    const cachedLogo = await tenantDbService.getCachedLogo(logoPath);
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
  () => props.group.logoPath,
  async (newLogoPath, oldLogoPath) => {
    if (newLogoPath !== oldLogoPath) {
      await loadDisplayLogo();
    }
  },
  { immediate: false }
);

onMounted(async () => {
  await loadDisplayLogo();
});

// Konten der Gruppe
const accountsInGroup = computed(() =>
  accountStore.accounts.filter(
    (account) => account.accountGroupId === props.group.id && account.isActive
  )
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
const onGroupSaved = async (groupData) => {
  showEditModal.value = false;
  // Delegate update to AccountService
  await AccountService.updateAccountGroup(props.group.id, groupData);
};

// Account Selection Handler
const onAccountSelect = (account) => emit("selectAccount", account);
</script>

<template>
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
      <div class="grid grid-cols-1 gap-1">
        <AccountCard
          v-for="account in accountsInGroup"
          :key="account.id"
          :account="account"
          :active="activeAccountId === account.id"
          @select="onAccountSelect"
        />
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
</template>
