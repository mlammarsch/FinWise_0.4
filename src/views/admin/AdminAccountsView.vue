<script setup lang="ts">
import { ref, computed } from "vue";
import { useAccountStore } from "../../stores/accountStore";
import AccountForm from "../../components/account/AccountForm.vue";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay.vue";
import { Account, AccountType, AccountGroup } from "../../types";
import AccountGroupForm from "../../components/account/AccountGroupForm.vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { BalanceService } from "@/services/BalanceService";

// Stores
const accountStore = useAccountStore();
const router = useRouter();

// State für Modals
const showAccountModal = ref(false);
const showGroupModal = ref(false); // Modal für AccountGroup

// Ausgewähltes Konto / Gruppe
const selectedAccount = ref<Account | null>(null);
const selectedGroup = ref<AccountGroup | null>(null); // Ausgewählte Gruppe

// Bearbeitungsmodus
const isEditMode = ref(false);
const isGroupEditMode = ref(false); // Bearbeitungsmodus für Gruppen

// Alle Konten
const accounts = computed(() => accountStore.accounts);

// Kontogruppen
const accountGroups = computed(() => accountStore.accountGroups);

// Gibt den Namen der Kontogruppe zurück
const getGroupName = (groupId: string) => {
  const group = accountGroups.value.find((g) => g.id === groupId);
  return group ? group.name : "Unbekannt";
};

// Berechnet den Gesamtbetrag der Konten innerhalb einer Gruppe
const getGroupBalance = (groupId: string) => {
  return accounts.value
    .filter((account) => account.accountGroupId === groupId)
    .reduce((sum, account) => sum + account.balance, 0);
};

// Formatiert den Kontotyp für die Anzeige
const formatAccountType = (type: AccountType): string => {
  switch (type) {
    case AccountType.CHECKING:
      return "Girokonto";
    case AccountType.SAVINGS:
      return "Sparkonto";
    case AccountType.CREDIT:
      return "Kreditkarte";
    case AccountType.CASH:
      return "Bargeld";
    default:
      return "Unbekannt";
  }
};

// Konto bearbeiten
const editAccount = (account: Account) => {
  selectedAccount.value = account;
  isEditMode.value = true;
  showAccountModal.value = true;
};

// Neues Konto erstellen
const createAccount = () => {
  selectedAccount.value = null;
  isEditMode.value = false;
  showAccountModal.value = true;
};

// Konto speichern
const saveAccount = (accountData: Omit<Account, "id">) => {
  if (isEditMode.value && selectedAccount.value) {
    accountStore.updateAccount(selectedAccount.value.id, accountData);
  } else {
    accountStore.addAccount(accountData);
  }
  showAccountModal.value = false;
};

// Konto löschen
const deleteAccount = (account: Account) => {
  if (confirm(`Möchten Sie das Konto "${account.name}" wirklich löschen?`)) {
    accountStore.deleteAccount(account.id);
  }
};

// Konto einer anderen Gruppe zuweisen
const updateAccountGroup = (account: Account, newGroupId: string) => {
  accountStore.updateAccount(account.id, { accountGroupId: newGroupId });
};

// Gruppe bearbeiten
const editAccountGroup = (group: AccountGroup) => {
  selectedGroup.value = group;
  isGroupEditMode.value = true;
  showGroupModal.value = true;
};

// Neue Gruppe erstellen
const createAccountGroup = () => {
  selectedGroup.value = null;
  isGroupEditMode.value = false;
  showGroupModal.value = true;
};

// Gruppe speichern
const saveAccountGroup = (groupData: Omit<AccountGroup, "id">) => {
  if (isGroupEditMode.value && selectedGroup.value) {
    accountStore.updateAccountGroup(selectedGroup.value.id, groupData);
  } else {
    accountStore.addAccountGroup(groupData);
  }
  showGroupModal.value = false;
};

// Gruppe löschen
const deleteAccountGroup = (groupId: string) => {
  if (confirm(`Möchten Sie die Kontogruppe wirklich löschen?`)) {
    accountStore.deleteAccountGroup(groupId);
  }
};

// Button-Funktion: Monatssalden aktualisieren
const updateMonthlyBalances = () => {
  BalanceService.calculateMonthlyBalances();
};
</script>

