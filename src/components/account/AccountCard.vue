<!-- Datei: src/components/account/AccountCard.vue -->
<script setup lang="ts">
import { defineProps, computed, ref, watch, onMounted } from "vue";
import { Account } from "../../types";
import CurrencyDisplay from "../ui/CurrencyDisplay.vue";
import { useRouter } from "vue-router";
import AccountReconcileModal from "./AccountReconcileModal.vue";
import AccountForm from "./AccountForm.vue";
import { useAccountStore } from "../../stores/accountStore";
import { AccountService } from "../../services/AccountService"; // neu
import TransactionImportModal from "../transaction/TransactionImportModal.vue"; // neu für CSV-Import
import { Icon } from "@iconify/vue";
import {
  useTenantStore,
  type FinwiseTenantSpecificDB,
} from "../../stores/tenantStore"; // Import useTenantStore und FinwiseTenantSpecificDB
import { ImageService } from "../../services/ImageService"; // Import ImageService

const emit = defineEmits(["select"]);

const props = defineProps<{
  account: Account;
  active?: boolean;
}>();

const router = useRouter();
const accountStore = useAccountStore();

// State für Modals
const showReconcileModal = ref(false);
const showEditModal = ref(false);
const showImportModal = ref(false); // neu für CSV-Import

const displayLogoSrc = ref<string | null>(null);

// Logo laden
const loadDisplayLogo = async () => {
  const logoPath = props.account.logoPath;
  if (!logoPath) {
    displayLogoSrc.value = null;
    return;
  }

  const activeTenantDB = useTenantStore().activeTenantDB; // Direktzugriff auf activeTenantDB
  if (activeTenantDB) {
    const cachedLogo = await activeTenantDB.logoCache.get(logoPath);
    if (cachedLogo?.dataUrl) {
      displayLogoSrc.value = cachedLogo.dataUrl;
    }
  }

  if (
    !displayLogoSrc.value ||
    (activeTenantDB && !(await activeTenantDB.logoCache.get(logoPath))?.dataUrl)
  ) {
    const dataUrl = await ImageService.fetchAndCacheLogo(logoPath);
    if (dataUrl) {
      displayLogoSrc.value = dataUrl;
    } else {
      if (!displayLogoSrc.value) {
        displayLogoSrc.value = null;
      }
    }
  }
};

watch(
  () => props.account.logoPath,
  async (newLogoPath, oldLogoPath) => {
    if (newLogoPath !== oldLogoPath) {
      await loadDisplayLogo();
    }
  },
  { immediate: false } // immediate false, da onMounted bereits aufruft
);

onMounted(async () => {
  await loadDisplayLogo();
});

// IBAN‑Formatierung
const formattedIban = computed(() => {
  if (!props.account.iban) return "";
  const iban = props.account.iban.replace(/\s/g, "");
  return iban.match(/.{1,4}/g)?.join(" ") || iban;
});

// Aktueller Saldo (Service)
const currentBalance = computed(() =>
  AccountService.getCurrentBalance(props.account.id)
);

// Aktionen
const showTransactions = () => {
  router.push({ name: "transactions", query: { accountId: props.account.id } });
};

const deleteAccount = async () => {
  if (
    confirm(`Möchtest Du das Konto "${props.account.name}" wirklich löschen?`)
  ) {
    await accountStore.deleteAccount(props.account.id);
  }
};

// Modal Handler
const onReconciled = async () => {
  showReconcileModal.value = false;
  await accountStore.loadAccounts();
};

const onAccountSaved = async (accountData: Partial<Account>) => {
  showEditModal.value = false;
  // Delegate update to AccountService
  await AccountService.updateAccount(props.account.id, accountData);
};

// Handler für CSV-Import (neu)
const onImportCompleted = (count: number) => {
  showImportModal.value = false;
};

// Konto auswählen
const selectAccount = () => {
  emit("select", props.account);
};
</script>

<template>
  <div
    :class="[
      'card rounded-md border border-base-300 shadow-none relative cursor-pointer hover:bg-base-300',
      props.active ? 'bg-primary/20' : 'bg-base-200',
    ]"
    style="width: 100%"
    @click="selectAccount"
  >
    <!-- Dropdown-Menü -->
    <div
      class="dropdown dropdown-end absolute top-1 right-1"
      @click.stop
    >
      <button
        tabindex="0"
        class="btn btn-ghost border-none btn-sm btn-circle"
      >
        <Icon icon="mdi:dots-vertical" />
      </button>
      <ul
        tabindex="0"
        class="dropdown-content menu p-2 shadow bg-base-100 border border-base-300 rounded-box w-52"
      >
        <li><a @click="showReconcileModal = true">Kontoabgleich</a></li>
        <li><a @click="showImportModal = true">Import</a></li>
        <!-- Eintrag für CSV-Import -->
        <li><a @click="showEditModal = true">Bearbeiten</a></li>
        <li>
          <a
            @click="deleteAccount"
            class="text-error"
            >Löschen</a
          >
        </li>
      </ul>
    </div>

    <div class="card-body min-h-22 flex flex-row items-center p-0">
      <!-- Konto-Logo -->
      <div
        class="w-16 h-16 flex-shrink-0 mr-1 ml-2 flex items-center justify-center rounded-full overflow-hidden bg-gray-200"
      >
        <img
          v-if="displayLogoSrc"
          :src="displayLogoSrc"
          :alt="props.account.name + ' Logo'"
          class="w-full h-full object-cover"
        />
        <Icon
          v-else
          icon="mdi:bank"
          class="text-3xl text-gray-400"
        />
      </div>

      <!-- Kontodetails -->
      <div class="flex-grow">
        <div class="grid grid-rows-[auto_auto_auto] m-1 pl-2 py-1">
          <h2
            class="card-title m-0 p-0 text-lg"
            :class="{ 'text-primary': props.active }"
          >
            {{ account.name }}
          </h2>
          <div
            class="text-sm m-0 p-0"
            :class="{ 'text-primary': props.active }"
          >
            {{ account.description }}
          </div>
          <div
            class="text-sm opacity-50 m-0 pt-1"
            :class="{ 'text-primary': props.active }"
          >
            {{ formattedIban }}
          </div>
        </div>
      </div>

      <!-- Saldo -->
      <div class="justify-self-end flex items-center flex-shrink-0 ml-2 mr-3">
        <CurrencyDisplay
          class="text-right text-base whitespace-nowrap"
          :amount="currentBalance"
          :show-zero="true"
          :asInteger="true"
        />
        <Icon
          icon="mdi:scale-balance"
          class="text-secondary text-base opacity-50 ml-2"
        />
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <AccountReconcileModal
        v-if="showReconcileModal"
        :account="account"
        :is-open="showReconcileModal"
        @close="showReconcileModal = false"
        @reconciled="onReconciled"
      />

      <div
        v-if="showEditModal"
        class="modal modal-open"
      >
        <div class="modal-box max-w-2xl">
          <h3 class="font-bold text-lg mb-4">Konto bearbeiten</h3>
          <AccountForm
            :account="account"
            :is-edit="true"
            @save="onAccountSaved"
            @cancel="showEditModal = false"
          />
        </div>
        <div
          class="modal-backdrop"
          @click="showEditModal = false"
        ></div>
      </div>

      <!-- Neues Import-Modal -->
      <TransactionImportModal
        v-if="showImportModal"
        :is-open="showImportModal"
        :accountId="account.id"
        @close="showImportModal = false"
        @imported="onImportCompleted"
      />
    </Teleport>
  </div>
</template>