<template>
  <div>
    <!-- Header mit Aktionen -->
    <div
      class="flex w-full justify-between items-center mb-6 flex-wrap md:flex-nowrap"
    >
      <h2 class="text-xl font-bold flex-shrink-0">Konten verwalten</h2>
      <div class="flex justify-end w-full md:w-auto mt-2 md:mt-0">
        <div class="join">
          <button
            class="btn join-item rounded-l-full btn-sm btn-soft border border-base-300"
            @click="createAccountGroup"
          >
            <Icon icon="mdi:folder-plus" class="mr-2 text-base" />
            Neue Gruppe
          </button>
          <button
            class="btn join-item rounded-r-full btn-sm btn-soft border border-base-300"
            @click="createAccount"
          >
            <Icon icon="mdi:plus" class="mr-2 text-base" />
            Neues Konto
          </button>
        </div>
        <!-- Neuer Button für manuelle Aktualisierung der Monatssalden -->
        <button
          class="btn btn-soft btn-sm ml-4 border border-base-300"
          @click="updateMonthlyBalances"
        >
          <Icon icon="mdi:refresh" class="mr-2 text-base" />
          Monatssalden aktualisieren
        </button>
      </div>
    </div>

    <!-- Konten -->
    <div class="card bg-base-100 shadow-md border border-base-300 mb-6">
      <div class="card-body">
        <h3 class="card-title text-lg mb-4">Konten</h3>
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th class="text-center">Gruppe</th>
                <th>Typ</th>
                <th class="text-right">Kontostand</th>
                <th class="text-center">Status</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in accounts" :key="account.id">
                <td>{{ account.name }}</td>
                <td>
                  <select
                    class="select select-sm w-full rounded-full border border-base-300"
                    :value="account.accountGroupId"
                    @change="updateAccountGroup(account, ($event.target as HTMLSelectElement).value)"
                  >
                    <option
                      v-for="group in accountGroups"
                      :key="group.id"
                      :value="group.id"
                    >
                      {{ group.name }}
                    </option>
                  </select>
                </td>
                <td>{{ formatAccountType(account.accountType) }}</td>
                <td class="text-right">
                  <CurrencyDisplay
                    class="text-right text-base whitespace-nowrap"
                    :amount="account.balance"
                    :show-zero="true"
                    :asInteger="false"
                  />
                </td>
                <td class="text-center">
                  <div
                    class="badge"
                    :class="account.isActive ? 'badge-success' : 'badge-error'"
                  >
                    {{ account.isActive ? "Aktiv" : "Inaktiv" }}
                  </div>
                </td>
                <td class="text-right">
                  <button
                    class="btn btn-ghost btn-xs"
                    @click="editAccount(account)"
                  >
                    <Icon icon="mdi:pencil" class="text-base" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="deleteAccount(account)"
                  >
                    <Icon icon="mdi:trash-can" class="text-base" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Kontogruppen -->
    <div class="card bg-base-100 shadow-md border border-base-300 mb-6">
      <div class="card-body">
        <h3 class="card-title text-lg mb-4">Kontogruppen</h3>
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th class="text-center">Sortierung</th>
                <th class="text-center">Anzahl Konten</th>
                <th class="text-right">Gesamtsaldo</th>
                <th class="text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="group in accountGroups" :key="group.id">
                <td>{{ group.name }}</td>
                <td class="text-center">{{ group.sortOrder }}</td>
                <td class="text-center">
                  {{
                    accounts.filter((a) => a.accountGroupId === group.id).length
                  }}
                </td>
                <td class="text-right">
                  <CurrencyDisplay
                    class="text-right text-base whitespace-nowrap"
                    :amount="getGroupBalance(group.id)"
                    :show-zero="true"
                    :asInteger="false"
                  />
                </td>
                <td class="text-right">
                  <button
                    class="btn btn-ghost btn-xs"
                    @click="editAccountGroup(group)"
                  >
                    <Icon icon="mdi:pencil" class="text-base" />
                  </button>
                  <button
                    class="btn btn-ghost btn-xs text-error"
                    @click="deleteAccountGroup(group.id)"
                  >
                    <Icon icon="mdi:trash-can" class="text-base" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Konto-Modal -->
    <div v-if="showAccountModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">
          {{ isEditMode ? "Konto bearbeiten" : "Neues Konto" }}
        </h3>

        <AccountForm
          :account="selectedAccount || undefined"
          :is-edit="isEditMode"
          @save="saveAccount"
          @cancel="showAccountModal = false"
        />
      </div>
      <div class="modal-backdrop" @click="showAccountModal = false"></div>
    </div>

    <!-- AccountGroup-Modal -->
    <div v-if="showGroupModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">
          {{ isGroupEditMode ? "Kontogruppe bearbeiten" : "Neue Kontogruppe" }}
        </h3>
        <AccountGroupForm
          :group="selectedGroup || undefined"
          :is-edit="isGroupEditMode"
          @save="saveAccountGroup"
          @cancel="showGroupModal = false"
        />
      </div>
      <div class="modal-backdrop" @click="showGroupModal = false"></div>
    </div>
  </div>
</template>
